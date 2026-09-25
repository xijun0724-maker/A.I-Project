// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import { tasks, afterTasks, tasksView } from "../../src/views/tasks.js";

describe("To-Do List Notepad View & Hierarchy", () => {
  beforeEach(() => {
    Store.resetAll();
    Store.db.courses = [
      { id: "c1", code: "CS 101", title: "Intro to Computer Science" },
      { id: "c2", code: "MATH 201", title: "Linear Algebra" },
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
        subtasks: [
          { id: "st1", title: "Draft answers", done: false, minutes: 30 },
        ],
      },
      {
        id: "ev2",
        title: "Read Chapter 3 Notes",
        type: "reading",
        courseId: "c2",
        due: "2026-09-24T23:59:00Z",
        priority: "Critical",
        status: "todo",
      },
      {
        id: "ev3",
        title: "Lab 1 Checklist",
        type: "lab",
        courseId: "c1",
        due: null,
        priority: "Low",
        status: "done",
      },
    ];
  });

  it("renders the stationery notepad header with sparkles and clean title", () => {
    const html = tasks();
    expect(html).toContain("todo-notepad-card");
    expect(html).toContain("TO DO LIST");
    expect(html).toContain("notepad-sparkle");
  });

  it("completely removes all subtask elements, progress bars, and subtask accordions", () => {
    const html = tasks();
    // Subtasks must not be rendered
    expect(html).not.toContain("Subtasks (");
    expect(html).not.toContain("subtasks</span>");
    expect(html).not.toContain("data-act=\"sub-toggle\"");
    expect(html).not.toContain("Draft answers"); // subtask title should not appear
  });

  it("removes High Priority KPI card and renders a balanced 3-card KPI pulse without empty space", () => {
    const html = tasks();
    expect(html).toContain("tasks-kpi-grid");
    expect(html).toContain("Open To-Dos");
    expect(html).toContain("Overdue");
    expect(html).toContain("Completion");
    expect(html).not.toContain("urgent coursework items");
    const match = html.match(/class="kpi"/g);
    expect(match ? match.length : 0).toBe(3);
  });

  it("removes the inline quick-add form and inputs for a clean notepad layout", () => {
    const html = tasks();
    expect(html).not.toContain('id="quickTodoTitle"');
    expect(html).not.toContain('id="quickTodoPriority"');
    expect(html).not.toContain('id="quickTodoDue"');
    expect(html).not.toContain('id="quickTodoCourse"');
    expect(html).not.toContain('id="quickTodoBtn"');
    expect(html).not.toContain("todo-quick-add-bar");
    expect(html).toContain("+ Add to-do");
    expect(html).toContain('data-act="task-new"');
  });

  it("renders ruled checklist rows with square checkboxes, priority badges, deadline badges with time, progress badges, and clickable row to edit without explicit edit button", () => {
    const html = tasks();
    expect(html).toContain("todo-checklist");
    expect(html).toContain("chk-square");
    expect(html).toContain("Submit Problem Set 1");
    expect(html).toContain("High");
    expect(html).toContain("Critical");
    expect(html).toContain('data-act="task-toggle"');
    expect(html).toContain('data-act="event-edit"');
    expect(html).toContain('data-act="task-delete"');

    // Explicit Edit button is removed; row content is clickable instead
    expect(html).not.toContain(">Edit</button>");
    expect(html).toContain('class="todo-item-content" data-act="event-edit"');
    expect(html).toContain('role="button"');

    // Progress badge is present
    expect(html).toContain("status-todo");
    expect(html).toContain("Not started");

    // Time is included in deadline badge
    expect(html).toContain("11:59 PM");
  });

  it("removes Next Up spotlight card and renders Priorities at a Glance and Study Plan Tools", () => {
    const html = tasks();
    expect(html).not.toContain("Next Up");
    expect(html).not.toContain("todo-focus-card");
    expect(html).toContain("todo-priorities-card");
    expect(html).toContain("Priorities at a Glance");
    expect(html).toContain("todo-tools-card");
    expect(html).toContain("Study Plan Tools");
  });

  it("wires sort select inside notepad header beside + Add to-do and removes from top page head", () => {
    const div = document.createElement("div");
    div.innerHTML = tasks();
    document.body.appendChild(div);
    afterTasks(div);

    // Top page head has no action controls
    expect(div.querySelector(".page-head .todo-head-actions")).toBeNull();

    // Notepad header has clean title cluster and actions with sort select and + Add to-do
    const titleCluster = div.querySelector(".notepad-title-cluster");
    expect(titleCluster.querySelector(".notepad-title")).not.toBeNull();
    expect(div.querySelector(".notepad-count-pill")).toBeNull();

    const headerActions = div.querySelector(".notepad-header-actions");
    expect(headerActions).not.toBeNull();
    expect(headerActions.querySelector("#taskSort")).not.toBeNull();
    expect(headerActions.querySelector('[data-act="task-new"]')).not.toBeNull();

    expect(div.querySelector("#quickTodoTitle")).toBeNull();
    expect(div.querySelector("#quickTodoBtn")).toBeNull();

    div.remove();
  });
});
