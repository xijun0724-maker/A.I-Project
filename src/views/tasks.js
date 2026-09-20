import { Store } from "../core/store.js";
import { UIState } from "../core/state.js";
import { Router } from "../core/router.js";
import { Tasks } from "../domain/tasks.js";
import { esc, sortBy, minutesToHM } from "../utils/helpers.js";
import { fmtDate, rel } from "../utils/date.js";
import { q } from "../utils/dom.js";
import {
  empty,
  bar,
  eventBadge,
  priBadge,
  eventProgress,
  typeMeta,
  tabBtn as _tabBtn,
  pageHead,
} from "./shared.js";

function filterTasks(all, tab) {
  let list = all.slice();
  if (tab === "open") list = list.filter(Tasks.isOpen);
  else if (tab === "today")
    list = list.filter(function (e) {
      return Tasks.isOpen(e) && Tasks.isDueSoon(e, 1);
    });
  else if (tab === "week")
    list = list.filter(function (e) {
      return Tasks.isOpen(e) && Tasks.isDueSoon(e, 7);
    });
  else if (tab === "overdue")
    list = list.filter(function (e) {
      return Tasks.isOpen(e) && Tasks.isOverdue(e);
    });
  else if (tab === "done")
    list = list.filter(function (e) {
      return !Tasks.isOpen(e);
    });
  else if (tab === "nodate")
    list = list.filter(function (e) {
      return !e.due && Tasks.isOpen(e);
    });
  return list;
}

function sortTasks(list, sort) {
  if (sort === "priority") return Tasks.ranked(list);
  if (sort === "due")
    return sortBy(list, function (e) {
      return e.due || "9999";
    });
  if (sort === "course")
    return sortBy(list, function (e) {
      return Store.courseName(e.courseId) + e.title;
    });
  if (sort === "effort")
    return sortBy(list, function (e) {
      return -Tasks.remainingMinutes(e);
    });
  return list;
}

function renderTaskCard(e) {
  const p = Tasks.priority(e);
  const prog = eventProgress(e);
  const tm = typeMeta(e.type);
  const subs = e.subtasks || [];
  const doneSubs = subs.filter(function (s) {
    return s.done;
  }).length;
  const openEnded = subs.length > 1;

  let h = '<div class="card">';
  h +=
    '<div class="row" style="align-items:flex-start">' +
    '<button type="button" class="chk' +
    (e.status === "done" ? " on" : "") +
    '" data-act="task-toggle" data-id="' +
    e.id +
    '"' +
    ' title="Mark complete" role="checkbox" tabindex="0" aria-checked="' +
    (e.status === "done" ? "true" : "false") +
    '" aria-label="Mark ' +
    esc(e.title) +
    ' complete">\u2713</button>' +
    '<div class="flex-fill">' +
    '<div class="row gap-xs">' +
    '<strong style="font-size:14.5px' +
    (e.status === "done" ? '" class="done-text' : "") +
    '">' +
    esc(e.title) +
    "</strong>" +
    priBadge(p.label) +
    eventBadge(e) +
    "</div>" +
    '<div class="tiny muted mt-s">' +
    esc(tm.label) +
    ' <i class="msep"></i> ' +
    esc(Store.courseName(e.courseId)) +
    (e.due
      ? ' <i class="msep"></i> due ' +
        fmtDate(e.due, true) +
        " (" +
        rel(e.due) +
        ")"
      : ' <i class="msep"></i> no deadline') +
    (e.weight != null
      ? ' <i class="msep"></i> ' + e.weight + "% of grade"
      : "") +
    "</div>" +
    '<div class="tiny muted" style="margin-top:3px">' +
    esc(Tasks.reason(e)) +
    (e.confidence && e.confidence < 1
      ? ' <i class="msep"></i> extracted with ' +
        Math.round(e.confidence * 100) +
        "% confidence"
      : "") +
    "</div></div>" +
    '<div class="row nowrap">' +
    '<button class="btn xs ghost" data-act="task-ask" data-id="' +
    e.id +
    '" title="Ask the tutor to help with this">Ask</button>' +
    '<button class="btn xs ghost" data-act="event-edit" data-id="' +
    e.id +
    '">Edit</button>' +
    "</div></div>";

  h +=
    '<div class="row mt-s gap-sm">' +
    '<div class="flex-fill">' +
    bar(prog, prog === 100 ? "ok" : prog > 40 ? "" : "warn") +
    "</div>" +
    '<span class="tiny muted nowrap-cell">' +
    prog +
    '% <i class="msep"></i> ' +
    doneSubs +
    " of " +
    subs.length +
    ' subtasks <i class="msep"></i> ' +
    minutesToHM(Tasks.remainingMinutes(e)) +
    " left</span></div>";

  if (e.notes)
    h += '<div class="small muted mt-s clamp2">' + esc(e.notes) + "</div>";

  if (subs.length) {
    h +=
      '<details class="acc mt"' +
      (openEnded && prog > 0 && prog < 100 ? " open" : "") +
      "><summary>Subtasks (" +
      doneSubs +
      "/" +
      subs.length +
      ')</summary><div class="sub mt-s">';
    subs.forEach(function (s) {
      h +=
        '<div class="list-item flat">' +
        '<button type="button" class="chk' +
        (s.done ? " on" : "") +
        '" data-act="sub-toggle" data-id="' +
        e.id +
        '" data-arg="' +
        s.id +
        '"' +
        ' role="checkbox" tabindex="0" aria-checked="' +
        (s.done ? "true" : "false") +
        '" aria-label="Complete subtask ' +
        esc(s.title) +
        '">\u2713</button>' +
        '<div class="body"><div class="small' +
        (s.done ? " muted done-text" : "") +
        '">' +
        esc(s.title) +
        "</div>" +
        '<div class="tiny muted">' +
        minutesToHM(s.minutes || 0) +
        (s.due ? ' <i class="msep"></i> by ' + fmtDate(s.due) : "") +
        "</div></div></div>";
    });
    h += "</div></details>";
  }

  const linked = Store.db.readings.filter(function (r) {
    return (e.readingIds || []).indexOf(r.id) !== -1;
  });
  if (linked.length) {
    h +=
      '<div class="row mt-s tiny">' +
      linked
        .map(function (r) {
          return (
            '<span class="tag" title="Required reading">' +
            esc(r.title) +
            (r.pages ? " " + esc(r.pages) : "") +
            "</span>"
          );
        })
        .join("") +
      "</div>";
  }
  h += "</div>";
  return h;
}

