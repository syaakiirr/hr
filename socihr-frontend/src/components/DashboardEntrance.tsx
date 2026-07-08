import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface DashboardEntranceProps {
  onComplete?: () => void;
}

export default function DashboardEntrance({ onComplete }: DashboardEntranceProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.6, delay: 1.2, ease: "easeInOut" }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {/* Reveal grid pattern */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 1.8 }}
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Center expanding logo */}
      <motion.div
        initial={{ scale: 1.2, opacity: 1 }}
        animate={{ 
          scale: [1.2, 1, 45],
          opacity: [1, 1, 0],
        }}
        transition={{
          duration: 1.8,
          times: [0, 0.4, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          width: 100,
          height: 100,
          borderRadius: 28,
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 20px 60px rgba(99, 102, 241, 0.35)",
        }}
      >
        <svg
          width="50"
          height="50"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        </svg>
      </motion.div>

      {/* Light rays emanating from center */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <motion.div
          key={i}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ 
            scaleX: [0, 1.2, 0],
            opacity: [0, 0.35, 0],
          }}
          transition={{
            duration: 1.6,
            delay: 0.2 + i * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "55vw",
            height: 3,
            transformOrigin: "left center",
            transform: `rotate(${i * 45}deg)`,
            background: `linear-gradient(90deg, ${
              i % 3 === 0 ? "rgba(99, 102, 241, 0.8)" : i % 3 === 1 ? "rgba(168, 85, 247, 0.8)" : "rgba(236, 72, 153, 0.8)"
            }, transparent)`,
            filter: "blur(2px)",
          }}
        />
      ))}

      {/* Expanding circles */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`circle-${i}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 3, 6],
            opacity: [0.4, 0.2, 0],
          }}
          transition={{
            duration: 1.8,
            delay: i * 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 200,
            height: 200,
            marginTop: -100,
            marginLeft: -100,
            borderRadius: "50%",
            border: `2px solid ${
              i === 0 ? "rgba(99, 102, 241, 0.3)" : i === 1 ? "rgba(168, 85, 247, 0.3)" : "rgba(236, 72, 153, 0.3)"
            }`,
            pointerEvents: "none",
          }}
        />
      ))}
    </motion.div>
  );
}
