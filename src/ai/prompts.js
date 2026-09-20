/**
 * AI prompt builders — structured system/user message pairs.
 */

import { CFG } from "../config/constants.js";
import { fmtDate } from "../utils/date.js";

export const prompts = {};

prompts.parse = function (text, name) {
  return [
    {
      role: "system",
      content: [
        "You are an academic planning parser. You read course syllabi, assignment briefs and lecture notes and return strict JSON.",
        "Extract only what the document actually states. Never invent deadlines, weightings or readings that are not present.",
        'Resolve relative dates ("Week 3", "next Friday") against the term start when it is stated; otherwise set isRelative to true and leave due null.',
        "Return a single JSON object with this exact shape:",
        "{",
        '  "course": { "code": string|null, "title": string|null, "instructor": string|null, "term": string|null, "schedule": string|null, "room": string|null },',
        '  "lessons": [ { "week": number, "topic": string, "start": "YYYY-MM-DD"|null } ],',
        '  "events": [ { "title": string, "type": "exam"|"quiz"|"assignment"|"project"|"presentation"|"lab"|"reading"|"other", "due": "YYYY-MM-DDTHH:MM"|null, "weight": number|null, "points": number|null, "week": number|null, "confidence": number } ],',
        '  "readings": [ { "title": string, "source": string|null, "week": number|null, "pages": string|null, "optional": boolean } ]',
        "}",
        'Use "weight" only for a percentage of the final grade. Use "points" only for a point value. Omit empty arrays rather than inventing entries.',
      ].join("\n"),
    },
    {
      role: "user",
      content:
        "Document name: " +
        (name || "document") +
        "\n\nDocument text:\n" +
        text,
    },
  ];
};

prompts.decompose = function (event, courseName) {
  return [
    {
      role: "system",
      content: [
        "You break academic assignments into concrete, ordered subtasks a student can tick off.",
        'Return strict JSON: { "subtasks": [ { "title": string, "minutes": number } ] }',
        "Give 4-7 subtasks. Each must be a single action starting with a verb. Estimate minutes of focused work realistically for a university student.",
        "The final subtask must be the submission or delivery step.",
      ].join("\n"),
    },
    {
      role: "user",
      content:
        "Course: " +
        (courseName || "unknown") +
        "\nTask: " +
        event.title +
        "\nType: " +
        event.type +
        "\nDeadline: " +
        (event.due ? fmtDate(event.due, true) : "not stated") +
        (event.weight != null
          ? "\nWeight: " + event.weight + "% of the final grade"
          : "") +
        (event.notes ? "\nNotes: " + event.notes : ""),
    },
  ];
};

prompts.tutor = function (question, ctx, courseName, chatHistory) {
  const sys = [
    "You are Journey A.I, a friendly and encouraging academic study tutor for a university student.",
    "Answer using the numbered reference passages provided when they are relevant. Cite the passage you used inline as [1], [2] and so on.",
    "If the passages do not contain the answer, say so plainly and suggest what the student should look up or ask their instructor. Never fabricate a citation.",
    "Build explanations step by step: define jargon in plain language, use a short worked example where it helps, and finish with a two-line recap.",
    "Use markdown headings, bullet points and short paragraphs. Keep the whole answer under 350 words unless the student asks for depth.",
    'You have memory of the conversation so far. When the student asks a follow-up like "explain more", "what about X", or "can you give an example", refer back to what was discussed earlier.',
    "If the question is vague or could refer to multiple topics, ask a brief clarifying question before answering.",
    "Be warm and supportive - academic topics can be stressful. Acknowledge effort and progress.",
  ];
  if (courseName)
    sys.push("The student is asking in the context of: " + courseName + ".");
  const messages = [{ role: "system", content: sys.join("\n") }];

  if (chatHistory && chatHistory.length) {
    const maxChars = CFG.maxHistoryChars || 8000;
    const limit = CFG.maxChatHistory || 20;
    const recent = chatHistory
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-limit);
    const picked = [];
    let charCount = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      const text = recent[i].content || "";
      if (charCount + text.length > maxChars) break;
      charCount += text.length;
      picked.unshift(recent[i]);
    }
    for (const m of picked) {
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }
  }

  const user = ctx.contextText
    ? "Reference passages from the student's own course materials:\n\n" +
      ctx.contextText +
      "\n\n---\n\nQuestion: " +
      question
    : "No reference passages were found in the student's uploaded materials for this question. Tell them that, then give general guidance and say clearly that it is not drawn from their course materials.\n\nQuestion: " +
      question;
  messages.push({ role: "user", content: user });
  return messages;
};

prompts.recommend = function (state) {
  return [
    {
      role: "system",
      content: [
        "You are an academic coach. Given a structured snapshot of a student's term, write a short, specific action plan.",
        'Return markdown with exactly these sections: "## This week", "## Start now", "## Watch out for", "## Study method".',
        "Be concrete: name the actual tasks, subjects and amounts of time from the snapshot. Prefer retrieval practice, spacing and past-paper work over rereading.",
        "Keep it under 300 words. Never invent courses or tasks that are not in the snapshot.",
      ].join("\n"),
    },
    { role: "user", content: JSON.stringify(state) },
  ];
};

prompts.summarise = function (text, name) {
  return [
    {
      role: "system",
      content:
        'You summarise study material. Return markdown with: a 2-sentence overview, then "## Key ideas" as 4-8 bullets, then "## Terms to know" as term - definition lines, then "## Likely exam questions" as 3 questions. Base everything strictly on the supplied text.',
    },
    {
      role: "user",
      content: "Material: " + (name || "document") + "\n\n" + text,
    },
  ];
};
