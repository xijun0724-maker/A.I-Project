/**
 * Document import pipeline for Journey A.I
 * Handles file analysis, text extraction, and NLP processing.
 */

import { CFG } from "../config/constants.js";
import { ext } from "../utils/dom.js";
import { NLP } from "./nlp.js";

export const Pipeline = {};

Pipeline.withTimeout = function (promise, ms, message) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(new Error(message));
      }, ms);
    }),
  ]).then(
    function (v) {
      if (timer) clearTimeout(timer);
      return v;
    },
    function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    },
  );
};

/** Truncate to CFG.maxDocChars and append a warning when cut. */
function capDocText(text, warnings) {
  let source = String(text || "");
  if (source.length > CFG.maxDocChars) {
    source = source.slice(0, CFG.maxDocChars);
    warnings.push(
      "Text truncated to " +
        CFG.maxDocChars.toLocaleString() +
        " characters (CFG.maxDocChars).",
    );
  }
  return source;
}

Pipeline.analyseFile = function (file, opts, onProgress) {
  opts = opts || {};
  const isPdf = ext(file.name) === "pdf";
  // Use the global Extract object (loaded via CDN script tag)
  const work = window.Extract
    ? window.Extract.file(file, onProgress)
    : Promise.resolve({ text: "", tables: [], pages: 0 });
  return Pipeline.withTimeout(
    work,
    isPdf ? CFG.timeouts.pdfParse : CFG.timeouts.fileParse,
    isPdf
      ? 'Parsing this PDF took too long. Opening the app directly from disk (file://) blocks the PDF engine - run it from a local server with "npx --yes serve .", or paste the text instead.'
      : "Reading this file took too long. Try again, or paste the text instead.",
  ).then(function (ex) {
    if (!ex.text || !ex.text.trim()) {
      throw new Error(
        "No text could be extracted from this file. It may be image-based or encrypted.",
      );
    }
    const warnings = [];
    const text = capDocText(ex.text, warnings);
    const result = NLP.analyse({
      text: text,
      tables: ex.tables,
      courseId: opts.courseId,
      name: file.name,
    });
    return {
      name: file.name,
      size: file.size,
      mime: file.type || "",
      kind:
        opts.kind ||
        (window.Extract ? window.Extract.kind(file.name) : "other"),
      text: text,
      tables: ex.tables,
      pages: ex.pages || null,
      warnings: warnings,
      result: result,
    };
  });
};

Pipeline.analyseText = function (text, opts) {
  opts = opts || {};
  const name = opts.name || "Pasted text";
  const warnings = [];
  const source = capDocText(text, warnings);
  const result = NLP.analyse({
    text: source,
    tables: [],
    courseId: opts.courseId,
    name: name,
  });
  return {
    name: name,
    size: source.length,
    mime: "text/plain",
    kind: opts.kind || (window.Extract ? window.Extract.kind(name) : "other"),
    text: source,
    tables: [],
    pages: null,
    warnings: warnings,
    result: result,
  };
};

export default Pipeline;
