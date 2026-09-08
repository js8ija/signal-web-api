// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * ipc namespace handler. Answers ipcRenderer.invoke(channel, ...args)
 * requests from the browser.
 *
 * Channel naming follows ts/util/preload.preload.ts `createSetting`:
 *   get: `settings:get:<name>`
 *   set: `settings:set:<name>`
 *
 * Unknown invoke channels are rejected with SignalWebUnsupportedIpc (logged once).
 * Unknown ipc-send channels are swallowed (logged once).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MenuOptionsType } from '../../vendor/ts/types/menu.std.ts';
import { getOptionalResource } from './optionalResources.node.ts';

// Type for optional SQL remove-db callback (set by index.node.ts)
type RemoveDbFn = () => Promise<void>;
let _removeDbFn: RemoveDbFn | null = null;

export function setRemoveDbFn(fn: RemoveDbFn): void {
  _removeDbFn = fn;
}

// ---- settings store ----------------------------------------------------------

let _dataDir = '';
let _settingsCache: Record<string, unknown> | null = null;

export function initIpc(dataDir: string): void {
  _dataDir = dataDir;
}

function loadSettings(): Record<string, unknown> {
  if (_settingsCache != null) return _settingsCache;
  const path = join(_dataDir, 'settings.json');
  if (existsSync(path)) {
    try {
      _settingsCache = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
      return _settingsCache;
    } catch {
      // fall through
    }
  }
  _settingsCache = {};
  return _settingsCache;
}

function saveSettings(): void {
  if (_settingsCache == null) return;
  const path = join(_dataDir, 'settings.json');
  mkdirSync(_dataDir, { recursive: true });
  writeFileSync(path, JSON.stringify(_settingsCache, null, 2), 'utf-8');
}

// Sensible defaults for settings
const SETTING_DEFAULTS: Record<string, unknown> = {
  themeSetting: 'system',
  localeOverride: null,
  spellCheck: true,
  contentProtection: false,
  systemTraySetting: 'MinimizeToSystemTray',
  mediaPermissions: false,
  mediaCameraPermissions: false,
  autoLaunch: false,
  zoomFactor: 1,
  audioMessage: false,
  audioNotification: false,
  badge: undefined,
  callRingtoneNotification: true,
  callSystemNotification: true,
  countMutedConversations: false,
  hideMenuBar: false,
  incomingCallNotification: true,
  messageSoundsEnabled: true,
  notificationDrawAttention: true,
  notificationSetting: 'message',
  preferredAudioInputDevice: undefined,
  preferredAudioOutputDevice: undefined,
  preferredVideoInputDevice: undefined,
  sentMediaQualitySetting: 'standard',
  textFormatting: true,
  hasStoriesDisabled: false,
  storyViewReceiptsEnabled: true,
  phoneNumberDiscoverability: 'discoverable',
  phoneNumberSharingMode: 'nobody',
};

// ---- unknown channel tracking -----------------------------------------------

const _warnedChannels = new Set<string>();
const _warnedSendChannels = new Set<string>();

function warnOnce(channel: string): void {
  if (!_warnedChannels.has(channel)) {
    _warnedChannels.add(channel);
    console.warn(`[ipc] Unknown invoke channel (will return error): ${channel}`);
  }
}

export function warnSendOnce(channel: string): void {
  if (!_warnedSendChannels.has(channel)) {
    _warnedSendChannels.add(channel);
    console.warn(`[ipc-send] Unknown send channel (no-op): ${channel}`);
  }
}

// ---- MenuOptions default -----------------------------------------------------

function defaultMenuOptions(): MenuOptionsType {
  return {
    development: false,
    devTools: true,
    includeSetup: false,
    isNightly: false,
    isProduction: true,
    platform: process.platform,
  };
}

// ---- main invoke handler -----------------------------------------------------

