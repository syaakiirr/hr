import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  getSessions, getPlatforms, getCompanies, createSession, deleteSession, archiveSession,
  getEngagements, updateEngagementAction, updateEngagementReason, bulkUpdateEngagementStatus,
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

  // Filter state
  const [filterName, setFilterName] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterCompany, setFilterCompany] = useState("");

  // Selected staff in split pane checklist
  const [selectedStaffID, setSelectedStaffID] = useState<string | null>(null);

  // Reason modal state — stores all engagementIDs for the staff row so reason applies to all posts
  const [reasonModal, setReasonModal] = useState<{ staffName: string; engagementIDs: string[]; current: string } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [savingReason, setSavingReason] = useState(false);

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
    setSelectedStaffID(null); // Reset selection
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


  async function handleAction(eng: Engagement, action: "like" | "comment" | "share", value: boolean) {
    // Optimistic update
    setEngagements((prev) => prev.map((e) =>
      e.engagementID === eng.engagementID
        ? { ...e,
            isLiked: action === "like" ? value : e.isLiked,
            isCommented: action === "comment" ? value : e.isCommented,
            isShared: action === "share" ? value : e.isShared,
          }
        : e
    ));
    try {
      const res = await updateEngagementAction(eng.engagementID, action, value);
      // Update with server's computed status
      setEngagements((prev) => prev.map((e) =>
        e.engagementID === eng.engagementID ? { ...e, status: res.status, isLiked: res.isLiked, isCommented: res.isCommented, isShared: res.isShared } : e
      ));
    } catch (err) {
      // Revert on failure
      setEngagements((prev) => prev.map((e) =>
        e.engagementID === eng.engagementID ? { ...e, isLiked: eng.isLiked, isCommented: eng.isCommented, isShared: eng.isShared } : e
      ));
      console.error(err);
    }
  }

  function openReasonModal(row: { staffName: string; engagements: Engagement[] }) {
    const current = row.engagements.find(e => e.reason)?.reason || "";
    setReasonModal({ staffName: row.staffName, engagementIDs: row.engagements.map(e => e.engagementID), current });
    setReasonInput(current);
  }

  async function saveReason() {
    if (!reasonModal) return;
    setSavingReason(true);
    try {
      // Save reason to all engagements for this staff row
      await Promise.all(reasonModal.engagementIDs.map(id => updateEngagementReason(id, reasonInput)));
      setEngagements((prev) => prev.map((e) =>
        reasonModal.engagementIDs.includes(e.engagementID) ? { ...e, reason: reasonInput || null } : e
      ));
      setReasonModal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingReason(false);
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
  const allStaffRows = Array.from(staffMap.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));

  // Unique departments and companies from current session
  const sessionDepts = Array.from(new Set(allStaffRows.map(r => r.department).filter(Boolean)));
  const sessionCompanies = Array.from(
    new Map(engagements.filter(e => e.companyID).map(e => [e.companyID, e.companyName ?? "No Company"])).entries()
  ).map(([id, name]) => ({ id, name }));

  // Filtered rows
  const staffRows = allStaffRows.filter(row => {
    const nameOk = !filterName || row.staffName.toLowerCase().includes(filterName.toLowerCase());
    const deptOk = !filterDept || row.department === filterDept;
    const compOk = !filterCompany || row.engagements.some(e => e.companyID === filterCompany);
    return nameOk && deptOk && compOk;
  });

  // ── Wizard step label helper ──
  const stepLabels = ["Date", "Company", "Platform"];

  return (
    <Layout>
      <style>{`
        /* ── Premium Monitoring Page Styles ── */
        .mon-wrap { display: flex; flex-direction: column; gap: 20px; }
        .mon-hdr { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 4px; }
        .mon-hdr-title { font-size: 24px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; margin: 0; line-height: 1.2; }
        .mon-hdr-sub { font-size: 13px; color: var(--text-3); margin-top: 3px; }
        .mon-hdr-title .ht { background: linear-gradient(135deg, #4f46e5, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

        /* Two-col layout */
        .mon-grid { display: grid; grid-template-columns: 272px 1fr; gap: 18px; align-items: start; }

        /* Sessions Panel */
        .sesh-panel { background: var(--white); border: 1.5px solid var(--line); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(15,23,42,0.04); }
        .sesh-panel-hd { padding: 14px 16px 12px; border-bottom: 1px solid var(--line); background: linear-gradient(135deg, #f8faff 0%, #f3f0ff 100%); }
        .sesh-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-4); }
        .sesh-panel-count { font-size: 28px; font-weight: 800; color: var(--text-1); letter-spacing: -1px; line-height: 1; margin-top: 2px; }
        .sesh-panel-list { overflow-y: auto; max-height: calc(100vh - 260px); }
        .sesh-panel-list::-webkit-scrollbar { width: 3px; }
        .sesh-panel-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

        .sesh-item { display: flex; align-items: center; gap: 10px; padding: 11px 15px; border-bottom: 1px solid var(--line); cursor: pointer; transition: background 0.12s; position: relative; }
        .sesh-item:last-child { border-bottom: none; }
        .sesh-item:hover { background: #f8fafc; }
        .sesh-item.active { background: linear-gradient(90deg, #f5f3ff 0%, #faf8ff 100%); }
        .sesh-item.active::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, #6366f1, #8b5cf6); border-radius: 0 2px 2px 0; }
        .sesh-item-body { flex: 1; min-width: 0; }
        .sesh-item-date { font-size: 13px; font-weight: 700; color: var(--text-1); }
        .sesh-item-co { font-size: 10.5px; color: var(--text-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sesh-item-plats { display: flex; align-items: center; gap: 4px; margin-top: 5px; flex-wrap: wrap; }
        .plat-pip { width: 7px; height: 7px; border-radius: 50%; }
        .sesh-item-acts { display: flex; gap: 2px; opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
        .sesh-item:hover .sesh-item-acts { opacity: 1; }

        /* Right area */
        .engage-area { min-width: 0; }
        .engage-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 32px; background: var(--white); border: 1.5px dashed var(--line); border-radius: 14px; text-align: center; gap: 8px; }
        .engage-empty-ico { font-size: 44px; opacity: 0.3; }
        .engage-empty-title { font-size: 16px; font-weight: 800; color: var(--text-2); }
        .engage-empty-sub { font-size: 13px; color: var(--text-3); max-width: 280px; line-height: 1.6; }

        /* Split pane inside right area */
        .engage-split { display: flex; gap: 16px; align-items: start; }
        .engage-main { flex: 1 1 0%; min-width: 0; }
        .engage-card { background: var(--white); border: 1.5px solid var(--line); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(15,23,42,0.04); }
        .engage-card-hd { display: flex; align-items: center; justify-content: space-between; padding: 15px 18px; border-bottom: 1px solid var(--line); flex-wrap: wrap; gap: 10px; }
        .engage-card-title { font-size: 14px; font-weight: 800; color: var(--text-1); }
        .engage-card-sub { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
        .stats-row { display: flex; gap: 7px; align-items: center; }
        .stat-chip { display: flex; align-items: center; gap: 4px; padding: 3.5px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1.5px solid; }
        .chip-g { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
        .chip-r { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .chip-b { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }

        /* Filter bar */
        .filter-bar { display: flex; gap: 7px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--line); background: #fafbfc; flex-wrap: wrap; }
        .fi-wrap { position: relative; flex: 1; min-width: 130px; }
        .fi-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.3; }
        .fi-inp { width: 100%; height: 32px; padding: 0 9px 0 30px; border: 1.5px solid var(--line); border-radius: 7px; font-size: 12.5px; background: var(--white); color: var(--text-1); outline: none; transition: border-color 0.15s; font-family: inherit; box-sizing: border-box; }
        .fi-inp:focus { border-color: var(--accent); }
        .fi-sel { height: 32px; padding: 0 8px; border: 1.5px solid var(--line); border-radius: 7px; font-size: 12px; background: var(--white); color: var(--text-1); outline: none; cursor: pointer; font-family: inherit; min-width: 110px; max-width: 145px; transition: border-color 0.15s; }
        .fi-sel:focus { border-color: var(--accent); }

        /* Bulk bar */
        .bulk-bar { display: flex; align-items: center; justify-content: space-between; padding: 7px 16px; background: linear-gradient(90deg, #f5f3ff, #fdf4ff); border-bottom: 1px solid rgba(99,102,241,0.12); flex-wrap: wrap; gap: 8px; }
        .bulk-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 9.5px; font-weight: 800; margin-right: 5px; }

        /* Staff table */
        .stbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .stbl th { padding: 9px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-4); background: #fafbfc; border-bottom: 1.5px solid var(--line); white-space: nowrap; }
        .stbl th.tc { text-align: center; }
        .stbl td { padding: 9px 12px; vertical-align: middle; }
        .stbl tbody tr { border-bottom: 1px solid var(--line); transition: background 0.1s; cursor: pointer; }
        .stbl tbody tr:hover td { background: #f8fafc; }
        .stbl tbody tr.rsel { border-left: 3px solid var(--accent); }
        .stbl tbody tr.rsel td { background: #f5f3ff; }
        .stbl tbody tr:last-child { border-bottom: none; }
        .sn { font-weight: 700; font-size: 13px; color: var(--text-1); }
        .sd { font-size: 10px; color: var(--text-3); margin-top: 1px; }

        /* Checklist drawer */
        .ck-drawer { width: 350px; flex-shrink: 0; border-radius: 14px; border: 1.5px solid var(--line); background: var(--white); overflow: hidden; box-shadow: 0 4px 20px rgba(15,23,42,0.06); position: sticky; top: 20px; max-height: calc(100vh - 160px); display: flex; flex-direction: column; }
        .ck-drawer-hd { padding: 16px 18px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; flex-shrink: 0; }
        .ck-drawer-body { flex: 1; overflow-y: auto; padding: 14px; }
        .ck-drawer-body::-webkit-scrollbar { width: 3px; }
        .ck-drawer-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .ck-prog-wrap { height: 5px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; margin-top: 9px; }
        .ck-prog-fill { height: 100%; background: #34d399; border-radius: 4px; transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }

        .cg { border: 1.5px solid var(--line); border-radius: 10px; margin-bottom: 10px; overflow: hidden; background: var(--white); }
        .cg-hd { display: flex; align-items: center; gap: 7px; padding: 7px 11px; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--line); }
        .cg-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .pr { padding: 11px 11px 9px; border-bottom: 1px solid var(--line); }
        .pr:last-child { border-bottom: none; }
        .pr-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
        .pr-badge { font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 5px; }
        .pr-link { font-size: 10px; font-weight: 700; text-decoration: none; padding: 2px 7px; border-radius: 5px; display: inline-flex; align-items: center; gap: 3px; transition: opacity 0.15s; }
        .pr-link:hover { opacity: 0.7; }
        .act-row { display: flex; gap: 5px; }
        .act-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 29px; font-size: 10.5px; font-weight: 700; border-radius: 7px; border: 1.5px solid var(--line); background: #f8fafc; cursor: pointer; transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1); font-family: inherit; color: var(--text-2); }
        .act-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.08); }
        .act-btn:active:not(:disabled) { transform: scale(0.94); }
        .act-btn.done { color: white; border-color: transparent; box-shadow: 0 2px 8px rgba(0,0,0,0.14); }
        .act-btn.dis { background: #f1f5f9; border: 1.5px dashed #cbd5e1; color: #94a3b8; cursor: not-allowed; opacity: 0.6; }

        @media (max-width: 1100px) { .mon-grid { grid-template-columns: 240px 1fr; } }
        @media (max-width: 900px) { .mon-grid { grid-template-columns: 1fr; } .ck-drawer { width: 100%; position: static; max-height: none; } }
        @media (max-width: 800px) { .engage-split { flex-direction: column; } }
      `}</style>

      <div className="mon-wrap">
        {/* ── Header ── */}
        <div className="mon-hdr">
          <div>
            <h1 className="mon-hdr-title">Monitoring <span className="ht">Sessions</span></h1>
            <p className="mon-hdr-sub">Manage and verify staff engagement for each platform post</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate('/archived', { state: { tab: 'sessions' } })}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3h18v5H3zM3 8h18v13H3z" /><path d="M9 12h6" /></svg>
              Archived
            </button>
            <button
              id="create-session-btn"
              onClick={openCreateModal}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Session
            </button>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="mon-grid">

          {/* ══ Sessions Panel (Left) ══ */}
          <div className="sesh-panel">
            <div className="sesh-panel-hd">
              <div className="sesh-panel-label">All Sessions</div>
              <div className="sesh-panel-count">{sessions.length}</div>
            </div>
            <div className="sesh-panel-list">
              {loading ? (
                <div className="loader" style={{ padding: 24 }}><div className="spin" /></div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: "28px 16px", textAlign: "center" }}>
                  <p style={{ color: "var(--text-3)", fontSize: 13 }}>No sessions yet</p>
                </div>
              ) : (
                sessions.map(s => {
                  const isActive = selectedSession?.sessionID === s.sessionID;
                  const uniquePlats = Array.from(new Set(s.posts.map(p => p.platformName)));
                  const coSummary = s.companies?.map(c => c.companyName).join(", ") ?? "";
                  return (
                    <div key={s.sessionID} className={`sesh-item ${isActive ? "active" : ""}`} onClick={() => handleSelectSession(s)}>
                      <div className="sesh-item-body">
                        <div className="sesh-item-date">
                          {parseDateOnly(s.sessionDate).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                        {coSummary && <div className="sesh-item-co" title={coSummary}>🏢 {coSummary}</div>}
                        <div className="sesh-item-plats">
                          {uniquePlats.map(pl => (
                            <span key={pl} className="plat-pip" style={{ background: PLATFORM_COLORS[pl] || "var(--accent)" }} title={pl} />
                          ))}
                          {uniquePlats.length > 0 && (
                            <span style={{ fontSize: 9.5, color: "var(--text-4)", fontWeight: 600 }}>{uniquePlats.join(" · ")}</span>
                          )}
                        </div>
                      </div>
                      <div className="sesh-item-acts" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleArchiveSession(s.sessionID)} className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--text-3)", width: 24, height: 24, padding: 0 }} title="Archive">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
                        </button>
                        <button onClick={() => handleDeleteSession(s.sessionID)} className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--red)", width: 24, height: 24, padding: 0 }} title="Delete">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ══ Engagement Area (Right) ══ */}
          <div className="engage-area">
            {!selectedSession ? (
              <div className="engage-empty">
                <div className="engage-empty-ico">📅</div>
                <p className="engage-empty-title">Select a Session</p>
                <p className="engage-empty-sub">Click any session from the left panel to view and manage staff engagement.</p>
              </div>
            ) : (
              <div className="engage-split">
                {/* Staff List */}
                <div className="engage-main">
                  <div className="engage-card">
                    {/* Header */}
                    <div className="engage-card-hd">
                      <div>
                        <div className="engage-card-title">Engagement Matrix</div>
                        <div className="engage-card-sub">
                          📅 {parseDateOnly(selectedSession.sessionDate).toLocaleDateString("en-MY", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                        </div>
                      </div>
                      <div className="stats-row">
                        <span className="stat-chip chip-b">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                          {allStaffRows.length}
                        </span>
                        <span className="stat-chip chip-g">✓ {engagements.filter(e => e.status === "Completed").length}</span>
                        <span className="stat-chip chip-r">✗ {engagements.filter(e => e.status === "Missed").length}</span>
                      </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="filter-bar">
                      <div className="fi-wrap">
                        <svg className="fi-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        <input className="fi-inp" placeholder="Cari nama staff..." value={filterName} onChange={e => setFilterName(e.target.value)} />
                      </div>
                      <select className="fi-sel" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                        <option value="">Semua Jabatan</option>
                        {sessionDepts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <select className="fi-sel" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
                        <option value="">Semua Syarikat</option>
                        {sessionCompanies.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}
                      </select>
                      {(filterName || filterDept || filterCompany) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11.5, color: "var(--text-3)", height: 32, whiteSpace: "nowrap" }}
                          onClick={() => { setFilterName(""); setFilterDept(""); setFilterCompany(""); }}
                        >✕ Clear</button>
                      )}
                    </div>

                    {/* Bulk Bar */}
                    {selectedEngagements.size > 0 && (
                      <div className="bulk-bar">
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>
                          <span className="bulk-badge">{selectedEngagements.size}</span>
                          dipilih
                        </span>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => handleBulkUpdate("Completed")} disabled={bulkUpdating} className="btn btn-sm" style={{ background: "var(--green)", color: "white", border: "none", fontSize: 11.5, height: 28 }}>✓ Done</button>
                          <button onClick={() => handleBulkUpdate("Missed")} disabled={bulkUpdating} className="btn btn-sm" style={{ background: "var(--red)", color: "white", border: "none", fontSize: 11.5, height: 28 }}>✗ Missed</button>
                          <button onClick={() => setSelectedEngagements(new Set())} disabled={bulkUpdating} className="btn btn-sm btn-ghost" style={{ fontSize: 11.5, height: 28 }}>Batal</button>
                        </div>
                      </div>
                    )}

                    {/* Table */}
                    {loadingEng ? (
                      <div className="loader" style={{ padding: 32 }}><div className="spin" /> Loading...</div>
                    ) : staffRows.length === 0 ? (
                      <div style={{ padding: "32px 20px", textAlign: "center" }}>
                        <p style={{ color: "var(--text-3)", fontSize: 13 }}>Tiada staff sepadan dengan filter.</p>
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="stbl">
                          <thead>
                            <tr>
                              <th style={{ width: 36, textAlign: "center" }}>
                                <input type="checkbox"
                                  checked={selectedEngagements.size === engagements.length && engagements.length > 0}
                                  onChange={toggleSelectAll}
                                  style={{ cursor: "pointer", width: 13, height: 13 }}
                                />
                              </th>
                              <th className="tc" style={{ width: 30 }}>#</th>
                              <th>Nama Staff</th>
                              <th className="tc" style={{ width: 70 }}>Ticks</th>
                              <th className="tc" style={{ width: 62 }}>Rate</th>
                              <th className="tc" style={{ width: 88 }}>Sebab</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staffRows.map((row, idx) => {
                              let totalTicks = 0, doneTicks = 0;
                              row.engagements.forEach(eng => {
                                if (eng.platformName === "Facebook") { totalTicks += 2; if (eng.isLiked) doneTicks++; if (eng.isCommented) doneTicks++; }
                                else if (eng.platformName === "Instagram") { totalTicks += 2; if (eng.isLiked) doneTicks++; if (eng.isCommented) doneTicks++; }
                                else if (eng.platformName === "TikTok") { totalTicks += 1; if (eng.isCommented) doneTicks++; }
                                else { totalTicks += 2; if (eng.isLiked) doneTicks++; if (eng.isCommented) doneTicks++; }
                              });
                              const rate = totalTicks > 0 ? Math.round((doneTicks / totalTicks) * 100) : 0;
                              const isRowSel = selectedStaffID === row.staffID || (!selectedStaffID && idx === 0);
                              const allChk = row.engagements.every(e => selectedEngagements.has(e.engagementID));
                              const reason = row.engagements.find(e => e.reason)?.reason;
                              const rc = rate >= 100 ? "#16a34a" : rate >= 50 ? "#d97706" : "#dc2626";
                              const rbg = rate >= 100 ? "#f0fdf4" : rate >= 50 ? "#fffbeb" : "#fef2f2";

                              return (
                                <tr key={row.staffID} className={isRowSel ? "rsel" : ""} onClick={() => setSelectedStaffID(row.staffID)}>
                                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={allChk}
                                      onChange={() => {
                                        const ids = row.engagements.map(e => e.engagementID);
                                        setSelectedEngagements(prev => {
                                          const next = new Set(prev);
                                          if (allChk) ids.forEach(id => next.delete(id));
                                          else ids.forEach(id => next.add(id));
                                          return next;
                                        });
                                      }}
                                      style={{ cursor: "pointer", width: 13, height: 13 }}
                                    />
                                  </td>
                                  <td style={{ textAlign: "center", color: "var(--text-4)", fontSize: 11 }}>{idx + 1}</td>
                                  <td>
                                    <div className="sn">{row.staffName}</div>
                                    <div className="sd">{row.department || "Tiada Jabatan"}</div>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: rc }}>{doneTicks}</span>
                                    <span style={{ fontSize: 10.5, color: "var(--text-4)", fontWeight: 600 }}>/{totalTicks}</span>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2.5px 7px", borderRadius: 10, background: rbg, color: rc, display: "inline-block", minWidth: 36 }}>{rate}%</span>
                                  </td>
                                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => openReasonModal(row)}
                                      title={reason ? `Sebab: ${reason}` : "Tambah sebab"}
                                      style={{
                                        fontSize: 10.5, padding: "3px 7px", borderRadius: 6,
                                        border: reason ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                                        cursor: "pointer", fontWeight: 700, maxWidth: 82,
                                        background: reason ? "rgba(99,102,241,0.06)" : "transparent",
                                        color: reason ? "var(--accent)" : "var(--text-3)",
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                        display: "block", width: "100%", textAlign: "center", fontFamily: "inherit"
                                      }}
                                    >
                                      {reason ? `📝 ${reason}` : "+ Reason"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Checklist Drawer */}
                <div className="ck-drawer">
                  {(() => {
                    const activeRow = staffRows.find(r => r.staffID === selectedStaffID) || staffRows[0];
                    if (!activeRow) return (
                      <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                        <p>Tiada staff terpilih.</p>
                      </div>
                    );

                    let total = 0, done = 0;
                    activeRow.engagements.forEach(eng => {
                      if (eng.platformName === "Facebook") { total += 2; if (eng.isLiked) done++; if (eng.isCommented) done++; }
                      else if (eng.platformName === "Instagram") { total += 2; if (eng.isLiked) done++; if (eng.isCommented) done++; }
                      else if (eng.platformName === "TikTok") { total += 1; if (eng.isCommented) done++; }
                      else { total += 2; if (eng.isLiked) done++; if (eng.isCommented) done++; }
                    });
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                    const coMap = new Map<string, { id: string; name: string; engagements: Engagement[] }>();
                    activeRow.engagements.forEach(eng => {
                      const cid = eng.companyID || "none";
                      if (!coMap.has(cid)) coMap.set(cid, { id: cid, name: eng.companyName || "No Company", engagements: [] });
                      coMap.get(cid)!.engagements.push(eng);
                    });
                    const coGroups = Array.from(coMap.values());

                    return (
                      <>
                        <div className="ck-drawer-hd">
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8, marginBottom: 3 }}>Tugasan Staff</p>
                          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.3px", lineHeight: 1.2 }}>{activeRow.staffName}</h3>
                          <p style={{ fontSize: 11.5, opacity: 0.85, marginTop: 3, fontWeight: 500 }}>{activeRow.department || "Tiada Jabatan"}</p>
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
                              <span>Prestasi Sesi</span>
                              <span>{done}/{total} — {pct}%</span>
                            </div>
                            <div className="ck-prog-wrap">
                              <div className="ck-prog-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="ck-drawer-body">
                          {coGroups.map((grp, gi) => {
                            const cc = COMPANY_COLORS[gi % COMPANY_COLORS.length];
                            return (
                              <div key={grp.id} className="cg">
                                <div className="cg-hd" style={{ color: cc, background: `${cc}0e` }}>
                                  <div className="cg-dot" style={{ background: cc }} />
                                  {grp.name}
                                </div>
                                <div>
                                  {grp.engagements.map(eng => {
                                    const pc = PLATFORM_COLORS[eng.platformName] || "var(--accent)";
                                    const isIg = eng.platformName === "Instagram";
                                    const acts: { key: "like" | "comment" | "share"; label: string; disabled?: boolean; icon: string }[] =
                                      eng.platformName === "Facebook"
                                        ? [{ key: "like", label: "Like", icon: "👍" }, { key: "comment", label: "Komen", icon: "💬" }, { key: "share", label: "Share", icon: "🔁", disabled: true }]
                                      : eng.platformName === "Instagram"
                                        ? [{ key: "like", label: "Like", icon: "❤️" }, { key: "comment", label: "Komen", icon: "💬" }]
                                      : eng.platformName === "TikTok"
                                        ? [{ key: "comment", label: "Komen", icon: "💬" }]
                                        : [{ key: "like", label: "Like", icon: "👍" }, { key: "comment", label: "Komen", icon: "💬" }];

                                    return (
                                      <div key={eng.engagementID} className="pr">
                                        <div className="pr-top">
                                          <span className="pr-badge" style={{
                                            background: isIg ? "linear-gradient(90deg, #f09433, #bc1888)" : `${pc}18`,
                                            color: isIg ? "white" : pc
                                          }}>{eng.platformName}</span>
                                          {eng.postLink ? (
                                            <a href={eng.postLink} target="_blank" rel="noopener noreferrer" className="pr-link" style={{ background: `${pc}12`, color: pc }}>
                                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                              Buka Post
                                            </a>
                                          ) : (
                                            <span style={{ fontSize: 9.5, color: "var(--text-4)" }}>No link</span>
                                          )}
                                        </div>
                                        <div className="act-row">
                                          {acts.map(a => {
                                            const ticked = a.key === "like" ? eng.isLiked : a.key === "comment" ? eng.isCommented : eng.isShared;
                                            const bg = ticked ? (isIg ? "linear-gradient(135deg, #f09433, #dc2743, #bc1888)" : pc) : undefined;
                                            return (
                                              <button
                                                key={a.key}
                                                disabled={a.disabled}
                                                onClick={() => handleAction(eng, a.key, !ticked)}
                                                className={`act-btn ${ticked ? "done" : ""} ${a.disabled ? "dis" : ""}`}
                                                style={ticked ? { background: bg } : undefined}
                                                title={a.disabled ? "Coming soon" : undefined}
                                              >
                                                <span style={{ fontSize: 11 }}>{a.icon}</span>
                                                <span>{a.label}</span>
                                                {ticked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
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
      {/* ── Reason Modal ── */}
      {reasonModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setReasonModal(null)}>
          <div style={{
            background: "var(--surface)", borderRadius: 14, padding: 24, width: 360,
            boxShadow: "0 8px 40px rgba(0,0,0,0.25)", border: "1px solid var(--line)"
          }} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>📝 Reason — {reasonModal.staffName}</p>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>Enter reason (applies to all posts for this staff in the session)</p>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 80, resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
              placeholder="MC, Cuti Tahunan, Urusan Rasmi..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setReasonModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={savingReason}
                onClick={saveReason}>
                {savingReason ? "Saving..." : "Save Reason"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
