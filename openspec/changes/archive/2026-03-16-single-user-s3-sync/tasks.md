## 1. Sync Data Model

- [x] 1.1 为 SQLite 增加同步元数据表：`sync_device_state`、`sync_outbox_batches`、`sync_remote_cursors`、`sync_field_versions`、`sync_list_versions`、`sync_conflict_events`、`sync_credentials`
- [x] 1.2 为 `task_tags`、`project_tags`、`area_tags` 增加 `updated_at` / `deleted_at`，把关系移除改为 tombstone 语义
- [x] 1.3 新增 shared schema / types：同步配置、同步状态、同步批次操作、冲突事件与 `window.api.sync.*`

## 2. DB Worker 同步能力

- [x] 2.1 抽取统一的同步记录辅助层，使所有同步范围内的本地写事务都能同时写业务表与 outbox 批次
- [x] 2.2 更新实体、Checklist、标签关系、任务重排、Sidebar 排序/移动等 DB action，使其写入字段版本或列表版本元数据
- [x] 2.3 新增 DB Worker action：读取同步状态、读取/保存非敏感同步配置、事务应用远端批次、记录冲突事件
- [x] 2.4 调整导入/导出边界，确保同步凭据、游标与 outbox 不进入用户内容导出/导入

## 3. Main / Preload / S3-Compatible Sync Service

- [x] 3.1 引入 `@aws-sdk/client-s3` 并封装支持自定义 `endpoint` / `region` / `bucket` / `prefix` / `forcePathStyle` 的仓库客户端
- [x] 3.2 在 Main 侧实现 `SyncService`：连接验证、push outbox、pull remote batches、前后台轮询、聚焦恢复补同步、错误退避
- [x] 3.3 使用 Electron 安全存储保存同步凭据，并通过新的 `window.api.sync.*` 暴露同步配置、状态、启停与 `Sync now`

## 4. Renderer 设置与状态呈现

- [x] 4.1 在 `src/pages/SettingsPage.tsx` 新增 Sync 卡片，提供仓库配置、连接测试、启用/停用、手动同步与状态显示
- [x] 4.2 在 Renderer 中接入同步状态刷新与错误呈现，确保仅展示结构化错误的 `code` / `message`

## 5. 冲突与一致性验证

- [x] 5.1 为 DB 层补充测试：outbox 原子生成、远端批次幂等应用、字段级 LWW、删除 tombstone、标签关系 tombstone
- [x] 5.2 为排序补充测试：任务列表重排与 Sidebar 排序在并发批次下按整组后写胜出收敛
- [x] 5.3 为 Main / SyncService 补充测试：S3-compatible 仓库读写、轮询节奏、失败退避与结构化错误返回

## 6. 验证

- [x] 6.1 运行 `npx tsc -p tsconfig.json`
- [x] 6.2 运行 `npm run test`
- [x] 6.3 运行 `npm run build`
