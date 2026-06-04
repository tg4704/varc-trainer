import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import OptionCard from "../components/OptionCard.jsx";
import TopicBadge from "../components/TopicBadge.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import IntuitionTimer from "../components/IntuitionTimer.jsx";
import FeedbackSections from "../components/FeedbackSections.jsx";
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

  const finishSession = useCallback(
    async (sess) => {
      if (endedRef.current) return;
      endedRef.current = true;
      try { await completeSession(sess.id); } catch {}
      clearActiveSession();
      navigate(`/results?sessionId=${sess.id}`, { replace: true });
    },
    [navigate]
  );

  const loadNext = useCallback(
    async (sess) => {
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
    [finishSession]
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
        <p className="text-red-600">Something went wrong: {error}</p>
        <button onClick={() => session && loadNext(session)}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Retry
        </button>
      </div>
    );
  }

  if (loadingQuestion || !question) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-400">Loading question…</div>;
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
              <span className="text-xs text-slate-400">Question {question.index} of {question.total}</span>
            </div>
            <p className="font-reading text-slate-800" style={{ fontSize: "16px", lineHeight: 1.85, maxWidth: "600px" }}>
              {question.paragraph}
            </p>
          </div>

          {/* Right — question, timer ring, options */}
          <div className="md:w-[45%]">
            <div className="flex items-start justify-between">
              <div>
                <TypeBadge type={question.type} />
                <h2 className="mt-2 font-bold text-slate-900" style={{ fontSize: "17px" }}>
                  {question.question}
                </h2>
              </div>
              {secsLeft !== null && !feedback ? (
                <IntuitionTimer seconds={secsLeft} total={totalSecs} />
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{sessionPoints}</div>
                  <div className="text-xs text-slate-500">pts total</div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {question.options.map((opt, i) => {
                const isElim = eliminated.has(i);
                const afterStatus = optionStatus(i);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`flex-1 ${isElim && !feedback ? "opacity-50" : ""}`}>
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
                        className={`flex-none h-8 w-8 rounded-full border text-xs font-bold transition-colors ${
                          isElim
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-500"
                        }`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            {!feedback ? (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={selected === null || submitting}
                  onClick={handleSubmit}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => doSkip(session, question)}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-slate-400 disabled:opacity-50"
                >
                  Skip
                </button>
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
  const timerColor = timer?.tone === "danger" ? "text-red-600" : timer?.tone === "warn" ? "text-amber-600" : "text-slate-400";
  const reasoningLen = reasoningText.trim().length;
  const canSubmit = selected !== null && reasoningLen >= 50;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {question.repeating && (
        <div className="mb-6 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
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
                <span className={`text-sm font-mono tabular-nums ${timerColor}`}>{timer.text}</span>
              )}
              {/* Mobile paragraph toggle */}
              <button
                type="button"
                onClick={() => setParagraphOpen((o) => !o)}
                className="md:hidden text-xs text-slate-400 hover:text-slate-600"
              >
                {paragraphOpen ? "▲ Hide" : "▼ Passage"}
              </button>
            </div>
          </div>
          <div className={`transition-opacity duration-300 ${loadingQuestion ? "opacity-0" : "opacity-100"}`}>
            {paragraphOpen && (
              <p className="font-reading text-slate-800" style={{ fontSize: "16px", lineHeight: 1.85, maxWidth: "600px" }}>
                {question.paragraph}
              </p>
            )}
          </div>
          <p className="mt-6 text-xs text-slate-400">Question {question.index} of {question.total}</p>
        </div>

        {/* Right — question + options + reasoning + submit */}
        <div className="md:w-[45%]">
          <TypeBadge type={question.type} />
          <h2 className="mt-3 font-bold text-slate-900" style={{ fontSize: "17px" }}>
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
            <div className="mt-5">
              <label className="block text-sm font-semibold text-slate-700">
                Why did you choose this option?
              </label>
              <p className="mt-0.5 text-xs text-slate-400">
                Reference the paragraph or the author's logic — 2 to 3 sentences
              </p>
              <textarea
                value={reasoningText}
                onChange={(e) => setReasoningText(e.target.value)}
                disabled={submitting}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="e.g. The paragraph says… which supports option B because…"
              />
              <div className={`mt-1 text-right text-xs ${reasoningLen >= 50 ? "text-green-600" : "text-slate-400"}`}>
                {reasoningLen} / 50 min
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {!feedback ? (
            <div className="mt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={!canSubmit || submitting}
                  onClick={handleSubmit}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Analyzing…
                    </span>
                  ) : (
                    selected === null ? "Select an option first" : "Evaluate My Reasoning"
                  )}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => doSkip(session, question)}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
              {submitting && (
                <p className="mt-2 text-center text-xs text-slate-400">Analyzing your reasoning…</p>
              )}
            </div>
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
    <div className="mt-6">
      {feedback.aiError && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {feedback.aiErrorMessage || "AI feedback unavailable — your attempt was saved."}
        </div>
      )}
      <FeedbackSections attempt={attempt} />
      <button
        type="button"
        onClick={isLast ? onEnd : onNext}
        className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {isLast ? "End Session" : "Next Question"}
      </button>
    </div>
  );
}

// ── Intuition mode lightweight feedback (no AI, instant) ─────────────────────
function IntuitionFeedback({ feedback, sessionPoints, isLast, onNext, onEnd }) {
  const trapLetter = feedback.trapOptionIndex != null ? LETTERS[feedback.trapOptionIndex] : null;
  const pts = feedback.intuitionPoints;
  const ptsText = pts > 0 ? `+${pts}` : String(pts);
  const ptsColor = pts > 0 ? "text-green-600" : "text-red-500";

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className={`text-2xl font-bold ${feedback.isCorrect ? "text-green-600" : "text-red-600"}`}>
          {feedback.isCorrect ? "Correct" : "Incorrect"}
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${ptsColor}`}>{ptsText} pts</div>
          <div className="text-xs text-slate-500">{sessionPoints} total</div>
        </div>
      </div>

      {trapLetter && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="font-semibold">The trap: {trapLetter}.</span>{" "}
          {trapLabel(feedback.trapType)} — {trapDescription(feedback.trapType)}
        </div>
      )}

      {feedback.isCorrect && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
          Correct answer: {LETTERS[feedback.correctOptionIndex]}
        </div>
      )}

      <button
        type="button"
        onClick={isLast ? onEnd : onNext}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {isLast ? "End Session" : "Next"}
      </button>
    </div>
  );
}
