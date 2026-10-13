import { motion, MotionConfig } from "motion/react";
import SplitText from "../components/SplitText";
import CountUp from "../components/CountUp";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  Lock,
  MonitorCheck,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import RotatingEarth from "@/components/ui/wireframe-dotted-globe";

// ─── Motion ──────────────────────────────────────────────────────────────────
const EASE = [0.22, 1, 0.36, 1] as const;

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.6, delay, ease: EASE },
  };
}



// ─── Data ─────────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { name: "Instagram", metric: "4,820+ Posts Tracked", sub: "Reels & Feed", color: "#E1306C" },
  { name: "TikTok", metric: "9,140+ Posts Tracked", sub: "Short-form Video", color: "#000000" },
  { name: "Facebook", metric: "3,420+ Posts Tracked", sub: "Pages & Groups", color: "#1877F2" },
];

const CAPABILITIES = [
  {
    icon: MonitorCheck,
    title: "Session Monitoring",
    body: "Named, timestamped tracking sessions verifying staff posts against campaign milestones. The immutable unit of workforce accountability.",
    stat: "100%",
    statLabel: "Traceable",
    highlight: true,
  },
  {
    icon: BarChart3,
    title: "Cross-Platform Analytics",
    body: "Consolidate likes, comments, and post engagement across Instagram, TikTok, and Facebook into uniform metrics per department.",
    stat: "3+",
    statLabel: "Channels",
  },
  {
    icon: ScrollText,
    title: "Cryptographic Audit Trail",
    body: "Every status modification recorded with actor identity, timestamp, and immutable state snapshots for defensibility.",
    stat: "Defensible",
    statLabel: "Audit Grade",
  },
  {
    icon: FileSpreadsheet,
    title: "Executive Export Dossiers",
    body: "One-click signed PDF audit dossiers and custom Excel spreadsheets formatted for People Operations and HR compliance leadership.",
    stat: "< 2s",
    statLabel: "Report Export",
  },
];

