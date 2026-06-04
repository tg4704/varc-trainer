// Placeholder for Phase 2 — the structured AI feedback card is built in Phase 4.
// Phase 3 shows simple inline feedback; this component is a stub for now.
export default function FeedbackCard({ children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {children || (
        <p className="text-sm text-slate-500">
          Feedback will appear here after you submit.
        </p>
      )}
    </div>
  );
}
