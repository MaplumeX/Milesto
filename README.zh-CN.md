# Milesto

一款专注于效率、支持键盘操作的桌面任务管理工具，灵感源自 Things。基于 Electron、React 和 SQLite 构建。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-20%2B-green.svg)

## 功能特性

- **清单视图**：收集箱、今天、即将到来、随时、某天、已完成、废纸篓
- **项目与领域**：将任务组织到项目中，将项目归类到领域
- **快速收集**：通过全局快捷键随时随地添加任务
- **拖拽排序**：直观地重新排列任务、项目和领域
- **搜索**：跨所有任务和项目的全文快速搜索
- **日期管理**：安排任务、设置截止日期、查看本周日程
- **离线优先**：所有数据本地存储在 SQLite 中，无需网络即可使用
- **云同步**（可选）：基于 WebSocket 的同步引擎，支持多设备
- **国际化**：多语言支持（已接入 i18n）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, Vite |
| 桌面端 | Electron 30 |
| 数据库 | better-sqlite3（Worker 线程） |
| 状态管理 | React Context + 乐观更新 |
| 拖拽 | @dnd-kit |
| 虚拟列表 | @tanstack/react-virtual |
| 测试 | Vitest + React Testing Library |

## 架构

Milesto 采用三层通信架构：

```
渲染进程 (React)     →    主进程 (Node)     →    DB Worker 线程
      |                        |                        |
   contextBridge         ipcMain.handle()         Worker.postMessage()
   window.api                                              better-sqlite3
```

所有 SQLite 操作都在独立的 DB Worker 线程中执行，确保 UI 始终保持响应。

## 快速开始

**环境要求**：Node.js 20+ 和 npm。

```bash
# 安装依赖
npm install

# 启动开发环境（Vite + Electron）
npm run dev

# 运行测试
npm test

# 运行数据库专项测试
npm run test:db

# 生产构建
npm run build
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 完整生产构建 |
| `npm test` | 运行测试套件（Electron Node 运行时） |
| `npm run test:watch` | 测试监听模式 |
| `npm run test:db` | 运行 DB Worker 测试 |
| `npm run lint` | 运行 ESLint |
| `npm run preview` | 预览生产构建 |

## 项目结构

```
src/              React 渲染进程（页面、组件、功能模块）
electron/         Electron 主进程 + 预加载脚本 + DB Worker
  main.ts         入口文件
  preload.ts      上下文桥接（window.api）
  workers/db/     DB Worker 线程（SQLite 操作）
  sync/           云同步引擎（WebSocket）
shared/           共享代码（Schema、类型、国际化、Result 单子）
tests/            测试套件（渲染层、单元、DB）
```

## 安全

- `contextIsolation: true`，`nodeIntegration: false`
- 预加载脚本仅暴露类型化的业务级 API，不暴露原始 `ipcRenderer`
- 所有 IPC 处理器均进行发送方来源校验
- `better-sqlite3` 始终无法从渲染进程直接访问

## 许可证

MIT © 2026 Maplume
