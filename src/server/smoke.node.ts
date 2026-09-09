// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Smoke test for the Signal Web bridge server.
 * Usage: npm run smoke
 *
 * Tests:
 * 1. GET /api/boot — config validates against rendererConfigSchema; nativeManifest has >300 entries
 * 2. WS: sql-write createOrUpdateItem then sql-read getItemById returns value
 * 3. POST /api/bridge/sync: PrivateKey_Generate → WireHandle, then PrivateKey_Serialize → 32-byte Uint8Array
 * 4. WS: native call works; 'release' frames delete handles from registry
 * 5. WS: ipc invoke for themeSetting returns default value
 */

// Must precede every import that can reach libsignal's native addon: tsx makes
// node-gyp-build resolve prebuilds from the cwd (EXTRACTION.md).
import './prebuilds.node.ts';

import http from 'node:http';
import os from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import WebSocket from 'ws';

// Import server bootstrap
// We set env before importing
const tmpDir = mkdtempSync(join(os.tmpdir(), 'signal-web-smoke-'));
const staticRoot = mkdtempSync(join(os.tmpdir(), 'signal-web-static-'));
mkdirSync(join(staticRoot, 'stylesheets'), { recursive: true });
writeFileSync(join(staticRoot, 'stylesheets', 'my file.css'), 'body{color:red}');
writeFileSync(join(staticRoot, 'stylesheets', 'app.wasm'), Buffer.from([0, 97, 115, 109, 1]));
writeFileSync(join(staticRoot, 'stylesheets', 'app.js.map'), '{"version":3}');
process.env.SIGNAL_DATA_DIR = tmpDir;
process.env.SIGNAL_WEB_DATA = tmpDir; // legacy alias
process.env.PORT = '0'; // random port
process.env.SIGNAL_ENV = 'production';
process.env.SIGNAL_ASSETS_ROOT = process.env.SIGNAL_ASSETS_ROOT ?? process.cwd();
process.env.SIGNAL_LISTEN_HOST = '127.0.0.1';
process.env.STATIC_ROOT = staticRoot;
process.env.SIGNAL_FS_READFILE_MAX = '1024';
delete process.env.SIGNAL_NEST_API_BASE;
delete process.env.NEST_API_BASE;
delete process.env.SIGNAL_API_AUTH;

// Dynamically import server after setting env
import type { Server as HttpServer } from 'node:http';
import { rendererConfigSchema } from '../../vendor/ts/types/RendererConfig.std.ts';
import type { RequestFrame, ResponseFrame, ReleaseFrame, WireHandle } from '../bridge/protocol.std.ts';
import { isWireHandle } from '../bridge/protocol.std.ts';
import { closeSQL, loadOrCreateSqlKey, readSqlKeyFromConfig } from './sql.node.ts';
import { isAllowedProxyUrl, isAllowedProxyHost, isProxyRequestHeaderAllowed } from './proxy.node.ts';
import { resolveNestUpstreamUrl, nestApiBaseFromEnv, nestAllowsMethod } from './nest-proxy.node.ts';
import { isFsInside, getDataDir } from './paths.node.ts';
import { getOptionalResource } from './optionalResources.node.ts';
import { stripProxyUserinfo, assertSignalEnvConfigExists } from './boot.node.ts';
import { resolveNestApiBase, sanitizeLinkedSessionForStorage } from '../bridge/nest-client.web.ts';
import { safeContentType, parseRange } from './attachments.node.ts';
import { getLockFilePath, releaseDataDirLock } from './instance-lock.node.ts';
import { getFsReadFileMaxBytes } from './fs.node.ts';
import { API_TOKEN_FILENAME } from './access-control.node.ts';

let serverInstance: HttpServer | null = null;
let serverPort = 0;
let apiToken = '';

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

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return apiToken ? { Authorization: `Bearer ${apiToken}`, ...extra } : { ...extra };
}

