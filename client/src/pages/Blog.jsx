import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";

export default function Blog() {
  return (
    <div className="mx-auto flex max-w-[600px] flex-col items-center px-7 py-28 text-center">
      <span
        className="mb-6 flex h-14 w-14 items-center justify-center rounded-[16px]"
        style={{ background: "rgba(139,157,255,0.12)", border: "1px solid rgba(139,157,255,0.3)" }}
      >
        <Icon name="spark" size={22} style={{ color: "var(--periwinkle)" }} />
      </span>
      <h1 className="display text-[34px] leading-tight">
        The blog is <span className="italic" style={{ color: "var(--periwinkle)" }}>coming soon.</span>
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed muted">
        Notes on CAT RC strategy, trap patterns, and how we're building Graspr. Nothing published yet.
      </p>
      <Link to="/" className="btn btn-glass fx-ring mt-8">
        Back home
      </Link>
    </div>
  );
}
