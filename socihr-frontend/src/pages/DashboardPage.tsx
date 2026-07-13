import { useState, useEffect, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import Layout from "../components/Layout";
import EngagementMetrics from "../components/EngagementMetrics";
import {
  getDashboardKpi,
  getMonthlyTrend,
  getPlatformComparison,
  getCompanyPerformance,
  getStaffRanking,
  getWeeklyTrend,
  createSnapshot,
  getHeatmap,
  type KpiData,
} from "../services/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#e1306c", Facebook: "#1877f2", TikTok: "#1f1f1f", LinkedIn: "#0a66c2"
};

const DATE_FILTERS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "3 Months", value: "3months" },
  { label: "6 Months", value: "6months" },
  { label: "1 Year", value: "year" },
  { label: "All Time", value: "all" },
];

function getDateRange(filter: string): { from?: string; to?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = fmt(now);

  switch (filter) {
    case "today": return { from: today, to: today };
    case "week": {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      return { from: fmt(start), to: today };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(start), to: today };
    }
    case "3months": {
      const start = new Date(now); start.setMonth(now.getMonth() - 3);
      return { from: fmt(start), to: today };
    }
    case "6months": {
      const start = new Date(now); start.setMonth(now.getMonth() - 6);
      return { from: fmt(start), to: today };
    }
    case "year": {
      const start = new Date(now); start.setFullYear(now.getFullYear() - 1);
      return { from: fmt(start), to: today };
    }
    default: return {};
  }
}

