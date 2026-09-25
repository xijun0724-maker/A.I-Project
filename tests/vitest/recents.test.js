// @vitest-environment happy-dom
/**
 * Tests for the shared sidebar Recents renderer in src/utils/format.js.
 * Both the router and the chat search render through these helpers.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recentPrompts,
  recentsHTML,
  renderRecents,
} from "../../src/utils/format.js";

const chat = [
  { role: "user", content: "Announcement" },
  { role: "assistant", content: "ok" },
  { role: "user", content: "TM" },
  { role: "assistant", content: "ok" },
  { role: "user", content: "Prompt" },
  { role: "assistant", content: "ok" },
];

describe("recentPrompts()", () => {
  it("returns prompts newest first and ignores assistant turns", () => {
    expect(recentPrompts(chat).map((m) => m.content)).toEqual([
      "Prompt",
      "TM",
      "Announcement",
    ]);
  });

  it("collapses repeated prompts to one entry", () => {
    const dupes = [
      { role: "user", content: "same" },
      { role: "user", content: "same" },
      { role: "user", content: "other" },
    ];
    expect(recentPrompts(dupes).map((m) => m.content)).toEqual([
      "other",
      "same",
    ]);
  });

  it("caps at five entries by default", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      role: "user",
      content: "prompt " + i,
    }));
    expect(recentPrompts(many)).toHaveLength(5);
    expect(recentPrompts(many)[0].content).toBe("prompt 11");
  });

  it("treats limit 0 as unlimited", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      role: "user",
      content: "prompt " + i,
    }));
    expect(recentPrompts(many, "", 0)).toHaveLength(12);
  });

  it("filters case-insensitively", () => {
    expect(recentPrompts(chat, "tm").map((m) => m.content)).toEqual(["TM"]);
    expect(recentPrompts(chat, "PROMPT").map((m) => m.content)).toEqual([
      "Prompt",
    ]);
  });

  it("survives an empty or missing log", () => {
    expect(recentPrompts([])).toEqual([]);
    expect(recentPrompts(null)).toEqual([]);
    expect(recentPrompts([{ role: "user" }])).toEqual([{ role: "user" }]);
  });
});

describe("recentsHTML()", () => {
  it("marks only the newest prompt as the current conversation", () => {
    const html = recentsHTML(recentPrompts(chat));
    expect(html.match(/class="recent-chat-link active"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="true"');
    expect(html.indexOf("active")).toBeLessThan(html.indexOf("Announcement"));
  });

  it("drops the active pill when activeFirst is false", () => {
    const html = recentsHTML(recentPrompts(chat), { activeFirst: false });
    expect(html).not.toContain(" active");
    expect(html).not.toContain("aria-current");
  });

  it("truncates long prompts in the label but keeps the full text in data-q", () => {
    const long = "x".repeat(80);
    const html = recentsHTML([{ role: "user", content: long }]);
    expect(html).toContain("x".repeat(28) + "\u2026");
    expect(html).toContain('data-q="' + long + '"');
  });

  it("escapes markup in both the label and the attribute", () => {
    const html = recentsHTML([
      { role: "user", content: '<img src=x onerror="alert(1)"> & more' },
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="alert');
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp; more");
  });
});

describe("renderRecents()", () => {
  let list;

  beforeEach(() => {
    document.body.innerHTML = '<div id="recentChatList"></div>';
    list = document.getElementById("recentChatList");
  });

  it("writes one row per prompt and reports the count", () => {
    expect(renderRecents(list, chat)).toBe(3);
    expect(list.querySelectorAll(".recent-chat-link")).toHaveLength(3);
  });

  it("clears the list when there is nothing to show", () => {
    list.innerHTML = "stale";
    expect(renderRecents(list, [])).toBe(0);
    expect(list.innerHTML).toBe("");
  });

  it("renders an empty label for a search with no hits", () => {
    const rows = renderRecents(list, chat, {
      query: "nothing matches this",
      limit: 0,
      activeFirst: false,
      emptyLabel: "No matches",
    });
    expect(rows).toBe(0);
    expect(list.textContent.trim()).toBe("No matches");
  });

  it("round-trips a prompt containing quotes through data-q", () => {
    renderRecents(list, [{ role: "user", content: 'say "hi"' }]);
    expect(list.querySelector(".recent-chat-link").dataset.q).toBe('say "hi"');
  });

  it("does not throw when the container is missing", () => {
    expect(() => renderRecents(null, chat)).not.toThrow();
    expect(renderRecents(null, chat)).toBe(0);
  });
});
