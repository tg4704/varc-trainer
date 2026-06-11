// Phase 14 — VARC Coach: 3-panel practice screen
// Left: article (with source-line highlight after debrief)
// Right top: question + options
// Right bottom: VARC Coach chat (appears after option selected)
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { saveActiveCoachSession, clearActiveCoachSession } from "../coachSession.js";
import { useNavGuard } from "../navGuard.jsx";
import OptionCard from "../components/OptionCard.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import VoiceMicButton from "../components/VoiceMicButton.jsx";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/utils.js";
import { coach } from "../api.js";
import { useVoiceInput } from "../hooks/useVoiceInput.js";

const LETTERS = ["A", "B", "C", "D"];
const MAX_EXCHANGE = 4;
const MAX_MSG_LENGTH = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ArticleWithHighlight({ text, sourceLines }) {
  // Guard: render plain text if no highlight needed, or if text is missing.
  if (!sourceLines || !text) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: "15px", lineHeight: 1.9 }}>
      {text || ""}
    </p>
  );
  const idx = text.indexOf(sourceLines.slice(0, 40));
  if (idx === -1) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: "15px", lineHeight: 1.9 }}>
      {text}
    </p>
  );
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + sourceLines.length);
  const after = text.slice(idx + sourceLines.length);
  return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: "15px", lineHeight: 1.9 }}>
      {before}
      <mark className="bg-amber-200 dark:bg-amber-900/60 rounded px-0.5">{match}</mark>
      {after}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CoachPractice() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = params.get("sessionId");

  const [coachSession, setCoachSession] = useState(location.state?.coachSession || null);
  const [loading, setLoading] = useState(!location.state?.coachSession);
  const [error, setError] = useState(null);

  // Per-question state
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);

  // Debrief state
  const [debriefPhase, setDebriefPhase] = useState("idle"); // idle | active | complete
  const [conversation, setConversation] = useState([]); // [{ role, text }]
  const [exchangeCount, setExchangeCount] = useState(0);
  const [verdict, setVerdict] = useState(null); // { correctIndex, trapIndex, trapType, sourceLines, isCorrect }

  // Chat input
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const chatEndRef = useRef(null);

  // Voice input for Socratic chat
  const [voiceInterim, setVoiceInterim] = useState("");
  const { isRecording: voiceRecording, isSupported: voiceSupported, toggle: voiceToggle, stop: voiceStop } =
    useVoiceInput({
      onFinalTranscript: (text) => {
        setInputText((prev) => (prev ? prev + " " + text : text));
      },
      onInterimTranscript: (text) => setVoiceInterim(text),
    });

  // Persist active coach session to localStorage so user can resume if they navigate away
  useEffect(() => {
    if (sessionId) saveActiveCoachSession(sessionId);
    return () => { /* don't clear on unmount — clear only on explicit completion */ };
  }, [sessionId]);

  // Load session if navigated directly (not from landing)
  useEffect(() => {
    if (coachSession || !sessionId) return;
    (async () => {
      try {
        const { coachSession: s, attempts } = await coach.getSession(sessionId);
        setCoachSession(s);
        // Restore in-progress debrief state from DB if any question has a partial conversation
        if (attempts && attempts.length > 0) {
          const inProgress = attempts.find((a) => !a.is_complete && a.conversation && a.conversation.length > 0);
          if (inProgress) {
            setQIdx(inProgress.question_index);
            setSelected(inProgress.selected_option_index);
            setConversation(inProgress.conversation);
            setExchangeCount(inProgress.exchange_count);
            setDebriefPhase("active");
          } else {
            // Jump to first unanswered question
            const firstUnanswered = [0,1,2,3].find(
              (i) => !attempts.find((a) => a.question_index === i && a.is_complete)
            );
            if (firstUnanswered != null) setQIdx(firstUnanswered);
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, coachSession]);

  // Leave-confirmation state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const pendingNavRef = useRef(null);

  // Warn on browser tab close/reload when a debrief is active
  useEffect(() => {
    const handler = (e) => {
      if (debriefPhase === "active") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [debriefPhase]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const question = coachSession?.questions?.[qIdx];

  // ── Start debrief — user types reasoning first, no AI call yet ───────────────
  const startDebrief = useCallback(() => {
    if (selected === null || !coachSession) return;
    setDebriefPhase("active");
    // Show a static opening prompt; the AI is called on the student's first message.
    setConversation([{
      role: "tutor",
      text: "Explain why you chose this option. What in the article led you to this choice?",
    }]);
    setExchangeCount(0);
  }, [selected, coachSession]);

  // ── Send a student message ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (giveUp = false) => {
    if (!coachSession || sending) return;
    if (!giveUp && (!inputText.trim() || inputText.trim().length > MAX_MSG_LENGTH)) return;
    setSending(true);
    const msgToSend = giveUp ? "" : inputText.trim();
    const newConv = giveUp
      ? [...conversation, { role: "student", text: "I give up — show me the answer." }]
      : [...conversation, { role: "student", text: msgToSend }];
    setConversation(newConv);
    setInputText("");
    try {
      const data = await coach.exchange({
        coachSessionId: coachSession.id,
        questionIndex: qIdx,
        selectedOptionIndex: selected,
        message: msgToSend,
        giveUp,
      });
      setConversation([...newConv, { role: "tutor", text: data.tutorMessage }]);
      setExchangeCount(data.exchangeNumber);
      if (data.isComplete) {
        setVerdict(data);
        setDebriefPhase("complete");
      }
    } catch (e) {
      setError(e.message);
      // Remove the optimistically-added student message
      setConversation(conversation);
      setInputText(msgToSend);
    } finally {
      setSending(false);
    }
  }, [coachSession, sending, inputText, conversation, qIdx, selected]);

  // ── Move to next question ─────────────────────────────────────────────────────
  function nextQuestion() {
    voiceStop();
    setVoiceInterim("");
    if (qIdx >= 3) {
      clearActiveCoachSession();
      navigate(`/coach/summary?sessionId=${coachSession.id}`);
      return;
    }
    setQIdx((i) => i + 1);
    setSelected(null);
    setDebriefPhase("idle");
    setConversation([]);
    setExchangeCount(0);
    setVerdict(null);
    setInputText("");
    setError(null);
  }

  // ── Nav guard: intercept NavBar clicks while a coach session is in progress ──
  const { registerGuard, clearGuard } = useNavGuard();
  const inProgressRef = useRef(false);
  useEffect(() => { inProgressRef.current = !!coachSession; }, [coachSession]);
  useEffect(() => {
    registerGuard((to) => {
      if (inProgressRef.current) {
        pendingNavRef.current = to;
        setShowLeaveModal(true);
        return false; // intercept — modal will navigate on confirm
      }
      return true;
    });
    return () => clearGuard();
  }, [registerGuard, clearGuard]);

  // Save & leave: the session already persists in the DB; keep the active
  // pointer so it can be resumed later from VARC Coach → History.
  function saveAndLeave() {
    setShowLeaveModal(false);
    const to = pendingNavRef.current || "/coach";
    pendingNavRef.current = null;
    navigate(to);
  }

  // Discard: delete the coach session entirely so it never happened.
  async function discardAndLeave() {
    setShowLeaveModal(false);
    const to = pendingNavRef.current || "/coach";
    pendingNavRef.current = null;
    inProgressRef.current = false;
    const id = coachSession?.id || sessionId;
    try { if (id) await coach.deleteSession(id); } catch {}
    clearActiveCoachSession();
    navigate(to);
  }

  // ── Render guards ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
      Loading session…
    </div>
  );
  if (error && !coachSession) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-destructive">{error}</p>
      <Button className="mt-4" onClick={() => navigate("/coach")}>Back to Coach</Button>
    </div>
  );
  if (!coachSession || !question) return null;

  const isLastQuestion = qIdx === 3;
  const studentMessagesSent = conversation.filter((m) => m.role === "student").length;
  const canGiveUp = debriefPhase === "active" && studentMessagesSent > 0 && exchangeCount < MAX_EXCHANGE && !sending;

  // ── Layout ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Progress bar */}
      <div className="mb-4 flex items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < qIdx ? "bg-primary" : i === qIdx ? "bg-primary/40" : "bg-border"
            )}
          />
        ))}
        <span className="text-xs text-muted-foreground flex-none">
          Q{qIdx + 1} / 4
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Article ────────────────────────────────────────────── */}
        <div className="lg:w-[45%]">
          <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-card p-5">
            {coachSession.articleTitle && (
              <h2 className="mb-3 font-bold text-foreground text-base leading-snug">
                {coachSession.articleTitle}
              </h2>
            )}
            {coachSession.articleSource && (
              <p className="mb-4 text-xs text-muted-foreground">{coachSession.articleSource}</p>
            )}
            <ArticleWithHighlight
              text={coachSession.articleText}
              sourceLines={verdict?.sourceLines || null}
            />
          </div>
        </div>

        {/* ── Right: Question + Options + Chat ─────────────────────────── */}
        <div className="lg:w-[55%] flex flex-col gap-5">
          {/* Question card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              {/* Type badge hidden until debrief complete — reveals with answer */}
              {verdict
                ? <TypeBadge type={question.type} />
                : <span className="text-xs text-transparent select-none">·</span>
              }
              {debriefPhase === "active" && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Exchange {exchangeCount} / {MAX_EXCHANGE}
                </span>
              )}
            </div>
            <h2 className="font-bold text-foreground mb-4" style={{ fontSize: "16px" }}>
              {question.question}
            </h2>
            <div className="space-y-2">
              {question.options.map((opt, i) => {
                let status = null;
                if (verdict) {
                  if (i === verdict.correctIndex) status = selected === i ? "correct" : "correct-unselected";
                  else if (i === selected) status = "wrong";
                }
                return (
                  <OptionCard
                    key={i}
                    letter={LETTERS[i]}
                    text={opt.text}
                    selected={selected === i}
                    status={status}
                    disabled={debriefPhase !== "idle" || selected !== null}
                    onClick={() => { if (debriefPhase === "idle") setSelected(i); }}
                  />
                );
              })}
            </div>

            {selected !== null && debriefPhase === "idle" && (
              <>
                {error && (
                  <p className="mt-3 text-sm text-destructive">{error}</p>
                )}
                <Button
                  className="mt-3 w-full"
                  size="lg"
                  onClick={startDebrief}
                >
                  Explain My Reasoning →
                </Button>
              </>
            )}
          </div>

          {/* Verdict card — shown after debrief completes */}
          {verdict && debriefPhase === "complete" && (
            <div className={cn(
              "rounded-xl border p-4",
              verdict.isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("font-bold text-sm", verdict.isCorrect ? "text-success" : "text-destructive")}>
                  {verdict.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                </span>
                {verdict.trapType && (
                  <span className="text-xs text-muted-foreground">
                    Trap: {verdict.trapType.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              {verdict.sourceLines && (
                <p className="text-xs text-muted-foreground italic">
                  ↑ Answer region highlighted in the article
                </p>
              )}
              <Button className="mt-3 w-full" size="lg" onClick={nextQuestion}>
                {isLastQuestion ? "View Session Summary →" : "Next Question →"}
              </Button>
            </div>
          )}

          {/* Socratic chat */}
          {debriefPhase !== "idle" && (
            <div className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  VARC Coach
                </span>
                {canGiveUp && (
                  <button
                    type="button"
                    onClick={() => sendMessage(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    I give up — show me the answer
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-80">
                {conversation.map((msg, i) => (
                  <div
                    key={i}
                    className={cn("flex", msg.role === "student" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        msg.role === "tutor"
                          ? "bg-muted text-foreground rounded-tl-sm"
                          : "bg-primary text-primary-foreground rounded-tr-sm"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {sending && conversation.length > 0 && conversation[conversation.length - 1].role === "student" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              {debriefPhase === "active" && (
                <div className="border-t border-border p-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        disabled={sending}
                        rows={2}
                        maxLength={MAX_MSG_LENGTH}
                        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                        placeholder="Explain your reasoning… (Enter to send, Shift+Enter for newline)"
                      />
                      {/* Live voice preview overlay */}
                      {voiceRecording && voiceInterim && (
                        <div className="absolute bottom-1 left-1 right-1 rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground italic pointer-events-none border border-primary/20">
                          {voiceInterim}…
                        </div>
                      )}
                      <div className={cn(
                        "mt-0.5 text-right text-xs",
                        inputText.length > MAX_MSG_LENGTH * 0.9 ? "text-amber-500" : "text-muted-foreground"
                      )}>
                        {inputText.length} / {MAX_MSG_LENGTH}
                      </div>
                    </div>
                    {voiceSupported && (
                      <VoiceMicButton
                        isRecording={voiceRecording}
                        onClick={voiceToggle}
                        className="mb-5"
                      />
                    )}
                    <Button
                      size="sm"
                      disabled={!inputText.trim() || inputText.trim().length > MAX_MSG_LENGTH || sending}
                      onClick={() => {
                        if (voiceRecording) voiceStop();
                        sendMessage();
                      }}
                      className="mb-5"
                    >
                      Send
                    </Button>
                  </div>
                  {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Leave this Coach session?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>Save</strong> keeps it so you can resume any time from VARC Coach → History.
              <strong> Discard</strong> deletes it permanently.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button className="w-full" onClick={saveAndLeave}>
                Save &amp; leave
              </Button>
              <Button variant="destructive" className="w-full" onClick={discardAndLeave}>
                Discard session
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setShowLeaveModal(false); pendingNavRef.current = null; }}
              >
                Stay
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
