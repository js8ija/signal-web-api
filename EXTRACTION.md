# Extraction record

Standalone seed from ochen1/signal-web (LeanScrm/_upstream; do not clone).

## Copied runtime assets

- `bundles/workers/sql.js`
- `config/default.json`
- `config/local-production.json`
- `config/production.json`
- `build/available-locales.json`
- `build/compact-locales/en/values.json`
- `build/compact-locales/keys.json`
- `build/country-display-names.json`
- `build/dns-fallback.json`
- `build/locale-display-names.json`
- `build/optional-resources.json`
- `_locales/en/messages.json`
- `assets/native-manifest.json`

## Vendored TypeScript (vendor/ts/)

Copied from upstream ts/ via runtime value-import closure from AttachmentCrypto + RendererConfig + menu + isPathInside.
import type edges not followed; export-from followed.

Total: **54** files:

- `vendor/ts/AttachmentCrypto.node.ts`
- `vendor/ts/Bytes.std.ts`
- `vendor/ts/Crypto.node.ts`
- `vendor/ts/Curve.node.ts`
- `vendor/ts/axo/AxoTokens.std.ts`
- `vendor/ts/axo/_internal/assert.std.tsx`
- `vendor/ts/context/Bytes.std.ts`
- `vendor/ts/context/Crypto.node.ts`
- `vendor/ts/environment.std.ts`
- `vendor/ts/jobs/JobManager.std.ts`
- `vendor/ts/logging/log.std.ts`
- `vendor/ts/logging/shared.std.ts`
- `vendor/ts/sql/Interface.std.ts`
- `vendor/ts/sql/util.std.ts`
- `vendor/ts/types/AttachmentDownload.std.ts`
- `vendor/ts/types/Colors.std.ts`
- `vendor/ts/types/Crypto.std.ts`
- `vendor/ts/types/DNSFallback.std.ts`
- `vendor/ts/types/HTTPError.std.ts`
- `vendor/ts/types/I18N.std.ts`
- `vendor/ts/types/Logging.std.ts`
- `vendor/ts/types/MIME.std.ts`
- `vendor/ts/types/RendererConfig.std.ts`
- `vendor/ts/types/Util.std.ts`
- `vendor/ts/types/errors.std.ts`
- `vendor/ts/types/menu.std.ts`
- `vendor/ts/util/AttachmentCrypto.std.ts`
- `vendor/ts/util/appendMacStream.node.ts`
- `vendor/ts/util/assert.std.ts`
- `vendor/ts/util/attachmentPath.node.ts`
- `vendor/ts/util/clearTimeoutIfNecessary.std.ts`
- `vendor/ts/util/decipherWithAesKey.node.ts`
- `vendor/ts/util/drop.std.ts`
- `vendor/ts/util/durations/constants.std.ts`
- `vendor/ts/util/durations/duration-in-seconds.std.ts`
- `vendor/ts/util/durations/index.std.ts`
- `vendor/ts/util/enum.std.ts`
- `vendor/ts/util/explodePromise.std.ts`
- `vendor/ts/util/exponentialBackoff.std.ts`
- `vendor/ts/util/finalStream.node.ts`
- `vendor/ts/util/getMacAndUpdateHmac.node.ts`
- `vendor/ts/util/isNotNil.std.ts`
- `vendor/ts/util/isPathInside.node.ts`
- `vendor/ts/util/isRecord.std.ts`
- `vendor/ts/util/logPadSize.std.ts`
- `vendor/ts/util/logPadding.node.ts`
- `vendor/ts/util/missingCaseError.std.ts`
- `vendor/ts/util/prependStream.node.ts`
- `vendor/ts/util/reallyJsonStringify.std.ts`
- `vendor/ts/util/sleep.std.ts`
- `vendor/ts/util/theme.std.ts`
- `vendor/ts/util/trimPadding.node.ts`
- `vendor/ts/util/uuidToBytes.std.ts`
- `vendor/ts/util/webSafeBase64.std.ts`

## Path / env remapping

| Upstream | Standalone |
| -------- | ---------- |
| __dirname repo root | SIGNAL_ASSETS_ROOT (default cwd) |
| SIGNAL_WEB_DATA | SIGNAL_DATA_DIR (legacy alias kept) |
| always UI static | STATIC_ROOT optional |
| web/generated/native-manifest.json | assets/native-manifest.json |

Shared resolver: src/server/paths.node.ts.

## Remaining blockers

- Full Desktop UI not shipped
- Native module install / rebuild required
- Optional resources CDN needs network
- config/development.json not copied

## License

AGPL-3.0-only; see LICENSE.
