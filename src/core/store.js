/**
 * Persistence layer for Journey A.I.
 *
 * localStorage is the synchronous bootstrap path (and the only path when
 * IndexedDB is unavailable, e.g. tests / happy-dom). IndexedDB mirrors every
 * successful persist with a larger capacity; `hydrateFromIDB()` restores from
 * it when localStorage is missing, unreadable, or older than the mirror.
 */

import { CFG } from "../config/constants.js";
import { debounce, fmtBytes, slug } from "../utils/helpers.js";
import { toast } from "../utils/dom.js";
import { createBlankDB, migrateSchema } from "../config/settings.js";
import { stripKey } from "../utils/secure.js";
import { idbAvailable, idbGet, idbSet } from "./idb.js";

// Sidecar key: last successful persist timestamp for the main DB key.
// Used to decide whether IndexedDB holds a newer snapshot than localStorage.
const AT_KEY = CFG.storageKey + ".at";

// Singleton database instance
let db = null;

/* Monotonic mirror revision. Bumped on every successful persist and stored
   with the IndexedDB record so hydrate can break timestamp ties and other
   tabs can tell a real write from a same-ms rewrite. */
let _rev = 0;

/* Set when stored data belongs to a newer app version or failed migration.
   While quarantined, persist() refuses to write so the newer bytes in
   localStorage are never overwritten by a blank/older schema. */
let _quarantined = false;

function isQuarantined() {
  return _quarantined;
}

/**
 * Lock the live database's top-level shape in tests and dev.
 *
 * `Object.seal` allows reassigning schema keys (`db.courses = []`) but throws
 * in strict mode when code invents a new root key (`db.coursez = []`) — the
 * typo class of bug that silently never persists. Production stays unsealed so
 * a future migration can add keys before they land in `createBlankDB`.
 * @param {Object} d
 * @returns {Object} The same object, sealed when applicable
 */
function maybeSeal(d) {
  if (!d || typeof d !== "object") return d;
  try {
    const env =
      (typeof import.meta !== "undefined" && import.meta.env) || undefined;
    const privileged =
      (env && (env.DEV || env.MODE === "test")) ||
      (typeof process !== "undefined" &&
        process.env &&
        (process.env.NODE_ENV === "test" || process.env.VITEST));
    if (privileged) Object.seal(d);
  } catch (_e) {
    /* sealing is a development aid only */
  }
  return d;
}

// Event bus: lightweight pub/sub for Store changes
const listeners = {};

/**
 * Subscribe to a Store event.
 * @param {string} event - Event name (e.g. 'save', 'load', 'reset')
 * @param {Function} fn - Callback
 * @returns {Function} Unsubscribe function
 */
function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
  return function () {
    listeners[event] = listeners[event].filter(function (f) {
      return f !== fn;
    });
  };
}

/**
 * Emit a Store event.
 * @param {string} event - Event name
 * @param {*} data - Event payload
 */
function emit(event, data) {
  (listeners[event] || []).forEach(function (fn) {
    try {
      fn(data);
    } catch (e) {
      if (typeof console !== "undefined" && console.error)
        console.error('Store listener for "' + event + '" failed', e);
    }
  });
}

// Maximum localStorage key count before eviction
const MAX_STORAGE_KEYS = 200;

/**
 * Evict oldest Journey-owned keys when storage is near capacity.
 * Never touches other applications' keys on a shared origin.
 * Always keeps the main DB key and its timestamp sidecar.
 */
function evictIfNeeded() {
  try {
    let keys = Object.keys(localStorage).filter(function (k) {
      return k.startsWith("journeyai.");
    });
    if (keys.length < MAX_STORAGE_KEYS) return;
    // Drop oldest Journey keys first, but always keep the current DB key.
    for (let i = 0; i < keys.length && keys.length >= MAX_STORAGE_KEYS; i++) {
      const k = keys[i];
      if (k !== CFG.storageKey && k !== AT_KEY) {
        localStorage.removeItem(k);
        keys = keys.filter(function (x) {
          return x !== k;
        });
      }
    }
  } catch (_e) {
    console.warn("Store: eviction failed", _e);
  }
}

