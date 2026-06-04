export default function TopicBadge({ topic }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 capitalize">
      {topic}
    </span>
  );
}
