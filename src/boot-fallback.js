/**
 * Boot fallback for Journey A.I — classic script (not a module).
 *
 * Runs even when the ES module graph fails to load, so this file must never
 * import anything. Covers two surfaces:
 *   1. Service-worker registration + update auto-refresh.
 *   2. A 10s loader timeout that surfaces a diagnostic if main.js never
 *      marks the app loaded.
 *
 * Loaded from index.html so script-src can drop 'unsafe-inline'.
 */
(function () {
  "use strict";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      /* Relative so the scope resolves correctly on a GitHub Pages
         project site (served from /<repo>/, not the domain root). */
      navigator.serviceWorker
        .register("sw.js")
        .then(function (reg) {
          reg.addEventListener("updatefound", function () {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", function () {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log(
                  "Journey A.I: New version available, auto-refreshing...",
                );
                setTimeout(function () {
                  if (newWorker.state === "installed") {
                    window.location.reload();
                  }
                }, 1000);
              }
            });
          });
        })
        .catch(function (err) {
          console.warn("Journey A.I: Service worker registration failed:", err);
        });
    });
  }

  /* Hide the loader after 10 seconds even if the module graph failed. */
  setTimeout(function () {
    const loader = document.getElementById("app-loader");
    const app = document.getElementById("app");
    if (!loader || !app || app.classList.contains("loaded")) return;

    const mainScript = document.querySelector('script[src="src/main.js"]');
    const errorMsg =
      mainScript && mainScript.error ? " (Script failed to load)" : "";

    loader.innerHTML =
      '<div style="text-align:center;padding:20px;max-width:400px;margin:0 auto;">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" style="margin:0 auto 12px;">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="12" y1="8" x2="12" y2="12"/>' +
      '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
      "</svg>" +
      '<p style="color:#f87171;font-size:15px;font-family:system-ui,sans-serif;font-weight:500;">' +
      "App failed to load" +
      errorMsg +
      "</p>" +
      '<p style="color:#9ca3af;font-size:13px;margin-top:8px;font-family:system-ui,sans-serif;">' +
      "Try these steps in order:" +
      "</p>" +
      '<div style="text-align:left;margin:12px 0 16px 20px;font-size:13px;color:#9ca3af;font-family:system-ui,sans-serif;">' +
      '<p style="margin:4px 0;">1. Open Developer Tools (F12) → Console tab → copy any errors</p>' +
      '<p style="margin:4px 0;">2. Try an <strong>incognito/private window</strong> to rule out extension interference</p>' +
      '<p style="margin:4px 0;">3. Disable ad blockers or script-blocking extensions</p>' +
      '<p style="margin:4px 0;">4. Clear site data: Settings → Privacy → Clear browsing data → Cookies & cached images</p>' +
      "</div>" +
      '<button class="btn primary" style="margin-top:8px;" id="bootRetryBtn">Retry loading</button>' +
      "</div>";

    const retry = document.getElementById("bootRetryBtn");
    if (retry) {
      retry.addEventListener("click", function () {
        location.reload();
      });
    }
  }, 10000);
})();
