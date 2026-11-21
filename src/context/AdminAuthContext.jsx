import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SESSION_EXPIRED, getToken, setToken } from "../services/http.js";

// The signed-in staff member. The token is kept in http.js.
const AdminContext = createContext(null);
const STORAGE_KEY = "vibeyetu_admin";

function loadAdmin() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed && typeof parsed.email === "string" && getToken("admin") ? parsed : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(loadAdmin);

  useEffect(() => {
    const onExpired = (e) => {
      if (e.detail === "admin") {
        setAdmin(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing to clean up.
        }
      }
    };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, []);

  const value = useMemo(
    () => ({
      admin,
      // login({ email, name, ... }, token)
      login: (next, token) => {
        if (token) setToken("admin", token);
        setAdmin(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage unavailable: the admin stays signed in for this visit.
        }
      },
      logout: () => {
        setToken("admin", "");
        setAdmin(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing to clean up.
        }
      },
    }),
    [admin]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminAuthProvider");
  return ctx;
}
