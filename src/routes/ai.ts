import { GoogleGenAI } from '@google/genai';
import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { withTenantContext } from '../db/index.ts';
import {
  academyCourses,
  churchEvents,
  churches,
  donationCampaigns,
  spiritualContents,
} from '../db/schema.ts';
import { requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';

export const aiRouter = Router({ mergeParams: true });
aiRouter.use(requireAuth);

const VALID_MODES = ['bible_research', 'sermon_summary', 'content_search', 'admin_draft'] as const;
type AiMode = (typeof VALID_MODES)[number];

aiRouter.post(
  '/:churchId/ai/assist',
  requireChurchPermission('ai.use'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const perms = req.tenant!.permissions;
      const { mode, prompt } = req.body ?? {};

      if (!(VALID_MODES as readonly string[]).includes(mode)) {
        return res.status(400).json({ error: 'Mode assistant invalide.' });
      }
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > 4000) {
        return res.status(400).json({ error: 'Requête requise (1 à 4000 caractères).' });
      }

      const aiMode = mode as AiMode;
      // Strict RBAC guard: admin drafting is prohibited to members without management permissions
      if (
        aiMode === 'admin_draft' &&
        !perms.includes('church.manage') &&
        !perms.includes('humanitarian.manage') &&
        !perms.includes('spiritual.publish')
      ) {
        return res.status(403).json({
          error:
            "Le mode rédaction administrative est réservé aux responsables autorisés de l'église.",
        });
      }

      // Gather strictly non-confidential, tenant-scoped public church context when needed.
      // NEVER access spiritual_journal, beneficiaries, family members, or user secrets.
      const safeContext = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ name: churches.name, denomination: churches.denomination, city: churches.city })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);

          if (aiMode !== 'content_search') {
            return { churchName: ch?.name || 'Église', snippet: '' };
          }

          const sermons = await tx
            .select({
              title: spiritualContents.title,
              kind: spiritualContents.kind,
              scriptureRef: spiritualContents.scriptureRef,
            })
            .from(spiritualContents)
            .where(eq(spiritualContents.churchId, churchId))
            .orderBy(desc(spiritualContents.createdAt))
            .limit(8);

          const events = await tx
            .select({
              title: churchEvents.title,
              eventType: churchEvents.eventType,
              location: churchEvents.location,
            })
            .from(churchEvents)
            .where(eq(churchEvents.churchId, churchId))
            .orderBy(desc(churchEvents.startsAt))
            .limit(6);

          const courses = await tx
            .select({ title: academyCourses.title, category: academyCourses.category })
            .from(academyCourses)
            .where(eq(academyCourses.churchId, churchId))
            .limit(6);

          const campaigns = await tx
            .select({ title: donationCampaigns.title, fundCategory: donationCampaigns.fundCategory })
            .from(donationCampaigns)
            .where(eq(donationCampaigns.churchId, churchId))
            .limit(6);

          return {
            churchName: ch?.name || 'Église',
            snippet: JSON.stringify({ sermons, events, courses, campaigns }),
          };
        }
      );

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "Service d'assistance IA non configuré sur cet environnement (GEMINI_API_KEY absent).",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstructions: Record<AiMode, string> = {
        bible_research: `Tu es un assistant d'étude biblique protestant/évangélique francophone au service de l'église "${safeContext.churchName}". Réponds en français structuré avec des références bibliques exactes (Louis Segond) et des pistes d'application communautaire. Sois fidèle au texte sans inventer de versets.`,
        sermon_summary: `Tu es un assistant pastoral francophone pour l'église "${safeContext.churchName}". Résume de façon claire le texte de prédication fourni : 1) Thème central et passage clé, 2) Points principaux (3 à 5 puces), 3) Questions de partage en groupe de maison et prière d'application.`,
        content_search: `Tu es le moteur de recherche intelligent des contenus publics de l'église "${safeContext.churchName}". Utilise exclusivement le catalogue ci-dessous pour orienter le membre en français. N'invente aucun événement absent.\nCatalogue public de l'église : ${safeContext.snippet}`,
        admin_draft: `Tu es un secrétaire administratif expérimenté pour l'église "${safeContext.churchName}". Rédige des communications officielles, annonces ou comptes-rendus en français sobre, respectueux et structuré, sans jamais inclure ni supposer de données personnelles confidentielles.`,
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt.trim(),
        config: {
          systemInstruction: systemInstructions[aiMode],
        },
      });

      return res.json({
        mode: aiMode,
        reply: response.text || 'Aucune réponse générée.',
      });
    } catch (error) {
      console.error('AI assistant error:', error);
      return res.status(502).json({
        error: "Impossible de contacter l'assistant Gemini pour le moment.",
      });
    }
  }
);
