/**
 * Text helpers for syllabus NLP — pure functions with no store/date coupling
 * beyond the shared date-format regexes.
 */

import { MONTH_FIRST_G, DAY_FIRST_G } from "../../utils/date.js";

/** Assessment keyword -> task type. Order matters (specific before generic). */
export const TYPE_RULES = [
  {
    type: "project",
    re: /\b(project|capstone|final deliverable|implementation|prototype|toolkit|lemp|learning environment management plan)\b/i,
  },
  {
    type: "exam",
    re: /\b(midterm|mid-?term exam|final exam|finals|examination|exam)\b/i,
  },
  { type: "quiz", re: /\b(quiz|quizzes)\b/i },
  {
    type: "presentation",
    re: /\b(presentation|present(?:ation)?|defense|demo day|oral report|pitch)\b/i,
  },
  { type: "lab", re: /\b(lab|laboratory|experiment)\b/i },
  {
    type: "assignment",
    re: /\b(assignment|homework|hw\s?\d|problem set|pset|paper|essay|report|write-?up|response|reflection|journal|portfolio|draft|proposal|case study|literature review|exercise|worksheet|submission|deliverable)\b/i,
  },
  {
    type: "reading",
    re: /\b(reading|readings|read|chapter|ch\.|textbook|article|handout|reading packet|pp\.)\b/i,
  },
];

export const WEEK_RE =
  /\b(?:week|wk|session|module|unit|lecture|class|topic|part)\s*#?\s*(\d{1,2})\b/i;
export const SESSION_ROW_RE = /^\s*(\d{1,2})\s+(.*)$/;
export const NOISE_RE = /^[\d\s\-–—().:+]+$|@|\bhttps?:\/\/|\bwww\./i;

export function typeOf(line) {
  for (let i = 0; i < TYPE_RULES.length; i++) {
    if (TYPE_RULES[i].re.test(line)) return TYPE_RULES[i].type;
  }
  return null;
}

export function weekOf(line) {
  const m = WEEK_RE.exec(line);
  if (!m) return null;
  const idx = m.index;
  if (
    idx > 24 &&
    !/[:\-–—]/.test(line.slice(idx + m[0].length, idx + m[0].length + 2))
  )
    return null;
  return parseInt(m[1], 10);
}

export function sessionOf(line) {
  const m = SESSION_ROW_RE.exec(String(line || ""));
  if (!m) return null;
  if (/^\s*\d{1,2}\s*[.)]/.test(String(line || ""))) return null;
  const number = parseInt(m[1], 10);
  if (number < 0 || number > 20 || !m[2].trim()) return null;
  return number;
}

/** PNU institutional header stamps repeated on every TEDPATH PDF page. */
const PNU_STAMP_RE =
  /^(?:Reference\s+No\.?\s+PNU|Issue\s+No\.?\s*\d|Rev(?:ision)?\.?\s+No\.?\s*\d|Taft\s+Ave\.|Trunkline:\s*\+|(?:CMI\s+TEACHER\s+EDUCATION\s+PATHWAYS|UCM\s+OBE\s+COURSE)\s+SYLLABUS|Page\s+\d+\s*\/|\(All\s+documents\s+without|DC\s+No\.\s+CC\d)/i;

export function isNoise(line) {
  const s = String(line || "").trim();
  if (!s || s.length < 3) return true;
  if (NOISE_RE.test(s)) return true;
  if (/^(page|pg)\.?\s*\d+/i.test(s)) return true;
  if (/^(table of contents|contents|syllabus|course syllabus)$/i.test(s))
    return true;
  if (PNU_STAMP_RE.test(s)) return true;
  return false;
}

export function clean(s) {
  return String(s == null ? "" : s)
    .replace(/^[\s•●▪○‣·*\-–—>|]+/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*[:;,]+\s*$/, "")
    .trim();
}

export function stripDates(s) {
  let out = String(s || "");
  out = out.replace(
    /\b(?:due|deadline|submit(?:ted)?|submission|posted|by)\b\s*[:_-]?/gi,
    " ",
  );
  out = out.replace(
    /^\s*(?:week|wk|session|module|unit|lecture|class|part)\s*#?\s*\d{1,2}\s*[:\-\u2013\u2014.]?\s*/i,
    " ",
  );
  out = out.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, " ");
  out = out.replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g, " ");
  out = out.replace(MONTH_FIRST_G, " ");
  out = out.replace(DAY_FIRST_G, " ");
  out = out.replace(
    /\b(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?\.?\b/gi,
    " ",
  );
  out = out.replace(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ");
  out = out.replace(/\b\d{1,3}(?:\.\d+)?\s*%/g, " ");
  out = out.replace(/\b\d{1,4}\s*(?:points|pts|marks)\b/gi, " ");
  out = out.replace(/[\u2013\u2014]/g, "-");
  out = out.replace(/\s*[-–—|]+\s*$/g, "").replace(/^\s*[-–—|]+\s*/g, "");
  out = out.replace(/\s*\(\s*\)/g, " ").replace(/\s*\[\s*\]/g, " ");
  out = out.replace(/\s{2,}/g, " ");
  for (let guard = 0; guard < 3; guard++) {
    out = out.replace(
      /\s+\b(?:on|at|by|for|to|of|in|and|or|the|is|are|was|due|week|day|noon|midnight)\b\.?\s*$/i,
      "",
    );
  }
  return clean(out);
}

export function weightOf(line) {
  // PNU grade-point-scale rows look like "98 - 100   1.00   Excellent" —
  // these are not assessment weights; skip them.
  if (/\b\d{2,3}\s*[-–]\s*\d{2,3}(?:\.\d+)?\s+\d+\.\d{2}\b/.test(line)) return null;
  if (/\b(?:grade\s+in\s+percent|grade\s+point\s+scale|adjectival\s+description)\b/i.test(line)) return null;
  let m = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(line);
  if (m) return { weight: parseFloat(m[1]), unit: "%" };
  m = /\b(\d{1,4})\s*(?:points|pts|marks)\b/i.exec(line);
  if (m) return { points: parseInt(m[1], 10), unit: "points" };
  return null;
}

export function looksLikeReading(line) {
  return /\b(chapter|ch\.|read(?:ing|ings)?|pp\.|pages?|textbook|handout|article|packet|worksheet|skim|review the)\b/i.test(
    line,
  );
}

export function isSyllabusAssessmentLine(line) {
  const value = String(line || "");
  if (value.length < 4 || value.length > 220) return false;
  if (
    /^(?:assessment|course requirements|performance criteria|focus on|rubric)$/i.test(
      value,
    )
  )
    return false;
  return /\b(?:midterm|mid-?term|final exam(?:ination)?|exam(?:ination)?|quiz(?:zes)?|assignment|presentation|portfolio|worksheet|discussion question|lemp|learning environment management plan|submission|project|rubric|reflection|journal|report)\b/i.test(
    value,
  );
}

export function uniqueCleanLines(lines, limit) {
  const seen = {};
  const out = [];
  (lines || []).forEach(function (line) {
    const value = clean(line);
    if (value.length < 3 || seen[value.toLowerCase()]) return;
    seen[value.toLowerCase()] = true;
    out.push(value);
  });
  return limit ? out.slice(0, limit) : out;
}

export function tableLines(tables) {
  const out = [];
  (tables || []).forEach(function (t) {
    if (t.header) out.push(t.header.join(" | "));
    (t.rows || []).forEach(function (r) {
      const joined = r
        .map(function (c) {
          return c || "";
        })
        .join(" | ");
      if (joined.replace(/[\s|]/g, "")) out.push(joined);
    });
  });
  return out;
}
