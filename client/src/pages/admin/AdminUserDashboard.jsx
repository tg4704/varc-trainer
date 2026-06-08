import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { admin } from "../../api.js";
import Dashboard from "../Dashboard.jsx";
import { Eye } from "lucide-react";

// Read-only impersonation: shows the user's dashboard exactly as they see it,
// with a clear "Viewing as" banner. No write actions are possible — fetcher
// only hits the admin endpoint.
export default function AdminUserDashboard() {
  const { id } = useParams();
  const [username, setUsername] = useState(null);

  useEffect(() => {
    admin.getUser(id).then(({ user }) => setUsername(user.username));
  }, [id]);

  const fetcher = useCallback(() => admin.getUserDashboard(id), [id]);

  const banner = (
    <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-warning">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-semibold">
          Viewing as {username || `user #${id}`} — read-only
        </span>
      </div>
      <Link to={`/admin/users/${id}`} className="text-xs text-warning underline">
        Back to user
      </Link>
    </div>
  );

  // key={id} forces a fresh mount when switching between users so we never see
  // stale data from the previous user flash while the new fetch is in flight.
  return <Dashboard key={id} fetcher={fetcher} headerSlot={banner} />;
}
