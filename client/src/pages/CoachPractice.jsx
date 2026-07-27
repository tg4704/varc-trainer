// ② Coach - practice screen. Flow per session:
//   1. Reading phase: full passage shown; student submits a reading map (crux words
//      per paragraph, or a fuller summary) BEFORE seeing any question. AI grades the
//      reading process - this is the differentiator (see content-pipeline/READING_GRADER.md).
//   2. Questions phase: passage stays visible; each question is answered with reasoning,
//      graded by AI (reused FeedbackSections component), with an optional "Stuck? Discuss"
//      follow-up chat once the verdict is shown.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { saveActiveCoachSession, clearActiveCoachSession } from "../coachSession.js";
import OptionCard from "../components/OptionCard.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import FeedbackSections from "../components/FeedbackSections.jsx";
import CoachSessionTopBar from "../components/CoachSessionTopBar.jsx";
import Modal from "../components/Modal.jsx";
import ReadingGradeCard from "../components/ReadingGradeCard.jsx";
import ReadingMapCard from "../components/ReadingMapCard.jsx";
import QuestionStepper, { stateFor } from "../components/QuestionStepper.jsx";
import Tooltip, { InfoDot } from "../components/Tooltip.jsx";
import VoiceMicButton from "../components/VoiceMicButton.jsx";
import PassageFontMenu, { PASSAGE_FONTS, LINE_SPACINGS } from "../components/PassageFontMenu.jsx";
import Icon from "../components/Icon.jsx";
import TypingLoader from "../components/TypingLoader.jsx";
import CoachThinking from "../components/CoachThinking.jsx";
import CoachMessage from "../components/CoachMessage.jsx";
import { useVoiceInput } from "../hooks/useVoiceInput.js";
import useBackGuard from "../hooks/useBackGuard.js";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/utils.js";
import { coach, billing } from "../api.js";
import { AI } from "../lib/limits.js";
import CharCount from "../components/CharCount.jsx";

const TONE_HINT = "Common tones to reach for: analytical, critical, ironic, skeptical, sympathetic, celebratory, elegiac, polemical, detached, urgent.";

const LETTERS = ["A", "B", "C", "D"];
const MAX_DISCUSS = 4;
// Caps live in client/src/lib/limits.js, mirrored from server/lib/schemas.js.
// The textarea's maxLength stops typing silently, so the counter beside each
// field tells the student the cap exists before they hit it.
const DISCUSS_MAX_CHARS = AI.COACH_DISCUSS_MAX;

