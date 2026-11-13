import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  HandCoins,
  Loader2,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { apiFetch, getMemoryAuthToken } from '../../lib/api';
import type {
  DonationCampaignItem,
  DonationItem,
  FinancialLedgerItem,
  GatewayStatusItem,
} from '../../types/platform';

interface DonationsPanelProps {
  churchId: number;
  churchName: string;
  canManage: boolean;
}

export const DonationsPanel: React.FC<DonationsPanelProps> = ({
  churchId,
  churchName,
  canManage,
}) => {
  const [subTab, setSubTab] = useState<'donate' | 'history' | 'transparency'>('donate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [currency, setCurrency] = useState('XOF');
  const [gateways, setGateways] = useState<GatewayStatusItem[]>([]);
  const [campaigns, setCampaigns] = useState<DonationCampaignItem[]>([]);
  const [donationsList, setDonationsList] = useState<DonationItem[]>([]);
  const [ledger, setLedger] = useState<FinancialLedgerItem[]>([]);
  const [fundSeparation, setFundSeparation] = useState<{
    church: { credits: number; debits: number; balance: number };
    humanitarian: { credits: number; debits: number; balance: number };
    commercial: { credits: number; debits: number; balance: number };
  }>({
    church: { credits: 0, debits: 0, balance: 0 },
    humanitarian: { credits: 0, debits: 0, balance: 0 },
    commercial: { credits: 0, debits: 0, balance: 0 },
  });

  // Online donation form
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | ''>('');
  const [fundCategory, setFundCategory] = useState<'church' | 'humanitarian'>('church');
  const [amount, setAmount] = useState('5000');
  const [frequency, setFrequency] = useState<'one_time' | 'monthly' | 'weekly'>('one_time');
  const [paymentMethod, setPaymentMethod] = useState('orange_money');
  const [donorPhone, setDonorPhone] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Campaign creation form
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campTitle, setCampTitle] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campGoal, setCampGoal] = useState('1000000');
  const [campFund, setCampFund] = useState<'church' | 'humanitarian'>('church');

  // Cash entry form (canManage)
  const [cashDonorName, setCashDonorName] = useState('');
  const [cashAmount, setCashAmount] = useState('10000');
  const [cashFund, setCashFund] = useState<'church' | 'humanitarian'>('church');
  const [cashCampaignId, setCashCampaignId] = useState<number | ''>('');

  // Expense form (canManage)
  const [expFund, setExpFund] = useState<'church' | 'humanitarian'>('church');
  const [expCategory, setExpCategory] = useState('Aide sociale / Matériel');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');

  const [activeReceipt, setActiveReceipt] = useState<DonationItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        currency: string;
        gateways: GatewayStatusItem[];
        campaigns: DonationCampaignItem[];
        donations: DonationItem[];
        ledger: FinancialLedgerItem[];
        fundSeparation: typeof fundSeparation;
      }>(`/api/churches/${churchId}/donations/overview`);
      setCurrency(res.currency);
      setGateways(res.gateways);
      setCampaigns(res.campaigns);
      setDonationsList(res.donations);
      setLedger(res.ledger);
      setFundSeparation(res.fundSeparation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur chargement finances.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{
        paymentInstructions: { message: string; paymentReference: string };
      }>(`/api/churches/${churchId}/donations`, {
        method: 'POST',
        body: JSON.stringify({
          campaignId: selectedCampaignId || undefined,
          fundCategory,
          amount: Number(amount),
          frequency,
          isAnonymous,
          paymentMethod,
          donorPhone,
        }),
      });
      setNotice(`${res.paymentInstructions.paymentReference} — ${res.paymentInstructions.message}`);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur initiation don.');
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campTitle.trim()) return;
    await apiFetch(`/api/churches/${churchId}/donations/campaigns`, {
      method: 'POST',
      body: JSON.stringify({
        title: campTitle,
        description: campDesc,
        fundCategory: campFund,
        goalAmount: Number(campGoal),
      }),
    });
    setCampTitle('');
    setCampDesc('');
    setShowCampaignForm(false);
    await loadData();
  };

  const handleCashRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    await apiFetch(`/api/churches/${churchId}/donations/cash`, {
      method: 'POST',
      body: JSON.stringify({
        donorName: cashDonorName,
        amount: Number(cashAmount),
        fundCategory: cashFund,
        campaignId: cashCampaignId || undefined,
      }),
    });
    setCashDonorName('');
    setNotice('Don en espèces enregistré et reçu généré dans le grand livre immuable.');
    await loadData();
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || !expAmount) return;
    await apiFetch(`/api/churches/${churchId}/donations/expenses`, {
      method: 'POST',
      body: JSON.stringify({
        fundType: expFund,
        category: expCategory,
        description: expDesc,
        amount: Number(expAmount),
        justificationNote: expNote,
      }),
    });
    setExpDesc('');
    setExpAmount('');
    setExpNote('');
    await loadData();
  };

  const handleDownloadCsv = async () => {
    const token = getMemoryAuthToken();
    const res = await fetch(`/api/churches/${churchId}/donations/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanctuaire-finances-eglise-${churchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (val: number) => `${val.toLocaleString('fr-FR')} ${currency}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-white">
            Dons, Campagnes & Transparence Financière
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Passerelles Côte d’Ivoire (Orange, MTN, Moov, Wave, Carte), espèces trésorerie et séparation stricte des fonds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'donate', label: 'Faire un don & Campagnes' },
            { id: 'history', label: 'Contributions & Reçus' },
            { id: 'transparency', label: 'Transparence & Grand Livre' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                subTab === t.id
                  ? 'bg-slate-900 text-white dark:bg-amber-600'
                  : 'border border-stone-200 dark:border-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-900 dark:text-amber-300">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" />
        </div>
      ) : (
        <>
          {subTab === 'donate' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Donation Form */}
              <div className="lg:col-span-5 space-y-5">
                <form
                  onSubmit={handleDonate}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-5 h-5 text-amber-700" />
                    <h3 className="text-base font-semibold">Contribuer en ligne</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      Campagne (optionnel)
                    </label>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setSelectedCampaignId(val);
                        const camp = campaigns.find((c) => c.id === val);
                        if (camp) setFundCategory(camp.fundCategory);
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    >
                      <option value="">Contribution libre (hors campagne)</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.fundCategory === 'humanitarian' ? 'Humanitaire' : 'Église'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-500 mb-1">Fonds</label>
                      <select
                        value={fundCategory}
                        onChange={(e) => setFundCategory(e.target.value as 'church' | 'humanitarian')}
                        className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                      >
                        <option value="church">Fonds de l’Église</option>
                        <option value="humanitarian">Fonds Humanitaires</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-500 mb-1">
                        Fréquence
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                        className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                      >
                        <option value="one_time">Don ponctuel</option>
                        <option value="monthly">Récurrent mensuel</option>
                        <option value="weekly">Récurrent hebdomadaire</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      Montant libre ({currency})
                    </label>
                    <input
                      type="number"
                      min={100}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      Passerelle de paiement
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    >
                      {gateways
                        .filter((g) => g.provider !== 'cash')
                        .map((g) => (
                          <option key={g.provider} value={g.provider}>
                            {g.label} — {g.mode === 'live' ? 'Mode Live' : 'Mode Sandbox'}
                          </option>
                        ))}
                    </select>
                  </div>

                  <input
                    type="tel"
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    placeholder="Numéro Mobile Money (ex: +225 07...)"
                    className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  />

                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                    />
                    Don anonyme (votre nom reste masqué publiquement)
                  </label>

                  <button
                    type="submit"
                    className="w-full h-11 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    Initialiser la contribution sécurisée
                  </button>
                  <p className="text-[11px] text-stone-500">
                    Aucune transaction en ligne n’est marquée confirmée sans validation webhook HMAC signée côté serveur.
                  </p>
                </form>

                {canManage && (
                  <form
                    onSubmit={handleCashRecord}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                  >
                    <h3 className="text-sm font-semibold">
                      Enregistrement Espèces (Trésorerie autorisée)
                    </h3>
                    <input
                      type="text"
                      value={cashDonorName}
                      onChange={(e) => setCashDonorName(e.target.value)}
                      placeholder="Nom complet du donateur"
                      required
                      className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={100}
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        required
                        className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                      />
                      <select
                        value={cashFund}
                        onChange={(e) => setCashFund(e.target.value as 'church' | 'humanitarian')}
                        className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                      >
                        <option value="church">Fonds Église</option>
                        <option value="humanitarian">Fonds Humanitaire</option>
                      </select>
                    </div>
                    <select
                      value={cashCampaignId}
                      onChange={(e) => setCashCampaignId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    >
                      <option value="">Hors campagne spécifique</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="w-full h-9 rounded-lg border border-slate-900 dark:border-amber-600 text-xs font-semibold cursor-pointer"
                    >
                      Valider l’encaissement espèces
                    </button>
                  </form>
                )}
              </div>

              {/* Campaigns */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Campagnes de financement actives</h3>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setShowCampaignForm((v) => !v)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nouvelle campagne
                    </button>
                  )}
                </div>

                {showCampaignForm && canManage && (
                  <form
                    onSubmit={handleCreateCampaign}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                  >
                    <input
                      type="text"
                      value={campTitle}
                      onChange={(e) => setCampTitle(e.target.value)}
                      placeholder="Titre de la campagne"
                      required
                      className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={campGoal}
                        onChange={(e) => setCampGoal(e.target.value)}
                        placeholder="Objectif"
                        required
                        className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                      />
                      <select
                        value={campFund}
                        onChange={(e) => setCampFund(e.target.value as 'church' | 'humanitarian')}
                        className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                      >
                        <option value="church">Fonds Église</option>
                        <option value="humanitarian">Fonds Humanitaire</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      value={campDesc}
                      onChange={(e) => setCampDesc(e.target.value)}
                      placeholder="Description et affectation des dons..."
                      className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                    >
                      Créer la campagne
                    </button>
                  </form>
                )}

                <div className="space-y-4">
                  {campaigns.map((camp) => {
                    const pct = Math.min(
                      100,
                      Math.round((camp.collectedAmount / Math.max(1, camp.goalAmount)) * 100)
                    );
                    return (
                      <div
                        key={camp.id}
                        className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">
                              {camp.fundCategory === 'humanitarian'
                                ? 'FONDS HUMANITAIRE'
                                : 'FONDS ÉGLISE'}
                            </span>
                            <h4 className="font-display text-xl font-semibold">{camp.title}</h4>
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold">{pct}%</span>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-slate-400">{camp.description}</p>
                        <div className="h-2 rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-amber-600" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs font-mono-tabular">
                          <span>Collecté : {fmt(camp.collectedAmount)}</span>
                          <span>Objectif : {fmt(camp.goalAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {subTab === 'history' && (
            <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <h3 className="text-base font-semibold">Historique des contributions & Reçus</h3>
              {donationsList.length === 0 ? (
                <p className="text-sm text-stone-500">Aucune contribution enregistrée.</p>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-slate-800">
                  {donationsList.map((d) => (
                    <div key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-semibold text-sm">
                          {d.donorName} · {fmt(d.amount)}
                        </p>
                        <p className="text-stone-500 font-mono-tabular">
                          {d.paymentReference} · {d.paymentMethod} ({d.gatewayMode}) · {d.fundCategory}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            d.status === 'confirmed'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {d.status === 'confirmed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {d.status === 'confirmed' ? 'Confirmé' : 'En attente webhook'}
                        </span>
                        {d.receipt && (
                          <button
                            type="button"
                            onClick={() => setActiveReceipt(d)}
                            className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 inline-flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            Reçu {d.receipt.receiptNumber}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === 'transparency' && (
            <div className="space-y-6">
              {/* Strict Fund Separation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'Fonds de l’Église', data: fundSeparation.church },
                  { title: 'Fonds Humanitaires', data: fundSeparation.humanitarian },
                  { title: 'Fonds Commerciaux / Boutique', data: fundSeparation.commercial },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-stone-500">{f.title}</p>
                      <Wallet className="w-4 h-4 text-amber-700" />
                    </div>
                    <p className="text-2xl font-semibold font-mono-tabular">{fmt(f.data.balance)}</p>
                    <p className="text-[11px] font-mono-tabular text-stone-500">
                      Entrées : {fmt(f.data.credits)} · Sorties : {fmt(f.data.debits)}
                    </p>
                  </div>
                ))}
              </div>

              {canManage && (
                <form
                  onSubmit={handleRecordExpense}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <h3 className="text-sm font-semibold">
                    Enregistrer une dépense justifiée (écriture append-only)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <select
                      value={expFund}
                      onChange={(e) => setExpFund(e.target.value as 'church' | 'humanitarian')}
                      className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    >
                      <option value="church">Fonds Église</option>
                      <option value="humanitarian">Fonds Humanitaire</option>
                    </select>
                    <input
                      type="text"
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      placeholder="Catégorie"
                      className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="Montant"
                      required
                      className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                    />
                    <input
                      type="text"
                      value={expNote}
                      onChange={(e) => setExpNote(e.target.value)}
                      placeholder="N° facture / justificatif"
                      className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={expDesc}
                      onChange={(e) => setExpDesc(e.target.value)}
                      placeholder="Libellé précis de la dépense"
                      required
                      className="flex-1 h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 h-9 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                    >
                      Inscrire au grand livre
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                    <h3 className="text-base font-semibold">
                      Grand Livre Financier Inaltérable (Chaînage SHA-256)
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadCsv}
                      className="px-3.5 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Excel / CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimer / PDF
                    </button>
                  </div>
                </div>

                {ledger.length === 0 ? (
                  <p className="text-sm text-stone-500">Aucune écriture financière enregistrée.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-stone-200 dark:border-slate-800 text-stone-500">
                        <tr>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Fonds</th>
                          <th className="py-2 pr-3">Catégorie & Description</th>
                          <th className="py-2 pr-3">Montant</th>
                          <th className="py-2">Empreinte SHA-256</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                        {ledger.map((row) => (
                          <tr key={row.id}>
                            <td className="py-2.5 pr-3 font-mono-tabular whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="py-2.5 pr-3 uppercase font-semibold">{row.fundType}</td>
                            <td className="py-2.5 pr-3">
                              <p className="font-semibold">{row.category}</p>
                              <p className="text-stone-500">{row.description}</p>
                            </td>
                            <td
                              className={`py-2.5 pr-3 font-mono-tabular font-semibold whitespace-nowrap ${
                                row.entryType === 'credit'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-600'
                              }`}
                            >
                              {row.entryType === 'credit' ? '+' : '-'}
                              {fmt(row.amount)}
                            </td>
                            <td className="py-2.5 font-mono-tabular text-[11px] text-stone-400">
                              {row.entryHash.slice(0, 14)}...
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeReceipt && activeReceipt.receipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
              <FileText className="w-5 h-5" />
              <h3 className="font-semibold text-base">Reçu Numérique Officiel</h3>
            </div>
            <div className="text-xs space-y-2 border-y border-stone-200 dark:border-slate-800 py-4">
              <p>
                <strong>Église :</strong> {churchName}
              </p>
              <p>
                <strong>N° Reçu :</strong> {activeReceipt.receipt.receiptNumber}
              </p>
              <p>
                <strong>Donateur :</strong> {activeReceipt.donorName}
              </p>
              <p>
                <strong>Montant :</strong> {fmt(activeReceipt.amount)}
              </p>
              <p>
                <strong>Moyen :</strong> {activeReceipt.paymentMethod} ({activeReceipt.paymentReference})
              </p>
              <p className="font-mono-tabular text-[11px] text-stone-500">
                Empreinte : {activeReceipt.receipt.verificationHash}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-10 rounded-lg border border-stone-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Imprimer PDF
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="flex-1 h-10 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
