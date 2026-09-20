/**
 * AI API client — connection, settings, and low-level chat.
 */

import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";

export function settings() {
  return Store.db.settings;
}

export function usable() {
  const s = settings();
  return !!(s.aiEnabled && s.apiKey && s.apiKey.length > 10);
}

export function normalizeGeminiModel(model) {
  const raw = String(model || "").trim();
  if (!raw) return CFG.gemini.model;
  const cleaned = raw
    .replace(/^models\//, "")
    .replace(/\/generateContent$/, "")
    .trim();
  if (!cleaned) return CFG.gemini.model;

  const aliases = new Set([
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-2.5-pro",
  ]);

  return aliases.has(cleaned) ? CFG.gemini.model : cleaned;
}

export function status() {
  const s = settings();
  if (!s.aiEnabled)
    return {
      on: false,
      label: "Offline mode",
      why: "AI is switched off in Settings.",
    };
  if (!s.apiKey)
    return {
      on: false,
      label: "Offline mode",
      why: "No API key configured - running on the built-in analyser.",
    };
  if (s.apiKey.length <= 10)
    return {
      on: false,
      label: "Offline mode",
      why: "API key looks invalid - check the key in Settings.",
    };
  const provider = s.provider || "gemini";
  const model =
    provider === "openrouter"
      ? s.model || CFG.openrouter.model
      : normalizeGeminiModel(s.model);
  const label = provider === "openrouter" ? "OpenRouter" : "Google Gemini";
  return { on: true, label: model + " (" + label + ")", why: label };
}

export function applyPreset() {
  const s = settings();
  const provider = s.provider || "gemini";
  if (provider === "openrouter") {
    s.baseUrl = CFG.openrouter.baseUrl;
    s.model = s.model || CFG.openrouter.model;
  } else {
    s.provider = "gemini";
    s.baseUrl = CFG.gemini.baseUrl;
    s.model = normalizeGeminiModel(s.model || CFG.gemini.model);
  }
}

function messagesToContents(messages) {
  const contents = [];
  let systemInstruction = null;
  for (const m of messages) {
    if (m.role === "system") {
      systemInstruction =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    } else {
      const role = m.role === "assistant" ? "model" : "user";
      const text =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      contents.push({ role, parts: [{ text }] });
    }
  }
  return { systemInstruction, contents };
}

function messagesToOpenAI(messages) {
  const systemMsgs = [];
  const chatMsgs = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemMsgs.push({
        role: "system",
        content:
          typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      });
    } else {
      chatMsgs.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content:
          typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      });
    }
  }
  return [...systemMsgs, ...chatMsgs];
}

function formatError(e, providerLabel) {
  if (!e) return "Unknown error.";
  const msg = e.message || String(e);
  if (/API key/i.test(msg) || /401|403/.test(msg))
    return "The API key was rejected. Check the key in Settings.";
  if (/quota|429/i.test(msg))
    return "Rate limited or out of quota. Wait a moment or check your plan.";
  if (/503|overload|high demand|UNAVAILABLE/i.test(msg))
    return "The AI service is temporarily overloaded. Please try again in a few seconds.";
  if (/timeout|abort/i.test(msg))
    return "The request timed out. Try again or shorten your message.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return (
      (providerLabel || "AI provider") +
      " request was blocked before a response arrived. Check your connection, browser extensions, or API access restrictions."
    );
  return msg;
}

