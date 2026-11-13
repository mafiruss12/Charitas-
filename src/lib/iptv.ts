import dns from 'node:dns/promises';
import net from 'node:net';
import { eq } from 'drizzle-orm';
import { withTenantContext } from '../db/index.ts';
import { churches, tvChannels } from '../db/schema.ts';
import { parseVideoMedia } from './media.ts';
import { IPTV_ORG_RELIGIOUS_PLAYLIST_URL, TV_CATEGORIES, type TvCategory } from './tvConstants.ts';

export interface ParsedM3uEntry {
  index: number;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  tvgId: string | null;
  groupTitle: string | null;
  language: string;
  country: string | null;
  suggestedCategory: TvCategory;
  christianRelevanceScore: number;
  isLikelyChristian: boolean;
  streamFormat: 'hls' | 'mp4' | 'embed';
}

export interface StreamProbeResult {
  status: 'operational' | 'unavailable' | 'pending_check';
  httpStatus: number | null;
  error: string | null;
  detectedFormat: 'hls' | 'mp4' | 'embed';
  checkedAt: string;
}

const CHRISTIAN_KEYWORDS = [
  'christ',
  'christian',
  'chrétien',
  'chretien',
  'catholic',
  'catholique',
  'kto',
  'ewtn',
  'emci',
  'lumen',
  'jesus',
  'jésus',
  'gospel',
  'god',
  'dieu',
  'bible',
  'biblique',
  'prayer',
  'prière',
  'priere',
  'church',
  'église',
  'eglise',
  'grace',
  'grâce',
  'hope',
  'esperance',
  'espérance',
  'faith',
  'foi',
  'heaven',
  'miracle',
  'shalom',
  'maranatha',
  'hallelu',
  'alleluia',
  'parish',
  'paroisse',
  'vatican',
  'tbn',
  '3abn',
  'daystar',
  'cnl',
  'evangel',
  'évang',
  'louange',
  'adoration',
  'salvation',
  'saint',
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast / reserved
    return false;
  }
  if (version === 6) {
    const norm = ip.toLowerCase();
    if (norm === '::' || norm === '::1') return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true; // ULA
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) {
      return true; // Link-local
    }
    if (norm.startsWith('::ffff:')) {
      return isPrivateOrReservedIp(norm.slice('::ffff:'.length));
    }
    return false;
  }
  return true;
}

/**
 * Validates that a stream or playlist URL is well-formed HTTP/HTTPS and does not target local/private SSRF networks.
 */
export function assertSafeHttpUrl(rawUrl: string): URL {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || trimmed.length > 2048) {
    throw new Error('URL invalide ou trop longue.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Format d’URL invalide.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Seuls les protocoles HTTP et HTTPS sont autorisés.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Les identifiants intégrés dans l’URL ne sont pas autorisés.');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || BLOCKED_HOSTNAMES.has(host)) {
    throw new Error('Hôte interdit ou non routable.');
  }
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    throw new Error('Les domaines locaux ou internes sont interdits.');
  }

  if (net.isIP(host) !== 0 && isPrivateOrReservedIp(host)) {
    throw new Error('Les adresses IP privées ou locales sont interdites.');
  }

  return parsed;
}

async function assertSafeResolvedTarget(url: URL): Promise<void> {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIP(host) !== 0) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Adresse IP privée bloquée.');
    }
    return;
  }

  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (records.length === 0) {
      throw new Error('Nom de domaine introuvable (DNS).');
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error('Résolution DNS vers une adresse IP privée interdite.');
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('interdite')) {
      throw err;
    }
    throw new Error('Impossible de résoudre le nom de domaine du flux.');
  }
}

export function detectStreamFormat(rawUrl: string): 'hls' | 'mp4' | 'embed' {
  const parsedMedia = parseVideoMedia(rawUrl);
  if (parsedMedia.kind === 'embed') return 'embed';
  if (/\.m3u8(\?.*)?$/i.test(rawUrl) || /\/playlist\.m3u8/i.test(rawUrl) || /format=m3u8/i.test(rawUrl)) {
    return 'hls';
  }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(rawUrl)) {
    return 'mp4';
  }
  return 'hls';
}

