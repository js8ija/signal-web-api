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

import { createRequire } from 'node:module';
import { delimiter, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  unlinkSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { format } from 'node:util';
import { getAssetsRoot, sqlWorkerPath } from './paths.node.ts';

const KEY_HEX_RE = /^[0-9a-f]{64}$/i;
const SQL_NATIVE_MODULES = ['@signalapp/sqlcipher', '@signalapp/ringrtc'] as const;

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

type PoolEntry = {
  worker: Worker;
  load: number;
  seqs: Set<number>;
  index: number;
  dead: boolean;
  deadError?: Error;
};
type PendingEntry = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

let pool: Array<PoolEntry> = [];
let seq = 0;
const pending = new Map<number, PendingEntry>();
let primaryDeadError: Error | null = null;
let lastDataDir = '';
let lastAppVersion = '';
let closing = false;
let removedAwaitingRestart = false;

function rejectSeq(s: number, error: Error): void {
  const entry = pending.get(s);
  if (!entry) {
    return;
  }
  pending.delete(s);
  clearTimeout(entry.timer);
  entry.reject(error);
}

function assertSqlNativeModules(): void {
  const req = createRequire(join(getAssetsRoot(), 'package.json'));
  for (const name of SQL_NATIVE_MODULES) {
    try {
      req.resolve(name);
    } catch (error) {
      throw new Error(
        `Missing or unloadable ${name} (SQL worker load-time dependency; calling/RingRTC is not enabled). ` +
          `Node ${process.version}, ABI modules=${process.versions.modules}. ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function createWorker(index: number): PoolEntry {
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
    index,
    dead: false,
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
  const markDead = (reason: Error): void => {
    if (entry.dead) {
      failAll(reason);
      return;
    }
    entry.dead = true;
    entry.deadError = reason;
    console.error(`[sql] worker ${entry.index} died: ${reason.message}`);
    failAll(reason);
    if (entry.index === 0) {
      initialized = false;
      primaryDeadError = reason;
    }
    pool = pool.filter(e => e !== entry);
    if (!closing && initialized && entry.index !== 0 && lastDataDir) {
      void respawnWorker(entry.index);
    }
  };
  entry.worker.on('error', err => {
    markDead(err instanceof Error ? err : new Error(String(err)));
  });
  entry.worker.on('exit', code => {
    if (closing || entry.dead) {
      if (entry.seqs.size > 0) {
        failAll(new Error(`sql worker ${entry.index} exited with code ${code}`));
      }
      return;
    }
    markDead(new Error(`sql worker ${entry.index} exited with code ${code}`));
  });
  return entry;
}

async function respawnWorker(index: number): Promise<void> {
  try {
    const replacement = createWorker(index);
    await send(replacement, {
      type: 'init',
      options: {
        appVersion: lastAppVersion,
        configDir: join(lastDataDir, 'db'),
        key: loadOrCreateSqlKey(lastDataDir),
      },
      isPrimary: false,
    });
    if (!closing && initialized) {
      pool.push(replacement);
    } else {
      await terminateWorker(replacement.worker);
    }
  } catch (error) {
    console.error(
      `[sql] failed to respawn worker ${index}:`,
      error instanceof Error ? error.message : error
    );
  }
}

async function send(
  entry: PoolEntry,
  request: WorkerRequest,
  timeoutMs = SQL_CALL_TIMEOUT_MS
): Promise<unknown> {
  if (entry.dead) {
    throw entry.deadError ?? new Error(`sql worker ${entry.index} is dead`);
  }
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

function liveWorkers(): Array<PoolEntry> {
  return pool.filter(e => !e.dead);
}

function getWorker(): PoolEntry {
  const live = liveWorkers();
  if (live.length === 0) {
    throw (
      primaryDeadError ??
      new Error(initialized ? 'SQL worker pool is empty' : 'SQL worker pool is not initialized')
    );
  }
  let min = live[0]!;
  for (const entry of live) {
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

export function readSqlKeyFromConfig(configPath: string): string {
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
  if (typeof key !== 'string') {
    if (cfg.encryptedKey != null) {
      throw new Error(
        `${configPath} contains encryptedKey (Signal Desktop OS-keyring format) and no usable key. ` +
          `This standalone bridge cannot unwrap an OS-keyring key. Use a fresh SIGNAL_DATA_DIR ` +
          `or a config.json with a 64-hex-character key.`
      );
    }
    throw new Error(
      `Invalid SQLCipher key in ${configPath}. Expected a 64-hex-character key. ` +
        `Refusing to overwrite an existing config.`
    );
  }
  if (!KEY_HEX_RE.test(key)) {
    throw new Error(
      `Invalid SQLCipher key in ${configPath}: expected 64 hex characters, got length ${key.length}.`
    );
  }
  try {
    chmodSync(configPath, 0o600);
  } catch {
    /* best-effort */
  }
  return key;
}

export function loadOrCreateSqlKey(dataDir: string): string {
  const configPath = join(dataDir, 'config.json');
  if (existsSync(configPath)) {
    return readSqlKeyFromConfig(configPath);
  }

  const key = randomBytes(32).toString('hex');
  try {
    writeFileSync(configPath, JSON.stringify({ key }, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
      flag: 'wx',
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return readSqlKeyFromConfig(configPath);
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
    assertSqlNativeModules();
    lastDataDir = dataDir;
    lastAppVersion = appVersion;
    primaryDeadError = null;
    removedAwaitingRestart = false;
    const dbDir = join(dataDir, 'db');
    mkdirSync(dbDir, { recursive: true, mode: 0o700 });

    const key = loadOrCreateSqlKey(dataDir);

    const spawned: Array<PoolEntry> = [];
    try {
      for (let i = 0; i < WORKER_COUNT; i++) {
        spawned.push(createWorker(i));
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
      closing = true;
      pool = [];
      await Promise.all(spawned.map(e => terminateWorker(e.worker)));
      closing = false;
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
    throw new Error(
      removedAwaitingRestart
        ? 'SQL restart required after remove-db'
        : 'SQL is not initialized'
    );
  }
  const type = access === 'read' ? 'sqlCall:read' : 'sqlCall:write';
  const entry =
    access === 'write'
      ? pool.find(e => e.index === 0 && !e.dead) ??
        (() => {
          throw primaryDeadError ?? new Error('SQL primary is dead');
        })()
      : getWorker();
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
  const entry =
    access === 'write'
      ? pool.find(e => e.index === 0 && !e.dead) ??
        (() => {
          throw primaryDeadError ?? new Error('SQL primary is dead');
        })()
      : getWorker();
  entry.load += 1;
  try {
    const result = await send(entry, { type, encoding: 'serialized', method, data } as WorkerRequest);
    return (result as { result: Uint8Array; duration: number }).result;
  } finally {
    entry.load -= 1;
  }
}

export function getSqlHealth(): { ready: boolean; reason?: string } {
  if (removedAwaitingRestart) {
    return { ready: false, reason: 'restart-required' };
  }
  if (primaryDeadError) {
    return { ready: false, reason: primaryDeadError.message };
  }
  if (!initialized || liveWorkers().length === 0) {
    return { ready: false, reason: 'sql-not-initialized' };
  }
  const primary = pool.find(e => e.index === 0);
  if (primary == null || primary.dead) {
    return { ready: false, reason: 'sql-primary-dead' };
  }
  return { ready: true };
}

function unlinkIfExists(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    /* ok */
  }
}

/** Close workers via removeDB (primary) / close (rest) and delete key + sqlite files. */
export async function removeSQL(dataDir: string): Promise<void> {
  const workers = pool.slice();
  closing = true;
  pool = [];
  initialized = false;
  initializing = null;
  if (workers.length > 0) {
    const rest = workers.filter(e => e.index !== 0);
    const primary = workers.find(e => e.index === 0) ?? workers[0];
    try {
      await Promise.all(
        rest.map(e => send(e, { type: 'close' }, SQL_CLOSE_TIMEOUT_MS).catch(() => undefined))
      );
      if (primary) {
        await send(primary, { type: 'removeDB' }, SQL_CLOSE_TIMEOUT_MS).catch(() => undefined);
      }
    } finally {
      await Promise.all(workers.map(e => terminateWorker(e.worker)));
      for (const [, waiting] of pending) {
        clearTimeout(waiting.timer);
        waiting.reject(new Error('SQL removed'));
      }
      pending.clear();
    }
  }
  closing = false;
  const dbSqlDir = join(dataDir, 'db', 'sql');
  for (const name of ['db.sqlite', 'db.sqlite-shm', 'db.sqlite-wal']) {
    unlinkIfExists(join(dbSqlDir, name));
  }
  unlinkIfExists(join(dataDir, 'config.json'));
  removedAwaitingRestart = true;
}

export async function resetSQL(dataDir: string, appVersion: string): Promise<void> {
  await removeSQL(dataDir);
  await initializeSQL(dataDir, appVersion);
}

export async function closeSQL(): Promise<void> {
  const workers = pool.slice();
  closing = true;
  pool = [];
  initialized = false;
  initializing = null;
  primaryDeadError = null;
  if (workers.length === 0) {
    closing = false;
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
    closing = false;
  }
}
