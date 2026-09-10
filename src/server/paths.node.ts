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
 *   SIGNAL_PROXY_URL     Outbound proxy for server-side Signal egress.
 *                        http/https and socks/socks4/socks4a/socks5/socks5h.
 *                        Other schemes (incl. org.signal.tls) fail startup.
 *                        HTTPS_PROXY is not read and is not a fallback.
 *   SIGNAL_NO_PROXY      Comma-separated bypass hosts (exact or .suffix).
 *                        Defaults always include 127.0.0.1, localhost, ::1,
 *                        plus the SIGNAL_NEST_API_BASE / NEST_API_BASE host.
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

export type ProxySpec = {
  scheme: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
};

export type ProxyConfig =
  | { mode: 'off' }
  | { mode: 'on'; spec: ProxySpec; raw: string }
  | { mode: 'invalid'; raw: string; reason: string };

const V1_PROXY_SCHEMES = new Set([
  'http',
  'https',
  'socks',
  'socks4',
  'socks4a',
  'socks5',
  'socks5h',
]);
const DEFAULT_PROXY_PORTS: Record<string, number> = {
  http: 80,
  https: 443,
  socks: 1080,
  socks4: 1080,
  socks4a: 1080,
  socks5: 1080,
  socks5h: 1080,
};

let cachedProxyEnv: string | undefined;
let cachedProxyConfig: ProxyConfig | undefined;

function parseProxyUrl(raw: string): ProxyConfig {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { mode: 'invalid', raw, reason: 'unparseable SIGNAL_PROXY_URL' };
  }

  // Aligned with libsignal Net.proxyOptionsFromUrl: reject "unnecessary parts".
  if ((url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    return {
      mode: 'invalid',
      raw,
      reason: 'SIGNAL_PROXY_URL must not include a path, query, or hash',
    };
  }

  const scheme = url.protocol.slice(0, -1);
  if (!V1_PROXY_SCHEMES.has(scheme)) {
    return {
      mode: 'invalid',
      raw,
      reason:
        `unsupported SIGNAL_PROXY_URL scheme '${scheme}' ` +
        `(http/https/socks/socks4/socks4a/socks5/socks5h only)`,
    };
  }

  const host = url.hostname;
  if (!host) {
    return { mode: 'invalid', raw, reason: 'SIGNAL_PROXY_URL is missing a host' };
  }

  const port =
    url.port !== '' ? Number.parseInt(url.port, 10) : DEFAULT_PROXY_PORTS[scheme]!;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      mode: 'invalid',
      raw,
      reason: `invalid proxy port '${url.port || port}' (must be 1..65535)`,
    };
  }

  let username: string | undefined;
  let password: string | undefined;
  try {
    // url.username / url.password are percent-decoded; decodeURIComponent
    // matches libsignal's proxyOptionsFromUrl.
    if (url.username !== '') {
      username = decodeURIComponent(url.username);
    }
    if (url.password !== '') {
      password = decodeURIComponent(url.password);
    }
  } catch {
    return {
      mode: 'invalid',
      raw,
      reason: 'SIGNAL_PROXY_URL has invalid userinfo encoding',
    };
  }

  const spec: ProxySpec = { scheme, host, port };
  if (username !== undefined) {
    spec.username = username;
  }
  if (password !== undefined) {
    spec.password = password;
  }
  return { mode: 'on', spec, raw };
}

/** Reads SIGNAL_PROXY_URL. Does not fall back to HTTPS_PROXY. */
export function getProxyConfig(): ProxyConfig {
  const envRaw = process.env.SIGNAL_PROXY_URL;
  if (cachedProxyConfig !== undefined && cachedProxyEnv === envRaw) {
    return cachedProxyConfig;
  }
  const trimmed = envRaw?.trim() ?? '';
  const parsed: ProxyConfig = trimmed === '' ? { mode: 'off' } : parseProxyUrl(trimmed);
  cachedProxyEnv = envRaw;
  cachedProxyConfig = parsed;
  return parsed;
}

