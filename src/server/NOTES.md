# Signal Web — Bridge Server Notes

## Workarounds and Decisions

### 1. Electron Import Avoidance

**Problem**: `ts/sql/main.main.ts` imports `electron` (for `app.isPackaged`) and
`ts/util/appRootDir.main.ts` also imports `electron`.

**Workaround**: Instead of importing `MainSQL`, `sql.node.ts` drives
`bundles/workers/sql.js` directly via `worker_threads`, replicating the
init/read/write protocol from `main.main.ts` without the Electron dependency.
The SQL worker binary itself has no Electron import.

**Files affected**: `src/server/sql.node.ts` (standalone; no upstream files modified)

---

### 2. Native Module Loading (ESM)

**Problem**: `@signalapp/libsignal-client/dist/Native.js` uses ESM `export` syntax.
`require()` cannot load it in a CommonJS/tsx context.

**Workaround**: `native.node.ts` uses dynamic `import()` via `initNative()` which
must be awaited before any native calls. `index.node.ts` calls `initNative()` at
startup.

---

### 3. Native Handle Wrapping

**Problem**: Neon (Rust FFI) functions in libsignal follow a Wrapper pattern:
- Functions **return** raw externals (Node.js `[External]` values with `null` prototype)
- Functions **accept** handles as `{ _nativeHandle: external }` (the `Wrapper<T>` type)

The bridge stores handles as `{ _nativeHandle: rawExternal }` so they can be
passed back to native functions correctly. Raw externals from return values are
detected by `isRawExternal()` (null prototype, no enumerable keys).

---

### 4. msgpack `undefined` → `null`

**Problem**: `@msgpack/msgpack` encodes JS `undefined` as msgpack `nil` (decoded
as `null`). `rendererConfigSchema` uses `configOptionalStringSchema` which accepts
`string | undefined` but rejects `null`.

**Workaround**: Optional config fields (`appInstance`) are only included
in the config object when they have a real value (via object spread).
`proxyUrl` remains an optional schema field but is never populated here —
`HTTPS_PROXY` is not consumed and is not copied into `/api/boot`. A
`stripUndefined()` pass is applied to the validated config before it enters the
BootPayload.

---

### 5. `locale.node.ts` not used directly

**Problem**: `app/locale.node.ts` imports from `@formatjs/intl-localematcher` and
`../ts/util/setupI18nMain.std.ts` which may drag in Electron-adjacent code.

**Workaround**: `boot.node.ts` re-implements locale loading directly from
`build/compact-locales/` (the packaged format already present from `pnpm generate`).
Keys are in `build/compact-locales/keys.json`, per-locale values in
`build/compact-locales/<locale>/values.json`. Falls back to `_locales/<locale>/messages.json`
if compact locales are absent.

---

### 6. `main.main.ts` `app.isPackaged` in `#traceDuration`

`ts/sql/main.main.ts` references `app.isPackaged` in `#traceDuration` (line ~571).
Since we bypass `MainSQL` entirely (see workaround 1), this is a non-issue.

---

### 7. SQLCipher Worker Crash at Exit

The `FATAL ERROR: Error::ThrowAsJavaScriptException napi_throw` printed at process
exit is a benign crash in the SQLCipher worker thread when the Node.js process is
forcibly terminated. It does not affect correctness. In production the server runs
continuously; in the smoke test `process.exit()` is called after tests complete.

---

### 8. Attachment HTTP serving (`attachment://` → `/api/attachment`)

**Problem**: Signal addresses images/attachments with a custom `attachment://`
URL scheme served by an Electron `protocol.handle` in
`app/attachment_channel.main.ts`. Browsers can't fetch a custom scheme
(`net::ERR_UNKNOWN_URL_SCHEME`), and that file imports `electron`
(`ipcMain`/`protocol`) at module scope, so it must never enter the server
import graph.

**Workaround**: `web/server/attachments.node.ts` is a fresh port of the
protocol handler written against Node `http` (not Electron). It imports ONLY
`decryptAttachmentV2ToSink` (ts/AttachmentCrypto.node.ts — verified clean of
electron, transitively) and `isPathInside` (ts/util/isPathInside.node.ts). The
renderer is patched via a FILE_REMAPS alias (rolldown.web.config.ts, suffix
`getLocalAttachmentUrl.std.ts` → `web/shims/getLocalAttachmentUrl.web.ts`) to
emit relative `/api/attachment/v{1,2}/<encoded path>?...` URLs instead of
`attachment://`. Upstream is untouched (desktop still uses `attachment://`).

**Simplifications** (also documented at the top of attachments.node.ts):
- *Range handling*: encrypted (v2) attachments are decrypted fully into memory
  once, then the requested byte range is sliced from the buffer (206 +
  Content-Range). Desktop streams via `@indutny/range-finder`; buffering is
  simpler and correct, and attachments are small. v1 plaintext files stream
  off disk with `createReadStream({ start, end })` (no buffering).
