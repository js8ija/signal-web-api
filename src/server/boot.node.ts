// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Builds the BootPayload served at GET /api/boot.
 *
 * Replicates the config + locale logic from app/main.main.ts and
 * app/locale.node.ts without touching Electron.
 *
 * Config: default.json + <env>.json deep-merged (same as the `config` npm
 * package precedence). rendererConfigSchema is validated before returning.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

import { rendererConfigSchema } from '../../vendor/ts/types/RendererConfig.std.ts';
import type { BootPayload } from '../bridge/protocol.std.ts';
import { getAssetsRoot } from './paths.node.ts';

const EXPIRY_WARN_MS = 14 * 24 * 60 * 60 * 1000;
let lastBuildExpiration = 0;

export function getBuildExpiration(): number {
  return lastBuildExpiration;
}

export function listAvailableSignalEnvs(repoRoot = getAssetsRoot()): string[] {
  const dir = join(repoRoot, 'config');
  try {
    return readdirSync(dir)
      .filter(name => name.endsWith('.json') && !name.startsWith('local-') && name !== 'default.json')
      .map(name => name.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}

export function assertSignalEnvConfigExists(env: string, repoRoot = getAssetsRoot()): string {
  const envCfgPath = join(repoRoot, 'config', `${env}.json`);
  if (!existsSync(envCfgPath)) {
    const available = listAvailableSignalEnvs(repoRoot);
    throw new Error(
      `Missing config/${env}.json for SIGNAL_ENV=${env}. Available environments: ${
        available.length > 0 ? available.join(', ') : '(none)'
      }`
    );
  }
  return envCfgPath;
}

/** Strip userinfo from a proxy URL so credentials never enter /api/boot (H2). */
export function stripProxyUserinfo(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
    }
    return u.href;
  } catch {
    return raw;
  }
}

export function allowInvalidRendererConfig(): boolean {
  const raw = process.env.SIGNAL_ALLOW_INVALID_CONFIG?.trim();
  return raw === '1' || raw === 'true';
}

export function logBuildExpiration(expirationMs: number): void {
  if (!Number.isFinite(expirationMs) || expirationMs <= 0) {
    console.warn('[boot] buildExpiration is missing or zero');
    return;
  }
  const when = new Date(expirationMs).toISOString();
  const remaining = expirationMs - Date.now();
  if (remaining <= 0) {
    console.warn(`[boot] buildExpiration ${when} is in the past — renderer will hard-stop`);
  } else if (remaining <= EXPIRY_WARN_MS) {
    console.warn(
      `[boot] buildExpiration ${when} is within ${Math.ceil(remaining / 86400000)} days`
    );
  } else {
    console.log(`[boot] buildExpiration ${when}`);
  }
}

