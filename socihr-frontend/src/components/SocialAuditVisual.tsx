import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ShieldCheck,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface PostData {
  id: string;
  author: string;
  role: string;
  dept: string;
  avatar: string;
  platform: "instagram" | "tiktok" | "facebook";
  content: string;
  tag: string;
  likes: number;
  comments: number;
  shares: number;
  hash: string;
  timestamp: string;
}

const SAMPLE_POSTS: PostData[] = [
  {
    id: "post-1",
    author: "Sara Jenkins",
    role: "Talent Acquisition Lead",
    dept: "Human Resources",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
    platform: "instagram",
    content: "Proud to share our workplace culture milestones! Embracing flexible work and real employee recognition. #SociHRLife #Workplace2026",
    tag: "#SociHRLife",
    likes: 1248,
    comments: 86,
    shares: 42,
    hash: "sha256: 4f9b8c91a7...a28e",
    timestamp: "Just now · Verified",
  },
  {
    id: "post-2",
    author: "Zulqarnain Haris",
    role: "Senior Engineering Manager",
    dept: "Technology",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    platform: "tiktok",
    content: "A day in the life of our infra team building multi-tenant architecture! 🚀 #TechAtSociHR #EngineeringCulture",
    tag: "#TechAtSociHR",
    likes: 3840,
    comments: 215,
    shares: 168,
    hash: "sha256: 9e2c1a40fd...710f",
    timestamp: "2m ago · Verified",
  },
  {
    id: "post-3",
    author: "Michelle Tan",
    role: "Brand Marketing Lead",
    dept: "Marketing",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    platform: "facebook",
    content: "Official wrap-up of our Q3 Community Outreach Day with 200+ team participants! #SociHRCares #CommunityImpact",
    tag: "#SociHRCares",
    likes: 954,
    comments: 112,
    shares: 89,
    hash: "sha256: 1c8d4e55fa...bb33",
    timestamp: "5m ago · Verified",
  },
];

