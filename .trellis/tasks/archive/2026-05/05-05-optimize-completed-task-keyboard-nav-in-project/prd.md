# 优化项目界面已完成任务显示：键盘导航与虚拟化

## Goal

为项目页面的已完成任务区域添加键盘导航（聚焦态 + ArrowUp/Down 移动）和虚拟化渲染，使其交互体验与日志簿（Logbook）页面一致。

## What I already know

* Logbook 使用 `LogbookGroupedList` 实现了完整的键盘导航：ArrowUp/Down 跳过非任务行、Enter 打开任务、`TaskSelectionContext` 管理选中态
* Logbook 键盘导航内联在 `onKeyDown` 中，使用 `selectedRowIndex` + `rowVirtualizer.scrollToIndex()` 配合虚拟化
* 项目页面当前分为两个区域：`ProjectGroupedList`（未完成，有虚拟化+键盘导航+拖拽）和 `ProjectDoneTaskList`（已完成，无虚拟化+无键盘导航）
* `ProjectDoneTaskList` 是 `ProjectPage.tsx` 中的内联组件（786-933行），约150行，使用普通 `map()` 渲染
* 选中态 CSS：`.task-row.is-selected { background: var(--wash); border-radius: 10px; }`
* 虚拟化行选中态：`.task-row.task-row-virtual.is-selected .task-row-inner { background: var(--wash); border-radius: 10px; }`
* 已完成区域按 section 分组，有 `done-section-header` 标题行
* 已完成区域默认折叠，展开时懒加载数据

## Requirements

### 核心功能

1. **统一键盘导航空间**：未完成列表 → 切换按钮 → 已完成列表，ArrowUp/Down 跨区域连续移动选中行
2. **已完成区域虚拟化**：使用 `@tanstack/react-virtual` 渲染已完成任务，与未完成列表和日志簿保持一致
3. **已完成区域键盘导航**：ArrowUp/Down 在已完成任务间移动，跳过 section header 但 section header 可聚焦高亮
4. **Space 恢复任务**：在已完成区域按 Space 将选中任务恢复为未完成
5. **Enter 打开任务**：与日志簿行为一致

### 跨区域焦点交接

6. **父组件 `focusRegion` 统一调度**：`ProjectPage` 维护 `focusRegion` 状态（`'active' | 'toggle' | 'done'`），子组件到达边界时通知父组件，父组件切换区域并传入 `initialFocusIndex`
7. **切换按钮作为导航行**：ArrowDown 从未完成列表末尾进入切换按钮，再 ArrowDown（展开态）进入已完成列表第一行
8. **折叠态 ArrowDown 停在切换按钮**：已完成区域折叠时，ArrowDown 到切换按钮即停，不自动展开
9. **展开后焦点自动进入**：在切换按钮上按 Enter/Space 展开后，焦点自动跳到已完成列表第一行

### 折叠/展开行为

10. **两种折叠方式**：切换按钮 Enter/Space 折叠 + 已完成区域内 Esc 折叠
11. **Esc 逐层退出**：先关编辑器，再按 Esc 折叠已完成区域
12. **全部恢复后自动隐藏**：当已完成任务清零时，切换按钮和已完成区域消失，焦点回到未完成列表

### 选中态行为

13. **Space 恢复后补位选中**：任务从已完成列表消失后，选中原位置的下一个任务；若为末尾则选中前一个
14. **Section header 可聚焦无操作**：ArrowUp/Down 可以停在 section header 上，选中高亮，但 Enter 无操作

### 组件结构

15. **`ProjectDoneTaskList` 抽为独立文件**：从 `ProjectPage.tsx` 拆到 `src/features/tasks/ProjectDoneTaskList.tsx`，与 `ProjectGroupedList` 平级

## Acceptance Criteria

- [ ] 已完成区域展开后，ArrowUp/Down 可在已完成任务间移动并高亮选中行
- [ ] ArrowDown 从未完成列表末尾可跳到切换按钮，再跳到已完成列表第一行
- [ ] ArrowUp 从已完成列表第一行可跳到切换按钮，再跳到未完成列表末尾
- [ ] 已完成区域折叠时，ArrowDown 到切换按钮即停
- [ ] 在切换按钮按 Enter/Space 展开后，焦点自动进入已完成列表第一行
- [ ] 已完成区域内按 Esc 折叠区域，焦点回到切换按钮
- [ ] 已完成区域内打开编辑器后按 Esc 先关编辑器，再按 Esc 折叠
- [ ] 按 Space 恢复已完成任务后，选中原位置的下一个任务
- [ ] 已完成区域使用 `@tanstack/react-virtual` 虚拟化渲染
- [ ] Section header 可被键盘选中高亮，Enter 无操作
- [ ] 全部恢复后切换按钮和已完成区域消失，焦点回未完成列表
- [ ] `ProjectDoneTaskList` 为独立文件，非 `ProjectPage.tsx` 内联

