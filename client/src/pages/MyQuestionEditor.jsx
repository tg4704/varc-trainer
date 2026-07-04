import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { myQuestions } from "../api.js";
import { Textarea } from "../components/ui/input.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Sparkles } from "lucide-react";

const TYPES = ["inference", "tone", "title", "detail", "application"];
const TOPICS = ["economics", "humanities", "philosophy", "science", "social"];
const TRAP_TYPES = ["too_extreme", "out_of_scope", "real_but_unstated", "partially_correct"];
const LETTERS = ["A", "B", "C", "D"];

function blankForm(passage = "") {
  return {
    topic: "humanities",
    type: "inference",
    paragraph: passage,
    question: "",
    options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
    correctIndex: 0,
    trapIndex: 1,
    trapType: "too_extreme",
    sourceLines: "",
  };
}

// ── AI-draft entry screen ──────────────────────────────────────────────────
function DraftEntry({ onDraft }) {
  const [passage, setPassage] = useState("");
  const [type, setType] = useState("inference");
  const [topic, setTopic] = useState("humanities");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wordCount = passage.trim().split(/\s+/).filter(Boolean).length;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const { draft } = await myQuestions.generateDraft({ paragraph: passage, type, topic });
      onDraft(draft);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-recessed flex items-start gap-3 px-4 py-3" style={{ borderLeft: "2px solid var(--teal)" }}>
        <Sparkles className="h-4 w-4 mt-0.5 flex-none" style={{ color: "var(--teal)" }} />
        <div className="text-sm text-foreground">
          <span className="font-semibold">AI draft:</span> paste a passage from any source
          (an old CAT paper, a long-form essay, anywhere) and Claude will generate a
          CAT-quality question with 4 options, mark the correct answer and trap, and
          identify the source lines. You review and edit before saving.
        </div>
      </div>

      <label className="block">
        <span className="field-label">Paste your passage</span>
        <Textarea
          rows={8}
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          placeholder="Paste any dense, argument-driven paragraph (90-500 words)…"
          className="resize-none"
        />
        <div className="mt-1 text-right text-xs" style={{ color: wordCount >= 50 ? "var(--green)" : "var(--text-2)" }}>
          {wordCount} words {wordCount < 50 && "(need at least 50)"}
        </div>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Question type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Topic</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="input">
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <button disabled={wordCount < 50 || loading} onClick={generate} className="btn btn-primary fx-sheen">
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#07130E", borderTopColor: "transparent" }} />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate draft
            </>
          )}
        </button>
        <button onClick={() => onDraft(null)} className="btn btn-glass fx-ring">
          Write manually instead
        </button>
      </div>
    </div>
  );
}