- *`download` disposition*: treated as an ordinary already-on-disk encrypted
  attachment (`type: 'local'`, no incremental-MAC/growing-file validation of
  in-progress downloads). Viewing a completed download works; a
  partially-written one may 500 until it finishes.
- *Path traversal*: the WHATWG URL parser normalizes `..`/`.`/`%2e` out of the
  pathname before the handler runs, so traversal via the URL path is
  structurally impossible (degrades to 404). `isPathInside` remains as
  defense-in-depth.

**Suffix-match subtlety**: the FILE_REMAPS suffix is the bare filename
`getLocalAttachmentUrl.std.ts` (NOT `util/getLocalAttachmentUrl.std.ts`),
because sibling modules in `ts/util/` import it as
`./getLocalAttachmentUrl.std.ts`, which would not match a `util/`-prefixed
suffix and would leave the upstream `attachment://` builder in the bundle.

**Disposition → dir mapping** (matches `app/attachments.node.ts`, i.e. the
renderer's real on-disk layout via `ts/util/basePaths.preload.ts`, which uses
`.noindex` suffixes):

| disposition | dir |
| ----------- | --- |
| attachment  | `attachments.noindex` |
| avatarData  | `avatars.noindex` |
| sticker     | `stickers.noindex` |
| draft       | `drafts.noindex` |
| download    | `downloads.noindex` |
| temporary   | `temp` |

`web/server/fs.node.ts` was corrected to create these `.noindex` dirs (it
previously created bare `drafts`/`stickers`/`downloads`/`avatars`, which were
never written to) and its `getDraftPath`/`getStickerPath`/`getDownloadsPath`/
`getAvatarPath` now return the `.noindex` paths so both subsystems agree.

**Files affected**: `web/server/attachments.node.ts` (new),
`web/shims/getLocalAttachmentUrl.web.ts` (new),
`web/server/index.node.ts` (route + init), `web/server/fs.node.ts` (dir
alignment), `rolldown.web.config.ts` (FILE_REMAPS entry). No upstream `ts/**`
file modified.

**Files affected (electron avoidance)**: server reads attachments without
touching `app/attachment_channel.main.ts`.

---

## IPC Channel Behavior

### Settings Channels
- `settings:get:<name>` → reads from `<dataDir>/settings.json`, falls back to defaults
- `settings:set:<name>` → writes to `<dataDir>/settings.json`, returns new value

Defaults:
```
themeSetting: 'system'
localeOverride: null
spellCheck: true
contentProtection: false
systemTraySetting: 'MinimizeToSystemTray'
mediaPermissions: false
mediaCameraPermissions: false
```

### Always-noop Channels
`executeMenuRole`, `restart`, `set-badge`, `draw-attention`, `show-window`,
`signal-app-loaded`, `ready-for-updates`, `windows-notifications:clear-all`,
`set-auto-hide-menu-bar`, `set-menu-bar-visibility`, `set-auto-launch`

### Stub Returns
- `getMainWindowStats` → `{ isMaximized: false, isFullScreen: false }`
- `getMenuOptions` → sensible MenuOptionsType
- `get-auto-launch` → `false`
- `get-media-access-status` → `'denied'`
- `DebugLogs.getLogs` → stub string
- `crash-reports:get-count` → `0`
- `sql-channel:remove-db` → calls `closeSQL()`

### Unsupported (throws SignalWebUnsupportedIpc)
- `DebugLogs.upload`
- All unknown channels (logged once per channel)

---

## Push Channels Sent at Boot
When a new WebSocket session connects, the server immediately sends:
- `window:set-window-stats` → `{ isMaximized: false, isFullScreen: false }`
- `window:set-menu-options` → MenuOptionsType

---

## Boot Payload Sync Channels
All 7 required sendSync channels are present:
1. `get-config` — validated RendererConfigType
2. `locale-data` — locale messages (compact format from build/)
3. `locale-display-names` — from build/locale-display-names.json
4. `country-display-names` — from build/country-display-names.json
5. `OS.getClassName` — hardcoded `'Gnome'` (sensible Linux default for web)
6. `get-user-data-path` — data directory path
7. `native-theme:init` — `{ shouldUseDarkColors: false }`

---

## CSS Asset URL Rewriting
CSS files served from `/stylesheets/` have `asset:///` rewritten to `/` so
that font references like `asset:///fonts/Inter.woff2` resolve as `/fonts/Inter.woff2`.

intl-tel-input flag images are served at `/node_modules/intl-tel-input/build/img/`
to match the relative URL `../node_modules/...` in compiled CSS.

---

## Protocol Extension
No gaps in `protocol.std.ts` required extension. The `ipc-send` namespace is
handled as fire-and-forget in the WS router (no response frame sent).
