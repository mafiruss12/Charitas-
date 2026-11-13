import dns from 'node:dns/promises';
import net from 'node:net';
import { eq } from 'drizzle-orm';
import { withTenantContext } from '../db/index.ts';
import { churches, tvChannels } from '../db/schema.ts';
import { parseVideoMedia } from './media.ts';
import {
  IPTV_ORG_RELIGIOUS_PLAYLIST_URL,
  TV_CATEGORIES,
  normalizeTvCategory,
  type TvCategory,
} from './tvConstants.ts';

export interface ParsedM3uEntry {
  index: number;
  name: string;
  streamUrl: string;
  httpProtocol: 'https' | 'http';
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
  status: 'operational' | 'unavailable' | 'incompatible' | 'pending_check';
  httpStatus: number | null;
  error: string | null;
  detectedFormat: 'hls' | 'mp4' | 'embed';
  corsAllowed: boolean;
  httpsCompatible: boolean;
  segmentChecked: boolean;
  checkedAt: string;
}

const NON_CHRISTIAN_PATTERN =
  /\b(islam|islamic|quran|qur'an|coran|muslim|makkah|mecca|madina|medina|madani|shia|sunni|ahmadiyya|mta\d*|azan|adhan|iqra|al-?resalah|huda\s*tv|peace\s*tv|al-?majd|kalamullah|hindu|hinduism|sanskar|aastha|bhakti|satsang|vedic|buddh|buddhist|dharma|sikh|khalsa|jewish|torah|judaism|scientolog|tawaftv|haramain)\b/i;

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
  'dieu',
  'bible',
  'biblique',
  'prière',
  'priere',
  'church',
  'église',
  'eglise',
  'paroisse',
  'parish',
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
  'hope channel',
  'esperanza',
  'maria',
  'maranatha',
  'shalom',
  'angelus',
  'capuchin',
  'telepace',
  'bethel',
  'amazing facts',
  'amazing discoveries',
  'faith africa',
  'sonlife',
  'redeem',
  'coptic',
  'orthodox',
];

