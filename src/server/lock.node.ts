// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Exclusive instance lock for a data dir. Two processes on the same
 * SIGNAL_DATA_DIR must not both write config.json / the SQLCipher DB.
 */

import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';

export const INSTANCE_LOCK_NAME = 'instance.lock';

export type InstanceLock = {
  path: string;
  release: () => void;
};

function lockPath(dataDir: string): string {
  return join(dataDir, INSTANCE_LOCK_NAME);
}

function pidIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function readLockPid(path: string): number | undefined {
  try {
    const n = Number.parseInt(readFileSync(path, 'utf-8').trim(), 10);
    return Number.isInteger(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Acquire an exclusive lock in `dataDir`. Reclaims a lock whose pid is dead.
 * Throws if another live process holds the lock (including this process).
 */
export function acquireInstanceLock(dataDir: string): InstanceLock {
  const path = lockPath(dataDir);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx', 0o600);
      try {
        writeSync(fd, `${process.pid}\n`);
      } catch (error) {
        closeSync(fd);
        try {
          unlinkSync(path);
        } catch {
          /* best-effort */
        }
        throw error;
      }
      let released = false;
      return {
        path,
        release: () => {
          if (released) {
            return;
          }
          released = true;
          try {
            closeSync(fd);
          } catch {
            /* already closed */
          }
          try {
            const pid = readLockPid(path);
            if (pid === process.pid) {
              unlinkSync(path);
            }
          } catch {
            /* best-effort */
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      const holder = readLockPid(path);
      if (holder != null && pidIsAlive(holder)) {
        throw new Error(
          `SIGNAL_DATA_DIR is already in use by pid ${holder} (${path}). ` +
            `Stop that process or choose a different directory.`
        );
      }
      try {
        unlinkSync(path);
      } catch {
        /* raced */
      }
    }
  }
  throw new Error(`Failed to acquire instance lock at ${path}`);
}

export function instanceLockExists(dataDir: string): boolean {
  return existsSync(lockPath(dataDir));
}
