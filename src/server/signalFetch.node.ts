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

const REPO_ROOT = join(__dirname, '..', '..');

let cachedCa: Array<string> | undefined;

function getSignalCa(): Array<string> {
  if (cachedCa != null) {
    return cachedCa;
  }
  const certs: Array<string> = [...tls.rootCertificates];
  try {
    const config = JSON.parse(
      readFileSync(join(REPO_ROOT, 'config', 'default.json'), 'utf-8')
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

export function signalFetch(
  url: URL,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer;
    timeoutMs?: number;
  } = {}
): Promise<SignalFetchResult> {
  return new Promise((resolve, reject) => {
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
        response.on('data', chunk => chunks.push(chunk as Buffer));
        response.on('end', () => {
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            if (value != null) {
              headers[key] = Array.isArray(value) ? value.join(', ') : value;
            }
          }
          resolve({
            status: response.statusCode ?? 0,
            headers,
            body: Buffer.concat(chunks),
          });
        });
        response.on('error', reject);
      }
    );
    request.on('timeout', () => {
      request.destroy(new Error(`signal-fetch: timeout for ${url.host}`));
    });
    request.on('error', reject);
    if (options.body != null && options.body.length > 0) {
      request.end(options.body);
    } else {
      request.end();
    }
  });
}
