import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import {
  createDepartment,
  getDepartments,
  getStaffList,
  type Department,
  type Staff,
} from "../services/api";

const DEPARTMENT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [saving, setSaving] = useState(false);

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
      await createDepartment(newDepartmentName);
      setNewDepartmentName("");
      setShowAddModal(false);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  const displayDepartments = useMemo(() => {
    const staffCountByDepartment = new Map<string, number>();

    staff.forEach((item) => {
      const key = item.department?.trim();
      if (!key) return;
      staffCountByDepartment.set(key, (staffCountByDepartment.get(key) ?? 0) + 1);
    });

    return departments.map((department, index) => ({
      ...department,
      staffCount: staffCountByDepartment.get(department.departmentName) ?? 0,
      color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
    }));
  }, [departments, staff]);

  return (
    <Layout>
      <div>
        <div className="page-hd">
          <div>
            <h1 className="page-title">Department Management</h1>
            <p className="page-sub">Manage department master data used across staff records</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Department
          </button>
        </div>

        {loading ? (
          <div className="loader" style={{ padding: "60px 0" }}>
            <div className="spin" />
            <span>Loading departments...</span>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <span className="badge badge-neutral">Total: {departments.length}</span>
              <span className="badge badge-blue">Staff Linked: {staff.length}</span>
            </div>

            {displayDepartments.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 32 }}>
                <p style={{ color: "var(--text-3)", fontSize: 13 }}>No departments registered yet</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {displayDepartments.map((department, index) => (
                  <motion.div
                    key={department.departmentID}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="card"
                    style={{
                      background: "var(--white)",
                      borderLeft: `5px solid ${department.color}`,
                      boxShadow: "var(--shadow-sm)",
                      padding: "18px 20px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>
                          {department.departmentName}
                        </h3>
                        <p style={{ fontSize: 12, color: "var(--text-3)" }}>
                          Available for staff forms and filters
                        </p>
                      </div>
                      <span
                        className="badge badge-neutral"
                        style={{ whiteSpace: "nowrap", fontSize: 11, fontWeight: 700 }}
                      >
                        {department.staffCount} staff
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h2 className="modal-title">Add New Department</h2>
              <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-icon btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddDepartment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="input-label" htmlFor="department-name">Department Name</label>
                <input
                  id="department-name"
                  className="input"
                  type="text"
                  placeholder="e.g. HUMAN RESOURCE"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving || !newDepartmentName.trim()} className="btn btn-primary" style={{ flex: 1 }}>
                  {saving ? <><span className="spin" style={{ width: 12, height: 12 }} /> Saving...</> : "Add Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
