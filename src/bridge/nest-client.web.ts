// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * LeanScrm Nest / ChatKnow HTTP client (staged adapter).
 * Used by the Signal Web chrome overlay (nest-wire.js) and as the seed
 * replacement for ochen1 bridge messaging once the Desktop protocol path
 * is retired for LeanScrm product builds.
 */

export type LinkedCredentials = {
  username: string;
  password: string;
  deviceId: number;
  aci: string;
  pni: string;
  number: string;
};

export type FinalizeResult = {
  credentials: LinkedCredentials;
  storageServiceKey: string;
  linkedPayload: Record<string, string>;
  deviceName: string;
  registrationIds: { aci: number; pni: number };
  syncedContacts: unknown[];
};

export type LinkedSession = FinalizeResult & {
  provisioningSessionId?: string;
  linkedAt: string;
};

export type NestConfig = {
  enabled: boolean;
  apiBase: string;
  proxyPath: string;
  clientBase: string;
};

export type NdjsonEvent = {
  type: string;
  sessionId?: string;
  message?: unknown;
  conversation?: unknown;
  [key: string]: unknown;
};

export const LINKED_SESSION_KEY = 'leanscrm.nest.linkedSession';

declare global {
  interface Window {
    __MY_RENDER_CONFIG__?: { apiBase?: string; nestProxy?: string | null; nestEnabled?: boolean };
    __LEAN_NEST__?: NestClient;
  }
}

export function resolveNestApiBase(config?: NestConfig | null): string {
  if (typeof window !== 'undefined') {
    try {
      const q = new URLSearchParams(window.location.search).get('apiBase');
      if (q) return q.replace(/\/$/, '');
    } catch {
      /* ignore */
    }
    const cfg = window.__MY_RENDER_CONFIG__;
    if (cfg?.apiBase) return cfg.apiBase.replace(/\/$/, '');
  }
  if (config?.clientBase) return config.clientBase.replace(/\/$/, '');
  if (config?.apiBase) return config.apiBase.replace(/\/$/, '');
  return 'http://127.0.0.1:3010';
}

export async function fetchNestConfig(): Promise<NestConfig | null> {
  try {
    const res = await fetch('/api/nest-config', {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as NestConfig;
  } catch {
    return null;
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class NestClient {
  apiBase: string;
  sessionId: string | null = null;
  linked: LinkedSession | null;
  #abort: AbortController | null = null;

  constructor(apiBase: string) {
    this.apiBase = apiBase.replace(/\/$/, '');
    this.linked = loadLinkedSession();
  }

  async adoptCli(deviceName = 'Signal Web Nest'): Promise<LinkedSession> {
    const q = encodeURIComponent(deviceName);
    const res = await fetch(
      `${this.apiBase}/provisioning/adopt-cli?deviceName=${q}`,
      { method: 'POST' }
    );
    const result = await json<FinalizeResult>(res);
    this.linked = { ...result, linkedAt: new Date().toISOString() };
    saveLinkedSession(this.linked);
    return this.linked;
  }


  async createProvisioning(): Promise<{
    id: string;
    state: string;
    provisioningUrl: string | null;
    createdAt: number;
    expiresAt: number;
    stub?: boolean;
    error?: string;
  }> {
    const res = await fetch(`${this.apiBase}/provisioning/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    return json(res);
  }

  async getProvisioning(id: string): Promise<{
    id: string;
    state: string;
    provisioningUrl: string | null;
    createdAt: number;
    expiresAt: number;
    linkedAccount?: { aci: string; pni: string; number: string };
    stub?: boolean;
    error?: string;
  }> {
    const res = await fetch(
      `${this.apiBase}/provisioning/sessions/${encodeURIComponent(id)}`
    );
    return json(res);
  }

  async finalizeProvisioning(
    id: string,
    deviceName = 'Signal Web Nest'
  ): Promise<LinkedSession> {
    const q = encodeURIComponent(deviceName);
    const res = await fetch(
      `${this.apiBase}/provisioning/sessions/${encodeURIComponent(id)}/finalize?deviceName=${q}`,
      { method: 'POST' }
    );
    const result = await json<FinalizeResult>(res);
    this.linked = {
      ...result,
      provisioningSessionId: id,
      linkedAt: new Date().toISOString(),
    };
    saveLinkedSession(this.linked);
    return this.linked;
  }

  async openStream(onEvent: (ev: NdjsonEvent) => void): Promise<void> {
    if (!this.linked?.credentials) {
      throw new Error('Not linked — adopt-cli or finalize first');
    }
    this.#abort?.abort();
    this.#abort = new AbortController();
    const creds = {
      username: this.linked.credentials.username,
      password: this.linked.credentials.password,
      storageServiceKey: this.linked.storageServiceKey,
      number: this.linked.credentials.number,
    };
    const res = await fetch(`${this.apiBase}/messages/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(creds),
      signal: this.#abort.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`stream ${res.status}: ${text || res.statusText}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const ev = JSON.parse(trimmed) as NdjsonEvent;
              if (ev.type === 'ready' && typeof ev.sessionId === 'string') {
                this.sessionId = ev.sessionId;
              }
              onEvent(ev);
            } catch {
              onEvent({ type: 'parse-error', message: trimmed });
            }
          }
        }
        onEvent({ type: 'stream-end' });
      } catch (err) {
        const e = err as { name?: string; message?: string };
        if (e?.name === 'AbortError') onEvent({ type: 'stream-aborted' });
        else onEvent({ type: 'stream-error', message: String(e?.message ?? err) });
      }
    })();
  }

  async send(destinationServiceId: string, message: string): Promise<unknown> {
    if (!this.sessionId) throw new Error('No sessionId — open stream first');
    const res = await fetch(`${this.apiBase}/messages/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        destinationServiceId,
        message,
        body: message,
      }),
    });
    return json(res);
  }

  async sendNoteToSelf(message: string): Promise<unknown> {
    if (!this.linked?.credentials) throw new Error('Not linked');
    const dest =
      this.linked.credentials.number || this.linked.credentials.aci;
    return this.send(dest, message);
  }

  unlink(): void {
    this.#abort?.abort();
    this.#abort = null;
    this.sessionId = null;
    this.linked = null;
    clearLinkedSession();
  }
}

export function loadLinkedSession(): LinkedSession | null {
  try {
    const raw = localStorage.getItem(LINKED_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LinkedSession;
  } catch {
    return null;
  }
}

export function saveLinkedSession(session: LinkedSession): void {
  localStorage.setItem(LINKED_SESSION_KEY, JSON.stringify(session));
}

export function clearLinkedSession(): void {
  localStorage.removeItem(LINKED_SESSION_KEY);
}
