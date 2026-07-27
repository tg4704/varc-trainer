// The money log. Two tabs:
//   Payments      - every row in `payments`, across all users, incl. abandoned
//                   checkouts and ₹0 manual admin grants.
//   Subscriptions - recurring-mandate state, which the payments log can't show
//                   (a 'halted' mandate is a user quietly about to lose access).
//
// Deliberately shows 'created' (never-paid) rows alongside captured ones: a
// cluster of them on one account is the signature of someone probing the
// payment flow, and filtering it out would hide exactly that.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../../api.js";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Select } from "../../components/ui/select.jsx";

function fmtInr(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return `₹${v.toLocaleString("en-IN")}`;
}
function fmtNum(n) { return (Number(n) || 0).toLocaleString(); }
function fmtDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return "-";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TIER_LABELS = {
  free: "Skimmer",
  inference: "Inference",
  ninetyninth: "99th Percentile",
  topper: "Topper",
};
function tierLabel(key) { return TIER_LABELS[key] || key; }

function periodLabel(p, seasonYear) {
  if (p === "cat") return `Till CAT ${seasonYear || ""}`.trim();
  if (p === "manual") return "Manual grant";
  return "Monthly";
}

// Status pill. 'created' is amber rather than neutral on purpose - it means
// money was expected and never arrived, which is worth the eye-catch.
function StatusPill({ status }) {
  const styles = status === "captured"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  const label = status === "captured" ? "Captured" : "Abandoned";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>{label}</span>;
}

function SubStatusPill({ status }) {
  const tone =
    status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : status === "halted" ? "bg-destructive/10 text-destructive"
        : status === "cancelled" ? "bg-muted text-muted-foreground"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${tone}`}>{status}</span>;
}

function Stat({ label, value, hint }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 50;
const emptyFilters = { q: "", status: "", provider: "", tier: "" };

export default function AdminPayments() {
  const [tab, setTab] = useState("payments");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Debounced so typing in the search box doesn't fire a query per keystroke.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    admin.payments({ ...filters, q: debouncedQ, page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [debouncedQ, filters.status, filters.provider, filters.tier, page]);

  useEffect(() => {
    if (tab !== "subscriptions" || subs) return;
    admin.subscriptions().then((d) => setSubs(d.subscriptions)).catch((e) => setError(e.message));
  }, [tab, subs]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const t = data?.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments &amp; Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payment, manual grant, and recurring mandate. Abandoned checkouts are shown too.
        </p>
      </div>

      {/* Revenue headline. Unfiltered on purpose - these are business totals,
          not a summary of whatever the search box currently says. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (all time)" value={fmtInr(t?.revenueInr)} hint={`${fmtNum(t?.capturedCount)} payments`} />
        <Stat label="Revenue this month" value={fmtInr(t?.revenueThisMonthInr)} />
        <Stat label="Paying users" value={fmtNum(t?.payingUsers)} hint={`${fmtNum(t?.manualCount)} manual grants`} />
        <Stat label="Abandoned checkouts" value={fmtNum(t?.abandonedCount)} hint="Order created, never paid" />
      </div>

      {/* Who currently holds a live paid plan. */}
      {data?.byTier?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Active plans</div>
            <div className="flex flex-wrap gap-4">
              {data.byTier.map((row) => (
                <div key={row.tier} className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums text-foreground">{fmtNum(row.users)}</span>
                  <span className="text-sm text-muted-foreground">{tierLabel(row.tier)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[["payments", "Payments"], ["subscriptions", "Subscriptions"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {tab === "payments" && (
        <>
          <Card>
            <CardContent className="p-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Search</span>
                <input
                  type="text"
                  placeholder="User, order or payment ID"
                  value={filters.q}
                  onChange={(e) => updateFilter("q", e.target.value)}
                  className="border border-border rounded-md px-2 py-1.5 text-sm w-56 bg-background"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <Select
                  value={filters.status} onChange={(v) => updateFilter("status", v)} className="w-40"
                  options={[{ value: "", label: "All" }, { value: "captured", label: "Captured" }, { value: "created", label: "Abandoned" }]}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Source</span>
                <Select
                  value={filters.provider} onChange={(v) => updateFilter("provider", v)} className="w-40"
                  options={[{ value: "", label: "All" }, { value: "razorpay", label: "Razorpay" }, { value: "manual", label: "Manual grant" }, { value: "dev", label: "Dev" }]}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Plan</span>
                <Select
                  value={filters.tier} onChange={(v) => updateFilter("tier", v)} className="w-44"
                  options={[{ value: "", label: "All" }, ...Object.entries(TIER_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
                />
              </label>
              {JSON.stringify(filters) !== JSON.stringify(emptyFilters) && (
                <button
                  onClick={() => { setFilters(emptyFilters); setPage(1); }}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Clear filters
                </button>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">User</th>
                  <th className="text-left font-medium px-3 py-2">Plan</th>
                  <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Period</th>
                  <th className="text-right font-medium px-3 py-2">Amount</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Source</th>
                  <th className="text-left font-medium px-3 py-2 hidden xl:table-cell">Order / Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-6">Loading…</td></tr>
                )}
                {!loading && data?.payments.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-6">No payments match these filters</td></tr>
                )}
                {!loading && data?.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">
                      {fmtDateTime(p.capturedAt || p.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/admin/users/${p.userId}`} className="hover:underline" title={p.email || ""}>
                        {p.username || `#${p.userId}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{tierLabel(p.tier)}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                      {periodLabel(p.period, p.seasonYear)}
                      {p.period !== "cat" && p.months > 1 && ` · ${p.months} mo`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {p.provider === "manual"
                        ? <span className="text-muted-foreground">Comp</span>
                        : fmtInr(p.amountInr)}
                    </td>
                    <td className="px-3 py-2"><StatusPill status={p.status} /></td>
                    <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground capitalize">
                      {p.provider === "manual" && p.grantedByUsername
                        ? <span title={`Granted by ${p.grantedByUsername}`}>by {p.grantedByUsername}</span>
                        : p.provider}
                    </td>
                    <td className="px-3 py-2 hidden xl:table-cell font-mono text-xs text-muted-foreground">
                      <div>{p.orderId || "-"}</div>
                      {p.paymentId && <div className="opacity-70">{p.paymentId}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {data && data.total > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{fmtNum(data.total)} payments</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40"
                >
                  Prev
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "subscriptions" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Started</th>
                <th className="text-left font-medium px-3 py-2">User</th>
                <th className="text-left font-medium px-3 py-2">Plan</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-left font-medium px-3 py-2">Renews / ends</th>
                <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Subscription ID</th>
              </tr>
            </thead>
            <tbody>
              {!subs && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Loading…</td></tr>
              )}
              {subs?.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No subscriptions yet</td></tr>
              )}
              {subs?.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">{fmtDateTime(s.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/users/${s.userId}`} className="hover:underline" title={s.email || ""}>
                      {s.username || `#${s.userId}`}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{tierLabel(s.tier)}</td>
                  <td className="px-3 py-2">
                    <SubStatusPill status={s.status} />
                    {s.cancelAtCycleEnd && (
                      <span className="ml-2 text-xs text-muted-foreground">cancels at cycle end</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDateTime(s.currentEnd)}</td>
                  <td className="px-3 py-2 hidden lg:table-cell font-mono text-xs text-muted-foreground">
                    {s.subscriptionId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
