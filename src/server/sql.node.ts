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

import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { serialize, deserialize } from 'node:v8';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { format } from 'node:util';
import { sqlWorkerPath } from './paths.node.ts';

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
const MIN_TRACE_DURATION = 40;

type PoolEntry = { worker: Worker; load: number };
type PendingEntry = { resolve: (v: unknown) => void; reject: (e: Error) => void };

const SQL_WORKER_PATH = sqlWorkerPath();

let pool: Array<PoolEntry> = [];
let seq = 0;
const pending = new Map<number, PendingEntry>();

function createWorker(): Worker {
  const w = new Worker(SQL_WORKER_PATH);
  w.on('message', (msg: WrappedWorkerResponse) => {
    if (msg.type === 'log') {
      const level = msg.level as 'info' | 'warn' | 'error' | 'debug';
      // eslint-disable-next-line no-console
      console[level in console ? level : 'log']('[sql-worker]', format(...(msg.args as [])));
      return;
    }
    if (msg.type === 'walCheckpointNeeded') {
      // Checkpoint is automatic; schedule it
      setTimeout(() => {
        void walCheckpoint('WALCheckpointNeeded');
      }, 0);
      return;
    }
    const entry = pending.get(msg.seq);
    pending.delete(msg.seq);
    if (!entry) return;
    if (msg.error) {
      const err = new Error(msg.error.message);
      err.name = msg.error.name;
      err.stack = msg.error.stack;
      entry.reject(err);
    } else {
      entry.resolve(msg.response);
    }
  });
  return w;
}

async function send(entry: PoolEntry, request: WorkerRequest): Promise<unknown> {
  const s = seq;
  seq = (seq + 1) >>> 0;
  return new Promise((resolve, reject) => {
    pending.set(s, { resolve, reject });
    const wrapped: WrappedWorkerRequest = { seq: s, request };
    entry.worker.postMessage(wrapped);
  });
}

function getWorker(): PoolEntry {
  let min = pool[0];
  for (const entry of pool) {
    if (entry.load < (min?.load ?? Infinity)) min = entry;
  }
  return min!;
}

async function walCheckpoint(reason: string): Promise<void> {
  const primary = pool[0];
  if (primary) await send(primary, { type: 'walCheckpoint', reason });
}

// ---- public API ---------------------------------------------------------------

let initialized = false;

export async function initializeSQL(dataDir: string, appVersion: string): Promise<void> {
  if (initialized) return;
  initialized = true;

  const dbDir = join(dataDir, 'db');
  mkdirSync(dbDir, { recursive: true });

  // Bootstrap or load the SQLCipher key (same pattern as app/main.main.ts)
  const configPath = join(dataDir, 'config.json');
  let key: string;
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      key = cfg.key as string;
    } catch {
      key = '';
    }
  } else {
    key = '';
  }
  if (!key || typeof key !== 'string' || key.length < 10) {
    key = randomBytes(32).toString('hex');
    writeFileSync(configPath, JSON.stringify({ key }, null, 2), 'utf-8');
  }

  // Spin up workers
  for (let i = 0; i < WORKER_COUNT; i++) {
    pool.push({ worker: createWorker(), load: 0 });
  }

  // Init primary (runs migrations)
  const primary = pool[0]!;
  await send(primary, {
    type: 'init',
    options: { appVersion, configDir: dbDir, key },
    isPrimary: true,
  });

  // Init rest
  await Promise.all(
    pool.slice(1).map(entry =>
      send(entry, {
        type: 'init',
        options: { appVersion, configDir: dbDir, key },
        isPrimary: false,
      })
    )
  );
}

export async function sqlCall(
  access: 'read' | 'write',
  method: string,
  args: ReadonlyArray<unknown>
): Promise<unknown> {
  const type = access === 'read' ? 'sqlCall:read' : 'sqlCall:write';
  const entry = access === 'write' ? pool[0]! : getWorker();
  entry.load += 1;
  try {
    // Use 'js' encoding — the bridge receives plain JS args from the browser
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
  const primary = pool[0];
  if (!primary) return;
  const rest = pool.slice(1);
  await Promise.all(rest.map(e => send(e, { type: 'close' })));
  await send(primary, { type: 'close' });
  pool = [];
  initialized = false;
}
