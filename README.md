# signal-web-api

Standalone Signal Web **bridge API** extracted from [ochen1/signal-web](https://github.com/ochen1/signal-web)
(itself based on Signal Desktop). Hosts the Node HTTP/WebSocket bridge
(`/api/boot`, `/api/bridge`, SQL workers, libsignal native, attachments).

Boots without the full Desktop Electron/UI tree. Desktop UI static bundles are optional (`STATIC_ROOT`).

## License

AGPL-3.0-only (same as Signal Desktop / ochen1-signal-web). See `LICENSE`.
Vendored TypeScript under `vendor/ts/` retains upstream copyright headers.

## Upstream

| Item | Location |
| ---- | -------- |
| Upstream checkout (do not clone) | LeanScrm `signal/_upstream/ochen1-signal-web` |
| Extraction notes | `EXTRACTION.md` |
| Bridge notes / workarounds | `src/server/NOTES.md` |

## Requirements

- Node.js **24.15.0** (see `package.json` engines)
- Native addon: `@signalapp/libsignal-client` (SQLCipher via the SQL worker)

## Quick start

```bash
npm install
export SIGNAL_ASSETS_ROOT="$PWD"
export SIGNAL_DATA_DIR="${SIGNAL_DATA_DIR:-$HOME/.signal-web}"
npm start   # http://localhost:8915
```

Smoke (needs native modules + SQL worker): `npm run smoke`

## Environment

| Variable | Default | Purpose |
| -------- | ------- | -------- |
| `PORT` | `8915` | HTTP listen port |
| `SIGNAL_DATA_DIR` | `~/.signal-web` | Persistent DB / attachments / settings |
| `SIGNAL_WEB_DATA` | (alias) | legacy alias for `SIGNAL_DATA_DIR` |
| `SIGNAL_ASSETS_ROOT` | `process.cwd()` | Root for config/build/bundles/_locales/assets |
| `STATIC_ROOT` | *(unset)* | Desktop UI static root; if unset, API-only |
| `SIGNAL_ENV` | `production` | Merges `config/<env>.json` (+ `local-<env>.json`) |
| `SIGNAL_WEB_LOCALE` | `en` | Locale hint for `/api/boot` |
| `SIGNAL_NEST_API_BASE` \ *(unset)* | Optional LeanScrm Nest reverse proxy |
| `SIGNAL_WEB_TRACE` | *(unset)* | Verbose native / attachment logging |

## Layout

- `assets/native-manifest.json` - libsignal bridge manifest
- `bundles/workers/sql.js` - SQLCipher worker (no Electron)
- `config/`, `build/`, `_locales/en/` - boot assets
- `vendor/ts/` - vendored AttachmentCrypto + boot schema deps
- `src/server/`, `src/bridge/` - HTTP/WS bridge

## API surface

- `GET /api/boot` - renderer config + locale + native manifest
- `WS /api/bridge` - sql /ipc / native / fs (msgpack)
- `PosT /api/bridge/sync` - sync native calls
- `GET /api/attachment/v{1,2}/...` - decrypt + serve attachments
- `GET /api/proxy?url=...` - allowlisted CORS forwarder

Point `STATIC_ROOT` at a full ochen1-signal-web tree to serve Desktop UI static bundles.

## Pair with js8ija/signal-web

Same-origin: set `STATIC_ROOT` to a signal-web (or ochen1) checkout that has `web/static` + `bundles-web`.

Cross-origin: UI uses `?apiOrigin=` / `__SIGNAL_WEB_API_ORIGIN__` / meta `signal-web-api-origin` (see signal-web `web/bridge/origin.web.ts`). This API already sends permissive CORS on HTTP routes.