export function tasks() {
  const tab = UIState.tab.tasks || "open";
  const all = Store.db.events.filter(function (e) {
    if (UIState.courseId && UIState.courseId !== "all")
      return e.courseId === UIState.courseId;
    return true;
  });
  let list = filterTasks(all, tab);
  const sort = UIState.tab.taskSort || "priority";
  list = sortTasks(list, sort);

  const openCount = all.filter(Tasks.isOpen).length;
  const overdue = all.filter(function (e) {
    return Tasks.isOpen(e) && Tasks.isOverdue(e);
  }).length;

  let h = pageHead(
    "Tasks",
    "Every assignment broken into checkable subtasks, ranked by deadline, weighting and remaining effort.",
    '<select id="taskSort" style="width:auto"><option value="priority"' +
      (sort === "priority" ? " selected" : "") +
      ">Sort: priority</option>" +
      '<option value="due"' +
      (sort === "due" ? " selected" : "") +
      ">Sort: due date</option>" +
      '<option value="effort"' +
      (sort === "effort" ? " selected" : "") +
      ">Sort: effort left</option>" +
      '<option value="course"' +
      (sort === "course" ? " selected" : "") +
      ">Sort: course</option></select>" +
      '<button class="btn sm" data-act="plan-generate">Auto-schedule</button>' +
      '<button class="btn primary sm" data-act="task-new">New task</button>',
  );

  h +=
    '<div class="tabs" role="tablist" aria-label="Task filters">' +
    tbtn("open", "Open (" + openCount + ")") +
    tbtn("today", "Due now") +
    tbtn("week", "This week") +
    tbtn("overdue", "Overdue" + (overdue ? " (" + overdue + ")" : "")) +
    tbtn("nodate", "No date") +
    tbtn("done", "Completed") +
    tbtn("all", "All") +
    "</div>";

  if (!list.length) {
    return (
      h +
      '<div class="card">' +
      empty(
        "",
        tab === "done" ? "Nothing completed yet" : "Nothing here",
        "Import a syllabus to generate tasks automatically, or add one by hand.",
        '<button class="btn primary mt" data-act="task-new">New task</button><button class="btn mt" data-act="go-import">Import syllabus</button>',
      ) +
      "</div>"
    );
  }

  h += '<div class="grid">';
  list.forEach(function (e) {
    h += renderTaskCard(e);
  });
  h += "</div>";
  return h;

  function tbtn(id, label) {
    return _tabBtn(id, label, (UIState.tab.tasks || "open") === id, "tasks");
  }
}

export function afterTasks(root) {
  const sel = q("#taskSort", root);
  if (sel)
    sel.addEventListener("change", function () {
      UIState.tab.taskSort = sel.value;
      Router.render();
    });
}

export const tasksView = {
  title: "Tasks",
  fn: tasks,
  after: afterTasks,
};
