/**
 * Planner action handlers
 */

import { Store } from "../store.js";
import { UI, UIState } from "../state.js";
import { Router } from "../router.js";
import { toast } from "../../utils/dom.js";
import { confirm } from "../../utils/feedback.js";
import { Planner } from "../../domain/planner.js";
import { RAG } from "../../domain/rag.js";
import { Pipeline } from "../../domain/pipeline.js";
import { minutesToHM } from "../../utils/helpers.js";

export function generatePlan() {
  const meta = Planner.generate({ courseId: UIState.courseId });
  Store.saveNow();
  Router.scheduleRender();
  if (!meta.totalMinutes && !meta.unscheduled.length) {
    toast(
      "No open tasks are available to schedule. Add a syllabus or task first.",
      "info",
    );
  } else if (meta.unscheduled.length) {
    toast(
      "Study plan generated with " +
        meta.unscheduled.length +
        " item(s) left unscheduled.",
      "warn",
    );
  } else {
    toast(
      "Study plan generated: " + minutesToHM(meta.totalMinutes) + " scheduled.",
      "ok",
    );
  }
}

export function clearPlan() {
  confirm("Clear the entire study plan?", {
    title: "Clear plan",
    ok: "Clear",
    danger: true,
  }).then((yes) => {
    if (!yes) return;
    Store.db.plan = [];
    Store.db.planMeta = null;
    Store.saveNow();
    Router.scheduleRender();
  });
}

export function togglePlanItem(id) {
  if (!Planner.toggle(id)) return;
  Router.scheduleRender();
}

export function resetData() {
  confirm(
    "This will permanently delete all courses, tasks, documents and chat messages. Export a backup first.",
    { title: "Reset all data", ok: "Reset everything", danger: true },
  ).then((yes) => {
    if (!yes) return;
    Store.db.courses = [];
    Store.db.events = [];
    Store.db.lessons = [];
    Store.db.readings = [];
    Store.db.documents = [];
    Store.db.chunks = [];
    Store.db.chat = [];
    Store.db.plan = [];
    Store.db.planMeta = null;
    Store.db.activity = [];
    Store.saveNow();
    Router.navigate("dashboard");
    toast("All data has been reset.", "ok");
  });
}

export function loadDemo() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.docx,.txt,.csv";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      toast("Parsing file...", "info");
      const payload = await Pipeline.analyseFile(file, {
        courseId: null,
        kind: "syllabus",
      });
      const meta = payload.result?.courseMeta || {};
      UI.draft = {
        payloads: [payload],
        courseId: null,
        newCourse: {
          code: meta.code || file.name.replace(/\.[^.]+$/, ""),
          title: meta.title || "",
        },
      };
      Router.navigate("import");
    } catch (e) {
      toast("Failed to import: " + (e.message || e), "bad", "Import error");
    }
  };
  input.click();
}

export function reindexFn() {
  toast("Rebuilding retrieval index...", "info");
  RAG.reindexAll();
  Store.saveNow();
  Router.scheduleRender();
  toast("Index rebuilt.", "ok");
}
