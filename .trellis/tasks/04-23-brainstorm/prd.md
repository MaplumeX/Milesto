# brainstorm: 删除云同步功能

## Goal

从 Milesto 中移除当前的单用户 S3 兼容云同步能力，收敛产品定位为纯本地优先桌面任务管理器，同时保证现有本地任务/项目/标签等核心功能不回归，旧用户升级后不会因为历史同步配置或同步元数据导致应用启动/读写异常。

## What I already know

* 当前同步功能不是孤立模块，而是贯穿四层架构：
  * Renderer：`src/features/settings/SyncSettingsPanel.tsx`、`src/features/settings/SettingsDialog.tsx`、`src/pages/SettingsPage.tsx`
  * Shared contract：`shared/schemas/sync.ts`、`shared/window-api.ts`
  * Preload / Main：`electron/preload.ts`、`electron/main.ts`
  * Main sync runtime：`electron/sync/*`
  * DB Worker：`electron/workers/db/actions/sync-actions.ts`、`electron/workers/db/actions/sync-support.ts`
* 当前设置弹窗明确存在 `General` / `Sync` 两个 tab，`Sync` tab 承载状态展示、S3 配置、凭据、启停和手动同步操作。
* `window.api.sync.*` 已对 Renderer 暴露 7 个接口：`getState`、`getCredentials`、`testConnection`、`saveConfiguration`、`enable`、`disable`、`syncNow`。
* `electron/main.ts` 在应用启动时总是创建 `SyncService`、`S3SyncRepository`、`ElectronSyncCredentialsStore`，并注册 `sync:*` IPC 以及焦点/失焦触发的同步调度。
* DB 初始化会创建多张同步专用表：`sync_device_state`、`sync_outbox_batches`、`sync_remote_cursors`、`sync_field_versions`、`sync_list_versions`、`sync_conflict_events`、`sync_credentials`。
* 同步配置保存在 `app_settings.key = 'sync.config'`；同步凭据经过 Electron `safeStorage` 加密后再落到 `sync_credentials` 表。
* 各类本地写操作并非“纯 CRUD”，而是通过 `createLocalSyncRecorder()` 将实体变更、关系变更、列表顺序变更写入 outbox 和版本表；涉及 task / project / area / tag / checklist / sidebar / trash / section move 等多条写路径。
* 数据导出/导入当前已经显式排除了同步凭据、remote cursor、outbox 等同步内部状态，这说明删除同步不会改变导入导出的用户数据模型，但需要处理历史残留元数据。
* 依赖层面当前存在 `@aws-sdk/client-s3`，删除同步后应一并移除。
* 规格层面已有 `openspec/specs/single-user-s3-sync/spec.md` 和 `openspec/specs/settings-dialog/spec.md` 中关于 Sync tab 的约束，需要同步删改。

## Assumptions (temporary)

* 目标是“彻底删除”云同步能力，而不是仅在 UI 上隐藏入口。
* 本地数据仍然是唯一保留的数据源，不需要保留任何跨设备合并、冲突解决、outbox 重放能力。
* 允许在升级过程中保留旧数据库中的同步表直到一次性清理完成，但最终代码不再依赖这些表。
* 删除同步后，设置界面应只保留非同步设置。

## Open Questions

* 是否要求在本次改动中对旧数据库做“一次性清理”（删除 `sync_*` 表、清空 `sync.config` 与加密凭据），还是只做到代码不再读取这些历史数据？

## Requirements (evolving)

* 删除所有面向用户的云同步能力，包括设置入口、状态展示、配置表单、启停控制、手动同步操作。
* 删除 Shared / Preload / Main 中所有 `sync` 业务契约与 IPC 暴露。
* 删除 Main 进程中的同步运行时：`SyncService`、S3 仓库访问、凭据存储桥接、焦点触发轮询。
* 将 DB Worker 的本地写路径从“写业务数据 + 录制同步元数据”简化为“仅写业务数据”，保持事务性和现有业务语义不变。
* 删除 DB 中对同步专用状态/版本/outbox/凭据的读写依赖。
* 移除同步相关依赖、测试、i18n 文案和规格文档。
* 旧用户升级后，本地数据仍可正常打开、编辑、导入导出、重置。

## Acceptance Criteria (evolving)

