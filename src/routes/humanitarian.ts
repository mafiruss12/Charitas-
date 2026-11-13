import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { recordAuditLog } from '../db/audit.ts';
import { withTenantContext } from '../db/index.ts';
import {
  aidDistributions,
  aidRequests,
  beneficiaries,
  beneficiaryFamilyMembers,
  churches,
  interventionReports,
  users,
  volunteerAssignments,
} from '../db/schema.ts';
import { appendFinancialLedgerEntry } from '../lib/payments.ts';
import { getClientIp, requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';

export const humanitarianRouter = Router({ mergeParams: true });
humanitarianRouter.use(requireAuth);

// Public-safe humanitarian overview (no confidential beneficiary PII exposed without humanitarian.manage)
humanitarianRouter.get(
  '/:churchId/humanitarian/overview',
  requireChurchPermission('humanitarian.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const canManage = req.tenant!.permissions.includes('humanitarian.manage');

      const data = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const reports = await tx
            .select()
            .from(interventionReports)
            .where(eq(interventionReports.churchId, churchId))
            .orderBy(desc(interventionReports.createdAt));

          const volunteers = await tx
            .select({
              id: volunteerAssignments.id,
              userId: volunteerAssignments.userId,
              volunteerName: users.fullName,
              missionTitle: volunteerAssignments.missionTitle,
              roleDescription: volunteerAssignments.roleDescription,
              scheduledDate: volunteerAssignments.scheduledDate,
              status: volunteerAssignments.status,
            })
            .from(volunteerAssignments)
            .innerJoin(users, eq(volunteerAssignments.userId, users.id))
            .where(eq(volunteerAssignments.churchId, churchId))
            .orderBy(desc(volunteerAssignments.createdAt));

          let aggregateStats = {
            beneficiariesCount: 0,
            openRequestsCount: 0,
            distributionsCount: 0,
          };

          const bRows = await tx
            .select({ id: beneficiaries.id })
            .from(beneficiaries)
            .where(eq(beneficiaries.churchId, churchId));
          const rRows = await tx
            .select({ id: aidRequests.id, status: aidRequests.status })
            .from(aidRequests)
            .where(eq(aidRequests.churchId, churchId));
          const dRows = await tx
            .select({ id: aidDistributions.id })
            .from(aidDistributions)
            .where(eq(aidDistributions.churchId, churchId));

          aggregateStats = {
            beneficiariesCount: bRows.length,
            openRequestsCount: rRows.filter((r) => ['submitted', 'under_review', 'approved'].includes(r.status)).length,
            distributionsCount: dRows.length,
          };

          return {
            canManageConfidential: canManage,
            stats: aggregateStats,
            reports,
            volunteers,
          };
        }
      );

      return res.json(data);
    } catch (error) {
      console.error('Humanitarian overview error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement humanitaire.' });
    }
  }
);

// Confidential Beneficiaries & Family Dossiers (strictly requires humanitarian.manage)
humanitarianRouter.get(
  '/:churchId/humanitarian/beneficiaries',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const list = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const rows = await tx
            .select()
            .from(beneficiaries)
            .where(eq(beneficiaries.churchId, churchId))
            .orderBy(desc(beneficiaries.createdAt));
          const fam = await tx
            .select()
            .from(beneficiaryFamilyMembers)
            .where(eq(beneficiaryFamilyMembers.churchId, churchId));

          return rows.map((b) => ({
            ...b,
            familyMembers: fam.filter((f) => f.beneficiaryId === b.id),
          }));
        }
      );
      return res.json({ beneficiaries: list });
    } catch (error) {
      console.error('List beneficiaries error:', error);
      return res.status(500).json({ error: 'Erreur chargement bénéficiaires.' });
    }
  }
);

