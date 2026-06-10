import { useEffect, useState } from "react";
import { admin } from "../../api.js";
import { Card, CardContent } from "../../components/ui/card.jsx";

function Stat({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function fmtUsd(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    admin.overview().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Top-level numbers for the whole app.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Users"          value={data.users} sub={`${data.admins} admin`} />
        <Stat label="Active users"   value={data.activeUsers} sub={`last ${data.activeWindowDays} days`} />
        <Stat label="Sessions"       value={data.sessions} />
        <Stat label="Attempts"       value={data.attempts} />
        <Stat label="Questions"      value={data.questionsActive} sub={`${data.questionsInactive} inactive`} />
        <Stat label="Open flags"     value={data.flagsOpen} />
        <Stat label="AI calls"       value={data.apiCallCount} />
        <Stat label="AI spend (all)" value={fmtUsd(data.totalCostUsd)} />
      </div>
    </div>
  );
}
