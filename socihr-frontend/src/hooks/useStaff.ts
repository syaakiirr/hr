/**
 * hooks/useStaff.ts
 *
 * TanStack Query hooks untuk Staff CRUD, pagination, profil, engagement, dan archive.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import {
  getStaffList,
  getStaffPaged,
  createStaff,
  updateStaff,
  deleteStaff,
  toggleStaffStatus,
  archiveStaff,
  restoreStaff,
  getArchivedStaff,
  getStaffSessionPerformance,
  getStaffEngagementStats,
  type Staff,
} from "../services/api";

// ─── List (semua, tanpa paging) ──────────────────────────────────────────────
export function useStaffList(params?: { search?: string; department?: string; status?: string }) {
  return useQuery({
    queryKey: queryKeys.staff.list(params),
    queryFn: () => getStaffList(params),
  });
}

// ─── Paginated ────────────────────────────────────────────────────────────────
export function useStaffPaged(params?: {
  search?: string;
  department?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: queryKeys.staff.paged(params),
    queryFn: () => getStaffPaged(params),
    placeholderData: (prev) => prev, // kekalkan data lama semasa loading page baru
  });
}

// ─── Staff Profil (per-session performance) ───────────────────────────────────
export function useStaffProfile(staffId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.staff.profile(staffId),
    queryFn: ({ signal }) => getStaffSessionPerformance(staffId, from, to, signal),
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Engagement Stats ─────────────────────────────────────────────────────────
export function useStaffEngagement(params?: {
  search?: string;
  department?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: queryKeys.staff.engagement(params),
    queryFn: () => getStaffEngagementStats(params),
  });
}

// ─── Archived Staff ───────────────────────────────────────────────────────────
export function useArchivedStaff() {
  return useQuery({
    queryKey: queryKeys.staff.archived,
    queryFn: getArchivedStaff,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fullName: string; department?: string; position?: string; staffType?: string }) =>
      createStaff(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { fullName: string; department?: string; position?: string; staffType?: string } }) =>
      updateStaff(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
      // Update cache terus untuk profil yang spesifik
      qc.invalidateQueries({ queryKey: queryKeys.staff.profile(updated.staffID) });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => deleteStaff(staffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
  });
}

export function useToggleStaffStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => toggleStaffStatus(staffId),
    onMutate: async (staffId) => {
      // Optimistic update — tukar status terus tanpa tunggu server
      await qc.cancelQueries({ queryKey: queryKeys.staff.all });
      const previous = qc.getQueriesData<Staff[]>({ queryKey: queryKeys.staff.all });
      qc.setQueriesData<Staff[]>({ queryKey: queryKeys.staff.all }, (old) =>
        old?.map((s) =>
          s.staffID === staffId
            ? { ...s, status: s.status === "Active" ? "Inactive" : "Active" }
            : s,
        ),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      // Rollback jika server reject
      if (ctx?.previous) {
        ctx.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
  });
}

export function useArchiveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => archiveStaff(staffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
  });
}

export function useRestoreStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => restoreStaff(staffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
  });
}
