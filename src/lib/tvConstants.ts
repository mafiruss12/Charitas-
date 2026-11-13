export const TV_CATEGORIES = [
  'Chaînes chrétiennes africaines',
  'Chaînes chrétiennes francophones',
  'Chaînes chrétiennes internationales',
  'Gospel et louange',
  'Prédications',
  'Enseignements bibliques',
  'Cultes en direct',
  'Conférences chrétiennes',
] as const;

export type TvCategory = (typeof TV_CATEGORIES)[number];

const LEGACY_TV_CATEGORY_ALIASES: Record<string, TvCategory> = {
  'TV chrétiennes africaines': 'Chaînes chrétiennes africaines',
  'TV chrétiennes francophones': 'Chaînes chrétiennes francophones',
  'TV chrétiennes internationales': 'Chaînes chrétiennes internationales',
};

export function normalizeTvCategory(value: string | null | undefined): TvCategory {
  const trimmed = (value || '').trim();
  if ((TV_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed as TvCategory;
  }
  if (trimmed in LEGACY_TV_CATEGORY_ALIASES) {
    return LEGACY_TV_CATEGORY_ALIASES[trimmed];
  }
  return 'Chaînes chrétiennes internationales';
}

export const TV_BROADCAST_TYPES = [
  { value: 'culte', label: 'Diffusion des cultes' },
  { value: 'priere', label: 'Prières en direct' },
  { value: 'conference', label: 'Conférences' },
  { value: 'evenement', label: 'Événements' },
  { value: 'rediffusion', label: 'Rediffusions' },
] as const;

export type TvBroadcastType = (typeof TV_BROADCAST_TYPES)[number]['value'];

export type TvStreamStatusKey = 'operational' | 'unavailable' | 'incompatible' | 'pending_check';

export const TV_STREAM_STATUS_META: Record<
  TvStreamStatusKey,
  { label: string; description: string }
> = {
  operational: {
    label: 'Opérationnel',
    description: 'Flux HTTPS/CORS vérifié et lisible en direct dans le lecteur web.',
  },
  incompatible: {
    label: 'Incompatible',
    description: 'Flux détecté mais bloqué côté navigateur (CORS absent, HTTP non chiffré ou codec non supporté).',
  },
  unavailable: {
    label: 'Indisponible',
    description: 'Flux inaccessible, géo-restreint, segment 404 ou expiré.',
  },
  pending_check: {
    label: 'À vérifier',
    description: 'En attente de test de disponibilité et validation.',
  },
};

export const IPTV_ORG_RELIGIOUS_PLAYLIST_URL =
  'https://iptv-org.github.io/iptv/categories/religious.m3u';

