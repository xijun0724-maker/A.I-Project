import { UIState } from "../core/state.js";
import { Coach } from "../domain/coach.js";
import { Tasks } from "../domain/tasks.js";
import {
  esc,
  sortBy,
  groupBy,
  pct,
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
} from "./shared.js";
import { courses, bindCoursesView } from "./courses.js";



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
  let h = '<div class="dash-content-grid"><div class="dash-col-left"><div class="card">';

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
      '" id="week-rail-' +
      w +
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
        esc(l.id) +
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
        esc(l.id) +
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
        esc(e.id) +
        '">Open</button></div>';
    });

    if (!group.length && !wkEvents.length)
      h += '<p class="small muted">No content captured for this week.</p>';
    h += "</div></div>";
  });

  h += "</div></div>";
  h += '<div class="dash-col-right roadmap-sidebar">';
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
    (currentWeek
      ? '<a href="#week-rail-' +
        currentWeek +
        '" class="btn sm block mt-s">Jump to Week ' +
        currentWeek +
        " (Now)</a>"
      : "") +
    "</div>";

  h +=
    '<div class="card"><div class="card-head"><h3>Week Navigator</h3><span class="tiny muted">' +
    weeks.length +
    ' wks</span></div><div class="week-nav-grid">' +
    weeks
      .map(function (w) {
        const isDone =
          byWeek[w] &&
          byWeek[w].length > 0 &&
          byWeek[w].every(function (l) {
            return l.done;
          });
        return (
          '<a href="#week-rail-' +
          w +
          '" class="week-nav-pill' +
          (w === currentWeek ? " now" : "") +
          (isDone ? " done" : "") +
          '" title="Jump to Week ' +
          w +
          '">W' +
          w +
          "</a>"
        );
      })
      .join("") +
    "</div></div>";

  h +=
    '<div class="card"><div class="card-head"><h3>Add topic</h3></div>' +
    '<p class="small muted">Manually add a lesson if the syllabus missed it.</p>' +
    '<button class="btn block sm primary" data-act="lesson-new">New topic</button></div>';
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
        grouped[month].length +
        " assessment" +
        (grouped[month].length === 1 ? "" : "s") +
        "</span></div>";
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
          esc(e.id) +
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
            esc(r.id) +
            '">Done</button> '
          : "") +
        '<button class="btn xs" data-act="reading-edit" data-id="' +
        esc(r.id) +
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

/**
 * Render visual roadmap.sh-style curriculum tree (matching Image 3)
 * @param {Object} course - Active course
 * @param {Array} allLessons - Lessons/topics from syllabus
 * @param {Array} allEvents - Course events/assessments
 * @param {Array} allReadings - Course readings
 * @returns {string} HTML markup
 */
