# 夜间模式配色调整（Things3 方向）Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将夜间模式调整为已确认的暖石墨配色，统一侧边栏、内容区和主要表面层，并让 Electron 窗口深色背景与内容区基底保持一致。

**Architecture:** 保留现有 CSS custom properties 主题体系，在 `src/index.css` 的深色 token 中集中收口布局级与表面级颜色；Renderer 不改 JSX 结构，只调整 token 和消费关系；Main 将窗口背景色提取为可测试的纯函数，避免启动和主题切换时出现旧冷黑底色。

**Tech Stack:** Electron 30、React 18、TypeScript strict、CSS variables、Vitest、内置 UI `selfTest`。

---

## File Structure

- Create: `electron/theme/window-background.ts`
  - 单一职责：根据 `EffectiveTheme` 返回 BrowserWindow 应使用的背景色
- Create: `tests/unit/window-background.test.ts`
  - 单一职责：验证窗口背景色映射，避免深色背景回退到旧值
- Modify: `src/index.css`
  - 单一职责：收口深色主题 token，并把布局级背景应用到 `.sidebar`、`.content`、`.content-bottom-bar`
- Modify: `src/app/selfTest.ts`
  - 单一职责：在现有主题切换流程中补充暗色配色断言
- Modify: `electron/main.ts`
  - 单一职责：改为复用可测试的窗口背景 helper

说明：按仓库 `AGENTS.md` 约束，本计划不包含 `git commit`、分支或 worktree 步骤。

## Chunk 1: 回归护栏

### Task 1: 在内置 UI `selfTest` 中补暗色配色断言

**Files:**
- Modify: `src/app/selfTest.ts`

- [x] **Step 1: 写会失败的主题断言**

在现有主题切换段落里，切到 `dark` 并确认 preference 持久化后，立即补一组 root token + 关键布局背景断言：

```ts
      const sidebar = await waitFor('Theme suite: sidebar shell', () =>
        document.querySelector<HTMLElement>('.sidebar')
      )
      const content = await waitFor('Theme suite: content shell', () =>
        document.querySelector<HTMLElement>('.content')
      )
      const bottomBar = await waitFor('Theme suite: bottom bar', () =>
        document.querySelector<HTMLElement>('.content-bottom-bar')
      )
      const themeCard = await waitFor('Theme suite: settings theme card', () =>
        document.querySelector<HTMLElement>('[data-settings-theme-card="true"]')
      )

      await waitFor('Theme suite: dark palette applied', () => {
        const root = getComputedStyle(document.documentElement)
        if (root.getPropertyValue('--sidebar-bg').trim() !== '#181A1D') return null
        if (root.getPropertyValue('--content-bg').trim() !== '#222528') return null
        if (root.getPropertyValue('--content-edge-bg').trim() !== '#1F2225') return null
        if (root.getPropertyValue('--panel').trim() !== '#2A2D31') return null
        if (root.getPropertyValue('--text').trim() !== '#F0E9DC') return null
        if (root.getPropertyValue('--muted').trim() !== '#B4AB9D') return null

        if (getComputedStyle(sidebar).backgroundColor !== 'rgb(24, 26, 29)') return null
        if (getComputedStyle(content).backgroundColor !== 'rgb(34, 37, 40)') return null
        if (getComputedStyle(bottomBar).backgroundColor !== 'rgb(31, 34, 37)') return null
        if (getComputedStyle(themeCard).backgroundColor !== 'rgba(42, 45, 49, 0.96)') return null

        return true
      })
```

- [x] **Step 2: 跑自测，确认它先失败**

Run: `MILESTO_SELF_TEST=1 MILESTO_SELF_TEST_SUITE=full npm run dev`

Expected:
- 进程非零退出
- 输出包含 `[MILESTO_SELF_TEST]`
- 失败信息指向新增的 `Theme suite: dark palette applied` 断言

## Chunk 2: 实现暗色配色

### Task 2: 收口深色 token，并把布局层背景显式化

**Files:**
- Modify: `src/index.css`

- [x] **Step 1: 先补布局级 token，保持浅色主题行为不变**

在 `:root` 中补布局级默认值，让浅色模式继续沿用现有视觉：

```css
  --sidebar-bg: var(--glass);
  --content-bg: var(--bg);
  --content-edge-bg: var(--glass);
```

- [x] **Step 2: 在深色主题里写入已确认的暖石墨调色盘**

把 `@media (prefers-color-scheme: dark)` 内的深色 token 调整为本次确认值：

```css
    --sidebar-bg: #181A1D;
    --content-bg: #222528;
    --content-edge-bg: #1F2225;

    --panel: #2A2D31;
    --text: #F0E9DC;
    --muted: #B4AB9D;
    --border: rgba(241, 233, 219, 0.08);
    --wash: rgba(255, 255, 255, 0.035);
    --wash-strong: rgba(255, 255, 255, 0.08);

    --glass: rgba(24, 26, 29, 0.92);
    --glass-soft: rgba(31, 34, 37, 0.94);
    --glass-strong: rgba(42, 45, 49, 0.96);
    --paper: rgba(42, 45, 49, 0.98);
```