// ---- helpers -----------------------------------------------------------------

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const [key, val] of Object.entries(source)) {
    if (val != null && typeof val === 'object' && !Array.isArray(val) &&
        result[key] != null && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function getConfigValue<T>(cfg: Record<string, unknown>, path: string): T {
  const parts = path.split('.');
  let cur: unknown = cfg;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined as T;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur as T;
}

// ---- locale loading ----------------------------------------------------------

type LocaleMessages = Record<string, { messageformat?: string | undefined }>;

function loadLocale(locale: string): LocaleMessages {
  const repoRoot = getAssetsRoot();
  // Use compact-locales (packaged format)
  const keysPath = join(repoRoot, 'build', 'compact-locales', 'keys.json');
  const enValuesPath = join(repoRoot, 'build', 'compact-locales', 'en', 'values.json');

  if (!existsSync(keysPath) || !existsSync(enValuesPath)) {
    // Fall back to _locales JSON
    try {
      const msgs = readJson<Record<string, { messageformat?: string }>>(
        join(repoRoot, '_locales', locale, 'messages.json')
      );
      const enMsgs = readJson<Record<string, { messageformat?: string }>>(
        join(repoRoot, '_locales', 'en', 'messages.json')
      );
      return { ...enMsgs, ...msgs };
    } catch {
      return {};
    }
  }

  const keys = readJson<string[]>(keysPath);
  const enValues = readJson<(string | null)[]>(enValuesPath);

  let localeValues: (string | null)[] = enValues;
  const localePath = join(repoRoot, 'build', 'compact-locales', locale, 'values.json');
  if (existsSync(localePath)) {
    try {
      localeValues = readJson<(string | null)[]>(localePath);
    } catch {
      localeValues = enValues;
    }
  }

  const messages: LocaleMessages = Object.create(null);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const value = localeValues[i] ?? enValues[i];
    if (value != null) {
      messages[key] = { messageformat: value };
    }
  }
  return messages;
}

function getAvailableLocales(): string[] {
  const path = join(getAssetsRoot(), 'build', 'available-locales.json');
  if (existsSync(path)) return readJson<string[]>(path);
  return ['en'];
}

function matchLocale(preferred: string[], available: string[]): string {
  const availSet = new Set(available);
  for (const loc of preferred) {
    if (availSet.has(loc)) return loc;
    // Try language-only match
    const lang = loc.split('-')[0];
    if (lang && availSet.has(lang)) return lang;
    // Try first match by language prefix
    const match = available.find(a => a.startsWith(lang + '-'));
    if (match) return match;
  }
  return 'en';
}

function getLocaleDirection(localeName: string): 'ltr' | 'rtl' {
  try {
    return (new Intl.Locale(localeName).getTextInfo() as { direction: string }).direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

function getHourCyclePreference(localeName: string): 'Prefer24' | 'Prefer12' | 'UnknownPreference' {
  try {
    const locale = new Intl.Locale(localeName);
    const hc = (locale.hourCycles ?? [])[0];
    if (hc === 'h11' || hc === 'h12') return 'Prefer12';
    if (hc === 'h23' || hc === 'h24') return 'Prefer24';
  } catch {
    // ignore
  }
  return 'UnknownPreference';
}

// ---- main build function -----------------------------------------------------

export type BootOptions = {
  env: string;
  dataDir: string;
  localeHint: string;
  nativeManifest: Record<string, 'sync' | 'async'>;
};

export function buildBootPayload(opts: BootOptions): BootPayload {
  const { env, dataDir, localeHint, nativeManifest } = opts;
  const repoRoot = getAssetsRoot();

  // --- config layer merge ---
  const defaultCfg = readJson<Record<string, unknown>>(
    join(repoRoot, 'config', 'default.json')
  );
  const envCfgPath = assertSignalEnvConfigExists(env, repoRoot);
  let envCfg: Record<string, unknown> = {};
  try {
    envCfg = readJson<Record<string, unknown>>(envCfgPath);
  } catch (error) {
    throw new Error(
      `[boot] Could not read config/${env}.json: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  let cfg = deepMerge(defaultCfg, envCfg);

  // local-<env>.json carries buildCreation/buildExpiration written by
  // `pnpm run get-expire-time` (same precedence as the `config` package).
  const localCfgPath = join(repoRoot, 'config', `local-${env}.json`);
  if (existsSync(localCfgPath)) {
    try {
      cfg = deepMerge(cfg, readJson<Record<string, unknown>>(localCfgPath));
    } catch {
      console.warn(`[boot] Could not read config/local-${env}.json`);
    }
  }

  // --- package.json ---
  const pkgJson = readJson<{ version: string; productName: string }>(
    join(repoRoot, 'package.json')
  );

  // --- locale ---
  const availableLocales = getAvailableLocales();
  const preferredLocales = localeHint ? [localeHint] : ['en'];
  const resolvedLocale = matchLocale(preferredLocales, availableLocales);
  const direction = getLocaleDirection(resolvedLocale);
  const hourCyclePreference = getHourCyclePreference(resolvedLocale);

  const messages = loadLocale(resolvedLocale);

  // locale display names
  let localeDisplayNames: unknown = {};
  try {
    const ldnPath = join(repoRoot, 'build', 'locale-display-names.json');
    if (existsSync(ldnPath)) {
      localeDisplayNames = readJson<unknown>(ldnPath);
    }
  } catch { /* ok */ }

  // country display names
  let countryDisplayNames: unknown = {};
  try {
    const cdnPath = join(repoRoot, 'build', 'country-display-names.json');
    if (existsSync(cdnPath)) {
      countryDisplayNames = readJson<unknown>(cdnPath);
    }
  } catch { /* ok */ }

  // --- DNS fallback ---
  let dnsFallback: unknown[] = [];
  try {
    const dnsPath = join(repoRoot, 'build', 'dns-fallback.json');
    if (existsSync(dnsPath)) {
      dnsFallback = readJson<unknown[]>(dnsPath);
    }
  } catch { /* ok */ }

  // --- directory config ---
  const directoryUrl = getConfigValue<string>(cfg, 'directoryUrl') ?? 'https://cdsi.signal.org';
  const directoryMRENCLAVE = getConfigValue<string>(cfg, 'directoryMRENCLAVE') ?? '';

  // --- build get-config payload ---
  const rawConfig = {
    name: pkgJson.productName,
    availableLocales,
    resolvedTranslationsLocale: resolvedLocale,
    resolvedTranslationsLocaleDirection: direction,
    hourCyclePreference,
    preferredSystemLocales: preferredLocales,
    localeOverride: null,
    version: pkgJson.version,
    buildCreation: getConfigValue<number>(cfg, 'buildCreation') ?? 0,
    buildExpiration: getConfigValue<number>(cfg, 'buildExpiration') ?? 0,
    challengeUrl: getConfigValue<string>(cfg, 'challengeUrl') ?? 'https://signalcaptchas.org/challenge/generate.html',
    serverUrl: getConfigValue<string>(cfg, 'serverUrl') ?? 'https://chat.signal.org',
    storageUrl: getConfigValue<string>(cfg, 'storageUrl') ?? 'https://storage.signal.org',
    updatesUrl: getConfigValue<string>(cfg, 'updatesUrl') ?? 'https://updates2.signal.org/desktop',
    resourcesUrl: getConfigValue<string>(cfg, 'resourcesUrl') ?? 'https://updates2.signal.org',
    cdnUrl0: getConfigValue<string>(cfg, 'cdn.0') ?? 'https://cdn.signal.org',
    cdnUrl2: getConfigValue<string>(cfg, 'cdn.2') ?? 'https://cdn2.signal.org',
    cdnUrl3: getConfigValue<string>(cfg, 'cdn.3') ?? 'https://cdn3.signal.org',
    certificateAuthority: getConfigValue<string>(cfg, 'certificateAuthority') ?? '',
    environment: env,
    isMockTestEnvironment: false,
    ciMode: false,
    ciForceUnprocessed: getConfigValue<boolean>(cfg, 'ciForceUnprocessed') ?? false,
    devTools: true,
    dnsFallback,
    disableIPv6: false,
    disableScreenSecurity: false,
    nodeVersion: process.versions.node,
    hostname: 'localhost',
    osRelease: os.release(),
    osVersion: os.version(),
    // Optional string fields: use undefined to omit (msgpack would encode undefined as null which fails schema)
    ...(process.env.NODE_APP_INSTANCE ? { appInstance: process.env.NODE_APP_INSTANCE } : {}),
    ...((process.env.HTTPS_PROXY || process.env.https_proxy)
      ? { proxyUrl: stripProxyUserinfo((process.env.HTTPS_PROXY || process.env.https_proxy) as string) }
      : {}),
    contentProxyUrl: getConfigValue<string>(cfg, 'contentProxyUrl') ?? 'http://contentproxy.signal.org:443',
    sfuUrl: getConfigValue<string>(cfg, 'sfuUrl') ?? 'https://sfu.voip.signal.org/',
    reducedMotionSetting: false,
    registrationChallengeUrl: getConfigValue<string>(cfg, 'registrationChallengeUrl') ?? 'https://signalcaptchas.org/registration/generate.html',
    serverPublicParams: getConfigValue<string>(cfg, 'serverPublicParams') ?? '',
    serverTrustRoots: getConfigValue<string[]>(cfg, 'serverTrustRoots') ?? [],
    stripePublishableKey: getConfigValue<string>(cfg, 'stripePublishableKey') ?? '',
    genericServerPublicParams: getConfigValue<string>(cfg, 'genericServerPublicParams') ?? '',
    backupServerPublicParams: getConfigValue<string>(cfg, 'backupServerPublicParams') ?? '',
    theme: 'system' as const,
    appStartInitialSpellcheckSetting: false,

    crashDumpsPath: join(dataDir, 'crashDumps'),
    homePath: '/home/user',
    installPath: repoRoot,
    userDataPath: dataDir,

    directoryConfig: { directoryUrl, directoryMRENCLAVE },

    isMainWindowFullScreen: false,
    isMainWindowMaximized: false,

    argv: '[]',
  };

  lastBuildExpiration = Number(rawConfig.buildExpiration) || 0;
  logBuildExpiration(lastBuildExpiration);
  console.log(
    `[boot] endpoints serverUrl=${String(rawConfig.serverUrl)} storageUrl=${String(rawConfig.storageUrl)} directoryUrl=${directoryUrl}`
  );

  // Validate against schema
  const parsed = rendererConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    const flat = JSON.stringify(parsed.error.flatten(), null, 2);
    console.error('[boot] rendererConfigSchema validation errors:', flat);
    if (!allowInvalidRendererConfig()) {
      throw new Error(`rendererConfigSchema validation failed:\n${flat}`);
    }
    console.warn('[boot] SIGNAL_ALLOW_INVALID_CONFIG set — serving invalid config');
  }

  // Strip undefined values — msgpack encodes undefined as null which breaks schema validation
  function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined)
    );
  }

  const getConfig = parsed.success
    ? stripUndefined(parsed.data as unknown as Record<string, unknown>)
    : stripUndefined(rawConfig as Record<string, unknown>);

  // NativeThemeState — see ts/main/NativeThemeNotifier.main.ts getState()
  const nativeThemeState = { shouldUseDarkColors: false };

  return {
    sync: {
      'get-config': getConfig,
      'locale-data': messages,
      'locale-display-names': localeDisplayNames,
      'country-display-names': countryDisplayNames,
      'OS.getClassName': 'Gnome',  // Linux Gnome class — sensible web default
      'get-user-data-path': dataDir,
      'native-theme:init': nativeThemeState,
    },
    nativeManifest,
  };
}
