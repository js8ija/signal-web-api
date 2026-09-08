// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Crypto bridge: hosts @signalapp/libsignal-client Native functions and
 * manages a server-side handle registry.
 *
 * Handles (opaque objects returned by native functions) are stored in a
 * Map<id, unknown> and replaced on the wire with { __native_handle: id, __kind }.
 * When clients pass them back they are decoded from the registry before calling
 * the native function.
 *
 * Callbacks (WireCallback) are proxied back over the requesting WebSocket
 * session via cbreq/cbres frames.
 */

import type WebSocket from 'ws';
import type {
  WireHandle,
  WireCallback,
  ResponseFrame,
  CallbackRequestFrame,
  CallbackResponseFrame,
  WireError,
} from '../bridge/protocol.std.ts';
import {
  isWireHandle,
  isWireCallback,
  toWireError,
} from '../bridge/protocol.std.ts';

// ---- handle registry ----------------------------------------------------------

let _nextId = 1;
const _registry = new Map<number, unknown>();

/**
 * Stores a native value in the registry.
 * Native functions return raw externals (Node.js External values with null prototype).
 * Native functions that accept handles expect { _nativeHandle: external }.
 * So we always store { _nativeHandle: rawExternal } in the registry and
 * return it as-is when decoding args.
 */
function storeHandle(value: unknown): WireHandle {
  const id = _nextId++;
  // Wrap raw externals into the Wrapper<T> format the native API expects
  const stored = wrapIfExternal(value);
  _registry.set(id, stored);
  const kind = guessKind(value);
  return { __native_handle: id, __kind: kind };
}

function guessKind(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value !== 'object') return typeof value;
  const name = (value as object).constructor?.name;
  if (name) return name;
  // Raw external: proto is null, no constructor
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return 'External';
  return 'object';
}

function isRawExternal(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  // Raw Neon externals have null prototype and no enumerable keys
  return Object.getPrototypeOf(value) === null;
}

function wrapIfExternal(value: unknown): unknown {
  if (isRawExternal(value)) {
    return { _nativeHandle: value };
  }
  return value;
}

export function releaseHandles(ids: ReadonlyArray<number>): void {
  for (const id of ids) {
    _registry.delete(id);
  }
}

export function getRegistrySize(): number {
  return _registry.size;
}

// ---- native module loading ---------------------------------------------------

// Native.js uses ESM exports; we load it via dynamic import (resolved at init time).
let Native: Record<string, unknown> = {};
let _nativeReady = false;
let _nativeReadyPromise: Promise<void> | null = null;

export function initNative(): Promise<void> {
  if (_nativeReadyPromise) return _nativeReadyPromise;
  _nativeReadyPromise = (async () => {
    // Use createRequire or dynamic import — for tsx/Node ESM interop use dynamic import
    const nativeMod = await import('@signalapp/libsignal-client/dist/Native.js');
    Native = nativeMod as unknown as Record<string, unknown>;

    // Bootstrap — call real functions at startup
    try {
      const registerErrors = Native.registerErrors as ((m: Record<string, unknown>) => void) | undefined;
      const initLogger = Native.initLogger as ((level: number, cb: (...args: unknown[]) => void) => void) | undefined;

      let errorsModule: Record<string, unknown> = {};
      try {
        const errorsMod = await import('@signalapp/libsignal-client/dist/Errors.js');
        errorsModule = errorsMod as unknown as Record<string, unknown>;
      } catch {
        // ignore
      }

      if (typeof registerErrors === 'function') {
        registerErrors(errorsModule);
      }
      if (typeof initLogger === 'function') {
        // LogLevel: Error=1 Warn=2 Info=3 Debug=4 Trace=5
        const level = process.env.SIGNAL_WEB_TRACE != null ? 4 : 2;
        initLogger(level, (_level: unknown, target: unknown, _file: unknown, _line: unknown, message: unknown) => {
          console.log(`[libsignal:${target}] ${message}`);
        });
      }
    } catch (err) {
      console.warn('[native] Failed to bootstrap libsignal:', err);
    }

    _nativeReady = true;
  })();
  return _nativeReadyPromise;
}

// ---- argument decode ----------------------------------------------------------

type DecodeContext = {
  ws: WebSocket | null;
  cbCounter: Map<number, number>; // cbId -> next correlation id
  pendingCallbacks: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  sendFrame: ((frame: CallbackRequestFrame) => void) | null;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

function decodeArg(arg: unknown, ctx: DecodeContext, depth = 0): unknown {
  if (depth > 4) return arg;
  if (arg == null) return arg;
  if (arg instanceof Uint8Array || Buffer.isBuffer(arg)) {
    return Buffer.isBuffer(arg) ? arg : Buffer.from(arg);
  }
  if (Array.isArray(arg)) {
    return arg.map(a => decodeArg(a, ctx, depth + 1));
  }
  if (isWireHandle(arg)) {
    const value = _registry.get(arg.__native_handle);
    if (value === undefined && !_registry.has(arg.__native_handle)) {
      throw new Error(`Unknown native handle: ${arg.__native_handle}`);
    }
    return value;
  }
  if (isWireCallback(arg)) {
    if (!ctx.ws || !ctx.sendFrame) {
      throw new Error('WireCallback received on non-WS path (sync POST)');
    }
    return buildCallbackProxy(arg, ctx);
  }
  if (isPlainObject(arg)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(arg)) {
      out[k] = decodeArg(v, ctx, depth + 1);
    }
    return out;
  }
  return arg;
}

let _cbReqCounter = 1;

const TRACE = process.env.SIGNAL_WEB_TRACE != null;
function trace(...args: Array<unknown>): void {
  if (TRACE) {
    // eslint-disable-next-line no-console
    console.log('[native-trace]', ...args);
  }
}

