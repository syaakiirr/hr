import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { getAuditTrail, type AuditItem } from "../services/api";

function parseDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Completed") return <span className="badge badge-green">✓ Completed</span>;
  if (status === "Missed") return <span className="badge badge-red">✗ Missed</span>;
  return <span className="badge badge-neutral">— Pending</span>;
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

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const filteredItems = search.trim()
    ? items.filter(
        (item) =>
          item.staffName.toLowerCase().includes(search.toLowerCase()) ||
          item.platformName.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <Layout>
      <>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="page-hd">
            <div>
              <h1 className="page-title">Audit Trail</h1>
              <p className="page-sub font-size-13">Detailed transaction log of staff engagement status changes</p>
            </div>
            <motion.span
              className="badge badge-accent"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              {total} Records
            </motion.span>
          </div>
          {/* Search bar */}
          <div style={{ marginBottom: 16 }}>
            <input
              className="input"
              type="text"
              placeholder="Search by staff name or platform..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </div>
        </motion.div>

        {loading ? (
          <div className="loader"><div className="spin" />Loading audit trail...</div>
        ) : filteredItems.length === 0 ? (
        <div className="empty" style={{ background: "var(--white)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)" }}>
          <div className="empty-ico">📋</div>
          <p className="empty-title">No Audit Records</p>
          <p className="empty-desc">All changes to engagement statuses will be transparently logged here.</p>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="tbl-wrap"
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Date & Time</th>
                  <th>Staff Name</th>
                  <th>Department</th>
                  <th>Platform</th>
                  <th>Session</th>
                  <th style={{ textAlign: "center" }}>Previous Status</th>
                  <th style={{ width: 40 }}></th>
                  <th style={{ textAlign: "center" }}>New Status</th>
                  <th>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.auditID}>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>
                      <div>{new Date(item.updatedAt).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}</div>
                      <div style={{ color: "var(--text-4)", marginTop: 1 }}>
                        {new Date(item.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-1)" }}>{item.staffName}</td>
                    <td><span className="badge badge-neutral">{item.department || "—"}</span></td>
                    <td><strong style={{ fontSize: 13, color: "var(--text-2)" }}>{item.platformName}</strong></td>
                    <td style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                      {item.sessionDate
                        ? parseDateOnly(item.sessionDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td style={{ textAlign: "center" }}><StatusBadge status={item.previousStatus} /></td>
                    <td style={{ textAlign: "center", color: "var(--text-4)" }}>→</td>
                    <td style={{ textAlign: "center" }}><StatusBadge status={item.newStatus} /></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: "var(--accent-soft)", border: "1px solid var(--accent-border)",
                          display: "flex", alignItems: "center",
                          fontSize: 10, fontWeight: 700, color: "var(--accent-text)",
                          justifyContent: "center"
                        }}>
                          {item.updatedBy.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-2)" }}>{item.updatedBy}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      </>
    </Layout>
  );
}
