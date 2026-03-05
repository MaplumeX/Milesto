# 底栏按钮切换动效（任务编辑进入/退出）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 当 `openTaskId` 在列表态/编辑态切换时，`.content-bottom-bar` 的按钮组以“先退出再进入”的卡片动效切换，并兼容 reduced-motion。

**Architecture:** 在 `AppShell` 内用 `framer-motion` 的 `AnimatePresence mode="wait"` 包裹两组 keyed 按钮容器；退出下滑淡出，退出完成后进入上滑淡入；reduced-motion 直接瞬切。

**Tech Stack:** React 18、framer-motion、现有 `usePrefersReducedMotion()`。

---

### Task 1: 在 `AppShell` 底栏实现“先退出再进入”切换

**Files:**
- Modify: `src/app/AppShell.tsx`（`.content-bottom-bar` 渲染段落；新增 `framer-motion` 导入；复用 `prefersReducedMotion`）
- (Optional) Modify: `src/index.css`（如需要裁切动画溢出：`.content-bottom-bar { overflow: hidden; }`）

**Step 1: 先写一个最小自测点（可选）**

说明：现有 `src/app/selfTest.ts` 已覆盖“编辑态底栏出现/列表态底栏隐藏”的行为；本次动效不改变 data-attributes，原则上无需新增断言。若希望覆盖“先退出再进入”的时序，可添加一个短暂的 `sleep(50)` 后断言“编辑态按钮尚未出现/或旧按钮仍在”，但这类断言可能引入脆弱性（不推荐作为强约束）。

**Step 2: 实现切换动画（核心）**

- 使用：
  - `AnimatePresence initial={false} mode="wait"`
  - 两个 `motion.div`，分别 `key="list"` / `key="edit"`
- 动画参数（与 `docs/ui.md` 对齐）：
  - exit：`opacity: 0, y: 10`，`transition: { duration: 0.12, ease: 'easeOut' }`
  - enter：`opacity: 0, y: 10` → `opacity: 1, y: 0`，`transition: { duration: 0.16, ease: 'easeOut' }`
  - 退出期追加 `pointerEvents: 'none'`
- reduced-motion：
  - `prefersReducedMotion` 为 true 时跳过 `AnimatePresence/motion`，直接按原条件渲染（瞬切）。

**Step 3: 运行类型检查**

Run: `npx tsc -p tsconfig.json`
Expected: 退出码 0。

**Step 4: 运行测试**

Run: `npm test`
Expected: 退出码 0。

**Step 5: 手动验证（dev）**

- Run: `npm run dev`
- 操作：在任务列表中进入/退出内联编辑器，观察底栏按钮组以“下滑淡出 → 上滑淡入”切换；开启系统 reduced-motion（或 `?selfTest=1&reducedMotion=1`）后应瞬切。

