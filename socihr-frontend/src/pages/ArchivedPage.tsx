import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import ConfirmationDialog from "../components/ConfirmationDialog";
import { getArchivedStaff, getArchivedSessions, restoreStaff, restoreSession, deleteStaff, deleteSession, type Staff, type MonitoringSession } from "../services/api";

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
      title: "Restore Staff",
      message: `Restore ${name}? Status will be set back to Active.`,
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
      title: "⚠️ Permanently Delete — Staff",
      message: `Permanently delete ${name}? All of their engagement data will also be deleted. This action CANNOT be undone.`,
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
      message: `Restore session ${date}? The session will reappear on the Monitoring page.`,
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
      title: "⚠️ Permanently Delete — Session",
      message: `Permanently delete session ${date}? All engagements and audit trail entries will also be deleted. This action CANNOT be undone.`,
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
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="page-hd">
          <div>
            <h1 className="page-title">Archived Items</h1>
            <p className="page-sub">View, restore or permanently delete archived staff and monitoring sessions</p>
          </div>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 6 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        <button
          onClick={() => setActiveTab("staff")}
          style={{
            padding: "10px 20px", background: "none", border: "none",
            borderBottom: activeTab === "staff" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "staff" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s",
          }}
        >
          Staff ({archivedStaff.length})
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          style={{
            padding: "10px 20px", background: "none", border: "none",
            borderBottom: activeTab === "sessions" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "sessions" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s",
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
    </Layout>
  );
}
