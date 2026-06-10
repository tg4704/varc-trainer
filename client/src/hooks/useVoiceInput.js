// Phase 11: Web Speech API wrapper for voice reasoning input.
// Works in Chrome/Edge. Uses en-US with continuous:false (short per-phrase
// requests) — far more reliable than a long-lived stream, avoids "network" errors.
import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// onFinalTranscript(text)   — called when the recognizer commits a phrase
// onInterimTranscript(text) — called with live in-progress text (empty string to clear)
export function useVoiceInput({ onFinalTranscript, onInterimTranscript }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const stoppedIntentionally = useRef(false);
  const retryCount = useRef(0);
  // Stable refs so event handlers always see the latest callbacks
  const onFinalRef = useRef(onFinalTranscript);
  const onInterimRef = useRef(onInterimTranscript);
  useEffect(() => { onFinalRef.current = onFinalTranscript; }, [onFinalTranscript]);
  useEffect(() => { onInterimRef.current = onInterimTranscript; }, [onInterimTranscript]);

  const isSupported = Boolean(SpeechRecognition);

  // Spawn one recognition instance and wire up its handlers.
  // Uses continuous:false so each phrase is a short, independent request to
  // Google — much less prone to "network" errors than a persistent stream.
  const spawnInstance = useCallback(() => {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          retryCount.current = 0; // successful phrase resets consecutive-error counter
          onFinalRef.current(t.trim());
          onInterimRef.current("");
        } else {
          interim += t;
        }
      }
      if (interim) onInterimRef.current(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      if (event.error === "network") {
        // Up to 5 consecutive network blips before surfacing the error.
        if (retryCount.current < 5) {
          retryCount.current += 1;
          // Restart the recognizer immediately instead of waiting for onend.
          try {
            const next = spawnInstance();
            next.start();
            recognitionRef.current = next;
          } catch {
            setIsRecording(false);
          }
          return;
        }
        setError(
          "Voice input couldn't reach Google's speech servers. " +
          "Check your internet connection and try again."
        );
        stoppedIntentionally.current = true;
        return;
      }
      setError(
        event.error === "not-allowed"
          ? "Microphone access denied. Allow mic access in your browser and try again."
          : `Voice error: ${event.error}`
      );
      stoppedIntentionally.current = true;
    };

    recognition.onend = () => {
      if (stoppedIntentionally.current) {
        setIsRecording(false);
        onInterimRef.current("");
        return;
      }
      // Phrase finished cleanly — reset retry counter, restart to keep listening.
      retryCount.current = 0;
      try {
        const next = spawnInstance();
        next.start();
        recognitionRef.current = next;
      } catch {
        setIsRecording(false);
      }
    };

    return recognition;
  }, []); // no deps — uses stable refs for callbacks

  const stop = useCallback(() => {
    stoppedIntentionally.current = true;
    retryCount.current = 0;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    onInterimRef.current("");
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    stoppedIntentionally.current = false;
    retryCount.current = 0;
    setError(null);

    try {
      const recognition = spawnInstance();
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setError("Could not start microphone. Check your browser permissions.");
      return;
    }

    setIsRecording(true);
  }, [spawnInstance]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, stop, start]);

  // Stop and clean up on unmount
  useEffect(() => () => stop(), [stop]);

  return { isRecording, isSupported, error, toggle, stop };
}