/**
 * Validate that an object is a plain, non-circular object safe for JSON serialization.
 */
function isValidData(value) {
  if (!value || typeof value !== "object") return false;
  try {
    const seen = new WeakSet();
    JSON.stringify(value, function (_key, val) {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return false;
        seen.add(val);
      }
      return val;
    });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Create a blank database with default settings.
 * Delegates to the schema module so there is a single source of truth.
 * @returns {Object} Blank database
 */
function blank() {
  return createBlankDB();
}

function deduplicateData(data) {
  let changed = false;
  function dedupe(list, keyOf, merge) {
    const seen = {};
    const out = [];
    (list || []).forEach(function (item) {
      const key = keyOf(item);
      if (!key || !seen[key]) {
        if (key) seen[key] = item;
        out.push(item);
        return;
      }
      changed = true;
      if (merge) merge(seen[key], item);
    });
    return out;
  }
  data.lessons = dedupe(
    data.lessons,
    function (lesson) {
      return [
        lesson.courseId || "",
        lesson.week == null ? "none" : lesson.week,
        slug(lesson.topic),
      ].join("|");
    },
    function (first, duplicate) {
      if (!first.start && duplicate.start) first.start = duplicate.start;
      if (!first.end && duplicate.end) first.end = duplicate.end;
      if (duplicate.done) first.done = true;
    },
  );
  data.events = dedupe(
    data.events,
    function (event) {
      return [
        event.courseId || "",
        slug(event.title),
        event.due ? event.due.slice(0, 10) : "none",
      ].join("|");
    },
    function (first, duplicate) {
      if (!first.due && duplicate.due) first.due = duplicate.due;
      if (first.weight == null && duplicate.weight != null)
        first.weight = duplicate.weight;
      if (first.points == null && duplicate.points != null)
        first.points = duplicate.points;
    },
  );
  data.readings = dedupe(
    data.readings,
    function (reading) {
      return [
        reading.courseId || "",
        reading.week == null ? "none" : reading.week,
        slug(reading.title),
      ].join("|");
    },
    function (first, duplicate) {
      if (!first.source && duplicate.source) first.source = duplicate.source;
      if (!first.pages && duplicate.pages) first.pages = duplicate.pages;
    },
  );
  if (changed) {
    data.plan = [];
    data.planMeta = null;
  }
  return changed;
}

function getLsAt() {
  try {
    return Number(localStorage.getItem(AT_KEY)) || 0;
  } catch (_e) {
    return 0;
  }
}

/** Persisted mirror revision sidecar (`journeyai.db.v1.rev`), 0 when absent. */
function getLsRev() {
  try {
    return Number(localStorage.getItem(AT_KEY + ".rev")) || 0;
  } catch (_e) {
    return 0;
  }
}

/** Post a save notice on the cross-tab channel (no-op when unsupported). */
function broadcastSave(rev, savedAt) {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("journeyai-store");
    ch.postMessage({ key: CFG.storageKey, rev: rev, savedAt: savedAt });
    ch.close();
  } catch (_e) {
    /* channel is best-effort; storage events still cover localStorage writes */
  }
}

/**
 * Parse, migrate and adopt a JSON snapshot into the live db.
 * Throws on unreadable input. Returns nothing; sets `db` / `_quarantined`.
 */
