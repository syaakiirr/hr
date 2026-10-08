/**
 * Query Keys — sumber kebenaran tunggal untuk semua cache keys.
 * Guna fungsi ini di hooks DAN semasa invalidate mutations.
 *
 * Contoh:
 *   queryKeys.dashboard.kpi({ from, to })   → ["dashboard", "kpi", { from, to }]
 *   queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
 */
export const queryKeys = {
  // ─── Dashboard ──────────────────────────────────────
  dashboard: {
    all:               ["dashboard"] as const,
    kpi:    (f?: string, t?: string) => ["dashboard", "kpi",    { from: f, to: t }] as const,
    monthly:(year?: number)          => ["dashboard", "monthly",{ year }] as const,
    weekly: (f?: string, t?: string) => ["dashboard", "weekly", { from: f, to: t }] as const,
    platform:(f?: string, t?: string)=> ["dashboard", "platform",{ from: f, to: t }] as const,
    company:(f?: string, t?: string) => ["dashboard", "company",{ from: f, to: t }] as const,
    trend:  (f?: string, t?: string) => ["dashboard", "trend",  { from: f, to: t }] as const,
    heatmap:(year?: number)          => ["dashboard", "heatmap",{ year }] as const,
    staffRanking:(order: string, limit: number, f?: string, t?: string) =>
                                        ["dashboard", "staffRanking", { order, limit, from: f, to: t }] as const,
  },

  // ─── Leaderboard ────────────────────────────────────
  leaderboard: {
    all:               ["leaderboard"] as const,
    list: (p?: { from?: string; to?: string; department?: string }) =>
                        ["leaderboard", "list", p] as const,
  },

  // ─── Staff ──────────────────────────────────────────
  staff: {
    all:               ["staff"] as const,
    list:  (p?: { search?: string; department?: string; status?: string }) =>
                        ["staff", "list", p] as const,
    paged: (p?: { search?: string; department?: string; status?: string; page?: number; pageSize?: number }) =>
                        ["staff", "paged", p] as const,
    profile:(id: string) => ["staff", "profile", id] as const,
    engagement:(p?: object) => ["staff", "engagement", p] as const,
    archived:           ["staff", "archived"] as const,
    ranking: (order: string, limit: number, f?: string, t?: string) =>
                        ["staff", "ranking", { order, limit, from: f, to: t }] as const,
  },

  // ─── Company ────────────────────────────────────────
  company: {
    all:               ["company"] as const,
    list:              ["company", "list"] as const,
    profile:(id: string, f?: string, t?: string) => ["company", "profile", id, { from: f, to: t }] as const,
  },

  // ─── Department ─────────────────────────────────────
  department: {
    all:               ["department"] as const,
    list:              ["department", "list"] as const,
  },

  // ─── Platform ───────────────────────────────────────
  platform: {
    all:               ["platform"] as const,
    list:              ["platform", "list"] as const,
  },

  // ─── Monitoring Sessions ─────────────────────────────
  sessions: {
    all:               ["sessions"] as const,
    list:              ["sessions", "list"] as const,
    archived:          ["sessions", "archived"] as const,
    engagements:(id: string) => ["sessions", "engagements", id] as const,
  },

  // ─── Snapshots ──────────────────────────────────────
  snapshots: {
    all:               ["snapshots"] as const,
    list:              ["snapshots", "list"] as const,
    detail:(id: string)=> ["snapshots", "detail", id] as const,
  },

  // ─── Audit Trail ────────────────────────────────────
  audit: {
    all:               ["audit"] as const,
    paged:(page: number, size: number) => ["audit", "paged", { page, size }] as const,
  },

  // ─── Users ──────────────────────────────────────────
  users: {
    all:               ["users"] as const,
    list:              ["users", "list"] as const,
  },

  // ─── Comparisons ────────────────────────────────────
  comparison: {
    sessions:(a: string, b: string) => ["comparison", "sessions", a, b] as const,
  },
} as const;
