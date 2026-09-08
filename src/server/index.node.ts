// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Signal Web bridge server entry point.
 *
 * ENV:
 *   PORT                  HTTP port (default 8915)
 *   SIGNAL_WEB_DATA       Data directory (default ~/.signal-web)
 *   SIGNAL_ENV            production | staging | development (default production)
 *   SIGNAL_WEB_LOCALE     Default locale hint (default 'en')
 *   SIGNAL_NEST_API_BASE  LeanScrm Nest base (e.g. http://127.0.0.1:3010);
 *                         enables /api/nest reverse proxy + /api/nest-config
 */

import http from 'node:http';
import { join, extname, resolve } from 'node:path';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';

import type {
  RequestFrame,
  ResponseFrame,
  CallbackResponseFrame,
  ReleaseFrame,
  BridgeFrame,
} from '../bridge/protocol.std.ts';
import { toWireError } from '../bridge/protocol.std.ts';
import { buildBootPayload } from './boot.node.ts';
import { initializeSQL, sqlCall, closeSQL } from './sql.node.ts';
import { invokeNative, releaseHandles, handleCallbackResponse, initNative } from './native.node.ts';
import { initIpc, handleIpcInvoke, warnSendOnce, setRemoveDbFn } from './ipc.node.ts';
import { initFs, handleFsCall } from './fs.node.ts';
import { initAttachments, handleAttachmentRequest } from './attachments.node.ts';
import { initOptionalResources } from './optionalResources.node.ts';
import { handleProxyRequest } from './proxy.node.ts';
import { handleNestProxy, nestApiBaseFromEnv } from './nest-proxy.node.ts';
import { registerSession, pushToAll, sendInitialPushes } from './push.node.ts';
import type { CallbackRequestFrame } from '../bridge/protocol.std.ts';

// ---- configuration -----------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '8915', 10);
const DATA_DIR = process.env.SIGNAL_WEB_DATA ?? join(os.homedir(), '.signal-web');
const SIGNAL_ENV = process.env.SIGNAL_ENV ?? 'production';
const LOCALE_HINT = process.env.SIGNAL_WEB_LOCALE ?? 'en';
const REPO_ROOT = join(__dirname, '..', '..');
// Identifies this server process; the native handle registry is reset on
// restart, so the browser reloads when it sees a new id (see protocol).
const SERVER_SESSION_ID = randomUUID();
const PKG_VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string }).version;
  } catch { return '0.0.0'; }
})();

// Ensure data dir exists
mkdirSync(DATA_DIR, { recursive: true });

// The bridge must survive stray failures from native callbacks, dropped
// futures and background tasks — log loudly, never exit.
process.on('unhandledRejection', reason => {
  console.error('[server] unhandled rejection (continuing):', reason);
});
process.on('uncaughtException', error => {
  console.error('[server] uncaught exception (continuing):', error);
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
};

function getMime(filepath: string): string {
  return MIME[extname(filepath).toLowerCase()] ?? 'application/octet-stream';
}

// ---- static file serving ----------------------------------------------------

// Map of URL prefix → filesystem root
const STATIC_MOUNTS: Array<{ prefix: string; root: string }> = [
  { prefix: '/bundles-web', root: join(REPO_ROOT, 'bundles-web') },
  { prefix: '/bundles', root: join(REPO_ROOT, 'bundles') },
  { prefix: '/stylesheets', root: join(REPO_ROOT, 'stylesheets') },
  { prefix: '/fonts', root: join(REPO_ROOT, 'fonts') },
  { prefix: '/images', root: join(REPO_ROOT, 'images') },
  { prefix: '/sounds', root: join(REPO_ROOT, 'sounds') },
  { prefix: '/build', root: join(REPO_ROOT, 'build') },
  // intl-tel-input images referenced from CSS as ../node_modules/intl-tel-input/build/img/
  {
    prefix: '/node_modules/intl-tel-input/build/img',
    root: join(REPO_ROOT, 'node_modules', 'intl-tel-input', 'build', 'img'),
  },
  { prefix: '/', root: join(REPO_ROOT, 'web', 'static') },
];

function serveStaticFile(urlPath: string, res: http.ServerResponse): boolean {
  // Prevent directory traversal
  for (const mount of STATIC_MOUNTS) {
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
      const candidate = resolve(mount.root, '.' + relPath);
      // Security: must stay within mount root
      if (!candidate.startsWith(resolve(mount.root))) continue;
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        const contentType = getMime(candidate);
        let content: Buffer = readFileSync(candidate);
        // Rewrite asset:/// → / in CSS files so font/image URLs resolve in browser
        if (extname(candidate).toLowerCase() === '.css') {
          content = Buffer.from(content.toString('utf-8').replaceAll('asset:///', '/'), 'utf-8');
        }
        // App code and the shell must always revalidate (dynamic imports
        // bypass hard-reload cache busting); immutable-ish assets may cache.
        const isAppCode =
          urlPath.startsWith('/bundles-web/') ||
          urlPath === '/' ||
          urlPath.endsWith('.html') ||
          urlPath === '/sw.js' ||
          extname(candidate).toLowerCase() === '.css';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': isAppCode ? 'no-cache' : 'public, max-age=3600',
        });
        res.end(content);
        return true;
      }
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
      env: SIGNAL_ENV,
      dataDir: DATA_DIR,
      localeHint: LOCALE_HINT,
      nativeManifest: _nativeManifest,
    });
  }
  return { ...(_bootPayload as object), serverSessionId: SERVER_SESSION_ID } as ReturnType<
    typeof buildBootPayload
  > & { serverSessionId: string };
}

