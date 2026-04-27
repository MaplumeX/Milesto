# brainstorm: GitHub 自动发布流程

## Goal

为 Milesto 新增 GitHub Actions 自动发布流程：当仓库推送语义化版本 tag 时，自动在 GitHub Release 中创建草稿版本，并在 macOS、Windows、Linux 三个平台构建 Electron 安装包后上传到同一个 Release。

## What I Already Know

* 用户要求将前面讨论的自动发布流程写入项目。
* 项目是 Electron + Vite 桌面应用，`npm run build` 会执行 `tsc && vite build && electron-builder`。
* `electron-builder.json5` 已配置 macOS `dmg`、Windows `nsis`、Linux `AppImage`，输出目录为 `release/${version}`。
* `package.json` 要求 Node.js `20.x || 22.x || 23.x || 24.x || 25.x`。
* 仓库远端为 `git@github.com:MaplumeX/Milesto.git`。
* 当前仓库没有 `.github/workflows`。

## Assumptions

* 自动发布应由 `v*.*.*` tag 触发，例如 `v0.1.1`。
* Release 初始创建为 draft，方便人工检查安装包和 release notes 后再公开发布。
* 本任务不处理 Apple notarization、macOS/Windows 代码签名、自动版本号 bump。

## Requirements

* 新增 `.github/workflows/release.yml`。
* workflow 在推送 `v*.*.*` tag 时触发。
* workflow 使用 `GITHUB_TOKEN` 创建或复用对应 tag 的 GitHub Release 草稿。
* workflow 在 `macos-latest`、`windows-latest`、`ubuntu-latest` 上分别运行：
  * `npm ci`
  * `npm run lint`
  * `npm test`
  * `npm run test:db`
  * `npm run build`
* workflow 收集 `release/**` 下生成的 `.dmg`、`.exe`、`.AppImage`，上传到对应 GitHub Release。
* workflow 权限应最小化到发布所需的 `contents: write`。

## Acceptance Criteria

* [ ] 仓库包含合法的 GitHub Actions workflow YAML。
* [ ] tag `vX.Y.Z` 推送后可以创建 draft Release。
* [ ] 三个平台构建产物会上传到同一个 Release。
* [ ] workflow 不依赖需要用户预先配置的额外 secret。
* [ ] 保持现有 `package.json` 和 `electron-builder.json5` 行为不变。

## Definition of Done

* 新增 CI 配置文件。
* 本地检查 YAML/配置基本可读性。
* 不修改无关应用代码。
* 最终说明如何触发发布。

## Out of Scope

* 应用签名、公证、证书管理。
* 自动更新服务器或 Electron auto-updater。
* changelog 生成策略定制。
* npm 包发布。

## Technical Notes

* 使用 GitHub CLI `gh release create` 和 `gh release upload`，GitHub-hosted runners 默认可用。
* 官方 actions release 信息显示 `actions/checkout@v6`、`actions/setup-node@v6` 可用。
* 直接上传 Release assets，不需要额外 artifact action。
