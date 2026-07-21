// Edit the AI system prompts (server/ai/prompts.js) without a redeploy. A
// prompt with no DB override falls back to its hardcoded default - "Reset to
// default" just deletes the override row rather than needing to know/paste
// the original text back in.
import { useEffect, useState } from "react";
import { admin } from "../../api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card.jsx";
import { Textarea } from "../../components/ui/input.jsx";
import { Button } from "../../components/ui/button.jsx";

function fmtDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState(null);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({}); // key -> edited content
  const [busyKey, setBusyKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  function load() {
    setError(null);
    admin.listPrompts()
      .then((data) => {
        setPrompts(data.prompts);
        setDrafts(Object.fromEntries(data.prompts.map((p) => [p.key, p.content])));
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function save(key) {
    setBusyKey(key);
    setError(null);
    try {
      await admin.savePrompt(key, drafts[key]);
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function resetToDefault(key) {
    setBusyKey(key);
    setError(null);
    try {
      await admin.resetPrompt(key);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  if (error && !prompts) {
    return (
      <div className="max-w-3xl mx-auto py-8 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (!prompts) {
    return <div className="max-w-3xl mx-auto py-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">AI Prompts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit the system prompts every AI call uses. Changes take effect on the next AI call - no
          redeploy needed.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {prompts.map((p) => {
        const dirty = drafts[p.key] !== p.content;
        return (
          <Card key={p.key}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <CardDescription className="mt-1">{p.description}</CardDescription>
                </div>
                {p.isCustom ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    Customized
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Default
                  </span>
                )}
              </div>
              {p.isCustom && p.updatedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last edited {fmtDateTime(p.updatedAt)}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Textarea
                value={drafts[p.key] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
                rows={10}
                className="font-mono text-xs"
              />
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!dirty || busyKey === p.key}
                  onClick={() => save(p.key)}
                >
                  {busyKey === p.key ? "Saving…" : savedKey === p.key ? "Saved ✓" : "Save"}
                </Button>
                {p.isCustom && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyKey === p.key}
                    onClick={() => resetToDefault(p.key)}
                  >
                    Reset to default
                  </Button>
                )}
                {dirty && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setDrafts((d) => ({ ...d, [p.key]: p.content }))}
                  >
                    Discard changes
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