const COUNTRY_CODE_LABELS: Record<string, string> = {
  ci: "Côte d'Ivoire",
  fr: 'France',
  be: 'Belgique',
  ch: 'Suisse',
  ca: 'Canada',
  us: 'États-Unis',
  uk: 'Royaume-Uni',
  gb: 'Royaume-Uni',
  tg: 'Togo',
  bj: 'Bénin',
  sn: 'Sénégal',
  cm: 'Cameroun',
  cd: 'RD Congo',
  cg: 'Congo',
  ke: 'Kenya',
  ng: 'Nigeria',
  gh: 'Ghana',
  ug: 'Ouganda',
  za: 'Afrique du Sud',
  br: 'Brésil',
  es: 'Espagne',
  ar: 'Argentine',
  co: 'Colombie',
  pe: 'Pérou',
  ro: 'Roumanie',
  de: 'Allemagne',
  pl: 'Pologne',
  ua: 'Ukraine',
  it: 'Italie',
  jm: 'Jamaïque',
  in: 'Inde',
  ru: 'Russie',
  hu: 'Hongrie',
  au: 'Australie',
};

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
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const norm = ip.toLowerCase();
    if (norm === '::' || norm === '::1') return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) {
      return true;
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
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function extractExtInfAttr(extInfLine: string, attrName: string): string | null {
  const regex = new RegExp(`(?:^|\\s)${attrName}=(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = extInfLine.match(regex);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const cleaned = sanitizeText(raw, 500);
  return cleaned || null;
}

function extractDisplayNameFromExtInf(extInfLine: string): string | null {
  let inDouble = false;
  let inSingle = false;
  let splitCommaIdx = -1;
  for (let i = 0; i < extInfLine.length; i++) {
    const ch = extInfLine[i];
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === ',' && !inDouble && !inSingle) {
      splitCommaIdx = i;
      break;
    }
  }
  if (splitCommaIdx >= 0) {
    const afterComma = sanitizeText(extInfLine.slice(splitCommaIdx + 1), 160);
    if (afterComma) return afterComma;
  }
  return extractExtInfAttr(extInfLine, 'tvg-name');
}

function inferCountryFromTvgId(tvgId: string | null): string | null {
  if (!tvgId) return null;
  const m = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
  if (!m) return null;
  return COUNTRY_CODE_LABELS[m[1].toLowerCase()] || m[1].toUpperCase();
}

function inferLanguageLabel(name: string, extInf: string, country: string | null): string {
  const attrLang = extractExtInfAttr(extInf, 'tvg-language');
  if (attrLang) {
    if (/^(fr|fre|fra|french|français|francais)$/i.test(attrLang)) return 'Français';
    if (/^(en|eng|english|anglais)$/i.test(attrLang)) return 'Anglais';
    if (/^(es|spa|spanish|espagnol)$/i.test(attrLang)) return 'Espagnol';
    if (/^(pt|por|portuguese|portugais)$/i.test(attrLang)) return 'Portugais';
    return attrLang;
  }
  const combined = `${name} ${extInf}`.toLowerCase();
  if (/(^|\b)(fr|french|français|francais|kto|emci|lumen|evandis)(\b|$)/i.test(combined)) {
    return 'Français';
  }
  if (/afri|uganda|kenya|nigeria|ghana|south africa/i.test(combined)) {
    return 'Anglais / Afrique';
  }
  if (country === 'France' || country === 'Belgique' || country === "Côte d'Ivoire" || country === 'Togo') {
    return 'Français';
  }
  if (/(espan|spanish|enlace|canal de la fe|bethel|viento|oracion|jujuy|santa maria|telefamilia|telesantiago|radio maya)/i.test(combined)) {
    return 'Espagnol';
  }
  return 'Anglais / International';
}

function inferCategory(name: string, group: string | null, language: string, country: string | null): TvCategory {
  const combined = `${name} ${group || ''} ${language} ${country || ''}`.toLowerCase();
  if (/gospel|louange|worship|music|choir|chorale|cantique|praise/.test(combined)) {
    return 'Gospel et louange';
  }
  if (/conférence|conference|summit|congrès|congres/.test(combined)) {
    return 'Conférences chrétiennes';
  }
  if (/bible|biblique|teaching|enseignement|catéch|catech|study|étude|amazing facts|discoveries/.test(combined)) {
    return 'Enseignements bibliques';
  }
  if (/prédic|predic|sermon|preach|proclaim/.test(combined)) {
    return 'Prédications';
  }
  if (/culte|messe|mass|service|sanctuaire|angelus/.test(combined)) {
    return 'Cultes en direct';
  }
  if (
    /afri|côte d'ivoire|cote d'ivoire|ivory|benin|bénin|togo|congo|cameroun|cameroon|senegal|sénégal|burkina|mali|ghana|nigeria|kenya|rwanda|gabon|madagascar|uganda|ouganda|afrique du sud|emci|lumen|capuchin/.test(
      combined
    )
  ) {
    return 'Chaînes chrétiennes africaines';
  }
  if (/français|francais|french|france|kto|emci|lumen|espoir|dieu tv|phare|evandis/.test(combined)) {
    return 'Chaînes chrétiennes francophones';
  }
  return 'Chaînes chrétiennes internationales';
}

function normalizeUrlDedupeKey(rawUrl: URL): string {
  return `${rawUrl.protocol}//${rawUrl.host.toLowerCase()}${rawUrl.pathname}${rawUrl.search}`;
}

/**
 * Strictly parses an M3U/M3U8 playlist string as inert text data (never executes scripts/HTML).
 * Deduplicates by normalized stream URL and applies Christian/non-Christian classification.
 */
export function parseM3uPlaylistText(rawText: string, maxEntries = 3000): ParsedM3uEntry[] {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.length > 8 * 1024 * 1024) {
    throw new Error('Fichier playlist M3U trop volumineux (limite 8 Mo).');
  }

  const lines = normalized.split('\n');
  const entries: ParsedM3uEntry[] = [];
  const seenUrls = new Set<string>();
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

    let safeUrl: URL;
    try {
      safeUrl = assertSafeHttpUrl(line);
    } catch {
      pendingExtInf = null;
      pendingVlcGroup = null;
      continue;
    }

    const dedupeKey = normalizeUrlDedupeKey(safeUrl);
    if (seenUrls.has(dedupeKey)) {
      pendingExtInf = null;
      pendingVlcGroup = null;
      continue;
    }
    seenUrls.add(dedupeKey);

    const extInf = pendingExtInf || '';
    pendingExtInf = null;

    const rawDisplayName = extractDisplayNameFromExtInf(extInf) || safeUrl.hostname;
    const name = sanitizeText(rawDisplayName, 140) || safeUrl.hostname;
    const tvgId = extractExtInfAttr(extInf, 'tvg-id');
    const rawLogo = extractExtInfAttr(extInf, 'tvg-logo');
    let logoUrl: string | null = null;
    if (rawLogo) {
      try {
        const parsedLogo = assertSafeHttpUrl(rawLogo);
        if (parsedLogo.protocol === 'https:') {
          logoUrl = parsedLogo.toString();
        }
      } catch {
        logoUrl = null;
      }
    }

    const groupTitle = extractExtInfAttr(extInf, 'group-title') || pendingVlcGroup;
    pendingVlcGroup = null;

    const country = extractExtInfAttr(extInf, 'tvg-country') || inferCountryFromTvgId(tvgId);
    const language = inferLanguageLabel(name, extInf, country);

    const hay = `${name} ${tvgId || ''} ${safeUrl.hostname}`.toLowerCase();
    const isExcluded = NON_CHRISTIAN_PATTERN.test(hay);
    let score = 0;
    if (!isExcluded) {
      for (const kw of CHRISTIAN_KEYWORDS) {
        if (hay.includes(kw)) score += 1;
      }
      if (/français/i.test(language)) score += 1;
      if (safeUrl.protocol === 'https:') score += 1;
    }

    const christianScoreWithoutBonus = isExcluded
      ? 0
      : CHRISTIAN_KEYWORDS.reduce((acc, kw) => (hay.includes(kw) ? acc + 1 : acc), 0);

    const suggestedCategory = inferCategory(name, groupTitle, language, country);

    entries.push({
      index: entries.length + 1,
      name,
      streamUrl: safeUrl.toString(),
      httpProtocol: safeUrl.protocol === 'https:' ? 'https' : 'http',
      logoUrl,
      tvgId,
      groupTitle,
      language,
      country,
      suggestedCategory,
      christianRelevanceScore: score,
      isLikelyChristian: !isExcluded && christianScoreWithoutBonus > 0,
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
      'User-Agent': 'CharitasTV-Validator/2.0',
      Accept: 'audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
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

function hasPermissiveCors(headers: Headers, requestOrigin = 'https://charitas.local'): boolean {
  const acao = (headers.get('access-control-allow-origin') || '').trim();
  if (!acao) return false;
  return acao === '*' || acao === requestOrigin;
}

async function readBoundedBodyText(response: Response, limitBytes = 65536): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  let bytesRead = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (bytesRead < limitBytes) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      bytesRead += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString('utf8');
}

function extractAllHlsPlaylistReferences(manifestText: string): {
  variants: { uri: string; codecs: string | null }[];
  audioUris: string[];
  segments: string[];
} {
  const lines = manifestText.replace(/\r\n/g, '\n').split('\n');
  const variants: { uri: string; codecs: string | null }[] = [];
  const audioUris: string[] = [];
  const segments: string[] = [];

  let pendingCodecs: string | null = null;
  let expectingVariantUri = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-MEDIA:')) {
      const uriMatch = line.match(/URI="([^"]+)"/i);
      if (uriMatch?.[1] && /TYPE=AUDIO/i.test(line)) {
        audioUris.push(uriMatch[1]);
      }
      continue;
    }

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const codecMatch = line.match(/CODECS="([^"]+)"/i);
      pendingCodecs = codecMatch?.[1] || null;
      expectingVariantUri = true;
      continue;
    }

    if (line.startsWith('#')) continue;

    if (expectingVariantUri) {
      variants.push({ uri: line, codecs: pendingCodecs });
      pendingCodecs = null;
      expectingVariantUri = false;
    } else {
      segments.push(line);
    }
  }

  return { variants, audioUris, segments };
}

