// Phase 11: Web Speech API wrapper for voice reasoning input.
// Works in Chrome, Edge, and (partially) mobile Safari.
// Indian English hint (en-IN) to improve accent recognition.
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
  const isSupported = Boolean(SpeechRecognition);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    onInterimTranscript("");
  }, [onInterimTranscript]);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          onFinalTranscript(transcript.trim());
          onInterimTranscript("");
        } else {
          interim += transcript;
        }
      }
      if (interim) onInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      // "no-speech" is normal after silence — don't show it as an error
      if (event.error === "no-speech") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone access denied. Allow mic access and try again."
          : `Voice error: ${event.error}`
      );
    };

    recognition.onend = () => {
      // Fires when recognition stops — either because we called stop(), or
      // because the browser timed out (e.g. no-speech on some mobile browsers).
      setIsRecording(false);
      onInterimTranscript("");
    };

    try {
      recognition.start();
    } catch (e) {
      setError("Could not start microphone. Check your browser permissions.");
      return;
    }

    recognitionRef.current = recognition;
    setIsRecording(true);
    setError(null);
  }, [onFinalTranscript, onInterimTranscript]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, stop, start]);

  // Stop and clean up on unmount
  useEffect(() => () => stop(), [stop]);

  return { isRecording, isSupported, error, toggle, stop };
}
