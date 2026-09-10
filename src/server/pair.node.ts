// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Pairing helpers: hosted UI URL + loopback apiOrigin.
 * The public page is opened as `${SIGNAL_WEB_UI_URL}?apiOrigin=http://127.0.0.1:<port>`.
 */

import { getWebUiUrl } from './paths.node.ts';

export function publicApiOrigin(boundPort: number): string {
  return `http://127.0.0.1:${boundPort}`;
}

export function webUiOriginFromEnv(): string | undefined {
  const raw = getWebUiUrl();
  if (!raw) {
    return undefined;
  }
  try {
    const origin = new URL(raw).origin;
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}

export function buildUiLaunchUrl(boundPort: number, token?: string): string {
  const apiOrigin = publicApiOrigin(boundPort);
  const raw = getWebUiUrl();
  const url = raw ? new URL(raw) : new URL(`${apiOrigin}/`);
  url.searchParams.set('apiOrigin', apiOrigin);
  if (token) {
    url.hash = new URLSearchParams({ token }).toString();
  }
  return url.toString();
}

export type ConnectPayload = {
  ok: true;
  apiOrigin: string;
  token: string;
  uiUrl: string;
  auth: boolean;
};

export function connectPayload(
  boundPort: number,
  token: string,
  auth: boolean
): ConnectPayload {
  return {
    ok: true,
    apiOrigin: publicApiOrigin(boundPort),
    token,
    uiUrl: buildUiLaunchUrl(boundPort),
    auth,
  };
}