function sanitizeText(val: string | null | undefined, maxLen = 220): string {
  if (!val) return '';
  return val
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

function extractExtInfAttr(extInfLine: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = extInfLine.match(regex);
  if (!match || !match[1]) return null;
  const cleaned = sanitizeText(match[1], 500);
  return cleaned || null;
}

function inferCategory(name: string, group: string | null, language: string, country: string | null): TvCategory {
  const combined = `${name} ${group || ''} ${language} ${country || ''}`.toLowerCase();
  if (/gospel|louange|worship|music|choir|chorale|cantique|praise/.test(combined)) {
    return 'Gospel et louange';
  }
  if (/conférence|conference|summit|congrès|congres/.test(combined)) {
    return 'Conférences chrétiennes';
  }
  if (/bible|biblique|teaching|enseignement|catéch|catech|study|étude/.test(combined)) {
    return 'Enseignements bibliques';
  }
  if (/prédic|predic|sermon|preach|evangel/.test(combined)) {
    return 'Prédications';
  }
  if (/culte|messe|mass|service|live|direct|sanctuaire/.test(combined)) {
    return 'Cultes en direct';
  }
  if (
    /afri|côte d'ivoire|cote d'ivoire|ivory|ci|benin|bénin|togo|congo|cameroun|cameroon|senegal|sénégal|burkina|mali|ghana|nigeria|kenya|rwanda|gabon|madagascar|emci|lumen/.test(
      combined
    )
  ) {
    return 'TV chrétiennes africaines';
  }
  if (/fr|franc|kto|emci|lumen|espoir|dieu tv|phare/.test(combined)) {
    return 'TV chrétiennes francophones';
  }
  return 'TV chrétiennes internationales';
}

/**
 * Strictly parses an M3U/M3U8 playlist string as inert text data (never executes scripts/HTML).
 */
export function parseM3uPlaylistText(rawText: string, maxEntries = 600): ParsedM3uEntry[] {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.length > 5 * 1024 * 1024) {
    throw new Error('Fichier playlist M3U trop volumineux (limite 5 Mo).');
  }

  const lines = normalized.split('\n');
  const entries: ParsedM3uEntry[] = [];
  let pendingExtInf: string | null = null;
  let pendingVlcGroup: string | null = null;

  for (const rawLine of lines) {
    if (entries.length >= maxEntries) break;
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      pendingExtInf = line;
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      pendingVlcGroup = sanitizeText(line.slice('#EXTGRP:'.length), 120) || null;
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    // Stream URL line
    let safeUrl: URL;
    try {
      safeUrl = assertSafeHttpUrl(line);
    } catch {
      pendingExtInf = null;
      pendingVlcGroup = null;
      continue;
    }

    const extInf = pendingExtInf || '';
    pendingExtInf = null;

    const commaIndex = extInf.lastIndexOf(',');
    const rawDisplayName =
      commaIndex >= 0 ? extInf.slice(commaIndex + 1) : safeUrl.hostname;
    const name = sanitizeText(rawDisplayName, 140) || safeUrl.hostname;
    const tvgId = extractExtInfAttr(extInf, 'tvg-id');
    const rawLogo = extractExtInfAttr(extInf, 'tvg-logo');
    let logoUrl: string | null = null;
    if (rawLogo) {
      try {
        logoUrl = assertSafeHttpUrl(rawLogo).toString();
      } catch {
        logoUrl = null;
      }
    }

    const groupTitle = extractExtInfAttr(extInf, 'group-title') || pendingVlcGroup;
    pendingVlcGroup = null;

    const language =
      extractExtInfAttr(extInf, 'tvg-language') ||
      (/(^|\b)(fr|french|français|francais)(\b|$)/i.test(`${name} ${extInf}`)
        ? 'Français'
        : 'Multilingue');
    const country = extractExtInfAttr(extInf, 'tvg-country');

    const hay = `${name} ${tvgId || ''} ${groupTitle || ''} ${safeUrl.hostname}`.toLowerCase();
    let score = 0;
    for (const kw of CHRISTIAN_KEYWORDS) {
      if (hay.includes(kw)) score += 1;
    }

    const suggestedCategory = inferCategory(name, groupTitle, language, country);

    entries.push({
      index: entries.length + 1,
      name,
      streamUrl: safeUrl.toString(),
      logoUrl,
      tvgId,
      groupTitle,
      language,
      country,
      suggestedCategory,
      christianRelevanceScore: score,
      isLikelyChristian: score > 0,
      streamFormat: detectStreamFormat(safeUrl.toString()),
    });
  }

  return entries;
}

