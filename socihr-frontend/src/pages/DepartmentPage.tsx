import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ConfirmationDialog from "../components/ConfirmationDialog";
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  getStaffList,
  type Department,
  type Staff,
} from "../services/api";

// ==========================================
// Crisp Lucide SVG Icon Components
// ==========================================

function Building2Icon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </svg>
  );
}

function PlusIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function DownloadIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SearchIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function XIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function UsersIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ArrowUpRightIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function LayersIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
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

const DEPARTMENT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e"];

export default function DepartmentPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
    danger?: boolean;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [departmentList, staffList] = await Promise.all([
        getDepartments(),
        getStaffList(),
      ]);
      setDepartments(departmentList);
      setStaff(staffList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDepartmentName.trim()) return;

    setSaving(true);
    try {
      await createDepartment(newDepartmentName.trim());
      setNewDepartmentName("");
      setShowAddModal(false);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDepartment(id: string, name: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Department",
      message: `Are you sure you want to delete "${toTitleCase(name)}"? This action cannot be undone. It will fail if staff members are currently assigned to this department.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await deleteDepartment(id);
          await fetchData();
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : "Failed to delete department.");
        } finally {
          setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
        }
      },
    });
  }

  const displayDepartments = useMemo(() => {
    const staffCountByDepartment = new Map<string, number>();

    staff.forEach((item) => {
      const key = item.department?.trim();
      if (!key) return;
      staffCountByDepartment.set(key, (staffCountByDepartment.get(key) ?? 0) + 1);
    });

    const mapped = departments.map((department, index) => {
      const count = staffCountByDepartment.get(department.departmentName) ?? 0;
      return {
        ...department,
        staffCount: count,
        color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
      };
    });

    if (!searchQuery.trim()) return mapped;
    const query = searchQuery.toLowerCase();
    return mapped.filter((d) => d.departmentName.toLowerCase().includes(query));
  }, [departments, staff, searchQuery]);

  // Executive KPI summary metrics
  const summaryMetrics = useMemo(() => {
    const totalAssignedStaff = staff.filter((s) => s.department).length;
    const avgStaffPerDept = departments.length > 0 ? (totalAssignedStaff / departments.length).toFixed(1) : "0";

    let largestDept = "None";
    let maxCount = 0;
    displayDepartments.forEach((d) => {
      if (d.staffCount > maxCount) {
        maxCount = d.staffCount;
        largestDept = d.departmentName;
      }
    });

    return {
      totalDepts: departments.length,
      totalStaff: staff.length,
      avgStaffPerDept,
      largestDept,
    };
  }, [departments, staff, displayDepartments]);

  return (
    <Layout>
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Departments
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              Manage organization departments and view staff distribution
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={async () => {
                const { downloadPageAsPDF } = await import("../utils/pdf");
                downloadPageAsPDF("Departments");
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <DownloadIcon size={14} />
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600 }}
            >
              <PlusIcon size={14} color="#fff" />
              <span>Add Department</span>
            </button>
          </div>
        </div>

        {/* Minimalist Metric Strip */}
        {!loading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Departments</span>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {summaryMetrics.totalDepts}
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><Building2Icon size={16} /></span>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Total Staff</span>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {summaryMetrics.totalStaff}
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><UsersIcon size={16} /></span>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Avg Headcount</span>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {summaryMetrics.avgStaffPerDept}
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><LayersIcon size={16} /></span>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--white)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ overflow: "hidden", paddingRight: 8 }}>
                <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Largest Unit</span>
                <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-1)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {toTitleCase(summaryMetrics.largestDept)}
                </p>
              </div>
              <span style={{ color: "var(--text-4)" }}><Building2Icon size={16} /></span>
            </div>
          </div>
        )}

        {/* Search Toolbar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 22,
            alignItems: "center",
            background: "var(--white)",
            padding: "12px 16px",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <input
              className="input"
              type="text"
              placeholder="Search department name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 34,
                paddingRight: searchQuery ? 30 : 12,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line-2)",
                height: 38,
                fontSize: "0.85rem",
              }}
            />
            <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", display: "flex" }}>
              <SearchIcon size={14} />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-3)",
                  padding: 2,
                  display: "flex",
                }}
              >
                <XIcon size={12} />
              </button>
            )}
          </div>
          <span style={{ fontSize: "0.82rem", color: "var(--text-3)", fontWeight: 500 }}>
            Showing {displayDepartments.length} of {departments.length}
          </span>
        </div>

        {/* Departments Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-3)" }}>
            <div className="spin" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontWeight: 500 }}>Loading departments...</p>
          </div>
        ) : displayDepartments.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--white)",
              borderRadius: 20,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--text-3)" }}>
              <Building2Icon size={24} />
            </div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>No Departments Found</h3>
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem", maxWidth: 400, margin: "0 auto 16px" }}>
              {searchQuery ? "No departments match your search term." : "No departments registered in the system yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {displayDepartments.map((department, index) => (
              <motion.div
                key={department.departmentID}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.25 }}
                style={{
                  background: "var(--white)",
                  borderRadius: 16,
                  border: "1px solid var(--line)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                  padding: "20px 20px 16px",
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = department.color + "60";
                  e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--line)";
                  e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.02)";
                  e.currentTarget.style.transform = "translateY(0px)";
                }}
                onClick={() => navigate(`/staff?department=${encodeURIComponent(department.departmentName)}`)}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "var(--bg-tag, #f1f5f9)",
                          border: "1px solid var(--line, #e2e8f0)",
                          color: "var(--text-2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Building2Icon size={18} color="var(--text-2)" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.3 }}>
                          {toTitleCase(department.departmentName)}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDepartment(department.departmentID, department.departmentName);
                      }}
                      title="Delete Department"
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: "var(--text-3)", opacity: 0.6, padding: 4 }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        background: department.staffCount > 0 ? "rgba(16,185,129,0.08)" : "var(--surface-2)",
                        color: department.staffCount > 0 ? "#16a34a" : "var(--text-3)",
                        border: department.staffCount > 0 ? "1px solid rgba(16,185,129,0.2)" : "1px solid var(--line)",
                      }}
                    >
                      {department.staffCount} {department.staffCount === 1 ? "staff" : "staff"}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "var(--accent)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <span>View staff</span>
                    <ArrowUpRightIcon size={13} color="var(--accent)" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Department Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "var(--white)",
                borderRadius: 20,
                padding: 24,
                width: "100%",
                maxWidth: 420,
                boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--line)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(14,165,233,0.12)", color: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Building2Icon size={18} color="#0ea5e9" />
                  </div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-1)" }}>
                    Add New Department
                  </h2>
                </div>
                <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-icon btn-sm">
                  <XIcon size={14} />
                </button>
              </div>

              <form onSubmit={handleAddDepartment} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="input-label" htmlFor="department-name" style={{ fontSize: 12.5, fontWeight: 600 }}>
                    Department Name
                  </label>
                  <input
                    id="department-name"
                    className="input"
                    type="text"
                    placeholder="e.g. Human Resource, IT & Development"
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    required
                    autoFocus
                    style={{ height: 40, borderRadius: "var(--r-md)", marginTop: 6 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: "9px 0" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || !newDepartmentName.trim()} className="btn btn-primary" style={{ flex: 1, padding: "9px 0" }}>
                    {saving ? "Saving..." : "Add Department"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} })}
        isLoading={confirmDialog.isLoading}
        danger={confirmDialog.danger}
      />
    </Layout>
  );
}
