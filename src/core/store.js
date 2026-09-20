/**
 * localStorage persistence layer for Journey A.I
 * Handles data storage, migrations, and schema management.
 */

import { CFG } from "../config/constants.js";
import { debounce, fmtBytes, slug } from "../utils/helpers.js";
import { toast } from "../utils/dom.js";
import { createBlankDB, migrateSchema } from "../config/settings.js";

// Singleton database instance
let db = null;

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
    } catch (_e) {
      /* swallow listener errors */
    }
  });
}

// Maximum localStorage key count before eviction
const MAX_STORAGE_KEYS = 200;

/**
 * Evict oldest non-essential keys when storage is near capacity.
 */
function evictIfNeeded() {
  try {
    let keys = Object.keys(localStorage);
    if (keys.length < MAX_STORAGE_KEYS) return;
    // Remove non-Journey keys first (oldest by insertion order)
    for (let i = 0; i < keys.length && keys.length >= MAX_STORAGE_KEYS; i++) {
      const k = keys[i];
      if (k !== CFG.storageKey && !k.startsWith("journeyai.")) {
        localStorage.removeItem(k);
      }
    }
    keys = Object.keys(localStorage);
    // If still over, remove oldest Journey keys (keep current DB)
    for (let i = 0; i < keys.length && keys.length >= MAX_STORAGE_KEYS; i++) {
      const k = keys[i];
      if (k !== CFG.storageKey) {
        localStorage.removeItem(k);
      }
    }
  } catch (_e) {
    /* ignore eviction errors */
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

/**
 * Load database from localStorage
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
    db = blank();
    emit("load", db);
    return db;
  }
  try {
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
      db = blank();
      setTimeout(function () {
        toast(
          "This browser holds data from a newer version of Journey A.I. It was left untouched - update the app or export a backup from the newer version first.",
          "bad",
          "Storage version",
        );
      }, 400);
      emit("load", db);
      return db;
    }
    db = migrated;
    if (deduplicateData(db)) setTimeout(persist, 0);
  } catch (_e) {
    db = blank();
    setTimeout(function () {
      toast("Saved data could not be read and was reset.", "bad", "Storage");
    }, 400);
  }
  emit("load", db);
  return db;
}

/**
 * Persist database to localStorage
 * @returns {boolean} True if successful
 */
function persist() {
  try {
    // Strip the API key from the persisted copy without clearing the live session key.
    const snapshot =
      db && db.settings
        ? { ...db, settings: { ...db.settings, apiKey: "" } }
        : db;
    const json = JSON.stringify(snapshot);
    if (json.length > CFG.storage.maxBytes * 0.95) {
      toast(
        "Storage is approaching capacity - remove some files in Library.",
        "warn",
        "Storage warning",
      );
    }
    evictIfNeeded();
    localStorage.setItem(CFG.storageKey, json);
    emit("save", { bytes: json.length });
    return true;
  } catch (_e) {
    toast(
      "Browser storage is full - large documents may not be saved. Remove some files in Library.",
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
 */
function saveNow() {
  persist();
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
  db = newDb;
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
  db = blank();
  saveNow();
  emit("reset", db);
}

// Export the Store API
export const Store = {
  get db() {
    return db;
  },
  blank,
  load,
  persist,
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
