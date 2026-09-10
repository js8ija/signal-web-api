// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Hosted UI ↔ local bridge pairing.
 *
 * The page may be served from a public origin. Each launch carries the
 * loopback API address in the URL:
 *
 *   https://app.example.com/?apiOrigin=http://127.0.0.1:8915
 *   https://app.example.com/?apiOrigin=http://127.0.0.1:8915#token=<64-hex>
 *
 * Aliases: `api`, `apiUrl`, `localApi`. Token may also be a query param;
 * the page should move it to sessionStorage and strip it from the URL.
 * Non-loopback apiOrigin values are rejected so a public page cannot be
 * tricked into sending the token off-box.
 */

export const API_ORIGIN_KEYS = ['apiOrigin', 'api', 'apiUrl', 'localApi'] as const;
export const TOKEN_KEYS = ['token'] as const;
export const STORAGE_ORIGIN = 'signal-web-api.origin';
export const STORAGE_TOKEN = 'signal-web-api.token';

export type RemoteApi = {
  origin: string;
  token?: string;
};

export function isLoopbackHostname(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

/** Accept only http(s) loopback origins. Strips path/query/userinfo. */
export function canonicalizeLoopbackApiOrigin(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return undefined;
  }
  if (url.username !== '' || url.password !== '') {
    return undefined;
  }
  if (!isLoopbackHostname(url.hostname)) {
    return undefined;
  }
  return url.origin;
}

function readParam(params: URLSearchParams, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function paramsFromHash(hash: string): URLSearchParams {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) {
    return new URLSearchParams();
  }
  if (raw.startsWith('?')) {
    return new URLSearchParams(raw);
  }
  return new URLSearchParams(raw);
}

export function parseLaunchParams(
  search: string,
  hash = ''
): { apiOrigin?: string; token?: string } {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fromHash = paramsFromHash(hash);
  const originRaw = readParam(query, API_ORIGIN_KEYS) ?? readParam(fromHash, API_ORIGIN_KEYS);
  const tokenRaw = readParam(query, TOKEN_KEYS) ?? readParam(fromHash, TOKEN_KEYS);
  const apiOrigin = originRaw ? canonicalizeLoopbackApiOrigin(originRaw) : undefined;
  const token = tokenRaw && /^[0-9a-f]{64}$/i.test(tokenRaw) ? tokenRaw : undefined;
  return { apiOrigin, token };
}

function storageGet(key: string): string | undefined {
  try {
    const value = sessionStorage.getItem(key)?.trim();
    return value ? value : undefined;
  } catch {
    return undefined;
  }
}

function storageSet(key: string, value: string | undefined): void {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* private mode */
  }
}

export function rememberRemoteApi(api: RemoteApi): void {
  storageSet(STORAGE_ORIGIN, api.origin);
  storageSet(STORAGE_TOKEN, api.token);
}

function sameOriginFallback(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return canonicalizeLoopbackApiOrigin(window.location.origin);
}

/**
 * Resolve the local API for this page load.
 * Precedence: URL (this launch) → sessionStorage → loopback same-origin.
 */
export function resolveRemoteApi(
  loc: Pick<Location, 'search' | 'hash' | 'origin'> = window.location
): RemoteApi | undefined {
  const fromUrl = parseLaunchParams(loc.search, loc.hash);
  const storedOrigin = storageGet(STORAGE_ORIGIN);
  const storedToken = storageGet(STORAGE_TOKEN);
  const origin =
    fromUrl.apiOrigin ??
    (storedOrigin ? canonicalizeLoopbackApiOrigin(storedOrigin) : undefined) ??
    canonicalizeLoopbackApiOrigin(loc.origin) ??
    sameOriginFallback();
  if (!origin) {
    return undefined;
  }
  const token = fromUrl.token ?? storedToken;
  return token ? { origin, token } : { origin };
}

/** Keep apiOrigin in the query; drop token from the address bar. */
export function persistLaunchInUrl(api: RemoteApi): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('apiOrigin', api.origin);
  for (const key of TOKEN_KEYS) {
    url.searchParams.delete(key);
  }
  url.hash = '';
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

export function applyLaunchFromLocation(
  loc: Pick<Location, 'search' | 'hash' | 'origin'> = window.location
): RemoteApi | undefined {
  const api = resolveRemoteApi(loc);
  if (!api) {
    return undefined;
  }
  rememberRemoteApi(api);
  persistLaunchInUrl(api);
  return api;
}

export function apiHttpUrl(path: string, api: RemoteApi): string {
  return new URL(path, `${api.origin}/`).href;
}

export function apiWsUrl(path: string, api: RemoteApi): string {
  const http = new URL(path, `${api.origin}/`);
  http.protocol = http.protocol === 'https:' ? 'wss:' : 'ws:';
  if (api.token) {
    http.searchParams.set('token', api.token);
  }
  return http.href;
}

export function apiAuthHeaders(api: RemoteApi): Record<string, string> {
  return api.token ? { Authorization: `Bearer ${api.token}` } : {};
}
