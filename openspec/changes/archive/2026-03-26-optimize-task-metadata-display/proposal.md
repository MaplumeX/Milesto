## Why

当前任务条目在折叠态下不会暴露计划时间、到期时间和标签，用户必须展开后才能确认关键信息，导致列表扫描效率偏低。展开态又把 metadata 分散在底部摘要 chips 和重复操作按钮里，层级噪声较高，信息与入口不够统一。

## What Changes

- 为折叠态任务条目新增右对齐的 metadata 预览簇，显示计划时间、到期时间和标签预览。
- 为折叠态标签预览增加“前 2 个标签名 + `+N`”的压缩规则，并在窄宽度下优先保留 metadata、提前截断标题。
- 调整行内展开编辑器的结构，将 metadata 提升为标题下方的信息带，并让 metadata chip 成为主编辑入口。
- 移除展开态底部重复的 `Schedule` / `Due` / `Tags` 控件，只保留不重复的动作入口。
- 扩展任务列表层的数据契约，提供轻量 tag preview 数据，避免按行补调详情接口。

## Capabilities

### New Capabilities
- `task-row-metadata-display`: 折叠态任务条目以右对齐 metadata 簇显示计划时间、到期时间和标签预览。

### Modified Capabilities
- `task-inline-editor`: 行内展开编辑器将 metadata 提升为标题下方的信息带，并移除底部重复 metadata 入口。

## Impact

- Renderer：`TaskRow`、任务列表相关渲染器、行内编辑器布局与样式
- Shared schema：任务列表/搜索结果的轻量 metadata 预览字段
- DB list queries：任务列表查询需要一次性聚合 tag preview 数据
- Virtualized lists：如果折叠态高度变化，需要同步校准相关 `estimateSize`
