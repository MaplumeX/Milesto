## Context

- 当前仓库已经形成清晰的 Electron 分层：Renderer 只能通过 `window.api.*` 调用业务能力，Main 负责 IPC 网关与进程级服务，SQLite 访问全部收敛到 DB Worker。
- 核心内容实体（`tasks`、`projects`、`areas`、`tags`、`task_checklist_items`）已经具备稳定 ID，以及 `created_at` / `updated_at` / `deleted_at` 等基础字段，这为内容级同步提供了基础。
- 现有导入/导出能力是“快照式、覆盖式”的数据传输，更适合备份/恢复，不适合作为双向实时同步主链路。
- 当前设置存储位于 `app_settings`，适合保存非敏感偏好，但并不适合直接保存明文 S3 凭据。
- 现有重排能力本身就是“整批提交顺序”的事务语义：任务列表重排通过 `list_positions` 批量 upsert；Sidebar 的 Area / Project 排序和跨 Area 移动也是批量写入。这使“整组后写胜出”的排序冲突策略与现有实现天然对齐。
- 本次探索已经明确首版范围与约束：
  - 单用户，不做账号体系与多人协作。
  - 远端使用 `S3-compatible` 仓库，支持自定义 `endpoint` / `region` / `bucket` / `prefix` / `forcePathStyle`。
  - 认证仅支持手填 `Access Key ID` / `Secret Access Key` / 可选 `Session Token`。
  - “实时”定义为秒级最终一致：前台短轮询、后台长轮询、应用恢复焦点立即补同步。
  - 首版仅同步内容数据，不同步设备偏好（如 theme / locale / sidebar collapse）。

## Goals / Non-Goals

**Goals:**
- 为单个用户的多台设备提供可选的内容同步能力，且保持默认 `local-first`。
- 使用 `S3-compatible` 仓库实现内容批次传播，不绑定 AWS 官方托管场景。
- 所有本地业务写入都能在同一事务中生成可上传的同步批次，避免“内容已写入、本地同步日志未写入”的半套状态。
- 远端批次应用必须事务化、可重试、幂等，且失败时不得留下部分已应用的数据。
- 冲突语义明确且可解释：
  - 普通字段：字段级 LWW。
  - 软删除：tombstone 参与比较。
  - 标签关系：作为一等同步对象。
  - 列表与 Sidebar 排序：整组后写胜出。
- 同步配置、最近状态和错误可在 Settings 中查看与操作。

**Non-Goals:**
- 不实现多人协作、presence、实时协同编辑、评论或共享任务列表。
- 不实现 IAM / SSO / 浏览器登录 / OAuth 等认证方式。
- 不同步 `theme`、`locale`、`sidebar.collapsedAreaIds` 等设备偏好。
- 不把现有 `data.export` / `data.importOverwrite` 直接改造成同步协议。
- 不追求亚秒级推送；首版不引入额外的远端通知链路。
- 不要求应用退出后继续后台驻留同步。

## Decisions

### 1) 新增 Main 侧 `SyncService`，保持 Renderer / DB Worker 边界不变

选择：新增一个运行在 Main 进程的 `SyncService`，负责：
- 读取本地同步配置与安全凭据。
- 调用 S3-compatible 客户端上传/拉取批次。
- 按前台/后台/聚焦恢复节奏调度 push / pull。
- 通过受控的 `window.api.sync.*` 接口向 Renderer 暴露配置、状态、手动同步与启停能力。

DB Worker 继续只负责：
- 本地业务写事务。
- 记录本地同步批次。
- 事务应用远端批次。

理由：
- 符合现有 `Renderer -> window.api -> Main -> DB Worker` 边界，不把网络能力带进 Renderer 或 DB Worker。
- 便于集中处理凭据、重试、退避与应用级事件（窗口聚焦、网络错误、生命周期）。

备选方案：
- 让 DB Worker 直接访问 S3。拒绝：破坏“DB Worker 只做数据库”的职责边界，也会把网络错误和 DB 事务耦合在同一层。
- 让 Renderer 直接访问 S3。拒绝：违背现有安全边界，也会暴露凭据和协议细节到 UI。

### 2) 远端协议采用“每设备 append-only 批次日志”，避免共享写热点

选择：远端仓库采用每设备独立写入的追加式批次日志：