const KpiCard = memo(({ label, value, sub, colorClass }: { label: string; value: string | number; sub?: string; colorClass: string }) => {
  return (
    <div className={`kpi ${colorClass}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  );
});

// Crisp clean light theme ECharts config
const lightChartTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#7b7b96", fontFamily: "Geist, sans-serif", fontSize: 11 },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("month");
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [monthly, setMonthly] = useState<{ month: number; completed: number; missed: number; total: number }[]>([]);
  const [weekly, setWeekly] = useState<{ week: string; completed: number; missed: number; total: number }[]>([]);
  const [platforms, setPlatforms] = useState<{ platform: string; completed: number; missed: number; total: number }[]>([]);
  const [topStaff, setTopStaff] = useState<{ staffID: string; fullName: string; department: string; completed: number; total: number; completionRate: number }[]>([]);
  const [bottomStaff, setBottomStaff] = useState<{ staffID: string; fullName: string; department: string; completed: number; total: number; completionRate: number }[]>([]);
  const [companyPerf, setCompanyPerf] = useState<{ companyID: string; company: string; completed: number; missed: number; total: number; rate: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Snapshot modal state
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Heatmap state
  const [heatmapData, setHeatmapData] = useState<{ date: string; completed: number; total: number }[]>([]);
  const currentYear = new Date().getFullYear();


  useEffect(() => {
    const { from, to } = getDateRange(filter);
    setLoading(true);

    Promise.all([
      getDashboardKpi(from, to),
      getMonthlyTrend(new Date().getFullYear()),
      getWeeklyTrend(from, to),
      getPlatformComparison(from, to),
      getStaffRanking("top", 10, from, to),
      getStaffRanking("bottom", 10, from, to),
      getCompanyPerformance(from, to),
      getHeatmap(currentYear),
    ]).then(([kpiData, monthData, weekData, platData, topData, botData, compData, heatData]) => {
      setKpi(kpiData);
      setMonthly(monthData);
      setWeekly(weekData);
      setPlatforms(platData);
      setTopStaff(topData);
      setBottomStaff(botData);
      setCompanyPerf(compData);
      setHeatmapData(heatData.map((d: { date: string; completed: number; total: number }) => ({
        date: d.date,
        completed: d.completed,
        total: d.total,
      })));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) {
      alert("Please enter a snapshot name.");
      return;
    }

    setSavingSnapshot(true);
    try {
      const { from, to } = getDateRange(filter);
      await createSnapshot(snapshotName, snapshotNotes, from, to);
      alert("Dashboard snapshot saved successfully!");
      setShowSnapshotModal(false);
      setSnapshotName("");
      setSnapshotNotes("");
    } catch (error) {
      console.error(error);
      alert("Failed to save snapshot. Please try again.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const customTooltip = {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: "#e5e5f0",
    borderWidth: 1,
    textStyle: { color: "#111118", fontFamily: "Geist, sans-serif", fontSize: 11 },
    extraCssText: "box-shadow: 0 4px 16px rgba(17, 17, 24, 0.08); border-radius: 8px; padding: 8px 12px;"
  };

  // Monthly trend option - memoized for performance
  const monthlyOption = useMemo(() => ({
    ...lightChartTheme,
    animation: true,
    animationDuration: 400,
    animationEasing: "cubicOut",
    tooltip: { trigger: "axis" as const, ...customTooltip },
    legend: { data: ["Completed", "Missed"], textStyle: { color: "#7b7b96" }, right: 10, top: 0 },
    grid: { left: 10, right: 10, bottom: 0, top: 32, containLabel: true },
    xAxis: { type: "category" as const, data: MONTHS, axisLine: { lineStyle: { color: "#e4e4ed" } }, axisLabel: { color: "#7b7b96" }, splitLine: { show: false } },
    yAxis: { type: "value" as const, axisLine: { show: false }, axisLabel: { color: "#7b7b96" }, splitLine: { lineStyle: { color: "#f1f1f6" } } },
    series: [
      {
        name: "Completed", type: "bar" as const, stack: "total", barMaxWidth: 20,
        data: MONTHS.map((_, i) => monthly.find((m) => m?.month === i + 1)?.completed ?? 0),
        itemStyle: { 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#4ade80" },
            { offset: 1, color: "#16a34a" }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
      },
      {
        name: "Missed", type: "bar" as const, stack: "total", barMaxWidth: 20,
        data: MONTHS.map((_, i) => monthly.find((m) => m?.month === i + 1)?.missed ?? 0),
        itemStyle: { 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#f87171" },
            { offset: 1, color: "#dc2626" }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
      },
    ],
  }), [monthly]);

  // Weekly trend option - memoized for performance
  const weeklyOption = useMemo(() => ({
    ...lightChartTheme,
    animation: true,
    animationDuration: 400,
    animationEasing: "cubicOut",
    tooltip: { trigger: "axis" as const, ...customTooltip },
    legend: { data: ["Completed", "Missed"], textStyle: { color: "#7b7b96" }, right: 10, top: 0 },
    grid: { left: 10, right: 10, bottom: 0, top: 32, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: weekly.map((w) => (w?.week && w.week.includes("-W")) ? `W${w.week.split("-W")[1]}` : (w?.week || "")),
      axisLine: { lineStyle: { color: "#e4e4ed" } }, axisLabel: { color: "#7b7b96" },
      boundaryGap: false
    },
    yAxis: { type: "value" as const, axisLine: { show: false }, axisLabel: { color: "#7b7b96" }, splitLine: { lineStyle: { color: "#f1f1f6" } } },
    series: [
      {
        name: "Completed", type: "line" as const, smooth: true,
        data: weekly.map((w) => w?.completed ?? 0),
        lineStyle: { color: "#6366f1", width: 3 },
        symbol: "circle", symbolSize: 6, 
        itemStyle: { color: "#6366f1" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(99, 102, 241, 0.2)" },
            { offset: 1, color: "rgba(99, 102, 241, 0.01)" }
          ])
        }
      },
      {
        name: "Missed", type: "line" as const, smooth: true,
        data: weekly.map((w) => w?.missed ?? 0),
        lineStyle: { color: "#ef4444", width: 2, type: "dashed" as const },
        symbol: "circle", symbolSize: 5, 
        itemStyle: { color: "#ef4444" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(239, 68, 68, 0.08)" },
            { offset: 1, color: "rgba(239, 68, 68, 0)" }
          ])
        }
      },
    ],
  }), [weekly]);

  // Platform comparison - memoized for performance
  const platformOption = useMemo(() => {
    const platformGradients: Record<string, echarts.graphic.LinearGradient> = {
      Facebook: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#60a5fa" }, { offset: 1, color: "#1d4ed8" }]),
      Instagram: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#fb7185" }, { offset: 1, color: "#be185d" }]),
      TikTok: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#9ca3af" }, { offset: 1, color: "#374151" }]),
      LinkedIn: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#38bdf8" }, { offset: 1, color: "#0369a1" }]),
    };
    const defaultGrad = new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#a78bfa" }, { offset: 1, color: "#7c3aed" }]);

    return {
      ...lightChartTheme,
      animation: true,
      animationDuration: 400,
      animationEasing: "cubicOut",
      tooltip: { trigger: "axis" as const, ...customTooltip },
      grid: { left: 10, right: 10, bottom: 0, top: 20, containLabel: true },
      xAxis: { type: "category" as const, data: platforms.map((p) => p?.platform || "Unknown"), axisLabel: { color: "#7b7b96" }, axisLine: { lineStyle: { color: "#e4e4ed" } } },
      yAxis: { type: "value" as const, max: 100, axisLabel: { color: "#7b7b96", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#f1f1f6" } } },
      series: [{
        type: "bar" as const, barMaxWidth: 30,
        showBackground: true,
        backgroundStyle: {
          color: "rgba(15, 23, 42, 0.03)",
          borderRadius: [5, 5, 0, 0]
        },
        data: platforms.map((p) => ({
          value: p.total > 0 ? Math.round(p.completed / p.total * 100) : 0,
          itemStyle: { color: platformGradients[p.platform] || defaultGrad, borderRadius: [5, 5, 0, 0] }
        })),
        label: { show: true, position: "top" as const, color: "#3d3d50", fontSize: 11, formatter: "{c}%", fontWeight: "bold" },
      }],
    };
  }, [platforms]);

  // Distribution - memoized for performance
  const distributionOption = useMemo(() => {
    const platformColors: Record<string, string> = {
      Facebook: "#1877f2", Instagram: "#e1306c", TikTok: "#374151", LinkedIn: "#0a66c2"
    };
    return {
      ...lightChartTheme,
      animation: true,
      animationDuration: 400,
      animationEasing: "cubicOut",
      tooltip: { trigger: "item" as const, ...customTooltip },
      series: [{
        type: "pie" as const, radius: ["62%", "82%"], center: ["50%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(17, 17, 24, 0.08)" }
        },
        data: platforms.map((p) => ({
          value: p.completed, name: p.platform || "Unknown",
          itemStyle: { color: platformColors[p.platform] || "#6366f1" }
        })),
      }],
    };
  }, [platforms]);

  // Staff ranking top - memoized for performance
  const topOption = useMemo(() => ({
    ...lightChartTheme,
    animation: true,
    animationDuration: 400,
    animationEasing: "cubicOut",
    tooltip: { trigger: "axis" as const, ...customTooltip },
    grid: { left: 10, right: 25, bottom: 0, top: 10, containLabel: true },
    xAxis: { type: "value" as const, max: 100, axisLabel: { color: "#7b7b96", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#f1f1f6" } } },
    yAxis: {
      type: "category" as const,
      data: topStaff.map((s) => s.fullName ? s.fullName.split(" ")[0] : "Staff"),
      axisLabel: { color: "#3d3d50" }, axisLine: { lineStyle: { color: "#e4e4ed" } }
    },
    series: [{
      type: "bar" as const, barMaxWidth: 12,
      showBackground: true,
      backgroundStyle: {
        color: "rgba(15, 23, 42, 0.02)",
        borderRadius: [0, 4, 4, 0]
      },
      data: topStaff.map((s) => s.completionRate ?? 0),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#86efac" },
          { offset: 1, color: "#16a34a" }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      label: { show: true, position: "right" as const, color: "#3d3d50", fontSize: 10, formatter: "{c}%", fontWeight: "bold" },
    }],
  }), [topStaff]);

  // Staff ranking bottom - memoized for performance
  const bottomOption = useMemo(() => ({
    ...lightChartTheme,
    animation: true,
    animationDuration: 400,
    animationEasing: "cubicOut",
    tooltip: { trigger: "axis" as const, ...customTooltip },
    grid: { left: 10, right: 25, bottom: 0, top: 10, containLabel: true },
    xAxis: { type: "value" as const, max: 100, axisLabel: { color: "#7b7b96", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#f1f1f6" } } },
    yAxis: {
      type: "category" as const,
      data: bottomStaff.map((s) => s.fullName ? s.fullName.split(" ")[0] : "Staff"),
      axisLabel: { color: "#3d3d50" }, axisLine: { lineStyle: { color: "#e4e4ed" } }
    },
    series: [{
      type: "bar" as const, barMaxWidth: 12,
      showBackground: true,
      backgroundStyle: {
        color: "rgba(15, 23, 42, 0.02)",
        borderRadius: [0, 4, 4, 0]
      },
      data: bottomStaff.map((s) => s.completionRate ?? 0),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#fca5a5" },
          { offset: 1, color: "#dc2626" }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      label: { show: true, position: "right" as const, color: "#3d3d50", fontSize: 10, formatter: "{c}%", fontWeight: "bold" },
    }],
  }), [bottomStaff]);

  // Company performance chart - memoized
  const companyColors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];
  const companyOption = useMemo(() => ({
    ...lightChartTheme,
    animation: true,
    animationDuration: 400,
    animationEasing: "cubicOut",
    tooltip: { trigger: "axis" as const, ...customTooltip },
    grid: { left: 16, right: 40, bottom: 0, top: 10, containLabel: true },
    xAxis: {
      type: "value" as const,
      max: 100,
      axisLabel: { color: "#7b7b96", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#f1f1f6" } }
    },
    yAxis: {
      type: "category" as const,
      data: companyPerf.map((c) => c.company),
      axisLabel: { color: "#3d3d50", fontWeight: "bold" },
      axisLine: { lineStyle: { color: "#e4e4ed" } }
    },
    series: [{
      type: "bar" as const,
      barMaxWidth: 20,
      showBackground: true,
      backgroundStyle: { color: "rgba(15, 23, 42, 0.03)", borderRadius: [0, 4, 4, 0] },
      data: companyPerf.map((c, i) => ({
        value: c.rate,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: companyColors[i % companyColors.length] + "80" },
            { offset: 1, color: companyColors[i % companyColors.length] }
          ]),
          borderRadius: [0, 4, 4, 0]
        }
      })),
      label: {
        show: true, position: "right" as const,
        color: "#3d3d50", fontSize: 11,
        formatter: (p: { value: number }) => `${p.value}%`,
        fontWeight: "bold"
      },
    }],
  }), [companyPerf]);

  // Daily engagement heatmap — calendar grid auto-scoped to the actual data range
  // (instead of a full empty year) so activity is dense and easy to read at a glance.
  const heatmapRange = useMemo(() => {
    if (heatmapData.length === 0) return null;
    const dates = heatmapData.map(d => d.date.split('T')[0]).sort();
    const minD = new Date(dates[0]);
    const maxD = new Date(dates[dates.length - 1]);
    const startOfMonth = new Date(minD.getFullYear(), minD.getMonth(), 1);
    const endOfMonth = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return { from: fmt(startOfMonth), to: fmt(endOfMonth) };
  }, [heatmapData]);

  const heatmapOption = useMemo(() => ({
    ...lightChartTheme,
    tooltip: {
      ...customTooltip,
      formatter: (p: { data: [string, number] }) => {
        if (!p.data) return "No session";
        const [dateStr, rate] = p.data;
        return `${dateStr}<br/>Completion: <strong>${rate}%</strong>`;
      }
    },
    visualMap: {
      show: false,
      min: 0, max: 100,
      inRange: { color: ['#eef2ff', '#a5b4fc', '#6366f1'] },
    },
    calendar: {
      top: 30, left: 40, right: 20, bottom: 10,
      range: heatmapRange ? [heatmapRange.from, heatmapRange.to] : `${currentYear}`,
      cellSize: ['auto', 18],
      splitLine: { lineStyle: { color: '#e5e5f0', width: 1 } },
      yearLabel: { show: false },
      dayLabel: { nameMap: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], color: '#9ca3af', fontSize: 9.5 },
      monthLabel: { color: '#6b6b85', fontSize: 10.5, fontWeight: 600 },
      itemStyle: { borderWidth: 3, borderColor: '#fff', color: '#f8f8fc' }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: heatmapData.map(d => [
        d.date.split('T')[0],
        d.total > 0 ? Math.round(d.completed / d.total * 100) : 0
      ]),
      itemStyle: { borderRadius: 4 }
    }]
  }), [heatmapData, heatmapRange, currentYear]);

  return (
    <>
      <Layout>
        <div>
          <div className="page-hd">
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-sub">Staff social media engagement performance analytics</p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button 
                onClick={() => setShowSnapshotModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                Save Snapshot
              </button>
              
              <button 
                onClick={() => navigate('/snapshots')}
                className="btn btn-ghost btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                View Snapshots
              </button>

              <div style={{ width: 1, height: 24, background: "var(--line)", margin: "0 4px" }} />

              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-secondary"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "60px 0", justifyContent: "center",
              opacity: 1, transition: "opacity 0.2s ease"
            }}
          >
            <div className="spin" />Loading dashboard data...
          </div>
        ) : kpi ? (
          <div

          >
              {/* KPI grid without staggered delay to let the page-wide transition shine */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
                <KpiCard label="Total Staff" value={kpi.totalStaff} colorClass="kpi-indigo" />
                <KpiCard label="Total Sessions" value={kpi.totalSessions} colorClass="kpi-blue" />
                <KpiCard label="Expected Ticks" value={kpi.totalExpected} colorClass="kpi-amber" />
                  <KpiCard label="Completed Ticks" value={kpi.totalCompleted} colorClass="kpi-green" />
                  <KpiCard label="Missed Ticks" value={kpi.totalMissed} colorClass="kpi-red" />
                <KpiCard label="Completion Rate" value={`${kpi.completionRate}%`} colorClass={kpi.completionRate >= 75 ? "kpi-green" : kpi.completionRate >= 50 ? "kpi-amber" : "kpi-red"} />
              </div>

          {/* Quick Platform Badges */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {platforms.map((p) => {
              const rate = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
              return (
                <div key={p.platform} style={{
                  background: "var(--white)", border: "1px solid var(--line)",
                  borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
                  fontSize: 13, fontWeight: 500, color: "var(--text-2)", boxShadow: "var(--shadow-xs)"
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: PLATFORM_COLORS[p.platform] ?? "var(--accent)" }} />
                  <strong>{p.platform}</strong>
                  <span style={{ color: "var(--text-3)" }}>{rate}% rate</span>
                </div>
              );
            })}
          </div>

          {/* Company Performance Quick Badges */}
          {companyPerf.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
              {companyPerf.map((c, i) => (
                <div key={c.companyID} style={{
                  background: "var(--white)",
                  border: `1px solid ${companyColors[i % companyColors.length]}30`,
                  borderRadius: 8, padding: "8px 14px",
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 13, fontWeight: 500, color: "var(--text-2)",
                  boxShadow: "var(--shadow-xs)"
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: companyColors[i % companyColors.length] }} />
                  <strong style={{ color: companyColors[i % companyColors.length] }}>{c.company}</strong>
                  <span style={{
                    padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                    background: c.rate >= 75 ? "var(--green-soft)" : c.rate >= 50 ? "var(--amber-soft)" : "var(--red-soft)",
                    color: c.rate >= 75 ? "var(--green)" : c.rate >= 50 ? "var(--amber)" : "var(--red)",
                  }}>
                    {c.rate}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Row 1 Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="chart-wrap">
              <p className="chart-label">Monthly Trend (This Year)</p>
              <ReactECharts 
                option={monthlyOption} 
                style={{ height: 220 }} 
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
            <div className="chart-wrap">
              <p className="chart-label">Weekly Trend</p>
              <ReactECharts 
                option={weeklyOption} 
                style={{ height: 220 }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
          </div>

          {/* Row 2 Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="chart-wrap">
              <p className="chart-label">Performance by Platform (Completion Rate %)</p>
              <ReactECharts 
                option={platformOption} 
                style={{ height: 220 }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
            <div className="chart-wrap">
              <p className="chart-label">Completed Engagement Distribution</p>
              <div style={{ display: "flex", height: 220, alignItems: "center", position: "relative" }}>
                <ReactECharts 
                  option={distributionOption} 
                  style={{ height: "100%", width: "100%" }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  textAlign: "center", pointerEvents: "none"
                }}>
                  <p style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Done</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)" }}>{kpi.totalCompleted}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3 Charts — Performers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="chart-wrap">
              <p className="chart-label" style={{ color: "var(--green)" }}>Top Performing Staff (% Completion Rate)</p>
              {topStaff.length === 0 ? (
                <p style={{ color: "var(--text-4)", fontSize: 13, padding: "20px 0" }}>No data available</p>
              ) : (
                <ReactECharts 
                  option={topOption} 
                  style={{ height: 240 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              )}
            </div>
            <div className="chart-wrap">
              <p className="chart-label" style={{ color: "var(--red)" }}>Staff Needing Attention (% Completion Rate)</p>
              {bottomStaff.length === 0 ? (
                <p style={{ color: "var(--text-4)", fontSize: 13, padding: "20px 0" }}>No data available</p>
              ) : (
                <ReactECharts 
                  option={bottomOption} 
                  style={{ height: 240 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              )}
            </div>
          </div>

          {/* Engagement Metrics Component */}
          <EngagementMetrics />

          {/* Company Performance Chart */}
          {companyPerf.length > 0 && (
            <div className="chart-wrap" style={{ marginTop: 16 }}>
              <p className="chart-label" style={{ color: "#6366f1" }}>🏢 Company Performance by Tick (Completion Rate %)</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                <ReactECharts
                  option={companyOption}
                  style={{ height: 200 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
                {/* Company breakdown table */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {companyPerf.map((c, i) => (
                    <div key={c.companyID} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 8,
                      background: "var(--surface-2)",
                      border: `1px solid ${companyColors[i % companyColors.length]}20`,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: companyColors[i % companyColors.length], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          display: "inline-block", padding: "3px 8px", borderRadius: 6,
                          fontSize: 12, fontWeight: 800,
                          background: c.rate >= 75 ? "var(--green-soft)" : c.rate >= 50 ? "var(--amber-soft)" : "var(--red-soft)",
                          color: c.rate >= 75 ? "var(--green)" : c.rate >= 50 ? "var(--amber)" : "var(--red)",
                        }}>
                          {c.rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Daily Engagement Activity Heatmap */}
          {heatmapData.length > 0 && (
            <div className="chart-wrap" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <p className="chart-label" style={{ color: "#6366f1", marginBottom: 2 }}>📅 Daily Engagement Activity</p>
                  <p style={{ fontSize: 11, color: "var(--text-4)" }}>
                    Each cell is a day with a monitoring session, colored by completion rate.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--text-4)" }}>
                  <span>Low</span>
                  <span style={{
                    width: 70, height: 8, borderRadius: 4,
                    background: "linear-gradient(90deg, #eef2ff, #a5b4fc, #6366f1)"
                  }} />
                  <span>High</span>
                </div>
              </div>
              <ReactECharts
                option={heatmapOption}
                style={{ height: 190, marginTop: 8 }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
          )}

        </div>
        ) : null}


      {showSnapshotModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowSnapshotModal(false)}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="modal-head">
                <h2 className="modal-title">Save Dashboard Snapshot</h2>
                <button onClick={() => setShowSnapshotModal(false)} className="btn btn-ghost btn-icon btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Save the current dashboard state for historical comparison and reporting.
                </p>

                <div>
                  <label className="input-label">Snapshot Name *</label>
                  <input
                     className="input"
                    type="text"
                    placeholder="e.g., January 2026 Report"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="input-label">Notes (Optional)</label>
                  <textarea
                    className="input"
                    placeholder="Add any notes about this snapshot..."
                    value={snapshotNotes}
                    onChange={(e) => setSnapshotNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div style={{ 
                  padding: 12, 
                  background: 'var(--accent-soft)', 
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--text-3)'
                }}>
                  <strong style={{ color: 'var(--text-2)' }}>What will be saved:</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                    <li>Current filter: <strong>{DATE_FILTERS.find(f => f.value === filter)?.label}</strong></li>
                    <li>All KPI metrics</li>
                    <li>Monthly &amp; platform trends</li>
                    <li>Staff rankings</li>
                  </ul>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button 
                    onClick={() => setShowSnapshotModal(false)} 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    disabled={savingSnapshot}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateSnapshot} 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    disabled={!snapshotName.trim() || savingSnapshot}
                  >
                    {savingSnapshot ? (
                      <>
                        <span className="spin" style={{ width: 12, height: 12, marginRight: 6 }} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 6 }}>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="m21 15-5-5L5 21" />
                        </svg>
                        Save Snapshot
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}
