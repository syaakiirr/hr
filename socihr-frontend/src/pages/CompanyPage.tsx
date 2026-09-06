import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { use, graphic, init, getInstanceByDom, dispose } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import Layout from "../components/Layout";
import ConfirmationDialog from "../components/ConfirmationDialog";
import { useDateFilter, getDateRange, DATE_FILTERS } from "../contexts/DateFilterContext";
import {
  getCompanies,
  createCompany,
  deleteCompany,
  getCompanyPerformance,
  type Company,
} from "../services/api";

const treeShakenECharts = { use, graphic, init, getInstanceByDom, dispose };
use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

// ==========================================
// Crisp Lucide SVG Icon Components
// ==========================================

function BriefcaseIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function PlusIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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

function TrashIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CrownIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.2a2 2 0 0 1-1.926 1.467H6.779a2 2 0 0 1-1.926-1.467L2.019 6.019a.5.5 0 0 1 .798-.519l4.277 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
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

function TrendingUpIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
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

const COMPANY_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e"];

const lightChartTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#64748b", fontFamily: "Inter, sans-serif", fontSize: 11 },
};

const customTooltip = {
  backgroundColor: "rgba(255, 255, 255, 0.98)",
  borderColor: "#e2e8f0",
  borderWidth: 1,
  textStyle: { color: "#0f172a", fontFamily: "Inter, sans-serif", fontSize: 12 },
  extraCssText: "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 10px; padding: 10px 14px;",
};