```text
repo/
  repo.json
  devices/<deviceId>/info.json
  devices/<deviceId>/changes/<seq>.json
  snapshots/<deviceId>/<seq>.json   // 可后置
```

约束：
- 每台设备只写自己的前缀。
- 其他设备只读，不改写远端全局游标。
- 每个批次对象一旦上传成功即不可变。

理由：
- 适配 AWS S3 与常见 `S3-compatible` 实现（MinIO、R2 等），不依赖所有端都写同一个高频 mutable manifest。
- 降低并发写冲突与锁协调复杂度。
- 每设备有天然的顺序序列号，便于本地 cursor 管理、重试与调试。

备选方案：
- 单个全局 `manifest.json` 维护所有游标与批次索引。拒绝：共享可变对象会放大兼容性和并发复杂度。
- 共享一个快照文件。拒绝：写冲突大、不可解释、无法自然表达增量与幂等。

### 3) 本地新增同步元数据表，并把“冲突裁决元数据”与业务表解耦

选择：本地新增最小同步元数据表：
- `sync_device_state`
  - 当前设备 ID、显示名称、HLC 状态、是否启用同步。
- `sync_outbox_batches`
  - 本地待上传批次、上传状态、重试计数、最近错误。
- `sync_remote_cursors`
  - 每个远端设备已消费到的最大序号。
- `sync_field_versions`
  - `(entity_type, entity_id, field_name)` -> `hlc`, `device_id`，用于字段级 LWW。
- `sync_list_versions`
  - `list_scope` -> `hlc`, `device_id`，用于列表/Sidebar 顺序的整组裁决。
- `sync_conflict_events`
  - 记录自动裁决结果，供日志与状态 UI 使用。
- `sync_credentials`
  - 本地加密凭据 blob，显式排除在导入/导出与同步之外。

同时调整关系表使其具备同步所需的墓碑能力：
- `task_tags`、`project_tags`、`area_tags` 增加 `updated_at` 与 `deleted_at`，将“移除标签关系”建模为 tombstone，而不是物理删除。

关于排序：
- `list_positions` 继续保留现有结构，不按单行记录做跨设备冲突裁决。
- 排序同步采用 `list.replaceOrder` 风格的批次操作，由 `sync_list_versions` 决定整组是否生效。

理由：
- `sync_field_versions` 允许字段级 LWW，而不必给每个业务表的每个字段单独加同步列。
- 关系表 tombstone 能正确表达“删除关系”并支持幂等重放。
- `sync_list_versions` 与现有 batch reorder 语义一致，避免把排序问题拆成大量脆弱的单行 delta。

备选方案：
- 直接依赖业务表的 `updated_at` 裁决所有冲突。拒绝：无法稳健处理时钟漂移，也不能满足字段级 LWW。
- 让排序也按单条 rank 记录同步。拒绝：不符合当前重排 API 语义，且多设备同时拖拽时更难解释。

### 4) 冲突裁决使用 `HLC + deviceId`，并按“字段 / 关系 / 列表”分层处理

选择：
- 每个本地提交批次都分配一个 HLC（Hybrid Logical Clock）。
- 普通字段更新会以 field patch 的形式进入批次，并更新 `sync_field_versions`。
- 标签关系更新使用独立操作与 tombstone。
- 软删除使用实体级 tombstone，并通过字段版本比较决定删除/恢复/编辑的胜负。
- 任务列表与 Sidebar 排序使用 `list_scope` 级别的整组裁决，后写胜出。

理由：
- HLC 兼顾可排序性和墙上时间可读性，比仅靠 `Date.now()` 更适合跨设备裁决。
- 字段、关系、列表三类数据本身语义不同，分层处理更简单，也更接近当前代码结构。

备选方案：
- 纯 Lamport Clock。可行，但会丢掉人类可读时间信息；HLC 更利于日志与调试。
- CRDT。拒绝：对单用户任务管理来说复杂度过高，与当前架构不匹配。

### 5) 本地业务写入必须在同一事务中产出同步批次

选择：所有会改变同步范围内内容的 DB Worker action，都要在原有业务事务内同时：
- 写业务表。
- 生成结构化同步操作。
- 更新 `sync_field_versions` / `sync_list_versions`。
- 追加到 `sync_outbox_batches`。

