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

export async function saveSettings() {
  const s = Store.db.settings;
  const keyInput = q("#setKey");
  const typedKey = keyInput && keyInput.value.trim();
  const providerSelect = q("#setProvider");
  const modelSelect = q("#setModel");
  const previousProvider = s.provider || "gemini";

  if (providerSelect) {
    const newProvider = providerSelect.value || "gemini";
    if (newProvider !== previousProvider) {
      s.model =
        newProvider === "openrouter"
          ? CFG.openrouter.model || "openrouter/free"
          : CFG.gemini.model;
    }
    s.provider = newProvider;
  }
  if (modelSelect) {
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

  s.aiEnabled = q("#setAiEnabled").checked;
  s.studyWeekday = parseFloat(q("#setWeekday").value) || 2;
  s.studyWeekend = parseFloat(q("#setWeekend").value) || 4;
  s.plannerWeeks = parseInt(q("#setWeeks").value, 10) || 6;
  s.defaultView = q("#setDefaultView").value || "dashboard";
  s.termStart = q("#setTermStart").value || s.termStart;
  s.termEnd = q("#setTermEnd").value || s.termEnd;

  Store.saveNow();
  UI.toastSaved("Settings saved.");
}

export function testAI() {
  const msg = q("#aiTestMsg");
  if (msg) msg.textContent = "Testing...";
  saveSettings()
    .then(() => AI.test())
    .then((result) => {
      const ok = !!result && result.ok;
      const detail =
        result && result.message ? result.message : "Connection failed.";
      if (msg) msg.textContent = detail;
      toast(ok ? "AI connected." : detail, ok ? "ok" : "bad");
    })
    .catch((e) => {
      const detail = e && e.message ? e.message : "Connection failed.";
      if (msg) msg.textContent = detail;
      toast(detail, "bad");
    });
}

export function clearApiKeyFn() {
  const provider = Store.db.settings.provider || "gemini";
  Store.db.settings.apiKey = "";
  clearApiKey(provider);
  Store.saveNow();
  Router.scheduleRender();
  toast("API key cleared.", "ok");
}
