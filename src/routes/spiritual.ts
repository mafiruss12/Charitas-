import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Router } from 'express';
import { BIBLE_FR_LSG, searchBibleVerses } from '../data/bible-fr.ts';
import { withTenantContext, type AppDatabase } from '../db/index.ts';
import {
  bibleQuizAttempts,
  bibleQuizzes,
  notifications,
  prayerInteractions,
  prayerRequests,
  readingPlanProgress,
  readingPlans,
  spiritualBookmarks,
  spiritualContents,
  spiritualJournal,
  testimonies,
  users,
} from '../db/schema.ts';
import { requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';
import { sendToUserInChurch } from '../realtime/ws.ts';

export const spiritualRouter = Router({ mergeParams: true });
spiritualRouter.use(requireAuth);

async function ensureStarterSpiritualContent(tx: AppDatabase, churchId: number, userId: number) {
  const existing = await tx
    .select({ id: spiritualContents.id })
    .from(spiritualContents)
    .where(eq(spiritualContents.churchId, churchId))
    .limit(1);

  if (existing.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    await tx.insert(spiritualContents).values([
      {
        churchId,
        authorUserId: userId,
        kind: 'daily_verse',
        title: 'La paix de Dieu qui surpasse toute intelligence',
        scriptureRef: 'Philippiens 4:6-7',
        content:
          'Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces.',
        publishedDate: today,
      },
      {
        churchId,
        authorUserId: userId,
        kind: 'meditation',
        title: 'Bâtir la fraternité sur le service et la compassion',
        scriptureRef: 'Matthieu 25:35-40',
        content:
          'Chaque geste d’accueil, de partage et d’écoute envers les plus vulnérables reflète fidèlement la lumière du Christ au cœur de notre cité.',
        publishedDate: today,
      },
      {
        churchId,
        authorUserId: userId,
        kind: 'sermon',
        title: 'Marcher avec assurance dans la vallée',
        scriptureRef: 'Psaumes 23:1-6',
        content:
          'Message dominical sur la confiance persévérante et la fidélité du Berger dans les saisons de transition.',
        durationLabel: '38 min',
        publishedDate: today,
      },
      {
        churchId,
        authorUserId: userId,
        kind: 'podcast',
        title: 'Voix d’Espérance — Épisode 1 : La solidarité en action',
        scriptureRef: 'Proverbes 19:17',
        content:
          'Entretien avec les équipes diaconales et bénévoles sur l’accompagnement fraternel des familles.',
        durationLabel: '22 min',
        publishedDate: today,
      },
    ]);
  }

  const existingPlans = await tx
    .select({ id: readingPlans.id })
    .from(readingPlans)
    .where(eq(readingPlans.churchId, churchId))
    .limit(1);

  if (existingPlans.length === 0) {
    await tx.insert(readingPlans).values({
      churchId,
      title: 'Fondements de la Foi & Compassion (5 jours)',
      description:
        'Un parcours biblique structuré pour ancrer la prière quotidienne et le service du prochain.',
      days: [
        {
          day: 1,
          title: 'La Parole créatrice et la lumière',
          scripture: 'Genèse 1:1-3 · Jean 1:1-5',
          reflection: 'Reconnaître la souveraineté de Dieu à l’aube de chaque projet.',
        },
        {
          day: 2,
          title: 'L’Éternel est mon berger',
          scripture: 'Psaumes 23:1-6',
          reflection: 'Déposer ses inquiétudes et avancer avec sérénité.',
        },
        {
          day: 3,
          title: 'Sagesse et confiance',
          scripture: 'Proverbes 3:5-6',
          reflection: 'Chercher le discernement avant toute décision communautaire.',
        },
        {
          day: 4,
          title: 'Amour actif envers les plus petits',
          scripture: 'Matthieu 25:35-40',
          reflection: 'Transformer la foi en solidarité concrète.',
        },
        {
          day: 5,
          title: 'La charité qui demeure',
          scripture: '1 Corinthiens 13:4-13',
          reflection: 'Cultiver la patience et la bienveillance dans l’assemblée.',
        },
      ],
    });
  }

  const existingQuizzes = await tx
    .select({ id: bibleQuizzes.id })
    .from(bibleQuizzes)
    .where(eq(bibleQuizzes.churchId, churchId))
    .limit(1);

  if (existingQuizzes.length === 0) {
    await tx.insert(bibleQuizzes).values({
      churchId,
      title: 'Quiz Biblique — Psaumes, Évangiles & Charité',
      description: 'Testez vos connaissances sur les textes fondamentaux (Louis Segond).',
      questions: [
        {
          question: 'Dans le Psaume 23, que déclare le psalmiste dès le verset 1 ?',
          options: [
            'L’Éternel est mon berger : je ne manquerai de rien.',
            'Le ciel raconte la gloire de Dieu.',
            'Heureux les artisans de paix.',
          ],
          correctIndex: 0,
          reference: 'Psaumes 23:1',
        },
        {
          question: 'Selon 1 Corinthiens 13:13, quelle est la plus grande des trois vertus ?',
          options: ['La foi', 'L’espérance', 'La charité (l’amour)'],
          correctIndex: 2,
          reference: '1 Corinthiens 13:13',
        },
        {
          question: 'Quel verset rappelle que secourir le pauvre revient à honorer le Seigneur ?',
          options: ['Proverbes 19:17', 'Genèse 1:1', 'Jean 1:5'],
          correctIndex: 0,
          reference: 'Proverbes 19:17',
        },
      ],
    });
  }
}

spiritualRouter.get(
  '/:churchId/spiritual/bible',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const q = typeof req.query.q === 'string' ? req.query.q : '';

      const bookmarks = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select()
            .from(spiritualBookmarks)
            .where(
              and(eq(spiritualBookmarks.churchId, churchId), eq(spiritualBookmarks.userId, userId))
            )
            .orderBy(desc(spiritualBookmarks.createdAt))
      );

      return res.json({
        books: BIBLE_FR_LSG,
        searchResults: q.trim() ? searchBibleVerses(q) : [],
        bookmarks,
      });
    } catch (error) {
      console.error('Bible endpoint error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement de la Bible.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/bookmarks',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { reference, verseText } = req.body ?? {};
      if (typeof reference !== 'string' || typeof verseText !== 'string' || !reference.trim()) {
        return res.status(400).json({ error: 'Référence et texte du verset requis.' });
      }

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(spiritualBookmarks)
            .where(
              and(
                eq(spiritualBookmarks.churchId, churchId),
                eq(spiritualBookmarks.userId, userId),
                eq(spiritualBookmarks.reference, reference.trim())
              )
            )
            .limit(1);

          if (existing.length) {
            await tx.delete(spiritualBookmarks).where(eq(spiritualBookmarks.id, existing[0].id));
            return { saved: false };
          }
          const [created] = await tx
            .insert(spiritualBookmarks)
            .values({
              churchId,
              userId,
              reference: reference.trim(),
              verseText: verseText.trim(),
            })
            .returning();
          return { saved: true, bookmark: created };
        }
      );

      return res.json(result);
    } catch (error) {
      console.error('Bible bookmark error:', error);
      return res.status(500).json({ error: 'Erreur lors de la sauvegarde du favori.' });
    }
  }
);

