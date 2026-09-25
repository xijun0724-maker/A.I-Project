/**
 * Default settings and schema for Journey A.I
 */

import { CFG } from "./constants.js";
import { dateOnly } from "../utils/date.js";

/**
 * Create a blank database schema
 */
export function createBlankDB() {
  const now = new Date();
  const termStart = new Date(now.getFullYear(), 0, 5);
  const termEnd = new Date(now.getFullYear(), 4, 20);

  return {
    version: CFG.schemaVersion,
    settings: {
      provider: "gemini",
      model: CFG.gemini.model,
      apiKey: "",
      aiEnabled: true,
      termStart: dateOnly(termStart),
      termEnd: dateOnly(termEnd),
      academicYear: "2026–2027",
      termName: "1st Term",
      studyWeekday: 2,
      studyWeekend: 4,
      plannerWeeks: 6,
      userName: "",
      hybridRAG: false,
      syllabusStandard: "pnu-cmi-teacher-education-2025",
      calendarStartOfWeek: 1,
      calendarMaxEvents: 4,
      calendarTimeFormat: "12h",
      calendarShowMilestones: true,
      calendarShowExams: true,
      calendarShowAssignments: true,
      calendarShowOther: true,
    },
    courses: [],
    academicCalendars: [],
    documents: [],
    events: [],
    lessons: [],
    readings: [],
    chunks: [],
    chat: [],
    activity: [],
    plan: [],
    planMeta: null,
  };
}

/**
 * Schema migrations, applied in order from the stored version up to
 * CFG.schemaVersion. Each step receives the parsed object and returns it.
 */
export const MIGRATIONS = {
  4: function (d) {
    (d.chunks || []).forEach(function (c) {
      if (typeof c.text !== "string" || c.len) return;
      const doc = (d.documents || []).find((x) => x.id === c.docId);
      const at =
        doc && typeof doc.text === "string" ? doc.text.indexOf(c.text) : -1;
      if (at === -1) return;
      c.start = at;
      c.len = c.text.length;
      delete c.text;
    });
    return d;
  },
};

/**
 * Apply schema migrations.
 * Returns null when the data must NOT be used: a newer-than-supported
 * schema, or a migration that threw (half-migrated data is not safe to
 * mark current). Callers must quarantine the stored bytes rather than
 * overwrite them.
 */
export function migrateSchema(d) {
  const from = parseInt(d.version, 10) || 1;
  if (from > CFG.schemaVersion) return null;

  for (let v = from + 1; v <= CFG.schemaVersion; v++) {
    if (typeof MIGRATIONS[v] === "function") {
      try {
        d = MIGRATIONS[v](d) || d;
      } catch (e) {
        if (typeof console !== "undefined" && console.warn)
          console.warn("Migration to v" + v + " failed - data quarantined", e);
        return null;
      }
    }
  }
  d.version = CFG.schemaVersion;
  return d;
}
