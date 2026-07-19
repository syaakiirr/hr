import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { login } from "../services/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [statusIndex, setStatusIndex] = useState(0);
  const statuses = [
    "Scanning Instagram engagements...",
    "Syncing TikTok monitoring logs...",
    "Parsing Facebook comments...",
    "Generating real-time analytics reports...",
    "Syncing completed engagement tasks..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [statuses.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); 
    setLoading(true);
    
    try {
      const d = await login(username, password);
      localStorage.setItem("token",    d.token);
      localStorage.setItem("username", d.username);
      localStorage.setItem("role",     d.role);
      
      // Dispatch global event for the sliding black overlay
      window.dispatchEvent(new CustomEvent("trigger-login-transition"));
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally { 
      setLoading(false); 
    }
  }

  return (
    <>
      <div className="login-container">

      {/* ── Left — Branding panel ── */}
      <div className="login-left-panel">
        {/* Custom animations for waves, slogan and aurora orbs */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes waveFlow1 {
            from { stroke-dashoffset: 360; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes waveFlow2 {
            from { stroke-dashoffset: 280; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes floatOrb1 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(40px, -60px) scale(1.15); }
          }
          @keyframes floatOrb2 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-60px, 40px) scale(0.9); }
          }
          @keyframes pulseGlow {
            0% { transform: scale(1); opacity: 1; }
            70%, 100% { transform: scale(2.4); opacity: 0; }
          }
          .pulse-wave-1 {
            animation: waveFlow1 8s linear infinite !important;
          }
          .pulse-wave-2 {
            animation: waveFlow2 10s linear infinite !important;
          }
          .aurora-orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(100px);
            z-index: 0;
            opacity: 0.35;
            pointer-events: none;
            mix-blend-mode: multiply;
          }
          .aurora-orb-1 {
            width: 320px;
            height: 320px;
            background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(99, 102, 241, 0) 70%);
            top: -40px;
            right: -40px;
            animation: floatOrb1 16s ease-in-out infinite;
          }
          .aurora-orb-2 {
            width: 360px;
            height: 360px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0) 70%);
            bottom: -60px;
            left: -60px;
            animation: floatOrb2 20s ease-in-out infinite;
          }
        ` }} />

        {/* Soft Aurora Glow Orbs */}
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />

        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          zIndex: 1,
        }} />

        {/* Floating Particles (Animated via Framer Motion) */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: i === 0 ? -10 : i === 1 ? 15 : i === 2 ? -20 : 10,
              y: i === 0 ? 10 : i === 1 ? -15 : i === 2 ? 15 : -10 
            }}
            animate={{
              x: i % 2 === 0 ? [0, 25, -20, 0] : [0, -25, 20, 0],
              y: i % 2 === 0 ? [0, -35, 15, 0] : [0, 35, -15, 0],
            }}
            transition={{
              duration: i % 2 === 0 ? 12 : 16,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              position: "absolute",
              width: i % 2 === 0 ? 6 : 9,
              height: i % 2 === 0 ? 6 : 9,
              borderRadius: "50%",
              background: i % 2 === 0 ? "rgba(99, 102, 241, 0.25)" : "rgba(16, 185, 129, 0.22)",
              boxShadow: i % 2 === 0 ? "0 0 16px rgba(99, 102, 241, 0.65)" : "0 0 16px rgba(16, 185, 129, 0.55)",
              pointerEvents: "none",
              zIndex: 1,
              top: i === 0 ? "25%" : i === 1 ? "65%" : i === 2 ? "45%" : "80%",
              left: i === 0 ? "20%" : i === 1 ? "75%" : i === 2 ? "85%" : "15%",
            }}
          />
        ))}

        {/* Floating Branded Social & System Icons (CSS-animated bob) */}
        {[
          {
            name: "Instagram",
            color: "#d62976",
            bg: "rgba(255, 255, 255, 0.35)",
            border: "rgba(255, 255, 255, 0.5)",
            shadow: "rgba(214, 41, 118, 0.15)",
            pos: { top: "22%", left: "12%" },
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            )
          },
          {
            name: "Facebook",
            color: "#1877f2",
            bg: "rgba(255, 255, 255, 0.35)",
            border: "rgba(255, 255, 255, 0.5)",
            shadow: "rgba(24, 119, 242, 0.15)",
            pos: { top: "35%", right: "12%" },
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            )
          },
          {
            name: "TikTok",
            color: "#0f172a",
            bg: "rgba(255, 255, 255, 0.35)",
            border: "rgba(255, 255, 255, 0.5)",
            shadow: "rgba(15, 23, 42, 0.1)",
            pos: { bottom: "22%", left: "15%" },
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
              </svg>
            )
          },
          {
            name: "Analytics",
            color: "#6366f1",
            bg: "rgba(255, 255, 255, 0.35)",
            border: "rgba(255, 255, 255, 0.5)",
            shadow: "rgba(99, 102, 241, 0.15)",
            pos: { bottom: "40%", left: "8%" },
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            )
          },
          {
            name: "Database",
            color: "#10b981",
            bg: "rgba(255, 255, 255, 0.35)",
            border: "rgba(255, 255, 255, 0.5)",
            shadow: "rgba(16, 185, 129, 0.15)",
            pos: { bottom: "34%", right: "16%" },
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
              </svg>
            )
          }
        ].map((item) => (
          <div
            key={item.name}
            className="login-float-icon"
            style={{
              position: "absolute",
              ...item.pos,
              width: 38,
              height: 38,
              borderRadius: 12,
              background: item.bg,
              border: `1px solid ${item.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: item.color,
              boxShadow: `0 8px 20px ${item.shadow}`,
              backdropFilter: "blur(8px)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {item.icon}
          </div>
        ))}

        {/* Live Engagement Graph Background */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "45%",
          opacity: 0.12,
          pointerEvents: "none",
          zIndex: 1,
        }}>
          <svg width="100%" height="100%" viewBox="0 0 800 400" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.16)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgba(99, 102, 241, 0.16)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(16, 185, 129, 0.14)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="rgba(16, 185, 129, 0.14)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(15, 23, 42, 0.03)" strokeWidth="1" />
            <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(15, 23, 42, 0.03)" strokeWidth="1" />
            <line x1="0" y1="300" x2="800" y2="300" stroke="rgba(15, 23, 42, 0.03)" strokeWidth="1" />
            {/* Wave 1 Background Area (static) */}
            <path
              d="M0,280 C150,320 250,180 400,240 C550,300 650,150 800,210 L800,400 L0,400 Z"
              fill="url(#grad1)"
              stroke="rgba(99, 102, 241, 0.12)"
              strokeWidth="1"
            />

            {/* Wave 1 Line (flowing pulse) */}
            <path
              d="M0,280 C150,320 250,180 400,240 C550,300 650,150 800,210"
              fill="none"
              stroke="rgba(99, 102, 241, 0.55)"
              strokeWidth="2.5"
              strokeDasharray="40 320"
              className="pulse-wave-1"
              style={{ filter: "drop-shadow(0 0 4px rgba(99, 102, 241, 0.3))" }}
            />

            {/* Wave 2 Background Area (static) */}
            <path
              d="M0,200 C200,120 300,280 500,220 C700,160 750,220 800,180 L800,400 L0,400 Z"
              fill="url(#grad2)"
              stroke="rgba(16, 185, 129, 0.1)"
              strokeWidth="1"
            />

            {/* Wave 2 Line (flowing pulse) */}
            <path
              d="M0,200 C200,120 300,280 500,220 C700,160 750,220 800,180"
              fill="none"
              stroke="rgba(16, 185, 129, 0.5)"
              strokeWidth="2"
              strokeDasharray="30 250"
              className="pulse-wave-2"
              style={{ filter: "drop-shadow(0 0 4px rgba(16, 185, 129, 0.25))" }}
            />
          </svg>
        </div>

        {/* Top brand header */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(15, 23, 42, 0.06)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(15, 23, 42, 0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-xs)"
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.25" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em" }}>SociHR</span>
          </div>
          {/* Creator Badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(214, 41, 118, 0.08) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.15)",
            padding: "4px 10px",
            borderRadius: 99,
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.05)"
          }}>
            <span style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#6366f1",
              animation: "pulseGlow 2s cubic-bezier(0, 0, 0.2, 1) infinite"
            }} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#475569", letterSpacing: "0.03em" }}>
              CRAFTED BY <span style={{ color: "#7c3aed", fontWeight: 800 }}>@syaakiirr</span>
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          width: "100%",
          maxWidth: 460,
          margin: "0 auto",
          position: "relative",
          zIndex: 2,
        }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
          >
            <p style={{ fontSize: 38, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 18 }}>
              Social Media<br />Engagement Monitor
            </p>
            <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
              Monitor employee engagement across social platforms with real-time insights, activity records, and centralized reporting.
            </p>

            {/* Live Ticker Status Feed */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 32,
              background: "rgba(15, 23, 42, 0.04)",
              padding: "6px 14px",
              borderRadius: 99,
              width: "fit-content",
              border: "1px solid rgba(15, 23, 42, 0.05)"
            }}>
              <span style={{
                position: "relative",
                display: "flex",
                width: 6,
                height: 6
              }}>
                <span style={{
                  position: "absolute",
                  display: "inline-flex",
                  height: "100%",
                  width: "100%",
                  borderRadius: "50%",
                  background: "#16a34a",
                  animation: "pulseGlow 2s cubic-bezier(0, 0, 0.2, 1) infinite"
                }} />
                <span style={{
                  position: "relative",
                  display: "inline-flex",
                  borderRadius: "50%",
                  height: 6,
                  width: 6,
                  background: "#16a34a"
                }} />
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={statusIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}
                >
                  {statuses[statusIndex]}
                </motion.span>
              </AnimatePresence>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                {
                  name: "Instagram",
                  color: "#d62976",
                  bg: "rgba(214, 41, 118, 0.05)",
                  border: "rgba(214, 41, 118, 0.15)",
                  glow: "0 6px 14px rgba(214, 41, 118, 0.12)",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <circle cx="12" cy="12" r="4"></circle>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  )
                },
                {
                  name: "Facebook",
                  color: "#1877f2",
                  bg: "rgba(24, 119, 242, 0.05)",
                  border: "rgba(24, 119, 242, 0.15)",
                  glow: "0 6px 14px rgba(24, 119, 242, 0.12)",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                    </svg>
                  )
                },
                {
                  name: "TikTok",
                  color: "#0f172a",
                  bg: "rgba(15, 23, 42, 0.05)",
                  border: "rgba(15, 23, 42, 0.15)",
                  glow: "0 6px 14px rgba(15, 23, 42, 0.08)",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
                    </svg>
                  )
                }
              ].map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.07, type: "spring", stiffness: 100 }}
                  whileHover={{ y: -2, scale: 1.03, boxShadow: p.glow, borderColor: p.color }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: p.bg,
                    border: `1px solid ${p.border}`,
                    borderRadius: 99, padding: "7px 18px",
                    fontSize: 12, fontWeight: 600, color: p.color,
                    cursor: "default",
                    backdropFilter: "blur(4px)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                >
                  <span style={{ display: "flex", opacity: 0.85 }}>{p.icon}</span>
                  {p.name}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Footer Area */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 2 }}>
          <span style={{ fontSize: 11, color: "#475569" }}>Real-time updates active</span>
          <span style={{ fontSize: 11, color: "#475569" }}>© 2026 SociHR</span>
        </div>
      </div>

      {/* ── Right — Login form ── */}
      <main style={{
        display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        padding: "48px 64px",
        background: "var(--white)",
      }} aria-label="Login form">
        <motion.div
          style={{ width: "100%", maxWidth: 360 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16,1,0.3,1] }}
        >
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.025em", marginBottom: 4 }}>
              Account Login
            </p>
            <p style={{ fontSize: 13, color: "var(--text-3)" }}>Enter your credentials to access your account.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="input-label" htmlFor="username">Username</label>
              <input id="username" className="input" type="text" value={username}
                onChange={e => setUsername(e.target.value)} required autoComplete="username"
                placeholder="e.g. admin"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input id="password" className="input" type={showPass ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  placeholder="••••••••"
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", display: "flex", minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
                >
                  {showPass
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  background: "var(--red-soft)", border: "1px solid var(--red-line)",
                  borderRadius: 7, padding: "8px 12px",
                  fontSize: 12.5, color: "var(--red)",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </motion.div>
            )}

            <button id="login-btn" type="submit" disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 4, height: 40 }}
            >
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: "2px solid rgba(15, 23, 42, 0.2)",
                      borderTopColor: "#0f172a",
                    }}
                  />
                  <span style={{ color: "#0f172a" }}>Authenticating...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Trust Indicators */}
          <div style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12
          }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Enterprise Security Standards</span>
            <div style={{ display: "flex", gap: 16, alignItems: "center", opacity: 0.65 }}>
              {/* SOC 2 badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--green)" }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                SOC 2 Compliance
              </div>
              {/* ISO 27001 badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--accent)" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                ISO 27001
              </div>
              {/* SSL Encryption badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--amber)" }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                AES-256 SSL
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "var(--text-4)", textAlign: "center", marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <span>© 2026 SociHR</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span>Crafted by <span style={{ color: "var(--primary)", fontWeight: 600 }}>@syaakiirr</span></span>
          </p>
        </motion.div>
      </main>
    </div>
    </>
  );
}