function normalizeProxyHost(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) {
    h = h.slice(1, -1);
  }
  while (h.endsWith('.')) {
    h = h.slice(0, -1);
  }
  return h;
}

function nestBypassHost(): string | undefined {
  const raw =
    process.env.SIGNAL_NEST_API_BASE?.trim() || process.env.NEST_API_BASE?.trim() || '';
  if (!raw) {
    return undefined;
  }
  try {
    const host = normalizeProxyHost(new URL(raw).hostname);
    return host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether `host` (request target) should skip SIGNAL_PROXY_URL.
 * Reads SIGNAL_NO_PROXY on each call. Exact match or `.suffix` match.
 */
export function shouldBypassProxy(host: string): boolean {
  const target = normalizeProxyHost(host);
  if (!target) {
    return false;
  }
  const entries: Array<string> = ['127.0.0.1', 'localhost', '::1'];
  const nestHost = nestBypassHost();
  if (nestHost) {
    entries.push(nestHost);
  }
  for (const part of (process.env.SIGNAL_NO_PROXY ?? '').split(',')) {
    if (part.trim()) {
      entries.push(part);
    }
  }
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const isSuffix = trimmed.startsWith('.');
    const token = normalizeProxyHost(trimmed);
    if (!token) {
      continue;
    }
    if (isSuffix) {
      const suffix = token.startsWith('.') ? token : `.${token}`;
      if (target === suffix.slice(1) || target.endsWith(suffix)) {
        return true;
      }
    } else if (target === token) {
      return true;
    }
  }
  return false;
}

/** Replace userinfo with `***` for logs and errors. Never throws. */
export function redactProxyUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.username === '' && url.password === '') {
      return raw;
    }
    return `${url.protocol}//***@${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '[redacted-proxy-url]';
  }
}

function replaceLiteral(haystack: string, needle: string, replacement: string): string {
  if (!needle || !haystack.includes(needle)) {
    return haystack;
  }
  return haystack.split(needle).join(replacement);
}

/**
 * Strip proxy credentials from an arbitrary log or error string.
 * Replaces the configured URL (raw + href), userinfo forms (`user:pass@`,
 * `user@`), and any password substring. Does not bare-replace a short
 * username — that would mangle unrelated words (`s` → `***ocket`).
 */
export function redactProxyText(text: string): string {
  const cfg = getProxyConfig();
  if (cfg.mode === 'off') {
    return text;
  }
  let out = text;
  if (cfg.raw) {
    out = replaceLiteral(out, cfg.raw, redactProxyUrl(cfg.raw));
    try {
      const href = new URL(cfg.raw).href;
      if (href && href !== cfg.raw) {
        out = replaceLiteral(out, href, redactProxyUrl(href));
      }
    } catch {
      // raw may be unparseable when mode is invalid
    }
  }

  let username: string | undefined;
  let password: string | undefined;
  if (cfg.mode === 'on') {
    username = cfg.spec.username;
    password = cfg.spec.password;
  } else {
    try {
      const url = new URL(cfg.raw);
      if (url.username !== '') {
        username = decodeURIComponent(url.username);
      }
      if (url.password !== '') {
        password = decodeURIComponent(url.password);
      }
    } catch {
      // keep username/password unset
    }
  }

  if (username && password) {
    out = replaceLiteral(out, `${username}:${password}@`, '***@');
    const encUser = encodeURIComponent(username);
    const encPass = encodeURIComponent(password);
    if (encUser !== username || encPass !== password) {
      out = replaceLiteral(out, `${encUser}:${encPass}@`, '***@');
    }
  }
  if (username) {
    out = replaceLiteral(out, `${username}@`, '***@');
    const encUser = encodeURIComponent(username);
    if (encUser !== username) {
      out = replaceLiteral(out, `${encUser}@`, '***@');
    }
  }
  if (password) {
    out = replaceLiteral(out, password, '***');
    const encPass = encodeURIComponent(password);
    if (encPass !== password) {
      out = replaceLiteral(out, encPass, '***');
    }
  }
  return out;
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
