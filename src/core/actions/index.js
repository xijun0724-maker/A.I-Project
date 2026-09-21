/**
 * Action dispatch layer for Journey A.I
 * Maps data-act attributes to handlers, with a registered-actions guard
 * so mistyped or stale data-act values warn in development rather than
 * silently doing nothing.
 *
 * Domain-specific handlers are split into sub-modules under ./actions/.
 * View-layer functions (modals, assistant) are loaded via late dynamic
 * imports to keep the core -> views dependency direction clean.
 */

import { Store } from "../store.js";
import { UIState } from "../state.js";
import { Router } from "../router.js";
import { toast } from "../../utils/dom.js";
import { RAG } from "../../domain/rag.js";
import {
  deleteCourse,
  deleteDocument,
  toggleLesson,
  clearChat,
} from "./courses.js";
import { toggleTask, toggleSubtask, toggleReading } from "./tasks.js";
import {
  exportData,
  exportICS,
  exportProgress,
  exportRoadmap,
  exportCSV,
} from "./exports.js";
import { saveSettings, testAI, clearApiKeyFn } from "./settings.js";
import { importData, commitDraft, cancelDraft } from "./import.js";
import {
  generatePlan,
  clearPlan,
  togglePlanItem,
  resetData,
  loadDemo,
  reindexFn,
} from "./planner.js";

/** Known action names - updated as actions are added. */
const KNOWN_ACTIONS = new Set([
  "nav",
  "view",
  "go-import",
  "ask",
  "tab",
  "settings-save",
  "data-export",
  "data-import",
  "data-reset",
  "demo-load",
  "reindex",
  "ai-test",
  "ai-key-clear",
  "new-course",
  "edit-course",
  "del-course",
  "course-view",
  "event-edit",
  "lesson-edit",
  "lesson-new",
  "lesson-toggle",
  "view-doc",
  "del-doc",
  "chat-send",
  "chat-plan",
  "chat-clear",
  "chat-source",
  "chat-sources-clear",
  "chat-sources-toggle",
  "plan-generate",
  "plan-clear",
  "plan-toggle",
  "draft-commit",
  "draft-cancel",
  "export-ics",
  "export-progress",
  "export-roadmap",
  "export-csv",
  "sub-toggle",
  "task-toggle",
  "task-ask",
  "task-new",
  "reading-new",
  "reading-edit",
  "reading-toggle",
  "doc-reanalyse",
  "doc-ask",
]);

function _assertKnown(action) {
  if (
    !KNOWN_ACTIONS.has(action) &&
    typeof window !== "undefined" &&
    window.console
  ) {
    console.warn(
      'Journey A.I: unknown action "' +
        action +
        '" - check the data-act attribute.',
    );
  }
}

function act(action, el) {
  _assertKnown(action);
  const arg = el?.dataset?.arg || el?.dataset?.id || null;
  const id = el?.dataset?.id || null;

  // Navigation actions
  if (action === "nav" || action === "view")
    return Router.navigate(arg || "dashboard");
  if (action === "go-import") return Router.navigate("import");
  if (action === "ask") {
    Router.navigate("assistant");
    requestAnimationFrame(async () => {
      const { sendChat } = await import("../../views/assistant.js");
      sendChat(arg);
    });
    return;
  }
  if (action === "tab") {
    const v = el?.dataset?.view;
    if (v && arg) {
      UIState.tab[v] = arg;
      Router.scheduleRender();
    }
    return;
  }
  if (action === "course-view") {
    UIState.courseId = id;
    Router.navigate(arg || "dashboard");
    return;
  }
  if (action === "task-ask") {
    Router.navigate("assistant");
    const ev = Store.db.events.find((e) => e.id === id);
    if (ev)
      requestAnimationFrame(async () => {
        const { sendChat } = await import("../../views/assistant.js");
        sendChat(
          'Help me understand "' +
            String(ev.title || "").replace(/["'`]/g, "") +
            '"',
        );
      });
    return;
  }

  // Dispatch table for simple actions
  const dispatch = {
    "settings-save": saveSettings,
    "data-export": exportData,
    "data-import": importData,
    "data-reset": resetData,
    "demo-load": loadDemo,
    reindex: reindexFn,
    "ai-test": testAI,
    "ai-key-clear": clearApiKeyFn,
    "new-course": () => _modal("courseModal"),
    "edit-course": () => _modal("courseModal", id),
    "del-course": () => deleteCourse(id),
    "event-edit": () => _modal("eventModal", id),
    "lesson-edit": () => _modal("lessonModal", id),
    "lesson-new": () => _modal("lessonModal"),
    "lesson-toggle": () => toggleLesson(id),
    "view-doc": () => _modal("docModal", id),
    "del-doc": () => deleteDocument(id),
    "chat-send": async () => {
      const { sendChat } = await import("../../views/assistant.js");
      sendChat();
    },
    "chat-plan": async () => {
      const { requestStudyPlan } = await import("../../views/assistant.js");
      requestStudyPlan();
    },
    "chat-clear": clearChat,
    "chat-source": () => {
      const sourceId = id;
      if (!sourceId) return;
      const selected = UIState.chatSources || [];
      UIState.chatSources =
        selected.indexOf(sourceId) === -1
          ? selected.concat(sourceId)
          : selected.filter((value) => value !== sourceId);
      Router.scheduleRender();
    },
    "chat-sources-clear": () => {
      UIState.chatSources = [];
      Router.scheduleRender();
    },
    "chat-sources-toggle": () => {
      UIState.chatSourcesOpen = !UIState.chatSourcesOpen;
      Router.scheduleRender();
    },
    "plan-generate": generatePlan,
    "plan-clear": clearPlan,
    "plan-toggle": () => togglePlanItem(id),
    "draft-commit": commitDraft,
    "draft-cancel": cancelDraft,
    "export-ics": exportICS,
    "export-progress": exportProgress,
    "export-roadmap": exportRoadmap,
    "export-csv": exportCSV,
    "sub-toggle": () => toggleSubtask(id, arg),
    "task-toggle": () => toggleTask(id),
    "task-new": () => _modal("eventModal"),
    "reading-new": () => _modal("readingModal"),
    "reading-edit": () => _modal("readingModal", id),
    "reading-toggle": () => toggleReading(id),
    "doc-reanalyse": () => {
      RAG.reindexAll();
      toast("Re-analysing document\u2026", "ok");
    },
    "doc-ask": () => {
      if (!id) return;
      UIState.chatSources = [id];
      const close = document.querySelector("#modalRoot [data-close]");
      if (close) close.click();
      Router.navigate("assistant");
    },
  };

  const handler = dispatch[action];
  if (handler) handler();
}

/** Late-import a modal function from views to avoid top-level core -> views dep. */
async function _modal(name, ...args) {
  const mod = await import("../../views/modals/index.js");
  if (typeof mod[name] === "function") mod[name](...args);
}

export { act, KNOWN_ACTIONS };
