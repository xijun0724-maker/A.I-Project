// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import { KNOWN_ACTIONS } from "../../src/core/actions/index.js";
import {
  saveAcademicCalendar,
  getActiveAcademicCalendar,
  getAcademicCalendars,
  calculateMilestones,
} from "../../src/domain/academic-calendar.js";
import { renderCalendarCard } from "../../src/views/calendar.js";
import { dashboardView } from "../../src/views/dashboard.js";

describe("Academic Calendar Feature", () => {
  beforeEach(() => {
    Store.resetAll();
  });

  it("registers academic-calendar-modal in KNOWN_ACTIONS", () => {
    expect(KNOWN_ACTIONS.has("academic-calendar-modal")).toBe(true);
  });

  it("retrieves default active academic calendar settings", () => {
    const active = getActiveAcademicCalendar();
    expect(active.academicYear).toBe("2026–2027");
    expect(active.termName).toBe("1st Term");
    expect(active).toHaveProperty("termStart");
    expect(active).toHaveProperty("termEnd");
  });

  it("calculates academic milestones across term start and end", () => {
    const milestones = calculateMilestones("2026-09-01", "2027-01-20", "1st Semester");
    expect(milestones.length).toBe(4);
    expect(milestones[0].title).toBe("1st Semester Classes Begin");
    expect(milestones[1].title).toBe("1st Semester Midterm Examination Week");
    expect(milestones[2].title).toBe("1st Semester Final Examination Week");
    expect(milestones[3].title).toBe("1st Semester Officially Concludes");
    expect(milestones[0].due).toContain("2026-09-01");
    expect(milestones[3].due).toContain("2027-01-20");
  });

  it("saves academic calendar and updates settings", () => {
    const cal = saveAcademicCalendar({
      academicYear: "2025–2026",
      termName: "2nd Semester",
      termStart: "2026-02-01",
      termEnd: "2026-06-15",
      generateMilestones: false,
    });

    expect(cal).toBeDefined();
    expect(cal.academicYear).toBe("2025–2026");
    expect(cal.termName).toBe("2nd Semester");
    expect(cal.isActive).toBe(true);

    expect(Store.db.settings.academicYear).toBe("2025–2026");
    expect(Store.db.settings.termName).toBe("2nd Semester");
    expect(Store.db.settings.termStart).toBe("2026-02-01");
    expect(Store.db.settings.termEnd).toBe("2026-06-15");

    const saved = getAcademicCalendars();
    expect(saved.length).toBe(1);
    expect(saved[0].termName).toBe("2nd Semester");
  });

  it("generates milestone events in Store.db.events when requested", () => {
    saveAcademicCalendar({
      academicYear: "2026–2027",
      termName: "1st Term",
      termStart: "2026-09-01",
      termEnd: "2027-01-20",
      generateMilestones: true,
    });

    const milestones = Store.db.events.filter((e) => e.tag === "academic-milestone");
    expect(milestones.length).toBe(4);
    expect(milestones.some((m) => m.title.includes("Classes Begin"))).toBe(true);
    expect(milestones.some((m) => m.title.includes("Midterm"))).toBe(true);
    expect(milestones.some((m) => m.title.includes("Final Examination"))).toBe(true);
  });

  it("renders academic calendar trigger and badges in Calendar and Dashboard views", () => {
    saveAcademicCalendar({
      academicYear: "2026–2027",
      termName: "1st Term",
      termStart: "2026-09-01",
      termEnd: "2027-01-20",
      generateMilestones: false,
    });

    const calHtml = renderCalendarCard();
    expect(calHtml).toContain("data-act=\"academic-calendar-modal\"");
    expect(calHtml).toContain("2026–2027");
    expect(calHtml).toContain("1st Term");

    const dashHtml = dashboardView.fn();
    expect(dashHtml).toContain("data-act=\"academic-calendar-modal\"");
    expect(dashHtml).toContain("2026–2027");
    expect(dashHtml).toContain("1st Term");
  });
});
