import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import {
  handleStorageEvent,
  handleBroadcastMessage,
  resetStorageWarn,
} from "../../src/app/lifecycle.js";
import { CFG } from "../../src/config/constants.js";
import { Store } from "../../src/core/store.js";

vi.mock("../../src/utils/dom.js", () => ({
  toast: vi.fn(),
}));

import { toast } from "../../src/utils/dom.js";

beforeEach(() => {
  Store.resetAll();
  resetStorageWarn();
  toast.mockClear();
});

afterEach(() => {
  resetStorageWarn();
});

function fire(key, newValue) {
  handleStorageEvent({ key, newValue });
}

describe("multi-tab storage events", () => {
  it("ignores unrelated keys", () => {
    fire("journeyai.theme", '"light"');
    expect(toast).not.toHaveBeenCalled();
  });

  it("ignores null key (storage cleared entirely for another app)", () => {
    fire(null, "{}");
    expect(toast).not.toHaveBeenCalled();
  });

  it("warns once when another tab clears the database", () => {
    fire(CFG.storageKey, null);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatch(/cleared/i);
    fire(CFG.storageKey, null);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("warns when another tab writes different bytes", () => {
    const other = JSON.stringify({ version: CFG.schemaVersion, settings: {} });
    fire(CFG.storageKey, other);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatch(/another tab/i);
  });

  it("stays silent when the event bytes already match local storage", () => {
    const payload = JSON.stringify({ version: CFG.schemaVersion, settings: {} });
    localStorage.setItem(CFG.storageKey, payload);
    fire(CFG.storageKey, payload);
    expect(toast).not.toHaveBeenCalled();
  });

  it("only warns once per session even for mixed clear/write events", () => {
    fire(CFG.storageKey, null);
    resetStorageWarn();
    fire(CFG.storageKey, '{"a":1}');
    expect(toast).toHaveBeenCalledTimes(2);
    fire(CFG.storageKey, '{"a":2}');
    expect(toast).toHaveBeenCalledTimes(2);
  });
});

describe("BroadcastChannel save notices", () => {
  it("ignores messages for other keys", () => {
    handleBroadcastMessage({ key: "other", rev: 99 }, 0);
    expect(toast).not.toHaveBeenCalled();
  });

  it("stays silent when the remote revision is not ahead", () => {
    handleBroadcastMessage({ key: CFG.storageKey, rev: 1 }, 1);
    handleBroadcastMessage({ key: CFG.storageKey, rev: 0 }, 5);
    expect(toast).not.toHaveBeenCalled();
  });

  it("warns once when another tab posts a higher revision", () => {
    handleBroadcastMessage({ key: CFG.storageKey, rev: 3 }, 1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatch(/another tab/i);
    handleBroadcastMessage({ key: CFG.storageKey, rev: 4 }, 1);
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
