import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";

  // If dashboard, slide vertically (fade-in from bottom). Otherwise, slide horizontally.
  const variants = isDashboard
    ? {
        initial: { opacity: 0, y: 32 },
        animate: { opacity: 1, y: 0 },
        exit:    { opacity: 0, y: -24 },
      }
    : {
        initial: { opacity: 0, x: 32 },
        animate: { opacity: 1, x: 0 },
        exit:    { opacity: 0, x: -24 },
      };

  const transition = {
    duration: 0.22,
    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
  };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
  );
}
