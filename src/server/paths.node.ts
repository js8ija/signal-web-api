// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared path / env resolution for the standalone bridge.
 *
 * ENV:
 *   PORT                 HTTP port (default 8915)
 *   SIGNAL_DATA_DIR      Persistent data directory (default ~/.signal-web)
 *                        Alias: SIGNAL_WEB_DATA (legacy)
 *   SIGNAL_ASSETS_ROOT   Root for config/, build/, bundles/, _locales/, assets/
 *                        (default: process.cwd() — run from package root)
 *   STATIC_ROOT          Optional Desktop UI static root. If unset, the server
 *                        does not mount Desktop UI bundles (API-only mode).
 */

import { join } from 'node:path';
import os from 'node:os';

export const PORT = parseInt(process.env.PORT ?? '8915', 10);

export const DATA_DIR =
  process.env.SIGNAL_DATA_DIR ??
  process.env.SIGNAL_WEB_DATA ??
  join(os.homedir(), '.signal-web');

/** Package / assets root (config, build, bundles, locales, assets). */
export const ASSETS_ROOT =
  process.env.SIGNAL_ASSETS_ROOT ?? process.cwd();

/** @deprecated Prefer ASSETS_ROOT — kept as alias used by older call sites. */
export const REPO_ROOT = ASSETS_ROOT;

/** Optional Desktop UI static root; unset => do not mount UI static bundles. */
export const STATIC_ROOT = process.env.STATIC_ROOT?.trim() || undefined;

export const SIGNAL_ENV = process.env.SIGNAL_ENV ?? 'production';
export const LOCALE_HINT = process.env.SIGNAL_WEB_LOCALE ?? 'en';

export function sqlWorkerPath(): string {
  return join(ASSETS_ROOT, 'bundles', 'workers', 'sql.js');
}

export function nativeManifestPath(): string {
  // Prefer the standalone layout; fall back to upstream web/generated path.
  return join(ASSETS_ROOT, 'assets', 'native-manifest.json');
}

export function nativeManifestFallbackPath(): string {
  return join(ASSETS_ROOT, 'web', 'generated', 'native-manifest.json');
}
