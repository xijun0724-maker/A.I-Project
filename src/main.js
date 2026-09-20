/**
 * Journey A.I - Main Entry Point
 * Keeps the root bootstrap separated from the app shell so the structure is
 * cleaner and easier to extend.
 */

import {
  boot,
  act,
  Store,
  UIState,
  Views,
  UI,
  Router,
} from "./app/bootstrap.js";

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();

export { boot, act, Store, UIState, Views, UI, Router };
