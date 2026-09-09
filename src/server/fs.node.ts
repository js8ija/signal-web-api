// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * fs namespace handler.
 *
 * Creates required subdirectories under the data dir at startup, and serves
 * the browser's filesystem operations against the server's disk. All paths
 * are confined to the data dir — the browser's `userDataPath` (from
 * /api/boot) IS this dir, so the renderer naturally targets it.
 *
 * Large files (e.g. the link-and-sync backup archive) stream through
 * handle-based read/write ops so the renderer's createReadStream /
 * createWriteStream can be backed by real disk I/O without buffering the
 * whole file in memory.
 */

import {
  mkdirSync,
  existsSync,
  createWriteStream,
  createReadStream,
  statSync,
  rmSync,
} from 'node:fs';
import {
  mkdir,
  stat,
  unlink,
  rename,
  rm,
  readFile,
  writeFile,
  truncate,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { ReadStream, WriteStream } from 'node:fs';
import { isFsInside } from './paths.node.ts';
import { API_TOKEN_FILENAME } from './access-control.node.ts';
import { INSTANCE_LOCK_FILENAME } from './instance-lock.node.ts';

export function getFsReadFileMaxBytes(): number {
  const n = parseInt(process.env.SIGNAL_FS_READFILE_MAX ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 16 * 1024 * 1024;
}

// Must match app/attachments.node.ts (the dirs the renderer actually writes
// to via ts/util/basePaths.preload.ts), which use the `.noindex` suffix.
export const ATTACHMENT_DIRS = [
  'attachments.noindex',
  'attachments.noindex/attachment-downloads',
  'temp',
  'drafts.noindex',
  'stickers.noindex',
  'downloads.noindex',
  'avatars.noindex',
  'badges.noindex',
  'megaphones.noindex',
  'profileAvatars',
  'groupAvatars',
  'badgeImages',
  'wallpapers',
  'sqlcipher-new',
];

const READ_CHUNK_SIZE = 512 * 1024;

let _dataDir = '';
let _dataDirResolved = '';
const _warnedMethods = new Set<string>();

type WriteHandle = { stream: WriteStream; drain: Promise<void> };
type ReadHandle = {
  stream: ReadStream;
  ended: boolean;
  pending: Array<(value: { chunk: Uint8Array | null }) => void>;
  queue: Array<Uint8Array>;
  error: Error | undefined;
};

let _nextHandle = 1;
const _writeHandles = new Map<number, WriteHandle>();
const _readHandles = new Map<number, ReadHandle>();

export function initFs(dataDir: string): void {
  _dataDir = dataDir;
  _dataDirResolved = resolve(dataDir);
  for (const dir of ATTACHMENT_DIRS) {
    mkdirSync(join(dataDir, dir), { recursive: true, mode: 0o700 });
  }
}

/** Empty attachment/temp trees after sql-channel:remove-db (H1). */
export function wipeUserMedia(): void {
  if (!_dataDir) {
    return;
  }
  for (const dir of ATTACHMENT_DIRS) {
    const path = join(_dataDir, dir);
    try {
      rmSync(path, { recursive: true, force: true });
    } catch {
      /* ok */
    }
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
}

const DENY_TOP = new Set([
  'config.json',
  'settings.json',
  API_TOKEN_FILENAME,
  INSTANCE_LOCK_FILENAME,
  'db',
]);

function posixMode(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, '0');
}

export function warnIfDataDirPermissive(dataDir: string): void {
  if (process.platform === 'win32') {
    return;
  }
  try {
    const st = statSync(dataDir);
    if ((st.mode & 0o077) !== 0) {
      console.warn(
        `[server] data dir ${dataDir} is group/other-readable (mode ${posixMode(st.mode)}); not changing user data`
      );
    }
  } catch {
    /* missing */
  }
}

function forbiddenError(): Error {
  const err = new Error('fs: path is not allowed');
  err.name = 'SignalWebFsForbidden';
  return err;
}

function unsupportedError(method: string): Error {
  const err = new Error(`fs operation not supported in Signal Web: ${method}`);
  err.name = 'SignalWebUnsupportedFs';
  return err;
}

function warnOnce(method: string): void {
  if (!_warnedMethods.has(method)) {
    _warnedMethods.add(method);
    console.warn(`[fs] Unknown method (will return unsupported error): ${method}`);
  }
}

const ALLOWED_WRITE_FLAGS = new Set(['w', 'wx', 'a', 'ax', 'r+', 'w+', 'a+']);

function isAllowlistedResolved(resolved: string): boolean {
  const rel = relative(_dataDirResolved, resolved);
  if (rel === '' || rel.startsWith(`..${sep}`) || rel === '..') {
    return false;
  }
  const top = rel.split(sep)[0] ?? '';
  if (DENY_TOP.has(top)) {
    return false;
  }
  for (const dir of ATTACHMENT_DIRS) {
    const allowed = resolve(_dataDirResolved, dir);
    if (resolved === allowed || resolved.startsWith(allowed + sep)) {
      return true;
    }
  }
  return false;
}

/** Confine a renderer-supplied path to attachment/temp trees (C3). */
function safePath(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0 || input.includes('\0')) {
    throw unsupportedError('fs: missing path');
  }
  const resolved = resolve(input);
  if (!isFsInside(resolved, _dataDirResolved, true) || !isAllowlistedResolved(resolved)) {
    throw forbiddenError();
  }
  return resolved;
}

function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') {
    return Buffer.from(value);
  }
  throw new TypeError('fs: expected bytes');
}