function httpRequest(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer;
    auth?: boolean;
  } = {}
): Promise<{ status: number; body: Buffer; headers: Record<string, string | string[]> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = opts.auth === false ? { ...opts.headers } : authHeaders(opts.headers ?? {});
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: opts.method ?? 'GET',
        headers: {
          ...headers,
          ...(opts.body ? { 'Content-Length': String(opts.body.length) } : {}),
        },
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks),
            headers: res.headers as Record<string, string | string[]>,
          })
        );
      }
    );
    req.on('error', reject);
    if (opts.body) {
      req.write(opts.body);
    }
    req.end();
  });
}

function httpGet(
  url: string,
  acceptMsgpack = false
): Promise<{ status: number; body: Buffer; headers: Record<string, string | string[]> }> {
  return httpRequest(url, {
    headers: acceptMsgpack ? { Accept: 'application/msgpack' } : {},
  });
}

function httpPost(
  url: string,
  body: Buffer,
  contentType: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; body: Buffer; headers: Record<string, string | string[]> }> {
  return httpRequest(url, {
    method: 'POST',
    body,
    headers: { 'Content-Type': contentType, ...extraHeaders },
  });
}

// ---- WebSocket helper --------------------------------------------------------

class WsSession {
  private ws: WebSocket;
  private pending = new Map<number, { resolve: (f: ResponseFrame) => void; reject: (e: Error) => void }>();
  private seq = 1;

