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

- Node.js **24.15.x recommended** (native addon ABI; `>=20.19` may work if prebuilds exist)
- Native addons: `@signalapp/libsignal-client`, `@signalapp/sqlcipher`, `@signalapp/ringrtc`

## Quick start

```bash
npm install
export SIGNAL_ASSETS_ROOT="$PWD"
export SIGNAL_DATA_DIR="${SIGNAL_DATA_DIR:-$HOME/.signal-web}"
npm start   # http://127.0.0.1:8915
```

Smoke (needs native modules + SQL worker): `npm run smoke`

The process binds **127.0.0.1** by default. Set `SIGNAL_LISTEN_HOST=0.0.0.0` only if you intentionally expose the unauthenticated SQL/native bridge.

## Environment

| Variable | Default | Purpose |
| -------- | ------- | -------- |
| `PORT` | `8915` | HTTP listen port |
| `SIGNAL_LISTEN_HOST` | `127.0.0.1` | Bind address. Opt in to `0.0.0.0` to expose |
| `SIGNAL_DATA_DIR` | `~/.signal-web` | Persistent DB / attachments / settings |
| `SIGNAL_WEB_DATA` | (alias) | legacy alias for `SIGNAL_DATA_DIR` |
| `SIGNAL_ASSETS_ROOT` | `process.cwd()` | Root for config/build/bundles/_locales/assets |
| `STATIC_ROOT` | *(unset)* | Desktop UI static root; if unset, API-only |
| `SIGNAL_ENV` | `production` | Merges `config/<env>.json` (+ `local-<env>.json`) |
| `SIGNAL_WEB_LOCALE` | `en` | Locale hint for `/api/boot` |
| `SIGNAL_CORS_ORIGIN` | `*` | CORS `Access-Control-Allow-Origin` (pairing / cross-origin UI) |
| `SIGNAL_NEST_API_BASE` | *(unset)* | Optional LeanScrm Nest reverse proxy; disabled when unset |
| `SIGNAL_WEB_TRACE` | *(unset)* | Verbose native / attachment logging |

## Layout

- `assets/native-manifest.json` - libsignal bridge manifest
- `bundles/workers/sql.js` - SQLCipher worker (no Electron)
- `config/`, `build/`, `_locales/en/` - boot assets
- `vendor/ts/` - vendored AttachmentCrypto + boot schema deps
- `src/server/`, `src/bridge/` - HTTP/WS bridge

## API surface

- `GET /api/health` - liveness (`{ ok, version, serverSessionId }`)
- `GET /api/boot` - renderer config + locale + native manifest
- `WS /api/bridge` - sql / ipc / native / fs (msgpack)
- `POST /api/bridge/sync` - sync native calls
- `GET /api/attachment/v{1,2}/...` - decrypt + serve attachments
- `GET /api/proxy?url=...` - allowlisted CORS forwarder (Signal hosts, HTTPS)
- `GET /api/nest-config` - Nest proxy config (`enabled: false` unless env is set)

Point `STATIC_ROOT` at a full ochen1-signal-web tree to serve Desktop UI static bundles.

## Pair with js8ija/signal-web

Same-origin: set `STATIC_ROOT` to a signal-web (or ochen1) checkout that has `web/static` + `bundles-web`.

Cross-origin: UI uses `?apiOrigin=` / `__SIGNAL_WEB_API_ORIGIN__` / meta `signal-web-api-origin` (see signal-web `web/bridge/origin.web.ts`). HTTP routes send `Access-Control-Allow-Origin: *` by default (`SIGNAL_CORS_ORIGIN` to lock down). Combined with the loopback bind, this is for local pairing — do not expose the process on a public interface.
