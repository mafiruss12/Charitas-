import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { recordAuditLog } from '../db/audit.ts';
import { withTenantContext, type AppDatabase } from '../db/index.ts';
import {
  auctionBids,
  auctions,
  churches,
  marketplaceOrderItems,
  marketplaceOrders,
  marketplaceProducts,
  notifications,
  users,
} from '../db/schema.ts';
import {
  appendFinancialLedgerEntry,
  getPaymentGatewayStatuses,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../lib/payments.ts';
import {
  getClientIp,
  requireAuth,
  requireChurchPermission,
  type AuthRequest,
} from '../middleware/auth.ts';
import { sendToUserInChurch } from '../realtime/ws.ts';

export const commerceRouter = Router({ mergeParams: true });
commerceRouter.use(requireAuth);

async function ensureStarterCommerce(tx: AppDatabase, churchId: number, userId: number, currency: string) {
  const existingProd = await tx
    .select({ id: marketplaceProducts.id })
    .from(marketplaceProducts)
    .where(eq(marketplaceProducts.churchId, churchId))
    .limit(1);

  if (existingProd.length === 0) {
    await tx.insert(marketplaceProducts).values([
      {
        churchId,
        sellerUserId: userId,
        title: "Bible d'Étude Louis Segond — Édition Cuir",
        description:
          'Édition reliée avec notes d’étude, cartes bibliques en couleurs et concordance.',
        category: 'Littérature chrétienne',
        isSolidarityProduct: false,
        price: 18500,
        currency,
        stockQuantity: 24,
        status: 'active',
      },
      {
        churchId,
        sellerUserId: userId,
        title: 'Pagnes & Sacs Artisanaux — Atelier des Veuves (Solidaire)',
        description:
          '100 % des bénéfices sont versés au fonds humanitaire pour l’autonomisation des familles accompagnées.',
        category: 'Boutique solidaire',
        isSolidarityProduct: true,
        price: 12000,
        currency,
        stockQuantity: 15,
        status: 'active',
      },
    ]);
  }

  const existingAuc = await tx
    .select({ id: auctions.id })
    .from(auctions)
    .where(eq(auctions.churchId, churchId))
    .limit(1);

  if (existingAuc.length === 0) {
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await tx.insert(auctions).values({
      churchId,
      sellerUserId: userId,
      title: 'Toile peinte « Espérance sur Abidjan » — Enchère Caritative',
      description:
        'Œuvre originale offerte au profit de la bourse scolaire des enfants suivis par le pôle social.',
      startPrice: 25000,
      reservePrice: 40000,
      currentBidAmount: 0,
      endsAt,
      moderationStatus: 'approved',
      status: 'active',
      fundAllocation: 'humanitarian',
      currency,
    });
  }
}

// ==================== MARKETPLACE & SOLIDARITY SHOP ====================

commerceRouter.get(
  '/:churchId/marketplace/products',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const canManage = req.tenant!.permissions.includes('marketplace.manage');

      const data = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);
          await ensureStarterCommerce(tx, churchId, userId, ch?.currency || 'XOF');

          const rows = await tx
            .select()
            .from(marketplaceProducts)
            .where(eq(marketplaceProducts.churchId, churchId))
            .orderBy(desc(marketplaceProducts.createdAt));

          return canManage ? rows : rows.filter((p) => p.status !== 'archived');
        }
      );

      return res.json({ products: data });
    } catch (error) {
      console.error('Marketplace products get error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement de la marketplace.' });
    }
  }
);

