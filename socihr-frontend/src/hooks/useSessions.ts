/**
 * hooks/useSessions.ts
 *
 * TanStack Query hooks untuk Monitoring Sessions, Engagements, dan Archive.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  archiveSession,
  restoreSession,
  getArchivedSessions,
  getEngagements,
  updateEngagementStatus,
  updateEngagementAction,
  updateEngagementReason,
  bulkUpdateEngagementStatus,
  addStaffToSession,
  updatePostLink,
  type Engagement,
} from "../services/api";

// ─── Sessions ─────────────────────────────────────────────────────────────────
export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions.list,
    queryFn: getSessions,
  });
}

export function useArchivedSessions() {
  return useQuery({
    queryKey: queryKeys.sessions.archived,
    queryFn: getArchivedSessions,
  });
}

// ─── Engagements (per session) ────────────────────────────────────────────────
export function useEngagements(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.engagements(sessionId),
    queryFn: () => getEngagements(sessionId),
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000, // engagement data lebih dinamik — stale 2 min
  });
}

// ─── Mutations: Sessions ──────────────────────────────────────────────────────
export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionDate: string; posts: { platformID: string; postLink: string }[]; companyIDs?: string[] }) =>
      createSession(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { sessionDate: string; companyIDs: string[]; platformIDs: string[] } }) =>
      updateSession(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useArchiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useRestoreSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useAddStaffToSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionID, staffIDs }: { sessionID: string; staffIDs: string[] }) =>
      addStaffToSession(sessionID, staffIDs),
    onSuccess: (_data, { sessionID }) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.engagements(sessionID) });
    },
  });
}

// ─── Mutations: Engagements (optimistic) ──────────────────────────────────────
export function useUpdateEngagementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string; sessionId: string }) =>
      updateEngagementStatus(id, status),
    onMutate: async ({ id, status, sessionId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.sessions.engagements(sessionId) });
      const previous = qc.getQueryData<Engagement[]>(queryKeys.sessions.engagements(sessionId));
      qc.setQueryData<Engagement[]>(
        queryKeys.sessions.engagements(sessionId),
        (old) => old?.map((e) => (e.engagementID === id ? { ...e, status } : e)),
      );
      return { previous, sessionId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.sessions.engagements(ctx.sessionId), ctx.previous);
      }
    },
    onSettled: (_data, _err, { sessionId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.engagements(sessionId) });
    },
  });
}

export function useUpdateEngagementAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      value,
    }: {
      id: string;
      action: "like" | "comment" | "share";
      value: boolean;
      sessionId: string;
    }) => updateEngagementAction(id, action, value),
    onMutate: async ({ id, action, value, sessionId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.sessions.engagements(sessionId) });
      const previous = qc.getQueryData<Engagement[]>(queryKeys.sessions.engagements(sessionId));
      qc.setQueryData<Engagement[]>(
        queryKeys.sessions.engagements(sessionId),
        (old) =>
          old?.map((e) => {
            if (e.engagementID !== id) return e;
            return {
              ...e,
              isLiked: action === "like" ? value : e.isLiked,
              isCommented: action === "comment" ? value : e.isCommented,
              isShared: action === "share" ? value : e.isShared,
            };
          }),
      );
      return { previous, sessionId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.sessions.engagements(ctx.sessionId), ctx.previous);
      }
    },
    onSettled: (_data, _err, { sessionId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.engagements(sessionId) });
    },
  });
}

export function useUpdateEngagementReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string; sessionId: string }) =>
      updateEngagementReason(id, reason),
    onSettled: (_data, _err, { sessionId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.engagements(sessionId) });
    },
  });
}

export function useBulkUpdateEngagementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string; sessionId: string }) =>
      bulkUpdateEngagementStatus(ids, status),
    onSettled: (_data, _err, { sessionId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.engagements(sessionId) });
    },
  });
}

export function useUpdatePostLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, postLink }: { postId: string; postLink: string }) =>
      updatePostLink(postId, postLink),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}
