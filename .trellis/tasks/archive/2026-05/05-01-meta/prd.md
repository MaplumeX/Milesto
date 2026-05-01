# 优化任务编辑器 meta 按钮样式

## Goal

在 `TaskEditorPaper`（任务编辑器）的 meta 区，把当前三套不一致的视觉语言（`MetaDateBadge` 12px / `task-inline-meta-value` 10px / `task-inline-meta-trigger` 10px）整理成更醒目、更可点的形态。核心痛点：标签按钮和空值占位按钮太小、太弱，跟日期 badge 视觉断层。

## What I already know

- 范围限定在 `TaskEditorPaper` 的 meta 区（`task-inline-metadata-band`），位于 `src/features/tasks/TaskEditorPaper.tsx:1330-1438`，CSS 在 `src/index.css:2088-2197`。
- 涉及组件：`MetaDateBadge`（`src/features/tasks/MetaDateBadge.tsx`）、`task-inline-meta-value`（旧 Tags 整体按钮）、`task-inline-meta-trigger`（空值占位）。
- `getTaskTagPreview` / `TASK_TAG_PREVIEW_LIMIT = 3` 在 `task-metadata.ts`，**还被 `TaskRow.tsx` 和 `ProjectRow.tsx` 使用**（任务/项目列表 row 视图），不属本次范围；改 task editor 时不能动这个常量，否则误伤 row。
- `Tag` schema 自带 `color: string | null` 字段（`shared/schemas/tag.ts`），但本次不启用彩色 chip。
- 最近 3 个 commit 都在维护 `meta-date-badge` 的 hover 节奏：`17189ee`（pre-reserve border space）、`12fc4ca`（× visibility 防抖动）、`c08d179`（flex stretch）。本次决定**不动 date badge**，沿用其稳定基线。

## Decisions (ADR-lite)

通过 `/grill-me` + `/trellis-brainstorm` 收敛 10 条共识：

| # | 决策 | 备注 |
|---|---|---|
| 1 | 痛点定性 = 视觉不够醒目（不是不统一/不是布局问题） | 选项 B |
| 2 | tag 拆成独立 chip + 内嵌 ×；chip 本身**不点开 picker** | 选项 B + 用户附加约束 |
| 3 | 「加新 tag」入口 = chip 序列尾部永驻 `+ Tags` trigger（已设值时也显示） | 选项 A |
| 4 | trigger / chip / date badge 字号 = **14px** | 选项 C；最大化醒目，已知会重新触发 hover/抖动校验面 |
| 5 | tag chip = 始终 `1px solid var(--border)` + `var(--wash)` 底色 | 选项 B |
| 6 | `MetaDateBadge` **保持现状**（hover 才显边框，仅放大字号到 14px） | 选项 B；接受日期/标签视觉略不同 |
| 7 | tag chip 上的 ×：hover 单个 chip 才显（visibility 模式，复用 `meta-date-badge-clear` 的实现） | 选项 B |
| 8 | 布局：保留 `set-values` 竖排 + `empty-triggers` 横排二分；Tags chips 在 set-values 区**单独一行 row + wrap**，`+ Tags` trigger 在该行尾；右侧 `empty-triggers` 区不再含 Tags（只剩 Schedule / Due / Checklist 占位） | 选项 A |
| 9 | tag chip **不带** TagIcon prefix；`+ Tags` trigger **保留** TagIcon prefix（跟 Schedule/Due trigger 的 icon-prefix 模式一致） | 选项 B |
| 10 | task editor 内 tag chips 数量**不限制**，多个时自然 wrap 到第二行；不引入 `[+N]` overflow chip / 不做 expand-collapse | 选项 A；保护 chip 独立可删除的设计不被 overflow 架空 |

**Consequences**：
- 字号 14px → `meta-date-badge` 也跟着升级，需要重新 verify 之前的 hover jitter / layout shift / flex stretch 三个 fix 在新尺寸下仍然 hold。
- chip 始终显边框，跟 date badge 的 hover-才显边框形成两档视觉重量；用户接受此差异。
- 新增"chip + 永驻 trigger 同行 wrap"的子布局，需要在 `set-values` column 里嵌一行 row。
- `TASK_TAG_PREVIEW_LIMIT = 3` 留给 row 视图独占；task editor 不限制 tag 数量，多 tag 自然 wrap（Decision #10）。

