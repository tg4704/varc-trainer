// status: null (pre-submit) | "correct" | "wrong" | "correct-unselected"
export default function OptionCard({
  letter,
  text,
  selected,
  status = null,
  disabled = false,
  onClick,
}) {
  let stateClasses;
  if (status === "correct") {
    stateClasses = "border-green-500 bg-green-50";
  } else if (status === "wrong") {
    stateClasses = "border-red-500 bg-red-50";
  } else if (status === "correct-unselected") {
    stateClasses = "border-green-500 bg-white";
  } else if (selected) {
    stateClasses = "border-slate-900 bg-slate-900/5";
  } else {
    stateClasses = "border-slate-200 bg-white hover:border-slate-400";
  }

  let letterClasses;
  if (status === "correct" || status === "correct-unselected") {
    letterClasses = "bg-green-500 text-white";
  } else if (status === "wrong") {
    letterClasses = "bg-red-500 text-white";
  } else if (selected) {
    letterClasses = "bg-slate-900 text-white";
  } else {
    letterClasses = "bg-slate-100 text-slate-600";
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${stateClasses} ${
        disabled ? "cursor-default" : "cursor-pointer"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-bold ${letterClasses}`}
      >
        {letter}
      </span>
      <span className="text-sm leading-relaxed text-slate-800 pt-0.5">
        {text}
      </span>
    </button>
  );
}
