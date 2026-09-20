/**
 * AI module — orchestrates client, prompts, offline fallbacks, and snapshot.
 */

import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import { RAG } from "../domain/rag.js";
import { Tasks } from "../domain/tasks.js";
import { Coach } from "../domain/coach.js";
import { Dashboard } from "../domain/dashboard.js";
import { NLP } from "../domain/nlp.js";
import {
  chat,
  usable,
  status,
  applyPreset,
  parseJson,
  test,
  errorText,
} from "./client.js";
import { prompts } from "./prompts.js";
import { offlineAnswer, offlineStudyPlan } from "./offline.js";
import { snapshot } from "./snapshot.js";

export {
  settings,
  usable,
  status,
  applyPreset,
  normalizeGeminiModel,
  chat,
  parseJson,
  test,
  errorText,
} from "./client.js";
export { prompts } from "./prompts.js";
export { offlineAnswer, offlineStudyPlan } from "./offline.js";
export { snapshot } from "./snapshot.js";

export function answer(question, opts) {
  opts = opts || {};
  const k = opts.k || 5;
  const chatHistory = opts.chatHistory || [];

  let ragQuery = question;
  if (question.split(/\s+/).length <= 6 && chatHistory.length > 0) {
    const keywords = NLP.extractKeywords(question);
    if (keywords) ragQuery = keywords + " " + question;
  }

  const ctx = RAG.context(ragQuery, { k, docIds: opts.docIds });

  if (!usable()) {
    const text = offlineAnswer(question, ctx, { db: Store.db }, RAG);
    return Promise.resolve({ text, mode: "offline", sources: ctx.sources });
  }

  const messages = prompts.tutor(question, ctx, null, chatHistory);
  return chat(messages, {
    timeout: CFG.timeouts.apiAnswer,
    maxTokens: 1024,
  }).then((r) => {
    if (r.ok)
      return { text: r.text, mode: "ai", model: r.model, sources: ctx.sources };
    const text = offlineAnswer(question, ctx, { db: Store.db }, RAG);
    return { text, mode: "offline", sources: ctx.sources, aiError: r.error };
  });
}

export function studyPlan() {
  const snap = snapshot(Tasks, Coach, Dashboard);

  if (!usable()) {
    return Promise.resolve({ text: offlineStudyPlan(snap), mode: "offline" });
  }

  const messages = prompts.recommend(snap);
  return chat(messages, { timeout: CFG.timeouts.apiRefine }).then((r) => {
    if (r.ok) return { text: r.text, mode: "ai", model: r.model };
    return { text: offlineStudyPlan(snap), mode: "offline", aiError: r.error };
  });
}

export const AI = {
  settings: () => Store.db.settings,
  usable,
  status,
  applyPreset,
  errorText,
  chat,
  parseJson,
  test,
  prompts,
  offlineAnswer,
  snapshot,
  answer,
  studyPlan,
};

export default AI;
