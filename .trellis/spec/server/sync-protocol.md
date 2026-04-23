# Sync Protocol (WebSocket)

Client-server sync protocol over WebSocket. Server is transport-only; all payloads are E2EE encrypted by the client.

## Connection Flow

```
Client                          Server
  |                               |
  |----------- ws connect ------->|
  |<---------- open --------------|
  |                               |
  |--- {type: auth, token} ----->|
  |<-- {type: auth_result, ...}--|
  |                               |
  |--- {type: push, ...} ------->|
  |<-- broadcast to others -------|
  |                               |
  |--- {type: fetch, ...} ------->|
  |<-- {type: fetch_result, ...}-|
```

## Client → Server Messages

### auth

| Field | Type | Required |
|-------|------|----------|
| type | `"auth"` | yes |
| token | string | yes |

### push

| Field | Type | Required |
|-------|------|----------|
| type | `"push"` | yes |
| entityType | string | yes |
| entityId | string | yes |
| updatedAt | ISO string | yes |
| deletedAt | ISO string \| null | no |
| payload | string (encrypted) | yes |

### fetch

| Field | Type | Required | Default |
|-------|------|----------|---------|
| type | `"fetch"` | yes | — |
| since | ISO string | no | undefined (full sync) |
| limit | number | no | 500 |
| offset | number | no | 0 |

Limit is capped server-side at 1000.

### ping

| Field | Type | Required |
|-------|------|----------|
| type | `"ping"` | yes |

## Server → Client Messages

### auth_result

| Field | Type | Required |
|-------|------|----------|
| type | `"auth_result"` | yes |
| success | boolean | yes |
| error | string | no |

### broadcast

Sent when another client pushes an entity. Same shape as `push`.

### fetch_result

| Field | Type | Required |
|-------|------|----------|
| type | `"fetch_result"` | yes |
| entities | SyncEntity[] | yes |
| hasMore | boolean | yes |

### pong

| Field | Type | Required |
|-------|------|----------|
| type | `"pong"` | yes |

### error

| Field | Type | Required |
|-------|------|----------|
| type | `"error"` | yes |
| message | string | yes |

Sent when the server encounters an internal error processing a client message.

## Conflict Resolution

Server uses **LWW (Last-Write-Wins)** based on `updated_at` string comparison (lexicographic ISO ordering). This matches SQLite and PostgreSQL `TEXT` collation behavior.

## Security

- Server verifies `token` via HKDF-derived auth token
- `payload` is opaque to the server (client-side E2EE)
- Server only uses `entityType`, `entityId`, `updatedAt`, `deletedAt` for routing and LWW
