import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import { UI, UIState } from "../core/state.js";
import { Dashboard } from "../domain/dashboard.js";
import { Coach } from "../domain/coach.js";
import { Tasks } from "../domain/tasks.js";
import * as AI from "../ai/index.js";
import { esc, sum, minutesToHM, sortBy } from "../utils/helpers.js";
import {
  fmtDate,
  rel,
  dateOnly,
  daysUntil,
  mondayOf,
  addDays,
} from "../utils/date.js";
import { q } from "../utils/dom.js";
import {
  empty,
  bar,
  ring,
  eventBadge,
  charts as sharedCharts,
  chartTheme,
  statBox,
  pageHead,
} from "./shared.js";

function registerChart(key, chart) {
  sharedCharts[key] = chart;
}

function renderWeekBand(
  wkNo,
  ready,
  monday,
  sunday,
  wkEvents,
  nextEv,
  wkMinutes,
  wkCapacity,
  overdueNow,
) {
  const slack = wkCapacity - wkMinutes;
  return (
    '<div class="band">' +
    '<div class="band-n">' +
    wkNo +
    "<small>week</small></div>" +
    '<div class="band-body">' +
    '<div class="band-title">' +
    fmtDate(dateOnly(monday), false) +
    " to " +
    fmtDate(dateOnly(sunday), false) +
    "</div>" +
    '<div class="band-meta">' +
    (wkEvents.length
      ? wkEvents.length +
        " task" +
        (wkEvents.length === 1 ? "" : "s") +
        " due this week. Next: " +
        esc(wkEvents[0].title) +
        ", " +
        rel(wkEvents[0].due) +
        "."
      : "Nothing is due this week. " +
        (nextEv
          ? "The next deadline is " +
            esc(nextEv.title) +
            ", " +
            rel(nextEv.due) +
            "."
          : "Add a syllabus to build the term out.")) +
    "</div>" +
    '<div class="band-load">' +
    "<div><b>" +
    minutesToHM(wkMinutes) +
    "</b><span>work left this week</span></div>" +
    "<div><b>" +
    minutesToHM(wkCapacity) +
    "</b><span>study time you have</span></div>" +
    "<div><b" +
    (slack < 0 ? ' style="color:var(--error)"' : "") +
    ">" +
    (slack < 0 ? "" : "+") +
    minutesToHM(Math.abs(slack)) +
    "</b><span>" +
    (slack < 0 ? "short of the week\u2019s work" : "spare capacity") +
    "</span></div>" +
    (overdueNow.length
      ? '<div><b style="color:var(--error)">' +
        overdueNow.length +
        "</b><span>past due</span></div>"
      : "") +
    "</div></div></div>"
  );
}

function renderRecommendations(recs) {
  let h =
    '<div class="card"><div class="card-head"><h2>What to do next</h2><span class="spacer"></span>' +
    '<span class="tiny muted">' +
    (AI.usable()
      ? "AI-assisted, and derived from your deadlines, progress and workload"
      : "derived from your deadlines, progress and workload") +
    "</span></div>";
  if (!recs.length) {
    h += empty(
      "",
      "Nothing needs your attention",
      "Add courses and deadlines and recommendations will appear here.",
    );
  }
  recs.slice(0, 6).forEach(function (r) {
    const cls =
      { high: "crit", med: "high", info: "info", ok: "ok" }[r.severity] ||
      "mute";
    h +=
      '<div class="list-item"><div class="body"><div class="t">' +
      esc(r.title) +
      ' <span class="badge ' +
      cls +
      '">' +
      esc(r.kind) +
      "</span></div>" +
      '<div class="small muted" style="margin-top:3px">' +
      esc(r.detail) +
      "</div>" +
      ((r.actions || []).length
        ? '<div class="row mt-s">' +
          r.actions
            .map(function (a) {
              return (
                '<button class="btn xs" data-act="' +
                (a.act === "view"
                  ? "nav"
                  : a.act === "ask"
                    ? "ask"
                    : "event-edit") +
                '" data-arg="' +
                esc(a.arg) +
                '">' +
                esc(a.label) +
                "</button>"
              );
            })
            .join("") +
          "</div>"
        : "") +
      "</div></div>";
  });
  h += "</div>";
  return h;
}

