# 技术框架方案（Electron + React + shadcn/ui）

目标：跨平台桌面应用（macOS / Windows / Linux），单窗口多路由；本地离线数据库（SQLite），使用 `better-sqlite3` 且运行在 `worker_threads`；暂不考虑自动更新。

---

## 1. 关键决策

- 平台：macOS + Windows + Linux
- 应用形态：单窗口（一个 `BrowserWindow`）+ 多路由（推荐 `HashRouter`）
- UI：React 18 + shadcn/ui + Tailwind CSS
- 数据：本地 SQLite（`better-sqlite3`），数据库访问放在 `worker_threads`
- 分发：`electron-builder`（暂不接入 `electron-updater`）

---

## 2. 技术选型（推荐组合）

### 2.1 核心

- Electron + TypeScript
- React 18 + TypeScript
- 构建：`electron-vite`

### 2.2 UI 与交互

- 组件库：shadcn/ui
- 样式：Tailwind CSS
- 图标：`lucide-react`
- 表单：`react-hook-form` + `zod`

### 2.3 状态与数据

- 全局状态：`zustand`
- 异步缓存（可选）：`@tanstack/react-query`

### 2.4 数据库

- SQLite 驱动：`better-sqlite3`（原生依赖）
- 查询/迁移层：推荐 Drizzle（`drizzle-orm` + `drizzle-kit`），或 Kysely（二选一，不建议并存）

### 2.5 工程化

- 代码规范：ESLint + Prettier
- 类型检查：TypeScript `strict`
- Git hooks：husky + lint-staged
- 测试：Vitest（renderer/main/service）；（可选）Playwright Electron 做关键 e2e

---

## 3. 总体架构

Electron 分三层：Main（主进程）/ Preload（预加载）/ Renderer（渲染进程）。数据库在独立 DB Worker 中执行。

### 3.1 Main（主进程）

- 窗口生命周期、单实例锁、应用菜单/托盘（如需要）
- 启动/管理 DB Worker（重启策略、超时控制、退出清理）
- IPC 网关：参数校验 + 白名单通道 + 统一错误结构

### 3.2 DB Worker（worker_threads）

- 持有唯一的 SQLite 连接（`better-sqlite3`）
- 执行 migrations、CRUD、事务
- 串行处理请求（默认最稳，避免并发写锁与线程安全风险）

### 3.3 Preload（预加载）

- 通过 `contextBridge` 暴露最小 API：`window.api.*`
- 对外只暴露“业务级方法”，不暴露任意 SQL 或文件系统能力

### 3.4 Renderer（React）

- UI/路由/状态
- 仅调用 `window.api`，不直接使用 `ipcRenderer`

---

## 4. 安全基线（默认强制）

- `nodeIntegration: false`
- `contextIsolation: true`
- 禁止 remote（不使用 `@electron/remote`）
- IPC：白名单 channel；所有请求/响应做 schema 校验（zod）
- CSP：渲染进程启用 Content-Security-Policy（至少禁用 `unsafe-eval`，并按 Vite 资源策略配置）

---

## 5. 路由与窗口策略

### 5.1 单窗口多路由

- 推荐 `HashRouter`：避免 `file://` 场景下刷新/深链路由导致的路径问题
- 路由组织：`AppShell`（布局） + `pages/*`（路由页） + `features/*`（业务域）

### 5.2 单实例与窗口聚焦

- 使用单实例锁（`app.requestSingleInstanceLock()`）
- 二次启动时聚焦并还原主窗口（最小化/隐藏状态恢复）

---

## 6. IPC 设计规范

### 6.1 通道命名

- 按域命名：`db:*`、`settings:*`、`fs:*`、`app:*`
- 只使用 `ipcMain.handle` / `ipcRenderer.invoke`（请求-响应）

### 6.2 统一错误结构

建议所有失败都返回：

```ts
type AppError = {
  code: string;
  message: string;
  details?: unknown;
};
```

UI 只依赖 `code/message` 做提示与恢复动作，`details` 仅用于日志。

---

## 7. DB Worker 通信协议（建议固定）

### 7.1 消息格式

主进程 -> Worker：

```ts
type DbWorkerRequest = {
  id: string; // requestId
  type: "db";
  action: string; // e.g. "project.list"
  payload: unknown;
};
```

Worker -> 主进程：

```ts
type DbWorkerResponse =
  | { id: string; ok: true; data: unknown }
  | { id: string; ok: false; error: AppError };
```

### 7.2 超时与重启策略

