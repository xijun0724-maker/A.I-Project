// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/core/router.js", () => ({
  Router: {
    render: vi.fn(),
    scheduleRender: vi.fn(),
    navigate: vi.fn(),
  },
}));

import { Store } from "../../src/core/store.js";
import { importPick, importBind } from "../../src/views/import.js";

describe("import drop zone accessibility", () => {
  beforeEach(() => {
    Store.resetAll();
    document.body.innerHTML = importPick();
  });

  it("exposes the drop zone as a focusable button", () => {
    const dz = document.querySelector("#dropZone");
    expect(dz).toBeTruthy();
    expect(dz.getAttribute("role")).toBe("button");
    expect(dz.getAttribute("tabindex")).toBe("0");
    expect(dz.getAttribute("aria-label")).toMatch(/drop|browse|choose/i);
  });

  it("opens the file picker on Enter and Space", () => {
    const root = document.body;
    importBind(root);
    const dz = document.querySelector("#dropZone");
    const input = document.querySelector("#fileInput");
    const click = vi.fn();
    input.click = click;

    dz.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(click).toHaveBeenCalledTimes(1);

    dz.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    expect(click).toHaveBeenCalledTimes(2);
  });
});
