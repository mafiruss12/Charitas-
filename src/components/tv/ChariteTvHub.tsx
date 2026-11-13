import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Film,
  Globe,
  History,
  Loader2,
  Play,
  Radio,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tv,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  TV_BROADCAST_TYPES,
  TV_CATEGORIES,
  TV_STREAM_STATUS_META,
  normalizeTvCategory,
} from '../../lib/tvConstants';
import type {
  PublicTvCatalogResponse,
  TvBroadcastItem,
  TvChannelItem,
  TvWatchHistoryItem,
} from '../../types/platform';
import { ResilientImage } from '../ResilientImage';
import { HlsVideoPlayer, type PlayerSourceMeta } from './HlsVideoPlayer';

interface ChariteTvHubProps {
  churchId?: number | null;
  isAuthenticated: boolean;
  canManageStreams?: boolean;
  onOpenAdminPanel?: () => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onCloseModal?: () => void;
  isModal?: boolean;
}

type ActiveSelection =
  | { kind: 'channel'; item: TvChannelItem; resumeSec?: number; autoSelected?: boolean }
  | { kind: 'broadcast'; item: TvBroadcastItem; resumeSec?: number; autoSelected?: boolean };

function formatDurationBadge(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const ChariteTvHub: React.FC<ChariteTvHubProps> = ({
  churchId,
  isAuthenticated,
  canManageStreams = false,
  onOpenAdminPanel,
  onOpenAuth,
  onCloseModal,
  isModal = false,
}) => {
  const [catalog, setCatalog] = useState<PublicTvCatalogResponse | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [history, setHistory] = useState<TvWatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [failedChannelIds, setFailedChannelIds] = useState<number[]>([]);

  const [sectionMode, setSectionMode] = useState<'all' | 'live' | 'favorites'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSelection, setActiveSelection] = useState<ActiveSelection | null>(null);

  const loadTvData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (churchId) qs.set('churchId', String(churchId));
      const publicCatalog = await apiFetch<PublicTvCatalogResponse>(
        `/api/public/tv/catalog${qs.toString() ? `?${qs.toString()}` : ''}`
      );
      setCatalog(publicCatalog);

      const resolvedChurchId = churchId || publicCatalog.churchId;
      if (isAuthenticated && resolvedChurchId) {
        try {
          const memberState = await apiFetch<{
            favoriteChannelIds: number[];
            history: TvWatchHistoryItem[];
          }>(`/api/churches/${resolvedChurchId}/tv/member-state`);
          setFavoriteIds(memberState.favoriteChannelIds || []);
          setHistory(memberState.history || []);
        } catch {
          // Member state optional if user doesn't belong to this church yet
        }
      }

      setActiveSelection((prev) => {
        if (prev) return prev;
        const liveBroadcast = publicCatalog.broadcasts.find((b) => b.status === 'live');
        if (liveBroadcast) {
          return { kind: 'broadcast', item: liveBroadcast, autoSelected: true };
        }
        const preferredChannel =
          publicCatalog.recommendedChannels.find((c) => c.streamStatus === 'operational') ||
          publicCatalog.channels.find((c) => c.streamStatus === 'operational') ||
          publicCatalog.recommendedChannels[0] ||
          publicCatalog.channels[0];
        if (preferredChannel) {
          return { kind: 'channel', item: preferredChannel, autoSelected: true };
        }
        if (publicCatalog.broadcasts[0]) {
          return { kind: 'broadcast', item: publicCatalog.broadcasts[0], autoSelected: true };
        }
        return null;
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Impossible de charger CHARITAS TV pour le moment.'
      );
    } finally {
      setLoading(false);
    }
  }, [churchId, isAuthenticated]);

  useEffect(() => {
    loadTvData();
  }, [loadTvData]);

  const effectiveChurchId = churchId || catalog?.churchId || 0;

  const loadMemberStateOnly = async (cid: number) => {
    if (!isAuthenticated || !cid) return;
    try {
      const memberState = await apiFetch<{
        favoriteChannelIds: number[];
        history: TvWatchHistoryItem[];
      }>(`/api/churches/${cid}/tv/member-state`);
      setFavoriteIds(memberState.favoriteChannelIds || []);
      setHistory(memberState.history || []);
    } catch {
      // ignore
    }
  };

  const selectChannel = useCallback(
    (channel: TvChannelItem, resumeSec = 0) => {
      setActiveSelection({ kind: 'channel', item: channel, resumeSec, autoSelected: false });
      if (isAuthenticated && effectiveChurchId) {
        apiFetch(`/api/churches/${effectiveChurchId}/tv/history`, {
          method: 'POST',
          body: JSON.stringify({
            channelId: channel.id,
            lastPositionSeconds: resumeSec,
            durationSeconds: 0,
          }),
        })
          .then(() => loadMemberStateOnly(effectiveChurchId))
          .catch(() => {});
      }
    },
    [isAuthenticated, effectiveChurchId]
  );

  const selectBroadcast = useCallback(
    (broadcast: TvBroadcastItem, resumeSec = 0) => {
      setActiveSelection({ kind: 'broadcast', item: broadcast, resumeSec, autoSelected: false });
      if (isAuthenticated && effectiveChurchId) {
        apiFetch(`/api/churches/${effectiveChurchId}/tv/history`, {
          method: 'POST',
          body: JSON.stringify({
            broadcastId: broadcast.id,
            lastPositionSeconds: resumeSec,
            durationSeconds: 0,
          }),
        })
          .then(() => loadMemberStateOnly(effectiveChurchId))
          .catch(() => {});
      }
    },
    [isAuthenticated, effectiveChurchId]
  );

  const handleToggleFavorite = async (channel: TvChannelItem) => {
    if (!isAuthenticated) {
      onOpenAuth?.('login');
      return;
    }
    if (!effectiveChurchId) return;
    try {
      const res = await apiFetch<{ added: boolean }>(
        `/api/churches/${effectiveChurchId}/tv/favorites/${channel.id}`,
        { method: 'POST' }
      );
      setFavoriteIds((prev) =>
        res.added ? [...new Set([...prev, channel.id])] : prev.filter((id) => id !== channel.id)
      );
      setShareToast(
        res.added
          ? `« ${channel.name} » ajoutée à vos favoris.`
          : `« ${channel.name} » retirée des favoris.`
      );
      setTimeout(() => setShareToast(null), 3200);
    } catch {
      setShareToast('Connectez-vous à cette paroisse pour gérer vos favoris.');
      setTimeout(() => setShareToast(null), 3200);
    }
  };

  const handleShare = async (title: string) => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Regardez « ${title} » sur CHARITAS TV — ${
      catalog?.churchName || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'
    }`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: `CHARITAS TV · ${title}`, text, url: shareUrl });
        setShareToast('Lien de diffusion partagé.');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        setShareToast('Lien de la chaîne copié dans le presse-papiers.');
      }
    } catch {
      // Ignore cancelled share dialog
    }
    setTimeout(() => setShareToast(null), 3200);
  };

  const handleProgressSave = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (!isAuthenticated || !effectiveChurchId || !activeSelection) return;
      apiFetch(`/api/churches/${effectiveChurchId}/tv/history`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: activeSelection.kind === 'channel' ? activeSelection.item.id : null,
          broadcastId: activeSelection.kind === 'broadcast' ? activeSelection.item.id : null,
          lastPositionSeconds: Math.floor(positionSeconds),
          durationSeconds: Math.floor(durationSeconds),
        }),
      }).catch(() => {});
    },
    [isAuthenticated, effectiveChurchId, activeSelection]
  );

  const filteredChannels = useMemo(() => {
    const base = catalog?.channels || [];
    const q = searchQuery.trim().toLowerCase();
    return base.filter((ch) => {
      if (sectionMode === 'favorites' && !favoriteIds.includes(ch.id)) return false;
      if (
        selectedCategory !== 'all' &&
        normalizeTvCategory(ch.category) !== normalizeTvCategory(selectedCategory)
      ) {
        return false;
      }
      if (q) {
        const hay = `${ch.name} ${ch.category} ${ch.language} ${ch.country || ''} ${
          ch.description || ''
        } ${ch.currentProgram || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [catalog?.channels, sectionMode, favoriteIds, selectedCategory, searchQuery]);

  const filteredBroadcasts = useMemo(() => {
    const base = catalog?.broadcasts || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((b) =>
      `${b.title} ${b.broadcastType} ${b.speakerName || ''} ${b.description || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [catalog?.broadcasts, searchQuery]);

  const selectNextChannel = useCallback(() => {
    const pool = filteredChannels.length > 0 ? filteredChannels : catalog?.channels || [];
    if (pool.length === 0) return;
    if (activeSelection?.kind === 'channel') {
      const idx = pool.findIndex((c) => c.id === activeSelection.item.id);
      const next = pool[(idx + 1) % pool.length];
      if (next && next.id !== activeSelection.item.id) {
        selectChannel(next);
      }
    } else if (pool[0]) {
      selectChannel(pool[0]);
    }
  }, [filteredChannels, catalog?.channels, activeSelection, selectChannel]);

  const handlePlayerFailure = useCallback(() => {
    if (activeSelection?.kind === 'channel') {
      const failedId = activeSelection.item.id;
      setFailedChannelIds((prev) => (prev.includes(failedId) ? prev : [...prev, failedId]));
      if (activeSelection.autoSelected) {
        const fallback = (catalog?.channels || []).find(
          (c) => c.id !== failedId && !failedChannelIds.includes(c.id)
        );
        if (fallback) {
          setActiveSelection({ kind: 'channel', item: fallback, autoSelected: true });
        }
      }
    }
  }, [activeSelection, catalog?.channels, failedChannelIds]);

  const playerSource: PlayerSourceMeta | null = useMemo(() => {
    if (!activeSelection) return null;
    if (activeSelection.kind === 'channel') {
      const ch = activeSelection.item;
      return {
        id: ch.id,
        title: ch.name,
        subtitle: [
          normalizeTvCategory(ch.category),
          ch.language,
          ch.country,
          ch.currentProgram,
        ]
          .filter(Boolean)
          .join(' · '),
        logoUrl: ch.logoUrl,
        streamUrl: ch.streamUrl,
        streamFormat: ch.streamFormat,
        isLive: true,
        country: ch.country,
        language: ch.language,
        category: normalizeTvCategory(ch.category),
      };
    }
    const br = activeSelection.item;
    const typeLabel =
      TV_BROADCAST_TYPES.find((t) => t.value === br.broadcastType)?.label || br.broadcastType;
    return {
      id: br.id,
      title: br.title,
      subtitle: [typeLabel, br.speakerName].filter(Boolean).join(' · '),
      logoUrl: br.thumbnailUrl,
      streamUrl: br.streamUrl,
      streamFormat:
        br.ingestProvider === 'replay_mp4'
          ? 'mp4'
          : br.ingestProvider === 'youtube_live' || br.ingestProvider === 'vimeo'
            ? 'embed'
            : 'hls',
      isLive: br.status === 'live',
    };
  }, [activeSelection]);

  const liveCount = (catalog?.broadcasts || []).filter((b) => b.status === 'live').length;
  const activeChannelCount = catalog?.channels.length || 0;

  return (
    <div className="space-y-6">
      {/* CHARITAS TV Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-[#04112B] via-[#061A40] to-[#1D4ED8] text-white p-5 sm:p-6 shadow-[0_18px_50px_-15px_rgba(4,17,43,0.6)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#F5B82E]">
              <Tv className="w-4 h-4" aria-hidden="true" />
              <span>CHARITAS TV — Église Saint Louis Roi d’Ebimpé</span>
              {liveCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {liveCount} direct{liveCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Télévisions chrétiennes en direct &amp; Cultes de la paroisse
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl">
              Accès libre sans inscription : chaînes chrétiennes vérifiées (africaines, francophones,
              internationales, gospel et enseignements bibliques) avec lecteur adaptatif HLS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canManageStreams && onOpenAdminPanel && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#04112B] text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Régie &amp; Catalogue IPTV
              </button>
            )}
            {!isAuthenticated && onOpenAuth && (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/12 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                Connexion (Favoris &amp; Historique)
              </button>
            )}
            {isModal && onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="min-h-[44px] w-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                aria-label="Fermer CHARITAS TV"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Segmented Tabs + Search */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSectionMode('all')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                sectionMode === 'all'
                  ? 'bg-[#F5B82E] text-[#04112B]'
                  : 'bg-white/10 text-blue-100 hover:bg-white/15'
              }`}
            >
              Chaînes TV ({activeChannelCount})
            </button>
            <button
              type="button"
              onClick={() => setSectionMode('live')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                sectionMode === 'live'
                  ? 'bg-[#F5B82E] text-[#04112B]'
                  : 'bg-white/10 text-blue-100 hover:bg-white/15'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              CHARITAS Live ({catalog?.broadcasts.length || 0})
            </button>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setSectionMode('favorites')}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  sectionMode === 'favorites'
                    ? 'bg-[#F5B82E] text-[#04112B]'
                    : 'bg-white/10 text-blue-100 hover:bg-white/15'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                Mes favoris ({favoriteIds.length})
              </button>
            )}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-blue-200 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une chaîne, pays, langue..."
              aria-label="Rechercher sur CHARITAS TV"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/12 border border-white/20 text-sm text-white placeholder:text-blue-200/75 focus:outline-none focus:ring-2 focus:ring-[#F5B82E]"
            />
          </div>
        </div>
      </div>

      {shareToast && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <BookmarkCheck className="w-4 h-4 shrink-0" />
          <span>{shareToast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading && !catalog ? (
        <div className="py-16 text-center space-y-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#1D4ED8] dark:text-[#F5B82E]" />
          <p className="text-sm font-semibold text-[#061A40] dark:text-white">
            Chargement de la chaîne...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Récupération des flux chrétiens opérationnels de CHARITAS TV.
          </p>
        </div>
      ) : (
        <>
          {/* Responsive Theater Split:
              - Mobile: Player FIRST at top, Catalogue directly BELOW
              - Desktop (lg+): Main Player (8 cols) + Lateral Catalogue Column (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT / TOP: Main Video Player + Active Details */}
            <div className="lg:col-span-8 space-y-4 order-1">
              {playerSource ? (
                <HlsVideoPlayer
                  source={playerSource}
                  initialPositionSeconds={activeSelection?.resumeSec || 0}
                  autoPlayMuted
                  onProgress={isAuthenticated ? handleProgressSave : undefined}
                  onPlaybackFailed={handlePlayerFailure}
                  onNextChannel={activeChannelCount > 1 ? selectNextChannel : undefined}
                  actionsSlot={
                    <div className="flex items-center gap-2">
                      {activeSelection?.kind === 'channel' && (
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(activeSelection.item)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                            favoriteIds.includes(activeSelection.item.id)
                              ? 'bg-[#F5B82E] border-[#F5B82E] text-[#04112B]'
                              : 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                          }`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              favoriteIds.includes(activeSelection.item.id) ? 'fill-[#04112B]' : ''
                            }`}
                          />
                          <span className="hidden sm:inline">
                            {favoriteIds.includes(activeSelection.item.id)
                              ? 'Favori'
                              : 'Ajouter favori'}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleShare(playerSource.title)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Partager</span>
                      </button>
                    </div>
                  }
                />
              ) : (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#04112B] text-white p-10 text-center space-y-3">
                  <Tv className="w-11 h-11 mx-auto text-[#F5B82E]" />
                  <h2 className="text-lg font-bold">Aucune chaîne disponible pour le moment</h2>
                  <p className="text-xs sm:text-sm text-blue-100/80 max-w-md mx-auto">
                    Aucune chaîne chrétienne opérationnelle n’est actuellement active dans ce
                    catalogue.
                  </p>
                  {canManageStreams && onOpenAdminPanel && (
                    <button
                      type="button"
                      onClick={onOpenAdminPanel}
                      className="mt-2 min-h-[44px] px-5 py-2 rounded-xl bg-[#F5B82E] text-[#04112B] text-xs font-bold cursor-pointer"
                    >
                      Importer &amp; Valider des chaînes dans la Régie
                    </button>
                  )}
                </div>
              )}

              {/* Active Channel Metadata Bar */}
              {activeSelection?.kind === 'channel' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                      <span className="font-bold text-[#061A40] dark:text-white">
                        {normalizeTvCategory(activeSelection.item.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{activeSelection.item.language}</span>
                      {activeSelection.item.country && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{activeSelection.item.country}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {TV_STREAM_STATUS_META[activeSelection.item.streamStatus]?.label ||
                          'Opérationnel'}
                      </span>
                    </div>
                    {activeSelection.item.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {activeSelection.item.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT / BELOW: Lateral Channel Catalogue */}
            <aside
              aria-label="Catalogue latéral des chaînes CHARITAS TV"
              className="lg:col-span-4 order-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-[#061A40] dark:text-white">
                    Catalogue des chaînes
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {filteredChannels.length} chaîne{filteredChannels.length > 1 ? 's' : ''} prête
                    {filteredChannels.length > 1 ? 's' : ''} à lire
                  </p>
                </div>
                {selectedCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="text-[11px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                  >
                    Tout voir
                  </button>
                )}
              </div>

              {filteredChannels.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-2">
                  <Tv className="w-8 h-8 mx-auto text-slate-400" />
                  <p className="text-xs font-semibold text-[#061A40] dark:text-white">
                    {sectionMode === 'favorites'
                      ? 'Aucune chaîne favorite enregistrée'
                      : 'Aucune chaîne trouvée'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Modifiez votre recherche ou choisissez une autre catégorie ci-dessous.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {filteredChannels.map((ch) => {
                    const isSelected =
                      activeSelection?.kind === 'channel' && activeSelection.item.id === ch.id;
                    const isFav = favoriteIds.includes(ch.id);
                    const hasPlayerWarning = failedChannelIds.includes(ch.id);
                    const statusLabel = hasPlayerWarning
                      ? 'À réessayer'
                      : TV_STREAM_STATUS_META[ch.streamStatus]?.label || 'Opérationnel';

                    return (
                      <div
                        key={ch.id}
                        className={`rounded-2xl border p-3 transition-colors flex items-center gap-3 ${
                          isSelected
                            ? 'border-[#1D4ED8] bg-blue-50/70 dark:bg-[#0B2252] ring-1 ring-[#1D4ED8]/40'
                            : 'border-slate-200/80 dark:border-slate-800 hover:border-[#1D4ED8]/60 bg-slate-50/50 dark:bg-slate-950/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectChannel(ch)}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-center">
                            {ch.logoUrl ? (
                              <ResilientImage
                                key={ch.logoUrl}
                                src={ch.logoUrl}
                                alt={ch.name}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Tv className="w-5 h-5 text-[#1D4ED8]" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-[#061A40] dark:text-white truncate">
                                {ch.name}
                              </p>
                              {isSelected && (
                                <span className="shrink-0 text-[10px] font-bold text-[#1D4ED8] dark:text-[#F5B82E]">
                                  En lecture
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-[#1D4ED8] dark:text-[#60A5FA] truncate">
                              {normalizeTvCategory(ch.category)}
                            </p>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              <span>{ch.language}</span>
                              {ch.country && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{ch.country}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  hasPlayerWarning
                                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                    : 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                }
                              >
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(ch)}
                          className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            isFav
                              ? 'text-[#B45309] dark:text-[#F5B82E] bg-amber-100/70 dark:bg-amber-950/50'
                              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                          aria-label={
                            isFav
                              ? `Retirer ${ch.name} des favoris`
                              : `Ajouter ${ch.name} aux favoris`
                          }
                        >
                          <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>

          {/* Interactive Categories Filter Strip */}
          {sectionMode !== 'live' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#061A40] text-white border-[#061A40] dark:bg-[#1D4ED8] dark:border-[#1D4ED8]'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-[#1D4ED8]'
                  }`}
                >
                  Toutes les catégories
                </button>
                {TV_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      normalizeTvCategory(selectedCategory) === cat && selectedCategory !== 'all'
                        ? 'bg-[#061A40] text-white border-[#061A40] dark:bg-[#1D4ED8] dark:border-[#1D4ED8]'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-[#1D4ED8]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Member Watch History & Resume Playback Strip */}
          {isAuthenticated && history.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
                <h2 className="text-base font-bold text-[#061A40] dark:text-white">
                  Dernières chaînes &amp; émissions regardées
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {history.slice(0, 4).map((h) => {
                  const title = h.channel?.name || h.broadcast?.title || 'Émission';
                  const sub =
                    (h.channel ? normalizeTvCategory(h.channel.category) : null) ||
                    h.broadcast?.speakerName ||
                    'Rediffusion';
                  const canResume = h.lastPositionSeconds > 10;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        if (h.channel) selectChannel(h.channel, h.lastPositionSeconds);
                        else if (h.broadcast) selectBroadcast(h.broadcast, h.lastPositionSeconds);
                      }}
                      className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 hover:border-[#1D4ED8] transition-colors flex items-center gap-3 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#061A40] text-[#F5B82E] flex items-center justify-center shrink-0">
                        <Play className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#061A40] dark:text-white truncate">
                          {title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {sub}
                        </p>
                        {canResume && (
                          <p className="mt-0.5 text-[10px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                            Reprendre à {formatDurationBadge(h.lastPositionSeconds)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* CHARITAS Live Section (Church Broadcasts) */}
          {(sectionMode === 'live' || (catalog?.broadcasts.length || 0) > 0) && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h2 className="text-lg font-bold text-[#061A40] dark:text-white">
                    CHARITAS Live — Cultes, Prières &amp; Conférences
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Retransmissions officielles de l’Église Saint Louis Roi d’Ebimpé
                </span>
              </div>

              {filteredBroadcasts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  Aucune diffusion CHARITAS Live planifiée ou archivée pour le moment.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBroadcasts.map((br) => {
                    const isSelected =
                      activeSelection?.kind === 'broadcast' && activeSelection.item.id === br.id;
                    const typeLabel =
                      TV_BROADCAST_TYPES.find((t) => t.value === br.broadcastType)?.label ||
                      br.broadcastType;
                    return (
                      <article
                        key={br.id}
                        className={`rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/25'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="relative h-40 bg-[#061A40]">
                          {br.thumbnailUrl ? (
                            <ResilientImage
                              src={br.thumbnailUrl}
                              alt={br.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#04112B] to-[#1D4ED8]/70">
                              <Film className="w-10 h-10 text-[#F5B82E]/80" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3 flex items-center gap-2">
                            {br.status === 'live' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600 text-white text-[11px] font-bold shadow">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                EN DIRECT
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-[#061A40]/90 text-[#F5B82E] text-[11px] font-semibold">
                                {br.status === 'replay' ? 'Rediffusion' : 'Programmé'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                              {typeLabel}
                            </p>
                            <h3 className="mt-1 text-sm font-bold text-[#061A40] dark:text-white line-clamp-2">
                              {br.title}
                            </h3>
                            {br.speakerName && (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                Intervenant : {br.speakerName}
                              </p>
                            )}
                            {br.scheduledAt && (
                              <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(br.scheduledAt).toLocaleString('fr-FR', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => selectBroadcast(br)}
                              className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Regarder
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShare(br.title)}
                              className="min-h-[42px] w-11 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                              aria-label={`Partager ${br.title}`}
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Recommended Channels Showcase Strip */}
          {sectionMode !== 'live' && (catalog?.recommendedChannels.length || 0) > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F5B82E]" />
                <h2 className="text-base font-bold text-[#061A40] dark:text-white">
                  Sélection recommandée CHARITAS TV
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {catalog!.recommendedChannels.map((ch) => {
                  const isSelected =
                    activeSelection?.kind === 'channel' && activeSelection.item.id === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => selectChannel(ch)}
                      className={`text-left rounded-2xl border p-4 transition-all flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-[#1D4ED8] bg-blue-50/70 dark:bg-[#0E2450]'
                          : 'border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/70 to-white dark:from-[#0E1E3E] dark:to-slate-900 hover:border-[#1D4ED8]'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shrink-0 flex items-center justify-center">
                        {ch.logoUrl ? (
                          <ResilientImage
                            key={`rec-${ch.logoUrl}`}
                            src={ch.logoUrl}
                            alt={ch.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Tv className="w-5 h-5 text-[#1D4ED8]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#061A40] dark:text-white truncate">
                          {ch.name}
                        </p>
                        <p className="text-[11px] text-[#B45309] dark:text-[#F5B82E] truncate">
                          {normalizeTvCategory(ch.category)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 truncate max-w-full">
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {[ch.language, ch.country].filter(Boolean).join(' · ')}
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