// Shared with Practice.jsx (Drills) so a reading preference set in one place
// carries over to the other.
const FONT_PREFS_KEY = "varc_passage_font_prefs";
function loadFontPrefs() {
  try {
    const raw = localStorage.getItem(FONT_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { fontId: "newsreader", fontSize: 17, spacingId: "normal" };
}

export default function CoachPractice() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = params.get("sessionId");

  const [coachSession, setCoachSession] = useState(location.state?.coachSession || null);
  const [attempts, setAttempts] = useState({}); // questionId -> attempt/verdict
  const [loading, setLoading] = useState(!location.state?.coachSession);
  const [error, setError] = useState(null);

  // Reading helpers - shared "Aa" typeface/size/spacing menu, and a way to
  // collapse the map/question column so the passage can take the full width
  // (handy once you're deep in a long passage and just want to reread it).
  const [fontPrefs, setFontPrefs] = useState(loadFontPrefs);
  useEffect(() => {
    try { localStorage.setItem(FONT_PREFS_KEY, JSON.stringify(fontPrefs)); } catch {}
  }, [fontPrefs]);
  const [mapCollapsed, setMapCollapsed] = useState(false);

  // Reading-map form state - row counts are derived from the passage's actual
  // paragraph count (split on blank lines) so the student maps exactly as many
  // paragraphs as the passage has, no more, no fewer. mapMode starts unset so
  // the student makes an explicit Quick/Full choice before any fields appear.
  const [mapMode, setMapMode] = useState(null);
  const [cruxRows, setCruxRows] = useState([]);
  const [mainPoint, setMainPoint] = useState("");
  const [tone, setTone] = useState("");
  const [structureRows, setStructureRows] = useState([]);
  const [gradingMap, setGradingMap] = useState(false);
  const [invalidFields, setInvalidFields] = useState(new Set()); // field keys currently missing/invalid - persists until fixed
  const [shakingFields, setShakingFields] = useState(new Set()); // subset of invalidFields mid-shake-animation - cleared after the animation so it can retrigger on the next failed submit
  const shakeTimeoutRef = useRef(null);

  // Voice input for the "Main point" field (Full-summary mode)
  const [mainPointInterim, setMainPointInterim] = useState("");
  const mainPointRef = useRef("");
  useEffect(() => { mainPointRef.current = mainPoint; }, [mainPoint]);
  const handleMainPointFinal = useCallback((text) => {
    const current = mainPointRef.current;
    const sep = current && !current.endsWith(" ") ? " " : "";
    const next = current + sep + text;
    setMainPoint(next);
    mainPointRef.current = next;
    setMainPointInterim("");
  }, []);
  const {
    isRecording: mainPointRecording, isSupported: voiceSupported, error: voiceError,
    toggle: toggleMainPointVoice,
  } = useVoiceInput({ onFinalTranscript: handleMainPointFinal, onInterimTranscript: setMainPointInterim });

  // Reading-grade presentation: a modal on submit, then a right-edge revisit dock.
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradeDockHover, setGradeDockHover] = useState(false);

  // Question phase state
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [reasoningText, setReasoningText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Indices actually landed on - NOT "every index below current" (jumping
  // straight from Q1 to Q4 must not retroactively mark Q2/Q3 as seen).
  const [visitedIndices, setVisitedIndices] = useState(() => new Set([0]));
  useEffect(() => { setVisitedIndices((prev) => new Set(prev).add(qIdx)); }, [qIdx]);

  // Discuss chat state (per current question)
  const [discussOpen, setDiscussOpen] = useState(false);
  const [discussInput, setDiscussInput] = useState("");
  const [discussSending, setDiscussSending] = useState(false);
  // "1-on-1 AI coaching" (the back-and-forth chat) is a Consistent/Topper perk.
  // Default true so the control never flashes locked before /billing/me resolves;
  // the server is the real gate (POST /coach/exchange 402s lower tiers anyway).
  const [canCoach, setCanCoach] = useState(true);
  useEffect(() => {
    const refreshEntitlement = () =>
      billing.me().then((m) => setCanCoach(m.canCoach !== false)).catch(() => {});

    refreshEntitlement();

    // Re-check whenever this tab comes back to the foreground. "See plans"
    // opens pricing in a NEW tab specifically so this session survives, which
    // means the upgrade happens somewhere this component never hears about.
    // Without this the user pays, switches back, and still sees
    // "🔒 1-on-1 AI coaching" until they reload — losing the session they
    // just paid to continue. Re-fetching on focus makes Discuss light up on
    // return, so they carry on from the exact question they were stuck on.
    const onVisible = () => { if (!document.hidden) refreshEntitlement(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshEntitlement);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshEntitlement);
    };
  }, []);
  const chatEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const discussPanelRef = useRef(null);
  const discussWasOpen = useRef(false);

  // Leave-session modal - Coach sessions are resumable (unlike Drills), so
  // "leaving" isn't just End/Discard: the safe default is Resume later,
  // which does nothing but navigate away (the session stays active and
  // reappears in the Dashboard's "pick up where you left off" card).
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveAction, setLeaveAction] = useState(null); // 'end' | 'discard' | null

  function resumeLater() {
    setShowLeaveModal(false);
    navigate("/dashboard");
  }
  async function endAndSummarize() {
    if (leaving || !coachSession) return;
    setLeaving(true);
    setLeaveAction("end");
    try { await coach.completeSession(coachSession.id); } catch { /* non-fatal */ }
    clearActiveCoachSession();
    navigate(`/coach/summary?sessionId=${coachSession.id}`);
  }
  async function discardSession() {
    if (leaving || !coachSession) return;
    setLeaving(true);
    setLeaveAction("discard");
    try { await coach.deleteSession(coachSession.id); } catch { /* non-fatal */ }
    clearActiveCoachSession();
    navigate("/coach");
  }

  // Unlike the session itself (resumable, safe to navigate away from), text
  // typed into the reasoning box or the Discuss chat input isn't saved until
  // submitted/sent - closing or refreshing the tab loses it silently. The
  // browser's own Back button / tab-close bypasses the in-app Exit button
  // entirely, so this is the only backstop for that specific loss.
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (!reasoningText.trim() && !discussInput.trim()) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [reasoningText, discussInput]);

  // Back / swipe-back is a history pop, not an unload, so beforeunload above
  // never sees it. Send it to the same leave-confirmation the Exit button uses.
  useBackGuard(!!coachSession && !leaving, () => setShowLeaveModal(true));

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
    // Scroll only the chat container, not the whole window. scrollIntoView()
    // would scroll every scrollable ancestor (including the page), yanking the
    // sticky article + question columns down on every reply.
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [attempts, discussOpen]);

  useEffect(() => {
    // Opening the panel is the one time we DO want to move the page: it renders
    // below the fold, so without this the button click looks like it did
    // nothing. Fires only on the closed->open transition, never on replies.
    const justOpened = discussOpen && !discussWasOpen.current;
    discussWasOpen.current = discussOpen;
    if (!justOpened) return;

    const panel = discussPanelRef.current;
    if (!panel) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [discussOpen]);

  // Size the reading-map rows to the passage's actual paragraph count (split on
  // blank lines) - the student maps exactly as many paragraphs as exist, no more.
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

  // Note: trapOptionIndex is intentionally NOT set here - the server already reveals
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

  // Blank rows/fields must never reach the grader - an empty submission still
  // gets AI-graded (and reads as a real, confusing verdict) unless we stop it
  // client-side first. Missing fields get a red border + shake instead.
  function validateReadingMap() {
    const missing = new Set();
    if (mapMode === "quick") {
      cruxRows.forEach((val, i) => { if (!val.trim()) missing.add(`crux-${i}`); });
    } else if (mapMode === "full") {
      if (!mainPoint.trim()) missing.add("mainPoint");
    }
    return missing;
  }

  async function submitReadingMap() {
    const missing = validateReadingMap();
    if (missing.size > 0) {
      setInvalidFields(missing);
      setShakingFields(missing);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      shakeTimeoutRef.current = setTimeout(() => setShakingFields(new Set()), 400);
      return;
    }
    setInvalidFields(new Set());
    setGradingMap(true);
    setError(null);
    try {
      const body = mapMode === "quick"
        ? { mode: "quick", crux: cruxRows }
        : { mode: "full", mainPoint, tone, structure: structureRows };
      const { readingMap, readingGrade } = await coach.submitReadingMap(coachSession.id, body);
      setCoachSession((s) => ({ ...s, readingMap, readingGrade }));
      setGradeModalOpen(true); // present the grade as a dialog over the questions

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
      // Roll back the optimistic bubble and restore the typed text - without
      // this, a failed send silently vanishes both the message on screen
      // and the input the user would need to retype it.
      setAttempts((prev) => ({ ...prev, [question.id]: current }));
      setDiscussInput(msg);
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
    if (val.trim() && invalidFields.has(`crux-${i}`)) {
      setInvalidFields((prev) => { const next = new Set(prev); next.delete(`crux-${i}`); return next; });
    }
  }
  function setMainPointValue(val) {
    setMainPoint(val);
    if (val.trim() && invalidFields.has("mainPoint")) {
      setInvalidFields((prev) => { const next = new Set(prev); next.delete("mainPoint"); return next; });
    }
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
  const currentFont = PASSAGE_FONTS.find((f) => f.id === fontPrefs.fontId) || PASSAGE_FONTS[0];
  const currentSpacing = (LINE_SPACINGS.find((s) => s.id === fontPrefs.spacingId) || LINE_SPACINGS[1]).value;

  // ── Reading phase ────────────────────────────────────────────────────────
  if (inReadingPhase) {
    return (
      <>
      <CoachSessionTopBar phase="reading" onExit={() => setShowLeaveModal(true)} />
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-9">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Passage - plain canvas, no glass, maximum reading legibility */}
          <div className={mapCollapsed ? "lg:w-full" : "lg:w-[55%]"}>
            <div className={mapCollapsed ? "" : "lg:border-r lg:pr-8"} style={{ borderColor: "var(--glass-border-lo)" }}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="eyebrow">Passage</div>
                <div className="flex items-center gap-2">
                  <PassageFontMenu
                    fontId={fontPrefs.fontId}
                    onFontChange={(id) => setFontPrefs((p) => ({ ...p, fontId: id }))}
                    fontSize={fontPrefs.fontSize}
                    onFontSizeChange={(sz) => setFontPrefs((p) => ({ ...p, fontSize: sz }))}
                    spacingId={fontPrefs.spacingId}
                    onSpacingChange={(id) => setFontPrefs((p) => ({ ...p, spacingId: id }))}
                  />
                  {mapCollapsed && (
                    <button
                      type="button"
                      onClick={() => setMapCollapsed(false)}
                      className="fx-ring flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.4)", color: "var(--teal)" }}
                    >
                      <Icon name="chevL" size={14} stroke={2.4} /> Map the argument
                    </button>
                  )}
                </div>
              </div>
              {passage.title && <h2 className="mb-4 display text-[24px] italic leading-tight">{passage.title}</h2>}
              <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontFamily: currentFont.family, fontSize: fontPrefs.fontSize, lineHeight: currentSpacing, color: "#C9D0E0" }}>
                {passage.body}
              </p>
            </div>
          </div>

          {!mapCollapsed && (
          <div className="lg:w-[45%]">
            <div className="glass-floating sticky top-4 p-6">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-bold text-foreground">Map the argument first</h3>
                <button
                  type="button"
                  onClick={() => setMapCollapsed(true)}
                  title="Move this aside to read full width"
                  className="fx-ring flex flex-none items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-semibold transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-border-hi)", color: "var(--text)" }}
                >
                  Hide <Icon name="chevR" size={14} stroke={2.4} />
                </button>
              </div>
              <p className="text-xs muted mb-4">
                Before you see any question, what is each paragraph doing? Write in any
                language, including your own words or mother tongue. Grammar doesn't matter;
                understanding does.
              </p>

              {!mapMode ? (
                // No mode chosen yet - a clear, centered decision point before any
                // form appears, rather than defaulting silently into Quick.
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-xs muted max-w-[220px]">How do you want to map it?</p>
                  <div className="flex flex-col gap-2 w-full max-w-[220px]">
                    <button
                      onClick={() => setMapMode("quick")}
                      className="fx-ring rounded-[12px] px-4 py-3 text-sm font-semibold transition-colors"
                      style={{ background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.4)", color: "var(--teal)" }}
                    >
                      Quick <span className="block text-[11px] font-normal dim">crux words per paragraph</span>
                    </button>
                    <button
                      onClick={() => setMapMode("full")}
                      className="fx-ring rounded-[12px] px-4 py-3 text-sm font-semibold transition-colors"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)", color: "var(--text)" }}
                    >
                      Full summary <span className="block text-[11px] font-normal dim">main point, tone, structure</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMapMode("quick")}
                        className="rounded-[999px] px-3 py-1 text-xs font-semibold transition-colors"
                        style={mapMode === "quick" ? { background: "var(--teal)", color: "#07130E" } : { background: "rgba(255,255,255,0.04)", color: "var(--text-2)", border: "1px solid var(--glass-border-lo)" }}
                      >Quick (crux words)</button>
                      <button
                        onClick={() => setMapMode("full")}
                        className="rounded-[999px] px-3 py-1 text-xs font-semibold transition-colors"
                        style={mapMode === "full" ? { background: "var(--teal)", color: "#07130E" } : { background: "rgba(255,255,255,0.04)", color: "var(--text-2)", border: "1px solid var(--glass-border-lo)" }}
                      >Full summary</button>
                    </div>
                  </div>

                  {mapMode === "quick" ? (
                    <div className="space-y-2">
                      {cruxRows.map((val, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs muted w-6 flex-none">¶{i + 1}</span>
                          <input
                            value={val}
                            onChange={(e) => setCruxRow(i, e.target.value)}
                            maxLength={AI.READING_CRUX_MAX}
                            placeholder="4-5 words: this paragraph's crux"
                            className={`input${invalidFields.has(`crux-${i}`) ? " field-invalid" : ""}${shakingFields.has(`crux-${i}`) ? " field-shake" : ""}`}
                            style={{ padding: "8px 12px", fontSize: 13.5 }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="field-label mb-0">Main point</label>
                          {voiceSupported && (
                            <VoiceMicButton isRecording={mainPointRecording} onClick={toggleMainPointVoice} />
                          )}
                        </div>
                        <textarea
                          value={mainPoint}
                          onChange={(e) => setMainPointValue(e.target.value)}
                          rows={2}
                          maxLength={AI.READING_MAIN_POINT_MAX}
                          className={`input mt-1${invalidFields.has("mainPoint") ? " field-invalid" : ""}${shakingFields.has("mainPoint") ? " field-shake" : ""}`}
                          style={{ resize: "vertical" }}
                        />
                        <CharCount value={mainPoint} max={AI.READING_MAIN_POINT_MAX} />
                        {mainPointInterim && <p className="mt-1 text-xs italic dim truncate">🎙 {mainPointInterim}</p>}
                        {voiceError && <p className="mt-1 text-xs text-destructive">{voiceError}</p>}
                      </div>
                      <div>
                        <label className="field-label flex items-center gap-1.5">
                          Tone <InfoDot label={TONE_HINT} size={14} />
                        </label>
                        <input value={tone} onChange={(e) => setTone(e.target.value)} maxLength={AI.READING_TONE_MAX} className="input" />
                      </div>
                      <div>
                        <label className="field-label">Structure (what each paragraph does)</label>
                        <div className="space-y-2">
                          {structureRows.map((val, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs muted w-6 flex-none">¶{i + 1}</span>
                              <input value={val} onChange={(e) => setStructureRow(i, e.target.value)} maxLength={AI.READING_STRUCTURE_MAX} className="input" style={{ padding: "8px 12px", fontSize: 13.5 }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

                  <button className="btn btn-primary fx-sheen btn-block mt-4" disabled={gradingMap} onClick={submitReadingMap}>
                    {gradingMap ? "Grading your reading…" : <>Grade my reading <span className="arrow inline-block">→</span></>}
                  </button>
                  {gradingMap && <TypingLoader text="Reading your notes against the passage…" className="mt-2" />}
                </>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
      {showLeaveModal && (
        <CoachLeaveModal
          busy={leaving}
          action={leaveAction}
          onResume={resumeLater}
          onEnd={endAndSummarize}
          onDiscard={discardSession}
          onStay={() => setShowLeaveModal(false)}
        />
      )}
      </>
    );
  }

  // ── Questions phase ──────────────────────────────────────────────────────
  const attempt = question ? attempts[question.id] : null;
  const verdictShown = !!attempt;
  const isLastQuestion = qIdx === questions.length - 1;

  // Free navigation between questions, same model as Drills' QuestionStepper -
  // "seen" (visited, no verdict yet) vs "correct"/"incorrect" (answered).
  const coachQuestionStates = questions.map((q, i) => {
    const a = attempts[q.id];
    return {
      feedback: a ? { isCorrect: a.isCorrect } : null,
      skipped: false,
      locked: !!a,
      visited: visitedIndices.has(i) || !!a,
    };
  });

  return (
    <>
    <CoachSessionTopBar phase="questions" qIndex={qIdx + 1} qTotal={questions.length} onExit={() => setShowLeaveModal(true)} />
    <QuestionStepper total={questions.length} currentIdx={qIdx} questionStates={coachQuestionStates} onJump={setQIdx} />
    {/* Reading grade - shown as a dialog on submit, then revisitable from the right-edge dock */}
    {gradeModalOpen && (
      <Modal onClose={() => setGradeModalOpen(false)} labelledBy="reading-grade-title">
        <div className="glass-floating w-full max-w-[560px] p-5 animate-slide-up sm:p-6" onClick={(e) => e.stopPropagation()}>
          <h2 id="reading-grade-title" className="display mb-3 text-[19px] leading-tight">How you read the passage</h2>
          <ReadingGradeCard grade={readingGrade} onRetry={submitReadingMap} retrying={gradingMap} />
          {/* What they actually wrote, so the feedback above has something to
              point at. The canonical key is deliberately NOT here - it would
              answer the main-idea/tone/title questions they haven't seen yet;
              it appears on the summary once the session is completed. */}
          <ReadingMapCard map={coachSession.readingMap} className="mt-3" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs muted">You can reopen this from the tab on the right anytime.</p>
            <button
              type="button"
              onClick={() => setGradeModalOpen(false)}
              className="fx-ring inline-flex flex-none items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-semibold transition-colors"
              style={{ background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.4)", color: "var(--teal)" }}
            >
              Move to side <Icon name="chevR" size={15} stroke={2.4} />
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* Right-edge revisit dock - hover to re-read the grade during the session */}
    <div
      className="hidden lg:flex items-center"
      style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 40 }}
      onMouseEnter={() => setGradeDockHover(true)}
      onMouseLeave={() => setGradeDockHover(false)}
    >
      <div
        style={{
          position: "absolute", right: "100%", marginRight: 12, top: "50%",
          width: 360, maxWidth: "min(360px, calc(100vw - 90px))",
          opacity: gradeDockHover ? 1 : 0, pointerEvents: gradeDockHover ? "auto" : "none",
          transform: `translateY(-50%) translateX(${gradeDockHover ? 0 : 12}px)`,
          transition: "opacity .22s ease, transform .22s ease",
        }}
      >
        <div
          className="rounded-[16px] p-3"
          style={{
            background: "var(--bg-elevated, #14171F)", border: "1px solid var(--border-subtle)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
            // The dock now holds grade + map, so it can outgrow the viewport.
            maxHeight: "min(78vh, 720px)", overflowY: "auto",
          }}
        >
          <ReadingGradeCard grade={readingGrade} onRetry={submitReadingMap} retrying={gradingMap} />
          <ReadingMapCard map={coachSession.readingMap} className="mt-3" />
        </div>
      </div>
      <button
        type="button"
        aria-label="Your reading feedback"
        title="Your reading feedback"
        onClick={() => setGradeModalOpen(true)}
        className="flex items-center justify-center"
        style={{
          width: 48, height: 48,
          background: gradeDockHover ? (readingGrade.ungraded ? "rgba(240,168,104,0.15)" : "rgba(93,202,165,0.15)") : "rgba(20,23,31,0.94)",
          border: `1px solid ${gradeDockHover ? (readingGrade.ungraded ? "var(--amber)" : "var(--teal)") : "var(--border-subtle)"}`,
          borderRight: "none", borderRadius: "14px 0 0 14px",
          color: readingGrade.ungraded ? "var(--amber)" : "var(--teal)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)", transition: "background .2s ease, border-color .2s ease",
        }}
      >
        <Icon name={readingGrade.ungraded ? "x" : "target"} size={20} />
      </button>
    </div>

    <div className="max-w-7xl mx-auto px-4 py-6 md:px-9">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Passage - plain canvas, no glass, maximum reading legibility */}
        <div className={mapCollapsed ? "lg:w-full" : "lg:w-[45%]"}>
          <div className={mapCollapsed ? "lg:sticky lg:top-4" : "lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:pr-6"} style={{ borderColor: "var(--glass-border-lo)" }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="eyebrow">Passage</div>
              <div className="flex items-center gap-2">
                <PassageFontMenu
                  fontId={fontPrefs.fontId}
                  onFontChange={(id) => setFontPrefs((p) => ({ ...p, fontId: id }))}
                  fontSize={fontPrefs.fontSize}
                  onFontSizeChange={(sz) => setFontPrefs((p) => ({ ...p, fontSize: sz }))}
                  spacingId={fontPrefs.spacingId}
                  onSpacingChange={(id) => setFontPrefs((p) => ({ ...p, spacingId: id }))}
                />
                <button
                  type="button"
                  onClick={() => setMapCollapsed((c) => !c)}
                  title={mapCollapsed ? "Bring the question back" : "Move the question aside to read full width"}
                  className="fx-ring flex flex-none items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-semibold transition-colors"
                  style={mapCollapsed
                    ? { background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.4)", color: "var(--teal)" }
                    : { background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-border-hi)", color: "var(--text)" }}
                >
                  {mapCollapsed
                    ? <><Icon name="chevL" size={14} stroke={2.4} /> Show question</>
                    : <>Hide <Icon name="chevR" size={14} stroke={2.4} /></>}
                </button>
              </div>
            </div>
            {passage.title && <h2 className="mb-3 display text-[22px] italic leading-tight">{passage.title}</h2>}
            <ArticleWithHighlight text={passage.body} sourceLines={question?.sourceLines || null} fontFamily={currentFont.family} fontSize={fontPrefs.fontSize} lineHeight={currentSpacing} />
          </div>
        </div>

        {/* Question + verdict + discuss */}
        {!mapCollapsed && (
        <div className="lg:w-[55%] flex flex-col gap-5">
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              {verdictShown ? <TypeBadge type={question.type} /> : <span className="text-xs text-transparent select-none">{" "}</span>}
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
                <label className="field-label">Your reasoning (optional)</label>
                <textarea
                  value={reasoningText}
                  onChange={(e) => setReasoningText(e.target.value)}
                  rows={3}
                  maxLength={AI.COACH_REASONING_MAX}
                  placeholder="Why this option? What in the passage supports it?"
                  className="input"
                  style={{ resize: "vertical" }}
                />
                <CharCount value={reasoningText} max={AI.COACH_REASONING_MAX} />
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
                <button className="btn btn-primary fx-sheen btn-block mt-3" disabled={submitting} onClick={submitAnswer}>
                  {submitting ? "Checking…" : reasoningText.trim() ? "Submit Answer →" : "Submit (No AI Feedback) →"}
                </button>
                {submitting && reasoningText.trim() && <TypingLoader text="Checking your reasoning…" className="mt-2" />}
              </div>
            )}
          </div>

          {/* Verdict */}
          {verdictShown && (
            <div className="glass p-5">
              <FeedbackSections
                attempt={{ ...attempt, options: question.options.map((o) => ({ text: o.text })), trapOptionIndex: question.trapIndex }}
              />

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button className="btn btn-glass fx-ring flex-1" onClick={() => setDiscussOpen((o) => !o)}>
                  {discussOpen
                    ? (canCoach ? "Hide discussion" : "Hide")
                    : (canCoach ? "Stuck? Discuss →" : "🔒 1-on-1 AI coaching")}
                </button>
                <button className="btn btn-primary fx-sheen flex-1" onClick={nextQuestion}>
                  {isLastQuestion ? "View Summary →" : "Next Question →"}
                </button>
              </div>
            </div>
          )}

          {/* Locked upsell - lower tiers get the instant explanation above, but the
              back-and-forth "1-on-1 AI coaching" is a Consistent/Topper perk. */}
          {verdictShown && discussOpen && !canCoach && (
            <div ref={discussPanelRef} className="glass-recessed p-5" style={{ scrollMarginTop: 84 }}>
              <div className="flex items-center gap-2">
                <span className="eyebrow">1-on-1 AI coaching</span>
                <span className="mono rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)" }}>
                  Consistent &amp; Topper
                </span>
              </div>
              <p className="mt-2 text-sm muted">
                You've got the answer and full explanation above. Go a step further with a back-and-forth AI tutor that questions your reasoning until it clicks - available on the Consistent and Topper plans.
              </p>
              {/* Deliberately a new-tab anchor, not a <Link>: an in-app nav
                  here abandons the passage mid-session. Opening a tab keeps
                  this session live, and the visibilitychange listener above
                  re-checks entitlement when they come back, so Discuss
                  unlocks in place after they upgrade. */}
              <a
                href="/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary fx-sheen fx-ring mt-4 inline-flex"
              >
                See plans →
              </a>
              <p className="mt-2 text-xs muted">
                Opens in a new tab — you won't lose your place here.
              </p>
            </div>
          )}

          {/* 1-on-1 AI coaching chat (Consistent/Topper) */}
          {verdictShown && discussOpen && canCoach && (
            // scrollMarginTop clears the sticky session bar so scrollIntoView
            // doesn't tuck the panel header underneath it.
            <div ref={discussPanelRef} className="glass-recessed flex flex-col overflow-hidden" style={{ scrollMarginTop: 84 }}>
              <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--glass-border-lo)" }}>
                <span className="eyebrow">1-on-1 AI coaching</span>
              </div>
              {/* Was a flat max-h-72 (288px), which read as a cramped strip at the
                  bottom of the page. Scales with the viewport now, with a floor so
                  it stays usable on short screens and a ceiling so it doesn't run
                  past the fold on tall ones. */}
              <div
                ref={chatBodyRef}
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
                style={{ height: "min(58vh, 560px)", minHeight: 260 }}
              >
                {(attempt.discussConversation || []).length === 0 && (
                  <p className="text-sm muted">Ask anything about this question: why an option is wrong, how to read the passage, whatever's unclear.</p>
                )}
                {(attempt.discussConversation || []).map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "student" ? "justify-end" : "justify-start")}>
                    <div
                      className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
                      style={
                        msg.role === "coach"
                          ? { background: "rgba(255,255,255,0.05)", color: "var(--text)", borderTopLeftRadius: 4 }
                          : { background: "var(--teal)", color: "#07130E", borderTopRightRadius: 4 }
                      }
                    >
                      {msg.role === "coach" ? <CoachMessage text={msg.text} /> : msg.text}
                    </div>
                  </div>
                ))}
                {discussSending && <CoachThinking />}
                <div ref={chatEndRef} />
              </div>
              {(attempt.exchangeCount || 0) < MAX_DISCUSS ? (
                <div className="p-3" style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={discussInput}
                      onChange={(e) => setDiscussInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDiscussMessage(); } }}
                      disabled={discussSending}
                      rows={2}
                      maxLength={DISCUSS_MAX_CHARS}
                      placeholder="Ask a follow-up…"
                      className="input flex-1"
                      style={{ resize: "none" }}
                    />
                    <button
                      onClick={sendDiscussMessage}
                      disabled={!discussInput.trim() || discussSending}
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] disabled:opacity-40"
                      style={{ background: "var(--teal)", color: "#07130E" }}
                      aria-label="Send"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="muted">
                      {MAX_DISCUSS - (attempt.exchangeCount || 0)} of {MAX_DISCUSS} replies left
                    </span>
                    {/* Stays hidden until the last quarter so it isn't nagging
                        during a normal short question. */}
                    <span
                      className="mono"
                      style={{
                        color: discussInput.length >= DISCUSS_MAX_CHARS ? "var(--danger, #F87171)" : "var(--text-2)",
                        visibility: discussInput.length > DISCUSS_MAX_CHARS * 0.75 ? "visible" : "hidden",
                      }}
                      aria-live="polite"
                    >
                      {discussInput.length}/{DISCUSS_MAX_CHARS}
                    </span>
                  </div>
                  {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
                </div>
              ) : (
                <p className="px-4 py-3 text-xs muted" style={{ borderTop: "1px solid var(--glass-border-lo)" }}>Discussion limit reached for this question.</p>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
    {showLeaveModal && (
      <CoachLeaveModal
        busy={leaving}
        action={leaveAction}
        onResume={resumeLater}
        onEnd={endAndSummarize}
        onDiscard={discardSession}
        onStay={() => setShowLeaveModal(false)}
      />
    )}
    </>
  );
}

// ── Leave-session modal ────────────────────────────────────────────────────
// Coach sessions ARE resumable (unlike Drills), so this offers a third,
// safe-default path: Resume later just navigates away and leaves everything
// as-is - the session reappears on the Dashboard's "pick up where you left
// off" card. End and Discard are both terminal (End completes it now and
// shows the summary for whatever's answered so far; Discard deletes it).
function CoachLeaveModal({ busy, action, onResume, onEnd, onDiscard, onStay }) {
  return (
    <Modal onClose={busy ? undefined : onStay} closeOnBackdrop={false} backdrop="bg-black/50" labelledBy="coach-leave-title">
      <div className="glass-floating w-full max-w-sm p-6 animate-slide-up">
        <h2 id="coach-leave-title" className="text-base font-bold text-foreground mb-4">Leave this passage?</h2>
        <div className="flex flex-col gap-3">
          <div>
            <button
              onClick={onDiscard}
              disabled={busy}
              className="btn w-full disabled:opacity-60"
              style={{ background: "var(--red)", color: "#fff" }}
            >
              {action === "discard" ? "Discarding…" : "Discard session"}
            </button>
            <p className="mt-1.5 text-[12px] leading-snug dim">Deletes this passage session and every answer in it. Nothing is saved.</p>
          </div>
          <div>
            <button onClick={onResume} disabled={busy} className="btn btn-primary fx-sheen w-full disabled:opacity-60">
              Resume later
            </button>
            <p className="mt-1.5 text-[12px] leading-snug dim">Leaves everything as-is. Pick it back up any time from your Dashboard.</p>
          </div>
          <div>
            <button onClick={onEnd} disabled={busy} className="btn btn-glass fx-ring w-full disabled:opacity-60">
              {action === "end" ? "Ending…" : "End & Get Summary"}
            </button>
            <p className="mt-1.5 text-[12px] leading-snug dim">Marks this session complete now and takes you to the summary for whatever you've answered so far.</p>
          </div>
          <button onClick={onStay} disabled={busy} className="btn btn-glass fx-ring w-full">
            Stay
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ArticleWithHighlight({ text, sourceLines, fontFamily, fontSize = 15, lineHeight = 1.9 }) {
  const style = { fontFamily, fontSize, lineHeight, color: "#C9D0E0" };
  if (!sourceLines || !text) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={style}>{text || ""}</p>
  );
  const idx = text.indexOf(sourceLines.slice(0, 40));
  if (idx === -1) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={style}>{text}</p>
  );
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + sourceLines.length);
  const after = text.slice(idx + sourceLines.length);
  return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={style}>
      {before}
      <mark style={{ background: "rgba(93,202,165,0.18)", color: "#C9D0E0", borderBottom: "2px solid var(--teal)", borderRadius: 3, padding: "0 1px" }}>{match}</mark>
      {after}
    </p>
  );
}
