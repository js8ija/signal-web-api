// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Side-effect module: link `<root>/prebuilds` to libsignal's prebuilds dir.
 *
 * Under tsx, node-gyp-build resolves `@signalapp/libsignal-client`'s native
 * addon relative to the cwd instead of the package dir (EXTRACTION.md), so it
 * looks for `<cwd>/prebuilds`. scripts/start.mjs creates that link before
 * spawning tsx; entry points invoked as `tsx <file>` need it too.
 *
 * Import this FIRST — ESM evaluates dependencies in import order, and any
 * import that reaches vendor/ts/AttachmentCrypto.node.ts loads the addon.
 */

import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

function isBrokenSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink() && !existsSync(path);
  } catch {
    return false;
  }
}

export function ensureLibsignalPrebuilds(root = process.cwd()): void {
  const link = join(root, 'prebuilds');
  const target = join(root, 'node_modules', '@signalapp', 'libsignal-client', 'prebuilds');
  try {
    if (isBrokenSymlink(link)) {
      unlinkSync(link);
    }
    if (!existsSync(link) && existsSync(target)) {
      symlinkSync(target, link);
    }
  } catch (error) {
    console.warn(
      '[prebuilds] could not link prebuilds:',
      error instanceof Error ? error.message : error
    );
  }
}

ensureLibsignalPrebuilds();
