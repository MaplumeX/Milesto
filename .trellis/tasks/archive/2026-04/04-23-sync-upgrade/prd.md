# 服务端 SQLite → PostgreSQL 升级

## Goal

将 milesto-server 的数据库从 SQLite 升级为 PostgreSQL，以支持更高的并发、可扩展性和生产部署场景。

## Requirements

1. **数据库驱动迁移**：用 `pg` (node-postgres) 替换 `better-sqlite3`
2. **异步化所有 DB 调用**：`db.ts` 所有函数从同步改为异步（Promise-based）
3. **服务端适配**：`server.ts` 的 WebSocket handler（handlePush、handleFetch）适配 async DB 调用
4. **健康检查适配**：`index.ts` 的 `/health` 端点适配 async DB 查询
5. **数据库迁移**：用 SQL 文件实现 PostgreSQL schema 初始化（替代 SQLite PRAGMA + CREATE TABLE）
6. **Docker Compose 更新**：加入 PostgreSQL 服务，服务端通过环境变量连接
7. **环境变量更新**：新增 `DATABASE_URL`，移除 `DATA_DIR`
8. **测试更新**：`server.test.ts` 适配 PostgreSQL 异步 API
9. **优雅关闭**：确保 PostgreSQL 连接池在 shutdown 时正确关闭

## Acceptance Criteria

* [ ] `npm run typecheck` 通过
* [ ] `npm run lint` 通过
* [ ] `npm run test` 通过
* [ ] `docker compose up` 一键启动 PostgreSQL + 服务端
* [ ] WebSocket 同步功能保持正常（push/fetch/broadcast）
* [ ] 健康检查端点 `/health` 返回正确的实体数量

## Definition of Done

* 测试覆盖新增逻辑
* Lint / typecheck 通过
* Docker Compose 可运行
* README 更新（配置说明）

## Technical Approach

* 驱动选择：`pg` (node-postgres) — 最成熟稳定，生态工具完善
* 连接管理：`pg.Pool` — 支持连接池，适合服务端长期运行
* 迁移策略：启动时检查表是否存在，不存在则执行 CREATE TABLE（简单迁移，足够当前两表场景）
* SQL 方言差异：
  * SQLite `TEXT` → PostgreSQL `TEXT`
  * SQLite `INSERT OR IGNORE` → PostgreSQL `ON CONFLICT DO NOTHING`
  * SQLite `LIMIT ? OFFSET ?` → PostgreSQL `LIMIT $1 OFFSET $2`（参数化语法兼容 pg）
  * 主键复合 `(entity_type, entity_id)` 保持不变

## Decision (ADR-lite)

**Context**：需要 PostgreSQL 支持以替代 SQLite 的单文件限制
**Decision**：使用 `pg` 驱动 + `pg.Pool`
**Consequences**：代码从同步变为异步，需 async/await 化所有调用路径；`pg` 不是零依赖但生态成熟

## Out of Scope

* 多租户 / 用户隔离
* 数据库分片
* 客户端同步逻辑修改（Milesto Electron 端）
* 复杂迁移框架（如 node-pg-migrate）

## Technical Notes

* 服务端仓库路径：`/home/maplume/projects/milesto-server/`
* 核心文件：`src/db.ts`, `src/server.ts`, `src/index.ts`, `src/config.ts`
* 测试文件：`src/server.test.ts`
* Docker：`Dockerfile`, `docker-compose.yml`
* 当前 schema：`entities(entity_type, entity_id, updated_at, deleted_at, payload)`, `sync_meta(key, value)`
