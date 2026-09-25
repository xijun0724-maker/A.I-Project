import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { Store } from "../../src/core/store.js";
import { CFG } from "../../src/config/constants.js";
import { idbGet, idbSet } from "../../src/core/idb.js";
import { installFakeIDB } from "./helpers/fake-idb.js";

const AT_KEY = CFG.storageKey + ".at";

async function idbGetWhen(pred, timeout = 500) {
  const start = Date.now();
  for (;;) {
    const rec = await idbGet(CFG.storageKey);
    if (rec && pred(rec)) return rec;
    if (Date.now() - start > timeout) return null;
    await new Promise(function (r) {
      setTimeout(r, 10);
    });
  }
}

describe("Store without IndexedDB (happy-dom default)", () => {
  beforeEach(() => {
    delete globalThis.indexedDB;
    Store.resetAll();
    localStorage.clear();
    Store.load();
  });

  it("hydrateFromIDB is a no-op when indexedDB is missing", async () => {
    expect(await Store.hydrateFromIDB()).toBe(false);
  });

  it("load still reads localStorage synchronously", async () => {
    const blank = Store.blank();
    blank.settings.userName = "Ada";
    localStorage.setItem(CFG.storageKey, JSON.stringify(blank));
    Store.load();
    expect(Store.db.settings.userName).toBe("Ada");
    expect(await Store.hydrateFromIDB()).toBe(false);
  });
});

describe("Store + IndexedDB mirror", () => {
  let restore;

  beforeEach(() => {
    restore = installFakeIDB();
    localStorage.clear();
    Store.resetAll();
    Store.load();
  });

  afterEach(() => {
    restore();
  });

  it("persist writes both localStorage and IndexedDB", async () => {
    Store.db.settings.userName = "Mirror";
    expect(Store.saveNow()).toBe(true);
    expect(localStorage.getItem(CFG.storageKey)).toContain("Mirror");

    const rec = await idbGetWhen(function (r) {
      return r.json && r.json.indexOf("Mirror") !== -1;
    });
    expect(rec).toBeTruthy();
    expect(typeof rec.savedAt).toBe("number");
    expect(rec.json).toContain("Mirror");
    expect(localStorage.getItem(AT_KEY)).toBeTruthy();
    expect(Number(rec.rev)).toBeGreaterThan(0);
    expect(localStorage.getItem(AT_KEY + ".rev")).toBe(String(rec.rev));
  });

  it("hydrate restores from IndexedDB when localStorage is empty", async () => {
    const payload = Store.blank();
    payload.settings.userName = "FromIDB";
    await idbSet(CFG.storageKey, {
      json: JSON.stringify(payload),
      savedAt: Date.now(),
    });

    // Simulate lost/cleared localStorage but a live mirror.
    localStorage.removeItem(CFG.storageKey);
    localStorage.removeItem(AT_KEY);
    Store.load();
    expect(Store.db.settings.userName).toBe("");

    expect(await Store.hydrateFromIDB()).toBe(true);
    expect(Store.db.settings.userName).toBe("FromIDB");
    // Sidecar + main key restored for the next boot.
    expect(localStorage.getItem(CFG.storageKey)).toContain("FromIDB");
    expect(localStorage.getItem(AT_KEY)).toBeTruthy();
  });

  it("keeps localStorage when it is newer than the mirror", async () => {
    const older = Store.blank();
    older.settings.userName = "OlderIDB";
    await idbSet(CFG.storageKey, {
      json: JSON.stringify(older),
      savedAt: Date.now() - 60000,
    });

    const newer = Store.blank();
    newer.settings.userName = "NewerLS";
    localStorage.setItem(CFG.storageKey, JSON.stringify(newer));
    localStorage.setItem(AT_KEY, String(Date.now()));

    Store.load();
    expect(await Store.hydrateFromIDB()).toBe(false);
    expect(Store.db.settings.userName).toBe("NewerLS");
  });

  it("keeps localStorage when timestamps match and local rev is not behind", async () => {
    const snapshot = Store.blank();
    snapshot.settings.userName = "Same";
    const json = JSON.stringify(snapshot);
    const at = Date.now();
    localStorage.setItem(CFG.storageKey, json);
    localStorage.setItem(AT_KEY, String(at));
    localStorage.setItem(AT_KEY + ".rev", "7");
    await idbSet(CFG.storageKey, { json: json, savedAt: at, rev: 7 });

    Store.load();
    expect(await Store.hydrateFromIDB()).toBe(false);
    expect(Store.db.settings.userName).toBe("Same");
  });

  it("adopts the mirror when its revision is ahead at the same timestamp", async () => {
    const older = Store.blank();
    older.settings.userName = "LSRev1";
    const jsonLs = JSON.stringify(older);
    const at = Date.now();
    localStorage.setItem(CFG.storageKey, jsonLs);
    localStorage.setItem(AT_KEY, String(at));
    localStorage.setItem(AT_KEY + ".rev", "1");

    const newer = Store.blank();
    newer.settings.userName = "IDBRev9";
    await idbSet(CFG.storageKey, {
      json: JSON.stringify(newer),
      savedAt: at,
      rev: 9,
    });

    Store.load();
    expect(Store.db.settings.userName).toBe("LSRev1");
    expect(await Store.hydrateFromIDB()).toBe(true);
    expect(Store.db.settings.userName).toBe("IDBRev9");
  });

  it("does not hydrate when quarantined", async () => {
    const newer = Store.blank();
    newer.version = CFG.schemaVersion + 10;
    localStorage.setItem(CFG.storageKey, JSON.stringify(newer));
    localStorage.setItem(AT_KEY, String(Date.now()));
    Store.load();
    expect(Store.isQuarantined()).toBe(true);

    const mirror = Store.blank();
    mirror.settings.userName = "ShouldNotWin";
    await idbSet(CFG.storageKey, {
      json: JSON.stringify(mirror),
      savedAt: Date.now() + 1000,
    });

    expect(await Store.hydrateFromIDB()).toBe(false);
    expect(Store.db.settings.userName).not.toBe("ShouldNotWin");
    expect(Store.isQuarantined()).toBe(true);
  });
});
