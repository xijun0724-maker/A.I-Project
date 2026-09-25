/**
 * Help modal — standalone information dialog
 */

import { mdToHtml } from "../../utils/markdown.js";
import { modal } from "../../utils/feedback.js";

export function helpModal() {
  modal({
    title: "How Journey A.I works",
    wide: true,
    body: mdToHtml(
      [
        "### 1. Import your syllabus",
        "Upload a course syllabus (PDF, Word or pasted text). The analyser reads it in your browser, extracts the text and any tables, then maps out the weekly topics, deadlines, weightings and required readings.",
        "",
        "### 2. Review before anything is saved",
        "Nothing is written to your plan until you confirm. Every extracted deadline shows a confidence score, and any date that was inferred from the week it appeared under is labelled as such.",
        "",
        "### 3. Tasks become subtasks",
        "Each assessment is decomposed into ordered subtasks with intermediate dates spread backwards from the deadline. Priority comes from deadline proximity and grade weighting.",
        "",
        "### 4. Upload your study material",
        "Add lecture notes, textbook chapters and briefs to the Library. They are split into passages and indexed in the browser so the assistant can retrieve grounded answers and cite them.",
        "",
        "### 5. Plan, track, improve",
        "The planner distributes study blocks across your available study hours, the dashboard reports progress, and recommendations update as you tick work off.",
        "",
        "> **Offline by design.** Every AI feature has a deterministic fallback: the syllabus analyser is rule-based NLP, the assistant falls back to extractive retrieval, and the study plan falls back to built-in scheduling. Adding an API key upgrades the explanation quality rather than unlocking the app.",
      ].join("\n"),
    ),
    footer: '<button class="btn primary" data-close="1">Got it</button>',
  });
}
