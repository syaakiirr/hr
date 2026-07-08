import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { getStaffEngagementStats, getStaffList, type StaffEngagementStats } from "../services/api";

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#6366f1", "#0284c7", "#059669", "#d97706", "#dc2626", "#7c3aed"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      background: `${color}10`,
      border: `1.5px solid ${color}20`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: color,
    }}>
      {initials}
    </div>
  );
}

export default function StaffEngagementPage() {
  const [stats, setStats] = useState<StaffEngagementStats[]>([]);
  const [totalStaffCount, setTotalStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // Fetch true total staff count (unfiltered) once on mount
  useEffect(() => {
    getStaffList().then((data) => setTotalStaffCount(data.length)).catch(console.error);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStaffEngagementStats({
        search: search || undefined,
        department: filterDept || undefined,
        status: filterStatus || undefined,
      });
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterStatus]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const departments = Array.from(new Set(stats.map((s) => s.department).filter(Boolean))) as string[];
  const totalCompleted = stats.reduce((sum, s) => sum + s.totalCompleted, 0);
  const totalMissed = stats.reduce((sum, s) => sum + s.totalMissed, 0);
  const totalEngagements = stats.reduce((sum, s) => sum + s.totalEngagements, 0);
  const overallRate = totalEngagements > 0 ? Math.round((totalCompleted / totalEngagements) * 100) : 0;

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: -8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.2 }}
      >
        <div className="page-hd">
          <div>
            <h1 className="page-title">Staff Engagement Stats</h1>
            <p className="page-sub">Total ticks and completion rates for all staff</p>
          </div>
        </div>

        {/* Summary KPIs */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: 16, 
            marginBottom: 24 
          }}
        >
          <motion.div 
            className="card-premium" 
            style={{ padding: 20 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8, fontWeight: 600 }}>
              Total Staff
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>
              {totalStaffCount}
            </div>
          </motion.div>
          <motion.div 
            className="card-premium" 
            style={{ padding: 20 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8, fontWeight: 600 }}>
              Total Completed ✓
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#16a34a" }}>
              {totalCompleted.toLocaleString()}
            </div>
          </motion.div>
          <motion.div 
            className="card-premium" 
            style={{ padding: 20 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8, fontWeight: 600 }}>
              Total Missed
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#dc2626" }}>
              {totalMissed.toLocaleString()}
            </div>
          </motion.div>
          <motion.div 
            className="card-premium" 
            style={{ padding: 20 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8, fontWeight: 600 }}>
              Overall Rate
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>
              {overallRate}%
            </div>
          </motion.div>
        </motion.div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}
        >
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <input
              className="input"
              type="text"
              placeholder="Search staff name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            className="input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </motion.div>
      </motion.div>

      {/* Stats Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="tbl-wrap"
      >
        {loading ? (
          <div className="loader">
            <div className="spin" />
            Loading engagement statistics...
          </div>
        ) : stats.length === 0 ? (
          <div className="empty">
            <div className="empty-ico">📊</div>
            <p className="empty-title">No Data Found</p>
            <p className="empty-desc">No staff engagement data available.</p>
          </div>
        ) : (
          <table className="tbl data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Staff Name</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Total Posts</th>
                <th style={{ textAlign: "center" }}>✓ Completed</th>
                <th style={{ textAlign: "center" }}>✗ Missed</th>
                <th style={{ textAlign: "center" }}>Completion %</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, idx) => (
                <tr key={stat.staffID}>
                  <td style={{ color: "var(--text-4)", fontWeight: 600 }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={stat.fullName} />
                      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>
                        {stat.fullName}
                      </span>
                    </div>
                  </td>
                  <td>
                    {stat.department ? (
                      <span className="badge badge-neutral">{stat.department}</span>
                    ) : (
                      <span style={{ color: "var(--text-4)" }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-3)" }}>
                    {stat.position || <span style={{ color: "var(--text-4)" }}>—</span>}
                  </td>
                  <td>
                    <span className={`badge ${stat.status === "Active" ? "badge-green" : "badge-red"}`}>
                      {stat.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 600, fontSize: 15 }}>
                    {stat.totalEngagements}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ 
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 50,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                      color: "#166534",
                      fontWeight: 700,
                      fontSize: 15,
                      border: "1.5px solid #bbf7d0"
                    }}>
                      {stat.totalCompleted}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ 
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 50,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                      color: "#991b1b",
                      fontWeight: 700,
                      fontSize: 15,
                      border: "1.5px solid #fecaca"
                    }}>
                      {stat.totalMissed}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ 
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: stat.completionRate >= 80 
                        ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                        : stat.completionRate >= 60
                        ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                        : "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                      border: stat.completionRate >= 80 
                        ? "1.5px solid #bbf7d0"
                        : stat.completionRate >= 60
                        ? "1.5px solid #fde68a"
                        : "1.5px solid #fecaca",
                    }}>
                      <span style={{ 
                        fontWeight: 800,
                        fontSize: 16,
                        color: stat.completionRate >= 80 
                          ? "#166534"
                          : stat.completionRate >= 60
                          ? "#92400e"
                          : "#991b1b"
                      }}>
                        {stat.completionRate}%
                      </span>
                      {stat.completionRate >= 80 && (
                        <span style={{ fontSize: 14 }}>🔥</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </Layout>
  );
}
