import { describe, it, expect, beforeEach } from "vitest";
import { Hybrid } from "../../src/domain/rag-embeddings.js";
import { RAG } from "../../src/domain/rag.js";
import { Store } from "../../src/core/store.js";
import { createBlankDB } from "../../src/config/settings.js";

function seedDocs() {
  Store.db.documents = [
    {
      id: "doc1",
      courseId: "c1",
      name: "Alpha Notes",
      text: "Machine learning models learn patterns from data. Neural networks train on large datasets with gradient descent and backpropagation algorithms.",
    },
    {
      id: "doc2",
      courseId: "c1",
      name: "Beta Notes",
      text: "Linear algebra covers matrices vectors and eigenvalues. Calculus deals with derivatives integrals and continuous change over intervals.",
    },
  ];
  RAG.reindexAll();
}

function fakeEmbedder() {
  let calls = 0;
  const fn = async (text) => {
    calls += 1;
    const s = String(text || "").toLowerCase();
    const v = new Float32Array(8);
    if (s.includes("machine") || s.includes("neural") || s.includes("learn"))
      v[0] = 1;
    if (s.includes("linear") || s.includes("algebra") || s.includes("matrix"))
      v[1] = 1;
    if (s.includes("gradient") || s.includes("network")) v[2] = 1;
    if (s.includes("calculus") || s.includes("derivative")) v[3] = 1;
    if (s.includes("data")) v[4] = 1;
    if (s.includes("question") || s.includes("what")) v[5] = 1;
    let n = 0;
    for (let i = 0; i < v.length; i++) n += v[i] * v[i];
    if (n > 0) for (let i = 0; i < v.length; i++) v[i] /= Math.sqrt(n);
    return v;
  };
  fn.calls = () => calls;
  return fn;
}

beforeEach(() => {
  Store.resetAll();
  RAG.invalidate();
  Hybrid.reset();
});

describe("Hybrid.enabled", () => {
  it("defaults to false in a blank DB", () => {
    expect(createBlankDB().settings.hybridRAG).toBe(false);
    expect(Hybrid.enabled()).toBe(false);
  });

  it("returns true when settings.hybridRAG is set", () => {
    Store.db.settings.hybridRAG = true;
    expect(Hybrid.enabled()).toBe(true);
  });
});

describe("Hybrid.cosine", () => {
  it("returns 1 for identical vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    expect(Hybrid.cosine(a, a)).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(Hybrid.cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns -1 for opposite vectors", () => {
    expect(Hybrid.cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it("returns 0 for empty or mismatched input", () => {
    expect(Hybrid.cosine([], [])).toBe(0);
    expect(Hybrid.cosine(null, [1])).toBe(0);
    expect(Hybrid.cosine([1, 2], [1])).toBe(0);
  });
});

describe("Hybrid.search", () => {
  it("returns BM25 results without calling the embedder when disabled", async () => {
    seedDocs();
    const emb = fakeEmbedder();
    Hybrid.setEmbedder(emb);
    expect(Hybrid.enabled()).toBe(false);
    const hits = await Hybrid.search("machine learning", { k: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].docId).toBe("doc1");
    expect(emb.calls()).toBe(0);
  });

  it("blends cosine when enabled with an embedder", async () => {
    seedDocs();
    Store.db.settings.hybridRAG = true;
    const emb = fakeEmbedder();
    Hybrid.setEmbedder(emb);
    const hits = await Hybrid.search("machine learning neural", { k: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].docId).toBe("doc1");
    expect(emb.calls()).toBeGreaterThan(0);
    expect(typeof hits[0].cosScore).toBe("number");
    expect(typeof hits[0].bm25Score).toBe("number");
  });

  it("falls back to BM25 when the embedder fails to load", async () => {
    seedDocs();
    Store.db.settings.hybridRAG = true;
    Hybrid.fail();
    const bm25 = RAG.search("machine learning", { k: 3 });
    const hits = await Hybrid.search("machine learning", { k: 3 });
    expect(hits.map((h) => h.id)).toEqual(bm25.map((h) => h.id));
    expect(hits[0].cosScore).toBeUndefined();
  });

  it("respects docIds filter", async () => {
    seedDocs();
    Store.db.settings.hybridRAG = true;
    Hybrid.setEmbedder(fakeEmbedder());
    const hits = await Hybrid.search("matrices", {
      k: 3,
      docIds: ["doc2"],
    });
    expect(hits.every((h) => h.docId === "doc2")).toBe(true);
  });
});

describe("Hybrid embedding cache", () => {
  it("reuses cached vectors for the same text", async () => {
    seedDocs();
    Store.db.settings.hybridRAG = true;
    const emb = fakeEmbedder();
    Hybrid.setEmbedder(emb);
    const before = emb.calls();
    await Hybrid.search("machine learning", { k: 3 });
    const mid = emb.calls();
    expect(mid).toBeGreaterThan(before);
    await Hybrid.search("machine learning", { k: 3 });
    expect(emb.calls()).toBe(mid);
    expect(Hybrid.cacheSize()).toBeGreaterThan(0);
  });

  it("clears the cache on reset", async () => {
    seedDocs();
    Store.db.settings.hybridRAG = true;
    Hybrid.setEmbedder(fakeEmbedder());
    await Hybrid.search("machine learning", { k: 3 });
    expect(Hybrid.cacheSize()).toBeGreaterThan(0);
    Hybrid.reset();
    expect(Hybrid.cacheSize()).toBe(0);
  });
});

describe("Hybrid.context", () => {
  it("returns the same shape as RAG.context when disabled", async () => {
    seedDocs();
    const ctx = await Hybrid.context("machine learning", { k: 3 });
    const base = RAG.context("machine learning", { k: 3 });
    expect(Object.keys(ctx).sort()).toEqual(Object.keys(base).sort());
    expect(ctx.chunks.length).toBe(base.chunks.length);
    expect(ctx.contextText).toContain("Alpha Notes");
  });

  it("returns chunks and sources when enabled", async () => {
    seedDocs();
    Store.db.settings.hybridRAG = true;
    Hybrid.setEmbedder(fakeEmbedder());
    const ctx = await Hybrid.context("machine learning", { k: 3 });
    expect(ctx.chunks.length).toBeGreaterThan(0);
    expect(ctx.sources.length).toBeGreaterThan(0);
    expect(ctx.contextText).toContain("Alpha Notes");
    expect(Array.isArray(ctx.terms)).toBe(true);
  });

  it("returns an empty context when nothing is indexed", async () => {
    const ctx = await Hybrid.context("machine learning");
    expect(ctx.chunks).toEqual([]);
    expect(ctx.sources).toEqual([]);
    expect(ctx.contextText).toBe("");
  });
});
