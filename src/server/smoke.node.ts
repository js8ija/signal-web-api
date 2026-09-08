// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Smoke test for the Signal Web bridge server.
 * Usage: pnpm exec tsx web/server/smoke.node.ts
 *
 * Tests:
 * 1. GET /api/boot — config validates against rendererConfigSchema; nativeManifest has >300 entries
 * 2. WS: sql-write createOrUpdateItem then sql-read getItemById returns value
 * 3. POST /api/bridge/sync: PrivateKey_Generate → WireHandle, then PrivateKey_Serialize → 32-byte Uint8Array
 * 4. WS: native call works; 'release' frames delete handles from registry
 * 5. WS: ipc invoke for themeSetting returns default value
 */

import http from 'node:http';
import os from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import WebSocket from 'ws';

// Import server bootstrap
// We set env before importing
const tmpDir = mkdtempSync(join(os.tmpdir(), 'signal-web-smoke-'));
process.env.SIGNAL_DATA_DIR = tmpDir;
process.env.SIGNAL_WEB_DATA = tmpDir; // legacy alias
process.env.PORT = '0'; // random port
process.env.SIGNAL_ENV = 'development';
process.env.SIGNAL_ASSETS_ROOT = process.env.SIGNAL_ASSETS_ROOT ?? process.cwd();

// Dynamically import server after setting env
import type { Server as HttpServer } from 'node:http';
import { rendererConfigSchema } from '../../vendor/ts/types/RendererConfig.std.ts';
import type { RequestFrame, ResponseFrame, ReleaseFrame, WireHandle } from '../bridge/protocol.std.ts';
import { isWireHandle } from '../bridge/protocol.std.ts';
import { closeSQL } from './sql.node.ts';

let serverInstance: HttpServer | null = null;
let serverPort = 0;

// ---- test helpers ------------------------------------------------------------

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error('       ', (err as Error).message);
    if (process.env.SMOKE_VERBOSE) {
      console.error((err as Error).stack);
    }
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ---- HTTP helpers ------------------------------------------------------------

function httpGet(url: string, acceptMsgpack = false): Promise<{ status: number; body: Buffer; headers: Record<string, string | string[]> }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, {
      headers: acceptMsgpack ? { Accept: 'application/msgpack' } : {},
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks),
        headers: res.headers as Record<string, string | string[]>,
      }));
    });
    req.on('error', reject);
  });
}

function httpPost(url: string, body: Buffer, contentType: string): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': body.length,
      },
    };
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---- WebSocket helper --------------------------------------------------------

class WsSession {
  private ws: WebSocket;
  private pending = new Map<number, { resolve: (f: ResponseFrame) => void; reject: (e: Error) => void }>();
  private seq = 1;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
    });
    this.ws.on('message', (data) => {
      const frame = msgpackDecode(data as Buffer) as ResponseFrame;
      if (frame.t === 'res') {
        const p = this.pending.get(frame.id);
        this.pending.delete(frame.id);
        if (p) {
          if (frame.ok) p.resolve(frame);
          else p.reject(new Error(frame.error?.message ?? 'unknown error'));
        }
      }
      // Ignore push/cbreq frames for smoke test
    });
  }

  async call(ns: string, method: string, args: unknown[]): Promise<unknown> {
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (f) => resolve(f.value),
        reject,
      });
      const frame: RequestFrame = { t: 'req', id, ns: ns as RequestFrame['ns'], method, args };
      this.ws.send(msgpackEncode(frame));
    });
  }

  release(handles: number[]): void {
    const frame: ReleaseFrame = { t: 'release', handles };
    this.ws.send(msgpackEncode(frame));
  }

  close(): void {
    this.ws.close();
  }
}

// ---- main -------------------------------------------------------------------

