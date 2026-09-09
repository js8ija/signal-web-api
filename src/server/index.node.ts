// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Signal Web bridge server entry point.
 *
 * ENV:
 *   PORT                  HTTP port (default 8915)
 *   SIGNAL_LISTEN_HOST    Bind address (default 127.0.0.1)
 *   SIGNAL_DATA_DIR       Data directory (default ~/.signal-web)
 *                         Alias: SIGNAL_WEB_DATA (legacy)
 *   SIGNAL_ASSETS_ROOT    Assets root for config/build/bundles/_locales/assets
 *                         (default: process.cwd())
 *   STATIC_ROOT           Optional Desktop UI static root; if unset, UI static
 *                         bundles are not mounted (API-only).
 *   SIGNAL_ENV            production | staging | development (default production)
 *   SIGNAL_WEB_LOCALE     Default locale hint (default 'en')
 *   SIGNAL_CORS_ORIGIN    Extra CORS origins (default: loopback, never *)
 *   SIGNAL_API_AUTH       Token auth (default on). Set `off` to disable.
 *   SIGNAL_API_TOKEN      Optional 64-hex token instead of a random mint
 *   SIGNAL_ALLOWED_HOSTS  Extra Host allowlist entries
 *   SIGNAL_NEST_API_BASE  LeanScrm Nest base (e.g. http://127.0.0.1:3010);
 *                         enables /api/nest reverse proxy + /api/nest-config
 *   SIGNAL_ACCESS_LOG     Set `1` for one structured line per HTTP/WS session
 */

import http from 'node:http';
import { createReadStream, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import { stat as statAsync } from 'node:fs/promises';

import type {
  RequestFrame,
  ResponseFrame,
  CallbackResponseFrame,
  ReleaseFrame,
  BridgeFrame,
} from '../bridge/protocol.std.ts';
import { toWireError } from '../bridge/protocol.std.ts';
import { buildBootPayload } from './boot.node.ts';
import { initializeSQL, sqlCall, closeSQL, getSqlHealth, removeSQL } from './sql.node.ts';
import {
  invokeNative,
  releaseHandles,
  handleCallbackResponse,
  initNative,
  isNativeReady,
  setNativeManifestAllowlist,
} from './native.node.ts';
import { initIpc, handleIpcInvoke, warnSendOnce, setRemoveDbFn } from './ipc.node.ts';
import { initFs, handleFsCall, wipeUserMedia, warnIfDataDirPermissive } from './fs.node.ts';
import { initAttachments, handleAttachmentRequest } from './attachments.node.ts';
import { initOptionalResources } from './optionalResources.node.ts';
import { handleProxyRequest } from './proxy.node.ts';
import { handleNestProxy, nestApiBaseFromEnv } from './nest-proxy.node.ts';
import { registerSession, sendInitialPushes } from './push.node.ts';
import type { CallbackRequestFrame } from '../bridge/protocol.std.ts';
import {
  getPort,
  getListenHost,
  getDataDir,
  getAssetsRoot,
  getStaticRoot,
  getSignalEnv,
  getLocaleHint,
  getEffectivePort,
  setBoundPort,
  nativeManifestPath,
  nativeManifestFallbackPath,
  isFsInside,
} from './paths.node.ts';
import {
  applyCors,
  readBody,
  sendPayloadTooLarge,
  MAX_BODY_NATIVE_SYNC,
  MAX_BODY_PROXY,
} from './http-util.node.ts';
import {
  evaluateHttpApiAccess,
  evaluateWsUpgrade,
  getAllowedOrigins,
  isApiAuthEnabled,
  mintApiToken,
  selectWsProtocol,
  sendAccessDenied,
  warnIfExposedWithoutAuth,
} from './access-control.node.ts';
import { acquireDataDirLock, releaseDataDirLock } from './instance-lock.node.ts';
import { getBuildExpiration } from './boot.node.ts';

// ---- configuration -----------------------------------------------------------

// Identifies this server process; the native handle registry is reset on
// restart, so the browser reloads when it sees a new id (see protocol).
const SERVER_SESSION_ID = randomUUID();
let _pkgVersion: string | undefined;
function getPkgVersion(): string {
  if (_pkgVersion != null) {
    return _pkgVersion;
  }
  try {
    _pkgVersion = (JSON.parse(readFileSync(join(getAssetsRoot(), 'package.json'), 'utf-8')) as { version: string }).version;
  } catch {
    _pkgVersion = '0.0.0';
  }
  return _pkgVersion;
}

const MAX_WS_CONNECTIONS = (() => {
  const n = parseInt(process.env.SIGNAL_WS_MAX_CONNECTIONS ?? '32', 10);
  return Number.isFinite(n) && n > 0 ? n : 32;
})();
const MAX_WS_INFLIGHT = (() => {
  const n = parseInt(process.env.SIGNAL_WS_MAX_INFLIGHT ?? '64', 10);
  return Number.isFinite(n) && n > 0 ? n : 64;
})();
const WS_PING_MS = (() => {
  const n = parseInt(process.env.SIGNAL_WS_PING_MS ?? '30000', 10);
  return Number.isFinite(n) && n >= 1000 ? n : 30_000;
})();

function accessLogEnabled(): boolean {
  const raw = process.env.SIGNAL_ACCESS_LOG?.trim();
  return raw === '1' || raw === 'true';
}

function logAccess(rec: Record<string, unknown>): void {
  if (!accessLogEnabled()) {
    return;
  }
  console.log(JSON.stringify({ ns: 'access', t: Date.now(), ...rec }));
}

// The bridge must survive stray failures from native callbacks, dropped
// futures and background tasks — log loudly, never exit.
process.on('unhandledRejection', reason => {
  console.error('[server] unhandled rejection (continuing):', reason);
});

// ---- MIME types --------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

function getMime(filepath: string): string {
  return MIME[extname(filepath).toLowerCase()] ?? 'application/octet-stream';
}

// ---- static file serving ----------------------------------------------------

// Map of URL prefix → filesystem root.
// Desktop UI static mounts are only enabled when STATIC_ROOT is set.
function getStaticMounts(): Array<{ prefix: string; root: string }> {
  const staticRoot = getStaticRoot();
  if (!staticRoot) {
    return [];
  }
  return [
    { prefix: '/bundles-web', root: join(staticRoot, 'bundles-web') },
    { prefix: '/bundles', root: join(staticRoot, 'bundles') },
    { prefix: '/stylesheets', root: join(staticRoot, 'stylesheets') },
    { prefix: '/fonts', root: join(staticRoot, 'fonts') },
    { prefix: '/images', root: join(staticRoot, 'images') },
    { prefix: '/sounds', root: join(staticRoot, 'sounds') },
    { prefix: '/build', root: join(staticRoot, 'build') },
    {
      prefix: '/node_modules/intl-tel-input/build/img',
      root: join(staticRoot, 'node_modules', 'intl-tel-input', 'build', 'img'),
    },
    { prefix: '/', root: join(staticRoot, 'web', 'static') },
  ];
}

function decodeStaticRelPath(relPath: string): string | 'forbidden' {
  const raw = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  let segments: string[];
  try {
    segments = raw
      .split('/')
      .filter(seg => seg.length > 0)
      .map(seg => decodeURIComponent(seg));
  } catch {
    return 'forbidden';
  }
  if (segments.some(seg => seg === '.' || seg === '..' || seg.includes('\0'))) {
    return 'forbidden';
  }
  return segments.join('/') || 'index.html';
}

function staticEtag(st: { size: number; mtimeMs: number }): string {
  return `"${st.size.toString(16)}-${Math.trunc(st.mtimeMs).toString(16)}"`;
}

async function serveStaticFile(
  urlPath: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  for (const mount of getStaticMounts()) {
    const isRootMount = mount.prefix === '/';
    if (
      isRootMount ||
      urlPath === mount.prefix ||
      urlPath.startsWith(mount.prefix + '/')
    ) {
      const relPath = isRootMount
        ? urlPath === '/'
          ? '/index.html'
          : urlPath
        : urlPath.slice(mount.prefix.length) || '/index.html';
      const decoded = decodeStaticRelPath(relPath);
      if (decoded === 'forbidden') {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return true;
      }
      const candidate = resolve(mount.root, decoded);
      const mountRoot = resolve(mount.root);
      if (!isFsInside(candidate, mountRoot, true) && candidate !== mountRoot) {
        continue;
      }
      let st;
      try {
        st = await statAsync(candidate);
      } catch {
        continue;
      }
      if (!st.isFile()) {
        continue;
      }
      const contentType = getMime(candidate);
      const etag = staticEtag(st);
      const isAppCode =
        urlPath.startsWith('/bundles-web/') ||
        urlPath === '/' ||
        urlPath.endsWith('.html') ||
        urlPath === '/sw.js' ||
        extname(candidate).toLowerCase() === '.css';
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': isAppCode ? 'no-cache' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        ETag: etag,
        'Last-Modified': st.mtime.toUTCString(),
      };
      const inm = req.headers['if-none-match'];
      if (inm === etag) {
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      if (extname(candidate).toLowerCase() === '.css') {
        // CSS asset:// rewrite needs the full text; stylesheets stay small.
        let content = readFileSync(candidate);
        content = Buffer.from(content.toString('utf-8').replaceAll('asset:///', '/'), 'utf-8');
        headers['Content-Length'] = String(content.length);
        res.writeHead(200, headers);
        res.end(content);
        return true;
      }
      headers['Content-Length'] = String(st.size);
      res.writeHead(200, headers);
      createReadStream(candidate).pipe(res);
      return true;
    }
  }
  return false;
}

// ---- boot payload (cached) --------------------------------------------------

let _bootPayload: ReturnType<typeof buildBootPayload> | null = null;
let _nativeManifest: Record<string, 'sync' | 'async'> = {};

function getBootPayload(): ReturnType<typeof buildBootPayload> & {
  serverSessionId: string;
} {
  if (_bootPayload == null) {
    _bootPayload = buildBootPayload({
      env: getSignalEnv(),
      dataDir: getDataDir(),
      localeHint: getLocaleHint(),
      nativeManifest: _nativeManifest,
    });
  }
  return { ...(_bootPayload as object), serverSessionId: SERVER_SESSION_ID } as ReturnType<
    typeof buildBootPayload
  > & { serverSessionId: string };
}

// ---- WebSocket session -------------------------------------------------------

type SessionState = {
  ws: WebSocket;
  pendingCallbacks: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  inflight: number;
};

function sendFrame(session: SessionState, frame: object): void {
  if (session.ws.readyState === 1 /* OPEN */) {
    session.ws.send(msgpackEncode(frame, { ignoreUndefined: true, useBigInt64: true }));
  }
}

function sendResponse(
  session: SessionState,
  id: number,
  ok: boolean,
  value?: unknown,
  error?: ReturnType<typeof toWireError>
): void {
  const frame: ResponseFrame = { t: 'res', id, ok, value, error };
  sendFrame(session, frame);
}

async function handleRequest(
  session: SessionState,
  frame: RequestFrame
): Promise<void> {
  const { id, ns, method, args } = frame;
  try {
    let result: unknown;
    if (ns === 'sql-read' || ns === 'sql-write') {
      result = await sqlCall(ns === 'sql-read' ? 'read' : 'write', method, args as unknown[]);
    } else if (ns === 'ipc') {
      result = await handleIpcInvoke(method, args);
    } else if (ns === 'native') {
      result = await invokeNative(
        method,
        args,
        session.ws,
        session.pendingCallbacks,
        (cbReqFrame: CallbackRequestFrame) => sendFrame(session, cbReqFrame)
      );
    } else if (ns === 'fs') {
      result = await handleFsCall(method, args);
    } else if (ns === 'ipc-send') {
      // fire-and-forget — no response needed
      warnSendOnce(method);
      return;
    } else {
      throw new Error(`Unknown namespace: ${ns}`);
    }
    sendResponse(session, id, true, result);
  } catch (err) {
    sendResponse(session, id, false, undefined, toWireError(err));
  }
}

function handleMessage(session: SessionState, data: Buffer | ArrayBuffer | Buffer[]): void {
  let buf: Buffer;
  if (Buffer.isBuffer(data)) {
    buf = data;
  } else if (data instanceof ArrayBuffer) {
    buf = Buffer.from(data);
  } else {
    buf = Buffer.concat(data as Buffer[]);
  }

  let frame: BridgeFrame;
  try {
    frame = msgpackDecode(buf, { useBigInt64: true }) as BridgeFrame;
  } catch (err) {
    console.error('[ws] Failed to decode frame:', err);
    return;
  }

  if (frame.t === 'req') {
    if (session.inflight >= MAX_WS_INFLIGHT) {
      sendResponse(
        session,
        frame.id,
        false,
        undefined,
        toWireError(
          Object.assign(new Error(`too many in-flight requests (max ${MAX_WS_INFLIGHT})`), {
            name: 'SignalWebTooManyRequests',
          })
        )
      );
      return;
    }
    session.inflight += 1;
    void handleRequest(session, frame).finally(() => {
      session.inflight -= 1;
    });
  } else if (frame.t === 'cbres') {
    handleCallbackResponse(frame as CallbackResponseFrame, session.pendingCallbacks);
  } else if (frame.t === 'release') {
    releaseHandles((frame as ReleaseFrame).handles);
  } else {
    console.warn('[ws] Unexpected frame type:', (frame as { t: string }).t);
  }
}

// ---- HTTP handler -----------------------------------------------------------

async function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const started = Date.now();
  const url = new URL(req.url ?? '/', `http://${getListenHost()}:${getEffectivePort()}`);
  const pathname = url.pathname;
  const safePath = pathname.startsWith('/api/attachment/') ? '/api/attachment' : pathname;

  applyCors(req, res);

  const access = evaluateHttpApiAccess(req, pathname);
  if (!access.ok) {
    sendAccessDenied(res, access);
    logAccess({
      kind: 'http',
      method: req.method,
      path: safePath,
      status: access.status,
      ms: Date.now() - started,
      origin: req.headers.origin ?? null,
    });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end();
    logAccess({ kind: 'http', method: 'OPTIONS', path: safePath, status: 204, ms: Date.now() - started });
    return;
  }

  if (req.method === 'GET' && pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    const sql = getSqlHealth();
    const expiration = getBuildExpiration();
    const expired = expiration > 0 && Date.now() > expiration;
    const ready = sql.ready && isNativeReady();
    const body = {
      ok: ready,
      ready,
      sql: sql.ready ? 'ok' : (sql.reason ?? 'not-ready'),
      native: isNativeReady(),
      buildExpiration: expiration || undefined,
      expired,
      version: getPkgVersion(),
      serverSessionId: SERVER_SESSION_ID,
    };
    res.writeHead(ready ? 200 : 503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify(body));
    logAccess({ kind: 'http', method: 'GET', path: pathname, status: ready ? 200 : 503, ms: Date.now() - started });
    return;
  }

  // GET /api/boot
  if (req.method === 'GET' && pathname === '/api/boot') {
    const payload = getBootPayload();
    const accept = req.headers.accept ?? '';
    const headers = { 'Cache-Control': 'no-store' };
    if (accept.includes('msgpack') || accept.includes('application/octet-stream')) {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/msgpack' });
      res.end(Buffer.from(msgpackEncode(payload, { ignoreUndefined: true, useBigInt64: true })));
    } else {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    }
    logAccess({ kind: 'http', method: 'GET', path: pathname, status: 200, ms: Date.now() - started });
    return;
  }

  if (pathname === '/api/bridge/sync' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'POST' });
    res.end('Method Not Allowed');
    return;
  }

  // POST /api/bridge/sync — synchronous native calls
  if (req.method === 'POST' && pathname === '/api/bridge/sync') {
    const ct = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (ct !== 'application/x-msgpack' && ct !== 'application/msgpack') {
      res.writeHead(415, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Unsupported Media Type: expected application/x-msgpack');
      return;
    }
    let body: Buffer;
    try {
      body = await readBody(req, MAX_BODY_NATIVE_SYNC);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 413) {
        sendPayloadTooLarge(res);
        return;
      }
      throw error;
    }
    let reqFrame: RequestFrame;
    try {
      reqFrame = msgpackDecode(body, { useBigInt64: true }) as RequestFrame;
    } catch (err) {
      res.writeHead(400); res.end('Bad Request: invalid msgpack');
      return;
    }
    if (reqFrame.t !== 'req' || reqFrame.ns !== 'native') {
      res.writeHead(400); res.end('Only native namespace allowed on sync path');
      return;
    }
    let result: unknown;
    let ok = true;
    let wireError: ReturnType<typeof toWireError> | undefined;
    try {
      // No WS, no callbacks on sync path
      result = await invokeNative(reqFrame.method, reqFrame.args, null, new Map(), null);
    } catch (err) {
      ok = false;
      wireError = toWireError(err);
    }
    const resFrame: ResponseFrame = { t: 'res', id: reqFrame.id, ok, value: result, error: wireError };
    res.writeHead(200, { 'Content-Type': 'application/msgpack' });
    res.end(Buffer.from(msgpackEncode(resFrame, { ignoreUndefined: true, useBigInt64: true })));
    return;
  }

  // /api/attachment/v{1,2}/… — decrypt + serve attachments over HTTP so the
  // browser can load images/video (no `attachment://` scheme support).
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    pathname.startsWith('/api/attachment/')
  ) {
    if (process.env.SIGNAL_WEB_TRACE != null) {
      res.on('finish', () =>
        console.log(`[attachment] ${req.method} ${pathname} -> ${res.statusCode}`)
      );
    }
    await handleAttachmentRequest(req, res, url);
    return;
  }

  // /api/proxy?url=… — allowlisted forwarder for CORS-blocked Signal hosts
  if (pathname === '/api/proxy') {
    const target = url.searchParams.get('url');
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('proxy: missing url parameter');
      return;
    }
    let body: Buffer;
    try {
      body =
        req.method === 'GET' || req.method === 'HEAD'
          ? Buffer.alloc(0)
          : await readBody(req, MAX_BODY_PROXY);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 413) {
        sendPayloadTooLarge(res);
        return;
      }
      throw error;
    }
    await handleProxyRequest(req, res, target, body);
    return;
  }

  // LeanScrm Nest ChatKnow proxy + config (SIGNAL_NEST_API_BASE)
  if (
    pathname === '/api/nest-config' ||
    pathname === '/api/nest' ||
    pathname.startsWith('/api/nest/')
  ) {
    const handled = await handleNestProxy(req, res, pathname, url.search);
    if (handled) return;
  }

  // Static file serving
  if (req.method === 'GET') {
    if (await serveStaticFile(pathname, req, res)) {
      logAccess({ kind: 'http', method: 'GET', path: safePath, status: res.statusCode ?? 200, ms: Date.now() - started });
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
  logAccess({ kind: 'http', method: req.method, path: safePath, status: 404, ms: Date.now() - started });
}

// ---- server startup ---------------------------------------------------------

let httpServer: http.Server | null = null;
let wsServer: WebSocketServer | null = null;
let wsHeartbeat: NodeJS.Timeout | null = null;

export async function startServer(): Promise<http.Server> {
  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  acquireDataDirLock(dataDir);
  try {
    return await startServerLocked(dataDir);
  } catch (error) {
    releaseDataDirLock();
    throw error;
  }
}

async function startServerLocked(dataDir: string): Promise<http.Server> {
  warnIfDataDirPermissive(dataDir);
  mintApiToken(dataDir);
  warnIfExposedWithoutAuth();

  // Init subsystems
  initIpc(dataDir);
  initFs(dataDir);
  initAttachments(dataDir);
  initOptionalResources(getAssetsRoot(), dataDir);
  await initNative();
  await initializeSQL(dataDir, getPkgVersion());

  // Load native manifest
  const manifestPath = existsSync(nativeManifestPath())
    ? nativeManifestPath()
    : nativeManifestFallbackPath();
  if (existsSync(manifestPath)) {
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
        functions: Record<string, 'sync' | 'async'>;
      };
      _nativeManifest = m.functions;
      setNativeManifestAllowlist(Object.keys(m.functions));
    } catch { /* ignore */ }
  }

  setRemoveDbFn(async () => {
    await removeSQL(dataDir);
    wipeUserMedia();
  });

  // Build and cache boot payload (fails closed on invalid config)
  getBootPayload();

  // Create HTTP server
  const server = http.createServer((req, res) => {
    handleHttpRequest(req, res).catch(err => {
      console.error('[http] Unhandled error:', err);
      if (!res.headersSent) {
        res.writeHead(500); res.end('Internal Server Error');
      }
    });
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  httpServer = server;

  // WebSocket server
  const wss = new WebSocketServer({
    server,
    path: '/api/bridge',
    maxPayload: 16 * 1024 * 1024,
    verifyClient: (info, done) => {
      if (wss.clients.size >= MAX_WS_CONNECTIONS) {
        done(false, 503, 'Too Many Connections');
        return;
      }
      const decision = evaluateWsUpgrade(info.req);
      if (!decision.ok) {
        done(false, decision.status, decision.message);
        return;
      }
      done(true);
    },
    handleProtocols: (protocols) => selectWsProtocol(protocols),
  });
  wsServer = wss;
  wss.on('connection', (ws: WebSocket, req) => {
    const session: SessionState = {
      ws,
      pendingCallbacks: new Map(),
      inflight: 0,
    };
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    registerSession(ws);
    logAccess({
      kind: 'ws',
      event: 'open',
      origin: req.headers.origin ?? null,
      host: req.headers.host ?? null,
    });
    // Announce this server's session id first so the browser can detect a
    // restart (stale native handles) and reload before issuing native calls.
    ws.send(
      msgpackEncode(
        { t: 'hello', serverSessionId: SERVER_SESSION_ID },
        { ignoreUndefined: true, useBigInt64: true }
      )
    );
    sendInitialPushes(ws);

    ws.on('pong', () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    });

    ws.on('message', (data) => {
      handleMessage(session, data as Buffer);
    });

    ws.on('error', (err) => {
      console.error('[ws] Session error:', err);
    });

    ws.on('close', () => {
      logAccess({ kind: 'ws', event: 'close' });
      for (const [, entry] of session.pendingCallbacks) {
        entry.reject(new Error('WebSocket closed'));
      }
      session.pendingCallbacks.clear();
    });
  });

  if (wsHeartbeat) {
    clearInterval(wsHeartbeat);
  }
  wsHeartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const tagged = client as WebSocket & { isAlive?: boolean };
      if (tagged.isAlive === false) {
        client.terminate();
        continue;
      }
      tagged.isAlive = false;
      client.ping();
    }
  }, WS_PING_MS);
  wsHeartbeat.unref();

  return new Promise((resolve, reject) => {
    const port = getPort();
    const host = getListenHost();
    const onError = (err: Error): void => {
      reject(err);
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      setBoundPort(actualPort);
      console.log(`Signal Web bridge listening on http://${host}:${actualPort}`);
      console.log(`  Data dir: ${dataDir}`);
      console.log(`  Assets root: ${getAssetsRoot()}`);
      console.log(`  Static UI: ${getStaticRoot() ?? '(disabled — set STATIC_ROOT to enable)'}`);
      console.log(`  Env: ${getSignalEnv()}`);
      console.log(`  CORS origins: ${getAllowedOrigins().join(', ')}`);
      console.log(`  API auth: ${isApiAuthEnabled() ? 'on (token in data dir /api-token)' : 'off'}`);
      const nestBase = nestApiBaseFromEnv();
      if (nestBase) {
        console.log(`  Nest proxy: /api/nest → ${nestBase}`);
      } else {
        console.log('  Nest proxy: disabled (set SIGNAL_NEST_API_BASE)');
      }
      resolve(server);
    });
  });
}

