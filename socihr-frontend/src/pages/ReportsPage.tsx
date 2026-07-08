import { useState } from "react";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import { buildReportUrl } from "../services/api";

type ReportType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: "daily",   label: "Daily",            desc: "Daily engagement data" },
  { value: "weekly",  label: "Weekly (7 Days)",  desc: "Performance for the past week" },
  { value: "monthly", label: "Monthly",          desc: "Monthly performance report" },
  { value: "yearly",  label: "Yearly",           desc: "Annual summary" },
  { value: "custom",  label: "Custom Range",     desc: "Select custom date range" },
];

function getRange(type: ReportType, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = fmt(now);

  switch (type) {
    case "daily": return { from: today, to: today };
    case "weekly": {
      const start = new Date(now); start.setDate(now.getDate() - 6);
      return { from: fmt(start), to: today };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(start), to: today };
    }
    case "yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: fmt(start), to: today };
    }
    case "custom": return { from: customFrom, to: customTo };
  }
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [customFrom, setCustomFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  async function handleDownload(format: "pdf" | "excel") {
    const { from, to } = getRange(reportType, customFrom, customTo);

    // Validate custom date range
    if (reportType === "custom" && from > to) {
      alert("Start Date cannot be later than End Date. Please fix your date range.");
      return;
    }
    if (reportType === "custom" && (!customFrom || !customTo)) {
      alert("Please select both Start Date and End Date.");
      return;
    }

    setDownloading(format);
    try {
      const token = localStorage.getItem("token") ?? "";
      const url = buildReportUrl(format, from, to);

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to generate report.");

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `SociHR_Report_${from}_to_${to}.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setDownloading(null);
    }
  }

  const { from, to } = getRange(reportType, customFrom, customTo);

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: -8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.2 }}
      >
        <div className="page-hd">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-sub">Export staff engagement analysis reports in PDF and Excel formats</p>
          </div>
        </div>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start", maxWidth: 900 }}>
        {/* Type panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="section-label" style={{ paddingLeft: 0 }}>Report Period</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {REPORT_TYPES.map((rt) => (
              <div
                key={rt.value}
                id={`report-type-${rt.value}`}
                onClick={() => setReportType(rt.value)}
                style={{
                  padding: "12px 14px", borderRadius: 8,
                  background: reportType === rt.value 
                    ? "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(214, 41, 118, 0.08) 100%)" 
                    : "rgba(255, 255, 255, 0.15)",
                  border: `1px solid ${reportType === rt.value ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.3)"}`,
                  cursor: "pointer", transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: reportType === rt.value 
                    ? "0 4px 12px rgba(99, 102, 241, 0.04)" 
                    : "none",
                  transform: reportType === rt.value ? "translateX(4px)" : "none",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{rt.label}</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{rt.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Generate options */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: 0.1 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="section-label" style={{ paddingLeft: 0 }}>Report Configuration</p>

          <div className="card">
            {reportType === "custom" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="input-label">Start Date</label>
                  <input className="input" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">End Date</label>
                  <input className="input" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <div>
                  <span style={{ color: "var(--text-3)", marginRight: 8 }}>Start:</span>
                  <strong style={{ color: "var(--text-1)" }}>{from}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-3)", marginRight: 8 }}>End:</span>
                  <strong style={{ color: "var(--text-1)" }}>{to}</strong>
                </div>
              </div>
            )}
          </div>

          <p className="section-label" style={{ paddingLeft: 0, marginTop: 8 }}>Export Document</p>

          {/* Formats Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* PDF export */}
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }}>Report Document (PDF)</p>
                <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Landscape A4 Format • QuestPDF Engine</p>
              </div>
              <button
                id="download-pdf-btn"
                onClick={() => handleDownload("pdf")}
                disabled={downloading !== null}
                className="btn btn-secondary"
                style={{ border: "1px solid var(--red-line)", color: "var(--red)" }}
              >
                {downloading === "pdf" ? (
                  <><span className="spin" style={{ width: 12, height: 12 }} /> Generating...</>
                ) : (
                  <>Download PDF</>
                )}
              </button>
            </div>

            {/* Excel export */}
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }}>Spreadsheet Document (Excel)</p>
                <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Format .xlsx • ClosedXML Engine</p>
              </div>
              <button
                id="download-excel-btn"
                onClick={() => handleDownload("excel")}
                disabled={downloading !== null}
                className="btn btn-secondary"
                style={{ border: "1px solid var(--green-line)", color: "var(--green)" }}
              >
                {downloading === "excel" ? (
                  <><span className="spin" style={{ width: 12, height: 12 }} /> Generating...</>
                ) : (
                  <>Download Excel</>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