保持现有 `danger` / `project progress` 等状态色，只在需要时做最小协调，不额外重做状态体系。

- [x] **Step 3: 把布局级背景应用到侧边栏、内容区和底部栏**

将下列规则改为显式消费布局级 token：

```css
.sidebar {
  background: var(--sidebar-bg);
}

.content {
  flex: 1;
  overflow: hidden;
  background: var(--content-bg);
}

.content-bottom-bar {
  background: var(--content-edge-bg);
}
```

其他表面层继续消费共享语义 token，不在 `.card`、`.input`、`.detail`、`.sidebar-error` 等选择器里写新的硬编码颜色。

- [ ] **Step 4: 重新跑内置 UI 自测，确认新断言通过**

Run: `MILESTO_SELF_TEST=1 MILESTO_SELF_TEST_SUITE=full npm run dev`

Expected:
- 进程退出码为 0
- stdout 包含 `[MILESTO_SELF_TEST] {"suite":"full","ok":true`

阻塞说明：2026-03-16 复跑后已越过 `Theme suite: dark palette applied`，但 full suite 继续失败于后续既有流程 `Edit-mode move inline editor open`，因此未能拿到整套自测绿灯。

## Chunk 3: 同步 Electron 窗口背景

### Task 3: 提取窗口背景 helper 并用单元测试锁定深色值

**Files:**
- Create: `electron/theme/window-background.ts`
- Create: `tests/unit/window-background.test.ts`

- [x] **Step 1: 先写会失败的单元测试**

新建 `tests/unit/window-background.test.ts`：

```ts
import { describe, expect, it } from 'vitest'

import { getWindowBackgroundColor } from '../../electron/theme/window-background'

describe('getWindowBackgroundColor', () => {
  it('returns the existing light background for light theme', () => {
    expect(getWindowBackgroundColor('light')).toBe('#ffffff')
  })

  it('returns the warm content background for dark theme', () => {
    expect(getWindowBackgroundColor('dark')).toBe('#222528')
  })
})
```

- [x] **Step 2: 跑单元测试，确认它先失败**

Run: `npx vitest run tests/unit/window-background.test.ts -c vitest.config.ts`

Expected:
- 退出码非 0
- 报错 `Cannot find module '../../electron/theme/window-background'` 或等效失败

- [x] **Step 3: 写最小实现**

新建 `electron/theme/window-background.ts`：

```ts
import type { EffectiveTheme } from '../../shared/schemas/theme'

export function getWindowBackgroundColor(effectiveTheme: EffectiveTheme): string {
  return effectiveTheme === 'dark' ? '#222528' : '#ffffff'
}
```

- [x] **Step 4: 重跑单元测试，确认通过**

Run: `npx vitest run tests/unit/window-background.test.ts -c vitest.config.ts`

Expected:
- 退出码为 0
- 2 个断言通过

### Task 4: 在 Main 中改用 helper，并完成总体验证

**Files:**
- Modify: `electron/main.ts`

- [x] **Step 1: 用 helper 替换 Main 内联背景色逻辑**

在 `electron/main.ts` 中：

```ts
import { getWindowBackgroundColor } from './theme/window-background'
```

然后删除或改写当前本地的 `getWindowBackgroundColor()`，确保以下调用都复用同一来源：

- 创建窗口时的 `backgroundColor`
- 主题切换时的 `win.setBackgroundColor(...)`

- [x] **Step 2: 跑类型检查**

Run: `npx tsc -p tsconfig.json`

Expected:
- 退出码为 0

- [x] **Step 3: 跑快速测试集**

Run: `npm test`

Expected:
- 退出码为 0

- [ ] **Step 4: 再跑一次内置 UI 自测**

Run: `MILESTO_SELF_TEST=1 MILESTO_SELF_TEST_SUITE=full npm run dev`

Expected:
- 退出码为 0
- 输出包含 `[MILESTO_SELF_TEST] {"suite":"full","ok":true,"failures":[]}`

阻塞说明：2026-03-16 再次执行后稳定失败于 `Edit-mode move inline editor open`；主题配色段已通过，但 full suite 仍未整体通过。

- [ ] **Step 5: 手动验证启动和主题切换观感**

Run: `npm run dev`

检查：
- 设置页切换 `light -> dark -> system`
- `.sidebar`、`.content`、`.content-bottom-bar` 是否形成“中等差值”的暖石墨分区
- 卡片、输入框、popover/详情面板是否回到同一套表面层级
- 应用启动时是否还有旧冷黑底闪出

说明：当前会话未直接操作原生 Electron 窗口，未完成人工观感验收。

### Task 5: 记录执行结果

**Files:**
- Modify: `docs/plans/2026-03-16-night-mode-things3.md`（执行时勾选步骤）

- [x] **Step 1: 在实施过程中勾选已完成步骤**

要求：
- 只勾选已验证通过的步骤
- 若某一步因仓库现状无法完成，在对应步骤后直接补一句阻塞说明

- [x] **Step 2: 不新增无关文档**

要求：
- 实现阶段如无新决策，不新增第二份设计文档
- 验证结果留在执行记录或最终说明里即可
