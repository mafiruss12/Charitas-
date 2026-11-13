import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Flame,
  Headphones,
  HeartHandshake,
  Loader2,
  Lock,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { BibleBook } from '../../data/bible-fr';
import { apiFetch } from '../../lib/api';
import type {
  BibleQuizItem,
  PrayerRequestItem,
  ReadingPlanItem,
  SpiritualContentItem,
  SpiritualJournalEntry,
  TestimonyItem,
} from '../../types/platform';

interface SpiritualPanelProps {
  churchId: number;
  canPublish: boolean;
}

export const SpiritualPanel: React.FC<SpiritualPanelProps> = ({ churchId, canPublish }) => {
  const [subTab, setSubTab] = useState<
    'overview' | 'bible' | 'plans' | 'journal' | 'prayers' | 'sermons' | 'quiz'
  >('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dailyVerse, setDailyVerse] = useState<SpiritualContentItem | null>(null);
  const [meditations, setMeditations] = useState<SpiritualContentItem[]>([]);
  const [sermons, setSermons] = useState<SpiritualContentItem[]>([]);
  const [podcasts, setPodcasts] = useState<SpiritualContentItem[]>([]);
  const [readingPlans, setReadingPlans] = useState<ReadingPlanItem[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequestItem[]>([]);
  const [testimonies, setTestimonies] = useState<TestimonyItem[]>([]);
  const [quizzes, setQuizzes] = useState<BibleQuizItem[]>([]);

  const [books, setBooks] = useState<BibleBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState('PSA');
  const [selectedChapter, setSelectedChapter] = useState(23);
  const [bibleSearch, setBibleSearch] = useState('');
  const [searchResults, setSearchResults] = useState<
    { reference: string; text: string; bookId: string; chapter: number; verse: number }[]
  >([]);
  const [bibleBookmarks, setBibleBookmarks] = useState<
    { id: number; reference: string; verseText: string }[]
  >([]);

  const [journalEntries, setJournalEntries] = useState<SpiritualJournalEntry[]>([]);
  const [jTitle, setJTitle] = useState('');
  const [jRef, setJRef] = useState('');
  const [jContent, setJContent] = useState('');

  const [pTitle, setPTitle] = useState('');
  const [pContent, setPContent] = useState('');
  const [pAnon, setPAnon] = useState(false);

  const [tTitle, setTTitle] = useState('');
  const [tContent, setTContent] = useState('');

  const [pubKind, setPubKind] = useState<'daily_verse' | 'meditation' | 'sermon' | 'podcast'>('meditation');
  const [pubTitle, setPubTitle] = useState('');
  const [pubRef, setPubRef] = useState('');
  const [pubContent, setPubContent] = useState('');
  const [pubMedia, setPubMedia] = useState('');

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number[]>>({});
  const [quizFeedback, setQuizFeedback] = useState<
    Record<
      number,
      {
        score: number;
        totalQuestions: number;
        corrections: { question: string; isCorrect: boolean; reference: string }[];
      }
    >
  >({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, bib, jrn] = await Promise.all([
        apiFetch<{
          dailyVerse: SpiritualContentItem | null;
          meditations: SpiritualContentItem[];
          sermons: SpiritualContentItem[];
          podcasts: SpiritualContentItem[];
          readingPlans: ReadingPlanItem[];
          prayers: PrayerRequestItem[];
          testimonies: TestimonyItem[];
          quizzes: BibleQuizItem[];
        }>(`/api/churches/${churchId}/spiritual/overview`),
        apiFetch<{
          books: BibleBook[];
          bookmarks: { id: number; reference: string; verseText: string }[];
        }>(`/api/churches/${churchId}/spiritual/bible`),
        apiFetch<{ entries: SpiritualJournalEntry[] }>(`/api/churches/${churchId}/spiritual/journal`),
      ]);
      setDailyVerse(ov.dailyVerse);
      setMeditations(ov.meditations);
      setSermons(ov.sermons);
      setPodcasts(ov.podcasts);
      setReadingPlans(ov.readingPlans);
      setPrayers(ov.prayers);
      setTestimonies(ov.testimonies);
      setQuizzes(ov.quizzes);
      setBooks(bib.books);
      setBibleBookmarks(bib.bookmarks);
      setJournalEntries(jrn.entries);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur vie spirituelle.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleBibleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{
      searchResults: { reference: string; text: string; bookId: string; chapter: number; verse: number }[];
    }>(`/api/churches/${churchId}/spiritual/bible?q=${encodeURIComponent(bibleSearch)}`);
    setSearchResults(res.searchResults);
  };

  const handleToggleVerseBookmark = async (reference: string, verseText: string) => {
    await apiFetch(`/api/churches/${churchId}/spiritual/bookmarks`, {
      method: 'POST',
      body: JSON.stringify({ reference, verseText }),
    });
    const bib = await apiFetch<{
      bookmarks: { id: number; reference: string; verseText: string }[];
    }>(`/api/churches/${churchId}/spiritual/bible`);
    setBibleBookmarks(bib.bookmarks);
  };

  const handleTogglePlanDay = async (planId: number, day: number) => {
    const res = await apiFetch<{ completedDays: number[] }>(
      `/api/churches/${churchId}/spiritual/reading-plans/${planId}/toggle-day`,
      { method: 'POST', body: JSON.stringify({ day }) }
    );
    setReadingPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, completedDays: res.completedDays } : p))
    );
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jTitle.trim() || !jContent.trim()) return;
    await apiFetch(`/api/churches/${churchId}/spiritual/journal`, {
      method: 'POST',
      body: JSON.stringify({ title: jTitle, scriptureRef: jRef, content: jContent }),
    });
    setJTitle('');
    setJRef('');
    setJContent('');
    await loadAll();
  };

  const handleDeleteJournal = async (entryId: number) => {
    await apiFetch(`/api/churches/${churchId}/spiritual/journal/${entryId}`, { method: 'DELETE' });
    setJournalEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const handleAddPrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pTitle.trim() || !pContent.trim()) return;
    await apiFetch(`/api/churches/${churchId}/spiritual/prayers`, {
      method: 'POST',
      body: JSON.stringify({ title: pTitle, content: pContent, isAnonymous: pAnon }),
    });
    setPTitle('');
    setPContent('');
    await loadAll();
  };

  const handlePrayToggle = async (prayerId: number) => {
    const res = await apiFetch<{ hasPrayed: boolean; prayCount: number }>(
      `/api/churches/${churchId}/spiritual/prayers/${prayerId}/pray`,
      { method: 'POST' }
    );
    setPrayers((prev) =>
      prev.map((p) =>
        p.id === prayerId ? { ...p, hasPrayed: res.hasPrayed, prayCount: res.prayCount } : p
      )
    );
  };

  const handleAddTestimony = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim() || !tContent.trim()) return;
    await apiFetch(`/api/churches/${churchId}/spiritual/testimonies`, {
      method: 'POST',
      body: JSON.stringify({ title: tTitle, content: tContent }),
    });
    setTTitle('');
    setTContent('');
    await loadAll();
  };

  const handlePublishContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubTitle.trim() || !pubContent.trim()) return;
    await apiFetch(`/api/churches/${churchId}/spiritual/contents`, {
      method: 'POST',
      body: JSON.stringify({
        kind: pubKind,
        title: pubTitle,
        scriptureRef: pubRef,
        content: pubContent,
        mediaUrl: pubMedia,
      }),
    });
    setPubTitle('');
    setPubRef('');
    setPubContent('');
    setPubMedia('');
    await loadAll();
  };

  const handleSubmitQuiz = async (quiz: BibleQuizItem) => {
    const answers = quizAnswers[quiz.id] || [];
    const res = await apiFetch<{
      score: number;
      totalQuestions: number;
      corrections: { question: string; isCorrect: boolean; reference: string }[];
    }>(`/api/churches/${churchId}/spiritual/quizzes/${quiz.id}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    setQuizFeedback((prev) => ({ ...prev, [quiz.id]: res }));
    await loadAll();
  };

  const currentBook = books.find((b) => b.id === selectedBookId) || books[0];
  const currentChapterObj =
    currentBook?.chapters.find((c) => c.chapter === selectedChapter) || currentBook?.chapters[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-white">
            Vie Spirituelle & Parole
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Bible numérique, méditations, plans de lecture, journal privé, mur de prière et quiz.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Verset & Méditations' },
            { id: 'bible', label: 'Bible numérique' },
            { id: 'plans', label: 'Plans de lecture' },
            { id: 'journal', label: 'Journal privé' },
            { id: 'prayers', label: 'Prière & Témoignages' },
            { id: 'sermons', label: 'Prédications & Podcasts' },
            { id: 'quiz', label: 'Quiz biblique' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                subTab === t.id
                  ? 'bg-slate-900 text-white dark:bg-amber-600'
                  : 'border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" />
        </div>
      ) : (
        <>
          {subTab === 'overview' && (
            <div className="space-y-6">
              {dailyVerse && (
                <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
                  <p className="text-xs font-semibold text-amber-400">
                    Verset du jour · {dailyVerse.scriptureRef}
                  </p>
                  <blockquote className="mt-3 font-display text-2xl sm:text-3xl leading-snug">
                    « {dailyVerse.content} »
                  </blockquote>
                  <p className="mt-3 text-xs text-stone-300">{dailyVerse.title}</p>
                </div>
              )}

              {canPublish && (
                <form
                  onSubmit={handlePublishContent}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <h3 className="text-sm font-semibold">Publier un contenu spirituel</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={pubKind}
                      onChange={(e) => setPubKind(e.target.value as typeof pubKind)}
                      className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    >
                      <option value="meditation">Méditation</option>
                      <option value="daily_verse">Verset quotidien</option>
                      <option value="sermon">Prédication</option>
                      <option value="podcast">Podcast</option>
                    </select>
                    <input
                      type="text"
                      value={pubTitle}
                      onChange={(e) => setPubTitle(e.target.value)}
                      placeholder="Titre"
                      className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <input
                      type="text"
                      value={pubRef}
                      onChange={(e) => setPubRef(e.target.value)}
                      placeholder="Référence (ex: Jean 3:16)"
                      className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={pubContent}
                    onChange={(e) => setPubContent(e.target.value)}
                    placeholder="Texte de la méditation ou résumé..."
                    className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <div className="flex flex-wrap gap-3 justify-between items-center">
                    <input
                      type="url"
                      value={pubMedia}
                      onChange={(e) => setPubMedia(e.target.value)}
                      placeholder="URL audio/vidéo (optionnel)"
                      className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                    >
                      Publier
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meditations.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-400 font-semibold">
                      <span>{m.scriptureRef || 'Méditation'}</span>
                      <span className="font-mono-tabular text-stone-400">{m.publishedDate}</span>
                    </div>
                    <h4 className="font-display text-xl font-semibold">{m.title}</h4>
                    <p className="text-sm text-stone-600 dark:text-slate-300 leading-relaxed">
                      {m.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'bible' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                <form onSubmit={handleBibleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={bibleSearch}
                      onChange={(e) => setBibleSearch(e.target.value)}
                      placeholder="Rechercher un mot-clé dans la Bible (ex: paix, berger, charité)..."
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 h-10 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    Rechercher
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                      {searchResults.length} résultat(s) trouvé(s)
                    </p>
                    {searchResults.map((r) => (
                      <div key={r.reference} className="text-xs space-y-0.5">
                        <span className="font-semibold">{r.reference} : </span>
                        <span>{r.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedBookId}
                    onChange={(e) => {
                      const nextBook = books.find((b) => b.id === e.target.value);
                      setSelectedBookId(e.target.value);
                      if (nextBook?.chapters[0]) setSelectedChapter(nextBook.chapters[0].chapter);
                    }}
                    className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.testament})
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(Number(e.target.value))}
                    className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  >
                    {currentBook?.chapters.map((ch) => (
                      <option key={ch.chapter} value={ch.chapter}>
                        Chapitre {ch.chapter}
                      </option>
                    ))}
                  </select>
                </div>

                {currentChapterObj && (
                  <div className="space-y-3 pt-2">
                    <h3 className="font-display text-2xl font-semibold">
                      {currentBook?.name} {currentChapterObj.chapter} (Louis Segond)
                    </h3>
                    {currentChapterObj.verses.map((v) => {
                      const ref = `${currentBook?.name} ${currentChapterObj.chapter}:${v.verse}`;
                      const isSaved = bibleBookmarks.some((b) => b.reference === ref);
                      return (
                        <div
                          key={v.verse}
                          className="p-3 rounded-lg hover:bg-stone-50 dark:hover:bg-slate-950 flex items-start justify-between gap-3"
                        >
                          <p className="text-sm leading-relaxed">
                            <span className="font-mono-tabular font-semibold text-amber-800 dark:text-amber-400 mr-2">
                              {v.verse}
                            </span>
                            {v.text}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleToggleVerseBookmark(ref, v.text)}
                            className={`p-1.5 rounded cursor-pointer shrink-0 ${
                              isSaved ? 'text-amber-700 dark:text-amber-400' : 'text-stone-400'
                            }`}
                            title="Ajouter aux favoris"
                          >
                            <Bookmark className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <h3 className="text-sm font-semibold">Versets favoris</h3>
                </div>
                {bibleBookmarks.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    Cliquez sur l’icône marque-page d’un verset pour le conserver ici.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bibleBookmarks.map((b) => (
                      <div key={b.id} className="p-3 rounded-lg bg-stone-50 dark:bg-slate-950 text-xs space-y-1">
                        <p className="font-semibold text-amber-800 dark:text-amber-400">{b.reference}</p>
                        <p>{b.verseText}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {subTab === 'plans' && (
            <div className="space-y-4">
              {readingPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-2xl font-semibold">{plan.title}</h3>
                      <p className="text-xs text-stone-500">{plan.description}</p>
                    </div>
                    <span className="text-xs font-mono-tabular font-semibold text-amber-800 dark:text-amber-400">
                      {plan.completedDays.length} / {plan.days.length} jours validés
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {plan.days.map((d) => {
                      const done = plan.completedDays.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => handleTogglePlanDay(plan.id, d.day)}
                          className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                            done
                              ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                              : 'border-stone-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">
                              Jour {d.day} · {d.title}
                            </span>
                            {done && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">{d.scripture}</p>
                          <p className="text-xs text-stone-600 dark:text-slate-400 mt-1">{d.reflection}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {subTab === 'journal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Lock className="w-4 h-4" />
                  Espace strictement privé (isolé par RLS pour votre compte uniquement)
                </div>
                <form onSubmit={handleAddJournal} className="space-y-3">
                  <input
                    type="text"
                    value={jTitle}
                    onChange={(e) => setJTitle(e.target.value)}
                    placeholder="Titre de votre note spirituelle"
                    className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <input
                    type="text"
                    value={jRef}
                    onChange={(e) => setJRef(e.target.value)}
                    placeholder="Passage médité (optionnel)"
                    className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <textarea
                    rows={5}
                    value={jContent}
                    onChange={(e) => setJContent(e.target.value)}
                    placeholder="Écrivez vos prières, engagements et révélations..."
                    className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full h-10 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    Enregistrer dans mon journal
                  </button>
                </form>
              </div>
              <div className="lg:col-span-7 space-y-3">
                {journalEntries.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-stone-500">
                    Aucune note dans votre journal spirituel personnel.
                  </div>
                ) : (
                  journalEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-sm">{entry.title}</h4>
                          <p className="text-xs text-stone-400">
                            {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
                            {entry.scriptureRef ? ` · ${entry.scriptureRef}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteJournal(entry.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-stone-700 dark:text-slate-300 whitespace-pre-wrap">
                        {entry.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {subTab === 'prayers' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-4">
                <form
                  onSubmit={handleAddPrayer}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-700" />
                    Déposer un sujet sur le mur de prière
                  </h3>
                  <input
                    type="text"
                    value={pTitle}
                    onChange={(e) => setPTitle(e.target.value)}
                    placeholder="Sujet de prière"
                    className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <textarea
                    rows={3}
                    value={pContent}
                    onChange={(e) => setPContent(e.target.value)}
                    placeholder="Partagez votre requête..."
                    className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={pAnon}
                      onChange={(e) => setPAnon(e.target.checked)}
                    />
                    Publier de manière anonyme
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    Publier la requête
                  </button>
                </form>

                <div className="space-y-3">
                  {prayers.map((pr) => (
                    <div
                      key={pr.id}
                      className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{pr.title}</h4>
                        <span className="text-[11px] text-stone-400">{pr.authorName}</span>
                      </div>
                      <p className="text-sm text-stone-600 dark:text-slate-300">{pr.content}</p>
                      <button
                        type="button"
                        onClick={() => handlePrayToggle(pr.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                          pr.hasPrayed
                            ? 'bg-amber-700 text-white'
                            : 'border border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        J’ai prié ({pr.prayCount})
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4">
                <form
                  onSubmit={handleAddTestimony}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <h3 className="text-base font-semibold">Partager un témoignage</h3>
                  <input
                    type="text"
                    value={tTitle}
                    onChange={(e) => setTTitle(e.target.value)}
                    placeholder="Titre du témoignage"
                    className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <textarea
                    rows={3}
                    value={tContent}
                    onChange={(e) => setTContent(e.target.value)}
                    placeholder="Racontez ce que Dieu a accompli..."
                    className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    Partager le témoignage
                  </button>
                </form>

                <div className="space-y-3">
                  {testimonies.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{t.title}</h4>
                        <span className="text-[11px] text-stone-400">{t.authorName}</span>
                      </div>
                      <p className="text-sm text-stone-600 dark:text-slate-300">{t.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === 'sermons' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[...sermons, ...podcasts].map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-800 dark:text-amber-400 inline-flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5" />
                      {item.kind === 'podcast' ? 'Podcast' : 'Prédication'}
                    </span>
                    <span className="text-stone-400">{item.durationLabel || item.publishedDate}</span>
                  </div>
                  <h4 className="font-display text-xl font-semibold">{item.title}</h4>
                  {item.scriptureRef && (
                    <p className="text-xs font-medium text-stone-500">{item.scriptureRef}</p>
                  )}
                  <p className="text-sm text-stone-600 dark:text-slate-300">{item.content}</p>
                  {item.mediaUrl && (
                    <audio controls src={item.mediaUrl} className="w-full mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}

          {subTab === 'quiz' && (
            <div className="space-y-6">
              {quizzes.map((quiz) => {
                const selected = quizAnswers[quiz.id] || [];
                const fb = quizFeedback[quiz.id];
                return (
                  <div
                    key={quiz.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-2xl font-semibold">{quiz.title}</h3>
                        <p className="text-xs text-stone-500">{quiz.description}</p>
                      </div>
                      {quiz.bestScore !== null && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400">
                          <Award className="w-4 h-4" />
                          Meilleur score : {quiz.bestScore}/{quiz.questions.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      {quiz.questions.map((q, qIdx) => (
                        <div key={qIdx} className="p-4 rounded-xl bg-stone-50 dark:bg-slate-950 space-y-2">
                          <p className="text-sm font-semibold">
                            {qIdx + 1}. {q.question}
                          </p>
                          <div className="space-y-1.5">
                            {q.options.map((opt, optIdx) => (
                              <label key={optIdx} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={`quiz-${quiz.id}-q-${qIdx}`}
                                  checked={selected[qIdx] === optIdx}
                                  onChange={() => {
                                    const next = [...selected];
                                    next[qIdx] = optIdx;
                                    setQuizAnswers((prev) => ({ ...prev, [quiz.id]: next }));
                                  }}
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSubmitQuiz(quiz)}
                      className="px-5 py-2.5 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                    >
                      Valider mes réponses
                    </button>

                    {fb && (
                      <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                        <p className="text-sm font-semibold">
                          Score obtenu : {fb.score} / {fb.totalQuestions}
                        </p>
                        {fb.corrections.map((c, idx) => (
                          <p key={idx} className="text-xs">
                            Q{idx + 1} ({c.reference}) :{' '}
                            {c.isCorrect ? 'Correct' : 'À revoir'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
