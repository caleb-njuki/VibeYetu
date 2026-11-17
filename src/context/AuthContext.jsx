import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SESSION_EXPIRED, getToken, setToken } from "../services/http.js";

// The signed-in buyer. The proof of sign-in is a token the server gave us; it is kept in http.js.
const AuthContext = createContext(null);
const STORAGE_KEY = "vibeyetu_user";

function loadUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    // Without a token the saved person is not really signed in.
    return parsed && typeof parsed.email === "string" && getToken("buyer") ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  useEffect(() => {
    const onExpired = (e) => {
      if (e.detail === "buyer") {
        setUser(null);
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
      user,
      // login({ id, phone }, token)
      login: (nextUser, token) => {
        if (token) setToken("buyer", token);
        setUser(nextUser);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
        } catch {
          // Storage unavailable: the user stays signed in for this visit.
        }
      },
      logout: () => {
        setToken("buyer", "");
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
