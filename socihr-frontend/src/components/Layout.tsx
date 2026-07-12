import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useDarkMode } from "../contexts/DarkModeContext";

const NAV = [
  { label: "Dashboard", path: "/dashboard", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg> },
  { label: "Staff",     path: "/staff",     icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { label: "Companies", path: "/company",   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { label: "Staff Ticks", path: "/staff-engagement", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { label: "Monitoring",path: "/monitoring",icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> },
  { label: "Reports",   path: "/reports",   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { label: "Audit Trail",path: "/audit",   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { label: "Snapshots", path: "/snapshots", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg> },
  { label: "Archived",  path: "/archived",  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("username") || "HR";
  const role     = localStorage.getItem("role")     || "Admin";
  const { isDark, toggleDarkMode } = useDarkMode();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface)" }}>
        <aside style={{
          width: 220, flexShrink: 0, position: "sticky", top: 0, height: "100vh",
          background: "var(--white)", borderRight: "1px solid var(--line)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "linear-gradient(135deg, #e0e7ff 0%, #fae8ff 50%, #ffedd5 100%)", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.25" strokeLinecap="round">
                    <circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>SociHR</p>
                  <p style={{ fontSize: 10, color: "var(--text-4)", letterSpacing: "0.04em", marginTop: 1 }}>Engagement Monitor</p>
                </div>
              </div>
              <button
                onClick={toggleDarkMode}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "var(--t)",
                }}
                aria-label="Toggle Dark Mode"
              >
                {isDark ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            <p className="section-label">Menu</p>
            {NAV.map((item) => (
              <NavLink key={item.path} to={item.path} style={{ textDecoration: "none" }}>
                {({ isActive }) => (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px", borderRadius: 7, marginBottom: 1,
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#111118" : "var(--text-2)",
                    background: isActive ? "linear-gradient(135deg, #e0e7ff 0%, #fae8ff 50%, #ffedd5 100%)" : "transparent",
                    border: isActive ? "1px solid rgba(15, 23, 42, 0.05)" : "1px solid transparent",
                    transition: "var(--t)", cursor: "pointer",
                  }}>
                    <span style={{ opacity: isActive ? 1 : 0.55, display: "flex" }}>{item.icon}</span>
                    {item.label}
                    {isActive && <span className="nav-dot" style={{ backgroundColor: "#111118" }} />}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          <div style={{ padding: "12px 8px", borderTop: "1px solid var(--line)" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "8px 10px", borderRadius: 7,
              background: "var(--surface)", border: "1px solid var(--line)",
              marginBottom: 6,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                background: "linear-gradient(135deg, #e0e7ff 0%, #fae8ff 50%, #ffedd5 100%)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#111118",
              }}>
                {username.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{username}</p>
                <p style={{ fontSize: 11, color: "var(--text-4)" }}>{role}</p>
              </div>
            </div>
            <button
              id="logout-btn"
              onClick={() => { localStorage.clear(); sessionStorage.clear(); navigate("/"); }}
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start", gap: 8, fontSize: 12.5 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Log Out
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, overflow: "auto", position: "relative", background: "var(--surface)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{ padding: "28px 32px", maxWidth: 1320, margin: "0 auto", position: "relative", zIndex: 1 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
  );
}
