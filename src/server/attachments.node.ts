// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * HTTP attachment handler for Signal Web.
 *
 * Browsers cannot fetch Signal's custom `attachment://` URL scheme, so the
 * renderer is patched to emit same-origin `/api/attachment/...` URLs (see
 * web/shims/getLocalAttachmentUrl.web.ts). This module serves those URLs over
 * HTTP, decrypting on the fly, with byte-range support so images/video seek.
 *
 * This is a fresh port of the logic in app/attachment_channel.main.ts
 * (`handleAttachmentRequest`). We do NOT import that file: it pulls in
 * `electron` (ipcMain/protocol) at module scope, which must never enter the
 * server import graph. We reuse only the crypto helper
 * (`decryptAttachmentV2ToSink` from ts/AttachmentCrypto.node.ts) and the
 * path-confinement helper (ts/util/isPathInside.node.ts).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NOTES / SIMPLIFICATIONS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. RANGE HANDLING — buffer-then-slice.
 *    Desktop uses @indutny/range-finder to stream a decrypted range without
 *    buffering. We take the simpler, correct approach: for encrypted (v2)
 *    attachments we decrypt the WHOLE file into memory once, then serve the
 *    requested byte range from that buffer (206 + Content-Range). Attachments
 *    are small (images, short clips), so the memory cost is negligible and the
 *    code is far easier to get right than a seeking streaming decryptor.
 *    For v1 PLAINTEXT files we stream straight off disk with createReadStream
 *    using { start, end }, so those never buffer.
 *
 * 2. DOWNLOAD disposition (in-progress, incremental-MAC) — NOT specially
 *    handled. Desktop has a separate path for *viewing a download while it is
 *    still streaming to disk* (growing-file + incremental MAC validation).
 *    Here we treat `download` like any other already-on-disk encrypted
 *    attachment: we point at the downloads dir and decrypt the complete file
 *    with `type: 'local'` (no incremental validation). The common case —
 *    viewing an attachment that has already finished downloading — works. A
 *    partially-written download may fail its MAC check and return 500; that is
 *    acceptable for v1 (the renderer retries once the download completes).
 *
 * 3. CONTENT-TYPE — passed through from the `contentType` query param
 *    (falling back to application/octet-stream). Unlike desktop we do not
 *    restrict it to image/video MIME types, so audio and other inline media
 *    also get a correct Content-Type.
 *
 * 4. DISPOSITION → DIR mapping mirrors app/attachments.node.ts (the renderer's
 *    actual on-disk layout, via ts/util/basePaths.preload.ts), which uses the
 *    `.noindex` suffixes — NOT the bare dir names. web/server/fs.node.ts was
 *    aligned to create the same dirs.
 *      attachment  → attachments.noindex
 *      avatarData  → avatars.noindex
 *      sticker     → stickers.noindex
 *      draft       → drafts.noindex
 *      download    → downloads.noindex
 *      temporary   → temp
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { PassThrough } from 'node:stream';
import { LRUCache } from 'lru-cache';

import {
  decryptAttachmentV2ToSink,
  type DecryptAttachmentToSinkOptionsType,
} from '../../vendor/ts/AttachmentCrypto.node.ts';
import { isPathInside } from '../../vendor/ts/util/isPathInside.node.ts';

/**
 * Decrypted-plaintext cache. A `<video>` element seeks by issuing many small
 * byte-range requests; without this each one would re-decrypt the entire file
 * (a 40 MB clip = a 40 MB AES pass per chunk), stalling playback. A given
 * (path, key, size) always decrypts to identical bytes, so caching by that key
 * is safe. Bounded by total bytes so memory stays in check.
 */
const DECRYPT_CACHE_MAX_BYTES = 384 * 1024 * 1024;
const decryptCache = new LRUCache<string, Buffer>({
  maxSize: DECRYPT_CACHE_MAX_BYTES,
  sizeCalculation: buf => Math.max(1, buf.length),
  ttl: 10 * 60 * 1000,
  // Don't cache anything larger than half the budget (huge single files would
  // thrash the cache); those fall back to decrypt-per-request.
  maxEntrySize: DECRYPT_CACHE_MAX_BYTES / 2,
});

