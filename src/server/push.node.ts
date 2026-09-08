// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Push frame broadcaster. Maintains a registry of active WebSocket sessions
 * and emits PushFrame events to all of them.
 *
 * The renderer listens for the following ipc channels via ipcRenderer.on(...):
 *   window:set-window-stats
 *   window:set-menu-options
 *   power-channel:suspend / resume / lock-screen
 *   open-settings-tab
 *   show-window
 *   add-dark-overlay / remove-dark-overlay
 *   sql-error
 *   (see ts/windows/main/phase1-ipc.preload.ts for full list)
 */

import { encode } from '@msgpack/msgpack';
import type WebSocket from 'ws';
import type { PushFrame } from '../bridge/protocol.std.ts';

const _sessions = new Set<WebSocket>();

export function registerSession(ws: WebSocket): void {
  _sessions.add(ws);
  ws.on('close', () => _sessions.delete(ws));
}

export function pushToAll(channel: string, args: ReadonlyArray<unknown> = []): void {
  const frame: PushFrame = { t: 'push', channel, args };
  const encoded = encode(frame);
  for (const ws of _sessions) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(encoded);
    }
  }
}

export function pushToSession(ws: WebSocket, channel: string, args: ReadonlyArray<unknown> = []): void {
  const frame: PushFrame = { t: 'push', channel, args };
  const encoded = encode(frame);
  if (ws.readyState === 1) {
    ws.send(encoded);
  }
}

/** Send initial push frames when a new session connects */
export function sendInitialPushes(ws: WebSocket): void {
  // Send initial window stats
  pushToSession(ws, 'window:set-window-stats', [
    { isMaximized: false, isFullScreen: false },
  ]);
  // Send initial menu options
  pushToSession(ws, 'window:set-menu-options', [
    {
      development: false,
      devTools: true,
      includeSetup: false,
      isNightly: false,
      isProduction: true,
      platform: process.platform,
    },
  ]);
  // Electron main sends 'activate' when the window becomes visible; the
  // renderer's whenWindowVisible() (and thus the installer screen) waits
  // for it. A browser tab that opened the socket is by definition visible.
  pushToSession(ws, 'activate', []);
}
