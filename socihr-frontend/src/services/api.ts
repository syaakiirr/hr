const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5094/api";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = "An error occurred. Please try again.";
    try {
      const err = JSON.parse(text);
      if (err?.message) message = err.message;
    } catch {
      // response body wasn't JSON; fall back to the default message
    }
    throw new Error(message);
  }
  return res.json();
}

// ─── Auth ───────────────────────────────────────────
export async function login(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Username: username, Password: password }),
  });
  return handleResponse<{ token: string; username: string; role: string }>(res);
}

// ─── Staff ──────────────────────────────────────────
export interface Staff {
  staffID: string;
  fullName: string;
  department: string;
  position?: string;
  status: string;
  createdAt: string;
}

export async function getStaffList(params?: { search?: string; department?: string; status?: string }): Promise<Staff[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.department) q.set("department", params.department);
  if (params?.status) q.set("status", params.status);
  const res = await fetch(`${BASE_URL}/staff?${q}`, { headers: authHeaders() });
  return handleResponse<Staff[]>(res);
}

export async function createStaff(data: { fullName: string; department?: string; position?: string }): Promise<Staff> {
  const res = await fetch(`${BASE_URL}/staff`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return handleResponse<Staff>(res);
}

export async function updateStaff(id: string, data: { fullName: string; department?: string; position?: string }): Promise<Staff> {
  const res = await fetch(`${BASE_URL}/staff/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(data) });
  return handleResponse<Staff>(res);
}

export async function toggleStaffStatus(id: string): Promise<Staff> {
  const res = await fetch(`${BASE_URL}/staff/${id}/toggle-status`, { method: "PATCH", headers: authHeaders() });
  return handleResponse<Staff>(res);
}

export interface StaffEngagementStats {
  staffID: string;
  fullName: string;
  department: string;
  position?: string;
  status: string;
  totalPosts: number;
  totalEngagements: number;
  totalCompleted: number;
  totalMissed: number;
  completionRate: number;
}

export async function getStaffEngagementStats(params?: { search?: string; department?: string; status?: string }): Promise<StaffEngagementStats[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.department) q.set("department", params.department);
  if (params?.status) q.set("status", params.status);
  const res = await fetch(`${BASE_URL}/staff/engagement-stats?${q}`, { headers: authHeaders() });
  return handleResponse<StaffEngagementStats[]>(res);
}

// ─── Platform ───────────────────────────────────────
export interface Platform {
  platformID: string;
  platformName: string;
}

export async function getPlatforms(): Promise<Platform[]> {
  const res = await fetch(`${BASE_URL}/platform`, { headers: authHeaders() });
  return handleResponse<Platform[]>(res);
}

// ─── Company ────────────────────────────────────────
export interface Company {
  companyID: string;
  companyName: string;
}

export async function getCompanies(): Promise<Company[]> {
  const res = await fetch(`${BASE_URL}/company`, { headers: authHeaders() });
  return handleResponse<Company[]>(res);
}

export async function createCompany(name: string): Promise<Company> {
  const res = await fetch(`${BASE_URL}/company`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ CompanyName: name })
  });
  return handleResponse<Company>(res);
}


// ─── Monitoring Session ──────────────────────────────
export interface SessionPost {
  postID: string;
  platformID: string;
  platformName: string;
  postLink: string;
  companyID?: string;
  companyName?: string;
}

export interface MonitoringSession {
  sessionID: string;
  sessionDate: string;
  createdBy: string;
  createdAt: string;
  posts: SessionPost[];
  companies: { companyID: string; companyName: string }[];
}

export async function getSessions(): Promise<MonitoringSession[]> {
  const res = await fetch(`${BASE_URL}/monitoringsession`, { headers: authHeaders() });
  return handleResponse<MonitoringSession[]>(res);
}

export async function createSession(data: { sessionDate: string; posts: { platformID: string; postLink: string }[]; companyIDs?: string[] }): Promise<{ sessionID: string }> {
  const res = await fetch(`${BASE_URL}/monitoringsession`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) });
  return handleResponse<{ sessionID: string }>(res);
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/monitoringsession/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to delete session.");
}

export async function updatePostLink(postId: string, postLink: string): Promise<{ postID: string; postLink: string }> {
  const res = await fetch(`${BASE_URL}/monitoringsession/posts/${postId}/link`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ PostLink: postLink }),
  });
  return handleResponse<{ postID: string; postLink: string }>(res);
}

// ─── Engagement ─────────────────────────────────────
export interface Engagement {
  engagementID: string;
  sessionID: string;
  postID: string;
  staffID: string;
  staffName: string;
  department: string;
  companyID?: string;
  companyName?: string;
  platformID: string;
  platformName: string;
  postLink: string;
  status: string;
  isLiked: boolean;
  isCommented: boolean;
  isShared: boolean;
  reason?: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export async function getEngagements(sessionId: string): Promise<Engagement[]> {
  const res = await fetch(`${BASE_URL}/engagement?sessionId=${sessionId}`, { headers: authHeaders() });
  return handleResponse<Engagement[]>(res);
}

export async function updateEngagementStatus(id: string, status: string): Promise<{ engagementID: string; status: string }> {
  const res = await fetch(`${BASE_URL}/engagement/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ Status: status }),
  });
  return handleResponse<{ engagementID: string; status: string }>(res);
}

