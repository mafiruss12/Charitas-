import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { withTenantContext, type AppDatabase } from '../db/index.ts';
import { academyCourses, academyEnrollments, mediaLibrary } from '../db/schema.ts';
import { requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';

export const academyMediaRouter = Router({ mergeParams: true });
academyMediaRouter.use(requireAuth);

async function ensureStarterAcademyAndMedia(tx: AppDatabase, churchId: number, userId: number) {
  const existingMedia = await tx
    .select({ id: mediaLibrary.id })
    .from(mediaLibrary)
    .where(eq(mediaLibrary.churchId, churchId))
    .limit(1);

  if (existingMedia.length === 0) {
    await tx.insert(mediaLibrary).values([
      {
        churchId,
        title: "Culte d'Action de Grâce — Replay Intégral",
        description:
          'Louange, témoignages et message principal sur la persévérance dans l’épreuve.',
        mediaType: 'replay',
        mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        speakerName: 'Pasteur Jean-Marc Kouamé',
        durationLabel: '54 min',
        publishedDate: new Date().toISOString().slice(0, 10),
        uploadedByUserId: userId,
      },
      {
        churchId,
        title: 'Conférence Leadership & Compassion Sociale',
        description:
          'Atelier pratique pour responsables de départements et coordinateurs humanitaires.',
        mediaType: 'conference',
        mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        speakerName: 'Équipe Formation & Solidarité',
        durationLabel: '38 min',
        publishedDate: new Date().toISOString().slice(0, 10),
        uploadedByUserId: userId,
      },
    ]);
  }

  const existingCourse = await tx
    .select({ id: academyCourses.id })
    .from(academyCourses)
    .where(eq(academyCourses.churchId, churchId))
    .limit(1);

  if (existingCourse.length === 0) {
    await tx.insert(academyCourses).values({
      churchId,
      title: 'Fondements du Service Chrétien & Diaconat',
      description:
        'Parcours certifiant de 3 modules sur l’accueil fraternel, l’éthique de l’aide humanitaire et le service en assemblée.',
      category: 'Diaconat & Humanitaire',
      level: 'Fondamentaux',
      instructorName: 'Pasteur & Direction Académique',
      pdfResourceUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      lessons: [
        {
          title: 'Module 1 : Le cœur du serviteur selon Éphésiens 4',
          summary:
            'Comprendre les dons ministériels au service de l’édification communautaire sans recherche de prestige.',
          duration: '20 min',
        },
        {
          title: 'Module 2 : Dignité et confidentialité des bénéficiaires',
          summary:
            'Règles strictes d’éthique lors des visites familiales, de l’évaluation des besoins et des distributions.',
          duration: '25 min',
        },
        {
          title: 'Module 3 : Rigueur financière et transparence biblique',
          summary:
            'Séparation des fonds, justificatifs et redevabilité devant l’assemblée et les donateurs.',
          duration: '20 min',
        },
      ],
      quizQuestions: [
        {
          question: 'Quelle priorité guide l’accompagnement humanitaire d’une famille ?',
          options: [
            'La dignité et la confidentialité absolue du dossier',
            'La publication de ses difficultés sur les réseaux sociaux',
            'L’attente sans évaluation',
          ],
          correctIndex: 0,
        },
        {
          question: 'Comment doivent être gérés les fonds humanitaires par rapport au budget cultuel ?',
          options: [
            'Mélangés dans une seule caisse',
            'Strictement séparés et justifiés dans le grand livre',
            'Non enregistrés',
          ],
          correctIndex: 1,
        },
      ],
      createdByUserId: userId,
    });
  }
}

// ==================== MULTIMEDIA LIBRARY ====================

academyMediaRouter.get(
  '/:churchId/media',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const items = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          await ensureStarterAcademyAndMedia(tx, churchId, userId);
          return tx
            .select()
            .from(mediaLibrary)
            .where(eq(mediaLibrary.churchId, churchId))
            .orderBy(desc(mediaLibrary.createdAt));
        }
      );

      return res.json({ media: items });
    } catch (error) {
      console.error('Get media error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement de la médiathèque.' });
    }
  }
);

