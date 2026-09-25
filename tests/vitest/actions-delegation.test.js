// @vitest-environment happy-dom
/**
 * Tests for src/app/actions-delegation.js
 * A swallowed action error is indistinguishable from a dead button, so
 * handlers that throw (or reject) must always reach the user as a toast.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";

const actMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/core/actions/index.js", () => ({ act: actMock }));

import { initActionDelegation } from "../../src/app/actions-delegation.js";

let errorSpy;

/* Listeners are attached to the document, so register them once: calling
   initActionDelegation() per test would dispatch every click twice. */
beforeAll(() => {
  document.body.innerHTML = '<div id="toasts"></div>';
  initActionDelegation();
});

beforeEach(() => {
  actMock.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  document.querySelectorAll("[data-act]").forEach((el) => el.remove());
  document.querySelector("#toasts").innerHTML = "";
});

afterEach(() => {
  errorSpy.mockRestore();
});

function mount(html) {
  document.body.insertAdjacentHTML("beforeend", html);
  return document.body.lastElementChild;
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

function keydown(el, key) {
  el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
}

function toastEl() {
  return document.querySelector("#toasts .toast-item");
}

describe("click delegation", () => {
  it("dispatches the action name and element", () => {
    const el = mount('<button data-act="nav" data-arg="tasks">Tasks</button>');

    click(el);

    expect(actMock).toHaveBeenCalledTimes(1);
    expect(actMock.mock.calls[0][0]).toBe("nav");
    expect(actMock.mock.calls[0][1]).toBe(el);
  });

  it("ignores clicks outside any [data-act] element", () => {
    const el = mount("<p>just text</p>");

    click(el);

    expect(actMock).not.toHaveBeenCalled();
  });
});

describe("error reporting", () => {
  it("surfaces a synchronous throw as a toast and does not rethrow", () => {
    actMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const el = mount('<button data-act="data-export">Export</button>');

    expect(() => click(el)).not.toThrow();

    const shown = toastEl();
    expect(shown).not.toBeNull();
    expect(shown.className).toContain("bad");
    expect(shown.textContent).toContain("Action failed");
    expect(shown.textContent).toContain("Something went wrong: boom");
    expect(String(errorSpy.mock.calls[0][0])).toContain("data-export");
  });

  it("surfaces a rejected async handler as a toast", async () => {
    actMock.mockImplementation(() => Promise.reject(new Error("parse failed")));
    const el = mount('<button data-act="plan-generate">Plan</button>');

    click(el);

    await vi.waitFor(() => expect(toastEl()).not.toBeNull());
    expect(toastEl().textContent).toContain("parse failed");
  });

  it("stays quiet when the handler succeeds", () => {
    actMock.mockReturnValue(undefined);
    const el = mount('<button data-act="nav">Dashboard</button>');

    click(el);

    expect(toastEl()).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("stays quiet when an async handler resolves", async () => {
    actMock.mockResolvedValue(undefined);
    const el = mount('<button data-act="nav">Dashboard</button>');

    click(el);
    await Promise.resolve();

    expect(toastEl()).toBeNull();
  });

  it("still reports a non-Error rejection value", async () => {
    actMock.mockImplementation(() => Promise.reject("plain string"));
    const el = mount('<button data-act="nav">Dashboard</button>');

    click(el);

    await vi.waitFor(() => expect(toastEl()).not.toBeNull());
    expect(toastEl().textContent).toContain("plain string");
  });
});

describe("keyboard delegation", () => {
  it("activates a role=checkbox element on Space and Enter", () => {
    const el = mount(
      '<div data-act="sub-toggle" data-id="s1" role="checkbox" tabindex="0">Sub</div>',
    );

    keydown(el, " ");
    keydown(el, "Enter");

    expect(actMock).toHaveBeenCalledTimes(2);
    expect(actMock.mock.calls[0][0]).toBe("sub-toggle");
  });

  it("ignores other keys", () => {
    const el = mount(
      '<div data-act="sub-toggle" role="checkbox" tabindex="0">Sub</div>',
    );

    keydown(el, "a");

    expect(actMock).not.toHaveBeenCalled();
  });

  it("leaves real buttons to the click handler", () => {
    const el = mount(
      '<button data-act="task-toggle" data-id="e1" role="checkbox">Task</button>',
    );

    keydown(el, " ");

    expect(actMock).not.toHaveBeenCalled();
  });

  it("reports failures from the keyboard path too", () => {
    actMock.mockImplementation(() => {
      throw new Error("kaboom");
    });
    const el = mount(
      '<div data-act="sub-toggle" role="checkbox" tabindex="0">Sub</div>',
    );

    keydown(el, " ");

    expect(toastEl().textContent).toContain("kaboom");
  });
});