commerceRouter.post(
  '/:churchId/marketplace/products',
  requireChurchPermission('marketplace.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { title, description, category, isSolidarityProduct, price, stockQuantity, imageUrl } =
        req.body ?? {};

      const numPrice = Math.round(Number(price));
      const numStock = Math.round(Number(stockQuantity ?? 1));
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        typeof description !== 'string' ||
        !description.trim() ||
        !Number.isFinite(numPrice) ||
        numPrice < 100
      ) {
        return res
          .status(400)
          .json({ error: 'Titre, description et prix valide (>= 100) requis.' });
      }

      const product = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);

          const [created] = await tx
            .insert(marketplaceProducts)
            .values({
              churchId,
              sellerUserId: userId,
              title: title.trim(),
              description: description.trim(),
              category:
                typeof category === 'string' && category.trim()
                  ? category.trim()
                  : isSolidarityProduct
                    ? 'Boutique solidaire'
                    : 'Littérature & Artisanat',
              isSolidarityProduct: Boolean(isSolidarityProduct),
              price: numPrice,
              currency: ch?.currency || 'XOF',
              stockQuantity: Math.max(0, Number.isFinite(numStock) ? numStock : 1),
              imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() || null : null,
              status: numStock > 0 ? 'active' : 'out_of_stock',
            })
            .returning();
          return created;
        }
      );

      await recordAuditLog({
        churchId,
        actorUserId: userId,
        actorEmail: req.authUser!.email,
        action: 'MARKETPLACE_PRODUCT_CREATED',
        entityType: 'marketplace_product',
        entityId: product.id,
        details: { title: product.title, isSolidarityProduct: product.isSolidarityProduct },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ product });
    } catch (error) {
      console.error('Create marketplace product error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création du produit.' });
    }
  }
);

commerceRouter.get(
  '/:churchId/marketplace/orders',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const canManage =
        req.tenant!.permissions.includes('marketplace.manage') ||
        req.tenant!.permissions.includes('donations.manage');

      const orders = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const allOrders = await tx
            .select()
            .from(marketplaceOrders)
            .where(
              canManage
                ? eq(marketplaceOrders.churchId, churchId)
                : and(
                    eq(marketplaceOrders.churchId, churchId),
                    eq(marketplaceOrders.buyerUserId, userId)
                  )
            )
            .orderBy(desc(marketplaceOrders.createdAt))
            .limit(60);

          const allItems = await tx
            .select()
            .from(marketplaceOrderItems)
            .where(eq(marketplaceOrderItems.churchId, churchId));

          const buyers = await tx
            .select({ id: users.id, fullName: users.fullName })
            .from(users);
          const buyerMap = new Map(buyers.map((u) => [u.id, u.fullName]));

          return allOrders.map((o) => ({
            ...o,
            buyerName: buyerMap.get(o.buyerUserId) || 'Membre',
            items: allItems.filter((i) => i.orderId === o.id),
          }));
        }
      );

      return res.json({ orders });
    } catch (error) {
      console.error('Get orders error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des commandes.' });
    }
  }
);

