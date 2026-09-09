<!--
Copyright 2026 Signal Web contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# FIX_PLAN — security & reliability review (Phase A)

Review of `js8ija/signal-web-api` at `e6a889b` (after the harden PRs #1–#3).
**This document is the deliverable. No code fixes are implemented in this phase.**

> Phase B implemented this plan; [`VERIFY.md`](./VERIFY.md) records the Phase C
> verification result (pass / fail / waived per item, with evidence).

Every claim below was checked against the code in this repository; findings that
turned out to be wrong are listed in [Verified and discarded](#verified-and-discarded)
so nobody re-spends effort on them.

## Threat model used

The bridge binds `127.0.0.1` by default (`src/server/paths.node.ts:33`), so the
relevant attacker is **not** a remote network peer. It is:

1. **Any web page the user visits.** A page at `https://evil.example` can open
   `ws://127.0.0.1:8915/api/bridge` (WebSocket connections are not subject to
   the same-origin policy — the server must check `Origin` itself) and can send
   cross-origin HTTP requests to every `/api/*` route (`Access-Control-Allow-Origin: *`
   by default). This is the dominant risk and drives the three Critical items.
2. **DNS rebinding.** No `Host` header validation exists, so even a locked-down
   `SIGNAL_CORS_ORIGIN` is bypassable by resolving an attacker domain to
   `127.0.0.1`.
3. **Another local user / process** on a shared machine (data-dir permissions,
   key file at rest, no instance lock).
4. **A buggy or hostile renderer bundle** (the bridge trusts the browser's
   `fs`/`sql`/`native` calls completely).

Operator misconfiguration (`SIGNAL_LISTEN_HOST=0.0.0.0`) turns every Critical
item into a remote-exploitable one; that is documented in the README but not
enforced anywhere.

## Priority summary

| ID | Sev | Area | One-line |
| -- | --- | ---- | -------- |
| [C1](#c1) | Critical | auth / WS | Any web page can drive the full SQL/native/fs bridge (no `Origin`, no `Host`, no token) |
| [C2](#c2) | Critical | CSRF | `POST /api/bridge/sync` accepts cross-origin simple requests (no content-type or `Origin` gate) |
| [C3](#c3) | Critical | fs / key | `fs` namespace can read the SQLCipher key and the encrypted DB, and can delete/overwrite both |
| [H1](#h1) | High | sqlcipher | `sql-channel:remove-db` deletes nothing and permanently kills the bridge |
| [H2](#h2) | High | info leak | `/api/boot` publishes hostname, home/install paths and `HTTPS_PROXY` credentials to any origin |
| [H3](#h3) | High | Nest proxy | Cross-origin requests (incl. `Authorization`) are relayed to a private upstream, with no timeout |
| [H4](#h4) | High | Nest client | `?apiBase=` is attacker-controllable and linked-device credentials live in `localStorage` |
| [H5](#h5) | High | startup | No data-dir lock and a `config.json` write race can destroy the DB key |
| [M1](#m1) | Medium | attachments | Arbitrary `contentType` (incl. `text/html`) served from the bridge origin |
| [M2](#m2) | Medium | DoS | Unbounded in-memory decrypt, 384 MB plaintext cache, unbounded `fs.readFile` |
| [M3](#m3) | Medium | isolation | Native/fs handle registries are process-global and never freed per session |
| [M4](#m4) | Medium | sqlcipher | No SQL worker supervision; worker errors are never logged; dead workers hang requests 60 s |
| [M5](#m5) | Medium | health | `/api/health` reports `ok` even when SQL/native are dead; re-reads `package.json` per request |
| [M6](#m6) | Medium | boot | `rendererConfigSchema` failures are non-fatal, so an invalid config is served anyway |
| [M7](#m7) | Medium | config | An unknown `SIGNAL_ENV` silently serves **staging** Signal endpoints |
| [M8](#m8) | Medium | WS | No heartbeat, no connection cap, no per-socket concurrency limit |
| [M9](#m9) | Medium | permissions | Data dir and `settings.json` are created world-readable |
| [M10](#m10) | Medium | path handling | Confinement falls back to lexical-only when the target does not exist (symlink escape on create) |
| [M11](#m11) | Medium | static | No percent-decoding, synchronous blocking reads, no `ETag`, missing `.wasm` MIME |
| [M12](#m12) | Medium | proxy | `set-cookie` relayed to the browser; `authorization` relayed upstream; no `nosniff` |
| [L1](#l1) | Low | native | `invokeNative` is not restricted to the published manifest |
| [L2](#l2) | Low | ipc | `settings:set:*` accepts unbounded values and writes synchronously per call |
| [L3](#l3) | Low | resources | `declarations[name]` uses raw property lookup (inherited keys) |
| [L4](#l4) | Low | config | `buildExpiration` is 2026-11-07 with no refresh path and no surfacing |
| [L5](#l5) | Low | lifecycle | Shutdown never closes the HTTP/WS server, always exits 0, entry detection is a substring match |
| [L6](#l6) | Low | observability | No request logging on a bridge that can read the entire message DB |
| [L7](#l7) | Low | protocol | `ipc-send` frame handling is dead code and inconsistent with the client |
| [L8](#l8) | Low | startup | The SQL worker hard-requires `@signalapp/ringrtc`; a missing prebuild fails opaquely |
| [L9](#l9) | Low | attachments | Suffix byte ranges (`bytes=-N`) are ignored and answered with a full 200 |
| [L10](#l10) | Low | headers | `/api/health` echoes CORS config; `/api/boot` has no `Cache-Control: no-store` |

Suggested sequencing: **C1 → C2 → C3** first (they share one access-control
mechanism and should land as one small, reviewable change set), then H1/H5
(data-loss), then H2/H3/H4, then the M items, then L items opportunistically.

---

## Critical

### C1

**Any web page can drive the full bridge — no `Origin` check, no `Host` check, no auth.**

- Severity: **Critical**
- Files: `src/server/index.node.ts:479-515` (`new WebSocketServer({ server, path, maxPayload })` — no `verifyClient`, no upgrade-time origin check), `src/server/index.node.ts:299-305` (`handleHttpRequest` derives the URL from `req.url` only and never inspects `req.headers.host`), `src/server/http-util.node.ts:11-22` (`applyCors`), `src/server/paths.node.ts:69-71` (`getCorsOrigin()` default `*`), `src/server/paths.node.ts:33-35` (`getListenHost`).

Evidence and impact. There is no authentication anywhere in `src/server/`
(`rg -i "authorization|token|verifyClient"` finds only the `/api/proxy`
hop-by-hop list and the Nest header passthrough). A page on any origin can:

- `ws://127.0.0.1:8915/api/bridge` → `sql-read` any `DataReader` method (the
  whole decrypted message/contact DB), `sql-write` any mutation, `ipc`
  (settings), `fs` (see [C3](#c3)), `native` (libsignal).
- Reach every `/api/*` route cross-origin and read the response, because
  `Access-Control-Allow-Origin: *` is the default.

Setting `SIGNAL_CORS_ORIGIN` does **not** close this: (a) it is not consulted on
the WebSocket upgrade at all, and (b) with no `Host` allowlist, DNS rebinding
makes the attacker's page genuinely same-origin.

Fix direction (minimal, no refactor): one small access-control module used by
`handleHttpRequest` and by a `verifyClient`/`upgrade` hook.

- Allowlist `Origin`: absent (non-browser client) or exactly one of the
  configured origins. Default = the loopback origins for the configured
  host/port, not `*`.
- Allowlist `Host`: `req.headers.host` must be `127.0.0.1:<port>`,
  `localhost:<port>`, `[::1]:<port>`, or an explicitly configured value.
- Mint a token at startup (32 random bytes), write it to
  `<dataDir>/api-token` with mode `0600`, log it once, accept it as
  `Authorization: Bearer …`, and — because browsers cannot set headers on a
  `WebSocket` — also as a `Sec-WebSocket-Protocol` value or `?token=` query
  parameter on the upgrade. Provide an explicit opt-out
  (e.g. `SIGNAL_API_AUTH=off`) so existing local pairing keeps working while
  the UI side is updated.
- Log a loud warning at startup when `SIGNAL_LISTEN_HOST` is not loopback and
  auth is off.

Acceptance criteria:

1. A WebSocket upgrade to `/api/bridge` carrying `Origin: https://evil.example`
   is rejected with HTTP 403 and no `SessionState` is created.
2. An upgrade with no `Origin` and a valid token succeeds; with an invalid or
   missing token (auth enabled) it is rejected 401.
3. Any `/api/*` request whose `Host` header is not in the allowlist is rejected
   403 before routing.
4. `SIGNAL_CORS_ORIGIN` unset no longer emits `Access-Control-Allow-Origin: *`;
   the default is the loopback origin(s), and `Vary: Origin` is always set.
5. `npm run smoke` gains cases for 1–4 and still passes end to end (boot, sql,
   sync-native, ipc, health) using the token.
6. README/`EXTRACTION.md` document the token file, the opt-out, and the fact
   that `SIGNAL_LISTEN_HOST=0.0.0.0` requires auth on.

Out of scope: user accounts, TLS termination, rate limiting (that is [M8](#m8)),
and any change to the bridge wire protocol in `src/bridge/protocol.std.ts`.

### C2

**`POST /api/bridge/sync` is CSRF-able: no `Origin` gate and no content-type gate.**

- Severity: **Critical**
- Files: `src/server/index.node.ts:337-374`, `src/server/http-util.node.ts:24-62` (`readBody`), `src/bridge/client.web.ts:282-313` (the real client already sends `content-type: application/x-msgpack`).

The handler decodes the body as msgpack and invokes `native` without looking at
`Origin`, `Sec-Fetch-Site`, or `Content-Type`. Because `text/plain` is a
CORS-safelisted content type, an attacker page can POST msgpack bytes with **no
preflight at all** and invoke arbitrary libsignal functions. Even without
reading the response, this is a state-changing, resource-consuming primitive
(and a crash primitive — see [L1](#l1)).

Fix direction: reuse the C1 gate, and additionally require the content type the
client already sends.

Acceptance criteria:

1. `POST /api/bridge/sync` with `Content-Type: text/plain` is rejected 415 and
   `invokeNative` is not called.
2. The same request with a foreign `Origin` is rejected 403.
3. `Content-Type: application/x-msgpack` (as sent by
   `BridgeClient.syncCall`) with a valid token/Origin still succeeds — the
   existing smoke test `PrivateKey_Generate` → `PrivateKey_Serialize` passes
   unchanged.
4. Non-`POST` methods on that path return 405 (today they fall through to the
   static handler and 404).

Out of scope: replacing the synchronous-XHR transport, and changing
`MAX_BODY_NATIVE_SYNC`.

### C3

**The `fs` namespace exposes the SQLCipher key and the encrypted database.**

- Severity: **Critical**
- Files: `src/server/fs.node.ts:100-111` (`safePath` confines to the data dir and nothing further), `src/server/fs.node.ts:147-198` (`readFile`/`writeFile`/`unlink`/`rm`/`rename`/`truncate`), `src/server/sql.node.ts:173-211` (`loadOrCreateSqlKey` → `<dataDir>/config.json`), `src/server/sql.node.ts:223-239` (`configDir = <dataDir>/db`; the worker opens `<configDir>/sql/db.sqlite` — see `bundles/workers/sql.js`, `Oo({configDir,key,isPrimary})`).

`safePath` only asserts "inside the data dir". Both the key file and the
database live inside the data dir, so any bridge client can:

- `fs readFile <dataDir>/config.json` → the raw SQLCipher key,
- `fs readFile <dataDir>/db/sql/db.sqlite` → the ciphertext,

which together are a complete offline copy of the user's Signal history. The
same primitive in reverse (`writeFile`/`truncate`/`rm` on `config.json` or the
`db/` tree) is **permanent data loss**: overwriting the key makes the DB
unreadable forever.

Fix direction: turn `safePath` from "inside the data dir" into "inside the
subdirectories the renderer legitimately uses". The allowlist already exists as
`ATTACHMENT_DIRS` (`src/server/fs.node.ts:40-55`) plus the paths returned by the
`get*Path` ops. Add an explicit denylist for `config.json`, `settings.json`,
`api-token`, and `db/**` as a second layer.

Acceptance criteria:

1. `fs readFile` / `writeFile` / `unlink` / `rm` / `rename` / `truncate` /
   `openRead` / `openWrite` on `<dataDir>/config.json` and on any path under
   `<dataDir>/db/` throw a `SignalWebFsForbidden`-named error.
2. Reads and writes under `attachments.noindex`, `attachments.noindex/attachment-downloads`,
   `temp`, `drafts.noindex`, `stickers.noindex`, `downloads.noindex`,
   `avatars.noindex`, `badges.noindex`, `megaphones.noindex`, `profileAvatars`,
   `groupAvatars`, `badgeImages`, `wallpapers` still succeed (the link-and-sync
   streaming path in particular must keep working).
3. The existing smoke assertion that `fs readFile /etc/passwd` fails still
   passes, and new assertions cover 1 and 2.
4. The error message does not echo the full resolved path back to the client.

Out of scope: encrypting `config.json` at rest (no OS keyring equivalent of
Electron `safeStorage` here — track separately), and changing the on-disk
layout or the disposition→dir mapping.

---

## High

### H1

**`sql-channel:remove-db` removes nothing and permanently disables the bridge.**

- Severity: **High** (privacy + availability + silent failure)
- Files: `src/server/ipc.node.ts:261-267`, `src/server/index.node.ts:463` (`setRemoveDbFn(closeSQL)`), `src/server/sql.node.ts:302-327` (`closeSQL`), `bundles/workers/sql.js` (the worker implements a distinct `{ type: 'removeDB' }` request that `rmSync`s `db.sqlite`, `-shm`, `-wal`).

The renderer's "delete all data" path is wired to `closeSQL()`, which sends
`{type:'close'}`; the worker then closes the DB and calls `process.exit(0)`.
Consequences:

- The database files, the plaintext key in `config.json`, and every attachment
  stay on disk — the user believes their data was erased.
- `initialized` is set to `false` and `pool` is emptied with no re-init path, so
  every later `sql-read`/`sql-write` throws `SQL is not initialized` until the
  process is restarted, while `/api/health` keeps reporting `ok: true`
  ([M5](#m5)).

Fix direction: send `{type:'removeDB'}` to the primary worker (and `close` to
the rest), then remove the key material and the attachment/temp trees, then
either re-initialize the pool or mark the process as requiring a restart and
report that on `/api/health`.

Acceptance criteria:

1. After the `sql-channel:remove-db` invoke resolves, `<dataDir>/db/sql/db.sqlite`,
   `-shm` and `-wal` do not exist.
2. The SQLCipher key is not reusable afterwards (`config.json` removed or the
   key rotated), and attachment/temp directories are emptied.
3. Either subsequent `sql-read` calls work against a fresh empty DB, or they
   fail with a clear "restart required" error **and** `/api/health` reports
   not-ready.
4. A smoke case (against the temp data dir) asserts 1 and 3.

Out of scope: implementing a full account-reset/relink flow, and touching the
prebuilt `bundles/workers/sql.js`.

### H2

**`/api/boot` publishes host details and proxy credentials to any origin.**

- Severity: **High**
- Files: `src/server/boot.node.ts:253-278` (`hostname: os.hostname()`, `osRelease`, `osVersion`, `homePath: os.homedir()`, `installPath`, `userDataPath`, `crashDumpsPath`), `src/server/boot.node.ts:258-262` (`proxyUrl: process.env.HTTPS_PROXY || process.env.https_proxy`), `src/server/index.node.ts:324-335` (route; no `Cache-Control`).

`HTTPS_PROXY` commonly contains `http://user:password@host:port`. The whole
value is copied into the boot payload verbatim and served, unauthenticated,
with `Access-Control-Allow-Origin: *` — so any page can read the proxy
credentials plus the machine hostname and local filesystem layout (useful for
targeting the [C3](#c3) primitives).

Fix direction: strip userinfo from `proxyUrl` before it enters the payload;
gate `/api/boot` behind the C1 check; consider replacing `hostname`/`homePath`
with stubs (the renderer uses them for debug logs, which are already stubbed in
`src/server/ipc.node.ts:251-254`); add `Cache-Control: no-store`.

Acceptance criteria:

1. With `HTTPS_PROXY=http://user:s3cret@proxy.internal:3128`, the `/api/boot`
   payload contains neither `user` nor `s3cret` (host/port may remain).
2. `/api/boot` is rejected for a foreign `Origin` and returns
   `Cache-Control: no-store`.
3. `rendererConfigSchema.safeParse` on the resulting payload still succeeds
   (the existing smoke assertion must not regress).

Out of scope: removing fields the schema marks as required, and any change to
`vendor/ts/types/RendererConfig.std.ts`.

### H3

**The Nest reverse proxy relays arbitrary cross-origin requests to a private upstream, with no timeout.**

- Severity: **High** (only when `SIGNAL_NEST_API_BASE` is set — off by default, `src/server/nest-proxy.node.ts:34-51`)
- Files: `src/server/nest-proxy.node.ts:117-239`, in particular `:152-157` (methods `GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS`), `:182-197` (forwards `authorization` and `content-type`), `:199-238` (`lib.request` with no `timeout`), `src/server/index.node.ts:416-424` (routing) and `:306-308` (the global `OPTIONS` short-circuit).

The origin-confinement logic itself is correct (see
[Verified and discarded](#verified-and-discarded)); the problem is *who* is
allowed to use the tunnel. With CORS `*` and no `Origin` check, any page becomes
a client of the operator's private Nest instance, including write methods, and
`Authorization` headers it supplies are forwarded verbatim. Separately, a
hanging upstream holds the connection (and the `await new Promise`) open
indefinitely because no socket/response timeout is set. `OPTIONS` is listed as
allowed but is unreachable — `handleHttpRequest` answers all `OPTIONS` with 204
before Nest routing — so Nest can never negotiate its own preflight.

Fix direction: apply the C1 gate to `/api/nest*`; add an upstream timeout with
504 on expiry and `upstream.destroy()`; drop hop-by-hop and `cookie` headers
explicitly; either forward `OPTIONS` to Nest or remove it from
`ALLOWED_METHODS` so the code matches reality.

Acceptance criteria:

1. With `SIGNAL_NEST_API_BASE` set, a request carrying a foreign `Origin` is
   rejected 403 and no upstream socket is opened.
2. An upstream that accepts the connection and never responds yields a 504
   within a configurable timeout (default ≤ 30 s), and the upstream request is
   destroyed.
3. `ALLOWED_METHODS` and the actual reachable methods agree; a test asserts the
   `OPTIONS` behaviour that is chosen.
4. The existing smoke assertions still pass: proxy disabled → `/api/nest-config`
   returns `enabled: false`, `/api/nest/...` returns 503, and
   `resolveNestUpstreamUrl('http://127.0.0.1:3010', '/api/nest//evil.com/steal', '')`
   stays on the configured origin.

Out of scope: adding Nest features, changing `NestConfigPayload`, or enabling
the proxy by default.

### H4

**The Nest client takes its API base from a URL query parameter and persists device credentials in `localStorage`.**

- Severity: **High**
- Files: `src/bridge/nest-client.web.ts:58-72` (`resolveNestApiBase` prefers `?apiBase=`), `:170-190` (`openStream` POSTs `username`, `password`, `storageServiceKey`, `number` to `${apiBase}/messages/stream`), `:226-239` (`send`), `:257-273` (`localStorage` under `leanscrm.nest.linkedSession`).

A single crafted link — `http://127.0.0.1:8915/?apiBase=https://evil.example` —
makes the client post the linked device's long-lived Signal credentials to an
attacker-controlled host. Independently, storing `password` and
`storageServiceKey` in `localStorage` means any script that reaches the bridge
origin (including a `text/html` attachment served per [M1](#m1)) can read them,
and they persist across sessions in plaintext.

Fix direction: never read `apiBase` from the query string; prefer the
same-origin proxy path from `/api/nest-config` (`clientBase`) and fall back only
to a build-time constant; keep credentials in memory (or behind the server) and
persist at most a non-secret session handle.

Acceptance criteria:

1. `resolveNestApiBase()` ignores `?apiBase=` entirely; with Nest enabled it
   returns `/api/nest`, and with Nest disabled it returns the configured base or
   throws — never an attacker-supplied origin.
2. No code path writes `password` or `storageServiceKey` to `localStorage` or
   `sessionStorage`; `LINKED_SESSION_KEY` contents contain no secret material.
3. A note in `src/server/NOTES.md` records that Nest remains disabled unless
   `SIGNAL_NEST_API_BASE` is set.

Out of scope: the Nest provisioning/messaging feature set itself, retiring the
adapter, and anything touching payments.

### H5

**No data-dir lock, and the `config.json` key write is a TOCTOU race.**

- Severity: **High** (permanent data loss)
- Files: `src/server/sql.node.ts:173-211` (`existsSync` then `writeFileSync` — non-exclusive), `src/server/index.node.ts:437-447` (`startServer` creates the data dir and initializes subsystems with no instance lock), `src/server/paths.node.ts:37-42` (`getDataDir`).

Two instances started against the same `SIGNAL_DATA_DIR` (easy: `npm start`
twice, or a systemd restart overlapping the old process) both see no
`config.json`, both generate a key, and the second `writeFileSync` wins. The
first instance is then holding a DB encrypted with a key that no longer exists
on disk → the database becomes permanently unreadable. Even with a key already
present, four workers per process × N processes write to the same WAL with no
coordination; Electron's single-instance lock is what upstream relies on and it
does not exist here.

There is also no format validation: the worker interpolates the key into
`pragma key = "x'<key>'"`, so only 64 hex characters are valid, but
`loadOrCreateSqlKey` accepts any string of length ≥ 10 — a malformed key
surfaces as an opaque SQLCipher error at init. And a data dir produced by
modern Signal Desktop stores `encryptedKey` (OS keyring) rather than `key`,
which currently fails with the misleading message "Invalid SQLCipher key …
Refusing to overwrite an existing config."

Fix direction: acquire an exclusive lock file in the data dir at startup
(`open(..., 'wx')` with the pid, stale-pid detection, released on exit); create
`config.json` with flag `wx` and, on `EEXIST`, re-read instead of writing;
validate `/^[0-9a-f]{64}$/i`; detect `encryptedKey` and emit an actionable
error.

Acceptance criteria:

1. Starting a second instance against the same data dir exits non-zero with a
   message naming the lock file and the holding pid; the first instance is
   unaffected.
2. The lock is released on `SIGINT`/`SIGTERM` and a stale lock (dead pid) is
   reclaimed automatically.
3. `config.json` is never overwritten: a concurrent create loses the race and
   the loser reads the winner's key.
4. A key that is not 64 hex chars fails startup with a message that names the
   file and the expected format; a `config.json` containing only `encryptedKey`
   produces a distinct, actionable error.
5. `npm run smoke` (temp data dir) still passes and does not leave a lock file
   behind.

Out of scope: multi-process support for the SQL pool, and migrating an existing
Signal Desktop profile.

---

## Medium

### M1

**Attachment responses honor an arbitrary `contentType`, including `text/html`.**

- Severity: **Medium**
- Files: `src/server/attachments.node.ts:127-143` (`safeContentType` only validates the *shape* of the MIME type), `:366` (taken from the query string), `:212-218` / `:263-268` (response headers).

`X-Content-Type-Options: nosniff` prevents sniffing but not an explicit
`Content-Type: text/html`. Combined with the `fs` write primitive
([C3](#c3)) or any attacker-influenced attachment path, this yields script
execution on the bridge origin — which is the origin that hosts the UI when
`STATIC_ROOT` is set, i.e. same-origin access to the whole bridge. Desktop's
handler restricts the type to image/video; this port deliberately widened it
(documented at `src/server/attachments.node.ts:43-47`).

Fix direction: allowlist `image/*`, `video/*`, `audio/*` and
`application/octet-stream`; anything else becomes `application/octet-stream`
plus `Content-Disposition: attachment`. Add
`Content-Security-Policy: default-src 'none'; sandbox`.

Acceptance criteria:

1. `?contentType=text/html` yields `Content-Type: application/octet-stream` and
   `Content-Disposition: attachment`.
2. `?contentType=image/png`, `video/mp4`, `audio/ogg` are passed through
   unchanged, and inline `<img>`/`<video>`/`<audio>` playback (including range
   requests) still works.
3. Every attachment response carries `nosniff` and the CSP header.

Out of scope: the buffer-then-slice range strategy, and the incremental-MAC
`download` disposition gap (both documented simplifications).

### M2

**Unbounded in-memory decryption, a 384 MB plaintext cache, and an unbounded `fs.readFile`.**

- Severity: **Medium** (availability; also plaintext retention)
- Files: `src/server/attachments.node.ts:80-88` (`DECRYPT_CACHE_MAX_BYTES = 384 MB`, `maxEntrySize = 192 MB`, `ttl = 10 min`), `:174-193` (`decryptToBuffer` concatenates the whole plaintext), `src/server/fs.node.ts:192-193` (`readFile` returns the entire file as one msgpack value), `src/server/index.node.ts:482` (inbound `maxPayload` 16 MB, but nothing bounds outbound frames).

A handful of concurrent range requests for large media can hold ~0.5 GB of
decrypted plaintext resident; `fs.readFile` on a multi-gigabyte link-and-sync
archive (or on `db.sqlite`) will OOM the process or exceed Node's max buffer
length. Decrypted plaintext of E2EE media also lives in RAM for up to ten
minutes after the request.

Fix direction: cap decrypt-to-memory (e.g. 64 MB) and return 413 (or stream)
above it; cap `fs.readFile` and direct larger reads to the existing
`openRead`/`read` handle path; cap the encoded size of outbound WS frames;
consider lowering the cache TTL.

Acceptance criteria:

1. `fs readFile` on a file larger than the configured cap rejects with a
   distinct error naming the cap; `openRead`/`read`/`closeRead` still stream the
   same file successfully.
2. An attachment larger than the decrypt cap returns a defined status instead of
   buffering it whole; attachments below the cap are unchanged and video seeking
   still hits the cache (no re-decrypt per range).
3. Documented cache/DoS trade-off in `src/server/NOTES.md`, with the numbers.

Out of scope: implementing seeking streaming decryption
(`@indutny/range-finder`-style).

### M3

**Native and fs handle registries are process-global and never freed per session.**

- Severity: **Medium**
- Files: `src/server/native.node.ts:34-36` (`_registry` module-global), `:44-51` (`storeHandle` hands out sequential small integers), `:77-81` (`releaseHandles` takes any id), `src/server/fs.node.ts:72-74` (`_writeHandles`/`_readHandles` global, `_nextHandle` sequential), `src/server/index.node.ts:484-515` (the `close` handler clears only `pendingCallbacks`).

Handle ids are guessable sequential integers in one global namespace, so one
WebSocket session can use — or `release` — another session's native objects
(including keys), and can leave file handles open. Nothing is reclaimed when a
socket closes, so a page reload leaks every handle it created and read/write
streams stay open until process exit.

Fix direction: move the registries into `SessionState` (or key them by session
id), free them in the `close` handler, and cap the number of live handles per
session. The sync `/api/bridge/sync` path already passes `null` for the socket
and a fresh callback map, so it needs its own short-lived scope.

Acceptance criteria:

1. Closing a WebSocket drops that session's native handles (`getRegistrySize()`
   returns to its pre-session value) and destroys its open read/write streams.
2. A handle minted on session A is not usable from session B (distinct error).
3. Exceeding the per-session handle cap fails the call rather than growing
   without bound.
4. The existing smoke test — native call, then `release`, then "released handle
   must fail" — still passes.

Out of scope: replacing integer handles with unguessable tokens on the wire
(protocol change).

### M4

**No SQL worker supervision: worker errors are never logged and dead workers hang requests for 60 s.**

- Severity: **Medium**
- Files: `src/server/sql.node.ts:109-122` (`entry.worker.on('error')` only rejects *in-flight* seqs and logs nothing; `on('exit')` likewise), `:126-147` (`send` posts to a dead worker and waits for the timeout), `:149-158` (`getWorker` keeps returning dead pool entries), `:44-46` (`SQL_CALL_TIMEOUT_MS = 60_000`).

If a worker dies (native ABI mismatch, OOM, the sqlcipher NAPI abort noted in
`src/server/NOTES.md:74-80`) with no request outstanding, nothing is printed
anywhere and the entry stays in the pool. Every subsequent read routed to it
hangs for a full minute and then fails with `sql worker timeout after 60000ms`,
which points the reader at the wrong problem. During startup the same shape can
turn a `require()` failure inside the worker into a 60-second hang followed by a
misleading `(init)` timeout.

Fix direction: log `error`/`exit` unconditionally with the worker index; mark
the entry dead and remove it from the pool; reject immediately (with the
underlying error) any request routed to a dead worker; respawn + re-`init`
non-primary workers, and fail fast if the primary dies. Cover the "worker died
before `init` was sent" window explicitly.

Acceptance criteria:

1. A worker that exits or errors produces exactly one log line naming the
   worker and the cause.
2. After a worker death, no request waits on the 60 s timeout — calls either go
   to a healthy worker or fail immediately with the recorded cause.
3. A worker that fails at module load makes `initializeSQL` reject with that
   load error, not with a timeout, and `startServer` exits non-zero promptly.
4. `closeSQL()` remains idempotent and still leaves no pending timers.

Out of scope: changing `WORKER_COUNT`, the read/write split, or the WAL
checkpoint policy.

### M5

**`/api/health` reports `ok` regardless of actual readiness, and does file I/O per request.**

- Severity: **Medium**
- Files: `src/server/index.node.ts:310-321`, `:76-82` (`getPkgVersion()` re-reads and re-parses `package.json` on every call), `src/server/sql.node.ts:215-216` (`initialized`).

The endpoint is a pure liveness stub: it returns `ok: true` even when the SQL
pool has been torn down ([H1](#h1)), when a worker is dead ([M4](#m4)), or when
the native module failed to bootstrap. Nothing an operator or a supervisor can
key off. It also echoes the CORS configuration ([L10](#l10)) and performs a
synchronous read per request, which is a cheap unauthenticated way to add event
loop work.

Fix direction: export readiness from the SQL and native layers, report
`{ ok, ready, sql, native, buildExpiration }`, return 503 when not ready, and
memoize the package version at startup.

Acceptance criteria:

1. `/api/health` returns 503 with a machine-readable reason when the SQL pool is
   not initialized or the primary worker is dead; 200 with `ready: true`
   otherwise.
2. The response reports whether the build is past `buildExpiration`
   ([L4](#l4)).
3. `package.json` is read at most once per process.
4. The existing smoke assertion (`health.ok === true` on a healthy server) still
   passes.

Out of scope: adding a metrics endpoint or a full readiness/liveness split.

### M6

**`rendererConfigSchema` validation failures are logged and then ignored.**

- Severity: **Medium**
- Files: `src/server/boot.node.ts:287-305`.

On a schema failure the code logs the flattened error and serves the *raw*
config anyway ("the browser side can handle partial config"). In practice the
renderer will fail later, far from the cause. This is exactly the kind of
startup misconfiguration (missing `certificateAuthority`, bad
`build/dns-fallback.json`, unknown `SIGNAL_ENV`) that should be caught at boot.

Fix direction: fail startup on validation failure in the default (production)
environment, with an explicit escape hatch (e.g. `SIGNAL_ALLOW_INVALID_CONFIG=1`)
for development; keep the flattened error in the message.

Acceptance criteria:

1. With a deliberately broken `config/production.json`, `startServer()` rejects
   and the process exits non-zero with the field-level errors in the output.
2. With the escape hatch set, the old behaviour (warn and serve) is preserved.
3. The healthy path is unchanged and the smoke `safeParse` assertion still
   passes.

Out of scope: editing `vendor/ts/types/RendererConfig.std.ts` or relaxing the
schema.

### M7

**An unknown `SIGNAL_ENV` silently serves staging Signal endpoints.**

- Severity: **Medium**
- Files: `src/server/boot.node.ts:154-177`, `config/default.json` (staging: `chat.staging.signal.org`, `cdsi.staging.signal.org`, staging CDNs), `config/production.json` (production overrides), `src/server/paths.node.ts:61-63` (`SIGNAL_ENV` default `production`).

`config/default.json` is the staging layer; production values only arrive via
`config/production.json`. `SIGNAL_ENV=development` (explicitly called out as
"not copied" in `EXTRACTION.md:99`) or any typo therefore produces a config that
reports `environment: development` while actually pointing at staging servers,
and `boot.node.ts` fills the remaining gaps with hardcoded *production*
fallbacks — a mixed staging/production config that can send a registration to
the wrong backend.

Fix direction: require `config/<SIGNAL_ENV>.json` to exist (fail fast with the
list of available environments), and log the resolved `serverUrl`/`directoryUrl`
at startup so the target is unambiguous.

Acceptance criteria:

1. `SIGNAL_ENV=nope npm start` exits non-zero naming the missing file and the
   environments that do exist.
2. Startup logs the effective `serverUrl`, `storageUrl` and `directoryUrl`.
3. `SIGNAL_ENV=production` (the default) is unchanged and points at production
   hosts; the smoke test still passes.

Out of scope: adding a `config/development.json`, and changing any endpoint
values.

### M8

**No WebSocket heartbeat, no connection cap, no per-socket concurrency limit.**

- Severity: **Medium**
- Files: `src/server/index.node.ts:479-515`, `:282-294` (`handleMessage` fires `void handleRequest(...)` per frame with no bound), `src/server/push.node.ts:24-28` (`_sessions` grows per connection), `src/server/sql.node.ts:52` (unbounded `pending` map).

Half-open TCP connections are never reaped (no ping/pong, no idle timeout), so
`_sessions` and `pendingCallbacks` accumulate; and a single socket can queue
unlimited concurrent `sql`/`native` calls, each pinning a worker slot for up to
60 s. No `server.requestTimeout`/`headersTimeout`/`keepAliveTimeout` tuning
either.

Fix direction: `ws` ping interval with termination of unresponsive sockets, a
max-connections cap, and a per-session in-flight request cap that queues or
rejects beyond the limit.

Acceptance criteria:

1. A socket that stops responding to pings is terminated within a bounded
   interval and removed from `_sessions`.
2. Connections beyond the configured cap are rejected at the upgrade with a
   clear close code/status.
3. A session exceeding the in-flight cap gets a defined error rather than
   unbounded queueing; normal renderer traffic (which is bursty at boot) is not
   throttled — the smoke test must still pass unchanged.

Out of scope: general HTTP rate limiting and any queueing/priority scheme inside
the SQL pool.

### M9

**Data directory and `settings.json` are created world-readable.**

- Severity: **Medium**
- Files: `src/server/index.node.ts:438-439` (`mkdirSync(dataDir, { recursive: true })` → mode `0777 & ~umask`, typically `0755`), `src/server/fs.node.ts:76-81` (same for the attachment dirs), `src/server/ipc.node.ts:68-73` (`writeFileSync(settings.json)` → `0644`), `src/server/sql.node.ts:200-209` (`config.json` is correctly `0600`, best-effort `chmod`).

Only the key file is protected. On a multi-user machine, other local users can
list and read attachments (v1 attachments are plaintext on disk), drafts,
`settings.json`, and the encrypted DB.

Fix direction: create the data dir and its subdirectories with mode `0700`,
write `settings.json` with `0600`, and log a warning when an existing data dir
is group/other-readable.

Acceptance criteria:

1. A freshly created data dir and all `ATTACHMENT_DIRS` are `0700` on POSIX.
2. `settings.json` is `0600`.
3. An existing over-permissive data dir produces one startup warning naming the
   path and mode (no automatic chmod of user data).
4. Windows/other platforms are not broken by the mode arguments.

Out of scope: encrypting attachments at rest beyond what Signal already does.

### M10

**Path confinement degrades to lexical-only when the target does not exist, allowing a symlink escape on create.**

- Severity: **Medium**
- Files: `src/server/paths.node.ts:91-115` (`isFsInside(..., followReal = true)` returns the lexical result when `child` or `parent` does not exist), `src/server/fs.node.ts:100-111` (`safePath` used by `openWrite`, `writeFile`, `mkdir`, `rename`, `ensureFile`), `src/server/index.node.ts:152-156` (static, reads only), `src/server/attachments.node.ts:356-363` (reads; the file is `stat`ed first, so realpath does apply).

For *creation* paths the file does not exist yet, so the realpath check is
skipped and only the lexical prefix test runs. A symlinked directory inside the
data dir (`<dataDir>/temp/x -> /etc`) therefore lets a write land outside the
data dir. Reads are fine because the target must exist.

Fix direction: resolve the nearest existing ancestor and require *its* realpath
to stay inside the parent, then confirm the remaining lexical suffix contains no
`..`. Apply consistently in `safePath`.

Acceptance criteria:

1. With `<dataDir>/temp/evil` symlinked to a directory outside the data dir,
   `fs writeFile`, `openWrite`, `mkdir`, `ensureFile` and `rename` targeting a
   path under it are rejected.
2. Ordinary creation of new files and nested directories inside the data dir
   still works (including the streaming write path).
3. A unit-style assertion for the "nonexistent child under a symlinked parent"
   case is added next to the existing `isFsInside` assertions in the smoke test.

Out of scope: replacing the helper with an `O_NOFOLLOW`/`openat`-based
implementation.

### M11

**Static serving: no percent-decoding, synchronous blocking reads, no caching validators, missing MIME types.**

- Severity: **Medium** (reliability; only active when `STATIC_ROOT` is set)
- Files: `src/server/index.node.ts:139-183` (`serveStaticFile`), `:92-112` (`MIME`, `getMime`).

Verified behaviours:

- The raw `url.pathname` is joined to the mount root with no
  `decodeURIComponent`, so any asset whose name contains a space or non-ASCII
  character 404s (`new URL('http://x/my%20file.css').pathname` stays
  `'/my%20file.css'`).
- `existsSync` + `statSync` + `readFileSync` run on the event loop and load the
  whole file into memory for every request — a multi-megabyte bundle blocks the
  loop, which also stalls the bridge.
- No `ETag`/`Last-Modified`/conditional handling, so `Cache-Control: no-cache`
  on app code means a full re-download of every bundle on every reload.
- `.wasm` and `.map` are missing from `MIME`, so `.wasm` is served as
  `application/octet-stream` and `WebAssembly.instantiateStreaming` rejects.

Fix direction: percent-decode each path segment (rejecting NUL and `..` after
decoding, mirroring `attachments.node.ts:329-344`), switch to
`createReadStream` with async `stat`, add `ETag`/`If-None-Match` → 304, and add
the missing MIME entries.

Acceptance criteria:

1. A file named `my file.css` under a mount is served for `/stylesheets/my%20file.css`.
2. A path that decodes to contain `..` or NUL is rejected 403 and never reaches
   `readFileSync`; the existing `isFsInside` prefix assertion still holds.
3. Static responses stream (no full-file buffering) and a repeat request with
   `If-None-Match` returns 304.
4. `.wasm` → `application/wasm`, `.map` → `application/json`.

Out of scope: adding compression, a CDN layer, or an in-memory asset cache;
serving the UI is optional and unchanged when `STATIC_ROOT` is unset.

### M12

**`/api/proxy` relays `set-cookie` to the browser and `authorization` upstream, without `nosniff`.**

- Severity: **Medium**
- Files: `src/server/proxy.node.ts:60-75` (`HOP_BY_HOP` strips request `cookie`/`origin`/`referer` but not `authorization`), `:116-124` (response headers are copied except hop-by-hop and `content-encoding` — so `set-cookie` passes through).

The host allowlist itself is sound (see
[Verified and discarded](#verified-and-discarded)). What remains: an upstream
`Set-Cookie` is replayed onto the bridge origin, response bodies are returned
without `X-Content-Type-Options: nosniff`, and a browser-supplied
`Authorization` header is forwarded to Signal hosts by any origin that can reach
the endpoint.

Fix direction: drop `set-cookie`/`set-cookie2` from the response, add `nosniff`,
and forward only a small request-header allowlist (`accept`, `accept-language`,
`content-type`, `range`, `user-agent`) rather than everything-minus-denylist.

Acceptance criteria:

1. An upstream response containing `Set-Cookie` produces a proxied response with
   no `Set-Cookie`.
2. Proxied responses include `X-Content-Type-Options: nosniff`.
3. Only allowlisted request headers reach the upstream (asserted with a local
   test double).
4. The existing smoke assertions for the allowlist (403 for `example.com`,
   rejection of `http:`, userinfo, suffix tricks, IP literals, non-443 ports)
   still pass.

Out of scope: broadening or narrowing `ALLOWED_HOST_SUFFIXES`, and touching
`signalFetch`'s CA handling.

---

## Low

### L1

**`invokeNative` is not restricted to the published manifest.**

- Severity: **Low** (hardening; matters more once [C1](#c1)/[C2](#c2) land)
- Files: `src/server/native.node.ts:352-355` (`Native[method]`, any exported function), `assets/native-manifest.json` (577 entries, 492 `sync`).

The manifest the server already loads and ships to the client
(`src/server/index.node.ts:449-460`) is a ready-made allowlist. Restricting to
it makes the reachable surface explicit and shrinks the blast radius of a Rust
panic in libsignal (which aborts the whole process, killing the bridge).

Acceptance criteria: a `native` call for a name absent from the manifest fails
with `Unknown native function` without invoking anything; every manifest entry
remains callable; the smoke native tests pass.

Out of scope: argument-shape validation per native function.

### L2

**`settings:set:*` accepts unbounded values and writes synchronously on every call.**

- Severity: **Low**
- Files: `src/server/ipc.node.ts:162-176`, `:68-73` (`saveSettings` → `writeFileSync` per set).

Key names are already guarded against `__proto__`/`constructor`/`prototype`
(`:38-49`, `:150`, `:166`), but a client can store arbitrarily large values,
filling the disk, and each set does a blocking write.

Acceptance criteria: values above a documented size cap are rejected with a
clear error; writes are coalesced (debounced or atomic write-and-rename) with no
lost update; the smoke `settings:get:themeSetting` case still passes.

### L3

**`getOptionalResource` looks up declarations with raw property access.**

- Severity: **Low**
- Files: `src/server/optionalResources.node.ts:53-63` (`declarations[name]`).

`name` comes from the client (`OptionalResourceService:getData`), so
`'constructor'` or `'toString'` returns an inherited value instead of
`undefined`. It currently fails safe (`new URL(undefined)` throws and is
caught), but it should not depend on that.

Acceptance criteria: `declarations` is built with a null prototype or looked up
via `Object.prototype.hasOwnProperty`; `getOptionalResource('constructor')`
returns `undefined` with no fetch attempted; digest/size verification is
unchanged.

### L4

**`buildExpiration` is 2026-11-07, baked into a committed file, with no refresh path.**

- Severity: **Low**
- Files: `config/local-production.json` (`buildCreation` 2026-09-08, `buildExpiration` 2026-11-07), `src/server/boot.node.ts:168-177`, `:234-235`.

Signal's renderer hard-stops when the build expires. Today that will surface as
an inexplicably dead UI with a healthy-looking `/api/health`.

Acceptance criteria: startup logs the expiration date and warns when it is
within a documented window; `/api/health` reports expiry ([M5](#m5)); the
README documents how to regenerate `config/local-<env>.json`.

### L5

**Shutdown never closes the HTTP/WS server, always exits 0, and entry detection is a substring match.**

- Severity: **Low**
- Files: `src/server/index.node.ts:545-576`.

`shutdown()` calls `closeSQL()` and then `process.exit(0)` even when the close
failed, and never calls `server.close()`/`wss.close()`, so in-flight requests
are cut and the exit code hides failures. Signal handlers are only installed on
the standalone path. `isLaunchedAsServerEntry()` matches *any* argv element
ending in `src/server/index.node.ts`, so an unrelated argument with that suffix
would auto-start a server.

Acceptance criteria: shutdown stops accepting connections, closes WS sessions,
awaits `closeSQL()` and exits non-zero if it failed, with a bounded force-exit
timer; the smoke test's own lifecycle (it calls `startServer()` after importing
the module) is unaffected.

### L6

**No request logging.**

- Severity: **Low**
- Files: `src/server/index.node.ts:296-433` (only `SIGNAL_WEB_TRACE` attachment logging at `:382-387`).

A service that can read the entire message database leaves no trace of who
called it. A minimal, opt-in access log (method, path, status, duration, and the
`Origin` once [C1](#c1) exists) makes abuse and misconfiguration diagnosable.
`pino` is already a dependency.

Acceptance criteria: an opt-in env flag enables one structured line per HTTP
request and per WS session open/close; no request/response bodies, keys, tokens
or attachment query strings are logged; disabled by default.

### L7

**`ipc-send` frame handling is dead code and inconsistent with the client.**

- Severity: **Low**
- Files: `src/server/index.node.ts:251-254` (`ns === 'ipc-send'` → `warnSendOnce`, no response) and `:287-291` (`frame.t === 'ipc-send'` → routed to `handleRequest` where `ns` is `undefined` → `Unknown namespace: undefined`), `src/bridge/client.web.ts:269-274` (`send()` always emits `t: 'req'` with `ns: 'ipc-send'`), `src/bridge/protocol.std.ts:19-26`.

The `t: 'ipc-send'` branch is unreachable from the real client and would answer
with an error frame for an id that no one is waiting on.

Acceptance criteria: exactly one code path handles fire-and-forget sends; the
unreachable branch is removed or made correct; `src/server/NOTES.md:217-219`
matches the implementation.

### L8

**The SQL worker hard-requires `@signalapp/ringrtc`; a missing prebuild fails opaquely.**

- Severity: **Low** (startup diagnosability)
- Files: `bundles/workers/sql.js:2` (`require('@signalapp/ringrtc')` and `require('@signalapp/sqlcipher')` at module scope), `package.json:24-26`, `src/server/sql.node.ts:66-71` (only checks that the worker *file* exists).

Calling is out of scope, yet the prebuilt SQL worker pulls RingRTC in at load
time, so an ABI-incompatible or missing RingRTC prebuild breaks the database —
surfacing as a worker load failure (see [M4](#m4)) rather than a clear
"native module missing" message.

Acceptance criteria: a missing or unloadable `@signalapp/sqlcipher` /
`@signalapp/ringrtc` produces a startup error that names the module, the Node
version and the ABI expectation; `EXTRACTION.md` records that RingRTC is a
load-time dependency of the SQL worker even though calling is stubbed.

Out of scope: **enabling calling or any RingRTC functionality**, and rebuilding
`bundles/workers/sql.js`.

### L9

**Suffix byte ranges are ignored.**

- Severity: **Low**
- Files: `src/server/attachments.node.ts:145-171` (`parseRange` matches only `bytes=START-` / `bytes=START-END`).

`Range: bytes=-N` (last N bytes) returns a full 200 with the whole body instead
of a 206. Harmless for Chromium's media pipeline, wrong per RFC 9110, and
wasteful for large media.

Acceptance criteria: suffix ranges produce a correct 206 with `Content-Range`;
unsatisfiable ranges produce 416; existing prefix-range behaviour and video
seeking are unchanged.

### L10

**`/api/health` echoes CORS config; `/api/boot` has no `Cache-Control`.**

- Severity: **Low**
- Files: `src/server/index.node.ts:310-321` (`cors: getCorsOrigin()`), `:324-335`.

Minor configuration disclosure on an unauthenticated endpoint, and a boot
payload containing local paths that intermediaries/browsers may cache.

Acceptance criteria: `/api/health` no longer returns the CORS setting (or
returns it only when authenticated); `/api/boot` sends
`Cache-Control: no-store`.

---

## Verified and discarded

Checked against the code and **not** worth fixing — recorded so they are not
re-reported:

- **msgpack prototype pollution.** `@msgpack/msgpack@3.1.3` refuses `__proto__`
  map keys at decode time (`DecodeError: The key __proto__ is not allowed`,
  reproduced locally against hand-encoded bytes). Neither
  `src/server/index.node.ts:274-280` nor `handleFsCall`/`handleIpcInvoke` can be
  polluted through the wire format. `ipc.node.ts:38-49` additionally filters
  `__proto__`/`constructor`/`prototype` for settings keys.
- **`/api/proxy` SSRF via redirects.** `signalFetch` uses `https.request`
  (`src/server/signalFetch.node.ts:70-78`), which does not follow redirects; an
  upstream 3xx is handed back to the browser, so the server never fetches an
  attacker-chosen host.
- **`/api/proxy` allowlist bypasses.** `isAllowedProxyUrl`
  (`src/server/proxy.node.ts:22-57`) requires `https:`, rejects userinfo,
  non-443 ports and IP-literal hosts, and matches apex-or-subdomain, so
  `evil-signal.org`, `cdn.signal.org.evil.com`, trailing-dot hosts and IP
  literals are all rejected. Already covered by
  `src/server/smoke.node.ts:335-347`.
- **Nest path escape / protocol-relative suffix.** `resolveNestUpstreamUrl`
  (`src/server/nest-proxy.node.ts:82-110`) collapses leading slashes and then
  compares protocol, hostname and effective port against the configured base.
  Covered by `src/server/smoke.node.ts:357-367`. The remaining Nest issues are
  [H3](#h3) (who may use it) — not confinement.
- **Attachment path traversal via the URL.** WHATWG `URL` normalizes
  percent-encoded dot segments before the handler runs (verified:
  `new URL('http://x/a/%2e%2e/b').pathname === '/b'`), and
  `attachments.node.ts:329-344` rejects `.`, `..` and NUL per decoded segment
  before `isFsInside(..., followReal = true)`. Because reads require an existing
  file, the realpath check does apply here (contrast [M10](#m10), which is about
  *creation* paths in the `fs` namespace).
- **Static mount prefix confusion.** `/bundles-evil/...` does not match the
  `/bundles` mount, and `isFsInside` rejects sibling-prefix escapes
  (`src/server/index.node.ts:141-156`; asserted in
  `src/server/smoke.node.ts:386-388`).
- **Server-side DNS resolution.** There is none: `build/dns-fallback.json` is
  read and passed through into the boot payload
  (`src/server/boot.node.ts:211-218`, `:250`) for the renderer's benefit only.
  No `node:dns` usage anywhere in `src/`. The DNS-related risk that *does* exist
  is rebinding against the HTTP/WS listener, folded into [C1](#c1).
- **SQLCipher key in `/api/boot`.** The boot payload does not contain the DB
  key; `loadOrCreateSqlKey` keeps it in `<dataDir>/config.json` (mode `0600`).
  The real exposure path is the `fs` namespace ([C3](#c3)).
- **`package-lock.json` missing native deps.** Already fixed in `1b2cc32`:
  `@signalapp/sqlcipher@3.3.5` and `@signalapp/ringrtc@2.69.0` are present in
  the lockfile.
- **Loopback default / Nest default-off.** Both already correct
  (`src/server/paths.node.ts:33-35`, `src/server/nest-proxy.node.ts:34-51`) and
  asserted by the smoke test. The plan does not change either default.

## Global out-of-scope for the implementation phase

- **No calling / RingRTC enablement.** `L8` is strictly about a clearer failure
  message for a load-time dependency of the prebuilt SQL worker.
- **No payments / Stripe work.** `stripePublishableKey` in
  `config/production.json` is a publishable key and stays untouched.
- **No drive-by refactors.** Each item above is a localized change to the files
  it names. Do not restructure `src/server/*` layering, rename exports, change
  the bridge wire protocol (`src/bridge/protocol.std.ts`), or reformat
  untouched code.
- **No changes to `vendor/ts/**` or `bundles/**`.** These are vendored upstream
  artifacts; AGPL-3.0-only headers and upstream copyright lines must be
  preserved everywhere (including the `// Copyright 2026 Signal Web
  contributors` / `SPDX-License-Identifier: AGPL-3.0-only` headers on every
  `src/` file).
- **No new test framework.** There is no unit test runner in this package;
  extend `src/server/smoke.node.ts` (`npm run smoke`), which already covers
  boot, sql, sync-native, ipc, health, proxy allowlist, Nest confinement and fs
  confinement, and which must keep passing.
- **No default-behaviour changes beyond access control.** Ports, data-dir
  layout, disposition→dir mapping and the loopback bind stay as they are.

---

## SKIPPED

| ID | Reason |
| -- | ------ |
| M3 | Per-session native/fs handle registries need threading session ids through `invokeNative` / `handleFsCall` and a sync-path scope. Not a small localized change; left for a follow-up so C1–C3 / H1–H5 stay reviewable. |