function ingestRaw(raw) {
  const d = JSON.parse(raw);
  if (!d || typeof d !== "object") throw new Error("bad");
  const base = blank();
  if (!d.settings || typeof d.settings !== "object") d.settings = {};
  Object.keys(base).forEach(function (k) {
    if (d[k] === undefined) d[k] = base[k];
  });
  Object.keys(base.settings).forEach(function (k) {
    if (d.settings[k] === undefined) d.settings[k] = base.settings[k];
  });

  const migrated = migrateSchema(d);
  if (!migrated) {
    /* Newer-version or half-migrated data: run blank in memory but refuse
       every future persist so the stored bytes stay exactly as they are. */
    _quarantined = true;
    db = maybeSeal(blank());
    setTimeout(function () {
      toast(
        "This browser holds data from a newer version of Journey A.I. It was left untouched - update the app or export a backup from the newer version first.",
        "bad",
        "Storage version",
      );
    }, 400);
    return;
  }
  _quarantined = false;
  db = maybeSeal(migrated);
  if (deduplicateData(db)) setTimeout(persist, 0);
}

/**
 * Load database from localStorage (synchronous bootstrap path).
 * @returns {Object} Database object
 */
function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(CFG.storageKey);
  } catch (_e) {
    raw = null;
  }
  if (!raw) {
    _quarantined = false;
    db = maybeSeal(blank());
    emit("load", db);
    return db;
  }
  try {
    ingestRaw(raw);
  } catch (_e) {
    db = maybeSeal(blank());
    setTimeout(function () {
      toast("Saved data could not be read and was reset.", "bad", "Storage");
    }, 400);
  }
  emit("load", db);
  return db;
}

/**
 * Restore from the IndexedDB mirror when it holds a newer (or only) snapshot
 * than localStorage. No-op when IndexedDB is unavailable, quarantined, or
 * localStorage is same-age/newer. Call after `load()`, before views render.
 * @returns {Promise<boolean>} True when the mirror was adopted
 */
async function hydrateFromIDB() {
  if (_quarantined) return false;
  if (!idbAvailable()) return false;

  let rec = null;
  try {
    rec = await idbGet(CFG.storageKey);
  } catch (_e) {
    return false;
  }
  if (!rec || typeof rec.json !== "string") return false;

  let lsRaw = null;
  try {
    lsRaw = localStorage.getItem(CFG.storageKey);
  } catch (_e) {
    lsRaw = null;
  }
  const lsAt = getLsAt();
  const idbAt = Number(rec.savedAt) || 0;
  const idbRev = Number(rec.rev) || 0;
  const lsRev = getLsRev();
  // localStorage present and strictly newer (or same-time newer rev) → keep it.
  if (lsRaw) {
    if (lsAt > idbAt) return false;
    if (lsAt === idbAt && lsRev >= idbRev) return false;
  }

  try {
    ingestRaw(rec.json);
  } catch (_e) {
    return false;
  }
  if (idbRev > _rev) _rev = idbRev;
  // Mirror back so the sidecar timestamp and localStorage catch up.
  persist();
  emit("load", db);
  return true;
}

/**
 * Persist database to localStorage and mirror to IndexedDB.
 * @returns {boolean} True if a durable copy was written
 */
function persist() {
  if (_quarantined) return false;
  try {
    // Strip the API key from the persisted copy without clearing the live session key.
    const snapshot = stripKey(db);
    const json = JSON.stringify(snapshot);
    if (json.length > CFG.storage.maxBytes * 0.95) {
      toast(
        "Storage is approaching capacity - export a backup and remove some files in Library.",
        "warn",
        "Storage warning",
      );
    }
    evictIfNeeded();

    const savedAt = Date.now();
    _rev += 1;
    let lsOk = false;
    try {
      localStorage.setItem(CFG.storageKey, json);
      try {
        localStorage.setItem(AT_KEY, String(savedAt));
        localStorage.setItem(AT_KEY + ".rev", String(_rev));
      } catch (_at) {
        /* sidecar is best-effort; hydrate falls back to IDB savedAt/rev */
      }
      lsOk = true;
    } catch (_ls) {
      /* quota exceeded — IndexedDB mirror below is the overflow path */
    }

    if (idbAvailable()) {
      idbSet(CFG.storageKey, {
        json: json,
        savedAt: savedAt,
        rev: _rev,
      }).catch(function (_e) {
        /* fire-and-forget; next persist retries */
      });
    }
    broadcastSave(_rev, savedAt);

    if (!lsOk && !idbAvailable()) {
      toast(
        "Browser storage is full - recent changes may be lost. Export a backup now, then remove files in Library.",
        "bad",
        "Storage full",
      );
      return false;
    }

    emit("save", { bytes: json.length });
    return true;
  } catch (_e) {
    toast(
      "Browser storage is full - recent changes may be lost. Export a backup now, then remove files in Library.",
      "bad",
      "Storage full",
    );
    return false;
  }
}