export async function fetchAndParseM3uUrl(playlistUrl: string): Promise<ParsedM3uEntry[]> {
  const safeUrl = assertSafeHttpUrl(playlistUrl);
  await assertSafeResolvedTarget(safeUrl);

  const response = await fetch(safeUrl.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'CharitasTV-Validator/1.0',
      Accept: 'audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new Error(`Impossible de récupérer la playlist M3U (HTTP ${response.status}).`);
  }

  if (response.url) {
    const finalUrl = assertSafeHttpUrl(response.url);
    await assertSafeResolvedTarget(finalUrl);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('La playlist M3U reçue est vide.');
  }

  return parseM3uPlaylistText(text);
}

/**
 * Probes a stream or embed URL safely without acting as an open proxy and without bypassing geo-blocks/DRM.
 */
export async function probeStreamUrl(rawUrl: string): Promise<StreamProbeResult> {
  const checkedAt = new Date().toISOString();
  let safeUrl: URL;
  try {
    safeUrl = assertSafeHttpUrl(rawUrl);
  } catch (err: unknown) {
    return {
      status: 'unavailable',
      httpStatus: null,
      error: err instanceof Error ? err.message : 'URL de flux invalide.',
      detectedFormat: 'hls',
      checkedAt,
    };
  }

  const detectedFormat = detectStreamFormat(safeUrl.toString());

  try {
    await assertSafeResolvedTarget(safeUrl);
  } catch (err: unknown) {
    return {
      status: 'unavailable',
      httpStatus: null,
      error: err instanceof Error ? err.message : 'Domaine inaccessible.',
      detectedFormat,
      checkedAt,
    };
  }

  try {
    // Handle YouTube / Vimeo embeds via official oEmbed metadata check
    if (detectedFormat === 'embed') {
      const host = safeUrl.hostname.replace(/^www\./, '').toLowerCase();
      const oembedEndpoint = host.includes('vimeo.com')
        ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(safeUrl.toString())}`
        : `https://www.youtube.com/oembed?url=${encodeURIComponent(safeUrl.toString())}&format=json`;
      const res = await fetch(oembedEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) {
        return {
          status: 'unavailable',
          httpStatus: res.status,
          error: `Flux vidéo intégré indisponible ou privé (HTTP ${res.status}).`,
          detectedFormat,
          checkedAt,
        };
      }
      return {
        status: 'operational',
        httpStatus: res.status,
        error: null,
        detectedFormat,
        checkedAt,
      };
    }

    // For HLS / MP4 / streaming endpoints: bounded GET reading only initial manifest/bytes
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    let response: Response;
    try {
      response = await fetch(safeUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'CharitasTV-HealthMonitor/1.0',
          Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, video/*, */*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.url) {
      const redirectedUrl = assertSafeHttpUrl(response.url);
      await assertSafeResolvedTarget(redirectedUrl);
    }

    if (response.status === 403 || response.status === 451) {
      await response.body?.cancel().catch(() => {});
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: `Diffusion restreinte ou géo-bloquée (HTTP ${response.status}) — aucun contournement autorisé.`,
        detectedFormat,
        checkedAt,
      };
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: `Le serveur de flux a répondu HTTP ${response.status}.`,
        detectedFormat,
        checkedAt,
      };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // Read small initial slice (up to 64 KB) to verify manifest / non-HTML stream payload
    let snippet = '';
    if (response.body) {
      const reader = response.body.getReader();
      let bytesRead = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (bytesRead < 65536) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          bytesRead += value.byteLength;
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      snippet = Buffer.concat(chunks).toString('utf8');
    }

    const looksHtml =
      contentType.includes('text/html') || /^\s*<!doctype html|^\s*<html/i.test(snippet);
    if (looksHtml) {
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: 'L’URL renvoie une page web HTML et non un flux vidéo HLS/MP4 direct.',
        detectedFormat,
        checkedAt,
      };
    }

    const hasDrmKey =
      /com\.apple\.streamingkeydelivery|urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed|METHOD=SAMPLE-AES/i.test(
        snippet
      );
    if (hasDrmKey) {
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: 'Flux protégé par DRM détecté — intégration non autorisée.',
        detectedFormat,
        checkedAt,
      };
    }

    const isM3uManifest =
      snippet.includes('#EXTM3U') ||
      contentType.includes('mpegurl') ||
      detectedFormat === 'hls';

    if (detectedFormat === 'hls' && contentType.startsWith('text/plain') && !snippet.includes('#EXTM3U')) {
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: 'Manifeste HLS #EXTM3U invalide ou corrompu.',
        detectedFormat,
        checkedAt,
      };
    }

    if (!isM3uManifest && detectedFormat === 'mp4' && !contentType.includes('video/') && !contentType.includes('octet-stream')) {
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: `Type MIME inattendu pour la vidéo (${contentType || 'inconnu'}).`,
        detectedFormat,
        checkedAt,
      };
    }

    return {
      status: 'operational',
      httpStatus: response.status,
      error: null,
      detectedFormat,
      checkedAt,
    };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      status: 'unavailable',
      httpStatus: null,
      error: isAbort
        ? 'Délai dépassé lors de la vérification du flux (timeout 7s).'
        : err instanceof Error
          ? err.message
          : 'Erreur réseau lors du test de disponibilité.',
      detectedFormat,
      checkedAt,
    };
  }
}

