// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { IncomingMessage, ServerResponse } from 'node:http';
import { pickCorsOrigin } from './auth.node.ts';

export const MAX_BODY_NATIVE_SYNC = 2 * 1024 * 1024;
export const MAX_BODY_PROXY = 32 * 1024 * 1024;
export const MAX_BODY_NEST = 8 * 1024 * 1024;
export const MAX_BODY_ADMIN = 4 * 1024;

export function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  boundPort: number
): void {
  const origin = pickCorsOrigin(
    typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
    boundPort
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization'
  );
  res.setHeader('Vary', 'Origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

export function readBody(
  req: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;

    const fail = (error: Error): void => {
      if (done) {
        return;
      }
      done = true;
      req.off('data', onData);
      req.destroy();
      reject(error);
    };

    const onData = (chunk: Buffer): void => {
      total += chunk.length;
      if (total > maxBytes) {
        fail(Object.assign(new Error(`request body exceeds ${maxBytes} bytes`), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    };

    req.on('data', onData);
    req.on('end', () => {
      if (done) {
        return;
      }
      done = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', err => fail(err instanceof Error ? err : new Error(String(err))));
  });
}

export function sendPayloadTooLarge(res: ServerResponse): void {
  if (!res.headersSent) {
    res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Payload Too Large');
  } else {
    res.end();
  }
}
