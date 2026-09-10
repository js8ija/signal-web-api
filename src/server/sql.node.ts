// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Hosts Signal's SQL worker pool outside Electron. Drives
 * bundles/workers/sql.js directly via worker_threads, replicating the
 * same init/read/write protocol as ts/sql/main.main.ts — but without the
 * Electron dependency.
 *
 * Exposes sqlCall(access, method, args) with plain-JS args/results;
 * serialisation to/from v8 format is done here server-side.
 */

import { delimiter, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import type { ObjectEncodingOptions } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { format } from 'node:util';
import { getAssetsRoot, sqlWorkerPath } from './paths.node.ts';

// ---- types (copied from ts/sql/main.main.ts to avoid Electron import) --------

type WrappedWorkerRequest = {
  seq: number;
  request: WorkerRequest;
};

type WorkerRequest =
  | { type: 'init'; options: { appVersion: string; configDir: string; key: string }; isPrimary: boolean }
  | { type: 'close' | 'removeDB' }
  | { type: 'walCheckpoint'; reason: string }
  | { type: 'sqlCall:read'; encoding: 'js'; method: string; args: ReadonlyArray<unknown> }
  | { type: 'sqlCall:read'; encoding: 'serialized'; method: string; data: Uint8Array }
  | { type: 'sqlCall:write'; encoding: 'js'; method: string; args: ReadonlyArray<unknown> }
  | { type: 'sqlCall:write'; encoding: 'serialized'; method: string; data: Uint8Array };

type WrappedWorkerResponse =
  | { type: 'response'; seq: number; error?: { name: string; message: string; stack: string | undefined }; errorKind?: number; response?: unknown }
  | { type: 'walCheckpointNeeded'; reason: string }
  | { type: 'log'; level: string; args: ReadonlyArray<unknown> };

// ---- worker pool ----------------------------------------------------------------

const WORKER_COUNT = 4;
const SQL_CALL_TIMEOUT_MS = 60_000;
const SQL_CLOSE_TIMEOUT_MS = 5_000;

type PoolEntry = { worker: Worker; load: number; seqs: Set<number> };
type PendingEntry = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

let pool: Array<PoolEntry> = [];
let seq = 0;
const pending = new Map<number, PendingEntry>();

function rejectSeq(s: number, error: Error): void {
  const entry = pending.get(s);
  if (!entry) {
    return;
  }
  pending.delete(s);
  clearTimeout(entry.timer);
  entry.reject(error);
}

function createWorker(): PoolEntry {
  const workerPath = sqlWorkerPath();
  if (!existsSync(workerPath)) {
    throw new Error(
      `SQL worker not found at ${workerPath}. Set SIGNAL_ASSETS_ROOT to the package root (config/build/bundles).`
    );
  }
  const nodePath = [join(getAssetsRoot(), 'node_modules'), process.env.NODE_PATH ?? '']
    .filter(Boolean)
    .join(delimiter);
  const entry: PoolEntry = {
    worker: new Worker(workerPath, {
      env: { ...process.env, NODE_PATH: nodePath },
    }),
    load: 0,
    seqs: new Set(),
  };
  entry.worker.on('message', (msg: WrappedWorkerResponse) => {
    if (msg.type === 'log') {
      const level = msg.level as 'info' | 'warn' | 'error' | 'debug';
      // eslint-disable-next-line no-console
      console[level in console ? level : 'log']('[sql-worker]', format(...(msg.args as [])));
      return;
    }
    if (msg.type === 'walCheckpointNeeded') {
      setTimeout(() => {
        void walCheckpoint('WALCheckpointNeeded');
      }, 0);
      return;
    }
    entry.seqs.delete(msg.seq);
    const waiting = pending.get(msg.seq);
    pending.delete(msg.seq);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    if (msg.error) {
      const err = new Error(msg.error.message);
      err.name = msg.error.name;
      err.stack = msg.error.stack;
      waiting.reject(err);
    } else {
      waiting.resolve(msg.response);
    }
  });
  const failAll = (reason: Error): void => {
    for (const s of entry.seqs) {
      rejectSeq(s, reason);
    }
    entry.seqs.clear();
  };
  entry.worker.on('error', err => {
    failAll(err instanceof Error ? err : new Error(String(err)));
  });
  entry.worker.on('exit', code => {
    if (entry.seqs.size > 0) {
      failAll(new Error(`sql worker exited with code ${code}`));
    }
  });
  return entry;
}

async function send(
  entry: PoolEntry,
  request: WorkerRequest,
  timeoutMs = SQL_CALL_TIMEOUT_MS
): Promise<unknown> {
  const s = seq;
  seq = (seq + 1) >>> 0;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      entry.seqs.delete(s);
      rejectSeq(s, new Error(`sql worker timeout after ${timeoutMs}ms (${request.type})`));
    }, timeoutMs);
    pending.set(s, { resolve, reject, timer });
    entry.seqs.add(s);
    const wrapped: WrappedWorkerRequest = { seq: s, request };
    try {
      entry.worker.postMessage(wrapped);
    } catch (error) {
      rejectSeq(s, error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function getWorker(): PoolEntry {
  if (pool.length === 0) {
    throw new Error('SQL worker pool is not initialized');
  }
  let min = pool[0]!;
  for (const entry of pool) {
    if (entry.load < min.load) min = entry;
  }
  return min;
}

async function walCheckpoint(reason: string): Promise<void> {
  const primary = pool[0];
  if (primary) await send(primary, { type: 'walCheckpoint', reason });
}

async function terminateWorker(worker: Worker): Promise<void> {
  try {
    await worker.terminate();
  } catch {
    /* already stopped */
  }
}

const SQLCIPHER_KEY_HEX = /^[0-9a-f]{64}$/i;

export function loadOrCreateSqlKey(dataDir: string): string {
  const configPath = join(dataDir, 'config.json');
  if (existsSync(configPath)) {
    let cfg: Record<string, unknown>;
    try {
      cfg = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `Failed to read SQLCipher key from ${configPath}: ${
          error instanceof Error ? error.message : String(error)
        }. Refusing to overwrite an existing config (that would make the DB unreadable).`
      );
    }
    const key = cfg.key;
    if (typeof key === 'string' && SQLCIPHER_KEY_HEX.test(key)) {
      try {
        chmodSync(configPath, 0o600);
      } catch {
        /* best-effort */
      }
      return key;
    }
    if (typeof cfg.encryptedKey === 'string' && cfg.encryptedKey.length > 0) {
      throw new Error(
        `${configPath} has encryptedKey (Signal Desktop OS keyring) and no raw 64-hex key. ` +
          `This bridge cannot unwrap it. Use a fresh SIGNAL_DATA_DIR or a config.json with "key".`
      );
    }
    throw new Error(
      `Invalid SQLCipher key in ${configPath} (expected 64 hex chars). ` +
        `Refusing to overwrite an existing config.`
    );
  }

  const key = randomBytes(32).toString('hex');
  try {
    writeFileSync(configPath, JSON.stringify({ key }, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
      flag: 'wx',
    } as ObjectEncodingOptions);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return loadOrCreateSqlKey(dataDir);
    }
    throw error;
  }
  try {
    chmodSync(configPath, 0o600);
  } catch {
    /* best-effort */
  }
  return key;
}

