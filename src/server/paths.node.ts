// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared path / env resolution for the standalone bridge.
 *
 * Values are read lazily so tests (and scripts/start.mjs) can set env before
 * first use. Do not cache these at module load.
 *
 * ENV:
 *   PORT                 HTTP port (default 8915)
 *   SIGNAL_LISTEN_HOST   Bind address (default 127.0.0.1 — opt in to 0.0.0.0)
 *   SIGNAL_DATA_DIR      Persistent data directory (default ~/.signal-web)
 *                        Alias: SIGNAL_WEB_DATA (legacy)
 *   SIGNAL_ASSETS_ROOT   Root for config/, build/, bundles/, _locales/, assets/
 *                        (default: process.cwd() — run from package root)
 *   STATIC_ROOT          Optional Desktop UI static root. If unset, the server
 *                        does not mount Desktop UI bundles (API-only mode).
 *   SIGNAL_CORS_ORIGIN   CORS Allow-Origin (default *). Set a concrete origin
 *                        to lock down cross-origin browser access.
 */

import { join, resolve, sep } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import os from 'node:os';

export function getPort(): number {
  const n = parseInt(process.env.PORT ?? '8915', 10);
  return Number.isFinite(n) && n >= 0 && n <= 65535 ? n : 8915;
}

/** Loopback-only by default. Set SIGNAL_LISTEN_HOST=0.0.0.0 to expose. */
export function getListenHost(): string {
  return process.env.SIGNAL_LISTEN_HOST?.trim() || '127.0.0.1';
}

export function getDataDir(): string {
  return resolve(
    process.env.SIGNAL_DATA_DIR ??
      process.env.SIGNAL_WEB_DATA ??
      join(os.homedir(), '.signal-web')
  );
}

/** Package / assets root (config, build, bundles, locales, assets). */
export function getAssetsRoot(): string {
  return resolve(process.env.SIGNAL_ASSETS_ROOT ?? process.cwd());
}

/** @deprecated Prefer getAssetsRoot() — kept as alias used by older call sites. */
export function getRepoRoot(): string {
  return getAssetsRoot();
}

/** Optional Desktop UI static root; unset => do not mount UI static bundles. */
export function getStaticRoot(): string | undefined {
  const raw = process.env.STATIC_ROOT?.trim();
  return raw ? resolve(raw) : undefined;
}

export function getSignalEnv(): string {
  return process.env.SIGNAL_ENV ?? 'production';
}

export function getLocaleHint(): string {
  return process.env.SIGNAL_WEB_LOCALE ?? 'en';
}

export function getCorsOrigin(): string {
  return process.env.SIGNAL_CORS_ORIGIN?.trim() || '*';
}

export function sqlWorkerPath(): string {
  return join(getAssetsRoot(), 'bundles', 'workers', 'sql.js');
}

export function nativeManifestPath(): string {
  // Prefer the standalone layout; fall back to upstream web/generated path.
  return join(getAssetsRoot(), 'assets', 'native-manifest.json');
}

export function nativeManifestFallbackPath(): string {
  return join(getAssetsRoot(), 'web', 'generated', 'native-manifest.json');
}

/**
 * Lexical confinement: resolved `child` is `parent` or a descendant.
 * When `followReal` is true and both paths exist, also require realpath
 * to stay inside (blocks symlink escapes).
 */
export function isFsInside(
  child: string,
  parent: string,
  followReal = false
): boolean {
  const c = resolve(child);
  const p = resolve(parent);
  const lexical = c === p || c.startsWith(p + sep);
  if (!lexical) {
    return false;
  }
  if (!followReal) {
    return true;
  }
  try {
    if (!existsSync(c) || !existsSync(p)) {
      return lexical;
    }
    const rc = realpathSync(c);
    const rp = realpathSync(p);
    return rc === rp || rc.startsWith(rp + sep);
  } catch {
    return false;
  }
}
