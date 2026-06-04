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

  async function login(identifier, password) {
    const { token, user } = await api.login({ identifier, password });
    api.setToken(token);
    setUser(user);
    return user;
  }

  async function register(username, email, password) {
    const { token, user } = await api.register({ username, email, password });
    api.setToken(token);
    setUser(user);
    return user;
  }

  function logout() {
    api.setToken(null);
    localStorage.removeItem("varc_active_session");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
