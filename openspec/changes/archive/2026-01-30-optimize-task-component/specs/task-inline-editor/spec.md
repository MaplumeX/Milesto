## MODIFIED Requirements

### Requirement: Inline editor expands under the task row
任务编辑器 MUST 以“行内展开”的方式呈现，但展开态 MUST 属于同一条任务条目（task row）本身：打开编辑后，该 task row 自身变为编辑器容器并增高，而不是在其下方插入一条独立的 editor row。

展开态的第一行（header）MUST 呈现为 row-like：在同一行内同时提供 done toggle 与标题输入框；标题输入框 MUST 与任务列表的标题区域对齐，视觉上保持“原 row 展开的样子”。

展开态 MUST 提供轻微的“聚焦卡片”视觉反馈：编辑器容器 MUST 具有可见边框与轻微阴影，并且在该任务与相邻任务行之间 MUST 留出上下空间，以便用户清晰识别当前正在编辑的条目。

#### Scenario: Open expands inline within the task row
- **WHEN** 用户对某条任务触发“打开编辑”（例如 Return 或双击）
- **THEN** 该任务在列表中原地展开编辑器，展开后的编辑内容位于同一条 task row 内（该 row 变高）
- **THEN** 第一行 header 包含 done toggle 与标题输入框，且标题输入框与原任务行标题区域对齐
- **THEN** 标题输入框获得焦点
- **THEN** 展开过程不打开新的 modal/overlay

#### Scenario: Expanded editor does not require a separate editor row
- **WHEN** 用户打开某条任务的行内编辑器
- **THEN** 渲染结构中 MUST NOT 依赖“额外插入一条 editor row（单独列表项）”来呈现编辑内容
- **THEN** 展开态 MUST 呈现轻微聚焦卡片（可见边框 + 轻微阴影 + 上下留白），但其视觉层级 MUST 仍被理解为“该 task row 的展开态”，而不是独立的第二层弹层/模态
