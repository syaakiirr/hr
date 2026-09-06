import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { compareSessions, getSessions, type SessionComparisonResult, type MonitoringSession } from "../services/api";

interface SessionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SessionComparisonModal({ isOpen, onClose }: SessionComparisonModalProps) {
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [sessionAId, setSessionAId] = useState<string>("");
  const [sessionBId, setSessionBId] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<SessionComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function loadSessions() {
      setError(null);
      try {
        const data = await getSessions();
        const sorted = (data || []).sort((a: MonitoringSession, b: MonitoringSession) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
        setSessions(sorted);
        if (sorted.length >= 2) {
          setSessionAId(sorted[1].sessionID);
          setSessionBId(sorted[0].sessionID);
        } else if (sorted.length === 1) {
          setSessionAId(sorted[0].sessionID);
          setSessionBId(sorted[0].sessionID);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load sessions");
      }
    }
    loadSessions();
  }, [isOpen]);

  useEffect(() => {
    if (!sessionAId || !sessionBId || sessionAId === sessionBId) {
      if (sessionAId && sessionBId && sessionAId === sessionBId) {
        setError("Please select two different sessions to compare.");
      }
      return;
    }
    async function runComparison() {
      setComparing(true);
      setError(null);
      try {
        const data = await compareSessions(sessionAId, sessionBId);
        setResult(data);
      } catch (err: any) {
        setError(err.message || "Failed to compare sessions");
      } finally {
        setComparing(false);
      }
    }
    runComparison();
  }, [sessionAId, sessionBId]);

  if (!isOpen) return null;

  const a = result?.sessionA;
  const b = result?.sessionB;

  const rateDelta = a && b ? Math.round((b.rate - a.rate) * 10) / 10 : 0;
  const completedDelta = a && b ? b.completed - a.completed : 0;
  const likesDelta = a && b ? b.likes - a.likes : 0;
  const commentsDelta = a && b ? b.comments - a.comments : 0;
  const sharesDelta = a && b ? b.shares - a.shares : 0;

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          style={{
            background: "var(--white)",
            borderRadius: "var(--r-xl)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-lg)",
            width: "100%",
            maxWidth: 880,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-1)" }}>
                  Session Side-by-Side Comparison
                </h3>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
                  Compare engagement metrics and department completion rates between two sessions
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: 6, borderRadius: "50%", height: 32, width: 32 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Selectors Bar */}
          <div
            style={{
              padding: "14px 20px",
              background: "var(--white)",
              borderBottom: "1px solid var(--line)",
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase" }}>
                Base Session (Session A)
              </label>
              <select
                value={sessionAId}
                onChange={(e) => setSessionAId(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line-2)",
                  background: "var(--surface)",
                  color: "var(--text-1)",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                }}
              >
                {sessions.map((s) => (
                  <option key={s.sessionID} value={s.sessionID}>
                    {new Date(s.sessionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "6px 12px",
                borderRadius: 20,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              VS
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase" }}>
                Target Session (Session B)
              </label>
              <select
                value={sessionBId}
                onChange={(e) => setSessionBId(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line-2)",
                  background: "var(--surface)",
                  color: "var(--text-1)",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                }}
              >
                {sessions.map((s) => (
                  <option key={s.sessionID} value={s.sessionID}>
                    {new Date(s.sessionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Body Content */}
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--r-md)",
                  background: "var(--red-soft)",
                  border: "1px solid var(--red-line)",
                  color: "var(--red)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {error}
              </div>
            )}

            {comparing ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)" }}>
                <div className="spin" style={{ margin: "0 auto 10px" }} />
                <p>Computing comparison analytics...</p>
              </div>
            ) : a && b ? (
              <>
                {/* KPI Comparison Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {/* Completion Rate Card */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: "var(--r-lg)",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", fontWeight: 500 }}>
                      Completion Rate
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 16, color: "var(--text-2)" }}>{a.rate}%</span>
                      <span style={{ fontSize: 12, color: "var(--text-4)" }}>➔</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>{b.rate}%</span>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: rateDelta >= 0 ? "var(--green-soft)" : "var(--red-soft)",
                        color: rateDelta >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {rateDelta >= 0 ? `▲ +${rateDelta}%` : `▼ ${rateDelta}%`}
                    </div>
                  </div>

                  {/* Completed Ticks */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: "var(--r-lg)",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", fontWeight: 500 }}>
                      Completed Ticks
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 16, color: "var(--text-2)" }}>{a.completed}</span>
                      <span style={{ fontSize: 12, color: "var(--text-4)" }}>➔</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>{b.completed}</span>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: completedDelta >= 0 ? "var(--green-soft)" : "var(--red-soft)",
                        color: completedDelta >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {completedDelta >= 0 ? `▲ +${completedDelta}` : `▼ ${completedDelta}`}
                    </div>
                  </div>

                  {/* Likes / Comments / Shares */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: "var(--r-lg)",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", fontWeight: 500 }}>
                      Engagement Actions
                    </p>
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--blue)" }}>Likes:</span>
                        <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{a.likes} ➔ {b.likes} ({likesDelta >= 0 ? `+${likesDelta}` : likesDelta})</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--accent)" }}>Comments:</span>
                        <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{a.comments} ➔ {b.comments} ({commentsDelta >= 0 ? `+${commentsDelta}` : commentsDelta})</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--green)" }}>Shares:</span>
                        <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{a.shares} ➔ {b.shares} ({sharesDelta >= 0 ? `+${sharesDelta}` : sharesDelta})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Department Comparison Table */}
                <div
                  style={{
                    background: "var(--white)",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--line)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "10px 14px", background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Department Performance Comparison</h4>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="table" style={{ width: "100%", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th style={{ textAlign: "center" }}>Session A Rate</th>
                          <th style={{ textAlign: "center" }}>Session B Rate</th>
                          <th style={{ textAlign: "center" }}>Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.departments.map((deptB) => {
                          const deptA = a.departments.find((d) => d.department === deptB.department);
                          const rateA = deptA ? deptA.rate : 0;
                          const dDelta = Math.round((deptB.rate - rateA) * 10) / 10;
                          return (
                            <tr key={deptB.department}>
                              <td style={{ fontWeight: 600, color: "var(--text-1)" }}>{deptB.department}</td>
                              <td style={{ textAlign: "center" }}>{rateA}%</td>
                              <td style={{ textAlign: "center", fontWeight: 700, color: "var(--text-1)" }}>{deptB.rate}%</td>
                              <td style={{ textAlign: "center" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: dDelta >= 0 ? "var(--green-soft)" : "var(--red-soft)",
                                    color: dDelta >= 0 ? "var(--green)" : "var(--red)",
                                  }}
                                >
                                  {dDelta >= 0 ? `+${dDelta}%` : `${dDelta}%`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--line)",
              background: "var(--surface)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