function isWebSupportedCodecList(codecs: string | null): boolean {
  if (!codecs) return true;
  const lower = codecs.toLowerCase();
  // Reject HEVC/H.265-only streams that Chrome/Firefox HTML5/HLS.js cannot decode universally
  const hasHevc = /\b(hvc1|hev1)\./.test(lower);
  const hasAvcOrVp9 = /\b(avc1|avc3|vp09|av01)\./.test(lower);
  if (hasHevc && !hasAvcOrVp9) return false;
  return true;
}

/**
 * Deeply probes a stream or embed URL safely (SSRF-guarded, no open proxy, no DRM/geo bypass).
 * Verifies HTTPS compatibility, strict CORS headers across manifest + variant + audio + live segment,
 * codec compatibility, and real live-edge segment reachability.
 */
export async function probeStreamUrl(rawUrl: string): Promise<StreamProbeResult> {
  const checkedAt = new Date().toISOString();
  const originHeader = 'https://charitas.local';

  let safeUrl: URL;
  try {
    safeUrl = assertSafeHttpUrl(rawUrl);
  } catch (err: unknown) {
    return {
      status: 'unavailable',
      httpStatus: null,
      error: err instanceof Error ? err.message : 'URL de flux invalide.',
      detectedFormat: 'hls',
      corsAllowed: false,
      httpsCompatible: false,
      segmentChecked: false,
      checkedAt,
    };
  }

  const detectedFormat = detectStreamFormat(safeUrl.toString());
  const httpsCompatible = safeUrl.protocol === 'https:';

  if (!httpsCompatible && detectedFormat !== 'embed') {
    return {
      status: 'incompatible',
      httpStatus: null,
      error: 'Flux HTTP non chiffré : bloqué sur navigateur HTTPS (Mixed Content). Utilisez une source HTTPS.',
      detectedFormat,
      corsAllowed: false,
      httpsCompatible: false,
      segmentChecked: false,
      checkedAt,
    };
  }

  try {
    await assertSafeResolvedTarget(safeUrl);
  } catch (err: unknown) {
    return {
      status: 'unavailable',
      httpStatus: null,
      error: err instanceof Error ? err.message : 'Domaine inaccessible (DNS).',
      detectedFormat,
      corsAllowed: false,
      httpsCompatible,
      segmentChecked: false,
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
          corsAllowed: true,
          httpsCompatible: true,
          segmentChecked: false,
          checkedAt,
        };
      }
      return {
        status: 'operational',
        httpStatus: res.status,
        error: null,
        detectedFormat,
        corsAllowed: true,
        httpsCompatible: true,
        segmentChecked: true,
        checkedAt,
      };
    }

    const response = await fetch(safeUrl.toString(), {
      method: 'GET',
      headers: {
        Origin: originHeader,
        'User-Agent': 'CharitasTV-HealthMonitor/2.1',
        Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, video/*, */*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (response.url) {
      const redirectedUrl = assertSafeHttpUrl(response.url);
      if (redirectedUrl.protocol !== 'https:') {
        await response.body?.cancel().catch(() => {});
        return {
          status: 'incompatible',
          httpStatus: response.status,
          error: 'Redirection vers HTTP non sécurisé bloquée sur navigateur HTTPS.',
          detectedFormat,
          corsAllowed: false,
          httpsCompatible: false,
          segmentChecked: false,
          checkedAt,
        };
      }
      await assertSafeResolvedTarget(redirectedUrl);
    }

    if (response.status === 403 || response.status === 451) {
      await response.body?.cancel().catch(() => {});
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: `Diffusion restreinte ou géo-bloquée (HTTP ${response.status}) — aucun contournement autorisé.`,
        detectedFormat,
        corsAllowed: false,
        httpsCompatible,
        segmentChecked: false,
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
        corsAllowed: hasPermissiveCors(response.headers, originHeader),
        httpsCompatible,
        segmentChecked: false,
        checkedAt,
      };
    }

    let corsAllowed = hasPermissiveCors(response.headers, originHeader);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const snippet = await readBoundedBodyText(response, 65536);

    const looksHtml =
      contentType.includes('text/html') || /^\s*<!doctype html|^\s*<html/i.test(snippet);
    if (looksHtml) {
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: 'L’URL renvoie une page web HTML et non un flux vidéo HLS/MP4 direct.',
        detectedFormat,
        corsAllowed,
        httpsCompatible,
        segmentChecked: false,
        checkedAt,
      };
    }

    const hasDrmKey =
      /com\.apple\.streamingkeydelivery|urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed|METHOD=SAMPLE-AES/i.test(
        snippet
      );
    if (hasDrmKey) {
      return {
        status: 'incompatible',
        httpStatus: response.status,
        error: 'Flux protégé par DRM détecté — incompatible lecteur ouvert.',
        detectedFormat,
        corsAllowed,
        httpsCompatible,
        segmentChecked: false,
        checkedAt,
      };
    }

    if (detectedFormat === 'mp4') {
      if (!contentType.includes('video/') && !contentType.includes('octet-stream')) {
        return {
          status: 'incompatible',
          httpStatus: response.status,
          error: `Type MIME vidéo inattendu (${contentType || 'inconnu'}).`,
          detectedFormat,
          corsAllowed,
          httpsCompatible,
          segmentChecked: false,
          checkedAt,
        };
      }
      return {
        status: 'operational',
        httpStatus: response.status,
        error: null,
        detectedFormat,
        corsAllowed,
        httpsCompatible,
        segmentChecked: true,
        checkedAt,
      };
    }

    if (!snippet.includes('#EXTM3U')) {
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: 'Manifeste HLS invalide : balise #EXTM3U absente.',
        detectedFormat,
        corsAllowed,
        httpsCompatible,
        segmentChecked: false,
        checkedAt,
      };
    }

    let currentBaseUrl = response.url || safeUrl.toString();
    const parsedMaster = extractAllHlsPlaylistReferences(snippet);

    if (parsedMaster.variants.length === 0 && parsedMaster.segments.length === 0) {
      return {
        status: 'unavailable',
        httpStatus: response.status,
        error: 'Manifeste HLS vide (aucun flux ni segment vidéo actif).',
        detectedFormat,
        corsAllowed,
        httpsCompatible,
        segmentChecked: false,
        checkedAt,
      };
    }

    let activeSegments = parsedMaster.segments;

    if (parsedMaster.variants.length > 0) {
      const compatibleVariant =
        parsedMaster.variants.find((v) => isWebSupportedCodecList(v.codecs)) ||
        parsedMaster.variants[0];

      if (!isWebSupportedCodecList(compatibleVariant.codecs)) {
        return {
          status: 'incompatible',
          httpStatus: response.status,
          error: `Codec vidéo non compatible navigateur (${compatibleVariant.codecs}).`,
          detectedFormat,
          corsAllowed,
          httpsCompatible,
          segmentChecked: false,
          checkedAt,
        };
      }

      const variantUrl = assertSafeHttpUrl(new URL(compatibleVariant.uri, currentBaseUrl).toString());
      if (variantUrl.protocol !== 'https:') {
        return {
          status: 'incompatible',
          httpStatus: response.status,
          error: 'Variante HLS en HTTP non chiffré détectée (Mixed Content).',
          detectedFormat,
          corsAllowed,
          httpsCompatible: false,
          segmentChecked: false,
          checkedAt,
        };
      }
      await assertSafeResolvedTarget(variantUrl);

      const variantRes = await fetch(variantUrl.toString(), {
        method: 'GET',
        headers: {
          Origin: originHeader,
          'User-Agent': 'CharitasTV-HealthMonitor/2.1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(6500),
      });
      corsAllowed = corsAllowed && hasPermissiveCors(variantRes.headers, originHeader);
      if (!variantRes.ok) {
        await variantRes.body?.cancel().catch(() => {});
        return {
          status: 'unavailable',
          httpStatus: variantRes.status,
          error: `Sous-playlist vidéo inaccessible (HTTP ${variantRes.status}).`,
          detectedFormat,
          corsAllowed,
          httpsCompatible,
          segmentChecked: false,
          checkedAt,
        };
      }
      const variantText = await readBoundedBodyText(variantRes, 65536);
      currentBaseUrl = variantRes.url || variantUrl.toString();
      if (!variantText.includes('#EXTM3U')) {
        return {
          status: 'unavailable',
          httpStatus: variantRes.status,
          error: 'Sous-playlist HLS invalide (#EXTM3U absent).',
          detectedFormat,
          corsAllowed,
          httpsCompatible,
          segmentChecked: false,
          checkedAt,
        };
      }
      const parsedChild = extractAllHlsPlaylistReferences(variantText);
      activeSegments = parsedChild.segments;
      if (activeSegments.length === 0) {
        return {
          status: 'unavailable',
          httpStatus: variantRes.status,
          error: 'Aucun segment vidéo actif dans la playlist.',
          detectedFormat,
          corsAllowed,
          httpsCompatible,
          segmentChecked: false,
          checkedAt,
        };
      }
    }

    // Check alternate demuxed audio track if declared in Master manifest
    if (parsedMaster.audioUris.length > 0) {
      const audioUrl = assertSafeHttpUrl(new URL(parsedMaster.audioUris[0], response.url || safeUrl.toString()).toString());
      await assertSafeResolvedTarget(audioUrl);
      const audioRes = await fetch(audioUrl.toString(), {
        method: 'GET',
        headers: {
          Origin: originHeader,
          'User-Agent': 'CharitasTV-HealthMonitor/2.1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      corsAllowed = corsAllowed && hasPermissiveCors(audioRes.headers, originHeader);
      await audioRes.body?.cancel().catch(() => {});
      if (!audioRes.ok) {
        return {
          status: 'unavailable',
          httpStatus: audioRes.status,
          error: `Piste audio HLS inaccessible (HTTP ${audioRes.status}).`,
          detectedFormat,
          corsAllowed,
          httpsCompatible,
          segmentChecked: false,
          checkedAt,
        };
      }
    }

    // Probe the LATEST live-edge segment with GET Range (avoids false 404 when oldest sliding-window segment expires)
    const latestSegRef = activeSegments[activeSegments.length - 1];
    const segUrl = assertSafeHttpUrl(new URL(latestSegRef, currentBaseUrl).toString());
    if (segUrl.protocol !== 'https:') {
      return {
        status: 'incompatible',
        httpStatus: response.status,
        error: 'Segments vidéo en HTTP non chiffré bloqués sur navigateur HTTPS.',
        detectedFormat,
        corsAllowed,
        httpsCompatible: false,
        segmentChecked: true,
        checkedAt,
      };
    }
    await assertSafeResolvedTarget(segUrl);

    let segRes = await fetch(segUrl.toString(), {
      method: 'GET',
      headers: {
        Origin: originHeader,
        Range: 'bytes=0-1023',
        'User-Agent': 'CharitasTV-HealthMonitor/2.1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
    });
    if (segRes.status === 405 || segRes.status === 501) {
      await segRes.body?.cancel().catch(() => {});
      segRes = await fetch(segUrl.toString(), {
        method: 'HEAD',
        headers: {
          Origin: originHeader,
          'User-Agent': 'CharitasTV-HealthMonitor/2.1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(6500),
      });
    }
    const segCors = hasPermissiveCors(segRes.headers, originHeader);
    corsAllowed = corsAllowed && segCors;
    const segOk = segRes.ok;
    const segStatus = segRes.status;
    await segRes.body?.cancel().catch(() => {});

    if (!segOk) {
      return {
        status: 'unavailable',
        httpStatus: segStatus,
        error: `Segment vidéo inaccessible (HTTP ${segStatus}).`,
        detectedFormat,
        corsAllowed,
        httpsCompatible,
        segmentChecked: true,
        checkedAt,
      };
    }

    if (!corsAllowed) {
      return {
        status: 'incompatible',
        httpStatus: response.status,
        error:
          'En-tête CORS (Access-Control-Allow-Origin) absent sur le flux ou ses segments : illisible par le lecteur web HLS.js.',
        detectedFormat,
        corsAllowed: false,
        httpsCompatible,
        segmentChecked: true,
        checkedAt,
      };
    }

    return {
      status: 'operational',
      httpStatus: response.status,
      error: null,
      detectedFormat,
      corsAllowed: true,
      httpsCompatible: true,
      segmentChecked: true,
      checkedAt,
    };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    return {
      status: 'unavailable',
      httpStatus: null,
      error: isAbort
        ? 'Délai dépassé lors de la vérification du flux et des segments (timeout).'
        : err instanceof Error
          ? err.message
          : 'Erreur réseau lors du test de disponibilité.',
      detectedFormat,
      corsAllowed: false,
      httpsCompatible,
      segmentChecked: false,
      checkedAt,
    };
  }
}

export function isValidTvCategory(value: string): boolean {
  if ((TV_CATEGORIES as readonly string[]).includes(value)) return true;
  const normalized = normalizeTvCategory(value);
  return value === 'TV chrétiennes africaines' ||
    value === 'TV chrétiennes francophones' ||
    value === 'TV chrétiennes internationales' ||
    normalized === value;
}

let healthSweepRunning = false;

export async function runChurchChannelsHealthCheck(churchId: number, userId?: number | null) {
  const rows = await withTenantContext({ churchId, userId: userId ?? null, isSuperAdmin: true }, async (tx) =>
    tx.select().from(tvChannels).where(eq(tvChannels.churchId, churchId))
  );

  const results: { channelId: number; status: string; error: string | null }[] = [];
  const chunkSize = 4;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const probed = await Promise.all(
      slice.map(async (ch) => ({
        channel: ch,
        probe: await probeStreamUrl(ch.streamUrl),
      }))
    );

    await withTenantContext({ churchId, userId: userId ?? null, isSuperAdmin: true }, async (tx) => {
      for (const { channel, probe } of probed) {
        await tx
          .update(tvChannels)
          .set({
            streamStatus: probe.status,
            httpStatus: probe.httpStatus,
            lastCheckError: probe.error,
            lastCheckedAt: new Date(probe.checkedAt),
            streamFormat: probe.detectedFormat,
            updatedAt: new Date(),
          })
          .where(eq(tvChannels.id, channel.id));
        results.push({ channelId: channel.id, status: probe.status, error: probe.error });
      }
    });
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

export { IPTV_ORG_RELIGIOUS_PLAYLIST_URL, normalizeTvCategory };
