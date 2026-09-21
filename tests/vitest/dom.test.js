// @vitest-environment happy-dom
/**
 * Tests for src/utils/dom.js — DOM helper utilities
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

let dom;

beforeEach(async () => {
  document.body.innerHTML = "";
  vi.resetModules();
  dom = await import("../../src/utils/dom.js");
});

describe("q()", () => {
  it("returns the first matching element", () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    const el = dom.q("#a");
    expect(el).toBeTruthy();
    expect(el.id).toBe("a");
  });

  it("returns null when no match is found", () => {
    expect(dom.q("#nonexistent")).toBeNull();
  });

  it("searches within a root element", () => {
    document.body.innerHTML =
      '<div id="root"><span id="inner"></span></div>';
    const root = document.getElementById("root");
    expect(dom.q("#inner", root)).toBeTruthy();
    expect(dom.q("#inner", document.createElement("div"))).toBeNull();
  });
});

describe("qa()", () => {
  it("returns an array of matching elements", () => {
    document.body.innerHTML = '<span class="x">A</span><span class="x">B</span>';
    const els = dom.qa(".x");
    expect(els).toHaveLength(2);
  });

  it("returns an empty array when no matches", () => {
    const els = dom.qa(".nonexistent");
    expect(els).toHaveLength(0);
  });
});

describe("ext()", () => {
  it("extracts file extension from a filename", () => {
    expect(dom.ext("notes.pdf")).toBe("pdf");
    expect(dom.ext("doc.DOCX")).toBe("docx");
  });

  it("returns empty string for files without an extension", () => {
    expect(dom.ext("Makefile")).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(dom.ext("")).toBe("");
  });
});

describe("toast()", () => {
  beforeEach(() => {
    const toasts = document.createElement("div");
    toasts.id = "toasts";
    document.body.appendChild(toasts);
  });

  it("creates a toast element in the DOM", () => {
    dom.toast("Hello!", "ok");
    const container = document.getElementById("toasts");
    expect(container).toBeTruthy();
    expect(container.innerHTML).toContain("Hello!");
  });

  it("applies the type class", () => {
    dom.toast("Warning", "warn");
    const container = document.getElementById("toasts");
    expect(container.innerHTML).toContain("warn");
  });

  it("defaults to info type", () => {
    dom.toast("Info message");
    const container = document.getElementById("toasts");
    expect(container.innerHTML).toContain("info");
  });

  it("does nothing when #toasts container is missing", () => {
    document.body.innerHTML = "";
    /* should not throw */
    expect(() => dom.toast("No container", "ok")).not.toThrow();
  });
});
