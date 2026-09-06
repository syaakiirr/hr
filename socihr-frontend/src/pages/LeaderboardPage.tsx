import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import { getLeaderboard, getDepartments, type LeaderboardEntry, type Department } from "../services/api";
import { useDateFilter, getDateRange } from "../contexts/DateFilterContext";

// ==========================================
// Crisp Lucide SVG Icon Components
// ==========================================

function TrophyIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34" />
      <path d="M18 14.66V17c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12v7a6 6 0 0 1-12 0V4z" />
    </svg>
  );
}

function CrownIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.2a2 2 0 0 1-1.926 1.467H6.779a2 2 0 0 1-1.926-1.467L2.019 6.019a.5.5 0 0 1 .798-.519l4.277 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

function MedalIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
      <path d="M11 12 5.12 2.2" />
      <path d="m13 12 5.88-9.8" />
      <path d="M8 7h8" />
      <circle cx="12" cy="17" r="5" />
      <path d="M12 18v-2h-.5" />
    </svg>
  );
}

function AwardIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function GemIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M11 3 8 9l4 12 4-12-3-6" />
      <path d="M2 9h20" />
    </svg>
  );
}

function ThumbsUpIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3" />
      <path d="M7 10V5a2 2 0 0 1 2-2h.34a2 2 0 0 1 1.96 1.6l.8 3.28" />
    </svg>
  );
}

function MessageSquareIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function SearchIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function XIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function InfoIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ChevronLeftIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronsLeftIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </svg>
  );
}

function ChevronsRightIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  );
}

