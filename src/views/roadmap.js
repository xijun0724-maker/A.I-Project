import { UI, UIState } from "../core/state.js";
import { Coach } from "../domain/coach.js";
import { Tasks } from "../domain/tasks.js";
import {
  esc,
  sortBy,
  groupBy,
  pct,
  sum,
  minutesToHM,
} from "../utils/helpers.js";
import { fmtDate, fromIso, dateOnly, addDays } from "../utils/date.js";
import {
  empty,
  bar,
  courseChip,
  eventBadge,
  dueLabel,
  typeMeta,
  eventProgress,
  priBadge,
  docs,
  tabBtn as _tabBtn,
  pageHead,
} from "./shared.js";

function renderWeeklyOutline(lessons, events, readings, currentWeek) {
  if (!lessons.length) {
    return (
      '<div class="card">' +
      empty(
        "",
        "No roadmap yet",
        "Import a course syllabus and the weekly topics will be mapped here automatically.",
        '<button class="btn primary mt" data-act="go-import">Import a syllabus</button>',
      ) +
      "</div>"
    );
  }

  const byWeek = groupBy(lessons, function (l) {
    const week = Number(l.week);
    return Number.isFinite(week) ? week : 0;
  });
  const weeks = Object.keys(byWeek)
    .map(Number)
    .filter(function (week) {
      return Number.isFinite(week) && byWeek[week] && byWeek[week].length;
    })
    .sort(function (a, b) {
      return a - b;
    });
  let h = '<div class="grid g-2-1"><div class="card">';

  weeks.forEach(function (w) {
    const group = byWeek[w];
    if (!group || !group.length) return;
    const first = group[0];
    const isCurrent = w === currentWeek;
    const weekStart = first.start
      ? fromIso(first.start + "T00:00")
      : Coach.weekStartDate(w);
    const weekEnd = first.end
      ? fromIso(first.end + "T23:59")
      : weekStart
        ? addDays(weekStart, 6)
        : null;
    const wkEvents = events.filter(function (e) {
      if (!e.due) return false;
      const due = fromIso(e.due);
      return weekStart && due >= addDays(weekStart, -1) && due <= weekEnd;
    });
    const wkReadings = readings.filter(function (r) {
      return r.week === w;
    });
    const doneCount = group.filter(function (l) {
      return l.done;
    }).length;

    h +=
      '<div class="rail' +
      (isCurrent ? " on" : "") +
      '">' +
      '<div class="rail-n">' +
      w +
      (isCurrent ? '<span class="now">now</span>' : "") +
      "</div>" +
      '<div class="rail-body"><div class="week-hdr">' +
      '<span class="wk">Week ' +
      w +
      "</span>" +
      '<span class="tiny muted">' +
      (weekStart
        ? fmtDate(dateOnly(weekStart), false) +
          " to " +
          fmtDate(dateOnly(weekEnd), false)
        : "dates not set") +
      "</span>" +
      '<span class="spacer"></span><span class="tiny muted">' +
      doneCount +
      " of " +
      group.length +
      " topics</span>" +
      "</div>";

    group.forEach(function (l) {
      h +=
        '<div class="list-item">' +
        '<div class="chk' +
        (l.done ? " on" : "") +
        '" data-act="lesson-toggle" data-id="' +
        l.id +
        '"' +
        ' role="checkbox" tabindex="0" aria-checked="' +
        (l.done ? "true" : "false") +
        '" aria-label="Toggle whether this topic is covered">\u2713</div>' +
        '<div class="body"><div class="t' +
        (l.done ? " done-text" : "") +
        '">' +
        esc(l.topic) +
        "</div>";
      if (l.notes) h += '<div class="small muted">' + esc(l.notes) + "</div>";
      if (wkReadings.length) {
        h +=
          '<div class="m">' +
          wkReadings
            .map(function (r) {
              return '<span class="tag">' + esc(r.title) + "</span>";
            })
            .join(" ") +
          "</div>";
      }
      h +=
        '</div><div class="row nowrap">' +
        courseChip(l.courseId) +
        '<button class="btn xs ghost" data-act="lesson-edit" data-id="' +
        l.id +
        '">Edit</button></div></div>';
    });

    wkEvents.forEach(function (e) {
      h +=
        '<div class="list-item flat"><span style="width:17px"></span><div class="body">' +
        '<div class="t small">' +
        esc(e.title) +
        " " +
        eventBadge(e) +
        "</div>" +
        '<div class="m">' +
        fmtDate(e.due, true) +
        (e.weight != null
          ? ' <i class="msep"></i> worth ' + e.weight + "%"
          : "") +
        "</div></div>" +
        '<button class="btn xs" data-act="event-edit" data-id="' +
        e.id +
        '">Open</button></div>';
    });

    if (!group.length && !wkEvents.length)
      h += '<p class="small muted">No content captured for this week.</p>';
    h += "</div></div>";
  });

  h += "</div>";
  h += '<div class="grid gap-md">';
  h +=
    '<div class="card"><div class="card-head"><h3>Roadmap coverage</h3></div>' +
    '<div class="kv"><span class="k">Topics mapped</span><span class="v">' +
    lessons.length +
    "</span></div>" +
    '<div class="kv"><span class="k">Topics completed</span><span class="v">' +
    lessons.filter(function (l) {
      return l.done;
    }).length +
    "</span></div>" +
    '<div class="kv"><span class="k">Weeks covered</span><span class="v">' +
    weeks.length +
    "</span></div>" +
    '<div class="kv"><span class="k">Current week</span><span class="v">' +
    currentWeek +
    "</span></div>" +
    bar(
      pct(
        lessons.filter(function (l) {
          return l.done;
        }).length,
        lessons.length,
      ),
    ) +
    "</div>";
  h +=
    '<div class="card"><div class="card-head"><h3>Add a topic</h3></div>' +
    '<p class="small muted">Manually add a lesson if the syllabus missed it.</p>' +
    '<button class="btn block sm" data-act="lesson-new">New topic</button></div>';
  h += "</div></div>";
  return h;
}

