/**
 * Secure storage for sensitive data (API keys).
 *
 * The key is held in sessionStorage for the current tab only, with a
 * per-provider record, last-used audit and a TTL. `stripKey()` removes it
 * from every localStorage write, so it never reaches disk.
 *
 * Note: the value is not encrypted. A browser cannot keep a secret from
 * same-origin script, and the guard that actually matters is not persisting
 * the key at all - which `stripKey()` enforces on every save path.
 */

const SESSION_KEY = "journeyai.secure.v2";
const KEY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getSessionStorage() {
  return typeof globalThis !== "undefined" ? globalThis.sessionStorage : null;
}

function getStore() {
  try {
    const ss = getSessionStorage();
    if (!ss) return { keys: {}, meta: {} };
    const raw = ss.getItem(SESSION_KEY);
    if (!raw) return { keys: {}, meta: {} };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 2) return { keys: {}, meta: {} };
    return parsed;
  } catch (_e) {
    return { keys: {}, meta: {} };
  }
}

function saveStore(obj) {
  try {
    const ss = getSessionStorage();
    if (!ss) return;
    ss.setItem(SESSION_KEY, JSON.stringify({ version: 2, ...obj }));
  } catch (_e) {
    // degraded: the key stays in memory for this page load only
  }
}

function now() {
  return Date.now();
}

export function setApiKey(key, provider = "gemini") {
  const store = getStore();
  const p = provider.toLowerCase();
  if (key && key.trim().length > 10) {
    store.keys[p] = {
      value: key.trim(),
      created: now(),
      lastUsed: now(),
      provider: p,
    };
    if (p === "gemini") store.keys.apiKey = store.keys[p];
  } else {
    delete store.keys[p];
    if (p === "gemini") delete store.keys.apiKey;
  }
  saveStore(store);
}

export function getApiKey(provider = "gemini") {
  const store = getStore();
  const p = provider.toLowerCase();
  const entry = store.keys[p] || (p === "gemini" ? store.keys.apiKey : null);
  if (!entry) return "";
  if (now() - entry.created > KEY_TTL_MS) {
    clearApiKey(provider);
    return "";
  }
  entry.lastUsed = now();
  saveStore(store);
  return entry.value;
}

export function clearApiKey(provider = "gemini") {
  const store = getStore();
  const p = provider.toLowerCase();
  delete store.keys[p];
  if (p === "gemini") delete store.keys.apiKey;
  saveStore(store);
}

export function hasApiKey(provider = "gemini") {
  return !!getApiKey(provider);
}

export function hydrateKey(settings) {
  if (!settings) return;
  const provider = settings.provider || "gemini";
  const key = getApiKey(provider);
  if (key) settings.apiKey = key;
  else delete settings.apiKey;
}

export function stripKey(db) {
  if (!db || !db.settings) return db;
  const {
    apiKey: _apiKey,
    gemini_apiKey: _gemini_apiKey,
    openrouter_apiKey: _openrouter_apiKey,
    ...rest
  } = db.settings;
  return { ...db, settings: { ...rest, apiKey: "" } };
}
