import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { recordAuditLog } from '../db/audit.ts';
import { db, withTenantContext, type AppDatabase } from '../db/index.ts';
import {
  churches,
  donationCampaigns,
  donationReceipts,
  donations,
  financialLedger,
  marketplaceOrderItems,
  marketplaceOrders,
  marketplaceProducts,
  notifications,
  paymentWebhookEvents,
} from '../db/schema.ts';
import {
  appendFinancialLedgerEntry,
  getPaymentGatewayStatuses,
  PAYMENT_METHODS,
  verifyWebhookSignature,
  type PaymentMethod,
} from '../lib/payments.ts';
import { getClientIp, requireAuth, requireChurchPermission, type AuthRequest } from '../middleware/auth.ts';
import { sendToUserInChurch } from '../realtime/ws.ts';

export const donationsRouter = Router({ mergeParams: true });
donationsRouter.use(requireAuth);

export const webhooksRouter = Router();

async function ensureStarterCampaigns(tx: AppDatabase, churchId: number, userId: number, currency: string) {
  const existing = await tx
    .select({ id: donationCampaigns.id })
    .from(donationCampaigns)
    .where(eq(donationCampaigns.churchId, churchId))
    .limit(1);

  if (existing.length === 0) {
    await tx.insert(donationCampaigns).values([
      {
        churchId,
        title: 'Soutien au Sanctuaire & Ministère Pastoral',
        description:
          'Dîmes, offrandes et entretien des lieux de culte et équipements audiovisuels.',
        fundCategory: 'church',
        goalAmount: 5000000,
        currency,
        createdByUserId: userId,
      },
      {
        churchId,
        title: 'Fonds Solidarité — Paniers Alimentaires & Scolarité',
        description:
          'Aide directe aux familles vulnérables, veuves, orphelins et soins médicaux d’urgence.',
        fundCategory: 'humanitarian',
        goalAmount: 3000000,
        currency,
        createdByUserId: userId,
      },
    ]);
  }
}

async function issueDonationReceipt(tx: AppDatabase, churchId: number, donationId: number) {
  const existing = await tx
    .select()
    .from(donationReceipts)
    .where(eq(donationReceipts.donationId, donationId))
    .limit(1);
  if (existing.length) return existing[0];

  const receiptNumber = `REC-${churchId}-${new Date().getFullYear()}-${String(donationId).padStart(6, '0')}`;
  const verificationHash = crypto
    .createHash('sha256')
    .update(`${receiptNumber}:${churchId}:${donationId}:${Date.now()}`)
    .digest('hex')
    .slice(0, 24);

  const [receipt] = await tx
    .insert(donationReceipts)
    .values({
      churchId,
      donationId,
      receiptNumber,
      verificationHash,
    })
    .returning();
  return receipt;
}

donationsRouter.get(
  '/:churchId/donations/overview',
  requireChurchPermission('donations.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const canManage = req.tenant!.permissions.includes('donations.manage');

      const data = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [churchRow] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);
          const currency = churchRow?.currency || 'XOF';

          await ensureStarterCampaigns(tx, churchId, userId, currency);

          const campaigns = await tx
            .select()
            .from(donationCampaigns)
            .where(eq(donationCampaigns.churchId, churchId))
            .orderBy(desc(donationCampaigns.createdAt));

          const allDonations = await tx
            .select()
            .from(donations)
            .where(eq(donations.churchId, churchId))
            .orderBy(desc(donations.createdAt))
            .limit(100);

          const receipts = await tx
            .select()
            .from(donationReceipts)
            .where(eq(donationReceipts.churchId, churchId));
          const receiptMap = new Map(receipts.map((r) => [r.donationId, r]));

          const ledger = await tx
            .select()
            .from(financialLedger)
            .where(eq(financialLedger.churchId, churchId))
            .orderBy(desc(financialLedger.id))
            .limit(100);

          const computeFundSummary = (fundType: 'church' | 'humanitarian' | 'commercial') => {
            const rows = ledger.filter((l) => l.fundType === fundType);
            const credits = rows
              .filter((r) => r.entryType === 'credit')
              .reduce((s, r) => s + r.amount, 0);
            const debits = rows
              .filter((r) => r.entryType === 'debit')
              .reduce((s, r) => s + r.amount, 0);
            return { credits, debits, balance: credits - debits };
          };

          const formattedDonations = allDonations.map((d) => ({
            id: d.id,
            campaignId: d.campaignId,
            donorName:
              d.isAnonymous && d.donorUserId !== userId && !canManage
                ? 'Donateur anonyme'
                : d.isAnonymous
                  ? `${d.donorName} (Anonyme)`
                  : d.donorName,
            fundCategory: d.fundCategory,
            amount: d.amount,
            currency: d.currency,
            frequency: d.frequency,
            isAnonymous: d.isAnonymous,
            paymentMethod: d.paymentMethod,
            paymentReference: d.paymentReference,
            gatewayMode: d.gatewayMode,
            status: d.status,
            confirmedAt: d.confirmedAt,
            createdAt: d.createdAt,
            isMine: d.donorUserId === userId,
            receipt: receiptMap.get(d.id) || null,
          }));

          return {
            currency,
            gateways: getPaymentGatewayStatuses(),
            campaigns,
            donations: canManage
              ? formattedDonations
              : formattedDonations.filter((d) => d.isMine || d.status === 'confirmed'),
            ledger,
            fundSeparation: {
              church: computeFundSummary('church'),
              humanitarian: computeFundSummary('humanitarian'),
              commercial: computeFundSummary('commercial'),
            },
          };
        }
      );

      return res.json(data);
    } catch (error) {
      console.error('Donations overview error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des dons.' });
    }
  }
);

