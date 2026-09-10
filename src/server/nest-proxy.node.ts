// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Same-origin reverse proxy from the ochen1 bridge to LeanScrm Nest
 * (ChatKnow-style API). Lets the Signal Web chrome call Nest without CORS
 * friction while keeping the local bridge for SQL/native/IPC.
 *
 * Mount: /api/nest/*  →  ${SIGNAL_NEST_API_BASE}/*
 * Config: GET /api/nest-config
 *
 * Disabled unless SIGNAL_NEST_API_BASE (or NEST_API_BASE) is set.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { MAX_BODY_NEST, readBody, sendPayloadTooLarge } from './http-util.node.ts';

export const NEST_PROXY_PREFIX = '/api/nest';
export const NEST_CONFIG_PATH = '/api/nest-config';

const ALLOWED_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

/** Upstream Nest base, e.g. http://127.0.0.1:3010. Empty = proxy disabled. */
export function nestApiBaseFromEnv(): string {
  const raw =
    process.env.SIGNAL_NEST_API_BASE?.trim() ||
    process.env.NEST_API_BASE?.trim() ||
    '';
  if (!raw) {
    return '';
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return raw.replace(/\/$/, '');
  } catch {
    return '';
  }
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

function defaultPort(protocol: string): string {
  return protocol === 'https:' ? '443' : '80';
}

/**
 * Map /api/nest/<path> onto apiBase, rejecting protocol-relative / absolute
 * suffixes that would escape the configured origin (SSRF).
 */
export function resolveNestUpstreamUrl(
  apiBase: string,
  pathname: string,
  search: string
): URL {
  const base = new URL(apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  let suffix = pathname.startsWith(NEST_PROXY_PREFIX)
    ? pathname.slice(NEST_PROXY_PREFIX.length)
    : pathname;
  if (!suffix) {
    suffix = '/';
  }
  if (!suffix.startsWith('/')) {
    suffix = `/${suffix}`;
  }
  // Collapse leading slashes so `//evil.com` cannot become protocol-relative.
  suffix = `/${suffix.replace(/^\/+/, '')}`;
  const target = new URL(suffix + search, base);
  const basePort = base.port || defaultPort(base.protocol);
  const targetPort = target.port || defaultPort(target.protocol);
  if (
    target.protocol !== base.protocol ||
    target.hostname !== base.hostname ||
    targetPort !== basePort
  ) {
    throw new Error('nest-proxy: target escaped configured origin');
  }
  return target;
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

  const method = (req.method ?? 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('nest-proxy: method not allowed');
    return true;
  }

  let targetUrl: URL;
  try {
    targetUrl = resolveNestUpstreamUrl(apiBase, pathname, search);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid nest proxy path' }));
    return true;
  }

  let body: Buffer;
  try {
    body =
      method === 'GET' || method === 'HEAD' || method === 'DELETE'
        ? Buffer.alloc(0)
        : await readBody(req, MAX_BODY_NEST);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 413) {
      sendPayloadTooLarge(res);
      return true;
    }
    throw error;
  }

  const lib = targetUrl.protocol === 'https:' ? https : http;
  const headers: http.OutgoingHttpHeaders = {
    accept: req.headers.accept ?? '*/*',
    'user-agent': 'signal-web-nest-proxy/1',
  };
  if (req.headers['content-type']) {
    headers['content-type'] = req.headers['content-type'];
  } else if (body.length > 0) {
    headers['content-type'] = 'application/json';
  }
  if (req.headers.authorization) {
    headers.authorization = req.headers.authorization;
  }
  if (body.length > 0) {
    headers['content-length'] = body.length;
  }

  // Nest is a local upstream by design — always bypass SIGNAL_PROXY_URL.
  await new Promise<void>(resolve => {
    const upstream = lib.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.pathname + targetUrl.search,
        method,
        headers,
      },
      upstreamRes => {
        const outHeaders: http.OutgoingHttpHeaders = {
          'cache-control': 'no-cache, no-transform',
        };
        const ct = upstreamRes.headers['content-type'];
        if (ct) outHeaders['content-type'] = ct;
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
