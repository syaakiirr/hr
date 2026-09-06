import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import StaffForm from "../components/StaffForm";
import ConfirmationDialog from "../components/ConfirmationDialog";
import Toast, { type ToastState } from "../components/Toast";
import type { Staff } from "../services/api";
import { getStaffList, createStaff, updateStaff, toggleStaffStatus, archiveStaff, deleteStaff } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// ==========================================
// Lucide SVG Icons
// ==========================================

function UsersIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UserPlusIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function ArchiveIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function EditIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
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

function ChevronLeftIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckCircleIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function UserXIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </svg>
  );
}

function BuildingIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" />
      <path d="M8 10h.01" /><path d="M16 10h.01" />
      <path d="M8 14h.01" /><path d="M16 14h.01" />
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--bg-tag, #f1f5f9)",
        border: "1px solid var(--line, #e2e8f0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "var(--text-2, #475569)",
      }}
    >
      {initials || "U"}
    </div>
  );
}

export default function StaffPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDeptAdmin, user } = useAuth();
  const deptName = user?.departmentName ?? localStorage.getItem("departmentName") ?? "";
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState(searchParams.get("department") ?? "");
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    isLoading: boolean;
    confirmLabel: string;
    danger: boolean;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {}, isLoading: false, confirmLabel: "Confirm", danger: true });
  const [toast, setToast] = useState<ToastState>({ isOpen: false, message: "", type: "success" });

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ isOpen: true, message, type });
  }

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStaffList({
        search: search || undefined,
        department: filterDept || undefined,
        status: filterStatus || undefined,
      });
      setStaffList(data);
      setPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterStatus]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const departments = useMemo(() => {
    return Array.from(new Set(staffList.map((s) => s.department).filter(Boolean))) as string[];
  }, [staffList]);

  const activeCount = useMemo(() => staffList.filter((s) => s.status === "Active").length, [staffList]);
  const inactiveCount = useMemo(() => staffList.filter((s) => s.status === "Inactive").length, [staffList]);
  const internCount = useMemo(() => staffList.filter((s) => s.staffType === "Intern").length, [staffList]);
  const [filterStaffType, setFilterStaffType] = useState("");

  async function handleSave(data: { fullName: string; department: string; position: string; staffType?: string; companyID?: string }) {
    setSaving(true);
    try {
      if (editingStaff) await updateStaff(editingStaff.staffID, data);
      else await createStaff(data);
      setShowForm(false);
      setEditingStaff(null);
      showToast(editingStaff ? "Staff updated successfully" : "New staff added successfully");
      fetchStaff();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "An error occurred.", "error");
    } finally {
      setSaving(false);
    }
  }

  function openConfirmDialog(title: string, message: string, onConfirm: () => Promise<void> | void, confirmLabel = "Confirm", danger = true) {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, isLoading: false, confirmLabel, danger });
  }

  function closeConfirmDialog() {
    setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {}, isLoading: false, confirmLabel: "Confirm", danger: true });
  }

  function handleToggle(staff: Staff) {
    const action = staff.status === "Active" ? "deactivate" : "activate";
    openConfirmDialog(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Staff`,
      `Are you sure you want to ${action} ${toTitleCase(staff.fullName)}?`,
      async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await toggleStaffStatus(staff.staffID);
          showToast(`Staff ${action}d successfully`);
          fetchStaff();
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : "An error occurred.", "error");
        } finally {
          closeConfirmDialog();
        }
      },
      action.charAt(0).toUpperCase() + action.slice(1),
      staff.status === "Active"
    );
  }

  function handleArchive(staff: Staff) {
    openConfirmDialog(
      "Archive Staff",
      `Archive ${toTitleCase(staff.fullName)}? This record can be restored anytime from the Archive page.`,
      async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await archiveStaff(staff.staffID);
          showToast("Staff archived successfully");
          fetchStaff();
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : "An error occurred.", "error");
        } finally {
          closeConfirmDialog();
        }
      },
      "Archive",
      false
    );
  }

  function handleDelete(staff: Staff) {
    openConfirmDialog(
      "Permanently Delete Staff",
      `Are you sure you want to PERMANENTLY delete ${toTitleCase(staff.fullName)}? This action cannot be undone and will delete all related records.`,
      async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await deleteStaff(staff.staffID);
          showToast("Staff deleted permanently");
          fetchStaff();
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : "An error occurred.", "error");
        } finally {
          closeConfirmDialog();
        }
      },
      "Delete",
      true
    );
  }

  const filteredStaff = useMemo(() => {
    if (!filterStaffType) return staffList;
    return staffList.filter((s) => s.staffType === filterStaffType);
  }, [staffList, filterStaffType]);

  const paginatedStaff = useMemo(() => {
    return filteredStaff.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredStaff, page, pageSize]);

  return (
    <Layout>
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Staff
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              Manage team members, roles, and department assignments
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => navigate("/archived")}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <ArchiveIcon size={14} />
              <span>Archived</span>
            </button>
            <button
              onClick={async () => {
                const { downloadPageAsPDF } = await import("../utils/pdf");
                downloadPageAsPDF("Staff_List");
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 500 }}
            >
              <DownloadIcon size={14} />
              <span>Export PDF</span>
            </button>
            <button
              id="add-staff-btn"
              onClick={() => {
                setEditingStaff(null);
                setShowForm(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600 }}
            >
              <UserPlusIcon size={14} color="#fff" />
              <span>Add Member</span>
            </button>
          </div>
        </div>

        {/* Minimalist Metric Strip */}
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
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Total Staff</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {staffList.length}
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
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Active</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#16a34a", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {activeCount}
              </p>
            </div>
            <span style={{ color: "#16a34a" }}><CheckCircleIcon size={16} /></span>
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
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Inactive</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: inactiveCount > 0 ? "var(--text-2)" : "var(--text-3)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {inactiveCount}
              </p>
            </div>
            <span style={{ color: "var(--text-4)" }}><UserXIcon size={16} /></span>
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
              <span style={{ fontSize: "0.74rem", color: "var(--text-3)", fontWeight: 500 }}>Departments</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {departments.length}
              </p>
            </div>
            <span style={{ color: "var(--text-4)" }}><BuildingIcon size={16} /></span>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--r-md)",
              background: "#fef3c7",
              border: "1px solid #fde68a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontSize: "0.74rem", color: "#92400e", fontWeight: 500 }}>Interns</span>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#92400e", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {internCount}
              </p>
            </div>
            <span style={{ fontSize: 18 }}>🎓</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
            alignItems: "center",
            background: "var(--white)",
            padding: "12px 16px",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <input
              id="search-staff"
              className="input"
              type="text"
              placeholder="Search staff name or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 34,
                paddingRight: search ? 30 : 12,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line-2)",
                height: 38,
                fontSize: "0.85rem",
              }}
            />
            <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", display: "flex" }}>
              <SearchIcon size={14} />
            </div>
            {search && (
              <button
                onClick={() => setSearch("")}
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

          {!isDeptAdmin() && (
            <select
              id="filter-dept"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line-2)",
                background: "var(--white)",
                color: "var(--text-1)",
                fontSize: "0.85rem",
                outline: "none",
                fontWeight: 500,
                cursor: "pointer",
                height: 38,
              }}
            >
              <option value="">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {toTitleCase(d)}
                </option>
              ))}
            </select>
          )}

          {isDeptAdmin() && deptName && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "var(--accent-soft)",
                border: "1px solid rgba(99,102,241,0.25)",
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--accent)",
                height: 38,
              }}
            >
              <BuildingIcon size={14} />
              <span>{toTitleCase(deptName)}</span>
            </div>
          )}

          <select
            id="filter-staff-type"
            value={filterStaffType}
            onChange={(e) => setFilterStaffType(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line-2)",
              background: "var(--white)",
              color: "var(--text-1)",
              fontSize: "0.85rem",
              outline: "none",
              fontWeight: 500,
              cursor: "pointer",
              height: 38,
            }}
          >
            <option value="">All Types</option>
            <option value="Permanent">Permanent</option>
            <option value="Intern">Intern</option>
          </select>

          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line-2)",
              background: "var(--white)",
              color: "var(--text-1)",
              fontSize: "0.85rem",
              outline: "none",
              fontWeight: 500,
              cursor: "pointer",
              height: 38,
            }}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>

        {/* Staff Table */}
        <div
          style={{
            background: "var(--white)",
            borderRadius: 20,
            border: "1px solid var(--line)",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-3)" }}>
              <div className="spin" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 500 }}>Loading staff members...</p>
            </div>
          ) : staffList.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--text-3)" }}>
                <UsersIcon size={24} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>No Staff Records Found</h3>
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem", maxWidth: 400, margin: "0 auto 16px" }}>
                There are no staff matching your current search or filter criteria.
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
                      <th style={{ width: 65, textAlign: "center", padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        #
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        Staff Member
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        Department
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        Position
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textAlign: "center", width: 100 }}>
                        Status
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        Joined Date
                      </th>
                      <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textAlign: "right" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStaff.map((staff, idx) => (
                      <tr
                        key={staff.staffID}
                        style={{
                          borderBottom: "1px solid var(--line)",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.03)";
                          e.currentTarget.style.transform = "translateX(2px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.transform = "translateX(0px)";
                        }}
                      >
                        <td style={{ textAlign: "center", padding: "14px 18px", fontSize: 12.5, color: "var(--text-4)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                          {(page - 1) * pageSize + idx + 1 < 10 ? `0${(page - 1) * pageSize + idx + 1}` : (page - 1) * pageSize + idx + 1}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Avatar name={staff.fullName} />
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={{ fontWeight: 600, color: "var(--text-1)", fontSize: "0.9rem", lineHeight: 1.3 }}>
                                  {toTitleCase(staff.fullName)}
                                </p>
                                {staff.staffType === "Intern" && (
                                  <span
                                    style={{
                                      padding: "1px 7px",
                                      borderRadius: 99,
                                      fontSize: "0.67rem",
                                      fontWeight: 700,
                                      background: "#fef3c7",
                                      color: "#92400e",
                                      border: "1px solid #fde68a",
                                      letterSpacing: "0.04em",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    Intern
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          {staff.department ? (
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "0.82rem",
                                fontWeight: 500,
                                color: "var(--text-2)",
                              }}
                            >
                              {toTitleCase(staff.department)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-4)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: "0.84rem", color: "var(--text-2)" }}>
                          {staff.position ? toTitleCase(staff.position) : <span style={{ color: "var(--text-4)" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 99,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: staff.status === "Active" ? "var(--green-soft)" : "var(--red-soft)",
                              color: staff.status === "Active" ? "var(--green)" : "var(--red)",
                              border: staff.status === "Active" ? "1px solid var(--green-line)" : "1px solid var(--red-line)",
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: staff.status === "Active" ? "var(--green)" : "var(--red)",
                              }}
                            />
                            <span>{staff.status}</span>
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", fontSize: "0.82rem", color: "var(--text-3)" }}>
                          {new Date(staff.createdAt).toLocaleDateString("en-US", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <button
                              onClick={() => {
                                setEditingStaff(staff);
                                setShowForm(true);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 12 }}
                              title="Edit staff details"
                            >
                              <EditIcon size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleToggle(staff)}
                              className={`btn btn-sm ${staff.status === "Active" ? "btn-danger" : "btn-success-outline"}`}
                              style={{ padding: "5px 10px", fontSize: 12 }}
                            >
                              {staff.status === "Active" ? "Deactivate" : "Activate"}
                            </button>
                            {!isDeptAdmin() && (
                              <>
                                <button
                                  onClick={() => handleArchive(staff)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: "var(--text-3)", padding: 6 }}
                                  title="Archive staff"
                                >
                                  <ArchiveIcon size={13} />
                                </button>
                                <button
                                  onClick={() => handleDelete(staff)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: "var(--red)", padding: 6 }}
                                  title="Delete permanently"
                                >
                                  <TrashIcon size={13} color="var(--red)" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modern Pagination Footer */}
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "0.82rem", color: "var(--text-3)" }}>
                  <span>
                    Showing <strong style={{ color: "var(--text-1)" }}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, staffList.length)}</strong> of <strong style={{ color: "var(--text-1)" }}>{staffList.length}</strong> staff members
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--line-2)",
                        background: "var(--white)",
                        color: "var(--text-1)",
                        fontSize: 12,
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "5px 12px", fontSize: 12, opacity: page === 1 ? 0.35 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
                  >
                    <ChevronLeftIcon size={14} />
                    <span>Prev</span>
                  </button>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-2)", padding: "0 6px" }}>
                    Page {page} of {Math.max(1, Math.ceil(staffList.length / pageSize))}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(Math.ceil(staffList.length / pageSize), p + 1))}
                    disabled={page >= Math.ceil(staffList.length / pageSize)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "5px 12px", fontSize: 12, opacity: page >= Math.ceil(staffList.length / pageSize) ? 0.35 : 1, cursor: page >= Math.ceil(staffList.length / pageSize) ? "not-allowed" : "pointer" }}
                  >
                    <span>Next</span>
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <StaffForm
          staff={editingStaff}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingStaff(null);
          }}
          loading={saving}
        />
      )}

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirmDialog}
        isLoading={confirmDialog.isLoading}
        confirmLabel={confirmDialog.confirmLabel}
        danger={confirmDialog.danger}
      />

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
      />
    </Layout>
  );
}
