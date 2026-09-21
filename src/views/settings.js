import { Store } from "../core/store.js";
import { CFG } from "../config/constants.js";
import * as AI from "../ai/index.js";
import { esc, fmtBytes } from "../utils/helpers.js";
import { isLoaded } from "../utils/cdn.js";
import { statBox, pageHead, bar } from "./shared.js";

export function settings() {
  const s = Store.db.settings;
  const st = AI.status();
  const usage = Store.usage();
  const libs = {
    pdf: isLoaded("pdf"),
    mammoth: isLoaded("mammoth"),
  };
  const usedPct = Math.round((usage.bytes / usage.cap) * 100);

  let h = pageHead(
    "Settings",
    "Connect an AI provider (Google Gemini or OpenRouter free models), set your available study hours, and manage your data.",
  );

  h += '<div class="grid g-2-1"><div class="grid gap-md">';

  /* AI provider */
  const provider = s.provider || "gemini";
  const provCfg = CFG.providers[provider] || CFG.providers.gemini;

  h +=
    '<div class="card"><div class="card-head"><h2>AI provider</h2><span class="spacer"></span>' +
    '<span class="badge ' +
    (st.on ? "ok" : "mute") +
    '">' +
    esc(st.on ? "connected: " + st.label : "offline mode") +
    "</span></div>";
  h +=
    '<div class="notice info mb"><div>Journey A.I works without an API key - the syllabus analyser, deadline extraction, task decomposition, retrieval and planner are all built in. Adding an AI key adds conversational explanations, smarter parsing and a written study plan.</div></div>';

  h += '<label class="fld"><span>Provider</span><select id="setProvider">';
  h +=
    '<option value="gemini"' +
    (provider === "gemini" ? " selected" : "") +
    ">Google Gemini</option>";
  h +=
    '<option value="openrouter"' +
    (provider === "openrouter" ? " selected" : "") +
    ">OpenRouter (free models)</option>";
  h += "</select></label>";

  if (provider === "openrouter") {
    h +=
      '<label class="fld"><span>OpenRouter model</span><select id="setModel">';
    CFG.openrouter.freeModels.forEach(function (m) {
      h +=
        '<option value="' +
        m.id +
        '"' +
        ((s.model || CFG.openrouter.model) === m.id ? " selected" : "") +
        ">" +
        esc(m.label) +
        "</option>";
    });
    h += "</select></label>";
  }

  h +=
    '<label class="fld"><span>' +
    provCfg.label +
    " API key" +
    (s.apiKey ? ' <span class="badge ok">stored in this browser</span>' : "") +
    "</span>" +
    '<input id="setKey" type="password" value="" autocomplete="off" spellcheck="false" placeholder="' +
    (s.apiKey
      ? "••••••••  - leave blank to keep the stored key"
      : provCfg.keyHint) +
    '"></label>' +
    '<p class="hint">Get a free key at <a href="' +
    provCfg.keyUrl +
    '" target="_blank" rel="noopener">' +
    provCfg.keyUrl.replace("https://", "") +
    "</a>.</p>";
  if (s.apiKey)
    h +=
      '<button class="btn sm ghost mb" data-act="ai-key-clear">Clear the stored key</button>';
  h +=
    '<label class="row small" style="gap:8px"><input type="checkbox" id="setAiEnabled"' +
    (s.aiEnabled ? " checked" : "") +
    "> Use the AI provider when a key is present</label>";
  h +=
    '<div class="row mt"><button class="btn primary" data-act="settings-save">Save</button>' +
    '<button class="btn" data-act="ai-test">Test connection</button>' +
    '<span id="aiTestMsg" class="small"></span></div>';
  h +=
    '<p class="hint">The key is kept in this browser session and sent directly from your browser to the provider. It never passes through any server of ours.</p>';
  h += "</div>";

  /* study preferences */
  h +=
    '<div class="card"><div class="card-head"><h2>Study preferences</h2></div>' +
    '<div class="grid g2">' +
    '<label class="fld"><span>Study hours on a weekday</span><input id="setWeekday" type="number" min="0" max="16" step="0.5" value="' +
    s.studyWeekday +
    '"></label>' +
    '<label class="fld"><span>Study hours on a weekend day</span><input id="setWeekend" type="number" min="0" max="16" step="0.5" value="' +
    s.studyWeekend +
    '"></label>' +
    "</div>" +
    '<div class="grid g3">' +
    '<label class="fld"><span>Default view</span><select id="setDefaultView">' +
    '<option value="dashboard"' +
    (s.defaultView === "dashboard" || s.defaultView === "student"
      ? " selected"
      : "") +
    ">Dashboard</option>" +
    "</select></label>" +
    '<label class="fld"><span>Planner horizon (weeks)</span><input id="setWeeks" type="number" min="1" max="20" value="' +
    s.plannerWeeks +
    '"></label>' +
    '<label class="fld"><span>Term starts</span><input id="setTermStart" type="date" value="' +
    esc(s.termStart || "") +
    '"></label>' +
    '<label class="fld"><span>Term ends</span><input id="setTermEnd" type="date" value="' +
    esc(s.termEnd || "") +
    '"></label>' +
    "</div>" +
    '<p class="hint">Term dates anchor week numbers and resolve dates on syllabi that omit the year.</p>' +
    '<button class="btn primary mt" data-act="settings-save">Save preferences</button></div>';

  /* data */
  h +=
    '<div class="card"><div class="card-head"><h2>Your data</h2></div>' +
    '<div class="grid g4 mb">' +
    statBox(Store.db.courses.length, "Courses") +
    statBox(Store.db.events.length, "Tasks") +
    statBox(Store.db.documents.length, "Documents") +
    statBox(Store.db.lessons.length, "Topics") +
    "</div>" +
    '<div class="row mb-s tiny muted"><span>Browser storage</span><span class="spacer"></span><span>' +
    usage.pretty +
    " of ~" +
    fmtBytes(usage.cap) +
    " (" +
    usedPct +
    "%)</span></div>" +
    bar(usedPct, usedPct > 80 ? "bad" : usedPct > 60 ? "warn" : "ok") +
    '<div class="row mt">' +
    '<button class="btn" data-act="data-export">Export everything (JSON)</button>' +
    '<button class="btn" data-act="data-import">Import a backup</button>' +
    '<button class="btn" data-act="demo-load">Import course file</button>' +
    '<button class="btn danger" data-act="data-reset">Reset all data</button>' +
    "</div>" +
    '<p class="hint">Everything lives in this browser. Export a JSON backup before clearing site data or switching devices.</p></div>';

  h += "</div>";

  /* right column */
  h += '<div class="grid gap-md">';
  h +=
    '<div class="card"><div class="card-head"><h3>Capability check</h3></div>' +
    '<div class="kv"><span class="k">PDF parsing (pdf.js)</span><span class="v">' +
    (libs.pdf
      ? '<span class="badge ok">ready</span>'
      : '<span class="badge info">on-demand</span>') +
    "</span></div>" +
    '<div class="kv"><span class="k">Word parsing (mammoth)</span><span class="v">' +
    (libs.mammoth
      ? '<span class="badge ok">ready</span>'
      : '<span class="badge info">on-demand</span>') +
    "</span></div>" +
    '<div class="kv"><span class="k">Retrieval index</span><span class="v">' +
    (Store.db.chunks || []).length +
    " passages</span></div>" +
    '<div class="kv"><span class="k">Offline capability</span><span class="v"><span class="badge ok">full</span></span></div>' +
    '<button class="btn block sm mt" data-act="reindex">Rebuild retrieval index</button></div>';

  h +=
    '<div class="card"><div class="card-head"><h3>Privacy</h3></div>' +
    '<p class="small muted">Documents are parsed in your browser and stored in this browser. They are only sent anywhere when you ask the assistant a question with an AI provider connected - then the retrieved passages (not the whole library) plus your question go to that provider. Without a key, nothing leaves the device at all.</p></div>';

  h +=
    '<div class="card"><div class="card-head"><h3>Danger zone</h3></div>' +
    '<p class="small muted">Resetting removes every course, task, document and chat message from this browser. Export a backup first if you want to keep it.</p>' +
    '<button class="btn danger block sm" data-act="data-reset">Reset everything</button></div>';
  h += "</div></div>";
  return h;
}

export function afterSettings(_root) {}

export const settingsView = {
  title: "Settings",
  fn: settings,
  after: afterSettings,
};
