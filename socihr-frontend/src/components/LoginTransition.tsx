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
        <img
          src="/logo.png"
          alt="SociHR Logo"
          style={{
            width: 64,
            height: 64,
            objectFit: "contain",
            filter: "drop-shadow(0 0 30px rgba(99, 102, 241, 0.6))",
          }}
        />
        <h1 style={{
          fontSize: 22, fontWeight: 800,
          background: "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)",
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
