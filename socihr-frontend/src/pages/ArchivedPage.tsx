import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import ConfirmationDialog from "../components/ConfirmationDialog";
import { getArchivedStaff, getArchivedSessions, restoreStaff, restoreSession, deleteStaff, deleteSession, type Staff, type MonitoringSession } from "../services/api";


function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      if (word.startsWith("(")) {
        return "(" + word.charAt(1).toUpperCase() + word.slice(2);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export default function ArchivedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"staff" | "sessions">(
    location.state?.tab === "sessions" ? "sessions" : "staff"
  );
  const [archivedStaff, setArchivedStaff] = useState<Staff[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<MonitoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
    confirmLabel?: string;
    danger?: boolean;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  useEffect(() => {
    loadArchived();
  }, [activeTab]);

  async function loadArchived() {
    setLoading(true);
    try {
      if (activeTab === "staff") {
        const data = await getArchivedStaff();
        setArchivedStaff(data);
      } else {
        const data = await getArchivedSessions();
        setArchivedSessions(data);
      }
    } catch (error) {
      console.error("Failed to load archived items:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreStaff(staffId: string, name: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Restore Staff Member",
      message: `Restore ${toTitleCase(name)}? Status will be reset to Active.`,
      confirmLabel: "Restore",
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await restoreStaff(staffId);
          setArchivedStaff(prev => prev.filter(s => s.staffID !== staffId));
        } catch (error) {
          console.error("Failed to restore staff:", error);
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      }
    });
  }

  async function handleDeleteStaffPermanently(staffId: string, name: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Permanently Delete Staff",
      message: `Permanently delete ${toTitleCase(name)}? All associated engagement data will be permanently removed. This action cannot be undone.`,
      confirmLabel: "Delete Permanently",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteStaff(staffId);
          setArchivedStaff(prev => prev.filter(s => s.staffID !== staffId));
        } catch (error) {
          console.error("Failed to permanently delete staff:", error);
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      }
    });
  }

  async function handleRestoreSession(sessionId: string, date: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Restore Session",
      message: `Restore session from ${date}? The session will reappear in the Monitoring page.`,
      confirmLabel: "Restore",
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await restoreSession(sessionId);
          setArchivedSessions(prev => prev.filter(s => s.sessionID !== sessionId));
        } catch (error) {
          console.error("Failed to restore session:", error);
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      }
    });
  }

  async function handleDeleteSessionPermanently(sessionId: string, date: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Permanently Delete Session",
      message: `Permanently delete session ${date}? All engagements and audit trail entries will be permanently removed. This action cannot be undone.`,
      confirmLabel: "Delete Permanently",
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteSession(sessionId);
          setArchivedSessions(prev => prev.filter(s => s.sessionID !== sessionId));
        } catch (error) {
          console.error("Failed to permanently delete session:", error);
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      }
    });
  }

  return (
    <Layout>
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Archived Items
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              View, restore, or permanently delete archived staff and monitoring sessions
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                const { downloadPageAsPDF } = await import("../utils/pdf");
                downloadPageAsPDF("Archived");
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => navigate(-1)}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", padding: 3, borderRadius: "var(--r-md)", border: "1px solid var(--line)", width: "fit-content", marginBottom: 20 }}>
          <button
            onClick={() => setActiveTab("staff")}
            style={{
              padding: "6px 14px",
              borderRadius: "calc(var(--r-md) - 2px)",
              border: "none",
              background: activeTab === "staff" ? "var(--accent)" : "transparent",
              color: activeTab === "staff" ? "#fff" : "var(--text-2)",
              fontSize: "0.82rem",
              fontWeight: activeTab === "staff" ? 600 : 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Staff ({archivedStaff.length})
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            style={{
              padding: "6px 14px",
              borderRadius: "calc(var(--r-md) - 2px)",
              border: "none",
              background: activeTab === "sessions" ? "var(--accent)" : "transparent",
              color: activeTab === "sessions" ? "#fff" : "var(--text-2)",
              fontSize: "0.82rem",
              fontWeight: activeTab === "sessions" ? 600 : 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Sessions ({archivedSessions.length})
          </button>
        </div>

      {loading ? (
        <div className="loader"><div className="spin" />Loading archived items...</div>
      ) : (
        <>
          {/* Staff Tab */}
          {activeTab === "staff" && (
            archivedStaff.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h18v5H3zM3 8h18v13H3z" /><path d="M9 12h6" />
                  </svg>
                </div>
                <p className="empty-title">No Archived Staff</p>
                <p className="empty-desc">Archived staff members will appear here</p>
              </div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Archived Date</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedStaff.map((staff, idx) => (
                      <motion.tr
                        key={staff.staffID}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.03 }}
                      >
                        <td style={{ fontWeight: 600 }}>{staff.fullName}</td>
                        <td><span className="badge badge-neutral">{staff.department || "—"}</span></td>
                        <td style={{ fontSize: 13, color: "var(--text-3)" }}>{staff.position || "—"}</td>
                        <td><span className="badge badge-red">{staff.status}</span></td>
                        <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                          {(staff as any).archivedAt
                            ? new Date((staff as any).archivedAt).toLocaleString('en-MY', {
                                year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })
                            : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button
                              onClick={() => handleRestoreStaff(staff.staffID, staff.fullName)}
                              className="btn btn-success-outline btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: 4 }}
                              title="Restore staff"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                <path d="M3 21v-5h5" />
                              </svg>
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteStaffPermanently(staff.staffID, staff.fullName)}
                              className="btn btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1.5px solid var(--red)", color: "var(--red)" }}
                              title="Permanently delete"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Sessions Tab */}
          {activeTab === "sessions" && (
            archivedSessions.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h18v5H3zM3 8h18v13H3z" /><path d="M9 12h6" />
                  </svg>
                </div>
                <p className="empty-title">No Archived Sessions</p>
                <p className="empty-desc">Archived monitoring sessions will appear here</p>
              </div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Session Date</th>
                      <th>Platforms</th>
                      <th>Companies</th>
                      <th>Archived Date</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedSessions.map((session, idx) => {
                      const sessionDateStr = new Date(session.sessionDate + "T00:00:00").toLocaleDateString("en-MY", {
                        day: "2-digit", month: "short", year: "numeric"
                      });
                      const uniquePlats = Array.from(new Set(session.posts.map(p => p.platformName)));
                      return (
                        <motion.tr
                          key={session.sessionID}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                        >
                          <td style={{ fontWeight: 600 }}>{sessionDateStr}</td>
                          <td>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {uniquePlats.map(pl => (
                                <span key={pl} className="badge badge-neutral" style={{ fontSize: 10 }}>{pl}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                            {session.companies?.map(c => c.companyName).join(", ") || "—"}
                          </td>
                          <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                            {(session as any).archivedAt
                              ? new Date((session as any).archivedAt).toLocaleString('en-MY', {
                                  year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                })
                              : "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button
                                onClick={() => handleRestoreSession(session.sessionID, sessionDateStr)}
                                className="btn btn-success-outline btn-sm"
                                style={{ display: "flex", alignItems: "center", gap: 4 }}
                                title="Restore session"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                  <path d="M21 3v5h-5" />
                                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                  <path d="M3 21v-5h5" />
                                </svg>
                                Restore
                              </button>
                              <button
                                onClick={() => handleDeleteSessionPermanently(session.sessionID, sessionDateStr)}
                                className="btn btn-sm"
                                style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1.5px solid var(--red)", color: "var(--red)" }}
                                title="Permanently delete"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} })}
        isLoading={confirmDialog.isLoading}
        confirmLabel={confirmDialog.confirmLabel}
        danger={confirmDialog.danger}
      />
      </div>
    </Layout>
  );
}