donationsRouter.post(
  '/:churchId/donations/campaigns',
  requireChurchPermission('donations.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const { title, description, fundCategory, goalAmount, endsAt } = req.body ?? {};
      const goal = Number(goalAmount);
      if (typeof title !== 'string' || !title.trim() || !Number.isFinite(goal) || goal <= 0) {
        return res.status(400).json({ error: 'Titre et objectif financier positif requis.' });
      }
      const safeFund = fundCategory === 'humanitarian' ? 'humanitarian' : 'church';

      const [campaign] = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);
          return tx
            .insert(donationCampaigns)
            .values({
              churchId,
              title: title.trim(),
              description: typeof description === 'string' ? description.trim() : '',
              fundCategory: safeFund,
              goalAmount: Math.round(goal),
              currency: ch?.currency || 'XOF',
              endsAt: endsAt ? new Date(endsAt) : null,
              createdByUserId: req.authUser!.id,
            })
            .returning();
        }
      );

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: 'CAMPAIGN_CREATED',
        entityType: 'donation_campaign',
        entityId: campaign.id,
        details: { title: campaign.title, fundCategory: safeFund, goalAmount: campaign.goalAmount },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ campaign });
    } catch (error) {
      console.error('Create campaign error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création de la campagne.' });
    }
  }
);

// Initiate an online / mobile money donation (stays PENDING until verified server-side webhook arrives)
donationsRouter.post(
  '/:churchId/donations',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { campaignId, fundCategory, amount, frequency, isAnonymous, paymentMethod, donorPhone } =
        req.body ?? {};

      const numAmount = Math.round(Number(amount));
      if (!Number.isFinite(numAmount) || numAmount < 100) {
        return res.status(400).json({ error: 'Montant invalide (minimum 100).' });
      }

      if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod) || paymentMethod === 'cash') {
        return res.status(400).json({
          error:
            'Moyen de paiement en ligne invalide (orange_money, mtn_momo, moov_money, wave ou card requis).',
        });
      }

      const method = paymentMethod as PaymentMethod;
      const gatewayInfo = getPaymentGatewayStatuses().find((g) => g.provider === method);
      const safeFreq = ['one_time', 'monthly', 'weekly'].includes(frequency) ? frequency : 'one_time';
      const paymentReference = `DON-${churchId}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const created = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);

          let resolvedFund = fundCategory === 'humanitarian' ? 'humanitarian' : 'church';
          let validCampaignId: number | null = null;
          if (campaignId) {
            const [camp] = await tx
              .select()
              .from(donationCampaigns)
              .where(
                and(
                  eq(donationCampaigns.id, Number(campaignId)),
                  eq(donationCampaigns.churchId, churchId)
                )
              )
              .limit(1);
            if (camp) {
              validCampaignId = camp.id;
              resolvedFund = camp.fundCategory === 'humanitarian' ? 'humanitarian' : 'church';
            }
          }

          const [donation] = await tx
            .insert(donations)
            .values({
              churchId,
              campaignId: validCampaignId,
              donorUserId: userId,
              donorName: req.authUser!.fullName,
              donorEmail: req.authUser!.email,
              donorPhone: typeof donorPhone === 'string' ? donorPhone.trim() || null : null,
              fundCategory: resolvedFund,
              amount: numAmount,
              currency: ch?.currency || 'XOF',
              frequency: safeFreq,
              isAnonymous: Boolean(isAnonymous),
              paymentMethod: method,
              paymentReference,
              gatewayMode: gatewayInfo?.mode || 'sandbox',
              status: 'pending',
            })
            .returning();

          return donation;
        }
      );

      return res.status(201).json({
        donation: created,
        paymentInstructions: {
          status: 'pending',
          gatewayMode: gatewayInfo?.mode || 'sandbox',
          providerLabel: gatewayInfo?.label || method,
          paymentReference,
          message:
            gatewayInfo?.mode === 'live'
              ? `Transaction initialisée auprès de ${gatewayInfo.label}. Confirmation automatique dès réception du webhook vérifié.`
              : `Passerelle ${gatewayInfo?.label} en mode Sandbox (${gatewayInfo?.envKeyHint} non configuré). La transaction reste en attente jusqu'à confirmation par webhook signé côté serveur.`,
        },
      });
    } catch (error) {
      console.error('Initiate donation error:', error);
      return res.status(500).json({ error: "Erreur lors de l'initiation du don." });
    }
  }
);

