/**
 * Secure storage for sensitive data (API keys)
 * Keeps secrets in sessionStorage (cleared on tab close) instead of localStorage.
 */

const SESSION_KEY = "journeyai.secure";

/** Get the secure store object from sessionStorage */
function getStore() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_e) {
    return {};
  }
}

/** Save the secure store object to sessionStorage */
function saveStore(obj) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj));
  } catch (_e) {
    // sessionStorage full or blocked — degrade gracefully
  }
}

/** Store an API key for a given provider */
export function setApiKey(key, provider) {
  const store = getStore();
  const p = provider || "gemini";
  if (key) {
    store[p + "_apiKey"] = key;
    if (p === "gemini") store.apiKey = key;
  } else {
    delete store[p + "_apiKey"];
    if (p === "gemini") delete store.apiKey;
  }
  saveStore(store);
}

/** Retrieve the stored API key for a given provider */
export function getApiKey(provider) {
  const store = getStore();
  const p = provider || "gemini";
  return store[p + "_apiKey"] || (p === "gemini" ? store.apiKey : "") || "";
}

/** Clear the stored API key for a given provider */
export function clearApiKey(provider) {
  const store = getStore();
  const p = provider || "gemini";
  delete store[p + "_apiKey"];
  if (p === "gemini") delete store.apiKey;
  saveStore(store);
}

/** Check if an API key is stored for a given provider */
export function hasApiKey(provider) {
  const store = getStore();
  const p = provider || "gemini";
  return !!(store[p + "_apiKey"] || store.apiKey);
}

/**
 * Patch the Store module to keep apiKey out of localStorage.
 * Call this after Store.load() to hydrate the in-memory key from sessionStorage.
 * Falls back to the built-in default key when no user key is stored.
 */
export function hydrateKey(settings) {
  if (settings) {
    const provider = settings.provider || "gemini";
    settings.apiKey = getApiKey(provider) || "";
  }
}

/**
 * Patch the Store module to strip apiKey before persisting to localStorage.
 * Call this before Store.persist() to remove the key from the serialized data.
 */
export function stripKey(db) {
  if (db && db.settings) {
    db.settings.apiKey = "";
  }
}
