import { useState } from "react";
import { admin } from "../../api.js";

// Paste JSON produced in Claude chat (see content-pipeline/GENERATION_KIT.md) and import it.
// Everything lands inactive (is_active=0) for review under Admin → Questions (active=0 filter).
export default function AdminImport() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleImport() {
    setError("");
    setResult(null);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      setError("Invalid JSON — check for a stray comma or unquoted value. " + e.message);
      return;
    }
    if (!payload || (payload.kind !== "passage_set" && payload.kind !== "drills")) {
      setError('JSON must have "kind": "passage_set" or "drills".');
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
          <strong>inactive</strong> — review them under{" "}
          <a href="/admin/questions?active=0" className="text-primary underline">Questions (inactive)</a>{" "}
          and activate the good ones.
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
    </div>
  );
}
