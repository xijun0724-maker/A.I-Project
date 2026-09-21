/**
 * Shared UI helper functions for Journey A.I Views
 * Scope/course filtering and chart management live in core/scope.js.
 * This module re-exports them alongside view-specific helpers
 * (typeMeta, courseSelectOptions, pageHead, etc.).
 */

import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import {
  courses,
  courseIds,
  inScope,
  events,
  lessons,
  readings,
  docs,
  eventProgress,
  remainingMinutes,
  charts,
  killCharts,
} from "../core/scope.js";
import { esc } from "../utils/helpers.js";
import { toast } from "../utils/dom.js";
import {
  bar as _bar,
  ring as _ring,
  empty as _empty,
  priBadge as _priBadge,
  eventBadge as _eventBadge,
  courseChip as _courseChip,
  dueLabel as _dueLabel,
  statBox as _statBox,
  tabBtn as _tabBtn,
} from "../utils/format.js";

function typeMeta(t) {
  return CFG.taskTypes[t] || CFG.taskTypes.other;
}

function courseSelectOptions(selected, allowAll) {
  let h = allowAll
    ? '<option value="all"' +
      (selected === "all" ? " selected" : "") +
      ">All courses</option>"
    : "";
  Store.db.courses.forEach((c) => {
    h +=
      '<option value="' +
      c.id +
      '"' +
      (selected === c.id ? " selected" : "") +
      ">" +
      esc(c.code || c.title) +
      "</option>";
  });
  return h;
}

function toastSaved(msg) {
  toast(msg || "Saved.", "ok");
}

function chartTheme() {
  if (!window.Chart) return false;
  const isDark = document.documentElement.dataset.theme === "dark";
  Chart.defaults.color = isDark ? "#cccccc" : "#7a7a7a";
  Chart.defaults.borderColor = isDark
    ? "rgba(255,255,255,.08)"
    : "rgba(0,0,0,.06)";
  Chart.defaults.font.family =
    '"Inter",-apple-system,"Segoe UI",Roboto,sans-serif';
  Chart.defaults.font.size = 11.5;
  return true;
}

/** Render a standard page header with title, lead text, and optional right-side content. */
export function pageHead(title, lead, right) {
  let h = '<div class="page-head"><div><h1>' + title + "</h1>";
  if (lead) h += '<p class="lead">' + lead + "</p>";
  h += "</div>";
  if (right) h += '<span class="spacer"></span>' + right;
  h += "</div>";
  return h;
}

export const Shared = {
  courses,
  courseIds,
  inScope,
  events,
  lessons,
  readings,
  docs,
  eventProgress,
  remainingMinutes,
  typeMeta,
  priBadge: _priBadge,
  eventBadge: _eventBadge,
  courseChip: _courseChip,
  bar: _bar,
  ring: _ring,
  empty: _empty,
  courseSelectOptions,
  dueLabel: _dueLabel,
  toastSaved,
  charts,
  killCharts,
  chartTheme,
  statBox: _statBox,
};

export {
  courses,
  courseIds,
  inScope,
  events,
  lessons,
  readings,
  docs,
  eventProgress,
  remainingMinutes,
  typeMeta,
  _priBadge as priBadge,
  _eventBadge as eventBadge,
  _courseChip as courseChip,
  _bar as bar,
  _ring as ring,
  _empty as empty,
  courseSelectOptions,
  _dueLabel as dueLabel,
  toastSaved,
  charts,
  killCharts,
  chartTheme,
  _statBox as statBox,
  _tabBtn as tabBtn,
};

export default Shared;