humanitarianRouter.post(
  '/:churchId/humanitarian/beneficiaries',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { fullName, phone, address, householdSize, vulnerabilityLevel, confidentialNotes, familyMembers } =
        req.body ?? {};
      if (typeof fullName !== 'string' || !fullName.trim()) {
        return res.status(400).json({ error: 'Nom complet du bénéficiaire requis.' });
      }
      const allowedLevels = ['standard', 'high', 'critical'];

      const created = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [b] = await tx
            .insert(beneficiaries)
            .values({
              churchId,
              fullName: fullName.trim(),
              phone: typeof phone === 'string' ? phone.trim() || null : null,
              address: typeof address === 'string' ? address.trim() || null : null,
              householdSize: Math.max(1, Number(householdSize) || 1),
              vulnerabilityLevel: allowedLevels.includes(vulnerabilityLevel)
                ? vulnerabilityLevel
                : 'standard',
              confidentialNotes:
                typeof confidentialNotes === 'string' ? confidentialNotes.trim() || null : null,
              createdByUserId: req.authUser!.id,
            })
            .returning();

          if (Array.isArray(familyMembers)) {
            for (const fm of familyMembers) {
              if (fm && typeof fm.fullName === 'string' && fm.fullName.trim()) {
                await tx.insert(beneficiaryFamilyMembers).values({
                  churchId,
                  beneficiaryId: b.id,
                  fullName: fm.fullName.trim(),
                  relationship: typeof fm.relationship === 'string' ? fm.relationship.trim() : 'Membre',
                  age: fm.age ? Number(fm.age) : null,
                  notes: typeof fm.notes === 'string' ? fm.notes.trim() || null : null,
                });
              }
            }
          }
          return b;
        }
      );

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'BENEFICIARY_REGISTERED',
        entityType: 'beneficiary',
        entityId: created.id,
        details: { vulnerabilityLevel: created.vulnerabilityLevel },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ beneficiary: created });
    } catch (error) {
      console.error('Create beneficiary error:', error);
      return res.status(500).json({ error: 'Erreur enregistrement bénéficiaire.' });
    }
  }
);

humanitarianRouter.post(
  '/:churchId/humanitarian/beneficiaries/:beneficiaryId/family',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const beneficiaryId = Number(req.params.beneficiaryId);
      const { fullName, relationship, age, notes } = req.body ?? {};
      if (typeof fullName !== 'string' || !fullName.trim()) {
        return res.status(400).json({ error: 'Nom requis.' });
      }
      const [member] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(beneficiaryFamilyMembers)
            .values({
              churchId,
              beneficiaryId,
              fullName: fullName.trim(),
              relationship: typeof relationship === 'string' ? relationship.trim() : 'Enfant',
              age: age ? Number(age) : null,
              notes: typeof notes === 'string' ? notes.trim() || null : null,
            })
            .returning()
      );
      return res.status(201).json({ familyMember: member });
    } catch (error) {
      console.error('Add family member error:', error);
      return res.status(500).json({ error: 'Erreur ajout membre famille.' });
    }
  }
);

// Aid Requests & Prioritization
humanitarianRouter.get(
  '/:churchId/humanitarian/aid-requests',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const requests = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: aidRequests.id,
              beneficiaryId: aidRequests.beneficiaryId,
              beneficiaryName: beneficiaries.fullName,
              title: aidRequests.title,
              category: aidRequests.category,
              needsAssessment: aidRequests.needsAssessment,
              requestedAmount: aidRequests.requestedAmount,
              allocatedAmount: aidRequests.allocatedAmount,
              priorityScore: aidRequests.priorityScore,
              status: aidRequests.status,
              createdAt: aidRequests.createdAt,
            })
            .from(aidRequests)
            .innerJoin(beneficiaries, eq(aidRequests.beneficiaryId, beneficiaries.id))
            .where(eq(aidRequests.churchId, churchId))
            .orderBy(desc(aidRequests.priorityScore), desc(aidRequests.createdAt))
      );
      return res.json({ aidRequests: requests });
    } catch (error) {
      console.error('List aid requests error:', error);
      return res.status(500).json({ error: 'Erreur chargement demandes.' });
    }
  }
);

