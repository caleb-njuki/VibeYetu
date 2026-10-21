import { createContext, useContext, useMemo, useState } from "react";

// Demo admin session. Real staff accounts and roles come with the backend.
const AdminContext = createContext(null);
const STORAGE_KEY = "vibeyetu_admin";

function loadAdmin() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed && typeof parsed.email === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(loadAdmin);

  const value = useMemo(
    () => ({
      admin,
      login: (next) => {
        setAdmin(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage unavailable: the admin stays signed in for this visit.
        }
      },
      logout: () => {
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