// ---- body reading ------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ---- WebSocket session -------------------------------------------------------

type SessionState = {
  ws: WebSocket;
  pendingCallbacks: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
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
    void handleRequest(session, frame);
  } else if (frame.t === 'cbres') {
    handleCallbackResponse(frame as CallbackResponseFrame, session.pendingCallbacks);
  } else if (frame.t === 'release') {
    releaseHandles((frame as ReleaseFrame).handles);
  } else if (frame.t === 'ipc-send') {
    // ipc-send is a fire-and-forget request frame variant
    void handleRequest(session, frame as unknown as RequestFrame);
  } else {
    console.warn('[ws] Unexpected frame type:', (frame as { t: string }).t);
  }
}

// ---- HTTP handler -----------------------------------------------------------

async function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  // GET /api/boot
  if (req.method === 'GET' && pathname === '/api/boot') {
    const payload = getBootPayload();
    const accept = req.headers.accept ?? '';
    if (accept.includes('msgpack') || accept.includes('application/octet-stream')) {
      res.writeHead(200, { 'Content-Type': 'application/msgpack' });
      res.end(Buffer.from(msgpackEncode(payload, { ignoreUndefined: true, useBigInt64: true })));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    }
    return;
  }

  // POST /api/bridge/sync — synchronous native calls
  if (req.method === 'POST' && pathname === '/api/bridge/sync') {
    const body = await readBody(req);
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
    const body = req.method === 'GET' || req.method === 'HEAD'
      ? Buffer.alloc(0)
      : await readBody(req);
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
    if (serveStaticFile(pathname, res)) return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// ---- server startup ---------------------------------------------------------

export async function startServer(): Promise<http.Server> {
  // Init subsystems
  initIpc(DATA_DIR);
  initFs(DATA_DIR);
  initAttachments(DATA_DIR);
  initOptionalResources(REPO_ROOT, DATA_DIR);
  await initNative();
  await initializeSQL(DATA_DIR, PKG_VERSION);

  // Load native manifest
  const manifestPath = join(REPO_ROOT, 'web', 'generated', 'native-manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
        functions: Record<string, 'sync' | 'async'>;
      };
      _nativeManifest = m.functions;
    } catch { /* ignore */ }
  }

  // Wire sql-channel:remove-db to the sql layer
  setRemoveDbFn(closeSQL);

  // Build and cache boot payload
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

  // WebSocket server
  const wss = new WebSocketServer({ server, path: '/api/bridge' });
  wss.on('connection', (ws: WebSocket) => {
    const session: SessionState = {
      ws,
      pendingCallbacks: new Map(),
    };
    registerSession(ws);
    // Announce this server's session id first so the browser can detect a
    // restart (stale native handles) and reload before issuing native calls.
    ws.send(
      msgpackEncode(
        { t: 'hello', serverSessionId: SERVER_SESSION_ID },
        { ignoreUndefined: true, useBigInt64: true }
      )
    );
    sendInitialPushes(ws);

    ws.on('message', (data) => {
      handleMessage(session, data as Buffer);
    });

    ws.on('error', (err) => {
      console.error('[ws] Session error:', err);
    });

    ws.on('close', () => {
      // pendingCallbacks cleanup
      for (const [, entry] of session.pendingCallbacks) {
        entry.reject(new Error('WebSocket closed'));
      }
      session.pendingCallbacks.clear();
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Signal Web bridge listening on http://localhost:${PORT}`);
      console.log(`  Data dir: ${DATA_DIR}`);
      console.log(`  Env: ${SIGNAL_ENV}`);
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

// Standalone entry
if (require.main === module || process.argv[1]?.endsWith('index.node.ts')) {
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
    console.log(`\n[server] ${signal} received, closing database…`);
    closeSQL()
      .catch(err => console.error('[server] sql close failed:', err))
      .finally(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
