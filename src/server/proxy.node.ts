// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * /api/proxy?url=<encoded> — forwards browser HTTP requests that would be
 * CORS-blocked (Signal CDNs, updates) through the bridge server. Hosts are
 * strictly allowlisted; everything else is rejected.
 */

import type http from 'node:http';
import { signalFetch } from './signalFetch.node.ts';

const ALLOWED_HOST_SUFFIXES = [
  '.signal.org',
  '.signalusercontent.com',
  '.signalcaptchas.org',
];

const ALLOWED_HOSTS = new Set(['signal.org']);

function isAllowedUrl(raw: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) {
    return url;
  }
  if (ALLOWED_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    return url;
  }
  return undefined;
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
]);

export async function handleProxyRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rawUrl: string,
  body: Buffer
): Promise<void> {
  const target = isAllowedUrl(rawUrl);
  if (target == null) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('proxy: host not allowed');
    return;
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || value == null) {
      continue;
    }
    headers[lower] = Array.isArray(value) ? value.join(', ') : value;
  }

  try {
    const upstream = await signalFetch(target, {
      method: req.method ?? 'GET',
      headers,
      body:
        req.method === 'GET' || req.method === 'HEAD' || body.length === 0
          ? undefined
          : body,
    });

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (!HOP_BY_HOP.has(key) && key !== 'content-encoding' && key !== 'content-length') {
        responseHeaders[key] = value;
      }
    }
    responseHeaders['content-length'] = String(upstream.body.length);
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
