# Ghost 按钮视觉瘦身

## 问题
`.button-ghost` 继承 `.button` 的 `padding: 10px 12px`，对于透明背景的 ghost 按钮来说视觉体积过大，显得"太胖"。

## 方案
在 `.button-ghost` 中添加更紧凑的 padding 和更小的 border-radius：
- `padding: 4px 8px`（原为 10px 12px）
- `border-radius: 8px`（原继承 12px）

## 验证
- 确认所有 ghost 按钮场景（工具栏、菜单、弹窗、ConfirmDialog）仍然有足够的点击区域
- 确认 lint/build 通过
