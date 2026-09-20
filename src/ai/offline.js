/**
 * Offline fallback responses when AI API is unavailable.
 */

export function offlineAnswer(question, ctx, StoreRef, RAGRef) {
  if (!ctx.chunks.length) {
    return (
      "I could not find anything about that in your uploaded materials.\n\n**What I checked:** " +
      (StoreRef.db.documents.length
        ? StoreRef.db.documents.length +
          " document(s) in your Library, using keyword retrieval."
        : "your Library is empty — nothing has been uploaded yet.") +
      "\n\n**To get a grounded answer, you can:**\n- Upload the relevant textbook chapter, lecture notes or handout in the Library\n- Add an API key in Settings so I can reason beyond your documents\n- Ask a narrower question about material you have already uploaded"
    );
  }
  const picks = RAGRef.extract(question, ctx.chunks, 5);
  const terms = RAGRef.glossary(ctx.chunks, 7);
  const out = [];
  if (picks.length) {
    out.push(
      "Based on your uploaded materials, here is what I found for **" +
        question.replace(/[*_`]/g, "") +
        "**:\n",
    );
    out.push(
      picks
        .map((p, i) => i + 1 + ". " + p.text + " [" + p.ref + "]")
        .join("\n"),
    );
  } else {
    out.push(
      "The passages I retrieved do not contain a direct answer to that question. The closest material is quoted under **Sources** below — try rephrasing with terms from your notes.",
    );
  }
  if (terms.length)
    out.push(
      "\n**Key terms appearing in the matched passages:** " + terms.join(", "),
    );
  out.push("\n**Sources**");
  out.push(
    ctx.sources
      .map((s) => "- [" + s.n + "] " + s.docName + " — passage " + (s.idx + 1))
      .join("\n"),
  );
  out.push(
    "\n_Offline mode: this answer is extracted directly from your documents rather than reasoned over. Add an API key in Settings for an explained, conversational answer._",
  );
  return out.join("\n");
}

export function offlineStudyPlan(snap) {
  const lines = [];
  lines.push("## This week");
  const dueSoon = snap.upcomingDeadlines.filter(
    (d) => d.daysLeft <= 7 && d.daysLeft >= 0,
  );
  if (dueSoon.length) {
    dueSoon.forEach((d) => {
      lines.push(
        "- **" +
          d.title +
          "** (" +
          d.course +
          ") — " +
          d.daysLeft +
          " days left, " +
          d.progress +
          "% done",
      );
    });
  } else {
    lines.push("- No deadlines this week — use this time to get ahead.");
  }
  lines.push("");
  lines.push("## Start now");
  const open = snap.upcomingDeadlines
    .filter((d) => d.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);
  if (open.length) {
    open.forEach((d) => {
      lines.push(
        "- Begin **" +
          d.title +
          "** — estimated " +
          d.minutesLeft +
          " minutes remaining",
      );
    });
  }
  lines.push("");
  lines.push("## Study tips");
  lines.push(
    "- Use active recall: close your notes and try to write down what you remember",
  );
  lines.push(
    "- Space your study sessions across multiple days instead of cramming",
  );
  lines.push("- Practice with past papers or create your own quiz questions");
  return lines.join("\n");
}
