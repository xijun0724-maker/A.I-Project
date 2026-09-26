/**
 * AI API client — connection, settings, and low-level chat.
 */

import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import { getApiKey, keyStatus } from "../utils/secure.js";

export function settings() {
  return Store.db.settings;
}

export function usable() {
  const s = settings();
  const key = getApiKey(s.provider || "gemini");
  return !!(s.aiEnabled && key && key.length > 10);
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
  const provider = s.provider || "gemini";
  const key = getApiKey(provider);
  if (!s.aiEnabled)
    return {
      on: false,
      label: "Offline mode",
      why: "AI is switched off in Settings.",
    };
  if (!key) {
    const ks = keyStatus(provider);
    if (ks && ks.expired) {
      return {
        on: false,
        label: "Offline mode",
        why: "Your saved API key expired after 30 days without use — paste it again in Settings.",
      };
    }
    return {
      on: false,
      label: "Offline mode",
      why: "No API key configured - running on the built-in analyser.",
    };
  }
  if (key.length <= 10)
    return {
      on: false,
      label: "Offline mode",
      why: "API key looks invalid - check the key in Settings.",
    };
  const model =
    provider === "openrouter"
      ? s.model || CFG.openrouter.model
      : normalizeGeminiModel(s.model);
  const label = provider === "openrouter" ? "OpenRouter" : "Google Gemini";
  return { on: true, label: model + " (" + label + ")", why: label };
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

export function messageChars(messages) {
  let total = 0;
  const list = Array.isArray(messages) ? messages : [];
  for (const m of list) {
    const content =
      typeof (m && m.content) === "string"
        ? m.content
        : JSON.stringify((m && m.content) || "");
    total += content.length + 16;
  }
  return total;
}

/**
 * Marker the agent uses to return tool output. Defined once so the truncation
 * pairing below and the agent loop cannot drift apart.
 */
export const TOOL_RESULT_PREFIX = "TOOL_RESULT ";

/** A tool result: the agent's answer to a request the model made. */
export function isToolResult(m) {
  return !!(
    m &&
    m.role !== "system" &&
    typeof m.content === "string" &&
    m.content.indexOf(TOOL_RESULT_PREFIX) === 0
  );
}

/** An assistant turn that asked for a tool. */
export function isToolRequest(m) {
  return !!(
    m &&
    m.role === "assistant" &&
    typeof m.content === "string" &&
    /"tool"\s*:/.test(m.content)
  );
}

/**
 * Group messages into atomic units: a tool result always travels with the
 * request it answers.
 *
 * Dropping one half of a tool exchange is how a capped context turns into a
 * tool-call loop - the model sees a result it never asked for and re-asks, or
 * waits forever for an answer that was truncated away. A result with no
 * request in front of it is an orphan and is dropped rather than sent alone.
 */
function groupUnits(list) {
  const units = [];
  for (const m of list) {
    if (isToolResult(m)) {
      const prev = units[units.length - 1];
      if (prev && prev.messages.length === 1 && isToolRequest(prev.messages[0])) {
        prev.messages.push(m);
        prev.chars += messageChars([m]);
        prev.pair = true;
      }
      /* No request to answer: drop it instead of sending half an exchange. */
      continue;
    }
    units.push({ messages: [m], chars: messageChars([m]), pair: false });
  }
  return units;
}

/**
 * Enforce a character budget on an outbound chat payload.
 * Keeps the system prompt and the final (user) message, then back-fills
 * as much recent history as fits under maxChars - whole tool exchanges at a
 * time, so a TOOL_RESULT can never be orphaned.
 */
export function checkTokenBudget(messages, opts) {
  opts = opts || {};
  const maxChars = opts.maxChars != null ? opts.maxChars : CFG.maxChatChars;
  const list = Array.isArray(messages) ? messages.slice() : [];
  const chars = messageChars(list);
  if (chars <= maxChars) {
    return {
      ok: true,
      chars,
      maxChars,
      truncated: false,
      dropped: 0,
      messages: list,
    };
  }

  const units = groupUnits(list);
  const system = units.filter(function (u) {
    return u.messages[0].role === "system";
  });
  const rest = units.filter(function (u) {
    return u.messages[0].role !== "system";
  });
  const tail = rest.length ? [rest[rest.length - 1]] : [];
  const middle = rest.slice(0, Math.max(0, rest.length - 1));

  const flatten = function (group) {
    const out = [];
    group.forEach(function (u) {
      u.messages.forEach(function (m) {
        out.push(m);
      });
    });
    return out;
  };

  const picked = [];
  let used = messageChars(flatten(system)) + messageChars(flatten(tail));
  for (let i = middle.length - 1; i >= 0; i--) {
    if (used + middle[i].chars > maxChars) continue;
    picked.unshift(middle[i]);
    used += middle[i].chars;
  }

  const out = flatten(system.concat(picked, tail));
  return {
    ok: false,
    chars: messageChars(out),
    maxChars,
    truncated: true,
    dropped: list.length - out.length,
    messages: out,
  };
}

export function recordUsage(result, budget) {
  if (!result || typeof result !== "object") return result;
  const b = budget || {};
  result.usage = {
    promptChars: b.chars != null ? b.chars : 0,
    completionChars: typeof result.text === "string" ? result.text.length : 0,
    truncated: !!b.truncated,
    droppedMessages: b.dropped || 0,
  };
  return result;
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

  // Default: Gemini — use Authorization header, not query string
  const { systemInstruction, contents } = messagesToContents(messages);
  const genConfig = {
    temperature: opts.temperature == null ? 0.25 : opts.temperature,
  };
  if (opts.maxTokens) genConfig.maxOutputTokens = opts.maxTokens;
  const model = normalizeGeminiModel(s.model);
  const url = CFG.gemini.baseUrl.replace("{model}", model);
  const body = { contents, generationConfig: genConfig };
  if (systemInstruction)
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  return {
    url,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.apiKey}`,
      },
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

function chatWithRetry(
  messages,
  opts,
  s,
  retryCount,
  maxRetries,
  baseDelay,
  deadline,
) {
  const effectiveDeadline =
    deadline != null
      ? deadline
      : Date.now() + (opts.timeout || CFG.timeouts.apiDefault);
  const remaining = effectiveDeadline - Date.now();
  if (remaining <= 0) {
    return Promise.resolve({
      ok: false,
      error: "The request ran out of time before it was sent.",
      timedOut: true,
      retryable: false,
    });
  }

  const req = buildProviderRequest(messages, opts, s);
  const timeout = Math.min(opts.timeout || CFG.timeouts.apiDefault, remaining);
  const callerSignal = opts.signal || null;

  /* A caller (the agent loop, a Stop button) can cancel this request. A
     cancel is terminal - it must never be retried, unlike our own timeout. */
  if (callerSignal && callerSignal.aborted) {
    return Promise.resolve({
      ok: false,
      error: "Cancelled.",
      cancelled: true,
      retryable: false,
    });
  }

  const ctrl =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer = null;
  let timedOut = false;
  if (ctrl)
    timer = setTimeout(() => {
      timedOut = true;
      try {
        ctrl.abort();
      } catch (_e) {}
    }, timeout);

  const onCallerAbort = () => {
    if (ctrl) ctrl.abort();
  };
  if (callerSignal && ctrl) callerSignal.addEventListener("abort", onCallerAbort);

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    if (callerSignal && ctrl && callerSignal.removeEventListener) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  };

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
          const retryAfter =
            res.headers && res.headers.get ? res.headers.get("retry-after") : null;
          if (retryAfter) {
            const sec = parseFloat(retryAfter);
            if (!Number.isNaN(sec)) err.retryAfter = sec;
          }
          throw err;
        });
      }
      return res.json();
    })
    .then((data) => {
      cleanup();
      return req.extractText(data);
    })
    .catch((e) => {
      cleanup();
      const aborted = e && e.name === "AbortError";
      const status = e && e.status ? e.status : 0;

      /* Aborted by the caller rather than by our own timer: report it as a
         cancel so nothing retries and no offline answer is substituted. */
      if (aborted && !timedOut) {
        return {
          ok: false,
          error: "Cancelled.",
          cancelled: true,
          retryable: false,
        };
      }

      const retriable = aborted || status === 429 || status === 503;
      const minWindow = CFG.timeouts.minUsefulWindow || 4000;
      const maxRetryAfter = CFG.timeouts.maxRetryAfterMs || 5000;

      let delay =
        baseDelay * Math.pow(2, retryCount) + Math.random() * 500 + (status === 503 ? 2000 : 0);
      if (e && e.retryAfter) {
        delay = Math.min(e.retryAfter * 1000, maxRetryAfter);
      }

      /* Never start an attempt the deadline cannot cover, and never retry a cancel. */
      const canAfford = effectiveDeadline - Date.now() - delay > minWindow;

      if (retriable && retryCount < maxRetries && canAfford) {
        return sleep(delay).then(() =>
          chatWithRetry(
            messages,
            opts,
            s,
            retryCount + 1,
            maxRetries,
            baseDelay,
            effectiveDeadline,
          ),
        );
      }
      const msg = timedOut
        ? "The request timed out after " + Math.round(timeout / 1000) + "s."
        : formatError(e, req.label);
      return { ok: false, error: msg, retryable: retriable, timedOut: timedOut };
    });
}

export async function chat(messages, opts = {}) {
  opts = opts || {};
  const maxRetries = opts.retries != null ? opts.retries : 3;
  const baseDelay = opts.retryDelay || 2000;

  /* Honour a cancel that landed before this call even started. */
  if (opts.signal && opts.signal.aborted) {
    return {
      ok: false,
      error: "Cancelled.",
      cancelled: true,
      retryable: false,
    };
  }

  const budget = checkTokenBudget(messages, {
    maxChars: opts.maxChars != null ? opts.maxChars : CFG.maxChatChars,
  });
  const safeMessages = budget.messages;

  if (
    messageChars(budget.messages) >
      budget.maxChars + (CFG.maxChatChars || 20000) * 0.1 ||
    messageChars(messages) >
      (opts.maxChars != null ? opts.maxChars : CFG.maxChatChars) +
        (CFG.maxChatChars || 20000) * 0.1
  ) {
    return {
      ok: false,
      off: true,
      error:
        "That question is too long for one request — trim the message or narrow it to one document.",
    };
  }

  const deadline =
    opts.deadline != null
      ? opts.deadline
      : Date.now() + (opts.timeout || CFG.timeouts.apiDefault);

  async function attempt(retryCount) {
    const s = settings();
    const key = getApiKey(s.provider || "gemini");
    if (!s.aiEnabled)
      return {
        ok: false,
        error: "AI is switched off in Settings.",
        off: true,
      };
    if (!key)
      return {
        ok: false,
        error: "No API key configured.",
        off: true,
      };
    if (key.length <= 10)
      return {
        ok: false,
        error: "API key looks invalid.",
        off: true,
      };
    s.apiKey = key;
    return chatWithRetry(
      safeMessages,
      opts,
      s,
      retryCount,
      maxRetries,
      baseDelay,
      deadline,
    );
  }

  return attempt(0).then((r) => {
    if (r && r.ok) recordUsage(r, budget);
    return r;
  });
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