function renderTermProgress(ready) {
  if (!ready) return '<div class="grid gap-md"></div>';
  return (
    '<div class="grid gap-md">' +
    '<div class="card"><div class="card-head"><h3>Term progress</h3></div>' +
    '<div class="row" style="align-items:center;gap:14px">' +
    ring(ready.workPct) +
    '<div class="flex-fill"><div class="small"><strong>' +
    ready.workPct +
    "%</strong> of work complete</div>" +
    '<div class="tiny muted mb-s">' +
    ready.timePct +
    "% of the term has elapsed</div>" +
    bar(ready.timePct, "warn") +
    "</div></div>" +
    '<p class="hint">' +
    (ready.workPct + 12 < ready.timePct
      ? "Your completion is behind the term clock \u2014 schedule catch-up blocks in the planner."
      : "You are tracking at or ahead of the term pace.") +
    "</p></div></div>"
  );
}

function renderCourseProgress() {
  const rows = Dashboard.completionByCourse();
  let h =
    '<div class="card"><div class="card-head"><h2>Course progress</h2></div>';
  if (!rows.length) {
    h += empty(
      "",
      "No courses yet",
      "Add a course to start tracking.",
      '<button class="btn primary mt" data-act="new-course">Add course</button>',
    );
  } else {
    h +=
      '<table aria-label="Course progress"><thead><tr><th>Course</th><th style="min-width:130px">Tasks</th><th>Topics</th><th>Grade</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h +=
        '<tr><td><span class="dot" style="background:' +
        r.course.color +
        '"></span> <strong>' +
        esc(r.course.code || r.course.title) +
        "</strong>" +
        '<div class="tiny muted">' +
        esc(r.course.title || "") +
        "</div></td>" +
        "<td>" +
        bar(r.pct) +
        '<div class="tiny muted">' +
        r.done +
        "/" +
        r.tasks +
        ' <i class="msep"></i> ' +
        r.pct +
        "%</div></td>" +
        '<td class="tiny">' +
        r.lessonsDone +
        "/" +
        r.lessons +
        "</td>" +
        "<td>" +
        (r.grade.grade != null
          ? "<strong>" +
            r.grade.grade.toFixed(1) +
            '%</strong> <span class="tiny muted">' +
            Dashboard.letter(r.grade.grade) +
            "</span>"
          : '<span class="tiny muted">\u2014</span>') +
        "</td></tr>";
    });
    h += "</tbody></table>";
  }
  h += "</div>";
  return h;
}

function renderUpcoming() {
  const up = Dashboard.upcoming(7);
  let h =
    '<div class="card"><div class="card-head"><h2>Upcoming deadlines</h2><span class="spacer"></span>' +
    '<button class="btn xs ghost" data-act="export-ics">Calendar (.ics)</button></div>';
  if (!up.length) {
    h +=
      '<p class="small muted">Nothing scheduled. Import a syllabus or add a task.</p>';
  } else {
    h += '<div class="timeline">';
    up.forEach(function (e) {
      const n = daysUntil(e.due);
      h +=
        '<div class="tl-item' +
        (n < 0 ? " overdue" : "") +
        '"><div class="t small strong">' +
        esc(e.title) +
        "</div>" +
        '<div class="tiny muted">' +
        fmtDate(e.due, true) +
        ' <i class="msep"></i> ' +
        rel(e.due) +
        ' <i class="msep"></i> ' +
        esc(Store.courseName(e.courseId)) +
        "</div>" +
        (e.weight != null
          ? '<div class="tiny muted">worth ' + e.weight + "% of the grade</div>"
          : "") +
        "</div>";
    });
    h += "</div>";
  }
  h += "</div>";
  return h;
}

