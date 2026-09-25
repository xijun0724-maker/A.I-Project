/**
 * Pre-paint theme — classic script, no imports.
 *
 * Applied from <head> so data-theme is correct before first paint and a
 * light loader never flashes over the dark default (or vice versa).
 * Keep the default in sync with chrome.js initTheme() — both use "dark".
 * Loaded as an external script because CSP script-src has no 'unsafe-inline'.
 */
(function () {
  "use strict";
  let t = "dark";
  try {
    t = localStorage.getItem("journeyai.theme") || "dark";
  } catch (_e) {}
  document.documentElement.setAttribute("data-theme", t);
})();
