import { Store } from "../core/store.js";
import { Dashboard } from "../domain/dashboard.js";
import { Tasks } from "../domain/tasks.js";
import { esc, sortBy } from "../utils/helpers.js";
import { fmtDate } from "../utils/date.js";
import { empty, bar, pageHead } from "./shared.js";

export function courses() {
  const rows = Dashboard.completionByCourse();
  let h = pageHead(
    "Courses",
    "Every course, its imported structure and how much of it is done.",
    '<button class="btn primary" data-act="new-course">Add course</button>',
  );

  if (!Store.db.courses.length) {
    return (
      h +
      '<div class="card">' +
      empty(
        "",
        "No courses yet",
        "Add a course, then import its syllabus and Journey A.I will build the roadmap, deadlines and subtasks for you.",
        '<button class="btn primary mt" data-act="new-course">Add your first course</button><button class="btn mt" data-act="go-import">Import a syllabus</button>',
      ) +
      "</div>"
    );
  }

  h += '<div class="grid g3">';
  rows.forEach(function (r) {
    const c = r.course;
    const next = sortBy(
      Store.db.events.filter(function (e) {
        return e.courseId === c.id && Tasks.isOpen(e) && e.due;
      }),
      function (e) {
        return e.due;
      },
    )[0];
    const unread = Store.db.readings.filter(function (x) {
      return x.courseId === c.id && Tasks.isOpen(x);
    }).length;
    const docs = Store.db.documents.filter(function (d) {
      return d.courseId === c.id;
    }).length;
    h +=
      '<div class="card">' +
      '<div class="row" style="align-items:flex-start">' +
      '<div class="dot" style="background:' +
      c.color +
      ';width:11px;height:11px;margin-top:6px"></div>' +
      '<div style="min-width:0;flex:1 1 auto">' +
      '<h2 style="margin:0">' +
      esc(c.code || c.title) +
      "</h2>" +
      '<div class="small muted">' +
      esc(c.title || "") +
      "</div>" +
      "</div>" +
      '<button class="btn xs ghost" data-act="edit-course" data-id="' +
      c.id +
      '" title="Edit this course">Edit</button>' +
      "</div>" +
      '<div class="tiny muted mt-s">' +
      [c.instructor, c.days, c.room, c.term]
        .filter(Boolean)
        .map(esc)
        .join(' <i class="msep"></i> ') +
      "</div>" +
      '<div class="mt">' +
      bar(r.pct) +
      "</div>" +
      '<div class="row tiny muted mt-s"><span>' +
      r.done +
      "/" +
      r.tasks +
      ' tasks</span><i class="msep"></i>' +
      "<span>" +
      r.lessonsDone +
      "/" +
      r.lessons +
      ' topics</span><i class="msep"></i><span>' +
      unread +
      " readings open</span></div>" +
      '<div class="kv mt"><span class="k">Documents</span><span class="v">' +
      docs +
      "</span></div>" +
      '<div class="kv"><span class="k">Grade so far</span><span class="v">' +
      (r.grade.grade != null
        ? r.grade.grade.toFixed(1) +
          "% (" +
          Dashboard.letter(r.grade.grade) +
          ")"
        : '<span class="muted">no graded work</span>') +
      "</span></div>" +
      '<div class="kv"><span class="k">Next deadline</span><span class="v">' +
      (next
        ? esc(next.title) +
          ' <span class="tiny muted">' +
          fmtDate(next.due) +
          "</span>"
        : '<span class="muted">none</span>') +
      "</span></div>" +
      '<div class="row mt">' +
      '<button class="btn sm" data-act="course-view" data-view="roadmap" data-id="' +
      c.id +
      '">Roadmap</button>' +
      '<button class="btn sm" data-act="course-view" data-view="tasks" data-id="' +
      c.id +
      '">Tasks</button>' +
      '<button class="btn sm" data-act="course-view" data-view="library" data-id="' +
      c.id +
      '">Materials</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn sm ghost" data-act="del-course" data-id="' +
      c.id +
      '" title="Delete this course">Delete</button>' +
      "</div>" +
      "</div>";
  });
  h += "</div>";
  return h;
}

export const coursesView = {
  title: "Courses",
  fn: courses,
};