export default function SocialAuditVisual() {
  const [activeIdx, setActiveIdx] = useState(0);

  // Auto-cycle posts to simulate a living, continuously ingesting engine
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % SAMPLE_POSTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const currentPost = SAMPLE_POSTS[activeIdx];

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        );
      case "tiktok":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.86-4.49v-7a8.16 8.16 0 0 0 4.77 1.52v-3.49z" />
          </svg>
        );
      case "facebook":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        );
      default:
        return <Sparkles size={14} color="#4f46e5" />;
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 540,
        margin: "0 auto",
      }}
    >
      {/* ── Ambient Radial Glows (Lightweight CSS animations) ─────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "8%",
          left: "6%",
          width: 460,
          height: 460,
          background: "radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, rgba(14, 165, 233, 0.06) 45%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
          animation: "ambient-pulse 6s ease-in-out infinite alternate",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "4%",
          right: "4%",
          width: 380,
          height: 380,
          background: "radial-gradient(circle, rgba(225, 48, 108, 0.08) 0%, rgba(79, 70, 229, 0.05) 50%, transparent 70%)",
          filter: "blur(46px)",
          pointerEvents: "none",
          animation: "ambient-pulse 8s ease-in-out infinite alternate-reverse",
        }}
      />

      {/* ── Main Live Social Audit Terminal ──────────────────────────────── */}
      <motion.div
        whileHover={{ y: -3, boxShadow: "0 28px 60px -10px rgba(79, 70, 229, 0.14), 0 2px 12px rgba(0, 0, 0, 0.03)" }}
        transition={{ duration: 0.3 }}
        style={{
          position: "relative",
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          border: "1px solid rgba(226, 232, 240, 0.95)",
          borderRadius: 24,
          padding: "26px",
          boxShadow: "0 20px 48px -8px rgba(79, 70, 229, 0.09), 0 2px 12px rgba(0, 0, 0, 0.03)",
          zIndex: 10,
          overflow: "hidden",
        }}
      >
        {/* Animated laser radar scanning bar (Visual audit telemetry) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "linear-gradient(90deg, transparent 0%, rgba(79, 70, 229, 0.8) 50%, transparent 100%)",
            boxShadow: "0 0 12px rgba(79, 70, 229, 0.7)",
            animation: "laser-scan 4.5s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 30,
          }}
        />

        {/* Terminal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 16,
            borderBottom: "1px solid #f1f5f9",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", letterSpacing: "0.04em", marginLeft: 4 }}>
              LIVE MONITORING SESSION #2026-Q3
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 20,
              padding: "4px 10px",
            }}
          >
            {/* Blinking Live Radar Beacon */}
            <span style={{ position: "relative", display: "flex", width: 7, height: 7 }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "#10b981",
                  animation: "ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
              <span style={{ position: "relative", borderRadius: "50%", width: 7, height: 7, background: "#10b981" }} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#065f46" }}>
              Active Listening
            </span>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 18,
          }}
        >
          {SAMPLE_POSTS.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setActiveIdx(idx)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: "8px 12px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                border: activeIdx === idx ? "1.5px solid #4f46e5" : "1px solid #f1f5f9",
                background: activeIdx === idx ? "#eef2ff" : "#f8fafc",
                color: activeIdx === idx ? "#4f46e5" : "#64748b",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                transform: activeIdx === idx ? "scale(1.02)" : "scale(1)",
                boxShadow: activeIdx === idx ? "0 2px 10px rgba(79, 70, 229, 0.12)" : "none",
              }}
            >
              {getPlatformIcon(p.platform)}
              <span style={{ textTransform: "capitalize" }}>{p.platform}</span>
            </button>
          ))}
        </div>

        {/* Active Post Preview Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPost.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 18,
              padding: "18px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
            }}
          >
            {/* Staff Info Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <img
                    src={currentPost.avatar}
                    alt={currentPost.author}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #eef2ff",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      background: "#ffffff",
                      borderRadius: "50%",
                      padding: 2,
                    }}
                  >
                    <CheckCircle2 size={13} color="#4f46e5" fill="#ffffff" />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: "#0f172a" }}>
                      {currentPost.author}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>
                    {currentPost.role} · <strong style={{ color: "#4f46e5" }}>{currentPost.dept}</strong>
                  </div>
                </div>
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#4f46e5",
                  background: "#eef2ff",
                  padding: "4px 9px",
                  borderRadius: 8,
                  border: "1px solid rgba(79, 70, 229, 0.15)",
                }}
              >
                {currentPost.timestamp}
              </span>
            </div>

            {/* Post Content */}
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "#334155",
                margin: "0 0 16px",
              }}
            >
              {currentPost.content}
            </p>

            {/* Post Engagement Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", gap: 18 }}>
                <motion.span
                  whileHover={{ scale: 1.08 }}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#e11d48", cursor: "pointer" }}
                >
                  <Heart size={14} fill="#e11d48" /> {currentPost.likes.toLocaleString()}
                </motion.span>
                <motion.span
                  whileHover={{ scale: 1.08 }}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#475569", cursor: "pointer" }}
                >
                  <MessageCircle size={14} /> {currentPost.comments}
                </motion.span>
                <motion.span
                  whileHover={{ scale: 1.08 }}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#475569", cursor: "pointer" }}
                >
                  <Share2 size={14} /> {currentPost.shares}
                </motion.span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#4f46e5", fontSize: 11, fontWeight: 700 }}>
                <span>Verified Match</span>
                <ExternalLink size={11} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Cryptographic Audit Strip */}
        <div
          style={{
            marginTop: 18,
            padding: "12px 16px",
            background: "#f8fafc",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={16} color="#10b981" />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                Cryptographic Audit Receipt
              </div>
              <div style={{ fontSize: 10, fontFamily: "'Geist Mono', 'Courier New', monospace", color: "#64748b" }}>
                {currentPost.hash}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#059669",
              background: "#d1fae5",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            Tamper Proof
          </div>
        </div>
      </motion.div>

      {/* ── Floating Badge 1: Org Compliance (Top Right with bobbing animation) ─ */}
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          top: -10,
          right: -20,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(226, 232, 240, 0.95)",
          borderRadius: 16,
          padding: "14px 18px",
          boxShadow: "0 14px 34px rgba(79, 70, 229, 0.1)",
          zIndex: 20,
          minWidth: 195,
        }}
        className="hidden sm:block"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Org Compliance
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: 3 }}>
            <TrendingUp size={12} /> 96.8%
          </span>
        </div>

        {/* Mini progress bars with animated glow */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, color: "#475569", marginBottom: 2 }}>
              <span>HR &amp; People</span>
              <span style={{ fontWeight: 700, color: "#4f46e5" }}>100%</span>
            </div>
            <div style={{ width: "100%", height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, #4f46e5, #818cf8)", borderRadius: 2 }} />
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, color: "#475569", marginBottom: 2 }}>
              <span>Tech &amp; Engineering</span>
              <span style={{ fontWeight: 700, color: "#10b981" }}>94%</span>
            </div>
            <div style={{ width: "100%", height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "94%", height: "100%", background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Floating Badge 2: Live Ingestion Stream (Bottom Left with bobbing) ── */}
      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          bottom: -24,
          left: -24,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(226, 232, 240, 0.95)",
          borderRadius: 16,
          padding: "14px 18px",
          boxShadow: "0 14px 34px rgba(79, 70, 229, 0.1)",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
        className="hidden sm:flex"
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "linear-gradient(135deg, #eef2ff, #e0e7ff)",
            border: "1px solid rgba(79, 70, 229, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Sparkles size={18} color="#4f46e5" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
            1,480+ Posts Verified
          </div>
          <div style={{ fontSize: 10.5, color: "#64748b" }}>
            Instagram · TikTok · Facebook
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes laser-scan {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes ambient-pulse {
          0% { transform: scale(0.96) translate(0, 0); opacity: 0.8; }
          100% { transform: scale(1.05) translate(10px, 8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
