/**
 * Lazy CDN script loader for Journey A.I
 * Injects <script> tags on demand so pdf.js and mammoth.js
 * don't block initial page load (~3 MB combined).
 */

const CDN_URLS = {
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker:
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  mammoth:
    "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
};

/* Subresource Integrity for the three CDN scripts above (SHA-384).
   Recompute when bumping a library version. */
const CDN_SRI = {
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js":
    "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js":
    "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2",
  "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js":
    "sha384-/cXAMbzovUIKbBERjPmR3SnPTh8siWr5lsvFYj1Uq4XP0yaJUZJmsh0YXyGv5P0y",
};

const _loaded = {};

export function injectScript(url, integrity) {
  const sri = integrity || CDN_SRI[url];
  return new Promise(function (resolve, reject) {
    const existing = document.querySelector('script[src="' + url + '"]');
    if (existing) {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.crossOrigin = "anonymous";
    if (sri) s.integrity = sri;
    s.onload = resolve;
    s.onerror = function () {
      reject(new Error("Failed to load " + url));
    };
    document.head.appendChild(s);
  });
}

export async function loadPdf() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (_loaded.pdf) return _loaded.pdf;

  _loaded.pdf = injectScript(CDN_URLS.pdf).then(function () {
    if (!window.pdfjsLib) throw new Error("pdf.js did not initialise");
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_URLS.pdfWorker;
    }
    return window.pdfjsLib;
  });

  return _loaded.pdf;
}

export async function loadMammoth() {
  if (window.mammoth) return window.mammoth;
  if (_loaded.mammoth) return _loaded.mammoth;

  _loaded.mammoth = injectScript(CDN_URLS.mammoth).then(function () {
    if (!window.mammoth) throw new Error("mammoth did not initialise");
    return window.mammoth;
  });

  return _loaded.mammoth;
}

export function isLoaded(name) {
  if (name === "pdf") return !!window.pdfjsLib;
  if (name === "mammoth") return !!window.mammoth;
  return false;
}
