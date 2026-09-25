#!/usr/bin/env node
/** One-shot scanner: find unescaped entity-id interpolations in HTML sinks. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const DATA_ATTRS = /data-(?:id|course-id|task-id|doc-id|kebab-id|recall-card|lesson-id|event-id|note-id|week-id)="'/;
const ID_ATTR = /id="[^"]*' \+/;
/* Known-safe values: pre-sanitized local (`safe`) or module constants. */
const SAFE_VALS = new Set(["safe", "safe +", "safe + '", "PROPOSAL_CARD_ID", "PROPOSAL_CARD_ID +"]);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".js")) acc.push(p);
  }
  return acc;
}

const issues = [];
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";

    // same-line: data-id="' + something  (must be esc(...) or a literal/number)
    let re = /data-(?:id|course-id|task-id|doc-id|kebab-id|recall-card)="' \+ ([^;]+?)(?:'|;|$)/g;
    let m;
    while ((m = re.exec(line))) {
      const val = m[1].trim();
      if (val.startsWith("esc(")) continue;
      if (SAFE_VALS.has(val) || SAFE_VALS.has(val.replace(/[);]+$/, ""))) continue;
      if (/^\d+$/.test(val)) continue;
      // multi-line: value continues on next lines — check if esc( appears soon
      const window = (line.slice(m.index) + "\n" + next + "\n" + next2).replace(/\s+/g, " ");
      if (/data-(?:id|course-id|task-id|doc-id|kebab-id|recall-card)="' \+ esc\(/.test(window)) continue;
      issues.push(`${file}:${i + 1}: ${m[0].slice(0, 90)}`);
    }

    // multi-line form: attr ends with "' +" and next meaningful token is bare id
    re = /data-(?:id|course-id|task-id|doc-id|kebab-id)="' \+\s*$/;
    if (re.test(line)) {
      const v = next.trim();
      if (v && !v.startsWith("esc(") && !SAFE_VALS.has(v) && !v.startsWith('"')) {
        issues.push(`${file}:${i + 1} (next line): ${v}`);
      }
    }

    // id="foo-' + x  (element id)
    re = /id="[^"]*' \+ ([A-Za-z_$][\w.$]*)/g;
    while ((m = re.exec(line))) {
      const val = m[1];
      if (val === "esc" || SAFE_VALS.has(val)) continue;
      const window = line.slice(m.index, m.index + 80);
      if (window.includes("esc(")) continue;
      const v = next.trim();
      if (v.startsWith("esc(")) continue;
      issues.push(`${file}:${i + 1}: id sink ${m[0].slice(0, 90)}`);
    }
  }
}

if (issues.length) {
  console.error("Unescaped ID sinks:\n" + issues.join("\n"));
  process.exit(1);
}
console.log("OK: no unescaped ID sinks");