- 主进程对每个请求设置超时（例如 30s）
- 超时或 Worker 崩溃：主进程可重启 Worker，并将错误以统一结构返回给 UI

### 7.3 API 形态（不要开放任意 SQL）

- 暴露业务级方法：`project.list/create/update/delete` 等
- 好处：权限可控、接口稳定、易测试、迁移可控

---

## 8. SQLite（better-sqlite3）与迁移策略

### 8.1 DB 文件路径

- `dbPath = path.join(app.getPath("userData"), "app.db")`
- DB 不放入 asar；随用户数据目录持久化

### 8.2 Migrations 打包与读取

- migrations 文件建议作为资源随安装包分发
- dev 环境读取项目路径；prod 环境读取 `process.resourcesPath` 下的 migrations

### 8.3 事务与一致性

- 所有写操作使用事务
- 导入/批量写入走单独 action，避免 UI 卡顿（由 Worker 执行）

---

## 9. 打包与发布（无自动更新）

### 9.1 electron-builder targets

- macOS：`dmg`
- Windows：`nsis`
- Linux：`AppImage`（可选加 `deb`）

### 9.2 原生依赖注意事项（better-sqlite3）

- `better-sqlite3` 是原生模块：通常需要在对应 OS 上构建对应产物（CI 矩阵构建最稳）
- 打包时启用 native rebuild（例如 `electron-builder install-app-deps` / `npmRebuild: true`）

---

## 10. 工程规范与 CI

### 10.1 本地脚本（建议）

- `dev`：开发模式（electron-vite）
- `lint`：eslint
- `typecheck`：`tsc --noEmit`
- `test`：vitest
- `dist`：electron-builder 打包

### 10.2 CI（GitHub Actions 建议）

- matrix：macos-latest / windows-latest / ubuntu-latest
- pipeline：install -> lint -> typecheck -> test -> build -> dist
- artifacts：上传 dmg/nsis/appimage

---

## 11. 里程碑（推荐交付顺序）

1) 初始化骨架：electron-vite + React + TS strict + HashRouter + shadcn/ui
2) 安全基线与 IPC：`window.api` + 白名单 + zod 校验 + 统一错误
3) DB Worker：通信协议 + 超时/重启 + 最小 CRUD action
4) Drizzle schema + migrations：dev/prod 路径策略打通（含基础索引/pragma 基线）
5) v0.1 MVP 关键基建：FTS5 搜索、列表虚拟滚动、Today/项目内排序持久化、JSON 导入/导出
6) 业务页面：AppShell + 核心列表/项目/标签/搜索/设置，贯通 DB->UI
7) 交互增强（v0.1 要求）：键盘优先快捷键 + 命令面板（Command Palette）
8) 打包验证：三平台产物可运行（重点验证 better-sqlite3 原生依赖）
9) v0.2/v0.3 预留：提醒/重复的调度边界、sync-ready 数据约束（UUID/soft delete/updated_at）

---

## 12. 性能策略（对齐 PRD 指标）

PRD 要求：10k 任务规模下搜索首屏 < 200ms，列表滚动无明显卡顿；冷启动到可交互目标 < 1s（桌面环境）。

### 12.1 SQLite 运行参数（建议基线）

- WAL：提升并发读写体验
  - `PRAGMA journal_mode = WAL;`
- 外键约束：保持数据一致性
  - `PRAGMA foreign_keys = ON;`
- busy timeout：减少偶发写锁导致的失败
  - `PRAGMA busy_timeout = 5000;`（按需要调整）
- 同步级别：平衡性能与安全（根据数据丢失容忍度选择）
  - 建议从 `NORMAL` 开始评估；对“绝不丢”的场景再上 `FULL`

注意：上述 pragma 建议在 DB Worker 打开连接后、执行迁移前设置。

### 12.2 查询与渲染策略

- 列表页只取必要字段（避免把 `notes`/checklist 大文本每次都读出来）
- 详情页按需加载 `notes`、checklist、重复规则等扩展字段
- 任务列表默认做虚拟滚动（10k 规模必需）
  - 推荐：`@tanstack/react-virtual` 或 `react-window`（二选一）

---

## 13. 搜索方案（FTS5 优先）

PRD v0.1 需要全局搜索（title + notes），且对性能有硬指标。建议从一开始就走 SQLite FTS5，避免后期从 `LIKE` 迁移。

### 13.1 FTS5 表设计（概念）

- `tasks`：主表（结构化字段）
- `tasks_fts`：FTS 虚表（`title`、`notes`）
- 维护策略：用 triggers 保持 `tasks_fts` 与 `tasks` 一致

