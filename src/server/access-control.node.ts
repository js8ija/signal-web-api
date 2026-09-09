// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared Host / Origin / token gate for HTTP /api/* and the WebSocket upgrade.
 *
 * Default CORS is the loopback origins for the bound port — never `*`.
 * A token is minted at startup (unless SIGNAL_API_AUTH=off) and accepted as
 * `Authorization: Bearer`, `Sec-WebSocket-Protocol`, or WS `?token=`.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getEffectivePort, getListenHost } from './paths.node.ts';

export const API_TOKEN_FILENAME = 'api-token';

export type AccessDecision =
  | { ok: true }
  | { ok: false; status: number; message: string };

let currentToken = '';

export function isApiAuthEnabled(): boolean {
  const raw = process.env.SIGNAL_API_AUTH?.trim().toLowerCase();
  return raw !== 'off' && raw !== '0' && raw !== 'false';
}

export function isLoopbackListenHost(host = getListenHost()): boolean {
  const h = host.trim().toLowerCase();
  return (
    h === '127.0.0.1' ||
    h === 'localhost' ||
    h === '::1' ||
    h === '[::1]'
  );
}

export function getApiToken(): string {
  return currentToken;
}

export function apiTokenPath(dataDir: string): string {
  return join(dataDir, API_TOKEN_FILENAME);
}

export function mintApiToken(dataDir: string): string {
  if (!isApiAuthEnabled()) {
    currentToken = '';
    return '';
  }
  const forced = process.env.SIGNAL_API_TOKEN?.trim();
  const token =
    forced && /^[0-9a-f]{64}$/i.test(forced)
      ? forced
      : randomBytes(32).toString('hex');
  const path = apiTokenPath(dataDir);
  writeFileSync(path, token, { encoding: 'utf-8', mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best-effort */
  }
  currentToken = token;
  console.log(
    `[server] API token written to ${path} (Authorization: Bearer, WS ?token=, or Sec-WebSocket-Protocol)`
  );
  console.log(`[server] API token: ${token}`);
  return token;
}

export function getAllowedOrigins(): string[] {
  const port = getEffectivePort();
  const loopback = [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://[::1]:${port}`,
  ];
  const extra = (process.env.SIGNAL_CORS_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s !== '*');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const origin of [...loopback, ...extra]) {
    if (!seen.has(origin)) {
      seen.add(origin);
      out.push(origin);
    }
  }
  return out;
}

/** First allowed origin — never `*`. Used when the request has no Origin. */
export function defaultCorsOrigin(): string {
  return getAllowedOrigins()[0] ?? `http://127.0.0.1:${getEffectivePort()}`;
}

export function getAllowedHosts(): string[] {
  const port = getEffectivePort();
  const base = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  const extra = (process.env.SIGNAL_ALLOWED_HOSTS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeHost);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const host of [...base, ...extra]) {
    const n = normalizeHost(host);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function normalizeHost(host: string): string {
  const trimmed = host.trim();
  const ipv6 = trimmed.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (ipv6) {
    const addr = ipv6[1]!.toLowerCase();
    return ipv6[2] ? `[${addr}]:${ipv6[2]}` : `[${addr}]`;
  }
  const idx = trimmed.lastIndexOf(':');
  if (idx > 0 && !trimmed.includes(']')) {
    return `${trimmed.slice(0, idx).toLowerCase()}:${trimmed.slice(idx + 1)}`;
  }
  return trimmed.toLowerCase();
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (origin == null) {
    return true;
  }
  return getAllowedOrigins().includes(origin);
}

export function checkHost(req: IncomingMessage): AccessDecision {
  const raw = headerValue(req.headers.host);
  if (raw == null) {
    return { ok: false, status: 403, message: 'Forbidden: missing Host' };
  }
  const host = normalizeHost(raw);
  if (!getAllowedHosts().includes(host)) {
    return { ok: false, status: 403, message: 'Forbidden: invalid Host' };
  }
  return { ok: true };
}

export function checkOrigin(req: IncomingMessage): AccessDecision {
  const origin = headerValue(req.headers.origin);
  if (!isOriginAllowed(origin)) {
    return { ok: false, status: 403, message: 'Forbidden: invalid Origin' };
  }
  return { ok: true };
}

function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function extractProvidedToken(
  req: IncomingMessage,
  opts: { allowQuery: boolean }
): string | undefined {
  const auth = headerValue(req.headers.authorization);
  if (auth) {
    const match = auth.match(/^Bearer\s+(\S+)$/i);
    if (match) {
      return match[1];
    }
  }
  const proto = headerValue(req.headers['sec-websocket-protocol']);
  if (proto && currentToken) {
    for (const part of proto.split(',').map(s => s.trim())) {
      if (tokensEqual(part, currentToken)) {
        return part;
      }
    }
  }
  if (opts.allowQuery) {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const q = url.searchParams.get('token');
      if (q) {
        return q;
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

export function checkToken(
  req: IncomingMessage,
  opts: { allowQuery: boolean }
): AccessDecision {
  if (!isApiAuthEnabled()) {
    return { ok: true };
  }
  if (!currentToken) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  const provided = extractProvidedToken(req, opts);
  if (provided == null) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  if (!tokensEqual(provided, currentToken)) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  return { ok: true };
}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/** Host + Origin + token for HTTP /api/* (token not required on OPTIONS). */
export function evaluateHttpApiAccess(
  req: IncomingMessage,
  pathname: string
): AccessDecision {
  if (!isApiPath(pathname)) {
    return { ok: true };
  }
  const host = checkHost(req);
  if (!host.ok) {
    return host;
  }
  const origin = checkOrigin(req);
  if (!origin.ok) {
    return origin;
  }
  if ((req.method ?? 'GET').toUpperCase() === 'OPTIONS') {
    return { ok: true };
  }
  return checkToken(req, { allowQuery: false });
}

/** Host + Origin + token for the WebSocket upgrade. */
export function evaluateWsUpgrade(req: IncomingMessage): AccessDecision {
  const host = checkHost(req);
  if (!host.ok) {
    return host;
  }
  const origin = checkOrigin(req);
  if (!origin.ok) {
    return origin;
  }
  return checkToken(req, { allowQuery: true });
}

export function sendAccessDenied(
  res: ServerResponse,
  decision: Extract<AccessDecision, { ok: false }>
): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(decision.status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(decision.message);
}

export function warnIfExposedWithoutAuth(): void {
  if (!isLoopbackListenHost() && !isApiAuthEnabled()) {
    console.warn(
      '[server] WARNING: SIGNAL_LISTEN_HOST is not loopback and SIGNAL_API_AUTH=off. ' +
        'Any client that can reach the bind address can drive SQL/native/fs. ' +
        'Set SIGNAL_LISTEN_HOST=0.0.0.0 only with auth on.'
    );
  }
}

export function selectWsProtocol(protocols: Set<string> | string[]): string | false {
  const list = [...(protocols instanceof Set ? protocols : protocols)];
  if (currentToken && list.includes(currentToken)) {
    return currentToken;
  }
  return list[0] ?? false;
}
