import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Globe,
  ListChecks,
  Loader2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Tv,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  IPTV_ORG_RELIGIOUS_PLAYLIST_URL,
  TV_BROADCAST_TYPES,
  TV_CATEGORIES,
  TV_STREAM_STATUS_META,
} from '../../lib/tvConstants';
import type {
  TvBroadcastItem,
  TvChannelItem,
  TvDiscoveryEntry,
} from '../../types/platform';
import { ResilientImage } from '../ResilientImage';
import { HlsVideoPlayer } from './HlsVideoPlayer';

interface ChariteTvAdminPanelProps {
  churchId: number;
  onChanged?: () => void;
}

export const ChariteTvAdminPanel: React.FC<ChariteTvAdminPanelProps> = ({
  churchId,
  onChanged,
}) => {
  const [subTab, setSubTab] = useState<'channels' | 'discovery' | 'live'>('channels');
  const [channels, setChannels] = useState<TvChannelItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<TvBroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] = useState<TvChannelItem | null>(null);

  // Manual add / edit channel form
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null);
  const [chName, setChName] = useState('');
  const [chStreamUrl, setChStreamUrl] = useState('');
  const [chCategory, setChCategory] = useState<string>(TV_CATEGORIES[2]);
  const [chLanguage, setChLanguage] = useState('Français');
  const [chCountry, setChCountry] = useState("Côte d'Ivoire");
  const [chLogoUrl, setChLogoUrl] = useState('');
  const [chProgram, setChProgram] = useState('');
  const [chDescription, setChDescription] = useState('');
  const [chRightsHolder, setChRightsHolder] = useState('');
  const [chRightsNotes, setChRightsNotes] = useState('');
  const [chRightsVerified, setChRightsVerified] = useState(false);
  const [chIsValidated, setChIsValidated] = useState(false);
  const [chIsActive, setChIsActive] = useState(true);
  const [chIsRecommended, setChIsRecommended] = useState(false);

  // IPTV / M3U Discovery state
  const [playlistUrl, setPlaylistUrl] = useState(IPTV_ORG_RELIGIOUS_PLAYLIST_URL);
  const [m3uText, setM3uText] = useState('');
  const [onlyChristian, setOnlyChristian] = useState(true);
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [discovered, setDiscovered] = useState<
    (TvDiscoveryEntry & { alreadyAdded?: boolean })[]
  >([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [discoveryCategoryOverride, setDiscoveryCategoryOverride] = useState<string>('auto');
  const [discoveryRightsConfirmed, setDiscoveryRightsConfirmed] = useState(false);

  // Charité Live Broadcast form
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [brTitle, setBrTitle] = useState('');
  const [brType, setBrType] = useState('culte');
  const [brSpeaker, setBrSpeaker] = useState('');
  const [brStreamUrl, setBrStreamUrl] = useState('');
  const [brProvider, setBrProvider] = useState('hls_custom');
  const [brStatus, setBrStatus] = useState('live');
  const [brThumb, setBrThumb] = useState('');
  const [brScheduledAt, setBrScheduledAt] = useState('');
  const [brDesc, setBrDesc] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        channels: TvChannelItem[];
        broadcasts: TvBroadcastItem[];
      }>(`/api/churches/${churchId}/tv/admin/channels`);
      setChannels(data.channels || []);
      setBroadcasts(data.broadcasts || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors du chargement de la régie CHARITAS TV.'
      );
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const resetChannelForm = () => {
    setEditingChannelId(null);
    setChName('');
    setChStreamUrl('');
    setChCategory(TV_CATEGORIES[2]);
    setChLanguage('Français');
    setChCountry("Côte d'Ivoire");
    setChLogoUrl('');
    setChProgram('');
    setChDescription('');
    setChRightsHolder('');
    setChRightsNotes('');
    setChRightsVerified(false);
    setChIsValidated(false);
    setChIsActive(true);
    setChIsRecommended(false);
  };

  const openEditChannel = (ch: TvChannelItem) => {
    setEditingChannelId(ch.id);
    setChName(ch.name);
    setChStreamUrl(ch.streamUrl);
    setChCategory(ch.category);
    setChLanguage(ch.language);
    setChCountry(ch.country || '');
    setChLogoUrl(ch.logoUrl || '');
    setChProgram(ch.currentProgram || '');
    setChDescription(ch.description || '');
    setChRightsHolder(ch.rightsHolder || '');
    setChRightsNotes(ch.rightsNotes || '');
    setChRightsVerified(ch.rightsVerified);
    setChIsValidated(ch.isValidated);
    setChIsActive(ch.isActive);
    setChIsRecommended(ch.isRecommended);
    setShowChannelForm(true);
    setSubTab('channels');
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setBusyAction('save-channel');
    try {
      const payload = {
        name: chName.trim(),
        streamUrl: chStreamUrl.trim(),
        category: chCategory,
        language: chLanguage.trim() || 'Français',
        country: chCountry.trim() || null,
        logoUrl: chLogoUrl.trim() || null,
        currentProgram: chProgram.trim() || null,
        description: chDescription.trim() || null,
        rightsHolder: chRightsHolder.trim() || null,
        rightsNotes: chRightsNotes.trim() || null,
        rightsVerified: chRightsVerified,
        isValidated: chIsValidated,
        isActive: chIsActive,
        isRecommended: chIsRecommended,
        testImmediately: true,
      };

      if (editingChannelId) {
        await apiFetch(`/api/churches/${churchId}/tv/admin/channels/${editingChannelId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Chaîne mise à jour et statut du flux vérifié.');
      } else {
        await apiFetch(`/api/churches/${churchId}/tv/admin/channels`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Chaîne ajoutée et test de disponibilité exécuté.');
      }

      resetChannelForm();
      setShowChannelForm(false);
      await loadAdminData();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestChannel = async (channelId: number) => {
    setBusyAction(`test-${channelId}`);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch<{
        channel: TvChannelItem;
        probe: { status: string; error: string | null };
      }>(`/api/churches/${churchId}/tv/admin/channels/${channelId}/test`, {
        method: 'POST',
      });
      setChannels((prev) => prev.map((c) => (c.id === channelId ? res.channel : c)));
      setSuccessMsg(
        res.probe.status === 'operational'
          ? `Flux « ${res.channel.name} » vérifié : OPÉRATIONNEL.`
          : `Flux « ${res.channel.name} » marqué INDISPONIBLE : ${res.probe.error || 'Échec de connexion'}`
      );
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du test du flux.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCheckAllStreams = async () => {
    setBusyAction('check-all');
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch<{
        checkedCount: number;
        operationalCount: number;
        unavailableCount: number;
      }>(`/api/churches/${churchId}/tv/admin/check-all`, { method: 'POST' });
      setSuccessMsg(
        `Vérification globale terminée (${res.checkedCount} chaînes) : ${res.operationalCount} opérationnelle(s), ${res.unavailableCount} indisponible(s).`
      );
      await loadAdminData();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur vérification globale.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleQuickFlag = async (
    ch: TvChannelItem,
    patch: Partial<{ isActive: boolean; isValidated: boolean; isRecommended: boolean; rightsVerified: boolean }>
  ) => {
    setBusyAction(`flag-${ch.id}`);
    setError(null);
    try {
      const res = await apiFetch<{ channel: TvChannelItem }>(
        `/api/churches/${churchId}/tv/admin/channels/${ch.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }
      );
      setChannels((prev) => prev.map((c) => (c.id === ch.id ? res.channel : c)));
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteChannel = async (ch: TvChannelItem) => {
    setBusyAction(`del-${ch.id}`);
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/tv/admin/channels/${ch.id}`, {
        method: 'DELETE',
      });
      setChannels((prev) => prev.filter((c) => c.id !== ch.id));
      if (previewChannel?.id === ch.id) setPreviewChannel(null);
      setSuccessMsg(`Chaîne « ${ch.name} » supprimée.`);
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDiscoverIptv = async (useText = false) => {
    setBusyAction('discover');
    setError(null);
    setSuccessMsg(null);
    setSelectedIndexes([]);
    try {
      const res = await apiFetch<{
        sourceUrl: string;
        totalParsed: number;
        entries: (TvDiscoveryEntry & { alreadyAdded?: boolean })[];
      }>(`/api/churches/${churchId}/tv/admin/iptv-discover`, {
        method: 'POST',
        body: JSON.stringify(
          useText
            ? { m3uText, onlyLikelyChristian: onlyChristian }
            : { playlistUrl: playlistUrl.trim(), onlyLikelyChristian: onlyChristian }
        ),
      });
      setDiscovered(res.entries || []);
      setSuccessMsg(
        `${res.entries.length} chaîne(s) prévisualisée(s) sur ${res.totalParsed} entrées (aucune publication automatique). Sélectionnez manuellement les chaînes à valider.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Échec du chargement de la playlist M3U.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleM3uFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setM3uText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const toggleSelectCandidate = (idx: number) => {
    setSelectedIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleImportSelectedCandidates = async () => {
    if (selectedIndexes.length === 0) return;
    if (!discoveryRightsConfirmed) {
      setError(
        'Veuillez cocher la confirmation de vérification des droits et pertinence chrétienne avant d’importer.'
      );
      return;
    }

    setBusyAction('import-selected');
    setError(null);
    setSuccessMsg(null);
    try {
      const chosen = discovered
        .filter((e) => selectedIndexes.includes(e.index))
        .slice(0, 10)
        .map((e) => ({
          name: e.name,
          streamUrl: e.streamUrl,
          logoUrl: e.logoUrl,
          tvgId: e.tvgId,
          language: e.language,
          country: e.country,
          category:
            discoveryCategoryOverride !== 'auto'
              ? discoveryCategoryOverride
              : e.suggestedCategory,
          sourceOrigin: playlistUrl.includes('iptv-org') ? 'iptv_org' : 'm3u_import',
          rightsVerified: true,
          isValidated: true,
          isActive: true,
          rightsNotes: `Sélection manuelle validée depuis ${playlistUrl.includes('iptv-org') ? 'iptv-org/iptv' : 'playlist M3U'}`,
        }));

      const res = await apiFetch<{ channels: TvChannelItem[] }>(
        `/api/churches/${churchId}/tv/admin/channels`,
        {
          method: 'POST',
          body: JSON.stringify({ channels: chosen, testImmediately: true }),
        }
      );

      const operationalCount = res.channels.filter((c) => c.streamStatus === 'operational').length;
      setSuccessMsg(
        `${res.channels.length} chaîne(s) importée(s) et testée(s) : ${operationalCount} opérationnelle(s) publiée(s).`
      );
      setSelectedIndexes([]);
      await loadAdminData();
      setSubTab('channels');
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’import sélectionné.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('create-broadcast');
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch(`/api/churches/${churchId}/tv/admin/broadcasts`, {
        method: 'POST',
        body: JSON.stringify({
          title: brTitle.trim(),
          broadcastType: brType,
          speakerName: brSpeaker.trim() || null,
          streamUrl: brStreamUrl.trim(),
          ingestProvider: brProvider,
          status: brStatus,
          thumbnailUrl: brThumb.trim() || null,
          scheduledAt: brScheduledAt || null,
          description: brDesc.trim() || null,
        }),
      });
      setBrTitle('');
      setBrSpeaker('');
      setBrStreamUrl('');
      setBrThumb('');
      setBrScheduledAt('');
      setBrDesc('');
      setShowBroadcastForm(false);
      setSuccessMsg('Diffusion CHARITAS Live enregistrée.');
      await loadAdminData();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur création diffusion.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleBroadcastStatus = async (brId: number, status: string) => {
    setBusyAction(`br-${brId}`);
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/tv/admin/broadcasts/${brId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadAdminData();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur changement statut.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteBroadcast = async (brId: number) => {
    setBusyAction(`br-del-${brId}`);
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/tv/admin/broadcasts/${brId}`, {
        method: 'DELETE',
      });
      setBroadcasts((prev) => prev.filter((b) => b.id !== brId));
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusyAction(null);
    }
  };

  const filteredDiscovered = useMemo(() => {
    const q = discoverySearch.trim().toLowerCase();
    if (!q) return discovered.slice(0, 120);
    return discovered
      .filter((e) =>
        `${e.name} ${e.language} ${e.country || ''} ${e.groupTitle || ''}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 120);
  }, [discovered, discoverySearch]);

  const stats = useMemo(
    () => ({
      total: channels.length,
      operational: channels.filter((c) => c.streamStatus === 'operational').length,
      unavailable: channels.filter((c) => c.streamStatus === 'unavailable').length,
      published: channels.filter(
        (c) => c.isValidated && c.isActive && c.streamStatus === 'operational'
      ).length,
    }),
    [channels]
  );

  return (
    <div className="space-y-6">
      {/* Admin Header & KPIs */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
              Régie audiovisuelle &amp; Curation légale
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-[#061A40] dark:text-white">
              Administration CHARITAS TV &amp; CHARITAS Live
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Sélection manuelle des flux chrétiens, contrôle des droits, vérification technique
              HLS/M3U8 et pilotage des cultes en direct.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCheckAllStreams}
              disabled={busyAction === 'check-all' || channels.length === 0}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {busyAction === 'check-all' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Activity className="w-4 h-4 text-[#1D4ED8]" />
              )}
              Tester tous les flux
            </button>
            <button
              type="button"
              onClick={() => {
                resetChannelForm();
                setShowChannelForm(true);
                setSubTab('channels');
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#061A40] hover:bg-[#0D2E6E] dark:bg-[#1D4ED8] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Ajouter une chaîne / M3U8
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5">
            <p className="text-[11px] text-slate-500">Chaînes configurées</p>
            <p className="mt-1 text-2xl font-bold font-mono-tabular text-[#061A40] dark:text-white">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Flux opérationnels</p>
            <p className="mt-1 text-2xl font-bold font-mono-tabular text-emerald-800 dark:text-emerald-300">
              {stats.operational}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 p-3.5">
            <p className="text-[11px] text-rose-700 dark:text-rose-300">Flux indisponibles</p>
            <p className="mt-1 text-2xl font-bold font-mono-tabular text-rose-800 dark:text-rose-300">
              {stats.unavailable}
            </p>
          </div>
          <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 p-3.5">
            <p className="text-[11px] text-[#1D4ED8] dark:text-[#60A5FA]">Publiées visiteurs</p>
            <p className="mt-1 text-2xl font-bold font-mono-tabular text-[#1D4ED8] dark:text-[#60A5FA]">
              {stats.published}
            </p>
          </div>
        </div>

        {/* Admin Sub-tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('channels')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${
              subTab === 'channels'
                ? 'bg-[#1D4ED8] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Tv className="w-4 h-4" />
            Chaînes gérées ({channels.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('discovery')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${
              subTab === 'discovery'
                ? 'bg-[#1D4ED8] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            Découverte IPTV (iptv-org) &amp; Import M3U
          </button>
          <button
            type="button"
            onClick={() => setSubTab('live')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${
              subTab === 'live'
                ? 'bg-[#1D4ED8] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Radio className="w-4 h-4" />
            CHARITAS Live — Diffusions paroisse ({broadcasts.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {previewChannel && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Prévisualisation technique en direct : {previewChannel.name}
            </span>
            <button
              type="button"
              onClick={() => setPreviewChannel(null)}
              className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
            >
              Fermer le lecteur
            </button>
          </div>
          <HlsVideoPlayer
            source={{
              title: previewChannel.name,
              subtitle: `${previewChannel.category} · ${previewChannel.language}`,
              logoUrl: previewChannel.logoUrl,
              streamUrl: previewChannel.streamUrl,
              streamFormat: previewChannel.streamFormat,
              isLive: true,
            }}
          />
        </div>
      )}

      {/* TAB 1: CHANNELS MANAGEMENT */}
      {subTab === 'channels' && (
        <div className="space-y-5">
          {showChannelForm && (
            <form
              onSubmit={handleSaveChannel}
              className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                  {editingChannelId
                    ? 'Modifier la chaîne & les droits'
                    : 'Ajouter manuellement une chaîne (.m3u8 / MP4)'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowChannelForm(false);
                    resetChannelForm();
                  }}
                  className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
                >
                  Annuler
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Nom de la chaîne *</label>
                  <input
                    required
                    value={chName}
                    onChange={(e) => setChName(e.target.value)}
                    placeholder="Ex. KTO TV Catholique"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">URL du flux HLS (.m3u8) / MP4 *</label>
                  <input
                    required
                    type="url"
                    value={chStreamUrl}
                    onChange={(e) => setChStreamUrl(e.target.value)}
                    placeholder="https://.../playlist.m3u8"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Catégorie *</label>
                  <select
                    value={chCategory}
                    onChange={(e) => setChCategory(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  >
                    {TV_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Langue *</label>
                    <input
                      required
                      value={chLanguage}
                      onChange={(e) => setChLanguage(e.target.value)}
                      placeholder="Français"
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Pays / Région</label>
                    <input
                      value={chCountry}
                      onChange={(e) => setChCountry(e.target.value)}
                      placeholder="Côte d'Ivoire"
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">URL du logo (PNG/JPG/SVG)</label>
                  <input
                    type="url"
                    value={chLogoUrl}
                    onChange={(e) => setChLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Émission / Programme en cours</label>
                  <input
                    value={chProgram}
                    onChange={(e) => setChProgram(e.target.value)}
                    placeholder="Chapelet en direct, Enseignement biblique..."
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={chDescription}
                  onChange={(e) => setChDescription(e.target.value)}
                  placeholder="Présentation de la chaîne et ligne éditoriale chrétienne..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3">
                <p className="text-xs font-bold text-[#061A40] dark:text-white inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
                  Conformité légale &amp; Droits de diffusion
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={chRightsHolder}
                    onChange={(e) => setChRightsHolder(e.target.value)}
                    placeholder="Ayant droit / Diffuseur officiel"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                  <input
                    value={chRightsNotes}
                    onChange={(e) => setChRightsNotes(e.target.value)}
                    placeholder="Preuve / Licence / Autorisation d'intégration"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-4 pt-1 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chRightsVerified}
                      onChange={(e) => {
                        setChRightsVerified(e.target.checked);
                        if (!e.target.checked) setChIsValidated(false);
                      }}
                    />
                    <span>Droits d’intégration vérifiés</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chIsValidated}
                      disabled={!chRightsVerified}
                      onChange={(e) => setChIsValidated(e.target.checked)}
                    />
                    <span>Valider pour publication publique (si flux opérationnel)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chIsActive}
                      onChange={(e) => setChIsActive(e.target.checked)}
                    />
                    <span>Chaîne active</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chIsRecommended}
                      onChange={(e) => setChIsRecommended(e.target.checked)}
                    />
                    <span>Mettre en recommandation</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={busyAction === 'save-channel'}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {busyAction === 'save-channel' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingChannelId ? 'Enregistrer & Tester' : 'Ajouter & Tester le flux'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1D4ED8]" />
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
              <Tv className="w-10 h-10 mx-auto text-slate-400" />
              <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                Aucune chaîne enregistrée dans ce catalogue
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                Utilisez l’onglet « Découverte IPTV (iptv-org) & Import M3U » pour explorer la
                playlist religieuse et sélectionner manuellement vos chaînes chrétiennes, ou ajoutez
                une URL M3U8 manuellement.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => {
                const statusMeta =
                  TV_STREAM_STATUS_META[ch.streamStatus] || TV_STREAM_STATUS_META.pending_check;
                const badgeClass =
                  ch.streamStatus === 'operational'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : ch.streamStatus === 'unavailable'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
                return (
                  <div
                    key={ch.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 shrink-0 flex items-center justify-center">
                        {ch.logoUrl ? (
                          <ResilientImage
                            src={ch.logoUrl}
                            alt={ch.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Tv className="w-5 h-5 text-[#1D4ED8]" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-[#061A40] dark:text-white">
                            {ch.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                          {ch.isValidated && ch.isActive && ch.streamStatus === 'operational' ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#1D4ED8] dark:text-[#60A5FA] text-[10px] font-semibold">
                              Visible visiteurs
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
                              Masquée visiteurs
                            </span>
                          )}
                          {ch.isRecommended && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-[#F5B82E] text-[10px] font-semibold inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Recommandée
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {ch.category} · {ch.language}
                          {ch.country ? ` · ${ch.country}` : ''} · Origine : {ch.sourceOrigin}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 truncate max-w-2xl">
                          {ch.streamUrl}
                        </p>
                        {ch.lastCheckError && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400">
                            Diagnostic : {ch.lastCheckError}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewChannel(ch)}
                        className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        Lire
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestChannel(ch.id)}
                        disabled={busyAction === `test-${ch.id}`}
                        className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {busyAction === `test-${ch.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        Tester flux
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditChannel(ch)}
                        className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleQuickFlag(ch, { isActive: !ch.isActive })}
                        className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        {ch.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteChannel(ch)}
                        className="min-h-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        aria-label={`Supprimer ${ch.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IPTV DISCOVERY & MANUAL SELECTION */}
      {subTab === 'discovery' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                  Catalogue IPTV-ORG &amp; Import M3U sécurisé (Validation manuelle)
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
                  Les playlists publiques sont analysées uniquement comme texte structuré (aucun
                  script exécuté). Aucune chaîne n’est publiée automatiquement : sélectionnez
                  uniquement les chaînes chrétiennes pertinentes dont l’intégration est légale.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#1D4ED8] dark:text-[#60A5FA] text-[11px] font-semibold">
                Source : github.com/iptv-org/iptv
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-8">
                <label className="block text-xs font-medium mb-1">URL Playlist M3U publique</label>
                <input
                  type="url"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div className="lg:col-span-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleDiscoverIptv(false)}
                  disabled={busyAction === 'discover'}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {busyAction === 'discover' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  Explorer la playlist
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium">Ou importer / coller un fichier .M3U</label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Charger fichier .m3u</span>
                  <input
                    type="file"
                    accept=".m3u,.m3u8,.txt"
                    onChange={handleM3uFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
              <textarea
                rows={3}
                value={m3uText}
                onChange={(e) => setM3uText(e.target.value)}
                placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-logo=&quot;...&quot; group-title=&quot;Religious&quot;,Nom Chaîne&#10;https://exemple.org/live/stream.m3u8"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyChristian}
                    onChange={(e) => setOnlyChristian(e.target.checked)}
                  />
                  <span>Filtrer uniquement les chaînes à mots-clés chrétiens</span>
                </label>
                <button
                  type="button"
                  disabled={!m3uText.trim() || busyAction === 'discover'}
                  onClick={() => handleDiscoverIptv(true)}
                  className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Analyser le texte M3U
                </button>
              </div>
            </div>
          </div>

          {discovered.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative w-full lg:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={discoverySearch}
                    onChange={(e) => setDiscoverySearch(e.target.value)}
                    placeholder="Filtrer résultats (nom, pays, langue)..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={discoveryCategoryOverride}
                    onChange={(e) => setDiscoveryCategoryOverride(e.target.value)}
                    aria-label="Catégorie d'import"
                    className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  >
                    <option value="auto">Catégorie suggérée automatiquement</option>
                    {TV_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={discoveryRightsConfirmed}
                      onChange={(e) => setDiscoveryRightsConfirmed(e.target.checked)}
                    />
                    <span>Droits &amp; pertinence chrétienne vérifiés</span>
                  </label>

                  <button
                    type="button"
                    disabled={selectedIndexes.length === 0 || busyAction === 'import-selected'}
                    onClick={handleImportSelectedCandidates}
                    className="min-h-[40px] px-4 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {busyAction === 'import-selected' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Importer sélection ({selectedIndexes.length}/10 max) &amp; Tester
                  </button>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                {filteredDiscovered.map((entry) => {
                  const checked = selectedIndexes.includes(entry.index);
                  return (
                    <label
                      key={`${entry.index}-${entry.streamUrl}`}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        entry.alreadyAdded ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          disabled={entry.alreadyAdded || (!checked && selectedIndexes.length >= 10)}
                          checked={checked}
                          onChange={() => toggleSelectCandidate(entry.index)}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#061A40] dark:text-white truncate">
                            {entry.name}
                            {entry.alreadyAdded && (
                              <span className="ml-2 text-[10px] text-emerald-600">(Déjà importée)</span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {entry.suggestedCategory} · {entry.language}
                            {entry.country ? ` · ${entry.country}` : ''}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 truncate max-w-xl">
                            {entry.streamUrl}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 uppercase">
                        {entry.streamFormat}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHARITAS LIVE (CHURCH BROADCASTS) */}
      {subTab === 'live' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#061A40] dark:text-white">
              Diffusions propres de la paroisse (CHARITAS Live)
            </h3>
            <button
              type="button"
              onClick={() => setShowBroadcastForm((v) => !v)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nouvelle diffusion / Rediffusion
            </button>
          </div>

          {showBroadcastForm && (
            <form
              onSubmit={handleCreateBroadcast}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Titre de la diffusion *</label>
                  <input
                    required
                    value={brTitle}
                    onChange={(e) => setBrTitle(e.target.value)}
                    placeholder="Messe Dominicale — Paroisse Saint Louis Roi d'Ebimpé"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Type de contenu *</label>
                  <select
                    value={brType}
                    onChange={(e) => setBrType(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  >
                    {TV_BROADCAST_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">URL du flux (HLS .m3u8, YouTube Live, Vimeo, MP4) *</label>
                  <input
                    required
                    type="url"
                    value={brStreamUrl}
                    onChange={(e) => setBrStreamUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Source technique</label>
                    <select
                      value={brProvider}
                      onChange={(e) => setBrProvider(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    >
                      <option value="hls_custom">HLS (.m3u8)</option>
                      <option value="youtube_live">YouTube Live</option>
                      <option value="vimeo">Vimeo Live</option>
                      <option value="mux_rtmp">Ingest RTMP → HLS</option>
                      <option value="replay_mp4">Rediffusion MP4</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Statut</label>
                    <select
                      value={brStatus}
                      onChange={(e) => setBrStatus(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    >
                      <option value="live">En direct maintenant</option>
                      <option value="scheduled">Programmé</option>
                      <option value="replay">Rediffusion</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Prédicateur / Célébrant</label>
                  <input
                    value={brSpeaker}
                    onChange={(e) => setBrSpeaker(e.target.value)}
                    placeholder="Père Curé / Équipe liturgique"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Date &amp; heure programmée</label>
                  <input
                    type="datetime-local"
                    value={brScheduledAt}
                    onChange={(e) => setBrScheduledAt(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="url"
                  value={brThumb}
                  onChange={(e) => setBrThumb(e.target.value)}
                  placeholder="URL miniature (optionnel)"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
                <input
                  value={brDesc}
                  onChange={(e) => setBrDesc(e.target.value)}
                  placeholder="Résumé de l'émission ou culte..."
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={busyAction === 'create-broadcast'}
                  className="min-h-[42px] px-5 rounded-xl bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
                >
                  Publier sur CHARITAS Live
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {broadcasts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                Aucune diffusion CHARITAS Live créée.
              </div>
            ) : (
              broadcasts.map((br) => (
                <div
                  key={br.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-[#061A40] dark:text-white">
                        {br.title}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          br.status === 'live'
                            ? 'bg-rose-600 text-white'
                            : br.status === 'replay'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {br.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {TV_BROADCAST_TYPES.find((t) => t.value === br.broadcastType)?.label ||
                        br.broadcastType}
                      {br.speakerName ? ` · ${br.speakerName}` : ''} · {br.ingestProvider}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {br.status !== 'live' && (
                      <button
                        type="button"
                        onClick={() => handleBroadcastStatus(br.id, 'live')}
                        className="min-h-[38px] px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Passer EN DIRECT
                      </button>
                    )}
                    {br.status !== 'replay' && (
                      <button
                        type="button"
                        onClick={() => handleBroadcastStatus(br.id, 'replay')}
                        className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        Passer en Rediffusion
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteBroadcast(br.id)}
                      className="min-h-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 cursor-pointer"
                      aria-label={`Supprimer ${br.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
