import { describe, it, expect } from "vitest";
import { RAG } from "../../src/domain/rag.js";
import { Store } from "../../src/core/store.js";

describe("RAG.stem", () => {
  it("returns short words unchanged (≤4 chars)", () => {
    expect(RAG.stem("cat")).toBe("cat");
    expect(RAG.stem("is")).toBe("is");
    expect(RAG.stem("story")).toBe("story");
  });

  it("stems -ies to -y for longer words", () => {
    expect(RAG.stem("histories")).toBe("history");
  });

  it("stems -sses then strips trailing s", () => {
    expect(RAG.stem("addresses")).toBe("addre");
  });

  it("stems -ing for longer words", () => {
    expect(RAG.stem("running")).toBe("runn");
    expect(RAG.stem("making")).toBe("mak");
  });

  it("stems -ed for longer words", () => {
    expect(RAG.stem("walked")).toBe("walk");
    expect(RAG.stem("jumped")).toBe("jump");
  });

  it("stems -s for longer words", () => {
    expect(RAG.stem("computers")).toBe("computer");
    expect(RAG.stem("houses")).toBe("house");
  });
});

describe("RAG.tokenize", () => {
  it("tokenizes and lowercases", () => {
    const tokens = RAG.tokenize("Hello World");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
  });

  it("removes stopwords", () => {
    const tokens = RAG.tokenize("the quick brown fox");
    expect(tokens).not.toContain("the");
  });

  it("removes single character tokens", () => {
    const tokens = RAG.tokenize("a b c test");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("b");
  });

  it("removes pure numbers", () => {
    const tokens = RAG.tokenize("test 12345 word");
    expect(tokens).not.toContain("12345");
  });

  it("returns empty array for empty input", () => {
    expect(RAG.tokenize("")).toEqual([]);
    expect(RAG.tokenize(null)).toEqual([]);
  });
});

describe("RAG.view", () => {
  it("normalizes whitespace", () => {
    const result = RAG.view("hello   world");
    expect(result.text).toBe("hello world");
  });

  it("removes carriage returns", () => {
    const result = RAG.view("hello\r\nworld");
    expect(result.text).toBe("hello\nworld");
  });

  it("builds character map", () => {
    const result = RAG.view("abc");
    expect(result.map).toEqual([0, 1, 2]);
  });
});

describe("RAG.chunkText", () => {
  it("returns array of text chunks for long text", () => {
    const text =
      "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\nFourth paragraph with enough content to exceed the minimum chunk size threshold.";
    const chunks = RAG.chunkText(text);
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty text", () => {
    expect(RAG.chunkText("")).toEqual([]);
    expect(RAG.chunkText(null)).toEqual([]);
  });

  it("returns empty for very short text (below 30 chars)", () => {
    const chunks = RAG.chunkText("Short.");
    expect(chunks.length).toBe(0);
  });
});

describe("RAG.context", () => {
  it("returns empty context when no documents indexed", () => {
    Store.resetAll();
    const ctx = RAG.context("machine learning");
    expect(ctx.chunks).toEqual([]);
    expect(ctx.sources).toEqual([]);
    expect(ctx.contextText).toBe("");
  });

  it("returns matching chunks for relevant query", () => {
    Store.resetAll();
    Store.db.documents = [
      {
        id: "doc1",
        courseId: "c1",
        name: "CS101 Notes",
        text: "Machine learning is a subset of artificial intelligence. Neural networks are used for deep learning. Supervised learning requires labeled training data.",
      },
    ];
    RAG.reindexAll();
    const ctx = RAG.context("neural networks");
    expect(ctx.chunks.length).toBeGreaterThan(0);
    expect(ctx.sources.length).toBeGreaterThan(0);
    expect(ctx.contextText).toContain("CS101 Notes");
  });

  it("respects courseId filter", () => {
    Store.resetAll();
    Store.db.documents = [
      {
        id: "doc1",
        courseId: "c1",
        name: "CS Notes",
        text: "Computer science fundamentals. Algorithms and data structures are essential.",
      },
      {
        id: "doc2",
        courseId: "c2",
        name: "Math Notes",
        text: "Linear algebra matrices and vectors. Eigenvalues and eigenvectors.",
      },
    ];
    RAG.reindexAll();
    const ctx = RAG.context("algorithms", { courseId: "c1" });
    expect(ctx.chunks.every((c) => c.courseId === "c1")).toBe(true);
  });

  it("falls back to selected source passages for broad questions", () => {
    Store.resetAll();
    Store.db.documents = [
      {
        id: "pdf1",
        courseId: "c1",
        name: "Lecture PDF",
        text: "This lecture introduces graph traversal, adjacency lists, breadth first search, and depth first search with worked examples and complexity notes.",
      },
    ];
    RAG.reindexAll();
    const ctx = RAG.context("what is in this pdf", { docIds: ["pdf1"] });
    expect(ctx.chunks.length).toBeGreaterThan(0);
    expect(ctx.contextText).toContain("graph traversal");
  });

  it("rebuilds a missing index before reading a selected source", () => {
    Store.resetAll();
    Store.db.documents = [
      {
        id: "pdf2",
        courseId: "c1",
        name: "Imported PDF",
        text: "This document contains the course overview, assessment rules, and the weekly topics for the semester.",
      },
    ];
    Store.db.chunks = [];
    RAG.invalidate();
    const ctx = RAG.context("what is in this file", { docIds: ["pdf2"] });
    expect(ctx.sources.length).toBeGreaterThan(0);
    expect(ctx.sources[0].docId).toBe("pdf2");
  });

  it("returns terms array", () => {
    Store.resetAll();
    const ctx = RAG.context("machine learning");
    expect(Array.isArray(ctx.terms)).toBe(true);
    expect(ctx.terms.length).toBeGreaterThan(0);
  });
});
