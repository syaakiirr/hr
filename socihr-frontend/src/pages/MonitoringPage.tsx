import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ConfirmationDialog from "../components/ConfirmationDialog";
import {
  getSessions, getPlatforms, getCompanies, createSession, deleteSession, archiveSession,
  getEngagements, updateEngagementAction, updateEngagementReason, bulkUpdateEngagementStatus,
  type MonitoringSession, type Platform, type Engagement, type Company
} from "../services/api";

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const CREATE_PLATFORMS = ["Instagram", "Facebook", "TikTok"];
const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#e1306c", Facebook: "#1877f2", TikTok: "#374151", LinkedIn: "#0a66c2"
};

const COMPANY_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];

// Frontend implementation of TickHelper.cs to calculate ticks at action level
const calculateTicks = (platformName: string, isLiked: boolean, isCommented: boolean, isShared: boolean) => {
  const platform = platformName.toLowerCase();
  let ticked = 0;
  let expected = 0;
  
  if (platform === "facebook") {
    expected = 2;
    if (isLiked) ticked++;
    if (isCommented) ticked++;
  } else if (platform === "instagram") {
    expected = 2;
    if (isLiked) ticked++;
    if (isCommented) ticked++;
  } else if (platform === "tiktok") {
    expected = 1;
    if (isCommented) ticked++;
  } else {
    expected = 3;
    if (isLiked) ticked++;
    if (isCommented) ticked++;
    if (isShared) ticked++;
  }
  
  return { ticked, missed: expected - ticked, expected };
};

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
  // Post links per platformID (same URL per platform across all companies)
  const [postLinks, setPostLinks] = useState<Record<string, string>>({});

  // Confirmation dialog (replaces native confirm/alert)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Debounced filter for name (avoids re-render on every keystroke)
  const debouncedFilterName = useDebounce(filterName, 300);

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
    setPostLinks({});
    setShowCreate(true);
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const posts = platforms
        .filter((p) => selectedPlatforms.has(p.platformID))
        .map((p) => ({ platformID: p.platformID, postLink: postLinks[p.platformID] || "" }));

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
      setPostLinks({});
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
    // Optimistic update: calculate new status as well
    setEngagements((prev) => prev.map((e) => {
      if (e.engagementID !== eng.engagementID) return e;
      
      const newEngagement = {
        ...e,
        isLiked: action === "like" ? value : e.isLiked,
        isCommented: action === "comment" ? value : e.isCommented,
        isShared: action === "share" ? value : e.isShared,
      };
      
      // Auto-calculate status
      const platform = e.platformName.toLowerCase();
      const completed = 
        platform === "tiktok" ? newEngagement.isCommented : 
        (newEngagement.isLiked && newEngagement.isCommented);
      
      newEngagement.status = completed ? "Completed" : "Missed";
      
      return newEngagement;
    }));
    
    try {
      await updateEngagementAction(eng.engagementID, action, value);
    } catch (err) {
      // Don't revert — keep optimistic state. Server didn't save, but UI stays consistent.
      // Next page load will fetch ground-truth from server.
      console.error("Failed to update engagement:", err);
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
    setConfirmDialog({
      isOpen: true,
      title: "Padam Session",
      message: "Adakah anda pasti mahu memadam session ini? Tindakan ini tidak boleh dibatalkan.",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteSession(id);
          setSessions((prev) => prev.filter((s) => s.sessionID !== id));
          if (selectedSession?.sessionID === id) {
            setSelectedSession(null);
            setSelectedEngagements(new Set());
          }
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : "An error occurred.");
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      }
    });
  }

  async function handleArchiveSession(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Archive Session",
      message: "Archive session ini? Ia boleh dipulihkan kemudian dari halaman Archive.",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await archiveSession(id);
          setSessions((prev) => prev.filter((s) => s.sessionID !== id));
          if (selectedSession?.sessionID === id) {
            setSelectedSession(null);
            setSelectedEngagements(new Set());
          }
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : "An error occurred.");
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      }
    });
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
    setConfirmDialog({
      isOpen: true,
      title: `Update ke "${status}"`,
      message: `Update ${selectedEngagements.size} engagement(s) kepada "${status}"?`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        setBulkUpdating(true);
        try {
          const engagementIDs = Array.from(selectedEngagements);
          await bulkUpdateEngagementStatus(engagementIDs, status);
          setEngagements((prev) =>
            prev.map((e) => selectedEngagements.has(e.engagementID) ? { ...e, status } : e)
          );
          setSelectedEngagements(new Set());
        } catch (err) {
          console.error(err);
          alert("Failed to update engagements. Please try again.");
        } finally {
          setBulkUpdating(false);
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      }
    });
  }

  // Type definition for staff row
  type StaffRow = { staffID: string; staffName: string; department: string; engagements: Engagement[] };

  // Group engagements by staff (memoized)
  const { allStaffRows, sessionDepts, sessionCompanies } = useMemo(() => {
    const staffMap = new Map<string, StaffRow>();
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
    const allRows: StaffRow[] = Array.from(staffMap.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));
    const depts: string[] = Array.from(new Set(allRows.map((r: StaffRow) => r.department).filter(Boolean)));
    const companies: { id: string; name: string }[] = Array.from(
      new Map(engagements.filter((e: Engagement) => e.companyID).map((e: Engagement) => [e.companyID!, e.companyName ?? "No Company"]))
    ).map(([id, name]) => ({ id, name }));
    return { allStaffRows: allRows, sessionDepts: depts, sessionCompanies: companies };
  }, [engagements]);

  // Filtered rows (memoized) — use debounced name filter
  const staffRows = useMemo(() => {
    return allStaffRows.filter((row: StaffRow) => {
      const nameOk = !debouncedFilterName || row.staffName.toLowerCase().includes(debouncedFilterName.toLowerCase());
      const deptOk = !filterDept || row.department === filterDept;
      const compOk = !filterCompany || row.engagements.some((e: Engagement) => e.companyID === filterCompany);
      return nameOk && deptOk && compOk;
    });
  }, [allStaffRows, debouncedFilterName, filterDept, filterCompany]);
  
  
  // Calculate total ticks for stat chips
  const totalTicks = useMemo(() => {
    let completed = 0;
    let missed = 0;
    engagements.forEach(e => {
      const { ticked, missed: m } = calculateTicks(e.platformName, e.isLiked, e.isCommented, e.isShared);
      completed += ticked;
      missed += m;
    });
    return { completed, missed };
  }, [engagements]);

  // Memoized table columns and groups
  const tableData = useMemo(() => {
    if (!selectedSession) {
      return { actionCols: [], coGroups: [], platGroups: [], coEndIndices: new Set() };
    }

    // Build column list with company info — one column per post+action
    const actionCols: {
      postID: string; platformName: string; companyID: string; companyName: string;
      actionKey: "like" | "comment" | "share";
      label: string; icon: string; disabled?: boolean;
    }[] = [];

    // Sort posts: group by company, then by platform order (FB → IG → TT)
    const platformOrder: Record<string, number> = { Facebook: 0, Instagram: 1, TikTok: 2 };
    let sortedPosts = [...selectedSession.posts].sort((a, b) => {
      const coA = (a.companyName || "").trim().toLowerCase();
      const coB = (b.companyName || "").trim().toLowerCase();
      if (coA !== coB) return coA.localeCompare(coB);
      return (platformOrder[a.platformName] ?? 99) - (platformOrder[b.platformName] ?? 99);
    });
    
    // Filter posts by selected company if filter is set
    if (filterCompany) {
      sortedPosts = sortedPosts.filter(p => p.companyID === filterCompany);
    }

    sortedPosts.forEach((p) => {
      const plat = p.platformName;
      const coID = p.companyID ?? "";
      const coName = (p.companyName || "No Company").trim();
      const acts: { key: "like" | "comment" | "share"; label: string; icon: string; disabled?: boolean }[] =
        plat.toLowerCase() === "facebook"
          ? [{ key: "like", label: "Like", icon: "👍" }, { key: "comment", label: "Komen", icon: "💬" }, { key: "share", label: "Share", icon: "🔁", disabled: true }]
          : plat.toLowerCase() === "instagram"
          ? [{ key: "like", label: "Like", icon: "❤️" }, { key: "comment", label: "Komen", icon: "💬" }]
          : plat.toLowerCase() === "tiktok"
          ? [{ key: "comment", label: "Komen", icon: "💬" }]
          : [{ key: "like", label: "Like", icon: "👍" }, { key: "comment", label: "Komen", icon: "💬" }];

      acts.forEach((a) =>
        actionCols.push({ ...a, postID: p.postID, platformName: plat, companyID: coID, companyName: coName, actionKey: a.key, label: a.label, icon: a.icon, disabled: a.disabled })
      );
    });

    // Group columns by company name (not ID) to avoid duplicates
    const coGroups: { companyID: string; name: string; color: string; span: number }[] = [];
    actionCols.forEach((col) => {
      const last = coGroups[coGroups.length - 1];
      if (last && last.name === col.companyName) {
        last.span++;
      } else {
        const idx = companies.findIndex(c => c.companyName === col.companyName);
        coGroups.push({
          companyID: col.companyID,
          name: col.companyName,
          color: idx >= 0 ? COMPANY_COLORS[idx % COMPANY_COLORS.length] : "#6b7280",
          span: 1
        });
      }
    });

    // Group columns by platform for the middle header row
    const platGroups: { platformName: string; color: string; span: number }[] = [];
    actionCols.forEach((col) => {
      const last = platGroups[platGroups.length - 1];
      if (last && last.platformName === col.platformName) {
        last.span++;
      } else {
        platGroups.push({
          platformName: col.platformName,
          color: PLATFORM_COLORS[col.platformName] || "var(--accent)",
          span: 1
        });
      }
    });

    const coEndIndices = new Set<number>();
    let cumSpan = 0;
    coGroups.forEach((cg) => { cumSpan += cg.span; coEndIndices.add(cumSpan - 1); });

    return { actionCols, coGroups, platGroups, coEndIndices };
  }, [selectedSession, filterCompany, companies]);

  // ── Wizard step label helper ──
  const stepLabels = ["Date", "Company", "Platform"];

  // ── Synchronized dual-scrollbar for the engagement table ──
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const topSpacerRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback((source: "top" | "table") => {
    if (source === "top" && topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    } else if (source === "table" && tableScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  }, []);

  // Keep the top scrollbar spacer width in sync with the actual table content width
  useLayoutEffect(() => {
    const syncWidth = () => {
      if (tableScrollRef.current && topSpacerRef.current) {
        const tableEl = tableScrollRef.current.querySelector('table');
        if (tableEl) {
          topSpacerRef.current.style.width = tableEl.scrollWidth + 'px';
        }
      }
    };
    syncWidth();
    // Also sync on window resize and filter changes
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, [engagements, staffRows, filterCompany]);

  return (
    <Layout>
      <style>{`
        /* ── Premium Monitoring Page Styles ── */
        .mon-wrap { display: flex; flex-direction: column; gap: 16px; }
        .mon-hdr { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 4px; }
        .mon-hdr-title { font-size: 24px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; margin: 0; line-height: 1.2; }
        .mon-hdr-sub { font-size: 13px; color: var(--text-3); margin-top: 3px; }
        .mon-hdr-title .ht { background: linear-gradient(135deg, #4f46e5, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

        /* Vertical stack layout */
        .mon-grid { display: flex; flex-direction: column; gap: 14px; }

        /* Sessions Panel — horizontal strip at top */
        .sesh-panel { background: var(--white); border: 1.5px solid var(--line); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(15,23,42,0.04); }
        .sesh-panel-hd { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--line); background: linear-gradient(135deg, #f8faff 0%, #f3f0ff 100%); flex-shrink: 0; }
        .sesh-panel-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-4); white-space: nowrap; }
        .sesh-panel-count { font-size: 18px; font-weight: 800; color: var(--accent); letter-spacing: -0.5px; line-height: 1; background: rgba(99,102,241,0.08); border-radius: 8px; padding: 2px 8px; }
        .sesh-panel-list { display: flex; flex-direction: row; overflow-x: auto; overflow-y: hidden; gap: 8px; padding: 10px 14px; scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent; }
        .sesh-panel-list::-webkit-scrollbar { height: 4px; }
        .sesh-panel-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

        /* Session item — horizontal card chip */
        .sesh-item { display: flex; flex-direction: column; justify-content: space-between; min-width: 150px; max-width: 180px; padding: 9px 12px; border: 1.5px solid var(--line); border-radius: 10px; cursor: pointer; transition: all 0.15s; position: relative; flex-shrink: 0; background: var(--white); gap: 5px; }
        .sesh-item:hover { border-color: var(--accent); background: #faf8ff; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(99,102,241,0.1); }
        .sesh-item.active { border-color: var(--accent); background: linear-gradient(135deg, #f5f3ff 0%, #faf8ff 100%); box-shadow: 0 0 0 2px rgba(99,102,241,0.18); }
        .sesh-item.active::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 8px 8px 0 0; }
        .sesh-item-body { flex: 1; min-width: 0; }
        .sesh-item-date { font-size: 12px; font-weight: 700; color: var(--text-1); white-space: nowrap; }
        .sesh-item-co { font-size: 10px; color: var(--text-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sesh-item-plats { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
        .plat-pip { width: 6px; height: 6px; border-radius: 50%; }
        .sesh-item-acts { display: flex; gap: 2px; opacity: 0; transition: opacity 0.12s; }
        .sesh-item:hover .sesh-item-acts { opacity: 1; }

        /* Right area */
        .engage-area { min-width: 0; }
        .engage-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 32px; background: var(--white); border: 1.5px dashed var(--line); border-radius: 14px; text-align: center; gap: 8px; }
        .engage-empty-ico { font-size: 44px; opacity: 0.3; }
        .engage-empty-title { font-size: 16px; font-weight: 800; color: var(--text-2); }
        .engage-empty-sub { font-size: 13px; color: var(--text-3); max-width: 280px; line-height: 1.6; }

        /* Matrix card inside right area */
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

        /* ── CSS Grid Matrix Table Styles ── */
        .matrix-grid {
          display: grid;
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
        }

        .gh-cell {
          background: #fafbfc;
          border-right: 1px solid var(--line);
          border-bottom: 1.5px solid var(--line);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-sizing: border-box;
          font-weight: 700;
          font-size: 10px;
          color: var(--text-2);
        }

        .gh-cell.sticky-col {
          position: sticky;
          z-index: 25;
        }

        .gh-cell.sticky-row {
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .gh-cell.sticky-both {
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .gb-cell {
          padding: 8px;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          background: var(--white);
          font-size: 12px;
        }

        .gb-cell.sticky-col {
          position: sticky;
          z-index: 10;
          box-shadow: 2px 0 5px rgba(0, 0, 0, 0.02);
        }

        .gb-cell.selected-row-cell {
          background: #f5f3ff !important;
        }

        @media (max-width: 700px) { .sesh-item { min-width: 130px; } }
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

        {/* ── Sessions Strip (Top) ── */}
        <div className="sesh-panel">
          <div className="sesh-panel-hd">
            <div className="sesh-panel-label">All Sessions</div>
            <div className="sesh-panel-count">{sessions.length}</div>
            <div style={{ flex: 1 }} />
            <p style={{ fontSize: 12, color: "var(--text-4)", fontStyle: "italic" }}>← scroll to see more →</p>
          </div>
          <div className="sesh-panel-list">
            {loading ? (
              <div className="loader" style={{ padding: 16 }}><div className="spin" /></div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: "12px 4px", color: "var(--text-3)", fontSize: 12, fontStyle: "italic" }}>No sessions yet</div>
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
                      <button onClick={() => handleArchiveSession(s.sessionID)} className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--text-3)", width: 22, height: 22, padding: 0 }} title="Archive">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
                      </button>
                      <button onClick={() => handleDeleteSession(s.sessionID)} className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--red)", width: 22, height: 22, padding: 0 }} title="Delete">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Main Content (Full Width) ── */}
        <div className="mon-grid">
          {/* ══ Engagement Area (Full Width) ══ */}
          <div className="engage-area" style={{ width: "100%" }}>
            {!selectedSession ? (
              <div className="engage-empty">
                <div className="engage-empty-ico">📅</div>
                <p className="engage-empty-title">Select a Session</p>
                <p className="engage-empty-sub">Click any session from the left panel to view and manage staff engagement.</p>
              </div>
            ) : (
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
                    <span className="stat-chip chip-g">✓ {totalTicks.completed}</span>
                    <span className="stat-chip chip-r">✗ {totalTicks.missed}</span>
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
                      style={{ fontSize: 12, color: "var(--text-3)", height: 32, whiteSpace: "nowrap" }}
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
                      <button onClick={() => handleBulkUpdate("Completed")} disabled={bulkUpdating} className="btn btn-sm" style={{ background: "var(--green)", color: "white", border: "none", fontSize: 12, height: 28 }}>✓ Done</button>
                      <button onClick={() => handleBulkUpdate("Missed")} disabled={bulkUpdating} className="btn btn-sm" style={{ background: "var(--red)", color: "white", border: "none", fontSize: 12, height: 28 }}>✗ Missed</button>
                      <button onClick={() => setSelectedEngagements(new Set())} disabled={bulkUpdating} className="btn btn-sm btn-ghost" style={{ fontSize: 12, height: 28 }}>Batal</button>
                    </div>
                  </div>
                )}

                {/* ── Engagement Table ── */}
                {loadingEng ? (
                  <div className="loader" style={{ padding: 32 }}><div className="spin" /> Loading...</div>
                ) : staffRows.length === 0 ? (
                  <div style={{ padding: "32px 20px", textAlign: "center" }}>
                    <p style={{ color: "var(--text-3)", fontSize: 13 }}>Tiada staff sepadan dengan filter.</p>
                  </div>
                ) : (
                  (() => {
                    const { actionCols, coGroups, platGroups, coEndIndices } = tableData;
                    
                    const thStyle: React.CSSProperties = {
                      padding: "6px 5px", textAlign: "center", fontWeight: 700,
                      fontSize: 11.5, color: "var(--text-2)", whiteSpace: "nowrap"
                    };
                    const tdStyle: React.CSSProperties = {
                      padding: "6px", textAlign: "center", verticalAlign: "middle"
                    };
                    
                    return (
                      <div style={{ width: "100%" }}>
                        {/* Top scrollbar — synced with the table scroll container */}
                        <div
                          ref={topScrollRef}
                          onScroll={() => syncScroll("top")}
                          style={{
                            overflowX: "scroll", overflowY: "hidden",
                            height: 10, width: "100%",
                            scrollbarWidth: "thin",
                          }}
                        >
                          <div ref={topSpacerRef} style={{ height: 1, minWidth: 1 }} />
                        </div>
                        {/* Main table container */}
                        <div
                          ref={tableScrollRef}
                          onScroll={() => syncScroll("table")}
                          style={{ overflowX: "auto", width: "100%" }}
                        >
                        <table className="simple-engage-table" style={{
                          width: "100%", borderCollapse: "collapse", fontSize: 13,
                          minWidth: 400 + actionCols.length * 52
                        }}>
                          <thead>
                            {/* Row 1 — Company */}
                            <tr style={{ background: "#f1f5f9" }}>
                              <th rowSpan={3} style={{ ...thStyle, width: 34, borderRight: "1px solid var(--line)", borderBottom: "2px solid var(--line)" }}>
                                <input type="checkbox"
                                  checked={selectedEngagements.size === engagements.length && engagements.length > 0}
                                  onChange={toggleSelectAll}
                                  style={{ cursor: "pointer", width: 14, height: 14 }}
                                />
                              </th>
                              <th rowSpan={3} style={{ ...thStyle, width: 28, fontSize: 11, color: "var(--text-4)", borderRight: "1px solid var(--line)", borderBottom: "2px solid var(--line)" }}>#</th>
                              <th rowSpan={3} style={{ ...thStyle, textAlign: "left", minWidth: 120, fontSize: 12, borderRight: "1px solid var(--line)", borderBottom: "2px solid var(--line)" }}>Nama Staff</th>
                              <th rowSpan={3} style={{ ...thStyle, textAlign: "left", minWidth: 80, fontSize: 11, borderRight: "2px solid var(--line-2)", borderBottom: "2px solid var(--line)" }}>Jabatan</th>
                              {coGroups.map((cg) => (
                                <th key={cg.companyID} colSpan={cg.span} style={{
                                  padding: "5px 6px", textAlign: "center", fontWeight: 800,
                                  fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase",
                                  color: cg.color, background: `${cg.color}14`,
                                  borderRight: "2px solid #cbd5e1", borderBottom: "1px solid var(--line)"
                                }}>
                                  {cg.name}
                                </th>
                              ))}
                              <th rowSpan={3} style={{ ...thStyle, width: 68, borderBottom: "2px solid var(--line)" }}>Sebab</th>
                            </tr>
                            {/* Row 2 — Platform */}
                            <tr style={{ background: "#f5f6f8" }}>
                              {(() => {
                                let platColIdx = 0;
                                return platGroups.map((pg, pi) => {
                                  const endIdx = platColIdx + pg.span - 1;
                                  const isCoEnd = coEndIndices.has(endIdx);
                                  platColIdx += pg.span;
                                  return (
                                    <th key={pi} colSpan={pg.span} style={{
                                      padding: "3px 4px", textAlign: "center", fontWeight: 700,
                                      fontSize: 11, color: pg.color, background: `${pg.color}0d`,
                                      borderRight: isCoEnd ? "2px solid #cbd5e1" : "1px solid var(--line)",
                                      borderBottom: "1px solid var(--line)"
                                    }}>
                                      {pg.platformName === "Facebook" ? "Facebook" : pg.platformName === "Instagram" ? "Instagram" : pg.platformName === "TikTok" ? "TikTok" : pg.platformName}
                                    </th>
                                  );
                                });
                              })()}
                            </tr>
                            {/* Row 3 — Action */}
                            <tr style={{ background: "#fafbfc", borderBottom: "2px solid var(--line)" }}>
                              {actionCols.map((col, ci) => {
                                const platColor = PLATFORM_COLORS[col.platformName] || "var(--accent)";
                                const isLastInCo = coEndIndices.has(ci);
                                return (
                                  <th key={ci} style={{
                                    ...thStyle, fontSize: 9.5, width: 46,
                                    color: col.disabled ? "var(--text-4)" : platColor,
                                    opacity: col.disabled ? 0.35 : 1,
                                    borderRight: isLastInCo ? "2px solid #cbd5e1" : "1px solid var(--line)"
                                  }}>
                                    {col.icon} {col.label}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {staffRows.map((row, idx) => {
                              const allChk = row.engagements.length > 0 && row.engagements.every(e => selectedEngagements.has(e.engagementID));
                              const reason = row.engagements.find(e => e.reason)?.reason;
                              const isRowSel = selectedStaffID === row.staffID;

                              return (
                                <tr
                                  key={row.staffID}
                                  onClick={() => setSelectedStaffID(row.staffID)}
                                  style={{
                                    background: isRowSel ? "#f5f3ff" : idx % 2 === 0 ? "var(--white)" : "#fafbfc",
                                    borderBottom: "1px solid var(--line)",
                                    cursor: "pointer",
                                    transition: "background 0.1s"
                                  }}
                                >
                                  <td style={tdStyle}>
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
                                      style={{ cursor: "pointer", width: 14, height: 14 }}
                                    />
                                  </td>
                                  <td style={{ ...tdStyle, color: "var(--text-4)", fontSize: 12 }}>{idx + 1}</td>
                                  <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600, color: "var(--text-1)", whiteSpace: "nowrap" }}>
                                    {row.staffName}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: "left", color: "var(--text-3)", fontSize: 12, whiteSpace: "nowrap" }}>
                                    {row.department || "—"}
                                  </td>
                                  {actionCols.map((col, ci) => {
                                    const eng = row.engagements.find(e => e.postID === col.postID);
                                    const isTicked = eng
                                      ? (col.actionKey === "like" ? eng.isLiked : col.actionKey === "comment" ? eng.isCommented : eng.isShared)
                                      : false;
                                    const isLastInGroup =
                                      ci === actionCols.length - 1 ||
                                      actionCols[ci].companyName !== (actionCols[ci + 1]?.companyName ?? "");

                                    return (
                                      <td key={ci} style={{
                                        ...tdStyle,
                                        borderRight: isLastInGroup ? "2px solid #d1d5db" : "1px solid var(--line)"
                                      }}>
                                        {eng ? (
                                          col.disabled ? (
                                            <span style={{ fontSize: 11, color: "#cbd5e1" }} title="Disabled">—</span>
                                          ) : (
                                            <input
                                              type="checkbox"
                                              checked={isTicked}
                                              onChange={(e) => { e.stopPropagation(); handleAction(eng, col.actionKey, e.target.checked); }}
                                              style={{ cursor: "pointer", width: 15, height: 15, accentColor: PLATFORM_COLORS[col.platformName] || "var(--accent)" }}
                                              title={`${col.label}`}
                                            />
                                          )
                                        ) : (
                                          <span style={{ color: "var(--text-4)", fontSize: 11 }}>—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td style={tdStyle}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openReasonModal(row); }}
                                      title={reason || "Tambah sebab"}
                                      style={{
                                        fontSize: 11, padding: "3px 6px", borderRadius: 6,
                                        border: reason ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                                        cursor: "pointer", fontWeight: 700,
                                        background: reason ? "rgba(99,102,241,0.06)" : "transparent",
                                        color: reason ? "var(--accent)" : "var(--text-3)",
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                        maxWidth: 70, fontFamily: "inherit"
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
                      </div>
                    );
                  })()
                )}
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
                      <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "var(--accent)" : isDone ? "var(--green)" : "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6, fontStyle: "italic" }}>
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
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
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
                  <p style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginTop: 8 }}>
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
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
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
                  <p style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginTop: 8 }}>
                    * Select which platforms are active for this session.
                  </p>
                </div>

                {/* Post Links per Platform */}
                {selectedPlatforms.size > 0 && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Post URLs (Pilihan)</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {platforms.filter(p => selectedPlatforms.has(p.platformID)).map(p => (
                        <div key={p.platformID} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: PLATFORM_COLORS[p.platformName] || "var(--accent)", width: 76, flexShrink: 0 }}>{p.platformName}</span>
                          <input
                            className="input"
                            type="url"
                            placeholder={`URL post ${p.platformName} (optional)`}
                            value={postLinks[p.platformID] || ""}
                            onChange={e => setPostLinks(prev => ({ ...prev, [p.platformID]: e.target.value }))}
                            style={{ height: 34, fontSize: 12 }}
                          />
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-4)", marginTop: 6, fontStyle: "italic" }}>* URL yang sama akan digunakan untuk semua syarikat dalam platform ini. Boleh kemaskini kemudian.</p>
                  </div>
                )}

                {/* Summary */}
                <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: 8, padding: "10px 14px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 4 }}>Session Summary</p>
                  <p style={{ fontSize: 12, color: "var(--text-3)" }}>📅 {new Date(sessionDate + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}</p>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>🏢 {selectedCompanies.size} company selected</p>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>📱 {selectedPlatforms.size} platform selected</p>
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

      {/* ── Confirmation Dialog (replaces native confirm/alert) ── */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} })}
        isLoading={confirmDialog.isLoading}
      />
    </Layout>
  );
}