// Authorized cash donation entry by treasurer / admin (donations.manage)
donationsRouter.post(
  '/:churchId/donations/cash',
  requireChurchPermission('donations.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const actorId = req.authUser!.id;
      const { campaignId, fundCategory, amount, donorName, donorEmail, isAnonymous } = req.body ?? {};
      const numAmount = Math.round(Number(amount));
      if (!Number.isFinite(numAmount) || numAmount <= 0 || typeof donorName !== 'string' || !donorName.trim()) {
        return res.status(400).json({ error: 'Nom du donateur et montant positif requis.' });
      }

      const paymentReference = `CASH-${churchId}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const result = await withTenantContext(
        { churchId, userId: actorId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);

          let resolvedFund: 'church' | 'humanitarian' =
            fundCategory === 'humanitarian' ? 'humanitarian' : 'church';
          let validCampaignId: number | null = null;
          if (campaignId) {
            const [camp] = await tx
              .select()
              .from(donationCampaigns)
              .where(
                and(
                  eq(donationCampaigns.id, Number(campaignId)),
                  eq(donationCampaigns.churchId, churchId)
                )
              )
              .limit(1);
            if (camp) {
              validCampaignId = camp.id;
              resolvedFund = camp.fundCategory === 'humanitarian' ? 'humanitarian' : 'church';
            }
          }

          const [donation] = await tx
            .insert(donations)
            .values({
              churchId,
              campaignId: validCampaignId,
              donorUserId: null,
              donorName: donorName.trim(),
              donorEmail: typeof donorEmail === 'string' ? donorEmail.trim() || null : null,
              fundCategory: resolvedFund,
              amount: numAmount,
              currency: ch?.currency || 'XOF',
              frequency: 'one_time',
              isAnonymous: Boolean(isAnonymous),
              paymentMethod: 'cash',
              paymentReference,
              gatewayMode: 'cash_desk',
              status: 'confirmed',
              recordedByUserId: actorId,
              confirmedAt: new Date(),
            })
            .returning();

          if (validCampaignId) {
            await tx
              .update(donationCampaigns)
              .set({ collectedAmount: sql`${donationCampaigns.collectedAmount} + ${numAmount}` })
              .where(eq(donationCampaigns.id, validCampaignId));
          }

          const receipt = await issueDonationReceipt(tx, churchId, donation.id);
          await appendFinancialLedgerEntry(tx, {
            churchId,
            fundType: resolvedFund,
            entryType: 'credit',
            amount: numAmount,
            currency: donation.currency,
            category: 'Don espèces',
            description: `Don en espèces (${donation.isAnonymous ? 'Anonyme' : donation.donorName}) — Réf ${paymentReference}`,
            campaignId: validCampaignId,
            donationId: donation.id,
            justificationNote: `Enregistré par ${req.authUser!.fullName}`,
            actorUserId: actorId,
          });

          return { donation, receipt };
        }
      );

      await recordAuditLog({
        churchId,
        actorUserId: actorId,
        actorEmail: req.authUser!.email,
        action: 'CASH_DONATION_RECORDED',
        entityType: 'donation',
        entityId: result.donation.id,
        details: { amount: numAmount, paymentReference, fundCategory: result.donation.fundCategory },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error('Cash donation error:', error);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement du don espèces." });
    }
  }
);

donationsRouter.post(
  '/:churchId/donations/expenses',
  requireChurchPermission('donations.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const actorId = req.authUser!.id;
      const { fundType, category, description, amount, justificationNote, justificationUrl } =
        req.body ?? {};
      const numAmount = Math.round(Number(amount));
      if (!Number.isFinite(numAmount) || numAmount <= 0 || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'Description et montant positif requis.' });
      }
      const safeFund: 'church' | 'humanitarian' | 'commercial' =
        fundType === 'humanitarian' || fundType === 'commercial' ? fundType : 'church';

      const entry = await withTenantContext(
        { churchId, userId: actorId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);

          return appendFinancialLedgerEntry(tx, {
            churchId,
            fundType: safeFund,
            entryType: 'debit',
            amount: numAmount,
            currency: ch?.currency || 'XOF',
            category: typeof category === 'string' && category.trim() ? category.trim() : 'Dépense opérationnelle',
            description: description.trim(),
            justificationNote: typeof justificationNote === 'string' ? justificationNote.trim() || null : null,
            justificationUrl: typeof justificationUrl === 'string' ? justificationUrl.trim() || null : null,
            actorUserId: actorId,
          });
        }
      );

      await recordAuditLog({
        churchId,
        actorUserId: actorId,
        actorEmail: req.authUser!.email,
        action: 'LEDGER_EXPENSE_RECORDED',
        entityType: 'financial_ledger',
        entityId: entry.id,
        details: { fundType: safeFund, amount: numAmount, category: entry.category },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ entry });
    } catch (error) {
      console.error('Expense record error:', error);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement de la dépense." });
    }
  }
);

donationsRouter.get(
  '/:churchId/donations/export.csv',
  requireChurchPermission('donations.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const rows = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) =>
          tx
            .select()
            .from(financialLedger)
            .where(eq(financialLedger.churchId, churchId))
            .orderBy(desc(financialLedger.id))
      );

      const escapeCsv = (val: string | number | null | undefined) => {
        const s = String(val ?? '');
        return `"${s.replace(/"/g, '""')}"`;
      };

      const header = ['ID', 'Date', 'Fonds', 'Type', 'Catégorie', 'Description', 'Montant', 'Devise', 'Justificatif', 'Empreinte SHA256'].join(';');
      const lines = rows.map((r) =>
        [
          r.id,
          new Date(r.createdAt).toISOString(),
          r.fundType,
          r.entryType === 'credit' ? 'Entrée' : 'Sortie',
          escapeCsv(r.category),
          escapeCsv(r.description),
          r.amount,
          r.currency,
          escapeCsv(r.justificationNote),
          r.entryHash.slice(0, 16),
        ].join(';')
      );

      const csv = '\uFEFF' + [header, ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="sanctuaire-finances-eglise-${churchId}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error('CSV export error:', error);
      return res.status(500).json({ error: "Erreur lors de l'export financier." });
    }
  }
);