  constructor(url: string, token = apiToken) {
    const u = new URL(url);
    if (token) {
      u.searchParams.set('token', token);
    }
    this.ws = new WebSocket(u.toString());
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ws connect timeout')), 15_000);
      this.ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
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
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ws call timeout ${ns}:${method}`));
      }, 20_000);
      this.pending.set(id, {
        resolve: (f) => {
          clearTimeout(timer);
          resolve(f.value);
        },
        reject: err => {
          clearTimeout(timer);
          reject(err);
        },
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
  apiToken = readFileSync(join(tmpDir, API_TOKEN_FILENAME), 'utf-8').trim();
  const base = `http://127.0.0.1:${serverPort}`;
  const wsBase = `ws://127.0.0.1:${serverPort}`;

  console.log(`\nSmoke test running against ${base}\n`);

  // ---- Test 1: GET /api/boot -------------------------------------------------
  await test('GET /api/boot: valid config and nativeManifest', async () => {
    const res = await httpGet(`${base}/api/boot`, true);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const cc = String(res.headers['cache-control'] ?? '');
    assert(cc.includes('no-store'), `boot Cache-Control should be no-store, got ${cc}`);
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

    const dataPath = payload.sync['get-user-data-path'];
    assert(
      dataPath === resolvePath(tmpDir) || dataPath === getDataDir(),
      `Smoke must not touch the real user data dir; got ${String(dataPath)} expected ${resolvePath(tmpDir)}`
    );
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
      'application/x-msgpack'
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
      'application/x-msgpack'
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

  await test('GET /api/health returns ok', async () => {
    const res = await httpGet(`${base}/api/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = JSON.parse(res.body.toString('utf-8')) as {
      ok: boolean;
      ready?: boolean;
      buildExpiration?: number;
      cors?: unknown;
    };
    assert(body.ok === true, 'health.ok should be true');
    assert(body.ready === true, 'health.ready should be true');
    assert(body.cors === undefined, 'health must not echo CORS');
    assert(typeof body.buildExpiration === 'number' || body.buildExpiration === undefined, 'buildExpiration');
  });

  await test('proxy allowlist: apex captcha host allowed, others rejected', async () => {
    assert(isAllowedProxyHost('signalcaptchas.org'), 'signalcaptchas.org apex must be allowed');
    assert(isAllowedProxyHost('cdn.signal.org'), 'cdn.signal.org must be allowed');
    assert(isAllowedProxyUrl('https://signalcaptchas.org/challenge') != null, 'https captcha URL');
    assert(isAllowedProxyUrl('https://example.com/') == null, 'example.com must be rejected');
    assert(isAllowedProxyUrl('http://cdn.signal.org/') == null, 'http must be rejected');
    assert(isAllowedProxyUrl('https://evil-signal.org/') == null, 'suffix bypass must be rejected');
    assert(isAllowedProxyUrl('https://cdn.signal.org.evil.com/') == null, 'suffix append must be rejected');
    assert(isAllowedProxyUrl('https://user:pass@cdn.signal.org/') == null, 'userinfo must be rejected');
    const denied = await httpGet(`${base}/api/proxy?url=${encodeURIComponent('https://example.com/')}`);
    assert(denied.status === 403, `Expected 403, got ${denied.status}`);
  });

  await test('nest proxy disabled by default and confines upstream URL', async () => {
    assert(nestApiBaseFromEnv() === '', 'nest proxy must be off without SIGNAL_NEST_API_BASE');
    const cfgRes = await httpGet(`${base}/api/nest-config`);
    assert(cfgRes.status === 200, `Expected 200, got ${cfgRes.status}`);
    const cfg = JSON.parse(cfgRes.body.toString('utf-8')) as { enabled: boolean };
    assert(cfg.enabled === false, 'nest-config.enabled should be false');
    const nestRes = await httpGet(`${base}/api/nest/messages/stream`);
    assert(nestRes.status === 503, `Expected 503, got ${nestRes.status}`);

    const confined = resolveNestUpstreamUrl(
      'http://127.0.0.1:3010',
      '/api/nest//evil.com/steal',
      ''
    );
    assert(
      confined.origin === 'http://127.0.0.1:3010',
      `protocol-relative suffix escaped: ${confined.href}`
    );
    assert(confined.pathname === '/evil.com/steal', confined.pathname);
  });

  await test('fs namespace rejects paths outside the data dir', async () => {
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();
    let threw = false;
    try {
      await ws.call('fs', 'readFile', ['/etc/passwd']);
    } catch (error) {
      threw = true;
      assert(
        String((error as Error).message).includes('escapes') ||
          String((error as Error).message).includes('not allowed') ||
          String((error as Error).message).includes('Forbidden') ||
          String((error as Error).name).includes('Forbidden'),
        `unexpected error: ${(error as Error).message}`
      );
    }
    assert(threw, 'expected fs read of /etc/passwd to fail');
    ws.close();
    assert(isFsInside('/tmp/ui/bundles-evil/x', '/tmp/ui/bundles') === false, 'prefix bypass');
    assert(isFsInside('/tmp/ui/bundles/x', '/tmp/ui/bundles') === true, 'descendant allowed');
  });

  await test('C1: WS evil Origin is 403; missing token is 401; valid token works', async () => {
    const evil = await new Promise<{ status: number }>((resolve, reject) => {
      const ws = new WebSocket(`${wsBase}/api/bridge?token=${apiToken}`, {
        origin: 'https://evil.example',
      });
      ws.on('unexpected-response', (_req, res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
      });
      ws.on('open', () => {
        ws.close();
        reject(new Error('evil origin must not connect'));
      });
      ws.on('error', () => {
        /* unexpected-response should fire first */
      });
      setTimeout(() => reject(new Error('evil origin ws timeout')), 5000);
    });
    assert(evil.status === 403, `Expected 403, got ${evil.status}`);

    const missing = await new Promise<{ status: number }>((resolve, reject) => {
      const ws = new WebSocket(`${wsBase}/api/bridge`);
      ws.on('unexpected-response', (_req, res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
      });
      ws.on('open', () => {
        ws.close();
        reject(new Error('missing token must not connect'));
      });
      ws.on('error', () => {
        /* ignore */
      });
      setTimeout(() => reject(new Error('missing token ws timeout')), 5000);
    });
    assert(missing.status === 401, `Expected 401, got ${missing.status}`);

    const ok = new WsSession(`${wsBase}/api/bridge`);
    await ok.connect();
    ok.close();
  });

  await test('C1: Host allowlist and CORS default', async () => {
    const badHost = await httpRequest(`${base}/api/health`, {
      headers: { Host: 'evil.example:8915' },
    });
    assert(badHost.status === 403, `Expected 403, got ${badHost.status}`);

    const withOrigin = await httpRequest(`${base}/api/health`, {
      headers: { Origin: `http://127.0.0.1:${serverPort}` },
    });
    assert(withOrigin.status === 200, `Expected 200, got ${withOrigin.status}`);
    const acao = String(withOrigin.headers['access-control-allow-origin'] ?? '');
    assert(acao !== '*', 'CORS must not be *');
    assert(acao === `http://127.0.0.1:${serverPort}`, `ACAOrigin ${acao}`);
    const vary = String(withOrigin.headers.vary ?? '');
    assert(vary.toLowerCase().includes('origin'), `Vary should include Origin, got ${vary}`);

    const foreign = await httpRequest(`${base}/api/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert(foreign.status === 403, `Expected 403, got ${foreign.status}`);
  });

  await test('C2: sync content-type, Origin, and method', async () => {
    const frame: RequestFrame = { t: 'req', id: 1, ns: 'native', method: 'PrivateKey_Generate', args: [] };
    const body = Buffer.from(msgpackEncode(frame));
    const plain = await httpPost(`${base}/api/bridge/sync`, body, 'text/plain');
    assert(plain.status === 415, `Expected 415, got ${plain.status}`);

    const csrf = await httpPost(`${base}/api/bridge/sync`, body, 'application/x-msgpack', {
      Origin: 'https://evil.example',
    });
    assert(csrf.status === 403, `Expected 403, got ${csrf.status}`);

    const get = await httpRequest(`${base}/api/bridge/sync`, { method: 'GET' });
    assert(get.status === 405, `Expected 405, got ${get.status}`);
  });

  await test('C3: fs denies config.json and db/; allows attachment dirs', async () => {
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();
    for (const target of [join(tmpDir, 'config.json'), join(tmpDir, 'db', 'sql', 'db.sqlite')]) {
      let threw = false;
      try {
        await ws.call('fs', 'readFile', [target]);
      } catch (error) {
        threw = true;
        const msg = String((error as Error).message);
        assert(!msg.includes(resolvePath(tmpDir, 'db')), `must not echo resolved path: ${msg}`);
        assert(
          msg.includes('not allowed') || (error as Error).name.includes('Forbidden'),
          `unexpected: ${msg}`
        );
      }
      assert(threw, `expected deny for ${target}`);
    }
    const att = join(tmpDir, 'attachments.noindex', 'smoke.bin');
    await ws.call('fs', 'writeFile', [att, new Uint8Array([1, 2, 3])]);
    const got = await ws.call('fs', 'readFile', [att]);
    assert(got instanceof Uint8Array && (got as Uint8Array).length === 3, 'attachment write/read');
    ws.close();
  });

  await test('H2: proxyUrl strips userinfo', async () => {
    const stripped = stripProxyUserinfo('http://user:s3cret@proxy.internal:3128');
    assert(!stripped.includes('user'), stripped);
    assert(!stripped.includes('s3cret'), stripped);
    assert(stripped.includes('proxy.internal'), stripped);
  });

  await test('H3: Nest Origin gate, timeout, OPTIONS not forwarded', async () => {
    assert(nestAllowsMethod('OPTIONS') === false, 'OPTIONS must not be a Nest upstream method');
    assert(nestAllowsMethod('GET') === true, 'GET is allowed');

    let upstreamHits = 0;
    const dummy = http.createServer((_req, res) => {
      upstreamHits += 1;
      // hang
      void res;
    });
    await new Promise<void>(resolve => dummy.listen(0, '127.0.0.1', resolve));
    const dummyPort = (dummy.address() as { port: number }).port;
    process.env.SIGNAL_NEST_API_BASE = `http://127.0.0.1:${dummyPort}`;
    process.env.SIGNAL_NEST_TIMEOUT_MS = '400';
    try {
      const forbidden = await httpRequest(`${base}/api/nest/messages/stream`, {
        headers: { Origin: 'https://evil.example' },
      });
      assert(forbidden.status === 403, `Expected 403, got ${forbidden.status}`);
      assert(upstreamHits === 0, 'foreign Origin must not open upstream');

      const hung = await httpRequest(`${base}/api/nest/messages/stream`);
      assert(hung.status === 504, `Expected 504, got ${hung.status}`);
      assert(upstreamHits >= 1, 'timeout path should have opened upstream');
    } finally {
      dummy.close();
      delete process.env.SIGNAL_NEST_API_BASE;
      delete process.env.SIGNAL_NEST_TIMEOUT_MS;
    }
  });

  await test('H4: resolveNestApiBase ignores ?apiBase= and storage is sanitized', async () => {
    const prev = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      location: { search: '?apiBase=https://evil.example' },
    };
    try {
      const basePath = resolveNestApiBase({
        enabled: true,
        apiBase: 'http://127.0.0.1:3010',
        proxyPath: '/api/nest',
        clientBase: '/api/nest',
      });
      assert(basePath === '/api/nest', basePath);
      assert(!basePath.includes('evil'), basePath);
    } finally {
      (globalThis as { window?: unknown }).window = prev;
    }
    let threw = false;
    try {
      resolveNestApiBase({ enabled: false, apiBase: '', proxyPath: '/api/nest', clientBase: '' });
    } catch {
      threw = true;
    }
    assert(threw, 'disabled nest without base should throw');
    const stored = sanitizeLinkedSessionForStorage({
      credentials: {
        username: 'u',
        password: 'p-secret',
        deviceId: 1,
        aci: 'aci',
        pni: 'pni',
        number: '+100',
      },
      storageServiceKey: 'ssk-secret',
      linkedPayload: { password: 'p-secret' },
      syncedContacts: [],
      deviceName: 'web',
      registrationIds: { aci: 1, pni: 2 },
      linkedAt: 't',
    });
    const raw = JSON.stringify(stored);
    assert(!raw.includes('p-secret'), raw);
    assert(!raw.includes('ssk-secret'), raw);
  });

  await test('H5: instance lock, key format, encryptedKey', async () => {
    const lockPath = getLockFilePath(tmpDir);
    assert(existsSync(lockPath), 'lock file should exist while server runs');
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `const fs=require('fs');try{fs.openSync(${JSON.stringify(lockPath)},'wx');process.exit(2)}catch(e){if(e.code==='EEXIST'){const p=fs.readFileSync(${JSON.stringify(lockPath)},'utf8');console.log('lock '+${JSON.stringify(lockPath)}+' pid '+p);process.exit(1)}throw e}`,
      ],
      { encoding: 'utf-8' }
    );
    assert(child.status === 1, `second lock should fail, got ${child.status} ${child.stderr}`);
    assert(child.stdout.includes(lockPath), child.stdout);
    assert(child.stdout.includes(String(process.pid)), child.stdout);

    const badDir = mkdtempSync(join(os.tmpdir(), 'signal-web-key-'));
    writeFileSync(join(badDir, 'config.json'), JSON.stringify({ key: 'tooshort' }));
    let bad = false;
    try {
      loadOrCreateSqlKey(badDir);
    } catch (error) {
      bad = true;
      assert(String((error as Error).message).includes('64 hex'), String((error as Error).message));
      assert(String((error as Error).message).includes('config.json'), String((error as Error).message));
    }
    assert(bad, 'short key must fail');
    writeFileSync(join(badDir, 'config.json'), JSON.stringify({ encryptedKey: 'abc' }));
    let enc = false;
    try {
      readSqlKeyFromConfig(join(badDir, 'config.json'));
    } catch (error) {
      enc = true;
      assert(String((error as Error).message).includes('encryptedKey'), String((error as Error).message));
    }
    assert(enc, 'encryptedKey must be a distinct error');
    rmSync(badDir, { recursive: true, force: true });
  });

