import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  Play,
  Plus,
  Video,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { AcademyCourseItem, MediaLibraryItem } from '../../types/platform';

interface AcademyMediaPanelProps {
  churchId: number;
  canManageAcademy: boolean;
  canManageMedia: boolean;
}

export const AcademyMediaPanel: React.FC<AcademyMediaPanelProps> = ({
  churchId,
  canManageAcademy,
  canManageMedia,
}) => {
  const [subTab, setSubTab] = useState<'academy' | 'media'>('academy');
  const [courses, setCourses] = useState<AcademyCourseItem[]>([]);
  const [media, setMedia] = useState<MediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  const [showNewMedia, setShowNewMedia] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mType, setMType] = useState<'replay' | 'conference' | 'music' | 'teaching'>('replay');
  const [mUrl, setMUrl] = useState('');
  const [mSpeaker, setMSpeaker] = useState('');

  const [showNewCourse, setShowNewCourse] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cCategory, setCCategory] = useState('Leadership & Église');
  const [cInstructor, setCInstructor] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, mRes] = await Promise.all([
        apiFetch<{ courses: AcademyCourseItem[] }>(
          `/api/churches/${churchId}/academy/courses`
        ),
        apiFetch<{ media: MediaLibraryItem[] }>(`/api/churches/${churchId}/media`),
      ]);
      setCourses(cRes.courses);
      setMedia(mRes.media);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const enroll = async (courseId: number) => {
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/academy/courses/${courseId}/enroll`, {
        method: 'POST',
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur d'inscription.");
    }
  };

  const completeLesson = async (courseId: number, idx: number) => {
    setError(null);
    try {
      await apiFetch(
        `/api/churches/${churchId}/academy/courses/${courseId}/lessons/${idx}/complete`,
        { method: 'POST' }
      );
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur validation leçon.');
    }
  };

  const submitQuiz = async (course: AcademyCourseItem) => {
    setError(null);
    setMessage(null);
    const answers = course.quizQuestions.map((_, idx) => quizAnswers[`${course.id}-${idx}`] ?? 0);
    try {
      const res = await apiFetch<{ score: number; passed: boolean; enrollment: { certificateCode: string | null } }>(
        `/api/churches/${churchId}/academy/courses/${course.id}/quiz`,
        {
          method: 'POST',
          body: JSON.stringify({ answers }),
        }
      );
      setMessage(
        res.passed
          ? `Félicitations ! Score : ${res.score} %. Certificat généré : ${res.enrollment.certificateCode}`
          : `Score obtenu : ${res.score} % (60 % requis pour la certification).`
      );
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur soumission quiz.');
    }
  };

  const createMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/churches/${churchId}/media`, {
        method: 'POST',
        body: JSON.stringify({
          title: mTitle,
          description: mDesc,
          mediaType: mType,
          mediaUrl: mUrl,
          speakerName: mSpeaker,
        }),
      });
      setMTitle('');
      setMDesc('');
      setMUrl('');
      setShowNewMedia(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur ajout média.');
    }
  };

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/churches/${churchId}/academy/courses`, {
        method: 'POST',
        body: JSON.stringify({
          title: cTitle,
          description: cDesc,
          category: cCategory,
          instructorName: cInstructor,
          lessons: [
            {
              title: 'Module introductif',
              summary: 'Objectifs pédagogiques et fondements bibliques du cours.',
              duration: '20 min',
            },
          ],
          quizQuestions: [
            {
              question: 'Avez-vous assimilé les principes fondamentaux de ce parcours ?',
              options: ['Oui, prêt pour la mise en pratique', 'À revoir'],
              correctIndex: 0,
            },
          ],
        }),
      });
      setCTitle('');
      setCDesc('');
      setShowNewCourse(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur création cours.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
            Académie & Médiathèque
          </h2>
          <p className="text-sm text-stone-500 dark:text-slate-400">
            Formations certifiantes, supports PDF, replays de cultes et conférences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('academy')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
              subTab === 'academy'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-600 dark:border-amber-600'
                : 'border-stone-200 dark:border-slate-700'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Académie ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('media')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
              subTab === 'media'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-600 dark:border-amber-600'
                : 'border-stone-200 dark:border-slate-700'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            Médiathèque ({media.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300">
          {message}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-500" />
        </div>
      ) : subTab === 'academy' ? (
        <div className="space-y-5">
          {canManageAcademy && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowNewCourse((v) => !v)}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouveau cours
              </button>
            </div>
          )}

          {showNewCourse && canManageAcademy && (
            <form
              onSubmit={createCourse}
              className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Titre du cours"
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                />
                <input
                  type="text"
                  placeholder="Catégorie"
                  value={cCategory}
                  onChange={(e) => setCCategory(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                />
                <input
                  type="text"
                  placeholder="Formateur"
                  value={cInstructor}
                  onChange={(e) => setCInstructor(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                />
              </div>
              <textarea
                required
                rows={2}
                placeholder="Présentation pédagogique"
                value={cDesc}
                onChange={(e) => setCDesc(e.target.value)}
                className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
              >
                Créer le cours
              </button>
            </form>
          )}

          {courses.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
                    {c.category} · {c.level} · {c.instructorName}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-stone-900 dark:text-white">
                    {c.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-400">
                    {c.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.pdfResourceUrl && (
                    <a
                      href={c.pdfResourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Support PDF
                    </a>
                  )}
                  {!c.enrollment && (
                    <button
                      type="button"
                      onClick={() => enroll(c.id)}
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                    >
                      S'inscrire au parcours
                    </button>
                  )}
                </div>
              </div>

              {c.enrollment?.certificateCode && (
                <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-300">
                    <Award className="w-5 h-5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold">Certificat de réussite délivré</p>
                      <p>Score final : {c.enrollment.quizScore} %</p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs font-bold text-amber-900 dark:text-amber-200">
                    {c.enrollment.certificateCode}
                  </span>
                </div>
              )}

              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                  Leçons du module
                </h4>
                {c.lessons.map((l, idx) => {
                  const done = c.enrollment?.completedLessonIndexes.includes(idx) ?? false;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-stone-100 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-900 dark:text-white">
                          {l.title}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                          {l.summary} ({l.duration})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => completeLesson(c.id, idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          done
                            ? 'bg-emerald-700 text-white'
                            : 'border border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {done ? 'Terminée' : 'Valider'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {c.quizQuestions.length > 0 && (
                <div className="pt-4 border-t border-stone-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                    Évaluation de certification
                  </h4>
                  {c.quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="space-y-1.5 text-xs">
                      <p className="font-medium text-stone-900 dark:text-white">{q.question}</p>
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt, optIdx) => {
                          const selected = (quizAnswers[`${c.id}-${qIdx}`] ?? 0) === optIdx;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() =>
                                setQuizAnswers((prev) => ({
                                  ...prev,
                                  [`${c.id}-${qIdx}`]: optIdx,
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg border text-left cursor-pointer ${
                                selected
                                  ? 'border-amber-700 bg-amber-50 dark:bg-amber-950/40 font-semibold'
                                  : 'border-stone-200 dark:border-slate-700'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => submitQuiz(c)}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    Soumettre l’évaluation
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {canManageMedia && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowNewMedia((v) => !v)}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Publier un média
              </button>
            </div>
          )}

          {showNewMedia && canManageMedia && (
            <form
              onSubmit={createMedia}
              className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Titre du replay ou conférence"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                />
                <select
                  value={mType}
                  onChange={(e) =>
                    setMType(e.target.value as 'replay' | 'conference' | 'music' | 'teaching')
                  }
                  className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                >
                  <option value="replay">Replay de culte</option>
                  <option value="conference">Conférence</option>
                  <option value="teaching">Enseignement</option>
                  <option value="music">Louange & Musique</option>
                </select>
                <input
                  type="url"
                  required
                  placeholder="URL audio ou vidéo (MP3 / MP4)"
                  value={mUrl}
                  onChange={(e) => setMUrl(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                />
                <input
                  type="text"
                  placeholder="Orateur / Artiste"
                  value={mSpeaker}
                  onChange={(e) => setMSpeaker(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Description"
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
              >
                Ajouter à la médiathèque
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {media.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1 font-medium text-amber-800 dark:text-amber-400">
                    <Play className="w-3.5 h-3.5" />
                    {m.mediaType}
                  </span>
                  <span className="font-mono-tabular">
                    {m.durationLabel} · {m.publishedDate}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                  {m.title}
                </h3>
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  {m.speakerName} — {m.description}
                </p>
                {m.mediaUrl.match(/\.(mp4|webm)$/i) ? (
                  <video controls src={m.mediaUrl} className="w-full rounded-lg bg-black max-h-52" />
                ) : (
                  <audio controls src={m.mediaUrl} className="w-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
