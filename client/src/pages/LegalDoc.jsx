// Shared layout for /privacy and /terms — plain, readable long-form text,
// consistent with the rest of the dark editorial theme but deliberately
// undecorated (this is a document, not a marketing page).
export function LegalDoc({ title, updated, children }) {
  return (
    <div className="mx-auto max-w-[720px] px-7 py-16">
      <h1 className="display text-[34px] leading-tight">{title}</h1>
      <p className="mt-2 text-[13px] dim">Last updated {updated}</p>
      <div className="mt-10 flex flex-col gap-7 text-[14.5px] leading-relaxed text-foreground/90">
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[17px] font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-2.5 muted">{children}</div>
    </section>
  );
}
