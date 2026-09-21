/**
 * Shared scope/filtering helpers for Journey A.I
 *
 * Extracted from views/shared.js to break the core <-> views circular
 * dependency.  state.js and other core modules import from here instead
 * of reaching into the views layer.
 */

import { Store } from "./store.js";
import { UIState } from "./state.js";
import { Tasks } from "../domain/tasks.js";
import { sortBy } from "../utils/helpers.js";

export function courses() {
  let list = Store.db.courses.slice();
  if (UIState.courseId && UIState.courseId !== "all")
    list = list.filter((c) => c.id === UIState.courseId);
  return list;
}

export function courseIds() {
  return courses().map((c) => c.id);
}

export function inScope(obj) {
  if (UIState.courseId === "all") return true;
  return obj.courseId === UIState.courseId;
}

export function events(opts) {
  opts = opts || {};
  let list = Store.db.events.filter((e) => inScope(e));
  if (opts.status === "open") list = list.filter((e) => e.status !== "done");
  if (opts.status === "done") list = list.filter((e) => e.status === "done");
  return list;
}

export function lessons() {
  return sortBy(
    Store.db.lessons.filter(inScope),
    (l) => (l.start || "9999") + String(l.week).padStart(2, "0"),
  );
}

export function readings() {
  return Store.db.readings.filter(inScope);
}

export function docs() {
  return Store.db.documents.filter(inScope);
}

export function eventProgress(e) {
  return Tasks.progress(e);
}

export function remainingMinutes(e) {
  return Tasks.remainingMinutes(e);
}

/** Chart instance registry - shared across the app. */
export const charts = {};

export function killCharts() {
  Object.keys(charts).forEach((k) => {
    try {
      charts[k].destroy();
    } catch (_e) { /* intentionally empty */ }
    delete charts[k];
  });
}
