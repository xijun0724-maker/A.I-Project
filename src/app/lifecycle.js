/**
 * Page lifecycle hooks — saves to localStorage on unload/visibility change,
 * and surfaces writes made by other tabs on the same origin.
 *
 * Two channels report cross-tab writes:
 * - the `storage` event, for localStorage-backed saves;
 * - a `BroadcastChannel`, for saves that only landed in the IndexedDB mirror
 *   (localStorage quota) or when a browser skips storage events for same-ms
 *   rewrites. Both funnel into the same once-per-session warning.
 */

import { Store } from "../core/store.js";
import { CFG } from "../config/constants.js";
import { toast } from "../utils/dom.js";

let _storageWarned = false;

/**
 * React to a cross-tab write on the main database key.
 * The `storage` event only fires in *other* tabs, never the writer — so any
 * matching event here is by definition an external change. Reload picks up
 * the newer bytes; without this the tab keeps a stale in-memory snapshot and
 * the next local persist silently overwrites the other tab's work.
 * @param {StorageEvent} e
 */
export function handleStorageEvent(e) {
  if (!e || e.key !== CFG.storageKey) return;
  /* newValue null = another tab cleared storage (reset/logout). */
  if (e.newValue == null) {
    if (_storageWarned) return;
    _storageWarned = true;
    toast(
      "Another tab cleared Journey A.I data. Reload to continue with a blank workspace.",
      "warn",
      "Storage cleared elsewhere",
    );
    return;
  }
  /* Skip the toast when this tab already holds the same bytes (own save
     raced the event, or the write was a no-op rewrite). */
  let current = null;
  try {
    current = localStorage.getItem(CFG.storageKey);
  } catch (_err) {
    current = null;
  }
  if (current === e.newValue) return;
  warnUpdatedOnce();
}

/**
 * Shared once-per-session "data changed elsewhere" toast used by both the
 * storage-event and BroadcastChannel paths.
 */
function warnUpdatedOnce() {
  if (_storageWarned) return;
  _storageWarned = true;
  toast(
    "Your data changed in another tab. Reload to pick up those changes before editing here — otherwise this tab may overwrite them.",
    "warn",
    "Updated in another tab",
  );
}

/**
 * React to a BroadcastChannel save notice from another tab.
 * Only warns when the remote revision is ahead of what this tab last wrote,
 * so our own posts (and same-rev echoes) stay silent.
 * @param {{key?: string, rev?: number}} msg
 * @param {number} localRev - revision this tab last persisted
 */
export function handleBroadcastMessage(msg, localRev) {
  if (!msg || msg.key !== CFG.storageKey) return;
  const remote = Number(msg.rev) || 0;
  if (remote <= localRev) return;
  warnUpdatedOnce();
}

/** Reset the once-per-session multi-tab warning (tests / manual re-arm). */
export function resetStorageWarn() {
  _storageWarned = false;
}

let _bc = null;

export function initLifecycle() {
  window.addEventListener("beforeunload", () => Store.saveNow());
  window.addEventListener("pagehide", () => Store.saveNow());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Store.saveNow();
  });
  window.addEventListener("storage", handleStorageEvent);

  /* Mirror channel: catch IDB-only writes that never touch localStorage. */
  try {
    if (typeof BroadcastChannel !== "undefined") {
      _bc = new BroadcastChannel("journeyai-store");
      _bc.addEventListener("message", (e) => {
        handleBroadcastMessage(e && e.data, Store.rev());
      });
    }
  } catch (_e) {
    /* storage events remain the primary path */
  }
}
