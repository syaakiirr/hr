import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import {
  getDashboardKpi,
  getCompanyPerformance,
  getWeeklyTrend,
  getMonthlyTrend,
  getPlatformComparison,
  getLeaderboard,
  getStaffPaged,
  getStaffList,
  getCompanies,
  getDepartments,
  getSessions,
  getSnapshots,
  getAuditTrail,
  getUsers,
  getArchivedStaff,
  getArchivedSessions,
} from "../services/api";

/**
 * Prefetches data for a given path when a user hovers over navigation links.
 * This makes page transitions feel instantaneous without showing loaders.
 */
export function prefetchRoute(path: string) {
  switch (path) {
    case "/dashboard": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.kpi(),
        queryFn: ({ signal }) => getDashboardKpi(undefined, undefined, signal),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.company(),
        queryFn: ({ signal }) => getCompanyPerformance(undefined, undefined, signal),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.monthly(new Date().getFullYear()),
        queryFn: ({ signal }) => getMonthlyTrend(new Date().getFullYear(), signal),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.weekly(),
        queryFn: ({ signal }) => getWeeklyTrend(undefined, undefined, signal),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.platform(),
        queryFn: ({ signal }) => getPlatformComparison(undefined, undefined, signal),
        staleTime: 5 * 60 * 1000,
      });
      break;
    }
    case "/leaderboard": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.leaderboard.list(),
        queryFn: () => getLeaderboard(),
        staleTime: 5 * 60 * 1000,
      });
      break;
    }
    case "/staff": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.staff.list(),
        queryFn: () => getStaffList(),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.staff.paged({ page: 1, pageSize: 10 }),
        queryFn: () => getStaffPaged({ page: 1, pageSize: 10 }),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.department.list,
        queryFn: getDepartments,
        staleTime: 10 * 60 * 1000,
      });
      break;
    }
    case "/company": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.company.list,
        queryFn: getCompanies,
        staleTime: 10 * 60 * 1000,
      });
      break;
    }
    case "/departments": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.department.list,
        queryFn: getDepartments,
        staleTime: 10 * 60 * 1000,
      });
      break;
    }
    case "/monitoring": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.sessions.list,
        queryFn: getSessions,
        staleTime: 3 * 60 * 1000,
      });
      break;
    }
    case "/snapshots": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.snapshots.list,
        queryFn: getSnapshots,
        staleTime: 5 * 60 * 1000,
      });
      break;
    }
    case "/audit": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.audit.paged(1, 50),
        queryFn: () => getAuditTrail(1, 50),
        staleTime: 60 * 1000,
      });
      break;
    }
    case "/users": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.users.list,
        queryFn: getUsers,
        staleTime: 10 * 60 * 1000,
      });
      break;
    }
    case "/archived": {
      queryClient.prefetchQuery({
        queryKey: queryKeys.staff.archived,
        queryFn: getArchivedStaff,
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: queryKeys.sessions.archived,
        queryFn: getArchivedSessions,
        staleTime: 5 * 60 * 1000,
      });
      break;
    }
    default:
      break;
  }
}