### 13.2 搜索接口约束

- Worker action 建议为 `task.search(query, filters)`
- filters 至少支持：`status`（open/done）以及是否包含 Logbook
- 结果返回：先返回 id 列表与高亮片段（如需要），UI 再按 id 批量拉取列表字段

---

## 14. 键盘优先与命令面板（对齐 PRD 交互目标）

PRD 强调低摩擦与键盘优先。建议把“命令”抽象成可复用的 command registry。

### 14.1 快捷键分层

- 应用级快捷键（Main）
  - 建议优先使用菜单 `accelerator`（更符合平台习惯、冲突更少）
  - 避免上来就大量使用 `globalShortcut` 抢占系统快捷键
- 页面级快捷键（Renderer）
  - 例如：列表上下移动、完成任务、进入搜索框

### 14.2 命令面板（Command Palette）

- 建议引入 `cmdk`（shadcn 社区常用组合），实现统一的“搜索 + 执行命令”入口
- 命令面板支持：跳转列表/项目、创建任务、切换视图、打开设置、触发导出等

---

## 15. 排序持久化（Today/项目内排序）

PRD v0.1 要求 Today 与项目内任务排序可拖拽/快捷键移动，并在重启后保持。

### 15.1 不建议仅靠单一 `order` 字段

Today 排序与项目内排序通常是两套位置体系；如果只用一个 `order`，会导致不同视图互相干扰。

### 15.2 推荐：独立的 list positions 表

建议建表（概念）：`list_positions(list_id, task_id, rank)`

- `list_id` 示例：`today`、`project:<projectId>`、`tag:<tagId>`（是否包含 tag 视图排序由产品决定）
- `rank`：可插入的排序键，避免每次移动都全量重排
  - 推荐把 rank 存为 `TEXT`（lexicographic rank / LexoRank 风格）或 `REAL`（有精度风险，慎用）
- 约束：`UNIQUE(list_id, task_id)`

DB Worker 提供 action：

- `task.move(listId, taskId, beforeTaskId | afterTaskId)`
- `task.reorder(listId, orderedTaskIds[])`（导入/修复用）

---

## 16. 导入/导出（JSON）与版本化

PRD v0.1 将导入/导出列为 P0。建议把它当作“数据可迁移性”基建，而不是临时工具。

### 16.1 导出格式（建议）

- 顶层元信息：
  - `schema_version`
  - `app_version`
  - `exported_at`
- 数据体：`tasks/projects/tags/areas` + 关系（多对多用 join 表或显式数组）

### 16.2 导入策略（最低要求）

- 全程事务：导入失败必须回滚，不能留下半套数据
- 去重/重复导入保护：至少给出策略占位
  - 方案 A：提示覆盖（清空后导入）
  - 方案 B：按 id 合并（同 id 更新，不同 id 新增）
- 导入过程跑在 DB Worker，UI 显示进度/结果摘要

---

## 17. v0.2 架构占位：提醒与重复任务

虽然 v0.1 不做提醒/重复，但建议提前预留模块边界，避免 v0.2 侵入式改造。

### 17.1 提醒（Reminders）

- 最小模型：`reminder_at`（单一时间点）或 `reminders[]`（可扩展）
- 调度器位置：建议在 Main（或独立 worker）中实现 reminder scheduler
  - 应用启动时扫描近期提醒并设置 timer
  - 先保证“应用内提醒可见”，再逐步接系统通知（跨平台差异更大）
- 不打扰原则：提醒必须可静默/可关闭

### 17.2 重复任务（Repeat Rules）

- 幂等性是核心：同一规则在同一周期只能生成一次
- 可追溯：生成的任务必须能追到来源规则（例如 `generated_from_rule_id`）
- 生成逻辑建议放 DB Worker（事务内完成：写入生成记录 + 写入新任务）

---

## 18. v0.3 架构占位：同步就绪（Sync-ready）原则

v0.3 才做同步 PoC，但 v0.1 的数据模型与基础约束应尽量避免“封死同步”。

- ID 策略：从一开始就用 UUID（建议 UUIDv7）而非自增整数
- 软删除：建议预留 `deleted_at`（同步与导入合并时更可控）
- 变更时间：`updated_at` 必须可靠更新（冲突检测基础）
- 冲突可解释：未来需要展示字段差异，因此建议字段拆分清晰、避免把大量状态塞进单个 JSON blob

备注：同步引擎、冲突解决 UI、同步日志等属于 v0.3 实现范围，这里仅定义“别把路堵死”的基础原则。
