import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import { getSnapshots, getSnapshot, deleteSnapshot, type DashboardSnapshot } from "../services/api";

export default function SnapshotsPage() {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<DashboardSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadSnapshots();
  }, []);

  async function loadSnapshots() {
    try {
      const data = await getSnapshots();
      setSnapshots(data);
    } catch (error) {
      console.error("Failed to load snapshots:", error);
      alert("Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  }

  async function handleViewSnapshot(id: string) {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const data = await getSnapshot(id);
      setSelectedSnapshot(data);
    } catch (error) {
      console.error("Failed to load snapshot:", error);
      alert("Failed to load snapshot details");
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDeleteSnapshot(id: string, name: string) {
    if (!confirm(`Delete snapshot "${name}"? This action cannot be undone.`)) return;

    try {
      await deleteSnapshot(id);
      alert("Snapshot deleted successfully");
      setSnapshots((prev) => prev.filter((s) => s.snapshotID !== id));
      if (selectedSnapshot?.snapshotID === id) {
        setShowDetailModal(false);
        setSelectedSnapshot(null);
      }
    } catch (error) {
      console.error("Failed to delete snapshot:", error);
      alert("Failed to delete snapshot");
    }
  }

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <div className="page-hd">
          <div>
            <h1 className="page-title">Dashboard Snapshots</h1>
            <p className="page-sub">Historical dashboard states saved for comparison and reporting</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 6 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="loader"><div className="spin" />Loading snapshots...</div>
      ) : snapshots.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
          <p className="empty-title">No Snapshots Yet</p>
          <p className="empty-desc">Save your first dashboard snapshot to keep historical records for comparison</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ marginTop: 16 }}>
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.snapshotID}
              className="card"
              style={{ cursor: 'pointer' }}
            >
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text-1)' }}>
                  {snapshot.snapshotName}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {new Date(snapshot.snapshotDate).toLocaleString('en-MY', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>

              {snapshot.notes && (
                <p style={{ 
                  fontSize: 12, 
                  color: 'var(--text-4)', 
                  marginBottom: 16,
                  padding: 8,
                  background: 'var(--surface-2)',
                  borderRadius: 6,
                  fontStyle: 'italic'
                }}>
                  "{snapshot.notes}"
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => handleViewSnapshot(snapshot.snapshotID)}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(snapshot.snapshotID, snapshot.snapshotName); }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--red)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Snapshot Detail Modal */}
      <AnimatePresence>
        {showDetailModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowDetailModal(false)}
            style={{ padding: 20, overflow: 'auto' }}
          >
            <motion.div
              className="modal-box"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 900, width: '100%' }}
            >
              <div className="modal-head">
                <div>
                  <h2 className="modal-title">{selectedSnapshot?.snapshotName}</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    Captured on {selectedSnapshot?.snapshotDate && new Date(selectedSnapshot.snapshotDate).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="btn btn-ghost btn-icon btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {loadingDetail ? (
                <div className="loader" style={{ padding: 40 }}><div className="spin" />Loading snapshot data...</div>
              ) : selectedSnapshot?.data ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {selectedSnapshot.notes && (
                    <div style={{ 
                      padding: 12, 
                      background: 'var(--accent-soft)', 
                      borderRadius: 8,
                      fontSize: 13,
                      color: 'var(--text-2)',
                      fontStyle: 'italic'
                    }}>
                      <strong>Notes:</strong> {selectedSnapshot.notes}
                    </div>
                  )}

                  {/* KPI Summary */}
                  {selectedSnapshot.data.kpi && (
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-2)' }}>
                        KPI Summary
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <div className="kpi kpi-indigo">
                          <p className="kpi-label">Total Staff</p>
                          <p className="kpi-value">{selectedSnapshot.data.kpi.totalStaff}</p>
                        </div>
                        <div className="kpi kpi-violet">
                          <p className="kpi-label">Sessions</p>
                          <p className="kpi-value">{selectedSnapshot.data.kpi.totalSessions}</p>
                        </div>
                        <div className="kpi kpi-green">
                          <p className="kpi-label">Completed</p>
                          <p className="kpi-value">{selectedSnapshot.data.kpi.totalCompleted}</p>
                        </div>
                        <div className="kpi kpi-red">
                          <p className="kpi-label">Missed</p>
                          <p className="kpi-value">{selectedSnapshot.data.kpi.totalMissed}</p>
                        </div>
                        <div className="kpi kpi-blue">
                          <p className="kpi-label">Completion Rate</p>
                          <p className="kpi-value">{selectedSnapshot.data.kpi.completionRate}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Staff */}
                  {selectedSnapshot.data.topStaff && selectedSnapshot.data.topStaff.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-2)' }}>
                        Top Performing Staff
                      </h4>
                      <div className="tbl-wrap">
                        <table className="tbl">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Name</th>
                              <th>Department</th>
                              <th style={{ textAlign: 'center' }}>Completed</th>
                              <th style={{ textAlign: 'center' }}>Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSnapshot.data.topStaff.slice(0, 5).map((staff: any, idx: number) => {
                              const name = staff.fullName || staff.FullName || "—";
                              const dept = staff.department || staff.Department || "—";
                              const completedCount = staff.completed !== undefined ? staff.completed : (staff.Completed !== undefined ? staff.Completed : 0);
                              const totalCount = staff.total !== undefined ? staff.total : (staff.Total !== undefined ? staff.Total : 0);
                              const rate = staff.completionRate !== undefined ? staff.completionRate : (staff.CompletionRate !== undefined ? staff.CompletionRate : 0);
                              const staffId = staff.staffID || staff.StaffID || idx;
                              
                              return (
                                <tr key={staffId}>
                                  <td>{idx + 1}</td>
                                  <td style={{ fontWeight: 600 }}>{name}</td>
                                  <td><span className="badge badge-neutral">{dept}</span></td>
                                  <td style={{ textAlign: 'center' }}>{completedCount}/{totalCount}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className="badge badge-green">{rate}%</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'center', marginTop: 8 }}>
                    This is a historical snapshot. Data reflects the dashboard state at capture time.
                  </p>
                </div>
              ) : selectedSnapshot && !selectedSnapshot.data ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <p style={{ color: 'var(--amber)', marginBottom: 8, fontWeight: 600 }}>⚠️ Snapshot data format not recognized</p>
                                    <p style={{ fontSize: 12, color: 'var(--text-4)' }}>This snapshot may have been saved with an older version. Try creating a new snapshot.</p>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-4)', padding: 32 }}>No data available</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
