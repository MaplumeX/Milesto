# PRD: 统一项目页和任务编辑器的计划/到期元数据样式

## 问题

项目页面 (`ProjectPage`) 和任务编辑器 (`TaskEditorPaper`) 中"计划"和"到期"元数据的视觉样式不一致：

- **项目页面**：文本行形态，图标有独立颜色（计划=项目主色，到期=橙色/红色），hover 时显示编辑铅笔 + X 清除按钮。
- **任务编辑器**：按钮形态，灰色图标，hover 时显示 X 清除按钮，空状态有占位触发器。

两者在形态、颜色、交互上差异明显，用户在不同界面看到同一概念的呈现方式不同。

## 目标

提取共用组件，统一"计划"和"到期"在以上两个界面的视觉样式和交互行为，同时做轻量美化。

## 设计决策

| 维度 | 决策 |
|------|------|
| 范围 | 项目页面 + 任务编辑器；任务/项目列表行保持现状 |
| 形态 | 按钮形态，hover 时细边框 + 小圆角包裹 |
| 图标颜色 | 保留彩色——计划 = `var(--ppc-color)`，到期 = `#C76A1E`（逾期时 `var(--danger-text)`） |
| 字体 | 统一 12px |
| 交互 | 点击值本身打开日期选择器编辑；X 按钮清除值；去掉项目页面的编辑铅笔图标 |
| X 显隐 | 平时隐藏，hover 时随边框一起浮现 |
| 边框 | `1px solid var(--border)`，`border-radius: 4px` |
| 布局 | 项目页面保持两行纵向堆叠；任务编辑器保留左右两栏布局 |
| 空状态 | **不统一**——任务编辑器保留占位按钮，项目页面空时隐藏 |
| 组件范围 | 仅覆盖"计划"和"到期"，标签等其他元数据本次不动 |

## 组件接口

新建 `MetaDateBadge` 组件（建议放在 `src/features/tasks/` 或 `src/components/`）：

```tsx
type MetaDateBadgeProps = {
  icon: React.ComponentType<{ className?: string }>
  value: string
  iconColor: string          // CSS color for the icon
  onClick: () => void        // open date picker
  onClear: () => void        // clear value
  ariaLabel: string          // accessible name
}
```

## 变更文件

1. **新建** `src/features/tasks/MetaDateBadge.tsx` —— 共用组件
2. **修改** `src/features/tasks/TaskEditorPaper.tsx` —— 替换计划/到期的已设值渲染
3. **修改** `src/pages/ProjectPage.tsx` —— 替换 `ProjectMetaRow` 中的计划/到期渲染
4. **修改** `src/index.css` —— 新增 `.meta-date-badge` 相关样式，清理被替换的旧样式

## 样式细节

- `.meta-date-badge`：`display: inline-flex`，`align-items: center`，`gap: 4px`
- `.meta-date-badge` hover：`border: 1px solid var(--border)`，`border-radius: 4px`，`padding: 1px 4px`
- `.meta-date-badge-icon`：`width: 12px`，`height: 12px`，颜色由传入 prop 控制
- `.meta-date-badge-value`：`font-size: 12px`，`color: var(--text)`
- `.meta-date-badge-clear`：平时 `display: none`，父元素 hover 时 `display: inline-flex`
- `.meta-date-badge-clear` 按钮：`width: 14px`，`height: 14px`，无背景无边框，`cursor: pointer`

## 验收标准

- [ ] 项目页面和任务编辑器的计划/到期元数据视觉上完全一致
- [ ] hover 时边框 + X 按钮浮现，点击值进入编辑，点击 X 清除
- [ ] 图标颜色正确：计划为项目主色（或默认蓝色），到期为橙色/红色
- [ ] 项目页面的编辑铅笔图标已移除
- [ ] 任务编辑器的空状态占位按钮保持原有行为不变
- [ ] 项目页面空状态保持隐藏不变
- [ ] 列表行（TaskRow / ProjectRow）不受本次改动影响
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过（类型检查）
