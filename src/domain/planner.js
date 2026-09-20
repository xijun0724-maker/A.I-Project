/**
 * Planner — greedy day-by-day study scheduler
 * Allocates work units to available study time, respecting priorities and deadlines.
 */

import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import { Tasks } from "./tasks.js";
import { Coach } from "./coach.js";
import { uid, sum, sortBy, clamp, slug } from "../utils/helpers.js";
import {
  addDays,
  dateOnly,
  fromIso,
  startOfDay,
  daysUntil,
} from "../utils/date.js";

export const Planner = {};

Planner.units = function (courseId) {
  const out = [];
  const seenEvents = {};
  const seenUnits = {};
  const pushUnit = function (unit) {
    const key = [
      unit.courseId || "",
      slug(unit.title),
      unit.due ? unit.due.slice(0, 10) : "none",
    ].join("|");
    if (seenUnits[key]) return;
    seenUnits[key] = true;
    out.push(unit);
  };
  const events = Store.db.events.filter(Tasks.isOpen).filter(function (event) {
    if (courseId && courseId !== "all" && event.courseId !== courseId)
      return false;
    const key = [
      event.courseId || "",
      slug(event.title),
      event.due ? event.due.slice(0, 10) : "none",
    ].join("|");
    if (seenEvents[key]) return false;
    seenEvents[key] = true;
    return true;
  });
  Tasks.ranked(events).forEach(function (e) {
    if (courseId && courseId !== "all" && e.courseId !== courseId) return;
    const p = Tasks.priority(e);
    const dueSoon = e.due && daysUntil(e.due) <= 2;
    if (dueSoon) {
      const reviewMinutes = Math.min(
        30,
        Math.max(15, Math.round(Tasks.remainingMinutes(e) / 4 / 5) * 5),
      );
      pushUnit({
        eventId: e.id,
        subtaskId: null,
        title: "Review: " + e.title,
        minutes: reviewMinutes,
        courseId: e.courseId,
        due: e.due,
        score: p.score + 20,
      });
    }
    const subs = (e.subtasks || []).filter(function (s) {
      return !s.done;
    });
    if (!subs.length) {
      pushUnit({
        eventId: e.id,
        subtaskId: null,
        title: e.title,
        minutes: Tasks.remainingMinutes(e) || 60,
        courseId: e.courseId,
        due: e.due,
        score: p.score,
      });
      return;
    }
    subs.forEach(function (s) {
      const sd = s.due && daysUntil(s.due) >= 0 ? s.due : e.due;
      pushUnit({
        eventId: e.id,
        subtaskId: s.id,
        title: e.title + " — " + s.title,
        minutes: s.minutes || 30,
        courseId: e.courseId,
        due: sd || null,
        score: p.score + (sd ? clamp(6 - (daysUntil(sd) || 0) / 3, -4, 6) : 0),
      });
    });
  });
  return sortBy(out, function (u) {
    return -u.score;
  });
};

Planner.generate = function (opts) {
  opts = opts || {};
  const weeks = opts.weeks || Store.db.settings.plannerWeeks || 6;
  const courseId = opts.courseId || Store.db.settings.courseId || "all";
  const { minBlock, maxBlock, blockGap, weekendStart, weekdayStart } =
    CFG.planner;
  const start = startOfDay(new Date());
  const days = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    days.push({
      date: dateOnly(d),
      capacity: Coach.dailyCapacity(d),
      used: 0,
      items: [],
    });
  }
  const queue = Planner.units(courseId);
  const unscheduled = [],
    overflow = [];

  queue.forEach(function (u) {
    let remaining = u.minutes,
      guard = 0;
    while (remaining > 0 && guard++ < 40) {
      let target = null;
      for (let i = 0; i < days.length; i++) {
        if (days[i].capacity - days[i].used < minBlock) continue;
        if (u.due && days[i].date > u.due.slice(0, 10)) continue;
        target = days[i];
        break;
      }
      if (!target) {
        for (let j = 0; j < days.length; j++) {
          if (days[j].capacity - days[j].used >= minBlock) {
            target = days[j];
            break;
          }
        }
        if (!target) {
          unscheduled.push(u);
          remaining = 0;
          break;
        }
        if (u.due && target.date > u.due.slice(0, 10)) overflow.push(u);
      }
      const take = Math.min(remaining, target.capacity - target.used, maxBlock);
      if (take < minBlock) {
        unscheduled.push(u);
        remaining = 0;
        break;
      }
      target.items.push({
        id: uid("pl"),
        date: target.date,
        minutes: take,
        label: u.title,
        eventId: u.eventId,
        subtaskId: u.subtaskId,
        courseId: u.courseId,
        due: u.due,
        score: Math.round(u.score),
        done: false,
      });
      target.used += take;
      remaining -= take;
      if (remaining > 0 && target.items.length > 6) break;
    }
    if (remaining > 0) unscheduled.push(u);
  });

  days.forEach(function (day) {
    const d = fromIso(day.date + "T00:00");
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    let cursor = (weekend ? weekendStart : weekdayStart) * 60;
    day.items.forEach(function (it) {
      it.startMinutes = cursor;
      it.start = pad(Math.floor(cursor / 60)) + ":" + pad(cursor % 60);
      it.end =
        pad(Math.floor((cursor + it.minutes) / 60)) +
        ":" +
        pad((cursor + it.minutes) % 60);
      cursor += it.minutes + blockGap;
    });
  });
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  Store.db.plan = [];
  days.forEach(function (day) {
    day.items.forEach(function (it) {
      Store.db.plan.push(it);
    });
  });
  const uniqueTitles = function (items) {
    const seen = {};
    return sortBy(items, function (item) {
      return item.title;
    })
      .map(function (item) {
        return item.title;
      })
      .filter(function (title) {
        const key = slug(title);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
  };
  Store.db.planMeta = {
    generatedAt: new Date().toISOString(),
    weeks: weeks,
    capacityMinutes: sum(days, function (day) {
      return day.capacity;
    }),
    unscheduled: uniqueTitles(unscheduled),
    atRisk: uniqueTitles(overflow),
    totalMinutes: sum(Store.db.plan, function (p) {
      return p.minutes;
    }),
  };
  Store.saveNow();
  return Store.db.planMeta;
};

Planner.clear = function () {
  Store.db.plan = [];
  Store.db.planMeta = null;
  Store.saveNow();
};

Planner.toggle = function (planId) {
  const it = (Store.db.plan || []).filter(function (p) {
    return p.id === planId;
  })[0];
  if (!it) return null;
  it.done = !it.done;
  if (it.done) Coach.logActivity(it.minutes, 0);
  if (it.subtaskId) {
    const ev = Store.event(it.eventId);
    const st =
      ev &&
      (ev.subtasks || []).find(function (s) {
        return s.id === it.subtaskId;
      });
    const blocks = (Store.db.plan || []).filter(function (block) {
      return block.eventId === it.eventId && block.subtaskId === it.subtaskId;
    });
    if (st) {
      const complete =
        blocks.length > 0 &&
        blocks.every(function (block) {
          return block.done;
        });
      const started =
        blocks.length > 0 &&
        blocks.some(function (block) {
          return block.done;
        });
      st.done = complete;
      if (complete) {
        st.completedAt = st.completedAt || new Date().toISOString();
      } else {
        st.completedAt = undefined;
      }
      Tasks.recompute(ev);
      if (complete) {
        ev.status = "done";
      } else if (started) {
        ev.status = "doing";
      } else {
        ev.status = "todo";
      }
    }
  }
  Store.saveNow();
  return it;
};

export default Planner;
