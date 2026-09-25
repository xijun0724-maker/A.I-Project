/**
 * Dashboard — KPIs and analytics for the main dashboard screen
 */

import { Store } from "../core/store.js";
import { CFG } from "../config/constants.js";
import { UI } from "../core/state.js";
import { Tasks } from "./tasks.js";
import { Coach } from "./coach.js";
import { Standards } from "../config/standards/index.js";
import { sum, pct, sortBy } from "../utils/helpers.js";
import { DAY, fromIso, daysUntil } from "../utils/date.js";
import { clamp } from "../utils/helpers.js";

export const Dashboard = {};

/** Active standard's competency map (PNU CMI, generic HE, or custom). */
function activeCompetencies() {
  const settings = Store.db && Store.db.settings ? Store.db.settings : null;
  const list = Standards.competencies(settings);
  if (list.length) return list;
  return Standards.competencies(Standards.DEFAULT_ID);
}

Dashboard.kpis = function () {
  const evs = Store.db.events.filter(UI.inScope);
  const open = evs.filter(Tasks.isOpen);
  const overdue = open.filter(Tasks.isOverdue);
  const due7 = open.filter(function (e) {
    const n = daysUntil(e.due);
    return n !== null && n >= 0 && n <= 7;
  });
  const done = evs.filter(function (e) {
    return e.status === "done";
  });
  const graded = evs.filter(function (e) {
    return e.grade != null;
  });
  const avg = graded.length
    ? Math.round(
        sum(graded, function (e) {
          return e.grade;
        }) / graded.length,
      )
    : null;
  const remMin = sum(open, Tasks.remainingMinutes);
  return {
    courses: Store.db.courses.length,
    open: open.length,
    done: done.length,
    overdue: overdue.length,
    due7: due7.length,
    completion: pct(done.length, evs.length),
    avgGrade: avg,
    remainingMinutes: remMin,
  };
};

Dashboard.completionByCourse = function (opts) {
  /* opts.all — ignore the focused-course scope. The Courses index must list
     every course; otherwise a previously opened course locks the page to a
     single card and newly imported syllabuses never appear. */
  const list = opts && opts.all ? Store.db.courses.slice() : UI.courses();
  return list.map(function (c) {
    const evs = Store.db.events.filter(function (e) {
      return e.courseId === c.id;
    });
    const done = evs.filter(function (e) {
      return e.status === "done";
    }).length;
    const lessons = Store.db.lessons.filter(function (l) {
      return l.courseId === c.id;
    });
    const covered = lessons.filter(function (l) {
      return l.done;
    }).length;
    return {
      course: c,
      tasks: evs.length,
      done: done,
      pct: pct(done, evs.length),
      lessons: lessons.length,
      lessonsDone: covered,
      readings: Store.db.readings.filter(function (r) {
        return r.courseId === c.id;
      }).length,
      grade: Dashboard.courseGrade(c.id),
    };
  });
};

Dashboard.courseGrade = function (courseId) {
  const graded = Store.db.events.filter(function (e) {
    return e.courseId === courseId && e.grade != null;
  });
  if (!graded.length) return { grade: null, source: null, count: 0 };
  const withW = graded.filter(function (e) {
    return e.weight != null;
  });
  let grade;
  if (withW.length) {
    const tw = sum(withW, function (e) {
      return e.weight;
    });
    grade = tw
      ? sum(withW, function (e) {
          return e.grade * e.weight;
        }) / tw
      : null;
  }
  if (grade == null)
    grade =
      sum(graded, function (e) {
        return e.grade;
      }) / graded.length;
  return {
    grade: Math.round(grade * 10) / 10,
    count: graded.length,
    weighted: withW.length > 0,
  };
};

Dashboard.letter = function (p) {
  if (p == null) return null;
  for (const g of CFG.grades) {
    if (p >= g.min) return g.letter;
  }
  return "F";
};

/**
 * Map an event/task to the active standard's competencies based on type
 * and title keywords. Matching rules live on each standard definition.
 */
function mapEventToCompetencies(event, competencies) {
  const title = (event.title || "").toLowerCase();
  const type = event.type || "other";
  const matched = new Set();

  (competencies || []).forEach(function (comp) {
    const types = comp.types || [];
    const keywords = comp.keywords || [];
    if (types.indexOf(type) >= 0) matched.add(comp.id);
    for (let i = 0; i < keywords.length; i++) {
      if (title.includes(keywords[i])) {
        matched.add(comp.id);
        break;
      }
    }
  });

  if (!matched.size) {
    const fallback = (competencies || [])[0];
    if (fallback) matched.add(fallback.id);
  }

  return Array.from(matched);
}

/**
 * Compute competency mastery for a course based on completed tasks
 */
Dashboard.competencyMastery = function (courseId) {
  const events = Store.db.events.filter((e) => e.courseId === courseId);
  if (!events.length) return [];

  const competencies = activeCompetencies();
  if (!competencies.length) return [];

  const competencyMap = {};
  competencies.forEach((c) => {
    competencyMap[c.id] = { label: c.label, total: 0, completed: 0, tasks: [] };
  });

  events.forEach((event) => {
    const compIds = mapEventToCompetencies(event, competencies);
    compIds.forEach((compId) => {
      if (competencyMap[compId]) {
        competencyMap[compId].total++;
        competencyMap[compId].tasks.push(event.id);
        if (event.status === "done") {
          competencyMap[compId].completed++;
        }
      }
    });
  });

  return Object.values(competencyMap)
    .filter((c) => c.total > 0)
    .map((c) => ({
      label: c.label,
      mastery: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
      completed: c.completed,
      total: c.total,
    }))
    .sort((a, b) => b.mastery - a.mastery);
};

Dashboard.upcoming = function (limit) {
  return sortBy(
    Store.db.events.filter(function (e) {
      return UI.inScope(e) && Tasks.isOpen(e) && e.due;
    }),
    function (e) {
      return e.due;
    },
  ).slice(0, limit || 8);
};

Dashboard.readiness = function () {
  const term = fromIso(Store.db.settings.termStart),
    end = fromIso(Store.db.settings.termEnd);
  if (!term || !end) return null;
  const total = Math.max(1, (end - term) / DAY);
  const elapsed = clamp((new Date() - term) / DAY, 0, total);
  const timePct = Math.round((elapsed / total) * 100);
  const workPct = pct(
    Store.db.events.filter(function (e) {
      return UI.inScope(e) && !Tasks.isOpen(e);
    }).length,
    Store.db.events.filter(UI.inScope).length,
  );
  return { timePct: timePct, workPct: workPct, week: Coach.currentWeek() };
};

export default Dashboard;
