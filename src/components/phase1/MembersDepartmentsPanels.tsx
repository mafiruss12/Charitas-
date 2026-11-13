import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Loader2, Plus, Search, Trash2, UserCheck, Users } from 'lucide-react';
import { ROLE_LABELS, CHURCH_ROLES } from '../../db/rbac';
import { apiFetch } from '../../lib/api';
import type { ChurchMemberItem, DepartmentItem } from '../../types/platform';

interface MembersPanelProps {
  churchId: number;
  canManage: boolean;
  departments: DepartmentItem[];
  onRefreshDashboard: () => void;
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  churchId,
  canManage,
  departments,
  onRefreshDashboard,
}) => {
  const [members, setMembers] = useState<ChurchMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'leaders'>('all');
  const [editing, setEditing] = useState<ChurchMemberItem | null>(null);
  const [editRole, setEditRole] = useState('member');
  const [editDeptId, setEditDeptId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      const res = await apiFetch<{ members: ChurchMemberItem[] }>(
        `/api/churches/${churchId}/members?${params.toString()}`
      );
      setMembers(res.members);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des membres.');
    } finally {
      setLoading(false);
    }
  }, [churchId, roleFilter, search]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const displayedMembers =
    viewMode === 'leaders'
      ? members.filter((m) =>
          [
            'super_admin',
            'church_admin',
            'senior_pastor',
            'associate_pastor',
            'department_leader',
            'treasurer',
            'humanitarian_lead',
            'moderator',
          ].includes(m.role)
        )
      : members;

  const openEdit = (m: ChurchMemberItem) => {
    setEditing(m);
    setEditRole(m.role);
    setEditDeptId(m.departmentId ? String(m.departmentId) : '');
    setEditTitle(m.leadershipTitle || '');
    setEditStatus(m.status === 'suspended' ? 'suspended' : 'active');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/members/${editing.membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: editRole,
          departmentId: editDeptId ? Number(editDeptId) : null,
          leadershipTitle: editTitle,
          status: editStatus,
        }),
      });
      setEditing(null);
      await loadMembers();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Échec de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
            Membres &amp; Responsables
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Annuaire isolé de l’église, affectations aux départements et gestion des responsabilités.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-900 rounded-lg border border-stone-200 dark:border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'all'
                ? 'bg-white dark:bg-slate-800 text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-600 dark:text-slate-400'
            }`}
          >
            Tous les membres ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('leaders')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'leaders'
                ? 'bg-white dark:bg-slate-800 text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-600 dark:text-slate-400'
            }`}
          >
            Responsables &amp; Pasteurs
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email ou titre pastoral..."
            className="w-full h-11 pl-10 pr-4 rounded-lg border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-stone-900 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-11 px-3.5 rounded-lg border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-stone-900 dark:text-white"
        >
          <option value="">Tous les rôles</option>
          {CHURCH_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-200 dark:border-slate-800 text-xs font-medium text-stone-500 dark:text-slate-400">
              <th className="py-3 px-4">Membre</th>
              <th className="py-3 px-4">Rôle &amp; Titre</th>
              <th className="py-3 px-4">Département</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4">Adhésion</th>
              {canManage && <th className="py-3 px-4 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-slate-800 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-stone-500 dark:text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Chargement des membres...
                </td>
              </tr>
            ) : displayedMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-stone-500 dark:text-slate-400">
                  Aucun membre trouvé pour ces critères.
                </td>
              </tr>
            ) : (
              displayedMembers.map((m) => (
                <tr key={m.membershipId} className="hover:bg-stone-50 dark:hover:bg-slate-800/50">
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-stone-900 dark:text-white">{m.fullName}</div>
                    <div className="text-xs text-stone-500 dark:text-slate-400">
                      {m.email}
                      {m.phone ? ` · ${m.phone}` : ''}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-stone-900 dark:text-slate-100 font-medium">
                      {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] || m.role}
                    </div>
                    {m.leadershipTitle && (
                      <div className="text-xs text-stone-500 dark:text-slate-400">
                        {m.leadershipTitle}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-stone-600 dark:text-slate-300">
                    {m.departmentName || '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-xs font-medium ${
                        m.status === 'active'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {m.status === 'active' ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono-tabular text-stone-500 dark:text-slate-400">
                    {new Date(m.joinedAt).toLocaleDateString('fr-FR')}
                  </td>
                  {canManage && (
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Gérer
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
              Modifier — {editing.fullName}
            </h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Rôle dans l’église
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
                >
                  {CHURCH_ROLES.filter((r) => r !== 'super_admin').map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Département
                </label>
                <select
                  value={editDeptId}
                  onChange={(e) => setEditDeptId(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
                >
                  <option value="">Aucun département</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Titre ou ministère (optionnel)
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ex. Diacre, Chef de chœur..."
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Statut
                </label>
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value === 'suspended' ? 'suspended' : 'active')
                  }
                  className="w-full h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
                >
                  <option value="active">Actif</option>
                  <option value="suspended">Suspendu</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-lg text-sm text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 dark:bg-amber-600 inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface DepartmentsPanelProps {
  churchId: number;
  canManage: boolean;
  onRefreshDashboard: () => void;
}

export const DepartmentsPanel: React.FC<DepartmentsPanelProps> = ({
  churchId,
  canManage,
  onRefreshDashboard,
}) => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [members, setMembers] = useState<ChurchMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderUserId, setLeaderUserId] = useState('');
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, memRes] = await Promise.all([
        apiFetch<{ departments: DepartmentItem[] }>(`/api/churches/${churchId}/departments`),
        apiFetch<{ members: ChurchMemberItem[] }>(`/api/churches/${churchId}/members`).catch(
          () => ({ members: [] })
        ),
      ]);
      setDepartments(deptRes.departments);
      setMembers(memRes.members);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editingDept) {
        await apiFetch(`/api/churches/${churchId}/departments/${editingDept.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            description,
            leaderUserId: leaderUserId ? Number(leaderUserId) : null,
          }),
        });
      } else {
        await apiFetch(`/api/churches/${churchId}/departments`, {
          method: 'POST',
          body: JSON.stringify({
            name,
            description,
            leaderUserId: leaderUserId ? Number(leaderUserId) : null,
          }),
        });
      }
      setName('');
      setDescription('');
      setLeaderUserId('');
      setEditingDept(null);
      await loadData();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/departments/${id}`, { method: 'DELETE' });
      await loadData();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
          Départements &amp; Ministères
        </h2>
        <p className="text-sm text-stone-600 dark:text-slate-400">
          Structurez les pôles de votre église et désignez leurs responsables.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            {editingDept ? `Modifier : ${editingDept.name}` : 'Nouveau département'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du département (ex. Intercession)"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mission et activités principales"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <select
              value={leaderUserId}
              onChange={(e) => setLeaderUserId(e.target.value)}
              className="h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            >
              <option value="">Responsable (optionnel)</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {editingDept ? 'Mettre à jour' : 'Ajouter le département'}
            </button>
            {editingDept && (
              <button
                type="button"
                onClick={() => {
                  setEditingDept(null);
                  setName('');
                  setDescription('');
                  setLeaderUserId('');
                }}
                className="px-3 py-2 text-xs text-stone-600 dark:text-slate-400 hover:underline cursor-pointer"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-10 text-center text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : departments.length === 0 ? (
        <div className="rounded-xl border border-stone-200 dark:border-slate-800 p-8 text-center text-sm text-stone-500">
          Aucun département configuré.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                    {d.name}
                  </h3>
                  <span className="font-mono-tabular text-xs text-stone-500 dark:text-slate-400 inline-flex items-center gap-1 shrink-0">
                    <Users className="w-3.5 h-3.5" />
                    {d.memberCount ?? 0}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-400">
                  {d.description || 'Aucune description renseignée.'}
                </p>
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-slate-300">
                  <UserCheck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  {d.leaderName ? `Responsable : ${d.leaderName}` : 'Responsable non assigné'}
                </span>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDept(d);
                        setName(d.name);
                        setDescription(d.description || '');
                        setLeaderUserId(d.leaderUserId ? String(d.leaderUserId) : '');
                      }}
                      className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-600 dark:text-slate-300 cursor-pointer"
                      aria-label="Modifier département"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 cursor-pointer"
                      aria-label="Supprimer département"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
