/**
 * Tests for src/utils/format.js — HTML generation helpers
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import {
  bar,
  ring,
  empty,
  priBadge,
  statusBadge,
  eventBadge,
  dueLabel,
  statBox,
  tabBtn,
  courseChip,
} from "../../src/utils/format.js";

beforeEach(() => {
  Store.load();
});

describe("bar()", () => {
  it("returns an HTML string containing role=progressbar", () => {
    const html = bar(50);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  it("includes aria-label with percentage", () => {
    const html = bar(75);
    expect(html).toContain('aria-label="75% complete"');
  });

  it("clamps values above 100", () => {
    const html = bar(150);
    expect(html).toContain('aria-valuenow="100"');
  });

  it("clamps negative values", () => {
    const html = bar(-5);
    expect(html).toContain('aria-valuenow="0"');
  });

  it("applies ok modifier class when cls=ok", () => {
    const html = bar(100, "ok");
    expect(html).toContain("bar ok");
  });

  it("applies warn modifier class when cls=warn", () => {
    const html = bar(20, "warn");
    expect(html).toContain("bar warn");
  });
});

describe("ring()", () => {
  it("returns a ring div with percentage text", () => {
    const html = ring(50);
    expect(html).toContain('class="ring"');
    expect(html).toContain("50%");
  });
});

describe("empty()", () => {
  it("returns HTML with title and description", () => {
    const html = empty("", "No data", "Add something to get started.");
    expect(html).toContain("No data");
    expect(html).toContain("Add something to get started.");
  });
});

describe("priBadge()", () => {
  it("returns a badge span with the priority label", () => {
    const html = priBadge("High");
    expect(html).toContain("High");
    expect(html).toContain("badge");
  });

  it("applies the crit class for Critical", () => {
    const html = priBadge("Critical");
    expect(html).toContain("crit");
  });
});

describe("eventBadge()", () => {
  it("returns a badge for an open event", () => {
    const html = eventBadge({ status: "todo", type: "assignment" });
    expect(html).toContain("badge");
  });

  it("returns Completed badge for a done event", () => {
    const html = eventBadge({ status: "done", type: "exam" });
    expect(html).toContain("Completed");
  });

  it("returns a badge for a doing event with no due date", () => {
    const html = eventBadge({ status: "doing", type: "project" });
    expect(html).toContain("badge");
  });
});

describe("dueLabel()", () => {
  it("returns a badge for an overdue event", () => {
    const html = dueLabel("2020-01-01");
    expect(html).toContain("badge");
  });

  it("handles null due date", () => {
    const html = dueLabel(null);
    expect(html).toContain("No date");
  });
});

describe("statBox()", () => {
  it("renders a stat box with value and label", () => {
    const html = statBox(42, "Tasks");
    expect(html).toContain("42");
    expect(html).toContain("Tasks");
  });
});

describe("tabBtn()", () => {
  it("renders a tab button with role=tab", () => {
    const html = tabBtn("open", "Open", true, "tasks");
    expect(html).toContain('role="tab"');
    expect(html).toContain("Open");
    expect(html).toContain("active");
  });

  it("does not include active class when isSelected is false", () => {
    const html = tabBtn("open", "Open", false, "tasks");
    expect(html).not.toContain("active");
  });
});

describe("courseChip()", () => {
  it("returns a chip when the course exists in the store", () => {
    Store.db.courses = [{ id: "c1", code: "CS101", color: "#ff0000" }];
    const html = courseChip("c1");
    expect(html).toContain("CS101");
    expect(html).toContain("tag");
  });

  it("returns empty string when the course does not exist", () => {
    Store.db.courses = [];
    const html = courseChip("nonexistent");
    expect(html).toBe("");
  });
});

describe("statusBadge()", () => {
  it("returns Not started badge for todo status", () => {
    const html = statusBadge({ status: "todo" });
    expect(html).toContain("status-todo");
    expect(html).toContain("Not started");
  });

  it("returns In progress badge for doing status", () => {
    const html = statusBadge({ status: "doing" });
    expect(html).toContain("status-doing");
    expect(html).toContain("In progress");
  });

  it("returns In progress with percentage when subtasks exist", () => {
    const html = statusBadge({
      status: "doing",
      subtasks: [{ done: true }, { done: false }],
    });
    expect(html).toContain("status-doing");
    expect(html).toContain("In progress · 50%");
  });

  it("returns Completed badge for done status", () => {
    const html = statusBadge({ status: "done" });
    expect(html).toContain("status-done");
    expect(html).toContain("Completed");
  });

  it("returns empty string for null", () => {
    expect(statusBadge(null)).toBe("");
  });
});