export async function handleFsCall(
  method: string,
  args: ReadonlyArray<unknown>
): Promise<unknown> {
  switch (method) {
    // ---- well-known directories ----
    case 'getAttachmentPath':
      return join(_dataDir, 'attachments.noindex');
    case 'getTempPath':
      return join(_dataDir, 'temp');
    case 'getDraftPath':
      return join(_dataDir, 'drafts.noindex');
    case 'getStickerPath':
      return join(_dataDir, 'stickers.noindex');
    case 'getDownloadsPath':
      return join(_dataDir, 'downloads.noindex');
    case 'getAvatarPath':
      return join(_dataDir, 'avatars.noindex');
    case 'getBadgeImagePath':
      return join(_dataDir, 'badgeImages');

    // ---- metadata ----
    case 'exists':
      return typeof args[0] === 'string' && existsSync(safePath(args[0]));
    case 'stat': {
      try {
        const s = await stat(safePath(args[0]));
        return { size: s.size, isFile: s.isFile(), mtimeMs: s.mtimeMs };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    }

    // ---- mutations ----
    case 'ensureFile': {
      const path = safePath(args[0]);
      await mkdir(dirname(path), { recursive: true });
      if (!existsSync(path)) {
        await writeFile(path, Buffer.alloc(0));
      }
      return undefined;
    }
    case 'mkdir':
      await mkdir(safePath(args[0]), { recursive: true });
      return undefined;
    case 'unlink':
      try {
        await unlink(safePath(args[0]));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      return undefined;
    case 'rm':
      await rm(safePath(args[0]), { recursive: true, force: true });
      return undefined;
    case 'rename':
      await rename(safePath(args[0]), safePath(args[1]));
      return undefined;
    case 'truncate':
      await truncate(safePath(args[0]), Number(args[1] ?? 0));
      return undefined;
    case 'readFile': {
      const path = safePath(args[0]);
      const s = await stat(path);
      const cap = getFsReadFileMaxBytes();
      if (s.size > cap) {
        const err = new Error(
          `fs: readFile exceeds cap of ${cap} bytes; use openRead/read/closeRead`
        );
        err.name = 'SignalWebFsTooLarge';
        throw err;
      }
      return new Uint8Array(await readFile(path));
    }
    case 'writeFile':
      await mkdir(dirname(safePath(args[0])), { recursive: true });
      await writeFile(safePath(args[0]), toBuffer(args[1]));
      return undefined;

    // ---- streaming writes ----
    case 'openWrite': {
      const path = safePath(args[0]);
      const opts = (args[1] ?? {}) as { flags?: string; start?: number };
      const flags = opts.flags ?? 'w';
      if (!ALLOWED_WRITE_FLAGS.has(flags)) {
        throw unsupportedError(`fs: invalid flags ${flags}`);
      }
      await mkdir(dirname(path), { recursive: true });
      const stream = createWriteStream(path, {
        flags,
        start: opts.start,
      });
      const id = _nextHandle++;
      _writeHandles.set(id, { stream, drain: Promise.resolve() });
      return id;
    }
    case 'write': {
      const handle = _writeHandles.get(Number(args[0]));
      if (handle == null) {
        throw new Error(`fs: unknown write handle ${String(args[0])}`);
      }
      const chunk = toBuffer(args[1]);
      const ok = handle.stream.write(chunk);
      if (!ok) {
        // Apply backpressure: resolve only once the buffer drains.
        await new Promise<void>(res => handle.stream.once('drain', res));
      }
      return undefined;
    }
    case 'closeWrite': {
      const handle = _writeHandles.get(Number(args[0]));
      if (handle == null) {
        return undefined;
      }
      _writeHandles.delete(Number(args[0]));
      await new Promise<void>((res, rej) => {
        handle.stream.end((error?: Error) => (error ? rej(error) : res()));
      });
      return undefined;
    }

    // ---- streaming reads ----
    case 'openRead': {
      const path = safePath(args[0]);
      const opts = (args[1] ?? {}) as { start?: number; end?: number };
      const s = await stat(path);
      const stream = createReadStream(path, {
        start: opts.start,
        end: opts.end,
        highWaterMark: READ_CHUNK_SIZE,
      });
      const id = _nextHandle++;
      const handle: ReadHandle = {
        stream,
        ended: false,
        pending: [],
        queue: [],
        error: undefined,
      };
      stream.on('data', (chunk: Buffer) => {
        const view = new Uint8Array(chunk);
        const waiter = handle.pending.shift();
        if (waiter != null) {
          waiter({ chunk: view });
        } else {
          handle.queue.push(view);
          stream.pause();
        }
      });
      stream.on('end', () => {
        handle.ended = true;
        let waiter = handle.pending.shift();
        while (waiter != null) {
          waiter({ chunk: null });
          waiter = handle.pending.shift();
        }
      });
      stream.on('error', err => {
        handle.error = err;
        handle.ended = true;
      });
      _readHandles.set(id, handle);
      return { handle: id, size: s.size };
    }
    case 'read': {
      const handle = _readHandles.get(Number(args[0]));
      if (handle == null) {
        throw new Error(`fs: unknown read handle ${String(args[0])}`);
      }
      if (handle.error != null) {
        throw handle.error;
      }
      const queued = handle.queue.shift();
      if (queued != null) {
        handle.stream.resume();
        return { chunk: queued };
      }
      if (handle.ended) {
        return { chunk: null };
      }
      return new Promise(res => {
        handle.pending.push(res);
        handle.stream.resume();
      });
    }
    case 'closeRead': {
      const handle = _readHandles.get(Number(args[0]));
      if (handle == null) {
        return undefined;
      }
      _readHandles.delete(Number(args[0]));
      handle.stream.destroy();
      return undefined;
    }

    default:
      warnOnce(method);
      throw unsupportedError(method);
  }
}
