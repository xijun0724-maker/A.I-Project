import { describe, it, expect, beforeEach } from "vitest";

import { Store } from "../../src/core/store.js";
import { CFG } from "../../src/config/constants.js";

beforeEach(() => {
  Store.resetAll();
});

describe("Store.lookup", () => {
  it("course() returns null for unknown id", () => {
    expect(Store.course("nonexistent")).toBeNull();
  });

  it("course() finds a course by id", () => {
    Store.db.courses = [{ id: "c1", title: "Math" }];
    expect(Store.course("c1")).toEqual({ id: "c1", title: "Math" });
  });

  it('courseName() returns "Unassigned" for missing course', () => {
    expect(Store.courseName("nope")).toBe("Unassigned");
  });

  it("courseName() returns code or title", () => {
    Store.db.courses = [{ id: "c1", code: "CS101", title: "Intro" }];
    expect(Store.courseName("c1")).toBe("CS101");
  });

  it("courseColor() returns default for missing course", () => {
    expect(Store.courseColor("nope")).toBe("#67717a");
  });

  it("event() returns null for unknown id", () => {
    expect(Store.event("nonexistent")).toBeNull();
  });

  it("event() finds an event by id", () => {
    Store.db.events = [{ id: "e1", title: "Midterm" }];
    expect(Store.event("e1")).toEqual({ id: "e1", title: "Midterm" });
  });

  it("doc() returns null for unknown id", () => {
    expect(Store.doc("nonexistent")).toBeNull();
  });

  it("doc() finds a document by id", () => {
    Store.db.documents = [{ id: "d1", name: "syllabus.pdf" }];
    expect(Store.doc("d1")).toEqual({ id: "d1", name: "syllabus.pdf" });
  });

  it("lesson() returns null for unknown id", () => {
    expect(Store.lesson("nonexistent")).toBeNull();
  });

  it("lesson() finds a lesson by id", () => {
    Store.db.lessons = [{ id: "l1", topic: "Week 1" }];
    expect(Store.lesson("l1")).toEqual({ id: "l1", topic: "Week 1" });
  });
});

describe("Store.usage", () => {
  it("returns bytes, pretty string, and cap", () => {
    const u = Store.usage();
    expect(u).toHaveProperty("bytes");
    expect(u).toHaveProperty("pretty");
    expect(u).toHaveProperty("cap");
    expect(u.cap).toBe(CFG.storage.maxBytes);
    expect(typeof u.pretty).toBe("string");
  });

  it("reports non-negative bytes", () => {
    const u = Store.usage();
    expect(u.bytes).toBeGreaterThanOrEqual(0);
  });
});

describe("Store.resetAll", () => {
  it("resets db to blank schema", () => {
    Store.db.courses = [{ id: "c1" }];
    Store.db.events = [{ id: "e1" }];
    Store.resetAll();
    expect(Store.db.courses).toEqual([]);
    expect(Store.db.events).toEqual([]);
    expect(Store.db.version).toBe(CFG.schemaVersion);
  });
});

describe("Store.deduplicateData", () => {
  it("removes repeated imported lessons, events, and readings", () => {
    Store.db.lessons = [
      {
        id: "l1",
        courseId: "c1",
        week: 1,
        topic: "Content management",
        done: false,
      },
      {
        id: "l2",
        courseId: "c1",
        week: 1,
        topic: "Content management",
        done: true,
      },
    ];
    Store.db.events = [
      {
        id: "e1",
        courseId: "c1",
        title: "Final Examination",
        due: null,
        subtasks: [],
      },
      {
        id: "e2",
        courseId: "c1",
        title: "Final Examination",
        due: null,
        subtasks: [],
      },
    ];
    Store.db.readings = [
      { id: "r1", courseId: "c1", week: 1, title: "Classroom management" },
      { id: "r2", courseId: "c1", week: 1, title: "Classroom management" },
    ];

    expect(Store.deduplicateData(Store.db)).toBe(true);
    expect(Store.db.lessons).toHaveLength(1);
    expect(Store.db.lessons[0].done).toBe(true);
    expect(Store.db.events).toHaveLength(1);
    expect(Store.db.readings).toHaveLength(1);
    expect(Store.db.plan).toEqual([]);
    expect(Store.db.planMeta).toBeNull();
  });
});

describe("Store.removeCourse", () => {
  it("removes a course and associated events/lessons", () => {
    Store.db.courses = [{ id: "c1" }, { id: "c2" }];
    Store.db.events = [
      { id: "e1", courseId: "c1", subtasks: [] },
      { id: "e2", courseId: "c2", subtasks: [] },
    ];
    Store.db.lessons = [
      { id: "l1", courseId: "c1" },
      { id: "l2", courseId: "c2" },
    ];
    Store.removeCourse("c1");
    expect(Store.db.courses.length).toBe(1);
    expect(Store.db.courses[0].id).toBe("c2");
    expect(Store.db.events.length).toBe(1);
    expect(Store.db.events[0].id).toBe("e2");
    expect(Store.db.lessons.length).toBe(1);
    expect(Store.db.lessons[0].id).toBe("l2");
  });
});
