import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Input, Textarea } from "../../components/ui/input.jsx";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { QUESTION } from "../../lib/limits.js";
import { Select } from "../../components/ui/select.jsx";

// Keep in sync with server/lib/validateQuestion.js VALID_TYPES / VALID_TRAPS.
const TYPES = ["inference", "except_set", "hypothetical", "function", "assumption",
  "application", "vocab_in_context", "main_idea", "concept_set", "weaken_strengthen",
  "tone", "detail", "title"];
const TOPICS = ["economics", "history", "humanities", "philosophy", "science", "social"];
const DIFFICULTIES = ["easy", "medium", "tough"];
const TRAP_TYPES = ["too_extreme", "out_of_scope", "too_broad", "partially_correct",
  "tone_mismatch", "real_but_unstated", "distortion", "wrong_question", "wrong_location",
  "mislabelled", "wordplay"];
const LETTERS = ["A", "B", "C", "D"];

function blankQuestion() {
  return {
    topic: "economics",
    type: "inference",
    difficulty: "medium",
    paragraph: "",
    question: "",
    options: [
      { text: "" }, { text: "" }, { text: "" }, { text: "" },
    ],
    correctIndex: 0,
    trapIndex: 1,
    trapType: "too_extreme",
    sourceLines: "",
  };
}

export default function AdminQuestionEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const [q, setQ] = useState(isNew ? blankQuestion() : null);
  const [flags, setFlags] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    admin.getQuestion(id).then(({ question, flags }) => {
      setQ({
        topic: question.topic,
        type: question.type,
        difficulty: question.difficulty || "medium",
        paragraph: question.paragraph,
        question: question.question,
        options: question.options.map(o => ({ text: o.text })),
        correctIndex: question.correctIndex,
        trapIndex: question.trapIndex,
        trapType: question.trapType,
        sourceLines: question.sourceLines,
      });
      setIsActive(question.isActive);
      setFlags(flags);
    }).catch((e) => setError(e.message));
  }, [id, isNew]);

  if (!q) return <p className="text-muted-foreground">Loading…</p>;

  function setOptionText(i, text) {
    setQ(prev => ({ ...prev, options: prev.options.map((o, j) => j === i ? { ...o, text } : o) }));
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const payload = {
        topic: q.topic,
        type: q.type,
        difficulty: q.difficulty,
        paragraph: q.paragraph,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        trapIndex: q.trapIndex,
        trapType: q.trapType,
        sourceLines: q.sourceLines,
      };
      if (isNew) {
        const { id: newId } = await admin.createQuestion(payload);
        navigate(`/admin/questions/${newId}`, { replace: true });
      } else {
        await admin.updateQuestion(id, payload);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await admin.updateQuestion(id, { isActive: !isActive });
      setIsActive(v => !v);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function flagThis() {
    const reason = prompt("Reason for flagging this question?");
    if (reason == null) return;
    setBusy(true);
    try {
      await admin.flagQuestion(id, reason);
      const { flags } = await admin.getQuestion(id);
      setFlags(flags);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/admin/questions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to questions
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          {isNew ? "New question" : `Edit ${id}`}
        </h1>
      </div>

      {flags.length > 0 && (
        <Card><CardContent className="p-4">
          <div className="text-sm font-semibold mb-2">Flags ({flags.length})</div>
          <ul className="space-y-1">
            {flags.map(f => (
              <li key={f.id} className="text-xs flex items-center gap-2">
                <Badge variant={f.status === "open" ? "warning" : "secondary"}>{f.status}</Badge>
                <span className="text-muted-foreground">{f.source}:</span>
                <span className="text-foreground">{f.reason || "(no reason)"}</span>
              </li>
            ))}
          </ul>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Topic">
            <Select value={q.topic} onChange={v => setQ(p => ({...p, topic: v}))} options={TOPICS} />
          </Field>
          <Field label="Type">
            <Select value={q.type} onChange={v => setQ(p => ({...p, type: v}))} options={TYPES} />
          </Field>
          <Field label="Difficulty">
            <Select value={q.difficulty || "medium"} onChange={v => setQ(p => ({...p, difficulty: v}))} options={DIFFICULTIES} />
          </Field>
        </div>

        <Field label="Paragraph">
          <Textarea rows={6} value={q.paragraph}
            onChange={e => setQ(p => ({...p, paragraph: e.target.value}))}
            maxLength={QUESTION.PARAGRAPH_MAX}
            placeholder="The short passage (90–120 words)…" />
        </Field>

        <Field label="Question">
          <Textarea rows={2} value={q.question}
            onChange={e => setQ(p => ({...p, question: e.target.value}))}
            maxLength={QUESTION.QUESTION_MAX}
            placeholder="Which of the following…?" />
        </Field>

        <div>
          <div className="text-sm font-medium text-foreground mb-1">Options</div>
          <p className="text-xs text-muted-foreground mb-2">
            Pick the correct option and the trap. The other two are distractors.
          </p>
          <div className="space-y-2">
            {q.options.map((o, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-none w-8 pt-3 text-center font-bold text-muted-foreground">{LETTERS[i]}</div>
                <div className="flex-1">
                  <Textarea rows={2} value={o.text}
                    onChange={e => setOptionText(i, e.target.value)}
                    maxLength={QUESTION.OPTION_MAX} />
                  <div className="mt-1 flex gap-3 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="correct" checked={q.correctIndex === i}
                        onChange={() => setQ(p => ({...p, correctIndex: i, trapIndex: p.trapIndex === i ? null : p.trapIndex}))} />
                      Correct
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="trap"
                        checked={q.trapIndex === i}
                        onChange={() => setQ(p => ({...p, trapIndex: i}))} />
                      Trap
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {q.trapIndex != null && (
          <Field label="Trap type">
            <Select value={q.trapType || ""} onChange={v => setQ(p => ({...p, trapType: v}))} options={TRAP_TYPES} />
          </Field>
        )}

        <Field label="Source lines (from the paragraph, where the answer comes from)">
          <Textarea rows={3} value={q.sourceLines}
            onChange={e => setQ(p => ({...p, sourceLines: e.target.value}))}
            maxLength={QUESTION.SOURCE_LINES_MAX}
            placeholder="The exact 2–4 sentences that justify the correct answer (server-only)" />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button disabled={busy} onClick={save}>
            {busy ? "Saving…" : isNew ? "Create question" : "Save changes"}
          </Button>
          {!isNew && (
            <>
              <Button variant="outline" disabled={busy} onClick={toggleActive}>
                {isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={flagThis}>
                Flag for review
              </Button>
            </>
          )}
        </div>
      </CardContent></Card>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
