/**
 * Page lifecycle hooks — saves to localStorage on unload/visibility change.
 */

import { Store } from "../core/store.js";

export function initLifecycle() {
  window.addEventListener("beforeunload", () => Store.saveNow());
  window.addEventListener("pagehide", () => Store.saveNow());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Store.saveNow();
  });
}