humanitarianRouter.post(
  '/:churchId/humanitarian/aid-requests',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { beneficiaryId, title, category, needsAssessment, requestedAmount, priorityScore } =
        req.body ?? {};
      if (!beneficiaryId || typeof title !== 'string' || typeof needsAssessment !== 'string') {
        return res.status(400).json({ error: 'Bénéficiaire, titre et évaluation des besoins requis.' });
      }
      const allowedCats = ['alimentaire', 'sante', 'education', 'logement', 'urgence'];
      const [created] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(aidRequests)
            .values({
              churchId,
              beneficiaryId: Number(beneficiaryId),
              title: title.trim(),
              category: allowedCats.includes(category) ? category : 'alimentaire',
              needsAssessment: needsAssessment.trim(),
              requestedAmount: Math.max(0, Math.round(Number(requestedAmount) || 0)),
              priorityScore: Math.min(100, Math.max(1, Number(priorityScore) || 50)),
            })
            .returning()
      );
      return res.status(201).json({ aidRequest: created });
    } catch (error) {
      console.error('Create aid request error:', error);
      return res.status(500).json({ error: 'Erreur création demande.' });
    }
  }
);

humanitarianRouter.patch(
  '/:churchId/humanitarian/aid-requests/:requestId',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const requestId = Number(req.params.requestId);
      const { status, allocatedAmount, priorityScore } = req.body ?? {};
      const allowedStatuses = ['submitted', 'under_review', 'approved', 'fulfilled', 'rejected'];
      const updates: Partial<typeof aidRequests.$inferInsert> = {
        reviewedByUserId: req.authUser!.id,
        reviewedAt: new Date(),
      };
      if (allowedStatuses.includes(status)) updates.status = status;
      if (allocatedAmount !== undefined) updates.allocatedAmount = Math.max(0, Math.round(Number(allocatedAmount) || 0));
      if (priorityScore !== undefined) updates.priorityScore = Math.min(100, Math.max(1, Number(priorityScore) || 50));

      const [updated] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .update(aidRequests)
            .set(updates)
            .where(and(eq(aidRequests.id, requestId), eq(aidRequests.churchId, churchId)))
            .returning()
      );
      if (!updated) return res.status(404).json({ error: 'Demande introuvable.' });
      return res.json({ aidRequest: updated });
    } catch (error) {
      console.error('Update aid request error:', error);
      return res.status(500).json({ error: 'Erreur mise à jour demande.' });
    }
  }
);

// Distributions & Strict Humanitarian Fund Debit
humanitarianRouter.get(
  '/:churchId/humanitarian/distributions',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const rows = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select({
              id: aidDistributions.id,
              aidRequestId: aidDistributions.aidRequestId,
              beneficiaryId: aidDistributions.beneficiaryId,
              beneficiaryName: beneficiaries.fullName,
              amountSpent: aidDistributions.amountSpent,
              itemsSummary: aidDistributions.itemsSummary,
              proofNotes: aidDistributions.proofNotes,
              proofImageUrl: aidDistributions.proofImageUrl,
              distributedAt: aidDistributions.distributedAt,
            })
            .from(aidDistributions)
            .innerJoin(beneficiaries, eq(aidDistributions.beneficiaryId, beneficiaries.id))
            .where(eq(aidDistributions.churchId, churchId))
            .orderBy(desc(aidDistributions.distributedAt))
      );
      return res.json({ distributions: rows });
    } catch (error) {
      console.error('List distributions error:', error);
      return res.status(500).json({ error: 'Erreur chargement distributions.' });
    }
  }
);

