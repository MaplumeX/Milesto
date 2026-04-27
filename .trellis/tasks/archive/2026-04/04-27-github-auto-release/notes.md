# GitHub 自动发布流程说明

## 触发方式

推送形如 `v0.1.1` 的 tag：

```bash
npm version patch
git push origin master
git push origin --tags
```

## 发布行为

GitHub Actions 会创建 draft Release，并从 macOS、Windows、Linux 三个平台上传 Electron Builder 产物。
