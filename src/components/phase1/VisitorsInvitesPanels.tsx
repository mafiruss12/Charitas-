import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Copy, Loader2, Plus, UserPlus } from 'lucide-react';
import { CHURCH_ROLES, ROLE_LABELS } from '../../db/rbac';
import { apiFetch } from '../../lib/api';
import type {
  ChurchMemberItem,
  DepartmentItem,
  InvitationItem,
  VisitorItem,
} from '../../types/platform';

interface VisitorsPanelProps {
  churchId: number;
  canManage: boolean;
  canConvert: boolean;
  onRefreshDashboard: () => void;
}

const VISITOR_STATUS_LABELS: Record<VisitorItem['followUpStatus'], string> = {
  pending: 'À contacter',
  contacted: 'Contacté',
  integrated: 'Intégré (Membre)',
  archived: 'Archivé',
};

export const VisitorsPanel: React.FC<VisitorsPanelProps> = ({
  churchId,
  canManage,
  canConvert,
  onRefreshDashboard,
}) => {
  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [members, setMembers] = useState<ChurchMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('Culte dominical');
  const [prayerOrNeed, setPrayerOrNeed] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const [visRes, memRes] = await Promise.all([
        apiFetch<{ visitors: VisitorItem[] }>(`/api/churches/${churchId}/visitors`),
        apiFetch<{ members: ChurchMemberItem[] }>(`/api/churches/${churchId}/members`).catch(
          () => ({ members: [] })
        ),
      ]);
      setVisitors(visRes.visitors);
      setMembers(memRes.members);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  const handleAddVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/visitors`, {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email: email || undefined,
          phone: phone || undefined,
          visitDate,
          source,
          prayerOrNeed: prayerOrNeed || undefined,
        }),
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setPrayerOrNeed('');
      await loadVisitors();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    visitorId: number,
    followUpStatus: VisitorItem['followUpStatus'],
    assignedLeaderId?: number | null
  ) => {
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/visitors/${visitorId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          followUpStatus,
          ...(assignedLeaderId !== undefined ? { assignedLeaderId } : {}),
        }),
      });
      await loadVisitors();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible.');
    }
  };

  const handleConvert = async (visitorId: number) => {
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/visitors/${visitorId}/convert`, {
        method: 'POST',
      });
      await loadVisitors();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
          Accueil &amp; Suivi des Visiteurs
        </h2>
        <p className="text-sm text-stone-600 dark:text-slate-400">
          Enregistrez les nouveaux venus, assignez un suivi pastoral et intégrez-les comme membres.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {canManage && (
        <form
          onSubmit={handleAddVisitor}
          className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            Enregistrer un nouveau visiteur
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nom complet"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optionnel)"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-stone-900 dark:text-white"
            />
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Origine (ex. Culte, Invitation)"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <input
              type="text"
              value={prayerOrNeed}
              onChange={(e) => setPrayerOrNeed(e.target.value)}
              placeholder="Sujet de prière ou besoin"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ajouter le visiteur
          </button>
        </form>
      )}

      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-200 dark:border-slate-800 text-xs font-medium text-stone-500 dark:text-slate-400">
              <th className="py-3 px-4">Visiteur</th>
              <th className="py-3 px-4">Date &amp; Origine</th>
              <th className="py-3 px-4">Besoin / Prière</th>
              <th className="py-3 px-4">Suivi</th>
              {canManage && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-slate-800 text-sm">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : visitors.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  Aucun visiteur enregistré pour cette église.
                </td>
              </tr>
            ) : (
              visitors.map((v) => (
                <tr key={v.id} className="hover:bg-stone-50 dark:hover:bg-slate-800/50">
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-stone-900 dark:text-white">{v.fullName}</div>
                    <div className="text-xs text-stone-500 dark:text-slate-400">
                      {[v.phone, v.email].filter(Boolean).join(' · ') || 'Sans contact'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-xs font-mono-tabular text-stone-800 dark:text-slate-200">
                      {v.visitDate}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-slate-400">
                      {v.source || '—'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-stone-600 dark:text-slate-300 max-w-xs">
                    {v.prayerOrNeed || '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    {canManage ? (
                      <div className="space-y-1.5">
                        <select
                          value={v.followUpStatus}
                          onChange={(e) =>
                            handleStatusChange(
                              v.id,
                              e.target.value as VisitorItem['followUpStatus']
                            )
                          }
                          className="h-8 px-2 rounded border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-stone-900 dark:text-white"
                        >
                          {Object.entries(VISITOR_STATUS_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={v.assignedLeaderId ? String(v.assignedLeaderId) : ''}
                          onChange={(e) =>
                            handleStatusChange(
                              v.id,
                              v.followUpStatus,
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          className="block h-8 px-2 rounded border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-stone-600 dark:text-slate-300"
                        >
                          <option value="">Responsable non assigné</option>
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-700 dark:text-slate-300">
                        {VISITOR_STATUS_LABELS[v.followUpStatus]}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="py-3.5 px-4 text-right">
                      {canConvert && !v.convertedUserId && (
                        <button
                          type="button"
                          onClick={() => handleConvert(v.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium text-stone-800 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Convertir en membre
                        </button>
                      )}
                      {v.convertedUserId && (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          Intégré
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface InvitationsPanelProps {
  churchId: number;
  departments: DepartmentItem[];
  onRefreshDashboard: () => void;
}

export const InvitationsPanel: React.FC<InvitationsPanelProps> = ({
  churchId,
  departments,
  onRefreshDashboard,
}) => {
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [targetRole, setTargetRole] = useState('member');
  const [departmentId, setDepartmentId] = useState('');
  const [maxUses, setMaxUses] = useState(5);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ invitations: InvitationItem[] }>(
        `/api/churches/${churchId}/invitations`
      );
      setInvitations(res.invitations);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          invitedEmail: invitedEmail.trim() || undefined,
          targetRole,
          departmentId: departmentId ? Number(departmentId) : undefined,
          maxUses,
          expiresInDays,
        }),
      });
      setInvitedEmail('');
      await loadInvites();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/invitations/${id}/revoke`, { method: 'POST' });
      await loadInvites();
      onRefreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Révocation impossible.');
    }
  };

  const copyCode = async (inv: InvitationItem) => {
    try {
      await navigator.clipboard.writeText(inv.code);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
          Invitations des Membres
        </h2>
        <p className="text-sm text-stone-600 dark:text-slate-400">
          Générez des codes d’invitation ciblés par rôle et département, avec suivi d’utilisation.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
          Générer une invitation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="email"
            value={invitedEmail}
            onChange={(e) => setInvitedEmail(e.target.value)}
            placeholder="Email réservé (optionnel)"
            className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
          />
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
          >
            {CHURCH_ROLES.filter((r) => r !== 'super_admin').map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
          >
            <option value="">Département (aucun)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={500}
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            aria-label="Utilisations maximum"
            className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-stone-900 dark:text-white"
          />
          <input
            type="number"
            min={1}
            max={90}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            aria-label="Validité en jours"
            className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-stone-900 dark:text-white"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
          <span>Paramètres par défaut : {maxUses} utilisations max · expire dans {expiresInDays} jours</span>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Créer le code
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-200 dark:border-slate-800 text-xs font-medium text-stone-500 dark:text-slate-400">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Rôle &amp; Département</th>
              <th className="py-3 px-4">Utilisation</th>
              <th className="py-3 px-4">Expiration</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-slate-800 text-sm">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : invitations.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  Aucune invitation générée.
                </td>
              </tr>
            ) : (
              invitations.map((inv) => {
                const expired = new Date(inv.expiresAt) <= new Date();
                const exhausted = inv.usesCount >= inv.maxUses;
                const active = !inv.revokedAt && !expired && !exhausted;
                return (
                  <tr key={inv.id} className="hover:bg-stone-50 dark:hover:bg-slate-800/50">
                    <td className="py-3.5 px-4">
                      <div className="font-mono-tabular font-semibold text-stone-900 dark:text-white">
                        {inv.code}
                      </div>
                      {inv.invitedEmail && (
                        <div className="text-xs text-stone-500 dark:text-slate-400">
                          Réservé à {inv.invitedEmail}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-stone-900 dark:text-slate-100">
                        {ROLE_LABELS[inv.targetRole as keyof typeof ROLE_LABELS] || inv.targetRole}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-slate-400">
                        {inv.departmentName || 'Aucun département'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-stone-700 dark:text-slate-300">
                      {inv.usesCount} / {inv.maxUses}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span
                        className={
                          active
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {inv.revokedAt
                          ? 'Révoquée'
                          : expired
                            ? 'Expirée'
                            : exhausted
                              ? 'Complète'
                              : `Active jusqu’au ${new Date(inv.expiresAt).toLocaleDateString('fr-FR')}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => copyCode(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {copiedId === inv.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedId === inv.id ? 'Copié' : 'Copier'}
                      </button>
                      {active && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
