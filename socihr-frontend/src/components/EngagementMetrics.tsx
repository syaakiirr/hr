import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDashboardKpi, getSessions, getEngagements } from "../services/api";

const MAX_SESSIONS = 30; // Limit concurrent API calls

// Frontend implementation of TickHelper.cs to calculate ticks at action level
const calculateTicks = (platformName: string, isLiked: boolean, isCommented: boolean, isShared: boolean) => {
  const platform = platformName.toLowerCase();
  let ticked = 0;
  let expected = 0;
  
  if (platform === "facebook") {
    expected = 2;
    if (isLiked) ticked++;
    if (isCommented) ticked++;
  } else if (platform === "instagram") {
    expected = 2;
    if (isLiked) ticked++;
    if (isCommented) ticked++;
  } else if (platform === "tiktok") {
    expected = 1;
    if (isCommented) ticked++;
  } else {
    expected = 3;
    if (isLiked) ticked++;
    if (isCommented) ticked++;
    if (isShared) ticked++;
  }
  
  return { ticked, missed: expected - ticked, expected };
};

interface MetricRow {
  id: string;
  label: string;
  date?: string;
  completed: number;
  missed: number;
  total: number;
  rate: number;
}

// Memoized table row component to prevent unnecessary re-renders
const MetricTableRow = memo(({ metric, idx }: { metric: MetricRow; idx: number }) => (
  <motion.tr
    key={metric.id}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: idx * 0.02, duration: 0.2 }}
  >
    <td style={{ color: "var(--text-4)", fontWeight: 600 }}>{idx + 1}</td>
    <td style={{ fontWeight: 600, color: "var(--text-1)" }}>{metric.label}</td>
    <td style={{ color: "var(--text-2)", fontSize: 13 }}>
      {metric.date
        ? (() => {
            const [y, m, d] = metric.date!.split("-").map(Number);
            return new Date(y, m - 1, d).toLocaleDateString("en-US", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          })()
        : "—"}
    </td>
    <td style={{ textAlign: "center" }}>
      <span className="badge badge-green">{metric.completed}</span>
    </td>
    <td style={{ textAlign: "center" }}>
      <span className="badge badge-red">{metric.missed}</span>
    </td>
    <td style={{ textAlign: "center", fontWeight: 700, color: "var(--text-1)" }}>{metric.total}</td>
    <td style={{ textAlign: "center" }}>
      <span
        className={`badge ${
          metric.rate >= 75 ? "badge-green" : metric.rate >= 50 ? "badge-amber" : "badge-red"
        }`}
      >
        {metric.rate}%
      </span>
    </td>
  </motion.tr>
));

export default function EngagementMetrics() {
  const [mode, setMode] = useState<"session" | "overall">("overall");
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [mode]);

  async function loadData() {
    setLoading(true);
    try {
      if (mode === "overall") {
        // Use dashboard KPI endpoint — only 1 API call (fixes N+1 bug)
        const kpiData = await getDashboardKpi();
        const total = kpiData.totalCompleted + kpiData.totalMissed;
        const rate = total > 0 ? Math.round((kpiData.totalCompleted / total) * 100) : 0;
        setMetrics([
          {
            id: "overall",
            label: "All Sessions Combined",
            completed: kpiData.totalCompleted,
            missed: kpiData.totalMissed,
            total,
            rate,
          },
        ]);
      } else {
        // Limit to recent 30 sessions to prevent N+1 overload
        const allSessions = await getSessions();
        const limited = allSessions.slice(0, MAX_SESSIONS);

        const allData = await Promise.all(
          limited.map((session) =>
            getEngagements(session.sessionID).then((engagements) => ({ session, engagements }))
          )
        );

        const sessionMetrics: MetricRow[] = allData.map(({ session, engagements }, idx) => {
          let totalCompleted = 0;
          let totalMissed = 0;
          let totalExpected = 0;
          
          engagements.forEach(e => {
            const { ticked, missed, expected } = calculateTicks(
              e.platformName, 
              e.isLiked, 
              e.isCommented, 
              e.isShared
            );
            totalCompleted += ticked;
            totalMissed += missed;
            totalExpected += expected;
          });
          
          const rate = totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;

          return {
            id: session.sessionID,
            label: `Session ${idx + 1}`,
            date: session.sessionDate,
            completed: totalCompleted,
            missed: totalMissed,
            total: totalExpected,
            rate,
          };
        });

        // Sort by date descending
        sessionMetrics.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setMetrics(sessionMetrics);
      }
    } catch (err) {
      console.error("Failed to load metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="card chart-animate"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: 24 }}
    >
      {/* Header with toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>
            Engagement Tick Metrics
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            View completion statistics {mode === "overall" ? "across all sessions" : "by individual session"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", borderRadius: 8, padding: 3, border: "1px solid var(--line)" }}>
          <button
            onClick={() => setMode("overall")}
            className={`btn btn-sm ${mode === "overall" ? "btn-primary" : "btn-ghost"}`}
            style={{ height: 32 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Overall
          </button>
          <button
            onClick={() => setMode("session")}
            className={`btn btn-sm ${mode === "session" ? "btn-primary" : "btn-ghost"}`}
            style={{ height: 32 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            By Session
          </button>
        </div>
      </div>

      {/* Metrics display */}
      {loading ? (
        <div className="loader" style={{ padding: "40px 0" }}>
          <div className="spin" />
          <span>Loading metrics...</span>
        </div>
      ) : metrics.length === 0 ? (
        <div className="empty" style={{ padding: "40px 20px" }}>
          <div className="empty-ico">📊</div>
          <p className="empty-title">No Data Available</p>
          <p className="empty-desc">No engagement data found for the selected view.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {mode === "overall" ? (
              // Overall summary view - large cards
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                <div style={{ background: "var(--green-soft)", border: "1px solid var(--green-line)", borderRadius: 10, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Completed
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: "var(--green)", letterSpacing: "-0.03em" }}>
                    {metrics[0].completed}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                    Total ticks completed
                  </p>
                </div>

                <div style={{ background: "var(--red-soft)", border: "1px solid var(--red-line)", borderRadius: 10, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Missed
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: "var(--red)", letterSpacing: "-0.03em" }}>
                    {metrics[0].missed}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                    Total ticks missed
                  </p>
                </div>

                <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Total
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: "var(--accent-text)", letterSpacing: "-0.03em" }}>
                    {metrics[0].total}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                    Overall engagements
                  </p>
                </div>

                <div
                  style={{
                    background: metrics[0].rate >= 75 ? "var(--green-soft)" : metrics[0].rate >= 50 ? "var(--amber-soft)" : "var(--red-soft)",
                    border: `1px solid ${metrics[0].rate >= 75 ? "var(--green-line)" : metrics[0].rate >= 50 ? "var(--amber-line)" : "var(--red-line)"}`,
                    borderRadius: 10,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Completion Rate
                  </p>
                  <p
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: metrics[0].rate >= 75 ? "var(--green)" : metrics[0].rate >= 50 ? "var(--amber)" : "var(--red)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {metrics[0].rate}%
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                    Success percentage
                  </p>
                </div>
              </div>
            ) : (
              // Session-by-session table view
              <div className="tbl-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Session</th>
                      <th>Date</th>
                      <th style={{ textAlign: "center" }}>Completed</th>
                      <th style={{ textAlign: "center" }}>Missed</th>
                      <th style={{ textAlign: "center" }}>Total</th>
                      <th style={{ textAlign: "center" }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric, idx) => (
                      <MetricTableRow key={metric.id} metric={metric} idx={idx} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}
