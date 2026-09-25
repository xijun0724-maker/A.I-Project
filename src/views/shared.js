/**
 * Shared UI helper functions for Journey A.I Views
 * Scope/course filtering lives in core/scope.js.
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
} from "../core/scope.js";
import { esc } from "../utils/helpers.js";
import { toastSaved } from "../utils/dom.js";
import {
  bar as _bar,
  ring as _ring,
  empty as _empty,
  priBadge as _priBadge,
  statusBadge as _statusBadge,
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
      esc(c.id) +
      '"' +
      (selected === c.id ? " selected" : "") +
      ">" +
      esc(c.code || c.title) +
      "</option>";
  });
  return h;
}

export function pageHead(title, lead, right) {
  let h =
    '<div class="page-head"><div><h1>' + esc(title == null ? "" : title) + "</h1>";
  if (lead) h += '<p class="lead">' + esc(lead) + "</p>";
  h += "</div>";
  if (right) h += '<span class="spacer"></span>' + right;
  h += "</div>";
  return h;
}

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
  _statusBadge as statusBadge,
  _eventBadge as eventBadge,
  _courseChip as courseChip,
  _bar as bar,
  _ring as ring,
  _empty as empty,
  courseSelectOptions,
  _dueLabel as dueLabel,
  toastSaved,
  _statBox as statBox,
  _tabBtn as tabBtn,
};
