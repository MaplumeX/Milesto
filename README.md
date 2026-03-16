# Milesto

## Development

- Install: `npm ci`
- Run: `npm run dev`

`npm run dev` / `npm run build` now auto-check Electron native deps and rebuild `better-sqlite3` for the current Electron version when needed.

## Tests

- Fast unit + renderer component tests: `npm run test`
- DB action tests: `npm run test:db`

Vitest is launched through Electron's Node runtime so `better-sqlite3` stays on the same ABI as the app.

If you still hit a `better-sqlite3` Electron ABI mismatch, rebuild Electron native deps:

```bash
npx electron-builder install-app-deps
```