function renderDeadlines(events) {
  const all = sortBy(
    events.filter(function (e) {
      return e.due || e.status !== "done";
    }),
    function (e) {
      return e.due || "9999";
    },
  );
  if (!all.length)
    return (
      '<div class="card">' +
      empty(
        "",
        "No deadlines yet",
        "Import a syllabus or add tasks manually.",
      ) +
      "</div>"
    );

  const grouped = groupBy(all, function (e) {
    return e.due ? e.due.slice(0, 7) : "none";
  });
  let h = '<div class="card">';
  Object.keys(grouped)
    .sort()
    .forEach(function (month) {
      const label =
        month === "none"
          ? "No date set"
          : fromIso(month + "-01T00:00").toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            });
      h +=
        '<div class="week-hdr mt"><span class="wk">' +
        label +
        '</span><span class="spacer"></span>' +
        '<span class="tiny muted">' +
        minutesToHM(sum(grouped[month], Tasks.remainingMinutes)) +
        " of work</span></div>";
      h +=
        '<div class="tbl-wrap"><table aria-label="Assessment calendar"><thead><tr><th>Due</th><th>Assessment</th><th>Type</th><th>Course</th><th>Weight</th><th>Progress</th><th></th></tr></thead><tbody>';
      grouped[month].forEach(function (e) {
        const p = Tasks.priority(e);
        h +=
          '<tr><td class="nowrap-cell">' +
          dueLabel(e.due) +
          "</td>" +
          "<td><strong>" +
          esc(e.title) +
          "</strong></td>" +
          "<td>" +
          esc(typeMeta(e.type).label) +
          "</td>" +
          "<td>" +
          courseChip(e.courseId) +
          "</td>" +
          "<td>" +
          (e.weight != null
            ? e.weight + "%"
            : e.points != null
              ? e.points + " pts"
              : '<span class="tiny muted">\u2014</span>') +
          "</td>" +
          '<td style="min-width:110px">' +
          bar(eventProgress(e)) +
          '<div class="tiny muted">' +
          eventProgress(e) +
          "%</div></td>" +
          '<td class="nowrap-cell">' +
          priBadge(p.label) +
          ' <button class="btn xs" data-act="event-edit" data-id="' +
          e.id +
          '">Open</button></td></tr>';
      });
      h += "</tbody></table></div>";
    });
  h += "</div>";
  return h;
}