function renderVisualRoadmapTree(
  course,
  allLessons,
  allEvents,
  allReadings,
) {
  if (!course) {
    return (
      '<div class="card">' +
      empty(
        "",
        "No course selected",
        "Select a course to view its curriculum roadmap.",
        '<button type="button" class="btn primary mt" data-act="scope-clear-to-courses">View all courses</button>',
      ) +
      "</div>"
    );
  }

  const courseLessons = (allLessons || []).filter(
    (l) => l.courseId === course.id,
  );
  const courseEvents = (allEvents || []).filter(
    (e) => e.courseId === course.id,
  );
  const courseReadings = (allReadings || []).filter(
    (r) => r.courseId === course.id,
  );

  // Group lessons by week
  const byWeek = groupBy(courseLessons, (l) => {
    const w = Number(l.week);
    return Number.isFinite(w) && w > 0 ? w : 1;
  });
  const weeks = Object.keys(byWeek)
    .map(Number)
    .filter((w) => Number.isFinite(w) && byWeek[w] && byWeek[w].length)
    .sort((a, b) => a - b);

  if (!courseLessons.length) {
    return (
      '<div class="roadmap-visual-wrapper">' +
      '<div class="roadmap-tree-empty-box">' +
      '<div class="empty-tree-icon">🗺️</div>' +
      "<h3>No topics extracted yet for " +
      esc(course.title || course.code || "this course") +
      "</h3>" +
      '<p class="small muted">Import a course syllabus (PDF, DOCX, or text) to automatically map weekly modules, extracted topics, and assessment milestones into this roadmap.</p>' +
      '<div class="row gap mt">' +
      '<button type="button" class="btn primary" data-act="go-import">Import syllabus</button>' +
      '<button type="button" class="btn" data-act="lesson-new">+ Add topic manually</button>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderTopicPill(l) {
    return (
      '<div class="roadmap-topic-pill' +
      (l.done ? " is-done" : "") +
      '">' +
      '<span class="topic-pill-title">' +
      esc(l.topic) +
      "</span>" +
      '<button type="button" class="roadmap-pill-chk' +
      (l.done ? " done" : "") +
      '" data-act="lesson-toggle" data-id="' +
      esc(l.id) +
      '" title="' +
      (l.done ? "Mark topic as pending" : "Mark topic as covered") +
      '" aria-label="Toggle topic coverage">' +
      (l.done ? "✓" : "") +
      "</button>" +
      "</div>"
    );
  }

  function renderEventPill(e) {
    const dueTxt = e.due ? fmtDate(e.due, true) : "No deadline";
    const weightTxt = e.weight != null ? " · " + e.weight + "%" : "";
    return (
      '<div class="roadmap-event-pill" data-act="event-edit" data-id="' +
      esc(e.id) +
      '" title="Open assessment details">' +
      '<span class="event-pill-tag">Assessment</span>' +
      '<div class="event-pill-title">' +
      esc(e.title) +
      "</div>" +
      '<div class="event-pill-meta">' +
      dueTxt +
      weightTxt +
      "</div>" +
      "</div>"
    );
  }

  function renderReadingPill(r) {
    const pagesTxt = r.pages ? " (" + esc(r.pages) + ")" : "";
    return (
      '<div class="roadmap-reading-tag" title="' +
      esc(r.title) +
      '">' +
      '<span class="reading-tag-icon" aria-hidden="true">📖</span>' +
      '<span class="reading-tag-text">' +
      esc(r.title) +
      "</span>" +
      (pagesTxt ? '<span class="reading-tag-pages">' + pagesTxt + "</span>" : "") +
      "</div>"
    );
  }

  let treeStepsHtml = "";
  const midpoint = Math.floor(weeks.length / 2);

  weeks.forEach((w, idx) => {
    const group = byWeek[w] || [];
    const isWeekDone = group.length > 0 && group.every((l) => l.done);
    const weekEvents = courseEvents.filter((e) => e.week === w);
    const weekReadings = courseReadings.filter((r) => r.week === w);

    let leftPills = "";
    let rightPills = "";
    let leftLineStyle = "";
    let rightLineStyle = "";

    const hasEventsOrReadings = weekEvents.length > 0 || weekReadings.length > 0;

    if (hasEventsOrReadings) {
      // Balanced: Topics on one side, Assessments/Readings on the other
      const isTopicsLeft = idx % 2 === 0;
      const topicsHtml = group.map(renderTopicPill).join("");
      const eventsHtml =
        weekEvents.map(renderEventPill).join("") +
        weekReadings.map(renderReadingPill).join("");

      if (isTopicsLeft) {
        leftPills = topicsHtml;
        rightPills = eventsHtml;
        leftLineStyle = " dotted";
        rightLineStyle = " solid";
      } else {
        leftPills = eventsHtml;
        rightPills = topicsHtml;
        leftLineStyle = " solid";
        rightLineStyle = " dotted";
      }
    } else if (group.length >= 2) {
      // Multiple topics: split evenly across left and right
      const mid = Math.ceil(group.length / 2);
      leftPills = group.slice(0, mid).map(renderTopicPill).join("");
      rightPills = group.slice(mid).map(renderTopicPill).join("");
      leftLineStyle = " dotted";
      rightLineStyle = " dotted";
    } else {
      // Exactly 1 topic: contextual schedule badge on the opposite side
      const topicsHtml = group.map(renderTopicPill).join("");
      const first = group[0];
      const dateText =
        first && first.start ? fmtDate(first.start, false) : "Syllabus Unit " + w;
      const badgeHtml =
        '<div class="roadmap-schedule-badge">' +
        '<span class="schedule-badge-icon" aria-hidden="true">🎯</span>' +
        '<div class="schedule-badge-content">' +
        '<span class="schedule-badge-text">' +
        esc(dateText) +
        "</span>" +
        '<span class="schedule-badge-sub">Core Objective · 1 Topic</span>' +
        "</div>" +
        "</div>";

      if (idx % 2 === 0) {
        leftPills = badgeHtml;
        rightPills = topicsHtml;
        leftLineStyle = " dotted";
        rightLineStyle = " dotted";
      } else {
        leftPills = topicsHtml;
        rightPills = badgeHtml;
        leftLineStyle = " dotted";
        rightLineStyle = " dotted";
      }
    }

    // Midterm Divider (Image 3 style)
    if (weeks.length >= 4 && idx === midpoint) {
      treeStepsHtml +=
        '<div class="roadmap-tree-divider">' +
        '<div class="roadmap-divider-box">' +
        '<span class="roadmap-divider-pill">Midterm Checkpoint</span>' +
        '<p class="roadmap-divider-text">Verify that introductory topics are covered and preliminary coursework is submitted.</p>' +
        '<button type="button" class="btn xs ghost" data-act="tab" data-view="courses" data-arg="deadlines">View assessment calendar →</button>' +
        "</div>" +
        "</div>";
    }

    // Module Row (The rail class ensures test compatibility)
    treeStepsHtml +=
      '<div class="roadmap-tree-step rail' +
      (isWeekDone ? " week-completed" : "") +
      '" id="roadmap-week-' +
      w +
      '">' +
      // Left Column
      '<div class="roadmap-step-col left">' +
      '<div class="roadmap-branch-pills">' +
      leftPills +
      "</div>" +
      (leftPills
        ? '<div class="roadmap-branch-line' +
          leftLineStyle +
          '" aria-hidden="true"></div>'
        : "") +
      "</div>" +
      // Center Spine Yellow Box Node (Image 3)
      '<div class="roadmap-spine-node" id="roadmap-node-' +
      w +
      '">' +
      '<span class="spine-node-title">Week ' +
      w +
      "</span>" +
      (isWeekDone
        ? '<span class="spine-done-pill" title="All topics covered">✓</span>'
        : "") +
      "</div>" +
      // Right Column
      '<div class="roadmap-step-col right">' +
      (rightPills
        ? '<div class="roadmap-branch-line' +
          rightLineStyle +
          '" aria-hidden="true"></div>'
        : "") +
      '<div class="roadmap-branch-pills">' +
      rightPills +
      "</div>" +
      "</div>" +
      "</div>";
  });

  // End of course endpoint
  treeStepsHtml +=
    '<div class="roadmap-tree-endpoint">' +
    '<div class="roadmap-endpoint-badge">🏁 Final Evaluation &amp; Term Mastery</div>' +
    "</div>";

  let h = '<div class="roadmap-visual-wrapper">';

  // Diagram Top Header: Legend on Left, Interactive Tip on Right (Image 3)
  h += '<div class="roadmap-canvas-header">';
  h += '<div class="roadmap-legend-card" role="region" aria-label="Roadmap legend">';
  h += '<div class="roadmap-legend-row"><span class="legend-chk-dot">✓</span><span>Covered Topic</span></div>';
  h += '<div class="roadmap-legend-row"><span class="legend-color-box yellow"></span><span>Core Module</span></div>';
  h += '<div class="roadmap-legend-row"><span class="legend-color-box amber"></span><span>Extracted Topic</span></div>';
  h += '<div class="roadmap-legend-row"><span class="legend-color-box blue"></span><span>Assessment / Milestone</span></div>';
  h += '<div class="roadmap-legend-row"><span class="legend-reading-dot">📖</span><span>Required Reading</span></div>';
  h += "</div>";

  h += '<div class="roadmap-canvas-tip">';
  h += '<span class="small muted">Click <strong class="purple-text">✓</strong> on any topic to track syllabus mastery. Click assessments for deadlines.</span>';
  h += "</div>";
  h += "</div>"; // closes .roadmap-canvas-header

  // Visual Roadmap Tree Canvas
  h += '<div class="roadmap-tree-canvas">';
  h += '<div class="roadmap-canvas-spine-line" aria-hidden="true"></div>';
  h += treeStepsHtml;
  h += "</div>"; // closes .roadmap-tree-canvas

  h += "</div>"; // closes .roadmap-visual-wrapper
  return h;
}

export {
  renderVisualRoadmapTree,
  renderWeeklyOutline,
  renderDeadlines,
  renderReadings,
  renderTables,
};

export function roadmap() {
  if (!UIState.tab.courses) {
    UIState.tab.courses =
      UIState.courseId && UIState.courseId !== "all" ? "roadmap" : "courses";
  }
  return courses();
}

export const roadmapView = {
  title: "Courses & Roadmap",
  fn: roadmap,
  after: bindCoursesView,
};

