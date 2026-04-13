import { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

interface CRMUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'phc';
  active: boolean;
  pagePermissions?: Record<string, boolean>;
  created_at?: string;
}

const inputClass =
  'w-full px-3 py-2 bg-black border border-exclusive-black-border text-white rounded-lg focus:outline-none focus:border-exclusive-red focus:ring-1 focus:ring-exclusive-red text-sm placeholder-gray-600';
const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

const PERMISSIONS = [
  { key: 'canReviewSubmittedApplications', label: 'Review Submitted Applications' },
];

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
        role === 'admin'
          ? 'bg-exclusive-red/20 text-exclusive-red border-exclusive-red/30'
          : 'bg-gray-800 text-gray-300 border-gray-700'
      }`}
    >
      {role === 'admin' ? 'Admin' : 'PHC'}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
        active
          ? 'bg-green-900/30 text-green-400 border-green-700/40'
          : 'bg-gray-800 text-gray-500 border-gray-700'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'phc' as 'admin' | 'phc' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit user
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: 'admin' | 'phc'; active: boolean; pagePermissions: Record<string, boolean> }>({
    name: '',
    role: 'phc',
    active: true,
    pagePermissions: {},
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data as CRMUser[]);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await adminAPI.createUser(createForm);
      setCreateForm({ name: '', email: '', password: '', role: 'phc' });
      setShowCreate(false);
      await fetchUsers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setCreateError(ax.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user: CRMUser) => {
    setEditId(user.id);
    setEditError(null);
    setEditForm({
      name: user.name,
      role: user.role,
      active: user.active ?? true,
      pagePermissions: user.pagePermissions ?? {},
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    setEditError(null);
    try {
      await adminAPI.updateUser(editId, { name: editForm.name, role: editForm.role, active: editForm.active });
      await adminAPI.setPermissions(editId, editForm.pagePermissions);
      setEditId(null);
      await fetchUsers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setEditError(ax.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(id);
      await fetchUsers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      alert(ax.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 sm:pb-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">User Management</h1>
          <button
            onClick={() => { setShowCreate((v) => !v); setCreateError(null); }}
            className="px-4 py-2 bg-exclusive-red hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {showCreate ? 'Cancel' : '+ New User'}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-exclusive-red/10 border border-exclusive-red/30 rounded-lg text-exclusive-red text-sm">
            {error}
          </div>
        )}

        {/* Create user form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mb-6 p-4 bg-exclusive-black-card border border-exclusive-black-border rounded-xl space-y-3"
          >
            <h2 className="text-sm font-semibold text-white mb-2">Create New User</h2>
            {createError && (
              <p className="text-exclusive-red text-xs">{createError}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputClass}
                  placeholder="Min. 6 characters"
                />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as 'admin' | 'phc' }))}
                  className={inputClass}
                >
                  <option value="phc">PHC</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="mt-2 px-4 py-2 bg-exclusive-red hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </form>
        )}

        {/* Users table */}
        <div className="bg-exclusive-black-card border border-exclusive-black-border rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1.5fr_80px_80px_120px] gap-4 px-4 py-3 border-b border-exclusive-black-border text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {users.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-500 text-sm">No users found.</p>
          ) : (
            users.map((user) => (
              <div key={user.id}>
                {/* Row */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_80px_80px_120px] gap-2 sm:gap-4 px-4 py-3 border-b border-exclusive-black-border/50 last:border-0 items-center">
                  <span className="text-white text-sm font-medium truncate">{user.name}</span>
                  <span className="text-gray-400 text-xs truncate">{user.email}</span>
                  <span><RoleBadge role={user.role} /></span>
                  <span><ActiveBadge active={user.active ?? true} /></span>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <button
                      onClick={() => openEdit(user)}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-exclusive-black-border transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      className="text-xs text-gray-600 hover:text-exclusive-red px-2 py-1 rounded hover:bg-exclusive-black-border transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline edit panel */}
                {editId === user.id && (
                  <form
                    onSubmit={handleSaveEdit}
                    className="mx-4 mb-3 p-4 bg-black border border-exclusive-black-border rounded-xl space-y-3"
                  >
                    <h3 className="text-xs font-semibold text-white mb-2">Edit User</h3>
                    {editError && <p className="text-exclusive-red text-xs">{editError}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Name</label>
                        <input
                          required
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Role</label>
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as 'admin' | 'phc' }))}
                          className={inputClass}
                        >
                          <option value="phc">PHC</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Status</label>
                        <select
                          value={editForm.active ? 'active' : 'inactive'}
                          onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.value === 'active' }))}
                          className={inputClass}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <p className={`${labelClass} mb-2`}>Page Permissions</p>
                      <div className="space-y-2">
                        {PERMISSIONS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={!!editForm.pagePermissions[key]}
                                onChange={() =>
                                  setEditForm((f) => ({
                                    ...f,
                                    pagePermissions: { ...f.pagePermissions, [key]: !f.pagePermissions[key] },
                                  }))
                                }
                              />
                              <div
                                className={`w-9 h-5 rounded-full transition-colors ${
                                  editForm.pagePermissions[key] ? 'bg-exclusive-red' : 'bg-gray-700'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    editForm.pagePermissions[key] ? 'translate-x-4' : 'translate-x-0.5'
                                  }`}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-gray-300">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-1.5 bg-exclusive-red hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
