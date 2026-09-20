import { Store } from "../core/store.js";
import { Coach } from "../domain/coach.js";
import { esc, sum, minutesToHM, groupBy, pct } from "../utils/helpers.js";
import { fmtDate, fmtDay, fromIso, dateOnly } from "../utils/date.js";
import { empty, bar, statBox, pageHead } from "./shared.js";

function compactPlanItems(items, limit) {
  const seen = {};
  const unique = [];
  (items || []).forEach(function (item) {
    const label = String(item || "")
      .replace(/\s+/g, " ")
      .trim();
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!label || seen[key]) return;
    seen[key] = true;
    unique.push(label);
  });
  return {
    items: unique.slice(0, limit),
    hidden: Math.max(0, unique.length - limit),
  };
}

export function planner() {
  const plan = Store.db.plan || [];
  const meta = Store.db.planMeta;
  const byDay = groupBy(plan, function (p) {
    return p.date;
  });
  const dates = Object.keys(byDay).sort();
  const total = sum(plan, function (p) {
    return p.minutes;
  });
  const doneMin = sum(
    plan.filter(function (p) {
      return p.done;
    }),
    function (p) {
      return p.minutes;
    },
  );
  const reviewBlocks = plan.filter(function (p) {
    return /^Review:/i.test(String(p.label || ""));
  }).length;
  const atRiskCount = (meta && meta.atRisk && meta.atRisk.length) || 0;
  const unscheduledCount =
    (meta && meta.unscheduled && meta.unscheduled.length) || 0;
  const pendingMin = total - doneMin;

  let h = pageHead(
    "Study planner",
    "A weekly schedule built from your remaining work, its deadlines and the study hours you have available.",
    (plan.length
      ? '<button class="btn sm" data-act="export-csv">Export schedule</button><button class="btn sm danger" data-act="plan-clear">Clear</button>'
      : "") +
      '<button class="btn primary sm" data-act="plan-generate">' +
      (plan.length ? "Rebuild plan" : "Generate plan") +
      "</button>",
  );

  if (!plan.length) {
    return (
      h +
      '<div class="card">' +
      empty(
        "",
        "No study plan yet",
        "Journey A.I distributes your remaining subtasks across the next " +
          (Store.db.settings.plannerWeeks || 6) +
          " weeks, respecting each deadline and your available hours (" +
          Store.db.settings.studyWeekday +
          "h on weekdays, " +
          Store.db.settings.studyWeekend +
          "h on weekends).",
        '<button class="btn primary mt" data-act="plan-generate">Generate my study plan</button><button class="btn mt" data-act="nav" data-arg="settings">Adjust study hours</button>',
      ) +
      "</div>"
    );
  }

  h +=
    '<div class="grid g4 mb">' +
    statBox(minutesToHM(total), "Scheduled workload") +
    statBox(minutesToHM(doneMin), "Blocks completed") +
    statBox(reviewBlocks, "Review blocks") +
    statBox(minutesToHM(pendingMin), "Still to do") +
    "</div>";

  const strategyText =
    unscheduledCount > 0
      ? "This plan prioritizes near-term deadlines first and leaves room for the work that cannot fit in your current study capacity."
      : atRiskCount > 0
        ? "This plan protects the nearest deadlines while keeping a smaller buffer for difficult tasks before submission."
        : reviewBlocks > 0
          ? "This plan spreads your work across the horizon and keeps short review blocks in place before final deadlines."
          : "This plan keeps your workload steady and consistent so progress stays manageable over time.";
  h +=
    '<div class="notice info mb"><div><strong>Why this plan?</strong> ' +
    strategyText +
    "</div></div>";

  const summaryItems = [];
  if (reviewBlocks) {
    summaryItems.push(
      '<div class="plan-summary-item"><span class="eyebrow">Focus</span><strong>' +
        reviewBlocks +
        " review block" +
        (reviewBlocks === 1 ? "" : "s") +
        " scheduled</strong></div>",
    );
  }
  if (atRiskCount) {
    summaryItems.push(
      '<div class="plan-summary-item warn"><span class="eyebrow">Risk</span><strong>' +
        atRiskCount +
        " tight-fit item" +
        (atRiskCount === 1 ? "" : "s") +
        "</strong></div>",
    );
  }
  if (unscheduledCount) {
    summaryItems.push(
      '<div class="plan-summary-item bad"><span class="eyebrow">Capacity</span><strong>' +
        unscheduledCount +
        " item" +
        (unscheduledCount === 1 ? "" : "s") +
        " left unscheduled</strong></div>",
    );
  }
  if (!summaryItems.length) {
    summaryItems.push(
      '<div class="plan-summary-item ok"><span class="eyebrow">Status</span><strong>Plan is paced well</strong></div>',
    );
  }
  h += '<div class="plan-summary mb">' + summaryItems.join("") + "</div>";

  if (meta) {
    const planWeeks = meta.weeks || Store.db.settings.plannerWeeks || 1;
    const weeklyMinutes = Math.ceil(total / planWeeks);
    const dailyMinutes = Math.ceil(weeklyMinutes / 7);
    const nextFocus =
      atRiskCount > 0
        ? "Keep a buffer before the hardest deadlines."
        : reviewBlocks > 0
          ? "Keep the review blocks in place before final submission."
          : "Your plan is paced well across the horizon.";
    h +=
      '<div class="notice info mb"><div><strong>Suggested study pace:</strong> ' +
      minutesToHM(total) +
      " total, about " +
      minutesToHM(weeklyMinutes) +
      " per week (" +
      minutesToHM(dailyMinutes) +
      " per day). You have " +
      minutesToHM(meta.capacityMinutes || 0) +
      ' of configured study capacity in this plan horizon. <span class="muted">' +
      nextFocus +
      "</span></div></div>";
    if (meta.unscheduled && meta.unscheduled.length) {
      const unscheduled = compactPlanItems(meta.unscheduled, 8);
      h +=
        '<div class="notice bad mb"><div><strong>Not enough study time configured.</strong> These items could not be placed before their deadlines: ' +
        esc(
          unscheduled.items
            .map(function (t) {
              return t.replace(/ — .*$/, "");
            })
            .join(", "),
        ) +
        (unscheduled.hidden
          ? " and " + unscheduled.hidden + " more item(s)"
          : "") +
        ". Increase your available hours or reduce scope. </div></div>";
    }
    if (meta.atRisk && meta.atRisk.length) {
      h +=
        '<div class="notice warn mb"><div><strong>Tight fit:</strong> work for ' +
        meta.atRisk.length +
        " item(s) had to be scheduled close to or past their deadline. Consider starting earlier.</div></div>";
    }
  }

  h += '<div class="grid g2">';
  dates.forEach(function (date) {
    const items = byDay[date];
    const cap = Coach.dailyCapacity(fromIso(date + "T00:00"));
    const used = sum(items, function (p) {
      return p.minutes;
    });
    const isPast = date < dateOnly(new Date());
    const reviewCount = items.filter(function (p) {
      return /^Review:/i.test(String(p.label || ""));
    }).length;
    const urgentCount = items.filter(function (p) {
      return !!(
        p.due &&
        fromIso(p.due) &&
        (fromIso(p.due) - new Date()) / 86400000 <= 2
      );
    }).length;
    const rationale =
      urgentCount > 0
        ? "Prioritizes a deadline-heavy task block."
        : reviewCount > 0
          ? "Includes a review block to protect final quality."
          : "Balanced study load for steady progress.";
    h +=
      '<div class="card"><div class="card-head day-head">' +
      '<span class="day-num">' +
      fmtDay(date + "T00:00") +
      "</span>" +
      (isPast ? '<span class="badge mute">past</span>' : "") +
      '<span class="spacer"></span><span class="tiny muted">' +
      minutesToHM(used) +
      " of " +
      minutesToHM(cap) +
      "</span></div>" +
      '<div class="day-rationale tiny muted">' +
      rationale +
      "</div>";
    h +=
      bar(pct(used, cap), used > cap ? "bad" : "ok") +
      '<div class="grid mt gap-xs">';
    items.forEach(function (p) {
      const kindMatch = /^Review:/i.test(String(p.label || ""));
      const dueSoon = !!(
        p.due &&
        fromIso(p.due) &&
        (fromIso(p.due) - new Date()) / 86400000 <= 2
      );
      const kind = kindMatch ? "review" : dueSoon ? "urgent" : "default";
      const kindLabel = kindMatch ? "Review" : dueSoon ? "Urgent" : "Planned";
      h +=
        '<div class="sched-block' +
        (p.done ? " done" : "") +
        '" data-plan-kind="' +
        kind +
        '">' +
        '<div class="chk' +
        (p.done ? " on" : "") +
        '" data-act="plan-toggle" data-id="' +
        p.id +
        '"' +
        ' role="checkbox" tabindex="0" aria-checked="' +
        (p.done ? "true" : "false") +
        '" aria-label="Mark this study block done">✓</div>' +
        '<div class="flex-fill">' +
        '<div class="sched-label-row">' +
        '<span class="sched-badge ' +
        kind +
        '">' +
        kindLabel +
        "</span>" +
        '<div class="small strong' +
        (p.done ? " done-text" : "") +
        '">' +
        esc(p.label) +
        "</div></div>" +
        '<div class="tiny muted">' +
        esc(p.start || "") +
        ' <i class="msep"></i> ' +
        minutesToHM(p.minutes) +
        ' <i class="msep"></i> ' +
        esc(Store.courseName(p.courseId)) +
        (p.due ? ' <i class="msep"></i> due ' + fmtDate(p.due) : "") +
        "</div>" +
        "</div>" +
        '<button class="btn xs ghost" data-act="event-edit" data-id="' +
        p.eventId +
        '" title="Open task">Edit</button></div>';
    });
    h += "</div></div>";
  });
  h += "</div>";
  return h;
}

export const plannerView = {
  title: "Study planner",
  fn: planner,
};
