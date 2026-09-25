/**
 * Summarise an analysis result for the import review screen.
 * Returns { lessons, events, readings, tables, confidence, syllabusLike }.
 */
export function summary(result) {
  const lessons = result.lessons || [];
  const events = result.events || [];
  const readings = result.readings || [];
  const tables = result.tables || [];
  const meta = result.meta || {};
  let confidence = 0;
  if (events.length) {
    let sum = 0;
    events.forEach(function (e) {
      sum += e.confidence || 0;
    });
    confidence = sum / events.length;
  }
  if (lessons.length) {
    confidence = (confidence + Math.min(1, lessons.length / 10) * 0.5) / 1.5;
  }
  confidence = Math.min(1, confidence);
  const syllabusLike = meta.weeks >= 3 || events.length >= 4;
  return {
    lessons: lessons.length,
    events: events.length,
    readings: readings.length,
    tables: tables.length,
    confidence: confidence,
    syllabusLike: syllabusLike,
  };
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "don",
  "now",
  "about",
  "and",
  "but",
  "or",
  "if",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "up",
  "also",
  "please",
  "explain",
  "tell",
  "help",
  "give",
  "show",
  "want",
  "need",
  "know",
  "think",
  "like",
  "use",
  "used",
  "using",
  "make",
  "makes",
  "made",
  "get",
  "got",
  "go",
  "going",
  "come",
  "came",
  "see",
  "saw",
  "say",
  "said",
]);

/** Extract search-relevant keywords from conversational text for RAG queries. */
export function extractKeywords(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(function (w) {
      return w.length > 2 && !STOPWORDS.has(w);
    })
    .slice(0, 12)
    .join(" ");
}