* [ ] 设置弹窗与设置页中不再出现 `Sync` tab / `Sync` 面板，也不存在同步相关文案和按钮。
* [ ] `window.api`、`preload`、`main` 中不再存在 `sync:*` API / IPC。
* [ ] 应用启动不再初始化任何同步服务、S3 仓库或凭据存储桥接。
* [ ] task / project / area / tag / checklist / sidebar / trash / section 相关写操作不再依赖同步录制逻辑，现有本地行为保持一致。
* [ ] 构建结果中不再依赖 `@aws-sdk/client-s3`。
* [ ] 现有本地数据文件可正常升级使用；如果选择做清理迁移，历史同步配置与凭据不会残留为死数据。
* [ ] 同步相关测试和规格被删除或改写，剩余测试覆盖新的本地优先行为。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不新增新的同步方案或替代云能力
* 不引入账号系统或远程备份
* 不改变导入/导出的核心数据模型
* 不顺带重构无关设置项或页面结构

## Technical Notes

* 推荐方案：分两阶段做“彻底删除”
  * 阶段 1：产品与运行时移除
    * 删除 Sync UI、i18n、`window.api.sync.*`、`sync:*` IPC、`electron/sync/*`
    * 停止在 `main.ts` 中创建/启动 `SyncService`
    * 移除 `@aws-sdk/client-s3`
  * 阶段 2：数据层去同步耦合
    * 删除 `sync-actions.ts`
    * 将各类业务 action 中的 `createLocalSyncRecorder()` / `replace*Tags()` 同步扩展替换为纯本地写逻辑
    * 处理 `db-bootstrap.ts` 中的同步表创建逻辑，以及旧库兼容/清理策略
* 不推荐方案：只隐藏 UI、保留后端同步逻辑
  * 优点：短期改动小
  * 缺点：死代码、隐式状态、AWS 依赖、测试负担、后续维护成本都还在，不符合本任务目标
* 关键风险
  * 最大风险不在 S3 访问，而在 DB 写路径已经和同步录制深度耦合，删错容易破坏本地事务行为
  * `db.resetAllData` / import 目前不会清理同步元数据，若选择做彻底删除，需明确历史残留的处理策略
  * 规格文档中明确要求存在 Sync tab，因此实现删除时必须同步更新 openspec
* 已检查文件
  * `shared/window-api.ts`
  * `shared/schemas/sync.ts`
  * `electron/preload.ts`
  * `electron/main.ts`
  * `electron/sync/electron-sync-credentials-store.ts`
  * `electron/sync/sync-service.ts`
  * `electron/workers/db/db-bootstrap.ts`
  * `electron/workers/db/db-handlers.ts`
  * `electron/workers/db/actions/sync-support.ts`
  * `electron/workers/db/actions/data-transfer-actions.ts`
  * `src/features/settings/SettingsDialog.tsx`
  * `src/features/settings/SyncSettingsPanel.tsx`
  * `tests/db/sync-db.test.ts`
  * `tests/renderer/settings-dialog.test.tsx`

## Implementation Steps

### Step 1: 删除用户可见入口

* 删除 `src/features/settings/SyncSettingsPanel.tsx`
* 删除 `src/features/settings/SyncSettingsCard.tsx`
* 修改 `src/features/settings/SettingsDialog.tsx`
  * 去掉 `Sync` tab
  * `SettingsTabId` 收敛为仅 `general`
* 修改 `src/pages/SettingsPage.tsx`
  * 去掉页面中的同步面板
* 修改 `shared/i18n/messages.ts`
  * 删除同步相关文案 key
* 删除或改写 Renderer 测试
  * `tests/renderer/settings-page-sync.test.tsx`
  * `tests/renderer/settings-dialog.test.tsx`

验证点：
* 设置弹窗只剩 General 内容
* 设置页不再渲染同步卡片
* i18n key 集合保持同步

### Step 2: 删除 Shared / Preload / Main 的同步契约

* 删除 `shared/schemas/sync.ts`
* 修改 `shared/schemas/index.ts`
  * 去掉 `sync` 导出
* 修改 `shared/window-api.ts`
  * 删除 `sync` API contract
* 修改 `electron/preload.ts`
  * 删除 `api.sync`
