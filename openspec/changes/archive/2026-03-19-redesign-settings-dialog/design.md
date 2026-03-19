## Context

当前设置 UI 通过 `AppRouter` 暴露为 `/settings` 路由，并在 `Outlet` 内容区内渲染 `SettingsPage`。这导致两个问题：

1. 打开设置会替换当前工作内容，用户离开当前列表或项目上下文。
2. 设置内容已经扩展到包含同步配置，但仍然沿用单页纵向堆叠，信息层级不清晰。

本次改动横跨 `AppShell`、路由、设置内容组件、样式和 self-test，属于典型的跨模块 UI 容器重构。现有 `window.api.settings.*`、`window.api.sync.*`、`window.api.data.*` 接口已经满足需求，因此设计重点应放在 Renderer 侧的容器职责重组，而不是新增跨进程能力。

## Goals / Non-Goals

**Goals:**

- 将设置从独立路由页重构为中央模态弹窗，同时保留背景页面上下文。
- 将设置内容拆分为 `常规` / `同步` 两个 tab，降低信息噪声。
- 保持现有语言、主题、数据导入导出、同步配置和同步控制能力不变。
- 定义稳定的模态交互：焦点进入、焦点陷阱、遮罩关闭、`Esc` 关闭、焦点恢复。
- 用最小改造路径替换现有 `/settings` 入口，并更新 self-test。

**Non-Goals:**

- 不引入新的设置后端接口或新的 IPC 通道。
- 不重做同步逻辑、凭据存储或 S3 配置字段集合。
- 不引入全局 overlay manager 来统一管理所有浮层。
- 不在本次变更中重做“重置所有数据”的原生 `confirm()` 交互样式。

## Decisions

### 1. Settings UI will be owned by `AppShell`, not `AppRouter`

将设置弹窗状态挂在 `AppShell`，由侧边栏设置按钮直接打开，而不是保留 `/settings` 路由并在路由层做“伪弹窗”。

Rationale:

- 设置是全局 UI 容器，不属于任何单个页面领域。
- 当前项目已经使用 portal 式全局浮层模式，例如搜索面板；继续沿用最简单。
- 这样可以保留 `Outlet` 当前页面状态，不需要为“关闭后返回哪里”维护额外导航状态。

Alternatives considered:

- 保留 `/settings` 路由并将其渲染成 modal：会让页面语义和容器语义混杂，增加关闭与回退处理复杂度。
- 新建统一 overlay manager：扩展性更强，但对当前目标是过度设计。

### 2. Settings content will be split into dialog shell + tab panels

将当前 `SettingsPage` 拆分为：

- `SettingsDialog`：模态壳层、遮罩、焦点与关闭语义
- `GeneralSettingsPanel`：语言、主题、数据工具、关于
- `SyncSettingsPanel`：复用现有同步逻辑，改造成 tab 内容

Rationale:

- 单一职责更明确，避免一个 page 文件同时承担容器和内容职责。
- `SyncSettingsPanel` 可保留现有状态轮询与 action 逻辑，只调整布局边界。
- 后续如果增加更多 tab，可以稳定扩展而不是继续堆大单文件。

Alternative considered:

- 保留 `SettingsPage` 作为容器并塞进 dialog：迁移快，但长期会保留错误命名和职责混乱。

### 3. Tab layout is asymmetric by intent

- `General` tab 使用紧凑双列布局
- `Sync` tab 使用单列纵向布局

Rationale:

- `General` 内容短、低频、动作少，双列更适合快速扫读和快速关闭。
- `Sync` 字段多、状态多、错误与安全信息更重要，单列可读性更高，也更适合窄窗口降级。

Alternative considered:

- 两个 tab 都用双列：统一但会压缩同步字段。
- 两个 tab 都用单列：简单但丢失了 `General` tab 的紧凑优势。

### 4. Modal behavior follows standard, strict accessibility semantics

设置弹窗应实现：

- 打开后焦点进入弹窗
- 弹窗内部焦点陷阱
- `Esc` 关闭
- 点击遮罩关闭
- 关闭后焦点回到触发按钮
- 背景滚动与交互锁定

Rationale:

- 这类行为是标准模态期望，用户成本最低。
- 仓库 `docs/ui.md` 明确要求弹窗打开时焦点陷阱正确，关闭后焦点回到触发点。

Alternative considered:

- 仅视觉遮罩，不做完整焦点管理：实现更快，但属于明显回退。

### 5. Existing APIs remain stable; only UI composition changes

语言、主题、同步和数据导入导出的调用路径保持不变，仍由现有 `window.api.*` 方法承载。

Rationale:

- 这次 change 是 UI 容器和信息架构重构，不涉及主进程或 preload 能力变化。
- 保持 API 稳定可以把实现风险控制在 Renderer 范围内。

## Risks / Trade-offs

- [AppShell responsibilities grow] → 仅把“设置是否打开、当前 tab、焦点恢复”放在 `AppShell`，把弹窗内容与行为封装进独立组件，避免继续堆叠业务逻辑。
- [Removing `/settings` can break self-tests or stale deep links] → 同步更新 `selfTest.ts`，并在实现时全局搜索 `/settings` 相关入口，确保没有残留依赖。
- [Sync panel may become too tall] → 使用固定头部 + 内容区独立滚动；同步 tab 保持单列，避免横向压缩。
- [Dialog close behavior can lose keyboard context] → 持有触发按钮引用，并在关闭后显式恢复焦点。
- [Layout regression on narrow windows] → `General` tab 在不足够宽时自动降为单列；`Sync` tab 始终单列。

## Migration Plan

1. 在 `AppShell` 中增加设置弹窗状态、设置入口按钮与 portal 渲染。
2. 新建设置弹窗壳层与 tab 容器，迁移 `SettingsPage` 的通用设置内容到 `GeneralSettingsPanel`。
3. 将 `SyncSettingsCard` 重构为 `SyncSettingsPanel`，保留现有同步逻辑与测试标识。
4. 移除 `AppRouter` 中的 `/settings` 路由以及任何 `NavLink` 形式的设置入口。
5. 更新样式与 self-test，验证主题切换与同步控制未回退。

Rollback strategy:

- 若实现阶段出现不可接受的 modal 回归，可临时恢复 `/settings` 路由和旧入口，但这应只作为开发期回退，不作为长期兼容方案。

## Open Questions

- 暂无阻塞实现的开放问题。当前已确认：
  - 不使用 `/settings` 路由
  - 采用标准模态关闭语义
  - `General` 双列、`Sync` 单列