/**
 * Debounced save (250ms)
 */
const save = debounce(function () {
  persist();
}, 250);

/**
 * Immediate save
 * @returns {boolean} False when quarantined or the write failed
 */
function saveNow() {
  return persist();
}

/**
 * Replace the entire database with a new object (seed, migration, reset).
 * Validates the new object before accepting it.
 * @param {Object} newDb - The new database object
 */
function update(newDb) {
  if (!isValidData(newDb)) {
    console.error("Store.update: rejected invalid data");
    return;
  }
  db = maybeSeal(newDb);
  saveNow();
  emit("update", db);
}

/**
 * Get storage usage stats
 * @returns {Object} Usage stats
 */
function usage() {
  try {
    const s = localStorage.getItem(CFG.storageKey) || "";
    return {
      bytes: s.length * 2,
      pretty: fmtBytes(s.length * 2),
      cap: CFG.storage.maxBytes,
    };
  } catch (_e) {
    return { bytes: 0, pretty: "0 B", cap: CFG.storage.maxBytes };
  }
}

/* ---- lookups ---- */
function course(id) {
  return (
    (db.courses || []).find(function (c) {
      return c.id === id;
    }) || null
  );
}

function courseName(id) {
  const c = course(id);
  return c ? c.code || c.title : "Unassigned";
}

function courseColor(id) {
  const c = course(id);
  return c ? c.color || CFG.palette[0] : "#67717a";
}

function event(id) {
  return (
    (db.events || []).find(function (e) {
      return e.id === id;
    }) || null
  );
}

function doc(id) {
  return (
    (db.documents || []).find(function (d) {
      return d.id === id;
    }) || null
  );
}

function lesson(id) {
  return (
    (db.lessons || []).find(function (l) {
      return l.id === id;
    }) || null
  );
}

/**
 * Remove a course and all associated data
 * @param {string} id - Course ID
 */
function removeCourse(id) {
  db.courses = db.courses.filter(function (c) {
    return c.id !== id;
  });
  db.lessons = db.lessons.filter(function (l) {
    return l.courseId !== id;
  });
  db.events = db.events.filter(function (e) {
    return e.courseId !== id;
  });
  db.readings = db.readings.filter(function (r) {
    return r.courseId !== id;
  });
  const docs = db.documents
    .filter(function (d) {
      return d.courseId === id;
    })
    .map(function (d) {
      return d.id;
    });
  db.documents = db.documents.filter(function (d) {
    return d.courseId !== id;
  });
  db.chunks = db.chunks.filter(function (c) {
    return docs.indexOf(c.docId) === -1 && c.courseId !== id;
  });
  db.plan = (db.plan || []).filter(function (p) {
    return p.courseId !== id;
  });
  saveNow();
}

/**
 * Reset all data to blank state
 */
function resetAll() {
  db = maybeSeal(blank());
  saveNow();
  emit("reset", db);
}

// Export the Store API
export const Store = {
  get db() {
    return db;
  },
  /** Current cross-tab mirror revision (0 before the first persist). */
  rev() {
    return _rev;
  },
  blank,
  load,
  hydrateFromIDB,
  persist,
  isQuarantined,
  deduplicateData,
  save,
  saveNow,
  update,
  on,
  emit,
  usage,
  course,
  courseName,
  courseColor,
  event,
  doc,
  lesson,
  removeCourse,
  resetAll,
};

export default Store;
