import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/core/store.js";
import {
  parseJson,
  chat,
  status,
  usable,
  applyPreset,
  normalizeGeminiModel,
} from "../../src/ai/client.js";
import { CFG } from "../../src/config/constants.js";

beforeEach(() => {
  Store.resetAll();
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
    Store.db.settings.apiKey = "";
    const s = status();
    expect(s.on).toBe(false);
    expect(s.why).toContain("No API key");
  });

  it("returns offline when key too short", () => {
    Store.db.settings.aiEnabled = true;
    Store.db.settings.apiKey = "short";
    const s = status();
    expect(s.on).toBe(false);
    expect(s.why).toContain("invalid");
  });

  it("returns online when key is valid", () => {
    Store.db.settings.aiEnabled = true;
    Store.db.settings.apiKey = "a".repeat(20);
    Store.db.settings.provider = "gemini";
    const s = status();
    expect(s.on).toBe(true);
    expect(s.label).toContain("Gemini");
  });

  it("returns online for OpenRouter provider", () => {
    Store.db.settings.aiEnabled = true;
    Store.db.settings.apiKey = "sk-or-" + "a".repeat(20);
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
    Store.db.settings.apiKey = "";
    expect(usable()).toBe(false);
  });

  it("returns true when enabled and key is long enough", () => {
    Store.db.settings.aiEnabled = true;
    Store.db.settings.apiKey = "a".repeat(20);
    expect(usable()).toBe(true);
  });
});

describe("applyPreset", () => {
  it("sets Gemini defaults", () => {
    Store.db.settings.provider = "gemini";
    applyPreset();
    expect(Store.db.settings.model).toBe(CFG.gemini.model);
    expect(Store.db.settings.baseUrl).toBe(CFG.gemini.baseUrl);
  });

  it("normalizes stale Gemini aliases to the current supported model", () => {
    expect(normalizeGeminiModel("gemini-2.5-flash")).toBe(CFG.gemini.model);
    expect(normalizeGeminiModel("gemini-3.6-flash")).toBe(CFG.gemini.model);
    expect(normalizeGeminiModel("")).toBe(CFG.gemini.model);
  });

  it("sets OpenRouter defaults", () => {
    Store.db.settings.provider = "openrouter";
    applyPreset();
    expect(Store.db.settings.baseUrl).toBe(CFG.openrouter.baseUrl);
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
    Store.db.settings.apiKey = "";
    const r = await chat([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(r.off).toBe(true);
  });

  it("returns error when key too short", async () => {
    Store.db.settings.aiEnabled = true;
    Store.db.settings.apiKey = "short";
    const r = await chat([{ role: "user", content: "hi" }]);
    expect(r.ok).toBe(false);
    expect(r.off).toBe(true);
  });
});

describe("errorText", () => {
  it("extracts error message from JSON body", () => {
    const body = JSON.stringify({ error: { message: "Invalid key" } });
    const result = import("../../src/ai/client.js").then((m) =>
      m.errorText(401, body),
    );
    return result.then((text) => {
      expect(text).toContain("Invalid key");
    });
  });
});
