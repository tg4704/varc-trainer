import { useState } from "react";
import { admin } from "../../api.js";
import { MISC } from "../../lib/limits.js";

// Paste JSON produced in Claude chat (see content-pipeline/GENERATION_KIT.md) and import it.
// Everything lands inactive (is_active=0) for review under Admin → Questions (active=0 filter).
export default function AdminImport() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // ── Export ──────────────────────────────────────────────────────────────
  const [expSource, setExpSource] = useState("ai_generated,coach");
  const [expActive, setExpActive] = useState(""); // "" = all, "1", "0"
  const [expBusy, setExpBusy] = useState(false);
  const [expError, setExpError] = useState("");
  const [expInfo, setExpInfo] = useState(null);

  async function handleExport() {
    setExpError("");
    setExpInfo(null);
    setExpBusy(true);
    try {
      const data = await admin.exportContent({ source: expSource, active: expActive });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = data.exportedAt.slice(0, 10);
      a.href = url;
      a.download = `graspr-content-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExpInfo(data.counts);
    } catch (e) {
      setExpError(e.message);
    } finally {
      setExpBusy(false);
    }
  }

  async function handleImport() {
    setError("");
    setResult(null);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      setError("Invalid JSON: check for a stray comma or unquoted value. " + e.message);
      return;
    }
    const items = Array.isArray(payload) ? payload : [payload];
    const badItem = items.find((it) => !it || (it.kind !== "passage_set" && it.kind !== "drills"));
    if (!items.length || badItem) {
      setError('Each item must have "kind": "passage_set" or "drills". You can paste a single object or an array of them.');
      return;
    }
    // express.json({ limit: "100kb" }) would reject this with a bare 413 whose
    // message says nothing about what to do. Batching several passage_sets in
    // one paste is the normal way to hit it, so name the fix explicitly.
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > MISC.JSON_IMPORT_MAX_BYTES) {
      setError(
        `Too large to import in one go: ${(bytes / 1024).toFixed(0)}KB, limit is ` +
        `${MISC.JSON_IMPORT_MAX_BYTES / 1024}KB. Split it into ${Math.ceil(bytes / MISC.JSON_IMPORT_MAX_BYTES)} ` +
        `smaller pastes (${items.length} items here) and import them one at a time.`
      );
      return;
    }
    setBusy(true);
    try {
      const res = await admin.importContent(payload);
      setResult(res);
      if (!res.errors?.length) setText(""); // clear only on a fully clean import
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl text-foreground">Import content</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste JSON generated in Claude chat (Opus 4.8) using the prompts in{" "}
          <code className="text-xs">content-pipeline/GENERATION_KIT.md</code>. Items are imported{" "}
          <strong>inactive</strong>, review drills under{" "}
          <a href="/admin/questions?active=0" className="text-primary underline">Questions (inactive)</a>.
          For <code>passage_set</code> imports, activating the questions is not enough: the{" "}
          <strong>passage itself</strong> also gates whether it shows up in Coach; activate it
          separately under{" "}
          <a href="/admin/passages?active=0" className="text-primary underline">Passages (inactive)</a>.
          You can paste a single object or a JSON array of several (e.g. multiple{" "}
          <code>passage_set</code>s generated together).
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ "kind": "passage_set", "passage": { ... }, "questions": [ ... ] }'
        spellCheck={false}
        className="w-full h-80 rounded-lg border border-border bg-card p-3 font-mono text-xs text-foreground
                   focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={busy || !text.trim()}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium
                     disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
        <span className="text-xs text-muted-foreground">
          Accepts one <code>passage_set</code> or a <code>drills</code> batch per import.
          Each <code>drills</code> item requires a <code>difficulty</code> of{" "}
          <code>easy</code>, <code>medium</code>, or <code>tough</code>.
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-border bg-card p-4 space-y-2 text-sm">
          <div className="text-foreground font-medium">
            Imported: {result.passagesInserted} passage{result.passagesInserted === 1 ? "" : "s"},{" "}
            {result.questionsInserted} question{result.questionsInserted === 1 ? "" : "s"}.
          </div>
          {result.errors?.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-1">Skipped {result.errors.length} item(s):</div>
              <ul className="list-disc pl-5 text-destructive space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          ) : (
            <div className="text-muted-foreground">No errors. Review &amp; activate under Questions.</div>
          )}
        </div>
      )}

      {/* ── Export ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border pt-5 space-y-3">
        <div>
          <h2 className="font-display text-xl text-foreground">Export content</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Download passages and questions as a JSON file for offline review / quality auditing.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Source
            <select
              value={expSource}
              onChange={(e) => setExpSource(e.target.value)}
              className="mt-1 block rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All sources</option>
              <option value="ai_generated,coach">AI-generated + Coach</option>
              <option value="ai_generated">AI-generated only</option>
              <option value="coach">Coach only</option>
              <option value="seed">Seed only</option>
              <option value="user">User-authored only</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Status
            <select
              value={expActive}
              onChange={(e) => setExpActive(e.target.value)}
              className="mt-1 block rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">Active + inactive</option>
              <option value="1">Active only</option>
              <option value="0">Inactive only</option>
            </select>
          </label>
          <button
            onClick={handleExport}
            disabled={expBusy}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {expBusy ? "Exporting…" : "Export JSON"}
          </button>
        </div>
        {expError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {expError}
          </div>
        )}
        {expInfo && (
          <div className="text-sm text-muted-foreground">
            Downloaded {expInfo.passages} passage{expInfo.passages === 1 ? "" : "s"} and{" "}
            {expInfo.questions} question{expInfo.questions === 1 ? "" : "s"}.
          </div>
        )}
      </div>
    </div>
  );
}
