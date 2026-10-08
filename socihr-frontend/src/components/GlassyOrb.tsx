import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

export default function GlassyOrb() {
  const [videoLoaded, setVideoLoaded] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 520,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* ── Ambient Radial Glows (Lightweight CSS, no WebGL) ──────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "12%",
          left: "8%",
          width: 460,
          height: 460,
          background: "radial-gradient(circle, rgba(79, 70, 229, 0.14) 0%, rgba(99, 102, 241, 0.06) 45%, transparent 72%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "10%",
          right: "4%",
          width: 380,
          height: 380,
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(99, 102, 241, 0.05) 50%, transparent 70%)",
          filter: "blur(46px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Glassy Orb Video (Ultra-lightweight, 60fps, Traceo aesthetic) ─── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          aspectRatio: "1/1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Soft fallback glowing sphere while video loads */}
        {!videoLoaded && (
          <div
            style={{
              position: "absolute",
              width: "70%",
              height: "70%",
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 30%, #c7d2fe 0%, #818cf8 40%, #4f46e5 85%)",
              opacity: 0.35,
              filter: "blur(24px)",
              animation: "orb-pulse 3s ease-in-out infinite alternate",
            }}
          />
        )}

        <video
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          style={{
            width: "92%",
            height: "92%",
            objectFit: "contain",
            mixBlendMode: "multiply",
            filter: "invert(1) hue-rotate(185deg) saturate(180%) brightness(1.12)",
            transform: "scale(0.92)",
            pointerEvents: "none",
            transition: "opacity 0.6s ease",
            opacity: videoLoaded ? 1 : 0.4,
          }}
        >
          <source
            src="https://future.co/images/homepage/glassy-orb/orb-purple.webm"
            type="video/webm"
          />
        </video>

        {/* ── Floating Metric Chip 1 (Top-Right) ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            position: "absolute",
            top: "14%",
            right: "4%",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            borderRadius: 14,
            padding: "12px 18px",
            boxShadow: "0 12px 32px rgba(79, 70, 229, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "#eef2ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={18} color="#4f46e5" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Audit Integrity
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
              100% Verified
            </div>
          </div>
        </motion.div>

        {/* ── Floating Metric Chip 2 (Bottom-Left) ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            position: "absolute",
            bottom: "12%",
            left: "6%",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            borderRadius: 14,
            padding: "14px 18px",
            boxShadow: "0 12px 32px rgba(79, 70, 229, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Active Sessions
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#10b981" }}>
              <TrendingUp size={12} /> +24%
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
            1,480+ <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>staff posts</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <CheckCircle2 size={12} color="#4f46e5" />
            <span style={{ fontSize: 11, color: "#64748b" }}>Live cross-platform sync</span>
          </div>
        </motion.div>

        {/* ── Subtle Center Tag ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{
            position: "absolute",
            top: "6%",
            left: "8%",
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.9)",
            borderRadius: 20,
            padding: "4px 12px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: "#4f46e5",
            boxShadow: "0 2px 10px rgba(79, 70, 229, 0.06)",
          }}
        >
          <Sparkles size={11} /> Real-Time Engine
        </motion.div>
      </div>

      <style>{`
        @keyframes orb-pulse {
          0% { transform: scale(0.95); opacity: 0.3; }
          100% { transform: scale(1.05); opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
