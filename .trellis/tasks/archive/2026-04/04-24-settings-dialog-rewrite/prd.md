# 重写设置模态框 UI

## Goal

完全重写 Milesto 的设置模态框（SettingsDialog）及其内部组件（GeneralSettingsPanel、SyncSettingsPanel），重新设计界面布局和视觉风格，使其与项目整体设计语言更一致，并提升用户体验。

## What I already know

- **当前结构**：SettingsDialog → Tab 切换（General/Sync）→ 各自 Panel
- **当前布局**：顶部标题 + Tab 栏 + 2列卡片网格
- **当前组件**：
  - General：语言选择、主题选择、导出/导入/重置数据、关于信息
  - Sync：状态指示、服务器 URL/Token 输入、连接控制
- **项目设计语言**：macOS 风格，柔和色彩，CSS 变量系统（light/dark），玻璃拟态元素，大量圆角，12px 基础字号
- **现有组件模式**：overlay-paper（大弹窗）、palette（搜索弹窗）、popover（浮层）、card（圆角卡片）
- **技术栈**：React 18 + TypeScript，纯 CSS（无 Tailwind），无外部 UI 库

## Assumptions (temporary)

- 保留现有功能逻辑（IPC 调用、状态管理不变）
- 保持模态框形式（非独立页面）
- 保留当前 CSS 变量系统和色彩体系
- 保持无障碍（a11y）特性（焦点陷阱、aria 属性等）

## Decision (ADR-lite)

**Context**: 需要在三种 UI 方向中选择一个，以确定设置模态框的整体视觉风格和布局基调。
**Decision**: 选择 **方案 C — Things 3 极简列表风格**。
- 无边框卡片，纯列表行用细线分割
- 分组用 section header，紧凑排列
- 与项目整体"简洁任务管理"气质最统一
- 实现最轻量，不引入新的布局范式
**Consequences**: 视觉变化相对克制，重点在于信息层次和间距的优化。

**导航结构决策**：保留顶部 Tab，但简化样式（去掉底部粗边框，用更柔和的 active 状态）。改动最小，用户习惯不变。

## Design Decisions

| 维度 | 选择 |
|------|------|
| 整体风格 | 方案 C — Things 3 极简列表风格 |
| 导航结构 | 保留顶部 Tab，简化样式（去掉粗边框，柔和 active 状态） |
| 图标使用 | 纯文字极简，完全不使用图标 |
| 模态框尺寸 | 保持当前 680px 宽（列表风格下足够） |

## Out of Scope (explicit)

- 新增设置功能（仅 redesign 现有功能）
- 修改 IPC / DB / 后端逻辑
- 修改设置数据存储格式

## Technical Notes

- 受影响文件：
  - `src/features/settings/SettingsDialog.tsx`
  - `src/features/settings/GeneralSettingsPanel.tsx`
  - `src/features/settings/SyncSettingsPanel.tsx`
  - `src/index.css`（settings 相关样式）
- 参考现有模式：overlay-paper, palette, card, popover 组件风格
- 项目 CSS 变量：`--bg`, `--panel`, `--text`, `--muted`, `--border`, `--shadow`, `--paper`, `--glass`, `--wash` 等

## Requirements (evolving)

- 重写 SettingsDialog 组件
- 重写或重构 GeneralSettingsPanel 和 SyncSettingsPanel
- 更新/替换相关 CSS 样式
- 保持所有现有功能不变
- 适配 light/dark 主题

## Acceptance Criteria (evolving)

- [ ] 设置对话框打开/关闭行为与当前一致
- [ ] 所有现有设置功能正常工作
- [ ] 支持 light/dark 主题切换
- [ ] 响应式适配（小屏幕）
- [ ] 无障碍属性完整
- [ ] Lint / typecheck 通过

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope (explicit)

- 新增设置功能（仅 redesign 现有功能）
- 修改 IPC / DB / 后端逻辑
- 修改设置数据存储格式

## Technical Notes

- 受影响文件：
  - `src/features/settings/SettingsDialog.tsx`
  - `src/features/settings/GeneralSettingsPanel.tsx`
  - `src/features/settings/SyncSettingsPanel.tsx`
  - `src/index.css`（settings 相关样式）
- 参考现有模式：overlay-paper, palette, card, popover 组件风格
- 项目 CSS 变量：`--bg`, `--panel`, `--text`, `--muted`, `--border`, `--shadow`, `--paper`, `--glass`, `--wash` 等
