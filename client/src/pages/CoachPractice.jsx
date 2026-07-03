// ② Coach — practice screen. Flow per session:
//   1. Reading phase: full passage shown; student submits a reading map (crux words
//      per paragraph, or a fuller summary) BEFORE seeing any question. AI grades the
//      reading process — this is the differentiator (see content-pipeline/READING_GRADER.md).
//   2. Questions phase: passage stays visible; each question is answered with reasoning,
//      graded by AI (reused FeedbackSections component), with an optional "Stuck? Discuss"
//      follow-up chat once the verdict is shown.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { saveActiveCoachSession, clearActiveCoachSession } from "../coachSession.js";
import OptionCard from "../components/OptionCard.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import FeedbackSections from "../components/FeedbackSections.jsx";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/utils.js";
import { coach } from "../api.js";

const LETTERS = ["A", "B", "C", "D"];
const MAX_DISCUSS = 4;

export default function CoachPractice() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = params.get("sessionId");

  const [coachSession, setCoachSession] = useState(location.state?.coachSession || null);
  const [attempts, setAttempts] = useState({}); // questionId -> attempt/verdict
  const [loading, setLoading] = useState(!location.state?.coachSession);
  const [error, setError] = useState(null);

  // Reading-map form state — row counts are derived from the passage's actual
  // paragraph count (split on blank lines) so the student maps exactly as many
  // paragraphs as the passage has, no more, no fewer.
  const [mapMode, setMapMode] = useState("quick");
  const [cruxRows, setCruxRows] = useState([]);
  const [mainPoint, setMainPoint] = useState("");
  const [tone, setTone] = useState("");
  const [structureRows, setStructureRows] = useState([]);
  const [theTurn, setTheTurn] = useState("");
  const [gradingMap, setGradingMap] = useState(false);

  // Question phase state
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [reasoningText, setReasoningText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Discuss chat state (per current question)
  const [discussOpen, setDiscussOpen] = useState(false);
  const [discussInput, setDiscussInput] = useState("");
  const [discussSending, setDiscussSending] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (sessionId) saveActiveCoachSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (coachSession || !sessionId) return;
    (async () => {
      try {
        const { coachSession: s, attempts: a } = await coach.getSession(sessionId);
        setCoachSession(s);
        const byQ = {};
        (a || []).forEach((att) => { byQ[att.question_id] = attemptToVerdict(att); });
        setAttempts(byQ);
        const firstUnanswered = s.questions.findIndex((q) => !byQ[q.id]);
        if (firstUnanswered >= 0) setQIdx(firstUnanswered);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, coachSession]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [attempts, discussOpen]);

  // Size the reading-map rows to the passage's actual paragraph count (split on
  // blank lines) — the student maps exactly as many paragraphs as exist, no more.
  useEffect(() => {
    const body = coachSession?.passage?.body;
    if (!body) return;
    const paraCount = Math.max(1, body.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean).length);
    setCruxRows(Array(paraCount).fill(""));
    setStructureRows(Array(paraCount).fill(""));
  }, [coachSession?.passage?.body]);

  // Reset per-question transient state when moving between questions
  useEffect(() => {
    setSelected(null);
    setReasoningText("");
    setDiscussOpen(false);
    setDiscussInput("");
    setError(null);
  }, [qIdx]);

  // Note: trapOptionIndex is intentionally NOT set here — the server already reveals
  // question.trapIndex for any attempted question (see GET /coach/sessions/:id), so
  // the render below reads it from `question.trapIndex` directly instead.
  function attemptToVerdict(a) {
    return {
      correctOptionIndex: a.correct_option_index,
      selectedOptionIndex: a.selected_option_index,
      trapType: a.trap_type,
      isCorrect: !!a.is_correct,
      skipped: false,
      reasoningScore: a.reasoning_score,
      reasoningFeedback: a.reasoning_feedback,
      correctExplanation: a.correct_explanation,
      trapExplanation: a.trap_explanation,
      keyTakeaway: a.key_takeaway,
      discussConversation: a.discussConversation || [],
      exchangeCount: a.exchange_count || 0,
    };
  }

  async function submitReadingMap() {
    setGradingMap(true);
    setError(null);
    try {
      const body = mapMode === "quick"
        ? { mode: "quick", crux: cruxRows }
        : { mode: "full", mainPoint, tone, structure: structureRows, theTurn };
      const { readingMap, readingGrade } = await coach.submitReadingMap(coachSession.id, body);
      setCoachSession((s) => ({ ...s, readingMap, readingGrade }));
    } catch (e) {
      setError(e.message);
    } finally {
      setGradingMap(false);
    }
  }

  const question = coachSession?.questions?.[qIdx];

  async function submitAnswer() {
    if (selected === null || !question || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const verdict = await coach.submitAttempt({
        coachSessionId: coachSession.id,
        questionId: question.id,
        questionIndex: qIdx,
        selectedOptionIndex: selected,
        reasoningText: reasoningText.trim() || undefined,
      });
      setAttempts((prev) => ({ ...prev, [question.id]: { ...verdict, discussConversation: [], exchangeCount: 0 } }));
      // Reveal the answer key on the question object too (type badge etc.)
      setCoachSession((s) => ({
        ...s,
        questions: s.questions.map((q, i) => i === qIdx
          ? { ...q, correctIndex: verdict.correctOptionIndex, trapIndex: verdict.trapOptionIndex, trapType: verdict.trapType, sourceLines: verdict.sourceLines }
          : q),
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const sendDiscussMessage = useCallback(async () => {
    if (!discussInput.trim() || discussSending || !question) return;
    setDiscussSending(true);
    const msg = discussInput.trim();
    const current = attempts[question.id];
    const optimistic = { ...current, discussConversation: [...(current.discussConversation || []), { role: "student", text: msg }] };
    setAttempts((prev) => ({ ...prev, [question.id]: optimistic }));
    setDiscussInput("");
    try {
      const { reply, exchangeCount } = await coach.exchange({ coachSessionId: coachSession.id, questionId: question.id, message: msg });
      setAttempts((prev) => ({
        ...prev,
        [question.id]: { ...prev[question.id], discussConversation: [...optimistic.discussConversation, { role: "coach", text: reply }], exchangeCount },
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setDiscussSending(false);
    }
  }, [discussInput, discussSending, question, attempts, coachSession]);

  async function nextQuestion() {
    if (qIdx >= coachSession.questions.length - 1) {
      try { await coach.completeSession(coachSession.id); } catch { /* non-fatal */ }
      clearActiveCoachSession();
      navigate(`/coach/summary?sessionId=${coachSession.id}`);
      return;
    }
    setQIdx((i) => i + 1);
  }

  function setCruxRow(i, val) {
    setCruxRows((rows) => rows.map((r, idx) => (idx === i ? val : r)));
  }
  function setStructureRow(i, val) {
    setStructureRows((rows) => rows.map((r, idx) => (idx === i ? val : r)));
  }

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">Loading session…</div>
  );
  if (error && !coachSession) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-destructive">{error}</p>
      <Button className="mt-4" onClick={() => navigate("/coach")}>Back to Coach</Button>
    </div>
  );
  if (!coachSession) return null;

  const { passage, questions, readingGrade } = coachSession;
  const inReadingPhase = !readingGrade;

  // ── Reading phase ────────────────────────────────────────────────────────
  if (inReadingPhase) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-[55%]">
            <div className="rounded-xl border border-border bg-card p-5">
              {passage.title && <h2 className="mb-3 display text-[22px] leading-tight">{passage.title}</h2>}
              <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: 15, lineHeight: 1.9 }}>
                {passage.body}
              </p>
            </div>
          </div>

          <div className="lg:w-[45%]">
            <div className="rounded-xl border border-border bg-card p-5 sticky top-4">
              <h3 className="font-bold text-foreground mb-1">Map the argument first</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Before you see any question — what is each paragraph doing? Write in any
                language, including your own words or mother tongue. Grammar doesn't matter;
                understanding does.
              </p>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMapMode("quick")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium border", mapMode === "quick" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}
                >Quick (crux words)</button>
                <button
                  onClick={() => setMapMode("full")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium border", mapMode === "full" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}
                >Full summary</button>
              </div>

              {mapMode === "quick" ? (
                <div className="space-y-2">
                  {cruxRows.map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6 flex-none">¶{i + 1}</span>
                      <input
                        value={val}
                        onChange={(e) => setCruxRow(i, e.target.value)}
                        placeholder="4-5 words — this paragraph's crux"
                        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Main point</label>
                    <textarea value={mainPoint} onChange={(e) => setMainPoint(e.target.value)} rows={2}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Tone</label>
                    <input value={tone} onChange={(e) => setTone(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Structure (what each paragraph does)</label>
                    <div className="space-y-2">
                      {structureRows.map((val, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-6 flex-none">¶{i + 1}</span>
                          <input value={val} onChange={(e) => setStructureRow(i, e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">The turn <span className="font-normal">(optional)</span></label>
                    <input value={theTurn} onChange={(e) => setTheTurn(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

              <Button className="mt-4 w-full" size="lg" disabled={gradingMap} onClick={submitReadingMap}>
                {gradingMap ? "Grading your reading…" : "Grade my reading →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Questions phase ──────────────────────────────────────────────────────
  const attempt = question ? attempts[question.id] : null;
  const verdictShown = !!attempt;
  const isLastQuestion = qIdx === questions.length - 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Reading grade banner — shown once, above the questions */}
      {qIdx === 0 && !verdictShown && (
        <div className={cn(
          "mb-4 rounded-xl border p-4",
          readingGrade.ungraded ? "border-amber-500/30 bg-amber-500/5" : "border-primary/30 bg-primary/5"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              readingGrade.ungraded ? "text-amber-600 dark:text-amber-400" : "text-primary"
            )}>
              {readingGrade.ungraded ? "Reading feedback unavailable" : `Your reading: ${readingGrade.reading_mode?.replace(/-/g, " ")}`}
            </span>
          </div>
          <p className="text-sm text-foreground mb-1">{readingGrade.verdict_line}</p>
          <p className="text-xs text-muted-foreground">{readingGrade.what_you_missed}</p>
          {!readingGrade.ungraded && (
            <p className="text-xs text-muted-foreground mt-1"><strong>Try this next:</strong> {readingGrade.one_technique}</p>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        {questions.map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < qIdx || attempts[questions[i].id] ? "bg-primary" : i === qIdx ? "bg-primary/40" : "bg-border")} />
        ))}
        <span className="text-xs text-muted-foreground flex-none">Q{qIdx + 1} / {questions.length}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Passage */}
        <div className="lg:w-[45%]">
          <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-card p-5">
            {passage.title && <h2 className="mb-3 display text-[22px] leading-tight">{passage.title}</h2>}
            <ArticleWithHighlight text={passage.body} sourceLines={question?.sourceLines || null} />
          </div>
        </div>

        {/* Question + verdict + discuss */}
        <div className="lg:w-[55%] flex flex-col gap-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              {verdictShown ? <TypeBadge type={question.type} /> : <span className="text-xs text-transparent select-none">·</span>}
            </div>
            <h2 className="font-bold text-foreground mb-4" style={{ fontSize: 16 }}>{question.question}</h2>
            <div className="space-y-2">
              {question.options.map((opt, i) => {
                let status = null;
                if (verdictShown) {
                  if (i === attempt.correctOptionIndex) status = selected === i || attempt.selectedOptionIndex === i ? "correct" : "correct-unselected";
                  else if (i === attempt.selectedOptionIndex) status = "wrong";
                }
                return (
                  <OptionCard
                    key={i}
                    letter={LETTERS[i]}
                    text={opt.text}
                    selected={selected === i}
                    status={status}
                    disabled={verdictShown}
                    onClick={() => { if (!verdictShown) setSelected(i); }}
                  />
                );
              })}
            </div>

            {selected !== null && !verdictShown && (
              <div className="mt-4">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Your reasoning (optional)</label>
                <textarea
                  value={reasoningText}
                  onChange={(e) => setReasoningText(e.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder="Why this option? What in the passage supports it?"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
                <Button className="mt-3 w-full" size="lg" disabled={submitting} onClick={submitAnswer}>
                  {submitting ? "Checking…" : reasoningText.trim() ? "Submit Answer →" : "Submit (No AI Feedback) →"}
                </Button>
              </div>
            )}
          </div>

          {/* Verdict */}
          {verdictShown && (
            <div className="rounded-xl border border-border bg-card p-5">
              <FeedbackSections
                attempt={{ ...attempt, options: question.options.map((o) => ({ text: o.text })), trapOptionIndex: question.trapIndex }}
              />

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDiscussOpen((o) => !o)}>
                  {discussOpen ? "Hide discussion" : "Stuck? Discuss →"}
                </Button>
                <Button className="flex-1" onClick={nextQuestion}>
                  {isLastQuestion ? "View Summary →" : "Next Question →"}
                </Button>
              </div>
            </div>
          )}

          {/* Stuck? Discuss chat */}
          {verdictShown && discussOpen && (
            <div className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discuss with Coach</span>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-72">
                {(attempt.discussConversation || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Ask anything about this question — why an option is wrong, how to read the passage, whatever's unclear.</p>
                )}
                {(attempt.discussConversation || []).map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "student" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed", msg.role === "coach" ? "bg-muted text-foreground rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {(attempt.exchangeCount || 0) < MAX_DISCUSS ? (
                <div className="border-t border-border p-3">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={discussInput}
                      onChange={(e) => setDiscussInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDiscussMessage(); } }}
                      disabled={discussSending}
                      rows={2}
                      maxLength={300}
                      placeholder="Ask a follow-up…"
                      className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                    />
                    <Button size="sm" disabled={!discussInput.trim() || discussSending} onClick={sendDiscussMessage}>Send</Button>
                  </div>
                  {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
                </div>
              ) : (
                <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">Discussion limit reached for this question.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleWithHighlight({ text, sourceLines }) {
  if (!sourceLines || !text) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: 15, lineHeight: 1.9 }}>{text || ""}</p>
  );
  const idx = text.indexOf(sourceLines.slice(0, 40));
  if (idx === -1) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: 15, lineHeight: 1.9 }}>{text}</p>
  );
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + sourceLines.length);
  const after = text.slice(idx + sourceLines.length);
  return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: 15, lineHeight: 1.9 }}>
      {before}
      <mark className="bg-amber-200 dark:bg-amber-900/60 rounded px-0.5">{match}</mark>
      {after}
    </p>
  );
}
