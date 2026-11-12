import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Moon, Plus, Save, Sun, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import type {
  AuditLogItem,
  ChurchDetail,
  ServiceScheduleItem,
} from '../../types/platform';
import { ResilientImage } from '../ResilientImage';

interface RolesPermissionsPanelProps {
  churchId: number;
  canConfigure: boolean;
}

export const RolesPermissionsPanel: React.FC<RolesPermissionsPanelProps> = ({
  churchId,
  canConfigure,
}) => {
  const [roles, setRoles] = useState<{ role: string; label: string; permissions: string[] }[]>([]);
  const [catalog, setCatalog] = useState<{ key: string; label: string }[]>([]);
  const [selectedRole, setSelectedRole] = useState('church_admin');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        roles: { role: string; label: string; permissions: string[] }[];
        permissionsCatalog: { key: string; label: string }[];
      }>(`/api/churches/${churchId}/roles`);
      setRoles(res.roles);
      setCatalog(res.permissionsCatalog);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const currentRoleObj = roles.find((r) => r.role === selectedRole);

  const togglePermission = (permKey: string) => {
    if (!canConfigure || selectedRole === 'super_admin') return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.role !== selectedRole) return r;
        const exists = r.permissions.includes(permKey);
        return {
          ...r,
          permissions: exists
            ? r.permissions.filter((p) => p !== permKey)
            : [...r.permissions, permKey],
        };
      })
    );
  };

  const handleSaveRole = async () => {
    if (!currentRoleObj || !canConfigure) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/churches/${churchId}/roles/${selectedRole}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: currentRoleObj.permissions }),
      });
      setMessage(`Permissions du rôle « ${currentRoleObj.label} » enregistrées.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sauvegarde impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
          Rôles &amp; Permissions Granulaires
        </h2>
        <p className="text-sm text-stone-600 dark:text-slate-400">
          Configurez finement les droits d’accès des 11 rôles pour cette église.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-stone-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-1.5">
            {roles.map((r) => (
              <button
                key={r.role}
                type="button"
                onClick={() => {
                  setMessage(null);
                  setSelectedRole(r.role);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                  selectedRole === r.role
                    ? 'border-stone-900 dark:border-amber-500 bg-white dark:bg-slate-900 font-semibold text-stone-900 dark:text-white'
                    : 'border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 text-stone-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <span className="truncate">{r.label}</span>
                <span className="font-mono-tabular text-xs text-stone-500 dark:text-slate-400 shrink-0">
                  {r.permissions.length}
                </span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            {currentRoleObj && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                      {currentRoleObj.label}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-slate-400 font-mono-tabular">
                      Identifiant : {currentRoleObj.role}
                    </p>
                  </div>
                  {canConfigure && selectedRole !== 'super_admin' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveRole}
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Enregistrer ce rôle
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {catalog.map((perm) => {
                    const checked = currentRoleObj.permissions.includes(perm.key);
                    const disabled = !canConfigure || selectedRole === 'super_admin';
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-3 p-3 rounded-lg border border-stone-200 dark:border-slate-800 text-xs ${
                          disabled ? 'opacity-75' : 'cursor-pointer hover:bg-stone-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => togglePermission(perm.key)}
                          className="mt-0.5 w-4 h-4 rounded border-stone-300"
                        />
                        <div>
                          <div className="font-medium text-stone-900 dark:text-white">
                            {perm.label}
                          </div>
                          <div className="font-mono-tabular text-[11px] text-stone-400 dark:text-slate-500 mt-0.5">
                            {perm.key}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface BrandingSettingsPanelProps {
  church: ChurchDetail;
  canManageSettings: boolean;
  onSaved: () => Promise<void>;
}

export const BrandingSettingsPanel: React.FC<BrandingSettingsPanelProps> = ({
  church,
  canManageSettings,
  onSaved,
}) => {
  const [name, setName] = useState(church.name);
  const [tagline, setTagline] = useState(church.tagline || '');
  const [description, setDescription] = useState(church.description || '');
  const [city, setCity] = useState(church.city || '');
  const [address, setAddress] = useState(church.address || '');
  const [phone, setPhone] = useState(church.phone || '');
  const [email, setEmail] = useState(church.email || '');
  const [primaryColor, setPrimaryColor] = useState(church.primaryColor);
  const [accentColor, setAccentColor] = useState(church.accentColor);
  const [logoUrl, setLogoUrl] = useState(church.logoUrl || '');
  const [bannerUrl, setBannerUrl] = useState(church.bannerUrl || '');
  const [currency, setCurrency] = useState(church.currency);
  const [isPublic, setIsPublic] = useState(church.isPublic);
  const [schedule, setSchedule] = useState<ServiceScheduleItem[]>(church.serviceSchedule || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(church.name);
    setTagline(church.tagline || '');
    setDescription(church.description || '');
    setCity(church.city || '');
    setAddress(church.address || '');
    setPhone(church.phone || '');
    setEmail(church.email || '');
    setPrimaryColor(church.primaryColor);
    setAccentColor(church.accentColor);
    setLogoUrl(church.logoUrl || '');
    setBannerUrl(church.bannerUrl || '');
    setCurrency(church.currency);
    setIsPublic(church.isPublic);
    setSchedule(church.serviceSchedule || []);
  }, [church]);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image trop volumineuse (max. 2 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/churches/${church.id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          tagline,
          description,
          city,
          address,
          phone,
          email,
          primaryColor,
          accentColor,
          logoUrl,
          bannerUrl,
          currency,
          isPublic,
          serviceSchedule: schedule,
        }),
      });
      await onSaved();
      setMessage('Identité visuelle et paramètres enregistrés.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
            Identité Visuelle &amp; Paramètres
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Personnalisez le nom, le logo, les couleurs, la visibilité et les horaires de votre église.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer self-start"
          style={{ backgroundColor: primaryColor }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
          Charte graphique &amp; médias
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 shrink-0">
              <ResilientImage src={logoUrl} alt="Logo église" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
                Logo de l’église (image max 2 Mo)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setLogoUrl)}
                className="text-xs text-stone-600 dark:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Couleur principale
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 rounded border border-stone-300 dark:border-slate-700 cursor-pointer"
                />
                <span className="font-mono-tabular text-xs">{primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Couleur d’accent
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-12 rounded border border-stone-300 dark:border-slate-700 cursor-pointer"
                />
                <span className="font-mono-tabular text-xs">{accentColor}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Nom de l’église
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Slogan
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Présentation
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {canManageSettings && (
        <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            Coordonnées, devise et cultes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ville"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Adresse"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            >
              <option value="XOF">XOF (FCFA)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
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
              placeholder="Email officiel"
              className="h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
            <label className="flex items-center gap-2.5 text-sm text-stone-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Visible dans l’annuaire public
            </label>
          </div>

          <div className="pt-4 border-t border-stone-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                Horaires des cultes et réunions
              </span>
              <button
                type="button"
                onClick={() =>
                  setSchedule((prev) => [
                    ...prev,
                    { day: 'Dimanche', time: '10:00', title: 'Culte', location: 'Sanctuaire' },
                  ])
                }
                className="text-xs font-medium text-amber-800 dark:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter un horaire
              </button>
            </div>
            {schedule.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={item.day}
                  onChange={(e) =>
                    setSchedule((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, day: e.target.value } : s))
                    )
                  }
                  placeholder="Jour"
                  className="sm:col-span-2 h-10 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <input
                  type="text"
                  value={item.time}
                  onChange={(e) =>
                    setSchedule((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, time: e.target.value } : s))
                    )
                  }
                  placeholder="Heure"
                  className="sm:col-span-2 h-10 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono-tabular"
                />
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) =>
                    setSchedule((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s))
                    )
                  }
                  placeholder="Titre"
                  className="sm:col-span-4 h-10 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <input
                  type="text"
                  value={item.location || ''}
                  onChange={(e) =>
                    setSchedule((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, location: e.target.value } : s))
                    )
                  }
                  placeholder="Lieu"
                  className="sm:col-span-3 h-10 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setSchedule((prev) => prev.filter((_, i) => i !== idx))}
                  className="sm:col-span-1 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
};

export const AuditLogsPanel: React.FC<{ churchId: number }> = ({ churchId }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const qs = actionFilter.trim() ? `?action=${encodeURIComponent(actionFilter.trim())}` : '';
      const res = await apiFetch<{ logs: AuditLogItem[] }>(
        `/api/churches/${churchId}/audit-logs${qs}`
      );
      setLogs(res.logs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement du journal d'audit.");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, churchId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
            Journal d’Audit Administratif
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Historique immuable et horodaté des actions sensibles dans cette église.
          </p>
        </div>
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filtrer par action (ex. MEMBER)"
          className="h-10 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-stone-900 dark:text-white"
        />
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
              <th className="py-3 px-4">Horodatage</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Acteur</th>
              <th className="py-3 px-4">Cible</th>
              <th className="py-3 px-4">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-slate-800 text-xs">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-stone-500" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  Aucune entrée dans le journal.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono-tabular text-stone-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 font-mono-tabular font-semibold text-stone-900 dark:text-white">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-stone-700 dark:text-slate-300">
                    {log.actorEmail || `User #${log.actorUserId ?? 'système'}`}
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-stone-600 dark:text-slate-400">
                    {log.entityType}
                    {log.entityId ? ` #${log.entityId}` : ''}
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-stone-500 dark:text-slate-400 max-w-xs truncate">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ProfilePanel: React.FC = () => {
  const { user, theme, setTheme, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || "Côte d'Ivoire");
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, phone, city, country, bio }),
      });
      await refreshProfile();
      setMessage('Profil personnel mis à jour.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white">
          Mon Profil Personnel
        </h2>
        <p className="text-sm text-stone-600 dark:text-slate-400">
          Informations personnelles et préférences d’affichage.
        </p>
      </div>

      {message && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Nom complet
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full h-11 px-3.5 rounded-lg border border-stone-200 dark:border-slate-800 bg-stone-100 dark:bg-slate-950 text-sm text-stone-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Ville
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
            Pays
          </label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
            Présentation / Témoignage personnel
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
          />
        </div>

        <div className="pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium text-stone-700 dark:text-slate-200 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Sauvegarder
          </button>
        </div>
      </form>
    </div>
  );
};
