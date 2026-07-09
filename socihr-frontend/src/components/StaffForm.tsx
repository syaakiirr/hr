import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Staff } from "../services/api";

const DEPARTMENTS = [
  "AGEING", "ACCOUNT AND FINANCE","HUMAN RESOURCE","PAYMENT","ACCOUNT (LEMBAH KLANG)","ACCOUNT (TERENGENTNU)","ACCOUNT (TERENGGANU)",
];

interface Props {
  staff: Staff | null;
  onSave: (data: { fullName: string; department: string; position: string }) => void;
  onClose: () => void;
  loading: boolean;
}

export default function StaffForm({ staff, onSave, onClose, loading }: Props) {
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  useEffect(() => {
    if (staff) {
      setFullName(staff.fullName);
      setDepartment(staff.department || "");
      setPosition(staff.position || "");
    } else {
      setFullName("");
      setDepartment("");
      setPosition("");
    }
  }, [staff]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ fullName, department, position });
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="modal-box"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
        >
          <div className="modal-head">
            <h2 className="modal-title">{staff ? "Edit Staff" : "Add New Staff"}</h2>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon btn-sm"
              type="button"
              style={{ color: "var(--text-3)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="input-label" htmlFor="staff-name">Full Name</label>
              <input
                id="staff-name"
                className="input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="staff-dept">Department</label>
              <select
                id="staff-dept"
                className="input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">-- Select Department --</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="staff-position">Jawatan / Position</label>
              <input
                id="staff-position"
                className="input"
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Manager, Executive, Officer"
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                id="staff-save-btn"
                type="submit"
                disabled={loading || !fullName.trim()}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {loading ? (
                  <><span className="spin" style={{ width: 12, height: 12 }} /> Saving...</>
                ) : staff ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
