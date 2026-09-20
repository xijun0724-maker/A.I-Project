/**
 * Document chunking plus a BM25 retrieval index over everything in the Library.
 * Runs entirely in the browser so the assistant still works with no API key and no network.
 */

import { CFG } from "../config/constants.js";
import { Store } from "../core/store.js";
import { sortBy } from "../utils/helpers.js";

export const RAG = {};

RAG.STOP = (function () {
  const words =
    "a an the and or but if then than that this these those of to in on at by for with from as is are was were be been being it its into over under not no do does did done have has had will would can could should may might must about above after again against all am any because before below between both down during each few further here how i just me more most my no nor now off once only other our out own same she he they them we you your so such there their what when where which while who whom why s t dont isn t very s il re ve ll d m o y".split(
      " ",
    );
  const o = {};
  words.forEach(function (w) {
    o[w] = 1;
  });
  return o;
})();

RAG.stem = function (t) {
  if (t.length <= 4) return t;
  return t
    .replace(/ies$/, "y")
    .replace(/(sses|shes|ches|xes)$/, "s")
    .replace(/ing$/, "")
    .replace(/edly$/, "")
    .replace(/ed$/, "")
    .replace(/s$/, "");
};

RAG.tokenize = function (s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (t) {
      return t.length > 1 && !RAG.STOP[t] && !/^\d+$/.test(t);
    })
    .map(RAG.stem);
};

RAG.view = function (text) {
  const src = String(text || "");
  let norm = "",
    prevSpace = false;
  const map = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (ch === "\r") continue;
    if (ch === " " || ch === "\t") {
      if (prevSpace) continue;
      prevSpace = true;
    } else {
      prevSpace = false;
    }
    norm += ch;
    map.push(i);
  }
  return { text: norm, map: map };
};

RAG.chunkRanges = function (text) {
  const src = String(text || "");
  const view = RAG.view(src),
    norm = view.text,
    map = view.map;
  if (!norm.trim()) return [];
  const segs = [],
    blank = /\n[ \t]*\n/g;
  let last = 0,
    m;
  while ((m = blank.exec(norm))) {
    segs.push([last, m.index]);
    last = m.index + m[0].length;
  }
  segs.push([last, norm.length]);
  const runs = [];
  segs.forEach(function (seg) {
    let a = seg[0],
      b = seg[1];
    while (a < b && /\s/.test(norm.charAt(a))) a++;
    while (b > a && /\s/.test(norm.charAt(b - 1))) b--;
    if (b > a) runs.push([a, b]);
  });
  const out = [];
  function keep(a, b) {
    if (b <= a) return;
    const start = map[a],
      end = map[b - 1];
    if (typeof start !== "number" || typeof end !== "number") return;
    const len = end - start + 1;
    if (len > 30) out.push({ start: start, len: len });
  }
  let i = 0;
  while (i < runs.length) {
    let a = runs[i][0],
      b = a,
      j = i;
    while (j < runs.length) {
      const end = runs[j][1];
      if (b > a && end - a > CFG.chunkSize) break;
      b = end;
      j++;
      if (b - a >= CFG.chunkSize * 1.7) break;
    }
    if (j === i) {
      j = i + 1;
      b = runs[i][1];
    }
    while (b - a > CFG.chunkSize * 1.7) {
      let cut = norm.lastIndexOf(". ", a + CFG.chunkSize);
      if (cut <= a + CFG.chunkSize * 0.4) cut = a + CFG.chunkSize;
      keep(a, cut + 1);
      const next = cut + 1 - CFG.chunkOverlap;
      a = next > a ? next : a + 1;
      while (a < b && /\s/.test(norm.charAt(a))) a++;
    }
    keep(a, b);
    i = Math.max(i + 1, j - 1);
  }
  return out;
};

RAG.chunkText = function (text) {
  const src = String(text || "");
  return RAG.chunkRanges(src).map(function (r) {
    return src.substr(r.start, r.len);
  });
};

