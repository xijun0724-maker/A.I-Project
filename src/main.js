/**
 * Journey A.I - Main Entry Point
 * Keeps the root bootstrap separated from the app shell so the structure is
 * cleaner and easier to extend.
 */

import { boot } from "./app/bootstrap.js";
import { act } from "./core/actions/index.js";
import { Store } from "./core/store.js";
import { UIState, Views, UI } from "./core/state.js";
import { Router } from "./core/router.js";

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();

export { boot, act, Store, UIState, Views, UI, Router };