const WORKFLOW_STEPS = [
  {
    n: "01",
    title: "Enroll Directory & Handles",
    body: "Import staff rosters, assign organizational divisions, and securely link verified public social media handles.",
  },
  {
    n: "02",
    title: "Execute Monitoring Sessions",
    body: "Run scheduled or ad-hoc tracking cycles to automatically benchmark post metrics against organizational targets.",
  },
  {
    n: "03",
    title: "Export Defensible Reports",
    body: "Generate signed audit reports with full chronological history, ready for executive compliance presentation.",
  },
];

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: "JWT & HMAC-SHA256 Signed",
    desc: "Stateless authentication tokens with strict automated expiry and signature validation.",
  },
  {
    icon: Users,
    title: "Scoped Role-Based Access",
    desc: "Granular administrative privileges isolating SuperAdmin, DeptAdmin, and Reviewer capabilities.",
  },
  {
    icon: ShieldCheck,
    title: "Hardware Two-Factor (TOTP)",
    desc: "Multi-factor authentication enforcement on all administrative actions and data modifications.",
  },
  {
    icon: Building2,
    title: "Division & Tenant Isolation",
    desc: "Data partitioning across company units ensuring zero cross-department information leakage.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={{
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Geist', sans-serif",
          color: "#0f172a",
          background: "#FFFFFF",
          overflowX: "hidden",
          minHeight: "100vh",
        }}
      >
        {/* ── Fixed Floating Pill Navbar (Follows on scroll) ─────────────── */}
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 0,
            right: 0,
            zIndex: 100,
            display: "flex",
            justifyContent: "center",
            width: "100%",
            pointerEvents: "none",
            padding: "0 16px",
          }}
        >
          <nav
            className="landing-nav"
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 8px 6px 16px",
              borderRadius: 16,
              background: "rgba(255, 255, 255, 0.88)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
            }}
          >
            {/* Brand (Clean logo with NO blue box background) */}
            <a
              href="#top"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginRight: 12,
                textDecoration: "none",
              }}
            >
              <img
                src="/logo.png"
                alt="SociHR"
                style={{ width: 28, height: 28, objectFit: "contain", display: "block" }}
                onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
              />
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                SociHR
              </span>
            </a>

            {/* Links — disembunyikan di fon/tablet melalui .landing-nav-links */}
            <div className="landing-nav-links" style={{ display: "flex", alignItems: "center" }}>
              {[
                { label: "Capabilities", href: "#capabilities" },
                { label: "Workflow", href: "#workflow" },
                { label: "Governance", href: "#governance" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  style={{
                    display: "block",
                    padding: "6px 12px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#64748b",
                    textDecoration: "none",
                    transition: "color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#0f172a";
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#64748b";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* CTA button */}
            <button
              id="nav-signin"
              className="landing-nav-cta"
              onClick={() => navigate("/login")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 36,
                padding: "0 16px",
                marginLeft: 6,
                borderRadius: 12,
                background: "#4f46e5",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(79, 70, 229, 0.28)",
                transition: "transform 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#4338ca";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#4f46e5";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              Sign In
              <ChevronRight size={13} />
            </button>
          </nav>
        </div>

        {/* ── Hero Section (Traceo 2-col layout) ──────────────────────────── */}
        <section
          id="top"
          style={{
            position: "relative",
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            paddingTop: 36,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1280,
              margin: "0 auto",
              padding: "44px 28px 80px",
              display: "grid",
              gridTemplateColumns: "1.1fr 1fr",
              gap: 48,
              alignItems: "center",
            }}
            className="hero-grid"
          >
            {/* Left: Text & CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              style={{ position: "relative", zIndex: 2 }}
            >
              {/* Subtle ambient blur behind headline */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -60,
                  left: -40,
                  width: 380,
                  height: 340,
                  background: "radial-gradient(circle, rgba(79, 70, 229, 0.08) 0%, transparent 70%)",
                  filter: "blur(40px)",
                  pointerEvents: "none",
                }}
              />

              <h1
                className="landing-hero-title"
                style={{
                  fontSize: "clamp(2.7rem, 5.2vw, 4.4rem)",
                  fontWeight: 900,
                  lineHeight: 1.1,
                  letterSpacing: "-0.04em",
                  color: "#0f172a",
                  marginBottom: 22,
                }}
              >
                <span style={{ display: "block" }}>
                  <SplitText
                    text="Track the posts."
                    delay={0.05}
                    duration={0.6}
                    yOffset={32}
                    once
                  />
                </span>
                <span style={{ display: "block", color: "#4f46e5" }}>
                  <SplitText
                    text="Verify the impact."
                    delay={0.05}
                    duration={0.6}
                    yOffset={32}
                    style={{ color: "#4f46e5" }}
                    once
                  />
                </span>
                <span style={{ display: "block", color: "rgba(15, 23, 42, 0.35)" }}>
                  <SplitText
                    text="Defend the data."
                    delay={0.045}
                    duration={0.6}
                    yOffset={32}
                    style={{ color: "rgba(15, 23, 42, 0.35)" }}
                    once
                  />
                </span>
              </h1>

              <p
                className="landing-hero-sub"
                style={{
                  fontSize: 17,
                  lineHeight: 1.65,
                  color: "#64748b",
                  maxWidth: 480,
                  marginBottom: 36,
                }}
              >
                SociHR automatically tracks and audits employee social engagement across Instagram, TikTok, and Facebook for enterprise people teams.
              </p>

              {/* Action Buttons */}
              <div className="landing-hero-ctas" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <button
                  id="hero-get-started"
                  onClick={() => navigate("/login")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    height: 52,
                    padding: "0 26px",
                    borderRadius: 14,
                    background: "#4f46e5",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 6px 20px rgba(79, 70, 229, 0.32)",
                    transition: "transform 0.15s, box-shadow 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#4338ca";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 28px rgba(79, 70, 229, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#4f46e5";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(79, 70, 229, 0.32)";
                  }}
                >
                  Launch Workspace
                  <ArrowRight size={15} />
                </button>

                <a
                  href="#capabilities"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 52,
                    padding: "0 22px",
                    borderRadius: 14,
                    background: "transparent",
                    border: "1.5px solid rgba(0, 0, 0, 0.09)",
                    color: "#475569",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#4f46e5";
                    (e.currentTarget as HTMLElement).style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(0, 0, 0, 0.09)";
                    (e.currentTarget as HTMLElement).style.color = "#475569";
                  }}
                >
                  What it does
                  <ChevronRight size={14} />
                </a>
              </div>
            </motion.div>

            {/* Right: Interactive Wireframe Dotted Globe */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <RotatingEarth width={560} height={520} className="w-full max-w-[560px]" />
            </motion.div>
          </div>
        </section>

        {/* ── Active Social Ingestion Bar (Animated & Interactive) ────────── */}
        <section
          className="landing-section"
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid rgba(0, 0, 0, 0.07)",
            borderBottom: "1px solid rgba(0, 0, 0, 0.07)",
            padding: "24px 28px",
          }}
        >
          <div
            className="landing-pipeline"
            style={{
              maxWidth: 1240,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ position: "relative", display: "flex", width: 8, height: 8 }}>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "#10b981",
                    animation: "ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                  }}
                />
                <span style={{ position: "relative", borderRadius: "50%", width: 8, height: 8, background: "#10b981" }} />
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>
                Active Multi-Platform Pipeline
              </span>
            </div>

            <div className="landing-pipeline-cards" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {PLATFORMS.map((p) => (
                <motion.div
                  key={p.name}
                  whileHover={{ y: -2, borderColor: "#c7d2fe", boxShadow: "0 6px 18px rgba(79, 70, 229, 0.06)" }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 16px",
                    borderRadius: 12,
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    cursor: "default",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: p.name === "Instagram" ? "rgba(225, 48, 108, 0.1)" : p.name === "TikTok" ? "rgba(0,0,0,0.06)" : "rgba(24, 119, 242, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {p.name === "Instagram" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                      </svg>
                    )}
                    {p.name === "TikTok" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#000000">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.86-4.49v-7a8.16 8.16 0 0 0 4.77 1.52v-3.49z" />
                      </svg>
                    )}
                    {p.name === "Facebook" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                      {p.metric}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Capabilities (Consistent Light Mode #F8F9FF) ─────────────────── */}
        <section
          id="capabilities"
          className="landing-section"
          style={{
            background: "#F8F9FF",
            borderBottom: "1px solid rgba(0, 0, 0, 0.07)",
            padding: "100px 28px",
          }}
        >
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <motion.div {...fadeUp()} style={{ maxWidth: 560, marginBottom: 54 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4f46e5" }}>
                Capabilities
              </span>
              <h2
                style={{
                  fontSize: "clamp(2rem, 3.8vw, 3.2rem)",
                  fontWeight: 900,
                  letterSpacing: "-0.035em",
                  color: "#0f172a",
                  lineHeight: 1.1,
                  margin: "10px 0 14px",
                }}
              >
                Engineered for workforce accountability.
              </h2>
              <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                Everything your organization needs to monitor, verify, and document employee social participation without manual spreadsheets.
              </p>
            </motion.div>

            {/* Asymmetric Light Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
              className="capabilities-grid"
            >
              {CAPABILITIES.map((cap, i) => {
                const Icon = cap.icon;
                const isWide = i === 0 || i === 3;
                return (
                  <motion.div
                    key={cap.title}
                    {...fadeUp(i * 0.08)}
                    style={{
                      gridColumn: isWide ? "span 2" : "span 1",
                      background: cap.highlight ? "#EEF2FF" : "#FFFFFF",
                      border: `1px solid ${cap.highlight ? "rgba(79, 70, 229, 0.25)" : "rgba(0, 0, 0, 0.07)"}`,
                      borderRadius: 18,
                      padding: isWide ? "36px 36px 40px" : "32px 30px",
                      display: "flex",
                      flexDirection: isWide ? "row" : "column",
                      justifyContent: "space-between",
                      alignItems: isWide ? "flex-start" : "stretch",
                      gap: 24,
                      boxShadow: "0 2px 14px rgba(0, 0, 0, 0.03)",
                      transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
                    }}
                    className={isWide ? "cap-wide landing-cap-card" : "landing-cap-card"}
                    whileHover={{
                      y: -2,
                      borderColor: "rgba(79, 70, 229, 0.4)",
                      boxShadow: "0 10px 30px rgba(79, 70, 229, 0.08)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: cap.highlight ? "rgba(79, 70, 229, 0.15)" : "#F1F5F9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 20,
                        }}
                      >
                        <Icon size={20} color="#4f46e5" />
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a", margin: "0 0 8px" }}>
                        {cap.title}
                      </h3>
                      <p style={{ fontSize: 14, color: cap.highlight ? "#4338ca" : "#64748b", lineHeight: 1.6, margin: 0, maxWidth: "44ch" }}>
                        {cap.body}
                      </p>
                    </div>

                    <div style={{ textAlign: isWide ? "right" : "left", flexShrink: 0, marginTop: isWide ? 0 : 16 }}>
                      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em", color: "#4f46e5", lineHeight: 1 }}>
                        {/* CountUp for numeric stats, static text for others */}
                        {cap.stat === "100%" ? (
                          <><CountUp to={100} suffix="%" duration={1600} delay={i * 120} /></>
                        ) : cap.stat === "3+" ? (
                          <><CountUp to={3} suffix="+" duration={1200} delay={i * 120} /></>
                        ) : cap.stat === "< 2s" ? (
                          <><CountUp to={2} prefix="< " suffix="s" duration={1000} delay={i * 120} /></>
                        ) : (
                          cap.stat
                        )}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>
                        {cap.statLabel}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Workflow (Consistent Light Mode #FFFFFF) ────────────────────── */}
        <section
          id="workflow"
          className="landing-section"
          style={{
            background: "#FFFFFF",
            borderBottom: "1px solid rgba(0, 0, 0, 0.07)",
            padding: "100px 28px",
          }}
        >
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.6fr",
                gap: 72,
                alignItems: "start",
              }}
              className="workflow-grid"
            >
              {/* Left sticky column */}
              <motion.div {...fadeUp()} className="landing-sticky-col" style={{ position: "sticky", top: 100 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4f46e5" }}>
                  Operational Pipeline
                </span>
                <h2
                  style={{
                    fontSize: "clamp(2rem, 3.6vw, 3rem)",
                    fontWeight: 900,
                    letterSpacing: "-0.035em",
                    color: "#0f172a",
                    lineHeight: 1.1,
                    margin: "10px 0 16px",
                  }}
                >
                  Three steps from roster to signed report.
                </h2>
                <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.65, margin: "0 0 28px" }}>
                  A streamlined compliance cycle that guarantees transparency and continuous verification.
                </p>

                <button
                  onClick={() => navigate("/login")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 44,
                    padding: "0 20px",
                    borderRadius: 12,
                    background: "#4f46e5",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(79, 70, 229, 0.28)",
                  }}
                >
                  Explore Workflow <ArrowRight size={14} />
                </button>
              </motion.div>

              {/* Right: Step cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {WORKFLOW_STEPS.map((step, idx) => (
                  <motion.div
                    key={step.n}
                    {...fadeUp(idx * 0.1)}
                    className="landing-step-card"
                    style={{
                      background: "#F8F9FF",
                      border: "1px solid rgba(0, 0, 0, 0.07)",
                      borderRadius: 16,
                      padding: "28px 32px",
                      display: "flex",
                      gap: 24,
                      alignItems: "flex-start",
                      transition: "transform 0.15s, border-color 0.15s",
                    }}
                    whileHover={{ y: -2, borderColor: "rgba(79, 70, 229, 0.3)" }}
                  >
                    <div
                      style={{
                        fontFamily: "'Geist Mono', 'Courier New', monospace",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#4f46e5",
                        background: "#EEF2FF",
                        border: "1px solid rgba(79, 70, 229, 0.2)",
                        borderRadius: 8,
                        padding: "6px 10px",
                        flexShrink: 0,
                      }}
                    >
                      {step.n}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: "0 0 6px" }}>
                        {step.title}
                      </h3>
                      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                        {step.body}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Security & Governance (NOW LIGHT MODE #F8F9FF! No black section) ── */}
        <section
          id="governance"
          className="landing-section"
          style={{
            background: "#F8F9FF",
            borderBottom: "1px solid rgba(0, 0, 0, 0.07)",
            padding: "100px 28px",
          }}
        >
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <motion.div {...fadeUp()} style={{ maxWidth: 620, marginBottom: 54 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4f46e5" }}>
                Security &amp; Governance
              </span>
              <h2
                style={{
                  fontSize: "clamp(2rem, 3.8vw, 3.2rem)",
                  fontWeight: 900,
                  letterSpacing: "-0.035em",
                  color: "#0f172a",
                  lineHeight: 1.1,
                  margin: "10px 0 14px",
                }}
              >
                Defensible architecture. Zero exceptions.
              </h2>
              <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                Every data layer is cryptographically protected with strict role boundaries to ensure enterprise compliance readiness.
              </p>
            </motion.div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 20,
              }}
              className="security-grid"
            >
              {SECURITY_PILLARS.map((sec, i) => {
                const Icon = sec.icon;
                return (
                  <motion.div
                    key={sec.title}
                    {...fadeUp(i * 0.08)}
                    className="landing-sec-card"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(0, 0, 0, 0.07)",
                      borderRadius: 16,
                      padding: "28px 28px",
                      display: "flex",
                      gap: 20,
                      alignItems: "flex-start",
                      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    whileHover={{
                      borderColor: "rgba(79, 70, 229, 0.35)",
                      boxShadow: "0 8px 24px rgba(79, 70, 229, 0.06)",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: "#EEF2FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={20} color="#4f46e5" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: "0 0 6px" }}>
                        {sec.title}
                      </h3>
                      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.55, margin: 0 }}>
                        {sec.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Clean Light CTA Section ─────────────────────────────────────── */}
        <section
          className="landing-section"
          style={{
            background: "#FFFFFF",
            padding: "90px 28px 110px",
          }}
        >
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <motion.div
              {...fadeUp()}
              className="landing-cta-card"
              style={{
                background: "linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 100%)",
                border: "1px solid rgba(79, 70, 229, 0.2)",
                borderRadius: 24,
                padding: "60px 48px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 36,
                boxShadow: "0 12px 36px rgba(79, 70, 229, 0.06)",
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4f46e5" }}>
                  Get Started Today
                </span>
                <h2
                  style={{
                    fontSize: "clamp(2rem, 3.4vw, 2.8rem)",
                    fontWeight: 900,
                    letterSpacing: "-0.035em",
                    color: "#0f172a",
                    lineHeight: 1.1,
                    margin: "8px 0 10px",
                  }}
                >
                  Ready to audit employee engagement?
                </h2>
                <p style={{ fontSize: 16, color: "#64748b", margin: 0 }}>
                  Sign in to your organization workspace or request access from your People Ops team.
                </p>
              </div>

              <button
                id="cta-launch"
                onClick={() => navigate("/login")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  height: 52,
                  padding: "0 28px",
                  borderRadius: 14,
                  background: "#4f46e5",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(79, 70, 229, 0.32)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 28px rgba(79, 70, 229, 0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(79, 70, 229, 0.32)";
                }}
              >
                Access Dashboard
                <ArrowRight size={16} />
              </button>
            </motion.div>
          </div>
        </section>

        {/* ── Rounded Light Footer (Traceo style) ─────────────────────────── */}
        <footer style={{ background: "#F0F1F3", padding: "40px 20px 30px" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <div
              className="landing-footer-card"
              style={{
                background: "#FFFFFF",
                borderRadius: 20,
                border: "1px solid rgba(0, 0, 0, 0.07)",
                padding: "32px 36px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 20,
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img
                  src="/logo.png"
                  alt="SociHR"
                  style={{ width: 22, height: 22, objectFit: "contain", display: "block" }}
                  onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                />
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>SociHR</span>
                <span style={{ color: "#cbd5e1" }}>·</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>Social Engagement &amp; Audit Engine</span>
              </div>

              <div style={{ fontSize: 13, color: "#64748b" }}>
                © 2026 SociHR. Designed &amp; Developed by <strong style={{ color: "#4f46e5" }}>@syaakiirr</strong>.
              </div>
            </div>
          </div>
        </footer>

        {/* ── Responsive Overrides ────────────────────────────────────────── */}
        <style>{`
          @media (max-width: 1024px) {
            .hero-grid {
              grid-template-columns: 1fr !important;
              padding-top: 100px !important;
            }
            .capabilities-grid {
              grid-template-columns: 1fr !important;
            }
            .capabilities-grid > div {
              grid-column: span 1 !important;
            }
            .cap-wide {
              flex-direction: column !important;
            }
            .workflow-grid {
              grid-template-columns: 1fr !important;
            }
            .security-grid {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 640px) {
            .hero-grid {
              padding: 100px 20px 56px !important;
              gap: 28px !important;
            }
            .landing-hero-ctas > * {
              width: 100% !important;
              justify-content: center !important;
            }
          }
        `}</style>
      </div>
    </MotionConfig>
  );
}