export async function updateEngagementAction(
  id: string,
  action: "like" | "comment" | "share",
  value: boolean
): Promise<{ engagementID: string; status: string; isLiked: boolean; isCommented: boolean; isShared: boolean }> {
  const res = await fetch(`${BASE_URL}/engagement/${id}/action`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ Action: action, Value: value }),
  });
  return handleResponse<{ engagementID: string; status: string; isLiked: boolean; isCommented: boolean; isShared: boolean }>(res);
}

export async function updateEngagementReason(id: string, reason: string): Promise<{ engagementID: string; reason: string | null }> {
  const res = await fetch(`${BASE_URL}/engagement/${id}/reason`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ Reason: reason }),
  });
  return handleResponse<{ engagementID: string; reason: string | null }>(res);
}

export async function bulkUpdateEngagementStatus(engagementIDs: string[], status: string): Promise<{ message: string; updatedCount: number; status: string }> {
  const res = await fetch(`${BASE_URL}/engagement/bulk-update`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ EngagementIDs: engagementIDs, Status: status }),
  });
  return handleResponse<{ message: string; updatedCount: number; status: string }>(res);
}

// ─── Dashboard ──────────────────────────────────────
export interface KpiData {
  totalStaff: number;
  totalSessions: number;
  totalPlatforms: number;
  totalExpected: number;
  totalCompleted: number;
  totalMissed: number;
  completionRate: number;
}

export async function getDashboardKpi(from?: string, to?: string): Promise<KpiData> {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await fetch(`${BASE_URL}/dashboard/kpi?${q}`, { headers: authHeaders() });
  return handleResponse<KpiData>(res);
}

export async function getMonthlyTrend(year?: number) {
  const q = year ? `?year=${year}` : "";
  const res = await fetch(`${BASE_URL}/dashboard/monthly${q}`, { headers: authHeaders() });
  return handleResponse<{ month: number; completed: number; missed: number; total: number }[]>(res);
}

export async function getWeeklyTrend() {
  const res = await fetch(`${BASE_URL}/dashboard/weekly`, { headers: authHeaders() });
  return handleResponse<{ week: string; completed: number; missed: number; total: number }[]>(res);
}

export async function getPlatformComparison() {
  const res = await fetch(`${BASE_URL}/dashboard/platform-comparison`, { headers: authHeaders() });
  return handleResponse<{ platform: string; completed: number; missed: number; total: number }[]>(res);
}

export async function getCompanyPerformance() {
  const res = await fetch(`${BASE_URL}/dashboard/company-performance`, { headers: authHeaders() });
  return handleResponse<{ companyID: string; company: string; completed: number; missed: number; total: number; rate: number }[]>(res);
}

export async function getStaffRanking(order: "top" | "bottom" = "top", limit = 10, from?: string, to?: string) {
  const q = new URLSearchParams();
  q.set("order", order);
  q.set("limit", String(limit));
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await fetch(`${BASE_URL}/dashboard/staff-ranking?${q}`, { headers: authHeaders() });
  return handleResponse<{ staffID: string; fullName: string; department: string; completed: number; total: number; completionRate: number }[]>(res);
}

export async function getHeatmap(year?: number) {
  const q = year ? `?year=${year}` : "";
  const res = await fetch(`${BASE_URL}/dashboard/heatmap${q}`, { headers: authHeaders() });
  return handleResponse<{ date: string; completed: number; total: number }[]>(res);
}

