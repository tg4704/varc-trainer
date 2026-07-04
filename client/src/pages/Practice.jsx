import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import OptionCard from "../components/OptionCard.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import IntuitionTimer from "../components/IntuitionTimer.jsx";
import TimerRing from "../components/TimerRing.jsx";
import SessionTopBar from "../components/SessionTopBar.jsx";
import QuestionStepper, { stateFor, statusDotColor } from "../components/QuestionStepper.jsx";
import PassageFontMenu, { PASSAGE_FONTS, LINE_SPACINGS } from "../components/PassageFontMenu.jsx";
import FeedbackSections from "../components/FeedbackSections.jsx";
import Icon from "../components/Icon.jsx";
import { Button } from "../components/ui/button.jsx";
import { Textarea } from "../components/ui/input.jsx";
import VoiceMicButton from "../components/VoiceMicButton.jsx";
import { useVoiceInput } from "../hooks/useVoiceInput.js";
import { cn } from "../lib/utils.js";
import { buildTextSegments, domOffsetToTextOffset, ANNOTATION_STYLES } from "../lib/textAnnotations.js";
import {
  getSessionQuestions,
  submitBasicAttempt,
  submitEvaluateAttempt,
  getActiveSession,
  completeSession,
  deleteSession,
  flagQuestion,
} from "../api.js";
import { loadActiveSession, saveActiveSession, clearActiveSession } from "../session.js";
import { useNavGuard } from "../navGuard.jsx";
import { trapLabel, trapDescription } from "../trapTypes.js";

const LETTERS = ["A", "B", "C", "D"];
const FONT_PREFS_KEY = "varc_passage_font_prefs";

