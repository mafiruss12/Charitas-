import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { createApp } from '../server.ts';
import { db, pool, withTenantContext } from '../src/db/index.ts';
import { beneficiaries, churches, financialLedger, users } from '../src/db/schema.ts';
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
  return { status: res.status, data: json, rawText: text };
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

describe('Phase 3 — Dons, Passerelles CI, Webhooks HMAC, Ledger Immuable & Humanitaire', () => {
  const suffix = Date.now();
  let tokenAdminA = '';
  let tokenMemberA = '';
  let tokenAdminB = '';
  let churchAId = 0;
  let churchBId = 0;

  it('prépare deux églises et un membre standard', async () => {
    const rA = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p3.adminA.${suffix}@test.ci`, password: 'Password123!', fullName: 'Trésorier P3' },
    });
    tokenAdminA = String(rA.data.token);
    createdUserIds.push((rA.data.user as { id: number }).id);

    const cA = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminA,
      body: { name: `Église P3 Alpha ${suffix}`, currency: 'XOF' },
    });
    churchAId = (cA.data.church as { id: number }).id;
    createdChurchIds.push(churchAId);

    const inv = await api(`/api/churches/${churchAId}/invitations`, {
      method: 'POST',
      token: tokenAdminA,
      body: { targetRole: 'member', maxUses: 2, expiresInDays: 5 },
    });
    const code = String((inv.data.invitation as { code: string }).code);

    const rM = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: `p3.memberA.${suffix}@test.ci`,
        password: 'Password123!',
        fullName: 'Fidèle Donateur',
        invitationCode: code,
      },
    });
    tokenMemberA = String(rM.data.token);
    createdUserIds.push((rM.data.user as { id: number }).id);

    const rB = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p3.adminB.${suffix}@test.ci`, password: 'Password123!', fullName: 'Admin B' },
    });
    tokenAdminB = String(rB.data.token);
    createdUserIds.push((rB.data.user as { id: number }).id);

    const cB = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminB,
      body: { name: `Église P3 Beta ${suffix}`, currency: 'XOF' },
    });
    churchBId = (cB.data.church as { id: number }).id;
    createdChurchIds.push(churchBId);
  });

  it("ne simule jamais un don en ligne comme payé ; confirme uniquement via webhook HMAC vérifié", async () => {
    const ov = await api(`/api/churches/${churchAId}/donations/overview`, { token: tokenMemberA });
    assert.equal(ov.status, 200);
    const campaigns = ov.data.campaigns as { id: number; fundCategory: string }[];
    const humCamp = campaigns.find((c) => c.fundCategory === 'humanitarian')!;
    assert.ok(humCamp);

    // 1. Member initiates Orange Money donation -> must stay 'pending'
    const init = await api(`/api/churches/${churchAId}/donations`, {
      method: 'POST',
      token: tokenMemberA,
      body: {
        campaignId: humCamp.id,
        fundCategory: 'humanitarian',
        amount: 25000,
        frequency: 'one_time',
        isAnonymous: true,
        paymentMethod: 'orange_money',
        donorPhone: '+2250701020304',
      },
    });
    assert.equal(init.status, 201);
    const donation = init.data.donation as { id: number; status: string; paymentReference: string };
    assert.equal(donation.status, 'pending');

    // 2. Forged webhook signature rejected (401)
    const badWebhook = await api('/api/webhooks/payments/orange_money', {
      method: 'POST',
      headers: { 'x-webhook-signature': 'invalid-hmac-signature' },
      body: {
        externalEventId: `evt-bad-${suffix}`,
        paymentReference: donation.paymentReference,
        status: 'confirmed',
      },
    });
    assert.equal(badWebhook.status, 401);

    // 3. Valid HMAC-signed webhook confirms donation, issues receipt, updates campaign & ledger
    const payload = {
      externalEventId: `evt-ok-${suffix}`,
      paymentReference: donation.paymentReference,
      status: 'confirmed',
      externalTransactionId: `OM-CI-${suffix}`,
    };
    const sig = signWebhookPayload(JSON.stringify(payload));
    const goodWebhook = await api('/api/webhooks/payments/orange_money', {
      method: 'POST',
      headers: { 'x-webhook-signature': sig },
      body: payload,
    });
    assert.equal(goodWebhook.status, 200);
    assert.equal(goodWebhook.data.status, 'confirmed');

    // 4. Member sees confirmed donation + digital receipt
    const ovAfter = await api(`/api/churches/${churchAId}/donations/overview`, { token: tokenMemberA });
    const myDon = (ovAfter.data.donations as { id: number; status: string; receipt: unknown }[]).find(
      (d) => d.id === donation.id
    );
    assert.ok(myDon);
    assert.equal(myDon.status, 'confirmed');
    assert.ok(myDon.receipt);
  });

  it("autorise les espèces par le trésorier, refuse aux membres simples, et verrouille financial_ledger en append-only", async () => {
    const memberCash = await api(`/api/churches/${churchAId}/donations/cash`, {
      method: 'POST',
      token: tokenMemberA,
      body: { donorName: 'Test', amount: 1000, fundCategory: 'church' },
    });
    assert.equal(memberCash.status, 403);

    const adminCash = await api(`/api/churches/${churchAId}/donations/cash`, {
      method: 'POST',
      token: tokenAdminA,
      body: { donorName: 'Frère Kouassi', amount: 15000, fundCategory: 'church' },
    });
    assert.equal(adminCash.status, 201);

    // Verify PostgreSQL immutability trigger rejects UPDATE/DELETE on financial_ledger
    await assert.rejects(
      async () => {
        await withTenantContext({ churchId: churchAId, isSuperAdmin: false }, async (tx) => {
          await tx
            .update(financialLedger)
            .set({ amount: 999999 })
            .where(eq(financialLedger.churchId, churchAId));
        });
      },
      (err: unknown) => {
        const msg =
          (err as { message?: string; cause?: { message?: string } })?.cause?.message ||
          (err as { message?: string })?.message ||
          '';
        return /append-only/i.test(msg);
      }
    );

    // Export CSV works
    const csvRes = await api(`/api/churches/${churchAId}/donations/export.csv`, {
      token: tokenAdminA,
    });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.rawText.includes('Empreinte SHA256'));
  });

  it("protège la confidentialité des bénéficiaires humanitaires, sépare les fonds et respecte RLS", async () => {
    // Member cannot read confidential beneficiaries list (403)
    const memberBen = await api(`/api/churches/${churchAId}/humanitarian/beneficiaries`, {
      token: tokenMemberA,
    });
    assert.equal(memberBen.status, 403);

    // Admin / humanitarian lead creates beneficiary + family + aid request + distribution
    const benRes = await api(`/api/churches/${churchAId}/humanitarian/beneficiaries`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        fullName: 'Famille Koné Confidentielle',
        householdSize: 5,
        vulnerabilityLevel: 'critical',
        confidentialNotes: 'Soutien médical urgent',
        familyMembers: [{ fullName: 'Awa Koné', relationship: 'Enfant', age: 8 }],
      },
    });
    assert.equal(benRes.status, 201);
    const benId = (benRes.data.beneficiary as { id: number }).id;

    const reqRes = await api(`/api/churches/${churchAId}/humanitarian/aid-requests`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        beneficiaryId: benId,
        title: 'Aide alimentaire mensuelle',
        category: 'alimentaire',
        needsAssessment: 'Besoin immédiat de riz et huile',
        requestedAmount: 10000,
        priorityScore: 95,
      },
    });
    assert.equal(reqRes.status, 201);
    const aidRequestId = (reqRes.data.aidRequest as { id: number }).id;

    const distRes = await api(`/api/churches/${churchAId}/humanitarian/distributions`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        beneficiaryId: benId,
        aidRequestId,
        itemsSummary: 'Sac de riz 50kg + kits scolaires',
        amountSpent: 10000,
        proofNotes: 'Bordereau #HUM-01 signé',
      },
    });
    assert.equal(distRes.status, 201);

    // Check strict fund separation: Church balance = 15,000 ; Humanitarian balance = 25,000 - 10,000 = 15,000
    const ov = await api(`/api/churches/${churchAId}/donations/overview`, { token: tokenAdminA });
    const sep = ov.data.fundSeparation as {
      church: { balance: number };
      humanitarian: { credits: number; debits: number; balance: number };
    };
    assert.equal(sep.church.balance, 15000);
    assert.equal(sep.humanitarian.credits, 25000);
    assert.equal(sep.humanitarian.debits, 10000);
    assert.equal(sep.humanitarian.balance, 15000);

    // RLS check: Church B cannot read Church A beneficiaries
    const rlsBenB = await withTenantContext({ churchId: churchBId, isSuperAdmin: false }, async (tx) =>
      tx.select().from(beneficiaries)
    );
    assert.equal(rlsBenB.some((b) => b.id === benId), false);
  });
});
