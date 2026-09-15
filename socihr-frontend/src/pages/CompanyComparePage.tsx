import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Layout from "../components/Layout";
import CompanyLogo from "../components/CompanyLogo";
import CompanyTrendChart, { RatePill } from "../components/CompanyTrendChart";
import { useDateFilter, getDateRange } from "../contexts/DateFilterContext";
import {
  getCompanies,
  getCompanySessionPerformance,
  type Company,
  type CompanySessionPerf,
} from "../services/api";

function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : "")).join(" ");
}

interface SideData {
  company: Company | null;
  sessions: CompanySessionPerf[];
}

function totalsOf(sessions: CompanySessionPerf[]) {
  const t = sessions.reduce(
    (a, s) => ({ completed: a.completed + s.completed, total: a.total + s.total }),
    { completed: 0, total: 0 }
  );
  return { ...t, rate: t.total > 0 ? Math.round((t.completed / t.total) * 1000) / 10 : 0 };
}

const selectStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--line)",
  background: "var(--white)",
  color: "var(--text-1)",
  fontSize: "0.85rem",
  fontWeight: 600,
  maxWidth: "100%",
};

export default function CompanyComparePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filter, customFrom, customTo } = useDateFilter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [aId, setAId] = useState(searchParams.get("a") ?? "");
  const [bId, setBId] = useState(searchParams.get("b") ?? "");
  const [a, setA] = useState<SideData>({ company: null, sessions: [] });
  const [b, setB] = useState<SideData>({ company: null, sessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCompanies().then((list) => {
      setCompanies(list);
      if (!aId && list[0]) setAId(list[0].companyID);
      if (!bId && list[1]) setBId(list[1].companyID);
      else if (!bId && list[0]) setBId(list[0].companyID);
    }).catch((err) => setError(err instanceof Error ? err.message : "Failed to load companies."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearchParams({ ...(aId ? { a: aId } : {}), ...(bId ? { b: bId } : {}) }, { replace: true });
  }, [aId, bId, setSearchParams]);

  useEffect(() => {
    if (!aId || !bId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const { from, to } = getDateRange(filter, customFrom, customTo);
    const need = [aId, bId].filter((id) => id);
    Promise.all(need.map((id) => getCompanySessionPerformance(id, from, to, controller.signal)))
      .then(([ra, rb]) => {
        setA({ company: companies.find((c) => c.companyID === aId) ?? { companyID: aId, companyName: ra.company.companyName }, sessions: ra.sessions ?? [] });
        const rbRes = rb ?? ra;
        setB({ company: companies.find((c) => c.companyID === bId) ?? { companyID: bId, companyName: rbRes.company.companyName }, sessions: rbRes.sessions ?? [] });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load comparison.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [aId, bId, filter, customFrom, customTo, companies]);

  const ta = useMemo(() => totalsOf(a.sessions), [a.sessions]);
  const tb = useMemo(() => totalsOf(b.sessions), [b.sessions]);
  const rateDiff = Math.round((ta.rate - tb.rate) * 10) / 10;
  const leader = rateDiff >= 0 ? a : b;

  const sides: { key: string; id: string; setId: (v: string) => void; data: SideData; totals: { completed: number; total: number; rate: number } }[] = [
    { key: "A", id: aId, setId: setAId, data: a, totals: ta },
    { key: "B", id: bId, setId: setBId, data: b, totals: tb },
  ];

  return (
    <Layout>
      <div className="page">
        <button onClick={() => navigate("/company")} className="btn btn-ghost btn-sm" style={{ marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Companies
        </button>

        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
          Compare Companies
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3, marginBottom: 16 }}>
          Side-by-side performance · In selected period (global date filter)
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {sides.map((s) => (
            <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600, color: "var(--text-2)" }}>
              {s.key}
              <select aria-label={`Company ${s.key}`} value={s.id} onChange={(e) => s.setId(e.target.value)} style={selectStyle}>
                {companies.map((c) => (
                  <option key={c.companyID} value={c.companyID}>{toTitleCase(c.companyName)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {error ? (
          <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
              {sides.map((s) => (
                <div key={s.key} className="kpi">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                    {s.data.company && <CompanyLogo name={s.data.company.companyName} size={38} />}
                    <p className="kpi-label" style={{ margin: 0 }}>{s.data.company ? toTitleCase(s.data.company.companyName) : `Company ${s.key}`}</p>
                  </div>
                  <p className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {loading ? "…" : `${s.totals.rate}%`}
                  </p>
                  <p className="kpi-sub">
                    {loading ? "Loading…" : `${s.data.sessions.length} sessions · ${s.totals.completed}/${s.totals.total} completed`}
                  </p>
                  {!loading && <RatePill rate={s.totals.rate} />}
                </div>
              ))}
              <div className="kpi kpi-indigo">
                <p className="kpi-label">Rate Gap</p>
                <p className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {loading ? "…" : `${rateDiff > 0 ? "+" : ""}${rateDiff}%`}
                </p>
                <p className="kpi-sub">
                  {!loading && leader.company
                    ? `${toTitleCase(leader.company.companyName)} leads`
                    : "Select two companies"}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              {sides.map((s) => (
                <div key={s.key} className="chart-wrap">
                  <p className="chart-label" style={{ marginBottom: 8 }}>
                    {s.data.company ? toTitleCase(s.data.company.companyName) : `Company ${s.key}`}
                  </p>
                  {loading ? (
                    <p style={{ padding: "24px 0", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>Loading…</p>
                  ) : s.data.sessions.length > 0 ? (
                    <CompanyTrendChart
                      points={s.data.sessions.map((p) => ({
                        label: p.label, likes: p.likes, comments: p.comments,
                        shares: p.shares, completed: p.completed, rate: p.rate,
                      }))}
                      height={260}
                      ariaLabel={`${s.data.company?.companyName ?? s.key} trend, rate ${s.totals.rate} percent`}
                    />
                  ) : (
                    <p style={{ padding: "24px 0", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                      No data for the selected period.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
