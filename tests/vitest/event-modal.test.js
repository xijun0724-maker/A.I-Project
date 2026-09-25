// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import { eventModal } from "../../src/views/modals/event.js";

describe("Event/To-Do Modal — Layout hierarchy & removal of grade weight/points", () => {
  beforeEach(() => {
    Store.resetAll();
    document.body.innerHTML = '<div id="modalRoot"></div>';
    Store.db.courses = [
      { id: "c1", code: "MATH 101", title: "Calculus I" },
    ];
    Store.db.events = [
      {
        id: "ev1",
        title: "Submit Problem Set 1",
        type: "assignment",
        courseId: "c1",
        due: "2026-09-30T23:59:00Z",
        priority: "High",
        status: "todo",
        notes: "Remember to show all work.",
      },
    ];
  });

  it("removes weight of grade, points earned, points possible, and grading hint", () => {
    eventModal("ev1");
    const root = document.querySelector("#modalRoot");
    const html = root.innerHTML;

    expect(html).not.toContain("Weight (% of grade)");
    expect(html).not.toContain("Points earned");
    expect(html).not.toContain("Points possible");
    expect(html).not.toContain("leave blank until graded");
    expect(html).not.toContain("Entering a score feeds the grade column");
    expect(html).not.toContain('id="evWeight"');
    expect(html).not.toContain('id="evEarned"');
    expect(html).not.toContain('id="evPoints"');
  });

  it("renders structured information hierarchy with title, course, priority, category, deadline, status, and notes", () => {
    eventModal("ev1");
    const root = document.querySelector("#modalRoot");

    expect(root.querySelector("#evTitle")).not.toBeNull();
    expect(root.querySelector("#evTitle").value).toBe("Submit Problem Set 1");

    expect(root.querySelector("#evCourse")).not.toBeNull();
    expect(root.querySelector("#evPriority")).not.toBeNull();
    expect(root.querySelector("#evPriority").value).toBe("High");

    expect(root.querySelector("#evType")).not.toBeNull();
    expect(root.querySelector("#evDue")).not.toBeNull();
    expect(root.querySelector("#evTime")).not.toBeNull();

    expect(root.querySelector("#evStatus")).not.toBeNull();
    expect(root.querySelector("#evStatus").value).toBe("todo");

    expect(root.querySelector("#evNotes")).not.toBeNull();
    expect(root.querySelector("#evNotes").value).toBe("Remember to show all work.");

    // Delete button present for existing event
    expect(root.querySelector("#evDelete")).not.toBeNull();
    expect(root.querySelector("#evSave").textContent).toBe("Save changes");
  });

  it("renders 'New to-do' header and Add to-do button when creating a new task", () => {
    eventModal(null);
    const root = document.querySelector("#modalRoot");

    expect(root.innerHTML).toContain("New to-do");
    expect(root.querySelector("#evDelete")).toBeNull();
    expect(root.querySelector("#evSave").textContent).toBe("Add to-do");
  });

  it("saves changes to an existing to-do correctly", () => {
    eventModal("ev1");
    const root = document.querySelector("#modalRoot");

    root.querySelector("#evTitle").value = "Submit Problem Set 1 (Updated)";
    root.querySelector("#evPriority").value = "Critical";
    root.querySelector("#evStatus").value = "done";
    root.querySelector("#evSave").click();

    const ev = Store.event("ev1");
    expect(ev.title).toBe("Submit Problem Set 1 (Updated)");
    expect(ev.priority).toBe("Critical");
    expect(ev.status).toBe("done");
  });

  it("creates a new to-do with entered details", () => {
    eventModal(null);
    const root = document.querySelector("#modalRoot");

    root.querySelector("#evTitle").value = "Read Chapter 5";
    root.querySelector("#evPriority").value = "Medium";
    root.querySelector("#evDue").value = "2026-10-15";
    root.querySelector("#evNotes").value = "Pages 120-145";
    root.querySelector("#evSave").click();

    const created = Store.db.events.find((e) => e.title === "Read Chapter 5");
    expect(created).toBeDefined();
    expect(created.priority).toBe("Medium");
    expect(created.due).toContain("2026-10-15");
    expect(created.notes).toBe("Pages 120-145");
  });
});
