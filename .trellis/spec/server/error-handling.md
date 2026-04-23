# Server Error Handling

## WebSocket Async Handler Pattern

### Problem

WebSocket `message` event handlers that perform async operations (DB queries) can produce unhandled Promise rejections if the async call throws.

```typescript
// Wrong — unhandled rejection if upsertEntity throws
ws.on('message', async (data) => {
  switch (msg.type) {
    case 'push':
      await handlePush(...)  // If this throws, nobody catches it
  }
})
```

### Correct Pattern

Wrap the entire async handler body in try-catch. Send an error message to the client and log the error.

```typescript
ws.on('message', async (data) => {
  try {
    const message = parseMessage(data)
    // ... dispatch to handlers
    switch (message.type) {
      case 'push':
        await handlePush(client, message, db, clients)
        break
      // ...
    }
  } catch (err) {
    console.error(`[ws] Error handling message:`, err)
    send(ws, { type: 'error', message: 'Internal error' })
  }
})
```

## send() Safety

`WebSocket.send()` can throw if the socket closes between the `readyState` check and the actual send.

```typescript
// Correct — always wrap send in try-catch
function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      // Socket closed between check and send — ignore
    }
  }
}
```

## Graceful Shutdown Order

1. Stop accepting new connections (`syncServer.close()`)
2. Close HTTP server (`httpServer.close()`)
3. Drain DB connection pool (`await db.end()`)
4. Exit process

```typescript
async function shutdown() {
  syncServer.close()
  await new Promise<void>((r) => httpServer.close(() => r()))
  await db.end()
  process.exit(0)
}
```

## Database Error Propagation

`/health` endpoint must catch DB errors and return 500, not crash the server.

```typescript
const httpServer = createServer(async (req, res) => {
  if (req.url === '/health') {
    try {
      const count = await getEntityCount(db)
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok', entities: count }))
    } catch (err) {
      res.writeHead(500)
      res.end(JSON.stringify({ status: 'error', message: 'Database unavailable' }))
    }
  }
})
```

## LWW Upsert — Atomic Pattern

Use single-statement atomic UPSERT instead of SELECT-then-INSERT to avoid race conditions.

```sql
INSERT INTO entities (entity_type, entity_id, updated_at, deleted_at, payload)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  updated_at = EXCLUDED.updated_at,
  deleted_at = EXCLUDED.deleted_at,
  payload = EXCLUDED.payload
WHERE entities.updated_at < EXCLUDED.updated_at
RETURNING updated_at
```

Check `result.rowCount` to determine if the write was applied (1 = applied, 0 = skipped due to LWW).
