import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import { buildReportUrl, downloadCustomReportPdf, downloadCustomReportExcel, getSessions, getDepartments } from "../services/api";
import type { MonitoringSession, Department } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type ReportType = "latest" | "session" | "all" | "monthly" | "yearly" | "custom";

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: "latest",  label: "Latest Session",   desc: "Most recent recorded session" },
  { value: "session", label: "Specific Session", desc: "Select specific monitoring date" },
  { value: "all",     label: "All Sessions",     desc: "Full historical archive" },
  { value: "monthly", label: "This Month",       desc: "Current month overview" },
  { value: "yearly",  label: "This Year",        desc: "Annual overview" },
  { value: "custom",  label: "Custom Range",     desc: "Select custom date range" },
];

function formatDotDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parseInt(parts[2], 10)}.${parseInt(parts[1], 10)}.${parts[0]}`;
  }
  return dateStr;
}

function getRange(
  type: ReportType, 
  customFrom: string, 
  customTo: string, 
  latestDate: string, 
  selectedSessionDate: string
): { from?: string; to?: string; displayLabel: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;

  switch (type) {
    case "latest": {
      const target = latestDate || today;
      return { 
        from: target, 
        to: target,
        displayLabel: `${formatDotDate(target)} - 1 Session`
      };
    }
    case "session": {
      const target = selectedSessionDate || latestDate || today;
      return {
        from: target,
        to: target,
        displayLabel: `${formatDotDate(target)} - 1 Session`
      };
    }
    case "all": 
      return { 
        from: undefined, 
        to: undefined,
        displayLabel: "All Recorded Monitoring Sessions (Full Archive)"
      };
    case "monthly": {
      const start = `${y}-${m}-01`;
      return { from: start, to: today, displayLabel: `${start} to ${today}` };
    }
    case "yearly": {
      const start = `${y}-01-01`;
      return { from: start, to: today, displayLabel: `${start} to ${today}` };
    }
    case "custom": 
      return { from: customFrom, to: customTo, displayLabel: `${customFrom} to ${customTo}` };
  }
}

// ─── Unit Picker Modal ─────────────────────────────────────────────────────────
interface UnitPickerProps {
  departments: Department[];
  selectedUnits: string[]; // "__all__" or list of dept names
  onSelectAll: () => void;
  onToggleDept: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  actionLabel: string;
  actionColor: string;
  loading: boolean;
}

function UnitPickerModal({
  departments,
  selectedUnits,
  onSelectAll,
  onToggleDept,
  onConfirm,
  onCancel,
  actionLabel,
  actionColor,
  loading,
}: UnitPickerProps) {
  const isAll = selectedUnits.includes("__all__");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
      onClick={() => !loading && onCancel()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "var(--bg-1, #ffffff)",
          borderRadius: 14,
          padding: "28px 28px 24px",
          minWidth: 380,
          maxWidth: 460,
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)",
          border: "1px solid var(--border, rgba(255,255,255,0.1))",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(214,41,118,0.12))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>🏢</div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>
              Select Units for Report
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
            Choose which department(s) to include in this report. Select <strong>All Units</strong> for a consolidated enterprise view.
          </p>
        </div>

        {/* All Units toggle */}
        <div
          onClick={() => !loading && onSelectAll()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: `1.5px solid ${isAll ? "rgba(99,102,241,0.4)" : "var(--border, rgba(0,0,0,0.08))"}`,
            background: isAll
              ? "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(214,41,118,0.07))"
              : "var(--bg-2, rgba(0,0,0,0.03))",
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 10,
            display: "flex", alignItems: "center", gap: 10,
            transition: "all 0.2s ease",
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 5,
            border: `2px solid ${isAll ? "#6366f1" : "var(--text-3)"}`,
            background: isAll ? "#6366f1" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.15s ease",
          }}>
            {isAll && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>All Units</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
              {departments.length} department{departments.length !== 1 ? "s" : ""} — consolidated enterprise report
            </p>
          </div>
          {isAll && (
            <div style={{
              marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 8px",
              borderRadius: 20, background: "#6366f1", color: "#fff", flexShrink: 0,
            }}>SELECTED</div>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border, rgba(0,0,0,0.08))" }} />
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>OR PICK SPECIFIC</span>
          <div style={{ flex: 1, height: 1, background: "var(--border, rgba(0,0,0,0.08))" }} />
        </div>

        {/* Individual dept list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
          {departments.map(dept => {
            const isSelected = !isAll && selectedUnits.includes(dept.departmentName);
            return (
              <div
                key={dept.departmentID}
                onClick={() => !loading && onToggleDept(dept.departmentName)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: `1px solid ${isSelected ? "rgba(99,102,241,0.3)" : "var(--border, rgba(0,0,0,0.06))"}`,
                  background: isSelected ? "rgba(99,102,241,0.07)" : "var(--bg-2, rgba(0,0,0,0.02))",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  transition: "all 0.15s ease",
                  opacity: isAll ? 0.4 : 1,
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: `1.5px solid ${isSelected && !isAll ? "#6366f1" : "var(--text-3)"}`,
                  background: isSelected && !isAll ? "#6366f1" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s ease",
                }}>
                  {isSelected && !isAll && (
                    <span style={{ color: "#fff", fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>
                  )}
                </div>
                <span style={{
                  fontSize: 12.5, fontWeight: isSelected && !isAll ? 600 : 400,
                  color: isSelected && !isAll ? "var(--text-1)" : "var(--text-2)",
                  flex: 1,
                }}>
                  {dept.departmentName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Selection summary */}
        {!isAll && selectedUnits.length > 0 && (
          <div style={{
            padding: "8px 12px", borderRadius: 8, marginBottom: 16,
            background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
            fontSize: 11.5, color: "var(--text-2)",
          }}>
            <span style={{ fontWeight: 700, color: "#6366f1" }}>{selectedUnits.length}</span> unit{selectedUnits.length !== 1 ? "s" : ""} selected: {selectedUnits.join(", ")}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            disabled={loading}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-secondary"
            disabled={loading || (!isAll && selectedUnits.length === 0)}
            onClick={onConfirm}
            style={{
              flex: 2,
              border: `1px solid ${actionColor}33`,
              color: actionColor,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontWeight: 700,
            }}
          >
            {loading ? (
              <><span className="spin" style={{ width: 12, height: 12 }} /> Generating...</>
            ) : (
              <>{actionLabel}</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { isSuperAdmin } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("latest");
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [latestSessionDate, setLatestSessionDate] = useState<string>("");
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);

  const [customFrom, setCustomFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customShowCards, setCustomShowCards] = useState(true);
  const [customShowRanking, setCustomShowRanking] = useState(true);
  const [customShowPlatformCompany, setCustomShowPlatformCompany] = useState(true);
  const [customShowDaily, setCustomShowDaily] = useState(true);
  const [customShowStaffTable, setCustomShowStaffTable] = useState(true);
  const [customShowMonitoringSessions, setCustomShowMonitoringSessions] = useState(true);
  const [generatingCustom, setGeneratingCustom] = useState(false);

  // Unit picker state
  const [unitPickerState, setUnitPickerState] = useState<{
    show: boolean;
    action: "pdf" | "excel" | "custom-pdf" | "custom-excel" | null;
    selectedUnits: string[]; // "__all__" or dept names
    loading: boolean;
  }>({ show: false, action: null, selectedUnits: ["__all__"], loading: false });

  useEffect(() => {
    getSessions()
      .then((data) => {
        if (data && data.length > 0) {
          const sorted = [...data].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
          setSessions(sorted);
          setLatestSessionDate(sorted[0].sessionDate);
          setSelectedSessionDate(sorted[0].sessionDate);
        }
      })
      .catch((err) => console.error("Failed to load sessions:", err));

    getDepartments()
      .then(setDepartments)
      .catch((err) => console.error("Failed to load departments:", err));
  }, []);

  const { from, to, displayLabel } = getRange(reportType, customFrom, customTo, latestSessionDate, selectedSessionDate);

  // Validate dates before download
  function validateDates(): boolean {
    if (reportType === "custom" && from && to && from > to) {
      alert("Start Date cannot be later than End Date. Please fix your date range.");
      return false;
    }
    if (reportType === "custom" && (!customFrom || !customTo)) {
      alert("Please select both Start Date and End Date.");
      return false;
    }
    return true;
  }

  // Open the unit picker (SuperAdmin only) or download directly (DeptAdmin)
  function triggerDownload(action: "pdf" | "excel") {
    if (!validateDates()) return;
    if (isSuperAdmin() && departments.length > 0) {
      setUnitPickerState({ show: true, action, selectedUnits: ["__all__"], loading: false });
    } else {
      executeDownload(action, []);
    }
  }

  // Resolve actual dept list from picker state
  function resolveDeptsFromPicker(selectedUnits: string[]): string[] {
    if (selectedUnits.includes("__all__")) return [];
    return selectedUnits;
  }

  async function executeDownload(action: "pdf" | "excel", selectedUnits: string[]) {
    const depts = resolveDeptsFromPicker(selectedUnits);
    setDownloading(action);
    try {
      const token = localStorage.getItem("token") ?? "";
      const url = buildReportUrl(action, from, to, depts.length > 0 ? depts : undefined);

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to generate report.");

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const deptSuffix = depts.length > 0 ? `_${depts.join("_")}` : "";
      const filenameSuffix = from && to ? `${from}_to_${to}` : "All_Sessions";
      a.download = `SociHR_Report_${filenameSuffix}${deptSuffix}.${action === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setDownloading(null);
      setUnitPickerState(s => ({ ...s, show: false, loading: false }));
    }
  }

  async function executeCustomDownload(
    format: "custom-pdf" | "custom-excel",
    selectedUnits: string[]
  ) {
    const depts = resolveDeptsFromPicker(selectedUnits);
    const options = {
      showCards: customShowCards,
      showRanking: customShowRanking,
      showPlatformCompany: customShowPlatformCompany,
      showDaily: customShowDaily,
      showMonitoringSessions: customShowMonitoringSessions,
      showStaffTable: customShowStaffTable,
    };

    setGeneratingCustom(true);
    setUnitPickerState(s => ({ ...s, loading: true }));
    try {
      if (format === "custom-pdf") {
        await downloadCustomReportPdf(from || "", to || "", options, depts.length > 0 ? depts : undefined);
      } else {
        await downloadCustomReportExcel(from || "", to || "", options, depts.length > 0 ? depts : undefined);
      }
      setShowCustomModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate custom report.");
    } finally {
      setGeneratingCustom(false);
      setUnitPickerState(s => ({ ...s, show: false, loading: false }));
    }
  }

  // Unit picker handlers
  function handlePickerSelectAll() {
    setUnitPickerState(s => ({ ...s, selectedUnits: ["__all__"] }));
  }

  function handlePickerToggleDept(name: string) {
    setUnitPickerState(s => {
      const withoutAll = s.selectedUnits.filter(u => u !== "__all__");
      const exists = withoutAll.includes(name);
      const next = exists ? withoutAll.filter(u => u !== name) : [...withoutAll, name];
      return { ...s, selectedUnits: next.length > 0 ? next : ["__all__"] };
    });
  }

  async function handlePickerConfirm() {
    const { action, selectedUnits } = unitPickerState;
    if (!action) return;

    if (action === "custom-pdf" || action === "custom-excel") {
      setShowCustomModal(false);
      await executeCustomDownload(action, selectedUnits);
    } else {
      await executeDownload(action as "pdf" | "excel", selectedUnits);
    }
  }

  // Custom modal "PDF" or "Excel" button
  function handleCustomModalFormat(format: "custom-pdf" | "custom-excel") {
    if (!validateDates()) return;
    if (isSuperAdmin() && departments.length > 0) {
      setUnitPickerState({ show: true, action: format, selectedUnits: ["__all__"], loading: false });
    } else {
      executeCustomDownload(format, []);
    }
  }

  // Determine picker UI colors based on action
  const pickerActionLabel = unitPickerState.action === "excel" || unitPickerState.action === "custom-excel"
    ? "Download Excel"
    : "Download PDF";
  const pickerActionColor = unitPickerState.action === "excel" || unitPickerState.action === "custom-excel"
    ? "var(--green, #16a34a)"
    : "var(--red, #dc2626)";

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
            ) : reportType === "session" ? (
              <div>
                <label className="input-label">Select Monitoring Session</label>
                <select 
                  className="input" 
                  value={selectedSessionDate} 
                  onChange={e => setSelectedSessionDate(e.target.value)}
                  style={{ width: "100%", marginTop: 4, fontWeight: 500 }}
                >
                  {sessions.map((s) => {
                    const parts = s.sessionDate.split("-");
                    const formatted = parts.length === 3 
                      ? `${parseInt(parts[2], 10)}.${parseInt(parts[1], 10)}.${parts[0]} - 1 Session` 
                      : `${s.sessionDate} - 1 Session`;
                    return (
                      <option key={s.sessionID} value={s.sessionDate}>
                        {formatted}
                      </option>
                    );
                  })}
                </select>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
                  Targeting session date: <strong style={{ color: "var(--text-1)" }}>{selectedSessionDate}</strong>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-3)" }}>Coverage:</span>
                  <span style={{ color: "var(--text-1)", fontWeight: 700 }}>{displayLabel}</span>
                </div>
                {reportType === "latest" && latestSessionDate && (
                  <p style={{ fontSize: 11.5, color: "var(--green, #16a34a)", marginTop: 2 }}>
                    ✓ Auto-targeting the latest monitoring session ({(() => {
                      const parts = latestSessionDate.split("-");
                      return parts.length === 3 ? `${parseInt(parts[2], 10)}.${parseInt(parts[1], 10)}.${parts[0]} - 1 Session` : latestSessionDate;
                    })()})
                  </p>
                )}
                {reportType === "all" && (
                  <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>
                    Includes all {sessions.length} recorded monitoring sessions across the entire archive.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SuperAdmin unit scope hint */}
          {isSuperAdmin() && departments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: "10px 14px", borderRadius: 8,
                background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(214,41,118,0.04))",
                border: "1px solid rgba(99,102,241,0.15)",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>🏢</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
                  Admin: Unit Selection Available
                </p>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>
                  When you click download, you'll be able to select specific unit(s) or all {departments.length} units.
                </p>
              </div>
            </motion.div>
          )}

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
                onClick={() => triggerDownload("pdf")}
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

            {/* Customizable Report */}
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }}>Custom Report</p>
                <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Choose which sections to include</p>
              </div>
              <button
                onClick={() => setShowCustomModal(true)}
                disabled={downloading !== null}
                className="btn btn-secondary"
                style={{ border: "1px solid var(--purple-line, #7c3aed)", color: "#7c3aed" }}
              >
                Customize
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
                onClick={() => triggerDownload("excel")}
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

      {/* Custom Report Modal */}
      {showCustomModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }} onClick={() => !generatingCustom && setShowCustomModal(false)}>
          <div style={{
            background: "#fff", borderRadius: 10, padding: 24, minWidth: 400, maxWidth: 480,
            maxHeight: "90vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Customize Report</h3>

            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
              Period: <strong>{from}</strong> to <strong>{to}</strong>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {[
                { label: "Summary Cards (totals & rate)", key: "cards" },
                { label: "Staff Ranking (Top 10 / Bottom 10)", key: "ranking" },
                { label: "Platform & Company Stats", key: "platformCompany" },
                { label: "Daily Engagement Breakdown", key: "daily" },
                { label: "Monitoring Sessions", key: "monitoringSessions" },
                { label: "All Staff Performance Table", key: "staffTable" },
              ].map(({ label, key }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: "var(--bg-2)" }}>
                  <input type="checkbox" checked={
                    key === "cards" ? customShowCards :
                    key === "ranking" ? customShowRanking :
                    key === "platformCompany" ? customShowPlatformCompany :
                    key === "daily" ? customShowDaily :
                    key === "monitoringSessions" ? customShowMonitoringSessions :
                    customShowStaffTable
                  } onChange={() => {
                    const setter =
                      key === "cards" ? setCustomShowCards :
                      key === "ranking" ? setCustomShowRanking :
                      key === "platformCompany" ? setCustomShowPlatformCompany :
                      key === "daily" ? setCustomShowDaily :
                      key === "monitoringSessions" ? setCustomShowMonitoringSessions :
                      setCustomShowStaffTable;
                    setter((prev: boolean) => !prev);
                  }} />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={generatingCustom} onClick={() => setShowCustomModal(false)}>Cancel</button>
              <button className="btn btn-secondary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--red-line)", color: "var(--red)" }}
                disabled={generatingCustom}
                onClick={() => handleCustomModalFormat("custom-pdf")}
              >
                {generatingCustom ? "..." : "PDF"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid var(--green-line)", color: "var(--green)" }}
                disabled={generatingCustom}
                onClick={() => handleCustomModalFormat("custom-excel")}
              >
                {generatingCustom ? "..." : "Excel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Picker Modal (SuperAdmin only) */}
      <AnimatePresence>
        {unitPickerState.show && (
          <UnitPickerModal
            departments={departments}
            selectedUnits={unitPickerState.selectedUnits}
            onSelectAll={handlePickerSelectAll}
            onToggleDept={handlePickerToggleDept}
            onConfirm={handlePickerConfirm}
            onCancel={() => !unitPickerState.loading && setUnitPickerState(s => ({ ...s, show: false }))}
            actionLabel={pickerActionLabel}
            actionColor={pickerActionColor}
            loading={unitPickerState.loading}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
