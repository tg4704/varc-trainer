import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";

// Phase 9: gates the /admin/* tree. Renders nothing while auth is hydrating,
// redirects to /login if not authed, and shows a 403 banner if authed-but-not-admin.
export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        Checking access…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.role !== "admin") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Admin access required</h1>
        <p className="mt-2 text-muted-foreground">
          Your account isn't an admin. If you think this is wrong, contact the team.
        </p>
      </div>
    );
  }
  return children;
}
