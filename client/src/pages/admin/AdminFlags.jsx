import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Card } from "../../components/ui/card.jsx";
import { Badge } from "../../components/ui/badge.jsx";

// Legacy codes (pre Phase-5 redesign) kept alongside the current flag-modal
// reasons so older flags in the queue still show a human label.
const REASON_LABELS = {
  wrong_answer: "Wrong answer key",
  ambiguous: "Ambiguous question",
  typo: "Typo or wording issue",
  poor_quality: "Poor quality / off-topic",
  confusing_wording: "Confusing wording",
  possible_error: "Possible error",
  ambiguous_options: "Ambiguous options",
  too_difficult: "Too difficult",
  revisit_later: "Revisit later",
};

function humanReason(raw) {
  if (!raw) return "—";
  const [code, ...rest] = raw.split(": ");
  const label = REASON_LABELS[code] || code;
  return rest.length ? `${label}: ${rest.join(": ")}` : label;
}

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

export default function AdminFlags() {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => admin.listFlags(status).then(setData).catch((e) => setError(e.message));
  // NB: wrap in a block so the effect returns undefined, not the Promise from
  // reload() — React would otherwise call the Promise as a cleanup function on
  // unmount ("n is not a function" crash).
  useEffect(() => { reload(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolve(id, resolution) {
    setBusy(true);
    try { await admin.resolveFlag(id, resolution); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quality flags</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions reported as bad. Admin-flagged today; user thumbs-down and AI self-audit will populate this in later phases.
          </p>
        </div>
        <div className="flex gap-1">
          {["open", "resolved"].map(s => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Question</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Source</th>
              <th className="text-left font-medium px-3 py-2">Reason</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">By</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">When</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.flags?.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-6">
                {status === "open" ? "No open flags. 🎉" : "No resolved flags yet."}
              </td></tr>
            )}
            {data?.flags?.map(f => (
              <tr key={f.id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs text-muted-foreground">{f.question_id}</div>
                  <div className="text-foreground max-w-md">{f.question_snippet}</div>
                </td>
                <td className="px-3 py-2 hidden md:table-cell"><Badge variant="secondary">{f.source}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground max-w-xs">{humanReason(f.reason)}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">{f.flagged_by_username || "—"}</td>
                <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{fmtDate(f.created_at)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <div className="flex gap-1 justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/admin/questions/${f.question_id}`}>Edit</Link>
                    </Button>
                    {status === "open" && (
                      <>
                        <Button size="sm" variant="destructive" disabled={busy}
                          title="Remove question from bank"
                          onClick={() => {
                            if (confirm(`Remove question "${f.question_id}" from the question bank?`))
                              resolve(f.id, "deleted");
                          }}>
                          Approve (remove)
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => resolve(f.id, "fixed")}>
                          Fixed
                        </Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => resolve(f.id, "invalid")}>
                          Dismiss
                        </Button>
                      </>
                    )}
                    {status === "resolved" && (
                      <Badge variant={f.resolution === "fixed" ? "success" : "secondary"}>
                        {f.resolution}
                      </Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
