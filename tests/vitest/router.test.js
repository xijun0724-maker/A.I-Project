import { describe, it, expect, beforeEach, vi } from "vitest";
import { Router } from "../../src/core/router.js";
import { esc } from "../../src/utils/helpers.js";

describe("Router.mark() SVG generation", () => {
  it("returns SVG for known icons", () => {
    const svg = Router.mark("dashboard");
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain("<rect");
  });

  it("returns SVG for tasks icon", () => {
    const svg = Router.mark("tasks");
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 16 16"');
  });

  it("returns empty string for unknown icon", () => {
    expect(Router.mark("nonexistent")).toBe("");
  });
});

describe("Router.icons registry", () => {
  it("has icons for all navigation items", () => {
    Router.navGroups.forEach((g) => {
      g.items.forEach((item) => {
        expect(Router.icons).toHaveProperty(item.icon);
        expect(Router.icons[item.icon]).toBeTruthy();
      });
    });
  });

  it("all icon values are SVG path strings", () => {
    Object.values(Router.icons).forEach((val) => {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    });
  });
});

describe("Router.viewDefs", () => {
  beforeEach(() => {
    // Clean up any test views
    delete Router.viewDefs["test-view"];
  });

  it("registerView stores a view definition", () => {
    Router.registerView("test-view", {
      title: "Test View",
      fn: () => "<div>test</div>",
    });
    expect(Router.viewDefs["test-view"]).toBeDefined();
    expect(Router.viewDefs["test-view"].title).toBe("Test View");
  });

  it("registerView overwrites duplicate registrations", () => {
    Router.registerView("test-view", { title: "V1" });
    Router.registerView("test-view", { title: "V2" });
    expect(Router.viewDefs["test-view"].title).toBe("V2");
  });
});

describe("Router.navGroups structure", () => {
  it("has exactly two groups", () => {
    expect(Router.navGroups.length).toBe(2);
  });

  it("first group targets #navMain", () => {
    expect(Router.navGroups[0].target).toBe("#navMain");
  });

  it("second group targets #navStudy", () => {
    expect(Router.navGroups[1].target).toBe("#navStudy");
  });

  it("each item has id, label, and icon", () => {
    Router.navGroups.forEach((g) => {
      g.items.forEach((item) => {
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("label");
        expect(item).toHaveProperty("icon");
        expect(typeof item.id).toBe("string");
        expect(typeof item.label).toBe("string");
        expect(typeof item.icon).toBe("string");
      });
    });
  });

  it("has dashboard as first main nav item", () => {
    expect(Router.navGroups[0].items[0].id).toBe("dashboard");
  });

  it("has settings in study nav", () => {
    const studyIds = Router.navGroups[1].items.map((i) => i.id);
    expect(studyIds).toContain("settings");
  });
  it("keeps planner as the main planning view and demotes roadmap", () => {
    const mainIds = Router.navGroups[0].items.map((i) => i.id);
    const studyIds = Router.navGroups[1].items.map((i) => i.id);
    expect(mainIds).toContain("planner");
    expect(mainIds).not.toContain("roadmap");
    expect(studyIds).toContain("roadmap");
  });
});

describe("Router navigation", () => {
  it("navigate is a function", () => {
    expect(typeof Router.navigate).toBe("function");
  });

  it("Router has all expected API methods", () => {
    expect(typeof Router.mark).toBe("function");
    expect(typeof Router.registerView).toBe("function");
    expect(typeof Router.renderNav).toBe("function");
    expect(typeof Router.syncChrome).toBe("function");
    expect(typeof Router.render).toBe("function");
    expect(typeof Router.navigate).toBe("function");
    expect(typeof Router.init).toBe("function");
  });
});

describe("esc() HTML escaping", () => {
  it("escapes HTML entities", () => {
    expect(esc("<script>")).toBe("&lt;script&gt;");
    expect(esc("a&b")).toBe("a&amp;b");
    expect(esc('"quote"')).toBe("&quot;quote&quot;");
  });

  it("returns empty string for falsy input", () => {
    expect(esc("")).toBe("");
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("leaves normal text unchanged", () => {
    expect(esc("hello world")).toBe("hello world");
    expect(esc("abc 123")).toBe("abc 123");
  });
});
