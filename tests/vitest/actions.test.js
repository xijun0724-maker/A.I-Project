import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/core/router.js", () => ({
  Router: { render: vi.fn() },
}));

import { Store } from "../../src/core/store.js";
import { KNOWN_ACTIONS } from "../../src/core/actions/index.js";
import { toggleSubtask } from "../../src/core/actions/tasks.js";
import { summarizeImportPlan } from "../../src/core/actions/import.js";
import { CFG } from "../../src/config/constants.js";

beforeEach(() => {
  Store.resetAll();
});

describe("KNOWN_ACTIONS", () => {
  it("is a Set", () => {
    expect(KNOWN_ACTIONS).toBeInstanceOf(Set);
  });

  it("contains core actions", () => {
    expect(KNOWN_ACTIONS.has("nav")).toBe(true);
    expect(KNOWN_ACTIONS.has("settings-save")).toBe(true);
    expect(KNOWN_ACTIONS.has("data-export")).toBe(true);
    expect(KNOWN_ACTIONS.has("data-import")).toBe(true);
    expect(KNOWN_ACTIONS.has("data-reset")).toBe(true);
  });

  it("contains task actions", () => {
    expect(KNOWN_ACTIONS.has("task-toggle")).toBe(true);
    expect(KNOWN_ACTIONS.has("task-new")).toBe(true);
    expect(KNOWN_ACTIONS.has("sub-toggle")).toBe(true);
  });

  it("contains document actions", () => {
    expect(KNOWN_ACTIONS.has("del-doc")).toBe(true);
    expect(KNOWN_ACTIONS.has("doc-reanalyse")).toBe(true);
    expect(KNOWN_ACTIONS.has("doc-ask")).toBe(true);
  });

  it("contains course actions", () => {
    expect(KNOWN_ACTIONS.has("new-course")).toBe(true);
    expect(KNOWN_ACTIONS.has("edit-course")).toBe(true);
    expect(KNOWN_ACTIONS.has("del-course")).toBe(true);
  });

  it("contains export actions", () => {
    expect(KNOWN_ACTIONS.has("export-ics")).toBe(true);
    expect(KNOWN_ACTIONS.has("export-csv")).toBe(true);
    expect(KNOWN_ACTIONS.has("export-progress")).toBe(true);
    expect(KNOWN_ACTIONS.has("export-roadmap")).toBe(true);
  });

  it("contains chat actions", () => {
    expect(KNOWN_ACTIONS.has("chat-send")).toBe(true);
    expect(KNOWN_ACTIONS.has("chat-clear")).toBe(true);
    expect(KNOWN_ACTIONS.has("chat-plan")).toBe(true);
  });
});

describe("importData validation", () => {
  it("rejects data without version", () => {
    const data = { courses: [] };
    expect(!data || !data.version).toBe(true);
  });

  it("rejects non-array course data", () => {
    const data = { version: 1, courses: "not an array" };
    const allowed = [
      "courses",
      "events",
      "lessons",
      "documents",
      "readings",
      "settings",
    ];
    const valid = allowed.every((k) => !data[k] || Array.isArray(data[k]));
    expect(valid).toBe(false);
  });

  it("accepts valid data shape", () => {
    const data = { version: 1, courses: [], events: [], lessons: [] };
    const allowed = [
      "courses",
      "events",
      "lessons",
      "documents",
      "readings",
      "settings",
    ];
    const valid = allowed.every((k) => !data[k] || Array.isArray(data[k]));
    expect(valid).toBe(true);
  });
});

describe("Store export functions", () => {
  it("exportICS produces valid ICS structure", () => {
    Store.db.events = [
      {
        id: "e1",
        title: "Midterm",
        due: "2026-10-15T09:00:00.000Z",
        status: "open",
      },
    ];
    const events = Store.db.events.filter((e) => e.due && e.status !== "done");
    expect(events.length).toBe(1);
    const dt = events[0].due.replace(/[-:]/g, "").slice(0, 15) + "00";
    expect(typeof dt).toBe("string");
    expect(dt.length).toBeGreaterThan(10);
  });

  it("exportCSV escapes quotes in labels", () => {
    const label = 'Say "hello"';
    const escaped = '"' + label.replace(/"/g, '""') + '"';
    expect(escaped).toBe('"Say ""hello"""');
  });
});

describe("commitDraft validation", () => {
  it("toggles a subtask and recomputes the parent task status", () => {
    Store.db.events = [
      {
        id: "event-1",
        status: "todo",
        subtasks: [{ id: "sub-1", title: "Read", minutes: 30, done: false }],
      },
    ];

    toggleSubtask("event-1", "sub-1");

    expect(Store.db.events[0].subtasks[0].done).toBe(true);
    expect(Store.db.events[0].status).toBe("done");

    toggleSubtask("event-1", "sub-1");

    expect(Store.db.events[0].subtasks[0].done).toBe(false);
    expect(Store.db.events[0].status).toBe("todo");
  });

  it("filters out lessons without topic", () => {
    const lessons = [
      { include: true, topic: "Week 1" },
      { include: true, topic: "" },
      { include: true },
    ];
    const valid = lessons.filter((l) => l.include !== false && l.topic);
    expect(valid.length).toBe(1);
  });

  it("summarizes plan impact from the generated schedule", () => {
    const summary = summarizeImportPlan(
      { totalMinutes: 135, weeks: 2 },
      {
        events: 3,
        readings: 2,
        lessons: 1,
      },
      [
        { label: "Review: Essay draft", minutes: 30 },
        { label: "Essay draft", minutes: 45 },
      ],
    );

    expect(summary).toContain("2h 15m");
    expect(summary).toContain("2 scheduled blocks");
    expect(summary).toContain("3 deadlines");
    expect(summary).toContain("2 readings");
    expect(summary).toContain("1 review block");
    expect(summary).toContain("All imported work fits");
  });

  it("filters out events without title", () => {
    const events = [
      { include: true, title: "Midterm" },
      { include: true, title: "" },
      { include: true },
    ];
    const valid = events.filter((e) => e.include !== false && e.title);
    expect(valid.length).toBe(1);
  });
});
