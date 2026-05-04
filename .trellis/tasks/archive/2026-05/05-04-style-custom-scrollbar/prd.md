# style-custom-scrollbar

## Goal

将应用所有可滚动区域的滚动条从系统原生样式优化为 6px 细条 + 主题色风格，与暗色/亮色主题协调一致，提升视觉精致感。

## Requirements

* 全局自定义 `::-webkit-scrollbar` 样式：6px 宽轨道 + 圆角 thumb，无 hover 变化
* 全局 `scrollbar-width: thin` + `scrollbar-color` 兼容 Firefox
* 亮色 / 暗色主题分别适配颜色
* `.tag-filter` 保持隐藏滚动条（已有规则不动）
* 无 hover 加粗/变色效果，保持低调一致

## Acceptance Criteria

* [ ] 所有可滚动区域显示 6px 细条主题色滚动条
* [ ] 亮色主题滚动条颜色与整体协调
* [ ] 暗色主题滚动条颜色与整体协调
* [ ] `.tag-filter` 滚动条仍隐藏
* [ ] Firefox 下滚动条样式生效（thin + 自定义颜色）
* [ ] 无 hover 变化效果

## Definition of Done

* Lint / typecheck 通过
* 手动在亮色/暗色主题下确认各区域滚动条表现

## Decision (ADR-lite)

**Context**: 需要选择滚动条宽度和交互方式
**Decision**: 6px 宽度 + 无 hover 变化
**Consequences**: 低调一致，不够醒目但不干扰视觉，拖拽区域稍小

## Out of Scope

* 引入第三方滚动条 JS 库
* 修改滚动行为本身（弹性滚动、smooth scroll 等）
* 悬浮/自动隐藏滚动条（overlay scrollbar）
* hover 变色/加粗效果

## Technical Notes

* 全局样式文件：`src/index.css`
* 主题变量定义在 `:root` 和 `@media (prefers-color-scheme: dark)` 中
* Electron 环境确保 Chromium 内核，`::-webkit-scrollbar` 完全可用
* 可滚动区域：`.nav`、`.content-scroll`、`.detail`、`.tag-picker-list`、`.palette-list`、line 2385 区域、`.settings-dialog-body`、`.markdown-body pre`、`.chat-session-list`、`.chat-messages`、`.chat-tool-body`
* 亮色主题 `--border: rgba(52, 74, 103, 0.12)`，`--muted: #5F6E82`
* 暗色主题 `--border: rgba(241, 233, 219, 0.08)`，`--muted: #B4AB9D`
