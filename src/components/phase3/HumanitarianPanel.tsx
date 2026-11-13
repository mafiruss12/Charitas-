import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  HeartHandshake,
  Loader2,
  Lock,
  PackageCheck,
  Plus,
  Users,
} from 'lucide-react';
import solidarityBanner from '../../assets/images/charitas_food_solidarity_1794525620555.jpg';
import { apiFetch } from '../../lib/api';
import type {
  AidDistributionItem,
  AidRequestItem,
  BeneficiaryItem,
  ChurchMemberItem,
  InterventionReportItem,
} from '../../types/platform';
import { ResilientImage } from '../ResilientImage';

interface HumanitarianPanelProps {
  churchId: number;
  canManage: boolean;
}

export const HumanitarianPanel: React.FC<HumanitarianPanelProps> = ({ churchId, canManage }) => {
  const [subTab, setSubTab] = useState<
    'public' | 'beneficiaries' | 'requests' | 'distributions' | 'volunteers'
  >('public');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    beneficiariesCount: 0,
    openRequestsCount: 0,
    distributionsCount: 0,
  });
  const [reports, setReports] = useState<InterventionReportItem[]>([]);
  const [volunteers, setVolunteers] = useState<
    {
      id: number;
      userId: number;
      volunteerName: string;
      missionTitle: string;
      roleDescription: string | null;
      scheduledDate: string;
      status: string;
    }[]
  >([]);

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryItem[]>([]);
  const [aidRequests, setAidRequests] = useState<AidRequestItem[]>([]);
  const [distributions, setDistributions] = useState<AidDistributionItem[]>([]);
  const [members, setMembers] = useState<ChurchMemberItem[]>([]);

  // Beneficiary form
  const [bName, setBName] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bAddress, setBAddress] = useState('');
  const [bHousehold, setBHousehold] = useState('3');
  const [bLevel, setBLevel] = useState<'standard' | 'high' | 'critical'>('high');
  const [bNotes, setBNotes] = useState('');

  // Aid request form
  const [reqBenId, setReqBenId] = useState<number | ''>('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqCat, setReqCat] = useState('alimentaire');
  const [reqNeeds, setReqNeeds] = useState('');
  const [reqAmount, setReqAmount] = useState('50000');
  const [reqPriority, setReqPriority] = useState('80');

  // Distribution form
  const [distBenId, setDistBenId] = useState<number | ''>('');
  const [distReqId, setDistReqId] = useState<number | ''>('');
  const [distItems, setDistItems] = useState('');
  const [distSpent, setDistSpent] = useState('45000');
  const [distProof, setDistProof] = useState('');

  // Report form
  const [repTitle, setRepTitle] = useState('');
  const [repSummary, setRepSummary] = useState('');
  const [repHelped, setRepHelped] = useState('25');
  const [repSpent, setRepSpent] = useState('350000');

  // Volunteer assignment form
  const [volUserId, setVolUserId] = useState<number | ''>('');
  const [volMission, setVolMission] = useState('');
  const [volDate, setVolDate] = useState('2026-11-20');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ov = await apiFetch<{
        stats: typeof stats;
        reports: InterventionReportItem[];
        volunteers: typeof volunteers;
      }>(`/api/churches/${churchId}/humanitarian/overview`);
      setStats(ov.stats);
      setReports(ov.reports);
      setVolunteers(ov.volunteers);

      if (canManage) {
        const [benRes, reqRes, distRes, memRes] = await Promise.all([
          apiFetch<{ beneficiaries: BeneficiaryItem[] }>(
            `/api/churches/${churchId}/humanitarian/beneficiaries`
          ),
          apiFetch<{ aidRequests: AidRequestItem[] }>(
            `/api/churches/${churchId}/humanitarian/aid-requests`
          ),
          apiFetch<{ distributions: AidDistributionItem[] }>(
            `/api/churches/${churchId}/humanitarian/distributions`
          ),
          apiFetch<{ members: ChurchMemberItem[] }>(`/api/churches/${churchId}/members`),
        ]);
        setBeneficiaries(benRes.beneficiaries);
        setAidRequests(reqRes.aidRequests);
        setDistributions(distRes.distributions);
        setMembers(memRes.members);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur module humanitaire.');
    } finally {
      setLoading(false);
    }
  }, [churchId, canManage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim()) return;
    await apiFetch(`/api/churches/${churchId}/humanitarian/beneficiaries`, {
      method: 'POST',
      body: JSON.stringify({
        fullName: bName,
        phone: bPhone,
        address: bAddress,
        householdSize: Number(bHousehold),
        vulnerabilityLevel: bLevel,
        confidentialNotes: bNotes,
      }),
    });
    setBName('');
    setBPhone('');
    setBAddress('');
    setBNotes('');
    await loadData();
  };

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqBenId || !reqTitle.trim() || !reqNeeds.trim()) return;
    await apiFetch(`/api/churches/${churchId}/humanitarian/aid-requests`, {
      method: 'POST',
      body: JSON.stringify({
        beneficiaryId: Number(reqBenId),
        title: reqTitle,
        category: reqCat,
        needsAssessment: reqNeeds,
        requestedAmount: Number(reqAmount),
        priorityScore: Number(reqPriority),
      }),
    });
    setReqTitle('');
    setReqNeeds('');
    await loadData();
  };

  const handleApproveRequest = async (req: AidRequestItem, status: 'approved' | 'rejected') => {
    await apiFetch(`/api/churches/${churchId}/humanitarian/aid-requests/${req.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        allocatedAmount: status === 'approved' ? req.requestedAmount : 0,
      }),
    });
    await loadData();
  };

  const handleAddDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distBenId || !distItems.trim()) return;
    await apiFetch(`/api/churches/${churchId}/humanitarian/distributions`, {
      method: 'POST',
      body: JSON.stringify({
        beneficiaryId: Number(distBenId),
        aidRequestId: distReqId || undefined,
        itemsSummary: distItems,
        amountSpent: Number(distSpent),
        proofNotes: distProof,
      }),
    });
    setDistItems('');
    setDistProof('');
    await loadData();
  };

  const handlePublishReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repTitle.trim() || !repSummary.trim()) return;
    await apiFetch(`/api/churches/${churchId}/humanitarian/reports`, {
      method: 'POST',
      body: JSON.stringify({
        title: repTitle,
        summary: repSummary,
        beneficiariesHelpedCount: Number(repHelped),
        totalAmountSpent: Number(repSpent),
      }),
    });
    setRepTitle('');
    setRepSummary('');
    await loadData();
  };

  const handleAssignVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volUserId || !volMission.trim()) return;
    await apiFetch(`/api/churches/${churchId}/humanitarian/volunteers`, {
      method: 'POST',
      body: JSON.stringify({
        userId: Number(volUserId),
        missionTitle: volMission,
        scheduledDate: volDate,
      }),
    });
    setVolMission('');
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-white">
            Œuvres Humanitaires & Diaconie
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Rapports d’impact transparents et gestion confidentielle des dossiers bénéficiaires.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'public', label: 'Impact & Rapports' },
            ...(canManage
              ? [
                  { id: 'beneficiaries', label: 'Bénéficiaires (Confidentiel)' },
                  { id: 'requests', label: 'Demandes & Priorisation' },
                  { id: 'distributions', label: 'Distributions & Preuves' },
                  { id: 'volunteers', label: 'Bénévoles' },
                ]
              : []),
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
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
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" />
        </div>
      ) : (
        <>
          {subTab === 'public' && (
            <div className="space-y-6">
              <div className="rounded-2xl overflow-hidden border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-5 h-56 lg:h-auto">
                  <ResilientImage
                    src={solidarityBanner}
                    alt="Solidarité humanitaire"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="lg:col-span-7 p-6 space-y-4">
                  <h3 className="font-display text-2xl font-semibold">
                    Transparence & Protection de la Dignité
                  </h3>
                  <p className="text-sm text-stone-600 dark:text-slate-300">
                    Les données personnelles des bénéficiaires restent strictement réservées aux
                    responsables humanitaires habilités. Les bilans chiffrés ci-dessous rendent compte
                    publiquement des actions réalisées.
                  </p>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-950">
                      <p className="text-[11px] text-stone-500">Foyers suivis</p>
                      <p className="text-xl font-semibold font-mono-tabular">
                        {stats.beneficiariesCount}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-950">
                      <p className="text-[11px] text-stone-500">Demandes actives</p>
                      <p className="text-xl font-semibold font-mono-tabular">
                        {stats.openRequestsCount}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-950">
                      <p className="text-[11px] text-stone-500">Distributions</p>
                      <p className="text-xl font-semibold font-mono-tabular">
                        {stats.distributionsCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {canManage && (
                <form
                  onSubmit={handlePublishReport}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <h3 className="text-sm font-semibold">Publier un rapport d’intervention</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={repTitle}
                      onChange={(e) => setRepTitle(e.target.value)}
                      placeholder="Titre du bilan"
                      required
                      className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <input
                      type="number"
                      value={repHelped}
                      onChange={(e) => setRepHelped(e.target.value)}
                      placeholder="Familles aidées"
                      className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                    />
                    <input
                      type="number"
                      value={repSpent}
                      onChange={(e) => setRepSpent(e.target.value)}
                      placeholder="Montant engagé"
                      className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={repSummary}
                    onChange={(e) => setRepSummary(e.target.value)}
                    placeholder="Résumé anonymisé des réalisations sur le terrain..."
                    required
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    Publier le rapport
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                  >
                    <div className="flex justify-between text-xs text-stone-400 font-mono-tabular">
                      <span>RAPPORT D’INTERVENTION</span>
                      <span>{r.publishedDate}</span>
                    </div>
                    <h4 className="font-display text-xl font-semibold">{r.title}</h4>
                    <p className="text-sm text-stone-600 dark:text-slate-300">{r.summary}</p>
                    <p className="text-xs font-mono-tabular font-semibold text-amber-800 dark:text-amber-400">
                      {r.beneficiariesHelpedCount} foyers accompagnés ·{' '}
                      {r.totalAmountSpent.toLocaleString('fr-FR')} XOF mobilisés
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'beneficiaries' && canManage && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAddBeneficiary}
                className="lg:col-span-5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Lock className="w-4 h-4" />
                  Dossiers strictement confidentiels (humanitarian.manage)
                </div>
                <input
                  type="text"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  placeholder="Nom complet du chef de foyer"
                  required
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                    placeholder="Téléphone"
                    className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  />
                  <select
                    value={bLevel}
                    onChange={(e) => setBLevel(e.target.value as typeof bLevel)}
                    className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  >
                    <option value="standard">Priorité standard</option>
                    <option value="high">Vulnérabilité élevée</option>
                    <option value="critical">Urgence critique</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={bAddress}
                    onChange={(e) => setBAddress(e.target.value)}
                    placeholder="Quartier / Adresse"
                    className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={bHousehold}
                    onChange={(e) => setBHousehold(e.target.value)}
                    placeholder="Taille foyer"
                    className="h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  />
                </div>
                <textarea
                  rows={3}
                  value={bNotes}
                  onChange={(e) => setBNotes(e.target.value)}
                  placeholder="Notes sociales confidentielles..."
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                >
                  Enregistrer le dossier bénéficiaire
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {beneficiaries.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{b.fullName}</span>
                      <span className="uppercase font-semibold text-amber-700">
                        {b.vulnerabilityLevel}
                      </span>
                    </div>
                    <p className="text-stone-500">
                      Foyer : {b.householdSize} pers. · {b.phone || 'Sans tél'} · {b.address || 'Adresse non renseignée'}
                    </p>
                    {b.confidentialNotes && (
                      <p className="text-stone-700 dark:text-slate-300">{b.confidentialNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'requests' && canManage && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAddRequest}
                className="lg:col-span-5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <h3 className="text-sm font-semibold">Nouvelle demande d’aide & évaluation</h3>
                <select
                  value={reqBenId}
                  onChange={(e) => setReqBenId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                >
                  <option value="">Sélectionnez un bénéficiaire</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="Objet de la demande (ex: Kits scolaires)"
                  required
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={reqCat}
                    onChange={(e) => setReqCat(e.target.value)}
                    className="h-9 px-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  >
                    <option value="alimentaire">Alimentaire</option>
                    <option value="sante">Santé</option>
                    <option value="education">Éducation</option>
                    <option value="logement">Logement</option>
                    <option value="urgence">Urgence</option>
                  </select>
                  <input
                    type="number"
                    value={reqAmount}
                    onChange={(e) => setReqAmount(e.target.value)}
                    placeholder="Budget"
                    className="h-9 px-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={reqPriority}
                    onChange={(e) => setReqPriority(e.target.value)}
                    placeholder="Priorité 1-100"
                    className="h-9 px-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                  />
                </div>
                <textarea
                  rows={3}
                  value={reqNeeds}
                  onChange={(e) => setReqNeeds(e.target.value)}
                  placeholder="Évaluation détaillée des besoins..."
                  required
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                >
                  Soumettre la demande
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {aidRequests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {r.title} — {r.beneficiaryName}
                      </span>
                      <span className="font-mono-tabular font-semibold">
                        Priorité {r.priorityScore}/100 · {r.status}
                      </span>
                    </div>
                    <p className="text-stone-600 dark:text-slate-300">{r.needsAssessment}</p>
                    <p className="font-mono-tabular text-stone-500">
                      Demandé : {r.requestedAmount.toLocaleString('fr-FR')} XOF · Alloué :{' '}
                      {r.allocatedAmount.toLocaleString('fr-FR')} XOF
                    </p>
                    {r.status === 'submitted' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(r, 'approved')}
                          className="px-3 py-1 rounded bg-emerald-700 text-white font-semibold cursor-pointer"
                        >
                          Approuver & Allouer budget
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(r, 'rejected')}
                          className="px-3 py-1 rounded border border-stone-300 cursor-pointer"
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'distributions' && canManage && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAddDistribution}
                className="lg:col-span-5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PackageCheck className="w-4 h-4 text-amber-700" />
                  Enregistrer une distribution (débite le Fonds Humanitaire)
                </div>
                <select
                  value={distBenId}
                  onChange={(e) => setDistBenId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                >
                  <option value="">Bénéficiaire</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName}
                    </option>
                  ))}
                </select>
                <select
                  value={distReqId}
                  onChange={(e) => setDistReqId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                >
                  <option value="">Lier à une demande approuvée (optionnel)</option>
                  {aidRequests
                    .filter((a) => a.status === 'approved')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({a.beneficiaryName})
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  value={distItems}
                  onChange={(e) => setDistItems(e.target.value)}
                  placeholder="Détail des vivres / aides remis"
                  required
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={distSpent}
                  onChange={(e) => setDistSpent(e.target.value)}
                  placeholder="Montant décaissé (XOF)"
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                />
                <input
                  type="text"
                  value={distProof}
                  onChange={(e) => setDistProof(e.target.value)}
                  placeholder="Preuve / N° bordereau de remise"
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                >
                  Valider la distribution
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {distributions.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1 text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold text-sm">{d.beneficiaryName}</span>
                      <span className="font-mono-tabular font-semibold text-amber-800 dark:text-amber-400">
                        {d.amountSpent.toLocaleString('fr-FR')} XOF
                      </span>
                    </div>
                    <p>{d.itemsSummary}</p>
                    <p className="text-stone-500">
                      {new Date(d.distributedAt).toLocaleDateString('fr-FR')}
                      {d.proofNotes ? ` · Preuve : ${d.proofNotes}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'volunteers' && canManage && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAssignVolunteer}
                className="lg:col-span-5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-700" />
                  Affecter un bénévole
                </h3>
                <select
                  value={volUserId}
                  onChange={(e) => setVolUserId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                >
                  <option value="">Sélectionner un membre</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={volMission}
                  onChange={(e) => setVolMission(e.target.value)}
                  placeholder="Mission (ex: Maraude Plateau)"
                  required
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <input
                  type="date"
                  value={volDate}
                  onChange={(e) => setVolDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                >
                  Planifier la mission
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {volunteers.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-sm">{v.missionTitle}</p>
                      <p className="text-stone-500">
                        Bénévole : {v.volunteerName} · {v.scheduledDate}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
