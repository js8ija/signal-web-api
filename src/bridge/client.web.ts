// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Browser side of the bridge: a multiplexed WebSocket RPC client plus a
 * synchronous XHR path for libsignal Native calls that must return
 * synchronously. Transport only — argument/handle transformation lives in
 * the shims that use this client (see web/shims/libsignal-native-runtime).
 */

import { decode, encode } from '@msgpack/msgpack';

import type {
  BridgeFrame,
  BridgeNamespace,
  CallbackRequestFrame,
  RequestFrame,
  ResponseFrame,
  WireCallback,
} from './protocol.std.ts';
import {
  BRIDGE_SYNC_PATH,
  BRIDGE_WS_PATH,
  fromWireError,
  toWireError,
} from './protocol.std.ts';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  ns: BridgeNamespace;
  method: string;
};

type PushHandler = (...args: ReadonlyArray<unknown>) => void;

export type CallbackTarget = Record<string, unknown>;

const RECONNECT_BASE_DELAY_MS = 250;
const RECONNECT_MAX_DELAY_MS = 10_000;

function readApiToken(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const injected = (window as unknown as { __SIGNAL_WEB_API_TOKEN__?: unknown })
    .__SIGNAL_WEB_API_TOKEN__;
  if (typeof injected === 'string' && injected.length > 0) {
    return injected;
  }
  try {
    const q = new URLSearchParams(window.location.search).get('token');
    if (q) {
      return q;
    }
  } catch {
    /* ignore */
  }
  try {
    const stored = window.localStorage?.getItem('signal-web.api-token');
    return stored || undefined;
  } catch {
    return undefined;
  }
}