export async function handleIpcInvoke(
  channel: string,
  args: ReadonlyArray<unknown>
): Promise<unknown> {
  // --- settings:get:<name> ---
  const getMatch = channel.match(/^settings:get:(.+)$/);
  if (getMatch) {
    const name = getMatch[1];
    const settings = loadSettings();
    if (Object.prototype.hasOwnProperty.call(settings, name)) {
      return settings[name];
    }
    return SETTING_DEFAULTS[name] ?? null;
  }

  // --- settings:set:<name> ---
  const setMatch = channel.match(/^settings:set:(.+)$/);
  if (setMatch) {
    const name = setMatch[1];
    const value = args[0];
    const settings = loadSettings();
    settings[name] = value;
    saveSettings();
    return value;
  }

  // --- window state ---
  if (channel === 'getMainWindowStats') {
    return { isMaximized: false, isFullScreen: false };
  }

  // --- zoom (browser zoom is user-controlled) ---
  if (channel === 'getZoomFactor') {
    return 1;
  }
  if (channel === 'setZoomFactor' || channel === 'zoomReset') {
    return undefined;
  }

  // --- optional resources (emoji search index, jumbo emoji font) ---
  if (channel === 'OptionalResourceService:getData') {
    const name = String(args[0]);
    const data = await getOptionalResource(name);
    if (data != null) {
      return data;
    }
    // Degrade gracefully when the CDN is unreachable: emoji search
    // indexes are JSON arrays, and an empty one is schema-valid
    // (ts/windows/context.preload.ts getLocalizedEmojiList).
    if (name.startsWith('emoji-index-')) {
      return new TextEncoder().encode('[]');
    }
    return undefined;
  }

  // --- orphaned attachment cleanup (attachments live on the server) ---
  if (channel === 'cleanup-orphaned-attachments') {
    return undefined;
  }

  // --- menu options ---
  if (channel === 'getMenuOptions') {
    return defaultMenuOptions();
  }

  // --- executeMenuRole / noop calls ---
  if (
    channel === 'executeMenuRole' ||
    channel === 'restart' ||
    channel === 'set-badge' ||
    channel === 'draw-attention' ||
    channel === 'show-window' ||
    channel === 'signal-app-loaded' ||
    channel === 'ready-for-updates' ||
    channel === 'windows-notifications:clear-all' ||
    channel === 'set-auto-hide-menu-bar' ||
    channel === 'set-menu-bar-visibility'
  ) {
    return undefined;
  }

  // --- set-auto-launch ---
  if (channel === 'set-auto-launch') {
    return undefined;
  }

  // --- get-auto-launch ---
  if (channel === 'get-auto-launch') {
    return false;
  }

  // --- media access (no real access on server) ---
  if (channel === 'get-media-access-status') {
    return 'denied';
  }
  if (channel === 'open-system-media-permissions') {
    return undefined;
  }

  // --- debug logs ---
  if (channel === 'DebugLogs.getLogs') {
    return '-- Signal Web debug log --\n(no logs available)\n';
  }
  if (channel === 'DebugLogs.upload') {
    throw Object.assign(new Error('DebugLogs.upload is not supported in Signal Web'), {
      name: 'SignalWebUnsupportedIpc',
    });
  }

  // --- sql-channel:remove-db (ts/sql/channels.preload.ts) ---
  if (channel === 'sql-channel:remove-db') {
    if (_removeDbFn) {
      await _removeDbFn();
    }
    return undefined;
  }

  // --- crash reports (stubs) ---
  if (channel === 'crash-reports:get-count') return 0;
  if (channel === 'crash-reports:write-to-log') return undefined;
  if (channel === 'crash-reports:erase') return undefined;

  // --- windows notifications (stubs) ---
  if (channel === 'windows-notifications:show') return undefined;
  if (channel === 'windows-notifications:clear-all') return undefined;

  // --- permissions (stubs) ---
  if (channel === 'show-permissions-popup') return undefined;

  // --- unknown ---
  warnOnce(channel);
  const err = new Error(`IPC channel not supported in Signal Web: ${channel}`);
  err.name = 'SignalWebUnsupportedIpc';
  throw err;
}
