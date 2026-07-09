import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  getSessions, getPlatforms, getCompanies, createSession, deleteSession, archiveSession,
  getEngagements, updateEngagementStatus, bulkUpdateEngagementStatus,
  type MonitoringSession, type Platform, type Engagement, type Company
} from "../services/api";

const CREATE_PLATFORMS = ["Instagram", "Facebook", "TikTok"];
const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#e1306c", Facebook: "#1877f2", TikTok: "#374151", LinkedIn: "#0a66c2"
};

const COMPANY_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];

// Parse DateOnly string (YYYY-MM-DD) without timezone shift
function parseDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function StatusSymbol({ status }: { status: string }) {
  if (status === "Completed") return <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>;
  return <span style={{ color: "var(--red)", fontWeight: 700 }}>✗</span>;
}

function nextStatus(current: string): string {
  return current === "Completed" ? "Missed" : "Completed";
}

export default function MonitoringPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSession, setSelectedSession] = useState<MonitoringSession | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loadingEng, setLoadingEng] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk selection state
  const [selectedEngagements, setSelectedEngagements] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Create session wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getSessions(), getPlatforms(), getCompanies()])
      .then(([s, p, c]) => { setSessions(s); setPlatforms(p); setCompanies(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openCreateModal() {
    setWizardStep(1);
    setSessionDate(new Date().toISOString().split("T")[0]);
    // Default: select ALL companies
    setSelectedCompanies(new Set(companies.map((c) => c.companyID)));
    setSelectedPlatforms(new Set());
    setShowCreate(true);
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const posts = platforms
        .filter((p) => selectedPlatforms.has(p.platformID))
        .map((p) => ({ platformID: p.platformID, postLink: "" }));

      if (posts.length === 0) { alert("Please select at least one platform."); return; }
      if (selectedCompanies.size === 0) { alert("Please select at least one company."); return; }

      await createSession({
        sessionDate,
        posts,
        companyIDs: Array.from(selectedCompanies),
      });
      setShowCreate(false);
      setSelectedPlatforms(new Set());
      setSelectedCompanies(new Set());
      const updated = await getSessions();
      setSessions(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectSession(session: MonitoringSession) {
    setSelectedSession(session);
    setSelectedEngagements(new Set());
    setLoadingEng(true);
    try {
      const eng = await getEngagements(session.sessionID);
      setEngagements(eng);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEng(false);
    }
  }

  async function handleTick(eng: Engagement) {
    const newStatus = nextStatus(eng.status);
    setEngagements((prev) => prev.map((e) => e.engagementID === eng.engagementID ? { ...e, status: newStatus } : e));
    try {
      await updateEngagementStatus(eng.engagementID, newStatus);
    } catch (err) {
      setEngagements((prev) => prev.map((e) => e.engagementID === eng.engagementID ? { ...e, status: eng.status } : e));
      console.error(err);
    }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.sessionID !== id));
      if (selectedSession?.sessionID === id) {
        setSelectedSession(null);
        setSelectedEngagements(new Set());
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  async function handleArchiveSession(id: string) {
    if (!confirm("Archive this session? This can be restored later from the Archive page.")) return;
    try {
      await archiveSession(id);
      alert("Session archived successfully");
      setSessions((prev) => prev.filter((s) => s.sessionID !== id));
      if (selectedSession?.sessionID === id) {
        setSelectedSession(null);
        setSelectedEngagements(new Set());
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  function toggleSelectAll() {
    if (selectedEngagements.size === engagements.length) {
      setSelectedEngagements(new Set());
    } else {
      setSelectedEngagements(new Set(engagements.map((e) => e.engagementID)));
    }
  }

  function toggleSelectEngagement(engagementID: string) {
    setSelectedEngagements((prev) => {
      const next = new Set(prev);
      if (next.has(engagementID)) {
        next.delete(engagementID);
      } else {
        next.add(engagementID);
      }
      return next;
    });
  }

  async function handleBulkUpdate(status: string) {
    if (selectedEngagements.size === 0) {
      alert("Please select at least one engagement.");
      return;
    }
    if (!confirm(`Update ${selectedEngagements.size} engagement(s) to "${status}"?`)) return;
    setBulkUpdating(true);
    try {
      const engagementIDs = Array.from(selectedEngagements);
      await bulkUpdateEngagementStatus(engagementIDs, status);
      setEngagements((prev) =>
        prev.map((e) => selectedEngagements.has(e.engagementID) ? { ...e, status } : e)
      );
      setSelectedEngagements(new Set());
      alert(`Successfully updated ${engagementIDs.length} engagement(s)!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update engagements. Please try again.");
    } finally {
      setBulkUpdating(false);
    }
  }

  // Group engagements by staff
  const staffMap = new Map<string, { staffID: string; staffName: string; department: string; engagements: Engagement[] }>();
  engagements.forEach((eng) => {
    if (!staffMap.has(eng.staffID)) {
      staffMap.set(eng.staffID, {
        staffID: eng.staffID,
        staffName: eng.staffName,
        department: eng.department,
        engagements: []
      });
    }
    staffMap.get(eng.staffID)!.engagements.push(eng);
  });
  const staffRows = Array.from(staffMap.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));

  const sessionPosts = selectedSession?.posts.map((p) => ({
    postID: p.postID,
    platformID: p.platformID,
    platformName: p.platformName,
    companyID: p.companyID,
    companyName: p.companyName || "No Company",
    postLink: p.postLink,
  })) ?? [];

  // ── Wizard step label helper ──
  const stepLabels = ["Date", "Company", "Platform"];

  return (
    <Layout>
      <div>
        <div className="page-hd">
          <div>
            <h1 className="page-title">Monitoring Sessions</h1>
            <p className="page-sub font-size-13">Manage and verify staff engagement for each platform post</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate('/archived', { state: { tab: 'sessions' } })}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3h18v5H3zM3 8h18v13H3z" />
                <path d="M9 12h6" />
              </svg>
              View Archived
            </button>
            <button id="create-session-btn" onClick={openCreateModal} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Session
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        {/* Sessions list panel */}
        <div>
          <p className="section-label" style={{ paddingLeft: 0 }}>All Sessions ({sessions.length})</p>
          {loading ? (
            <div className="loader"><div className="spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "30px 16px" }}>
              <p style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 500 }}>No session records found</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sessions.map((s) => {
                const isSelected = selectedSession?.sessionID === s.sessionID;
                return (
                <div
                  key={s.sessionID}
                  onClick={() => handleSelectSession(s)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 12px", borderRadius: 8,
                    background: isSelected ? "#eef2ff" : "#ffffff",
                    border: `1.5px solid ${isSelected ? "#4f46e5" : "#e2e8f0"}`,
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, background 0.15s ease",
                    boxShadow: isSelected ? "0 1px 4px rgba(79,70,229,0.12)" : "0 1px 2px rgba(15,23,42,0.04)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                      {parseDateOnly(s.sessionDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {/* Show companies */}
                    {s.companies && s.companies.length > 0 && (
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                        {s.companies.map((c, ci) => (
                          <span key={c.companyID} style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 3,
                            background: `${COMPANY_COLORS[ci % COMPANY_COLORS.length]}18`,
                            color: COMPANY_COLORS[ci % COMPANY_COLORS.length],
                            border: `1px solid ${COMPANY_COLORS[ci % COMPANY_COLORS.length]}40`,
                            fontWeight: 700,
                          }}>
                            {c.companyName}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Show platforms */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                      {s.posts.map((p) => (
                        <span key={p.postID} style={{
                          fontSize: 11, padding: "2px 7px", borderRadius: 4,
                          background: "#f1f5f9", color: "#334155",
                          border: "1px solid #cbd5e1", fontWeight: 600,
                          letterSpacing: "0.01em",
                        }}>
                          {p.platformName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchiveSession(s.sessionID); }}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: "var(--text-3)", opacity: 0.65 }}
                      title="Archive session"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.sessionID); }}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: "var(--red)", opacity: 0.6 }}
                      title="Delete session"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Matrix engagement panel */}
        <div>
          {!selectedSession ? (
            <div className="empty" style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)" }}>
              <div className="empty-ico">📅</div>
              <p className="empty-title">Select Session</p>
              <p className="empty-desc">Click any session from the left panel to begin managing staff engagement.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
                    Engagement Matrix: {parseDateOnly(selectedSession.sessionDate).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    {selectedEngagements.size > 0
                      ? `${selectedEngagements.size} selected — Use bulk actions below`
                      : "Click checkbox to select, or click tick button ( ✗ Missed ↔ ✓ Completed )"}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <span className="badge badge-green">✓ Completed: {engagements.filter((e) => e.status === "Completed").length}</span>
                  <span className="badge badge-red">✗ Missed: {engagements.filter((e) => e.status === "Missed").length}</span>
                </div>
              </div>

              {/* Bulk Action Bar */}
              {selectedEngagements.size > 0 && (
                <div style={{
                  marginBottom: 16, padding: 16,
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(214, 41, 118, 0.08) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: "var(--accent)", color: "white", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                      {selectedEngagements.size}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Bulk Actions</p>
                      <p style={{ fontSize: 11, color: "var(--text-3)" }}>{selectedEngagements.size} engagement{selectedEngagements.size > 1 ? 's' : ''} selected</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => handleBulkUpdate("Completed")} disabled={bulkUpdating} className="btn btn-sm" style={{ background: "var(--green)", color: "white", border: "none" }}>✓ Mark Completed</button>
                    <button onClick={() => handleBulkUpdate("Missed")} disabled={bulkUpdating} className="btn btn-sm" style={{ background: "var(--red)", color: "white", border: "none" }}>✗ Mark Missed</button>
                    <button onClick={() => setSelectedEngagements(new Set())} disabled={bulkUpdating} className="btn btn-sm btn-ghost" style={{ color: "var(--text-3)" }}>Clear Selection</button>
                  </div>
                </div>
              )}

              {loadingEng ? (
                <div className="loader"><div className="spin" />Loading engagement data...</div>
              ) : staffRows.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 32 }}>
                  <p style={{ color: "var(--text-3)" }}>No registered staff found.</p>
                </div>
              ) : (
                <div className="tbl-wrap" style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: "center" }}>
                          <input type="checkbox" checked={selectedEngagements.size === engagements.length && engagements.length > 0} onChange={toggleSelectAll} style={{ cursor: "pointer", width: 16, height: 16 }} title="Select all" />
                        </th>
                        <th style={{ width: 50 }}>#</th>
                        <th>Staff Name</th>
                        <th>Department</th>
                        {sessionPosts.map((p) => {
                          const compIdx = companies.findIndex(c => c.companyID === p.companyID);
                          const compColor = compIdx >= 0 ? COMPANY_COLORS[compIdx % COMPANY_COLORS.length] : "var(--text-3)";
                          return (
                            <th key={p.postID} style={{ textAlign: "center", width: 140, padding: "8px 10px" }}>
                              <span style={{
                                display: "block", fontSize: 9, fontWeight: 700,
                                color: compColor, textTransform: "uppercase", letterSpacing: "0.03em",
                                marginBottom: 2
                              }}>
                                {p.companyName}
                              </span>
                              <span style={{ color: PLATFORM_COLORS[p.platformName] || "var(--accent)", fontSize: 11.5 }}>
                                {p.platformName}
                              </span>
                            </th>
                          );
                        })}
                        <th style={{ textAlign: "center", width: 80 }}>Total</th>
                        <th style={{ textAlign: "center", width: 80 }}>Rate %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffRows.map((row, idx) => {
                        const completed = row.engagements.filter((e) => e.status === "Completed").length;
                        const total = row.engagements.length;
                        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
                        const allRowSelected = row.engagements.every((e) => selectedEngagements.has(e.engagementID));

                        return (
                          <tr key={row.staffID}>
                            <td style={{ textAlign: "center" }}>
                              <input type="checkbox" checked={allRowSelected}
                                onChange={() => {
                                  const rowEngagementIds = row.engagements.map((e) => e.engagementID);
                                  setSelectedEngagements((prev) => {
                                    const next = new Set(prev);
                                    if (allRowSelected) { rowEngagementIds.forEach((id) => next.delete(id)); }
                                    else { rowEngagementIds.forEach((id) => next.add(id)); }
                                    return next;
                                  });
                                }}
                                style={{ cursor: "pointer", width: 16, height: 16 }} title="Select row"
                              />
                            </td>
                            <td style={{ color: "var(--text-4)" }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600, color: "var(--text-1)" }}>{row.staffName}</td>
                            <td><span className="badge badge-neutral">{row.department || "—"}</span></td>
                            {sessionPosts.map((p) => {
                              const eng = row.engagements.find((e) => e.postID === p.postID);
                              return (
                                <td key={p.postID} style={{ textAlign: "center" }}>
                                  {eng ? (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                      <input type="checkbox" checked={selectedEngagements.has(eng.engagementID)} onChange={() => toggleSelectEngagement(eng.engagementID)} style={{ cursor: "pointer", width: 14, height: 14 }} onClick={(e) => e.stopPropagation()} />
                                      <button onClick={() => handleTick(eng)} className={`tick ${eng.status === "Completed" ? "done" : "miss"}`}>
                                        <StatusSymbol status={eng.status} />
                                      </button>
                                    </div>
                                  ) : <span style={{ color: "var(--text-4)" }}>—</span>}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: "center", fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{completed}/{total}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`badge ${rate >= 75 ? "badge-green" : rate >= 50 ? "badge-amber" : "badge-red"}`}>{rate}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          3-STEP WIZARD MODAL: Create New Session
         ══════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <h2 className="modal-title">Create New Session</h2>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-icon btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Step Progress Indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24, padding: "0 4px" }}>
              {stepLabels.map((label, i) => {
                const stepNum = (i + 1) as 1 | 2 | 3;
                const isActive = wizardStep === stepNum;
                const isDone = wizardStep > stepNum;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 13, transition: "all 0.2s",
                        background: isDone ? "var(--green)" : isActive ? "var(--accent)" : "var(--surface-2)",
                        color: isDone || isActive ? "white" : "var(--text-3)",
                        border: `2px solid ${isDone ? "var(--green)" : isActive ? "var(--accent)" : "var(--line)"}`,
                      }}>
                        {isDone ? "✓" : stepNum}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? "var(--accent)" : isDone ? "var(--green)" : "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div style={{ flex: 1, height: 2, margin: "0 8px", marginBottom: 18, background: wizardStep > i + 1 ? "var(--green)" : "var(--line)", transition: "background 0.2s" }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── STEP 1: Date ── */}
            {wizardStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="input-label">Session Date</label>
                  <input
                    className="input"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    required
                    autoFocus
                  />
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, fontStyle: "italic" }}>
                    * Choose the date for this monitoring session.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    disabled={!sessionDate}
                    className="btn btn-primary"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    Next: Select Company
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Company ── */}
            {wizardStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                    Select Companies
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {companies.map((c, ci) => {
                      const checked = selectedCompanies.has(c.companyID);
                      const color = COMPANY_COLORS[ci % COMPANY_COLORS.length];
                      return (
                        <label
                          key={c.companyID}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                            border: `1.5px solid ${checked ? color : "var(--line)"}`,
                            background: checked ? `${color}12` : "var(--surface-2)",
                            transition: "all 0.15s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedCompanies((prev) => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(c.companyID) : next.delete(c.companyID);
                                return next;
                              });
                            }}
                            style={{ accentColor: color, width: 15, height: 15 }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: checked ? color : "var(--text-2)" }}>
                              {c.companyName}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", marginTop: 8 }}>
                    * {selectedCompanies.size} of {companies.length} companies selected. Only staff from selected companies will be included.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => setWizardStep(1)} className="btn btn-secondary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    disabled={selectedCompanies.size === 0}
                    className="btn btn-primary"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    Next: Select Platform
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Platform ── */}
            {wizardStep === 3 && (
              <form onSubmit={handleCreateSession} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                    Select Platforms
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {platforms.filter((p) => CREATE_PLATFORMS.some(cp => cp.toLowerCase() === p.platformName.toLowerCase().trim())).map((p) => {
                      const checked = selectedPlatforms.has(p.platformID);
                      return (
                        <label
                          key={p.platformID}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "10px 16px", borderRadius: 8, cursor: "pointer",
                            border: `1.5px solid ${checked ? PLATFORM_COLORS[p.platformName] : "var(--line)"}`,
                            background: checked ? `${PLATFORM_COLORS[p.platformName]}14` : "var(--surface-2)",
                            transition: "var(--t)", flex: 1, minWidth: 120,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedPlatforms((prev) => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(p.platformID) : next.delete(p.platformID);
                                return next;
                              });
                            }}
                            style={{ accentColor: PLATFORM_COLORS[p.platformName] }}
                          />
                          <span style={{ fontWeight: 600, fontSize: 13, color: checked ? PLATFORM_COLORS[p.platformName] : "var(--text-2)" }}>
                            {p.platformName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", marginTop: 8 }}>
                    * Select which platforms are active for this session.
                  </p>
                </div>

                {/* Summary */}
                <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: 8, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", marginBottom: 4 }}>Session Summary</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)" }}>📅 {new Date(sessionDate + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>🏢 {selectedCompanies.size} company selected</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>📱 {selectedPlatforms.size} platform selected</p>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => setWizardStep(2)} className="btn btn-secondary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Back
                  </button>
                  <button type="submit" disabled={saving || selectedPlatforms.size === 0} className="btn btn-primary" style={{ flex: 1 }}>
                    {saving ? <><span className="spin" style={{ width: 12, height: 12 }} /> Saving...</> : "🚀 Launch Session"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