/** Pending decryptions, so concurrent range requests share one decrypt. */
const inFlight = new Map<string, Promise<Buffer>>();

// ---- disposition → relative dir ---------------------------------------------

// Mirrors app/attachments.node.ts path constants (the dirs the renderer
// actually writes to via ts/util/basePaths.preload.ts).
const DISPOSITION_DIRS: Record<string, string> = {
  attachment: 'attachments.noindex',
  avatarData: 'avatars.noindex',
  sticker: 'stickers.noindex',
  draft: 'drafts.noindex',
  download: 'downloads.noindex',
  temporary: 'temp',
};

let _dataDir = '';

export function initAttachments(dataDir: string): void {
  _dataDir = dataDir;
}

// ---- helpers ----------------------------------------------------------------

function sendError(
  res: ServerResponse,
  status: number,
  message: string
): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

/** Parse a Chromium-style open-ended range header: "bytes=START-" or "bytes=START-END". */
function parseRange(
  header: string | undefined,
  totalSize: number
): { start: number; end: number } | null {
  if (header == null) {
    return null;
  }
  const match = header.match(/^bytes=(\d+)-(\d*)$/);
  if (match == null || match[1] == null) {
    return null;
  }
  const start = Number.parseInt(match[1], 10);
  if (!Number.isFinite(start) || start < 0) {
    return null;
  }
  let end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1;
  if (!Number.isFinite(end)) {
    end = totalSize - 1;
  }
  // Clamp to file bounds.
  end = Math.min(end, totalSize - 1);
  if (start > end) {
    return null;
  }
  return { start, end };
}

/** Decrypt a v2 attachment fully into memory, trimmed to `size` bytes. */
async function decryptToBuffer(
  options: DecryptAttachmentToSinkOptionsType
): Promise<Buffer> {
  const sink = new PassThrough();
  const chunks: Array<Buffer> = [];
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Swallow stream errors on the sink: when decryption fails (e.g. bad MAC),
  // `pipeline()` inside decryptAttachmentV2ToSink destroys the sink with the
  // error and the function's promise rejects (handled by the caller). Without
  // this listener the destroyed-with-error sink surfaces as an unhandled
  // 'error' event / rejection.
  sink.on('error', () => {});

  // `sink` is the terminal stream of the internal pipeline, so when this
  // resolves all plaintext has been written to (and drained from) it.
  await decryptAttachmentV2ToSink(options, sink);

  return Buffer.concat(chunks);
}

// ---- v1: plaintext streaming -------------------------------------------------

async function servePlaintext(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  contentType: string
): Promise<void> {
  let totalSize: number;
  try {
    const s = await stat(filePath);
    totalSize = s.size;
  } catch {
    sendError(res, 404, 'Not Found');
    return;
  }

  const baseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-cache',
  };

  const range = parseRange(req.headers.range, totalSize);

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': String(totalSize) });
    res.end();
    return;
  }

  if (range == null) {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': String(totalSize) });
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        sendError(res, 500, 'Read error');
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
    return;
  }

  const { start, end } = range;
  res.writeHead(206, {
    ...baseHeaders,
    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
    'Content-Length': String(end - start + 1),
  });
  const stream = createReadStream(filePath, { start, end });
  stream.on('error', () => {
    res.destroy();
  });
  stream.pipe(res);
}

// ---- v2: decrypt + (optional) range -----------------------------------------

function serveBuffer(
  req: IncomingMessage,
  res: ServerResponse,
  buffer: Buffer,
  contentType: string
): void {
  const totalSize = buffer.length;
  const baseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-cache',
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': String(totalSize) });
    res.end();
    return;
  }

  const range = parseRange(req.headers.range, totalSize);
  if (range == null) {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': String(totalSize) });
    res.end(buffer);
    return;
  }

  const { start, end } = range;
  res.writeHead(206, {
    ...baseHeaders,
    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
    'Content-Length': String(end - start + 1),
  });
  res.end(buffer.subarray(start, end + 1));
}

