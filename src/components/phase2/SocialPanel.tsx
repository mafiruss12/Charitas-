import React, { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Film,
  Flag,
  Heart,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Share2,
  ShieldAlert,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type {
  CommunityGroupItem,
  ContentReportItem,
  SocialCommentItem,
  SocialPostItem,
  SocialStoryItem,
} from '../../types/platform';
import { ResilientImage } from '../ResilientImage';

interface SocialPanelProps {
  churchId: number;
  canPost: boolean;
  canModerate: boolean;
}

export const SocialPanel: React.FC<SocialPanelProps> = ({ churchId, canPost, canModerate }) => {
  const [subTab, setSubTab] = useState<'feed' | 'shorts' | 'groups' | 'moderation'>('feed');
  const [posts, setPosts] = useState<SocialPostItem[]>([]);
  const [stories, setStories] = useState<SocialStoryItem[]>([]);
  const [groups, setGroups] = useState<CommunityGroupItem[]>([]);
  const [reports, setReports] = useState<ContentReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeHashtag, setActiveHashtag] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const [postType, setPostType] = useState<'text' | 'photo' | 'video' | 'short_video' | 'poll'>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('Oui, je participe\nJe prie depuis la maison');
  const [publishing, setPublishing] = useState(false);

  const [storyCaption, setStoryCaption] = useState('');
  const [storyBg, setStoryBg] = useState('#1E3A5F');
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [activeStory, setActiveStory] = useState<SocialStoryItem | null>(null);

  const [openCommentsPostId, setOpenCommentsPostId] = useState<number | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, SocialCommentItem[]>>({});
  const [commentInput, setCommentInput] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  const [profileModal, setProfileModal] = useState<{
    userId: number;
    fullName: string;
    city: string | null;
    bio: string | null;
    role: string;
    leadershipTitle: string | null;
    followersCount: number;
    postsCount: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (subTab === 'shorts') params.set('type', 'short_video');
      if (search.trim()) params.set('search', search.trim());
      if (activeHashtag) params.set('hashtag', activeHashtag);
      if (selectedGroupId) params.set('groupId', String(selectedGroupId));
      if (bookmarkedOnly) params.set('bookmarked', 'true');

      const [postsRes, storiesRes, groupsRes] = await Promise.all([
        apiFetch<{ posts: SocialPostItem[] }>(`/api/churches/${churchId}/social/posts?${params.toString()}`),
        apiFetch<{ stories: SocialStoryItem[] }>(`/api/churches/${churchId}/social/stories`),
        apiFetch<{ groups: CommunityGroupItem[] }>(`/api/churches/${churchId}/social/groups`),
      ]);
      setPosts(postsRes.posts);
      setStories(storiesRes.stories);
      setGroups(groupsRes.groups);

      if (canModerate) {
        const repRes = await apiFetch<{ reports: ContentReportItem[] }>(
          `/api/churches/${churchId}/social/reports`
        );
        setReports(repRes.reports);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement social.');
    } finally {
      setLoading(false);
    }
  }, [churchId, subTab, search, activeHashtag, selectedGroupId, bookmarkedOnly, canModerate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPublishing(true);
    setError(null);
    try {
      const pollList =
        postType === 'poll'
          ? pollOptionsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      await apiFetch(`/api/churches/${churchId}/social/posts`, {
        method: 'POST',
        body: JSON.stringify({
          postType,
          content,
          mediaUrl: mediaUrl.trim() || undefined,
          groupId: selectedGroupId || undefined,
          pollOptionsList: pollList,
        }),
      });
      setContent('');
      setMediaUrl('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de publier.');
    } finally {
      setPublishing(false);
    }
  };

  const handleReact = async (postId: number, reactionType = 'amen') => {
    try {
      const res = await apiFetch<{ likesCount: number; myReaction: string | null }>(
        `/api/churches/${churchId}/social/posts/${postId}/react`,
        { method: 'POST', body: JSON.stringify({ reactionType }) }
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likesCount: res.likesCount, myReaction: res.myReaction } : p
        )
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur réaction.');
    }
  };

  const handleBookmark = async (postId: number) => {
    try {
      const res = await apiFetch<{ isBookmarked: boolean }>(
        `/api/churches/${churchId}/social/posts/${postId}/bookmark`,
        { method: 'POST' }
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isBookmarked: res.isBookmarked } : p))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur favori.');
    }
  };

  const handleShare = async (postId: number) => {
    try {
      const res = await apiFetch<{ sharesCount: number }>(
        `/api/churches/${churchId}/social/posts/${postId}/share`,
        { method: 'POST' }
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, sharesCount: res.sharesCount } : p))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur partage.');
    }
  };

  const handleVote = async (postId: number, optionId: number) => {
    try {
      const res = await apiFetch<{ pollOptions: SocialPostItem['pollOptions']; myPollOptionId: number }>(
        `/api/churches/${churchId}/social/posts/${postId}/vote`,
        { method: 'POST', body: JSON.stringify({ optionId }) }
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, pollOptions: res.pollOptions, myPollOptionId: res.myPollOptionId }
            : p
        )
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur vote.');
    }
  };

  const toggleComments = async (postId: number) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }
    setOpenCommentsPostId(postId);
    const res = await apiFetch<{ comments: SocialCommentItem[] }>(
      `/api/churches/${churchId}/social/posts/${postId}/comments`
    );
    setCommentsByPost((prev) => ({ ...prev, [postId]: res.comments }));
  };

  const handleAddComment = async (postId: number) => {
    if (!commentInput.trim()) return;
    const res = await apiFetch<{ comment: SocialCommentItem }>(
      `/api/churches/${churchId}/social/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify({ content: commentInput }) }
    );
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), res.comment],
    }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
    );
    setCommentInput('');
  };

  const handleFollow = async (targetUserId: number) => {
    const res = await apiFetch<{ following: boolean }>(
      `/api/churches/${churchId}/social/users/${targetUserId}/follow`,
      { method: 'POST' }
    );
    setPosts((prev) =>
      prev.map((p) =>
        p.authorUserId === targetUserId ? { ...p, isFollowingAuthor: res.following } : p
      )
    );
  };

  const openProfile = async (targetUserId: number) => {
    const res = await apiFetch<{ profile: NonNullable<typeof profileModal> }>(
      `/api/churches/${churchId}/social/users/${targetUserId}/profile`
    );
    setProfileModal(res.profile);
  };

  const handleReportPost = async (postId: number) => {
    const reason = window.prompt('Motif du signalement :');
    if (!reason || !reason.trim()) return;
    await apiFetch(`/api/churches/${churchId}/social/reports`, {
      method: 'POST',
      body: JSON.stringify({ targetType: 'post', targetId: postId, reason }),
    });
    if (canModerate) await loadData();
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyCaption.trim()) return;
    await apiFetch(`/api/churches/${churchId}/social/stories`, {
      method: 'POST',
      body: JSON.stringify({ caption: storyCaption, backgroundColor: storyBg }),
    });
    setStoryCaption('');
    setStoryModalOpen(false);
    await loadData();
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    await apiFetch(`/api/churches/${churchId}/social/groups`, {
      method: 'POST',
      body: JSON.stringify({ name: groupName, description: groupDesc }),
    });
    setGroupName('');
    setGroupDesc('');
    await loadData();
  };

  const handleJoinGroup = async (groupId: number) => {
    await apiFetch(`/api/churches/${churchId}/social/groups/${groupId}/join`, { method: 'POST' });
    await loadData();
  };

  const handleModerate = async (reportId: number, hidePost: boolean) => {
    await apiFetch(`/api/churches/${churchId}/social/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: hidePost ? 'action_taken' : 'dismissed', hidePost }),
    });
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-white">
            Réseau Social Communautaire
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Fil fraternel, stories 24h, vidéos courtes verticales, sondages et groupes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'feed', label: 'Fil communautaire' },
            { id: 'shorts', label: 'Vidéos courtes' },
            { id: 'groups', label: 'Groupes' },
            ...(canModerate ? [{ id: 'moderation', label: `Modération (${reports.filter((r) => r.status === 'pending').length})` }] : []),
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id as typeof subTab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                subTab === item.id
                  ? 'bg-slate-900 text-white dark:bg-amber-600'
                  : 'border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {(subTab === 'feed' || subTab === 'shorts') && (
        <>
          {/* Stories 24h Bar */}
          <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                Stories éphémères (24h)
              </p>
              {canPost && (
                <button
                  type="button"
                  onClick={() => setStoryModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-400 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Publier une story
                </button>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {stories.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  Aucune story active dans les dernières 24 heures.
                </p>
              ) : (
                stories.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveStory(s)}
                    className="w-36 shrink-0 rounded-xl p-3 text-left text-white cursor-pointer transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: s.backgroundColor }}
                  >
                    <p className="text-[11px] font-semibold opacity-80 truncate">{s.authorName}</p>
                    <p className="mt-2 text-xs font-medium line-clamp-2">{s.caption}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une publication ou un thème..."
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setBookmarkedOnly((v) => !v)}
              className={`h-10 px-3.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                bookmarkedOnly
                  ? 'bg-amber-700 text-white'
                  : 'border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Favoris
            </button>
            {activeHashtag && (
              <button
                type="button"
                onClick={() => setActiveHashtag('')}
                className="h-10 px-3 rounded-lg bg-stone-200 dark:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                #{activeHashtag}
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {selectedGroupId && (
              <button
                type="button"
                onClick={() => setSelectedGroupId(null)}
                className="h-10 px-3 rounded-lg bg-stone-200 dark:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                Groupe filtré
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Composer */}
          {canPost && (
            <form
              onSubmit={handleCreatePost}
              className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'text', label: 'Texte', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                  { id: 'photo', label: 'Photo', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                  { id: 'video', label: 'Vidéo', icon: <Video className="w-3.5 h-3.5" /> },
                  { id: 'short_video', label: 'Vidéo courte (9:16)', icon: <Film className="w-3.5 h-3.5" /> },
                  { id: 'poll', label: 'Sondage', icon: <ListChecks className="w-3.5 h-3.5" /> },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPostType(t.id as typeof postType)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                      postType === t.id
                        ? 'bg-slate-900 text-white dark:bg-amber-600'
                        : 'border border-stone-200 dark:border-slate-700'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Partagez une exhortation, un témoignage ou une annonce (#prière #jeunesse)..."
                className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
              />

              {(postType === 'photo' || postType === 'video' || postType === 'short_video') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder={
                      postType === 'photo'
                        ? "URL de l'image ou sélectionnez un fichier"
                        : 'URL de la vidéo MP4/YouTube'
                    }
                    className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  {postType === 'photo' && (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setMediaUrl(String(reader.result || ''));
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs self-center"
                    />
                  )}
                </div>
              )}

              {postType === 'poll' && (
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-slate-400 mb-1">
                    Options du sondage (une par ligne)
                  </label>
                  <textarea
                    rows={3}
                    value={pollOptionsText}
                    onChange={(e) => setPollOptionsText(e.target.value)}
                    className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={publishing || !content.trim()}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {publishing ? 'Publication...' : 'Publier'}
                </button>
              </div>
            </form>
          )}

          {/* Feed List */}
          {loading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-stone-500">
              Aucune publication trouvée pour ces critères.
            </div>
          ) : (
            <div
              className={
                subTab === 'shorts'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-5'
              }
            >
              {posts.map((post) => {
                const totalPollVotes = post.pollOptions.reduce((sum, o) => sum + o.votesCount, 0);
                return (
                  <article
                    key={post.id}
                    className={`rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 ${
                      post.postType === 'short_video' && subTab === 'shorts'
                        ? 'flex flex-col justify-between min-h-[420px] bg-slate-950 text-white border-slate-800'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openProfile(post.authorUserId)}
                        className="flex items-center gap-3 text-left cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full bg-amber-800/15 text-amber-800 dark:text-amber-400 flex items-center justify-center font-semibold text-xs">
                          {post.authorName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold hover:underline">{post.authorName}</p>
                          <p className="text-[11px] text-stone-500 dark:text-slate-400">
                            {new Date(post.createdAt).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFollow(post.authorUserId)}
                          className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-slate-700 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          {post.isFollowingAuthor ? 'Abonné' : 'Suivre'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReportPost(post.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 cursor-pointer"
                          title="Signaler"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

                    {post.mediaUrl && post.postType === 'photo' && (
                      <div className="rounded-lg overflow-hidden max-h-96 border border-stone-200 dark:border-slate-800">
                        <ResilientImage
                          src={post.mediaUrl}
                          alt="Publication photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {post.mediaUrl && (post.postType === 'video' || post.postType === 'short_video') && (
                      <div
                        className={`rounded-lg overflow-hidden bg-black ${
                          post.postType === 'short_video' ? 'aspect-[9/16] max-h-80 mx-auto' : 'aspect-video'
                        }`}
                      >
                        <video src={post.mediaUrl} controls className="w-full h-full object-cover" />
                      </div>
                    )}

                    {post.postType === 'poll' && post.pollOptions.length > 0 && (
                      <div className="space-y-2">
                        {post.pollOptions.map((opt) => {
                          const pct = totalPollVotes
                            ? Math.round((opt.votesCount / totalPollVotes) * 100)
                            : 0;
                          const selected = post.myPollOptionId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={post.myPollOptionId !== null}
                              onClick={() => handleVote(post.id, opt.id)}
                              className={`w-full text-left p-2.5 rounded-lg border text-xs relative overflow-hidden cursor-pointer ${
                                selected
                                  ? 'border-amber-600 font-semibold'
                                  : 'border-stone-200 dark:border-slate-700'
                              }`}
                            >
                              <div
                                className="absolute inset-y-0 left-0 bg-amber-600/15"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative flex justify-between">
                                <span>{opt.label}</span>
                                <span className="font-mono-tabular">
                                  {opt.votesCount} ({pct}%)
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.hashtags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setActiveHashtag(tag)}
                            className="text-xs font-medium text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => handleReact(post.id, 'amen')}
                          className={`inline-flex items-center gap-1.5 font-medium cursor-pointer ${
                            post.myReaction ? 'text-amber-700 dark:text-amber-400' : 'text-stone-500'
                          }`}
                        >
                          <Heart className="w-4 h-4" />
                          Amen ({post.likesCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleComments(post.id)}
                          className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Commenter ({post.commentsCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShare(post.id)}
                          className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                        >
                          <Share2 className="w-4 h-4" />
                          {post.sharesCount}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBookmark(post.id)}
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          post.isBookmarked ? 'text-amber-700 dark:text-amber-400' : 'text-stone-400'
                        }`}
                        title="Enregistrer en favori"
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>
                    </div>

                    {openCommentsPostId === post.id && (
                      <div className="pt-3 border-t border-stone-100 dark:border-slate-800 space-y-3">
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {(commentsByPost[post.id] || []).map((c) => (
                            <div
                              key={c.id}
                              className="p-2.5 rounded-lg bg-stone-50 dark:bg-slate-950 text-xs"
                            >
                              <span className="font-semibold">{c.authorName} : </span>
                              <span>{c.content}</span>
                            </div>
                          ))}
                        </div>
                        {canPost && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentInput}
                              onChange={(e) => setCommentInput(e.target.value)}
                              placeholder="Votre commentaire..."
                              className="flex-1 h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddComment(post.id)}
                              className="px-3.5 h-9 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                            >
                              Envoyer
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {subTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h3 className="text-base font-semibold mb-3">Créer un groupe communautaire</h3>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nom du groupe (ex: Intercession)"
                className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
              />
              <textarea
                rows={3}
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="Objectif et programme..."
                className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
              />
              <button
                type="submit"
                className="w-full h-10 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
              >
                Créer le groupe
              </button>
            </form>
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm">{g.name}</h4>
                    <span className="text-xs font-mono-tabular text-stone-500">
                      {g.membersCount} membres
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-600 dark:text-slate-400">
                    {g.description || 'Groupe de fraternité et d’entraide.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleJoinGroup(g.id)}
                    className={`flex-1 h-9 rounded-lg text-xs font-semibold cursor-pointer ${
                      g.isMember
                        ? 'border border-stone-300 dark:border-slate-700'
                        : 'bg-slate-900 text-white dark:bg-amber-600'
                    }`}
                  >
                    {g.isMember ? 'Quitter' : 'Rejoindre'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(g.id);
                      setSubTab('feed');
                    }}
                    className="px-3 h-9 rounded-lg border border-stone-200 dark:border-slate-700 text-xs cursor-pointer"
                  >
                    Voir le fil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'moderation' && canModerate && (
        <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <h3 className="text-base font-semibold">Signalements communautaires</h3>
          </div>
          {reports.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun signalement enregistré.</p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-slate-800">
              {reports.map((rep) => (
                <div key={rep.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">
                      {rep.targetType} #{rep.targetId} · {rep.reason}
                    </p>
                    <p className="text-xs text-stone-500">
                      Signalé par {rep.reporterName} · Statut : {rep.status}
                    </p>
                  </div>
                  {rep.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleModerate(rep.id, true)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Masquer le contenu
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModerate(rep.id, false)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 text-xs cursor-pointer"
                      >
                        Classer sans suite
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Story Create Modal */}
      {storyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Nouvelle Story (24h)</h3>
              <button type="button" onClick={() => setStoryModalOpen(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateStory} className="space-y-3">
              <textarea
                rows={3}
                value={storyCaption}
                onChange={(e) => setStoryCaption(e.target.value)}
                placeholder="Votre pensée du jour ou moment de louange..."
                className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
              />
              <div className="flex items-center gap-3">
                <span className="text-xs">Couleur de fond :</span>
                {['#1E3A5F', '#7C2D12', '#14532D', '#4C1D95'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStoryBg(c)}
                    className={`w-6 h-6 rounded-full cursor-pointer ${
                      storyBg === c ? 'ring-2 ring-offset-2 ring-amber-600' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="w-full h-10 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
              >
                Publier la story
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Active Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div
            className="max-w-sm w-full rounded-2xl p-8 text-white space-y-4 relative"
            style={{ backgroundColor: activeStory.backgroundColor }}
          >
            <button
              type="button"
              onClick={() => setActiveStory(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/30 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs font-semibold opacity-80">{activeStory.authorName}</p>
            <p className="font-display text-2xl leading-snug">{activeStory.caption}</p>
            <p className="text-[11px] opacity-70">
              Expire le {new Date(activeStory.expiresAt).toLocaleString('fr-FR')}
            </p>
          </div>
        </div>
      )}

      {/* Public Profile Modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">{profileModal.fullName}</h3>
              <button type="button" onClick={() => setProfileModal(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500">
              {profileModal.leadershipTitle || profileModal.role}
              {profileModal.city ? ` · ${profileModal.city}` : ''}
            </p>
            <p className="text-sm text-stone-700 dark:text-slate-300">
              {profileModal.bio || 'Membre actif de la communauté.'}
            </p>
            <div className="flex gap-6 pt-2 text-xs font-mono-tabular">
              <span>{profileModal.followersCount} abonnés</span>
              <span>{profileModal.postsCount} publications</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
