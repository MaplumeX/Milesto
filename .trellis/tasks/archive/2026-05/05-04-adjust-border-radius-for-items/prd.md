# Adjust Border Radius for Items

## Goal

统一调整 Milesto 应用中各种条目（任务行、侧边栏项、项目项等）的圆角，使视觉风格更一致。

## What I already know

* 所有 border-radius 定义集中在 `src/index.css`（约 73 处声明）
* 当前圆角值分布：0, 1px, 2px, 3px, 4px, 5px, 6px, 7px, 8px, 10px, 12px, 14px, 16px, 22px, 50%, 999px
* 无设计 token 体系，无 CSS 变量管理圆角
* 主要条目级圆角：
  - 8px: nav-item, select-item, tag-picker-item, button-ghost, checklist-empty-entry, search-result-row
  - 10px: task-row.is-selected, project-group-header.is-selected, sidebar-dnd-overlay, task-dnd-overlay
  - 12px: .input, .button, .select-content, .select-trigger, task-inline-paper, project-section-dnd-overlay
  - 6px: nav-item-icon, nav-area-collapse, create-toggle-item, tag-picker-row, task-inline-popover-item, chat-session-item
  - 4px: checkbox-control, meta-tag-chip, meta-date-badge, project-open-count
  - 999px: pill/badge 类组件（badge, tag-pill, tag-filter-pill 等）

## Decision (ADR-lite)

**Context**: 当前圆角值散乱（0–22px + 999px），同类组件圆角不一致，需要统一风格。
**Decision**: 采用更方正的风格（4–6px 范围），类似 Windows 11 / Linear。
**Consequences**: 界面更紧凑锐利；pill/badge 类组件保留 999px 不变；对话框/浮层容器另行决定。

## Requirements

### 圆角层级规范（条目级）

| 层级 | 值 | 适用组件 |
|------|-----|---------|
| 小元素 | 4px | checkbox-control, meta-tag-chip, meta-date-badge, project-open-count, chat-session-action, chat-error-dismiss, markdown-body code, task-inline-meta-trigger |
| 条目行 | 6px | nav-item, nav-item-icon, nav-area-collapse, select-item, tag-picker-item, tag-picker-create, tag-picker-row, create-toggle-item, task-inline-popover-item, chat-session-item, chat-session-input, completed-toggle, checklist-empty-entry, search-result-row, button-ghost, chat-toggle, chat-session-new, task-row.is-selected, project-group-header.is-selected, sidebar-dnd-overlay, task-dnd-overlay, project-section-dnd-overlay-edge, project-section-dnd-overlay-card, sidebar-error |
| 输入/按钮 | 6px | .input, .button, .select-trigger, tag-picker-input, search-page-input, chat-composer-input, content-bottom-action-button, sidebar-create |

### 具体变更映射（当前值 → 新值）

**6px → 6px（保持不变）：** nav-item-icon, nav-area-collapse, create-toggle-item, tag-picker-row, task-inline-popover-item, chat-session-item, chat-session-input, completed-toggle

**4px → 4px（保持不变）：** checkbox-control, meta-tag-chip, meta-date-badge, project-open-count, chat-session-action, chat-error-dismiss, markdown-body code, task-inline-meta-trigger

**8px → 6px：** nav-item, select-item, tag-picker-item, tag-picker-create, checklist-empty-entry, search-result-row, button-ghost, chat-toggle, chat-session-new

**10px → 6px：** task-row.is-selected, project-group-header.is-selected, sidebar-dnd-overlay, task-dnd-overlay, project-section-dnd-overlay-edge, project-section-dnd-overlay-card, sidebar-error, tag-picker-input, search-page-input, chat-error

**12px → 6px：** .input, .button, .select-trigger, content-bottom-action-button, sidebar-create, chat-composer-input

**14px → 6px：** content-bottom-action-button, sidebar-create

## Acceptance Criteria

* [ ] 所有条目级组件圆角统一到 4px 或 6px
* [ ] 同类组件间无明显圆角差异
* [ ] pill/badge (999px) 不变
* [ ] 容器级圆角不变

## Definition of Done

* Lint / typecheck / CI green
* 手动视觉验证各条目圆角效果

## Out of Scope

* 容器级圆角（settings-dialog 22px, confirm-dialog/palette 16px, task-inline-popover 14px, select-content 12px, task-inline-paper 12px, project-section-dnd-overlay 12px, chat-message-bubble 12px, error 12px, chat-confirm-dialog 16px）
* pill/badge 类组件（999px）
* 圆形元素（sync-dot 50%）
* scrollbar-thumb（3px）

## Technical Notes

* 源文件: `src/index.css`（唯一包含 border-radius 的 CSS 文件）
* 无 Tailwind、无 CSS-in-JS、无 CSS modules
