// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Server-side port of app/OptionalResourceService.main.ts: serves named
 * optional resources (emoji search indexes, jumbo emoji font) declared in
 * build/optional-resources.json. Files are fetched from Signal's static
 * CDN, verified against the pinned sha512 digest and size, and cached in
 * <data>/optionalResources/.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { signalFetch } from './signalFetch.node.ts';

type ResourceDecl = Readonly<{
  url: string;
  size: number;
  digest: string;
}>;

let declarations: Record<string, ResourceDecl> | undefined;
let resourcesDir: string | undefined;
const memoryCache = new Map<string, Uint8Array>();
let ready: Promise<void> = Promise.resolve();

export function initOptionalResources(repoRoot: string, dataDir: string): void {
  resourcesDir = join(dataDir, 'optionalResources');
  mkdirSync(resourcesDir, { recursive: true });
  ready = readFile(join(repoRoot, 'build', 'optional-resources.json'), 'utf-8')
    .then(json => {
      declarations = JSON.parse(json) as Record<string, ResourceDecl>;
    })
    .catch(err => {
      console.warn('[optional-resources] could not load declarations:', err);
      declarations = {};
    });
}

function isValid(data: Uint8Array, decl: ResourceDecl): boolean {
  if (data.length !== decl.size) {
    return false;
  }
  const digest = createHash('sha512').update(data).digest();
  const expected = Buffer.from(decl.digest, 'base64');
  return (
    digest.length === expected.length && timingSafeEqual(digest, expected)
  );
}

export async function getOptionalResource(
  name: string
): Promise<Uint8Array | undefined> {
  await ready;
  if (declarations == null || resourcesDir == null) {
    return undefined;
  }
  const decl = declarations[name];
  if (decl == null || /[/\\]/.test(name)) {
    return undefined;
  }

  const cached = memoryCache.get(name);
  if (cached != null) {
    return cached;
  }

  const filePath = join(resourcesDir, name);
  try {
    const onDisk = await readFile(filePath);
    if (isValid(onDisk, decl)) {
      memoryCache.set(name, onDisk);
      return onDisk;
    }
    await unlink(filePath).catch(() => undefined);
  } catch {
    // Not on disk yet
  }

  try {
    const response = await signalFetch(new URL(decl.url));
    if (response.status < 200 || response.status >= 300) {
      console.warn(
        `[optional-resources] ${name}: HTTP ${response.status} from CDN`
      );
      return undefined;
    }
    const data = new Uint8Array(response.body);
    if (!isValid(data, decl)) {
      console.warn(`[optional-resources] ${name}: digest mismatch, dropping`);
      return undefined;
    }
    memoryCache.set(name, data);
    await writeFile(filePath, data).catch(err =>
      console.warn(`[optional-resources] ${name}: cache write failed`, err)
    );
    console.log(`[optional-resources] fetched ${name} (${data.length} bytes)`);
    return data;
  } catch (err) {
    console.warn(`[optional-resources] ${name}: fetch failed`, err);
    return undefined;
  }
}
