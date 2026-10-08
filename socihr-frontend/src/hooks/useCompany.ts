/**
 * hooks/useCompany.ts
 *
 * TanStack Query hooks untuk Company + Department + Platform.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import {
  getCompanies,
  createCompany,
  deleteCompany,
  getDepartments,
  createDepartment,
  deleteDepartment,
  getPlatforms,
  getCompanySessionPerformance,
} from "../services/api";

// ─── Companies ────────────────────────────────────────────────────────────────
export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.company.list,
    queryFn: getCompanies,
    staleTime: 10 * 60 * 1000, // company list tukar jarang
  });
}

export function useCompanyProfile(companyId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.company.profile(companyId, from, to),
    queryFn: ({ signal }) => getCompanySessionPerformance(companyId, from, to, signal),
    enabled: !!companyId,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCompany(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.company.all });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.company.all });
    },
  });
}

// ─── Departments ──────────────────────────────────────────────────────────────
export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.department.list,
    queryFn: getDepartments,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createDepartment(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.department.all });
    },
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.department.all });
    },
  });
}

// ─── Platforms ────────────────────────────────────────────────────────────────
export function usePlatforms() {
  return useQuery({
    queryKey: queryKeys.platform.list,
    queryFn: getPlatforms,
    staleTime: 15 * 60 * 1000, // platform list sangat stabil
  });
}
