/**
 * Export action handlers (ICS, progress, roadmap, CSV)
 */

import { Store } from "../store.js";
import { UI } from "../state.js";
import { Dashboard } from "../../domain/dashboard.js";
import { Tasks } from "../../domain/tasks.js";
import { toast } from "../../utils/dom.js";
import { stripKey } from "../../utils/secure.js";

export function exportData() {
  const snapshot = stripKey(Store.db);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download =
    "journeyai-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); // matches CFG.timeouts
  toast("Data exported.", "ok");
}

export function exportICS() {
  try {
    const events = Store.db.events.filter((e) => e.due && Tasks.isOpen(e));
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Journey A.I//EN\n";
    events.forEach((e) => {
      const dt = e.due.replace(/[-:]/g, "").slice(0, 15) + "00";
      ics +=
        "BEGIN:VEVENT\nDTSTART:" +
        dt +
        "\nSUMMARY:" +
        (e.title || "").replace(/,/g, "\\,") +
        "\nEND:VEVENT\n";
    });
    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "journeyai-deadlines.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Calendar exported.", "ok");
  } catch (e) {
    toast("Failed to export calendar: " + e.message, "bad");
  }
}

export function exportProgress() {
  try {
    const k = Dashboard.kpis();
    let text = "Journey A.I - Progress Report\n";
    text += "Generated: " + new Date().toLocaleDateString() + "\n\n";
    text += "Open tasks: " + k.open + "\n";
    text += "Overdue: " + k.overdue + "\n";
    text += "Completion: " + k.completion + "%\n";
    text += "Work remaining: " + k.remainingMinutes + " minutes\n\n";
    text += "Courses:\n";
    Dashboard.completionByCourse().forEach((r) => {
      text +=
        "  " +
        (r.course.code || r.course.title) +
        ": " +
        r.pct +
        "% (" +
        r.done +
        "/" +
        r.tasks +
        " tasks)\n";
    });
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "journeyai-progress.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Progress report exported.", "ok");
  } catch (e) {
    toast("Failed to export progress: " + e.message, "bad");
  }
}

export function exportRoadmap() {
  try {
    const lessons = UI.lessons();
    let text = "Journey A.I - Lesson Roadmap\n\n";
    let currentWeek = 0;
    lessons.forEach((l) => {
      if (l.week !== currentWeek) {
        currentWeek = l.week;
        text += "\nWeek " + currentWeek + ":\n";
      }
      text += "  " + (l.done ? "[x]" : "[ ]") + " " + l.topic + "\n";
    });
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "journeyai-roadmap.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Roadmap exported.", "ok");
  } catch (e) {
    toast("Failed to export roadmap: " + e.message, "bad");
  }
}

export function exportCSV() {
  try {
    const plan = Store.db.plan || [];
    let csv = "Date,Task,Course,Minutes,Done\n";
    plan.forEach((p) => {
      csv +=
        [
          p.date,
          '"' + (p.label || "").replace(/"/g, '""') + '"',
          Store.courseName(p.courseId),
          p.minutes,
          p.done,
        ].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "journeyai-schedule.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Schedule exported.", "ok");
  } catch (e) {
    toast("Failed to export schedule: " + e.message, "bad");
  }
}
