// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Local-supervisor access control: Host allowlist, Origin allowlist, and a
 * per-data-dir bearer token. Default is auth on; SIGNAL_API_AUTH=off is the
 * pairing escape hatch. /api/admin/* always requires the token.
 */

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { getCorsOrigin, getListenHost } from './paths.node.ts';
import { webUiOriginFromEnv } from './pair.node.ts';

export const API_TOKEN_NAME = 'api-token';

export function isApiAuthEnabled(): boolean {
  const raw = process.env.SIGNAL_API_AUTH?.trim().toLowerCase();
  return raw !== 'off' && raw !== '0' && raw !== 'false';
}

export function isLoopbackListenHost(host = getListenHost()): boolean {
  const h = host.trim().toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]';
}

export function apiTokenPath(dataDir: string): string {
  return join(dataDir, API_TOKEN_NAME);
}

export function mintApiToken(dataDir: string): string {
  const existing = readApiToken(dataDir);
  if (existing != null && /^[0-9a-f]{64}$/i.test(existing)) {
    return existing;
  }
  const token = randomBytes(32).toString('hex');
  const path = apiTokenPath(dataDir);
  writeFileSync(path, `${token}\n`, { encoding: 'utf-8', mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best-effort */
  }
  return token;
}

export function readApiToken(dataDir: string): string | undefined {
  const path = apiTokenPath(dataDir);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    return raw.length > 0 ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function tokensMatch(provided: string | undefined, expected: string | undefined): boolean {
  if (provided == null || expected == null) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function extractProvidedToken(req: IncomingMessage, url: URL): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === 'string') {
    const m = header.match(/^Bearer\s+(\S+)/i);
    if (m?.[1]) {
      return m[1];
    }
  }
  const q = url.searchParams.get('token')?.trim();
  if (q) {
    return q;
  }
  const proto = req.headers['sec-websocket-protocol'];
  if (typeof proto === 'string') {
    for (const part of proto.split(',')) {
      const t = part.trim();
      if (t && t !== 'signal-web' && /^[0-9a-f]{64}$/i.test(t)) {
        return t;
      }
    }
  }
  return undefined;
}

function parseHostHeader(raw: string | undefined): { host: string; port: string } | undefined {
  if (raw == null || raw.trim() === '') {
    return undefined;
  }
  const value = raw.trim();
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end < 0) {
      return undefined;
    }
    const host = value.slice(1, end).toLowerCase();
    const rest = value.slice(end + 1);
    const port = rest.startsWith(':') ? rest.slice(1) : '';
    return { host, port };
  }
  const idx = value.lastIndexOf(':');
  if (idx < 0) {
    return { host: value.toLowerCase(), port: '' };
  }
  return { host: value.slice(0, idx).toLowerCase(), port: value.slice(idx + 1) };
}

export function isAllowedHostHeader(hostHeader: string | undefined, boundPort: number): boolean {
  const parsed = parseHostHeader(hostHeader);
  if (parsed == null) {
    return false;
  }
  const extra = (process.env.SIGNAL_PUBLIC_HOST ?? '').trim().toLowerCase();
  const hosts = new Set(['127.0.0.1', 'localhost', '::1']);
  const listen = getListenHost().trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (listen) {
    hosts.add(listen);
  }
  if (extra) {
    hosts.add(extra.replace(/^\[|\]$/g, ''));
  }
  if (!hosts.has(parsed.host)) {
    return false;
  }
  if (parsed.port === '') {
    return boundPort === 80 || boundPort === 443;
  }
  return Number.parseInt(parsed.port, 10) === boundPort;
}

export function loopbackOrigins(boundPort: number): Array<string> {
  return [
    `http://127.0.0.1:${boundPort}`,
    `http://localhost:${boundPort}`,
    `http://[::1]:${boundPort}`,
  ];
}

export function allowedOrigins(boundPort: number): Set<string> {
  const out = new Set(loopbackOrigins(boundPort));
  const cors = getCorsOrigin();
  if (cors && cors !== '*') {
    out.add(cors.replace(/\/$/, ''));
  }
  const ui = webUiOriginFromEnv();
  if (ui) {
    out.add(ui);
  }
  for (const part of (process.env.SIGNAL_ALLOWED_ORIGINS ?? '').split(',')) {
    const o = part.trim().replace(/\/$/, '');
    if (o && o !== '*') {
      out.add(o);
    }
  }
  return out;
}

/** Absent Origin (non-browser) is allowed. Present Origin must be allowlisted. */
export function isAllowedOrigin(origin: string | undefined, boundPort: number): boolean {
  if (origin == null || origin.trim() === '') {
    return true;
  }
  return allowedOrigins(boundPort).has(origin.trim().replace(/\/$/, ''));
}

export function pickCorsOrigin(requestOrigin: string | undefined, boundPort: number): string | undefined {
  if (requestOrigin && isAllowedOrigin(requestOrigin, boundPort) && requestOrigin.trim() !== '') {
    return requestOrigin.trim();
  }
  return undefined;
}