RAG.chunkTextOf = function (c) {
  if (typeof c.len !== "number") return c.text || "";
  const doc = Store.doc(c.docId);
  if (!doc || typeof doc.text !== "string") return "";
  return doc.text.substr(c.start, c.len);
};

RAG.reindexAll = function () {
  const db = Store.db,
    out = [];
  try {
    (db.documents || []).forEach(function (doc) {
      const ranges = RAG.chunkRanges(doc.text);
      doc.chunkCount = ranges.length;
      ranges.forEach(function (r, i) {
        out.push({
          id: doc.id + "#" + i,
          docId: doc.id,
          courseId: doc.courseId,
          docName: doc.name,
          idx: i,
          start: r.start,
          len: r.len,
        });
      });
    });
    db.chunks = out;
    RAG.invalidate();
  } catch (_e) {
    if (window.console) console.warn("RAG reindex failed", _e);
  }
  return out.length;
};

RAG.invalidate = function () {
  RAG._idx = null;
};

RAG.index = function () {
  if (RAG._idx) return RAG._idx;
  const chunks = Store.db.chunks || [];
  const idx = {
    n: 0,
    post: {},
    len: {},
    byId: {},
    avg: 1,
    k1: CFG.rag.bm25k1,
    b: CFG.rag.bm25b,
  };
  let total = 0,
    indexed = 0;
  chunks.forEach(function (c) {
    const text = RAG.chunkTextOf(c);
    if (!text) return;
    idx.byId[c.id] = Object.assign({}, c, { text: text });
    const toks = RAG.tokenize(text);
    if (!toks.length) return;
    indexed++;
    idx.len[c.id] = toks.length;
    total += toks.length;
    const tf = {};
    toks.forEach(function (t) {
      tf[t] = (tf[t] || 0) + 1;
    });
    Object.keys(tf).forEach(function (t) {
      if (!idx.post[t]) idx.post[t] = {};
      idx.post[t][c.id] = tf[t];
    });
  });
  idx.n = indexed;
  idx.avg = indexed ? total / indexed : 1;
  RAG._idx = idx;
  return idx;
};

