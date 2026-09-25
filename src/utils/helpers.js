/**
 * Core utility functions for Journey A.I
 * Pure functions with no external dependencies.
 */

/**
 * Generate a unique ID with optional prefix
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique identifier
 */
export function uid(prefix = "id") {
  return (
    prefix +
    "_" +
    Math.random().toString(36).slice(2, 9) +
    Date.now().toString(36).slice(-3)
  );
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} s - String to escape
 * @returns {string} Escaped string
 */
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitize a URL destined for CSS url(...) or a background-image sink.
 * Allows only data:image, http(s), same-origin absolute paths, and blob.
 * Strips characters that could break out of the url() token.
 * @param {string} url
 * @returns {string} Safe URL, or "" when the value is not allowed
 */
export function safeCssUrl(url) {
  const s = String(url == null ? "" : url).trim();
  if (!s) return "";
  const allowed =
    /^data:image\//i.test(s) ||
    /^https?:\/\//i.test(s) ||
    /^\/(?!\/)/.test(s) ||
    /^blob:/.test(s) ||
    /^\.\.?\//.test(s);
  if (!allowed) return "";
  return s.replace(/["'\\)<>\s]/g, "");
}

/**
 * Sanitize a color value destined for an inline style sink.
 * Allows hex, rgb/rgba, hsl/hsla, CSS variables, and simple named colors.
 * @param {string} c
 * @returns {string} Safe color, or a neutral fallback
 */
export function safeColor(c) {
  const s = String(c == null ? "" : c).trim();
  if (!s) return "";
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/i.test(s))
    return s;
  if (/^hsla?\(\s*[\d.]+(\w+)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\)$/i.test(s))
    return s;
  if (/^var\(--[a-z0-9-]+\)$/i.test(s)) return s;
  if (/^[a-z]{3,20}$/i.test(s)) return s;
  return "";
}

/**
 * Clamp a number between min and max values
 * @param {number} n - Number to clamp
 * @param {number} a - Min value
 * @param {number} b - Max value
 * @returns {number} Clamped number
 */
export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Sum array values, optionally mapping with a function
 * @param {Array} arr - Array to sum
 * @param {Function} f - Optional mapping function
 * @returns {number} Sum
 */
export function sum(arr, f) {
  return (arr || []).reduce((t, x) => t + (f ? f(x) : x) || 0, 0);
}

/**
 * Get unique values from an array
 * @param {Array} arr - Array with duplicates
 * @returns {Array} Array with unique values
 */
export function uniq(arr) {
  return arr.filter((v, i) => arr.indexOf(v) === i);
}

/**
 * Group array elements by a key function or property name
 * @param {Array} arr - Array to group
 * @param {Function|string} f - Key function or property name
 * @returns {Object} Grouped object
 */
export function groupBy(arr, f) {
  const o = {};
  (arr || []).forEach((x) => {
    const k = typeof f === "function" ? f(x) : x[f];
    (o[k] = o[k] || []).push(x);
  });
  return o;
}

/**
 * Sort array by a key function
 * @param {Array} arr - Array to sort
 * @param {Function} f - Key function
 * @param {number} dir - Direction (1 for ascending, -1 for descending)
 * @returns {Array} Sorted array
 */
export function sortBy(arr, f, dir) {
  const s = (arr || []).slice();
  s.sort((a, b) => {
    const x = f(a),
      y = f(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (x < y) return dir === -1 ? 1 : -1;
    if (x > y) return dir === -1 ? -1 : 1;
    return 0;
  });
  return s;
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms || 200);
  };
}

/**
 * Convert string to URL-safe slug
 * @param {string} s - String to slugify
 * @returns {string} Slug
 */
export function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Calculate percentage
 * @param {number} n - Numerator
 * @param {number} d - Denominator
 * @returns {number} Percentage (0-100)
 */
export function pct(n, d) {
  if (!d) return 0;
  return clamp(Math.round((n / d) * 100), 0, 100);
}

/**
 * Convert minutes to human-readable format (e.g., "2h 30m")
 * @param {number} m - Minutes
 * @returns {string} Formatted string
 */
export function minutesToHM(m) {
  m = Math.max(0, Math.round(m || 0));
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? h + "h " + r + "m" : h + "h";
}

/**
 * Format bytes to human-readable format
 * @param {number} b - Bytes
 * @returns {string} Formatted string
 */
export function fmtBytes(b) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
}

/**
 * Convert array to CSV format
 * @param {Array} rows - 2D array of values
 * @returns {string} CSV string
 */
export function csv(rows) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c == null ? "" : c);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(","),
    )
    .join("\n");
}

// Export all functions as a namespace for backward compatibility
export const U = {
  uid,
  esc,
  safeCssUrl,
  safeColor,
  clamp,
  sum,
  uniq,
  groupBy,
  sortBy,
  debounce,
  slug,
  pct,
  minutesToHM,
  fmtBytes,
  csv,
};

export default U;
