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
 *   SIGNAL_CORS_ORIGIN   Extra CORS origins (comma-separated). Default is the
 *                        loopback origins for the bound port — never `*`.
 *   SIGNAL_ALLOWED_HOSTS Extra Host header values (comma-separated).
 */

import { dirname, join, resolve, sep } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import os from 'node:os';

let boundPort: number | undefined;

/** Record the port actually bound (PORT=0 → ephemeral). */
export function setBoundPort(port: number): void {
  boundPort = port;
}

export function getEffectivePort(): number {
  return boundPort ?? getPort();
}

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

/**
 * Configured extra CORS origin(s), or the first loopback origin.
 * Never returns `*`.
 */
export function getCorsOrigin(): string {
  const extra = process.env.SIGNAL_CORS_ORIGIN?.trim();
  if (extra && extra !== '*') {
    return extra.split(',')[0]!.trim();
  }
  return `http://127.0.0.1:${getEffectivePort()}`;
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
 * When `followReal` is true, existing paths are compared via realpath.
 * Missing children resolve the nearest existing ancestor (blocks symlink
 * escapes on create).
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
    if (!existsSync(p)) {
      return false;
    }
    const rp = realpathSync(p);
    if (existsSync(c)) {
      const rc = realpathSync(c);
      return rc === rp || rc.startsWith(rp + sep);
    }
    // Creation path: require the nearest existing ancestor's realpath to
    // stay inside the parent, then a `..`-free lexical suffix (M10).
    let cursor = dirname(c);
    while (!existsSync(cursor)) {
      const next = dirname(cursor);
      if (next === cursor) {
        return false;
      }
      cursor = next;
    }
    const ra = realpathSync(cursor);
    if (!(ra === rp || ra.startsWith(rp + sep))) {
      return false;
    }
    const rel = c.slice(cursor.length);
    return !rel.split(sep).includes('..');
  } catch {
    return false;
  }
}
