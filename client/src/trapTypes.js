// Shared trap-type metadata used by Practice feedback, the Dashboard, and
// (later) the Phase 4 structured FeedbackCard.
export const TRAP_TYPES = {
  too_extreme: {
    label: "Too extreme",
    description: "Too extreme: used absolute language the passage doesn't support",
  },
  out_of_scope: {
    label: "Out of scope",
    description: "Out of scope: introduced an idea not discussed in the paragraph",
  },
  real_but_unstated: {
    label: "True but unstated",
    description: "True in general, but the paragraph never actually says this",
  },
  partially_correct: {
    label: "Partially correct",
    description: "Partially right, but misses a key qualification the author makes",
  },
};

export function trapLabel(type) {
  return TRAP_TYPES[type]?.label || type;
}

export function trapDescription(type) {
  return TRAP_TYPES[type]?.description || type;
}
