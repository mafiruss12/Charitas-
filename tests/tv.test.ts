import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { eq, inArray, sql } from 'drizzle-orm';
import { createApp } from '../server.ts';
import { db, pool, withTenantContext } from '../src/db/index.ts';
import { churches, tvChannels, users } from '../src/db/schema.ts';
import { assertSafeHttpUrl, parseM3uPlaylistText, probeStreamUrl } from '../src/lib/iptv.ts';
import { TV_CATEGORIES, normalizeTvCategory } from '../src/lib/tvConstants.ts';

let server: http.Server;
let baseUrl = '';

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

describe('Module CHARITAS TV & CHARITAS Live', () => {
  const suffix = Date.now();
  let tokenAdminA = '';
  let tokenMemberA = '';
  let tokenAdminB = '';
  let churchAId = 0;
  let churchBId = 0;
  let channelValidatedId = 0;
  let channelBrokenId = 0;

  it('valide la protection SSRF, le parsing #EXTINF avancé, l’exclusion non-chrétienne et la compatibilité HTTPS', async () => {
    assert.throws(() => assertSafeHttpUrl('http://127.0.0.1:3000/api/health'));
    assert.throws(() => assertSafeHttpUrl('http://localhost/stream.m3u8'));
    assert.throws(() => assertSafeHttpUrl('http://169.254.169.254/latest/meta-data/'));
    assert.throws(() => assertSafeHttpUrl('http://10.0.0.5/live.m3u8'));
    assert.throws(() => assertSafeHttpUrl('javascript:alert(1)'));
    assert.doesNotThrow(() => assertSafeHttpUrl('https://cdn.example.org/live/playlist.m3u8'));

    assert.equal(normalizeTvCategory('TV chrétiennes francophones'), 'Chaînes chrétiennes francophones');
    assert.equal(normalizeTvCategory('TV chrétiennes africaines'), 'Chaînes chrétiennes africaines');
    assert.equal(normalizeTvCategory('TV chrétiennes internationales'), 'Chaînes chrétiennes internationales');

    const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-id='KTO.fr' tvg-logo='https://cdn.example.org/kto.png' tvg-language='French' group-title='Religious, Faith',<script>alert(1)</script>KTO TV Catholique
https://cdn.example.org/kto/playlist.m3u8
#EXTINF:-1 tvg-id='KTO.dup' group-title='Religious',KTO Doublon
https://cdn.example.org/kto/playlist.m3u8
#EXTINF:-1 tvg-id='Islamic.sa' group-title='Religious',Azan TV Makkah Live
https://cdn.example.org/azan/index.m3u8
#EXTINF:-1 tvg-id='LocalSSRF',Internal Loopback
http://127.0.0.1/secret.m3u8
#EXTINF:-1 tvg-language="English" group-title="Religious",Sports Channel
https://cdn.example.org/sports/index.m3u8`;

    const entries = parseM3uPlaylistText(sampleM3u);
    // Internal loopback & duplicate URL are dropped; Azan TV (non-Christian) excluded from Christian flag
    assert.equal(entries.length, 3);
    assert.ok(!entries[0].name.includes('<script>'));
    assert.equal(entries[0].isLikelyChristian, true);
    assert.equal(entries[0].suggestedCategory, 'Chaînes chrétiennes francophones');
    assert.equal(entries[0].logoUrl, 'https://cdn.example.org/kto.png');

    const azanEntry = entries.find((e) => e.name.includes('Azan TV'));
    assert.ok(azanEntry);
    assert.equal(azanEntry.isLikelyChristian, false);

    const sportsEntry = entries.find((e) => e.name.includes('Sports Channel'));
    assert.ok(sportsEntry);
    assert.equal(sportsEntry.isLikelyChristian, false);
    assert.equal(TV_CATEGORIES.length, 8);

    // HTTP stream must immediately report incompatible (Mixed Content)
    const httpProbe = await probeStreamUrl('http://cdn.example.org/legacy/stream.m3u8');
    assert.equal(httpProbe.status, 'incompatible');
    assert.equal(httpProbe.httpsCompatible, false);
  });

  it('prépare deux églises et teste la découverte IPTV sans auto-publication', async () => {
    const rAdminA = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `tv.adminA.${suffix}@test.ci`, password: 'Password123!', fullName: 'Admin TV A' },
    });
    assert.equal(rAdminA.status, 201);
    tokenAdminA = String(rAdminA.data.token);
    createdUserIds.push((rAdminA.data.user as { id: number }).id);

    const cA = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminA,
      body: { name: `Paroisse TV A ${suffix}`, currency: 'XOF' },
    });
    assert.equal(cA.status, 201);
    churchAId = (cA.data.church as { id: number }).id;
    createdChurchIds.push(churchAId);

    // Join second user as plain member (no streams.manage)
    const invRes = await api(`/api/churches/${churchAId}/invitations`, {
      method: 'POST',
      token: tokenAdminA,
      body: { targetRole: 'member', maxUses: 5 },
    });
    assert.equal(invRes.status, 201);
    const inviteCode = (invRes.data.invitation as { code: string }).code;

    const rMemA = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: `tv.memA.${suffix}@test.ci`,
        password: 'Password123!',
        fullName: 'Membre TV A',
        invitationCode: inviteCode,
      },
    });
    assert.equal(rMemA.status, 201);
    tokenMemberA = String(rMemA.data.token);
    createdUserIds.push((rMemA.data.user as { id: number }).id);

    // Second isolated church B
    const rAdminB = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `tv.adminB.${suffix}@test.ci`, password: 'Password123!', fullName: 'Admin TV B' },
    });
    tokenAdminB = String(rAdminB.data.token);
    createdUserIds.push((rAdminB.data.user as { id: number }).id);

    const cB = await api('/api/churches', {
      method: 'POST',
      token: tokenAdminB,
      body: { name: `Paroisse TV B ${suffix}`, currency: 'XOF' },
    });
    churchBId = (cB.data.church as { id: number }).id;
    createdChurchIds.push(churchBId);

    // Member is blocked from admin routes (403)
    const denied = await api(`/api/churches/${churchAId}/tv/admin/channels`, {
      token: tokenMemberA,
    });
    assert.equal(denied.status, 403);

    // Discover M3U entries without auto-inserting into database
    const discover = await api(`/api/churches/${churchAId}/tv/admin/iptv-discover`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        onlyLikelyChristian: true,
        m3uText: `#EXTM3U
#EXTINF:-1 tvg-language="French" group-title="Religious",EMCI TV Afrique
https://stream.example.invalid/emci.m3u8
#EXTINF:-1 tvg-language="French" group-title="News",Generic World News
https://stream.example.invalid/news.m3u8`,
      },
    });
    assert.equal(discover.status, 200);
    const entries = discover.data.entries as { name: string }[];
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'EMCI TV Afrique');

    // Confirm nothing was auto-published
    const adminList = await api(`/api/churches/${churchAId}/tv/admin/channels`, {
      token: tokenAdminA,
    });
    assert.equal((adminList.data.channels as unknown[]).length, 0);
  });

  it('applique la validation légale, le test de disponibilité et le filtrage public strict', async () => {
    // Reject SSRF stream URL
    const ssrfAdd = await api(`/api/churches/${churchAId}/tv/admin/channels`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        name: 'SSRF Test',
        streamUrl: 'http://127.0.0.1:3000/api/health',
        category: 'Chaînes chrétiennes francophones',
      },
    });
    assert.equal(ssrfAdd.status, 400);

    // Add unreachable stream -> tested immediately -> marked unavailable and hidden from public
    const brokenAdd = await api(`/api/churches/${churchAId}/tv/admin/channels`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        name: 'Chaîne Inaccessible Test',
        streamUrl: 'https://nonexistent.invalid/stream.m3u8',
        category: 'Chaînes chrétiennes africaines',
        rightsVerified: true,
        isValidated: true,
        testImmediately: true,
      },
    });
    assert.equal(brokenAdd.status, 201);
    const brokenChannel = brokenAdd.data.channel as { id: number; streamStatus: string };
    channelBrokenId = brokenChannel.id;
    assert.equal(brokenChannel.streamStatus, 'unavailable');

    // Public catalog MUST NOT expose broken channel even if isValidated=true
    const publicBefore = await api(`/api/public/tv/catalog?churchId=${churchAId}`);
    assert.equal(publicBefore.status, 200);
    assert.equal((publicBefore.data.channels as unknown[]).length, 0);

    // Add valid-format channel without probing yet
    const addValid = await api(`/api/churches/${churchAId}/tv/admin/channels`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        name: 'KTO Paroisse Sélection',
        streamUrl: 'https://cdn.example.org/kto/playlist.m3u8',
        category: 'Chaînes chrétiennes francophones',
        language: 'Français',
        country: "Côte d'Ivoire",
        currentProgram: 'Chapelet & Enseignement',
        rightsVerified: false,
        isValidated: false,
        isRecommended: true,
        testImmediately: false,
      },
    });
    assert.equal(addValid.status, 201);
    channelValidatedId = (addValid.data.channel as { id: number }).id;

    // Duplicate stream URL must be rejected with HTTP 409
    const dupAdd = await api(`/api/churches/${churchAId}/tv/admin/channels`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        name: 'KTO Paroisse Doublon',
        streamUrl: 'https://cdn.example.org/kto/playlist.m3u8',
        category: 'Chaînes chrétiennes francophones',
        testImmediately: false,
      },
    });
    assert.equal(dupAdd.status, 409);

    // Cannot set isValidated=true without rightsVerified=true
    const unverifiedReject = await api(
      `/api/churches/${churchAId}/tv/admin/channels/${channelValidatedId}`,
      {
        method: 'PATCH',
        token: tokenAdminA,
        body: { isValidated: true, rightsVerified: false },
      }
    );
    assert.equal(unverifiedReject.status, 400);

    // Approve rights & mark operational
    const approveRes = await api(
      `/api/churches/${churchAId}/tv/admin/channels/${channelValidatedId}`,
      {
        method: 'PATCH',
        token: tokenAdminA,
        body: { rightsVerified: true, isValidated: true, rightsHolder: 'KTO Diffusion' },
      }
    );
    assert.equal(approveRes.status, 200);

    await withTenantContext({ churchId: churchAId, isSuperAdmin: true }, async (tx) =>
      tx
        .update(tvChannels)
        .set({ streamStatus: 'operational', lastCheckedAt: new Date() })
        .where(eq(tvChannels.id, channelValidatedId))
    );

    // Now unauthenticated visitor sees ONLY the validated operational channel
    const publicAfter = await api(`/api/public/tv/catalog?churchId=${churchAId}`);
    assert.equal(publicAfter.status, 200);
    const pubChannels = publicAfter.data.channels as { id: number; name: string }[];
    assert.equal(pubChannels.length, 1);
    assert.equal(pubChannels[0].id, channelValidatedId);

    // Single public channel endpoint blocks broken channel and returns operational channel
    const singleBroken = await api(`/api/public/tv/channels/${channelBrokenId}`);
    assert.equal(singleBroken.status, 404);
    const singleValid = await api(`/api/public/tv/channels/${channelValidatedId}`);
    assert.equal(singleValid.status, 200);

    // Playback-report endpoint lets admin player update real status (incompatible -> operational)
    const reportDenied = await api(
      `/api/churches/${churchAId}/tv/admin/channels/${channelValidatedId}/playback-report`,
      {
        method: 'POST',
        token: tokenMemberA,
        body: { status: 'incompatible', error: 'CORS test' },
      }
    );
    assert.equal(reportDenied.status, 403);

    const reportIncomp = await api(
      `/api/churches/${churchAId}/tv/admin/channels/${channelValidatedId}/playback-report`,
      {
        method: 'POST',
        token: tokenAdminA,
        body: { status: 'incompatible', error: 'Codec audio AC3 non supporté sur navigateur' },
      }
    );
    assert.equal(reportIncomp.status, 200);
    assert.equal((reportIncomp.data.channel as { streamStatus: string }).streamStatus, 'incompatible');

    const reportOk = await api(
      `/api/churches/${churchAId}/tv/admin/channels/${channelValidatedId}/playback-report`,
      {
        method: 'POST',
        token: tokenAdminA,
        body: { status: 'operational' },
      }
    );
    assert.equal(reportOk.status, 200);
    assert.equal((reportOk.data.channel as { streamStatus: string }).streamStatus, 'operational');
  });

  it('gère les favoris, l’historique avec reprise, CHARITAS Live et l’isolation RLS multi-tenant', async () => {
    // Toggle favorite as member
    const favOn = await api(
      `/api/churches/${churchAId}/tv/favorites/${channelValidatedId}`,
      { method: 'POST', token: tokenMemberA }
    );
    assert.equal(favOn.status, 200);
    assert.equal(favOn.data.added, true);

    // Save watch history with resume position
    const histRes = await api(`/api/churches/${churchAId}/tv/history`, {
      method: 'POST',
      token: tokenMemberA,
      body: {
        channelId: channelValidatedId,
        lastPositionSeconds: 185,
        durationSeconds: 1800,
      },
    });
    assert.equal(histRes.status, 200);

    // Create Charité Live broadcast
    const liveRes = await api(`/api/churches/${churchAId}/tv/admin/broadcasts`, {
      method: 'POST',
      token: tokenAdminA,
      body: {
        title: 'Messe Dominicale Ebimpé',
        broadcastType: 'culte',
        speakerName: 'Père Curé Saint Louis Roi',
        streamUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ingestProvider: 'youtube_live',
        status: 'live',
      },
    });
    assert.equal(liveRes.status, 201);
    const broadcastId = (liveRes.data.broadcast as { id: number }).id;

    // Member reads favorites + history
    const memberState = await api(`/api/churches/${churchAId}/tv/member-state`, {
      token: tokenMemberA,
    });
    assert.equal(memberState.status, 200);
    assert.deepEqual(memberState.data.favoriteChannelIds, [channelValidatedId]);
    const histList = memberState.data.history as { lastPositionSeconds: number }[];
    assert.equal(histList.length, 1);
    assert.equal(histList[0].lastPositionSeconds, 185);

    // Visitor catalog includes Charité Live broadcast
    const pubCatalog = await api(`/api/public/tv/catalog?churchId=${churchAId}`);
    assert.equal((pubCatalog.data.broadcasts as { id: number }[]).length, 1);
    assert.equal((pubCatalog.data.broadcasts as { id: number }[])[0].id, broadcastId);

    // Cross-tenant HTTP isolation: Admin B cannot access Church A TV admin or member state
    const crossAdmin = await api(`/api/churches/${churchAId}/tv/admin/channels`, {
      token: tokenAdminB,
    });
    assert.equal(crossAdmin.status, 403);

    // Cross-tenant PostgreSQL RLS isolation check
    const rlsRows = await withTenantContext(
      { churchId: churchBId, isSuperAdmin: false },
      async (tx) => tx.select().from(tvChannels)
    );
    assert.equal(rlsRows.length, 0);

    // Audit RLS completeness in public schema
    const auditRes = await db.execute(
      sql`SELECT COUNT(*)::int AS total, COUNT(qual)::int AS with_qual, COUNT(with_check)::int AS with_check FROM pg_policies WHERE schemaname = 'public'`
    );
    const row = auditRes.rows[0] as { total: number; with_qual: number; with_check: number };
    assert.equal(row.total, row.with_qual);
    assert.equal(row.total, row.with_check);
  });
});