## Open Questions

无（剩下的实现细节——14px 下 `meta-date-badge` 的 padding/icon 等比放大数值——已在 Technical Notes 中规约，不属 blocking 决策）。

## Requirements (evolving)

- task editor meta 区使用统一 14px 字号。
- tag chip 独立可视化，每个内嵌 hover-only ×，点击 × 移除该 tag（不影响其他 tag）。
- tag chip **不带** TagIcon prefix（仅 tag title + ×）。
- `+ Tags` trigger 永驻 chip 行尾，**保留** `<TagIcon>` prefix；点击打开 TagPicker。
- tag chip 视觉：`1px solid var(--border)` + `var(--wash)` 底色 + 14px 文本。
- 空值占位 trigger（Schedule / Due / Checklist）hover 时显示 1px border（参考 MetaDateBadge）。
- `MetaDateBadge` 保持现有 hover 行为，只放大字号到 14px（icon / padding 等比放大，详见 Technical Notes）。
- 布局保留 `task-inline-metadata-band` 的左竖排 / 右横排二分；Tags chips + `+ Tags` 形成 set-values 区的最后一行（row + wrap）。
- task editor 内 tag chips **不限制数量**：多个 tag 时自然 wrap 到第二/第三行，不引入 overflow `[+N]` chip。

## Acceptance Criteria

- [ ] 任务编辑器打开时，meta 区所有可点元素字号为 14px（trigger / chip / badge）。
- [ ] 任务有 0 个 tag 时：set-values 区无 Tags 行；右侧 empty-triggers 区显示 `[<TagIcon> Tags]` 入口。
- [ ] 任务有 1+ tag 时：set-values 区出现 Tags 行（单独一行 row + wrap），形如 `[#work] [#urgent] [<TagIcon> Tags]`；右侧 empty-triggers 区不再含 Tags 占位。
- [ ] 6+ tag 时：chips 自动 wrap 到第二行（甚至更多行），**不出现** `[+N]` overflow chip，每个 tag 都可被 hover 单删。
- [ ] 鼠标悬停在某个 tag chip 上，仅该 chip 内的 × 出现；点击该 × 仅移除该 tag，其他 chip 不变。
- [ ] tag chip 静止时显示 `1px solid var(--border)` 边框 + `var(--wash)` 底色（视觉与日期 badge 区分开）。
- [ ] tag chip 上**不显示** TagIcon。
- [ ] `+ Tags` trigger **显示** TagIcon prefix（跟 Schedule/Due trigger 的 icon-prefix 模式一致）。
- [ ] 空值占位 trigger（Schedule/Due/Checklist）hover 时显示 1px border（之前没有）。
- [ ] `MetaDateBadge`（Schedule/Due）行为不变：静止 transparent border，hover 显 var(--border) + × visible；放大到 14px 后 `17189ee` / `12fc4ca` / `c08d179` 三个 fix 仍然生效（layout shift / hover jitter / flex stretch 不复发）。
- [ ] `TaskRow` / `ProjectRow` 的 tag 渲染**完全不受影响**（preview limit 保持 3）。
- [ ] 已有的 happy-dom / vitest 测试通过；如有 snapshot 测试需要更新，更新到对应新 DOM。

## Definition of Done

- 单元/组件测试覆盖：tag chip 单删、`+ Tags` 永驻入口、空值 trigger hover 边框；`npm run test`（Electron Node 运行时）通过。
- `npm run lint` + `tsc` 通过。
- 自测：`MILESTO_SELF_TEST=1 npm run dev` 跑 search/sidebar 套件确认编辑器交互不回归。
- `meta-date-badge` 在 14px 新尺寸下重新人工校验 hover jitter / layout shift / flex stretch 三个旧 issue 不复发。

## Out of Scope