// Server-side verified payment webhook (Orange Money, MTN MoMo, Moov, Wave, Card)
webhooksRouter.post('/payments/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    const signature =
      (typeof req.headers['x-webhook-signature'] === 'string' && req.headers['x-webhook-signature']) ||
      (typeof req.headers['x-signature'] === 'string' && req.headers['x-signature']) ||
      '';

    const rawBody = JSON.stringify(req.body ?? {});
    const isValidSig = verifyWebhookSignature(rawBody, signature);
    if (!isValidSig) {
      return res.status(401).json({ error: 'Signature webhook invalide.' });
    }

    const { externalEventId, paymentReference, status, externalTransactionId } = req.body ?? {};
    if (typeof externalEventId !== 'string' || typeof paymentReference !== 'string' || !status) {
      return res.status(400).json({ error: 'Champs webhook requis manquants.' });
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.is_super_admin', 'true', true)`);

      const existingEvent = await tx
        .select()
        .from(paymentWebhookEvents)
        .where(eq(paymentWebhookEvents.externalEventId, externalEventId))
        .limit(1);
      if (existingEvent.length > 0) {
        return { idempotent: true, status: existingEvent[0].status };
      }

      const [donation] = await tx
        .select()
        .from(donations)
        .where(eq(donations.paymentReference, paymentReference))
        .limit(1);

      if (!donation) {
        const [order] = await tx
          .select()
          .from(marketplaceOrders)
          .where(eq(marketplaceOrders.paymentReference, paymentReference))
          .limit(1);

        if (!order) {
          return { notFound: true };
        }

        await tx.insert(paymentWebhookEvents).values({
          churchId: order.churchId,
          provider,
          externalEventId,
          paymentReference,
          signatureValid: true,
          status: String(status),
          payload: (req.body ?? {}) as Record<string, unknown>,
        });

        const normalizedOrderStatus =
          status === 'confirmed' || status === 'succeeded' ? 'paid' : 'cancelled';
        if (order.status === 'pending') {
          await tx
            .update(marketplaceOrders)
            .set({
              status: normalizedOrderStatus,
              confirmedAt: normalizedOrderStatus === 'paid' ? new Date() : null,
            })
            .where(eq(marketplaceOrders.id, order.id));

          if (normalizedOrderStatus === 'paid') {
            const items = await tx
              .select()
              .from(marketplaceOrderItems)
              .where(eq(marketplaceOrderItems.orderId, order.id));
            for (const item of items) {
              if (item.productId) {
                await tx
                  .update(marketplaceProducts)
                  .set({
                    stockQuantity: sql`GREATEST(0, ${marketplaceProducts.stockQuantity} - ${item.quantity})`,
                  })
                  .where(eq(marketplaceProducts.id, item.productId));
              }
            }

            await appendFinancialLedgerEntry(tx as unknown as AppDatabase, {
              churchId: order.churchId,
              fundType: order.fundType === 'humanitarian' ? 'humanitarian' : 'commercial',
              entryType: 'credit',
              amount: order.totalAmount,
              currency: order.currency,
              category:
                order.fundType === 'humanitarian'
                  ? `Boutique Solidaire (${provider})`
                  : `Marketplace (${provider})`,
              description: `Commande marketplace payée — Réf ${paymentReference}`,
              justificationNote: `Webhook vérifié (${provider})`,
              actorUserId: order.buyerUserId,
            });

            const [notif] = await tx
              .insert(notifications)
              .values({
                churchId: order.churchId,
                userId: order.buyerUserId,
                type: 'marketplace_order_paid',
                title: 'Commande confirmée',
                body: `Votre commande (${paymentReference}) de ${order.totalAmount} ${order.currency} est confirmée.`,
              })
              .returning();
            sendToUserInChurch(order.churchId, order.buyerUserId, 'notification:new', notif);
          }
        }

        return { processed: true, status: normalizedOrderStatus, entityType: 'marketplace_order' };
      }

      await tx.insert(paymentWebhookEvents).values({
        churchId: donation.churchId,
        provider,
        externalEventId,
        paymentReference,
        signatureValid: true,
        status: String(status),
        payload: (req.body ?? {}) as Record<string, unknown>,
      });

      const normalizedStatus = status === 'confirmed' || status === 'succeeded' ? 'confirmed' : 'failed';
      if (donation.status === 'pending') {
        await tx
          .update(donations)
          .set({
            status: normalizedStatus,
            externalTransactionId:
              typeof externalTransactionId === 'string' ? externalTransactionId : null,
            confirmedAt: normalizedStatus === 'confirmed' ? new Date() : null,
          })
          .where(eq(donations.id, donation.id));

        if (normalizedStatus === 'confirmed') {
          if (donation.campaignId) {
            await tx
              .update(donationCampaigns)
              .set({ collectedAmount: sql`${donationCampaigns.collectedAmount} + ${donation.amount}` })
              .where(eq(donationCampaigns.id, donation.campaignId));
          }

          await issueDonationReceipt(tx as unknown as AppDatabase, donation.churchId, donation.id);
          await appendFinancialLedgerEntry(tx as unknown as AppDatabase, {
            churchId: donation.churchId,
            fundType: donation.fundCategory === 'humanitarian' ? 'humanitarian' : 'church',
            entryType: 'credit',
            amount: donation.amount,
            currency: donation.currency,
            category: `Don ${provider}`,
            description: `Don vérifié (${donation.isAnonymous ? 'Anonyme' : donation.donorName}) — Réf ${paymentReference}`,
            campaignId: donation.campaignId,
            donationId: donation.id,
            justificationNote: `Webhook vérifié (${provider})`,
            actorUserId: donation.donorUserId,
          });

          if (donation.donorUserId) {
            const [notif] = await tx
              .insert(notifications)
              .values({
                churchId: donation.churchId,
                userId: donation.donorUserId,
                type: 'donation_confirmed',
                title: 'Don confirmé',
                body: `Votre don de ${donation.amount} ${donation.currency} (${paymentReference}) est confirmé. Votre reçu numérique est disponible.`,
              })
              .returning();
            sendToUserInChurch(donation.churchId, donation.donorUserId, 'notification:new', notif);
          }
        }
      }

      return { processed: true, status: normalizedStatus };
    });

    if ('notFound' in result && result.notFound) {
      return res.status(404).json({ error: 'Référence de transaction introuvable.' });
    }
    return res.json(result);
  } catch (error) {
    console.error('Payment webhook error:', error);
    return res.status(500).json({ error: 'Erreur lors du traitement webhook.' });
  }
});
