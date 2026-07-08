import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { getArchivedStaff, getArchivedSessions, restoreStaff, restoreSession, type Staff, type MonitoringSession } from "../services/api";

export default function ArchivedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"staff" | "sessions">(
    location.state?.tab === "sessions" ? "sessions" : "staff"
  );
  const [archivedStaff, setArchivedStaff] = useState<Staff[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<MonitoringSession[]>([]);
  const [loading, setLoading] = useState(true);

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
      alert("Failed to load archived items");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreStaff(staffId: string, name: string) {
    if (!confirm(`Restore ${name}? This will set them back to Active status.`)) return;

    try {
      await restoreStaff(staffId);
      alert("Staff restored successfully");
      loadArchived();
    } catch (error) {
      console.error("Failed to restore staff:", error);
      alert("Failed to restore staff");
    }
  }

  async function handleRestoreSession(sessionId: string, date: string) {
    if (!confirm(`Restore session from ${date}?`)) return;

    try {
      await restoreSession(sessionId);
      alert("Session restored successfully");
      loadArchived();
    } catch (error) {
      console.error("Failed to restore session:", error);
      alert("Failed to restore session");
    }
  }

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="page-hd">
          <div>
            <h1 className="page-title">Archived Items</h1>
            <p className="page-sub">View and restore archived staff and monitoring sessions</p>
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
          className={activeTab === "staff" ? "tab active" : "tab"}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "staff" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "staff" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          Staff ({archivedStaff.length})
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={activeTab === "sessions" ? "tab active" : "tab"}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "sessions" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "sessions" ? "var(--accent)" : "var(--text-3)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.2s",
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
                    <path d="M3 3h18v5H3zM3 8h18v13H3z" />
                    <path d="M9 12h6" />
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
                      <th>Archived By</th>
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
                          {(staff as any).archivedBy || "—"}
                        </td>
                        <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                          {(staff as any).archivedAt 
                            ? new Date((staff as any).archivedAt).toLocaleString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => handleRestoreStaff(staff.staffID, staff.fullName)}
                            className="btn btn-success-outline btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: 4, margin: "0 auto" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                              <path d="M21 3v5h-5" />
                              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                              <path d="M3 21v-5h5" />
                            </svg>
                            Restore
                          </button>
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
                    <path d="M3 3h18v5H3zM3 8h18v13H3z" />
                    <path d="M9 12h6" />
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
                      <th>Created At</th>
                      <th>Archived By</th>
                      <th>Archived Date</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedSessions.map((session, idx) => (
                      <motion.tr
                        key={session.sessionID}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.03 }}
                      >
                        <td style={{ fontWeight: 600 }}>
                          {new Date(session.sessionDate).toLocaleDateString("en-US", { 
                            day: "2-digit", 
                            month: "short", 
                            year: "numeric" 
                          })}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {session.posts.map((p) => (
                              <span key={p.postID} className="badge badge-neutral" style={{ fontSize: 10 }}>
                                {p.platformName}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                          {new Date(session.createdAt).toLocaleDateString("en-US", { 
                            month: "short", 
                            day: "2-digit" 
                          })}
                        </td>
                        <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                          {(session as any).archivedBy || "—"}
                        </td>
                        <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                          {(session as any).archivedAt 
                            ? new Date((session as any).archivedAt).toLocaleString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => handleRestoreSession(
                              session.sessionID, 
                              new Date(session.sessionDate).toLocaleDateString()
                            )}
                            className="btn btn-success-outline btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: 4, margin: "0 auto" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                              <path d="M21 3v5h-5" />
                              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                              <path d="M3 21v-5h5" />
                            </svg>
                            Restore
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </Layout>
  );
}
