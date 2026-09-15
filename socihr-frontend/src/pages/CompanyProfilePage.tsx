import { useState, useEffect, useMemo, Fragment } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import Layout from "../components/Layout";
import CompanyLogo from "../components/CompanyLogo";
import CompanyTrendChart, { RatePill } from "../components/CompanyTrendChart";
import { useDateFilter, getDateRange, DATE_FILTERS } from "../contexts/DateFilterContext";
import {
  getCompanySessionPerformance,
  type CompanySessionPerf,
} from "../services/api";

function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : "")).join(" ");
}

interface MonthPoint {
  key: string;
  label: string;
  likes: number;
  comments: number;
  shares: number;
  completed: number;
  total: number;
  rate: number;
}

function groupByMonth(sessions: CompanySessionPerf[]): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  for (const s of sessions) {
    const key = s.date.slice(0, 7); // yyyy-MM
    const [y, m] = key.split("-").map(Number);
    const label = new Date(y, m - 1, 1).toLocaleString("en", { month: "short", year: "numeric" });
    const cur = map.get(key) ?? { key, label, likes: 0, comments: 0, shares: 0, completed: 0, total: 0, rate: 0 };
    cur.likes += s.likes;
    cur.comments += s.comments;
    cur.shares += s.shares;
    cur.completed += s.completed;
    cur.total += s.total;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((p) => ({ ...p, rate: p.total > 0 ? Math.round((p.completed / p.total) * 1000) / 10 : 0 }));
}