- 启用 `tag.color` 进行彩色 chip 渲染（schema 已有字段，但需要单独 PRD）。
- 改动 `TaskRow` / `ProjectRow` 的 tag 显示（仍用 `TASK_TAG_PREVIEW_LIMIT = 3` 拼接预览）。
- 改动 `MetaDateBadge` 的 hover 节奏（仅放大字号，不动 hover 行为）。
- 把 meta 区改成 inline-wrap 一行流式（保留 set-values column / empty-triggers row 二分）。
- 重构 `task-inline-metadata-band` 容器结构（仅在 set-values 内嵌一行 row 容纳 Tags chips）。
- 引入 tag chips 的 overflow `[+N]` 截断或 expand-collapse 折叠机制（多 tag 一律自然 wrap）。
- 在 tag chip 上显示 TagIcon（Decision #9 明确不带）。

## Technical Notes

### 关键文件

- `src/features/tasks/TaskEditorPaper.tsx:1330-1438`——meta 区 JSX。
  - `task-inline-meta-value`（旧 Tags 单按钮，行 1362-1385）——本次拆分为多 chip。
  - `task-inline-meta-trigger`（空值占位，行 1388-1437）——加 hover border + 14px。
- `src/features/tasks/MetaDateBadge.tsx`——保留组件结构，CSS 字号升 14px。
- `src/index.css:1357-1422`——`meta-date-badge` 系列样式。
- `src/index.css:2088-2197`——`task-inline-meta-*` 系列样式。
- `src/features/tasks/task-metadata.ts:18-26`——`getTaskTagPreview` 不动（row 在用）。

### 不能动的边界

- `TASK_TAG_PREVIEW_LIMIT = 3`：`TaskRow.tsx` / `ProjectRow.tsx` 依赖。
- `getTaskTagPreview` 函数签名：同上。
- `Tag.color` 字段：本次不引入。

### 实现注意

- **`+ Tags` trigger** 沿用 `task-inline-meta-trigger` class，但需要打破 `TaskEditorPaper.tsx:1413` 的 `selectedTagIds.size === 0` 条件——已设值时也要显示，且渲染位置移到 set-values 区的 Tags 行尾（不再属于右侧 empty-triggers 区）。
- **tag chip** 是新增组件（建议复用 `MetaDateBadge` 的 paper 结构思路，但不要直接复用其 hover 边框逻辑）：
  - 仅 `<span>{tag.title}</span>` + 内嵌 hover-only `<button class="...-clear">×</button>`；**不渲染 TagIcon**。
  - 静止：`border: 1px solid var(--border); background: var(--wash); padding: 2px 6px; gap: 4px; font-size: 14px; line-height: 1.2;`
  - × 复用 `meta-date-badge-clear` 的 visibility 模式（`visibility: hidden; .chip:hover & { visibility: visible }`），避免引入新的抖动模式。
- **空值 trigger hover border**：在 `.task-inline-meta-trigger` 上加 `border: 1px solid transparent` + `:hover { border-color: var(--border); padding: ...预留空间 }`——参考 `17189ee` commit 在 `meta-date-badge` 上的 pre-reserve 思路，避免 layout shift。
- **`meta-date-badge` 14px 升级**：字号 `12px → 14px`；icon `12px → 14px`（等比 1.167x）；padding `1px 4px → 2px 6px`（等比微调，保留旧"紧凑"观感不要膨胀过多）。升级后**必须人工 verify**：
  - `17189ee` 的 transparent border 预留是否仍消除 hover layout shift；
  - `12fc4ca` 的 × visibility 切换是否仍消除垂直抖动；
  - `c08d179` 的 column 布局下不被 flex stretch。
- **set-values 内嵌 Tags 行**：在 `.task-inline-metadata-set-values`（column）下新增一个 row 容器（建议 class `.task-inline-meta-tags-row` 或类似），`display: flex; flex-wrap: wrap; gap: 6px;`，容纳所有 tag chips + 末尾的 `+ Tags` trigger。

### 实现细节（不需要再问）

- chip 之间 gap 和 chip-到-trigger 的 gap 统一 6px（视觉留白足够 + 避免 wrap 时挤在一起）。
- chip × 的尺寸和颜色复用 `meta-date-badge-clear`（14px line-height、`var(--muted)` → hover `var(--text)`）。

## Research References

（暂无；本次设计基于 repo 现状 + grill-me 收敛，未涉及外部技术调研。）
