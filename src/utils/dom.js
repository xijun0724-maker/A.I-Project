/**
 * DOM utility functions for Journey A.I
 * Query selectors, downloads, and DOM manipulation helpers.
 */

import { esc } from "./helpers.js";

/**
 * Query selector shorthand
 * @param {string} sel - CSS selector
 * @param {Element} root - Root element (default: document)
 * @returns {Element|null} Found element
 */
export function q(sel, root) {
  return (root || document).querySelector(sel);
}

/**
 * Query selector all shorthand (returns array)
 * @param {string} sel - CSS selector
 * @param {Element} root - Root element (default: document)
 * @returns {Element[]} Array of found elements
 */
export function qa(sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
}

/**
 * Trigger file download
 * @param {string} name - Filename
 * @param {string} text - File content
 * @param {string} mime - MIME type
 */
export function download(name, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

/**
 * Read file as text
 * @param {File} file - File to read
 * @returns {Promise<string>} File content
 */
export function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () =>
      reject(new Error("The browser could not read this file."));
    r.onload = () => resolve(String(r.result || ""));
    r.readAsText(file);
  });
}

/**
 * Read file as ArrayBuffer
 * @param {File} file - File to read
 * @returns {Promise<ArrayBuffer>} File content
 */
export function readAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () =>
      reject(new Error("The browser could not read this file."));
    r.onload = () => resolve(r.result);
    r.readAsArrayBuffer(file);
  });
}

/**
 * Get file extension from filename
 * @param {string} name - Filename
 * @returns {string} Extension (lowercase)
 */
export function ext(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

/**
 * Create a toast notification
 * @param {string} msg - Message
 * @param {string} kind - Type (info, ok, bad, warn)
 * @param {string} title - Optional title
 */
export function toast(msg, kind, title) {
  const host = q("#toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast " + (kind || "info");
  el.setAttribute("role", kind === "bad" ? "alert" : "status");
  el.innerHTML =
    (title ? '<div class="tt">' + esc(title) + "</div>" : "") +
    "<div>" +
    esc(msg) +
    "</div>";
  host.appendChild(el);
  const timeout = kind === "bad" ? 6500 : 4200;
  setTimeout(() => {
    el.style.transition = "opacity .25s, transform .25s";
    el.style.opacity = "0";
    el.style.transform = "translateX(18px)";
    setTimeout(() => el.remove(), 260);
  }, timeout);
}

// Export all functions as a namespace for backward compatibility
export const DOM = {
  q,
  qa,
  download,
  readAsText,
  readAsBuffer,
  ext,
  toast,
};

export default DOM;
