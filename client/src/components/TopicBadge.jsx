import { Badge } from "./ui/badge.jsx";

export default function TopicBadge({ topic }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {topic}
    </Badge>
  );
}
