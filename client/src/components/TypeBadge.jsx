import { Badge } from "./ui/badge.jsx";

const TYPE_LABELS = {
  inference: "Inference",
  tone: "Tone / Attitude",
  title: "Title / Main Idea",
  detail: "Detail",
  application: "Application",
  main_idea: "Main Idea",
  function: "Function",
  concept_set: "Concept Set",
  vocab_in_context: "Vocabulary",
  weaken_strengthen: "Weaken / Strengthen",
};

export default function TypeBadge({ type }) {
  return <Badge variant={type}>{TYPE_LABELS[type] || type}</Badge>;
}
