// Row-level browser over api_calls, for diagnosing a specific AI failure
// (e.g. "AI feedback unavailable") - AdminCosts.jsx only shows aggregates;
// this shows every individual call with its persisted error message,
// filterable by date range, user, token count, surface, and status.
import { Fragment, useEffect, useState } from "react";
import { admin } from "../../api.js";
import { Card, CardContent } from "../../components/ui/card.jsx";

function fmtUsd(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtNum(n) { return (Number(n) || 0).toLocaleString(); }
function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "-";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const SURFACE_LABELS = {
  drills: "Drills",
  coach: "Coach",
  my_questions: "My Questions",
  other: "Other",
};

const ROUTE_SURFACE_PREFIXES = [
  ["/api/coach/", "coach"],
  ["/api/my-questions/", "my_questions"],
  ["/api/attempts/evaluate", "drills"],
  ["/api/sessions/batch-evaluate", "drills"],
];
function surfaceForRoute(route) {
  for (const [prefix, surface] of ROUTE_SURFACE_PREFIXES) {
    if (route === prefix || route.startsWith(prefix)) return surface;
  }
  return "other";
}

const PAGE_SIZE = 50;

const emptyFilters = { from: "", to: "", userId: "", minTokens: "", maxTokens: "", surface: "", status: "" };

export default function AdminLogs() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    admin.apiCalls({ ...filters, page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every AI call - tokens, cost, and the actual provider error when one failed.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter("from", e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => updateFilter("to", e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">User (ID or username)</span>
            <input
              type="text"
              placeholder="Any"
              value={filters.userId}
              onChange={(e) => updateFilter("userId", e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm w-36 bg-background"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Min tokens</span>
            <input
              type="number"
              placeholder="0"
              value={filters.minTokens}
              onChange={(e) => updateFilter("minTokens", e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm w-24 bg-background"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Max tokens</span>
            <input
              type="number"
              placeholder="Any"
              value={filters.maxTokens}
              onChange={(e) => updateFilter("maxTokens", e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm w-24 bg-background"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Surface</span>
            <select
              value={filters.surface}
              onChange={(e) => updateFilter("surface", e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background"
            >
              <option value="">All</option>
              <option value="drills">Drills</option>
              <option value="coach">Coach</option>
              <option value="my_questions">My Questions</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <select
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-background"
            >
              <option value="">All</option>
              <option value="ok">OK</option>
              <option value="error">Error</option>
            </select>
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

      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Time</th>
              <th className="text-left font-medium px-3 py-2">User</th>
              <th className="text-left font-medium px-3 py-2">Surface</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Route</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Model</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">In</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Out</th>
              <th className="text-right font-medium px-3 py-2">Tokens</th>
              <th className="text-right font-medium px-3 py-2">Cost</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-6">Loading…</td></tr>
            )}
            {!loading && data?.rows.length === 0 && (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-6">No calls match these filters</td></tr>
            )}
            {!loading && data?.rows.map((r) => {
              const isOpen = expandedId === r.id;
              const surface = surfaceForRoute(r.route);
              return (
                <Fragment key={r.id}>
                  <tr
                    className={`border-t border-border ${r.status === "error" ? "cursor-pointer hover:bg-destructive/5" : ""}`}
                    onClick={() => r.status === "error" && setExpandedId(isOpen ? null : r.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      {r.username
                        ? <span title={r.email || ""}>{r.username}</span>
                        : <span className="text-muted-foreground">{r.userId ? `#${r.userId}` : "(anonymous)"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-muted text-foreground">
                        {SURFACE_LABELS[surface]}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs hidden lg:table-cell text-muted-foreground">{r.route}</td>
                    <td className="px-3 py-2 font-mono text-xs hidden md:table-cell text-muted-foreground">{r.model}</td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{fmtNum(r.inputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{fmtNum(r.outputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtNum(r.totalTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(r.costUsd)}</td>
                    <td className="px-3 py-2">
                      {r.status === "error" ? (
                        <span className="inline-flex items-center gap-1 text-destructive font-medium">
                          Error {isOpen ? "▾" : "▸"}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-destructive/5">
                      <td colSpan={10} className="px-3 py-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Error message</div>
                        <pre className="text-xs whitespace-pre-wrap font-mono text-destructive">
                          {r.errorMessage || "(no error message captured - this call predates error-message logging)"}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{fmtNum(data.total)} calls total</span>
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
    </div>
  );
}