spiritualRouter.get(
  '/:churchId/spiritual/overview',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;

      const data = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          await ensureStarterSpiritualContent(tx, churchId, userId);

          const [contents, plans, progressRows, prayers, interactions, testimoniesRows, quizzes, attempts] =
            await Promise.all([
              tx
                .select()
                .from(spiritualContents)
                .where(eq(spiritualContents.churchId, churchId))
                .orderBy(desc(spiritualContents.createdAt)),
              tx
                .select()
                .from(readingPlans)
                .where(eq(readingPlans.churchId, churchId))
                .orderBy(desc(readingPlans.createdAt)),
              tx
                .select()
                .from(readingPlanProgress)
                .where(
                  and(
                    eq(readingPlanProgress.churchId, churchId),
                    eq(readingPlanProgress.userId, userId)
                  )
                ),
              tx
                .select({
                  id: prayerRequests.id,
                  authorUserId: prayerRequests.authorUserId,
                  authorName: users.fullName,
                  title: prayerRequests.title,
                  content: prayerRequests.content,
                  isAnonymous: prayerRequests.isAnonymous,
                  prayCount: prayerRequests.prayCount,
                  createdAt: prayerRequests.createdAt,
                })
                .from(prayerRequests)
                .innerJoin(users, eq(prayerRequests.authorUserId, users.id))
                .where(eq(prayerRequests.churchId, churchId))
                .orderBy(desc(prayerRequests.createdAt)),
              tx
                .select()
                .from(prayerInteractions)
                .where(
                  and(
                    eq(prayerInteractions.churchId, churchId),
                    eq(prayerInteractions.userId, userId)
                  )
                ),
              tx
                .select({
                  id: testimonies.id,
                  authorUserId: testimonies.authorUserId,
                  authorName: users.fullName,
                  title: testimonies.title,
                  content: testimonies.content,
                  createdAt: testimonies.createdAt,
                })
                .from(testimonies)
                .innerJoin(users, eq(testimonies.authorUserId, users.id))
                .where(eq(testimonies.churchId, churchId))
                .orderBy(desc(testimonies.createdAt)),
              tx
                .select()
                .from(bibleQuizzes)
                .where(eq(bibleQuizzes.churchId, churchId))
                .orderBy(desc(bibleQuizzes.createdAt)),
              tx
                .select()
                .from(bibleQuizAttempts)
                .where(
                  and(
                    eq(bibleQuizAttempts.churchId, churchId),
                    eq(bibleQuizAttempts.userId, userId)
                  )
                )
                .orderBy(desc(bibleQuizAttempts.createdAt)),
            ]);

          const progressMap = new Map(progressRows.map((p) => [p.planId, p.completedDays]));
          const prayedSet = new Set(interactions.map((i) => i.prayerId));

          return {
            dailyVerse: contents.find((c) => c.kind === 'daily_verse') || null,
            meditations: contents.filter((c) => c.kind === 'meditation'),
            sermons: contents.filter((c) => c.kind === 'sermon'),
            podcasts: contents.filter((c) => c.kind === 'podcast'),
            readingPlans: plans.map((p) => ({
              ...p,
              completedDays: progressMap.get(p.id) || [],
            })),
            prayers: prayers.map((p) => ({
              id: p.id,
              authorName: p.isAnonymous ? 'Membre anonyme' : p.authorName,
              isAnonymous: p.isAnonymous,
              title: p.title,
              content: p.content,
              prayCount: p.prayCount,
              hasPrayed: prayedSet.has(p.id),
              createdAt: p.createdAt,
            })),
            testimonies: testimoniesRows,
            quizzes: quizzes.map((q) => {
              const quizAttempts = attempts.filter((a) => a.quizId === q.id);
              const best = quizAttempts.reduce(
                (max, a) => (a.score > max ? a.score : max),
                -1
              );
              return {
                ...q,
                questions: q.questions.map((item) => ({
                  question: item.question,
                  options: item.options,
                  reference: item.reference,
                })),
                bestScore: best >= 0 ? best : null,
                attemptsCount: quizAttempts.length,
              };
            }),
          };
        }
      );

      return res.json(data);
    } catch (error) {
      console.error('Spiritual overview error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement de la vie spirituelle.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/contents',
  requireChurchPermission('spiritual.publish'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { kind, title, scriptureRef, content, mediaUrl, durationLabel } = req.body ?? {};
      const allowed = ['daily_verse', 'meditation', 'sermon', 'podcast'];
      if (!allowed.includes(kind) || typeof title !== 'string' || typeof content !== 'string') {
        return res.status(400).json({ error: 'Type, titre et contenu requis.' });
      }

      const [created] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(spiritualContents)
            .values({
              churchId,
              authorUserId: req.authUser!.id,
              kind,
              title: title.trim(),
              scriptureRef: typeof scriptureRef === 'string' ? scriptureRef.trim() || null : null,
              content: content.trim(),
              mediaUrl: typeof mediaUrl === 'string' ? mediaUrl.trim() || null : null,
              durationLabel: typeof durationLabel === 'string' ? durationLabel.trim() || null : null,
              publishedDate: new Date().toISOString().slice(0, 10),
            })
            .returning()
      );

      return res.status(201).json({ content: created });
    } catch (error) {
      console.error('Publish spiritual content error:', error);
      return res.status(500).json({ error: 'Erreur lors de la publication spirituelle.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/reading-plans/:planId/toggle-day',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const planId = Number(req.params.planId);
      const day = Number(req.body?.day);

      if (!Number.isInteger(day) || day <= 0) {
        return res.status(400).json({ error: 'Numéro de jour invalide.' });
      }

      const completedDays = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(readingPlanProgress)
            .where(
              and(
                eq(readingPlanProgress.churchId, churchId),
                eq(readingPlanProgress.planId, planId),
                eq(readingPlanProgress.userId, userId)
              )
            )
            .limit(1);

          const current = existing.length ? existing[0].completedDays : [];
          const nextDays = current.includes(day)
            ? current.filter((d) => d !== day)
            : [...current, day].sort((a, b) => a - b);

          if (existing.length) {
            await tx
              .update(readingPlanProgress)
              .set({ completedDays: nextDays, updatedAt: new Date() })
              .where(eq(readingPlanProgress.id, existing[0].id));
          } else {
            await tx.insert(readingPlanProgress).values({
              churchId,
              planId,
              userId,
              completedDays: nextDays,
            });
          }
          return nextDays;
        }
      );

      return res.json({ completedDays });
    } catch (error) {
      console.error('Toggle reading day error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du plan.' });
    }
  }
);

