import { motion, AnimatePresence } from "framer-motion";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmLabel = "Confirm",
  danger = true,
}: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && !isLoading && onCancel()}
        >
          <motion.div
            className="modal-box"
            style={{ maxWidth: 400 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="modal-head">
              <h2 className="modal-title">{title}</h2>
            </div>

            <p style={{ color: "var(--text-2)", fontSize: 13.5, lineHeight: 1.5, marginBottom: 20 }}>{message}</p>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className="btn"
                style={{
                  flex: 1,
                  background: danger ? "var(--red)" : "var(--accent)",
                  color: "white",
                  border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}
              >
                {isLoading && <span className="spin" style={{ width: 12, height: 12 }} />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
