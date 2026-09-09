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
import { getAssetsRoot } from './paths.node.ts';

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
    const request = https.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        ca: getSignalCa(),
        timeout: options.timeoutMs ?? 120_000,
      },
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
        response.on('error', err => fail(err instanceof Error ? err : new Error(String(err))));
      }
    );
    request.on('timeout', () => {
      request.destroy(new Error(`signal-fetch: timeout for ${url.host}`));
    });
    request.on('error', err => fail(err instanceof Error ? err : new Error(String(err))));
    if (options.body != null && options.body.length > 0) {
      request.end(options.body);
    } else {
      request.end();
    }
  });
}
