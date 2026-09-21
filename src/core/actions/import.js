/**
 * Import and draft commit action handlers
 */

import { Store } from "../store.js";
import { UI } from "../state.js";
import { Router } from "../router.js";
import { CFG } from "../../config/constants.js";
import { toast } from "../../utils/dom.js";
import { uid, minutesToHM } from "../../utils/helpers.js";
import { Tasks } from "../../domain/tasks.js";
import { RAG } from "../../domain/rag.js";
import { Planner } from "../../domain/planner.js";
import { addDays, dateOnly, fromIso } from "../../utils/date.js";

export function summarizeImportPlan(suggestedPlan, stats, planItems) {
  const totalMinutes = Number(suggestedPlan && suggestedPlan.totalMinutes) || 0;
  const scheduledBlocks = (planItems || []).length;
  const reviewBlocks = (planItems || []).filter(function (item) {
    return /^Review:/i.test(String(item && item.label ? item.label : ""));
  }).length;
  const deadlineCount = Number(stats && stats.events) || 0;
  const readingCount = Number(stats && stats.readings) || 0;
  const lessonCount = Number(stats && stats.lessons) || 0;
  const unscheduledCount = ((suggestedPlan && suggestedPlan.unscheduled) || [])
    .length;
  const summaryParts = [
    minutesToHM(totalMinutes),
    scheduledBlocks + " scheduled block" + (scheduledBlocks === 1 ? "" : "s"),
    deadlineCount + " deadline" + (deadlineCount === 1 ? "" : "s"),
    readingCount + " reading" + (readingCount === 1 ? "" : "s"),
    lessonCount + " topic" + (lessonCount === 1 ? "" : "s"),
  ];
  const plannedText = summaryParts.join(" • ");
  const reviewText =
    reviewBlocks > 0
      ? " with " +
        reviewBlocks +
        " review block" +
        (reviewBlocks === 1 ? "" : "s")
      : " without additional review blocks";
  const capacityText = unscheduledCount
    ? " " +
      unscheduledCount +
      " item" +
      (unscheduledCount === 1 ? "" : "s") +
      " still need attention."
    : " All imported work fits the current study capacity.";
  return "Suggested plan: " + plannedText + reviewText + "." + capacityText;
}