function collectMethodNames(target: CallbackTarget): Array<string> {
  const names = new Set<string>();
  let proto: unknown = target;
  while (
    proto != null &&
    proto !== Object.prototype &&
    names.size < 64 // sanity bound
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (descriptor && typeof descriptor.value === 'function') {
        names.add(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return Array.from(names);
}

export class BridgeClient {
  #socket: WebSocket | undefined;
  #requestId = 1;
  #pending = new Map<number, PendingRequest>();
  #sendQueue: Array<Uint8Array> = [];
  #pushHandlers = new Map<string, Set<PushHandler>>();
  #reconnectAttempt = 0;
  #closedForGood = false;

  #callbackIds = new WeakMap<CallbackTarget, number>();
  #callbacks = new Map<number, CallbackTarget>();
  #nextCallbackId = 1;

  /**
   * Hook installed by the libsignal shim: revives incoming values inside
   * cbreq args / outgoing cbres values. Identity by default.
   */
  public reviveCallbackArg: (value: unknown) => unknown = v => v;
  public prepareCallbackResult: (value: unknown) => unknown = v => v;

  connect(): void {
    if (this.#socket != null || this.#closedForGood) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = readApiToken();
    const url = new URL(`${proto}//${window.location.host}${BRIDGE_WS_PATH}`);
    if (token) {
      url.searchParams.set('token', token);
    }
    const socket = token
      ? new WebSocket(url.toString(), [token])
      : new WebSocket(url.toString());
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;

    socket.addEventListener('open', () => {
      this.#reconnectAttempt = 0;
      const queue = this.#sendQueue;
      this.#sendQueue = [];
      for (const frame of queue) {
        socket.send(frame);
      }
    });

    socket.addEventListener('message', event => {
      let frame: BridgeFrame;
      try {
        frame = decode(new Uint8Array(event.data as ArrayBuffer), {
          useBigInt64: true,
        }) as BridgeFrame;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('bridge: failed to decode frame', error);
        return;
      }
      this.#onFrame(frame);
    });

    socket.addEventListener('close', () => {
      this.#socket = undefined;
      const pending = this.#pending;
      this.#pending = new Map();
      for (const [, request] of pending) {
        request.reject(
          new Error(
            `bridge: connection lost during ${request.ns}:${request.method}`
          )
        );
      }
      if (!this.#closedForGood) {
        const delay = Math.min(
          RECONNECT_MAX_DELAY_MS,
          RECONNECT_BASE_DELAY_MS * 2 ** this.#reconnectAttempt
        );
        this.#reconnectAttempt += 1;
        setTimeout(() => this.connect(), delay);
      }
    });
  }

  #onFrame(frame: BridgeFrame): void {
    switch (frame.t) {
      case 'res': {
        const pending = this.#pending.get(frame.id);
        if (pending == null) {
          return;
        }
        this.#pending.delete(frame.id);
        if (frame.ok) {
          pending.resolve(frame.value);
        } else {
          pending.reject(
            frame.error
              ? fromWireError(frame.error)
              : new Error('bridge: unknown error')
          );
        }
        break;
      }
      case 'hello':
        this.#onServerHello(frame.serverSessionId);
        break;
      case 'cbreq':
        void this.#onCallbackRequest(frame);
        break;
      case 'push': {
        const handlers = this.#pushHandlers.get(frame.channel);
        if (handlers != null) {
          for (const handler of handlers) {
            try {
              handler(...frame.args);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(`bridge: push handler ${frame.channel}`, error);
            }
          }
        }
        break;
      }
      default:
        // req/cbres/release are client→server only
        break;
    }
  }

  #reloadedForSession = false;

  /**
   * The server announces its session id on every (re)connect. If it differs
   * from the one this page booted with, the server restarted and its native
   * handle registry reset — our handles are stale. Reload once to rebuild
   * against the fresh server. A fresh page boots with the current id, so the
   * ids match and this never loops.
   */
  #onServerHello(serverSessionId: string): void {
    const booted = (globalThis as Record<string, unknown>)[
      '__SIGNAL_WEB_BOOT__'
    ] as { serverSessionId?: string } | undefined;
    const bootedId = booted?.serverSessionId;
    if (
      bootedId != null &&
      serverSessionId !== bootedId &&
      !this.#reloadedForSession &&
      typeof window !== 'undefined'
    ) {
      this.#reloadedForSession = true;
      // eslint-disable-next-line no-console
      console.warn(
        'bridge: server restarted (session id changed) — reloading to rebuild native handles'
      );
      window.location.reload();
    }
  }

  async #onCallbackRequest(frame: CallbackRequestFrame): Promise<void> {
    let ok = true;
    let value: unknown;
    let error: unknown;
    try {
      const target = this.#callbacks.get(frame.cbId);
      if (target == null) {
        throw new Error(`bridge: unknown callback object ${frame.cbId}`);
      }
      const method = target[frame.method];
      if (typeof method !== 'function') {
        throw new TypeError(
          `bridge: callback ${frame.cbId} has no method ${frame.method}`
        );
      }
      const args = frame.args.map(arg => this.reviveCallbackArg(arg));
      value = this.prepareCallbackResult(
        await Reflect.apply(method, target, args)
      );
    } catch (err) {
      ok = false;
      error = err;
    }
    this.#sendFrame({
      t: 'cbres',
      id: frame.id,
      ok,
      value: ok ? value : undefined,
      error: ok ? undefined : toWireError(error),
    });
  }

  #sendFrame(frame: BridgeFrame): void {
    const encoded = encode(frame, { ignoreUndefined: true, useBigInt64: true });
    if (this.#socket != null && this.#socket.readyState === WebSocket.OPEN) {
      this.#socket.send(encoded);
    } else {
      this.#sendQueue.push(encoded);
      this.connect();
    }
  }

  invoke(
    ns: BridgeNamespace,
    method: string,
    args: ReadonlyArray<unknown>
  ): Promise<unknown> {
    const id = this.#requestId;
    this.#requestId += 1;
    const frame: RequestFrame = { t: 'req', id, ns, method, args };
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, ns, method });
      this.#sendFrame(frame);
    });
  }

  send(ns: BridgeNamespace, method: string, args: ReadonlyArray<unknown>): void {
    const id = this.#requestId;
    this.#requestId += 1;
    // Fire-and-forget: the server never answers these, so no pending entry.
    this.#sendFrame({ t: 'req', id, ns, method, args });
  }

  /**
   * Synchronous RPC for libsignal Native calls. Blocks the calling thread
   * on a sync XHR; server must answer with a raw msgpack ResponseFrame.
   * Binary-safe via the legacy x-user-defined charset trick (sync XHR
   * forbids responseType).
   */
  syncCall(method: string, args: ReadonlyArray<unknown>): unknown {
    const frame: RequestFrame = {
      t: 'req',
      id: 0,
      ns: 'native',
      method,
      args,
    };
    const xhr = new XMLHttpRequest();
    xhr.open('POST', BRIDGE_SYNC_PATH, false);
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.setRequestHeader('content-type', 'application/x-msgpack');
    const token = readApiToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(encode(frame, { ignoreUndefined: true, useBigInt64: true }));
    if (xhr.status !== 200) {
      throw new Error(
        `bridge: sync call ${method} failed with HTTP ${xhr.status}`
      );
    }
    const text = xhr.responseText;
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
      // eslint-disable-next-line no-bitwise
      bytes[i] = text.charCodeAt(i) & 0xff;
    }
    const response = decode(bytes, { useBigInt64: true }) as ResponseFrame;
    if (!response.ok) {
      throw response.error
        ? fromWireError(response.error)
        : new Error(`bridge: sync call ${method} failed`);
    }
    return response.value;
  }

  onPush(channel: string, handler: PushHandler): () => void {
    let handlers = this.#pushHandlers.get(channel);
    if (handlers == null) {
      handlers = new Set();
      this.#pushHandlers.set(channel, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  offPush(channel: string, handler: PushHandler): void {
    this.#pushHandlers.get(channel)?.delete(handler);
  }

  /**
   * Register (or reuse) a callback object so the server can call back into
   * it during async native calls. Returns its wire representation.
   */
  registerCallback(target: CallbackTarget): WireCallback {
    let id = this.#callbackIds.get(target);
    if (id == null) {
      id = this.#nextCallbackId;
      this.#nextCallbackId += 1;
      this.#callbackIds.set(target, id);
      this.#callbacks.set(id, target);
    }
    return {
      __bridge_callback: id,
      __methods: collectMethodNames(target),
    };
  }

  releaseHandles(handles: ReadonlyArray<number>): void {
    if (handles.length === 0) {
      return;
    }
    this.#sendFrame({ t: 'release', handles });
  }
}

export const bridge = new BridgeClient();
