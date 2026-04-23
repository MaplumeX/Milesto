# 云端实时同步 + 自部署服务端

## Goal

为 Milesto 添加云端实时同步能力，让用户可以在多台设备间实时同步任务数据。服务端需要支持用户自部署（Docker 或单二进制），部署门槛要低。

## What I already know

- Milesto 是 Electron + React + TypeScript 桌面应用，本地 SQLite 存储
- 四层架构：Renderer → Preload → Main Process → DB Worker，IPC 经过 Zod 校验
- 所有实体表已有 `created_at`、`updated_at`、`deleted_at` 字段（软删除模式）
- 旧 S3 同步已完全移除，sync 目录为空
- 数据模型：areas、projects、project_sections、tasks、tags、task_tags、task_checklist_items、list_positions
- 没有全局状态管理，用 revision counter + 重新拉取做跨视图刷新

## Assumptions (temporary)

- 用户自部署 = 单用户或小团队场景，不需要复杂的多租户
- 实时同步 = 一个设备上的修改应在秒级同步到其他在线设备
- 离线优先 = 应用在无网环境下应能正常使用，联网后自动同步

## Open Questions

- ~~同步协议选择~~ → **WebSocket 全双工推送**（已确定）
- 冲突解决策略
- 服务端技术栈偏好
- 认证方式（自部署场景下如何简化）
- 是否需要端到端加密

## Decisions

### 同步协议：WebSocket 全双工推送
- 客户端 ↔ 服务端通过 WebSocket 建立持久连接
- 服务端向所有在线客户端广播变更
- 断线后自动重连 + 增量同步补齐

### 冲突解决：全局 Last-Write-Wins（LWW）
- 以整行为同步单位，`updated_at` 晚的覆盖早的
- 不引入字段级版本向量或 CRDT，保持实现简单
- 列表重排等边界并发冲突可接受（概率低，可手动修正）

### 服务端技术栈：Node.js + TypeScript
- 复用 `shared/` 目录的 Zod schemas 和类型定义
- Docker 部署，Alpine 基础镜像
- 生态成熟，开发效率高

### 同步数据模型：状态快照（State Snapshot）
- 服务端维护完整实体表（和本地 SQLite 结构一致）
- 客户端发送变更后的完整实体，服务端 LWW 比较后更新
- 离线重连时拉取所有 `updated_at > last_sync_at` 的实体
- 广播时推送变更后的完整实体

### 安全：端到端加密（E2EE）
- 任务内容（title, notes 等）在客户端加密后才上传
- 服务端只存储密文，无法读取用户数据
- 冲突解决在客户端完成（服务端看不到 updated_at）
- 传输层额外加 TLS

### 范围：单用户 + 跨平台预留
- MVP 仅支持单用户多设备同步
- 协议设计预留多设备/跨平台扩展点（统一的消息格式、版本标识）

### 仓库结构：独立仓库
- 服务端代码放在独立 Git 仓库（如 `milesto-server`）
- `shared/` schemas 通过构建脚本复制同步（`sync-schemas.sh`）
- 长期可演进为 npm package

### 本地变更推送：定时轮询
- 连接成功后每 5 秒检查一次本地变更（`updated_at > last_sync_at`）
- 有变更时自动推送到服务端
- 远程变更通过 WebSocket 广播实时接收

## Requirements (evolving)

- 多设备实时同步
- 离线支持（本地优先，联网后自动同步）
- 冲突解决机制
- 服务端可自部署（Docker / 单二进制）
- 部署简单（尽量零配置或极少配置）

## Acceptance Criteria (evolving)

- [x] 两台设备登录同一账号后，一端修改另一端实时收到
- [x] 断网后正常操作，恢复网络后自动补齐
- [x] 并发修改同一任务时有明确的冲突解决行为（LWW）
- [x] 服务端可通过 Docker 一键启动
- [x] 同步数据在传输中加密（TLS + E2EE）
- [ ] 集成测试覆盖多端同步场景

## Definition of Done

- [x] Lint / typecheck 零警告
- [x] 服务端有 README 部署说明
- [x] 客户端同步 UI 状态可见
- [ ] 测试覆盖同步核心逻辑（单元 + DB 测试）

## Out of Scope (explicit)

- 多用户协作（共享项目等）
- 服务端管理后台
- 第三方登录（OAuth）
- 文件附件同步

## Technical Notes

- DB v9 migration：新增 `sync_state` 表（last_sync_at、server_url、sync_token、sync_enabled）
- 所有 10 种实体类型支持同步：task、project、area、tag、checklist_item、project_section、list_position、task_tag、project_tag、area_tag
- IPC 架构：`renderer ↔ preload ↔ main(sync-engine) ↔ db-worker(sync-actions)`
- E2EE：HKDF 派生密钥 + AES-256-GCM，metadata 明文用于路由和 LWW
- 心跳保活：服务端 30s ping / 客户端 pong，90s 超时断开
