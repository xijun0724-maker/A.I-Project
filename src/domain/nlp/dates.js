/**
 * Term-aware date helpers for syllabus NLP.
 */

import { Store } from "../../core/store.js";
import { uniq } from "../../utils/helpers.js";
import { addDays, fromIso, parseDate, parseTime } from "../../utils/date.js";

export function termRange() {
  const settings = (Store.db && Store.db.settings) || {};
  let s = fromIso(settings.termStart),
    e = fromIso(settings.termEnd);
  if (!s || !e) {
    const y = new Date().getFullYear();
    s = new Date(y, 0, 1);
    e = new Date(y, 11, 31);
  }
  return { s: s, e: e };
}

export function yearFor(monthIdx) {
  const t = termRange();
  const cands = uniq([t.s.getFullYear(), t.e.getFullYear()]);
  for (let i = 0; i < cands.length; i++) {
    const d = new Date(cands[i], monthIdx, 15);
    if (d >= addDays(t.s, -60) && d <= addDays(t.e, 60)) return cands[i];
  }
  return t.s.getFullYear();
}

export function parseDateSmart(line) {
  let d = parseDate(line, null);
  if (!d) return null;
  const explicit =
    /\b\d{4}\b/.test(line) || /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/.test(line);
  if (!explicit) {
    const y = yearFor(d.getMonth());
    d = new Date(y, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
  }
  const tm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(line);
  if (tm) {
    const t = parseTime(tm[0]);
    if (t) {
      const x = new Date(d);
      x.setHours(t.h, t.m, 0, 0);
      return x;
    }
  }
  return d;
}

export function defaultDue(weekStart) {
  if (!weekStart) return null;
  const d = addDays(weekStart, 4);
  d.setHours(23, 59, 0, 0);
  return d;
}

export function weekStartFrom(line) {
  const d = parseDateSmart(line);
  if (!d) return null;
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(d, diff);
}