export function isValidTvCategory(value: string): value is TvCategory {
  return (TV_CATEGORIES as readonly string[]).includes(value);
}

let healthSweepRunning = false;

export async function runChurchChannelsHealthCheck(churchId: number, userId?: number | null) {
  const rows = await withTenantContext({ churchId, userId: userId ?? null, isSuperAdmin: true }, async (tx) =>
    tx.select().from(tvChannels).where(eq(tvChannels.churchId, churchId))
  );

  const results: { channelId: number; status: string; error: string | null }[] = [];
  for (const ch of rows) {
    const probe = await probeStreamUrl(ch.streamUrl);
    await withTenantContext({ churchId, userId: userId ?? null, isSuperAdmin: true }, async (tx) =>
      tx
        .update(tvChannels)
        .set({
          streamStatus: probe.status,
          httpStatus: probe.httpStatus,
          lastCheckError: probe.error,
          lastCheckedAt: new Date(probe.checkedAt),
          updatedAt: new Date(),
        })
        .where(eq(tvChannels.id, ch.id))
    );
    results.push({ channelId: ch.id, status: probe.status, error: probe.error });
  }
  return results;
}

export function startPeriodicStreamHealthMonitor(intervalMs = 15 * 60 * 1000): () => void {
  const timer = setInterval(async () => {
    if (healthSweepRunning) return;
    healthSweepRunning = true;
    try {
      const allChurches = await withTenantContext({ isSuperAdmin: true }, async (tx) =>
        tx.select({ id: churches.id }).from(churches).where(eq(churches.status, 'active'))
      );
      for (const c of allChurches) {
        await runChurchChannelsHealthCheck(c.id);
      }
    } catch (err) {
      console.error('Periodic CHARITAS TV health monitor error:', err);
    } finally {
      healthSweepRunning = false;
    }
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
}

export { IPTV_ORG_RELIGIOUS_PLAYLIST_URL };
