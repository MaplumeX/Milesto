# Server Spec

Milesto sync server — self-hosted WebSocket sync endpoint.

## Location
Server source lives in a separate repository (`milesto-server/`).

## Key Documents

* [error-handling.md](error-handling.md) — WebSocket async error handling, database error propagation
* [sync-protocol.md](sync-protocol.md) — WebSocket message contracts (client ↔ server)

## Related

* Frontend: `electron/sync/sync-engine.ts` — client-side sync engine
* Cross-layer: `guides/cross-layer-thinking-guide.md`
