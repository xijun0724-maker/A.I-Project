/**
 * Settings and AI test action handlers
 */

import { Store } from "../store.js";
import { UI } from "../state.js";
import { CFG } from "../../config/constants.js";
import { q, toast } from "../../utils/dom.js";
import * as AI from "../../ai/index.js";
import {
  setApiKey,
  clearApiKey,
  getApiKey,
  hydrateKey,
} from "../../utils/secure.js";

export function applyProviderModel(provider, model) {
  const s = Store.settings.get();
  provider = provider || "gemini";
  let targetModel = s.model;
  if (provider !== (s.provider || "gemini")) {
    targetModel =
      provider === "openrouter"
        ? CFG.openrouter.model || "openrouter/free"
        : CFG.gemini.model;
  } else if (model) {
    targetModel = model;
  }
  if (provider === "gemini") {
    targetModel = AI.normalizeGeminiModel(targetModel);
  }
  return Store.settings.update({ provider, model: targetModel });
}

export function saveSettings() {
  const s = Store.settings.get();
  const patch = {};
  const keyInput = q("#setKey");
  const typedKey = keyInput && keyInput.value.trim();
  const providerSelect = q("#setProvider");
  const modelSelect = q("#setModel");

  if (providerSelect) {
    applyProviderModel(providerSelect.value || "gemini", modelSelect ? modelSelect.value : null);
  } else if (modelSelect) {
    patch.model = modelSelect.value;
  }

  const currentSettings = Store.settings.get();
  const provider = currentSettings.provider || "gemini";

  if (currentSettings.provider === "gemini" && patch.model) {
    patch.model = AI.normalizeGeminiModel(patch.model);
  }

  if (typedKey) {
    patch.apiKey = typedKey;
    setApiKey(typedKey, provider);
  } else {
    const savedKey = getApiKey(provider);
    if (savedKey) {
      patch.apiKey = savedKey;
    } else {
      patch.apiKey = "";
      clearApiKey(provider);
    }
  }

  /* Only fields that are actually on screen are written, so a save fired
     from a screen without these inputs cannot throw on a null lookup. */
  const aiToggle = q("#setAiEnabled");
  if (aiToggle) patch.aiEnabled = aiToggle.checked;
  const hybridInput = q("#setHybridRAG");
  if (hybridInput) patch.hybridRAG = hybridInput.checked;
  const standardSelect = q("#setSyllabusStandard");
  if (standardSelect) patch.syllabusStandard = standardSelect.value;
  const weekdayInput = q("#setWeekday");
  if (weekdayInput) patch.studyWeekday = parseFloat(weekdayInput.value) || 2;
  const weekendInput = q("#setWeekend");
  if (weekendInput) patch.studyWeekend = parseFloat(weekendInput.value) || 4;
  const weeksInput = q("#setWeeks");
  if (weeksInput) patch.plannerWeeks = parseInt(weeksInput.value, 10) || 6;
  const defaultViewInput = q("#setDefaultView");
  if (defaultViewInput) patch.defaultView = defaultViewInput.value || "dashboard";
  const termStartInput = q("#setTermStart");
  if (termStartInput) patch.termStart = termStartInput.value || s.termStart;
  const termEndInput = q("#setTermEnd");
  if (termEndInput) patch.termEnd = termEndInput.value || s.termEnd;
  const academicYearInput = q("#setAcademicYear");
  if (academicYearInput) patch.academicYear = academicYearInput.value || s.academicYear;
  const termNameInput = q("#setTermName");
  if (termNameInput) patch.termName = termNameInput.value || s.termName;

  const updated = Store.settings.update(patch);
  hydrateKey(updated);
  UI.toastSaved("Settings saved.");
}

/**
 * Save the settings form, then probe the configured provider.
 * saveSettings() is synchronous — it must not be chained as a promise.
 * Always resolves, so a failed probe never leaves the UI stuck on "Testing".
 */
export async function testAI() {
  const msg = q("#aiTestMsg");
  if (msg) msg.textContent = "Testing...";
  try {
    saveSettings();
    const result = await AI.test();
    const ok = !!(result && result.ok);
    const detail = (result && result.message) || "Connection failed.";
    if (msg) msg.textContent = detail;
    toast(ok ? "AI connected." : detail, ok ? "ok" : "bad");
    return result;
  } catch (e) {
    const detail = (e && e.message) || "Connection failed.";
    if (msg) msg.textContent = detail;
    toast(detail, "bad");
    return { ok: false, message: detail };
  }
}

export function clearApiKeyFn() {
  const provider = Store.settings.get().provider || "gemini";
  clearApiKey(provider);
  Store.settings.update({ apiKey: "" });
  toast("API key cleared.", "ok");
}