  await test('M1/L9: attachment content-type and suffix ranges', async () => {
    const file = join(tmpDir, 'attachments.noindex', 'range.bin');
    writeFileSync(file, Buffer.from('abcdefghijklmnopqrstuvwxyz'));
    const html = await httpGet(
      `${base}/api/attachment/v1/range.bin?contentType=${encodeURIComponent('text/html')}`
    );
    assert(html.status === 200, `Expected 200, got ${html.status}`);
    assert(String(html.headers['content-type']).includes('application/octet-stream'), 'html coerced');
    assert(String(html.headers['content-disposition'] ?? '').includes('attachment'), 'disposition');
    assert(String(html.headers['x-content-type-options']).includes('nosniff'), 'nosniff');
    assert(String(html.headers['content-security-policy'] ?? '').includes('sandbox'), 'csp');

    const png = await httpGet(`${base}/api/attachment/v1/range.bin?contentType=image/png`);
    assert(String(png.headers['content-type']).includes('image/png'), 'png passthrough');

    const suffix = await httpRequest(
      `${base}/api/attachment/v1/range.bin?contentType=application/octet-stream`,
      { headers: { Range: 'bytes=-3' } }
    );
    assert(suffix.status === 206, `Expected 206, got ${suffix.status}`);
    assert(suffix.body.toString() === 'xyz', suffix.body.toString());

    const unsat = await httpRequest(
      `${base}/api/attachment/v1/range.bin?contentType=application/octet-stream`,
      { headers: { Range: 'bytes=100-200' } }
    );
    assert(unsat.status === 416, `Expected 416, got ${unsat.status}`);

    const parsed = parseRange('bytes=-4', 10);
    assert(parsed != null && parsed !== 'unsatisfiable' && parsed.start === 6 && parsed.end === 9, JSON.stringify(parsed));
    const coerced = safeContentType('text/html');
    assert(
      coerced.contentType === 'application/octet-stream' && coerced.attachmentDisposition,
      JSON.stringify(coerced)
    );
  });

