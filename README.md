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
| `SIGNAL_WEB_UI_URL` | *(unset)* | Hosted UI base. Its origin is allowlisted. `/open` redirects here with `?apiOrigin=http://127.0.0.1:<port>` |
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

- `GET /` / `GET /console/` - hosted-capable console (`web/`). Same-origin when served by this process; deploy the folder to any HTTPS host
- `GET /open` - pairing bounce. JSON `{ apiOrigin, token, uiUrl }`, or `302` to `SIGNAL_WEB_UI_URL?apiOrigin=…#token=…` when `Accept: text/html` or `?redirect=1`
- `GET /api/connect` / `GET /api/pair` - Host/Origin only; returns the file token so a public page that already knows `apiOrigin` can talk without putting the token in the query string
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

## Hosted page + local API

The UI can live on a public HTTPS host. The bridge stays on the user's machine.
Each open carries the loopback address:

```text
https://your-ui.example/?apiOrigin=http://127.0.0.1:8915
```

Aliases: `api`, `apiUrl`, `localApi`. Optional `#token=<64-hex>` (hash is not sent to the UI host). If the token is omitted, the page calls `GET {apiOrigin}/api/connect`. Non-loopback `apiOrigin` values are rejected.

1. Deploy `web/` (this repo) — or signal-web using `src/bridge/origin.web.ts` / `client.web.ts`.
2. Local: `SIGNAL_WEB_UI_URL=https://your-ui.example npm start`
3. Open `http://127.0.0.1:8915/open` (redirects) or print the launch URL from the process log.

CORS echoes an allowlisted Origin only (loopback of the bound port, `SIGNAL_WEB_UI_URL`'s origin, `SIGNAL_CORS_ORIGIN`, `SIGNAL_ALLOWED_ORIGINS`). HTTPS→localhost preflight gets `Access-Control-Allow-Private-Network`. There is no default `*`.

This repo does **not** spawn accounts. A host-app supervisor should start one bridge process per account (`SIGNAL_DATA_DIR` unique, bind `127.0.0.1`), then open the hosted UI with that process's `apiOrigin`. Do not point the browser at a row of undocumented raw ports without this URL contract.