// ── Question form ──────────────────────────────────────────────────────────
function QuestionForm({ initial, onSave, onDelete, isNew }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }
  function setOptionText(i, text) {
    setForm(prev => ({ ...prev, options: prev.options.map((o, j) => j === i ? { ...o, text } : o) }));
  }

  async function save() {
    setBusy(true); setError(null);
    try { await onSave(form); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function del() {
    if (!onDelete) return;
    setBusy(true);
    try { await onDelete(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="glass p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Topic</span>
          <select value={form.topic} onChange={e => setField("topic", e.target.value)} className="input">
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Question type</span>
          <select value={form.type} onChange={e => setField("type", e.target.value)} className="input">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="field-label">Passage</span>
        <Textarea rows={6} value={form.paragraph}
          onChange={e => setField("paragraph", e.target.value)}
          placeholder="The passage text (90-500 words)…" className="resize-none" />
      </label>

      <label className="block">
        <span className="field-label">Question</span>
        <Textarea rows={2} value={form.question}
          onChange={e => setField("question", e.target.value)}
          placeholder="Which of the following…?" className="resize-none" />
      </label>

      {/* Options */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium text-foreground">Options</div>
          <button
            type="button"
            onClick={() => setShowAnswer((v) => !v)}
            className="fx-underline text-xs"
            style={{ color: "var(--teal)" }}
          >
            {showAnswer ? "Hide answer" : "Show answer"}
          </button>
        </div>
        {showAnswer && (
          <p className="text-xs muted mb-2">Mark which option is correct and which is the trap.</p>
        )}
        <div className="space-y-3">
          {form.options.map((o, i) => {
            const isCorrect = showAnswer && form.correctIndex === i;
            const isTrap = showAnswer && form.trapIndex === i;
            return (
              <div
                key={i}
                className="rounded-[12px] p-3 transition-colors"
                style={
                  isCorrect ? { background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.4)" }
                    : isTrap ? { background: "rgba(240,168,104,0.06)", border: "1px solid rgba(240,168,104,0.4)" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }
                }
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold muted w-5">{LETTERS[i]}</span>
                  {showAnswer && (
                    <div className="flex gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="correct" checked={form.correctIndex === i}
                          onChange={() => setField("correctIndex", i)} className="accent-green-500" />
                        <span className="font-medium" style={{ color: "var(--green)" }}>Correct</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="trap"
                          checked={form.trapIndex === i}
                          onChange={() => setField("trapIndex", i)} className="accent-amber-500" />
                        <span className="font-medium" style={{ color: "var(--amber)" }}>Trap</span>
                      </label>
                      {(form.correctIndex !== i && form.trapIndex !== i) && (
                        <span className="muted">Distractor</span>
                      )}
                    </div>
                  )}
                </div>
                <Textarea rows={2} value={o.text}
                  onChange={e => setOptionText(i, e.target.value)}
                  placeholder={`Option ${LETTERS[i]}…`} className="resize-none text-sm" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Trap type — only visible when showing answer */}
      {showAnswer && form.trapIndex != null && (
        <label className="block">
          <span className="field-label">Trap type</span>
          <select value={form.trapType || ""} onChange={e => setField("trapType", e.target.value)} className="input">
            {TRAP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      {/* Source lines — only visible when showing answer */}
      {showAnswer && (
        <label className="block">
          <span className="field-label">
            Source lines
            <span className="ml-1 dim font-normal">
              (the 2-4 sentences in the passage that contain the answer, used internally)
            </span>
          </span>
          <Textarea rows={3} value={form.sourceLines}
            onChange={e => setField("sourceLines", e.target.value)}
            placeholder="The exact sentences from the passage that justify the correct answer…"
            className="resize-none" />
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
        <button disabled={busy} onClick={save} className="btn btn-primary fx-sheen">
          {busy ? "Saving…" : isNew ? "Save question" : "Save changes"}
        </button>
        {!isNew && onDelete && (
          <button
            disabled={busy}
            onClick={del}
            className="btn"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", color: "var(--red)" }}
          >
            Delete question
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MyQuestionEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  // For new questions: 'pick' (method picker) | 'ai' (AI draft entry) | 'form' (manual/post-draft)
  const [mode, setMode] = useState(isNew ? "pick" : "form");
  const [initial, setInitial] = useState(isNew ? null : null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    myQuestions.get(id)
      .then(({ question: q }) => {
        setInitial({
          topic: q.topic,
          type: q.type,
          paragraph: q.paragraph,
          question: q.question,
          options: q.options.map(o => ({ text: o.text })),
          correctIndex: q.correctIndex,
          trapIndex: q.trapIndex,
          trapType: q.trapType,
          sourceLines: q.sourceLines,
        });
        setMode("form");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function handleDraft(draft) {
    if (draft) {
      setInitial(draft);
      setMode("form");
    } else {
      setInitial(blankForm());
      setMode("form");
    }
  }

  async function handleSave(form) {
    if (isNew) {
      const { id: newId } = await myQuestions.create(form);
      navigate(`/my-questions/${newId}`, { replace: true });
    } else {
      await myQuestions.update(id, form);
      navigate("/my-questions");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this question? It will be removed from your sessions.")) return;
    await myQuestions.remove(id);
    navigate("/my-questions");
  }

  if (loading) return <p className="muted px-4 py-10">Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link to="/my-questions" className="fx-underline text-sm muted">
          ← My questions
        </Link>
        <h1 className="mt-2 display text-[28px] leading-none">
          {isNew ? "Add question" : "Edit question"}
        </h1>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Method picker — only for new questions */}
      {mode === "pick" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode("ai")}
            className="glass glasscard p-6 text-left"
            style={{ borderColor: "rgba(93,202,165,0.3)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5" style={{ color: "var(--teal)" }} />
              <span className="font-semibold text-foreground">AI-assisted</span>
              <Badge variant="default" className="text-xs">Recommended</Badge>
            </div>
            <p className="text-sm muted">
              Paste a passage. Claude generates the question, 4 options, marks correct and trap, and finds the source lines. You review and edit.
            </p>
          </button>
          <button
            onClick={() => { setInitial(blankForm()); setMode("form"); }}
            className="glass glasscard p-6 text-left"
          >
            <div className="mb-2 font-semibold text-foreground">Write manually</div>
            <p className="text-sm muted">
              Fill in everything yourself: passage, question, 4 options, mark correct and trap.
            </p>
          </button>
        </div>
      )}

      {mode === "ai" && <DraftEntry onDraft={handleDraft} />}

      {mode === "form" && initial && (
        <QuestionForm
          initial={initial}
          isNew={isNew}
          onSave={handleSave}
          onDelete={!isNew ? handleDelete : null}
        />
      )}
    </div>
  );
}
