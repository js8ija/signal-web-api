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

import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import WebSocket from 'ws';

// Import server bootstrap
// We set env before importing
const tmpDir = mkdtempSync(join(os.tmpdir(), 'signal-web-smoke-'));
process.env.SIGNAL_DATA_DIR = tmpDir;
process.env.SIGNAL_WEB_DATA = tmpDir; // legacy alias
process.env.PORT = '0'; // random port
process.env.SIGNAL_ENV = 'production';
process.env.SIGNAL_ASSETS_ROOT = process.env.SIGNAL_ASSETS_ROOT ?? process.cwd();
process.env.SIGNAL_LISTEN_HOST = '127.0.0.1';
delete process.env.SIGNAL_NEST_API_BASE;
delete process.env.NEST_API_BASE;
delete process.env.SIGNAL_PROXY_URL;
delete process.env.SIGNAL_NO_PROXY;
// Set BEFORE startServer() — boot payload is cached on first getBootPayload().
// HTTPS_PROXY must not leak into /api/boot (and is otherwise unconsumed).
process.env.HTTPS_PROXY = 'http://user:s3cret@h:3128';
process.env.https_proxy = 'http://user:s3cret@h:3128';

// Dynamically import server after setting env
import type { Server as HttpServer } from 'node:http';
import { rendererConfigSchema } from '../../vendor/ts/types/RendererConfig.std.ts';
import type { RequestFrame, ResponseFrame, ReleaseFrame, WireHandle } from '../bridge/protocol.std.ts';
import { isWireHandle } from '../bridge/protocol.std.ts';
import { closeSQL } from './sql.node.ts';
import { invokeNative } from './native.node.ts';
import { isAllowedProxyUrl, isAllowedProxyHost } from './proxy.node.ts';
import { resolveNestUpstreamUrl, nestApiBaseFromEnv } from './nest-proxy.node.ts';
import { isFsInside, getDataDir, getProxyConfig, redactProxyText, redactProxyUrl } from './paths.node.ts';
import { signalFetch } from './signalFetch.node.ts';

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
  const base = `http://127.0.0.1:${serverPort}`;
  const wsBase = `ws://127.0.0.1:${serverPort}`;

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

  await test('GET /api/health returns ok', async () => {
    const res = await httpGet(`${base}/api/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = JSON.parse(res.body.toString('utf-8')) as {
      ok: boolean;
      proxy?: { enabled: boolean };
    };
    assert(body.ok === true, 'health.ok should be true');
    assert(body.proxy?.enabled === false, 'health.proxy.enabled should be false without SIGNAL_PROXY_URL');
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

  const connectTargets: Array<string> = [];
  const proxyServer = http.createServer();
  proxyServer.on('connect', (req, clientSocket, head) => {
    const target = req.url ?? '';
    connectTargets.push(target);
    const sep = target.lastIndexOf(':');
    const host = target.slice(0, sep);
    const port = Number(target.slice(sep + 1));
    const dest = net.connect(port, host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) dest.write(head);
      dest.pipe(clientSocket);
      clientSocket.pipe(dest);
    });
    dest.on('error', () => {
      try {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      } catch {
        /* ok */
      }
      clientSocket.destroy();
    });
    clientSocket.on('error', () => dest.destroy());
  });
  const proxyPort = await new Promise<number>((resolve, reject) => {
    proxyServer.once('error', reject);
    proxyServer.listen(0, '127.0.0.1', () => {
      const addr = proxyServer.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
  const prevProxyUrl = process.env.SIGNAL_PROXY_URL;
  process.env.SIGNAL_PROXY_URL = `http://127.0.0.1:${proxyPort}`;

  await test('signalFetch tunnels HTTPS via a fake CONNECT proxy (Signal CA survives)', async () => {
    connectTargets.length = 0;
    let fetchResult: { status: number } | undefined;
    let fetchError: Error | undefined;
    try {
      fetchResult = await signalFetch(new URL('https://cdn.signal.org/'), {
        timeoutMs: 20_000,
      });
    } catch (error) {
      fetchError = error instanceof Error ? error : new Error(String(error));
    }
    assert(
      connectTargets.some(t => t === 'cdn.signal.org:443' || t === 'cdn.signal.org:443.'),
      `proxy did not observe CONNECT cdn.signal.org:443; saw ${JSON.stringify(connectTargets)}`
    );
    if (fetchResult) {
      assert(
        typeof fetchResult.status === 'number' && fetchResult.status > 0,
        `expected HTTP status through tunnel, got ${fetchResult.status}`
      );
    } else {
      console.log(
        '       (cdn.signal.org egress failed after CONNECT; TLS status not asserted:',
        fetchError?.message,
        ')'
      );
    }
  });

  await test('signalFetch bypasses the proxy for loopback targets', async () => {
    connectTargets.length = 0;
    try {
      await signalFetch(new URL('https://127.0.0.1/'), { timeoutMs: 2_000 });
    } catch {
      // Direct loopback TLS is expected to fail; the proxy must see nothing.
    }
    assert(
      connectTargets.length === 0,
      `loopback must bypass proxy; CONNECTs: ${JSON.stringify(connectTargets)}`
    );
  });

  if (prevProxyUrl === undefined) {
    delete process.env.SIGNAL_PROXY_URL;
  } else {
    process.env.SIGNAL_PROXY_URL = prevProxyUrl;
  }
  await new Promise<void>(resolve => proxyServer.close(() => resolve()));

  await test('getProxyConfig accepts socks5', async () => {
    const prev = process.env.SIGNAL_PROXY_URL;
    try {
      process.env.SIGNAL_PROXY_URL = 'socks5://p:1080';
      const socks = getProxyConfig();
      assert(socks.mode === 'on', `socks5://p:1080 should be on, got ${JSON.stringify(socks)}`);
      assert(socks.mode === 'on' && socks.spec.port === 1080, 'socks5 default port');
    } finally {
      if (prev === undefined) {
        delete process.env.SIGNAL_PROXY_URL;
      } else {
        process.env.SIGNAL_PROXY_URL = prev;
      }
    }
  });

  await test('getProxyConfig is invalid for socks6, port 0, path, hash, org.signal.tls, garbage', async () => {
    const prev = process.env.SIGNAL_PROXY_URL;
    const cases = [
      'socks6://p:1080',
      'http://p:0',
      'http://p/path',
      'socks5://p:1080#comment',
      'org.signal.tls://u:p@h:443',
      'not a url !!',
    ];
    try {
      for (const raw of cases) {
        process.env.SIGNAL_PROXY_URL = raw;
        const cfg = getProxyConfig();
        assert(cfg.mode === 'invalid', `${raw} should be invalid, got ${JSON.stringify(cfg)}`);
      }
    } finally {
      if (prev === undefined) {
        delete process.env.SIGNAL_PROXY_URL;
      } else {
        process.env.SIGNAL_PROXY_URL = prev;
      }
    }
  });

  await test('/api/boot omits proxyUrl and does not leak HTTPS_PROXY credentials', async () => {
    const res = await httpGet(`${base}/api/boot`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const payload = JSON.parse(res.body.toString('utf-8')) as {
      sync: { 'get-config': Record<string, unknown> };
    };
    const config = payload.sync['get-config'];
    assert(!('proxyUrl' in config), 'get-config must not contain proxyUrl');
    const serialized = res.body.toString('utf-8');
    // `user` alone appears in unrelated keys (userDataPath); check the credential pair.
    assert(!serialized.includes('user:s3cret'), 'boot payload must not contain HTTPS_PROXY userinfo');
    assert(!serialized.includes('s3cret'), 'boot payload must not contain HTTPS_PROXY password');
  });

  await test('redactProxyUrl strips userinfo', async () => {
    const redacted = redactProxyUrl('http://user:s3cret@h:3128');
    assert(!redacted.includes('user'), `redacted still contains user: ${redacted}`);
    assert(!redacted.includes('s3cret'), `redacted still contains password: ${redacted}`);
  });

  await test('signalFetch errors redact password from message and cause', async () => {
    const closing = http.createServer();
    closing.on('connect', (_req, clientSocket) => {
      clientSocket.destroy();
    });
    const closingPort = await new Promise<number>((resolve, reject) => {
      closing.once('error', reject);
      closing.listen(0, '127.0.0.1', () => {
        const addr = closing.address();
        resolve(typeof addr === 'object' && addr ? addr.port : 0);
      });
    });
    const prev = process.env.SIGNAL_PROXY_URL;
    process.env.SIGNAL_PROXY_URL = `http://myuser:sup3rs3cret@127.0.0.1:${closingPort}`;
    try {
      let err: Error | undefined;
      try {
        await signalFetch(new URL('https://cdn.signal.org/'), { timeoutMs: 5_000 });
      } catch (error) {
        err = error instanceof Error ? error : new Error(String(error));
      }
      assert(err != null, 'expected proxied signalFetch to fail when CONNECT closes');
      assert(
        !err.message.includes('sup3rs3cret'),
        `err.message leaked password: ${err.message}`
      );
      const causeMessage = (err.cause as Error | undefined)?.message;
      assert(
        causeMessage == null || !causeMessage.includes('sup3rs3cret'),
        `err.cause.message leaked password: ${causeMessage}`
      );
    } finally {
      if (prev === undefined) {
        delete process.env.SIGNAL_PROXY_URL;
      } else {
        process.env.SIGNAL_PROXY_URL = prev;
      }
      await new Promise<void>(resolve => closing.close(() => resolve()));
    }
  });

  await test('redactProxyText does not over-replace a one-character username', async () => {
    const prev = process.env.SIGNAL_PROXY_URL;
    process.env.SIGNAL_PROXY_URL = 'http://s:sup3rs3cret@h:3128';
    try {
      const unrelated = 'socket hang up connecting to host';
      const redacted = redactProxyText(unrelated);
      assert(
        redacted === unrelated,
        `one-char username mangled unrelated text: ${redacted}`
      );
      const withSecret = redactProxyText('socket failed: sup3rs3cret');
      assert(!withSecret.includes('sup3rs3cret'), `password survived: ${withSecret}`);
      assert(withSecret.includes('socket'), `unrelated word dropped: ${withSecret}`);
    } finally {
      if (prev === undefined) {
        delete process.env.SIGNAL_PROXY_URL;
      } else {
        process.env.SIGNAL_PROXY_URL = prev;
      }
    }
  });

  // TESTING_ConnectionManager_isUsingProxy returns a number. Observed
  // empirically against libsignal 0.94.1 (do not invert these):
  //   0  = no proxy / after clear_proxy
  //   1  = proxy applied (ConnectionManager_set_proxy)
  //  -1  = invalid proxy (ConnectionManager_set_invalid_proxy)
  await test('libsignal ConnectionManager_new applies SIGNAL_PROXY_URL server-side', async () => {
    const prev = process.env.SIGNAL_PROXY_URL;
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    const call = (method: string, args: unknown[]): Promise<unknown> =>
      invokeNative(method, args, null, pending, null);
    try {
      delete process.env.SIGNAL_PROXY_URL;
      const mapOff = await call('BridgedStringMap_new', [0]);
      const cmOff = await call('ConnectionManager_new', [1, 'signal-web-smoke', mapOff, 0]);
      const off = await call('TESTING_ConnectionManager_isUsingProxy', [cmOff]);
      assert(off === 0, `no-proxy isUsingProxy should be 0, got ${String(off)}`);

      process.env.SIGNAL_PROXY_URL = 'http://127.0.0.1:3128';
      const mapOn = await call('BridgedStringMap_new', [0]);
      const cmOn = await call('ConnectionManager_new', [1, 'signal-web-smoke', mapOn, 0]);
      const on = await call('TESTING_ConnectionManager_isUsingProxy', [cmOn]);
      assert(on === 1, `proxy-applied isUsingProxy should be 1, got ${String(on)}`);

      await call('ConnectionManager_set_invalid_proxy', [cmOn]);
      const invalid = await call('TESTING_ConnectionManager_isUsingProxy', [cmOn]);
      assert(invalid === -1, `invalid-proxy isUsingProxy should be -1, got ${String(invalid)}`);
    } finally {
      if (prev === undefined) {
        delete process.env.SIGNAL_PROXY_URL;
      } else {
        process.env.SIGNAL_PROXY_URL = prev;
      }
    }
  });

  await test('bridge-issued ConnectionManager_clear_proxy is refused while enforced', async () => {
    const prev = process.env.SIGNAL_PROXY_URL;
    process.env.SIGNAL_PROXY_URL = 'http://127.0.0.1:3128';
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    try {
      const map = await invokeNative('BridgedStringMap_new', [0], null, pending, null);
      const cm = await invokeNative(
        'ConnectionManager_new',
        [1, 'signal-web-smoke', map, 0],
        null,
        pending,
        null
      );
      let threw = false;
      try {
        await invokeNative('ConnectionManager_clear_proxy', [cm], null, pending, null);
      } catch (error) {
        threw = true;
        assert(
          (error as Error).name === 'SignalWebProxyEnforced',
          `expected SignalWebProxyEnforced, got ${(error as Error).name}: ${(error as Error).message}`
        );
      }
      assert(threw, 'expected ConnectionManager_clear_proxy to be refused');
    } finally {
      if (prev === undefined) {
        delete process.env.SIGNAL_PROXY_URL;
      } else {
        process.env.SIGNAL_PROXY_URL = prev;
      }
    }
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