function ArrowUpIcon({ size = 12, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDownIcon({ size = 12, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function UsersIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ActivityIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function TargetIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function BuildingIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" />
      <path d="M8 10h.01" /><path d="M16 10h.01" />
      <path d="M8 14h.01" /><path d="M16 14h.01" />
    </svg>
  );
}

// ==========================================
// Formatting Helpers for Clean Title Casing
// ==========================================

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

type SortField = "rank" | "fullName" | "department" | "score" | "completed" | "completionRate";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 10;

export default function LeaderboardPage() {
  const { filter } = useDateFilter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { from, to } = getDateRange(filter);
        const [lbData, deptData] = await Promise.all([
          getLeaderboard({
            from: from || undefined,
            to: to || undefined,
            department: selectedDept === "All" ? undefined : selectedDept,
          }),
          getDepartments(),
        ]);
        setLeaderboard(lbData);
        setDepartments(deptData);
      } catch (err) {
        console.error("Failed to load leaderboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filter, selectedDept]);

  // Handle column sort toggle
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "fullName" || field === "department" || field === "rank" ? "asc" : "desc");
    }
  }

  // Copy staff name helper
  function handleCopyStaffName(name: string, id: string) {
    navigator.clipboard.writeText(name);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Export CSV
  function handleExportCsv() {
    if (leaderboard.length === 0) return;
    const headers = ["Rank", "Staff Name", "Department", "Position", "Score", "Likes", "Comments", "Shares", "Completed", "Total", "Completion Rate (%)", "Tier"];
    const rows = sortedList.map((s) => [
      s.rank,
      `"${s.fullName.replace(/"/g, '""')}"`,
      `"${s.department.replace(/"/g, '""')}"`,
      `"${s.position.replace(/"/g, '""')}"`,
      s.score,
      s.likes,
      s.comments,
      s.shares,
      s.completed,
      s.total,
      s.completionRate,
      s.tier,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SociHR_Leaderboard_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtered and sorted data
  const sortedList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = leaderboard.filter(
      (item) =>
        item.fullName.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query) ||
        item.position.toLowerCase().includes(query)
    );

    return filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === "string") {
        const strA = aVal.toLowerCase();
        const strB = (bVal as string).toLowerCase();
        if (strA < strB) return sortDirection === "asc" ? -1 : 1;
        if (strA > strB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      } else {
        const numA = (aVal as number) ?? 0;
        const numB = (bVal as number) ?? 0;
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
    });
  }, [leaderboard, searchQuery, sortField, sortDirection]);

  // Aggregate Metrics for Executive KPI bar
  const summaryMetrics = useMemo(() => {
    if (leaderboard.length === 0) return null;
    const totalScore = leaderboard.reduce((acc, cur) => acc + (cur.score || 0), 0);
    const avgScore = Math.round(totalScore / leaderboard.length);
    const totalRate = leaderboard.reduce((acc, cur) => acc + (cur.completionRate || 0), 0);
    const avgRate = Math.round(totalRate / leaderboard.length);
    
    // Top department by score
    const deptMap: Record<string, number> = {};
    leaderboard.forEach((s) => {
      deptMap[s.department] = (deptMap[s.department] || 0) + s.score;
    });
    let topDept = "General";
    let maxDeptScore = 0;
    Object.entries(deptMap).forEach(([dept, score]) => {
      if (score > maxDeptScore) {
        maxDeptScore = score;
        topDept = dept;
      }
    });

    return {
      totalStaff: leaderboard.length,
      avgScore,
      avgRate,
      topDept,
    };
  }, [leaderboard]);

  // Reset to page 1 on query, dept, or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, sortField, sortDirection]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedList.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedList = sortedList.slice(startIndex, endIndex);

  // Podium top 3 (always extracted from base rank order)
  const top1 = leaderboard.length > 0 ? leaderboard[0] : null;
  const top2 = leaderboard.length > 1 ? leaderboard[1] : null;
  const top3 = leaderboard.length > 2 ? leaderboard[2] : null;

  return (
    <Layout>
      <div style={{ padding: "32px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Page Header with Ambient Lighting */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.1) 100%)",
                  border: "1px solid rgba(245,158,11,0.35)",
                  color: "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 14px rgba(245,158,11,0.18)",
                }}
              >
                <TrophyIcon size={24} color="#d97706" />
              </div>
              <div>
                <h1 style={{ fontSize: "1.55rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.03em" }}>
                  Staff Engagement Leaderboard
                </h1>
                <p style={{ fontSize: "0.86rem", color: "var(--text-3)", marginTop: 2 }}>
                  Real-time gamified ranking and recognition based on weighted social media interactions
                </p>
              </div>
            </div>
          </div>

          {/* Action Header Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Scoring Rules Trigger Modal */}
            <button
              onClick={() => setShowRulesModal(true)}
              className="btn btn-secondary btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                fontWeight: 600,
                fontSize: 12.5,
              }}
              title="Click to view full scoring formula & tier breakdown"
            >
              <InfoIcon size={14} color="var(--accent)" />
              <span>Scoring Rules</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              disabled={leaderboard.length === 0}
              className="btn btn-secondary btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                fontWeight: 600,
                fontSize: 12.5,
              }}
              title="Download full leaderboard as CSV"
            >
              <DownloadIcon size={14} color="currentColor" />
              <span>Export CSV</span>
            </button>

            {/* Search input */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search staff, dept, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 30px 8px 34px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line-2)",
                  background: "var(--white)",
                  color: "var(--text-1)",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                  width: 220,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              />
              <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", display: "flex" }}>
                <SearchIcon size={14} />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-3)",
                    padding: 2,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Clear search"
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line-2)",
                background: "var(--white)",
                color: "var(--text-1)",
                fontSize: "var(--text-sm)",
                outline: "none",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <option value="All">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d.departmentID} value={d.departmentName}>
                  {d.departmentName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Executive Quick Stats Banner */}
        {summaryMetrics && !loading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 14,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderRadius: "var(--r-lg)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.1)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UsersIcon size={18} />
              </div>
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                  Active Staff
                </p>
                <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-1)", marginTop: 1 }}>
                  {summaryMetrics.totalStaff} <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-3)" }}>members</span>
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "14px 18px",
                borderRadius: "var(--r-lg)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(245,158,11,0.1)", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ActivityIcon size={18} />
              </div>
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                  Average Score
                </p>
                <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-1)", marginTop: 1 }}>
                  {summaryMetrics.avgScore.toLocaleString()} <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-3)" }}>pts</span>
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "14px 18px",
                borderRadius: "var(--r-lg)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16,185,129,0.1)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TargetIcon size={18} />
              </div>
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                  Avg Completion
                </p>
                <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-1)", marginTop: 1 }}>
                  {summaryMetrics.avgRate}% <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-3)" }}>rate</span>
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "14px 18px",
                borderRadius: "var(--r-lg)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(14,165,233,0.1)", color: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BuildingIcon size={18} />
              </div>
              <div style={{ overflow: "hidden" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                  Leading Dept
                </p>
                <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-1)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {toTitleCase(summaryMetrics.topDept)}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-3)" }}>
            <div className="spin" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontWeight: 500 }}>Calculating staff scores & ranking podium...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--white)",
              borderRadius: "var(--r-xl)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--text-3)" }}>
              <InfoIcon size={24} />
            </div>
            <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>No Leaderboard Records Found</h3>
            <p style={{ color: "var(--text-3)", fontSize: "var(--text-sm)", maxWidth: 420, margin: "0 auto 16px" }}>
              There are no recorded staff engagement tasks for the selected date period.
            </p>
            {selectedDept !== "All" && (
              <button onClick={() => setSelectedDept("All")} className="btn btn-secondary btn-sm">
                Reset Department Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Top 3 Podium Showcase */}
            {searchQuery === "" && selectedDept === "All" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 22,
                  marginBottom: 38,
                  alignItems: "flex-end",
                  maxWidth: 1040,
                  margin: "0 auto 38px",
                }}
              >
                {/* 2nd Place (Silver) */}
                {top2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)",
                      borderRadius: 20,
                      border: "1px solid rgba(148, 163, 184, 0.45)",
                      padding: "24px 18px 16px",
                      textAlign: "center",
                      position: "relative",
                      boxShadow: "0 8px 24px -4px rgba(100, 116, 139, 0.12)",
                      height: 310,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: -13,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "linear-gradient(135deg, #64748b, #475569)",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 10.5,
                        letterSpacing: "0.06em",
                        padding: "3px 14px",
                        borderRadius: 99,
                        boxShadow: "0 2px 10px rgba(100,116,139,0.35)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <MedalIcon size={12} color="#fff" />
                      <span>2ND PLACE</span>
                    </div>
                    <div>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #e2e8f0, #cbd5e1)",
                          color: "#1e293b",
                          fontSize: 20,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "6px auto 8px",
                          border: "2px solid #94a3b8",
                          boxShadow: "0 3px 10px rgba(148, 163, 184, 0.2)",
                        }}
                      >
                        {top2.fullName.charAt(0)}
                      </div>
                      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <h3 style={{ fontSize: "0.96rem", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {toTitleCase(top2.fullName)}
                        </h3>
                      </div>
                      <div style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                        <p style={{ fontSize: "0.76rem", color: "var(--text-3)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {toTitleCase(top2.department)} • {toTitleCase(top2.position)}
                        </p>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                          }}
                        >
                          {top2.score.toLocaleString()} pts
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: "var(--green-soft)",
                            color: "var(--green)",
                          }}
                        >
                          {top2.completionRate}% Rate
                        </span>
                      </div>
                    </div>
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "center", gap: 14, fontSize: 11, color: "var(--text-3)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ThumbsUpIcon size={12} color="var(--blue)" /> {top2.likes}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MessageSquareIcon size={12} color="var(--accent)" /> {top2.comments}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ShareIcon size={12} color="var(--green)" /> {top2.shares}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place (Gold Crown) */}
                {top1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(254,243,199,0.2) 100%)",
                      borderRadius: 22,
                      border: "2px solid #f59e0b",
                      padding: "26px 20px 20px",
                      textAlign: "center",
                      position: "relative",
                      boxShadow: "0 14px 38px rgba(245, 158, 11, 0.22)",
                      height: 355,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: -15,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "linear-gradient(135deg, #f59e0b, #d97706)",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        padding: "4px 18px",
                        borderRadius: 99,
                        boxShadow: "0 4px 14px rgba(245, 158, 11, 0.45)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <CrownIcon size={13} color="#fff" />
                      <span>TOP PERFORMER</span>
                    </div>
                    <div>
                      <div
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #fde68a, #f59e0b)",
                          color: "#78350f",
                          fontSize: 26,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "8px auto 8px",
                          border: "3px solid #fff",
                          boxShadow: "0 6px 18px rgba(245, 158, 11, 0.35)",
                        }}
                      >
                        {top1.fullName.charAt(0)}
                      </div>
                      <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <h3 style={{ fontSize: "1.08rem", fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {toTitleCase(top1.fullName)}
                        </h3>
                      </div>
                      <div style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-3)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {toTitleCase(top1.department)} • {toTitleCase(top1.position)}
                        </p>
                      </div>
                      <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 800,
                            padding: "4px 12px",
                            borderRadius: 14,
                            background: "var(--amber-soft)",
                            color: "var(--amber)",
                          }}
                        >
                          {top1.score.toLocaleString()} pts
                        </span>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 800,
                            padding: "4px 12px",
                            borderRadius: 14,
                            background: "var(--green-soft)",
                            color: "var(--green)",
                          }}
                        >
                          {top1.completionRate}% Rate
                        </span>
                      </div>
                    </div>
                    <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "center", gap: 16, fontSize: 11.5, color: "var(--text-2)", fontWeight: 600 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--blue)" }}>
                        <ThumbsUpIcon size={13} color="var(--blue)" /> {top1.likes}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent)" }}>
                        <MessageSquareIcon size={13} color="var(--accent)" /> {top1.comments}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--green)" }}>
                        <ShareIcon size={13} color="var(--green)" /> {top1.shares}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place (Bronze) */}
                {top3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 100%)",
                      borderRadius: 20,
                      border: "1px solid rgba(217, 119, 6, 0.4)",
                      padding: "24px 18px 16px",
                      textAlign: "center",
                      position: "relative",
                      boxShadow: "0 8px 24px -4px rgba(217, 119, 6, 0.14)",
                      height: 310,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: -13,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "linear-gradient(135deg, #d97706, #b45309)",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 10.5,
                        letterSpacing: "0.06em",
                        padding: "3px 14px",
                        borderRadius: 99,
                        boxShadow: "0 2px 10px rgba(217, 119, 6, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <MedalIcon size={12} color="#fff" />
                      <span>3RD PLACE</span>
                    </div>
                    <div>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #fed7aa, #d97706)",
                          color: "#7c2d12",
                          fontSize: 20,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "6px auto 8px",
                          border: "2px solid #ea580c",
                          boxShadow: "0 3px 10px rgba(234, 88, 12, 0.2)",
                        }}
                      >
                        {top3.fullName.charAt(0)}
                      </div>
                      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <h3 style={{ fontSize: "0.96rem", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {toTitleCase(top3.fullName)}
                        </h3>
                      </div>
                      <div style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                        <p style={{ fontSize: "0.76rem", color: "var(--text-3)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {toTitleCase(top3.department)} • {toTitleCase(top3.position)}
                        </p>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                          }}
                        >
                          {top3.score.toLocaleString()} pts
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: "var(--green-soft)",
                            color: "var(--green)",
                          }}
                        >
                          {top3.completionRate}% Rate
                        </span>
                      </div>
                    </div>
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "center", gap: 14, fontSize: 11, color: "var(--text-3)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ThumbsUpIcon size={12} color="var(--blue)" /> {top3.likes}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MessageSquareIcon size={12} color="var(--accent)" /> {top3.comments}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ShareIcon size={12} color="var(--green)" /> {top3.shares}
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Complete Ranking Table - Impeccable & Taste Design */}
            <div
              style={{
                background: "var(--white)",
                borderRadius: 20,
                border: "1px solid var(--line)",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
                overflow: "hidden",
              }}
            >
              {/* Header section with summary */}
              <div
                style={{
                  padding: "18px 26px",
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-1)" }}>
                    Staff Rankings
                  </h3>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "2px 9px",
                      borderRadius: 99,
                      background: "var(--surface-2)",
                      color: "var(--text-3)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {sortedList.length} Total Staff
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--text-3)" }}>
                  <span>Showing page {currentPage} of {totalPages}</span>
                  <span>•</span>
                  <span>Click column to sort</span>
                </div>
              </div>

              {/* Table Container */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
                      <th
                        onClick={() => handleSort("rank")}
                        style={{
                          padding: "14px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-3)",
                          cursor: "pointer",
                          userSelect: "none",
                          width: 70,
                          textAlign: "center",
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span>Rank</span>
                          {sortField === "rank" ? (
                            sortDirection === "asc" ? <ArrowUpIcon size={11} color="var(--accent)" /> : <ArrowDownIcon size={11} color="var(--accent)" />
                          ) : null}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("fullName")}
                        style={{
                          padding: "14px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-3)",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span>Staff Member</span>
                          {sortField === "fullName" ? (
                            sortDirection === "asc" ? <ArrowUpIcon size={11} color="var(--accent)" /> : <ArrowDownIcon size={11} color="var(--accent)" />
                          ) : null}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("department")}
                        style={{
                          padding: "14px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-3)",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span>Department</span>
                          {sortField === "department" ? (
                            sortDirection === "asc" ? <ArrowUpIcon size={11} color="var(--accent)" /> : <ArrowDownIcon size={11} color="var(--accent)" />
                          ) : null}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("score")}
                        style={{
                          padding: "14px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-3)",
                          cursor: "pointer",
                          userSelect: "none",
                          textAlign: "right",
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4, width: "100%" }}>
                          <span>Total Score</span>
                          {sortField === "score" ? (
                            sortDirection === "asc" ? <ArrowUpIcon size={11} color="var(--accent)" /> : <ArrowDownIcon size={11} color="var(--accent)" />
                          ) : null}
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "14px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-3)",
                          textAlign: "center",
                        }}
                      >
                        <span>Social Engagement</span>
                      </th>
                      <th
                        onClick={() => handleSort("completionRate")}
                        style={{
                          padding: "14px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-3)",
                          cursor: "pointer",
                          userSelect: "none",
                          textAlign: "left",
                          minWidth: 160,
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span>Completion</span>
                          {sortField === "completionRate" ? (
                            sortDirection === "asc" ? <ArrowUpIcon size={11} color="var(--accent)" /> : <ArrowDownIcon size={11} color="var(--accent)" />
                          ) : null}
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "14px 20px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-3)",
                          textAlign: "center",
                          width: 115,
                        }}
                      >
                        <span>Tier</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedList.map((staff) => (
                      <tr
                        key={staff.staffID}
                        style={{
                          borderBottom: "1px solid var(--line)",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.03)";
                          e.currentTarget.style.transform = "translateX(2px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.transform = "translateX(0px)";
                        }}
                      >
                        {/* Rank */}
                        <td style={{ padding: "16px 20px", textAlign: "center" }}>
                          {staff.rank === 1 ? (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                                border: "1px solid #f59e0b",
                                color: "#b45309",
                                fontWeight: 800,
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto",
                                boxShadow: "0 2px 8px rgba(245, 158, 11, 0.25)",
                              }}
                            >
                              1
                            </div>
                          ) : staff.rank === 2 ? (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
                                border: "1px solid #94a3b8",
                                color: "#475569",
                                fontWeight: 800,
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto",
                                boxShadow: "0 2px 8px rgba(148, 163, 184, 0.2)",
                              }}
                            >
                              2
                            </div>
                          ) : staff.rank === 3 ? (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #ffedd5, #fed7aa)",
                                border: "1px solid #ea580c",
                                color: "#c2410c",
                                fontWeight: 800,
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto",
                                boxShadow: "0 2px 8px rgba(234, 88, 12, 0.2)",
                              }}
                            >
                              3
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-4)", fontFamily: "var(--font-mono, monospace)" }}>
                              {staff.rank < 10 ? `0${staff.rank}` : staff.rank}
                            </span>
                          )}
                        </td>

                        {/* Staff Member Info */}
                        <td style={{ padding: "16px 20px" }}>
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                            onClick={() => handleCopyStaffName(staff.fullName, staff.staffID)}
                            title="Click to copy full name"
                          >
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                background: staff.rank <= 3 ? "var(--accent-soft)" : "var(--surface-2)",
                                color: staff.rank <= 3 ? "var(--accent)" : "var(--text-2)",
                                fontWeight: 800,
                                fontSize: 14,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                border: "1px solid var(--line-2)",
                              }}
                            >
                              {staff.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={{ fontWeight: 650, color: "var(--text-1)", fontSize: "0.92rem", lineHeight: 1.3 }}>
                                  {toTitleCase(staff.fullName)}
                                </p>
                                {copiedId === staff.staffID && (
                                  <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>
                                    Copied!
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 1 }}>
                                {toTitleCase(staff.position)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td style={{ padding: "16px 20px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: "0.83rem",
                              fontWeight: 500,
                              color: "var(--text-2)",
                            }}
                          >
                            {toTitleCase(staff.department)}
                          </span>
                        </td>

                        {/* Score */}
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                            <span style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                              {staff.score.toLocaleString()}
                            </span>
                            <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              points
                            </span>
                          </div>
                        </td>

                        {/* Social Activity Metrics Group */}
                        <td style={{ padding: "16px 20px", textAlign: "center" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "5px 12px",
                              borderRadius: 99,
                              background: "var(--surface)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            <span title={`${staff.likes} Likes (1 pt)`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-2)" }}>
                              <ThumbsUpIcon size={12} color="var(--blue)" />
                              <span>{staff.likes}</span>
                            </span>
                            <span style={{ color: "var(--line-2)", fontSize: 11 }}>•</span>
                            <span title={`${staff.comments} Comments (2 pts)`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-2)" }}>
                              <MessageSquareIcon size={12} color="var(--accent)" />
                              <span>{staff.comments}</span>
                            </span>
                            <span style={{ color: "var(--line-2)", fontSize: 11 }}>•</span>
                            <span title={`${staff.shares} Shares (3 pts)`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-2)" }}>
                              <ShareIcon size={12} color="var(--green)" />
                              <span>{staff.shares}</span>
                            </span>
                          </div>
                        </td>

                        {/* Completion / Progress */}
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 145 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.78rem" }}>
                              <span style={{ fontWeight: 700, color: staff.completionRate >= 75 ? "var(--green)" : staff.completionRate >= 50 ? "var(--amber)" : "var(--red)" }}>
                                {staff.completionRate}%
                              </span>
                              <span style={{ color: "var(--text-4)", fontSize: "0.72rem" }}>
                                {staff.completed}/{staff.total}
                              </span>
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: 5,
                                borderRadius: 3,
                                background: "var(--surface-2)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, staff.completionRate))}%`,
                                  height: "100%",
                                  borderRadius: 3,
                                  background:
                                    staff.completionRate >= 75
                                      ? "var(--green)"
                                      : staff.completionRate >= 50
                                      ? "var(--amber)"
                                      : "var(--red)",
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Tier */}
                        <td style={{ padding: "16px 20px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "4px 11px",
                              borderRadius: 99,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background:
                                staff.tier === "Diamond"
                                  ? "rgba(99,102,241,0.1)"
                                  : staff.tier === "Gold"
                                  ? "var(--amber-soft)"
                                  : staff.tier === "Silver"
                                  ? "var(--surface-2)"
                                  : "var(--red-soft)",
                              color:
                                staff.tier === "Diamond"
                                  ? "#6366f1"
                                  : staff.tier === "Gold"
                                  ? "var(--amber)"
                                  : staff.tier === "Silver"
                                  ? "var(--text-2)"
                                  : "var(--red)",
                              border:
                                staff.tier === "Diamond"
                                  ? "1px solid rgba(99,102,241,0.25)"
                                  : staff.tier === "Gold"
                                  ? "1px solid var(--amber-line)"
                                  : "1px solid var(--line)",
                            }}
                          >
                            {staff.tier === "Diamond" && <GemIcon size={11} color="#6366f1" />}
                            {staff.tier === "Gold" && <CrownIcon size={11} color="var(--amber)" />}
                            {staff.tier === "Silver" && <MedalIcon size={11} color="var(--text-2)" />}
                            {staff.tier === "Bronze" && <AwardIcon size={11} color="var(--red)" />}
                            <span>{staff.tier}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar (Max 1-10 per page) */}
              <div
                style={{
                  padding: "16px 26px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: "0.83rem", color: "var(--text-3)", fontWeight: 500 }}>
                  Showing <strong style={{ color: "var(--text-1)" }}>{sortedList.length === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, sortedList.length)}</strong> of <strong style={{ color: "var(--text-1)" }}>{sortedList.length}</strong> staff members
                </div>

                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {/* First Page */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="btn btn-secondary btn-icon btn-sm"
                      style={{ width: 32, height: 32, padding: 0, opacity: currentPage === 1 ? 0.35 : 1, cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
                      title="First Page"
                    >
                      <ChevronsLeftIcon size={14} />
                    </button>

                    {/* Previous Page */}
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-secondary btn-icon btn-sm"
                      style={{ width: 32, height: 32, padding: 0, opacity: currentPage === 1 ? 0.35 : 1, cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
                      title="Previous Page"
                    >
                      <ChevronLeftIcon size={14} />
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                      })
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <span key={page} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {prev && page - prev > 1 && (
                              <span style={{ fontSize: 12, color: "var(--text-4)", padding: "0 3px" }}>…</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "var(--r-sm)",
                                border: page === currentPage ? "1px solid var(--accent)" : "1px solid var(--line-2)",
                                background: page === currentPage ? "var(--accent)" : "var(--white)",
                                color: page === currentPage ? "#fff" : "var(--text-2)",
                                fontSize: 12.5,
                                fontWeight: page === currentPage ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.15s",
                                boxShadow: page === currentPage ? "0 2px 6px rgba(99, 102, 241, 0.3)" : "none",
                              }}
                            >
                              {page}
                            </button>
                          </span>
                        );
                      })}

                    {/* Next Page */}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary btn-icon btn-sm"
                      style={{ width: 32, height: 32, padding: 0, opacity: currentPage === totalPages ? 0.35 : 1, cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}
                      title="Next Page"
                    >
                      <ChevronRightIcon size={14} />
                    </button>

                    {/* Last Page */}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary btn-icon btn-sm"
                      style={{ width: 32, height: 32, padding: 0, opacity: currentPage === totalPages ? 0.35 : 1, cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}
                      title="Last Page"
                    >
                      <ChevronsRightIcon size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Scoring Rules Explanation Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setShowRulesModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "var(--white)",
                borderRadius: 22,
                padding: 26,
                width: "100%",
                maxWidth: 490,
                boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--line)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <InfoIcon size={18} color="var(--accent)" />
                  </div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-1)" }}>
                    Scoring & Tier System
                  </h3>
                </div>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label="Close modal"
                >
                  <XIcon size={14} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>
                    Weighted Point Formula:
                  </p>
                  <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, color: "var(--accent)", fontWeight: 700, background: "var(--white)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                    Total Score = (Completed × 10) + (Shares × 3) + (Comments × 2) + (Likes × 1)
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 10 }}>
                    Performance Tiers:
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ padding: "12px 14px", borderRadius: 10, background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <GemIcon size={13} color="#6366f1" />
                        <p style={{ fontSize: 12, fontWeight: 800, color: "#6366f1" }}>Diamond Tier</p>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>90% – 100% Completion</p>
                    </div>
                    <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--amber-soft)", border: "1px solid var(--amber-line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CrownIcon size={13} color="var(--amber)" />
                        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--amber)" }}>Gold Tier</p>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>75% – 89% Completion</p>
                    </div>
                    <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <MedalIcon size={13} color="var(--text-2)" />
                        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-2)" }}>Silver Tier</p>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>50% – 74% Completion</p>
                    </div>
                    <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--red-soft)", border: "1px solid var(--red-line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <AwardIcon size={13} color="var(--red)" />
                        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--red)" }}>Bronze Tier</p>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>&lt; 50% Completion</p>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>
                  Rankings update in real time as daily monitoring sessions and social engagements are logged by team leads and administrators.
                </p>
              </div>

              <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setShowRulesModal(false)} className="btn btn-primary btn-sm" style={{ width: "100%", padding: "10px 0", fontSize: 13 }}>
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
