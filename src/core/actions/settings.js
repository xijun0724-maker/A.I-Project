/**
 * Settings and AI test action handlers
 */

import { Store } from "../store.js";
import { UI } from "../state.js";
import { Router } from "../router.js";
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
  const s = Store.db.settings;
  provider = provider || "gemini";
  if (provider !== (s.provider || "gemini")) {
    s.model =
      provider === "openrouter"
        ? CFG.openrouter.model || "openrouter/free"
        : CFG.gemini.model;
  } else if (model) {
    s.model = model;
  }
  s.provider = provider;
  if (s.provider === "gemini") {
    s.model = AI.normalizeGeminiModel(s.model);
  }
  Store.saveNow();
  return s;
}

export function saveSettings() {
  const s = Store.db.settings;
  const keyInput = q("#setKey");
  const typedKey = keyInput && keyInput.value.trim();
  const providerSelect = q("#setProvider");
  const modelSelect = q("#setModel");

  if (providerSelect) {
    applyProviderModel(providerSelect.value || "gemini", modelSelect ? modelSelect.value : null);
  } else if (modelSelect) {
    s.model = modelSelect.value;
  }

  if (s.provider === "gemini") {
    s.model = AI.normalizeGeminiModel(s.model);
  }

  const provider = s.provider || "gemini";

  if (typedKey) {
    s.apiKey = typedKey;
    setApiKey(typedKey, provider);
  } else {
    const savedKey = getApiKey(provider);
    if (savedKey) {
      s.apiKey = savedKey;
    } else {
      s.apiKey = "";
      clearApiKey(provider);
    }
  }
  hydrateKey(s);

  /* Only fields that are actually on screen are written, so a save fired
     from a screen without these inputs cannot throw on a null lookup. */
  const aiToggle = q("#setAiEnabled");
  if (aiToggle) s.aiEnabled = aiToggle.checked;
  const hybridInput = q("#setHybridRAG");
  if (hybridInput) s.hybridRAG = hybridInput.checked;
  const standardSelect = q("#setSyllabusStandard");
  if (standardSelect) s.syllabusStandard = standardSelect.value;
  const weekdayInput = q("#setWeekday");
  if (weekdayInput) s.studyWeekday = parseFloat(weekdayInput.value) || 2;
  const weekendInput = q("#setWeekend");
  if (weekendInput) s.studyWeekend = parseFloat(weekendInput.value) || 4;
  const weeksInput = q("#setWeeks");
  if (weeksInput) s.plannerWeeks = parseInt(weeksInput.value, 10) || 6;
  const defaultViewInput = q("#setDefaultView");
  if (defaultViewInput) s.defaultView = defaultViewInput.value || "dashboard";
  const termStartInput = q("#setTermStart");
  if (termStartInput) s.termStart = termStartInput.value || s.termStart;
  const termEndInput = q("#setTermEnd");
  if (termEndInput) s.termEnd = termEndInput.value || s.termEnd;
  const academicYearInput = q("#setAcademicYear");
  if (academicYearInput) s.academicYear = academicYearInput.value || s.academicYear;
  const termNameInput = q("#setTermName");
  if (termNameInput) s.termName = termNameInput.value || s.termName;

  Store.saveNow();
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
  const provider = Store.db.settings.provider || "gemini";
  Store.db.settings.apiKey = "";
  clearApiKey(provider);
  Store.saveNow();
  Router.scheduleRender();
  toast("API key cleared.", "ok");
}
