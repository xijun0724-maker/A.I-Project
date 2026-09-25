/**
 * Markdown rendering utilities for Journey A.I
 * Tiny, escaping-safe renderer for AI output.
 */

import { esc } from "./helpers.js";

/**
 * Convert inline markdown to HTML (bold, italic, code, citations)
 * @param {string} s - Markdown string
 * @returns {string} HTML string
 */
export function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
      if (!/^(?:https?:|mailto:)/i.test(href.trim())) return label;
      return (
        '<a href="' +
        href +
        '" target="_blank" rel="noopener noreferrer">' +
        label +
        "</a>"
      );
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[(\d+)\]/g,
      '<sup class="cite-mark" title="Source $1">[$1]</sup>',
    );
}

/**
 * Convert markdown text to HTML (headings, lists, code blocks, blockquotes)
 * @param {string} src - Markdown source
 * @returns {string} HTML string
 */
export function mdToHtml(src) {
  if (!src) return "";
  const lines = String(src).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inUl = false,
    inOl = false,
    inCode = false;

  function closeLists() {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  }

  lines.forEach((raw) => {
    const line = raw;

    // Code blocks
    if (/^\s*```/.test(line)) {
      closeLists();
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      return;
    }
    if (inCode) {
      out.push(esc(line));
      return;
    }

    // Headings (h1-h6)
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      const level = h[1].length;
      out.push("<h" + level + ">" + inline(h[2]) + "</h" + level + ">");
      return;
    }

    // Unordered lists
    if (/^\s*[-*+]\s+/.test(line)) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push("<li>" + inline(line.replace(/^\s*[-*+]\s+/, "")) + "</li>");
      return;
    }

    // Ordered lists
    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push("<li>" + inline(line.replace(/^\s*\d+[.)]\s+/, "")) + "</li>");
      return;
    }

    // Blockquotes
    if (/^\s*>\s?/.test(line)) {
      closeLists();
      out.push(
        "<blockquote>" + inline(line.replace(/^\s*>\s?/, "")) + "</blockquote>",
      );
      return;
    }

    // Empty lines
    if (!line.trim()) {
      closeLists();
      return;
    }

    // Regular paragraphs
    closeLists();
    out.push("<div>" + inline(line) + "</div>");
  });

  closeLists();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}