function isLaunchedAsServerEntry(): boolean {
  if (typeof require !== 'undefined' && require.main === module) {
    return true;
  }
  return process.argv.some(arg =>
    /(?:^|[/\\])src[/\\]server[/\\]index\.node\.ts$/.test(arg)
  );
}

// Standalone entry
if (isLaunchedAsServerEntry()) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  // Close the SQLCipher workers before exiting — terminating the process
  // with the DB open aborts in the sqlcipher NAPI finalizer.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`\n[server] ${signal} received, closing…`);
    const force = setTimeout(() => process.exit(1), 8_000);
    force.unref();
    if (wsHeartbeat) {
      clearInterval(wsHeartbeat);
      wsHeartbeat = null;
    }
    const wss = wsServer;
    const srv = httpServer;
    const closeHttp = (): Promise<void> =>
      new Promise(resolve => {
        if (!srv) {
          resolve();
          return;
        }
        srv.close(() => resolve());
      });
    const closeWs = (): Promise<void> =>
      new Promise(resolve => {
        if (!wss) {
          resolve();
          return;
        }
        for (const client of wss.clients) {
          client.close(1001, 'server shutting down');
        }
        wss.close(() => resolve());
      });
    Promise.all([closeWs(), closeHttp()])
      .then(() => closeSQL())
      .then(() => {
        releaseDataDirLock();
        process.exit(0);
      })
      .catch(err => {
        console.error('[server] shutdown failed:', err);
        releaseDataDirLock();
        process.exit(1);
      });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('exit', () => {
  releaseDataDirLock();
});