// ---- public API ---------------------------------------------------------------

let initialized = false;
let initializing: Promise<void> | null = null;

export async function initializeSQL(dataDir: string, appVersion: string): Promise<void> {
  if (initialized) return;
  if (initializing) return initializing;

  initializing = (async () => {
    const dbDir = join(dataDir, 'db');
    mkdirSync(dbDir, { recursive: true });

    const key = loadOrCreateSqlKey(dataDir);

    const spawned: Array<PoolEntry> = [];
    try {
      for (let i = 0; i < WORKER_COUNT; i++) {
        spawned.push(createWorker());
      }
      pool = spawned;

      const primary = pool[0]!;
      await send(primary, {
        type: 'init',
        options: { appVersion, configDir: dbDir, key },
        isPrimary: true,
      });

      await Promise.all(
        pool.slice(1).map(entry =>
          send(entry, {
            type: 'init',
            options: { appVersion, configDir: dbDir, key },
            isPrimary: false,
          })
        )
      );
      initialized = true;
    } catch (error) {
      pool = [];
      await Promise.all(spawned.map(e => terminateWorker(e.worker)));
      throw error;
    } finally {
      initializing = null;
    }
  })();

  return initializing;
}

export async function sqlCall(
  access: 'read' | 'write',
  method: string,
  args: ReadonlyArray<unknown>
): Promise<unknown> {
  if (!initialized) {
    throw new Error('SQL is not initialized');
  }
  const type = access === 'read' ? 'sqlCall:read' : 'sqlCall:write';
  const entry = access === 'write' ? pool[0]! : getWorker();
  entry.load += 1;
  try {
    const result = await send(entry, { type, encoding: 'js', method, args } as WorkerRequest);
    return (result as { result: unknown; duration: number }).result;
  } finally {
    entry.load -= 1;
  }
}

export async function sqlCallSerialized(
  access: 'read' | 'write',
  method: string,
  data: Uint8Array
): Promise<Uint8Array> {
  if (!initialized) {
    throw new Error('SQL is not initialized');
  }
  const type = access === 'read' ? 'sqlCall:read' : 'sqlCall:write';
  const entry = access === 'write' ? pool[0]! : getWorker();
  entry.load += 1;
  try {
    const result = await send(entry, { type, encoding: 'serialized', method, data } as WorkerRequest);
    return (result as { result: Uint8Array; duration: number }).result;
  } finally {
    entry.load -= 1;
  }
}

export async function closeSQL(): Promise<void> {
  const workers = pool.slice();
  pool = [];
  initialized = false;
  initializing = null;
  if (workers.length === 0) {
    return;
  }
  const rest = workers.slice(1);
  const primary = workers[0];
  try {
    await Promise.all(
      rest.map(e => send(e, { type: 'close' }, SQL_CLOSE_TIMEOUT_MS).catch(() => undefined))
    );
    if (primary) {
      await send(primary, { type: 'close' }, SQL_CLOSE_TIMEOUT_MS).catch(() => undefined);
    }
  } finally {
    await Promise.all(workers.map(e => terminateWorker(e.worker)));
    for (const [, waiting] of pending) {
      clearTimeout(waiting.timer);
      waiting.reject(new Error('SQL closed'));
    }
    pending.clear();
  }
}