// ---- main handler -----------------------------------------------------------

/**
 * Handle GET/HEAD /api/attachment/v{1,2}/<relative path>?key=&size=&...
 *
 * Never throws — always writes a response.
 */
export async function handleAttachmentRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<void> {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendError(res, 405, 'Method Not Allowed');
      return;
    }
    if (_dataDir === '') {
      sendError(res, 500, 'Attachments not initialized');
      return;
    }

    // pathname: /api/attachment/v1/<rest...>  or  /v2/<rest...>
    const prefix = '/api/attachment/';
    const rest = url.pathname.slice(prefix.length); // "v1/<path...>"
    const slash = rest.indexOf('/');
    if (slash < 0) {
      sendError(res, 404, 'Unknown attachment path');
      return;
    }
    const version = rest.slice(0, slash); // "v1" | "v2"
    if (version !== 'v1' && version !== 'v2') {
      sendError(res, 404, 'Unknown attachment version');
      return;
    }

    // The relative file path is URL-encoded (each segment encodeURIComponent'd
    // by the URL builder); decode each segment.
    const encodedRelPath = rest.slice(slash + 1);
    const relSegments = encodedRelPath
      .split('/')
      .filter(seg => seg.length > 0)
      .map(seg => decodeURIComponent(seg));

    // Disposition → parent dir.
    const disposition = url.searchParams.get('disposition') ?? 'attachment';
    const dirName = DISPOSITION_DIRS[disposition];
    if (dirName == null) {
      sendError(res, 400, `Unknown disposition: ${disposition}`);
      return;
    }
    const parentDir = join(_dataDir, dirName);

    // Resolve + confine to the parent dir.
    const filePath = normalize(join(parentDir, ...relSegments));
    if (!isPathInside(filePath, parentDir)) {
      sendError(res, 403, 'Access denied');
      return;
    }

    // Content-Type from query param.
    const contentType =
      url.searchParams.get('contentType') ?? 'application/octet-stream';

    // ---- v1: plaintext ----
    if (version === 'v1') {
      await servePlaintext(req, res, filePath, contentType);
      return;
    }

    // ---- v2: encrypted ----
    const keysBase64 = url.searchParams.get('key');
    if (keysBase64 == null) {
      sendError(res, 400, 'Missing key');
      return;
    }
    const sizeParam = url.searchParams.get('size');
    const size = sizeParam != null ? Number.parseInt(sizeParam, 10) : NaN;
    if (!Number.isFinite(size)) {
      sendError(res, 400, 'Missing/invalid size');
      return;
    }

    // Confirm the ciphertext exists (weakReference: 404 quietly; otherwise too).
    try {
      await stat(filePath);
    } catch {
      sendError(res, 404, 'Not Found');
      return;
    }

    const cacheKey = `${filePath}|${keysBase64}|${size}`;
    let buffer = decryptCache.get(cacheKey);
    if (buffer == null) {
      try {
        let pending = inFlight.get(cacheKey);
        if (pending == null) {
          pending = decryptToBuffer({
            ciphertextPath: filePath,
            idForLogging: 'web/attachment',
            keysBase64,
            size,
            type: 'local',
          });
          inFlight.set(cacheKey, pending);
          pending.finally(() => inFlight.delete(cacheKey));
        }
        buffer = await pending;
        decryptCache.set(cacheKey, buffer);
      } catch (error) {
        console.error(
          '[attachment] decrypt failed for',
          url.pathname,
          error instanceof Error ? error.message : error
        );
        sendError(res, 500, 'Decrypt failure');
        return;
      }
    }

    serveBuffer(req, res, buffer, contentType);
  } catch (error) {
    console.error('[attachment] unexpected error:', error);
    sendError(res, 500, 'Internal Server Error');
  }
}
