# 任务编辑纸面亮度微调 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让任务编辑纸面在夜间模式下比内容区更浅，同时只影响 `task-inline-paper` 和 `overlay-paper`，不改变 `task-inline-popover` 或其他表面层。

**Architecture:** 保留现有 CSS token 体系，在 `src/index.css` 中新增一个专用的 `--editor-paper` token，暗色主题下赋值为已确认的 `#31353A`。两个任务编辑纸面选择器统一消费该 token，普通 `popover` 和其他面板继续使用现有表面层 token，不扩散影响面。

**Tech Stack:** TypeScript strict、Vitest、CSS custom properties、现有 `npm test` 快速测试集。

---

## File Structure

- Create: `tests/unit/editor-paper-theme.test.ts`
  - 单一职责：对 `src/index.css` 做窄范围 CSS 合约回归，锁定 `--editor-paper` 的引入和三个关键选择器的消费关系
- Modify: `src/index.css`
  - 单一职责：新增 `--editor-paper`，并把 `.task-inline-paper` 与 `.overlay-paper` 接到该 token，同时保持 `.task-inline-popover` 不变

说明：按仓库 `AGENTS.md` 约束，本计划不包含 `git commit`、分支或 worktree 步骤。

## Chunk 1: CSS 回归护栏

### Task 1: 先写会失败的 CSS 合约测试

**Files:**
- Create: `tests/unit/editor-paper-theme.test.ts`

- [x] **Step 1: 写一个最小失败测试，锁定编辑纸面层级**

新建测试文件，直接读取 `src/index.css`，验证三件事：

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('editor paper theme contract', () => {
  it('defines the dark editor paper token', () => {
    expect(css).toContain('--editor-paper: #31353A;')
  })

  it('maps inline and overlay task editors to editor paper', () => {
    expect(css).toMatch(/\\.task-inline-paper\\s*\\{[\\s\\S]*background:\\s*var\\(--editor-paper\\);/)
    expect(css).toMatch(/\\.overlay-paper\\s*\\{[\\s\\S]*background:\\s*var\\(--editor-paper\\);/)
  })

  it('keeps task inline popovers on the existing paper surface', () => {
    expect(css).toMatch(/\\.task-inline-popover\\s*\\{[\\s\\S]*background:\\s*var\\(--paper\\);/)
    expect(css).not.toMatch(/\\.task-inline-popover\\s*\\{[\\s\\S]*background:\\s*var\\(--editor-paper\\);/)
  })
})
```

- [x] **Step 2: 跑单测，确认它先失败**

Run: `npx vitest run tests/unit/editor-paper-theme.test.ts -c vitest.config.ts`

Expected:
- 退出码非 0
- 失败原因是 `--editor-paper` 尚未定义，且 `.task-inline-paper` / `.overlay-paper` 仍未使用该 token

## Chunk 2: 最小实现

### Task 2: 在 CSS 中引入编辑纸面专用 token

**Files:**
- Modify: `src/index.css`

- [x] **Step 1: 新增专用 token，不影响浅色主题**

在 `:root` 中增加默认回退：

```css
  --editor-paper: var(--paper);
```

这样浅色主题仍然沿用当前纸面，不引入额外视觉改动。

- [x] **Step 2: 在暗色主题里写入已确认的编辑纸面色**

在 `@media (prefers-color-scheme: dark) { :root { ... } }` 中增加：

```css
    --editor-paper: #31353A;
```

不要改 `--paper`，因为本次要求 `task-inline-popover` 保持当前层级。

- [x] **Step 3: 让两个任务编辑纸面统一消费该 token**

把以下选择器改为：

```css
.overlay-paper {
  background: var(--editor-paper);
}

.task-inline-paper {
  background: var(--editor-paper);
}
```

保持以下规则不变：

```css
.task-inline-popover {
  background: var(--paper);
}
```

- [x] **Step 4: 重跑 CSS 合约测试，确认通过**

Run: `npx vitest run tests/unit/editor-paper-theme.test.ts -c vitest.config.ts`

Expected:
- 退出码为 0
- 3 个断言全部通过

## Chunk 3: 整体验证

### Task 3: 跑类型检查和快速测试集

**Files:**
- Modify: `src/index.css`
- Test: `tests/unit/editor-paper-theme.test.ts`

- [x] **Step 1: 跑类型检查**

Run: `npx tsc -p tsconfig.json`

Expected:
- 退出码为 0

- [x] **Step 2: 跑快速测试集**

Run: `npm test`

Expected:
- 退出码为 0
- 包含新加的 `tests/unit/editor-paper-theme.test.ts`

- [ ] **Step 3: 做一次人工观感验收**

Run: `npm run dev`

检查：
- 内联编辑纸面明显比内容区 `#222528` 更浅
- 覆盖式编辑纸面与内联编辑纸面属于同一亮度层级
- `task-inline-popover` 没有跟着一起抬亮
- 其余普通卡片、输入框、详情面板不受这次改动影响

阻塞说明：当前会话未直接完成原生 Electron 窗口的人工视觉验收，此步骤保留给手动确认。

### Task 4: 更新执行记录

**Files:**
- Modify: `docs/plans/2026-03-16-editor-paper-lightness.md`（执行时勾选步骤）

- [x] **Step 1: 在实施过程中勾选已完成步骤**

要求：
- 只勾选已实际验证通过的步骤
- 若某一步因环境或既有仓库问题无法完成，在对应步骤后直接写阻塞说明

- [x] **Step 2: 不额外扩散需求**

要求：
- 不顺手修改 `task-inline-popover`
- 不顺手修改普通卡片、输入框、详情面板
- 不在本计划中混入其他夜间主题微调
