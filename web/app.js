// Copyright 2026 Signal Web contributors
// SPDX-License-Identifier: AGPL-3.0-only

const STORAGE_ORIGIN = 'signal-web-api.origin';
const STORAGE_TOKEN = 'signal-web-api.token';

function isLoopbackHostname(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

function canonicalizeLoopbackApiOrigin(raw) {
  let url;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (url.username || url.password) return undefined;
  if (!isLoopbackHostname(url.hostname)) return undefined;
  return url.origin;
}

function readParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

function parseLaunchParams(search, hash) {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const fromHash = new URLSearchParams(rawHash.startsWith('?') ? rawHash.slice(1) : rawHash);
  const originRaw =
    readParam(query, ['apiOrigin', 'api', 'apiUrl', 'localApi']) ||
    readParam(fromHash, ['apiOrigin', 'api', 'apiUrl', 'localApi']);
  const tokenRaw = readParam(query, ['token']) || readParam(fromHash, ['token']);
  return {
    apiOrigin: originRaw ? canonicalizeLoopbackApiOrigin(originRaw) : undefined,
    token: tokenRaw && /^[0-9a-f]{64}$/i.test(tokenRaw) ? tokenRaw : undefined,
  };
}

function resolveRemoteApi() {
  const fromUrl = parseLaunchParams(location.search, location.hash);
  let storedOrigin;
  let storedToken;
  try {
    storedOrigin = sessionStorage.getItem(STORAGE_ORIGIN) || undefined;
    storedToken = sessionStorage.getItem(STORAGE_TOKEN) || undefined;
  } catch {
    /* ignore */
  }
  const origin =
    fromUrl.apiOrigin ||
    canonicalizeLoopbackApiOrigin(storedOrigin || '') ||
    canonicalizeLoopbackApiOrigin(location.origin);
  if (!origin) return undefined;
  const token = fromUrl.token || storedToken;
  return token ? { origin, token } : { origin };
}

function persistLaunch(api) {
  try {
    sessionStorage.setItem(STORAGE_ORIGIN, api.origin);
    if (api.token) sessionStorage.setItem(STORAGE_TOKEN, api.token);
    else sessionStorage.removeItem(STORAGE_TOKEN);
  } catch {
    /* ignore */
  }
  const url = new URL(location.href);
  url.searchParams.set('apiOrigin', api.origin);
  url.searchParams.delete('token');
  url.hash = '';
  history.replaceState(history.state, '', `${url.pathname}${url.search}`);
}

function $(id) {
  return document.getElementById(id);
}

function setStatus(state, title, detail) {
  $('dot').dataset.state = state;
  $('status-title').textContent = title;
  $('status-detail').textContent = detail;
}

function logLine(message, cls) {
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  $('log').prepend(li);
}

function headers(api) {
  return api.token ? { Authorization: `Bearer ${api.token}` } : {};
}

async function readJson(url, api, extra = {}) {
  const res = await fetch(url, {
    ...extra,
    headers: { ...headers(api), ...(extra.headers || {}) },
    credentials: 'omit',
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function connect(api) {
  persistLaunch(api);
  $('api-origin').textContent = api.origin;
  $('api-input').value = api.origin;
  setStatus('busy', '正在连接本地桥接…', api.origin);
  logLine(`health ${api.origin}/api/health`);

  const health = await readJson(`${api.origin}/api/health`, api);
  $('api-auth').textContent = health.auth ? '需要 token' : '已关闭（仅 loopback 配对）';
  $('api-session').textContent = health.serverSessionId || '—';
  logLine(`health ok version=${health.version || '?'} auth=${health.auth}`, 'ok');

  if (!api.token) {
    logLine('GET /api/connect 领取本机 token');
    const pair = await readJson(`${api.origin}/api/connect`, api);
    if (!pair?.token || !/^[0-9a-f]{64}$/i.test(pair.token)) {
      throw new Error('配对接口没有返回 64-hex token');
    }
    api.token = pair.token;
    persistLaunch(api);
    logLine('已领取 token（不会写进线上站点的查询串）', 'ok');
  }

  logLine('GET /api/boot');
  const boot = await readJson(`${api.origin}/api/boot`, api);
  const session = boot.serverSessionId || health.serverSessionId;
  $('api-session').textContent = session || '—';
  logLine(`boot ok session=${session || '?'}`, 'ok');

  const wsUrl = new URL('/api/bridge', api.origin.replace(/^http/, 'ws'));
  if (api.token) wsUrl.searchParams.set('token', api.token);
  logLine(`WS ${wsUrl.origin}${wsUrl.pathname}`);

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket 超时'));
    }, 8000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      logLine('WebSocket 已打开', 'ok');
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket 失败（检查 Origin 白名单 / SIGNAL_WEB_UI_URL）'));
    });
    ws.addEventListener('message', () => {
      clearTimeout(timer);
      ws.close();
      resolve();
    });
  });

  setStatus('ok', '已连上本机桥接', '线上页面正在和 127.0.0.1 通信。');
}

function launchHref(api) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('apiOrigin', api.origin);
  return url.toString();
}

function boot() {
  const initial = resolveRemoteApi();
  if (initial) {
    $('api-input').value = initial.origin;
    connect(initial).catch(error => {
      setStatus('bad', '连接失败', error.message);
      logLine(error.message, 'bad');
    });
  } else {
    setStatus(
      'idle',
      '等待本地地址',
      '把本页放到线上后，用 ?apiOrigin=http://127.0.0.1:8915 打开。'
    );
  }

  $('connect-btn').addEventListener('click', () => {
    const origin = canonicalizeLoopbackApiOrigin($('api-input').value);
    if (!origin) {
      setStatus('bad', '地址不合法', '只接受 http(s)://127.0.0.1|localhost|::1');
      return;
    }
    connect({ origin }).catch(error => {
      setStatus('bad', '连接失败', error.message);
      logLine(error.message, 'bad');
    });
  });

  $('copy-btn').addEventListener('click', async () => {
    const origin = canonicalizeLoopbackApiOrigin($('api-input').value) || resolveRemoteApi()?.origin;
    if (!origin) return;
    const href = launchHref({ origin });
    try {
      await navigator.clipboard.writeText(href);
      logLine(`已复制 ${href}`, 'ok');
    } catch {
      logLine(href);
    }
  });
}

boot();
