const TYPE_STYLES = {
  inference: "bg-blue-100 text-blue-700",
  tone: "bg-purple-100 text-purple-700",
  title: "bg-teal-100 text-teal-700",
  detail: "bg-amber-100 text-amber-700",
  application: "bg-orange-100 text-orange-700",
};

const TYPE_LABELS = {
  inference: "Inference",
  tone: "Tone / Attitude",
  title: "Title / Main Idea",
  detail: "Detail",
  application: "Application",
};

export default function TypeBadge({ type }) {
  const style = TYPE_STYLES[type] || "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {TYPE_LABELS[type] || type}
    </span>
  );
}