function renderReadings(readings) {
  const rds = sortBy(readings, function (r) {
    return (r.week || 99) + "";
  });
  let h =
    '<div class="card"><div class="card-head"><h2>Required reading &amp; reference list</h2><span class="spacer"></span>' +
    '<button class="btn sm" data-act="reading-new">Add reading</button></div>';
  if (!rds.length) {
    h += empty(
      "",
      "No readings recorded",
      "Import a syllabus or add readings manually.",
    );
  } else {
    h +=
      '<div class="tbl-wrap"><table aria-label="Required readings"><thead><tr><th>Week</th><th>Title</th><th>Source</th><th>Pages</th><th>Course</th><th>Status</th><th></th></tr></thead><tbody>';
    rds.forEach(function (r) {
      h +=
        '<tr><td class="nowrap-cell">' +
        (r.week ? "W" + r.week : "\u2014") +
        "</td><td><strong" +
        (r.status === "done" ? ' class="done-text"' : "") +
        ">" +
        esc(r.title) +
        "</strong>" +
        (r.docId
          ? ' <span class="tag" title="Linked to an uploaded document">document</span>'
          : "") +
        "</td>" +
        '<td class="small">' +
        esc(r.source || "\u2014") +
        '</td><td class="small">' +
        esc(r.pages || "\u2014") +
        "</td>" +
        "<td>" +
        courseChip(r.courseId) +
        "</td>" +
        '<td><span class="badge ' +
        (r.status === "done"
          ? "ok"
          : r.status === "optional"
            ? "mute"
            : "med") +
        '">' +
        esc(r.status) +
        "</span></td>" +
        '<td class="nowrap-cell">' +
        (r.status !== "done"
          ? '<button class="btn xs ok" data-act="reading-toggle" data-id="' +
            r.id +
            '">Done</button> '
          : "") +
        '<button class="btn xs" data-act="reading-edit" data-id="' +
        r.id +
        '">Edit</button></td></tr>';
    });
    h += "</tbody></table></div>";
  }
  h += "</div>";
  return h;
}

function renderTables() {
  const docsWithTables = docs().filter(function (d) {
    return d.tables && d.tables.length;
  });
  let h =
    '<div class="card"><div class="card-head"><h2>Tables extracted from documents</h2><span class="spacer"></span>' +
    '<span class="tiny muted">' +
    docsWithTables.length +
    " document(s)</span></div>";
  if (!docsWithTables.length) {
    h += empty(
      "",
      "No tables found",
      "Tables are detected in PDFs and Word documents, including schedules and grading schemes.",
    );
  }
  docsWithTables.forEach(function (d) {
    const requirementPattern =
      /course requirements|formative assessment|summative assessment|accomplished worksheets|topic facilitation|discussion responses|final examinations?|presentation\s*\/\s*critique|learning environment management plan|e-?portfolio|total\s+100%/i;
    h += '<h3 class="mt">' + esc(d.name) + "</h3>";
    d.tables.forEach(function (t, i) {
      const rows = (t.rows || []).filter(function (row) {
        return requirementPattern.test(row.join(" "));
      });
      if (!rows.length) return;
      h +=
        '<div class="table-note">Table ' +
        (i + 1) +
        (t.page ? ' <i class="msep"></i> page ' + t.page : "") +
        ' <i class="msep"></i> ' +
        Math.round((t.confidence || 0.5) * 100) +
        "% confidence</div>";
      h +=
        '<div class="tbl-wrap mb scroll-md"><table aria-label="Extracted tables"><tbody>';
      if (t.header)
        h +=
          "<tr>" +
          t.header
            .map(function (c) {
              return "<th>" + esc(c) + "</th>";
            })
            .join("") +
          "</tr>";
      rows.forEach(function (row) {
        h +=
          "<tr>" +
          row
            .map(function (c) {
              return "<td>" + esc(c) + "</td>";
            })
            .join("") +
          "</tr>";
      });
      h += "</tbody></table></div>";
    });
  });
  h += "</div>";
  return h;
}

export function roadmap() {
  const lessons = UI.lessons();
  const events = UI.events();
  const readings = UI.readings();
  const currentWeek = Coach.currentWeek();
  const tab = UIState.tab.roadmap || "roadmap";

  let h = pageHead(
    "Lesson roadmap",
    "Chronological topic outline with the deadlines, assessments and readings attached to each week.",
    '<button class="btn sm" data-act="export-roadmap">Export outline</button>' +
      '<button class="btn sm" data-act="go-import">Import syllabus</button>',
  );

  h +=
    '<div class="tabs" role="tablist" aria-label="Roadmap views">' +
    tbtn("roadmap", "Weekly outline", tab) +
    tbtn("deadlines", "Assessment calendar", tab) +
    tbtn("readings", "Required readings", tab) +
    tbtn("tables", "Extracted tables", tab) +
    "</div>";

  if (tab === "roadmap")
    return h + renderWeeklyOutline(lessons, events, readings, currentWeek);
  if (tab === "deadlines") return h + renderDeadlines(events);
  if (tab === "readings") return h + renderReadings(readings);
  return h + renderTables();

  function tbtn(id, label, active) {
    return _tabBtn(id, label, active === id, "roadmap");
  }
}

export const roadmapView = {
  title: "Lesson roadmap",
  fn: roadmap,
};
