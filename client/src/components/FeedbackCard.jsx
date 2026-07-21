// Placeholder for Phase 2 - the structured AI feedback card is built in Phase 4.
// Phase 3 shows simple inline feedback; this component is a stub for now.
export default function FeedbackCard({ children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {children || (
        <p className="text-sm muted">
          Feedback will appear here after you submit.
        </p>
      )}
    </div>
  );
}
