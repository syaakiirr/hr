import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StaffForm from "../components/StaffForm";
import ConfirmationDialog from "../components/ConfirmationDialog";
import type { Staff } from "../services/api";
import { getStaffList, createStaff, updateStaff, toggleStaffStatus, archiveStaff, deleteStaff } from "../services/api";

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#6366f1", "#0284c7", "#059669", "#d97706", "#dc2626", "#7c3aed"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 6, flexShrink: 0,
      background: `${color}10`,
      border: `1px solid ${color}20`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, color: color,
    }}>
      {initials}
    </div>
  );
}

export default function StaffPage() {
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStaffList({
        search: search || undefined,
        department: filterDept || undefined,
        status: filterStatus || undefined,
      });
      setStaffList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterStatus]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const departments = Array.from(new Set(staffList.map((s) => s.department).filter(Boolean))) as string[];
  const activeCount = staffList.filter((s) => s.status === "Active").length;
  const inactiveCount = staffList.filter((s) => s.status === "Inactive").length;

  async function handleSave(data: { fullName: string; department: string; position: string; companyID?: string }) {
    setSaving(true);
    try {
      if (editingStaff) await updateStaff(editingStaff.staffID, data);
      else await createStaff(data);
      setShowForm(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  function openConfirmDialog(title: string, message: string, onConfirm: () => Promise<void> | void) {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  }

  function handleToggle(staff: Staff) {
    const action = staff.status === "Active" ? "deactivate" : "activate";
    openConfirmDialog(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Staff`,
      `Are you sure you want to ${action} ${staff.fullName}?`,
      async () => {
        try {
          await toggleStaffStatus(staff.staffID);
          fetchStaff();
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : "An error occurred.");
        }
      }
    );
  }

  async function handleArchive(staff: Staff) {
    try {
      await archiveStaff(staff.staffID);
      alert("Staff archived successfully");
      fetchStaff();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  async function handleDelete(staff: Staff) {
    try {
      await deleteStaff(staff.staffID);
      alert("Staff deleted successfully");
      fetchStaff();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: -8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.2 }}
      >
        <div className="page-hd">
          <div>
            <h1 className="page-title">Staff</h1>
            <p className="page-sub">Staff list and employee database management</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate('/archived')}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h18v5H3zM3 8h18v13H3z" />
                <path d="M9 12h6" />
              </svg>
              View Archived
            </button>
            <motion.button
              id="add-staff-btn"
              onClick={() => { setEditingStaff(null); setShowForm(true); }}
              className="btn btn-primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Staff
            </motion.button>
          </div>
        </div>

        {/* Info row */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
        >
          <span className="badge badge-neutral">Total: {staffList.length}</span>
          <span className="badge badge-green">Active: {activeCount}</span>
          <span className="badge badge-red">Inactive: {inactiveCount}</span>
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
              id="search-staff"
              className="input"
              type="text"
              placeholder="Search staff name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            id="filter-dept"
            className="input"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            id="filter-status"
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

      {/* Main Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="tbl-wrap"
      >
        {loading ? (
          <div className="loader">
            <div className="spin" />
            Loading staff information...
          </div>
        ) : staffList.length === 0 ? (
          <div className="empty">
            <div className="empty-ico">👥</div>
            <p className="empty-title">No Staff Found</p>
            <p className="empty-desc">Please add a new staff member or refine your search query.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Full Name</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
                <th>Date Registered</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((staff, idx) => (
                <tr key={staff.staffID}>
                  <td style={{ color: "var(--text-4)", fontWeight: 500 }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={staff.fullName} />
                      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{staff.fullName}</span>
                    </div>
                  </td>
                  <td>
                    {staff.department ? (
                      <span className="badge badge-neutral">{staff.department}</span>
                    ) : (
                      <span style={{ color: "var(--text-4)" }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-3)" }}>
                    {staff.position || <span style={{ color: "var(--text-4)" }}>—</span>}
                  </td>
                  <td>
                    <span className={`badge ${staff.status === "Active" ? "badge-green" : "badge-red"}`}>
                      {staff.status === "Active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-3)" }}>
                    {new Date(staff.createdAt).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button
                        onClick={() => { setEditingStaff(staff); setShowForm(true); }}
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(staff)}
                        className={`btn btn-sm ${staff.status === "Active" ? "btn-danger" : "btn-success-outline"}`}
                      >
                        {staff.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleArchive(staff)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--text-4)" }}
                        title="Archive staff"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3h18v5H3zM3 8h18v13H3z" />
                          <path d="M9 12h6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(staff)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#ef4444" }}
                        title="Delete staff permanently"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {showForm && (
        <StaffForm
          staff={editingStaff}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingStaff(null); }}
          loading={saving}
        />
      )}

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </Layout>
  );
}
