import { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On boot, if a token exists, validate it by fetching the current user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!api.getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api.fetchMe();
        if (!cancelled) setUser(user);
      } catch {
        api.setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 on an authenticated request (api.js's request()) means the token
  // died mid-session - expired, or the account was deleted/reset elsewhere.
  // Deliberately doesn't touch varc_active_session: unlike logout(), this
  // isn't the user choosing to leave, so an in-progress Drills/Coach session
  // should still be there to resume once they log back in.
  useEffect(() => {
    function handleSessionExpired() {
      setUser(null);
    }
    window.addEventListener("graspr:session-expired", handleSessionExpired);
    return () => window.removeEventListener("graspr:session-expired", handleSessionExpired);
  }, []);

  async function login(identifier, password) {
    const result = await api.login({ identifier, password });
    if (result.requiresVerification) {
      return { requiresVerification: true, email: result.email };
    }
    api.setToken(result.token);
    setUser(result.user);
    return { requiresVerification: false };
  }

  async function register(username, email, password, name) {
    const result = await api.register({ username, email, password, name });
    if (result.requiresVerification) {
      return { requiresVerification: true, email: result.email };
    }
    api.setToken(result.token);
    setUser(result.user);
    return { requiresVerification: false };
  }

  // Called after OTP verification or password reset succeeds
  function loginWithToken(token, user) {
    api.setToken(token);
    setUser(user);
  }

  function logout() {
    api.setToken(null);
    localStorage.removeItem("varc_active_session");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("graspr:last-home-bento-autoscroll:")) {
        localStorage.removeItem(key);
      }
    }
    setUser(null);
  }

  function updateUser(updated) {
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithToken, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
