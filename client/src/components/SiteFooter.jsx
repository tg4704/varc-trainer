import { Link } from "react-router-dom";

function FooterColumn({ title, items }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="mono text-[10.5px] uppercase tracking-[0.12em] dim">{title}</div>
      {items.map((it) =>
        it.to ? (
          <Link key={it.label} to={it.to} className="fx-pill w-fit text-[13px] dim">
            {it.label}
          </Link>
        ) : it.href ? (
          <a key={it.label} href={it.href} className="fx-pill w-fit text-[13px] dim">
            {it.label}
          </a>
        ) : (
          <span key={it.label} className="flex items-center gap-1.5 text-[13px] dim">
            {it.label}
            {it.soon && <span className="mono rounded-full px-1.5 py-0.5 text-[8.5px] uppercase tracking-wide" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)" }}>Soon</span>}
          </span>
        )
      )}
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
      <div className="mx-auto grid max-w-[1000px] gap-8 px-7 py-10 sm:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <span className="display text-lg">graspr<span style={{ color: "var(--teal)" }}>.</span>in</span>
          <p className="mt-2.5 max-w-[240px] text-[13px] leading-relaxed dim">
            Train the reasoning, not the recall. Verbal practice with feedback on every answer.
          </p>
        </div>
        <FooterColumn
          title="Product"
          items={[
            { label: "Drills", to: "/setup" },
            { label: "Coach", to: "/coach" },
            { label: "Lounge", soon: true },
            { label: "Pricing", to: "/pricing" },
          ]}
        />
        <FooterColumn title="Company" items={[{ label: "Blog", to: "/blog" }, { label: "FAQ", to: "/faq" }, { label: "Contact", href: "mailto:privacy@graspr.in" }]} />
        <FooterColumn title="Legal" items={[{ label: "Privacy", to: "/privacy" }, { label: "Terms", to: "/terms" }, { label: "Refunds", to: "/refunds" }, { label: "Cookie Policy", to: "/cookies" }]} />
      </div>
      <div
        className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3 px-7 py-4"
        style={{ borderTop: "1px solid var(--glass-border-lo)" }}
      >
        <span className="mono text-[11px] dim">© {new Date().getFullYear()} graspr.in</span>
        <span className="text-xs dim">Made for serious readers</span>
      </div>
    </footer>
  );
}
