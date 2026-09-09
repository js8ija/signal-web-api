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

The process binds **127.0.0.1** by default. Token auth is **on** by default
(see `SIGNAL_API_AUTH` / `<dataDir>/api-token`). Set
`SIGNAL_LISTEN_HOST=0.0.0.0` only if you intentionally expose the bridge, and
**keep auth on** — `0.0.0.0` with `SIGNAL_API_AUTH=off` is a loud startup
warning and an open SQL/native/fs surface.

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
| `SIGNAL_CORS_ORIGIN` | loopback origins | Extra CORS origins (comma-separated). Default is `http://127.0.0.1:<port>` (+ localhost / `[::1]`). Never `*` |
| `SIGNAL_ALLOWED_HOSTS` | loopback `host:port` | Extra `Host` header allowlist entries |
| `SIGNAL_API_AUTH` | on | Set `off` to disable the API token (local pairing while the UI is updated) |
| `SIGNAL_API_TOKEN` | *(minted)* | Optional 64-hex token; otherwise written to `<dataDir>/api-token` (mode `0600`) |
| `SIGNAL_NEST_API_BASE` | *(unset)* | Optional LeanScrm Nest reverse proxy; disabled when unset |
| `SIGNAL_ALLOW_INVALID_CONFIG` | *(unset)* | Set `1` to serve a boot config that fails `rendererConfigSchema` |
| `SIGNAL_ACCESS_LOG` | *(unset)* | Set `1` for one structured line per HTTP request / WS session |
| `SIGNAL_WEB_TRACE` | *(unset)* | Verbose native / attachment logging |

## Layout

- `assets/native-manifest.json` - libsignal bridge manifest
- `bundles/workers/sql.js` - SQLCipher worker (no Electron)
- `config/`, `build/`, `_locales/en/` - boot assets
- `vendor/ts/` - vendored AttachmentCrypto + boot schema deps
- `src/server/`, `src/bridge/` - HTTP/WS bridge

## API surface

- `GET /api/health` - readiness (`{ ok, ready, sql, native, buildExpiration }`; 503 when SQL/native not ready). Requires the API token when auth is on
- `GET /healthz` - unauthenticated liveness
- `GET /api/boot` - renderer config + locale + native manifest (`Cache-Control: no-store`)
- `WS /api/bridge` - sql / ipc / native / fs (msgpack). Token via `Authorization`, `?token=`, or `Sec-WebSocket-Protocol`
- `POST /api/bridge/sync` - sync native calls (`Content-Type: application/x-msgpack`)
- `GET /api/attachment/v{1,2}/...` - decrypt + serve attachments
- `GET /api/proxy?url=...` - allowlisted CORS forwarder (Signal hosts, HTTPS)
- `GET /api/nest-config` - Nest proxy config (`enabled: false` unless env is set)

Point `STATIC_ROOT` at a full ochen1-signal-web tree to serve Desktop UI static bundles.

## Pair with js8ija/signal-web

Same-origin: set `STATIC_ROOT` to a signal-web (or ochen1) checkout that has `web/static` + `bundles-web`.

Cross-origin: UI uses `?apiOrigin=` / `__SIGNAL_WEB_API_ORIGIN__` / meta `signal-web-api-origin` (see signal-web `web/bridge/origin.web.ts`). Put the extra UI origin in `SIGNAL_CORS_ORIGIN`. The page must present the API token (`Authorization: Bearer`, `?token=`, `Sec-WebSocket-Protocol`, or `window.__SIGNAL_WEB_API_TOKEN__`). `SIGNAL_API_AUTH=off` keeps older pairing working while the UI is updated.

### API token

At startup the server writes 32 random bytes (hex) to `<SIGNAL_DATA_DIR>/api-token` (mode `0600`) and logs the value once. Send it on every `/api/*` call and on the WebSocket upgrade. `Host` must be `127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>`, or a value in `SIGNAL_ALLOWED_HOSTS`. Browser `Origin` must be absent (non-browser) or one of the loopback / configured origins.

`SIGNAL_LISTEN_HOST=0.0.0.0` requires auth on.

### Regenerating `config/local-<env>.json`

`buildCreation` / `buildExpiration` live in `config/local-production.json` (and `local-<SIGNAL_ENV>.json`). Upstream Desktop refreshes them with `pnpm run get-expire-time`. For this seed, rewrite those two millisecond timestamps (expiration should be ~60 days after creation) and restart; `/api/health` reports `buildExpiration` / `expired`. The renderer hard-stops after expiry.