// Strictly private spiritual journal (owner-only RLS: never pass isSuperAdmin=true to bypass owner RLS)
spiritualRouter.get(
  '/:churchId/spiritual/journal',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const entries = await withTenantContext(
        { churchId, userId, isSuperAdmin: false },
        async (tx) =>
          tx
            .select()
            .from(spiritualJournal)
            .where(and(eq(spiritualJournal.churchId, churchId), eq(spiritualJournal.userId, userId)))
            .orderBy(desc(spiritualJournal.createdAt))
      );
      return res.json({ entries });
    } catch (error) {
      console.error('Get journal error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement du journal privé.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/journal',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { title, scriptureRef, content, mood } = req.body ?? {};
      if (typeof title !== 'string' || typeof content !== 'string' || !title.trim() || !content.trim()) {
        return res.status(400).json({ error: 'Titre et réflexion requis.' });
      }

      const [entry] = await withTenantContext(
        { churchId, userId, isSuperAdmin: false },
        async (tx) =>
          tx
            .insert(spiritualJournal)
            .values({
              churchId,
              userId,
              title: title.trim(),
              scriptureRef: typeof scriptureRef === 'string' ? scriptureRef.trim() || null : null,
              content: content.trim(),
              mood: typeof mood === 'string' ? mood.trim() || null : null,
            })
            .returning()
      );
      return res.status(201).json({ entry });
    } catch (error) {
      console.error('Create journal error:', error);
      return res.status(500).json({ error: 'Erreur lors de la sauvegarde du journal.' });
    }
  }
);

