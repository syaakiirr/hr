import { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import { useDateFilter, getDateRange, DATE_FILTERS } from "../contexts/DateFilterContext";
import { getStaffEngagementStats, getStaffList, type StaffEngagementStats } from "../services/api";

// ==========================================
// Crisp Lucide SVG Icon Components
// ==========================================

function CheckCheckIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
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
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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

function CheckCircleIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertCircleIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--bg-tag, #f1f5f9)",
        border: "1px solid var(--line, #e2e8f0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "var(--text-2, #475569)",
      }}
    >
      {initials || "U"}
    </div>
  );
}

const ITEMS_PER_PAGE = 15;

export default function StaffEngagementPage() {
  const { filter, setFilter } = useDateFilter();
  const { from, to } = getDateRange(filter);
  const [stats, setStats] = useState<StaffEngagementStats[]>([]);
  const [totalStaffCount, setTotalStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [perfTab, setPerfTab] = useState<"all" | "top" | "mid" | "low">("all");
  const [page, setPage] = useState(1);

  // Fetch true total staff count (unfiltered) once on mount
  useEffect(() => {
    getStaffList()
      .then((data) => setTotalStaffCount(data.length))
      .catch(console.error);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStaffEngagementStats({
        search: search || undefined,
        department: filterDept || undefined,
        status: filterStatus || undefined,
        from,
        to,
      });
      setStats(data);
      setPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterStatus, from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const departments = useMemo(() => {
    return Array.from(new Set(stats.map((s) => s.department).filter(Boolean))) as string[];
  }, [stats]);

  const totalCompleted = useMemo(() => stats.reduce((sum, s) => sum + s.totalCompleted, 0), [stats]);
  const totalMissed = useMemo(() => stats.reduce((sum, s) => sum + s.totalMissed, 0), [stats]);
  const totalEngagements = useMemo(() => stats.reduce((sum, s) => sum + s.totalEngagements, 0), [stats]);
  const overallRate = totalEngagements > 0 ? Math.round((totalCompleted / totalEngagements) * 100) : 0;

  const filteredStats = useMemo(() => {
    return stats.filter((s) => {
      if (perfTab === "top") return s.completionRate >= 75;
      if (perfTab === "mid") return s.completionRate >= 50 && s.completionRate < 75;
      if (perfTab === "low") return s.completionRate < 50;
      return true;
    });
  }, [stats, perfTab]);

  const totalPages = Math.max(1, Math.ceil(filteredStats.length / ITEMS_PER_PAGE));
  const paginatedStats = useMemo(() => {
    return filteredStats.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filteredStats, page]);

  return (
    <Layout>
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Staff Ticks
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              Monitor daily engagement ticks and compliance by staff member
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 2, background: "var(--surface)", padding: 2, borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
              {DATE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "calc(var(--r-md) - 2px)",
                    border: "none",
                    background: filter === f.value ? "var(--accent)" : "transparent",
                    color: filter === f.value ? "#fff" : "var(--text-2)",
                    fontSize: "0.78rem",
                    fontWeight: filter === f.value ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={async () => {
                const { downloadPageAsPDF } = await import("../utils/pdf");
                downloadPageAsPDF("Staff_Engagement");
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <DownloadIcon size={14} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Minimalist Metric Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--r-md)",
              background: "var(--white)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Enrolled Staff</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {totalStaffCount}
              </p>
            </div>
            <span style={{ color: "var(--text-4)" }}><UsersIcon size={16} /></span>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--r-md)",
              background: "var(--white)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Completed Ticks</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#16a34a", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {totalCompleted.toLocaleString()}
              </p>
            </div>
            <span style={{ color: "#16a34a" }}><CheckCircleIcon size={16} /></span>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--r-md)",
              background: "var(--white)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Missed Ticks</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: totalMissed > 0 ? "var(--text-2)" : "var(--text-3)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {totalMissed.toLocaleString()}
              </p>
            </div>
            <span style={{ color: "var(--text-4)" }}><AlertCircleIcon size={16} /></span>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--r-md)",
              background: "var(--white)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Overall Compliance</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: overallRate >= 75 ? "#16a34a" : "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {overallRate}%
              </p>
            </div>
            <span style={{ color: "var(--text-4)" }}><TargetIcon size={16} /></span>
          </div>
        </div>

        {/* Search, Filter Toolbar & Performance Threshold Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              background: "var(--white)",
              padding: "12px 16px",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
              <input
                className="input"
                type="text"
                placeholder="Search staff name or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  paddingLeft: 34,
                  paddingRight: search ? 30 : 12,
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line-2)",
                  height: 38,
                  fontSize: "0.85rem",
                }}
              />
              <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", display: "flex" }}>
                <SearchIcon size={14} />
              </div>
              {search && (
                <button
                  onClick={() => setSearch("")}
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
                  }}
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line-2)",
                background: "var(--white)",
                color: "var(--text-1)",
                fontSize: "0.85rem",
                outline: "none",
                fontWeight: 500,
                cursor: "pointer",
                height: 38,
              }}
            >
              <option value="">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {toTitleCase(d)}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line-2)",
                background: "var(--white)",
                color: "var(--text-1)",
                fontSize: "0.85rem",
                outline: "none",
                fontWeight: 500,
                cursor: "pointer",
                height: 38,
              }}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          {/* Performance Threshold Filter Tabs */}
          <div style={{ display: "flex", gap: 6, background: "var(--surface)", padding: 4, borderRadius: 10, border: "1px solid var(--line)", width: "fit-content", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All Staff", count: stats.length },
              { id: "top", label: "Top Performers (≥75%)", count: stats.filter((s) => s.completionRate >= 75).length },
              { id: "mid", label: "Moderate (50–74%)", count: stats.filter((s) => s.completionRate >= 50 && s.completionRate < 75).length },
              { id: "low", label: "Needs Attention (<50%)", count: stats.filter((s) => s.completionRate < 50).length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setPerfTab(tab.id as any);
                  setPage(1);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 7,
                  border: "none",
                  background: perfTab === tab.id ? "var(--accent)" : "transparent",
                  color: perfTab === tab.id ? "#fff" : "var(--text-2)",
                  fontSize: 12,
                  fontWeight: perfTab === tab.id ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 99,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: perfTab === tab.id ? "rgba(255,255,255,0.25)" : "var(--surface-2)",
                    color: perfTab === tab.id ? "#fff" : "var(--text-3)",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Table */}
        <div
          style={{
            background: "var(--white)",
            borderRadius: 20,
            border: "1px solid var(--line)",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-3)" }}>
              <div className="spin" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 500 }}>Loading engagement statistics...</p>
            </div>
          ) : filteredStats.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--text-3)" }}>
                <CheckCheckIcon size={24} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>No Matching Records</h3>
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem", maxWidth: 400, margin: "0 auto 16px" }}>
                No staff engagement data found for the selected filters and date range.
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
                      <th style={{ width: 65, textAlign: "center", padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        #
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        Staff Member
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        Department
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        Position
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textAlign: "center", width: 95 }}>
                        Status
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textAlign: "center" }}>
                        Completed Ticks
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textAlign: "center" }}>
                        Missed Ticks
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textAlign: "left", minWidth: 160 }}>
                        Compliance Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStats.map((stat, idx) => (
                      <tr
                        key={stat.staffID}
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
                        <td style={{ textAlign: "center", padding: "14px 18px", fontSize: 12.5, color: "var(--text-4)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                          {(page - 1) * ITEMS_PER_PAGE + idx + 1 < 10 ? `0${(page - 1) * ITEMS_PER_PAGE + idx + 1}` : (page - 1) * ITEMS_PER_PAGE + idx + 1}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Avatar name={stat.fullName} />
                            <div>
                              <p style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.9rem", lineHeight: 1.3 }}>
                                {toTitleCase(stat.fullName)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          {stat.department ? (
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "0.82rem",
                                fontWeight: 500,
                                color: "var(--text-2)",
                              }}
                            >
                              {toTitleCase(stat.department)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-4)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: "0.84rem", color: "var(--text-2)" }}>
                          {stat.position ? toTitleCase(stat.position) : <span style={{ color: "var(--text-4)" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 99,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: stat.status === "Active" ? "var(--green-soft)" : "var(--red-soft)",
                              color: stat.status === "Active" ? "var(--green)" : "var(--red)",
                              border: stat.status === "Active" ? "1px solid var(--green-line)" : "1px solid var(--red-line)",
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: stat.status === "Active" ? "var(--green)" : "var(--red)",
                              }}
                            />
                            <span>{stat.status}</span>
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>
                            {stat.totalCompleted}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.92rem", fontWeight: 800, color: stat.totalMissed > 0 ? "var(--red)" : "var(--text-4)", fontVariantNumeric: "tabular-nums" }}>
                            {stat.totalMissed}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 145 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.78rem" }}>
                              <span style={{ fontWeight: 700, color: stat.completionRate >= 75 ? "var(--green)" : stat.completionRate >= 50 ? "var(--amber)" : "var(--red)" }}>
                                {stat.completionRate}%
                              </span>
                              <span style={{ color: "var(--text-4)", fontSize: "0.72rem" }}>
                                {stat.totalCompleted}/{stat.totalEngagements}
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
                                  width: `${Math.min(100, Math.max(0, stat.completionRate))}%`,
                                  height: "100%",
                                  borderRadius: 3,
                                  background:
                                    stat.completionRate >= 75
                                      ? "var(--green)"
                                      : stat.completionRate >= 50
                                      ? "var(--amber)"
                                      : "var(--red)",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modern Pagination Footer */}
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: "0.82rem", color: "var(--text-3)", fontWeight: 500 }}>
                  Showing <strong style={{ color: "var(--text-1)" }}>{(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredStats.length)}</strong> of <strong style={{ color: "var(--text-1)" }}>{filteredStats.length}</strong> staff members
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "5px 12px", fontSize: 12, opacity: page === 1 ? 0.35 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
                  >
                    <ChevronLeftIcon size={14} />
                    <span>Prev</span>
                  </button>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-2)", padding: "0 6px" }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "5px 12px", fontSize: 12, opacity: page >= totalPages ? 0.35 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
                  >
                    <span>Next</span>
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
