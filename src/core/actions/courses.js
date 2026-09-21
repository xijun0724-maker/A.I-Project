/**
 * Course, document, lesson, and chat action handlers
 */

import { Store } from "../store.js";
import { UIState } from "../state.js";
import { Router } from "../router.js";
import { toast } from "../../utils/dom.js";
import { confirm } from "../../utils/feedback.js";
import {
  courseModal,
  eventModal,
  lessonModal,
  docModal,
  readingModal,
} from "../../views/modals/index.js";

export function deleteCourse(id) {
  const c = Store.db.courses.find((x) => x.id === id);
  if (!c) return;
  confirm(
    'Delete "' +
      (c.code || c.title) +
      '" and all its tasks, topics and readings?',
    {
      title: "Delete course",
      ok: "Delete",
      danger: true,
    },
  ).then((yes) => {
    if (!yes) return;
    Store.removeCourse(id);
    if (UIState.courseId === id) UIState.courseId = "all";
    Router.scheduleRender();
    toast("Course deleted.", "ok");
  });
}

export function deleteDocument(id) {
  const d = Store.db.documents.find((x) => x.id === id);
  if (!d) return;
  confirm('Remove "' + d.name + '" from your library?', {
    title: "Delete document",
    ok: "Delete",
    danger: true,
  }).then((yes) => {
    if (!yes) return;
    Store.db.documents = Store.db.documents.filter((x) => x.id !== id);
    Store.db.chunks = (Store.db.chunks || []).filter((c) => c.docId !== id);
    UIState.chatSources = (UIState.chatSources || []).filter(
      (sourceId) => sourceId !== id,
    );
    Store.saveNow();
    Router.scheduleRender();
    toast("Document removed.", "ok");
  });
}

export function toggleLesson(id) {
  const l = Store.db.lessons.find((x) => x.id === id);
  if (!l) return;
  l.done = !l.done;
  Store.saveNow();
  Router.scheduleRender();
}

export function clearChat() {
  confirm("Clear all chat messages? This cannot be undone.", {
    title: "Clear chat",
    ok: "Clear",
    danger: true,
  }).then((yes) => {
    if (!yes) return;
    Store.db.chat = [];
    Store.saveNow();
    Router.scheduleRender();
    toast("Chat cleared.", "ok");
  });
}

export { courseModal, eventModal, lessonModal, docModal, readingModal };
