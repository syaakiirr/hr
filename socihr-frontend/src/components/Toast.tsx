import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ToastState {
  isOpen: boolean;
  message: string;
  type: "success" | "error";
}

interface ToastProps extends ToastState {
  onClose: () => void;
  duration?: number;
}

export default function Toast({ isOpen, message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, message, duration]);

  const isSuccess = type === "success";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed", top: 20, right: 20, zIndex: 200,
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--white)",
            border: `1px solid ${isSuccess ? "var(--green-line)" : "var(--red-line)"}`,
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-lg)",
            padding: "12px 16px",
            minWidth: 260,
            maxWidth: 380,
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isSuccess ? "var(--green-soft)" : "var(--red-soft)",
            color: isSuccess ? "var(--green)" : "var(--red)",
          }}>
            {isSuccess ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", flex: 1, lineHeight: 1.4 }}>{message}</p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", padding: 2, flexShrink: 0, display: "flex" }}
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
