import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import { setApiKey, clearApiKey } from "../../src/utils/secure.js";
import {
  parseJson,
  chat,
  status,
  usable,
  normalizeGeminiModel,
} from "../../src/ai/client.js";
import { CFG } from "../../src/config/constants.js";

beforeEach(() => {
  Store.resetAll();
  clearApiKey();
});

describe("parseJson", () => {
  it("parses valid JSON", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("finds JSON object in surrounding text", () => {
    expect(parseJson('Here is the result: {"a":1} done.')).toEqual({ a: 1 });
  });

  it("returns null for non-JSON", () => {
    expect(parseJson("hello world")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseJson("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseJson(null)).toBeNull();
  });

  it("strips trailing commas", () => {
    expect(parseJson('{"a":1,}')).toEqual({ a: 1 });
  });
});

describe("status", () => {
  it("returns offline when AI disabled", () => {
    Store.db.settings.aiEnabled = false;
    const s = status();
    expect(s.on).toBe(false);
    expect(s.why).toContain("switched off");
  });

  it("returns offline when no API key", () => {
    Store.db.settings.aiEnabled = true;
    clearApiKey();
    const s = status();
    expect(s.on).toBe(false);
    expect(s.why).toContain("No API key");
  });

  it("returns offline when key too short (rejected at storage)", () => {
    Store.db.settings.aiEnabled = true;
    setApiKey("short");
    const s = status();
    expect(s.on).toBe(false);
    expect(s.why).toContain("No API key");
  });

  it("returns online when key is valid", () => {
    Store.db.settings.aiEnabled = true;
    setApiKey("a".repeat(20));
    Store.db.settings.provider = "gemini";
    const s = status();
    expect(s.on).toBe(true);
    expect(s.label).toContain("Gemini");
  });

  it("returns online for OpenRouter provider", () => {
    Store.db.settings.aiEnabled = true;
    setApiKey("sk-or-" + "a".repeat(20), "openrouter");
    Store.db.settings.provider = "openrouter";
    const s = status();
    expect(s.on).toBe(true);
    expect(s.label).toContain("OpenRouter");
  });
});

describe("usable", () => {
  it("returns false when AI disabled", () => {
    Store.db.settings.aiEnabled = false;
    expect(usable()).toBe(false);
  });

  it("returns false when no key", () => {
    Store.db.settings.aiEnabled = true;
    clearApiKey();
    expect(usable()).toBe(false);
  });

  it("returns true when enabled and key is long enough", () => {
    Store.db.settings.aiEnabled = true;
    setApiKey("a".repeat(20));
    expect(usable()).toBe(true);
  });
});

describe("normalizeGeminiModel", () => {
  it("normalizes stale Gemini aliases to the current supported model", () => {
    expect(normalizeGeminiModel("gemini-2.5-flash")).toBe(CFG.gemini.model);
    expect(normalizeGeminiModel("gemini-3.6-flash")).toBe(CFG.gemini.model);
    expect(normalizeGeminiModel("")).toBe(CFG.gemini.model);
  });
});

describe("chat", () => {
  it("returns error when AI disabled", async () => {
    Store.db.settings.aiEnabled = false;
    const r = await chat([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(r.off).toBe(true);
  });

  it("returns error when no API key", async () => {
    Store.db.settings.aiEnabled = true;
    clearApiKey();
    const r = await chat([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(r.off).toBe(true);
  });

  it("returns error when key too short", async () => {
    Store.db.settings.aiEnabled = true;
    setApiKey("short");
    const r = await chat([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(r.off).toBe(true);
  });

  it("does not reach the network when the signal is already aborted", async () => {
    Store.db.settings.aiEnabled = true;
    setApiKey("test-key-0123456789abcdef");
    const ctrl = new AbortController();
    ctrl.abort();
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = () => {
      called = true;
      return Promise.resolve({ ok: true, json: async () => ({}) });
    };
    try {
      const r = await chat([{ role: "user", content: "hi" }], {
        signal: ctrl.signal,
      });
      expect(called).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.cancelled).toBe(true);
      expect(r.retryable).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("reports a cancel - not a retry or a timeout - when aborted mid-flight", async () => {
    Store.db.settings.aiEnabled = true;
    setApiKey("test-key-0123456789abcdef");
    const ctrl = new AbortController();
    const original = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = (_url, init) => {
      attempts += 1;
      return new Promise((_resolve, reject) => {
        /* Abort once the request is genuinely in flight. */
        const onAbort = () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        };
        if (init.signal.aborted) return onAbort();
        init.signal.addEventListener("abort", onAbort);
        setTimeout(() => ctrl.abort(), 0);
      });
    };
    try {
      const r = await chat([{ role: "user", content: "hi" }], {
        signal: ctrl.signal,
        timeout: 30000,
      });
      expect(attempts).toBe(1);
      expect(r.ok).toBe(false);
      expect(r.cancelled).toBe(true);
      expect(r.error).toBe("Cancelled.");
    } finally {
      globalThis.fetch = original;
    }
  });
});
