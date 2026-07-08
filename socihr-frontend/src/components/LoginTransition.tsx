import { motion } from "framer-motion";

interface LoginTransitionProps {
  onMidpoint?: () => void;
}

export default function LoginTransition({ onMidpoint }: LoginTransitionProps) {
  return (
    <motion.div
      initial={{ y: "-100%" }}
      animate={{ y: "0%" }}
      exit={{ y: "100%" }}
      transition={{
        duration: 0.6,
        ease: [0.76, 0, 0.24, 1], // Custom premium cubic-bezier ease
      }}
      onAnimationComplete={(definition) => {
        // If it finished sliding down (entering)
        if (JSON.stringify(definition) === JSON.stringify({ y: "0%" }) || (definition as any).y === "0%") {
          setTimeout(() => {
            onMidpoint?.();
          }, 150); // Small pause for dramatic effect
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#09090b", // Sleek dark/black
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Brand logo in the center of the black screen */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 40px rgba(99, 102, 241, 0.4)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          </svg>
        </div>
        <h1 style={{
          fontSize: 22,
          fontWeight: 800,
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em",
        }}>
          SociHR
        </h1>
      </motion.div>
    </motion.div>
  );
}
