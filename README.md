# Milesto

## Development

- Install: `npm ci`
- Run: `npm run dev`

## Tests

- Fast unit + renderer component tests (no Electron runtime): `npm run test`
- DB action tests (native `better-sqlite3`, Node env): `npm run test:db`

If you hit a `better-sqlite3` Node module version mismatch, rebuild it:

```bash
npm rebuild better-sqlite3
```
