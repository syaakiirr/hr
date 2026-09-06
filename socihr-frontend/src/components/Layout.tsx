import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

// All nav items — each can declare which roles can see it
// If `roles` is undefined, all roles can see it
const NAV: { label: string; path: string; icon: ReactNode; roles?: string[] }[] = [
  {
    label: "Dashboard", path: "/dashboard",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    label: "Leaderboard", path: "/leaderboard",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34"/><path d="M18 14.66V17c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M6 4h12v7a6 6 0 0 1-12 0V4z"/></svg>,
  },
  {
    label: "Staff", path: "/staff",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: "Departments", path: "/departments", roles: ["SuperAdmin"],
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M4 10h16"/><path d="M9 3v4"/><path d="M15 3v4"/></svg>,
  },
  {
    label: "Companies", path: "/company", roles: ["SuperAdmin"],
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  },
  {
    label: "Staff Ticks", path: "/staff-engagement",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  },
  {
    label: "Monitoring", path: "/monitoring",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  },
  {
    label: "Reports", path: "/reports",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    label: "Audit Trail", path: "/audit", roles: ["SuperAdmin"],
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    label: "Snapshots", path: "/snapshots", roles: ["SuperAdmin"],
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
  },
  {
    label: "Archived", path: "/archived", roles: ["SuperAdmin"],
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  },
  {
    label: "User Management", path: "/users", roles: ["SuperAdmin"],
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><path d="M16 11l2 2 4-4"/></svg>,
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin, isDeptAdmin, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const username = user?.username || localStorage.getItem("username") || "HR";
  const role     = user?.role || localStorage.getItem("role") || "";
  const deptName = user?.departmentName || localStorage.getItem("departmentName") || "";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Filter nav by role using reliable helper functions
  const visibleNav = NAV.filter(item => {
    if (!item.roles) return true; // visible to all roles
    if (item.roles.includes("SuperAdmin") && isSuperAdmin()) return true;
    if (item.roles.includes("DeptAdmin") && isDeptAdmin()) return true;
    return item.roles.includes(role);
  });

  // Role badge display
  const roleBadge = isSuperAdmin() ? "Super Admin" : isDeptAdmin() ? "Dept Admin" : role;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface)" }}>
        {isMobile && mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(17,17,24,0.5)" }}
          />
        )}
        <aside style={{
          width: 230, flexShrink: 0, position: isMobile ? "fixed" : "sticky",
          top: 0, height: "100vh", zIndex: isMobile ? 50 : "auto",
          background: "var(--white)", borderRight: "1px solid var(--line)",
          display: "flex", flexDirection: "column",
          transform: isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : "none",
          transition: isMobile ? "transform 0.2s ease" : "none",
        }}>
          {/* Logo & Header */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src="/logo.png"
                alt="SociHR Logo"
                style={{
                  width: 30,
                  height: 30,
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
              <div>
                <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>SociHR</p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-4)", letterSpacing: "0.02em", marginTop: 0.5 }}>Engagement Monitor</p>
              </div>
            </div>
          </div>

          {/* DeptAdmin dept banner */}
          {!isSuperAdmin() && deptName && (
            <div style={{
              margin: "8px 10px 0",
              padding: "6px 10px",
              borderRadius: 6,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              fontSize: "0.74rem",
              color: "var(--text-2)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>{deptName}</span>
            </div>
          )}

          {/* Navigation Links */}
          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            <div style={{ padding: "0 8px 6px", fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-4)" }}>
              Menu
            </div>
            {visibleNav.map((item) => (
              <NavLink key={item.path} to={item.path} style={{ textDecoration: "none" }}>
                {({ isActive }) => (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "7px 10px", borderRadius: 6, marginBottom: 2,
                    fontSize: "0.83rem", fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--accent)" : "var(--text-2)",
                    background: isActive ? "var(--accent-soft)" : "transparent",
                    transition: "all 0.12s ease", cursor: "pointer",
                  }}>
                    <span style={{ opacity: isActive ? 1 : 0.7, display: "flex", color: isActive ? "var(--accent)" : "currentColor" }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom Controls */}
          <div style={{ padding: "10px 8px", borderTop: "1px solid var(--line)" }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn btn-ghost"
              style={{
                width: "100%",
                justifyContent: "space-between",
                padding: "6px 10px",
                marginBottom: 6,
                fontSize: "0.78rem",
                borderRadius: 6,
                color: "var(--text-2)",
                background: "var(--surface)",
                border: "1px solid var(--line)",
              }}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {theme === "dark" ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
              </div>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                {theme.toUpperCase()}
              </span>
            </button>

            {/* Profile Bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 6,
              background: "var(--surface)", border: "1px solid var(--line)",
              marginBottom: 4,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)",
              }}>
                {username.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{username}</p>
                <p style={{ fontSize: "0.7rem", color: "var(--text-4)" }}>{roleBadge}</p>
              </div>
            </div>

            <button
              id="logout-btn"
              onClick={() => { localStorage.clear(); sessionStorage.clear(); navigate("/"); }}
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start", gap: 7, fontSize: "0.78rem", padding: "6px 8px", color: "var(--text-3)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, overflow: "auto", position: "relative", background: "var(--surface)" }}>
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar menu"
              style={{
                position: "fixed", top: 12, left: 12, zIndex: 30,
                width: 36, height: 36, borderRadius: 8,
                background: "var(--white)", border: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", boxShadow: "var(--shadow-sm)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{ padding: isMobile ? "60px 16px 28px" : "28px 32px", maxWidth: 1320, margin: "0 auto", position: "relative", zIndex: 1 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
  );
}
