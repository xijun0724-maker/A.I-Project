/**
 * DOM utility functions for Journey A.I
 * Query selectors, downloads, and DOM manipulation helpers.
 */

/**
 * Query selector shorthand
 * @param {string} sel - CSS selector
 * @param {Element} root - Root element (default: document)
 * @returns {Element|null} Found element
 */
export function q(sel, root) {
  const doc = root || (typeof document !== "undefined" ? document : null);
  return doc ? doc.querySelector(sel) : null;
}

/**
 * Query selector all shorthand (returns array)
 * @param {string} sel - CSS selector
 * @param {Element} root - Root element (default: document)
 * @returns {Element[]} Array of found elements
 */
export function qa(sel, root) {
  const doc = root || (typeof document !== "undefined" ? document : null);
  return doc ? Array.prototype.slice.call(doc.querySelectorAll(sel)) : [];
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
  const k = kind || "info";
  const el = document.createElement("div");
  el.className = "toast-item " + k;
  el.setAttribute("role", k === "bad" ? "alert" : "status");
  const content = document.createElement("div");
  content.className = "content";
  if (title) {
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = String(title);
    content.appendChild(t);
  }
  const m = document.createElement("div");
  m.className = "message";
  m.textContent = String(msg);
  content.appendChild(m);
  el.appendChild(content);

  let timer = null;
  function dismiss() {
    if (timer) clearTimeout(timer);
    el.style.transition = "opacity .25s, transform .25s";
    el.style.opacity = "0";
    el.style.transform = "translateX(18px)";
    setTimeout(() => el.remove(), 260);
  }
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close";
  closeBtn.setAttribute("aria-label", "Dismiss notification");
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", dismiss);
  el.appendChild(closeBtn);

  host.appendChild(el);
  const timeout = k === "bad" ? 6500 : 4200;
  timer = setTimeout(dismiss, timeout);
}

/**
 * Confirmation toast for a completed save action
 * @param {string} msg - Message (defaults to "Saved.")
 */
export function toastSaved(msg) {
  toast(msg || "Saved.", "ok");
}

// Export all functions as a namespace for backward compatibility
export const DOM = {
  q,
  qa,
  readAsText,
  ext,
  toast,
  toastSaved,
};

export default DOM;