这包括：
- 实体创建 / 更新 / 软删除 / 恢复。
- 标签关系设置与移除。
- Checklist 项增删改。
- 任务列表重排。
- Sidebar Area / Project 排序与跨 Area 移动。

理由：
- 保证“本地内容状态”和“待同步意图”强一致。
- 避免应用崩溃后出现已改内容但无法上传的无日志状态。

备选方案：
- 由 Main 监听业务写结果后再异步补写 outbox。拒绝：无法保证原子性。

### 6) 同步配置分层保存：非敏感配置进本地 DB，敏感凭据使用 `safeStorage`

选择：
- 非敏感配置（`endpoint`、`region`、`bucket`、`prefix`、`forcePathStyle`、轮询间隔、设备名称）保存在本地 SQLite 的设置域中。
- 敏感凭据（`accessKeyId`、`secretAccessKey`、`sessionToken`）在 Main 侧使用 Electron `safeStorage` 加密后保存到 `sync_credentials`。
- 若当前环境无法提供可用的安全存储，则不允许启用持久化同步，并向用户返回结构化错误。

理由：
- 避免引入额外原生依赖，同时不把明文凭据暴露给 Renderer 或写入普通设置表。
- 明确区分“可同步/可导出配置”和“本机私有凭据”。

备选方案：
- 明文存进 `app_settings`。拒绝：安全边界过弱。
- 引入 `keytar`。可行，但会增加额外原生依赖与打包复杂度；首版不必。

### 7) Settings 提供最小但完整的同步操作面

选择：在 Settings 中新增 `Sync` 卡片，至少包含：
- 同步启用状态。
- 仓库配置表单。
- 测试连接。
- 启用 / 更新 / 停用同步。
- 当前设备名称。
- 最后成功同步时间。
- 当前同步状态（idle / syncing / error）。
- 最近错误（只展示 `code/message`）。
- `Sync now` 手动触发。

状态刷新节奏：
- 本地成功写入后触发短暂 debounce push。
- 前台短轮询，后台长轮询。
- 应用恢复焦点时立即补一次同步。

理由：
- 首版需要让用户能看见“是否在工作”，否则出错时不可操作。
- 不把细节散落到多个页面，符合当前 Settings 的集中配置模式。

## Risks / Trade-offs

- [关系表从物理删除转成 tombstone 后，查询复杂度上升] → 统一收敛到 DB Worker action 与 schema，读取侧始终过滤 `deleted_at IS NULL`。
- [排序采用整组后写胜出，会覆盖另一台设备几乎同时的拖拽结果] → 明确把排序定义为整组裁决，并在状态/UI 中记录最近一次冲突覆盖事件。
- [`safeStorage` 在部分 Linux 环境可能不可用] → 检测不可用时阻止启用同步，并返回明确错误；不回退到明文存储。
- [远端对象数量会随批次数增长] → 首版允许追加式增长；预留 `snapshots/` 与后续 compaction，但不在首版实现复杂压缩流程。
- [导入/导出与同步元数据混用会造成概念混淆] → 明确规定导入/导出只处理内容数据，不包含同步凭据、游标和 outbox。
- [跨 Area move 同时包含字段变更和列表重排，冲突处理较复杂] → 将其建模为同一批次中的字段操作 + 列表操作，远端应用时按当前归属对列表结果做 scope 校验与裁剪。

## Migration Plan

1. 新增 SQLite migration：
- 新增同步元数据表与 `sync_credentials`。
- 为 `task_tags` / `project_tags` / `area_tags` 增加 `updated_at` / `deleted_at`。

2. 保持现有内容表与导入/导出可继续工作：
- 内容实体 ID 与主表字段保持兼容。
- 同步元数据、凭据与设备游标不进入既有导出文件。

3. 首次启用同步时：
- 生成本地 `device_id` 与默认设备名称。
- 通过测试连接验证远端仓库。
- 成功后开始 push / pull 调度。

4. 回滚策略：
- 停用同步时只停止调度并保留本地内容，不删除用户数据。
- 若功能回滚到不支持同步的代码版本，新增表保留但不影响旧内容读取。

## Open Questions

- 首版是否需要在 UI 中展示“最近一次自动裁决的冲突摘要”，还是仅在日志/状态中保留即可？
- `snapshots/` 的 compaction 是要在第一阶段就留入口，还是等批次数与性能数据出现后再补？
