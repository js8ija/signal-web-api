// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Same-origin reverse proxy from the ochen1 bridge to LeanScrm Nest
 * (ChatKnow-style API). Lets the Signal Web chrome call Nest without CORS
 * friction while keeping the local bridge for SQL/native/IPC.
 *
 * Mount: /api/nest/*  →  ${SIGNAL_NEST_API_BASE}/*
 * Config: GET /api/nest-config
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export const NEST_PROXY_PREFIX = '/api/nest';
export const NEST_CONFIG_PATH = '/api/nest-config';

/** Upstream Nest base, e.g. http://127.0.0.1:3010. Empty = proxy disabled. */
export function nestApiBaseFromEnv(): string {
  const raw =
    process.env.SIGNAL_NEST_API_BASE?.trim() ||
    process.env.NEST_API_BASE?.trim() ||
    'http://127.0.0.1:3010';
  return raw.replace(/\/$/, '');
}

export type NestConfigPayload = {
  enabled: boolean;
  /** Absolute Nest URL (may be empty when disabled). */
  apiBase: string;
  /** Same-origin proxy prefix when enabled. */
  proxyPath: string;
  /** Preferred base for browser clients (proxy when enabled, else apiBase). */
  clientBase: string;
};

export function buildNestConfig(): NestConfigPayload {
  const apiBase = nestApiBaseFromEnv();
  const enabled = apiBase.length > 0;
  return {
    enabled,
    apiBase,
    proxyPath: NEST_PROXY_PREFIX,
    clientBase: enabled ? NEST_PROXY_PREFIX : apiBase,
  };
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Proxy /api/nest/<path> to Nest. Streaming responses (NDJSON) are piped.
 * Returns true if the request was handled.
 */
export async function handleNestProxy(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  search: string
): Promise<boolean> {
  if (pathname === NEST_CONFIG_PATH && (req.method === 'GET' || req.method === 'HEAD')) {
    const payload = buildNestConfig();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    if (req.method !== 'HEAD') {
      res.end(JSON.stringify(payload));
    } else {
      res.end();
    }
    return true;
  }

  if (!pathname.startsWith(NEST_PROXY_PREFIX)) {
    return false;
  }

  const apiBase = nestApiBaseFromEnv();
  if (!apiBase) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Nest proxy disabled',
        hint: 'Set SIGNAL_NEST_API_BASE=http://127.0.0.1:3010',
      })
    );
    return true;
  }

  const suffix = pathname.slice(NEST_PROXY_PREFIX.length) || '/';
  const targetUrl = new URL(suffix + search, apiBase.endsWith('/') ? apiBase : apiBase + '/');

  const body =
    req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE'
      ? Buffer.alloc(0)
      : await readBody(req);

  const lib = targetUrl.protocol === 'https:' ? https : http;
  const headers: http.OutgoingHttpHeaders = {
    accept: req.headers.accept ?? '*/*',
    'content-type': req.headers['content-type'] ?? 'application/json',
    'user-agent': 'signal-web-nest-proxy/1',
  };
  if (body.length > 0) {
    headers['content-length'] = body.length;
  }

  await new Promise<void>((resolve) => {
    const upstream = lib.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers,
      },
      upstreamRes => {
        const outHeaders: http.OutgoingHttpHeaders = {
          'cache-control': 'no-cache, no-transform',
        };
        const ct = upstreamRes.headers['content-type'];
        if (ct) outHeaders['content-type'] = ct;
        // Do not forward content-length for streamed NDJSON
        res.writeHead(upstreamRes.statusCode ?? 502, outHeaders);
        upstreamRes.pipe(res);
        upstreamRes.on('end', () => resolve());
        upstreamRes.on('error', () => resolve());
      }
    );
    upstream.on('error', err => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nest upstream failed', message: err.message }));
      } else {
        res.end();
      }
      resolve();
    });
    req.on('close', () => {
      upstream.destroy();
    });
    if (body.length > 0) {
      upstream.write(body);
    }
    upstream.end();
  });

  return true;
}
