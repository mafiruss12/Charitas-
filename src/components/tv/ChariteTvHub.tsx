import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookmarkCheck,
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
import { TV_BROADCAST_TYPES, TV_CATEGORIES } from '../../lib/tvConstants';
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
  | { kind: 'channel'; item: TvChannelItem; resumeSec?: number }
  | { kind: 'broadcast'; item: TvBroadcastItem; resumeSec?: number };

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
        if (liveBroadcast) return { kind: 'broadcast', item: liveBroadcast };
        if (publicCatalog.recommendedChannels[0]) {
          return { kind: 'channel', item: publicCatalog.recommendedChannels[0] };
        }
        if (publicCatalog.channels[0]) {
          return { kind: 'channel', item: publicCatalog.channels[0] };
        }
        if (publicCatalog.broadcasts[0]) {
          return { kind: 'broadcast', item: publicCatalog.broadcasts[0] };
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

  const selectChannel = (channel: TvChannelItem, resumeSec = 0) => {
    setActiveSelection({ kind: 'channel', item: channel, resumeSec });
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
  };

  const selectBroadcast = (broadcast: TvBroadcastItem, resumeSec = 0) => {
    setActiveSelection({ kind: 'broadcast', item: broadcast, resumeSec });
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
  };

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
        res.added ? `« ${channel.name} » ajoutée à vos favoris.` : `« ${channel.name} » retirée des favoris.`
      );
      setTimeout(() => setShareToast(null), 3200);
    } catch {
      setShareToast('Connectez-vous à cette paroisse pour gérer vos favoris.');
      setTimeout(() => setShareToast(null), 3200);
    }
  };

  const handleShare = async (title: string) => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Regardez « ${title} » sur CHARITAS TV — ${catalog?.churchName || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: `CHARITAS TV · ${title}`, text, url: shareUrl });
        setShareToast('Lien de diffusion partagé.');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        setShareToast('Lien de la chaîne copié dans le presse-papiers.');
      }
    } catch {
      // Ignore user-cancelled share dialog
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
      if (selectedCategory !== 'all' && ch.category !== selectedCategory) return false;
      if (q) {
        const hay = `${ch.name} ${ch.category} ${ch.language} ${ch.country || ''} ${ch.description || ''} ${ch.currentProgram || ''}`.toLowerCase();
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

  const playerSource: PlayerSourceMeta | null = useMemo(() => {
    if (!activeSelection) return null;
    if (activeSelection.kind === 'channel') {
      const ch = activeSelection.item;
      return {
        title: ch.name,
        subtitle: [ch.category, ch.language, ch.currentProgram].filter(Boolean).join(' · '),
        logoUrl: ch.logoUrl,
        streamUrl: ch.streamUrl,
        streamFormat: ch.streamFormat,
        isLive: true,
      };
    }
    const br = activeSelection.item;
    const typeLabel =
      TV_BROADCAST_TYPES.find((t) => t.value === br.broadcastType)?.label || br.broadcastType;
    return {
      title: br.title,
      subtitle: [typeLabel, br.speakerName].filter(Boolean).join(' · '),
      logoUrl: br.thumbnailUrl,
      streamUrl: br.streamUrl,
      streamFormat: br.ingestProvider === 'replay_mp4' ? 'mp4' : br.ingestProvider === 'youtube_live' || br.ingestProvider === 'vimeo' ? 'embed' : 'hls',
      isLive: br.status === 'live',
    };
  }, [activeSelection]);

  const liveCount = (catalog?.broadcasts || []).filter((b) => b.status === 'live').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="rounded-3xl bg-gradient-to-br from-[#04112B] via-[#0A255C] to-[#1D4ED8] text-white p-5 sm:p-7 shadow-[0_18px_50px_-15px_rgba(4,17,43,0.6)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-[#F5B82E]">
              <Tv className="w-3.5 h-3.5" aria-hidden="true" />
              <span>CHARITAS TV &amp; CHARITAS Live</span>
              {liveCount > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {liveCount} direct{liveCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Chaînes chrétiennes &amp; Retransmissions de la paroisse
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl">
              Regardez gratuitement et sans inscription les chaînes chrétiennes validées, les
              cultes en direct de l’Église Saint Louis Roi d’Ebimpé, les prédications et les
              émissions gospel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canManageStreams && onOpenAdminPanel && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Régie &amp; Catalogue IPTV
              </button>
            )}
            {!isAuthenticated && onOpenAuth && (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold cursor-pointer"
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

        {/* Navigation Pills + Search */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSectionMode('all')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                sectionMode === 'all'
                  ? 'bg-[#F5B82E] text-[#061A40]'
                  : 'bg-white/10 text-blue-100 hover:bg-white/15'
              }`}
            >
              Chaînes TV ({catalog?.channels.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setSectionMode('live')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                sectionMode === 'live'
                  ? 'bg-[#F5B82E] text-[#061A40]'
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
                    ? 'bg-[#F5B82E] text-[#061A40]'
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
              placeholder="Rechercher une chaîne, émission, langue..."
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
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#1D4ED8] dark:text-[#F5B82E]" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chargement des flux vérifiés de CHARITAS TV...
          </p>
        </div>
      ) : (
        <>
          {/* Active Video Player */}
          {playerSource && (
            <HlsVideoPlayer
              source={playerSource}
              initialPositionSeconds={activeSelection?.resumeSec || 0}
              onProgress={isAuthenticated ? handleProgressSave : undefined}
              actionsSlot={
                <div className="flex items-center gap-2">
                  {activeSelection?.kind === 'channel' && (
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(activeSelection.item)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        favoriteIds.includes(activeSelection.item.id)
                          ? 'bg-[#F5B82E] border-[#F5B82E] text-[#061A40]'
                          : 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          favoriteIds.includes(activeSelection.item.id) ? 'fill-[#061A40]' : ''
                        }`}
                      />
                      <span className="hidden sm:inline">
                        {favoriteIds.includes(activeSelection.item.id) ? 'Favori' : 'Ajouter favori'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleShare(playerSource.title)}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Partager</span>
                  </button>
                </div>
              }
            />
          )}

          {/* Member Watch History & Resume Playback Strip */}
          {isAuthenticated && history.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
                <h2 className="text-sm font-bold text-[#061A40] dark:text-white">
                  Dernières chaînes &amp; émissions regardées
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {history.slice(0, 4).map((h) => {
                  const title = h.channel?.name || h.broadcast?.title || 'Émission';
                  const sub = h.channel?.category || h.broadcast?.speakerName || 'Rediffusion';
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h2 className="text-lg font-bold text-[#061A40] dark:text-white">
                    CHARITAS Live — Cultes, Prières &amp; Conférences
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Diffusions officielles de la communauté
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
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-bold shadow">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                EN DIRECT
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-[#061A40]/85 text-[#F5B82E] text-[11px] font-semibold">
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
                              className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Regarder
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShare(br.title)}
                              className="min-h-[40px] w-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
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

          {/* Recommendations + 8 Categories + Validated Channels Grid */}
          {sectionMode !== 'live' && (
            <>
              {(catalog?.recommendedChannels.length || 0) > 0 && selectedCategory === 'all' && !searchQuery && sectionMode === 'all' && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F5B82E]" />
                    <h2 className="text-base font-bold text-[#061A40] dark:text-white">
                      Contenus &amp; Chaînes recommandés
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {catalog!.recommendedChannels.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => selectChannel(ch)}
                        className="text-left rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/70 to-white dark:from-[#0E1E3E] dark:to-slate-900 p-4 hover:shadow-md transition-all flex items-center gap-3 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shrink-0 flex items-center justify-center">
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
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#061A40] dark:text-white truncate">
                            {ch.name}
                          </p>
                          <p className="text-[11px] text-amber-700 dark:text-[#F5B82E] truncate">
                            {ch.category}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {ch.currentProgram || ch.language}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* 8 Validated Categories Bar */}
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
                        selectedCategory === cat
                          ? 'bg-[#061A40] text-white border-[#061A40] dark:bg-[#1D4ED8] dark:border-[#1D4ED8]'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-[#1D4ED8]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {filteredChannels.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                    <Tv className="w-10 h-10 mx-auto text-slate-400" />
                    <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                      {sectionMode === 'favorites'
                        ? 'Aucune chaîne favorite enregistrée'
                        : 'Aucune chaîne disponible dans cette sélection'}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                      Seules les chaînes chrétiennes manuellement validées, autorisées et dont le
                      flux HLS/vidéo fonctionne en direct sont publiées sur CHARITAS TV.
                    </p>
                    {canManageStreams && onOpenAdminPanel && (
                      <button
                        type="button"
                        onClick={onOpenAdminPanel}
                        className="mt-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        Ouvrir la Régie Admin CHARITAS TV
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredChannels.map((ch) => {
                      const isSelected =
                        activeSelection?.kind === 'channel' && activeSelection.item.id === ch.id;
                      const isFav = favoriteIds.includes(ch.id);
                      return (
                        <article
                          key={ch.id}
                          className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-4 transition-all ${
                            isSelected
                              ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/25 shadow-md'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 shrink-0 flex items-center justify-center">
                                {ch.logoUrl ? (
                                  <ResilientImage
                                    src={ch.logoUrl}
                                    alt={ch.name}
                                    className="w-full h-full object-contain p-1.5"
                                  />
                                ) : (
                                  <Tv className="w-6 h-6 text-[#1D4ED8]" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Direct vérifié
                                </span>
                              </div>
                            </div>

                            <div>
                              <h3 className="text-sm font-bold text-[#061A40] dark:text-white line-clamp-1">
                                {ch.name}
                              </h3>
                              <p className="mt-0.5 text-[11px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] truncate">
                                {ch.category}
                              </p>
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                {ch.currentProgram ||
                                  ch.description ||
                                  'Diffusion chrétienne en continu'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <Globe className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {[ch.language, ch.country].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => selectChannel(ch)}
                              className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#061A40] hover:bg-[#0E2F6E] dark:bg-[#1D4ED8] dark:hover:bg-[#2563EB] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Regarder
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(ch)}
                              className={`min-h-[42px] w-11 rounded-xl border flex items-center justify-center cursor-pointer ${
                                isFav
                                  ? 'bg-[#F5B82E]/15 border-[#F5B82E] text-[#B45309] dark:text-[#F5B82E]'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                              aria-label={
                                isFav
                                  ? `Retirer ${ch.name} des favoris`
                                  : `Ajouter ${ch.name} aux favoris`
                              }
                            >
                              <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShare(ch.name)}
                              className="min-h-[42px] w-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                              aria-label={`Partager ${ch.name}`}
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};
