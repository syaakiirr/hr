import { useMemo } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { use, graphic, init, getInstanceByDom, dispose } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const treeShakenECharts = { use, graphic, init, getInstanceByDom, dispose };

export interface TrendDatum {
  label: string;
  likes: number;
  comments: number;
  shares: number;
  completed: number;
  rate: number;
}

const lightChartTheme = {
  backgroundColor: "transparent",
  textStyle: { color: "#7b7b96", fontFamily: "Geist, sans-serif", fontSize: 11 },
};

const customTooltip = {
  backgroundColor: "rgba(255, 255, 255, 0.96)",
  borderColor: "#e5e5f0",
  borderWidth: 1,
  textStyle: { color: "#111118", fontFamily: "Geist, sans-serif", fontSize: 11 },
  extraCssText: "box-shadow: 0 4px 16px rgba(17, 17, 24, 0.08); border-radius: 8px; padding: 8px 12px;",
};

export function buildTrendOption(points: TrendDatum[]) {
  if (points.length === 0) return null;
  const sparse = points.length <= 2;
  return {
    ...lightChartTheme,
    animation: true,
    animationDuration: 400,
    animationEasing: "cubicOut" as const,
    tooltip: { trigger: "axis" as const, ...customTooltip },
    legend: {
      data: ["Completed", "Rate %", "Likes", "Comments", "Shares"],
      selected: { Likes: false, Comments: false, Shares: false },
      top: 0,
      textStyle: { color: "#64748b", fontSize: 11 },
    },
    grid: { left: 15, right: 35, bottom: 10, top: 38, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: points.map((p) => p.label),
      axisLabel: { color: "#64748b", fontSize: 10.5, hideOverlap: true },
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
        name: "Completed", type: "line" as const, smooth: true,
        showSymbol: true, symbolSize: sparse ? 8 : 4,
        itemStyle: { color: "#4f46e5" }, data: points.map((p) => p.completed),
      },
      {
        name: "Rate %", type: "line" as const, yAxisIndex: 1, smooth: true,
        showSymbol: true, symbolSize: sparse ? 8 : 4,
        lineStyle: { width: 2.5, type: "dashed" as const },
        itemStyle: { color: "#f59e0b" }, data: points.map((p) => p.rate),
      },
      {
        name: "Likes", type: "line" as const, smooth: true,
        showSymbol: sparse, symbolSize: 8,
        itemStyle: { color: "#93c5fd" }, data: points.map((p) => p.likes),
      },
      {
        name: "Comments", type: "line" as const, smooth: true,
        showSymbol: sparse, symbolSize: 8,
        itemStyle: { color: "#a5b4fc" }, data: points.map((p) => p.comments),
      },
      {
        name: "Shares", type: "line" as const, smooth: true,
        showSymbol: sparse, symbolSize: 8,
        itemStyle: { color: "#86efac" }, data: points.map((p) => p.shares),
      },
    ],
  };
}

export default function CompanyTrendChart({
  points, height = 320, ariaLabel,
}: {
  points: TrendDatum[];
  height?: number;
  ariaLabel: string;
}) {
  const option = useMemo(() => buildTrendOption(points), [points]);
  if (!option) return null;
  return (
    <div role="img" aria-label={ariaLabel}>
      <ReactEChartsCore
        echarts={treeShakenECharts}
        option={option}
        style={{ height }}
        opts={{ renderer: "canvas" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}

export function rateLabel(rate: number): string {
  if (rate >= 75) return "On track";
  if (rate >= 50) return "Needs push";
  return "At risk";
}

function rateStyle(rate: number): { bg: string; fg: string; Icon: typeof Check } {
  if (rate >= 75) return { bg: "#f0fdf4", fg: "#15803d", Icon: Check };
  if (rate >= 50) return { bg: "#fffbeb", fg: "#b45309", Icon: TriangleAlert };
  return { bg: "#fef2f2", fg: "#b91c1c", Icon: X };
}

export function RatePill({ rate }: { rate: number }) {
  const s = rateStyle(rate);
  const Icon = s.Icon;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: s.bg, color: s.fg,
        borderRadius: 999, padding: "3px 10px",
        fontWeight: 700, fontSize: 12, fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} aria-hidden="true" />
      {rate}% · {rateLabel(rate)}
    </span>
  );
}
