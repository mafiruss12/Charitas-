import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { inArray } from 'drizzle-orm';
import { WebSocket } from 'ws';
import { createApp } from '../server.ts';
import { db, pool, withTenantContext } from '../src/db/index.ts';
import { chatMessages, churches, socialPosts, spiritualJournal, users } from '../src/db/schema.ts';
import type { WebSocketServer } from 'ws';
import { attachWebSocketServer } from '../src/realtime/ws.ts';

let server: http.Server;
let wss: WebSocketServer;
let baseUrl = '';
let wsBaseUrl = '';

const createdChurchIds: number[] = [];
const createdUserIds: number[] = [];

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {}
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
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
  wss = attachWebSocketServer(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsBaseUrl = `ws://127.0.0.1:${addr.port}/ws`;
      }
      resolve();
    });
  });
});

after(async () => {
  for (const client of wss.clients) {
    client.terminate();
  }
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  if (createdChurchIds.length > 0) {
    await db.delete(churches).where(inArray(churches.id, createdChurchIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('Phase 2 — Réseau Social, Messagerie Temps Réel, Vie Spirituelle & Événements QR', () => {
  const suffix = Date.now();
  let tokenAdminA = '';
  let adminAId = 0;
  let tokenMemberA = '';
  let memberAId = 0;
  let tokenAdminB = '';
  let churchAId = 0;
  let churchBId = 0;

  it('prépare deux églises isolées et deux membres dans Église A', async () => {
    const r1 = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p2.adminA.${suffix}@test.ci`, password: 'Password123!', fullName: 'Pasteur P2 Alpha' },
    });
    assert.equal(r1.status, 201);
    tokenAdminA = String(r1.data.token);
    adminAId = (r1.data.user as { id: number }).id;
    createdUserIds.push(adminAId);

    const cA = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminA,
      body: { name: `Église P2 Alpha ${suffix}`, city: 'Abidjan' },
    });
    assert.equal(cA.status, 201);
    churchAId = (cA.data.church as { id: number }).id;
    createdChurchIds.push(churchAId);

    const inv = await api(`/api/churches/${churchAId}/invitations`, {
      method: 'POST',
      token: tokenAdminA,
      body: { targetRole: 'member', maxUses: 5, expiresInDays: 7 },
    });
    const code = String((inv.data.invitation as { code: string }).code);

    const r2 = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: `p2.memberA.${suffix}@test.ci`,
        password: 'Password123!',
        fullName: 'Membre P2 Alpha',
        invitationCode: code,
      },
    });
    assert.equal(r2.status, 201);
    tokenMemberA = String(r2.data.token);
    memberAId = (r2.data.user as { id: number }).id;
    createdUserIds.push(memberAId);

    const r3 = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `p2.adminB.${suffix}@test.ci`, password: 'Password123!', fullName: 'Pasteur P2 Beta' },
    });
    tokenAdminB = String(r3.data.token);
    createdUserIds.push((r3.data.user as { id: number }).id);

    const cB = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminB,
      body: { name: `Église P2 Beta ${suffix}`, city: 'Yamoussoukro' },
    });
    churchBId = (cB.data.church as { id: number }).id;
    createdChurchIds.push(churchBId);
  });

  it('gère publications, sondages, commentaires, stories 24h, groupes, modération et RLS social', async () => {
    const pPoll = await api(`/api/churches/${churchAId}/social/posts`, {
      method: 'POST',
      token: tokenMemberA,
      body: {
        postType: 'poll',
        content: 'Veillée de prière ce vendredi #prière #jeunesse',
        pollOptionsList: ['Je serai présent', 'En ligne uniquement'],
      },
    });
    assert.equal(pPoll.status, 201);
    const postId = (pPoll.data.post as { id: number }).id;

    const feed = await api(`/api/churches/${churchAId}/social/posts?hashtag=prière`, {
      token: tokenAdminA,
    });
    assert.equal(feed.status, 200);
    const foundPost = (feed.data.posts as { id: number; pollOptions: { id: number }[] }[]).find(
      (p) => p.id === postId
    );
    assert.ok(foundPost);
    assert.equal(foundPost.pollOptions.length, 2);

    const voteOk = await api(`/api/churches/${churchAId}/social/posts/${postId}/vote`, {
      method: 'POST',
      token: tokenAdminA,
      body: { optionId: foundPost.pollOptions[0].id },
    });
    assert.equal(voteOk.status, 200);

    const voteDup = await api(`/api/churches/${churchAId}/social/posts/${postId}/vote`, {
      method: 'POST',
      token: tokenAdminA,
      body: { optionId: foundPost.pollOptions[1].id },
    });
    assert.equal(voteDup.status, 409);

    const reactRes = await api(`/api/churches/${churchAId}/social/posts/${postId}/react`, {
      method: 'POST',
      token: tokenAdminA,
      body: { reactionType: 'amen' },
    });
    assert.equal(reactRes.status, 200);
    assert.equal(reactRes.data.likesCount, 1);

    const commentRes = await api(`/api/churches/${churchAId}/social/posts/${postId}/comments`, {
      method: 'POST',
      token: tokenAdminA,
      body: { content: 'Amen ! Soyons unis.' },
    });
    assert.equal(commentRes.status, 201);

    const storyRes = await api(`/api/churches/${churchAId}/social/stories`, {
      method: 'POST',
      token: tokenMemberA,
      body: { caption: 'Louange matinale !', backgroundColor: '#1E3A5F' },
    });
    assert.equal(storyRes.status, 201);

    const grpRes = await api(`/api/churches/${churchAId}/social/groups`, {
      method: 'POST',
      token: tokenMemberA,
      body: { name: 'Chorale Espérance', description: 'Répétitions hebdomadaires' },
    });
    assert.equal(grpRes.status, 201);

    // Report and moderate post
    const repRes = await api(`/api/churches/${churchAId}/social/reports`, {
      method: 'POST',
      token: tokenMemberA,
      body: { targetType: 'post', targetId: postId, reason: 'Test modération' },
    });
    assert.equal(repRes.status, 201);
    const reportId = (repRes.data.report as { id: number }).id;

    const modRes = await api(`/api/churches/${churchAId}/social/reports/${reportId}`, {
      method: 'PATCH',
      token: tokenAdminA,
      body: { status: 'action_taken', hidePost: true },
    });
    assert.equal(modRes.status, 200);

    const feedAfterMod = await api(`/api/churches/${churchAId}/social/posts`, { token: tokenAdminA });
    assert.equal(
      (feedAfterMod.data.posts as { id: number }[]).some((p) => p.id === postId),
      false
    );

    // RLS isolation: Church B cannot see Church A social_posts
    const rlsB = await withTenantContext({ churchId: churchBId, isSuperAdmin: false }, async (tx) =>
      tx.select().from(socialPosts)
    );
    assert.equal(rlsB.some((p) => p.id === postId), false);
  });

  it('gère la messagerie WebSocket temps réel, blocage, accusé de lecture et RLS', async () => {
    // Member A connects via WebSocket and subscribes to Church A
    const receivedFrames: { event: string; payload: Record<string, unknown> }[] = [];
    const ws = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(tokenMemberA)}`);

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WS timeout')), 5000);
      ws.on('open', () => {
        ws.send(JSON.stringify({ event: 'subscribe:church', payload: { churchId: churchAId } }));
      });
      ws.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString());
        receivedFrames.push(parsed);
        if (parsed.event === 'presence:update') {
          clearTimeout(t);
          resolve();
        }
      });
    });

    // Create direct conversation Admin A <-> Member A
    const convRes = await api(`/api/churches/${churchAId}/messaging/conversations`, {
      method: 'POST',
      token: tokenAdminA,
      body: { type: 'direct', participantUserIds: [memberAId] },
    });
    assert.equal(convRes.status, 201);
    const convId = (convRes.data.conversation as { id: number }).id;

    const waitChatMsg = new Promise<Record<string, unknown>>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('No chat:message WS frame received')), 5000);
      ws.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.event === 'chat:message') {
          clearTimeout(t);
          resolve(parsed.payload);
        }
      });
    });

    const msgRes = await api(`/api/churches/${churchAId}/messaging/conversations/${convId}/messages`, {
      method: 'POST',
      token: tokenAdminA,
      body: { messageType: 'text', content: 'Que la paix soit avec vous !' },
    });
    assert.equal(msgRes.status, 201);

    const wsPayload = await waitChatMsg;
    assert.equal(wsPayload.content, 'Que la paix soit avec vous !');

    const readRes = await api(`/api/churches/${churchAId}/messaging/conversations/${convId}/read`, {
      method: 'POST',
      token: tokenMemberA,
    });
    assert.equal(readRes.status, 200);

    // Block check: Member A blocks Admin A -> new direct conversation creation returns 403
    const blockRes = await api(`/api/churches/${churchAId}/messaging/users/${adminAId}/block`, {
      method: 'POST',
      token: tokenMemberA,
    });
    assert.equal(blockRes.status, 200);
    assert.equal(blockRes.data.blocked, true);

    const blockedConv = await api(`/api/churches/${churchAId}/messaging/conversations`, {
      method: 'POST',
      token: tokenAdminA,
      body: { type: 'direct', participantUserIds: [memberAId] },
    });
    assert.equal(blockedConv.status, 403);

    // RLS isolation on chat_messages
    const rlsChatB = await withTenantContext({ churchId: churchBId, isSuperAdmin: false }, async (tx) =>
      tx.select().from(chatMessages)
    );
    assert.equal(rlsChatB.length, 0);

    ws.close();
  });

  it('valide Bible, prière, quiz et isolation stricte du journal spirituel privé (owner-only RLS)', async () => {
    const bibleRes = await api(`/api/churches/${churchAId}/spiritual/bible?q=berger`, {
      token: tokenMemberA,
    });
    assert.equal(bibleRes.status, 200);
    assert.ok((bibleRes.data.searchResults as unknown[]).length >= 1);

    const ovRes = await api(`/api/churches/${churchAId}/spiritual/overview`, { token: tokenMemberA });
    assert.equal(ovRes.status, 200);
    const plans = ovRes.data.readingPlans as { id: number }[];
    const quizzes = ovRes.data.quizzes as { id: number }[];
    assert.ok(plans.length >= 1);
    assert.ok(quizzes.length >= 1);

    const dayRes = await api(
      `/api/churches/${churchAId}/spiritual/reading-plans/${plans[0].id}/toggle-day`,
      { method: 'POST', token: tokenMemberA, body: { day: 1 } }
    );
    assert.equal(dayRes.status, 200);
    assert.deepEqual(dayRes.data.completedDays, [1]);

    const prayerRes = await api(`/api/churches/${churchAId}/spiritual/prayers`, {
      method: 'POST',
      token: tokenMemberA,
      body: { title: 'Paix pour notre quartier', content: 'Prions ensemble', isAnonymous: true },
    });
    assert.equal(prayerRes.status, 201);
    const prayerId = (prayerRes.data.prayer as { id: number }).id;

    const prayClick = await api(`/api/churches/${churchAId}/spiritual/prayers/${prayerId}/pray`, {
      method: 'POST',
      token: tokenAdminA,
    });
    assert.equal(prayClick.status, 200);
    assert.equal(prayClick.data.prayCount, 1);

    const quizRes = await api(`/api/churches/${churchAId}/spiritual/quizzes/${quizzes[0].id}/attempt`, {
      method: 'POST',
      token: tokenMemberA,
      body: { answers: [0, 2, 0] },
    });
    assert.equal(quizRes.status, 200);
    assert.equal(quizRes.data.score, 3);

    // Private journal strict RLS test: Member A writes private entry; Admin A CANNOT see it even via PostgreSQL
    const jCreate = await api(`/api/churches/${churchAId}/spiritual/journal`, {
      method: 'POST',
      token: tokenMemberA,
      body: { title: 'Note intime confidentielle', content: 'Prière personnelle secrète' },
    });
    assert.equal(jCreate.status, 201);
    const entryId = (jCreate.data.entry as { id: number }).id;

    const adminJournalApi = await api(`/api/churches/${churchAId}/spiritual/journal`, {
      token: tokenAdminA,
    });
    assert.equal(adminJournalApi.status, 200);
    assert.equal(
      (adminJournalApi.data.entries as { id: number }[]).some((e) => e.id === entryId),
      false
    );

    const adminJournalRls = await withTenantContext(
      { churchId: churchAId, userId: adminAId, isSuperAdmin: true },
      async (tx) => tx.select().from(spiritualJournal)
    );
    assert.equal(
      adminJournalRls.some((e) => e.id === entryId),
      false,
      'Owner-only RLS on spiritual_journal must block even church admins and super admins'
    );
  });

  it('valide événements, inscription QR code et vérification sécurisée de présence', async () => {
    const evCreate = await api(`/api/churches/${churchAId}/events`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        title: 'Culte de Louange',
        eventType: 'culte',
        location: 'Abidjan Plateau',
        startsAt: '2026-12-01T09:00:00Z',
      },
    });
    assert.equal(evCreate.status, 201);
    const eventId = (evCreate.data.event as { id: number }).id;

    const regRes = await api(`/api/churches/${churchAId}/events/${eventId}/register`, {
      method: 'POST',
      token: tokenMemberA,
    });
    assert.equal(regRes.status, 201);
    const qrPayload = String(regRes.data.qrPayload);
    const qrDataUrl = String(regRes.data.qrDataUrl);
    assert.ok(qrDataUrl.startsWith('data:image/png;base64,'));

    // Forged QR payload rejected with 403
    const forgedRes = await api(`/api/churches/${churchAId}/events/${eventId}/checkin`, {
      method: 'POST',
      token: tokenAdminA,
      body: { qrPayload: `SANCTUAIRE:EVENT:${eventId}:USER:${memberAId}:0000000000000000` },
    });
    assert.equal(forgedRes.status, 403);

    // Valid QR check-in succeeds
    const validCheckin = await api(`/api/churches/${churchAId}/events/${eventId}/checkin`, {
      method: 'POST',
      token: tokenAdminA,
      body: { qrPayload },
    });
    assert.equal(validCheckin.status, 200);
    assert.equal(
      (validCheckin.data.registration as { status: string }).status,
      'checked_in'
    );
  });
});
