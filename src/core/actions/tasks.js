/**
 * Task, subtask, and reading toggle action handlers
 */

import { Store } from "../store.js";
import { confirm } from "../../utils/feedback.js";
import { toast } from "../../utils/dom.js";

export function toggleTask(id) {
  Store.events.toggle(id);
}

export function toggleSubtask(eventId, subId) {
  Store.events.toggleSubtask(eventId, subId);
}

export function toggleReading(id) {
  Store.readings.toggle(id);
}

export function deleteTask(id) {
  const ev = Store.events.get(id);
  if (!ev) return;
  confirm('Delete "' + ev.title + '"?', {
    title: "Delete to-do",
    ok: "Delete",
    danger: true,
  }).then((yes) => {
    if (!yes) return;
    Store.events.remove(id);
    toast("To-do deleted.", "ok");
  });
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

