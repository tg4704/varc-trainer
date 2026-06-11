import { createContext, useContext, useRef, useCallback } from "react";

// Lets an in-progress page (Practice, CoachPractice) register a guard that the
// NavBar consults before navigating away. The guard returns false to intercept
// navigation (it then shows its own modal and navigates itself on confirm), or
// true/undefined to allow it.
const NavGuardContext = createContext(null);

export function NavGuardProvider({ children }) {
  const guardRef = useRef(null);

  const registerGuard = useCallback((fn) => { guardRef.current = fn; }, []);
  const clearGuard = useCallback(() => { guardRef.current = null; }, []);

  // Returns true if navigation may proceed immediately; false if intercepted.
  const attemptNav = useCallback((to) => {
    if (guardRef.current) {
      try { return guardRef.current(to) !== false; } catch { return true; }
    }
    return true;
  }, []);

  return (
    <NavGuardContext.Provider value={{ registerGuard, clearGuard, attemptNav }}>
      {children}
    </NavGuardContext.Provider>
  );
}

export function useNavGuard() {
  return (
    useContext(NavGuardContext) || {
      registerGuard() {},
      clearGuard() {},
      attemptNav: () => true,
    }
  );
}
