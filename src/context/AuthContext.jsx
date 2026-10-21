import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "vibeyetu_user";

function loadUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed && typeof parsed.phone === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const value = useMemo(
    () => ({
      user,
      login: (nextUser) => {
        setUser(nextUser);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
        } catch {
          // Storage unavailable: the user stays signed in for this visit.
        }
      },
      logout: () => {
        setUser(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing to clean up.
        }
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