* 修改 `tests/renderer/window-api-mock.ts` 及测试 mock
  * 删除或替换对 `window.api.sync` 的依赖

验证点：
* Renderer 编译通过
* 不再有任何 `window.api.sync.*` 调用

### Step 3: 删除 Main 进程同步运行时

* 删除 `electron/sync/electron-sync-credentials-store.ts`
* 删除 `electron/sync/main-sync-bridge.ts`
* 删除 `electron/sync/s3-sync-repository.ts`
* 删除 `electron/sync/sync-service.ts`
* 修改 `electron/main.ts`
  * 删除 sync import
  * 删除 `syncMutationActions`
  * 删除 `sync:*` IPC handler
  * 删除应用启动时的 `SyncService` / `S3SyncRepository` / credentials store 初始化
  * 删除窗口焦点同步调度
* 删除对应单测
  * `tests/unit/sync-service.test.ts`
  * `tests/unit/s3-sync-repository.test.ts`

验证点：
* 应用启动路径不再构造任何同步对象
* Main 进程不再注册 `sync:*` IPC

### Step 4: 拆除 DB Worker 中的同步录制耦合

* 删除 `electron/workers/db/actions/sync-actions.ts`
* 删除 `electron/workers/db/actions/sync-support.ts`
* 修改 `electron/workers/db/db-handlers.ts`
  * 删除 sync handler 注册
* 逐个改造以下 action 文件，移除 `createLocalSyncRecorder()` 与 `replace*Tags()` 依赖：
  * `task-actions.ts`
  * `project-actions.ts`
  * `area-actions.ts`
  * `tag-actions.ts`
  * `checklist-actions.ts`
  * `list-position-actions.ts`
  * `sidebar-actions.ts`
  * `trash-actions.ts`
* 改造方式：
  * 保留原有业务事务边界
  * 去掉 outbox / field version / list version 写入
  * 对 tag 替换逻辑，抽出纯本地版本的 `replaceTaskTags` / `replaceProjectTags` / `replaceAreaTags`，只维护关系表与 `updated_at`

验证点：
* task / project / area / tag / checklist / sidebar / trash 的本地 CRUD 行为保持不变
* 列表排序、section move、trash restore/purge 等事务型场景不回归

### Step 5: 处理数据库初始化与历史残留

* 修改 `electron/workers/db/db-bootstrap.ts`
  * 删除新库初始化时创建 `sync_*` 表的逻辑
* 处理旧库升级策略，建议二选一：
  * 方案 A：保留旧 `sync_*` 表，不再读写
  * 方案 B：在新 migration 中删除 `sync_*` 表、删除 `app_settings` 中的 `sync.config`
* 若采用方案 B，还需要在应用启动或 migration 中清理历史凭据残留
  * `sync_credentials`
  * Electron 安全存储对应 blob

建议：
* 本任务优先采用方案 B，避免留下不可见死数据

验证点：
* 新库不会生成同步表
* 旧库升级后可正常打开
* 历史同步配置不会影响启动与写操作

### Step 6: 移除依赖与测试

* 修改 `package.json`
  * 删除 `@aws-sdk/client-s3`
* 更新 lockfile
* 删除 DB 同步测试
  * `tests/db/sync-db.test.ts`
* 改写受同步影响的 DB 测试
  * `tests/db/project-section-move.test.ts`
  * `tests/db/trash-actions.test.ts`
  * 其他直接查询 `sync_outbox_batches` / `sync_*` 表的测试
* 改写 openspec
  * 删除或废弃 `openspec/specs/single-user-s3-sync/spec.md`
  * 更新 `openspec/specs/settings-dialog/spec.md`

验证点：
* `npm run lint`
* `npm run test`
* `npm run test:db`

## Recommended Execution Order

1. 先删 UI、i18n、`window.api.sync`，快速收口产品表面。
2. 再删 Main sync runtime，避免启动路径继续依赖同步实现。
3. 然后集中处理 DB Worker 去耦，这是主要工作量。
4. 最后做 migration/清理、测试修正和文档收尾。

## Suggested Commit Slices

* Slice 1: remove sync UI and public renderer contracts
* Slice 2: remove main-process sync runtime and IPC
* Slice 3: remove DB sync recording and sync-specific tables
* Slice 4: cleanup tests, docs, and dependencies