humanitarianRouter.post(
  '/:churchId/humanitarian/distributions',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const actorId = req.authUser!.id;
      const { aidRequestId, beneficiaryId, volunteerUserId, amountSpent, itemsSummary, proofNotes, proofImageUrl } =
        req.body ?? {};
      if (!beneficiaryId || typeof itemsSummary !== 'string' || !itemsSummary.trim()) {
        return res.status(400).json({ error: 'Bénéficiaire et description des aides distribuées requis.' });
      }
      const spent = Math.max(0, Math.round(Number(amountSpent) || 0));

      const dist = await withTenantContext(
        { churchId, userId: actorId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);

          const [created] = await tx
            .insert(aidDistributions)
            .values({
              churchId,
              aidRequestId: aidRequestId ? Number(aidRequestId) : null,
              beneficiaryId: Number(beneficiaryId),
              volunteerUserId: volunteerUserId ? Number(volunteerUserId) : null,
              amountSpent: spent,
              itemsSummary: itemsSummary.trim(),
              proofNotes: typeof proofNotes === 'string' ? proofNotes.trim() || null : null,
              proofImageUrl: typeof proofImageUrl === 'string' ? proofImageUrl.trim() || null : null,
              recordedByUserId: actorId,
            })
            .returning();

          if (aidRequestId) {
            await tx
              .update(aidRequests)
              .set({ status: 'fulfilled' })
              .where(
                and(eq(aidRequests.id, Number(aidRequestId)), eq(aidRequests.churchId, churchId))
              );
          }

          if (spent > 0) {
            await appendFinancialLedgerEntry(tx, {
              churchId,
              fundType: 'humanitarian',
              entryType: 'debit',
              amount: spent,
              currency: ch?.currency || 'XOF',
              category: 'Distribution humanitaire',
              description: `Aide distribuée : ${itemsSummary.trim()}`,
              aidDistributionId: created.id,
              justificationNote: typeof proofNotes === 'string' ? proofNotes.trim() || null : null,
              justificationUrl: typeof proofImageUrl === 'string' ? proofImageUrl.trim() || null : null,
              actorUserId: actorId,
            });
          }

          return created;
        }
      );

      await recordAuditLog({
        churchId,
        actorUserId: actorId,
        actorEmail: req.authUser!.email,
        action: 'AID_DISTRIBUTION_RECORDED',
        entityType: 'aid_distribution',
        entityId: dist.id,
        details: { amountSpent: spent, itemsSummary: dist.itemsSummary },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ distribution: dist });
    } catch (error) {
      console.error('Create distribution error:', error);
      return res.status(500).json({ error: 'Erreur enregistrement distribution.' });
    }
  }
);

humanitarianRouter.post(
  '/:churchId/humanitarian/volunteers',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { userId, missionTitle, roleDescription, scheduledDate } = req.body ?? {};
      if (!userId || typeof missionTitle !== 'string' || !scheduledDate) {
        return res.status(400).json({ error: 'Bénévole, mission et date requis.' });
      }
      const [assignment] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(volunteerAssignments)
            .values({
              churchId,
              userId: Number(userId),
              missionTitle: missionTitle.trim(),
              roleDescription: typeof roleDescription === 'string' ? roleDescription.trim() || null : null,
              scheduledDate: String(scheduledDate),
            })
            .returning()
      );
      return res.status(201).json({ assignment });
    } catch (error) {
      console.error('Assign volunteer error:', error);
      return res.status(500).json({ error: 'Erreur affectation bénévole.' });
    }
  }
);

humanitarianRouter.post(
  '/:churchId/humanitarian/reports',
  requireChurchPermission('humanitarian.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { title, summary, beneficiariesHelpedCount, totalAmountSpent, proofImageUrl } =
        req.body ?? {};
      if (typeof title !== 'string' || typeof summary !== 'string' || !title.trim() || !summary.trim()) {
        return res.status(400).json({ error: 'Titre et bilan requis.' });
      }
      const [report] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .insert(interventionReports)
            .values({
              churchId,
              title: title.trim(),
              summary: summary.trim(),
              beneficiariesHelpedCount: Math.max(0, Number(beneficiariesHelpedCount) || 0),
              totalAmountSpent: Math.max(0, Math.round(Number(totalAmountSpent) || 0)),
              proofImageUrl: typeof proofImageUrl === 'string' ? proofImageUrl.trim() || null : null,
              publishedDate: new Date().toISOString().slice(0, 10),
              authorUserId: req.authUser!.id,
            })
            .returning()
      );
      return res.status(201).json({ report });
    } catch (error) {
      console.error('Create intervention report error:', error);
      return res.status(500).json({ error: 'Erreur publication rapport.' });
    }
  }
);
