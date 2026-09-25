/**
 * Task, subtask, and reading toggle action handlers
 */

import { Store } from "../store.js";
import { Router } from "../router.js";
import { Tasks } from "../../domain/tasks.js";
import { confirm } from "../../utils/feedback.js";
import { toast } from "../../utils/dom.js";

export function toggleTask(id) {
  const ev = Store.db.events.find((x) => x.id === id);
  if (!ev) return;
  const goingDone = ev.status !== "done";
  if (goingDone) {
    (ev.subtasks || []).forEach((s) => {
      s.done = true;
    });
  } else {
    (ev.subtasks || []).forEach((s) => {
      s.done = false;
    });
  }
  Tasks.recompute(ev);
  Store.saveNow();
  Router.scheduleRender();
}

export function toggleSubtask(eventId, subId) {
  const ev = Store.db.events.find((x) => x.id === eventId);
  if (!ev) return;
  const sub = (ev.subtasks || []).find((s) => s.id === subId);
  if (!sub) return;
  sub.done = !sub.done;
  Tasks.recompute(ev);
  Store.saveNow();
  Router.scheduleRender();
}

export function toggleReading(id) {
  const r = Store.db.readings.find((x) => x.id === id);
  if (!r) return;
  r.status = r.status === "done" ? "required" : "done";
  Store.saveNow();
  Router.scheduleRender();
}

export function deleteTask(id) {
  const ev = Store.db.events.find((x) => x.id === id);
  if (!ev) return;
  confirm('Delete "' + ev.title + '"?', {
    title: "Delete to-do",
    ok: "Delete",
    danger: true,
  }).then((yes) => {
    if (!yes) return;
    Store.db.events = Store.db.events.filter((x) => x.id !== id);
    Store.db.plan = Store.db.plan.filter((p) => p.eventId !== id);
    Store.saveNow();
    Router.scheduleRender();
    toast("To-do deleted.", "ok");
  });
}

