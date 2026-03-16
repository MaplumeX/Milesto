## Why

Milesto 的产品方向明确是 `local-first`、可自建同步、冲突可解释且可回滚，但当前实现仍然是单设备本地 SQLite，尚无单用户多设备同步路径。现在核心实体已经具备稳定 ID 与基础时间戳字段，适合先把一条可落地、边界清晰的同步能力定义出来，为后续实现和演进建立契约。

## What Changes

- 新增可选的单用户多设备内容同步能力，使用 `S3-compatible` 仓库作为远端，支持自定义 `endpoint`、`region`、`bucket`、`prefix` 与 `path-style`。
- 新增同步配置与状态入口：用户可在 Settings 中配置仓库、测试连接、启用/停用同步、查看最后同步时间、查看最近错误并手动触发同步。
- 新增本地同步元数据与批处理机制：本地写操作会生成可上传的同步批次，设备间通过追加式远端批次日志实现秒级最终一致。
- 新增明确的冲突规则：普通字段按字段级 LWW 合并；软删除使用 tombstone；标签关系按一等同步对象处理；任务列表与 Sidebar 排序按整组后写胜出。
- 明确首版边界：仅同步内容数据（任务、项目、Area、标签、Checklist、标签关系、列表排序、Sidebar 排序/归属），不同步设备偏好设置；不支持多人协作、账号体系、IAM/SSO/浏览器登录流。

## Capabilities

### New Capabilities
- `single-user-s3-sync`: 单用户多设备内容同步，覆盖 S3-compatible 仓库配置、批次传播、事务应用、冲突处理与同步状态呈现。

### Modified Capabilities
- 

## Impact

- Renderer：`src/pages/SettingsPage.tsx` 需要新增 Sync 配置与状态 UI；可能需要在应用级别展示同步状态与错误提示。
- Shared Types / Schemas：需要新增 `window.api.sync.*`、同步配置/状态 schema、同步批次与冲突语义的共享类型。
- Main / Preload：需要新增同步服务与安全凭据存储能力，并通过 `window.api.sync.*` 暴露业务级接口；仍需遵守现有 IPC 与安全边界。
- DB Worker / SQLite：需要新增同步元数据表、关系/排序同步支撑，以及“本地写入同时产生日志”“远端批次事务应用”的能力。
- 依赖与系统能力：预计引入 `@aws-sdk/client-s3`；需要使用 Electron 的安全存储能力保存敏感凭据；测试需要覆盖同步协议、冲突规则与失败恢复。
