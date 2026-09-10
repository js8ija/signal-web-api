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

The process binds **127.0.0.1** by default. API auth is **on** (token file
`<SIGNAL_DATA_DIR>/api-token`). Set `SIGNAL_API_AUTH=off` only for local pairing
on loopback. Set `SIGNAL_LISTEN_HOST=0.0.0.0` only if you intentionally expose
the bridge.

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
| `SIGNAL_CORS_ORIGIN` | *(unset — loopback)* | Extra allowed browser origin (not `*`; default is loopback of the bound port) |
| `SIGNAL_ALLOWED_ORIGINS` | *(unset)* | Comma-separated extra browser origins for a local host UI |
| `SIGNAL_PUBLIC_HOST` | *(unset)* | Extra allowed `Host` header name (supervisor / public hostname) |
| `SIGNAL_API_AUTH` | `on` | Bearer on `/api/*` except health. `off` / `0` / `false` skips it. `/api/admin/*` always requires the token |
| `SIGNAL_NEST_API_BASE` | *(unset)* | Optional LeanScrm Nest reverse proxy; disabled when unset |
| `SIGNAL_PROXY_URL` | *(unset)* | Single-account outbound proxy fallback (`http`/`https`/`socks`/`socks4`/`socks4a`/`socks5`/`socks5h`). No path/query/hash. Other schemes fail startup. `https://` is TLS **to the proxy**, not “target is HTTPS” — a typical HTTP CONNECT proxy is `http://user:pass@host:port` |
| `SIGNAL_NO_PROXY` | `127.0.0.1,localhost,::1` (+ Nest hostname) | Comma-separated hosts that bypass the proxy (exact match or `.suffix`) |
| `SIGNAL_WEB_TRACE` | *(unset)* | Verbose native / attachment logging |

`HTTPS_PROXY` / `https_proxy` are not consumed anywhere (including `/api/boot`). Use `SIGNAL_PROXY_URL` or `PUT /api/admin/proxy`.

On start the process writes `<SIGNAL_DATA_DIR>/api-token` (64 hex, mode `0600`) if missing, and takes an exclusive `instance.lock` on that directory. A second process on the same data dir fails. Token is accepted as `Authorization: Bearer`, `?token=`, or a 64-hex `Sec-WebSocket-Protocol` part.

## Layout

- `assets/native-manifest.json` - libsignal bridge manifest
- `bundles/workers/sql.js` - SQLCipher worker (no Electron)
- `config/`, `build/`, `_locales/en/` - boot assets
- `vendor/ts/` - vendored AttachmentCrypto + boot schema deps
- `src/server/`, `src/bridge/` - HTTP/WS bridge

## API surface

- `GET /api/health` / `GET /healthz` - liveness (`{ ok, version, serverSessionId, auth, proxy: { enabled } }`); Host/Origin only, no token
- `GET /api/boot` - renderer config + locale + native manifest
- `WS /api/bridge` - sql / ipc / native / fs (msgpack); same Host/Origin/token gates
- `POST /api/bridge/sync` - sync native calls
- `GET /api/attachment/v{1,2}/...` - decrypt + serve attachments
- `GET /api/proxy?url=...` - allowlisted CORS forwarder (Signal hosts, HTTPS)
- `GET /api/nest-config` - Nest proxy config (`enabled: false` unless env is set)
- `GET` / `PUT` / `DELETE /api/admin/proxy` - supervisor hot-swap (`{ url }` JSON or raw string). Always token-required. Applies to every live `ConnectionManager`; `SIGNAL_PROXY_URL` remains the single-account env fallback. Invalid URLs leave the previous setting unchanged. Response never includes credentials.

Point `STATIC_ROOT` at a full ochen1-signal-web tree to serve Desktop UI static bundles.

## Pair with js8ija/signal-web

Same-origin: set `STATIC_ROOT` to a signal-web (or ochen1) checkout that has `web/static` + `bundles-web`.

Cross-origin: UI uses `?apiOrigin=` / `__SIGNAL_WEB_API_ORIGIN__` / meta `signal-web-api-origin` (see signal-web `web/bridge/origin.web.ts`). CORS echoes an allowlisted `Origin` only (loopback of the bound port, plus `SIGNAL_CORS_ORIGIN` / `SIGNAL_ALLOWED_ORIGINS`). There is no default `*`. Pass the file token on API calls; old pairing that talked to the bridge with no token needs `SIGNAL_API_AUTH=off` on loopback.

This repo does **not** spawn accounts. A host-app supervisor should start one bridge process per account (`SIGNAL_DATA_DIR` unique, bind `127.0.0.1`), read `api-token`, proxy the browser to that process, and `PUT /api/admin/proxy` to hot-swap egress. Do not point the browser at a row of raw bridge ports.