function loadFontPrefs() {
  try {
    const raw = localStorage.getItem(FONT_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { fontId: "newsreader", fontSize: 17, spacingId: "normal" };
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

// Per-question state shape
function defaultQState() {
  return {
    tentativeSelected: null, // option picked but not yet locked
    locked: false,           // true after "Submit Answer"
    lockedSelected: null,    // the final locked option
    lockTime: null,          // timestamp (ms) at lock — for timer freeze
    reasoning: "",
    quotes: [],
    annotations: [],         // highlight/underline/note ranges over the passage
    pausedTimer: false,
    submitting: false,
    feedback: null,
    isSkipping: false,
    skipped: false,
    eliminated: [],          // intuition mode: eliminated option indices
  };
}

export default function Practice() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState(null); // null = loading; array when ready
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionStates, setQuestionStates] = useState([]); // per-question state
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Confirm "End Session" modal (shown on last question or when all answered)
  const [showEndModal, setShowEndModal] = useState(false);
  // Nav-blocked message (can't leave while locked+no feedback)
  const [navBlockMsg, setNavBlockMsg] = useState(null);

  // Flag modal
  const [flagModal, setFlagModal] = useState(null);
  const [flagToast, setFlagToast] = useState(null);

  const [error, setError] = useState(null);
  const [tick, setTick] = useState(Date.now());

  // Interim voice preview (not committed to state yet)
  const [interimText, setInterimText] = useState("");
  const reasoningRef = useRef(""); // stable ref for voice callbacks

  // Selection popover (highlight / underline / note / quote)
  const [selectionPopover, setSelectionPopover] = useState(null);
  const [noteDraft, setNoteDraft] = useState(null); // string while composing a note, else null
  const paragraphRef = useRef(null);

  // Passage font preferences (typeface / size / line spacing) — persisted
  const [fontPrefs, setFontPrefs] = useState(loadFontPrefs);
  useEffect(() => {
    try { localStorage.setItem(FONT_PREFS_KEY, JSON.stringify(fontPrefs)); } catch {}
  }, [fontPrefs]);

  // Per-question timer-pause bookkeeping (pre-lock only)
  const pauseAccumRef = useRef({});
  const pauseStartRef = useRef({});

  // Mobile paragraph toggle (per-question, reset on nav)
  const [paragraphOpen, setParagraphOpen] = useState(true);

  // Intuition mode points accumulator
  const [sessionPoints, setSessionPoints] = useState(0);

  // Timing refs
  const questionStartTimesRef = useRef({}); // idx → ms when first shown
  const sessionStartRef = useRef(Date.now());
  const autoActedRef = useRef(false);
  const endedRef = useRef(false);

  const practiceMode = session?.practiceMode || "analysis";

  // Read / patch per-question state (using functional updates to avoid stale closures)
  function getCS(idx) { return questionStates[idx] || defaultQState(); }

  function patchCS(idx, patch) {
    setQuestionStates(prev => {
      const arr = [...prev];
      arr[idx] = { ...(arr[idx] || defaultQState()), ...patch };
      return arr;
    });
  }

  const cs = getCS(currentIdx); // current question state

  // Keep reasoningRef in sync for voice callbacks
  useEffect(() => { reasoningRef.current = cs.reasoning; }, [cs.reasoning]);

  // ── Voice input ────────────────────────────────────────────────────────────
  const currentIdxRef = useRef(currentIdx);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const handleFinalTranscript = useCallback((text) => {
    const current = reasoningRef.current;
    const sep = current && !current.endsWith(" ") ? " " : "";
    const next = current + sep + text;
    // Use ref to get current idx — avoids stale closure in this useCallback
    setQuestionStates(prev => {
      const arr = [...prev];
      const idx = currentIdxRef.current;
      arr[idx] = { ...(arr[idx] || defaultQState()), reasoning: next };
      return arr;
    });
    reasoningRef.current = next;
    setInterimText("");
  }, []);

  const { isRecording: isVoiceRecording, isSupported: voiceSupported, error: voiceError,
          toggle: toggleVoice, stop: stopVoice } = useVoiceInput({
    onFinalTranscript: handleFinalTranscript,
    onInterimTranscript: setInterimText,
  });

  // Stop voice when submitting
  useEffect(() => {
    if (cs.submitting && isVoiceRecording) stopVoice();
  }, [cs.submitting, isVoiceRecording, stopVoice]);

  // Reset autoActedRef when moving to a new question
  useEffect(() => { autoActedRef.current = false; }, [currentIdx]);

  // ── Text selection: Highlight / Underline / Note / Quote ─────────────────
  // Highlight/underline/note are available any time while reading. Quote is
  // only available after lock (Submit Answer) and before feedback, since it
  // feeds into the reasoning textarea for AI grading context (Phase 12).
  function handleParagraphMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 3) { setSelectionPopover(null); return; }
    if (!sel.rangeCount || !paragraphRef.current?.contains(sel.anchorNode) || !paragraphRef.current?.contains(sel.focusNode)) {
      setSelectionPopover(null); return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const start = domOffsetToTextOffset(paragraphRef.current, range.startContainer, range.startOffset);
    const end = domOffsetToTextOffset(paragraphRef.current, range.endContainer, range.endOffset);
    setNoteDraft(null);
    setSelectionPopover({ text, x: rect.left + rect.width / 2, y: rect.bottom + 8, start, end });
  }

  function addAnnotation(type, note) {
    if (!selectionPopover) return;
    const { start, end } = selectionPopover;
    patchCS(currentIdx, {
      annotations: [...cs.annotations, { id: `${Date.now()}-${Math.random()}`, type, start, end, note }],
    });
    setSelectionPopover(null);
    setNoteDraft(null);
    window.getSelection()?.removeAllRanges();
  }

  function addQuote(text) {
    patchCS(currentIdx, { quotes: [...cs.quotes.filter(q => q !== text), text] });
    setSelectionPopover(null);
    setNoteDraft(null);
    window.getSelection()?.removeAllRanges();
  }

  function removeQuote(text) {
    patchCS(currentIdx, { quotes: cs.quotes.filter(q => q !== text) });
  }

  useEffect(() => {
    if (!selectionPopover || noteDraft !== null) return;
    const dismiss = () => setSelectionPopover(null);
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [selectionPopover, noteDraft]);

  // ── Session helpers ────────────────────────────────────────────────────────
  function isDeferred(sess) {
    if (!sess) return false;
    if (sess.practiceMode !== "analysis") return false;
    return sess.timerMode !== "untimed" || sess.feedbackMode === "deferred";
  }

  const finishSession = useCallback(async (sess) => {
    if (endedRef.current) return;
    endedRef.current = true;
    try { await completeSession(sess.id); } catch {}
    clearActiveSession();
    if (isDeferred(sess)) {
      navigate(`/session-review?sessionId=${sess.id}`, { replace: true });
    } else {
      navigate(`/results?sessionId=${sess.id}`, { replace: true });
    }
  }, [navigate]);

  // ── Nav guard: intercept nav clicks while a practice session is in progress.
  // Practice sessions aren't resumable — the user must End (attempted counted,
  // unattempted skipped) or Discard (deleted, never happened).
  const { registerGuard, clearGuard, attemptNav } = useNavGuard();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavePendingRef = useRef(null);
  const inProgressRef = useRef(false);
  useEffect(() => {
    // In progress while questions are loaded and the session hasn't ended.
    inProgressRef.current = !!questions && !endedRef.current;
  });
  useEffect(() => {
    registerGuard((to) => {
      if (inProgressRef.current) {
        leavePendingRef.current = to;
        setShowLeaveModal(true);
        return false;
      }
      return true;
    });
    return () => clearGuard();
  }, [registerGuard, clearGuard]);

  function requestExit() {
    if (!attemptNav("/dashboard")) return; // guard intercepted — shows LeaveSessionModal
    navigate("/dashboard");
  }

  // End session: record skips for every unanswered question, complete, leave.
  async function endSessionAndLeave() {
    if (leaving || !session || !questions) return;
    setLeaving(true);
    const to = leavePendingRef.current || "/dashboard";
    try {
      for (let i = 0; i < questions.length; i++) {
        const st = questionStates[i] || defaultQState();
        if (st.feedback || st.skipped) continue; // already resolved
        const startTime = questionStartTimesRef.current[i] || Date.now();
        try {
          await submitBasicAttempt({
            sessionId: session.id, questionId: questions[i].id,
            skipped: true,
            timeTakenSeconds: Math.floor((Date.now() - startTime) / 1000),
            mode: session.practiceMode || "analysis",
          });
        } catch {}
      }
      try { await completeSession(session.id); } catch {}
    } finally {
      endedRef.current = true;
      inProgressRef.current = false;
      clearActiveSession();
      setShowLeaveModal(false);
      leavePendingRef.current = null;
      navigate(to);
    }
  }

  // Discard: delete the session and all its attempts — as if it never happened.
  async function discardSessionAndLeave() {
    if (leaving || !session) return;
    setLeaving(true);
    const to = leavePendingRef.current || "/dashboard";
    try { await deleteSession(session.id); } catch {}
    endedRef.current = true;
    inProgressRef.current = false;
    clearActiveSession();
    setShowLeaveModal(false);
    leavePendingRef.current = null;
    navigate(to);
  }

  // Navigate to question by 0-based index
  function navigateTo(idx) {
    if (!questions || idx < 0 || idx >= questions.length) return;
    // Block if current question is locked but not yet submitted
    if (cs.locked && !cs.feedback) {
      setNavBlockMsg("Submit your reasoning before jumping to another question.");
      setTimeout(() => setNavBlockMsg(null), 2500);
      return;
    }
    stopVoice();
    setInterimText("");
    setSelectionPopover(null);
    setNoteDraft(null);
    setParagraphOpen(true);
    if (!questionStartTimesRef.current[idx]) {
      questionStartTimesRef.current[idx] = Date.now();
    }
    setCurrentIdx(idx);
  }

  // Skip current question
  const doSkip = useCallback(async (sess, idx, isAutoSkip = false) => {
    if (!questions || !questions[idx]) return;
    const currentS = questionStates[idx] || defaultQState();
    if (currentS.locked || currentS.skipped || currentS.feedback) return;
    if (isAutoSkip) autoActedRef.current = true;

    const q = questions[idx];
    const startTime = questionStartTimesRef.current[idx] || Date.now();
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    patchCS(idx, { isSkipping: true });
    try {
      await submitBasicAttempt({
        sessionId: sess.id,
        questionId: q.id,
        skipped: true,
        timeTakenSeconds: timeTaken,
        mode: sess.practiceMode || "analysis",
      });
      patchCS(idx, { isSkipping: false, skipped: true });
      // Auto-advance to next unanswered
      setQuestionStates(prev => {
        const nextIdx = findNextUnanswered(prev, idx);
        if (nextIdx !== null) {
          if (!questionStartTimesRef.current[nextIdx]) questionStartTimesRef.current[nextIdx] = Date.now();
          setCurrentIdx(nextIdx);
        } else {
          setShowEndModal(true);
        }
        return prev;
      });
    } catch (e) {
      patchCS(idx, { isSkipping: false });
      setError(e.message);
    }
  }, [questions, questionStates]);

  function findNextUnanswered(states, afterIdx) {
    if (!questions) return null;
    // First check after current index
    for (let i = afterIdx + 1; i < questions.length; i++) {
      const s = states[i] || defaultQState();
      if (!s.feedback && !s.skipped) return i;
    }
    // Wrap to beginning
    for (let i = 0; i < afterIdx; i++) {
      const s = states[i] || defaultQState();
      if (!s.feedback && !s.skipped) return i;
    }
    return null; // all done
  }

  // Lock the current answer (Analysis mode "Submit Answer" button)
  function lockAnswer() {
    if (cs.tentativeSelected === null || cs.locked) return;
    patchCS(currentIdx, {
      locked: true,
      lockedSelected: cs.tentativeSelected,
      lockTime: Date.now(),
    });
  }

  // Pause/resume the per-question timer (pre-lock only)
  function togglePause() {
    const idx = currentIdx;
    if (cs.pausedTimer) {
      const startedAt = pauseStartRef.current[idx];
      if (startedAt) pauseAccumRef.current[idx] = (pauseAccumRef.current[idx] || 0) + (Date.now() - startedAt);
      delete pauseStartRef.current[idx];
      patchCS(idx, { pausedTimer: false });
    } else {
      pauseStartRef.current[idx] = Date.now();
      patchCS(idx, { pausedTimer: true });
    }
  }

  // Submit reasoning (after lock)
  async function handleSubmit() {
    const s = cs;
    if (!s.locked || s.lockedSelected === null || !questions || s.submitting) return;
    const q = questions[currentIdx];
    const sess = session;
    const startTime = questionStartTimesRef.current[currentIdx] || Date.now();
    const timeTaken = Math.floor(((s.lockTime || Date.now()) - startTime) / 1000);
    const reasoning = s.reasoning.trim();

    patchCS(currentIdx, { submitting: true });
    setError(null);
    try {
      let fb;
      if (practiceMode === "analysis") {
        if (reasoning && !isDeferred(sess)) {
          fb = await submitEvaluateAttempt({
            sessionId: sess.id, questionId: q.id,
            selectedOptionIndex: s.lockedSelected,
            reasoningText: reasoning, timeTakenSeconds: timeTaken,
            mode: practiceMode, quotedLines: s.quotes, deferred: false,
          });
        } else if (reasoning && isDeferred(sess)) {
          fb = await submitEvaluateAttempt({
            sessionId: sess.id, questionId: q.id,
            selectedOptionIndex: s.lockedSelected,
            reasoningText: reasoning, timeTakenSeconds: timeTaken,
            mode: practiceMode, quotedLines: s.quotes, deferred: true,
          });
        } else {
          fb = await submitBasicAttempt({
            sessionId: sess.id, questionId: q.id,
            selectedOptionIndex: s.lockedSelected,
            timeTakenSeconds: timeTaken, mode: practiceMode,
          });
        }
      } else {
        // Intuition mode
        const elim = s.eliminated || [];
        fb = await submitBasicAttempt({
          sessionId: sess.id, questionId: q.id,
          selectedOptionIndex: s.tentativeSelected,
          timeTakenSeconds: timeTaken, mode: practiceMode,
          eliminatedIndices: elim,
        });
      }
      patchCS(currentIdx, { feedback: fb, submitting: false });
      if (practiceMode === "intuition" && fb.intuitionPoints != null) {
        setSessionPoints(p => p + fb.intuitionPoints);
      }
      // Check if all done
      setQuestionStates(prev => {
        const done = questions.every((_, i) => {
          if (i === currentIdx) return true; // just answered
          const ss = prev[i] || defaultQState();
          return ss.feedback !== null || ss.skipped;
        });
        if (done) setShowEndModal(true);
        return prev;
      });
    } catch (e) {
      patchCS(currentIdx, { submitting: false });
      setError(e.message);
    }
  }

  // Intuition submit (simpler — no lock step)
  async function handleIntuitionSubmit() {
    if (cs.tentativeSelected === null || cs.submitting || cs.skipped) return;
    const q = questions[currentIdx];
    const sess = session;
    const startTime = questionStartTimesRef.current[currentIdx] || Date.now();
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const elim = cs.eliminated || [];

    patchCS(currentIdx, { submitting: true });
    setError(null);
    try {
      const fb = await submitBasicAttempt({
        sessionId: sess.id, questionId: q.id,
        selectedOptionIndex: cs.tentativeSelected,
        timeTakenSeconds: timeTaken, mode: "intuition",
        eliminatedIndices: elim,
      });
      patchCS(currentIdx, { feedback: fb, submitting: false, locked: true, lockedSelected: cs.tentativeSelected });
      if (fb.intuitionPoints != null) setSessionPoints(p => p + fb.intuitionPoints);
      setQuestionStates(prev => {
        const done = questions.every((_, i) => {
          if (i === currentIdx) return true;
          const ss = prev[i] || defaultQState();
          return ss.feedback !== null || ss.skipped;
        });
        if (done) setShowEndModal(true);
        return prev;
      });
    } catch (e) {
      patchCS(currentIdx, { submitting: false });
      setError(e.message);
    }
  }

  function optionStatus(i) {
    const fb = cs.feedback;
    if (!fb) return null;
    const sel = cs.lockedSelected ?? cs.tentativeSelected;
    if (i === fb.correctOptionIndex) return sel === i ? "correct" : "correct-unselected";
    if (fb.trapOptionIndex != null && i === fb.trapOptionIndex) return "trap";
    if (i === sel) return "wrong";
    return null;
  }

  // Timer helpers — returns text/tone for display, plus numeric remaining/total
  // for the donut ring. Accounts for a pre-lock pause (elapsed freezes while
  // cs.pausedTimer is true) and the existing freeze-at-lock behavior.
  function timerInfo() {
    if (!session || session.practiceMode === "intuition") return null;
    if (session.timerMode === "untimed") return null;
    const perSession = session.timerScope === "per_session";
    const base = perSession ? sessionStartRef.current : (questionStartTimesRef.current[currentIdx] || Date.now());
    let nowPoint = tick;
    if (!perSession && cs.lockTime) nowPoint = cs.lockTime; // frozen at lock
    let pausedMs = 0;
    if (!perSession) {
      pausedMs = pauseAccumRef.current[currentIdx] || 0;
      if (cs.pausedTimer && pauseStartRef.current[currentIdx]) {
        pausedMs += tick - pauseStartRef.current[currentIdx];
      }
    }
    const elapsed = (nowPoint - base - pausedMs) / 1000;
    if (session.timerMode === "count_up") return { text: formatTime(elapsed), tone: "neutral", remaining: elapsed, total: null };
    const remaining = session.timerSeconds - elapsed;
    return {
      text: formatTime(remaining),
      tone: remaining <= 10 ? "danger" : remaining <= 20 ? "warn" : "ok",
      remaining, total: session.timerSeconds,
    };
  }

  function intuitionSecondsLeft() {
    if (!session || session.timerMode !== "countdown") return null;
    const start = questionStartTimesRef.current[currentIdx] || Date.now();
    return Math.max(0, session.timerSeconds - (tick - start) / 1000);
  }

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let s = loadActiveSession();
        if (!s) {
          const { session: active } = await getActiveSession();
          if (active) { s = { ...active, startedAt: Date.now() }; saveActiveSession(s); }
        }
        if (cancelled) return;
        if (!s) { navigate("/setup", { replace: true }); return; }
        sessionStartRef.current = s.startedAt || Date.now();
        setSession(s);
        const { questions: qs } = await getSessionQuestions(s.id);
        if (cancelled) return;
        questionStartTimesRef.current = { 0: Date.now() };
        setQuestions(qs);
        setQuestionStates(qs.map(() => defaultQState()));
        setLoadingQuestions(false);
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoadingQuestions(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Timer tick
  useEffect(() => {
    if (!session) return;
    const needsTick = session.timerMode !== "untimed" || session.practiceMode === "intuition";
    if (!needsTick) return;
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [session]);

  // Countdown enforcement
  useEffect(() => {
    if (!session || !questions || endedRef.current) return;
    const q = questions[currentIdx];
    if (!q) return;

    if (session.practiceMode === "intuition" && session.timerMode === "countdown") {
      if (cs.feedback || cs.submitting || cs.isSkipping) return;
      const start = questionStartTimesRef.current[currentIdx] || Date.now();
      const remaining = session.timerSeconds - (Date.now() - start) / 1000;
      if (remaining <= 0 && !autoActedRef.current) doSkip(session, currentIdx, true);
      return;
    }

    if (session.timerMode !== "countdown") return;
    if (session.timerScope === "per_session") {
      const remaining = session.timerSeconds - (Date.now() - sessionStartRef.current) / 1000;
      if (remaining <= 0) finishSession(session);
    } else {
      if (cs.locked || cs.feedback || cs.submitting || cs.isSkipping || cs.pausedTimer) return;
      const pausedMs = pauseAccumRef.current[currentIdx] || 0;
      const start = questionStartTimesRef.current[currentIdx] || Date.now();
      const remaining = session.timerSeconds - (Date.now() - start - pausedMs) / 1000;
      if (remaining <= 0 && !autoActedRef.current) doSkip(session, currentIdx, true);
    }
  }, [tick, currentIdx, session, questions, cs.locked, cs.feedback, cs.submitting, cs.isSkipping, cs.pausedTimer, finishSession, doSkip]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (error && !questions) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-destructive">Something went wrong: {error}</p>
        <Button className="mt-4" onClick={() => { setError(null); setLoadingQuestions(true); }}>
          Retry
        </Button>
      </div>
    );
  }

  if (loadingQuestions || !questions) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center muted">
        Loading questions…
      </div>
    );
  }

  const question = questions[currentIdx];
  if (!question) return null;

  // ── Intuition mode ─────────────────────────────────────────────────────────
  if (practiceMode === "intuition") {
    const secsLeft = intuitionSecondsLeft();
    const totalSecs = session.timerSeconds || 60;
    const fb = cs.feedback;
    const elim = new Set(cs.eliminated || []);

    return (
      <>
      <SessionTopBar current={currentIdx + 1} total={questions.length} modeLabel="Intuition" onExit={requestExit} />
      <QuestionStepper total={questions.length} currentIdx={currentIdx} questionStates={questionStates} onJump={navigateTo} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <MobileQuestionDots questions={questions} currentIdx={currentIdx} questionStates={questionStates} onJump={navigateTo} />
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-[55%]">
            <div className="flex items-center justify-between mb-4">
              {fb ? <TopicBadge topic={question.topic} /> : <span className="opacity-0 text-xs">·</span>}
              <div className="flex items-center gap-3">
                <span className="text-xs muted">Q{currentIdx + 1} of {questions.length}</span>
                <button type="button" onClick={() => setFlagModal({ questionId: question.id })}
                  title="Report issue" className="text-xs muted hover:text-amber-500 transition-colors">🚩</button>
              </div>
            </div>
            <p className="serif-read text-foreground" style={{ fontSize: "16px", lineHeight: 1.85, maxWidth: "600px" }}>{question.paragraph}</p>
          </div>

          <div className="md:w-[45%]">
            <div className="flex items-start justify-between">
              <div>
                {fb && <TypeBadge type={question.type} />}
                <h2 className={cn("font-bold text-foreground", fb ? "mt-2" : "")} style={{ fontSize: "17px" }}>{question.question}</h2>
              </div>
              {secsLeft !== null && !fb ? (
                <IntuitionTimer seconds={secsLeft} total={totalSecs} />
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{sessionPoints}</div>
                  <div className="text-xs muted">pts total</div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {question.options.map((opt, i) => {
                const isElim = elim.has(i);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={cn("flex-1", isElim && !fb && "opacity-50")}>
                      <OptionCard
                        letter={LETTERS[i]}
                        text={isElim && !fb ? <s>{opt.text}</s> : opt.text}
                        selected={cs.tentativeSelected === i}
                        status={optionStatus(i)}
                        trapBadge={!!fb && i === fb.trapOptionIndex}
                        disabled={!!fb || cs.submitting}
                        onClick={() => { if (!isElim) patchCS(currentIdx, { tentativeSelected: cs.tentativeSelected === i ? null : i }); }}
                      />
                    </div>
                    {!fb && (
                      <button type="button" title={isElim ? "Restore" : "Eliminate"}
                        onClick={() => {
                          const next = new Set(elim);
                          if (next.has(i)) next.delete(i);
                          else { next.add(i); if (cs.tentativeSelected === i) patchCS(currentIdx, { tentativeSelected: null }); }
                          patchCS(currentIdx, { eliminated: [...next] });
                        }}
                        className={cn("flex-none h-8 w-8 rounded-full border text-xs font-bold transition-colors",
                          isElim ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:border-destructive hover:text-destructive")}>
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            {!fb ? (
              <div className="mt-6 flex gap-3">
                <button
                  className="btn btn-primary fx-sheen flex-1"
                  disabled={cs.tentativeSelected === null || cs.submitting || cs.isSkipping}
                  onClick={handleIntuitionSubmit}>
                  {cs.submitting ? "Submitting…" : "Submit"}
                </button>
                <button className="btn btn-glass fx-ring" disabled={cs.submitting || cs.isSkipping}
                  onClick={() => doSkip(session, currentIdx)}>
                  {cs.isSkipping ? "Skipping…" : "Not sure"}
                </button>
              </div>
            ) : (
              <IntuitionFeedback
                feedback={fb}
                sessionPoints={sessionPoints}
                isLast={currentIdx === questions.length - 1}
                onNext={() => navigateTo(currentIdx + 1)}
                onEnd={() => setShowEndModal(true)}
              />
            )}
          </div>
        </div>

        {flagModal && <FlagModal questionId={flagModal.questionId} onClose={() => setFlagModal(null)}
          onSuccess={() => { setFlagModal(null); setFlagToast("Reported, thanks!"); setTimeout(() => setFlagToast(null), 3000); }} />}
        {flagToast && <div className="glass-floating fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-5 py-3 text-sm text-foreground">{flagToast}</div>}
        {showEndModal && <EndSessionModal onConfirm={() => finishSession(session)} onCancel={() => setShowEndModal(false)} />}
        {showLeaveModal && <LeaveSessionModal busy={leaving} onEnd={endSessionAndLeave} onDiscard={discardSessionAndLeave} onStay={() => { setShowLeaveModal(false); leavePendingRef.current = null; }} />}
      </div>
      </>
    );
  }

  // ── Analysis mode ──────────────────────────────────────────────────────────
  const timer = timerInfo();
  const REASONING_MAX = 500;
  const reasoningLen = cs.reasoning.trim().length;
  const fb = cs.feedback;

  const currentFont = PASSAGE_FONTS.find((f) => f.id === fontPrefs.fontId) || PASSAGE_FONTS[0];
  const currentSpacing = (LINE_SPACINGS.find((s) => s.id === fontPrefs.spacingId) || LINE_SPACINGS[1]).value;
  const segments = buildTextSegments(question.paragraph, cs.annotations);
  const wordCount = question.paragraph.trim().split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(wordCount / 200));

  return (
    <>
    <SessionTopBar
      current={currentIdx + 1}
      total={questions.length}
      timerText={timer?.text}
      timerTone={timer?.tone}
      modeLabel="Analysis"
      onExit={requestExit}
    />
    <QuestionStepper total={questions.length} currentIdx={currentIdx} questionStates={questionStates} onJump={navigateTo} />

    <div className="max-w-[1300px] mx-auto px-4 py-8 md:px-8 animate-fade-in">
      {session?.sessionType === "review" && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm flex items-center gap-2.5"
          style={{ background: "color-mix(in oklch, var(--amber) 9%, transparent)", borderColor: "color-mix(in oklch, var(--amber) 28%, transparent)", color: "var(--amber)" }}>
          <Icon name="clock" size={16} />
          <span><strong className="font-semibold">Spaced repetition review.</strong> Questions you previously got wrong, due for reinforcement.</span>
        </div>
      )}

      <MobileQuestionDots questions={questions} currentIdx={currentIdx} questionStates={questionStates} onJump={navigateTo} />

      {/* Nav-blocked message */}
      {navBlockMsg && (
        <div className="mb-4 rounded-md bg-warning/15 border border-warning/30 px-4 py-2 text-sm text-warning">
          {navBlockMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-10 md:pl-24">
        {/* Left — passage panel (52%) */}
        <div className="md:w-[52%] md:border-r md:pr-8" style={{ borderColor: "var(--glass-border-lo)" }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="mono text-[11px] uppercase dim">Question {currentIdx + 1}</span>
              <InfoDot wordCount={wordCount} readMins={readMins} />
            </div>
            <div className="flex items-center gap-2.5">
              <PassageFontMenu
                fontId={fontPrefs.fontId}
                onFontChange={(id) => setFontPrefs((p) => ({ ...p, fontId: id }))}
                fontSize={fontPrefs.fontSize}
                onFontSizeChange={(sz) => setFontPrefs((p) => ({ ...p, fontSize: sz }))}
                spacingId={fontPrefs.spacingId}
                onSpacingChange={(id) => setFontPrefs((p) => ({ ...p, spacingId: id }))}
                annotationCount={cs.annotations.length}
                onClearAnnotations={() => patchCS(currentIdx, { annotations: [] })}
              />
              {timer && (
                <TimerRing
                  seconds={Math.max(0, timer.remaining)}
                  totalSeconds={timer.total}
                  paused={!!cs.pausedTimer}
                  onTogglePause={
                    !cs.locked && session.timerMode === "countdown" && session.timerScope === "per_question"
                      ? togglePause
                      : undefined
                  }
                />
              )}
              <button type="button" onClick={() => setParagraphOpen((o) => !o)}
                className="md:hidden text-xs muted hover:text-foreground">
                {paragraphOpen ? "▲ Hide" : "▼ Passage"}
              </button>
            </div>
          </div>

          {paragraphOpen && (
            <p
              ref={paragraphRef}
              onMouseUp={handleParagraphMouseUp}
              className="select-text cursor-text muted"
              style={{ fontFamily: currentFont.family, fontSize: fontPrefs.fontSize, lineHeight: currentSpacing, maxWidth: 560 }}
            >
              {segments.map((seg, i) =>
                seg.ann ? (
                  <mark key={i} style={{ ...ANNOTATION_STYLES[seg.ann.type], color: "inherit" }} title={seg.ann.type === "note" ? seg.ann.note : undefined}>
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={() => setFlagModal({ questionId: question.id })}
              title="Report an issue with this question"
              className="flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: "var(--text-2)" }}>
              <Icon name="flag" size={14} /> Report issue
            </button>
          </div>
        </div>

        {/* Right — question + options + reasoning + submit */}
        <div className="md:w-[48%]">
          {fb && <TypeBadge type={question.type} />}
          <h2 className={cn("display", fb ? "mt-2" : "")} style={{ fontSize: "19px", lineHeight: 1.4 }}>
            {question.question}
          </h2>

          <div className="mt-5 flex flex-col gap-2.5">
            {question.options.map((opt, i) => (
              <OptionCard
                key={i}
                letter={LETTERS[i]}
                text={opt.text}
                selected={cs.locked ? cs.lockedSelected === i : cs.tentativeSelected === i}
                status={optionStatus(i)}
                trapBadge={!!fb && i === fb.trapOptionIndex}
                disabled={!!fb || cs.submitting || cs.locked}
                onClick={() => {
                  if (!cs.locked && !fb) patchCS(currentIdx, { tentativeSelected: cs.tentativeSelected === i ? null : i });
                }}
              />
            ))}
          </div>

          {/* Submit Answer button — visible when option selected but not yet locked */}
          {!cs.locked && !fb && cs.tentativeSelected !== null && (
            <div className="mt-4 animate-slide-up">
              <button className="btn btn-primary fx-sheen w-full" onClick={lockAnswer}>
                Submit Answer →
              </button>
              <p className="mt-1.5 text-center text-xs dim">
                You can still change your selection above
              </p>
            </div>
          )}

          {/* Reasoning textarea — appears after lock, before feedback */}
          {cs.locked && !fb && (
            <div className="mt-5 animate-slide-up">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-foreground">
                  Explain your reasoning <span className="font-normal dim">. What rules out the trap?</span>
                </label>
                {voiceSupported && (
                  <VoiceMicButton isRecording={isVoiceRecording} onClick={toggleVoice} disabled={cs.submitting} />
                )}
              </div>
              {cs.quotes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cs.quotes.map((q, qi) => (
                    <span key={qi} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs" style={{ border: "1px solid rgba(93,202,165,0.3)", background: "rgba(93,202,165,0.08)", color: "var(--teal)" }}>
                      <span className="italic" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>"{q}"</span>
                      <button type="button" onClick={() => removeQuote(q)} className="ml-0.5 flex-none opacity-60 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              )}
              <Textarea
                value={cs.reasoning}
                onChange={(e) => patchCS(currentIdx, { reasoning: e.target.value })}
                disabled={cs.submitting}
                rows={3}
                className="mt-2 resize-none"
                placeholder="Because the passage says…"
              />
              {interimText && <p className="mt-1 text-xs italic px-1 truncate dim">🎙 {interimText}</p>}
              {voiceError && <p className="mt-1 text-xs text-destructive">{voiceError}</p>}
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="dim">
                  {reasoningLen === 0 ? "A sentence or two is plenty." : reasoningLen < 20 ? "Add a little more…" : "Looks solid."}
                </span>
                <span className={cn("mono", reasoningLen > REASONING_MAX ? "text-destructive" : "dim")}>
                  {reasoningLen} / {REASONING_MAX}
                </span>
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          {/* Submit reasoning button — only when locked & no feedback yet.
              No skip here: the answer is already locked, so the user must submit. */}
          {cs.locked && !fb && (
            <div className="mt-4">
              <button className="btn btn-primary fx-sheen w-full"
                disabled={reasoningLen > REASONING_MAX || cs.submitting || cs.isSkipping}
                onClick={handleSubmit}>
                {cs.submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#07130E", borderTopColor: "transparent" }} />
                    {isDeferred(session) ? "Saving…" : reasoningLen > 0 ? "Analyzing…" : "Submitting…"}
                  </>
                ) : reasoningLen > REASONING_MAX ? (
                  `Too long (${reasoningLen}/${REASONING_MAX})`
                ) : isDeferred(session) ? (
                  "Submit Answer"
                ) : reasoningLen > 0 ? (
                  <>Get AI feedback <span className="mono ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 text-[11px]" style={{ background: "rgba(7,19,14,0.14)", color: "rgba(7,19,14,0.6)" }}>↵</span></>
                ) : (
                  "Submit (No AI Feedback)"
                )}
              </button>
              {cs.submitting && isDeferred(session) && <p className="mt-2 text-center text-xs dim">Saving your answer…</p>}
              {cs.submitting && !isDeferred(session) && reasoningLen > 0 && <p className="mt-2 text-center text-xs dim">Analyzing your reasoning…</p>}
            </div>
          )}

          {/* Not yet started state — show "Not sure" (skip) only */}
          {!cs.locked && !fb && cs.tentativeSelected === null && (
            <div className="mt-4">
              <button className="btn btn-glass fx-ring w-full" disabled={cs.isSkipping}
                onClick={() => doSkip(session, currentIdx)}>
                {cs.isSkipping ? "Skipping…" : "Not sure"}
              </button>
            </div>
          )}

          {/* Feedback */}
          {fb && (
            isDeferred(session) && fb?.deferred ? (
              <DeferredSavedCard
                feedback={fb}
                isLast={currentIdx === questions.length - 1}
                onNext={() => {
                  const nextIdx = findNextUnanswered(questionStates, currentIdx);
                  if (nextIdx !== null) navigateTo(nextIdx);
                  else setShowEndModal(true);
                }}
                onEnd={() => setShowEndModal(true)}
              />
            ) : (
              <AnalysisFeedback
                feedback={fb}
                question={question}
                selectedOptionIndex={cs.lockedSelected}
                reasoningText={cs.reasoning.trim() || undefined}
                isLast={currentIdx === questions.length - 1}
                onNext={() => {
                  const nextIdx = findNextUnanswered(questionStates, currentIdx);
                  if (nextIdx !== null) navigateTo(nextIdx);
                  else setShowEndModal(true);
                }}
                onEnd={() => setShowEndModal(true)}
              />
            )
          )}
        </div>
      </div>
    </div>

    {/* Selection popover — Highlight / Underline / Note / Quote */}
    {selectionPopover && (
      <div style={{ position: "fixed", left: selectionPopover.x, top: selectionPopover.y, transform: "translateX(-50%)", zIndex: 120 }}>
        <div
          className="flex items-center gap-0.5 rounded-[12px] p-[3px]"
          style={{ background: "rgba(20,23,31,0.95)", backdropFilter: "blur(18px) saturate(150%)", WebkitBackdropFilter: "blur(18px) saturate(150%)", border: "1px solid rgba(255,255,255,0.14)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {noteDraft === null ? (
            <>
              <SelToolBtn onClick={() => addAnnotation("highlight")}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--teal)" }} /> Highlight
              </SelToolBtn>
              <span className="mx-0.5 h-4 w-px" style={{ background: "rgba(255,255,255,0.14)" }} />
              <SelToolBtn onClick={() => addAnnotation("underline")}>
                <span className="h-[2px] w-3 rounded-full" style={{ background: "var(--periwinkle)" }} /> Underline
              </SelToolBtn>
              <span className="mx-0.5 h-4 w-px" style={{ background: "rgba(255,255,255,0.14)" }} />
              <SelToolBtn onClick={() => setNoteDraft("")}>
                <Icon name="pencil" size={13} style={{ color: "var(--amber)" }} /> Note
              </SelToolBtn>
              {cs.locked && !cs.feedback && practiceMode === "analysis" && (
                <>
                  <span className="mx-0.5 h-4 w-px" style={{ background: "rgba(255,255,255,0.14)" }} />
                  <SelToolBtn onClick={() => addQuote(selectionPopover.text)}>
                    <span style={{ color: "var(--teal)" }}>❝</span> Quote
                  </SelToolBtn>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 p-1">
              <input
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && noteDraft.trim()) addAnnotation("note", noteDraft.trim()); }}
                placeholder="Add a note…"
                className="rounded-[8px] px-2.5 py-1.5 text-[12.5px]"
                style={{ width: 180, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "var(--text)" }}
              />
              <button
                type="button"
                disabled={!noteDraft.trim()}
                onClick={() => addAnnotation("note", noteDraft.trim())}
                className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold"
                style={{ background: "var(--amber)", color: "#07130E" }}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {flagModal && <FlagModal questionId={flagModal.questionId} onClose={() => setFlagModal(null)}
      onSuccess={() => { setFlagModal(null); setFlagToast("Reported, thanks for the feedback!"); setTimeout(() => setFlagToast(null), 3500); }} />}

    {flagToast && (
      <div className="glass-floating fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-5 py-3 text-sm font-medium text-foreground">
        {flagToast}
      </div>
    )}

    {showEndModal && <EndSessionModal onConfirm={() => finishSession(session)} onCancel={() => setShowEndModal(false)} />}
    {showLeaveModal && <LeaveSessionModal busy={leaving} onEnd={endSessionAndLeave} onDiscard={discardSessionAndLeave} onStay={() => { setShowLeaveModal(false); leavePendingRef.current = null; }} />}
    </>
  );
}

function SelToolBtn({ onClick, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors"
      style={{ color: "var(--text)", background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

// Small (i) info dot with a hover tooltip showing word count + read time.
function InfoDot({ wordCount, readMins }) {
  const [hover, setHover] = useState(false);
  return (
    <span className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full font-serif text-[11px] italic"
        style={{ border: "1px solid rgba(255,255,255,0.22)", color: "var(--text-2)", cursor: "default" }}
      >
        i
      </span>
      {hover && (
        <div
          className="absolute left-0 top-[calc(100%+9px)] z-[80] rounded-[11px] px-[13px] py-[10px]"
          style={{ background: "rgba(20,23,31,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid var(--glass-border-hi)", whiteSpace: "nowrap" }}
        >
          <div className="mono text-[12.5px] font-semibold text-foreground">{wordCount} words</div>
          <div className="mt-0.5 text-[11.5px] dim">about {readMins} min read</div>
        </div>
      )}
    </span>
  );
}

// Compact mobile-only question dots (QuestionStepper hides below md).
function MobileQuestionDots({ questions, currentIdx, questionStates, onJump }) {
  return (
    <div className="mb-4 flex items-center gap-1.5 overflow-x-auto md:hidden">
      {questions.map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          className="h-2.5 w-2.5 flex-none rounded-full transition-transform"
          style={{
            background: statusDotColor(stateFor(questionStates[i] || {})),
            outline: i === currentIdx ? "2px solid var(--teal)" : "none",
            outlineOffset: 2,
          }}
        />
      ))}
    </div>
  );
}

// ── End session confirm modal ─────────────────────────────────────────────────
function EndSessionModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="glass-floating w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-foreground mb-2">Submit session?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          All questions answered. Submit the session to see your results, or keep reviewing.
        </p>
        <div className="flex gap-3">
          <Button className="fx-sheen flex-1" onClick={onConfirm}>Submit session</Button>
          <Button variant="outline" className="flex-1" onClick={onCancel}>Keep reviewing</Button>
        </div>
      </div>
    </div>
  );
}

// ── Leave-session modal (nav away mid-practice) ───────────────────────────────
// Practice sessions aren't resumable: End (counts answered, skips the rest) or
// Discard (deletes the session entirely — as if it never happened).
function LeaveSessionModal({ busy, onEnd, onDiscard, onStay }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="glass-floating w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-foreground mb-2">Leave this session?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Practice sessions can't be resumed. <strong>End</strong> keeps your answered
          questions (the rest count as skipped). <strong>Discard</strong> deletes the
          session entirely, as if it never happened.
        </p>
        <div className="flex flex-col gap-2">
          <Button className="fx-sheen w-full" disabled={busy} onClick={onEnd}>
            {busy ? "Ending…" : "End session"}
          </Button>
          <Button variant="destructive" className="w-full" disabled={busy} onClick={onDiscard}>
            {busy ? "Discarding…" : "Discard session"}
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={onStay}>
            Stay
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Deferred mode — minimal "saved" confirmation, no AI feedback ─────────────
function DeferredSavedCard({ feedback, isLast, onNext, onEnd }) {
  return (
    <div className="mt-6 space-y-3 animate-slide-up">
      <div className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
        feedback.isCorrect
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive"
      )}>
        {feedback.isCorrect ? "✓ Correct" : "✗ Incorrect"}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          Reasoning saved, full feedback after the session
        </span>
      </div>
      <button className="btn btn-primary fx-sheen w-full" onClick={isLast ? onEnd : onNext}>
        {isLast ? "End Session & Get Feedback" : "Next Question →"}
      </button>
    </div>
  );
}

// ── Analysis mode feedback — tabbed AI feedback card ──────────────────────────
function AnalysisFeedback({ feedback, question, selectedOptionIndex, reasoningText, isLast, onNext, onEnd }) {
  const attempt = {
    options: question.options,
    correctOptionIndex: feedback.correctOptionIndex,
    selectedOptionIndex,
    trapOptionIndex: feedback.trapOptionIndex,
    isCorrect: feedback.isCorrect,
    skipped: false,
    trapType: feedback.trapType,
    reasoningScore: feedback.reasoningScore,
    reasoningFeedback: feedback.reasoningFeedback,
    correctExplanation: feedback.correctExplanation,
    trapExplanation: feedback.trapExplanation,
    keyTakeaway: feedback.keyTakeaway,
    reasoningText,
  };

  return (
    <div className="mt-6 animate-slide-up">
      {feedback.aiError && (
        <div className="mb-4 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
          {feedback.aiErrorMessage || "AI feedback unavailable. Your attempt was saved."}
        </div>
      )}
      <FeedbackSections attempt={attempt} />
      <button className="btn btn-primary fx-sheen mt-6 w-full" onClick={isLast ? onEnd : onNext}>
        {isLast ? "Finish · See your results" : "Next question →"}
      </button>
    </div>
  );
}

// ── Flag modal — report a problem with a question ──────────────────────────────
const FLAG_REASONS = [
  { value: "confusing_wording", label: "Confusing wording" },
  { value: "possible_error",    label: "Possible error" },
  { value: "ambiguous_options", label: "Ambiguous options" },
  { value: "too_difficult",     label: "Too difficult" },
  { value: "revisit_later",     label: "Revisit later" },
];

function FlagModal({ questionId, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason) { setErr("Please select a reason."); return; }
    setBusy(true); setErr(null);
    try {
      await flagQuestion(questionId, reason, note);
      onSuccess();
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="glass-floating w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-foreground mb-1">Flag this question</h2>
        <p className="text-xs muted mb-4">Tell us what to look at.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="mono mb-2 text-[9.5px] uppercase tracking-wide dim">What is the issue?</div>
            <div className="flex flex-wrap gap-2">
              {FLAG_REASONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReason(value)}
                  className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors"
                  style={
                    reason === value
                      ? { background: "rgba(240,168,104,0.16)", border: "1px solid rgba(240,168,104,0.5)", color: "var(--amber)" }
                      : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text)" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mono mb-2 text-[9.5px] uppercase tracking-wide dim">Add detail (optional)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              className="w-full resize-none rounded-[12px] px-3.5 py-3 text-sm"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text)" }}
              placeholder="Describe what felt off, in your own words."
            />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy} className="btn btn-primary fx-sheen flex-1">
              {busy ? "Sending…" : "Save flag"}
            </button>
            <button type="button" onClick={onClose} disabled={busy} className="btn btn-glass fx-ring">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Intuition mode lightweight feedback (no AI, instant) ─────────────────────
function IntuitionFeedback({ feedback, sessionPoints, isLast, onNext, onEnd }) {
  const trapLetter = feedback.trapOptionIndex != null ? LETTERS[feedback.trapOptionIndex] : null;
  const pts = feedback.intuitionPoints;
  const ptsText = pts > 0 ? `+${pts}` : String(pts);
  const ptsColor = pts > 0 ? "text-success" : "text-destructive";

  return (
    <div className="mt-6 space-y-4 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className={cn("text-2xl font-bold", feedback.isCorrect ? "text-success" : "text-destructive")}>
          {feedback.isCorrect ? "Correct" : "Incorrect"}
        </div>
        <div className="text-right">
          <div className={cn("text-2xl font-bold", ptsColor)}>{ptsText} pts</div>
          <div className="text-xs muted">{sessionPoints} total</div>
        </div>
      </div>

      {trapLetter && (
        <div className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
          <span className="font-semibold">The trap: {trapLetter}.</span>{" "}
          {trapLabel(feedback.trapType)}. {trapDescription(feedback.trapType)}
        </div>
      )}

      {feedback.isCorrect && (
        <div className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
          Correct answer: {LETTERS[feedback.correctOptionIndex]}
        </div>
      )}

      <button className="btn btn-primary fx-sheen w-full" onClick={isLast ? onEnd : onNext}>
        {isLast ? "End Session" : "Next"}
      </button>
    </div>
  );
}