function Segmented<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 2, background: "var(--surface)", padding: 2, borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            style={{
              padding: "5px 10px",
              borderRadius: "calc(var(--r-md) - 2px)",
              border: "none",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--text-2)",
              fontSize: "0.78rem",
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CompanyProfilePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filter, setFilter, customFrom, customTo } = useDateFilter();

  const [companyName, setCompanyName] = useState("");
  const [sessions, setSessions] = useState<CompanySessionPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"session" | "month">(() =>
    searchParams.get("view") === "month" ? "month" : "session"
  );
  const [sortKey, setSortKey] = useState<"date" | "rate">("date");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Deep-link masuk: ?filter= terpakai ke penapis global sekali sahaja
  useEffect(() => {
    const f = searchParams.get("filter");
    if (f && DATE_FILTERS.some((d) => d.value === f)) setFilter(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link keluar: kongsi view + filter dalam URL (boleh copy-paste penemuan)
  useEffect(() => {
    setSearchParams({ view, filter }, { replace: true });
  }, [view, filter, setSearchParams]);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const { from, to } = getDateRange(filter, customFrom, customTo);
    getCompanySessionPerformance(companyId, from, to, controller.signal)
      .then((d) => {
        setCompanyName(d.company.companyName);
        setSessions(d.sessions ?? []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load company performance.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [companyId, filter, customFrom, customTo]);

  useEffect(() => {
    document.title = companyName ? `${toTitleCase(companyName)} — SociHR` : "Company Profile — SociHR";
  }, [companyName]);

  const monthPoints = useMemo(() => groupByMonth(sessions), [sessions]);

  const totals = useMemo(() => {
    const t = sessions.reduce(
      (a, s) => ({
        likes: a.likes + s.likes,
        comments: a.comments + s.comments,
        shares: a.shares + s.shares,
        completed: a.completed + s.completed,
        total: a.total + s.total,
      }),
      { likes: 0, comments: 0, shares: 0, completed: 0, total: 0 }
    );
    return { ...t, rate: t.total > 0 ? Math.round((t.completed / t.total) * 1000) / 10 : 0 };
  }, [sessions]);

  const chartPoints = useMemo(
    () =>
      (view === "session" ? sessions : monthPoints).map((p) => ({
        label: p.label, likes: p.likes, comments: p.comments,
        shares: p.shares, completed: p.completed, rate: p.rate,
      })),
    [view, sessions, monthPoints]
  );

  const sortedSessions = useMemo(() => {
    const rows = [...sessions];
    rows.sort((a, b) =>
      sortKey === "rate" ? (a.rate - b.rate) * sortDir : (a.date < b.date ? -1 : 1) * sortDir
    );
    return rows;
  }, [sessions, sortKey, sortDir]);

  function toggleSort(key: "date" | "rate") {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }

  function sortIcon(key: "date" | "rate") {
    if (sortKey !== key)
      return <ChevronsUpDown size={12} aria-hidden="true" style={{ opacity: 0.35 }} />;
    return sortDir === 1
      ? <ArrowUp size={12} aria-hidden="true" />
      : <ArrowDown size={12} aria-hidden="true" />;
  }

  async function handleExportPdf() {
    const { downloadPageAsPDF } = await import("../utils/pdf");
    downloadPageAsPDF(`Company_${companyName || "Profile"}`);
  }

  const kpis = [
    { label: "Sessions", value: String(sessions.length) },
    { label: "Completed", value: String(totals.completed) },
    { label: "Total Actions", value: String(totals.total) },
    { label: "Compliance Rate", value: `${totals.rate}%`, accent: true },
  ];

  const cellNum: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", padding: "10px 8px" };
  const headBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    font: "inherit", fontWeight: 700, color: "inherit",
    display: "inline-flex", alignItems: "center", gap: 4, padding: 0,
  };

  return (
    <Layout>
      <div className="page">
        <button onClick={() => navigate("/company")} className="btn btn-ghost btn-sm" style={{ marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Companies
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {companyName ? (
              <CompanyLogo name={companyName} size={54} />
            ) : (
              <div
                aria-hidden="true"
                style={{ width: 54, height: 54, borderRadius: 12, background: "var(--surface, #f1f5f9)", border: "1px solid var(--line, #e2e8f0)", flexShrink: 0 }}
              />
            )}
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                {companyName ? toTitleCase(companyName) : "Company Profile"}
              </h1>
              <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
                Engagement performance &amp; per-session breakdown · In selected period
              </p>
            </div>
          </div>
          <button onClick={handleExportPdf} className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Export PDF
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          {kpis.map((k) => (
            <div key={k.label} className={`kpi${k.accent ? " kpi-indigo" : ""}`}>
              <p className="kpi-label">{k.label}</p>
              <p className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>
                {loading ? "…" : k.value}
              </p>
              <p className="kpi-sub">In selected period</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          <Segmented
            label="Date range"
            options={DATE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
            value={filter}
            onChange={setFilter}
          />
          <div style={{ marginLeft: "auto" }}>
            <Segmented
              label="Chart granularity"
              options={[{ value: "session" as const, label: "By Session" }, { value: "month" as const, label: "By Month" }]}
              value={view}
              onChange={setView}
            />
          </div>
        </div>

        <div className="chart-wrap" style={{ marginBottom: 16 }}>
          <p className="chart-label" style={{ marginBottom: 2 }}>
            Performance Trend — By {view === "session" ? "Session" : "Month"}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            Completed actions and compliance rate % · Rate ≥75% On track · 50–74% Needs push · &lt;50% At risk
          </p>
          <div aria-live="polite">
            {loading ? (
              <p style={{ padding: "24px 0", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>Loading…</p>
            ) : error ? (
              <p style={{ padding: "24px 0", textAlign: "center", color: "var(--red)", fontSize: 12 }}>{error}</p>
            ) : chartPoints.length > 0 ? (
              <CompanyTrendChart
                points={chartPoints}
                height={320}
                ariaLabel={`Performance trend chart, ${chartPoints.length} points, overall rate ${totals.rate} percent`}
              />
            ) : (
              <p style={{ padding: "24px 0", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                No performance data for the selected period.
              </p>
            )}
          </div>
        </div>

        <div className="chart-wrap">
          <p className="chart-label" style={{ marginBottom: 2 }}>Session Breakdown</p>
          <p style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}>
            Tap a row for likes / comments / shares detail
          </p>
          {sessions.length === 0 && !loading ? (
            <p style={{ color: "var(--text-3)", fontSize: 12 }}>No sessions for this company in the selected period.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                <caption style={{ textAlign: "left", fontSize: 11.5, color: "var(--text-3)", paddingBottom: 6 }}>
                  Per-session compliance, sorted by {sortKey === "rate" ? "rate" : "date"}
                </caption>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <th scope="col" aria-sort={sortKey === "date" ? (sortDir === 1 ? "ascending" : "descending") : "none"} style={{ textAlign: "left", padding: "8px" }}>
                      <button onClick={() => toggleSort("date")} aria-label="Sort by session date" style={headBtn}>
                        Session {sortIcon("date")}
                      </button>
                    </th>
                    <th scope="col" aria-sort={sortKey === "rate" ? (sortDir === 1 ? "ascending" : "descending") : "none"} style={{ textAlign: "right", padding: "8px" }}>
                      <button onClick={() => toggleSort("rate")} aria-label={`Sort by rate ${sortKey === "rate" && sortDir === -1 ? "ascending" : "descending"}`} style={{ ...headBtn, marginLeft: "auto" }}>
                        Rate {sortIcon("rate")}
                      </button>
                    </th>
                    <th scope="col" style={{ textAlign: "right", padding: "8px" }}>Completed</th>
                    <th scope="col" style={{ textAlign: "right", padding: "8px" }}>Total</th>
                    <th scope="col" style={{ width: 36 }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map((s) => {
                    const expanded = expandedId === s.sessionId;
                    return (
                      <Fragment key={s.sessionId}>
                        <tr
                          onClick={() => setExpandedId(expanded ? null : s.sessionId)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(expanded ? null : s.sessionId); } }}
                          tabIndex={0}
                          aria-expanded={expanded}
                          title="Tap for engagement detail"
                          style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
                        >
                          <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                            {s.label} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({s.date})</span>
                          </td>
                          <td style={{ textAlign: "right", padding: "10px 8px" }}><RatePill rate={s.rate} /></td>
                          <td style={cellNum}>{s.completed}</td>
                          <td style={cellNum}>{s.total}</td>
                          <td style={{ textAlign: "center", color: "var(--text-3)" }} aria-hidden="true">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${s.sessionId}-detail`}>
                            <td colSpan={5} style={{ padding: "8px 8px 12px 8px", background: "var(--surface)" }}>
                              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text-2)" }}>
                                <span>Likes <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.likes}</strong></span>
                                <span>Comments <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.comments}</strong></span>
                                <span>Shares <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.shares}</strong></span>
                                <span>Missed <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.missed}</strong></span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--line-strong, var(--line))" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 700 }}>Period total</td>
                    <td style={{ textAlign: "right", padding: "10px 8px" }}><RatePill rate={totals.rate} /></td>
                    <td style={{ ...cellNum, fontWeight: 700 }}>{totals.completed}</td>
                    <td style={{ ...cellNum, fontWeight: 700 }}>{totals.total}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
