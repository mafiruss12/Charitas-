import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Check, Loader2, ShieldAlert, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type {
  EnabledModulesConfig,
  SuperAdminChurchSummary,
  SuperAdminOverviewResponse,
} from '../../types/platform';

interface SuperAdminPanelProps {
  onRefreshWorkspace: () => Promise<void>;
}

const MODULE_LABELS: { key: keyof EnabledModulesConfig; label: string }[] = [
  { key: 'social', label: 'Social' },
  { key: 'messaging', label: 'Chat' },
  { key: 'spiritual', label: 'Spirituel' },
  { key: 'donations', label: 'Dons' },
  { key: 'humanitarian', label: 'Humanitaire' },
  { key: 'marketplace', label: 'Boutique' },
  { key: 'auctions', label: 'Enchères' },
  { key: 'academy', label: 'Académie' },
];

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ onRefreshWorkspace }) => {
  const [data, setData] = useState<SuperAdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SuperAdminOverviewResponse>('/api/superadmin/overview');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur chargement console centrale.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const updateChurchGovernance = async (
    church: SuperAdminChurchSummary,
    patch: {
      status?: 'active' | 'suspended';
      enabledModules?: EnabledModulesConfig;
      planName?: string;
    }
  ) => {
    setSavingId(church.id);
    setError(null);
    try {
      await apiFetch(`/api/superadmin/churches/${church.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await loadOverview();
      await onRefreshWorkspace();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour église.');
    } finally {
      setSavingId(null);
    }
  };

  const resolveGlobalReport = async (reportId: number, decision: 'dismissed' | 'action_taken') => {
    setError(null);
    try {
      await apiFetch(`/api/superadmin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur traitement signalement.');
    }
  };

  if (loading && !data) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
          Administration Centrale Multi-Églises
        </h2>
        <p className="text-sm text-stone-500 dark:text-slate-400">
          Supervision globale des tenants, activation des modules, plans SaaS et modération réseau.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-stone-500">Églises hébergées</p>
              <p className="mt-1.5 text-2xl font-mono-tabular font-bold">
                {data.stats.totalChurches}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {data.stats.activeChurches} actives · {data.stats.suspendedChurches} suspendues
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-stone-500">Comptes utilisateurs</p>
              <p className="mt-1.5 text-2xl font-mono-tabular font-bold">
                {data.stats.totalUsers}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">Fédérés Firebase & PostgreSQL</p>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-stone-500">Dons confirmés globaux</p>
              <p className="mt-1.5 text-2xl font-mono-tabular font-bold">
                {data.stats.totalConfirmedDonationsAmount.toLocaleString('fr-FR')}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">Toutes devises consolidées</p>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-stone-500">Modération globale</p>
              <p className="mt-1.5 text-2xl font-mono-tabular font-bold">
                {data.stats.pendingModerationReports}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {data.stats.activeAuctionsCount} enchères en cours
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-700" />
              Gouvernance des églises & Modules ({data.churches.length})
            </h3>
            <div className="divide-y divide-stone-100 dark:divide-slate-800">
              {data.churches.map((ch) => (
                <div key={ch.id} className="py-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900 dark:text-white">
                        {ch.name}{' '}
                        <span className="font-mono-tabular text-xs font-normal text-stone-500">
                          (#{ch.id} · {ch.slug})
                        </span>
                      </p>
                      <p className="text-xs text-stone-500 dark:text-slate-400">
                        {ch.city || ch.country} · {ch.membersCount} membres actifs ·{' '}
                        {ch.confirmedDonationsAmount.toLocaleString('fr-FR')} {ch.currency} collectés
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={ch.subscription.planName}
                        disabled={savingId === ch.id}
                        onChange={(e) =>
                          updateChurchGovernance(ch, { planName: e.target.value })
                        }
                        className="h-8 px-2.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                      >
                        <option value="essential">Plan Essentiel</option>
                        <option value="growth">Plan Croissance</option>
                        <option value="network">Plan Réseau</option>
                      </select>
                      <button
                        type="button"
                        disabled={savingId === ch.id}
                        onClick={() =>
                          updateChurchGovernance(ch, {
                            status: ch.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                          ch.status === 'active'
                            ? 'border-red-300 text-red-700 dark:text-red-400'
                            : 'bg-emerald-700 text-white border-emerald-700'
                        }`}
                      >
                        {ch.status === 'active' ? 'Suspendre' : 'Réactiver'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {MODULE_LABELS.map((m) => {
                      const enabled = ch.enabledModules[m.key];
                      return (
                        <button
                          key={m.key}
                          type="button"
                          disabled={savingId === ch.id}
                          onClick={() =>
                            updateChurchGovernance(ch, {
                              enabledModules: {
                                ...ch.enabledModules,
                                [m.key]: !enabled,
                              },
                            })
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer ${
                            enabled
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-700 dark:border-amber-700'
                              : 'border-stone-200 dark:border-slate-700 text-stone-400'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              Signalements inter-églises ({data.globalReports.length})
            </h3>
            {data.globalReports.length === 0 ? (
              <p className="text-xs text-stone-500">Aucun signalement enregistré sur la plateforme.</p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-slate-800">
                {data.globalReports.map((r) => (
                  <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold">
                        {r.churchName} · {r.targetType} #{r.targetId}
                      </p>
                      <p className="text-stone-500">
                        Motif : {r.reason} (par {r.reporterName}) · Statut : {r.status}
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => resolveGlobalReport(r.id, 'action_taken')}
                          className="px-2.5 py-1 rounded bg-red-700 text-white inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Masquer
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveGlobalReport(r.id, 'dismissed')}
                          className="px-2.5 py-1 rounded border border-stone-200 dark:border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Classer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
