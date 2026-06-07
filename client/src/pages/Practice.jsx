import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import OptionCard from "../components/OptionCard.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import IntuitionTimer from "../components/IntuitionTimer.jsx";
import FeedbackSections from "../components/FeedbackSections.jsx";
import { Button } from "../components/ui/button.jsx";
import { Textarea } from "../components/ui/input.jsx";
import VoiceMicButton from "../components/VoiceMicButton.jsx";
import { useVoiceInput } from "../hooks/useVoiceInput.js";
import { cn } from "../lib/utils.js";
import {
  getNextQuestion,
  submitBasicAttempt,
  submitEvaluateAttempt,
  getActiveSession,
  completeSession,
} from "../api.js";
import { loadActiveSession, saveActiveSession, clearActiveSession } from "../session.js";
import { trapLabel, trapDescription } from "../trapTypes.js";

const LETTERS = ["A", "B", "C", "D"];

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function Practice() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(Date.now());

  // Analysis-mode reasoning input
  const [reasoningText, setReasoningText] = useState("");
  const [interimText, setInterimText] = useState("");     // live voice preview (not committed)
  const reasoningRef = useRef("");                         // stable ref so voice callbacks don't go stale

  // Phase 12: quote-to-reasoning
  const [quotes, setQuotes] = useState([]);
  const [selectionPopover, setSelectionPopover] = useState(null); // { text, x, y }
  const paragraphRef = useRef(null);

  // Mobile paragraph toggle
  const [paragraphOpen, setParagraphOpen] = useState(true);

  // Intuition-mode state
  const [eliminated, setEliminated] = useState(new Set());
  const [sessionPoints, setSessionPoints] = useState(0);

  const questionStartRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const frozenElapsedRef = useRef(null);
  const autoActedRef = useRef(false);
  const endedRef = useRef(false);

  const practiceMode = session?.practiceMode || "analysis";

  // ── Voice input (Phase 11) ────────────────────────────────────────────────
  // Keep the ref in sync so voice callbacks always see the latest text.
  useEffect(() => { reasoningRef.current = reasoningText; }, [reasoningText]);

  const handleFinalTranscript = useCallback((text) => {
    const current = reasoningRef.current;
    const sep = current && !current.endsWith(" ") ? " " : "";
    setReasoningText(current + sep + text);
    setInterimText("");
  }, []);

  const { isRecording: isVoiceRecording, isSupported: voiceSupported, error: voiceError,
          toggle: toggleVoice, stop: stopVoice } = useVoiceInput({
    onFinalTranscript: handleFinalTranscript,
    onInterimTranscript: setInterimText,
  });

  // Stop recording if the user submits mid-speech
  useEffect(() => {
    if (submitting && isVoiceRecording) stopVoice();
  }, [submitting, isVoiceRecording, stopVoice]);

  // Clear interim text when moving to the next question
  const resetVoice = useCallback(() => {
    stopVoice();
    setInterimText("");
  }, [stopVoice]);

  // ── Quote-to-reasoning (Phase 12) ────────────────────────────────────────
  function handleParagraphMouseUp() {
    if (feedback || practiceMode !== "analysis") return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 5) { setSelectionPopover(null); return; }
    if (
      !sel.rangeCount ||
      !paragraphRef.current?.contains(sel.anchorNode) ||
      !paragraphRef.current?.contains(sel.focusNode)
    ) { setSelectionPopover(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelectionPopover({ text, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  }

  function addQuote(text) {
    setQuotes((prev) => (prev.includes(text) ? prev : [...prev, text]));
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }

  function removeQuote(text) {
    setQuotes((prev) => prev.filter((q) => q !== text));
  }

  // Dismiss quote popover on any click outside it
  useEffect(() => {
    if (!selectionPopover) return;
    const dismiss = () => setSelectionPopover(null);
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [selectionPopover]);

  // A session is "deferred" if it has a timer OR the user picked "after session" feedback.
  // In deferred mode, reasoning is saved but AI evaluation runs at the end.
  function isDeferred(sess) {
    if (!sess) return false;
    if (sess.practiceMode !== "analysis") return false;
    return sess.timerMode !== "untimed" || sess.feedbackMode === "deferred";
  }

  const finishSession = useCallback(
    async (sess) => {
      if (endedRef.current) return;
      endedRef.current = true;
      try { await completeSession(sess.id); } catch {}
      clearActiveSession();
      if (isDeferred(sess)) {
        navigate(`/session-review?sessionId=${sess.id}`, { replace: true });
      } else {
        navigate(`/results?sessionId=${sess.id}`, { replace: true });
      }
    },
    [navigate]
  );

  const loadNext = useCallback(
    async (sess) => {
      resetVoice();
      setQuotes([]);
      setSelectionPopover(null);
      setLoadingQuestion(true);
      setError(null);
      setFeedback(null);
      setSelected(null);
      setEliminated(new Set());
      setReasoningText("");
      setParagraphOpen(true);
      frozenElapsedRef.current = null;
      try {
        const q = await getNextQuestion(sess.id);
        if (q.done) { await finishSession(sess); return; }
        setQuestion(q);
        questionStartRef.current = Date.now();
        autoActedRef.current = false;
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingQuestion(false);
      }
    },
    [finishSession, resetVoice]
  );

  const doSkip = useCallback(
    async (sess, q, isAutoSkip = false) => {
      if (autoActedRef.current && isAutoSkip) return;
      if (isAutoSkip) autoActedRef.current = true;
      const timeTaken = Math.floor((Date.now() - questionStartRef.current) / 1000);
      setSubmitting(true);
      try {
        await submitBasicAttempt({
          sessionId: sess.id,
          questionId: q.id,
          skipped: true,
          timeTakenSeconds: timeTaken,
          mode: sess.practiceMode || "analysis",
        });
        await loadNext(sess);
      } catch (e) { setError(e.message); }
      finally { setSubmitting(false); }
    },
    [loadNext]
  );

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
        await loadNext(s);
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoadingQuestion(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, loadNext]);

  // Timer tick
  useEffect(() => {
    if (!session) return;
    const needsTick = session.timerMode !== "untimed" || session.practiceMode === "intuition";
    if (!needsTick) return;
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [session]);

  // Countdown enforcement (analysis) + intuition per-question auto-submit
  useEffect(() => {
    if (!session || !question || endedRef.current) return;

    if (session.practiceMode === "intuition" && session.timerMode === "countdown") {
      if (feedback || submitting) return;
      const remaining = session.timerSeconds - (Date.now() - questionStartRef.current) / 1000;
      if (remaining <= 0 && !autoActedRef.current) {
        autoActedRef.current = true;
        doSkip(session, question, true);
      }
      return;
    }

    if (session.timerMode !== "countdown") return;
    if (session.timerScope === "per_session") {
      const remaining = session.timerSeconds - (Date.now() - sessionStartRef.current) / 1000;
      if (remaining <= 0) finishSession(session);
    } else {
      if (feedback || submitting) return;
      const remaining = session.timerSeconds - (Date.now() - questionStartRef.current) / 1000;
      if (remaining <= 0 && !autoActedRef.current) {
        autoActedRef.current = true;
        doSkip(session, question, true);
      }
    }
  }, [tick, feedback, submitting, question, session, finishSession, doSkip]);

  async function handleSubmit() {
    if (selected === null || !question || !session || submitting) return;
    const timeTaken = Math.floor((Date.now() - questionStartRef.current) / 1000);
    frozenElapsedRef.current = timeTaken;
    setSubmitting(true);
    setError(null);
    try {
      let fb;
      if (practiceMode === "analysis") {
        fb = await submitEvaluateAttempt({
          sessionId: session.id,
          questionId: question.id,
          selectedOptionIndex: selected,
          reasoningText: reasoningText.trim(),
          timeTakenSeconds: timeTaken,
          mode: practiceMode,
          quotedLines: quotes,
          deferred: isDeferred(session),
        });
      } else {
        fb = await submitBasicAttempt({
          sessionId: session.id,
          questionId: question.id,
          selectedOptionIndex: selected,
          timeTakenSeconds: timeTaken,
          mode: practiceMode,
          eliminatedIndices: [...eliminated],
        });
      }
      setFeedback(fb);
      if (practiceMode === "intuition" && fb.intuitionPoints != null) {
        setSessionPoints((p) => p + fb.intuitionPoints);
      }
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  function optionStatus(i) {
    if (!feedback) return null;
    if (i === feedback.correctOptionIndex) return selected === i ? "correct" : "correct-unselected";
    if (i === selected) return "wrong";
    return null;
  }

  // Timer helpers (analysis mode)
  function timerInfo() {
    if (!session || session.practiceMode === "intuition") return null;
    if (session.timerMode === "untimed") return null;
    const perSession = session.timerScope === "per_session";
    const base = perSession ? sessionStartRef.current : questionStartRef.current;
    let elapsed = (tick - base) / 1000;
    if (!perSession && feedback && frozenElapsedRef.current != null) elapsed = frozenElapsedRef.current;
    if (session.timerMode === "count_up") return { text: formatTime(elapsed), tone: "neutral" };
    const remaining = session.timerSeconds - elapsed;
    return {
      text: formatTime(remaining),
      tone: remaining <= 10 ? "danger" : remaining <= 20 ? "warn" : "ok",
    };
  }

  function intuitionSecondsLeft() {
    if (!session || session.timerMode !== "countdown") return null;
    return Math.max(0, session.timerSeconds - (tick - questionStartRef.current) / 1000);
  }

  if (error && !question) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-destructive">Something went wrong: {error}</p>
        <Button className="mt-4" onClick={() => session && loadNext(session)}>
          Retry
        </Button>
      </div>
    );
  }

  if (loadingQuestion || !question) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        Loading question…
      </div>
    );
  }

  // ── Intuition mode layout ─────────────────────────────────────────────────
  if (practiceMode === "intuition") {
    const secsLeft = intuitionSecondsLeft();
    const totalSecs = session.timerSeconds || 60;

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left — paragraph */}
          <div className="md:w-[55%]">
            <div className="flex items-center justify-between mb-4">
              <TopicBadge topic={question.topic} />
              <span className="text-xs text-muted-foreground">
                Question {question.index} of {question.total}
              </span>
            </div>
            <p
              className="font-reading text-foreground"
              style={{ fontSize: "16px", lineHeight: 1.85, maxWidth: "600px" }}
            >
              {question.paragraph}
            </p>
          </div>

          {/* Right — question, timer ring, options */}
          <div className="md:w-[45%]">
            <div className="flex items-start justify-between">
              <div>
                <TypeBadge type={question.type} />
                <h2 className="mt-2 font-bold text-foreground" style={{ fontSize: "17px" }}>
                  {question.question}
                </h2>
              </div>
              {secsLeft !== null && !feedback ? (
                <IntuitionTimer seconds={secsLeft} total={totalSecs} />
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{sessionPoints}</div>
                  <div className="text-xs text-muted-foreground">pts total</div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {question.options.map((opt, i) => {
                const isElim = eliminated.has(i);
                const afterStatus = optionStatus(i);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={cn("flex-1", isElim && !feedback && "opacity-50")}>
                      <OptionCard
                        letter={LETTERS[i]}
                        text={isElim && !feedback ? <s>{opt.text}</s> : opt.text}
                        selected={selected === i}
                        status={afterStatus}
                        disabled={feedback !== null || submitting}
                        onClick={() => { if (!isElim) setSelected(i); }}
                      />
                    </div>
                    {!feedback && (
                      <button
                        type="button"
                        title={isElim ? "Restore" : "Eliminate"}
                        onClick={() => setEliminated((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) { next.delete(i); }
                          else { next.add(i); if (selected === i) setSelected(null); }
                          return next;
                        })}
                        className={cn(
                          "flex-none h-8 w-8 rounded-full border text-xs font-bold transition-colors",
                          isElim
                            ? "border-foreground bg-foreground text-background"
                            : "border-input text-muted-foreground hover:border-destructive hover:text-destructive"
                        )}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            {!feedback ? (
              <div className="mt-6 flex gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  disabled={selected === null || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={submitting}
                  onClick={() => doSkip(session, question)}
                >
                  Skip
                </Button>
              </div>
            ) : (
              <IntuitionFeedback
                feedback={feedback}
                sessionPoints={sessionPoints}
                isLast={question.index === question.total}
                onNext={() => loadNext(session)}
                onEnd={() => finishSession(session)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Analysis mode layout ──────────────────────────────────────────────────
  const timer = timerInfo();
  const timerColor =
    timer?.tone === "danger"
      ? "text-destructive"
      : timer?.tone === "warn"
      ? "text-warning"
      : "text-muted-foreground";
  const reasoningLen = reasoningText.trim().length;
  const REASONING_MAX = 500;
  const canSubmit = selected !== null && reasoningLen <= REASONING_MAX;

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      {session?.sessionType === "review" && (
        <div className="mb-6 rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <span className="text-base">🔁</span>
          <span><strong>Spaced repetition review</strong> — these are questions you previously got wrong, due for reinforcement.</span>
        </div>
      )}
      {question.repeating && session?.sessionType !== "review" && (
        <div className="mb-6 rounded-md bg-primary/10 px-4 py-3 text-sm text-primary">
          You've seen all 25 questions — repeating from the full question bank.
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left — paragraph */}
        <div className="md:w-[55%]">
          <div className="flex items-center justify-between mb-4">
            <TopicBadge topic={question.topic} />
            <div className="flex items-center gap-3">
              {timer && (
                <span className={cn("text-sm font-mono tabular-nums", timerColor)}>
                  {timer.text}
                </span>
              )}
              {/* Mobile paragraph toggle */}
              <button
                type="button"
                onClick={() => setParagraphOpen((o) => !o)}
                className="md:hidden text-xs text-muted-foreground hover:text-foreground"
              >
                {paragraphOpen ? "▲ Hide" : "▼ Passage"}
              </button>
            </div>
          </div>
          <div className={cn("transition-opacity duration-300", loadingQuestion ? "opacity-0" : "opacity-100")}>
            {paragraphOpen && (
              <p
                ref={paragraphRef}
                onMouseUp={handleParagraphMouseUp}
                className="font-reading text-foreground select-text cursor-text"
                style={{ fontSize: "16px", lineHeight: 1.85, maxWidth: "600px" }}
              >
                {question.paragraph}
              </p>
            )}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Question {question.index} of {question.total}
          </p>
        </div>

        {/* Right — question + options + reasoning + submit */}
        <div className="md:w-[45%]">
          <TypeBadge type={question.type} />
          <h2 className="mt-3 font-bold text-foreground" style={{ fontSize: "17px" }}>
            {question.question}
          </h2>

          <div className="mt-5 flex flex-col gap-3">
            {question.options.map((opt, i) => (
              <OptionCard
                key={i}
                letter={LETTERS[i]}
                text={opt.text}
                selected={selected === i}
                status={optionStatus(i)}
                disabled={feedback !== null || submitting}
                onClick={() => setSelected(i)}
              />
            ))}
          </div>

          {/* Reasoning textarea — appears after option is selected, before feedback */}
          {selected !== null && !feedback && (
            <div className="mt-5 animate-slide-up">
              <div className="flex items-baseline justify-between">
                <label className="block text-sm font-semibold text-foreground">
                  Why did you choose this option?
                </label>
                {voiceSupported && (
                  <span className="text-xs text-muted-foreground">
                    {isVoiceRecording ? "🎙 Listening…" : "Mic available"}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reference the paragraph — select text in the passage to quote it as evidence.
              </p>
              {quotes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quotes.map((q, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs text-primary"
                    >
                      <span className="italic" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>"{q}"</span>
                      <button
                        type="button"
                        onClick={() => removeQuote(q)}
                        aria-label="Remove quote"
                        className="ml-0.5 flex-none opacity-60 hover:opacity-100"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-start gap-2">
                <Textarea
                  value={reasoningText}
                  onChange={(e) => setReasoningText(e.target.value)}
                  disabled={submitting}
                  rows={3}
                  className="flex-1 resize-none"
                  placeholder="e.g. The paragraph says… which supports option B because…"
                />
                {voiceSupported && (
                  <VoiceMicButton
                    isRecording={isVoiceRecording}
                    onClick={toggleVoice}
                    disabled={submitting}
                  />
                )}
              </div>

              {/* Live interim preview while speaking */}
              {interimText && (
                <p className="mt-1 text-xs text-muted-foreground italic px-1 truncate">
                  🎙 {interimText}
                </p>
              )}

              {/* Voice error */}
              {voiceError && (
                <p className="mt-1 text-xs text-destructive">{voiceError}</p>
              )}

              <div
                className={cn(
                  "mt-1 text-right text-xs",
                  reasoningLen > REASONING_MAX ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {reasoningLen} / {REASONING_MAX}
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          {!feedback ? (
            <div className="mt-4">
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  disabled={!canSubmit || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      {isDeferred(session) ? "Saving…" : "Analyzing…"}
                    </>
                  ) : selected === null ? (
                    "Select an option first"
                  ) : reasoningLen > REASONING_MAX ? (
                    `Reasoning too long (${reasoningLen}/${REASONING_MAX})`
                  ) : isDeferred(session) ? (
                    "Submit Answer"
                  ) : (
                    "Evaluate My Reasoning"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={submitting}
                  onClick={() => doSkip(session, question)}
                >
                  Skip
                </Button>
              </div>
              {submitting && isDeferred(session) && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Saving your answer…
                </p>
              )}
              {submitting && !isDeferred(session) && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Analyzing your reasoning…
                </p>
              )}
            </div>
          ) : isDeferred(session) && feedback?.deferred ? (
            <DeferredSavedCard
              feedback={feedback}
              isLast={question.index === question.total}
              onNext={() => loadNext(session)}
              onEnd={() => finishSession(session)}
            />
          ) : (
            <AnalysisFeedback
              feedback={feedback}
              question={question}
              selectedOptionIndex={selected}
              isLast={question.index === question.total}
              onNext={() => loadNext(session)}
              onEnd={() => finishSession(session)}
            />
          )}
        </div>
      </div>
    </div>

    {/* Quote popover — fixed position near text selection */}
    {selectionPopover && (
      <div
        style={{
          position: "fixed",
          left: selectionPopover.x,
          top: selectionPopover.y,
          transform: "translateX(-50%)",
          zIndex: 50,
        }}
      >
        <button
          type="button"
          onMouseDown={(e) => { e.stopPropagation(); addQuote(selectionPopover.text); }}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-lg"
        >
          ❝ Quote
        </button>
      </div>
    )}
    </>
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
          Reasoning saved — full feedback after the session
        </span>
      </div>
      <Button className="w-full" size="lg" onClick={isLast ? onEnd : onNext}>
        {isLast ? "End Session & Get Feedback" : "Next Question →"}
      </Button>
    </div>
  );
}

// ── Analysis mode feedback — full 5-section AI feedback card ─────────────────
function AnalysisFeedback({ feedback, question, selectedOptionIndex, isLast, onNext, onEnd }) {
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
  };

  return (
    <div className="mt-6 animate-slide-up">
      {feedback.aiError && (
        <div className="mb-4 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
          {feedback.aiErrorMessage || "AI feedback unavailable — your attempt was saved."}
        </div>
      )}
      <FeedbackSections attempt={attempt} />
      <Button className="mt-6 w-full" size="lg" onClick={isLast ? onEnd : onNext}>
        {isLast ? "End Session" : "Next Question"}
      </Button>
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
          <div className="text-xs text-muted-foreground">{sessionPoints} total</div>
        </div>
      </div>

      {trapLetter && (
        <div className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
          <span className="font-semibold">The trap: {trapLetter}.</span>{" "}
          {trapLabel(feedback.trapType)} — {trapDescription(feedback.trapType)}
        </div>
      )}

      {feedback.isCorrect && (
        <div className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
          Correct answer: {LETTERS[feedback.correctOptionIndex]}
        </div>
      )}

      <Button className="w-full" size="lg" onClick={isLast ? onEnd : onNext}>
        {isLast ? "End Session" : "Next"}
      </Button>
    </div>
  );
}