spiritualRouter.delete(
  '/:churchId/spiritual/journal/:entryId',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const entryId = Number(req.params.entryId);

      await withTenantContext({ churchId, userId, isSuperAdmin: false }, async (tx) =>
        tx
          .delete(spiritualJournal)
          .where(
            and(
              eq(spiritualJournal.id, entryId),
              eq(spiritualJournal.churchId, churchId),
              eq(spiritualJournal.userId, userId)
            )
          )
      );
      return res.json({ deleted: true });
    } catch (error) {
      console.error('Delete journal error:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/prayers',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { title, content, isAnonymous } = req.body ?? {};
      if (typeof title !== 'string' || typeof content !== 'string' || !title.trim() || !content.trim()) {
        return res.status(400).json({ error: 'Sujet et détail de prière requis.' });
      }

      const [prayer] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(prayerRequests)
            .values({
              churchId,
              authorUserId: req.authUser!.id,
              title: title.trim(),
              content: content.trim(),
              isAnonymous: Boolean(isAnonymous),
            })
            .returning()
      );

      return res.status(201).json({ prayer });
    } catch (error) {
      console.error('Create prayer error:', error);
      return res.status(500).json({ error: 'Erreur lors du dépôt de la requête de prière.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/prayers/:prayerId/pray',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const prayerId = Number(req.params.prayerId);

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const existing = await tx
            .select()
            .from(prayerInteractions)
            .where(
              and(
                eq(prayerInteractions.churchId, churchId),
                eq(prayerInteractions.prayerId, prayerId),
                eq(prayerInteractions.userId, userId)
              )
            )
            .limit(1);

          let hasPrayed = true;
          if (existing.length) {
            await tx.delete(prayerInteractions).where(eq(prayerInteractions.id, existing[0].id));
            hasPrayed = false;
          } else {
            await tx.insert(prayerInteractions).values({ churchId, prayerId, userId });
            const [prayerRow] = await tx
              .select()
              .from(prayerRequests)
              .where(eq(prayerRequests.id, prayerId))
              .limit(1);
            if (prayerRow && prayerRow.authorUserId !== userId) {
              const [notif] = await tx
                .insert(notifications)
                .values({
                  churchId,
                  userId: prayerRow.authorUserId,
                  type: 'prayer_support',
                  title: 'Soutien dans la prière',
                  body: `Un frère ou une sœur prie pour votre sujet : « ${prayerRow.title} ».`,
                })
                .returning();
              sendToUserInChurch(churchId, prayerRow.authorUserId, 'notification:new', notif);
            }
          }

          const [countRow] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(prayerInteractions)
            .where(eq(prayerInteractions.prayerId, prayerId));

          const prayCount = countRow?.count ?? 0;
          await tx
            .update(prayerRequests)
            .set({ prayCount })
            .where(eq(prayerRequests.id, prayerId));

          return { hasPrayed, prayCount };
        }
      );

      return res.json(result);
    } catch (error) {
      console.error('Pray interaction error:', error);
      return res.status(500).json({ error: 'Erreur lors de l’interaction de prière.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/testimonies',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { title, content } = req.body ?? {};
      if (typeof title !== 'string' || typeof content !== 'string' || !title.trim() || !content.trim()) {
        return res.status(400).json({ error: 'Titre et témoignage requis.' });
      }
      const [testimony] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(testimonies)
            .values({
              churchId,
              authorUserId: req.authUser!.id,
              title: title.trim(),
              content: content.trim(),
            })
            .returning()
      );
      return res.status(201).json({ testimony });
    } catch (error) {
      console.error('Create testimony error:', error);
      return res.status(500).json({ error: 'Erreur lors de la publication du témoignage.' });
    }
  }
);

