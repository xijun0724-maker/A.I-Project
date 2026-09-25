/**
 * Optional hybrid retrieval: blend BM25 lexical scores with cosine similarity
 * over ONNX sentence embeddings. Off by default (settings.hybridRAG === false);
 * when disabled, or whenever the embedder cannot load, search degrades to pure
 * BM25 with no network access.
 *
 * Embeddings load lazily from a CDN (transformers.js + a small MiniLM model)
 * only after hybrid mode is switched on. Any failure falls back to BM25.
 */

import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import { injectScript } from "../utils/cdn.js";
import { RAG } from "./rag.js";

export const Hybrid = {};

let _embedder = null;
let _embedderPromise = null;
let _loadFailed = false;

const _cache = new Map();

Hybrid.enabled = function () {
  const s = Store.db && Store.db.settings;
  return !!(s && s.hybridRAG);
};

Hybrid.load = function () {
  if (_embedder) return Promise.resolve(_embedder);
  if (_loadFailed)
    return Promise.reject(new Error("hybrid embedder unavailable"));
  if (_embedderPromise) return _embedderPromise;

  const url = CFG.rag.hybrid.cdn;
  /* SHA-384 of transformers@3.7.2 dist/transformers.min.js — recompute on bump. */
  const integrity =
    "sha384-RdWOraTKe5MePFYkuq2G7SQ1g9bu1cR0sKmQc+GNq7zd3kcs+5Js4ZYp8uilPtq2";
  _embedderPromise = injectScript(url, integrity)
    .then(function () {
      const lib = typeof window !== "undefined" ? window.transformers : null;
      if (!lib || typeof lib.pipeline !== "function") {
        throw new Error("transformers.js did not initialise");
      }
      return lib.pipeline("feature-extraction", CFG.rag.hybrid.model, {
        dtype: "q8",
        device: "wasm",
      });
    })
    .then(function (pipe) {
      _embedder = async function (text) {
        const out = await pipe(String(text), {
          pooling: "mean",
          normalize: true,
        });
        const data = out && out.data ? out.data : out;
        return data instanceof Float32Array
          ? data
          : Float32Array.from(data || []);
      };
      return _embedder;
    })
    .catch(function (e) {
      _loadFailed = true;
      _embedderPromise = null;
      throw e;
    });

  return _embedderPromise;
};

/** Inject a custom embedder (async fn: text → Float32Array). Pass null to clear. */
Hybrid.setEmbedder = function (fn) {
  _embedder = typeof fn === "function" ? fn : null;
  _embedderPromise = null;
  _loadFailed = false;
};

/** Force the failure flag so subsequent embeds fall back to BM25 without loading. */
Hybrid.fail = function () {
  _loadFailed = true;
  _embedder = null;
  _embedderPromise = null;
};

Hybrid.reset = function () {
  _embedder = null;
  _embedderPromise = null;
  _loadFailed = false;
  Hybrid.clearCache();
};

Hybrid.clearCache = function () {
  _cache.clear();
};

Hybrid.cacheSize = function () {
  return _cache.size;
};

function hashText(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ":" + s.length.toString(36);
}

function cacheGet(key) {
  if (!_cache.has(key)) return null;
  const v = _cache.get(key);
  _cache.delete(key);
  _cache.set(key, v);
  return v;
}

function cachePut(key, vec) {
  if (_cache.has(key)) _cache.delete(key);
  _cache.set(key, vec);
  const max = CFG.rag.hybrid.maxCache;
  while (_cache.size > max) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
}

Hybrid.cosine = function (a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

async function embed(text) {
  const src = String(text || "");
  if (!src) return null;
  const key = hashText(src);
  const hit = cacheGet(key);
  if (hit) return hit;
  if (_loadFailed) return null;
  if (!_embedder) {
    if (!_embedderPromise) {
      try {
        await Hybrid.load();
      } catch (_e) {
        return null;
      }
    } else {
      try {
        await _embedderPromise;
      } catch (_e) {
        return null;
      }
    }
  }
  if (!_embedder) return null;
  try {
    const vec = await _embedder(src);
    if (vec && vec.length) {
      cachePut(key, vec);
      return vec;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Hybrid search. Always runs BM25 first (lexical candidates), then optionally
 * re-ranks with cosine when hybrid mode is on and the embedder is usable.
 * Shape matches RAG.search: [{ score, id, docId, docName, text, ... }].
 */
Hybrid.search = async function (query, opts) {
  opts = opts || {};
  const k = opts.k || 5;
  const factor = CFG.rag.hybrid.candidateFactor || 1;
  const bm25 = RAG.search(query, {
    k: Math.max(k * factor, k),
    courseId: opts.courseId,
    docIds: opts.docIds,
  });
  if (!bm25.length) return bm25;
  if (!Hybrid.enabled()) return bm25.slice(0, k);

  const w = CFG.rag.hybrid.blend;
  const qVec = await embed(query);
  if (!qVec) return bm25.slice(0, k);

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < bm25.length; i++) {
    const s = bm25[i].score;
    if (s < min) min = s;
    if (s > max) max = s;
  }
  const span = max - min;

  const ranked = [];
  for (let i = 0; i < bm25.length; i++) {
    const c = bm25[i];
    const cVec = await embed(c.text || "");
    const cos = cVec ? Math.max(0, Hybrid.cosine(qVec, cVec)) : 0;
    const bm25Norm = span > 0 ? (c.score - min) / span : c.score > 0 ? 1 : 0;
    const score = (1 - w) * bm25Norm + w * cos;
    ranked.push(
      Object.assign({}, c, {
        score: Math.round(score * 1000) / 1000,
        bm25Score: c.score,
        cosScore: Math.round(cos * 1000) / 1000,
      }),
    );
  }
  ranked.sort(function (a, b) {
    return b.score - a.score;
  });
  return ranked.slice(0, k);
};

/**
 * Async context builder with the same return shape as RAG.context.
 * Disabled mode just delegates to RAG.context (sync path, wrapped).
 */
Hybrid.context = async function (question, opts) {
  opts = opts || {};
  try {
    if (!Hybrid.enabled()) return RAG.context(question, opts);
    const chunks = await Hybrid.search(question, opts);
    return RAG.context(question, Object.assign({}, opts, { chunks: chunks }));
  } catch (_e) {
    return { chunks: [], sources: [], contextText: "", terms: [] };
  }
};

export default Hybrid;
