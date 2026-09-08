// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared bridge protocol between the browser bundle and the bridge server.
 * Frames are MessagePack-encoded maps sent over a single WebSocket at
 * `/api/bridge`, except for synchronous native calls which POST a single
 * request frame to `/api/bridge/sync` and receive a single response frame.
 *
 * See docs/web/ARCHITECTURE.md ("Bridge protocol").
 */

export const BRIDGE_WS_PATH = '/api/bridge';
export const BRIDGE_SYNC_PATH = '/api/bridge/sync';
export const BOOT_PATH = '/api/boot';
export const PROXY_PATH = '/api/proxy';

/** RPC namespaces. */
export type BridgeNamespace =
  | 'sql-read' // ts/sql DataReader; method = function name
  | 'sql-write' // ts/sql DataWriter; method = function name
  | 'ipc' // ipcRenderer.invoke(channel, ...args); method = channel
  | 'ipc-send' // ipcRenderer.send(channel, ...args); fire-and-forget
  | 'native' // libsignal Native.* flat functions; method = native fn name
  | 'fs'; // attachment/file operations; method = op name

export type RequestFrame = {
  t: 'req';
  id: number;
  ns: BridgeNamespace;
  method: string;
  args: ReadonlyArray<unknown>;
};

export type ResponseFrame = {
  t: 'res';
  id: number;
  ok: boolean;
  value?: unknown;
  error?: WireError;
};

/**
 * Server→client: native code invoked a method on a callback object (a
 * "store") that the client passed by reference inside an async native call.
 */
export type CallbackRequestFrame = {
  t: 'cbreq';
  id: number; // correlation id for the cbres
  cbId: number; // which client-side callback object
  method: string;
  args: ReadonlyArray<unknown>;
};

export type CallbackResponseFrame = {
  t: 'cbres';
  id: number;
  ok: boolean;
  value?: unknown;
  error?: WireError;
};

/** Server→client event, mirrors webContents.send → ipcRenderer.on. */
export type PushFrame = {
  t: 'push';
  channel: string;
  args: ReadonlyArray<unknown>;
};

/** Client→server: release server-side native handles (GC). */
export type ReleaseFrame = {
  t: 'release';
  handles: ReadonlyArray<number>;
};

export type BridgeFrame =
  | RequestFrame
  | ResponseFrame
  | CallbackRequestFrame
  | CallbackResponseFrame
  | PushFrame
  | ReleaseFrame
  | ServerHelloFrame;

export type WireError = {
  name: string;
  message: string;
  stack?: string;
  // Extra enumerable own properties (e.g. libsignal error codes), msgpack-safe
  props?: Record<string, unknown>;
};

/**
 * Wire representation of a server-side native handle. Argument encoding /
 * decoding walks args one level deep (arrays and plain objects) so handles
 * can appear inside option bags and lists.
 */
export type WireHandle = {
  __native_handle: number;
  /** Constructor-ish tag for debugging only. */
  __kind?: string;
};

export function isWireHandle(value: unknown): value is WireHandle {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof (value as WireHandle).__native_handle === 'number'
  );
}

/**
 * Wire representation of a client-side callback object (e.g. a
 * SessionStore). Only valid inside async native calls.
 */
export type WireCallback = {
  __bridge_callback: number;
  /** Method names the object supports. */
  __methods: ReadonlyArray<string>;
};

export function isWireCallback(value: unknown): value is WireCallback {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof (value as WireCallback).__bridge_callback === 'number'
  );
}

export function toWireError(error: unknown): WireError {
  if (error instanceof Error) {
    const props: Record<string, unknown> = {};
    for (const key of Object.keys(error)) {
      const value = (error as unknown as Record<string, unknown>)[key];
      const type = typeof value;
      if (
        value == null ||
        type === 'string' ||
        type === 'number' ||
        type === 'boolean' ||
        value instanceof Uint8Array
      ) {
        props[key] = value;
      }
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      props: Object.keys(props).length > 0 ? props : undefined,
    };
  }
  return { name: 'Error', message: String(error) };
}

export function fromWireError(wire: WireError): Error {
  const error = new Error(wire.message);
  error.name = wire.name;
  if (wire.stack != null) {
    error.stack = `${wire.stack}\n    [over signal-web bridge]`;
  }
  if (wire.props != null) {
    Object.assign(error, wire.props);
  }
  return error;
}

/**
 * Identifies a single bridge-server process lifetime. The browser captures
 * it at boot; if the server restarts, its native handle registry resets and
 * the browser's handles go stale — the WS reports the new id, and the
 * browser reloads once to rebuild against the fresh server. A fresh load
 * always matches, so this can't loop.
 */
export type ServerHelloFrame = {
  t: 'hello';
  serverSessionId: string;
};

/** Boot payload served at /api/boot; answers all sendSync channels. */
export type BootPayload = {
  serverSessionId: string;
  // sendSync channel name → return value
  sync: {
    'get-config': unknown; // RendererConfigType
    'locale-data': unknown;
    'locale-display-names': unknown;
    'country-display-names': unknown;
    'OS.getClassName': string;
    'get-user-data-path': string;
    [channel: string]: unknown;
  };
  nativeManifest: Record<string, 'sync' | 'async'>;
};
