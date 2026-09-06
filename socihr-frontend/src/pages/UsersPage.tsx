import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { getUsers, createUser, updateUser, deleteUser, getDepartments, type AppUser, type Department } from "../services/api";

// ─── Mini Toast ──────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: ok ? "#166534" : "#991b1b",
      color: "#fff", borderRadius: 10, padding: "12px 18px",
      fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", gap: 8, maxWidth: 340,
    }}>
      {ok
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
      {msg}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────
interface ModalState {
  mode: "create" | "edit";
  user?: AppUser;
}

export default function UsersPage() {
  const [users,   setUsers]   = useState<AppUser[]>([]);
  const [depts,   setDepts]   = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [modal,   setModal]   = useState<ModalState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AppUser | null>(null);

  // Form state
  const [fUsername, setFUsername] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fRole,     setFRole]     = useState("DeptAdmin");
  const [fDeptId,   setFDeptId]   = useState("");
  const [saving,    setSaving]    = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([getUsers(), getDepartments()]);
      setUsers(u);
      setDepts(d);
    } catch {
      showToast("Failed to load data.", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setFUsername(""); setFPassword(""); setFRole("DeptAdmin"); setFDeptId("");
    setModal({ mode: "create" });
  }

  function openEdit(u: AppUser) {
    setFUsername(u.username); setFPassword(""); setFRole(u.role); setFDeptId(u.departmentID ?? "");
    setModal({ mode: "edit", user: u });
  }

  async function handleSave() {
    if (!fUsername.trim()) { showToast("Username required.", false); return; }
    if (modal?.mode === "create" && !fPassword.trim()) { showToast("Password required.", false); return; }
    if (fRole === "DeptAdmin" && !fDeptId) { showToast("Select a department for DeptAdmin.", false); return; }

    setSaving(true);
    try {
      if (modal?.mode === "create") {
        await createUser({
          username: fUsername.trim(),
          password: fPassword,
          role: fRole,
          departmentID: fRole === "DeptAdmin" ? fDeptId : undefined,
        });
        showToast("User created successfully.");
      } else if (modal?.user) {
        await updateUser(modal.user.userID, {
          username: fUsername.trim() !== modal.user.username ? fUsername.trim() : undefined,
          password: fPassword || undefined,
          departmentID: fRole === "DeptAdmin" ? fDeptId : undefined,
        });
        showToast("User updated successfully.");
      }
      setModal(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Save failed.", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: AppUser) {
    try {
      await deleteUser(u.userID);
      showToast(`"${u.username}" deleted.`);
      setDeleteConfirm(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Delete failed.", false);
    }
  }

  const roleBadge = (r: string) => {
    const isSuper = r === "SuperAdmin";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 600,
        background: isSuper ? "rgba(99,102,241,0.08)" : "rgba(2,132,199,0.08)",
        color: isSuper ? "#6366f1" : "#0284c7",
        border: `1px solid ${isSuper ? "rgba(99,102,241,0.2)" : "rgba(2,132,199,0.2)"}`,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: isSuper ? "#6366f1" : "#0284c7" }} />
        {isSuper ? "Super Admin" : "Dept Admin"}
      </span>
    );
  };

  return (
    <Layout>
      <div style={{ padding: "28px 36px 64px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {toast && <Toast msg={toast.msg} ok={toast.ok} />}

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em", margin: 0 }}>
              Users
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-3)", marginTop: 3 }}>
              Manage administrator accounts and department access permissions
            </p>
          </div>
          <button id="create-user-btn" className="btn btn-primary btn-sm" onClick={openCreate} style={{ gap: 6, display: "inline-flex", alignItems: "center", padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add User</span>
          </button>
        </div>

        {/* ── Table ── */}
        <div style={{ background: "var(--white)", borderRadius: "var(--r-md)", border: "1px solid var(--line)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-4)", fontSize: 13 }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-4)", fontSize: 13 }}>No users found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
                  {["Username", "Role", "Department", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.userID} style={{ borderBottom: i < users.length - 1 ? "1px solid var(--line)" : "none", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--bg-tag, #f1f5f9)", border: "1px solid var(--line, #e2e8f0)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", flexShrink: 0,
                        }}>{u.username.charAt(0).toUpperCase()}</div>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-1)" }}>{u.username}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{roleBadge(u.role)}</td>
                    <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: u.departmentName ? "var(--text-2)" : "var(--text-4)" }}>
                      {u.departmentName ?? <span style={{ fontStyle: "italic" }}>All departments</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "0.78rem", padding: "4px 8px", gap: 5, display: "flex", alignItems: "center" }}
                          onClick={() => openEdit(u)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          <span>Edit</span>
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "0.78rem", padding: "4px 8px", gap: 5, display: "flex", alignItems: "center", color: "var(--red)" }}
                          onClick={() => setDeleteConfirm(u)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,17,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ background: "var(--white)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-1)", margin: "0 0 20px", letterSpacing: "-0.02em" }}>
              {modal.mode === "create" ? "Add New User" : `Edit — ${modal.user?.username}`}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 5 }}>
                USERNAME
                <input
                  id="user-modal-username"
                  className="input"
                  value={fUsername}
                  onChange={e => setFUsername(e.target.value)}
                  placeholder="e.g. admin_ageing"
                  style={{ fontSize: 13 }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 5 }}>
                PASSWORD {modal.mode === "edit" && <span style={{ fontWeight: 400, color: "var(--text-4)" }}>(leave blank to keep current)</span>}
                <input
                  id="user-modal-password"
                  className="input"
                  type="password"
                  value={fPassword}
                  onChange={e => setFPassword(e.target.value)}
                  placeholder={modal.mode === "create" ? "Set password" : "New password (optional)"}
                  style={{ fontSize: 13 }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 5 }}>
                ROLE
                <select
                  id="user-modal-role"
                  className="input"
                  value={fRole}
                  onChange={e => setFRole(e.target.value)}
                  style={{ fontSize: 13 }}
                  disabled={modal.mode === "edit"} // role change not supported after creation
                >
                  <option value="DeptAdmin">Dept Admin</option>
                  <option value="SuperAdmin">Super Admin</option>
                </select>
                {modal.mode === "edit" && <span style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 400 }}>Role cannot be changed after creation.</span>}
              </label>

              {fRole === "DeptAdmin" && (
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 5 }}>
                  DEPARTMENT
                  <select
                    id="user-modal-dept"
                    className="input"
                    value={fDeptId}
                    onChange={e => setFDeptId(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="">— Select department —</option>
                    {depts.map(d => (
                      <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)} style={{ fontSize: 13 }}>Cancel</button>
              <button id="user-modal-save" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 13, minWidth: 90 }}>
                {saving ? "Saving…" : modal.mode === "create" ? "Create User" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,17,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--white)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.25" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Delete User</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 20px" }}>
              Are you sure you want to delete <strong>{deleteConfirm.username}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} style={{ fontSize: 13 }}>Cancel</button>
              <button
                id="user-delete-confirm-btn"
                className="btn"
                style={{ fontSize: 13, background: "#dc2626", color: "#fff", border: "none", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}