export function dashboard() {
  const hasAcademicData =
    Store.db.courses.length > 0 ||
    Store.db.events.length > 0 ||
    Store.db.lessons.length > 0 ||
    Store.db.readings.length > 0;
  if (!hasAcademicData) {
    return (
      pageHead(
        "Dashboard",
        "Your academic workspace is ready.",
        '<button class="btn sm" data-act="go-import">Import syllabus</button>',
      ) +
      '<div class="card dashboard-empty-card">' +
      empty(
        "",
        "Your dashboard is empty",
        "Import a syllabus or add a course to build your roadmap, tasks, readings and study plan.",
        '<div class="row mt"><button class="btn primary" data-act="go-import">Import a syllabus</button><button class="btn" data-act="new-course">Add a course</button></div>',
      ) +
      "</div>"
    );
  }
  const k = Dashboard.kpis();
  const recs = Coach.recommendations();
  const ready = Dashboard.readiness();

  let h = pageHead(
    "Dashboard",
    (UIState.courseId === "all"
      ? "All courses"
      : esc(Store.courseName(UIState.courseId))) +
      ", week " +
      (ready ? ready.week : Coach.currentWeek()) +
      " of the term",
    '<button class="btn sm" data-act="export-progress">Export report</button>' +
      '<button class="btn sm" data-act="go-import">Import syllabus</button>',
  );

  const wkNo = ready ? ready.week : Coach.currentWeek();
  const monday = mondayOf(new Date()),
    sunday = addDays(monday, 6);
  const wkEvents = sortBy(
    Store.db.events.filter(function (e) {
      return (
        UI.inScope(e) &&
        Tasks.isOpen(e) &&
        e.due &&
        e.due.slice(0, 10) >= dateOnly(monday) &&
        e.due.slice(0, 10) <= dateOnly(sunday)
      );
    }),
    function (e) {
      return e.due;
    },
  );
  const wkMinutes = sum(wkEvents, Tasks.remainingMinutes);
  let wkCapacity = 0;
  for (let wd = 0; wd < 7; wd++)
    wkCapacity += Coach.dailyCapacity(addDays(monday, wd));
  const nextEv = sortBy(
    Store.db.events.filter(function (e) {
      return UI.inScope(e) && Tasks.isOpen(e) && e.due;
    }),
    function (e) {
      return e.due;
    },
  )[0];
  const overdueNow = Store.db.events.filter(function (e) {
    return UI.inScope(e) && Tasks.isOpen(e) && Tasks.isOverdue(e);
  });

  if (!ready) {
    h +=
      '<div class="notice info mb"><div>Every screen here is numbered by week, so a term start and end are what make it legible. ' +
      '<button class="btn xs" data-act="nav" data-arg="settings">Set term dates</button></div></div>';
  } else {
    h += renderWeekBand(
      wkNo,
      ready,
      monday,
      sunday,
      wkEvents,
      nextEv,
      wkMinutes,
      wkCapacity,
      overdueNow,
    );
  }

  h +=
    '<div class="register">' +
    statBox(k.open, "Open tasks", k.due7 + " due within 7 days") +
    statBox(
      k.overdue,
      "Overdue",
      k.overdue ? "needs attention now" : "nothing overdue",
      k.overdue ? "bad" : "ok",
    ) +
    statBox(
      k.completion + "%",
      "Completion",
      k.done + " of " + (k.done + k.open) + " tasks done",
    ) +
    statBox(
      minutesToHM(k.remainingMinutes),
      "Work remaining",
      "estimated from task complexity",
    ) +
    "</div>";

  h += '<div class="grid g-2-1 mb">';
  h += renderRecommendations(recs);
  h += '<div class="grid gap-md">';
  h += renderTermProgress(ready);
  h += "</div></div>";

  h +=
    '<div class="grid g-2-1 mb">' +
    '<div class="card"><div class="card-head"><h2>Workload by week</h2><span class="spacer"></span><span class="tiny muted">remaining task effort, by course</span></div>' +
    '<div style="height:250px"><canvas id="chartWorkload" role="img" aria-label="Workload by week chart"></canvas></div></div>' +
    "</div>";

  h += '<div class="grid g-2-1">';
  h += renderCourseProgress();
  h += renderUpcoming();
  h += "</div>";

  return h;
}

export function afterDashboard(root) {
  if (!chartTheme()) return;
  const wl = Dashboard.workloadByWeek(8);
  const pal = CFG.palette;
  const wlCanvas = q("#chartWorkload", root);
  if (wlCanvas) {
    registerChart(
      "workload",
      new Chart(wlCanvas, {
        type: "bar",
        data: {
          labels: wl.labels,
          datasets: wl.courses.map(function (c, i) {
            return {
              label: c.code || c.title,
              data: wl.data[i],
              backgroundColor: c.color || pal[i % pal.length],
              borderRadius: 4,
              stack: "w",
            };
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                usePointStyle: true,
                padding: 12,
              },
            },
            tooltip: {
              callbacks: {
                label: function (c) {
                  return c.dataset.label + ": " + c.parsed.y + " h";
                },
              },
            },
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: {
              stacked: true,
              beginAtZero: true,
              title: { display: true, text: "hours" },
            },
          },
        },
      }),
    );
  }
}

export const dashboardView = {
  title: "Dashboard",
  fn: dashboard,
  after: afterDashboard,
};