RAG.search = function (query, opts) {
  opts = opts || {};
  const k = opts.k || 5;
  let idx = RAG.index();
  if (!idx.n && (Store.db.documents || []).length) {
    RAG.reindexAll();
    idx = RAG.index();
  }
  let allowed = null;
  if (opts.courseId && opts.courseId !== "all") {
    allowed = {};
    (Store.db.chunks || []).forEach(function (c) {
      if (c.courseId === opts.courseId) allowed[c.id] = 1;
    });
  }
  if (opts.docIds && opts.docIds.length) {
    allowed = {};
    (Store.db.chunks || []).forEach(function (c) {
      if (opts.docIds.indexOf(c.docId) !== -1) allowed[c.id] = 1;
    });
  }
  const fallback = function () {
    return Object.keys(idx.byId)
      .filter(function (cid) {
        return !allowed || allowed[cid];
      })
      .sort(function (a, b) {
        const left = idx.byId[a],
          right = idx.byId[b];
        return (
          (left.docName || "").localeCompare(right.docName || "") ||
          left.idx - right.idx
        );
      })
      .slice(0, k)
      .map(function (cid) {
        return Object.assign({ score: 0 }, idx.byId[cid]);
      });
  };
  const terms = RAG.tokenize(query);
  if (!idx.n || !terms.length) return fallback();
  const scores = {};
  terms.forEach(function (term) {
    const postings = idx.post[term];
    if (!postings) return;
    const cids = Object.keys(postings);
    const idf = Math.log(1 + (idx.n - cids.length + 0.5) / (cids.length + 0.5));
    cids.forEach(function (cid) {
      if (allowed && !allowed[cid]) return;
      const f = postings[cid],
        len = idx.len[cid] || 1;
      const s =
        idf *
        ((f * (idx.k1 + 1)) /
          (f + idx.k1 * (1 - idx.b + (idx.b * len) / idx.avg)));
      scores[cid] = (scores[cid] || 0) + s;
    });
  });
  const phrase = String(query || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  Object.keys(scores).forEach(function (cid) {
    const c = idx.byId[cid];
    if (!c) return;
    const low = c.text.toLowerCase();
    if (phrase.length > 6 && low.indexOf(phrase) !== -1)
      scores[cid] += CFG.rag.phraseBonus;
  });
  if (!Object.keys(scores).length) {
    return fallback();
  }
  return sortBy(Object.keys(scores), function (cid) {
    return -scores[cid];
  })
    .slice(0, k)
    .map(function (cid) {
      return Object.assign(
        { score: Math.round(scores[cid] * 100) / 100 },
        idx.byId[cid],
      );
    });
};

RAG.sentences = function (text) {
  return String(text || "")
    .replace(/([.!?])\s+/g, "$1\u0001")
    .split("\u0001")
    .map(function (s) {
      return s.replace(/\s+/g, " ").trim();
    })
    .filter(function (s) {
      return s.length > 25;
    });
};

RAG.extract = function (question, chunks, maxSentences) {
  const terms = RAG.tokenize(question);
  const scored = [];
  chunks.forEach(function (c, ci) {
    RAG.sentences(c.text).forEach(function (s, si) {
      const toks = RAG.tokenize(s);
      if (!toks.length) return;
      let hit = 0;
      terms.forEach(function (t) {
        if (toks.indexOf(t) !== -1) hit += 1;
        else if (
          toks.some(function (x) {
            return x.length > 4 && (x.indexOf(t) === 0 || t.indexOf(x) === 0);
          })
        )
          hit += 0.5;
      });
      if (!hit) return;
      const density = hit / Math.sqrt(toks.length);
      const score = density * 6 + (ci === 0 ? 0.6 : 0) + (si === 0 ? 0.3 : 0);
      scored.push({ score: score, text: s, ref: ci + 1 });
    });
  });
  return sortBy(scored, function (s) {
    return -s.score;
  }).slice(0, maxSentences || 5);
};

RAG.context = function (question, opts) {
  opts = opts || {};
  try {
    const chunks = RAG.search(question, {
      k: opts.k || 5,
      courseId: opts.courseId,
      docIds: opts.docIds,
    });
    const budget = CFG.maxChatChars;
    let used = 0;
    const picked = [];
    chunks.forEach(function (c) {
      if (used + c.text.length > budget) return;
      used += c.text.length;
      picked.push(c);
    });
    const sources = picked.map(function (c, i) {
      return {
        n: i + 1,
        docId: c.docId,
        docName: c.docName,
        idx: c.idx,
        courseId: c.courseId,
        snippet:
          c.text.slice(0, CFG.rag.snippetLength) +
          (c.text.length > CFG.rag.snippetLength ? "…" : ""),
      };
    });
    const contextText = picked
      .map(function (c, i) {
        return (
          "[" +
          (i + 1) +
          "] " +
          c.docName +
          " (passage " +
          (c.idx + 1) +
          ")\n" +
          c.text
        );
      })
      .join("\n\n");
    return {
      chunks: picked,
      sources: sources,
      contextText: contextText,
      terms: RAG.tokenize(question),
    };
  } catch (_e) {
    return { chunks: [], sources: [], contextText: "", terms: [] };
  }
};

RAG.glossary = function (chunks, limit) {
  const counts = {};
  chunks.forEach(function (c) {
    const seen = {};
    RAG.tokenize(c.text).forEach(function (t) {
      if (!seen[t]) {
        seen[t] = 1;
        counts[t] = (counts[t] || 0) + 1;
      }
    });
  });
  return sortBy(Object.keys(counts), function (t) {
    return -counts[t];
  }).slice(0, limit || 6);
};

export default RAG;
