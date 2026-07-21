// Catch-all 404 - without this, unknown URLs render an empty <main> under
// the nav (React Router matches nothing and shows nothing).
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import PageMeta from "../components/PageMeta.jsx";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[600px] flex-col items-center px-7 py-28 text-center">
      <PageMeta title="Page not found · Graspr" />
      <span
        className="mb-6 flex h-14 w-14 items-center justify-center rounded-[16px]"
        style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.28)" }}
      >
        <Icon name="target" size={22} style={{ color: "var(--red)" }} />
      </span>
      <h1 className="display text-[34px] leading-tight">
        Page <span className="italic" style={{ color: "var(--red)" }}>not found.</span>
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed muted">
        That link doesn't go anywhere - it may have moved, or the URL has a typo.
      </p>
      <Link to="/" className="btn btn-glass fx-ring mt-8">
        Back home
      </Link>
    </div>
  );
}
