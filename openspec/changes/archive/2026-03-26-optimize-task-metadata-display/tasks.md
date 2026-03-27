## 1. Data Contract

- [x] 1.1 扩展任务列表与搜索结果的共享 schema，增加轻量 tag preview / tag count 字段
- [x] 1.2 更新任务列表查询，在单次查询内返回计划时间、到期时间和标签预览数据
- [x] 1.3 校验相关 IPC 返回值与共享类型，确保旧列表页面不会因新字段而回归

## 2. Collapsed Row Metadata

- [x] 2.1 更新折叠态任务行渲染，新增右对齐 metadata 簇并实现固定顺序
- [x] 2.2 实现标签前 2 个名称加 `+N` 的预览规则，以及 metadata 优先、标题提前截断的布局
- [x] 2.3 为折叠态 metadata 簇补齐样式与状态区分，确保到期时间强调高于计划时间和标签

## 3. Inline Editor Information Band

- [x] 3.1 将展开态 metadata 从底部摘要区移动到标题下方的信息带
- [x] 3.2 让信息带 chip 复用现有 schedule/due/tags picker 入口与保存逻辑
- [x] 3.3 移除展开态底部重复的 `Schedule` / `Due` / `Tags` 按钮，仅保留 Checklist 与非重复动作

## 4. List Stability And Verification

- [x] 4.1 统一检查并调整任务相关虚拟列表的高度估算与测量行为
- [x] 4.2 回归 Inbox、Anytime、Someday、Today、Upcoming、Project、Area 等任务列表的折叠态与展开态
- [x] 4.3 回归行内编辑器的键盘焦点、picker 打开/关闭与 click-away 行为
