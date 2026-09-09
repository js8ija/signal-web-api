// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * /api/proxy?url=<encoded> — forwards browser HTTP requests that would be
 * CORS-blocked (Signal CDNs, updates) through the bridge server. Hosts are
 * strictly allowlisted; everything else is rejected.
 */

import type http from 'node:http';
import { isIP } from 'node:net';
import { signalFetch } from './signalFetch.node.ts';

const ALLOWED_HOST_SUFFIXES = [
  '.signal.org',
  '.signalusercontent.com',
  '.signalcaptchas.org',
];

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);

export function isAllowedProxyUrl(raw: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') {
    return undefined;
  }
  if (url.username || url.password) {
    return undefined;
  }
  const port = url.port;
  if (port && port !== '443') {
    return undefined;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || isIP(host) !== 0) {
    return undefined;
  }
  if (!isAllowedProxyHost(host)) {
    return undefined;
  }
  return url;
}

export function isAllowedProxyHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  for (const suffix of ALLOWED_HOST_SUFFIXES) {
    const base = suffix.startsWith('.') ? suffix.slice(1) : suffix;
    if (h === base || h.endsWith('.' + base)) {
      return true;
    }
  }
  return false;
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'origin',
  'referer',
  'cookie',
  'accept-encoding',
  'content-length',
]);

const PROXY_REQ_ALLOWLIST = new Set([
  'accept',
  'accept-language',
  'content-type',
  'range',
  'user-agent',
]);

const PROXY_RES_DROP = new Set([
  ...HOP_BY_HOP,
  'content-encoding',
  'set-cookie',
  'set-cookie2',
]);

export function isProxyRequestHeaderAllowed(name: string): boolean {
  return PROXY_REQ_ALLOWLIST.has(name.toLowerCase());
}

export async function handleProxyRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rawUrl: string,
  body: Buffer
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    res.writeHead(405, { 'content-type': 'text/plain' });
    res.end('proxy: method not allowed');
    return;
  }

  const target = isAllowedProxyUrl(rawUrl);
  if (target == null) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('proxy: host not allowed');
    return;
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (!PROXY_REQ_ALLOWLIST.has(lower) || value == null) {
      continue;
    }
    headers[lower] = Array.isArray(value) ? value.join(', ') : value;
  }

  try {
    const upstream = await signalFetch(target, {
      method,
      headers,
      body:
        method === 'GET' || method === 'HEAD' || body.length === 0
          ? undefined
          : body,
    });

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (!PROXY_RES_DROP.has(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    }
    responseHeaders['content-length'] = String(upstream.body.length);
    responseHeaders['x-content-type-options'] = 'nosniff';
    res.writeHead(upstream.status, responseHeaders);
    res.end(upstream.body);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(
      `proxy: upstream fetch failed: ${
        error instanceof Error ? (error.cause as Error)?.message ?? error.message : String(error)
      }`
    );
  }
}