academyMediaRouter.post(
  '/:churchId/media',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const perms = req.tenant!.permissions;
      if (!perms.includes('streams.manage') && !perms.includes('spiritual.publish')) {
        return res.status(403).json({ error: 'Permission streams.manage ou spiritual.publish requise.' });
      }
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { title, description, mediaType, mediaUrl, thumbnailUrl, speakerName, durationLabel } =
        req.body ?? {};

      if (typeof title !== 'string' || !title.trim() || typeof mediaUrl !== 'string' || !mediaUrl.trim()) {
        return res.status(400).json({ error: 'Titre et URL média requis.' });
      }

      const item = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [created] = await tx
            .insert(mediaLibrary)
            .values({
              churchId,
              title: title.trim(),
              description: typeof description === 'string' ? description.trim() : '',
              mediaType: ['replay', 'conference', 'music', 'teaching'].includes(mediaType)
                ? mediaType
                : 'replay',
              mediaUrl: mediaUrl.trim(),
              thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl.trim() || null : null,
              speakerName:
                typeof speakerName === 'string' && speakerName.trim()
                  ? speakerName.trim()
                  : req.authUser!.fullName,
              durationLabel:
                typeof durationLabel === 'string' && durationLabel.trim()
                  ? durationLabel.trim()
                  : '30 min',
              publishedDate: new Date().toISOString().slice(0, 10),
              uploadedByUserId: userId,
            })
            .returning();
          return created;
        }
      );

      return res.status(201).json({ media: item });
    } catch (error) {
      console.error('Create media error:', error);
      return res.status(500).json({ error: "Erreur lors de l'ajout du média." });
    }
  }
);

// ==================== ACADEMY ====================

academyMediaRouter.get(
  '/:churchId/academy/courses',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;

      const courses = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          await ensureStarterAcademyAndMedia(tx, churchId, userId);

          const allCourses = await tx
            .select()
            .from(academyCourses)
            .where(eq(academyCourses.churchId, churchId))
            .orderBy(desc(academyCourses.createdAt));

          const enrollments = await tx
            .select()
            .from(academyEnrollments)
            .where(
              and(eq(academyEnrollments.churchId, churchId), eq(academyEnrollments.userId, userId))
            );
          const enrollMap = new Map(enrollments.map((e) => [e.courseId, e]));

          return allCourses.map((c) => {
            const enrollment = enrollMap.get(c.id) || null;
            return {
              id: c.id,
              title: c.title,
              description: c.description,
              category: c.category,
              level: c.level,
              instructorName: c.instructorName,
              pdfResourceUrl: c.pdfResourceUrl,
              lessons: c.lessons,
              quizQuestions: c.quizQuestions.map((q) => ({
                question: q.question,
                options: q.options,
              })),
              enrollment: enrollment
                ? {
                    id: enrollment.id,
                    completedLessonIndexes: enrollment.completedLessonIndexes,
                    quizScore: enrollment.quizScore,
                    certificateCode: enrollment.certificateCode,
                    completedAt: enrollment.completedAt,
                  }
                : null,
              createdAt: c.createdAt,
            };
          });
        }
      );

      return res.json({ courses });
    } catch (error) {
      console.error('Get academy courses error:', error);
      return res.status(500).json({ error: "Erreur lors du chargement de l'Académie." });
    }
  }
);

academyMediaRouter.post(
  '/:churchId/academy/courses',
  requireChurchPermission('academy.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { title, description, category, level, instructorName, pdfResourceUrl, lessons, quizQuestions } =
        req.body ?? {};

      if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'Titre et description du cours requis.' });
      }

      const safeLessons = Array.isArray(lessons)
        ? lessons
            .filter((l) => l && typeof l.title === 'string' && l.title.trim())
            .map((l) => ({
              title: String(l.title).trim(),
              summary: String(l.summary || '').trim(),
              duration: String(l.duration || '15 min').trim(),
            }))
        : [];

      const safeQuiz = Array.isArray(quizQuestions)
        ? quizQuestions
            .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options))
            .map((q) => ({
              question: String(q.question).trim(),
              options: q.options.map((o: unknown) => String(o)),
              correctIndex: Number(q.correctIndex) || 0,
            }))
        : [];

      const course = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [created] = await tx
            .insert(academyCourses)
            .values({
              churchId,
              title: title.trim(),
              description: description.trim(),
              category:
                typeof category === 'string' && category.trim()
                  ? category.trim()
                  : 'Formation Biblique',
              level:
                typeof level === 'string' && level.trim() ? level.trim() : 'Fondamentaux',
              instructorName:
                typeof instructorName === 'string' && instructorName.trim()
                  ? instructorName.trim()
                  : req.authUser!.fullName,
              pdfResourceUrl:
                typeof pdfResourceUrl === 'string' ? pdfResourceUrl.trim() || null : null,
              lessons: safeLessons,
              quizQuestions: safeQuiz,
              createdByUserId: userId,
            })
            .returning();
          return created;
        }
      );

      return res.status(201).json({ course });
    } catch (error) {
      console.error('Create course error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création du cours.' });
    }
  }
);