/**
 * Decode a value RETURNED from a browser callback (cbres) for handoff to
 * native. Mirrors decodeArg, except a WireHandle resolves to the bare
 * external (`registry._nativeHandle`) rather than the `{ _nativeHandle }`
 * wrapper used for function arguments: libsignal store callbacks hand back
 * raw `_nativeHandle` externals (PrivateKey, SessionRecord, …).
 */
function decodeCallbackResult(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) {
    return value;
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => decodeCallbackResult(v, depth + 1));
  }
  if (isWireHandle(value)) {
    const stored = _registry.get(value.__native_handle);
    if (stored === undefined && !_registry.has(value.__native_handle)) {
      throw new Error(`Unknown native handle: ${value.__native_handle}`);
    }
    // Unwrap to the raw external when we stored it via the Wrapper shape.
    if (
      stored != null &&
      typeof stored === 'object' &&
      '_nativeHandle' in (stored as Record<string, unknown>)
    ) {
      return (stored as { _nativeHandle: unknown })._nativeHandle;
    }
    return stored;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = decodeCallbackResult(v, depth + 1);
    }
    return out;
  }
  return value;
}

function buildCallbackProxy(cb: WireCallback, ctx: DecodeContext): unknown {
  const { __bridge_callback: cbId, __methods: methods } = cb;

  const proxy: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  for (const method of methods) {
    proxy[method] = async (...nativeArgs: unknown[]): Promise<unknown> => {
      if (!ctx.sendFrame) throw new Error('Callback context lost');
      trace(`listener→browser ${method}(${nativeArgs.length} args)`);

      const id = _cbReqCounter++;
      const frame: CallbackRequestFrame = {
        t: 'cbreq',
        id,
        cbId,
        method,
        args: encodeResultArray(nativeArgs),
      };

      const resultPromise = new Promise<unknown>((resolve, reject) => {
        ctx.pendingCallbacks.set(id, { resolve, reject });
      });
      // If native drops the future that awaits this callback (e.g. the
      // connection closed mid-call), the rejection would otherwise be
      // unhandled and take down the whole bridge process.
      resultPromise.catch(() => undefined);

      ctx.sendFrame(frame);
      // The browser's callback result may itself contain WireHandles
      // (e.g. getIdentityKeyPair → [privateKey._nativeHandle, ...], or a
      // store returning a SessionRecord token). In real libsignal these
      // results are RAW externals, not Wrapper<T> objects — so resolve
      // handles to the bare external, unlike function-argument decoding.
      const raw = await resultPromise;
      return decodeCallbackResult(raw);
    };
  }
  return proxy;
}

// ---- result encode ------------------------------------------------------------

function isNativePlainPrimitive(v: unknown): boolean {
  if (v == null) return true;
  const t = typeof v;
  return t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint';
}

function encodeResult(value: unknown): unknown {
  if (value == null) return value;
  if (isNativePlainPrimitive(value)) return value;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    // Always return Uint8Array for msgpack
    return value instanceof Uint8Array ? value : new Uint8Array(value as Buffer);
  }
  if (Array.isArray(value)) {
    return value.map(encodeResult);
  }
  if (value instanceof Map) {
    // Encode maps as plain objects (string keys)
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      out[String(k)] = encodeResult(v);
    }
    return out;
  }
  // Raw external (Neon value — null proto, no keys) — store as handle
  if (isRawExternal(value)) {
    return storeHandle(value);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = encodeResult(v);
    }
    return out;
  }
  // Any other non-plain object — store in registry and return a handle
  return storeHandle(value);
}

function encodeResultArray(args: unknown[]): unknown[] {
  return args.map(encodeResult);
}

// ---- callback response handling -----------------------------------------------

export function handleCallbackResponse(
  frame: CallbackResponseFrame,
  pendingCallbacks: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>
): void {
  const entry = pendingCallbacks.get(frame.id);
  pendingCallbacks.delete(frame.id);
  if (!entry) return;
  if (frame.ok) {
    entry.resolve(frame.value);
  } else {
    const wire = frame.error!;
    const err = new Error(wire.message);
    err.name = wire.name;
    entry.reject(err);
  }
}

// ---- main invoke --------------------------------------------------------------

export async function invokeNative(
  method: string,
  rawArgs: ReadonlyArray<unknown>,
  ws: WebSocket | null,
  pendingCallbacks: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>,
  sendFrame: ((frame: CallbackRequestFrame) => void) | null
): Promise<unknown> {
  // Ensure native module is loaded
  if (!_nativeReady) {
    await initNative();
  }

  // Special bootstrap functions — no-op if already done at startup
  if (method === 'registerErrors' || method === 'initLogger') {
    return undefined;
  }

  const fn = Native[method];
  if (typeof fn !== 'function') {
    throw new Error(`Unknown native function: ${method}`);
  }

  const ctx: DecodeContext = { ws, pendingCallbacks, cbCounter: new Map(), sendFrame };
  const decodedArgs = (rawArgs as unknown[]).map(a => decodeArg(a, ctx));

  const isInteresting =
    TRACE && /Chat|Connection|connect|listener|Cdsi|disconnect|Provision/i.test(method);
  if (isInteresting) {
    trace(`call ${method}`);
  }

  let resolved: unknown;
  try {
    const result = (fn as (...a: unknown[]) => unknown)(...decodedArgs);
    if (result instanceof Promise) {
      resolved = await result;
    } else {
      resolved = result;
    }
  } catch (error) {
    if (isInteresting) {
      trace(`call ${method} THREW`, (error as Error)?.message);
    }
    throw error;
  }
  if (isInteresting) {
    trace(`call ${method} → ok`);
  }

  return encodeResult(resolved);
}
