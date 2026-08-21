import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setUnauthorizedHandler } from "../api/client.js";
import { useToast } from "./ToastContext.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const toast = useToast();

  // Synchronously initialize user from localStorage to prevent layout shift or redirect to login on refresh
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
    return null;
  });

  // Start loading as true only if we have a token but need to verify it against the backend
  const [loading, setLoading] = useState(() => {
    return !!localStorage.getItem("token");
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    // Silent background token validation on application mount
    api
      .get("/auth/me")
      .then((data) => {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      })
      .catch(() => {
        // Token is expired or invalid, clear localStorage and local state
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function login(email, password) {
    const data = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }

  async function register(name, email, password) {
    const data = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  // When any request comes back 401 mid-session, the stored token is no longer
  // good. Clear it and say so once, rather than letting every subsequent action
  // fail with an opaque error until the user thinks to reload.
  const handleUnauthorized = useCallback(() => {
    const wasSignedIn = !!localStorage.getItem("token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    if (wasSignedIn) {
      toast.error("Your session has expired. Please sign in again.");
    }
  }, [toast]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
