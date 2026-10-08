/**
 * hooks/useMisc.ts
 *
 * TanStack Query hooks untuk Snapshots, Audit Trail, dan Users.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import {
  getSnapshots,
  getSnapshot,
  createSnapshot,
  deleteSnapshot,
  getAuditTrail,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../services/api";

// ─── Snapshots ────────────────────────────────────────────────────────────────
export function useSnapshots() {
  return useQuery({
    queryKey: queryKeys.snapshots.list,
    queryFn: getSnapshots,
  });
}

export function useSnapshotDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.snapshots.detail(id),
    queryFn: () => getSnapshot(id),
    enabled: !!id,
    staleTime: Infinity, // snapshot adalah rekod tidak berubah
  });
}

export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      notes,
      fromDate,
      toDate,
    }: {
      name: string;
      notes?: string;
      fromDate?: string;
      toDate?: string;
    }) => createSnapshot(name, notes, fromDate, toDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.snapshots.all });
    },
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSnapshot(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.snapshots.all });
    },
  });
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────
export function useAuditTrail(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: queryKeys.audit.paged(page, pageSize),
    queryFn: () => getAuditTrail(page, pageSize),
    placeholderData: (prev) => prev, // kekalkan data lama semasa paging
    staleTime: 60 * 1000, // audit jarang berubah dalam satu sesi — 1 min cukup
  });
}

// ─── Users (SuperAdmin) ───────────────────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list,
    queryFn: getUsers,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string; role: string; departmentID?: string }) =>
      createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { username?: string; password?: string; departmentID?: string } }) =>
      updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
