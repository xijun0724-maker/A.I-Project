/**
 * Task management for Journey A.I
 * Work decomposition, effort estimation and workload prioritisation.
 */

import { CFG } from "../config/constants.js";
import { uid, clamp, sum, sortBy, minutesToHM } from "../utils/helpers.js";
import { DAY, daysUntil, startOfDay, addDays, iso } from "../utils/date.js";

/** Total estimated effort for a task, in minutes, from type + weighting. */
export function effort(type, weight, points) {
  const base = (
    (CFG.taskTypes || {})[type] ||
    (CFG.taskTypes || {}).other || { base: 60 }
  ).base;
  let scale = 1;
  if (weight != null && !isNaN(weight))
    scale = clamp(1 + (weight - 15) / 30, 0.6, 2.8);
  else if (points != null && !isNaN(points)) scale = clamp(points / 10, 0.7, 3);
  return Math.max(15, Math.round((base * scale) / 5) * 5);
}

/** Estimate a single subtask's minutes from its wording. */
export function estimateSubtask(type, title, weight, count) {
  const total = effort(type, weight, null);
  const n = Math.max(1, count || 6);
  let per = total / n;
  const t = String(title || "").toLowerCase();
  if (/write|draft|build|implement|design|solve/.test(t)) per *= 1.45;
  else if (/revise|edit|review|proofread|test/.test(t)) per *= 1.05;
  else if (
    /select|choose|read|skim|prepare|gather|collect|create outline|proposal/.test(
      t,
    )
  )
    per *= 0.8;
  return Math.max(15, Math.round(per / 5) * 5);
}

/** Decompose a task into checkable subtasks with due dates spread backwards from the deadline. */
export function subtasksFor(type, weight, points, dueDate) {
  const tpl = CFG.subtaskTemplates[type] || CFG.subtaskTemplates.other;
  const total = effort(type, weight, points);
  const per = Math.max(15, Math.round(total / tpl.length / 5) * 5);
  const due = dueDate ? startOfDay(dueDate) : null;
  let span = 0,
    spacing = 0;
  if (due) {
    const today = startOfDay(new Date());
    span = Math.max(1, Math.round((due - today) / DAY));
    spacing = Math.max(1, Math.floor(span / tpl.length));
  }
  return tpl.map((title, i) => {
    let d = null;
    if (due)
      d = iso(addDays(due, -Math.max(0, (tpl.length - 1 - i) * spacing)));
    return { id: uid("st"), title, minutes: per, done: false, due: d };
  });
}

/** Re-spread outstanding checkpoints when a task's deadline moves. */
export function retimeSubtasks(e, dueDate) {
  if (!e || !dueDate) return e;
  const open = (e.subtasks || []).filter((s) => !s.done);
  if (!open.length) return e;
  const due = startOfDay(dueDate);
  const today = startOfDay(new Date());
  const days = Math.max(1, Math.round((due - today) / DAY));
  const spacing = Math.max(1, Math.floor(days / open.length));
  open.forEach((s, i) => {
    s.due = iso(addDays(due, -Math.max(0, (open.length - 1 - i) * spacing)));
  });
  return e;
}

/** Remaining minutes for a task. */
export function remainingMinutes(e) {
  if (!e) return 0;
  const s = e.subtasks || [];
  if (!s.length)
    return e.status === "done" ? 0 : effort(e.type, e.weight, e.points);
  return sum(
    s.filter((x) => !x.done),
    (x) => x.minutes || 0,
  );
}

/** Progress percentage for a task. */
export function progress(e) {
  if (!e) return 0;
  const s = e.subtasks || [];
  if (!s.length) return e.status === "done" ? 100 : 0;
  const done = s.filter((x) => x.done).length;
  return Math.round((done / s.length) * 100);
}

/** Recompute derived fields on an event after a mutation.
 * Recalculates status from subtasks, remaining minutes, and priority score.
 * Side-effect-free: returns the event with updated fields.
 */
export function recompute(e) {
  if (!e) return e;
  const subs = e.subtasks || [];
  if (subs.length) {
    const allDone = subs.every((s) => s.done);
    const noneDone = subs.every((s) => !s.done);
    e.status = allDone ? "done" : noneDone ? "todo" : "doing";
  }
  return e;
}

/** Human-readable reason a task ranks where it does.
 * Used by Coach recommendations and the Tasks view.
 */
export function reason(e) {
  if (!e) return "unknown task";
  if (e.status === "done") return "already completed";
  const parts = [];
  if (e.due) {
    const n = daysUntil(e.due);
    if (n === null) parts.push("no deadline set");
    else if (n <= 0) parts.push("it is overdue");
    else if (n === 0) parts.push("it is due today");
    else if (n === 1) parts.push("it is due tomorrow");
    else if (n <= 7) parts.push("it is due within the week");
    else parts.push("it is due in " + n + " days");
  } else {
    parts.push("it has no due date");
  }
  if (e.weight != null)
    parts.push("it is worth " + e.weight + "% of the grade");
  if (e.points != null) parts.push("it is worth " + e.points + " points");
  const rem = remainingMinutes(e);
  if (rem > 0) parts.push("about " + minutesToHM(rem) + " of work remains");
  return parts.join(", ");
}

/** Priority score (0-100) combining urgency, weight and effort. */
export function priority(e) {
  if (!e)
    return { score: 0, urgency: 0, weight: 0, effortScore: 0, label: "Low" };
  const w = CFG.priorityWeights || { urgency: 0.4, weight: 0.35, effort: 0.25 };
  const n = daysUntil(e.due);
  const urgency = n === null ? 0.3 : clamp(1 - n / 14, 0, 1);
  const weight = e.weight != null ? clamp(e.weight / 100, 0, 1) : 0.4;
  const effortScore = clamp(remainingMinutes(e) / 600, 0, 1);
  const score = Math.round(
    (urgency * w.urgency + weight * w.weight + effortScore * w.effort) * 100,
  );
  const label =
    score >= 80
      ? "Critical"
      : score >= 60
        ? "High"
        : score >= 40
          ? "Medium"
          : "Low";
  return { score, urgency, weight, effortScore, label };
}

/** Rank tasks by priority score descending. */
export function ranked(events) {
  return sortBy(events, (e) => -priority(e).score);
}

/** True if the event is not yet completed. */
export function isOpen(e) {
  return e && e.status !== "done";
}

/** True if the event has a due date that has passed. */
export function isOverdue(e) {
  const n = daysUntil(e && e.due);
  return n !== null && n < 0;
}

/** True if the event is due within the next `days` days (including overdue). */
export function isDueSoon(e, days) {
  const n = daysUntil(e && e.due);
  return n !== null && n <= (days || 7);
}

export const Tasks = {
  effort,
  estimateSubtask,
  subtasksFor,
  retimeSubtasks,
  remainingMinutes,
  progress,
  priority,
  ranked,
  recompute,
  reason,
  isOpen,
  isOverdue,
  isDueSoon,
};

export default Tasks;
