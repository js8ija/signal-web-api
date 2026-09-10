// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * HTTPS fetch that trusts Signal's private CA in addition to the public
 * roots. Signal's services (chat/cdn/updates) present certificates issued
 * by the "Signal Messenger" CA shipped in config/default.json
 * (`certificateAuthority`) — exactly what desktop's WebAPI pins. Plain
 * global fetch fails against them with SELF_SIGNED_CERT_IN_CHAIN.
 */

import https from 'node:https';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  getAssetsRoot,
  getProxyConfig,
  redactProxyUrl,
  shouldBypassProxy,
} from './paths.node.ts';

let cachedCa: Array<string> | undefined;

function getSignalCa(): Array<string> {
  if (cachedCa != null) {
    return cachedCa;
  }
  const certs: Array<string> = [...tls.rootCertificates];
  try {
    const config = JSON.parse(
      readFileSync(join(getAssetsRoot(), 'config', 'default.json'), 'utf-8')
    ) as { certificateAuthority?: string };
    if (config.certificateAuthority) {
      certs.push(config.certificateAuthority);
    }
  } catch (error) {
    console.warn('[signal-fetch] could not load certificateAuthority:', error);
  }
  cachedCa = certs;
  return certs;
}

export type SignalFetchResult = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

const DEFAULT_MAX_BODY_BYTES = 32 * 1024 * 1024;
const PROXY_CONNECT_TIMEOUT_MS = 15_000;

const proxyAgents = new Map<string, InstanceType<typeof HttpsProxyAgent>>();

function redactProxyText(text: string): string {
  const cfg = getProxyConfig();
  let out = text;
  if (cfg.mode === 'off') {
    return out;
  }
  const redacted = redactProxyUrl(cfg.raw);
  if (cfg.raw && out.includes(cfg.raw)) {
    out = out.split(cfg.raw).join(redacted);
  }
  try {
    const href = new URL(cfg.raw).href;
    if (href && href !== cfg.raw && out.includes(href)) {
      out = out.split(href).join(redactProxyUrl(href));
    }
  } catch {
    // raw may be unparseable when mode is invalid
  }
  if (cfg.mode === 'on') {
    if (cfg.spec.password && out.includes(cfg.spec.password)) {
      out = out.split(cfg.spec.password).join('***');
    }
    if (cfg.spec.username && out.includes(cfg.spec.username)) {
      out = out.split(cfg.spec.username).join('***');
    }
  }
  return out;
}

function sanitizeProxyError(error: unknown): Error {
  const message = redactProxyText(error instanceof Error ? error.message : String(error));
  const err = new Error(message);
  if (error instanceof Error) {
    err.name = error.name;
    err.cause = error;
  }
  return err;
}

function getProxyAgent(proxyRaw: string): InstanceType<typeof HttpsProxyAgent> {
  const cached = proxyAgents.get(proxyRaw);
  if (cached) {
    return cached;
  }
  const ca = getSignalCa();
  // Through a CONNECT tunnel the TLS session is end-to-end with the target,
  // so this CA list must still reach the handshake. Pass `ca` on both the
  // request options and the agent so the agent's own tls.connect cannot drop
  // it (otherwise Signal hosts fail with SELF_SIGNED_CERT_IN_CHAIN).
  const agent = new HttpsProxyAgent(proxyRaw, {
    ca,
    timeout: PROXY_CONNECT_TIMEOUT_MS,
  });
  proxyAgents.set(proxyRaw, agent);
  return agent;
}

export function signalFetch(
  url: URL,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer;
    timeoutMs?: number;
    maxBodyBytes?: number;
  } = {}
): Promise<SignalFetchResult> {
  return new Promise((resolve, reject) => {
    const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    let settled = false;
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = (value: SignalFetchResult): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const proxy = getProxyConfig();
    if (proxy.mode === 'invalid') {
      fail(
        new Error(
          `signal-fetch: invalid SIGNAL_PROXY_URL (${redactProxyUrl(proxy.raw)}): ${proxy.reason}`
        )
      );
      return;
    }
    const requestOptions: https.RequestOptions = {
      method: options.method ?? 'GET',
      headers: options.headers,
      ca: getSignalCa(),
      timeout: options.timeoutMs ?? 120_000,
    };
    if (proxy.mode === 'on' && !shouldBypassProxy(url.hostname)) {
      try {
        requestOptions.agent = getProxyAgent(proxy.raw);
      } catch (error) {
        fail(sanitizeProxyError(error));
        return;
      }
    }
    const request = https.request(
      url,
      requestOptions,
      response => {
        const chunks: Array<Buffer> = [];
        let total = 0;
        response.on('data', chunk => {
          const buf = chunk as Buffer;
          total += buf.length;
          if (total > maxBodyBytes) {
            request.destroy(
              new Error(`signal-fetch: response exceeds ${maxBodyBytes} bytes for ${url.host}`)
            );
            return;
          }
          chunks.push(buf);
        });
        response.on('end', () => {
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            if (value != null) {
              headers[key] = Array.isArray(value) ? value.join(', ') : value;
            }
          }
          succeed({
            status: response.statusCode ?? 0,
            headers,
            body: Buffer.concat(chunks),
          });
        });
        response.on('error', err => fail(sanitizeProxyError(err)));
      }
    );
    request.on('timeout', () => {
      request.destroy(new Error(`signal-fetch: timeout for ${url.host}`));
    });
    request.on('error', err => fail(sanitizeProxyError(err)));
    if (options.body != null && options.body.length > 0) {
      request.end(options.body);
    } else {
      request.end();
    }
  });
}
