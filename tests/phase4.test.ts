import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { createApp } from '../server.ts';
import { db, pool, withTenantContext } from '../src/db/index.ts';
import { auctions, churches, marketplaceProducts, users } from '../src/db/schema.ts';
import { signWebhookPayload } from '../src/lib/payments.ts';

let server: http.Server;
let baseUrl = '';

const createdChurchIds: number[] = [];
const createdUserIds: number[] = [];

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, data: json };
}

before(async () => {
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (createdChurchIds.length > 0) {
    await db.delete(churches).where(inArray(churches.id, createdChurchIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('Phase 4 — Marketplace, Enchères Solidaires, Académie & Assistant IA', () => {
  const suffix = Date.now();
  let tokenAdminA = '';
  let tokenSellerA = '';
  let tokenBidderA = '';
  let tokenAdminB = '';
  let churchAId = 0;
  let churchBId = 0;

  it('prépare deux églises et deux membres', async () => {
    const rA = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p4.adminA.${suffix}@test.ci`, password: 'Password123!', fullName: 'Admin P4' },
    });
    tokenAdminA = String(rA.data.token);
    createdUserIds.push((rA.data.user as { id: number }).id);

    const cA = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminA,
      body: { name: `Église P4 Alpha ${suffix}`, currency: 'XOF' },
    });
    churchAId = (cA.data.church as { id: number }).id;
    createdChurchIds.push(churchAId);

    const inv = await api(`/api/churches/${churchAId}/invitations`, {
      method: 'POST',
      token: tokenAdminA,
      body: { targetRole: 'member', maxUses: 5, expiresInDays: 5 },
    });
    const code = String((inv.data.invitation as { code: string }).code);

    const rS = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: `p4.seller.${suffix}@test.ci`,
        password: 'Password123!',
        fullName: 'Vendeur Membre',
        invitationCode: code,
      },
    });
    tokenSellerA = String(rS.data.token);
    createdUserIds.push((rS.data.user as { id: number }).id);

    const rBid = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: `p4.bidder.${suffix}@test.ci`,
        password: 'Password123!',
        fullName: 'Enchérisseur Membre',
        invitationCode: code,
      },
    });
    tokenBidderA = String(rBid.data.token);
    createdUserIds.push((rBid.data.user as { id: number }).id);

    const rB = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p4.adminB.${suffix}@test.ci`, password: 'Password123!', fullName: 'Admin B' },
    });
    tokenAdminB = String(rB.data.token);
    createdUserIds.push((rB.data.user as { id: number }).id);

    const cB = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminB,
      body: { name: `Église P4 Beta ${suffix}`, currency: 'XOF' },
    });
    churchBId = (cB.data.church as { id: number }).id;
    createdChurchIds.push(churchBId);
  });

  it('gère la marketplace, la confirmation webhook, le stock et la séparation des fonds', async () => {
    const p1 = await api(`/api/churches/${churchAId}/marketplace/products`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        title: 'Recueil de Cantiques',
        description: 'Édition chorale complète',
        price: 5000,
        stockQuantity: 10,
        isSolidarityProduct: false,
      },
    });
    assert.equal(p1.status, 201);
    const prodId = (p1.data.product as { id: number }).id;

    // Member creates an online order (stays pending)
    const ord = await api(`/api/churches/${churchAId}/marketplace/orders`, {
      method: 'POST',
      token: tokenSellerA,
      body: {
        productId: prodId,
        quantity: 2,
        paymentMethod: 'wave',
        shippingAddress: 'Cocody Riviera',
      },
    });
    assert.equal(ord.status, 201);
    const order = ord.data.order as { paymentReference: string; status: string; fundType: string; totalAmount: number };
    assert.equal(order.status, 'pending');
    assert.equal(order.fundType, 'commercial');
    assert.equal(order.totalAmount, 10000);

    // Verified webhook confirms payment & decrements stock & credits commercial fund
    const payload = {
      externalEventId: `evt_ord_${suffix}`,
      paymentReference: order.paymentReference,
      status: 'confirmed',
    };
    const sig = signWebhookPayload(JSON.stringify(payload));
    const wh = await api('/api/webhooks/payments/wave', {
      method: 'POST',
      headers: { 'x-webhook-signature': sig },
      body: payload,
    });
    assert.equal(wh.status, 200);
    assert.equal(wh.data.status, 'paid');

    const prodList = await api(`/api/churches/${churchAId}/marketplace/products`, { token: tokenAdminA });
    const updatedProd = (prodList.data.products as { id: number; stockQuantity: number }[]).find(
      (p) => p.id === prodId
    );
    assert.equal(updatedProd?.stockQuantity, 8);

    // Check commercial fund separation in donations overview
    const ov = await api(`/api/churches/${churchAId}/donations/overview`, { token: tokenAdminA });
    const funds = ov.data.fundSeparation as { commercial: { balance: number }; church: { balance: number } };
    assert.equal(funds.commercial.balance, 10000);
    assert.equal(funds.church.balance, 0);
  });

  it('applique la modération, bloque la surenchère du vendeur, vérifie le prix de réserve et adjuge le lot', async () => {
    const create = await api(`/api/churches/${churchAId}/auctions`, {
      method: 'POST',
      token: tokenSellerA,
      body: {
        title: 'Guitare Acoustique Solidarité',
        description: 'Guitare folk neuve offerte pour la jeunesse',
        startPrice: 20000,
        reservePrice: 30000,
        durationDays: 3,
        fundAllocation: 'humanitarian',
      },
    });
    assert.equal(create.status, 201);
    const auctionId = (create.data.auction as { id: number; moderationStatus: string }).id;
    assert.equal((create.data.auction as { moderationStatus: string }).moderationStatus, 'pending');

    // Bidder cannot bid before moderation approval
    const preBid = await api(`/api/churches/${churchAId}/auctions/${auctionId}/bids`, {
      method: 'POST',
      token: tokenBidderA,
      body: { amount: 22000 },
    });
    assert.equal(preBid.status, 400);

    // Admin moderates & approves
    const mod = await api(`/api/churches/${churchAId}/auctions/${auctionId}/moderate`, {
      method: 'POST',
      token: tokenAdminA,
      body: { decision: 'approved' },
    });
    assert.equal(mod.status, 200);

    // Anti-shill-bidding: seller is strictly forbidden (403)
    const shillBid = await api(`/api/churches/${churchAId}/auctions/${auctionId}/bids`, {
      method: 'POST',
      token: tokenSellerA,
      body: { amount: 25000 },
    });
    assert.equal(shillBid.status, 403);

    // Bidder bids below reserve (25000 >= 20000 startPrice)
    const bid1 = await api(`/api/churches/${churchAId}/auctions/${auctionId}/bids`, {
      method: 'POST',
      token: tokenBidderA,
      body: { amount: 25000 },
    });
    assert.equal(bid1.status, 201);

    // Winner cannot be confirmed because reservePrice (30000) not reached
    const failConfirm = await api(`/api/churches/${churchAId}/auctions/${auctionId}/confirm-winner`, {
      method: 'POST',
      token: tokenAdminA,
    });
    assert.equal(failConfirm.status, 400);

    // Higher bid >= reservePrice
    const bid2 = await api(`/api/churches/${churchAId}/auctions/${auctionId}/bids`, {
      method: 'POST',
      token: tokenBidderA,
      body: { amount: 35000 },
    });
    assert.equal(bid2.status, 201);

    const confirm = await api(`/api/churches/${churchAId}/auctions/${auctionId}/confirm-winner`, {
      method: 'POST',
      token: tokenAdminA,
    });
    assert.equal(confirm.status, 200);
    assert.equal((confirm.data.auction as { status: string }).status, 'confirmed');
  });

  it("gère l'Académie (inscription, leçons, quiz & certificat) et la Médiathèque", async () => {
    const mediaRes = await api(`/api/churches/${churchAId}/media`, { token: tokenSellerA });
    assert.equal(mediaRes.status, 200);
    assert.ok((mediaRes.data.media as unknown[]).length >= 2);

    const coursesRes = await api(`/api/churches/${churchAId}/academy/courses`, {
      token: tokenSellerA,
    });
    assert.equal(coursesRes.status, 200);
    const course = (coursesRes.data.courses as { id: number }[])[0];
    assert.ok(course?.id);

    const enroll = await api(`/api/churches/${churchAId}/academy/courses/${course.id}/enroll`, {
      method: 'POST',
      token: tokenSellerA,
    });
    assert.equal(enroll.status, 201);

    const lesson = await api(
      `/api/churches/${churchAId}/academy/courses/${course.id}/lessons/0/complete`,
      { method: 'POST', token: tokenSellerA }
    );
    assert.equal(lesson.status, 200);

    // Submit correct answers [0, 1] -> 100% -> certificate generated
    const quiz = await api(`/api/churches/${churchAId}/academy/courses/${course.id}/quiz`, {
      method: 'POST',
      token: tokenSellerA,
      body: { answers: [0, 1] },
    });
    assert.equal(quiz.status, 200);
    assert.equal(quiz.data.passed, true);
    assert.equal(quiz.data.score, 100);
    const certCode = (quiz.data.enrollment as { certificateCode: string }).certificateCode;
    assert.ok(certCode?.startsWith('CERT-'));
  });

  it("applique le RBAC de l'assistant IA et l'isolation RLS PostgreSQL Phase 4", async () => {
    // Member cannot use admin_draft mode (403)
    const deniedAi = await api(`/api/churches/${churchAId}/ai/assist`, {
      method: 'POST',
      token: tokenSellerA,
      body: { mode: 'admin_draft', prompt: 'Rédige un rapport administratif confidentiel.' },
    });
    assert.equal(deniedAi.status, 403);

    // Cross-church HTTP check
    const cross = await api(`/api/churches/${churchAId}/marketplace/products`, {
      token: tokenAdminB,
    });
    assert.equal(cross.status, 403);

    // PostgreSQL RLS direct check: Church B cannot see Church A products or auctions
    const rlsProductsB = await withTenantContext({ churchId: churchBId }, async (tx) =>
      tx.select().from(marketplaceProducts).where(eq(marketplaceProducts.churchId, churchAId))
    );
    assert.equal(rlsProductsB.length, 0);

    const rlsAuctionsB = await withTenantContext({ churchId: churchBId }, async (tx) =>
      tx.select().from(auctions).where(eq(auctions.churchId, churchAId))
    );
    assert.equal(rlsAuctionsB.length, 0);
  });
});
