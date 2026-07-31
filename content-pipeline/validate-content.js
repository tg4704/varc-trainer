#!/usr/bin/env node
/**
 * validate-content.js — check generated CAT content against the measured corpus.
 *
 *   node content-pipeline/validate-content.js <file.json> [more.json ...]
 *
 * Accepts either shape:
 *   • a GENERATION payload   — { kind: "passage_set" | "drills", ... }, or an array of them
 *   • an ADMIN EXPORT        — { passages: [...], questions: [...] } from Admin → Export content
 *
 * Every threshold below traces to content-pipeline/CORPUS_STUDY.md (102 CAT passages,
 * 438 questions, 2017–2025). Run this BEFORE importing a batch, and on any export you
 * want to audit.
 *
 * Exit code: 0 if no FAILs, 1 otherwise (so CI or a shell loop can gate on it).
 */

const fs = require("fs");

// ── measured targets (CORPUS_STUDY.md) ──────────────────────────────────────
const T = {
  passageWords:     [500, 540],  // real CAT median 518, IQR 506–525
  passageWordsSoft: [480, 560],  // importer's soft gate
  drillWords:       [90, 120],
  paragraphs:       [3, 5],
  minTurns:         3,           // 0 of 102 passages had none; median 4
  minDrillTurnShare: 0.40,      // real CAT: 56% of 100-word windows carry a marker
  maxOver40Pct:     0.10,        // real CAT 4%; allow some slack on small samples
  minUnder12Pct:    0.25,        // real CAT 43%
  maxLongestShare:  0.25,        // real CAT: answer is longest 20% of the time
  maxTrapShare:     0.30,        // no single archetype may dominate
  maxIndexShare:    0.40,        // real CAT answer positions are ~uniform (25% each)
  minIndexShare:    0.12,        // …and no index is starved (checked at n>=8)
  minShortestShare: 0.08,        // real CAT: answer is shortest 16% of the time
  optionWords:      [7, 20],     // real CAT median 12, IQR 9–16
};

const BANNED = /\b(furthermore|moreover|nevertheless|nonetheless|in conclusion|it is important to note|delve|underscores?|testament to|in an era of)\b/gi;
const TURNS  = /\b(but|yet|however|still|though|although|whereas|admittedly|granted)\b/gi;

const TEXTURE = {
  "named person":   /\b[A-Z][a-z]+ [A-Z][a-z]+\b/,
  "ellipsis":       /…|\. \. \./,
  "colon":          /:/,
  "first person":   /\b(I|my|we|our|us)\b/,
  "em-dash":        /—/,
  "quotation":      /["“][^"”]{10,}["”]/,
  "parenthetical":  /\([^)]{5,}\)/,
  "numeric/date":   /\b(1[5-9]\d\d|20\d\d|\d+ percent|\d+%)\b/,
  "bracket gloss":  /\[[^\]]{2,40}\]/,
  "semicolon":      /;/,
};

// question types that count toward each quota slot
const STRONG_TYPES = ["except_set", "hypothetical"];
const FUNC_TYPES   = ["function", "author_intent"];
const WEAK_TYPES   = ["tone", "title", "detail"];

// ── helpers ─────────────────────────────────────────────────────────────────
const wc = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const sentences = (s) => String(s || "").match(/[^.!?]+[.!?]/g) || [];
const pct = (x) => (x * 100).toFixed(0) + "%";