  await test('M2: fs readFile cap; openRead still works', async () => {
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();
    const big = join(tmpDir, 'temp', 'big.bin');
    const oversized = Buffer.alloc(getFsReadFileMaxBytes() + 8, 7);
    await ws.call('fs', 'writeFile', [big, oversized]);
    let threw = false;
    try {
      await ws.call('fs', 'readFile', [big]);
    } catch (error) {
      threw = true;
      assert(String((error as Error).message).includes('cap'), String((error as Error).message));
    }
    assert(threw, 'readFile over cap must fail');
    const opened = (await ws.call('fs', 'openRead', [big])) as { handle: number; size: number };
    assert(opened.size === oversized.length, 'openRead size');
    const chunk = (await ws.call('fs', 'read', [opened.handle])) as { chunk: Uint8Array | null };
    assert(chunk.chunk instanceof Uint8Array && chunk.chunk.length > 0, 'streamed chunk');
    await ws.call('fs', 'closeRead', [opened.handle]);
    ws.close();
  });

  await test('M5/M7/M10/M11/M12/L1/L3: remaining small cases', async () => {
    let envThrew = false;
    try {
      assertSignalEnvConfigExists('nope');
    } catch (error) {
      envThrew = true;
      const msg = String((error as Error).message);
      assert(msg.includes('config/nope.json'), msg);
      assert(msg.includes('production'), msg);
    }
    assert(envThrew, 'unknown SIGNAL_ENV must fail');

    const evilLink = join(tmpDir, 'temp', 'evil');
    symlinkSync(os.tmpdir(), evilLink);
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();
    let linkDenied = false;
    try {
      await ws.call('fs', 'writeFile', [join(evilLink, 'pwn'), new Uint8Array([1])]);
    } catch {
      linkDenied = true;
    }
    assert(linkDenied, 'symlink escape on create must fail');
    assert(
      isFsInside(join(evilLink, 'pwn'), tmpDir, true) === false,
      'isFsInside must reject nonexistent child under symlinked parent'
    );
    const nested = join(tmpDir, 'temp', 'a', 'b', 'ok.txt');
    await ws.call('fs', 'writeFile', [nested, new Uint8Array([9])]);
    await ws.call('ipc', 'settings:set:themeSetting', ['dark']);
    if (process.platform !== 'win32') {
      const dataMode = statSync(tmpDir).mode & 0o777;
      assert(dataMode === 0o700, `data dir mode ${dataMode.toString(8)}`);
      const attMode = statSync(join(tmpDir, 'attachments.noindex')).mode & 0o777;
      assert(attMode === 0o700, `attachment dir mode ${attMode.toString(8)}`);
      const setMode = statSync(join(tmpDir, 'settings.json')).mode & 0o777;
      assert(setMode === 0o600, `settings.json mode ${setMode.toString(8)}`);
    }
    ws.close();

    const spaced = await httpGet(`${base}/stylesheets/my%20file.css`);
    assert(spaced.status === 200, `Expected 200 for percent-decoded css, got ${spaced.status}`);
    assert(spaced.body.toString().includes('color:red'), spaced.body.toString());
    const again = await httpRequest(`${base}/stylesheets/my%20file.css`, {
      headers: { 'If-None-Match': String(spaced.headers.etag ?? '') },
    });
    assert(again.status === 304, `Expected 304, got ${again.status}`);
    const trav = await httpGet(`${base}/stylesheets/foo%00.css`);
    assert(trav.status === 403, `Expected 403 for NUL segment, got ${trav.status}`);
    const wasm = await httpGet(`${base}/stylesheets/app.wasm`);
    assert(String(wasm.headers['content-type']).includes('application/wasm'), String(wasm.headers['content-type']));
    const map = await httpGet(`${base}/stylesheets/app.js.map`);
    assert(String(map.headers['content-type']).includes('application/json'), String(map.headers['content-type']));

    assert(isProxyRequestHeaderAllowed('authorization') === false, 'auth not proxied');
    assert(isProxyRequestHeaderAllowed('content-type') === true, 'content-type allowed');

    const ws2 = new WsSession(`${wsBase}/api/bridge`);
    await ws2.connect();
    let unknownNative = false;
    try {
      await ws2.call('native', 'DefinitelyNotANativeFunction_XYZ', []);
    } catch (error) {
      unknownNative = true;
      assert(String((error as Error).message).includes('Unknown native function'), String((error as Error).message));
    }
    assert(unknownNative, 'L1 unknown native');
    const ctor = await getOptionalResource('constructor');
    assert(ctor === undefined, 'constructor must not fetch');
    ws2.close();
  });

