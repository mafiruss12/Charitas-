import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Film,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Newspaper,
  Play,
  Radio,
  Search,
  Send,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { parseVideoMedia } from '../../lib/media';
import type {
  PublicChurch,
  PublicEventsResponse,
  PublicFeedResponse,
  PublicStory,
} from '../../types/platform';
import { ResilientImage } from '../ResilientImage';
import { ChariteLogoMark } from './ChariteLogoMark';

export type ExplorerTab = 'feed' | 'shorts' | 'events' | 'visitor';

interface PublicCommunityExplorerProps {
  open: boolean;
  initialTab?: ExplorerTab;
  churches: PublicChurch[];
  initialChurchId?: number;
  onClose: () => void;
  onOpenAuth: (mode: 'login' | 'register', prefill?: { churchId?: number }) => void;
}

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export const PublicCommunityExplorer: React.FC<PublicCommunityExplorerProps> = ({
  open,
  initialTab = 'feed',
  churches,
  initialChurchId,
  onClose,
  onOpenAuth,
}) => {
  const [tab, setTab] = useState<ExplorerTab>(initialTab);
  const [selectedChurchId, setSelectedChurchId] = useState<number>(
    initialChurchId || churches[0]?.id || 1
  );

  // Feed & Shorts State
  const [feedData, setFeedData] = useState<PublicFeedResponse | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'photo' | 'video' | 'poll'>('all');
  const [activeHashtag, setActiveHashtag] = useState('');
  const [activeStory, setActiveStory] = useState<PublicStory | null>(null);
  const [shortIndex, setShortIndex] = useState(0);

  // Events State
  const [eventsData, setEventsData] = useState<PublicEventsResponse | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [streamPreviewUrl, setStreamPreviewUrl] = useState<string | null>(null);

  // Visitor Contact State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interestType, setInterestType] = useState<'visite' | 'priere' | 'benevolat' | 'renseignement'>('visite');
  const [message, setMessage] = useState('');
  const [submittingVisitor, setSubmittingVisitor] = useState(false);
  const [visitorSuccess, setVisitorSuccess] = useState<string | null>(null);
  const [visitorError, setVisitorError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      if (initialChurchId) setSelectedChurchId(initialChurchId);
    }
  }, [open, initialTab, initialChurchId]);

  const loadFeed = useCallback(async () => {
    if (!open) return;
    setFeedLoading(true);
    setFeedError(null);
    try {
      const params = new URLSearchParams();
      if (selectedChurchId) params.set('churchId', String(selectedChurchId));
      if (tab === 'shorts') {
        params.set('type', 'short_video');
      } else if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      if (search.trim()) params.set('search', search.trim());
      if (activeHashtag) params.set('hashtag', activeHashtag);

      const res = await apiFetch<PublicFeedResponse>(`/api/public/feed?${params.toString()}`);
      setFeedData(res);
      setShortIndex(0);
    } catch (err: unknown) {
      setFeedError(err instanceof Error ? err.message : 'Erreur lors du chargement du fil.');
    } finally {
      setFeedLoading(false);
    }
  }, [open, selectedChurchId, tab, typeFilter, search, activeHashtag]);

  const loadEvents = useCallback(async () => {
    if (!open || tab !== 'events') return;
    setEventsLoading(true);
    setEventsError(null);
    try {
      const q = selectedChurchId ? `?churchId=${selectedChurchId}` : '';
      const res = await apiFetch<PublicEventsResponse>(`/api/public/events${q}`);
      setEventsData(res);
    } catch (err: unknown) {
      setEventsError(err instanceof Error ? err.message : 'Erreur lors du chargement des événements.');
    } finally {
      setEventsLoading(false);
    }
  }, [open, tab, selectedChurchId]);

  useEffect(() => {
    if (tab === 'feed' || tab === 'shorts') {
      void loadFeed();
    } else if (tab === 'events') {
      void loadEvents();
    }
  }, [tab, loadFeed, loadEvents]);

  const shortVideos = useMemo(() => {
    return (feedData?.posts || []).filter((p) => p.postType === 'short_video');
  }, [feedData]);

  useEffect(() => {
    if (!open || tab !== 'shorts' || shortVideos.length <= 1) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setShortIndex((i) => Math.min(shortVideos.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setShortIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, tab, shortVideos.length]);

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVisitorError(null);
    setVisitorSuccess(null);
    setSubmittingVisitor(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/public/visitor-contact', {
        method: 'POST',
        token: null,
        body: JSON.stringify({
          churchId: selectedChurchId,
          fullName,
          phone,
          email,
          interestType,
          message,
        }),
      });
      setVisitorSuccess(res.message);
      setFullName('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch (err: unknown) {
      setVisitorError(err instanceof Error ? err.message : 'Impossible d’envoyer votre message.');
    } finally {
      setSubmittingVisitor(false);
    }
  };

  if (!open) return null;

  const selectedChurch = churches.find((c) => c.id === selectedChurchId) || churches[0];
  const currentShort = shortVideos[shortIndex] || null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#04112B]/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Portail communautaire public"
    >
      <div className="bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Bar */}
        <header className="bg-[#061A40] text-white px-4 sm:px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <ChariteLogoMark
              logoUrl={selectedChurch?.logoUrl}
              churchName={selectedChurch?.name || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'}
              sizeClass="w-9 h-9"
            />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">
                {selectedChurch?.name || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'}
              </h2>
              <p className="text-xs text-blue-200/80 truncate">
                Espace visiteur CHARITAS · Données paroissiales en direct
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {churches.length > 1 && (
              <select
                value={selectedChurchId}
                onChange={(e) => setSelectedChurchId(Number(e.target.value))}
                aria-label="Choisir une paroisse"
                className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-xs text-white focus:outline-none"
              >
                {churches.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onOpenAuth('register', { churchId: selectedChurchId })}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Rejoindre
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l'explorateur"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Sub-Navigation Tabs */}
        <nav className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'feed', label: 'Fil & Actualités', icon: <Newspaper className="w-4 h-4" /> },
            { id: 'shorts', label: 'Vidéos courtes (9:16)', icon: <Film className="w-4 h-4" /> },
            { id: 'events', label: 'Événements & Directs', icon: <Calendar className="w-4 h-4" /> },
            { id: 'visitor', label: 'Accueil visiteur & Prière', icon: <Users className="w-4 h-4" /> },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as ExplorerTab)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1D4ED8] text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Main Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'feed' && (
            <div className="space-y-6">
              {/* Stories Row */}
              {feedData && feedData.stories.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {feedData.stories.map((story) => (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => setActiveStory(story)}
                      className="w-40 shrink-0 rounded-xl p-3.5 text-left text-white cursor-pointer transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: story.backgroundColor }}
                    >
                      <p className="text-[11px] font-semibold opacity-80 truncate">{story.authorName}</p>
                      <p className="mt-1.5 text-xs font-medium line-clamp-2">{story.caption}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Search & Type Filter */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher une actualité, un verset, un thème..."
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {[
                    { id: 'all', label: 'Tout' },
                    { id: 'text', label: 'Messages' },
                    { id: 'photo', label: 'Photos' },
                    { id: 'video', label: 'Vidéos' },
                    { id: 'poll', label: 'Sondages' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTypeFilter(f.id as typeof typeFilter)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                        typeFilter === f.id
                          ? 'bg-white dark:bg-slate-900 text-[#061A40] dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hashtag Filter Bar */}
              {feedData && feedData.availableHashtags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {feedData.availableHashtags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveHashtag((prev) => (prev === tag ? '' : tag))}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                        activeHashtag === tag
                          ? 'bg-[#1D4ED8] text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              {feedError && (
                <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
                  {feedError}
                </div>
              )}

              {feedLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1D4ED8]" />
                </div>
              ) : !feedData || feedData.posts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] p-8 text-center space-y-3">
                  <Newspaper className="w-8 h-8 mx-auto text-[#1D4ED8]" />
                  <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                    Aucune publication publique correspondante
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Les actualités paroissiales, photos et sondages publiés par les membres
                    apparaîtront ici en temps réel.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register', { churchId: selectedChurchId })}
                    className="px-5 py-2.5 rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold cursor-pointer"
                  >
                    Rejoindre et publier
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {feedData.posts.map((post) => {
                    const totalVotes = post.pollOptions.reduce((sum, o) => sum + o.votesCount, 0);
                    const parsedVideo =
                      post.mediaUrl && (post.postType === 'video' || post.postType === 'short_video')
                        ? parseVideoMedia(post.mediaUrl)
                        : null;

                    return (
                      <article
                        key={post.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-[#061A40] dark:text-white">
                              {post.authorName}
                            </span>
                            <span className="tabular-nums">{formatDateTime(post.createdAt)}</span>
                          </div>

                          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {post.content}
                          </p>

                          {post.mediaUrl && post.postType === 'photo' && (
                            <div className="rounded-xl overflow-hidden max-h-64 border border-slate-200 dark:border-slate-800">
                              <ResilientImage
                                src={post.mediaUrl}
                                alt={`Publication de ${post.authorName}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          {parsedVideo && (
                            <div className="rounded-xl overflow-hidden bg-slate-950 aspect-video border border-slate-800">
                              {parsedVideo.kind === 'embed' && parsedVideo.embedUrl ? (
                                <iframe
                                  src={parsedVideo.embedUrl}
                                  title={`Vidéo de ${post.authorName}`}
                                  className="w-full h-full"
                                  allowFullScreen
                                />
                              ) : (
                                <video
                                  src={parsedVideo.rawUrl}
                                  controls
                                  playsInline
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          )}

                          {post.postType === 'poll' && post.pollOptions.length > 0 && (
                            <div className="space-y-2">
                              {post.pollOptions.map((opt) => {
                                const pct = totalVotes
                                  ? Math.round((opt.votesCount / totalVotes) * 100)
                                  : 0;
                                return (
                                  <div
                                    key={opt.id}
                                    className="relative p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs overflow-hidden"
                                  >
                                    <div
                                      className="absolute inset-y-0 left-0 bg-[#1D4ED8]/15"
                                      style={{ width: `${pct}%` }}
                                    />
                                    <div className="relative flex justify-between gap-2">
                                      <span className="font-medium text-slate-800 dark:text-slate-200">
                                        {opt.label}
                                      </span>
                                      <span className="tabular-nums text-slate-600 dark:text-slate-400">
                                        {opt.votesCount} ({pct}%)
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              {post.likesCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {post.commentsCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Share2 className="w-3.5 h-3.5" />
                              {post.sharesCount}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenAuth('login', { churchId: post.churchId })}
                            className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                          >
                            Réagir &amp; commenter
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'shorts' && (
            <div className="space-y-4">
              {feedLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1D4ED8]" />
                </div>
              ) : !currentShort ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] p-8 text-center space-y-3">
                  <Film className="w-8 h-8 mx-auto text-[#1D4ED8]" />
                  <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                    Aucune vidéo courte (9:16) publiée pour le moment
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    Partagez de courts témoignages, louanges ou appels solidaires au format vertical
                    depuis votre espace membre.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register', { churchId: selectedChurchId })}
                    className="px-5 py-2.5 rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold cursor-pointer"
                  >
                    Publier la première vidéo courte
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#061A40] dark:text-white flex items-center gap-2">
                        <Film className="w-4 h-4 text-[#F5B82E]" />
                        CHARITAS Reels — Témoignages &amp; Louanges (Mode TikTok)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Glissez verticalement ou utilisez les flèches pour découvrir les capsules spirituelles d’Ebimpé.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#1D4ED8] dark:text-[#60A5FA] bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 tabular-nums">
                      {shortIndex + 1} / {shortVideos.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Immersive 9:16 TikTok Vertical Reel Player */}
                    <div className="lg:col-span-7 flex items-center justify-center gap-4">
                      <div className="w-full max-w-[340px] aspect-[9/16] rounded-3xl overflow-hidden bg-black text-white border-2 border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] relative flex flex-col justify-between group">
                        {currentShort.mediaUrl ? (
                          (() => {
                            const parsed = parseVideoMedia(currentShort.mediaUrl);
                            return parsed.kind === 'embed' && parsed.embedUrl ? (
                              <iframe
                                src={parsed.embedUrl}
                                title={currentShort.content}
                                className="absolute inset-0 w-full h-full object-cover"
                                allowFullScreen
                              />
                            ) : (
                              <video
                                key={currentShort.id}
                                src={parsed.rawUrl}
                                autoPlay
                                loop
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                                onClick={(e) => {
                                  const v = e.currentTarget;
                                  if (v.paused) v.play(); else v.pause();
                                }}
                              />
                            );
                          })()
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#04112B] via-[#0A2B6E] to-[#1D4ED8] p-6 flex items-center justify-center text-center">
                            <p className="text-lg font-semibold leading-relaxed">
                              {currentShort.content}
                            </p>
                          </div>
                        )}

                        {/* TikTok Right-Side Floating Action Buttons */}
                        <div className="absolute right-3 bottom-28 z-20 flex flex-col items-center gap-4 text-white">
                          <button
                            type="button"
                            onClick={() => onOpenAuth('login', { churchId: currentShort.churchId })}
                            className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-rose-500 shadow-lg transition-transform active:scale-95 cursor-pointer"
                            title="Dire Amen / Réagir"
                          >
                            <span className="text-lg">❤️</span>
                            <span className="text-[10px] font-bold text-white tabular-nums">
                              {currentShort.likesCount}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenAuth('login', { churchId: currentShort.churchId })}
                            className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-blue-300 shadow-lg transition-transform active:scale-95 cursor-pointer"
                            title="Commentaires"
                          >
                            <span className="text-base">💬</span>
                            <span className="text-[10px] font-bold text-white tabular-nums">
                              {currentShort.commentsCount}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                navigator.clipboard.writeText(window.location.href);
                              }
                            }}
                            className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-lg transition-transform active:scale-95 cursor-pointer"
                            title="Partager le Reel"
                          >
                            <Share2 className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Top Overlay Badge */}
                        <div className="relative z-10 pointer-events-none p-4 bg-gradient-to-b from-black/70 via-black/20 to-transparent flex items-center justify-between text-xs">
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-600 font-bold tracking-wide uppercase text-[10px]">
                            CHARITAS Reels
                          </span>
                          <span className="font-semibold text-blue-200">
                            {currentShort.authorName}
                          </span>
                        </div>

                        {/* Bottom Overlay Caption & Sound */}
                        <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2">
                          <p className="text-xs sm:text-sm font-medium leading-relaxed drop-shadow">
                            {currentShort.content}
                          </p>
                          {currentShort.hashtags && currentShort.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-[#F5B82E]">
                              {currentShort.hashtags.map((tag) => (
                                <span key={tag}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vertical Scroll Nav Buttons */}
                      {shortVideos.length > 1 && (
                        <div className="flex flex-col gap-3">
                          <button
                            type="button"
                            disabled={shortIndex === 0}
                            onClick={() => setShortIndex((i) => Math.max(0, i - 1))}
                            aria-label="Reel précédent"
                            className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-md hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <ChevronUp className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                          </button>
                          <button
                            type="button"
                            disabled={shortIndex >= shortVideos.length - 1}
                            onClick={() =>
                              setShortIndex((i) => Math.min(shortVideos.length - 1, i + 1))
                            }
                            aria-label="Reel suivant"
                            className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-md hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <ChevronDown className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Playlist Queue */}
                    <div className="lg:col-span-5 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        File de lecture Reels ({shortVideos.length})
                      </h4>
                      <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                        {shortVideos.map((vid, idx) => (
                          <button
                            key={vid.id}
                            type="button"
                            onClick={() => setShortIndex(idx)}
                            className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                              idx === shortIndex
                                ? 'border-[#1D4ED8] bg-blue-50/80 dark:bg-blue-950/50 shadow-sm'
                                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#1D4ED8]/60'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#04112B] to-[#1D4ED8] text-white flex items-center justify-center font-bold text-xs shrink-0">
                              #{idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[#061A40] dark:text-white truncate">
                                {vid.authorName}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                {vid.content}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'events' && (
            <div className="space-y-6">
              {eventsError && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">
                  {eventsError}
                </div>
              )}

              {eventsLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1D4ED8]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                      Événements &amp; Retransmissions en direct
                    </h3>
                    {!eventsData || eventsData.events.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] p-7 text-center space-y-3">
                        <Calendar className="w-8 h-8 mx-auto text-[#1D4ED8]" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Aucun événement ponctuel planifié actuellement. Consultez le programme
                          hebdomadaire ci-contre.
                        </p>
                      </div>
                    ) : (
                      eventsData.events.map((ev) => (
                        <article
                          key={ev.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                              {formatDateTime(ev.startsAt)}
                            </span>
                            {ev.isLive && (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                                <Radio className="w-3.5 h-3.5" />
                                En direct
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-bold text-[#061A40] dark:text-white">
                            {ev.title}
                          </h4>
                          {ev.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {ev.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <span className="text-slate-500 inline-flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              {ev.location || 'Sanctuaire'} · {ev.registrationsCount} inscrits
                            </span>
                            <div className="flex items-center gap-2">
                              {ev.streamUrl && (
                                <button
                                  type="button"
                                  onClick={() => setStreamPreviewUrl(ev.streamUrl)}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 text-[#1D4ED8]" />
                                  Voir le direct
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenAuth('register', { churchId: ev.churchId })}
                                className="px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] text-white font-semibold cursor-pointer"
                              >
                                Réserver mon billet QR
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  {/* Weekly Schedule Card */}
                  <aside className="lg:col-span-5 rounded-2xl bg-[#061A40] text-white p-6 space-y-5 self-start">
                    <div>
                      <p className="text-xs font-semibold text-[#F5B82E]">
                        Horaires hebdomadaires
                      </p>
                      <h3 className="mt-1 text-xl font-bold">
                        {eventsData?.churchName || selectedChurch?.name}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {(eventsData?.serviceSchedule || selectedChurch?.serviceSchedule || []).map(
                        (item, idx) => (
                          <div
                            key={idx}
                            className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0 flex items-start justify-between gap-3"
                          >
                            <div>
                              <p className="text-sm font-semibold">{item.title}</p>
                              <p className="text-xs text-blue-200/80">
                                {item.location || 'Paroisse'}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-[#F5B82E] whitespace-nowrap tabular-nums">
                              {item.day} · {item.time}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('register', { churchId: selectedChurchId })}
                      className="w-full h-11 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-sm font-semibold cursor-pointer"
                    >
                      S'inscrire à la paroisse
                    </button>
                  </aside>
                </div>
              )}

              {streamPreviewUrl && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center justify-between text-xs text-white border-b border-white/10">
                    <span className="font-semibold">Lecteur retransmission vidéo</span>
                    <button
                      type="button"
                      onClick={() => setStreamPreviewUrl(null)}
                      className="text-slate-300 hover:text-white cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>
                  <div className="aspect-video">
                    {(() => {
                      const parsed = parseVideoMedia(streamPreviewUrl);
                      return parsed.kind === 'embed' && parsed.embedUrl ? (
                        <iframe
                          src={parsed.embedUrl}
                          title="Retransmission paroissiale"
                          className="w-full h-full"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={parsed.rawUrl}
                          controls
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'visitor' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-4">
                <p className="text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                  Accueil fraternel &amp; Écoute
                </p>
                <h3 className="text-2xl font-bold text-[#061A40] dark:text-white">
                  Annoncez votre visite ou confiez une intention de prière
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Votre message est transmis directement à l’équipe pastorale et d’accueil de{' '}
                  <strong>{selectedChurch?.name}</strong> afin d’assurer un suivi fraternel et
                  confidentiel.
                </p>
                <div className="rounded-2xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-[#061A40] dark:text-white">
                    Vous souhaitez créer un compte membre complet ?
                  </p>
                  <p>
                    Accédez au réseau social chrétien, aux dons transparents, aux messages temps
                    réel et au suivi biblique.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register', { churchId: selectedChurchId })}
                    className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                  >
                    Créer mon compte membre
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleVisitorSubmit}
                className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4"
              >
                {visitorError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
                    {visitorError}
                  </div>
                )}
                {visitorSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{visitorSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Marie-Claire Konan"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Objet de votre démarche
                    </label>
                    <select
                      value={interestType}
                      onChange={(e) => setInterestType(e.target.value as typeof interestType)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="visite">Première visite à la paroisse</option>
                      <option value="priere">Intention de prière</option>
                      <option value="benevolat">Rejoindre les bénévoles CHARITAS</option>
                      <option value="renseignement">Renseignement pastoral</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Adresse email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="marie@exemple.ci"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Votre message ou intention de prière
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Partagez votre besoin, vos disponibilités ou votre intention..."
                    className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingVisitor}
                  className="w-full h-11 rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#1E40AF] hover:to-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submittingVisitor ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Envoyer à l’équipe d’accueil
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Story Modal */}
      {activeStory && (
        <div
          className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setActiveStory(null)}
        >
          <div
            className="max-w-sm w-full rounded-2xl p-8 text-white space-y-4 relative shadow-2xl"
            style={{ backgroundColor: activeStory.backgroundColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveStory(null)}
              aria-label="Fermer la story"
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/30 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs font-semibold opacity-80">{activeStory.authorName}</p>
            <p className="text-xl font-semibold leading-snug">{activeStory.caption}</p>
            <p className="text-[11px] opacity-75">
              Expire le {formatDateTime(activeStory.expiresAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
