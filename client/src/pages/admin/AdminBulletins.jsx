// Admin CRUD for the "important updates" bulletins shown on the logged-in
// homepage. New bulletins are active by default; toggling active/inactive
// keeps history instead of deleting it - Delete is a separate, permanent action.
import { useEffect, useState } from "react";
import { admin } from "../../api.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.jsx";
import { Input, Textarea } from "../../components/ui/input.jsx";
import { Button } from "../../components/ui/button.jsx";
import { MISC } from "../../lib/limits.js";

function fmtDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function emptyDraft(b) {
  return { title: b?.title ?? "", body: b?.body ?? "", isActive: b?.is_active ?? true };
}

export default function AdminBulletins() {
  const [bulletins, setBulletins] = useState(null);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({}); // id -> { title, body, isActive }
  const [busyId, setBusyId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [newDraft, setNewDraft] = useState({ title: "", body: "" });
  const [creating, setCreating] = useState(false);

  function load() {
    setError(null);
    admin.listBulletins()
      .then((data) => {
        setBulletins(data.bulletins);
        setDrafts(Object.fromEntries(data.bulletins.map((b) => [b.id, emptyDraft(b)])));
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function dirty(b) {
    const d = drafts[b.id];
    if (!d) return false;
    return d.title !== b.title || d.body !== b.body || d.isActive !== b.is_active;
  }

  async function save(b) {
    setBusyId(b.id);
    setError(null);
    try {
      const d = drafts[b.id];
      await admin.saveBulletin(b.id, d.title, d.body, d.isActive);
      setSavedId(b.id);
      setTimeout(() => setSavedId((id) => (id === b.id ? null : id)), 2000);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(b) {
    if (!window.confirm(`Delete "${b.title}" permanently?`)) return;
    setBusyId(b.id);
    setError(null);
    try {
      await admin.deleteBulletin(b.id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function create() {
    if (!newDraft.title.trim() || !newDraft.body.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await admin.createBulletin(newDraft.title.trim(), newDraft.body.trim());
      setNewDraft({ title: "", body: "" });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  if (error && !bulletins) {
    return <div className="max-w-3xl mx-auto py-8 text-center text-destructive">{error}</div>;
  }
  if (!bulletins) {
    return <div className="max-w-3xl mx-auto py-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Bulletins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Post "important updates" shown in a box on the logged-in homepage. Up to the 5 most recent
          active bulletins are shown, newest first.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New bulletin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Title"
            maxLength={MISC.BULLETIN_TITLE_MAX}
            value={newDraft.title}
            onChange={(e) => setNewDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <Textarea
            placeholder="Body"
            rows={3}
            maxLength={MISC.BULLETIN_BODY_MAX}
            value={newDraft.body}
            onChange={(e) => setNewDraft((d) => ({ ...d, body: e.target.value }))}
          />
          <Button size="sm" disabled={creating || !newDraft.title.trim() || !newDraft.body.trim()} onClick={create}>
            {creating ? "Posting…" : "Post bulletin"}
          </Button>
        </CardContent>
      </Card>

      {bulletins.map((b) => {
        const d = drafts[b.id] ?? emptyDraft(b);
        const isDirty = dirty(b);
        return (
          <Card key={b.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{b.title}</CardTitle>
                {b.is_active ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Posted by {b.created_by_username || "unknown"} · {fmtDateTime(b.created_at)}
                {b.updated_at !== b.created_at && ` · edited ${fmtDateTime(b.updated_at)}`}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input
                  value={d.title}
                  onChange={(e) => setDrafts((s) => ({ ...s, [b.id]: { ...d, title: e.target.value } }))}
                />
                <Textarea
                  rows={3}
                  value={d.body}
                  onChange={(e) => setDrafts((s) => ({ ...s, [b.id]: { ...d, body: e.target.value } }))}
                />
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={d.isActive}
                    onChange={(e) => setDrafts((s) => ({ ...s, [b.id]: { ...d, isActive: e.target.checked } }))}
                  />
                  Active
                </label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" disabled={!isDirty || busyId === b.id} onClick={() => save(b)}>
                  {busyId === b.id ? "Saving…" : savedId === b.id ? "Saved ✓" : "Save"}
                </Button>
                {isDirty && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setDrafts((s) => ({ ...s, [b.id]: emptyDraft(b) }))}
                  >
                    Discard changes
                  </button>
                )}
                <button
                  className="ml-auto text-xs text-destructive hover:underline"
                  disabled={busyId === b.id}
                  onClick={() => remove(b)}
                >
                  Delete
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {bulletins.length === 0 && (
        <p className="text-sm text-muted-foreground">No bulletins yet - post one above.</p>
      )}
    </div>
  );
}