## Definition of Done

- Lint / typecheck 通过
- 现有测试不回归
- 已完成区域的选中态 CSS 与未完成列表/日志簿一致（`.task-row.is-selected`）
- Area 页面不做改动（后续推广）

## Technical Approach

### 整体架构

保留两个独立组件（`ProjectGroupedList` + `ProjectDoneTaskList`），在 `ProjectPage` 层面通过 `focusRegion` 状态协调跨区域焦点交接。

### `ProjectDoneTaskList` 改造

1. 抽到独立文件 `src/features/tasks/ProjectDoneTaskList.tsx`
2. 加入 `@tanstack/react-virtual` 虚拟化
3. 构建混合行数组（section header + task），参考日志簿的 `logbook-rows.ts` 模式
4. 实现 `onKeyDown`：ArrowUp/Down 在 task 行间移动（section header 可聚焦但跳过导航），Enter 无操作（section header）/打开任务（task），Space 恢复任务
5. 维护 `selectedRowIndex` + `selectedSectionId`（section header 选中态）
6. 接受 `focusRegion`/`initialFocusIndex` props，在 effect 中响应父组件的焦点指令
7. 到达边界时调用 `onNavigateOut('up' | 'down')` 通知父组件

### `ProjectPage` 焦点调度

1. 新增 `focusRegion` 状态：`'active' | 'toggle' | 'done'`
2. `ProjectGroupedList` 到达底部边界时 → `focusRegion = 'toggle'`
3. 切换按钮获得焦点后 ArrowDown（展开态） → `focusRegion = 'done'`, `initialFocusIndex = 0`
4. `ProjectDoneTaskList` 到达顶部边界时 → `focusRegion = 'toggle'`
5. 切换按钮 ArrowUp → `focusRegion = 'active'`
6. 展开/折叠时自动调整 `focusRegion`

### 选中态 fallback

Space 恢复任务后，使用 `lastSelectedIndexRef` 模式（参考日志簿），选中同位置下一个任务。

## Decision (ADR-lite)

**Context**: 项目页面的已完成任务区域缺少键盘导航和虚拟化，与日志簿和未完成列表体验不一致

**Decision**: 保留两个独立组件，父层桥接焦点；已完成区域独立加虚拟化和键盘导航

**Consequences**: 改动范围可控，不侵入 `ProjectGroupedList` 的拖拽逻辑；需要仔细处理两个虚拟化器之间的焦点切换边界情况

## Out of Scope

- Area 页面的已完成任务优化（后续推广）
- 已完成区域的拖拽排序
- 已完成任务的批量操作快捷键
- 日志簿中已完成项目的键盘导航模式（项目页面不涉及已完成项目行）

## Technical Notes

### 关键文件

| 文件 | 作用 |
|------|------|
| `src/pages/ProjectPage.tsx` | 主页面，将加入 `focusRegion` 调度逻辑 |
| `src/features/tasks/ProjectGroupedList.tsx` | 未完成列表，需添加边界回调 |
| `src/features/tasks/ProjectDoneTaskList.tsx` | **新建**，从 ProjectPage 抽出并改造 |
| `src/features/tasks/project-done-task-rows.ts` | 行数据构建（已有，可能需调整） |
| `src/features/tasks/TaskSelectionContext.tsx` | 共享选中上下文 |
| `src/features/tasks/TaskRow.tsx` | 任务行组件 |
| `src/features/logbook/LogbookGroupedList.tsx` | 参考实现 |
| `src/index.css` | 选中态样式 |

### 参考模式

- 键盘导航 + 虚拟化：`LogbookGroupedList.tsx` 第 167-213 行
- 选中态 fallback：`LogbookGroupedList.tsx` 第 86-105 行
- 虚拟化行选中 CSS：`src/index.css` 第 2712-2720 行
