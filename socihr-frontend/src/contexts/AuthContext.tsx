import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface AuthUser {
  username: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isSuperAdmin: () => boolean;
  isDeptAdmin: () => boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isSuperAdmin: () => false,
  isDeptAdmin: () => false,
  refreshUser: () => {},
});

function readUserFromStorage(): AuthUser | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return {
    username: localStorage.getItem("username") ?? "",
    role: localStorage.getItem("role") ?? "",
    departmentId: localStorage.getItem("departmentId"),
    departmentName: localStorage.getItem("departmentName"),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUserFromStorage);

  const refreshUser = () => {
    setUser(readUserFromStorage());
  };

  useEffect(() => {
    refreshUser();
    const onStorage = () => refreshUser();
    window.addEventListener("storage", onStorage);
    window.addEventListener("trigger-login-transition", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("trigger-login-transition", onStorage);
    };
  }, []);

  const isSuperAdmin = () => {
    const r = (localStorage.getItem("role") || user?.role || "").trim().toLowerCase();
    return r === "superadmin" || r === "admin";
  };

  const isDeptAdmin = () => {
    const r = (localStorage.getItem("role") || user?.role || "").trim().toLowerCase();
    return r === "deptadmin";
  };

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, isDeptAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
