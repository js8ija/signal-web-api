// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Exclusive data-dir lock so two processes cannot mint different SQLCipher
 * keys against the same profile (permanent data loss).
 */

import {
  closeSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const INSTANCE_LOCK_FILENAME = 'instance.lock';

let lockFd: number | null = null;
let lockPath = '';

export function getLockFilePath(dataDir: string): string {
  return join(dataDir, INSTANCE_LOCK_FILENAME);
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireDataDirLock(dataDir: string): string {
  if (lockFd != null && lockPath) {
    return lockPath;
  }
  const path = getLockFilePath(dataDir);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx', 0o600);
      writeSync(fd, `${process.pid}\n`);
      lockFd = fd;
      lockPath = path;
      return path;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw error;
      }
      let holder = 0;
      try {
        holder = parseInt(readFileSync(path, 'utf-8').trim(), 10);
      } catch {
        holder = 0;
      }
      if (pidAlive(holder)) {
        throw new Error(
          `Another signal-web-api instance is using this data dir (lock ${path}, pid ${holder})`
        );
      }
      try {
        unlinkSync(path);
      } catch {
        /* retry wx */
      }
    }
  }
  throw new Error(`Failed to acquire data-dir lock ${path}`);
}

export function releaseDataDirLock(): void {
  if (lockFd != null) {
    try {
      closeSync(lockFd);
    } catch {
      /* already closed */
    }
    lockFd = null;
  }
  if (lockPath) {
    try {
      unlinkSync(lockPath);
    } catch {
      /* already gone */
    }
    lockPath = '';
  }
}