academyMediaRouter.post(
  '/:churchId/academy/courses/:courseId/enroll',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const courseId = Number(req.params.courseId);

      const enrollment = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [course] = await tx
            .select()
            .from(academyCourses)
            .where(and(eq(academyCourses.id, courseId), eq(academyCourses.churchId, churchId)))
            .limit(1);
          if (!course) return null;

          const existing = await tx
            .select()
            .from(academyEnrollments)
            .where(
              and(eq(academyEnrollments.courseId, courseId), eq(academyEnrollments.userId, userId))
            )
            .limit(1);
          if (existing.length > 0) return existing[0];

          const [created] = await tx
            .insert(academyEnrollments)
            .values({
              churchId,
              courseId,
              userId,
              completedLessonIndexes: [],
            })
            .returning();
          return created;
        }
      );

      if (!enrollment) {
        return res.status(404).json({ error: 'Cours introuvable.' });
      }
      return res.status(201).json({ enrollment });
    } catch (error) {
      console.error('Enroll error:', error);
      return res.status(500).json({ error: "Erreur lors de l'inscription au cours." });
    }
  }
);

academyMediaRouter.post(
  '/:churchId/academy/courses/:courseId/lessons/:lessonIndex/complete',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const courseId = Number(req.params.courseId);
      const lessonIndex = Number(req.params.lessonIndex);

      const updated = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [course] = await tx
            .select()
            .from(academyCourses)
            .where(and(eq(academyCourses.id, courseId), eq(academyCourses.churchId, churchId)))
            .limit(1);
          if (!course || lessonIndex < 0 || lessonIndex >= course.lessons.length) {
            return null;
          }

          let [enrollment] = await tx
            .select()
            .from(academyEnrollments)
            .where(
              and(eq(academyEnrollments.courseId, courseId), eq(academyEnrollments.userId, userId))
            )
            .limit(1);

          if (!enrollment) {
            const [created] = await tx
              .insert(academyEnrollments)
              .values({ churchId, courseId, userId, completedLessonIndexes: [] })
              .returning();
            enrollment = created;
          }

          const nextSet = Array.from(new Set([...enrollment.completedLessonIndexes, lessonIndex]));
          const [saved] = await tx
            .update(academyEnrollments)
            .set({ completedLessonIndexes: nextSet })
            .where(eq(academyEnrollments.id, enrollment.id))
            .returning();
          return saved;
        }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Leçon ou cours introuvable.' });
      }
      return res.json({ enrollment: updated });
    } catch (error) {
      console.error('Complete lesson error:', error);
      return res.status(500).json({ error: 'Erreur lors de la validation de la leçon.' });
    }
  }
);

academyMediaRouter.post(
  '/:churchId/academy/courses/:courseId/quiz',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const courseId = Number(req.params.courseId);
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [course] = await tx
            .select()
            .from(academyCourses)
            .where(and(eq(academyCourses.id, courseId), eq(academyCourses.churchId, churchId)))
            .limit(1);
          if (!course) return null;

          let [enrollment] = await tx
            .select()
            .from(academyEnrollments)
            .where(
              and(eq(academyEnrollments.courseId, courseId), eq(academyEnrollments.userId, userId))
            )
            .limit(1);

          if (!enrollment) {
            const [created] = await tx
              .insert(academyEnrollments)
              .values({ churchId, courseId, userId, completedLessonIndexes: [] })
              .returning();
            enrollment = created;
          }

          const total = course.quizQuestions.length;
          let correct = 0;
          course.quizQuestions.forEach((q, idx) => {
            if (Number(answers[idx]) === q.correctIndex) correct++;
          });
          const pct = total > 0 ? Math.round((correct / total) * 100) : 100;
          const passed = pct >= 60;

          const certificateCode =
            passed && !enrollment.certificateCode
              ? `CERT-${churchId}-${courseId}-${userId}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
              : enrollment.certificateCode;

          const [saved] = await tx
            .update(academyEnrollments)
            .set({
              quizScore: pct,
              certificateCode,
              completedAt: passed ? enrollment.completedAt || new Date() : enrollment.completedAt,
            })
            .where(eq(academyEnrollments.id, enrollment.id))
            .returning();

          return { score: pct, passed, total, correct, enrollment: saved };
        }
      );

      if (!result) {
        return res.status(404).json({ error: 'Cours introuvable.' });
      }
      return res.json(result);
    } catch (error) {
      console.error('Submit quiz error:', error);
      return res.status(500).json({ error: 'Erreur lors de la correction du quiz.' });
    }
  }
);
