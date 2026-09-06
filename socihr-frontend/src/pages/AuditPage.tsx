import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { getAuditTrail, type AuditItem } from "../services/api";


function parseDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      if (word.startsWith("(")) {
        return "(" + word.charAt(1).toUpperCase() + word.slice(2);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Completed") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px",
          borderRadius: 6,
          fontSize: "0.74rem",
          fontWeight: 600,
          background: "rgba(16,185,129,0.08)",
          color: "#16a34a",
          border: "1px solid rgba(16,185,129,0.2)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
        Completed
      </span>
    );
  }
  if (status === "Missed") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px",
          borderRadius: 6,
          fontSize: "0.74rem",
          fontWeight: 600,
          background: "rgba(239,68,68,0.08)",
          color: "#dc2626",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626" }} />
        Missed
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: "0.74rem",
        fontWeight: 600,
        background: "var(--surface-2)",
        color: "var(--text-3)",
        border: "1px solid var(--line)",
      }}
    >
      Pending
    </span>
  );
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 50;

  useEffect(() => {
    setLoading(true);
    getAuditTrail(page, PAGE_SIZE)
      .then((res) => { setItems(res.items); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const filteredItems = items.filter((item) => {
    const matchesSearch = !search.trim() ||
      item.staffName.toLowerCase().includes(search.toLowerCase()) ||
      item.platformName.toLowerCase().includes(search.toLowerCase()) ||
      (item.department && item.department.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || item.newStatus.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Audit Trail
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              Transaction log of staff engagement status updates and verification records
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--text-2)",
                padding: "6px 12px",
                borderRadius: 6,
                background: "var(--white)",
                border: "1px solid var(--line)",
              }}
            >
              {total} Total Records
            </span>
            <button
              onClick={async () => {
                const { downloadPageAsPDF } = await import("../utils/pdf");
                downloadPageAsPDF("Audit_Trail");
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
            background: "var(--white)",
            padding: "12px 16px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--line)",
          }}
        >
          <input
            className="input"
            type="text"
            placeholder="Search by staff, department, or platform..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 260, height: 36, fontSize: "0.85rem" }}
          />

          <div style={{ display: "flex", gap: 3, background: "var(--surface)", padding: 2, borderRadius: 6, border: "1px solid var(--line)" }}>
            {["all", "Completed", "Missed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: "none",
                  background: statusFilter === st ? "var(--accent)" : "transparent",
                  color: statusFilter === st ? "#fff" : "var(--text-2)",
                  fontSize: "0.78rem",
                  fontWeight: statusFilter === st ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {st === "all" ? "All Changes" : st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-3)" }}>
            <div className="spin" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontWeight: 500 }}>Loading audit records...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--white)", borderRadius: 12, border: "1px solid var(--line)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--text-4)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>No Audit Records Found</h3>
            <p style={{ color: "var(--text-3)", fontSize: "0.82rem" }}>
              Changes to engagement statuses will appear here automatically.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "var(--white)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              overflow: "hidden",
            }}
          >
            <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Timestamp</th>
                  <th>Staff Member</th>
                  <th>Department</th>
                  <th>Platform</th>
                  <th>Session Date</th>
                  <th style={{ textAlign: "center" }}>Previous</th>
                  <th style={{ width: 30, textAlign: "center" }}></th>
                  <th style={{ textAlign: "center" }}>Updated Status</th>
                  <th>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.auditID}>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                      <div>{new Date(item.updatedAt).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <div style={{ color: "var(--text-4)", fontSize: "0.74rem", marginTop: 1 }}>
                        {new Date(item.updatedAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.86rem" }}>{toTitleCase(item.staffName)}</td>
                    <td>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>
                        {item.department ? toTitleCase(item.department) : "—"}
                      </span>
                    </td>
                    <td><strong style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>{item.platformName}</strong></td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                      {item.sessionDate
                        ? parseDateOnly(item.sessionDate).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td style={{ textAlign: "center" }}><StatusBadge status={item.previousStatus} /></td>
                    <td style={{ textAlign: "center", color: "var(--text-4)", fontSize: "0.8rem" }}>→</td>
                    <td style={{ textAlign: "center" }}><StatusBadge status={item.newStatus} /></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "var(--surface)", border: "1px solid var(--line)",
                          display: "flex", alignItems: "center",
                          fontSize: "0.7rem", fontWeight: 700, color: "var(--text-2)",
                          justifyContent: "center"
                        }}>
                          {item.updatedBy.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-2)" }}>{item.updatedBy}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 20 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            >
              Previous
            </button>
            <span style={{ fontSize: "0.82rem", color: "var(--text-3)", fontWeight: 500 }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary btn-sm"
              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