export default function CompanyPage() {
  const { filter, setFilter } = useDateFilter();
  const { from, to } = getDateRange(filter);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [performance, setPerformance] = useState<{ companyID: string; company: string; completed: number; missed: number; total: number; rate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
    danger?: boolean;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compList, perfList] = await Promise.all([
        getCompanies(),
        getCompanyPerformance(from, to),
      ]);
      setCompanies(compList);
      setPerformance(perfList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setSaving(true);
    try {
      await createCompany(newCompanyName.trim());
      setNewCompanyName("");
      setShowAddModal(false);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteCompany(id: string, name: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Company",
      message: `Delete "${toTitleCase(name)}"? This cannot be undone. Will fail if the company is currently referenced in active monitoring sessions.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await deleteCompany(id);
          await fetchData();
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : "Failed to delete company.");
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      },
    });
  }

  // Combine full company list with performance stats
  const displayCompanies = useMemo(() => {
    return companies
      .map((c, i) => {
        const perf = performance.find((p) => p.companyID === c.companyID);
        const color = COMPANY_COLORS[i % COMPANY_COLORS.length];
        return {
          companyID: c.companyID,
          companyName: c.companyName,
          completed: perf?.completed ?? 0,
          missed: perf?.missed ?? 0,
          total: perf?.total ?? 0,
          rate: perf?.rate ?? 0,
          color,
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [companies, performance]);

  // Executive KPI summary metrics
  const summaryMetrics = useMemo(() => {
    if (companies.length === 0) return null;
    const totalCompleted = displayCompanies.reduce((acc, cur) => acc + cur.completed, 0);
    const totalEngagements = displayCompanies.reduce((acc, cur) => acc + cur.total, 0);
    const avgRate = totalEngagements > 0 ? Math.round((totalCompleted / totalEngagements) * 100) : 0;
    const topCompany = displayCompanies.length > 0 && displayCompanies[0].total > 0 ? displayCompanies[0].companyName : "None yet";

    return {
      totalCompanies: companies.length,
      topCompany,
      avgRate,
      totalCompleted,
    };
  }, [companies, displayCompanies]);

  // Memoized company chart options
  const companyChartOption = useMemo(() => {
    const sortedPerf = [...performance].sort((a, b) => a.rate - b.rate); // Ascending for horizontal bar

    return {
      ...lightChartTheme,
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "axis" as const,
        ...customTooltip,
        formatter: (params: any) => {
          const item = params[0];
          return `<strong>${item.name}</strong><br/>Compliance Rate: <strong>${item.value}%</strong>`;
        },
      },
      grid: { left: 16, right: 46, bottom: 10, top: 20, containLabel: true },
      xAxis: {
        type: "value" as const,
        max: 100,
        axisLabel: { color: "#94a3b8", formatter: "{value}%", fontSize: 11 },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      yAxis: {
        type: "category" as const,
        data: sortedPerf.map((c) => toTitleCase(c.company)),
        axisLabel: { color: "#334155", fontWeight: 600, fontSize: 11.5 },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series: [
        {
          name: "Completion Rate",
          type: "bar" as const,
          barMaxWidth: 20,
          showBackground: true,
          backgroundStyle: { color: "rgba(241, 245, 249, 0.6)", borderRadius: [0, 6, 6, 0] },
          data: sortedPerf.map((c, i) => {
            const originalIdx = performance.findIndex((orig) => orig.companyID === c.companyID);
            const color = COMPANY_COLORS[originalIdx >= 0 ? originalIdx % COMPANY_COLORS.length : i % COMPANY_COLORS.length];
            return {
              value: c.rate,
              itemStyle: {
                color: new graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: color + "90" },
                  { offset: 1, color: color },
                ]),
                borderRadius: [0, 6, 6, 0],
              },
            };
          }),
          label: {
            show: true,
            position: "right" as const,
            color: "#1e293b",
            fontSize: 11.5,
            formatter: (p: { value: number }) => `${Math.round(p.value)}%`,
            fontWeight: 700,
          },
        },
      ],
    };
  }, [performance]);

  return (
    <Layout>
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Companies
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              Track compliance rates and engagement statistics by company
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
                downloadPageAsPDF("Company_Performance");
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <DownloadIcon size={14} />
              <span>Export PDF</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600 }}
            >
              <PlusIcon size={14} color="#fff" />
              <span>Add Company</span>
            </button>
          </div>
        </div>

        {/* Minimalist Metric Strip */}
        {summaryMetrics && !loading && (
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
                <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Companies</span>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {summaryMetrics.totalCompanies}
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><BriefcaseIcon size={16} /></span>
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
              <div style={{ overflow: "hidden", paddingRight: 8 }}>
                <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Top Performer</span>
                <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-1)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {toTitleCase(summaryMetrics.topCompany)}
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><CrownIcon size={16} /></span>
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
                <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Avg Compliance</span>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: summaryMetrics.avgRate >= 75 ? "#16a34a" : "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {summaryMetrics.avgRate}%
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><TargetIcon size={16} /></span>
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
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {summaryMetrics.totalCompleted.toLocaleString()}
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><TrendingUpIcon size={16} /></span>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-3)" }}>
            <div className="spin" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontWeight: 500 }}>Loading company analytics...</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, alignItems: "start" }}>
            {/* Left side: Company Ranking List */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)" }}>
                  Company Performance Ranking
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                  Sorted by completion rate
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {displayCompanies.length === 0 ? (
                  <div style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: 16, padding: 32, textAlign: "center" }}>
                    <p style={{ color: "var(--text-3)", fontSize: 13 }}>No companies registered yet</p>
                  </div>
                ) : (
                  displayCompanies.map((c, idx) => (
                    <motion.div
                      key={c.companyID}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        background: "var(--white)",
                        borderRadius: 16,
                        border: "1px solid var(--line)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = c.color + "60";
                        e.currentTarget.style.boxShadow = "0 6px 20px -4px rgba(0,0,0,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--line)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.02)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {/* Rank Circle */}
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "var(--bg-tag, #f1f5f9)",
                            color: "var(--text-2)",
                            border: "1px solid var(--line, #e2e8f0)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </div>

                        <div>
                          <h4 style={{ fontSize: "0.96rem", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.25 }}>
                            {toTitleCase(c.companyName)}
                          </h4>
                          <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 2 }}>
                            {c.completed} completed • {c.missed} missed • {c.total} total
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 800,
                              color: c.rate >= 75 ? "var(--green)" : c.rate >= 50 ? "var(--amber)" : "var(--red)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {c.rate}%
                          </span>
                          <div
                            style={{
                              width: 80,
                              height: 5,
                              borderRadius: 3,
                              background: "var(--surface-2)",
                              overflow: "hidden",
                              marginTop: 3,
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, c.rate))}%`,
                                height: "100%",
                                borderRadius: 3,
                                background: c.rate >= 75 ? "var(--green)" : c.rate >= 50 ? "var(--amber)" : "var(--red)",
                              }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteCompany(c.companyID, c.companyName)}
                          title="Delete Company"
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: "var(--red)", opacity: 0.7, padding: 6 }}
                        >
                          <TrashIcon size={14} color="var(--red)" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Right side: Chart Visualization */}
            <div
              style={{
                background: "var(--white)",
                borderRadius: 20,
                border: "1px solid var(--line)",
                padding: "22px 24px",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
                position: "sticky",
                top: 24,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)" }}>
                  Compliance Rate Comparison
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 2 }}>
                  Percentage of staff engagement completed per company
                </p>
              </div>

              {performance.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)", fontSize: 13 }}>
                  No performance data recorded for this date period
                </div>
              ) : (
                <div style={{ height: Math.max(260, performance.length * 48) }}>
                  <ReactEChartsCore
                    echarts={treeShakenECharts}
                    option={companyChartOption}
                    style={{ height: "100%", width: "100%" }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "var(--white)",
                borderRadius: 20,
                padding: 24,
                width: "100%",
                maxWidth: 420,
                boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--line)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99,102,241,0.12)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BriefcaseIcon size={18} color="#6366f1" />
                  </div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-1)" }}>
                    Add New Company
                  </h2>
                </div>
                <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-icon btn-sm">
                  <XIcon size={14} />
                </button>
              </div>

              <form onSubmit={handleAddCompany} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="input-label" htmlFor="company-name" style={{ fontSize: 12.5, fontWeight: 600 }}>
                    Company Name
                  </label>
                  <input
                    id="company-name"
                    className="input"
                    type="text"
                    placeholder="e.g. Acme Corporation, SociHQ Sdn Bhd"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required
                    autoFocus
                    style={{ height: 40, borderRadius: "var(--r-md)", marginTop: 6 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: "9px 0" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || !newCompanyName.trim()} className="btn btn-primary" style={{ flex: 1, padding: "9px 0" }}>
                    {saving ? "Saving..." : "Add Company"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} })}
        isLoading={confirmDialog.isLoading}
        danger={confirmDialog.danger}
      />
    </Layout>
  );
}