commerceRouter.post(
  '/:churchId/marketplace/orders',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { productId, quantity, paymentMethod, shippingAddress } = req.body ?? {};
      const qty = Math.round(Number(quantity ?? 1));

      if (!productId || !Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ error: 'Produit et quantité valide (>= 1) requis.' });
      }
      if (typeof shippingAddress !== 'string' || !shippingAddress.trim()) {
        return res.status(400).json({ error: 'Adresse ou point de retrait requis.' });
      }
      if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
        return res.status(400).json({ error: 'Moyen de paiement invalide.' });
      }
      if (
        paymentMethod === 'cash' &&
        !req.tenant!.permissions.includes('marketplace.manage') &&
        !req.tenant!.permissions.includes('donations.manage')
      ) {
        return res.status(403).json({
          error: 'Seul un responsable marketplace ou trésorier peut valider un paiement espèces.',
        });
      }

      const method = paymentMethod as PaymentMethod;
      const gatewayInfo = getPaymentGatewayStatuses().find((g) => g.provider === method);
      const paymentReference = `ORD-${churchId}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [product] = await tx
            .select()
            .from(marketplaceProducts)
            .where(
              and(
                eq(marketplaceProducts.id, Number(productId)),
                eq(marketplaceProducts.churchId, churchId)
              )
            )
            .limit(1);

          if (!product || product.status !== 'active') {
            return { error: 'Produit introuvable ou indisponible.', code: 404 as const };
          }
          if (product.stockQuantity < qty) {
            return { error: 'Stock insuffisant pour cette quantité.', code: 400 as const };
          }

          const totalAmount = product.price * qty;
          const fundType: 'commercial' | 'humanitarian' = product.isSolidarityProduct
            ? 'humanitarian'
            : 'commercial';
          const isCash = method === 'cash';

          const [order] = await tx
            .insert(marketplaceOrders)
            .values({
              churchId,
              buyerUserId: userId,
              totalAmount,
              currency: product.currency,
              fundType,
              paymentMethod: method,
              paymentReference,
              gatewayMode: isCash ? 'cash_desk' : gatewayInfo?.mode || 'sandbox',
              status: isCash ? 'paid' : 'pending',
              shippingAddress: shippingAddress.trim(),
              confirmedAt: isCash ? new Date() : null,
            })
            .returning();

          const [item] = await tx
            .insert(marketplaceOrderItems)
            .values({
              churchId,
              orderId: order.id,
              productId: product.id,
              titleSnapshot: product.title,
              unitPrice: product.price,
              quantity: qty,
              lineTotal: totalAmount,
            })
            .returning();

          if (isCash) {
            await tx
              .update(marketplaceProducts)
              .set({
                stockQuantity: sql`GREATEST(0, ${marketplaceProducts.stockQuantity} - ${qty})`,
              })
              .where(eq(marketplaceProducts.id, product.id));

            await appendFinancialLedgerEntry(tx, {
              churchId,
              fundType,
              entryType: 'credit',
              amount: totalAmount,
              currency: product.currency,
              category: product.isSolidarityProduct ? 'Boutique Solidaire (Espèces)' : 'Marketplace (Espèces)',
              description: `Commande ${paymentReference} — ${product.title} x${qty}`,
              justificationNote: 'Encaissement guichet validé',
              actorUserId: userId,
            });
          }

          return { order, items: [item] };
        }
      );

      if ('error' in result && result.error) {
        return res.status(result.code).json({ error: result.error });
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error('Create marketplace order error:', error);
      return res.status(500).json({ error: 'Erreur lors de la création de la commande.' });
    }
  }
);

commerceRouter.patch(
  '/:churchId/marketplace/orders/:orderId/status',
  requireChurchPermission('marketplace.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const orderId = Number(req.params.orderId);
      const { status } = req.body ?? {};
      if (!['shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Statut de suivi invalide (shipped, delivered, cancelled).' });
      }

      const updated = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [row] = await tx
            .update(marketplaceOrders)
            .set({ status })
            .where(and(eq(marketplaceOrders.id, orderId), eq(marketplaceOrders.churchId, churchId)))
            .returning();
          return row;
        }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Commande introuvable.' });
      }
      return res.json({ order: updated });
    } catch (error) {
      console.error('Update order status error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour de commande.' });
    }
  }
);

// ==================== SOLIDARITY AUCTIONS ====================

commerceRouter.get(
  '/:churchId/auctions',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const canManage = req.tenant!.permissions.includes('auctions.manage');

      const data = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);
          await ensureStarterCommerce(tx, churchId, userId, ch?.currency || 'XOF');

          // Transition expired active auctions to ended cleanly
          await tx
            .update(auctions)
            .set({ status: 'ended' })
            .where(
              and(
                eq(auctions.churchId, churchId),
                eq(auctions.status, 'active'),
                sql`${auctions.endsAt} <= NOW()`
              )
            );

          const allAuctions = await tx
            .select()
            .from(auctions)
            .where(eq(auctions.churchId, churchId))
            .orderBy(desc(auctions.createdAt));

          const visible = allAuctions.filter(
            (a) => a.moderationStatus === 'approved' || a.sellerUserId === userId || canManage
          );

          const bids = await tx
            .select()
            .from(auctionBids)
            .where(eq(auctionBids.churchId, churchId))
            .orderBy(desc(auctionBids.amount));

          const userRows = await tx.select({ id: users.id, fullName: users.fullName }).from(users);
          const userMap = new Map(userRows.map((u) => [u.id, u.fullName]));

          return visible.map((a) => ({
            ...a,
            sellerName: userMap.get(a.sellerUserId) || 'Membre',
            highestBidderName: a.highestBidderUserId
              ? userMap.get(a.highestBidderUserId) || 'Enchérisseur'
              : null,
            bidsCount: bids.filter((b) => b.auctionId === a.id).length,
            recentBids: bids
              .filter((b) => b.auctionId === a.id)
              .slice(0, 5)
              .map((b) => ({
                id: b.id,
                bidderName: userMap.get(b.bidderUserId) || 'Membre',
                amount: b.amount,
                createdAt: b.createdAt,
              })),
          }));
        }
      );

      return res.json({ auctions: data });
    } catch (error) {
      console.error('Get auctions error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des enchères.' });
    }
  }
);

commerceRouter.post(
  '/:churchId/auctions',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const { title, description, startPrice, reservePrice, durationDays, fundAllocation, imageUrl } =
        req.body ?? {};

      const numStart = Math.round(Number(startPrice));
      const numReserve = Math.round(Number(reservePrice ?? 0));
      const days = Math.min(30, Math.max(1, Math.round(Number(durationDays ?? 5))));

      if (
        typeof title !== 'string' ||
        !title.trim() ||
        typeof description !== 'string' ||
        !description.trim() ||
        !Number.isFinite(numStart) ||
        numStart < 500
      ) {
        return res
          .status(400)
          .json({ error: 'Titre, description et mise à prix (>= 500) requis.' });
      }

      const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const auction = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [ch] = await tx
            .select({ currency: churches.currency })
            .from(churches)
            .where(eq(churches.id, churchId))
            .limit(1);

          const [created] = await tx
            .insert(auctions)
            .values({
              churchId,
              sellerUserId: userId,
              title: title.trim(),
              description: description.trim(),
              imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() || null : null,
              startPrice: numStart,
              reservePrice: Number.isFinite(numReserve) && numReserve >= 0 ? numReserve : 0,
              currentBidAmount: 0,
              endsAt,
              moderationStatus: 'pending',
              status: 'draft',
              fundAllocation: fundAllocation === 'church' ? 'church' : 'humanitarian',
              currency: ch?.currency || 'XOF',
            })
            .returning();
          return created;
        }
      );

      return res.status(201).json({ auction });
    } catch (error) {
      console.error('Create auction error:', error);
      return res.status(500).json({ error: "Erreur lors de la création de l'enchère." });
    }
  }
);

commerceRouter.post(
  '/:churchId/auctions/:auctionId/moderate',
  requireChurchPermission('auctions.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const auctionId = Number(req.params.auctionId);
      const { decision } = req.body ?? {};

      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Décision invalide (approved ou rejected).' });
      }

      const updated = await withTenantContext(
        { churchId, userId: req.authUser!.id, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [row] = await tx
            .update(auctions)
            .set({
              moderationStatus: decision,
              status: decision === 'approved' ? 'active' : 'cancelled',
            })
            .where(and(eq(auctions.id, auctionId), eq(auctions.churchId, churchId)))
            .returning();
          return row;
        }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Enchère introuvable.' });
      }

      await recordAuditLog({
        churchId,
        actorUserId: req.authUser!.id,
        actorEmail: req.authUser!.email,
        action: `AUCTION_${decision.toUpperCase()}`,
        entityType: 'auction',
        entityId: updated.id,
        details: { title: updated.title },
        ipAddress: getClientIp(req),
      });

      return res.json({ auction: updated });
    } catch (error) {
      console.error('Moderate auction error:', error);
      return res.status(500).json({ error: 'Erreur lors de la modération.' });
    }
  }
);

commerceRouter.post(
  '/:churchId/auctions/:auctionId/bids',
  requireChurchPermission('church.view'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const userId = req.authUser!.id;
      const auctionId = Number(req.params.auctionId);
      const amount = Math.round(Number(req.body?.amount));

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Montant d'enchère invalide." });
      }

      const result = await withTenantContext(
        { churchId, userId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [auction] = await tx
            .select()
            .from(auctions)
            .where(and(eq(auctions.id, auctionId), eq(auctions.churchId, churchId)))
            .limit(1);

          if (!auction) {
            return { error: 'Lot introuvable.', code: 404 as const };
          }
          if (auction.sellerUserId === userId) {
            return { error: 'Le vendeur ne peut pas enchérir sur son propre lot.', code: 403 as const };
          }
          if (auction.moderationStatus !== 'approved' || auction.status !== 'active') {
            return { error: "Cette enchère n'est pas ouverte aux mises.", code: 400 as const };
          }
          if (new Date(auction.endsAt).getTime() <= Date.now()) {
            return { error: 'Cette enchère est expirée.', code: 400 as const };
          }

          const minRequired =
            auction.currentBidAmount > 0 ? auction.currentBidAmount + 1 : auction.startPrice;
          if (amount < minRequired) {
            return {
              error: `L'offre doit être d'au moins ${minRequired} ${auction.currency}.`,
              code: 400 as const,
            };
          }

          const previousLeaderId = auction.highestBidderUserId;

          const [bid] = await tx
            .insert(auctionBids)
            .values({
              churchId,
              auctionId: auction.id,
              bidderUserId: userId,
              amount,
            })
            .returning();

          const [updated] = await tx
            .update(auctions)
            .set({
              currentBidAmount: amount,
              highestBidderUserId: userId,
            })
            .where(eq(auctions.id, auction.id))
            .returning();

          if (previousLeaderId && previousLeaderId !== userId) {
            const [notif] = await tx
              .insert(notifications)
              .values({
                churchId,
                userId: previousLeaderId,
                type: 'auction_outbid',
                title: 'Vous avez été surenchéri',
                body: `Une offre de ${amount} ${auction.currency} vient d’être placée sur « ${auction.title} ».`,
              })
              .returning();
            sendToUserInChurch(churchId, previousLeaderId, 'notification:new', notif);
          }

          return { bid, auction: updated };
        }
      );

      if ('error' in result && result.error) {
        return res.status(result.code).json({ error: result.error });
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error('Place bid error:', error);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement de l'offre." });
    }
  }
);

commerceRouter.post(
  '/:churchId/auctions/:auctionId/confirm-winner',
  requireChurchPermission('auctions.manage'),
  async (req: AuthRequest, res) => {
    try {
      const churchId = req.tenant!.churchId;
      const actorId = req.authUser!.id;
      const auctionId = Number(req.params.auctionId);

      const result = await withTenantContext(
        { churchId, userId: actorId, isSuperAdmin: req.authUser!.isPlatformSuperAdmin },
        async (tx) => {
          const [auction] = await tx
            .select()
            .from(auctions)
            .where(and(eq(auctions.id, auctionId), eq(auctions.churchId, churchId)))
            .limit(1);

          if (!auction) {
            return { error: 'Enchère introuvable.', code: 404 as const };
          }
          if (!auction.highestBidderUserId || auction.currentBidAmount <= 0) {
            return { error: 'Aucune offre reçue sur ce lot.', code: 400 as const };
          }
          if (auction.currentBidAmount < auction.reservePrice) {
            return {
              error: `Prix de réserve (${auction.reservePrice} ${auction.currency}) non atteint.`,
              code: 400 as const,
            };
          }
          if (auction.status === 'confirmed') {
            return { auction };
          }

          const [updated] = await tx
            .update(auctions)
            .set({ status: 'confirmed', winnerConfirmedAt: new Date() })
            .where(eq(auctions.id, auction.id))
            .returning();

          await appendFinancialLedgerEntry(tx, {
            churchId,
            fundType: auction.fundAllocation === 'church' ? 'church' : 'humanitarian',
            entryType: 'credit',
            amount: auction.currentBidAmount,
            currency: auction.currency,
            category: 'Enchère solidaire adjugée',
            description: `Adjudication lot #${auction.id} — ${auction.title}`,
            justificationNote: 'Gagnant confirmé par modération/trésorerie',
            actorUserId: actorId,
          });

          const [notif] = await tx
            .insert(notifications)
            .values({
              churchId,
              userId: auction.highestBidderUserId,
              type: 'auction_won',
              title: 'Enchère remportée',
              body: `Félicitations ! Vous avez remporté « ${auction.title} » pour ${auction.currentBidAmount} ${auction.currency}.`,
            })
            .returning();
          sendToUserInChurch(churchId, auction.highestBidderUserId, 'notification:new', notif);

          return { auction: updated };
        }
      );

      if ('error' in result && result.error) {
        return res.status(result.code).json({ error: result.error });
      }

      await recordAuditLog({
        churchId,
        actorUserId: actorId,
        actorEmail: req.authUser!.email,
        action: 'AUCTION_WINNER_CONFIRMED',
        entityType: 'auction',
        entityId: auctionId,
        details: { finalAmount: result.auction?.currentBidAmount },
        ipAddress: getClientIp(req),
      });

      return res.json(result);
    } catch (error) {
      console.error('Confirm winner error:', error);
      return res.status(500).json({ error: 'Erreur lors de la confirmation du gagnant.' });
    }
  }
);