// ─── Dashboard Snapshots ────────────────────────────
export interface DashboardSnapshot {
  snapshotID: string;
  snapshotName: string;
  snapshotDate: string;
  createdBy: string;
  createdAt: string;
  notes?: string;
}

export async function createSnapshot(name: string, notes?: string, fromDate?: string, toDate?: string): Promise<{ snapshotID: string; message: string }> {
  const res = await fetch(`${BASE_URL}/dashboard/snapshot/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ Name: name, Notes: notes, FromDate: fromDate, ToDate: toDate }),
  });
  return handleResponse<{ snapshotID: string; message: string }>(res);
}

export async function getSnapshots(): Promise<DashboardSnapshot[]> {
  const res = await fetch(`${BASE_URL}/dashboard/snapshot/list`, { headers: authHeaders() });
  return handleResponse<DashboardSnapshot[]>(res);
}

export async function getSnapshot(id: string) {
  const res = await fetch(`${BASE_URL}/dashboard/snapshot/${id}`, { headers: authHeaders() });
  return handleResponse<any>(res);
}

export async function deleteSnapshot(id: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/dashboard/snapshot/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<{ message: string }>(res);
}

export async function deleteStaff(staffId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/staff/${staffId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete staff.");
}

// ─── Archive ────────────────────────────────────────
export async function archiveStaff(staffId: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/staff/${staffId}/archive`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<{ message: string }>(res);
}

export async function restoreStaff(staffId: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/staff/${staffId}/restore`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<{ message: string }>(res);
}

export async function getArchivedStaff(): Promise<Staff[]> {
  const res = await fetch(`${BASE_URL}/staff/archived`, { headers: authHeaders() });
  return handleResponse<Staff[]>(res);
}

export async function archiveSession(sessionId: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/monitoringsession/${sessionId}/archive`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<{ message: string }>(res);
}

export async function restoreSession(sessionId: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/monitoringsession/${sessionId}/restore`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<{ message: string }>(res);
}

export async function getArchivedSessions(): Promise<MonitoringSession[]> {
  const res = await fetch(`${BASE_URL}/monitoringsession/archived`, { headers: authHeaders() });
  return handleResponse<MonitoringSession[]>(res);
}

// ─── AI Insights ────────────────────────────────────
export async function getDashboardInsights(fromDate?: string, toDate?: string): Promise<{ insights: string; generatedAt: string }> {
  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);
  
  const res = await fetch(`${BASE_URL}/aiinsights/dashboard-insights?${params}`, {
    headers: authHeaders()
  });
  return handleResponse<{ insights: string; generatedAt: string }>(res);
}

export async function askAIQuestion(question: string, fromDate?: string, toDate?: string): Promise<{ question: string; answer: string; answeredAt: string }> {
  const res = await fetch(`${BASE_URL}/aiinsights/ask`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ Question: question, FromDate: fromDate, ToDate: toDate })
  });
  return handleResponse<{ question: string; answer: string; answeredAt: string }>(res);
}

export async function getAIAnomalies(): Promise<{ anomalies: string[]; checkedAt: string }> {
  const res = await fetch(`${BASE_URL}/aiinsights/anomalies`, {
    headers: authHeaders()
  });
  return handleResponse<{ anomalies: string[]; checkedAt: string }>(res);
}

export async function getAIRecommendations(): Promise<{ recommendations: string }> {
  const res = await fetch(`${BASE_URL}/aiinsights/recommendations`, {
    headers: authHeaders()
  });
  return handleResponse<{ recommendations: string }>(res);
}

// ─── Reports ────────────────────────────────────────
export function buildReportUrl(format: "excel" | "pdf", from?: string, to?: string): string {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return `${BASE_URL}/reports/${format}?${q}`;
}

// ─── Audit Trail ────────────────────────────────────
export interface AuditItem {
  auditID: string;
  engagementID: string;
  previousStatus: string;
  newStatus: string;
  updatedBy: string;
  updatedAt: string;
  staffName: string;
  department: string;
  platformName: string;
  sessionDate: string;
}

export async function getAuditTrail(page = 1, pageSize = 50): Promise<{ total: number; page: number; pageSize: number; items: AuditItem[] }> {
  const res = await fetch(`${BASE_URL}/audit?page=${page}&pageSize=${pageSize}`, { headers: authHeaders() });
  return handleResponse<{ total: number; page: number; pageSize: number; items: AuditItem[] }>(res);
}
