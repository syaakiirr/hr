import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import Layout from "../components/Layout";
import {
  getCompanies,
  createCompany,
  getCompanyPerformance,
  type Company
} from "../services/api";

const COMPANY_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

const lightChartTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#7b7b96", fontFamily: "Geist, sans-serif", fontSize: 11 },
};

const customTooltip = {
  backgroundColor: "rgba(255, 255, 255, 0.96)",
  borderColor: "#e5e5f0",
  borderWidth: 1,
  textStyle: { color: "#111118", fontFamily: "Geist, sans-serif", fontSize: 11 },
  extraCssText: "box-shadow: 0 4px 16px rgba(17, 17, 24, 0.08); border-radius: 8px; padding: 8px 12px;"
};

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [performance, setPerformance] = useState<{ companyID: string; company: string; completed: number; missed: number; total: number; rate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [compList, perfList] = await Promise.all([
        getCompanies(),
        getCompanyPerformance()
      ]);
      setCompanies(compList);
      setPerformance(perfList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setSaving(true);
    try {
      await createCompany(newCompanyName);
      setNewCompanyName("");
      setShowAddModal(false);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  // Memoized company chart options
  const companyChartOption = useMemo(() => {
    // Sort performance by rate descending for ranking
    const sortedPerf = [...performance].sort((a, b) => b.rate - a.rate);

    return {
      ...lightChartTheme,
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
      tooltip: { trigger: "axis" as const, ...customTooltip },
      grid: { left: 16, right: 40, bottom: 10, top: 20, containLabel: true },
      xAxis: {
        type: "value" as const,
        max: 100,
        axisLabel: { color: "#7b7b96", formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#f1f1f6" } }
      },
      yAxis: {
        type: "category" as const,
        data: sortedPerf.map((c) => c.company),
        axisLabel: { color: "#3d3d50", fontWeight: "bold" },
        axisLine: { lineStyle: { color: "#e4e4ed" } }
      },
      series: [{
        name: "Completion Rate",
        type: "bar" as const,
        barMaxWidth: 18,
        showBackground: true,
        backgroundStyle: { color: "rgba(15, 23, 42, 0.02)", borderRadius: [0, 4, 4, 0] },
        data: sortedPerf.map((c, i) => {
          const originalIdx = performance.findIndex(orig => orig.companyID === c.companyID);
          const color = COMPANY_COLORS[originalIdx >= 0 ? originalIdx % COMPANY_COLORS.length : i % COMPANY_COLORS.length];
          return {
            value: c.rate,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: color + "80" },
                { offset: 1, color: color }
              ]),
              borderRadius: [0, 4, 4, 0]
            }
          };
        }),
        label: {
          show: true,
          position: "right" as const,
          color: "#3d3d50",
          fontSize: 11,
          formatter: (p: { value: number }) => `${p.value}%`,
          fontWeight: "bold"
        },
      }],
    };
  }, [performance]);

  // Combine full company list with performance stats if available
  const displayCompanies = useMemo(() => {
    return companies.map((c, i) => {
      const perf = performance.find((p) => p.companyID === c.companyID);
      const color = COMPANY_COLORS[i % COMPANY_COLORS.length];
      return {
        companyID: c.companyID,
        companyName: c.companyName,
        completed: perf?.completed ?? 0,
        missed: perf?.missed ?? 0,
        total: perf?.total ?? 0,
        rate: perf?.rate ?? 0,
        color
      };
    }).sort((a, b) => b.rate - a.rate); // Sort by overall performance ranking
  }, [companies, performance]);

  return (
    <Layout>
      <div>
        <div className="page-hd">
          <div>
            <h1 className="page-title">Company Management</h1>
            <p className="page-sub">View company rankings, check completion ticks, and register new companies</p>
          </div>
          <div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Company
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loader" style={{ padding: "60px 0" }}>
            <div className="spin" />
            <span>Loading company analytics...</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            
            {/* Left side: Company Ranking List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p className="section-label" style={{ paddingLeft: 0 }}>Company Performance Leaderboard</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {displayCompanies.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: 32 }}>
                    <p style={{ color: "var(--text-3)", fontSize: 13 }}>No companies registered yet</p>
                  </div>
                ) : (
                  displayCompanies.map((c, idx) => (
                    <motion.div
                      key={c.companyID}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="card"
                      style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
                        background: "var(--white)",
                        borderLeft: `5px solid ${c.color}`,
                        boxShadow: "var(--shadow-sm)"
                      }}
                    >
                      {/* Rank badge */}
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: idx === 0 ? "#fef3c7" : idx === 1 ? "#e2e8f0" : idx === 2 ? "#ffedd5" : "var(--surface-2)",
                        color: idx === 0 ? "#d97706" : idx === 1 ? "#475569" : idx === 2 ? "#ea580c" : "var(--text-3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13, flexShrink: 0
                      }}>
                        {idx + 1}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>
                          {c.companyName}
                        </h3>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>✓ {c.completed} Completed</span>
                          <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 600 }}>✗ {c.missed} Missed</span>
                          <span style={{ fontSize: 11, color: "var(--text-4)" }}>Total: {c.total}</span>
                        </div>
                      </div>

                      {/* Score/Rate */}
                      <div style={{ textAlign: "right" }}>
                        <span className={`badge ${c.rate >= 75 ? "badge-green" : c.rate >= 50 ? "badge-amber" : "badge-red"}`} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 8, fontWeight: 800 }}>
                          {c.rate}%
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Right side: Charts & Visuals */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p className="section-label" style={{ paddingLeft: 0 }}>Overall Ranking Chart</p>
              
              <div className="chart-wrap" style={{ background: "var(--white)", padding: 20, borderRadius: "var(--r-lg)", border: "1px solid var(--line)" }}>
                {performance.length === 0 ? (
                  <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-3)" }}>
                    No engagement stats available yet. Create sessions to populate stats.
                  </div>
                ) : (
                  <ReactECharts
                    option={companyChartOption}
                    style={{ height: 350 }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-head">
              <h2 className="modal-title">Register New Company</h2>
              <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-icon btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddCompany} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="input-label">Company Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Muaz Force SDN BHD"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving || !newCompanyName.trim()} className="btn btn-primary" style={{ flex: 1 }}>
                  {saving ? <><span className="spin" style={{ width: 12, height: 12 }} /> Registering...</> : "Add Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
