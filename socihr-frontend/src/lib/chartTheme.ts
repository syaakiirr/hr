import { useTheme } from "@/contexts/ThemeContext";

export interface ChartTooltipTheme {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textStyle: { color: string; fontFamily: string; fontSize: number };
  extraCssText: string;
}

export interface ChartPalette {
  text: string;
  textStrong: string;
  axis: string;
  split: string;
  line: string;
  track: string;
  tooltip: ChartTooltipTheme;
  pieBorder: string;
  calendarBorder: string;
  calendarEmpty: string;
  heatmap: [string, string, string];
}

const LIGHT: ChartPalette = {
  text: "#7b7b96",
  textStrong: "#3d3d50",
  axis: "#e4e4ed",
  split: "#f1f1f6",
  line: "#cbd5e1",
  track: "rgba(15, 23, 42, 0.03)",
  tooltip: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: "#e5e5f0",
    borderWidth: 1,
    textStyle: { color: "#111118", fontFamily: "Geist, sans-serif", fontSize: 11 },
    extraCssText:
      "box-shadow: 0 4px 16px rgba(17, 17, 24, 0.08); border-radius: 8px; padding: 8px 12px;",
  },
  pieBorder: "#ffffff",
  calendarBorder: "#ffffff",
  calendarEmpty: "#f8f8fc",
  heatmap: ["#eef2ff", "#a5b4fc", "#6366f1"],
};

const DARK: ChartPalette = {
  text: "#94a3b8",
  textStrong: "#e2e8f0",
  axis: "#303b52",
  split: "#232c3d",
  line: "#475569",
  track: "rgba(255, 255, 255, 0.05)",
  tooltip: {
    backgroundColor: "rgba(20, 26, 38, 0.98)",
    borderColor: "#303b52",
    borderWidth: 1,
    textStyle: { color: "#f8fafc", fontFamily: "Geist, sans-serif", fontSize: 11 },
    extraCssText:
      "box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); border-radius: 8px; padding: 8px 12px;",
  },
  pieBorder: "#141a26",
  calendarBorder: "#141a26",
  calendarEmpty: "#1b2231",
  heatmap: ["#1e1b4b", "#4338ca", "#818cf8"],
};

export function getChartPalette(theme: "light" | "dark"): ChartPalette {
  return theme === "dark" ? DARK : LIGHT;
}

export function useChartPalette(): ChartPalette {
  const { theme } = useTheme();
  return getChartPalette(theme);
}