async function runSmoke(): Promise<void> {
  // Start server
  const { startServer } = await import('./index.node.ts');
  serverInstance = await startServer();
  serverPort = (serverInstance.address() as { port: number }).port;
  const base = `http://localhost:${serverPort}`;
  const wsBase = `ws://localhost:${serverPort}`;

  console.log(`\nSmoke test running against ${base}\n`);

  // ---- Test 1: GET /api/boot -------------------------------------------------
  await test('GET /api/boot: valid config and nativeManifest', async () => {
    const res = await httpGet(`${base}/api/boot`, true);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const payload = msgpackDecode(res.body) as {
      sync: Record<string, unknown>;
      nativeManifest: Record<string, string>;
    };
    assert(typeof payload === 'object' && payload !== null, 'Payload must be an object');
    assert('sync' in payload, 'Payload must have sync field');
    assert('nativeManifest' in payload, 'Payload must have nativeManifest field');

    // Validate config
    const config = payload.sync['get-config'];
    const parsed = rendererConfigSchema.safeParse(config);
    assert(parsed.success, `rendererConfigSchema validation failed: ${JSON.stringify(!parsed.success && parsed.error?.flatten())}`);

    // Check nativeManifest size
    const count = Object.keys(payload.nativeManifest).length;
    assert(count > 300, `nativeManifest has only ${count} entries, expected >300`);

    // Check all 7 sendSync channels are present
    const syncKeys = Object.keys(payload.sync);
    for (const ch of ['get-config', 'locale-data', 'locale-display-names', 'country-display-names', 'OS.getClassName', 'get-user-data-path', 'native-theme:init']) {
      assert(syncKeys.includes(ch), `Missing sync channel: ${ch}`);
    }
  });

  // ---- Test 2: SQL write + read ----------------------------------------------
  await test('WS sql-write createOrUpdateItem + sql-read getItemById', async () => {
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();

    const testItem = { id: 'smoke-test-key', value: 'smoke-test-value-42' };
    await ws.call('sql-write', 'createOrUpdateItem', [testItem]);

    const result = await ws.call('sql-read', 'getItemById', ['smoke-test-key']) as { id: string; value: string } | null;
    assert(result != null, 'getItemById returned null');
    assert(result.id === 'smoke-test-key', `Expected id 'smoke-test-key', got '${result?.id}'`);
    assert(result.value === 'smoke-test-value-42', `Expected value 'smoke-test-value-42', got '${result?.value}'`);

    ws.close();
  });

  // ---- Test 3: sync native via POST /api/bridge/sync -------------------------
  await test('POST /api/bridge/sync: PrivateKey_Generate → WireHandle, PrivateKey_Serialize → 32 bytes', async () => {
    const genFrame: RequestFrame = {
      t: 'req',
      id: 100,
      ns: 'native',
      method: 'PrivateKey_Generate',
      args: [],
    };
    const genRes = await httpPost(
      `${base}/api/bridge/sync`,
      Buffer.from(msgpackEncode(genFrame)),
      'application/msgpack'
    );
    assert(genRes.status === 200, `Expected 200, got ${genRes.status}`);
    const genResp = msgpackDecode(genRes.body) as ResponseFrame;
    assert(genResp.ok, `PrivateKey_Generate failed: ${genResp.error?.message}`);
    const handle = genResp.value as WireHandle;
    assert(isWireHandle(handle), `Expected WireHandle, got ${JSON.stringify(handle)}`);

    // Serialize the private key
    const serFrame: RequestFrame = {
      t: 'req',
      id: 101,
      ns: 'native',
      method: 'PrivateKey_Serialize',
      args: [handle],
    };
    const serRes = await httpPost(
      `${base}/api/bridge/sync`,
      Buffer.from(msgpackEncode(serFrame)),
      'application/msgpack'
    );
    const serResp = msgpackDecode(serRes.body) as ResponseFrame;
    assert(serResp.ok, `PrivateKey_Serialize failed: ${serResp.error?.message}`);
    const bytes = serResp.value as Uint8Array;
    assert(bytes instanceof Uint8Array, `Expected Uint8Array, got ${typeof bytes}`);
    assert(bytes.length === 32, `Expected 32 bytes, got ${bytes.length}`);
  });

  // ---- Test 4: WS native call + release frames --------------------------------
  await test('WS native call works and release deletes handles', async () => {
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();

    const handle = await ws.call('native', 'PrivateKey_Generate', []) as WireHandle;
    assert(isWireHandle(handle), `Expected WireHandle, got ${JSON.stringify(handle)}`);

    // Serialize it via WS
    const bytes = await ws.call('native', 'PrivateKey_Serialize', [handle]) as Uint8Array;
    assert(bytes instanceof Uint8Array && bytes.length === 32, `Expected 32-byte Uint8Array`);

    // Release the handle
    ws.release([handle.__native_handle]);

    // Wait a tick for the release to be processed
    await new Promise<void>(r => setTimeout(r, 50));

    // Trying to use the released handle should now fail
    let threwOnRelease = false;
    try {
      await ws.call('native', 'PrivateKey_Serialize', [handle]);
    } catch {
      threwOnRelease = true;
    }
    assert(threwOnRelease, 'Expected error when using released handle');

    ws.close();
  });

  // ---- Test 5: ipc invoke for themeSetting -----------------------------------
  await test('WS ipc invoke settings:get:themeSetting returns default', async () => {
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();

    const theme = await ws.call('ipc', 'settings:get:themeSetting', []);
    assert(theme === 'system' || theme === 'light' || theme === 'dark' || theme == null,
      `Expected theme setting, got ${JSON.stringify(theme)}`);

    ws.close();
  });

  // ---- Summary ---------------------------------------------------------------
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('─'.repeat(40));
}

// ---- run --------------------------------------------------------------------

runSmoke().finally(async () => {
  // Close the SQLCipher workers gracefully first — terminating the process
  // with the DB open aborts in the sqlcipher NAPI finalizer.
  try {
    await closeSQL();
  } catch {
    /* ok */
  }
  if (serverInstance) serverInstance.close();
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  process.exit(failed > 0 ? 1 : 0);
});