let FAILS = 0, WARNS = 0;
const C = process.stdout.isTTY
  ? { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", x: "\x1b[0m", b: "\x1b[1m" }
  : { r: "", y: "", g: "", d: "", x: "", b: "" };

function ok(msg)   { console.log(`  ${C.g}✓${C.x} ${msg}`); }
function fail(msg) { console.log(`  ${C.r}✗ FAIL${C.x} ${msg}`); FAILS++; }
function warn(msg) { console.log(`  ${C.y}! WARN${C.x} ${msg}`); WARNS++; }
function head(msg) { console.log(`\n${C.b}${msg}${C.x}`); }

function check(cond, good, bad, soft = false) {
  if (cond) ok(good);
  else if (soft) warn(bad);
  else fail(bad);
}

/** Normalize a question from either the generation shape or the export shape. */
function normQ(q) {
  let opts = q.options;
  if (!opts && q.options_json) {
    opts = typeof q.options_json === "string" ? JSON.parse(q.options_json) : q.options_json;
  }
  return {
    type: q.type,
    question: q.question,
    options: (opts || []).map((o) => ({ text: o.text, trapType: o.trapType ?? o.trap_type ?? null })),
    correctIndex: q.correctIndex ?? q.correct_index,
    paragraph: q.paragraph,
    topic: q.topic,
    difficulty: q.difficulty,
  };
}

// ── prose checks (shared by passages and drill paragraphs) ──────────────────
function checkProse(text, { isPassage, label }) {
  const words = wc(text);
  const band = isPassage ? T.passageWords : T.drillWords;
  check(words >= band[0] && words <= band[1],
    `${label} length ${words} words (target ${band[0]}–${band[1]})`,
    `${label} length ${words} words — outside target ${band[0]}–${band[1]}`,
    isPassage && words >= T.passageWordsSoft[0] && words <= T.passageWordsSoft[1]);

  const sl = sentences(text).map(wc);
  if (sl.length) {
    const over40  = sl.filter((x) => x > 40).length / sl.length;
    const under12 = sl.filter((x) => x < 12).length / sl.length;
    const med = [...sl].sort((a, b) => a - b)[Math.floor(sl.length / 2)];
    check(over40 <= T.maxOver40Pct,
      `sentence rhythm: median ${med}w, ${pct(under12)} under 12w, ${pct(over40)} over 40w`,
      `sentence rhythm: ${pct(over40)} of sentences exceed 40 words (CAT 4%) — split them`);
    if (isPassage && under12 < T.minUnder12Pct) {
      warn(`only ${pct(under12)} of sentences are under 12 words (CAT 43%) — reads uniform/AI-ish`);
    }
  }

  const turns = (text.match(TURNS) || []).length;
  if (isPassage) {
    // Justified for a full ~518-word passage: 0 of 102 corpus passages had none, median 4.
    check(turns >= T.minTurns,
      `${turns} turn marker(s) (CAT median 4; 0 of 102 passages had none)`,
      `only ${turns} turn marker(s) — need ≥${T.minTurns}; a CAT passage always turns on itself`);
  } else {
    // NOT a per-drill requirement. Sliced into 100-word windows, 44% of real CAT
    // prose contains zero turn markers (median 1). A drill can turn structurally
    // ("It counted almost nothing that a census counts") without a marker word,
    // so demanding one per drill would reject half the real corpus. Monotony is
    // checked at batch level instead — see checkDrillBatchTurns().
    console.log(`  ${C.d}·${C.x} ${turns} turn marker(s) ${C.d}(CAT median 1 per 100 words; 44% have none)${C.x}`);
  }
  const bad = text.match(BANNED);
  check(!bad, "no banned AI-prose connectives",
    `banned connective(s): ${bad ? [...new Set(bad.map((s) => s.toLowerCase()))].join(", ") : ""}`);

  return turns;
}

// ── passage-specific ────────────────────────────────────────────────────────
function checkPassage(p) {
  head(`PASSAGE — ${p.title || "(untitled)"} [${p.topic}]`);
  const body = p.body || "";
  checkProse(body, { isPassage: true, label: "body" });

  const paras = body.split(/\n\s*\n/).filter((s) => s.trim());
  check(paras.length >= T.paragraphs[0] && paras.length <= T.paragraphs[1],
    `${paras.length} paragraphs`,
    `${paras.length} paragraphs — need ${T.paragraphs[0]}–${T.paragraphs[1]} separated by blank lines`);

  const present = Object.entries(TEXTURE).filter(([, re]) => re.test(body)).map(([k]) => k);
  check(present.length >= 4,
    `texture ${present.length}/10: ${present.join(", ")}`,
    `only ${present.length}/10 texture features — reads like a clean AI essay, not an edited excerpt`);

  // reading key
  let key = p.reading_key || p.readingKey || p.reading_key_json;
  if (typeof key === "string") { try { key = JSON.parse(key); } catch { key = null; } }
  if (!key || !Object.keys(key).length) {
    fail("reading_key missing or empty — the reading-map grader silently scores against nothing");
    return;
  }
  for (const f of ["thesis", "tone", "key_turn"]) {
    check(typeof key[f] === "string" && key[f].trim(), `reading_key.${f} present`,
      `reading_key.${f} missing or empty`);
  }
  const pf = key.paragraph_functions;
  check(Array.isArray(pf) && pf.length === paras.length,
    `paragraph_functions: ${Array.isArray(pf) ? pf.length : 0} entries, matches ${paras.length} paragraphs`,
    `paragraph_functions has ${Array.isArray(pf) ? pf.length : 0} entries but the body has ${paras.length} paragraphs — hard import rejection`);
}

// ── question-set checks (the three tells that condemned the old bank) ───────
function checkQuestionSet(rawQs, { context, isDrills }) {
  const qs = rawQs.map(normQ);
  head(`QUESTIONS — ${context} (n=${qs.length})`);

  // per-question structural sanity. Option-length gripes are rolled up: on a
  // 170-item batch, printing one line per option buries the summary that matters.
  const OPT_WARN_SHOWN = 5;
  let optOff = 0;
  qs.forEach((q, i) => {
    const n = q.options.length;
    if (n !== 4) fail(`Q${i + 1}: ${n} options (need exactly 4)`);
    if (!(q.correctIndex >= 0 && q.correctIndex < n)) fail(`Q${i + 1}: correctIndex ${q.correctIndex} out of range`);
    q.options.forEach((o, j) => {
      const w = wc(o.text);
      if (w < T.optionWords[0] || w > T.optionWords[1]) {
        optOff++;
        if (optOff <= OPT_WARN_SHOWN) warn(`Q${i + 1} option ${j}: ${w} words (CAT median 12, IQR 9–16)`);
      }
    });
  });
  if (optOff > OPT_WARN_SHOWN) {
    console.log(`  ${C.y}!${C.x} …and ${optOff - OPT_WARN_SHOWN} more option(s) outside ${T.optionWords[0]}–${T.optionWords[1]} words`);
  }

  // ── TELL 1: length correlated with correctness ──
  let longest = 0, shortest = 0;
  const rows = [];
  qs.forEach((q, i) => {
    const lens = q.options.map((o) => wc(o.text));
    const ci = q.correctIndex, mx = Math.max(...lens), mn = Math.min(...lens);
    const isL = lens[ci] === mx && lens.filter((l) => l === mx).length === 1;
    const isS = lens[ci] === mn && lens.filter((l) => l === mn).length === 1;
    if (isL) longest++;
    if (isS) shortest++;
    rows.push(`    Q${String(i + 1).padEnd(2)} ${String(q.type || "?").padEnd(14)} idx=${ci} lens=[${lens.join(",")}]${isL ? "  ← answer LONGEST" : ""}${isS ? "  ← answer shortest" : ""}`);
  });
  console.log(C.d + rows.join("\n") + C.x);

  const lShare = longest / qs.length;
  check(lShare <= T.maxLongestShare,
    `answer is the longest option in ${longest}/${qs.length} (${pct(lShare)}) — real CAT 20%`,
    `answer is the longest option in ${longest}/${qs.length} (${pct(lShare)}) — the old bank's 73% tell; real CAT is 20%`);
  // Proportional for anything but a tiny set: on n=170, "at least one" is no test
  // at all (the old bank scored 5/170 = 3% and would have passed a >=1 rule).
  const sShare = shortest / qs.length;
  if (qs.length >= 20) {
    check(sShare >= T.minShortestShare,
      `answer is the shortest option in ${shortest}/${qs.length} (${pct(sShare)}) — real CAT 16%`,
      `answer is the shortest option in only ${shortest}/${qs.length} (${pct(sShare)}) — real CAT 16%; length is still carrying signal`);
  } else {
    check(shortest >= 1,
      `answer is the shortest option in ${shortest}/${qs.length} — length carries no signal`,
      "answer is NEVER the shortest option — in real CAT it is 16% of the time");
  }

  // ── TELL 2: answer position ──
  // Check BOTH over- and under-representation. The old bank's {0:65,1:62,2:29,3:14}
  // has a 38% max — under a naive 40% cap — yet indices 2/3 are starved, which is
  // exactly the "answers cluster early" defect.
  const pos = {};
  qs.forEach((q) => { pos[q.correctIndex] = (pos[q.correctIndex] || 0) + 1; });
  const nOpts = Math.max(...qs.map((q) => q.options.length), 4);
  const counts = Array.from({ length: nOpts }, (_, i) => pos[i] || 0);
  const maxIdx = Math.max(...counts), minIdx = Math.min(...counts);
  const posOK = qs.length < 8
    ? maxIdx / qs.length <= T.maxIndexShare
    : maxIdx / qs.length <= T.maxIndexShare && minIdx / qs.length >= T.minIndexShare;
  check(posOK,
    `answer positions ${JSON.stringify(pos)} — spread (real CAT ~25% each)`,
    `answer positions ${JSON.stringify(pos)} — max ${pct(maxIdx / qs.length)}, min ${pct(minIdx / qs.length)}; real CAT is ~25% each. The old bank was 47% index-0, so "always pick A" scored 47%`);

  // ── TELL 3: type monoculture ──
  const types = qs.map((q) => q.type);
  const strong = types.filter((t) => STRONG_TYPES.includes(t)).length;
  const needStrong = isDrills ? Math.ceil(qs.length / 4) : 1;
  check(strong >= needStrong,
    `${strong} except_set/hypothetical item(s) — the two dominant CAT shapes`,
    `only ${strong} except_set/hypothetical — need ≥${needStrong}; EXCEPT alone is 25% of real CAT and the old bank had ZERO`);
  if (qs.length >= 4) {
    check(types.some((t) => FUNC_TYPES.includes(t)),
      "contains a function/author_intent question",
      "no function/author_intent question (together ~17% of real CAT)");
  }
  if (!isDrills) {
    check(types.includes("inference"), "contains an inference question", "no inference question");
  }
  const toneN = types.filter((t) => t === "tone").length;
  check(toneN <= 1, `tone questions: ${toneN} (real CAT: 3 in 9 years)`,
    `${toneN} tone questions — real CAT has ~1%; cap at 1`);
  const weak = types.filter((t) => WEAK_TYPES.includes(t)).length;
  if (weak / qs.length > 0.34) warn(`${pct(weak / qs.length)} of items are tone/title/detail — the easiest, rarest CAT shapes`);

  // quote-anchored stems (13% of real CAT)
  const quoted = qs.filter((q) => /["“][^"”]{10,}["”]/.test(q.question || "")).length;
  check(quoted >= 1, `${quoted} quote-anchored stem(s)`,
    "no stem quotes the passage verbatim (13% of real CAT stems do)");

  // trap archetype spread
  const tr = {};
  qs.forEach((q) => q.options.forEach((o) => { if (o.trapType) tr[o.trapType] = (tr[o.trapType] || 0) + 1; }));
  const tot = Object.values(tr).reduce((a, b) => a + b, 0);
  if (tot) {
    const m = Math.max(...Object.values(tr));
    check(m / tot <= T.maxTrapShare + 0.02,
      `trap spread, max archetype ${pct(m / tot)}`,
      `one archetype is ${pct(m / tot)} of traps — the old bank was 50% partially_correct; cap ~30%`);
  }
}

// ── payload dispatch ────────────────────────────────────────────────────────
function validatePayload(payload, srcLabel) {
  if (payload && Array.isArray(payload.questions) && Array.isArray(payload.passages)) {
    // admin export
    console.log(`\n${C.b}══ ${srcLabel} — admin export (${payload.passages.length} passages, ${payload.questions.length} questions) ══${C.x}`);
    payload.passages.forEach(checkPassage);
    const byPassage = {};
    payload.questions.forEach((q) => {
      const k = q.passage_id || q.passageId || "standalone drills";
      (byPassage[k] = byPassage[k] || []).push(q);
    });
    Object.entries(byPassage).forEach(([k, qs]) =>
      checkQuestionSet(qs, { context: `passage ${k}`, isDrills: k === "standalone drills" }));
    return;
  }

  const items = Array.isArray(payload) ? payload : [payload];
  items.forEach((it, i) => {
    const lbl = items.length > 1 ? `${srcLabel} [${i + 1}/${items.length}]` : srcLabel;
    if (it.kind === "passage_set") {
      console.log(`\n${C.b}══ ${lbl} — passage_set ══${C.x}`);
      checkPassage(it.passage || {});
      checkQuestionSet(it.questions || [], { context: "passage set", isDrills: false });
    } else if (it.kind === "drills") {
      console.log(`\n${C.b}══ ${lbl} — drills (${(it.items || []).length} items) ══${C.x}`);
      const turnCounts = [];
      (it.items || []).forEach((d, j) => {
        head(`DRILL ${j + 1} [${d.topic} · ${d.difficulty || "?"}]`);
        if (!d.difficulty) fail("missing required `difficulty` (easy|medium|tough)");
        turnCounts.push(checkProse(d.paragraph || "", { isPassage: false, label: "paragraph" }));
      });
      // Batch-level, not per-drill: real CAT prose has a marker in 56% of its
      // 100-word windows, so a batch where almost nothing turns lexically reads
      // flat even if each drill is individually defensible.
      if (turnCounts.length >= 4) {
        const withTurn = turnCounts.filter((n) => n >= 1).length;
        const share = withTurn / turnCounts.length;
        head("BATCH prose");
        check(share >= T.minDrillTurnShare,
          `${withTurn}/${turnCounts.length} drills carry a turn marker (${pct(share)}; real CAT 56%)`,
          `only ${withTurn}/${turnCounts.length} drills carry a turn marker (${pct(share)}) — real CAT is 56%; the batch reads flat`);
      }
      checkQuestionSet(it.items || [], { context: "drills batch", isDrills: true });
    } else {
      fail(`${lbl}: unrecognised payload — need kind "passage_set" or "drills", or an admin export`);
    }
  });
}

// ── main ────────────────────────────────────────────────────────────────────
const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node content-pipeline/validate-content.js <file.json> [more.json ...]");
  process.exit(2);
}
for (const f of files) {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    console.error(`${C.r}cannot read ${f}${C.x}: ${e.message}`);
    FAILS++;
    continue;
  }
  validatePayload(payload, f.split("/").pop());
}

console.log(`\n${C.b}${"─".repeat(60)}${C.x}`);
if (FAILS) console.log(`${C.r}${C.b}${FAILS} FAIL(S)${C.x}${WARNS ? `, ${WARNS} warning(s)` : ""} — fix before importing.`);
else if (WARNS) console.log(`${C.y}${C.b}PASS with ${WARNS} warning(s)${C.x} — review, then import.`);
else console.log(`${C.g}${C.b}ALL CHECKS PASS${C.x} — ready to import.`);
console.log(`${C.d}thresholds: content-pipeline/CORPUS_STUDY.md${C.x}`);
process.exit(FAILS ? 1 : 0);
