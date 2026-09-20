/**
 * Event/task modal — create and edit academic tasks
 */

import { CFG } from "../../config/constants.js";
import { Store } from "../../core/store.js";
import { UI, UIState } from "../../core/state.js";
import { Router } from "../../core/router.js";
import { Tasks } from "../../domain/tasks.js";
import { NLP } from "../../domain/nlp.js";
import { esc, uid } from "../../utils/helpers.js";
import { fromIso } from "../../utils/date.js";
import { q, toast } from "../../utils/dom.js";
import { modal, confirm } from "../../utils/feedback.js";
import { courseSelectOptions } from "../shared.js";

export function eventModal(eventId, preset) {
  preset = preset || {};
  const e = eventId ? Store.event(eventId) : null;
  const defaultType = e ? e.type : "assignment";
  const typeOpts = Object.keys(CFG.taskTypes)
    .map(function (k) {
      const t = CFG.taskTypes[k];
      return (
        '<option value="' +
        k +
        '"' +
        (k === defaultType ? " selected" : "") +
        ">" +
        t.label +
        "</option>"
      );
    })
    .join("");
  const body =
    '<label class="fld"><span>Title</span><input id="evTitle" placeholder="Research paper: memory systems" value="' +
    esc(e ? e.title : preset.title || "") +
    '"></label>' +
    '<div class="grid g2">' +
    '<label class="fld"><span>Course</span><select id="evCourse">' +
    courseSelectOptions(
      e
        ? e.courseId
        : preset.courseId ||
            (UIState.courseId !== "all"
              ? UIState.courseId
              : Store.db.courses[0] && Store.db.courses[0].id),
      false,
    ) +
    "</select></label>" +
    '<label class="fld"><span>Type</span><select id="evType">' +
    typeOpts +
    "</select></label>" +
    "</div>" +
    '<div class="grid g3">' +
    '<label class="fld"><span>Due date</span><input id="evDue" type="date" value="' +
    esc(
      e && e.due
        ? e.due.slice(0, 10)
        : preset.due
          ? preset.due.slice(0, 10)
          : "",
    ) +
    '"></label>' +
    '<label class="fld"><span>Due time</span><input id="evTime" type="time" value="' +
    esc(e && e.due && e.due.length > 10 ? e.due.slice(11, 16) : "23:59") +
    '"></label>' +
    '<label class="fld"><span>Weight (% of grade)</span><input id="evWeight" type="number" min="0" max="100" step="1" value="' +
    esc(e && e.weight != null ? e.weight : "") +
    '"></label>' +
    "</div>" +
    '<div class="grid g2">' +
    '<label class="fld"><span>Points earned</span><input id="evEarned" type="number" min="0" step="0.5" placeholder="leave blank until graded" value="' +
    esc(e && e.pointsEarned != null ? e.pointsEarned : "") +
    '"></label>' +
    '<label class="fld"><span>Points possible</span><input id="evPoints" type="number" min="0" step="0.5" placeholder="e.g. 50" value="' +
    esc(e && e.points != null ? e.points : "") +
    '"></label>' +
    "</div>" +
    '<p class="hint" style="margin-top:-4px">Entering a score feeds the grade column on the dashboard. Weight and points are independent - a task can have either.</p>' +
    '<label class="fld"><span>Notes</span><textarea id="evNotes" placeholder="Requirements, submission rules, links…">' +
    esc(e ? e.notes || "" : "") +
    "</textarea></label>" +
    (e
      ? '<div class="row tiny muted"><span>Source: ' +
        (e.sourceDocId
          ? esc((Store.doc(e.sourceDocId) || {}).name || "document")
          : e.source === "import"
            ? "syllabus import"
            : "manual entry") +
        "</span>" +
        (e.confidence
          ? '<span class="badge ' +
            (e.confidence >= 0.75
              ? "ok"
              : e.confidence >= 0.55
                ? "info"
                : "high") +
            '">extraction confidence ' +
            Math.round(e.confidence * 100) +
            "%</span>"
          : "") +
        "</div>"
      : "") +
    '<label class="fld mt"><span>Subtasks (one per line - leave blank to auto-generate for the type)</span>' +
    '<textarea id="evSubs" style="min-height:110px" placeholder="Optional">' +
    esc(
      e
        ? (e.subtasks || [])
            .map(function (s) {
              return s.title;
            })
            .join("\n")
        : "",
    ) +
    "</textarea></label>" +
    '<label class="fld"><span>Progress</span><select id="evStatus">' +
    ["todo:Not started", "doing:In progress", "done:Completed"]
      .map(function (o) {
        const v = o.split(":")[0];
        return (
          '<option value="' +
          v +
          '"' +
          (e && e.status === v ? " selected" : "") +
          ">" +
          o.split(":")[1] +
          "</option>"
        );
      })
      .join("") +
    "</select></label>";

  modal({
    title: e ? "Edit task" : "New academic task",
    wide: true,
    body: body,
    footer:
      '<button class="btn" data-close="1">Cancel</button>' +
      (e ? '<button class="btn danger" id="evDelete">Delete</button>' : "") +
      '<button class="btn primary" id="evSave">' +
      (e ? "Save changes" : "Add task") +
      "</button>",
    onMount: function (m, closeFn) {
      q("#evSave", m).addEventListener("click", function () {
        const title = q("#evTitle", m).value.trim();
        if (!title) {
          toast("A title is required.", "warn");
          return;
        }
        const dueDate = q("#evDue", m).value;
        const dueTime = q("#evTime", m).value || "23:59";
        const due = dueDate ? dueDate + "T" + dueTime : null;
        const weight =
          q("#evWeight", m).value === ""
            ? null
            : parseFloat(q("#evWeight", m).value);
        const type = q("#evType", m).value;
        const courseId = q("#evCourse", m).value || null;
        const subsText = q("#evSubs", m)
          .value.split("\n")
          .map(function (s) {
            return NLP.clean(s);
          })
          .filter(Boolean);
        const status = q("#evStatus", m).value;

        const target = e || {
          id: uid("ev"),
          createdAt: new Date().toISOString(),
          points: null,
          pointsEarned: null,
          sourceDocId: null,
          confidence: 1,
          readingIds: [],
          subtasks: [],
        };
        const priorDue = e ? e.due : null;
        target.title = title;
        target.type = type;
        target.courseId = courseId;
        target.due = due;
        target.weight = weight;
        target.notes = q("#evNotes", m).value.trim();
        target.status = status;

        const pointsIn = q("#evPoints", m).value;
        const earnedIn = q("#evEarned", m).value;
        target.points = pointsIn === "" ? null : parseFloat(pointsIn);
        target.pointsEarned = earnedIn === "" ? null : parseFloat(earnedIn);
        if (target.points == null) target.grade = null;

        if (subsText.length) {
          const doneCount = e
            ? (e.subtasks || []).filter(function (s) {
                return s.done;
              }).length
            : 0;
          target.subtasks = subsText.map(function (t, i) {
            const prev = e
              ? (e.subtasks || []).filter(function (s) {
                  return s.title === t;
                })[0]
              : null;
            const est = Tasks.estimateSubtask(type, t, weight, subsText.length);
            return {
              id: prev ? prev.id : uid("st"),
              title: t,
              minutes: prev ? prev.minutes : est,
              done: prev ? prev.done : doneCount && i < 1 && status === "done",
              due: prev ? prev.due : null,
            };
          });
        } else if (e) {
          target.subtasks = [];
        } else {
          target.subtasks = Tasks.subtasksFor(
            type,
            weight,
            null,
            due ? fromIso(due) : null,
          );
        }

        if (e && due !== priorDue)
          Tasks.retimeSubtasks(target, due ? fromIso(due) : null);

        if (status === "done")
          target.subtasks.forEach(function (s) {
            s.done = true;
          });
        if (!e) Store.db.events.push(target);
        Tasks.recompute(target);
        Store.saveNow();
        closeFn();
        Router.render();
        UI.toastSaved(e ? "Task updated." : "Task added.");
      });
      const del = q("#evDelete", m);
      if (del)
        del.addEventListener("click", function () {
          confirm('Delete "' + e.title + '" and all of its subtasks?', {
            title: "Delete task",
            ok: "Delete",
            danger: true,
          }).then(function (yes) {
            if (!yes) return;
            Store.db.events = Store.db.events.filter(function (x) {
              return x.id !== e.id;
            });
            Store.db.plan = Store.db.plan.filter(function (p) {
              return p.eventId !== e.id;
            });
            Store.saveNow();
            closeFn();
            Router.render();
            toast("Task deleted.", "ok");
          });
        });
    },
  });
}
