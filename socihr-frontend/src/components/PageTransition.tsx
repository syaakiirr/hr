import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  return (
    <div className={isDashboard ? "pt-enter" : "pt-enter-h"} style={{ width: "100%", height: "100%" }}>
      {children}
    </div>
  );
}
