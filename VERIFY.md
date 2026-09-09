<!--
Copyright 2026 Signal Web contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

# VERIFY — Phase C verification of the Phase B fixes

Independent verification of the Phase B implementation on
`fix/grok-from-opus-plan` against every item in [`FIX_PLAN.md`](./FIX_PLAN.md)
(Phase A review, PR #4). **Verification only** — the single code change made in
this phase is the Phase B regression recorded in
[Regression found and fixed](#regression-found-and-fixed).

Every item below is marked **pass**, **fail** or **waived**, with the file/line
or test name that establishes it. Claims are checked against the code, not
against the Phase B PR description.

## Verdict

**Merge ready.** All 3 Critical and all 5 High items pass, with every acceptance
criterion either asserted by a test or traced to specific code. No fails.

- **Critical**: 3 / 3 pass
- **High**: 5 / 5 pass
- **Medium**: 11 / 12 pass, 1 waived (M3, declared in `FIX_PLAN.md` SKIPPED)
- **Low**: 10 / 10 pass

One Phase B regression was found and fixed: `npm run smoke` aborted before its
first test on a clean checkout. Two residual caveats and one follow-up (M3) are
listed under [Residual observations](#residual-observations); none block the
merge.

## How this was verified

Clean checkout, `npm ci`, Node v22.14.0 (linux x64, ABI 127).

| Evidence source | Result |
| --------------- | ------ |
| `npm run smoke` (21 cases, `src/server/smoke.node.ts`) | **21 passed, 0 failed** |
| Out-of-tree probe batch 1 — 14 assertions against a real spawned server | **14 passed, 0 failed** |
| Out-of-tree probe batch 2 — 2 assertions against a real spawned server | **2 passed, 0 failed** |
| `tsc --noEmit --strict` on `src/` | 6 errors, all identical to the `e6a889b` baseline (baseline had 7) |
| Code review | Every acceptance criterion in `FIX_PLAN.md`, plus the scope guards |

The probe batches cover the acceptance criteria that the smoke suite does not
reach: they spawn `src/server/index.node.ts` as a real child process and
exercise the instance lock against a second live instance, WebSocket heartbeat
and caps, the settings size cap, the access log, `SIGTERM` shutdown, invalid
renderer config, SQL worker module-load failure, and a missing native
dependency. They are deliberately not committed — `FIX_PLAN.md` rules out a new
test framework, and they need to break the assets root and `node_modules` to
force those failure paths. Their assertions are quoted per item below.

There is no `tsconfig.json` and no typecheck script in this package, so `tsc` is
not a gate; it is used here only to compare against the baseline commit. The
partial `vendor/ts/**` tree produces unrelated errors and is excluded.

## Regression found and fixed

**`npm run smoke` could not run on a clean checkout** — commit `b90e587`.

Phase B added `import { safeContentType, parseRange } from './attachments.node.ts'`
to `smoke.node.ts`, which reaches `vendor/ts/AttachmentCrypto.node.ts` and
therefore loads libsignal's native addon. Under `tsx`, `node-gyp-build` resolves
that addon from the cwd (`EXTRACTION.md:106`), so it needs `<root>/prebuilds`.
Phase B also added a block to create that symlink — but placed it in the module
body, and ESM evaluates all `import` declarations before any module-body
statement. The block was dead code, and the run aborted before test 1 with:

```
Error: No native build was found for platform=linux arch=x64 runtime=node abi=127 uv=1 libc=glibc node=22.14.0
    loaded from: /workspace
```

This is why the claimed "21 passed" was not reproducible from a clean state: it
only passes if `<root>/prebuilds` already exists from an earlier `npm start`
(`scripts/start.mjs` creates it in a parent process, which is why `npm start` was
unaffected).

Fix: move the link into `src/server/prebuilds.node.ts`, a side-effect module
imported ahead of everything else in `smoke.node.ts`, so it runs before any
import can reach the addon. The same commit fixes the two type errors Phase B
introduced in its own new cases (`sanitizeLinkedSessionForStorage` called without
`syncedContacts`; an `assert(...)` missing its message argument), which brings
`src/` back below the baseline error count.

---

## Critical

### C1 — Origin / Host / token gate — **PASS**

All six acceptance criteria met.

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | Evil `Origin` on the WS upgrade → 403, no session | smoke `C1: WS evil Origin is 403…`; `access-control.node.ts:163` (`checkOrigin`) via `verifyClient` in `index.node.ts:684-697` — rejection happens at the upgrade, before `wss.on('connection')` |
| 2 | No `Origin` + valid token → connects; invalid/missing → 401 | smoke same case (asserts `401` and then a successful session); `checkToken` `access-control.node.ts:214-232`, `allowQuery: true` for WS (`:270`) |
| 3 | Bad `Host` on `/api/*` → 403 before routing | smoke `C1: Host allowlist and CORS default` (403 for `evil.example:8915`); `evaluateHttpApiAccess` runs at `index.node.ts:432`, ahead of every route |
| 4 | No `*` CORS; loopback default; `Vary: Origin` always | smoke same case (asserts `ACAO === http://127.0.0.1:<port>`, `!== '*'`, `Vary` contains `Origin`); `getAllowedOrigins` `access-control.node.ts:74-94`, `applyCors` `http-util.node.ts:11-27` |
| 5 | Smoke covers 1–4 and still passes end to end with the token | 21/21 including boot, sql, sync-native, ipc, health |
| 6 | Docs cover the token file, the opt-out, and `0.0.0.0` | `README.md` "API token" section + env table; `EXTRACTION.md:115-117` |

Token handling is sound: minted from `randomBytes(32)`, written `0600`
(`mintApiToken` `access-control.node.ts:49-72`), compared with `timingSafeEqual`
(`:171-179`), and accepted as `Authorization: Bearer`, `Sec-WebSocket-Protocol`
or `?token=` (`:181-212`). `warnIfExposedWithoutAuth` (`:285-293`) covers the
non-loopback-with-auth-off warning. Out-of-scope guards held: no user accounts,
no TLS, no `protocol.std.ts` change.

### C2 — `/api/bridge/sync` CSRF — **PASS**

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | `text/plain` → 415, `invokeNative` not called | smoke `C2: sync content-type, Origin, and method`; `index.node.ts:506-510` gates on content type before `readBody` |
| 2 | Foreign `Origin` → 403 | smoke same case; shared C1 gate at `index.node.ts:432` |
| 3 | `application/x-msgpack` still succeeds | smoke test 3 (`PrivateKey_Generate` → `PrivateKey_Serialize`, 32 bytes) unchanged |
| 4 | Non-`POST` → 405 | smoke same case; `index.node.ts:498-502` with `Allow: POST` |

`MAX_BODY_NATIVE_SYNC` is unchanged and the synchronous-XHR transport is intact,
as the plan required.

### C3 — `fs` namespace reaching the key and the DB — **PASS**

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | `config.json` and `db/**` forbidden across all ops | smoke `C3: fs denies config.json and db/…`; both layers present — `DENY_TOP` (`fs.node.ts:109-115`, covering `config.json`, `settings.json`, `api-token`, `instance.lock`, `db`) and the positive allowlist `isAllowlistedResolved` (`:158-174`). Every mutating and reading op routes through `safePath` (`:177-186`) |
| 2 | The attachment / temp trees still work | smoke same case (write+read under `attachments.noindex`) and `M2` (streaming `openRead`/`read`/`closeRead` under `temp`); all 13 dirs the plan enumerates are in `ATTACHMENT_DIRS` (`:49-64`) |
| 3 | `/etc/passwd` still fails; new assertions added | smoke `fs namespace rejects paths outside the data dir` |
| 4 | The error does not echo the resolved path | smoke asserts the message excludes the resolved `db` path; `forbiddenError()` returns the constant `fs: path is not allowed` (`:137-141`) |

Error name is `SignalWebFsForbidden` as specified. On-disk layout and the
disposition→dir mapping are untouched.

---

## High

### H1 — `sql-channel:remove-db` — **PASS**

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | `db.sqlite`, `-shm`, `-wal` gone afterwards | smoke `H1: sql-channel:remove-db deletes files and marks health not-ready` |
| 2 | Key not reusable; attachment/temp emptied | smoke asserts `config.json` is gone; probe **H1-2** `remove-db empties the attachment/temp trees` → `writtenBefore=true removedAfter=true dirsRecreated=true` (`wipeUserMedia` `fs.node.ts:94-107`) |
| 3 | Clear "restart required" **and** health not-ready | smoke asserts `sql-read` fails with `SQL restart required after remove-db` and `/api/health` → **503** with `sql: restart-required` (`sql.node.ts:448-463`, `index.node.ts:458-479`) |
| 4 | Smoke case asserts 1 and 3 | the case above |

`removeSQL` (`sql.node.ts:473-506`) sends `{type:'removeDB'}` to the primary and
`{type:'close'}` to the rest, exactly as the plan directed, and
`bundles/workers/sql.js` is untouched. The worker's own log line
(`[sql-worker] removeDB: Removing all database files`) appears in the smoke
output, confirming the correct worker request is reaching it.

### H2 — `/api/boot` information leak — **PASS**

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | No proxy userinfo in the payload | smoke `H2: proxyUrl strips userinfo` (`http://user:s3cret@proxy.internal:3128` → neither `user` nor `s3cret`, host retained); `stripProxyUserinfo` `boot.node.ts:55-65`, applied at `:331` |
| 2 | Foreign `Origin` rejected; `Cache-Control: no-store` | smoke test 1 asserts `no-store` (`index.node.ts:486`); the route sits behind the C1 gate |
| 3 | `rendererConfigSchema.safeParse` still succeeds | smoke test 1 |

`hostname` and `homePath` are additionally stubbed to `localhost` / `/home/user`
(`boot.node.ts:325`, `:346`), which the plan suggested. No required schema field
was removed and `vendor/ts/types/RendererConfig.std.ts` is untouched.

### H3 — Nest reverse proxy — **PASS**

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | Foreign `Origin` → 403, no upstream socket | smoke `H3: Nest Origin gate, timeout, OPTIONS not forwarded` asserts 403 **and** `upstreamHits === 0` against a real local upstream |
| 2 | Hung upstream → 504, upstream destroyed | smoke same case (504 at `SIGNAL_NEST_TIMEOUT_MS=400`); `getNestTimeoutMs` `nest-proxy.node.ts:53-56` (default 30 s, capped 120 s), `failTimeout` destroys the request at `:258-272` |
| 3 | `ALLOWED_METHODS` matches reality | smoke asserts `nestAllowsMethod('OPTIONS') === false`; `OPTIONS` removed from the set with the reason in a comment (`:23-31`) |
| 4 | Existing assertions still pass | smoke `nest proxy disabled by default and confines upstream URL` (`enabled:false`, 503, `resolveNestUpstreamUrl` confinement) |

`authorization`, `cookie` and the hop-by-hop set are dropped
(`NEST_HOP_BY_HOP` `:34-47`), and only `accept`, `content-type`, `user-agent`
are forwarded (`NEST_REQ_HEADERS` `:33`). `NestConfigPayload` is unchanged and
the proxy is still off by default.

### H4 — Nest client `?apiBase=` and `localStorage` — **PASS**

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | `?apiBase=` ignored; `/api/nest` when enabled; throws when unconfigured | smoke `H4: resolveNestApiBase ignores ?apiBase=…` — sets `window.location.search = '?apiBase=https://evil.example'` and asserts the result is `/api/nest`; the disabled case throws. `nest-client.web.ts:62-73` no longer reads the query string or `__MY_RENDER_CONFIG__` |
| 2 | No `password` / `storageServiceKey` in web storage | smoke same case asserts the serialized blob contains neither `p-secret` nor `ssk-secret`; `sanitizeLinkedSessionForStorage` (`:76-90`) is the only thing `saveLinkedSession` writes (`:285-287`) |
| 3 | `NOTES.md` records that Nest stays disabled | `src/server/NOTES.md` "Nest (H4)" section |

### H5 — Data-dir lock and `config.json` race — **PASS**

| # | Criterion | Evidence |
| - | --------- | -------- |
| 1 | Second instance exits non-zero naming the lock file and holding pid | probe **H5-1** → `exit=1`, message contains the lock path and the live holder's pid: `Another signal-web-api instance is using this data dir (lock …/instance.lock, pid 3475)`. First instance kept serving |
| 2 | Lock released on signals; stale lock reclaimed | probe **L5+H5-2a** → `SIGTERM` gives `exit=0` and the lock file is removed; probe **H5-2b** → a lock file holding a dead pid is reclaimed and the server starts (`pidAlive` `instance-lock.node.ts:27-37`) |
| 3 | `config.json` never overwritten; loser reads the winner's key | code: `loadOrCreateSqlKey` writes with `flag: 'wx'` and on `EEXIST` re-reads instead of writing (`sql.node.ts:309-334`). Not raced in a test — the `wx` flag makes the create atomic at the syscall level |
| 4 | Non-64-hex key and `encryptedKey` give distinct actionable errors | smoke `H5: instance lock, key format, encryptedKey` asserts the short-key error names `config.json` and `64 hex`, and that `encryptedKey` produces its own message (`sql.node.ts:271-307`) |
| 5 | Smoke passes and leaves no lock behind | 21/21; the smoke teardown fails the run if `instance.lock` survives (`smoke.node.ts` final block) |

`acquireDataDirLock` is taken before any subsystem init (`index.node.ts:621`) and
released on the error path, on `SIGINT`/`SIGTERM`, and on `process.on('exit')`.

---

## Medium

| ID | Verdict | Evidence |
| -- | ------- | -------- |
| M1 | **PASS** | smoke `M1/L9: attachment content-type and suffix ranges` — `text/html` → `application/octet-stream` + `Content-Disposition: attachment`; `image/png` passes through; `nosniff` and `default-src 'none'; sandbox` on every response. `safeContentType` `attachments.node.ts:132-155`, `attachmentHeaders` `:157-172` |
| M2 | **PASS** (caveat) | smoke `M2: fs readFile cap; openRead still works` (over-cap read names the cap, `openRead`/`read`/`closeRead` stream the same file); probe **M2-2** → over-cap attachment returns **413** `Attachment exceeds decrypt cap` (`:436-437`). Numbers documented in `NOTES.md`. Caveat below |
| M3 | **WAIVED** | Declared in `FIX_PLAN.md` SKIPPED and genuinely not implemented: `_registry` is still module-global (`native.node.ts:34-35`), `releaseHandles` still accepts any id (`:77-81`), and the WS `close` handler still clears only `pendingCallbacks` (`index.node.ts:735-741`). The waiver reason (needs session ids threaded through `invokeNative`/`handleFsCall`) matches the code. Follow-up |
| M4 | **PASS** | probe **M4-3** → a worker throwing at module scope makes startup fail in **486 ms** with the load error, never the 60 s timeout; probe **M4-1** → `[sql] worker 2 died: probe: worker module load failure`. Dead entries are removed from the pool and `send` rejects immediately with the recorded cause (`sql.node.ts:155-172`, `:218-220`); re-logging is guarded by the `entry.dead` early return |
| M5 | **PASS** | smoke `GET /api/health returns ok` (`ready:true`, no `cors` field, numeric `buildExpiration`) and the H1 case (**503** with a machine-readable reason). `package.json` is memoized in `_pkgVersion` (`index.node.ts:101-112`) |
| M6 | **PASS** | probe **M6** → a `production.json` with `certificateAuthority: 42` makes startup fail with `rendererConfigSchema validation failed` naming the field; probe **M6-2** → `SIGNAL_ALLOW_INVALID_CONFIG=1` restores warn-and-serve (`boot.node.ts:365-373`) |
| M7 | **PASS** | smoke asserts `assertSignalEnvConfigExists('nope')` names `config/nope.json` and lists `production` (`boot.node.ts:41-52`); startup logs the resolved endpoints — observed in the smoke run: `[boot] endpoints serverUrl=https://chat.signal.org storageUrl=… directoryUrl=…` |
| M8 | **PASS** | probe **M8-1** → 3 pings in 2.6 s at `SIGNAL_WS_PING_MS=1000`; probe **M8-2** → 4th connection rejected **503** at the upgrade with the cap at 3; probe **M8-3** → 10 of 12 concurrent calls rejected with `too many in-flight requests (max 2)` while normal traffic is unaffected (21/21 smoke). The terminate-on-missed-pong branch (`index.node.ts:747-757`) is code-verified; `_sessions` removal on close pre-dates Phase B (`push.node.ts:27`). `requestTimeout`/`headersTimeout`/`keepAliveTimeout` set at `index.node.ts:674-676` |
| M9 | **PASS** | smoke asserts the data dir and `attachments.noindex` are `0700` and `settings.json` is `0600` (`index.node.ts:620`, `fs.node.ts:85-91`, `ipc.node.ts:70-83`). The over-permissive warning (`fs.node.ts:121-135`) and the win32 early return are code-verified |
| M10 | **PASS** | smoke asserts `fs writeFile` under `<dataDir>/temp/evil → /tmp` is rejected **and** the unit-style `isFsInside(join(evilLink,'pwn'), tmpDir, true) === false` case the plan asked for, while nested creation inside the data dir still works. `isFsInside` resolves the nearest existing ancestor and rejects a `..`-bearing suffix (`paths.node.ts:126-153`) |
| M11 | **PASS** (caveat) | smoke asserts `/stylesheets/my%20file.css` → 200, `If-None-Match` → **304**, a NUL segment → **403**, `.wasm` → `application/wasm`, `.map` → `application/json`. Async `stat` + `createReadStream` at `index.node.ts:247`/`:286`. Caveat below |
| M12 | **PASS** | smoke asserts `isProxyRequestHeaderAllowed('authorization') === false` and `('content-type') === true`, plus the unchanged allowlist assertions (403 for `example.com`, `http:`, userinfo, suffix tricks, IP literals, non-443). `set-cookie`/`set-cookie2` are in `PROXY_RES_DROP` (`proxy.node.ts:85-90`) and `nosniff` is added unconditionally (`:142`); request headers are a positive allowlist (`:77-83`, `:119`) |

## Low

| ID | Verdict | Evidence |
| -- | ------- | -------- |
| L1 | **PASS** | smoke asserts `native DefinitelyNotANativeFunction_XYZ` → `Unknown native function` while all manifest entries stay callable (tests 3, 4). Allowlist from the shipped manifest (`native.node.ts:95-97`, `:361-370`) |
| L2 | **PASS** | probe **L2** → a 70 KB value is rejected with `settings value exceeds 65536 bytes` and `settings:set:themeSetting` still works; writes go through a temp file + `rename` at `0600` (`ipc.node.ts:70-83`) |
| L3 | **PASS** | smoke asserts `getOptionalResource('constructor') === undefined`; `declarations` is built on a null prototype and looked up with `hasOwnProperty` (`optionalResources.node.ts:35`, `:63`) |
| L4 | **PASS** | startup log observed in the smoke run (`[boot] buildExpiration 2026-11-07T12:12:42.467Z`), with a 14-day warn window (`boot.node.ts:73-89`); `/api/health` reports `buildExpiration` and `expired`; `README.md` documents regenerating `config/local-<env>.json` |
| L5 | **PASS** | probe **L5+H5-2a** → `SIGTERM` exits **0** after closing WS sessions and the HTTP server, then `closeSQL()`, then releasing the lock; exit 1 on failure with an 8 s force timer (`index.node.ts:809-853`). Entry detection is now an anchored path regex, not a substring (`:790-797`) |
| L6 | **PASS** | probe **L6** → `SIGNAL_ACCESS_LOG=1` produced 15 `{"ns":"access",…}` lines (one per HTTP request and per WS open/close) with no token in any of them; off by default (`index.node.ts:127-137`) |
| L7 | **PASS** | probe **L7** → a `t:'req'`/`ns:'ipc-send'` frame draws no response frame and the session stays usable. The unreachable `t:'ipc-send'` branch is gone — the baseline `tsc` error `index.node.ts(288,14): TS2367 … '"ipc-send"' have no overlap` no longer appears. `NOTES.md` "Protocol Extension" updated to match |
| L8 | **PASS** | probe **L8** → a missing `@signalapp/ringrtc` fails startup with `Missing or unloadable @signalapp/ringrtc (SQL worker load-time dependency; calling/RingRTC is not enabled). Node v22.14.0, ABI modules=127.` (`sql.node.ts:88-101`); `EXTRACTION.md:118-119` records it as a load-time worker dependency. Note: this is a `require.resolve` check, so a *present but ABI-incompatible* module instead surfaces through the M4 worker-load path — verified fast-failing by probe M4-3 |
| L9 | **PASS** | smoke asserts `Range: bytes=-3` → **206** returning `xyz`, `bytes=100-200` → **416**, and `parseRange('bytes=-4', 10)` → `{start:6,end:9}`; prefix ranges unchanged (`attachments.node.ts:177-212`) |
| L10 | **PASS** | smoke asserts `/api/health` has no `cors` field and `/api/boot` sends `Cache-Control: no-store` |

---

## Residual observations

Non-blocking. Recorded so they are not rediscovered as new findings.

1. **M2 — the plaintext cache tops out at half the decrypt cap.** The decrypt
   cap is 64 MB but `maxEntrySize` is `DECRYPT_CACHE_MAX_BYTES / 2` = 32 MB
   (`attachments.node.ts:84-88`), so an attachment between 32 MB and 64 MB
   decrypts successfully but is never cached and is re-decrypted for every byte
   range. M2's criterion 2 ("video seeking still hits the cache") therefore holds
   only up to 32 MB. The numbers are disclosed in `NOTES.md`, and concurrent
   ranges still share one decrypt via the `inFlight` map, so this is a
   performance edge rather than a correctness or safety gap.
2. **M11 — `.css` is still fully buffered.** Everything else streams, but
   stylesheets are read whole so the `asset:///` → `/` rewrite can run on the
   text (`index.node.ts:275-283`, commented). Deliberate and bounded; the M11
   criterion about not buffering holds for bundles, which is what the finding was
   about.
3. **C3 — the allowlist inherits `sqlcipher-new`.** Reusing `ATTACHMENT_DIRS` as
   the allowlist is exactly what the plan directed, and `sqlcipher-new` was
   already in that list before Phase B (`fs.node.ts:63`), so it is now
   renderer-writable and is cleared by `wipeUserMedia`. It is not the live
   database (`db/**` is denied by both layers), but it is the one DB-adjacent
   directory in the allowlist and is worth a look if the relink path ever stages
   a database there.
4. **`/healthz` is new and unauthenticated.** Not requested by the plan. It
   returns only `{ok:true}` (`index.node.ts:452-455`) and exists because
   `/api/health` now needs a token, so a supervisor still needs a liveness
   probe. Documented in `README.md`; discloses nothing.
5. **Auth-on changes what a plain `<img>` can load.** With `SIGNAL_API_AUTH` on,
   `/api/attachment/...` needs the token, and a browser cannot attach an
   `Authorization` header to an `<img>`/`<video>` load. This is inherent to C1
   and is what `SIGNAL_API_AUTH=off` exists for (called out in the plan's C1 fix
   direction and in `README.md`); the UI side still has to be updated.

## Scope constraints

All confirmed to hold.

- **No calling / RingRTC / payments enablement.** The only RingRTC reference
  added is the load-time resolvability check in `SQL_NATIVE_MODULES`
  (`sql.node.ts:30`), whose own message states calling is not enabled — the L8
  diagnostic and nothing more. No `stripe`/payments changes.
- **No `vendor/ts/**` or `bundles/**` edits.** `git diff e6a889b..HEAD -- vendor bundles`
  is empty.
- **AGPL headers preserved.** Every tracked `src/**/*.ts` file, including the new
  `access-control.node.ts`, `instance-lock.node.ts` and `prebuilds.node.ts`,
  carries the `Copyright 2026 Signal Web contributors` /
  `SPDX-License-Identifier: AGPL-3.0-only` header.
- **No new test framework.** Validation is still `npm run smoke`.
- **No force-push.** Phase C added one commit on top of the Phase B history.

## Follow-ups

1. **M3** — per-session native/fs handle registries. Waived by Phase B for the
   stated reason; still the one open plan item. Now that C1 gates who can open a
   session at all, the exposure is one authorized page reading or releasing
   another authorized page's handles, plus handles leaking on reload.
2. **M2 cache sizing** — decide whether `maxEntrySize` should track the decrypt
   cap so 32–64 MB media can still seek from cache.