  await test('H1: sql-channel:remove-db deletes files and marks health not-ready', async () => {
    const ws = new WsSession(`${wsBase}/api/bridge`);
    await ws.connect();
    await ws.call('ipc', 'sql-channel:remove-db', []);
    const db = join(tmpDir, 'db', 'sql', 'db.sqlite');
    assert(!existsSync(db), 'db.sqlite must be gone');
    assert(!existsSync(`${db}-shm`), 'shm must be gone');
    assert(!existsSync(`${db}-wal`), 'wal must be gone');
    assert(!existsSync(join(tmpDir, 'config.json')), 'key file must be gone');
    let sqlFailed = false;
    try {
      await ws.call('sql-read', 'getItemById', ['smoke-test-key']);
    } catch (error) {
      sqlFailed = true;
      assert(
        String((error as Error).message).includes('restart required'),
        String((error as Error).message)
      );
    }
    assert(sqlFailed, 'sql-read after remove-db must fail');
    ws.close();
    const health = await httpGet(`${base}/api/health`);
    assert(health.status === 503, `Expected 503, got ${health.status}`);
    const body = JSON.parse(health.body.toString('utf-8')) as { ready: boolean; sql: string };
    assert(body.ready === false, 'health.ready false');
    assert(String(body.sql).includes('restart'), String(body.sql));
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
  releaseDataDirLock();
  if (existsSync(getLockFilePath(tmpDir))) {
    console.error('  FAIL: lock file left behind');
    failed++;
  }
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  try { rmSync(staticRoot, { recursive: true, force: true }); } catch { /* ok */ }
  process.exit(failed > 0 ? 1 : 0);
});
