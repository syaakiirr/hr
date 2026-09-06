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

  // Side-by-side comparison state
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<{ snapA: any; snapB: any } | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);

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

  const toggleCompareSelect = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id]; // keep last and new
      }
      return [...prev, id];
    });
  };

  async function handleOpenCompare() {
    if (selectedForCompare.length !== 2) return;
    setLoadingCompare(true);
    setShowCompareModal(true);
    try {
      const [snapA, snapB] = await Promise.all([
        getSnapshot(selectedForCompare[0]),
        getSnapshot(selectedForCompare[1]),
      ]);
      setCompareData({ snapA, snapB });
    } catch (error) {
      console.error("Failed to load snapshots for comparison:", error);
      alert("Failed to load snapshots for comparison");
      setShowCompareModal(false);
    } finally {
      setLoadingCompare(false);
    }
  }

  async function handleDeleteSnapshot(id: string, name: string) {
    if (!confirm(`Delete snapshot "${name}"? This action cannot be undone.`)) return;

    try {
      await deleteSnapshot(id);
      alert("Snapshot deleted successfully");
      setSnapshots((prev) => prev.filter((s) => s.snapshotID !== id));
      setSelectedForCompare((prev) => prev.filter((item) => item !== id));
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
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Dashboard Snapshots
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              Historical dashboard states saved for audit and reporting
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {selectedForCompare.length === 2 && (
              <button
                onClick={handleOpenCompare}
                className="btn btn-primary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
                <span>Compare (2)</span>
              </button>
            )}

            <button
              onClick={async () => {
                const { downloadPageAsPDF } = await import("../utils/pdf");
                downloadPageAsPDF("Snapshots");
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Dashboard</span>
            </button>
          </div>
        </div>

        {/* Comparison selection helper bar */}
        {snapshots.length >= 2 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 16px",
              borderRadius: "var(--r-md)",
              background: "var(--white)",
              marginBottom: 20,
              border: "1px solid var(--line)",
              fontSize: "0.82rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "var(--text-1)" }}>Comparison Mode:</span>
              <span style={{ color: "var(--text-3)" }}>
                {selectedForCompare.length === 0 && "Select any 2 snapshot checkboxes to compare deltas"}
                {selectedForCompare.length === 1 && "1 selected — select 1 more to compare"}
                {selectedForCompare.length === 2 && "2 selected — ready to compare"}
              </span>
            </div>
            {selectedForCompare.length > 0 && (
              <button
                onClick={() => setSelectedForCompare([])}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.76rem", padding: "3px 8px", height: "auto", color: "var(--text-3)" }}
              >
                Clear selection
              </button>
            )}
          </div>
        )}

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
          {snapshots.map((snapshot) => {
            const isSelected = selectedForCompare.includes(snapshot.snapshotID);
            return (
              <div
                key={snapshot.snapshotID}
                className="card"
                style={{
                  cursor: 'pointer',
                  border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                  background: isSelected ? "var(--surface-2)" : "var(--white)"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-1)', overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {snapshot.snapshotName}
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                  {/* Compare checkbox */}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: isSelected ? "var(--accent)" : "var(--text-4)",
                      padding: "3px 6px", borderRadius: 4, background: isSelected ? "var(--accent-soft)" : "transparent"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCompareSelect(snapshot.snapshotID)}
                      style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                    />
                    Compare
                  </label>
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
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View Details
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(snapshot.snapshotID, snapshot.snapshotName); }}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--red)' }}
                    title="Delete snapshot"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
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
                          <p className="kpi-value">{Math.round(selectedSnapshot.data.kpi.completionRate)}%</p>
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
                                    <span className="badge badge-green">{Math.round(rate)}%</span>
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

      {/* Snapshot Comparison Modal (Side-by-Side) */}
      <AnimatePresence>
        {showCompareModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowCompareModal(false)}
            style={{ padding: 20, overflow: 'auto' }}
          >
            <motion.div
              className="modal-box"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 960, width: '100%' }}
            >
              <div className="modal-head">
                <div>
                  <h2 className="modal-title">Snapshot Comparison</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    Side-by-side historical delta analysis between two saved states
                  </p>
                </div>
                <button onClick={() => setShowCompareModal(false)} className="btn btn-ghost btn-icon btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {loadingCompare ? (
                <div className="loader" style={{ padding: 40 }}><div className="spin" />Calculating snapshot differences...</div>
              ) : compareData?.snapA?.data && compareData?.snapB?.data ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Header info comparison */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="badge badge-accent" style={{ fontSize: 10 }}>Snapshot A (Baseline)</span>
                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {new Date(compareData.snapA.snapshotDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{compareData.snapA.snapshotName}</h4>
                      {compareData.snapA.notes && <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>"{compareData.snapA.notes}"</p>}
                    </div>

                    <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="badge badge-blue" style={{ fontSize: 10 }}>Snapshot B (Comparison)</span>
                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {new Date(compareData.snapB.snapshotDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{compareData.snapB.snapshotName}</h4>
                      {compareData.snapB.notes && <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>"{compareData.snapB.notes}"</p>}
                    </div>
                  </div>

                  {/* KPI Delta Table */}
                  {compareData.snapA.data.kpi && compareData.snapB.data.kpi && (
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-2)' }}>Key Metrics Comparison</h4>
                      <div className="tbl-wrap">
                        <table className="tbl">
                          <thead>
                            <tr>
                              <th>Metric</th>
                              <th style={{ textAlign: 'center' }}>Snapshot A</th>
                              <th style={{ textAlign: 'center' }}>Snapshot B</th>
                              <th style={{ textAlign: 'center' }}>Difference (B - A)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: 'Active Staff', a: compareData.snapA.data.kpi.totalStaff, b: compareData.snapB.data.kpi.totalStaff, isRate: false },
                              { label: 'Tracked Sessions', a: compareData.snapA.data.kpi.totalSessions, b: compareData.snapB.data.kpi.totalSessions, isRate: false },
                              { label: 'Expected Actions', a: compareData.snapA.data.kpi.totalExpected || 0, b: compareData.snapB.data.kpi.totalExpected || 0, isRate: false },
                              { label: 'Completed Actions', a: compareData.snapA.data.kpi.totalCompleted, b: compareData.snapB.data.kpi.totalCompleted, isRate: false },
                              { label: 'Missed Actions', a: compareData.snapA.data.kpi.totalMissed, b: compareData.snapB.data.kpi.totalMissed, isRate: false, invertColor: true },
                              { label: 'Compliance Rate', a: Math.round(compareData.snapA.data.kpi.completionRate), b: Math.round(compareData.snapB.data.kpi.completionRate), isRate: true },
                            ].map((row) => {
                              const diff = row.b - row.a;
                              const isPositive = diff > 0;
                              const isZero = diff === 0;
                              let badgeClass = "badge-neutral";
                              if (!isZero) {
                                if (row.invertColor) {
                                  badgeClass = isPositive ? "badge-red" : "badge-green";
                                } else {
                                  badgeClass = isPositive ? "badge-green" : "badge-red";
                                }
                              }
                              return (
                                <tr key={row.label}>
                                  <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{row.label}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.a}{row.isRate ? '%' : ''}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.b}{row.isRate ? '%' : ''}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className={`badge ${badgeClass}`} style={{ fontWeight: 800 }}>
                                      {isPositive ? `+${diff}` : `${diff}`}{row.isRate ? '%' : ''}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button onClick={() => setShowCompareModal(false)} className="btn btn-secondary btn-sm">
                      Close Comparison
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <p style={{ color: 'var(--amber)', fontWeight: 600 }}>Unable to compare selected snapshots</p>
                  <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>One or both snapshots may contain incomplete analytics data.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </Layout>
  );
}