export function parseJson(text) {
  const s = String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = s.indexOf("{"),
    end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  const slice = s.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (_e) {}
  try {
    return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"'));
  } catch (_e) {}
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildProviderRequest(messages, opts, s) {
  const provider = s.provider || "gemini";

  if (provider === "openrouter") {
    const openaiMsgs = messagesToOpenAI(messages);
    const body = {
      model: s.model || CFG.openrouter.model,
      messages: openaiMsgs,
      temperature: opts.temperature == null ? 0.25 : opts.temperature,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    return {
      url: CFG.openrouter.baseUrl,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + s.apiKey,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Journey A.I",
        },
        body: JSON.stringify(body),
      },
      extractText: (data) => {
        const text =
          (data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content) ||
          "";
        const model = data.model || body.model;
        return text
          ? { ok: true, text: text.trim(), model }
          : { ok: false, error: "The provider returned an empty completion." };
      },
      label: "OpenRouter",
    };
  }

  // Default: Gemini
  const { systemInstruction, contents } = messagesToContents(messages);
  const genConfig = {
    temperature: opts.temperature == null ? 0.25 : opts.temperature,
  };
  if (opts.maxTokens) genConfig.maxOutputTokens = opts.maxTokens;
  const model = normalizeGeminiModel(s.model);
  const url =
    CFG.gemini.baseUrl.replace("{model}", model) +
    "?key=" +
    encodeURIComponent(s.apiKey);
  const body = { contents, generationConfig: genConfig };
  if (systemInstruction)
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  return {
    url,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    extractText: (data) => {
      const text =
        (data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts.map((p) => p.text || "").join("")) ||
        "";
      return text
        ? { ok: true, text: text.trim(), model }
        : { ok: false, error: "The provider returned an empty completion." };
    },
    label: "Google Gemini",
  };
}

function chatWithRetry(messages, opts, s, retryCount, maxRetries, baseDelay) {
  const req = buildProviderRequest(messages, opts, s);
  const timeout = opts.timeout || CFG.timeouts.apiDefault;

  const ctrl =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer = null;
  if (ctrl)
    timer = setTimeout(() => {
      try {
        ctrl.abort();
      } catch (_e) {}
    }, timeout);

  return fetch(req.url, { ...req.init, signal: ctrl ? ctrl.signal : undefined })
    .then((res) => {
      if (!res.ok) {
        return res.text().then((t) => {
          let detail = "";
          try {
            const j = JSON.parse(t);
            detail = j.error && j.error.message ? j.error.message : "";
          } catch (_e) {
            detail = t.slice(0, 200);
          }
          const err = new Error(
            detail || req.label + " returned " + res.status,
          );
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    })
    .then((data) => {
      if (timer) clearTimeout(timer);
      return req.extractText(data);
    })
    .catch((e) => {
      if (timer) clearTimeout(timer);
      const aborted = e && e.name === "AbortError";
      const status = e && e.status ? e.status : 0;
      const retriable = aborted || status === 429 || status === 503;
      if (retriable && retryCount < maxRetries) {
        const extra = status === 503 ? 2000 : 0;
        const delay =
          baseDelay * Math.pow(2, retryCount) + Math.random() * 500 + extra;
        return sleep(delay).then(() =>
          chatWithRetry(
            messages,
            opts,
            s,
            retryCount + 1,
            maxRetries,
            baseDelay,
          ),
        );
      }
      const msg = aborted
        ? "The request timed out after " + Math.round(timeout / 1000) + "s."
        : formatError(e, req.label);
      return { ok: false, error: msg, retryable: retriable };
    });
}

export function chat(messages, opts = {}) {
  opts = opts || {};
  const maxRetries = opts.retries != null ? opts.retries : 3;
  const baseDelay = opts.retryDelay || 2000;

  function attempt(retryCount) {
    const s = settings();
    if (!s.aiEnabled)
      return Promise.resolve({
        ok: false,
        error: "AI is switched off in Settings.",
        off: true,
      });
    if (!s.apiKey)
      return Promise.resolve({
        ok: false,
        error: "No API key configured.",
        off: true,
      });
    if (s.apiKey.length <= 10)
      return Promise.resolve({
        ok: false,
        error: "API key looks invalid.",
        off: true,
      });
    return chatWithRetry(messages, opts, s, retryCount, maxRetries, baseDelay);
  }

  return attempt(0);
}

export function test() {
  return chat(
    [{ role: "user", content: "Reply with the single word: ready" }],
    {
      temperature: 0,
      timeout: CFG.timeouts.apiTest,
    },
  ).then((r) => {
    if (r.ok)
      return {
        ok: true,
        message:
          "Connected to " +
          (r.model || settings().model) +
          ' \u2014 replied "' +
          r.text.slice(0, 40) +
          '".',
      };
    return { ok: false, message: r.error };
  });
}

export function errorText(_status, body) {
  let detail = "";
  try {
    const j = JSON.parse(body);
    detail = (j.error && (j.error.message || j.error.type)) || j.message || "";
  } catch (_e) {
    detail = String(body || "").slice(0, 200);
  }
  return "The AI provider returned an error." + (detail ? " " + detail : "");
}
