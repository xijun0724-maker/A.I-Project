/**
 * Minimal in-memory IndexedDB stand-in for vitest (happy-dom has none).
 * Implements only the surface `src/core/idb.js` uses.
 */

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeRequest() {
  return {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: undefined,
    error: null,
  };
}

function fire(req, value) {
  Promise.resolve().then(function () {
    req.result = value;
    if (req.onsuccess) req.onsuccess({ target: req });
  });
}

function fail(req, err) {
  Promise.resolve().then(function () {
    req.error = err;
    if (req.onerror) req.onerror({ target: req });
  });
}

export function createFakeIDB() {
  /** @type {Map<string, Map<string, any>>} db name → store name → entries */
  const databases = new Map();

  function getDB(name) {
    let db = databases.get(name);
    if (!db) {
      db = { name: name, stores: new Map(), closed: false };
      databases.set(name, db);
      return { db: db, isNew: true };
    }
    return { db: db, isNew: false };
  }

  function wrapDB(entry) {
    const raw = entry.db;
    return {
      get objectStoreNames() {
        return {
          contains: function (n) {
            return raw.stores.has(n);
          },
        };
      },
      createObjectStore: function (n) {
        if (!raw.stores.has(n)) raw.stores.set(n, new Map());
        return makeStoreHandle(raw, n);
      },
      transaction: function (storeName) {
        if (!raw.stores.has(storeName)) {
          throw new Error("store not found: " + storeName);
        }
        return {
          error: null,
          onabort: null,
          objectStore: function (n) {
            if (!raw.stores.has(n)) throw new Error("store not found: " + n);
            return makeStoreHandle(raw, n);
          },
        };
      },
      close: function () {
        raw.closed = true;
      },
    };
  }

  function makeStoreHandle(raw, storeName) {
    return {
      get: function (key) {
        const req = makeRequest();
        const map = raw.stores.get(storeName);
        fire(req, map ? clone(map.get(key)) : undefined);
        return req;
      },
      put: function (value, key) {
        const req = makeRequest();
        const map = raw.stores.get(storeName);
        if (!map) {
          fail(req, new Error("store missing"));
          return req;
        }
        map.set(key, clone(value));
        fire(req, key);
        return req;
      },
      delete: function (key) {
        const req = makeRequest();
        const map = raw.stores.get(storeName);
        if (map) map.delete(key);
        fire(req, undefined);
        return req;
      },
    };
  }

  const idb = {
    open: function (name) {
      const req = makeRequest();
      Promise.resolve().then(function () {
        const entry = getDB(name);
        const dbHandle = wrapDB(entry);
        req.result = dbHandle;
        if (entry.isNew && req.onupgradeneeded) {
          req.onupgradeneeded({ target: req });
        }
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
    /** Test helpers */
    _databases: databases,
    _reset: function () {
      databases.clear();
    },
  };
  return idb;
}

/** Install as globalThis.indexedDB; returns a restore function. */
export function installFakeIDB() {
  const fake = createFakeIDB();
  const prev = globalThis.indexedDB;
  globalThis.indexedDB = fake;
  return function restore() {
    if (prev === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = prev;
    fake._reset();
  };
}