export function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !data.version)
          throw new Error("Invalid Journey A.I backup file.");
        const allowed = [
          "courses",
          "events",
          "lessons",
          "documents",
          "readings",
          "settings",
        ];
        const valid = allowed.every(function (k) {
          return !data[k] || Array.isArray(data[k]);
        });
        if (!valid) throw new Error("Backup contains invalid data types.");
        allowed.forEach(function (k) {
          if (data[k]) Store.db[k] = data[k];
        });
        Store.saveNow();
        Router.scheduleRender();
        toast("Data imported successfully.", "ok");
      } catch (e) {
        toast(e.message || "Import failed.", "bad", "Import error");
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

export function commitDraft() {
  const draft = UI.draft;
  if (!draft) return;
  let courseId = draft.courseId;
  const nc = draft.newCourse;
  const detectedCourse =
    (draft.payloads || [])
      .map(function (payload) {
        return (
          payload.result && payload.result.pnu && payload.result.pnu.course
        );
      })
      .find(function (course) {
        return course && (course.code || course.title);
      }) || {};
  if (
    !courseId &&
    ((nc && (nc.code || nc.title)) ||
      detectedCourse.code ||
      detectedCourse.title)
  ) {
    const newC = {
      id: uid("crs"),
      code: nc.code || detectedCourse.code || "",
      title: nc.title || detectedCourse.title || "Imported course",
      color: CFG.palette[Store.db.courses.length % CFG.palette.length],
      instructor: "",
      term: "Term",
      days: "",
      room: "",
      credits: 3,
      startDate: Store.db.settings.termStart,
      endDate: Store.db.settings.termEnd,
      createdAt: new Date().toISOString(),
    };
    Store.db.courses.push(newC);
    courseId = newC.id;
  }
  if (courseId && detectedCourse) {
    const existingCourse = Store.db.courses.find(function (course) {
      return course.id === courseId;
    });
    if (existingCourse) {
      if (!existingCourse.code && detectedCourse.code)
        existingCourse.code = detectedCourse.code;
      if (
        (!existingCourse.title || existingCourse.title === "Imported course") &&
        detectedCourse.title
      )
        existingCourse.title = detectedCourse.title;
    }
  }
  (draft.payloads || []).forEach((p) => {
    const r = p.result;
    if (!r) return;
    (r.lessons || [])
      .filter((l) => l.include !== false && l.topic)
      .forEach((l) => {
        const termStart = fromIso(Store.db.settings.termStart);
        const weekStart = l.start
          ? fromIso(l.start)
          : termStart && l.week != null
            ? addDays(termStart, Math.max(0, l.week - 1) * 7)
            : null;
        const start = weekStart ? dateOnly(weekStart) : null;
        const end = weekStart ? dateOnly(addDays(weekStart, 2)) : null;
        const duplicate = Store.db.lessons.find(function (lesson) {
          return (
            lesson.courseId === courseId &&
            lesson.week === l.week &&
            lesson.topic === l.topic
          );
        });
        if (duplicate) {
          if (!duplicate.start && start) duplicate.start = start;
          if (!duplicate.end && end) duplicate.end = end;
          return;
        }
        Store.db.lessons.push({
          id: uid("lsn"),
          topic: l.topic,
          week: l.week,
          courseId: courseId,
          notes: "",
          done: false,
          start: start,
          end: end,
          readings: [],
          eventIds: [],
          source: "import",
        });
      });
    (r.events || [])
      .filter((e) => e.include !== false && e.title)
      .forEach((e) => {
        const ev = {
          id: uid("ev"),
          title: e.title,
          type: e.type || "assignment",
          courseId: courseId,
          due: e.due || null,
          weight: e.weight != null ? e.weight : null,
          points: e.points != null ? e.points : null,
          pointsEarned: null,
          notes: "",
          status: "todo",
          createdAt: new Date().toISOString(),
          confidence: e.confidence || 0.5,
          sourceDocId: null,
          source: "import",
          readingIds: [],
          subtasks: Tasks.subtasksFor(
            e.type || "assignment",
            e.weight,
            null,
            e.due ? new Date(e.due) : null,
          ),
        };
        Store.db.events.push(ev);
        Tasks.recompute(ev);
      });
    (r.readings || [])
      .filter((rd) => rd.include !== false && rd.title)
      .forEach((rd) => {
        Store.db.readings.push({
          id: uid("rdg"),
          title: rd.title,
          courseId: courseId,
          week: rd.week || null,
          source: rd.source || "",
          pages: rd.pages || "",
          status: rd.optional ? "optional" : "required",
          docId: null,
        });
      });
    const doc = {
      id: uid("doc"),
      name: p.name || "Imported document",
      kind: p.kind || "other",
      courseId: courseId,
      text: p.text || "",
      chars: (p.text || "").length,
      tables: r.tables || [],
      analysis: r.pnu || null,
      standardAnalysis: r.standard || null,
      importedAt: new Date().toISOString(),
      chunkCount: 0,
    };
    Store.db.documents.push(doc);
  });
  Store.deduplicateData(Store.db);
  const suggestedPlan = Planner.generate({ courseId: courseId || "all" });
  const importStats = {
    events: (draft.payloads || []).reduce(function (total, p) {
      return (
        total +
        ((p && p.result && p.result.events) || []).filter(function (e) {
          return e && e.include !== false && e.title;
        }).length
      );
    }, 0),
    readings: (draft.payloads || []).reduce(function (total, p) {
      return (
        total +
        ((p && p.result && p.result.readings) || []).filter(function (rd) {
          return rd && rd.include !== false && rd.title;
        }).length
      );
    }, 0),
    lessons: (draft.payloads || []).reduce(function (total, p) {
      return (
        total +
        ((p && p.result && p.result.lessons) || []).filter(function (l) {
          return l && l.include !== false && l.topic;
        }).length
      );
    }, 0),
  };
  const planSummary = summarizeImportPlan(
    suggestedPlan,
    importStats,
    (Store.db.plan || []).filter(function (item) {
      return item && item.label;
    }),
  );
  UI.draft = null;
  Store.saveNow();
  RAG.reindexAll(); // Ensure reindexing after saving
  Router.navigate("dashboard");
  toast(
    suggestedPlan.totalMinutes
      ? "Import committed. " + planSummary
      : "Import committed. No open work was available to schedule.",
    suggestedPlan.totalMinutes ? "ok" : "info",
  );
}

export function cancelDraft() {
  UI.draft = null;
  Router.scheduleRender();
}
