import { Mic, MicOff } from "lucide-react";
import { cn } from "../lib/utils.js";

// Phase 11: mic toggle button that sits beside the reasoning textarea.
// Pulses red while recording, shows MicOff icon to indicate "click to stop".
export default function VoiceMicButton({ isRecording, onClick, disabled, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isRecording ? "Stop voice recording" : "Start voice input"}
      title={isRecording ? "Stop recording" : "Speak your reasoning"}
      className={cn(
        "flex-none h-9 w-9 flex items-center justify-center rounded-md border transition-colors",
        isRecording
          ? "border-destructive bg-destructive/10 text-destructive animate-pulse"
          : "border-input text-muted-foreground hover:border-foreground/40 hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
        className
      )}
    >
      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
