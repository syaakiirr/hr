import { useRef, useEffect } from "react";

interface LoginTransitionProps {
  onMidpoint?: () => void;
}

export default function LoginTransition({ onMidpoint }: LoginTransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const handler = (e: AnimationEvent) => {
      if (e.animationName === "ltSlideDown") {
        setTimeout(() => onMidpoint?.(), 150);
      }
    };
    el.addEventListener("animationend", handler);
    return () => el.removeEventListener("animationend", handler);
  }, [onMidpoint]);

  return (
    <div
      ref={overlayRef}
      className="lt-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#09090b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="lt-logo" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: 14,
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(99, 102, 241, 0.4)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          </svg>
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 800,
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em",
        }}>
          SociHR
        </h1>
      </div>
    </div>
  );
}
