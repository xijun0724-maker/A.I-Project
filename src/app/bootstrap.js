/**
 * Application bootstrap layer.
 * Thin orchestrator that imports focused modules and runs the startup sequence.
 */

import { Store } from "../core/store.js";
import { Router } from "../core/router.js";
import { registerAll as registerViews } from "../views/index.js";
import { RAG } from "../domain/rag.js";
import { hydrateKey } from "../utils/secure.js";
import "../utils/extract.js";

import { initScrollReveal } from "./scroll-reveal.js";
import { initActionDelegation } from "./actions-delegation.js";
import { initChrome } from "./chrome.js";
import { initFocusTrap } from "./focus-trap.js";
import { initLifecycle } from "./lifecycle.js";

function boot() {
  Store.load();
  hydrateKey(Store.db.settings);

  registerViews(Router);

  const needsIndex =
    !(Store.db.chunks || []).length &&
    Store.db.documents.some((d) => (d.text || "").length > 200);
  if (needsIndex) RAG.reindexAll();
  Store.saveNow();

  initScrollReveal();
  initActionDelegation();
  initChrome();
  initFocusTrap();
  initLifecycle();

  Router.init();
}

export { boot };
export default { boot };
