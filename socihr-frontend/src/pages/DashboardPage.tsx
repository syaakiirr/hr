import { useState, useEffect, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { use, graphic, init, getInstanceByDom, dispose, type LinearGradientObject } from "echarts/core";
import { BarChart, LineChart, PieChart, HeatmapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, CalendarComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { LegacyGridContainLabel } from "echarts/features";
import Layout from "../components/Layout";
import EngagementMetrics from "../components/EngagementMetrics";
import Toast, { type ToastState } from "../components/Toast";
import SessionComparisonModal from "../components/SessionComparisonModal";
import { useDateFilter, getDateRange, DATE_FILTERS } from "../contexts/DateFilterContext";
import { useAuth } from "../contexts/AuthContext";
import {
  getDashboardKpi,
  getMonthlyTrend,
  getPlatformComparison,
  getCompanyPerformance,
  getStaffRanking,
  getWeeklyTrend,
  getDashboardTrend,
  createSnapshot,
  getHeatmap,
  type KpiData,
  type TrendPoint,
} from "../services/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#e1306c", Facebook: "#1877f2", TikTok: "#1f1f1f", LinkedIn: "#0a66c2"
};

const treeShakenECharts = { use, graphic, init, getInstanceByDom, dispose };
use([BarChart, LineChart, PieChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, CalendarComponent, VisualMapComponent, CanvasRenderer, LegacyGridContainLabel]);

const KpiCard = memo(({ label, value, sub, colorClass }: { label: string; value: string | number; sub?: string; colorClass: string }) => {
  return (
    <div className={`kpi ${colorClass}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  );
});

function getRateColor(rate: number) {
  if (rate >= 75) return "green";
  if (rate >= 50) return "amber";
  return "red";
}

// Crisp clean light theme ECharts config
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

type BarGradient = { offset: number; color: string }[];

function makeStaffBarOption(data: number[], labels: string[], gradient: BarGradient, opts?: { barMaxWidth?: number; labelFontSize?: number }) {
  return {
    ...lightChartTheme,
    animation: true,
    animationDuration: 400,
    animationEasing: "cubicOut",
    tooltip: { trigger: "axis" as const, ...customTooltip },
    grid: { left: 10, right: 25, bottom: 0, top: 10, containLabel: true },
    xAxis: { type: "value" as const, max: 100, axisLabel: { color: "#7b7b96", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#f1f1f6" } } },
    yAxis: { type: "category" as const, data: labels, axisLabel: { color: "#3d3d50" }, axisLine: { lineStyle: { color: "#e4e4ed" } } },
    series: [{
      type: "bar" as const, barMaxWidth: opts?.barMaxWidth ?? 12,
      showBackground: true,
      backgroundStyle: { color: "rgba(15, 23, 42, 0.02)", borderRadius: [0, 4, 4, 0] },
      data,
      itemStyle: { color: new graphic.LinearGradient(0, 0, 1, 0, gradient), borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: "right" as const, color: "#3d3d50", fontSize: opts?.labelFontSize ?? 10, formatter: (p: { value: number }) => `${Math.round(p.value)}%`, fontWeight: "bold" },
    }],
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { filter, setFilter, customFrom, setCustomFrom, customTo, setCustomTo } = useDateFilter();
  const { isDeptAdmin, user } = useAuth();
  const deptName = user?.departmentName ?? localStorage.getItem("departmentName") ?? "";
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [monthly, setMonthly] = useState<{ month: number; completed: number; missed: number; total: number }[]>([]);
  const [weekly, setWeekly] = useState<{ week: string; completed: number; missed: number; total: number }[]>([]);
  const [platforms, setPlatforms] = useState<{ platform: string; completed: number; missed: number; total: number }[]>([]);
  const [topStaff, setTopStaff] = useState<{ staffID: string; fullName: string; department: string; completed: number; total: number; completionRate: number }[]>([]);
  const [bottomStaff, setBottomStaff] = useState<{ staffID: string; fullName: string; department: string; completed: number; total: number; completionRate: number }[]>([]);
  const [companyPerf, setCompanyPerf] = useState<{ companyID: string; company: string; completed: number; missed: number; total: number; rate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<ToastState>({ isOpen: false, message: "", type: "success" });
  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ isOpen: true, message, type });
  }

  // Snapshot modal state
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Session Comparison modal state
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Multi-metric Timeline Trend state
  const [trends, setTrends] = useState<TrendPoint[]>([]);

  useEffect(() => {
    if (!showSnapshotModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSnapshotModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSnapshotModal]);

  // Heatmap state
  const [heatmapData, setHeatmapData] = useState<{ date: string; completed: number; total: number }[]>([]);
  const currentYear = new Date().getFullYear();


  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    const { from, to } = getDateRange(filter, customFrom, customTo);
    Promise.all([
      getDashboardKpi(from, to, signal),
      getMonthlyTrend(new Date().getFullYear(), signal),
      getWeeklyTrend(from, to, signal),
      getPlatformComparison(from, to, signal),
      getStaffRanking("top", 10, from, to, signal),
      getStaffRanking("bottom", 10, from, to, signal),
      getCompanyPerformance(from, to, signal),
      getHeatmap(currentYear, signal),
      getDashboardTrend(from, to),
    ]).then(([kpiData, monthData, weekData, platData, topData, botData, compData, heatData, trendData]) => {
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
      setTrends(trendData || []);
    }).catch((err) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal muatkan data, cuba lagi.");
    }).finally(() => setLoading(false));

    return () => controller.abort();
  }, [filter]);

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) {
      showToast("Please enter a snapshot name.", "error");
      return;
    }

    setSavingSnapshot(true);
    try {
      const { from, to } = getDateRange(filter, customFrom, customTo);
      await createSnapshot(snapshotName, snapshotNotes, from, to);
      showToast("Dashboard snapshot saved successfully!", "success");
      setShowSnapshotModal(false);
      setSnapshotName("");
      setSnapshotNotes("");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Failed to save snapshot. Please try again.", "error");
    } finally {
      setSavingSnapshot(false);
    }
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
          color: new graphic.LinearGradient(0, 0, 0, 1, [
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
          color: new graphic.LinearGradient(0, 0, 0, 1, [
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
          color: new graphic.LinearGradient(0, 0, 0, 1, [
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
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(239, 68, 68, 0.08)" },
            { offset: 1, color: "rgba(239, 68, 68, 0)" }
          ])
        }
      },
    ],
  }), [weekly]);

  // Platform comparison - memoized for performance
  const platformOption = useMemo(() => {
    const platformGradients: Record<string, LinearGradientObject> = {
      Facebook: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#60a5fa" }, { offset: 1, color: "#1d4ed8" }]),
      Instagram: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#fb7185" }, { offset: 1, color: "#be185d" }]),
      TikTok: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#9ca3af" }, { offset: 1, color: "#374151" }]),
      LinkedIn: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#38bdf8" }, { offset: 1, color: "#0369a1" }]),
    };
    const defaultGrad = new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#a78bfa" }, { offset: 1, color: "#7c3aed" }]);

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

  // Multi-metric Trend Area/Line option
  const trendOption = useMemo(() => {
    if (trends.length === 0) return null;
    const labels = trends.map((t) => t.label);
    const likes = trends.map((t) => t.likes);
    const comments = trends.map((t) => t.comments);
    const shares = trends.map((t) => t.shares);
    const rates = trends.map((t) => t.rate);

    return {
      ...lightChartTheme,
      animation: true,
      animationDuration: 500,
      tooltip: {
        trigger: "axis" as const,
        ...customTooltip,
      },
      legend: {
        data: ["Likes", "Comments", "Shares", "Rate %"],
        top: 0,
        textStyle: { color: "#64748b", fontSize: 11 },
        itemGap: 14,
      },
      grid: { left: 15, right: 35, bottom: 10, top: 35, containLabel: true },
      xAxis: {
        type: "category" as const,
        data: labels,
        axisLabel: { color: "#64748b", fontSize: 10.5 },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      yAxis: [
        {
          type: "value" as const,
          name: "Actions",
          nameTextStyle: { color: "#64748b", fontSize: 10 },
          axisLabel: { color: "#64748b", fontSize: 10 },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        {
          type: "value" as const,
          name: "Rate",
          min: 0,
          max: 100,
          nameTextStyle: { color: "#64748b", fontSize: 10 },
          axisLabel: { color: "#64748b", formatter: "{value}%", fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Likes",
          type: "line" as const,
          smooth: true,
          showSymbol: false,
          areaStyle: {
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(37, 99, 235, 0.35)" },
              { offset: 1, color: "rgba(37, 99, 235, 0.02)" },
            ]),
          },
          itemStyle: { color: "#2563eb" },
          data: likes,
        },
        {
          name: "Comments",
          type: "line" as const,
          smooth: true,
          showSymbol: false,
          areaStyle: {
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(99, 102, 241, 0.35)" },
              { offset: 1, color: "rgba(99, 102, 241, 0.02)" },
            ]),
          },
          itemStyle: { color: "#6366f1" },
          data: comments,
        },
        {
          name: "Shares",
          type: "line" as const,
          smooth: true,
          showSymbol: false,
          areaStyle: {
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(22, 163, 74, 0.35)" },
              { offset: 1, color: "rgba(22, 163, 74, 0.02)" },
            ]),
          },
          itemStyle: { color: "#16a34a" },
          data: shares,
        },
        {
          name: "Rate %",
          type: "line" as const,
          yAxisIndex: 1,
          smooth: true,
          lineStyle: { width: 3, type: "dashed" as const },
          itemStyle: { color: "#f59e0b" },
          data: rates,
        },
      ],
    };
  }, [trends]);


  // Staff ranking top - memoized for performance
  const topLabels = useMemo(() => topStaff.map((s) => s.fullName ? s.fullName.split(" ")[0] : "Staff"), [topStaff]);
  const topData = useMemo(() => topStaff.map((s) => Math.round(s.completionRate ?? 0)), [topStaff]);
  const topOption = useMemo(() => makeStaffBarOption(topData, topLabels, [
    { offset: 0, color: "#86efac" },
    { offset: 1, color: "#16a34a" }
  ]), [topData, topLabels]);

  // Staff ranking bottom - memoized for performance
  const bottomLabels = useMemo(() => bottomStaff.map((s) => s.fullName ? s.fullName.split(" ")[0] : "Staff"), [bottomStaff]);
  const bottomData = useMemo(() => bottomStaff.map((s) => Math.round(s.completionRate ?? 0)), [bottomStaff]);
  const bottomOption = useMemo(() => makeStaffBarOption(bottomData, bottomLabels, [
    { offset: 0, color: "#fca5a5" },
    { offset: 1, color: "#dc2626" }
  ]), [bottomData, bottomLabels]);

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
          color: new graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: companyColors[i % companyColors.length] + "80" },
            { offset: 1, color: companyColors[i % companyColors.length] }
          ]),
          borderRadius: [0, 4, 4, 0]
        }
      })),
      label: {
        show: true, position: "right" as const,
        color: "#3d3d50", fontSize: 11,
        formatter: (p: { value: number }) => `${Math.round(p.value)}%`,
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

  // Keyboard shortcuts for power users (Alex persona)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside an input or modal
      if (showSnapshotModal || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= "1" && e.key <= "7") {
        const index = parseInt(e.key, 10) - 1;
        if (index < DATE_FILTERS.length) {
          e.preventDefault();
          setFilter(DATE_FILTERS[index].value);
          showToast(`Switched filter: ${DATE_FILTERS[index].label}`, "success");
        }
      } else if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowSnapshotModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSnapshotModal, setFilter]);

  return (
    <>
      <Layout>
        <div>
          {/* Header */}
          <div className="page-hd">
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-sub">Staff social media engagement performance &amp; compliance analytics</p>
              {/* DeptAdmin department banner */}
              {isDeptAdmin() && deptName && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6,
                  padding: "4px 10px", borderRadius: 20,
                  background: "#eff6ff", border: "1px solid #bfdbfe",
                  fontSize: 12, fontWeight: 700, color: "#1d4ed8",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Viewing: {deptName} only
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => navigate('/leaderboard')}
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                aria-label="View Leaderboard"
              >
                <span style={{ fontSize: 13 }}>🏆</span>
                Leaderboard
              </button>

              <button
                onClick={() => setShowComparisonModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
                aria-label="Compare Sessions"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
                Compare Sessions
              </button>

              {!isDeptAdmin() && (
                <>
                  <button 
                    onClick={() => setShowSnapshotModal(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    title="Save snapshot (Key: S)"
                    aria-label="Save dashboard snapshot"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                    Save Snapshot <span style={{ opacity: 0.6, fontSize: 10, padding: "1px 4px", borderRadius: 3, background: "rgba(0,0,0,0.06)" }}>S</span>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/snapshots')}
                    className="btn btn-primary btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    aria-label="View saved snapshots"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    View Snapshots
                  </button>
                </>
              )}

              <button 
                onClick={async () => { const { downloadPageAsPDF } = await import("../utils/pdf"); downloadPageAsPDF("Dashboard"); }} 
                className="btn btn-ghost btn-sm" 
                style={{ display: "flex", alignItems: "center", gap: 6 }} 
                aria-label="Download dashboard as PDF"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>

              <div style={{ width: 1, height: 24, background: "var(--line)", margin: "0 4px" }} />

              {/* Date Filter Pills with keyboard accelerator indicators */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                {DATE_FILTERS.map((f, idx) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-secondary"}`}
                    title={`Shortcut: ${idx + 1}`}
                  >
                    {f.label}
                  </button>
                ))}
                {filter === "custom" && (
                  <>
                    <input className="input" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: 130, height: 28, fontSize: 12 }} />
                    <span style={{ color: "var(--text-3)", fontSize: 12, alignSelf: "center" }}>to</span>
                    <input className="input" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: 130, height: 28, fontSize: 12 }} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "60px 0" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ color: "var(--red)", fontSize: 14, fontWeight: 500 }}>{error}</span>
          </div>
        ) : loading ? (
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
          <div>
            {/* ══════════════════════════════════════════════════════════════
                TIER 1: EXECUTIVE KPI SUMMARY
                ══════════════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
              <KpiCard label="Active Staff" value={kpi.totalStaff} sub="Enrolled in system" colorClass="kpi-indigo" />
              <KpiCard label="Tracked Sessions" value={kpi.totalSessions} sub="In selected period" colorClass="kpi-blue" />
              <KpiCard label="Expected Actions" value={kpi.totalExpected} sub="Required engagement ticks" colorClass="kpi-amber" />
              <KpiCard label="Completed Actions" value={kpi.totalCompleted} sub="Successful employee ticks" colorClass="kpi-green" />
              <KpiCard label="Missed Actions" value={kpi.totalMissed} sub="Uncompleted engagements" colorClass="kpi-red" />
              <KpiCard label="Overall Compliance" value={`${Math.round(kpi.completionRate)}%`} sub="Action completion rate" colorClass={`kpi-${getRateColor(kpi.completionRate)}`} />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TIER 1.5: MULTI-METRIC ENGAGEMENT TIMELINE TREND
                ══════════════════════════════════════════════════════════════ */}
            {trendOption && (
              <div className="chart-wrap" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <p className="chart-label" style={{ marginBottom: 2 }}>Engagement Action Timeline &amp; Compliance Trends</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-3)" }}>Volume of Likes, Comments, Shares, and overall compliance rate %</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => navigate("/monitoring")}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11.5 }}
                    >
                      View All Sessions →
                    </button>
                  </div>
                </div>
                <ReactEChartsCore 
                  echarts={treeShakenECharts}
                  option={trendOption} 
                  style={{ height: 230 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TIER 2: CHANNELS & COMPANY BREAKDOWN
                ══════════════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Platform Engagement Breakdown */}
              <div className="chart-wrap">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <p className="chart-label" style={{ marginBottom: 0 }}>Social Platform Compliance (%)</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {platforms.map((p) => {
                      const rate = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
                      return (
                        <div key={p.platform} style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "3px 8px", borderRadius: 6, background: "var(--surface-2)",
                          fontSize: 11.5, fontWeight: 600, color: "var(--text-2)"
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: PLATFORM_COLORS[p.platform] ?? "var(--accent)" }} />
                          <span>{p.platform}:</span>
                          <span style={{ color: `var(--${getRateColor(rate)})` }}>{rate}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <ReactEChartsCore 
                  echarts={treeShakenECharts}
                  option={platformOption} 
                  style={{ height: 210 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </div>

              {/* Action Distribution Share */}
              <div className="chart-wrap">
                <p className="chart-label">Completed Action Distribution</p>
                <div style={{ display: "flex", height: 210, alignItems: "center", position: "relative" }}>
                  <ReactEChartsCore 
                    echarts={treeShakenECharts}
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
                    <p style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Done</p>
                    <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-1)" }}>{kpi.totalCompleted}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Company Performance Overview (Consolidated Single Source) */}
            {companyPerf.length > 0 && (
              <div className="chart-wrap" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <p className="chart-label" style={{ marginBottom: 2 }}>Company Performance Breakdown</p>
                    <p style={{ fontSize: 11, color: "var(--text-4)" }}>Overall employee compliance rate grouped by registered organization</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, alignItems: "center" }}>
                  <ReactEChartsCore
                    echarts={treeShakenECharts}
                    option={companyOption}
                    style={{ height: 190 }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                  {/* Company breakdown table */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {companyPerf.map((c, i) => (
                      <div key={c.companyID} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 8,
                        background: "var(--surface-2)",
                        border: `1px solid ${companyColors[i % companyColors.length]}20`,
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: companyColors[i % companyColors.length], flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company}</p>
                          <p style={{ fontSize: 10.5, color: "var(--text-4)" }}>{c.completed} of {c.total} actions</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 6,
                            fontSize: 11.5, fontWeight: 800,
                            background: `var(--${getRateColor(c.rate)}-soft)`,
                            color: `var(--${getRateColor(c.rate)})`,
                          }}>
                            {Math.round(c.rate)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TIER 3: PERFORMANCE TRENDS & STAFF STANDINGS
                ══════════════════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="chart-wrap">
                <p className="chart-label">Monthly Volume (This Year)</p>
                <ReactEChartsCore 
                  echarts={treeShakenECharts}
                  option={monthlyOption} 
                  style={{ height: 220 }} 
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </div>
              <div className="chart-wrap">
                <p className="chart-label">Weekly Volume Velocity</p>
                <ReactEChartsCore 
                  echarts={treeShakenECharts}
                  option={weeklyOption} 
                  style={{ height: 220 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </div>
            </div>

            {/* Staff Standings */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="chart-wrap">
                <p className="chart-label" style={{ color: "var(--green)" }}>Top Performing Staff (% Completion Rate)</p>
                {topStaff.length === 0 ? (
                  <p style={{ color: "var(--text-4)", fontSize: 13, padding: "20px 0" }}>No data available</p>
                ) : (
                  <ReactEChartsCore 
                    echarts={treeShakenECharts}
                    option={topOption} 
                    style={{ height: 230 }}
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
                  <ReactEChartsCore 
                    echarts={treeShakenECharts}
                    option={bottomOption} 
                    style={{ height: 230 }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TIER 4: ACTIVITY LOG & SESSION DETAIL
                ══════════════════════════════════════════════════════════════ */}
            {/* Daily Engagement Activity Heatmap */}
            {heatmapData.length > 0 && (
              <div className="chart-wrap" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <p className="chart-label" style={{ marginBottom: 2 }}>Daily Engagement Heatmap</p>
                    <p style={{ fontSize: 11, color: "var(--text-4)" }}>
                      Activity calendar colored by compliance percentage across active monitoring sessions
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--text-4)" }}>
                    <span>0%</span>
                    <span style={{
                      width: 80, height: 8, borderRadius: 4,
                      background: "linear-gradient(90deg, #eef2ff, #a5b4fc, #6366f1)"
                    }} />
                    <span>100%</span>
                  </div>
                </div>
                <ReactEChartsCore
                  echarts={treeShakenECharts}
                  option={heatmapOption}
                  style={{ height: 180, marginTop: 6 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </div>
            )}

            {/* Session Engagement Log Table */}
            <EngagementMetrics filter={filter} kpiData={kpi} />

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
                <button onClick={() => setShowSnapshotModal(false)} className="btn btn-ghost btn-icon btn-sm" aria-label="Close">
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
      <SessionComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
      />
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
