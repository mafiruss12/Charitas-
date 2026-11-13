export const TV_CATEGORIES = [
  'TV chrétiennes africaines',
  'TV chrétiennes internationales',
  'TV chrétiennes francophones',
  'Gospel et louange',
  'Prédications',
  'Enseignements bibliques',
  'Cultes en direct',
  'Conférences chrétiennes',
] as const;

export type TvCategory = (typeof TV_CATEGORIES)[number];

export const TV_BROADCAST_TYPES = [
  { value: 'culte', label: 'Diffusion des cultes' },
  { value: 'priere', label: 'Prières en direct' },
  { value: 'conference', label: 'Conférences' },
  { value: 'evenement', label: 'Événements' },
  { value: 'rediffusion', label: 'Rediffusions' },
] as const;

export type TvBroadcastType = (typeof TV_BROADCAST_TYPES)[number]['value'];

export const TV_STREAM_STATUS_META: Record<
  'operational' | 'unavailable' | 'pending_check',
  { label: string; description: string }
> = {
  operational: {
    label: 'Opérationnel',
    description: 'Flux vérifié et disponible à la lecture.',
  },
  unavailable: {
    label: 'Indisponible',
    description: 'Flux inaccessible, géo-restreint ou expiré.',
  },
  pending_check: {
    label: 'À vérifier',
    description: 'En attente de test de disponibilité et validation.',
  },
};

export const IPTV_ORG_RELIGIOUS_PLAYLIST_URL =
  'https://iptv-org.github.io/iptv/categories/religious.m3u';
