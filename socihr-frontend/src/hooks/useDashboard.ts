/**
 * hooks/useDashboard.ts
 *
 * TanStack Query hooks untuk semua dashboard API.
 * Gantikan useEffect + fetch dalam DashboardPage, LeaderboardPage, dll.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import {
  getDashboardKpi,
  getMonthlyTrend,
  getWeeklyTrend,
  getPlatformComparison,
  getCompanyPerformance,
  getDashboardTrend,
  getHeatmap,
  getStaffRanking,
  getLeaderboard,
  compareSessions,
  getDashboardInsights,
  getAIAnomalies,
  getAIRecommendations,
} from "../services/api";

// ─── KPI ────────────────────────────────────────────────────────────────────
export function useDashboardKpi(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.kpi(from, to),
    queryFn: ({ signal }) => getDashboardKpi(from, to, signal),
    enabled: true,
  });
}

// ─── Monthly Trend ───────────────────────────────────────────────────────────
export function useMonthlyTrend(year?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.monthly(year),
    queryFn: ({ signal }) => getMonthlyTrend(year, signal),
  });
}

// ─── Weekly Trend ────────────────────────────────────────────────────────────
export function useWeeklyTrend(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.weekly(from, to),
    queryFn: ({ signal }) => getWeeklyTrend(from, to, signal),
  });
}

// ─── Platform Comparison ─────────────────────────────────────────────────────
export function usePlatformComparison(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.platform(from, to),
    queryFn: ({ signal }) => getPlatformComparison(from, to, signal),
  });
}

// ─── Company Performance ─────────────────────────────────────────────────────
export function useCompanyPerformance(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.company(from, to),
    queryFn: ({ signal }) => getCompanyPerformance(from, to, signal),
  });
}

// ─── Dashboard Trend (per-session) ───────────────────────────────────────────
export function useDashboardTrend(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.trend(from, to),
    queryFn: () => getDashboardTrend(from, to),
  });
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
export function useHeatmap(year?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.heatmap(year),
    queryFn: ({ signal }) => getHeatmap(year, signal),
    staleTime: 10 * 60 * 1000, // heatmap tukar perlahan
  });
}

// ─── Staff Ranking ────────────────────────────────────────────────────────────
export function useStaffRanking(
  order: "top" | "bottom" = "top",
  limit = 10,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: queryKeys.dashboard.staffRanking(order, limit, from, to),
    queryFn: ({ signal }) => getStaffRanking(order, limit, from, to, signal),
  });
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export function useLeaderboard(params?: { from?: string; to?: string; department?: string }) {
  return useQuery({
    queryKey: queryKeys.leaderboard.list(params),
    queryFn: () => getLeaderboard(params),
  });
}

// ─── Session Comparison ───────────────────────────────────────────────────────
export function useSessionComparison(sessionA: string, sessionB: string) {
  return useQuery({
    queryKey: queryKeys.comparison.sessions(sessionA, sessionB),
    queryFn: () => compareSessions(sessionA, sessionB),
    enabled: !!sessionA && !!sessionB,
    staleTime: 15 * 60 * 1000, // comparisons are static once both sessions set
  });
}

// ─── AI Insights ─────────────────────────────────────────────────────────────
export function useAIInsights(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ["ai", "insights", { fromDate, toDate }],
    queryFn: () => getDashboardInsights(fromDate, toDate),
    staleTime: 30 * 60 * 1000, // AI responses are expensive — 30 min stale
    retry: 0,                  // jangan retry AI calls
  });
}

export function useAIAnomalies() {
  return useQuery({
    queryKey: ["ai", "anomalies"],
    queryFn: getAIAnomalies,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });
}

export function useAIRecommendations() {
  return useQuery({
    queryKey: ["ai", "recommendations"],
    queryFn: getAIRecommendations,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });
}

// ─── Prefetch helpers (untuk nav hover) ──────────────────────────────────────
export function usePrefetchDashboard() {
  const qc = useQueryClient();
  return (from?: string, to?: string) => {
    qc.prefetchQuery({
      queryKey: queryKeys.dashboard.kpi(from, to),
      queryFn: ({ signal }) => getDashboardKpi(from, to, signal),
      staleTime: 5 * 60 * 1000,
    });
    qc.prefetchQuery({
      queryKey: queryKeys.dashboard.company(from, to),
      queryFn: ({ signal }) => getCompanyPerformance(from, to, signal),
      staleTime: 5 * 60 * 1000,
    });
  };
}

export function usePrefetchLeaderboard() {
  const qc = useQueryClient();
  return (params?: { from?: string; to?: string; department?: string }) => {
    qc.prefetchQuery({
      queryKey: queryKeys.leaderboard.list(params),
      queryFn: () => getLeaderboard(params),
      staleTime: 5 * 60 * 1000,
    });
  };
}