spiritualRouter.post(
  '/:churchId/spiritual/quizzes/:quizId/attempt',
  requireChurchPermission('spiritual.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const quizId = Number(req.params.quizId);
      const { answers } = req.body ?? {};

      if (!Array.isArray(answers)) {
        return res.status(400).json({ error: 'Réponses requises.' });
      }

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [quiz] = await tx
            .select()
            .from(bibleQuizzes)
            .where(and(eq(bibleQuizzes.id, quizId), eq(bibleQuizzes.churchId, churchId)))
            .limit(1);

          if (!quiz) return null;

          let score = 0;
          const corrections = quiz.questions.map((q, idx) => {
            const chosen = Number(answers[idx]);
            const isCorrect = chosen === q.correctIndex;
            if (isCorrect) score += 1;
            return {
              question: q.question,
              chosenIndex: chosen,
              correctIndex: q.correctIndex,
              isCorrect,
              reference: q.reference,
            };
          });

          const [attempt] = await tx
            .insert(bibleQuizAttempts)
            .values({
              churchId,
              quizId,
              userId,
              score,
              totalQuestions: quiz.questions.length,
            })
            .returning();

          return { attempt, score, totalQuestions: quiz.questions.length, corrections };
        }
      );

      if (!result) return res.status(404).json({ error: 'Quiz introuvable.' });
      return res.json(result);
    } catch (error) {
      console.error('Quiz attempt error:', error);
      return res.status(500).json({ error: 'Erreur lors de la correction du quiz.' });
    }
  }
);
