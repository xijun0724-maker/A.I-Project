import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import { Standards } from "../../src/config/standards/index.js";
import { NLP } from "../../src/domain/nlp.js";

beforeEach(() => {
  Store.resetAll();
});

describe("Standards registry", () => {
  it("has PNU and generic built-ins", () => {
    const list = Standards.list();
    const ids = list.map((s) => s.id);
    expect(ids).toContain("pnu-cmi-teacher-education-2025");
    expect(ids).toContain("generic-higher-ed");
    expect(Standards.DEFAULT_ID).toBe("pnu-cmi-teacher-education-2025");
  });

  it("get() returns the default for unknown ids", () => {
    const s = Standards.get("does-not-exist");
    expect(s.id).toBe(Standards.DEFAULT_ID);
    expect(s.label).toMatch(/PNU/i);
  });

  it("get() returns registered standards by id", () => {
    expect(Standards.get("generic-higher-ed").label).toMatch(/generic/i);
    expect(Standards.get("pnu-cmi-teacher-education-2025").builtin).toBe(true);
  });

  it("resolve() accepts id string, settings object, or nothing", () => {
    expect(Standards.resolve("generic-higher-ed").id).toBe("generic-higher-ed");
    expect(
      Standards.resolve({ syllabusStandard: "generic-higher-ed" }).id,
    ).toBe("generic-higher-ed");
    expect(Standards.resolve(null).id).toBe(Standards.DEFAULT_ID);
    expect(Standards.resolve().id).toBe(Standards.DEFAULT_ID);
  });

  it("registers and resolves custom standards", () => {
    const ok = Standards.register({
      id: "my-custom-sys",
      label: "My Custom Syllabus",
      requiredSections: [
        {
          id: "intro",
          label: "Introduction",
          patterns: [/introduction/i],
        },
      ],
      gradingTarget: 100,
      minimumSessionCount: 1,
    });
    expect(ok).toBe(true);
    expect(Standards.has("my-custom-sys")).toBe(true);
    expect(Standards.get("my-custom-sys").label).toBe("My Custom Syllabus");
    expect(Standards.resolve("my-custom-sys").id).toBe("my-custom-sys");
    expect(Standards.unregister("my-custom-sys")).toBe(true);
    expect(Standards.has("my-custom-sys")).toBe(false);
  });

  it("rejects invalid custom standards", () => {
    expect(Standards.register(null)).toBe(false);
    expect(Standards.register({ id: "x", label: "X" })).toBe(false);
    expect(
      Standards.register({
        id: "",
        label: "No id",
        requiredSections: [{ id: "a", label: "A", patterns: [/a/] }],
      }),
    ).toBe(false);
  });

  it("cannot unregister built-ins", () => {
    expect(Standards.unregister("pnu-cmi-teacher-education-2025")).toBe(false);
    expect(Standards.unregister("generic-higher-ed")).toBe(false);
    expect(Standards.has("generic-higher-ed")).toBe(true);
  });
});

describe("NLP.analyseAgainstStandard with registry", () => {
  const emptyResult = { lessons: [], events: [], readings: [] };

  it("defaults to the configured settings standard", () => {
    const a = NLP.analyseAgainstStandard("nothing here", emptyResult);
    expect(a.standard).toBe(Store.db.settings.syllabusStandard);
    expect(a.standardLabel).toBeTruthy();
    expect(typeof a.score).toBe("number");
  });

  it("analyses against an explicit standard id", () => {
    const text = [
      "Course Code: CS 101",
      "Learning Outcomes: Students will be able to design algorithms.",
      "Schedule",
      "Week 1 Intro",
      "Assessment: midterm and final",
      "Grading scale: A 90-100",
      "Required readings: textbook chapter 1",
      "Attendance policy: attend class",
      "Instructor: Dr Smith office hours",
    ].join("\n");
    const a = NLP.analyseAgainstStandard(
      text,
      emptyResult,
      "generic-higher-ed",
    );
    expect(a.standard).toBe("generic-higher-ed");
    expect(a.standardLabel).toMatch(/generic/i);
    expect(a.score).toBeGreaterThan(50);
    const present = a.sections.filter((s) => s.status === "present");
    expect(present.length).toBeGreaterThanOrEqual(5);
  });

  it("scores poorly on empty text against any standard", () => {
    const a = NLP.analyseAgainstStandard("", emptyResult, "generic-higher-ed");
    expect(a.score).toBe(0);
    expect(a.sections.every((s) => s.status === "missing")).toBe(true);
  });

  it("analyse() honours settings.syllabusStandard", () => {
    Store.db.settings.syllabusStandard = "generic-higher-ed";
    const res = NLP.analyse({
      name: "syllabus.txt",
      text: "Course Code: CS101\nLearning Outcomes: know things\nAssessment: exams\nGrading scale: A/B\nRequired readings: book\nAttendance policy: show up\nInstructor: someone",
    });
    expect(res.standard.standard).toBe("generic-higher-ed");
    expect(res.standard.standardLabel).toMatch(/generic/i);
  });
});

describe("Standards competencies", () => {
  it("exposes PNU competency list by default", () => {
    const comps = Standards.competencies();
    const ids = comps.map((c) => c.id);
    expect(ids).toContain("cilos");
    expect(ids).toContain("ppst");
    expect(comps.every((c) => c.label)).toBe(true);
  });

  it("exposes generic competencies for generic-higher-ed", () => {
    const comps = Standards.competencies("generic-higher-ed");
    const ids = comps.map((c) => c.id);
    expect(ids).toContain("learning-outcomes");
    expect(ids).not.toContain("ppst");
  });

  it("reads competencies from settings.syllabusStandard", () => {
    Store.db.settings.syllabusStandard = "generic-higher-ed";
    const comps = Standards.competencies(Store.db.settings);
    expect(comps.map((c) => c.id)).toContain("learning-outcomes");
  });

  it("dashboard competency mastery follows the active standard", async () => {
    const { Dashboard } = await import("../../src/domain/dashboard.js");
    Store.db.events = [
      {
        id: "e1",
        courseId: "c1",
        type: "exam",
        status: "done",
        title: "Midterm",
        subtasks: [],
      },
      {
        id: "e2",
        courseId: "c1",
        type: "reading",
        status: "open",
        title: "Chapter 1",
        subtasks: [],
      },
    ];

    Store.db.settings.syllabusStandard = "pnu-cmi-teacher-education-2025";
    const pnu = Dashboard.competencyMastery("c1");
    const pnuLabels = pnu.map((c) => c.label);
    expect(pnuLabels).toContain("Course Intended Learning Outcomes (CILOs)");
    expect(pnuLabels).toContain("Performance Standards");

    Store.db.settings.syllabusStandard = "generic-higher-ed";
    const gen = Dashboard.competencyMastery("c1");
    const genLabels = gen.map((c) => c.label);
    expect(genLabels).toContain("Learning outcomes");
    expect(genLabels).not.toContain("PPST Alignment");
    expect(gen.find((c) => c.label === "Learning outcomes").mastery).toBe(50);
  });
});
