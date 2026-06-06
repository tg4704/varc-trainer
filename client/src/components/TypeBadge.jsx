import { Badge } from "./ui/badge.jsx";

const TYPE_LABELS = {
  inference: "Inference",
  tone: "Tone / Attitude",
  title: "Title / Main Idea",
  detail: "Detail",
  application: "Application",
};

export default function TypeBadge({ type }) {
  return <Badge variant={type}>{TYPE_LABELS[type] || type}</Badge>;
}
