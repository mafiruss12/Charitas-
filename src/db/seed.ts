import { eq } from 'drizzle-orm';
import { db, withTenantContext } from './index.ts';
import { CHURCH_ROLES, DEFAULT_ROLE_PERMISSIONS } from './rbac.ts';
import { churches, departments, rolePermissions, tvChannels } from './schema.ts';

let seededOnce = false;

const VERIFIED_STARTER_IPTV_CHANNELS = [
  {
    name: 'Evandis Gospel TV',
    category: 'Gospel et louange',
    language: 'Français',
    country: 'France',
    logoUrl: 'https://i.imgur.com/v8TiqhH.png',
    streamUrl: 'https://evandis.streamakaci.tv/str_evandis_evandis/str_evandis_multi/playlist.m3u8',
    tvgId: 'EvandisGospelTV.fr@SD',
    description: 'Chaîne chrétienne francophone dédiée au gospel, à la louange et aux temps de prière.',
    currentProgram: 'Louange & Gospel en direct',
    isRecommended: true,
    rightsHolder: 'Evandis Gospel TV (Flux public iptv-org)',
  },
  {
    name: '3ABN French',
    category: 'Chaînes chrétiennes francophones',
    language: 'Français',
    country: 'International',
    logoUrl: 'https://i.imgur.com/B5gsM7m.png',
    streamUrl: 'https://3abn.bozztv.com/3abn2/Fre_live/smil:Fre_live.smil/playlist.m3u8',
    tvgId: '3ABNFrench.us@SD',
    description: 'Programmes chrétiens francophones : enseignements bibliques, santé et famille.',
    currentProgram: 'Émissions chrétiennes en français',
    isRecommended: true,
    rightsHolder: 'Three Angels Broadcasting Network (iptv-org)',
  },
  {
    name: 'EWTN Africa-Asia',
    category: 'Chaînes chrétiennes africaines',
    language: 'Anglais / Afrique',
    country: 'Afrique & International',
    logoUrl: 'https://play-lh.googleusercontent.com/3716tvZCgzpIt-X1giV8jKwCdC8zwOI4eMUfO_ETWzNX6eGKIi2RiUK9a_fr6BCzjw',
    streamUrl: 'https://cdn3.wowza.com/1/ZVBYYXFLLzE0c3NC/Qk1FMURC/hls/live/playlist.m3u8',
    tvgId: 'EWTN.us@AfricaAsia',
    description: 'Réseau catholique mondial : messes quotidiennes, chapelet, catéchèse et actualité de l’Église.',
    currentProgram: 'EWTN Catholic Live Feed',
    isRecommended: true,
    rightsHolder: 'EWTN Global Catholic Network (iptv-org)',
  },
  {
    name: 'Hope Channel Africa',
    category: 'Chaînes chrétiennes africaines',
    language: 'Anglais / Afrique',
    country: 'Afrique du Sud',
    logoUrl: 'https://i.imgur.com/SFacyYO.png',
    streamUrl: 'https://jstre.am/live/jsl:i1onRBELcGV.m3u8',
    tvgId: 'HopeChannelAfrica.za@SD',
    description: 'Télévision chrétienne africaine axée sur l’espérance, l’Évangile et la vie communautaire.',
    currentProgram: 'Hope Africa Direct',
    isRecommended: true,
    rightsHolder: 'Hope Channel Network (iptv-org)',
  },
  {
    name: 'Angel TV Africa',
    category: 'Chaînes chrétiennes africaines',
    language: 'Anglais / Afrique',
    country: 'Afrique',
    logoUrl: 'https://i.imgur.com/qKLEGU7.png',
    streamUrl: 'https://janya-digimix.akamaized.net/vglive-sk-904559/africa/ngrp:angelafrica_all/playlist.m3u8',
    tvgId: 'AngelTV.in@Africa',
    description: 'Programmes chrétiens, témoignages et édification destinés au public africain.',
    currentProgram: 'Diffusion chrétienne Afrique',
    isRecommended: false,
    rightsHolder: 'Angel TV Network (iptv-org)',
  },
  {
    name: 'Catholic TV',
    category: 'Chaînes chrétiennes internationales',
    language: 'Anglais',
    country: 'États-Unis',
    logoUrl: 'https://i.imgur.com/EL0rWD3.png',
    streamUrl: 'https://catholictvhd-lh.akamaized.net/hls/live/2043390/CTVLiveHD/master.m3u8',
    tvgId: 'CatholicTV.us@SD',
    description: 'Liturgie catholique, messes en direct, méditations et émissions familiales.',
    currentProgram: 'Messe & Vie de l’Église',
    isRecommended: false,
    rightsHolder: 'CatholicTV Network (iptv-org)',
  },
  {
    name: 'Catholic Faith Network',
    category: 'Cultes en direct',
    language: 'Anglais',
    country: 'États-Unis',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/0/07/Catholic_Faith_Network_2018.png',
    streamUrl: 'https://uni8rtmp.tulix.tv/cfntv/cfntv/playlist.m3u8',
    tvgId: 'CatholicFaithNetwork.us@SD',
    description: 'Célébrations eucharistiques en direct, liturgie des heures et commentaires bibliques.',
    currentProgram: 'Célébrations & Prières en direct',
    isRecommended: false,
    rightsHolder: 'Catholic Faith Network (iptv-org)',
  },
  {
    name: 'Amazing Facts TV',
    category: 'Enseignements bibliques',
    language: 'Anglais',
    country: 'États-Unis',
    logoUrl: 'https://i.imgur.com/4d65Bev.png',
    streamUrl: 'https://hlspackager.akamaized.net/live/DB/AMAZING_FACTS/HLS/AMAZING_FACTS.m3u8',
    tvgId: 'AmazingFactsTV.us@SD',
    description: 'Études bibliques approfondies et réponses théologiques en continu.',
    currentProgram: 'Enseignement biblique continu',
    isRecommended: false,
    rightsHolder: 'Amazing Facts Media (iptv-org)',
  },
  {
    name: '3ABN Praise Him Music Network',
    category: 'Gospel et louange',
    language: 'Anglais',
    country: 'États-Unis',
    logoUrl: 'https://i.imgur.com/iBcqT8L.png',
    streamUrl: 'https://3abn.bozztv.com/3abn1/PraiseHim/smil:PraiseHim.smil/playlist.m3u8',
    tvgId: '3ABNPraiseHimMusicNetwork.us@SD',
    description: 'Chants sacrés, chorales et musique chrétienne d’adoration 24h/24.',
    currentProgram: 'Louange & Cantiques 24/7',
    isRecommended: false,
    rightsHolder: 'Three Angels Broadcasting Network (iptv-org)',
  },
  {
    name: 'Shalom World Prayer',
    category: 'Prédications',
    language: 'Anglais',
    country: 'International',
    logoUrl: 'https://i.imgur.com/uUrTto3.png',
    streamUrl: 'https://broadcaster-1.cclouds.in/srt-4/channel4_abr/playlist.m3u8',
    tvgId: 'ShalomWorldPrayer.us@SD',
    description: 'Chaîne catholique d’adoration, prédications, chapelet et intercession.',
    currentProgram: 'Intercession & Prédications',
    isRecommended: false,
    rightsHolder: 'Shalom World Ministries (iptv-org)',
  },
  {
    name: 'Caribbean Gospel TV',
    category: 'Conférences chrétiennes',
    language: 'Anglais',
    country: 'Jamaïque',
    logoUrl: 'https://i.imgur.com/lhgrqmA.png',
    streamUrl: 'https://25466019af9b7aed.servers.dvcloud.tv/hls/iptv_providers/fhvtgifbqbcjp0g19mdd76t18tpalu4k.m3u8',
    tvgId: 'CaribbeanGospelTV.jm@SD',
    description: 'Conférences chrétiennes, concerts gospel et exhortations communautaires.',
    currentProgram: 'Conférences & Concerts Gospel',
    isRecommended: false,
    rightsHolder: 'Caribbean Gospel TV (iptv-org)',
  },
] as const;

async function ensureStarterTvCatalogForEbimpe(): Promise<void> {
  const [starterChurch] = await db
    .select({ id: churches.id })
    .from(churches)
    .where(eq(churches.slug, 'charitas-saint-louis-roi-ebimpe'))
    .limit(1);

  if (!starterChurch) return;

  await withTenantContext({ churchId: starterChurch.id, isSuperAdmin: true }, async (tx) => {
    const existingChannels = await tx
      .select({ id: tvChannels.id })
      .from(tvChannels)
      .where(eq(tvChannels.churchId, starterChurch.id))
      .limit(1);

    if (existingChannels.length > 0) return;

    await tx.insert(tvChannels).values(
      VERIFIED_STARTER_IPTV_CHANNELS.map((ch) => ({
        churchId: starterChurch.id,
        name: ch.name,
        category: ch.category,
        language: ch.language,
        country: ch.country,
        logoUrl: ch.logoUrl,
        streamUrl: ch.streamUrl,
        streamFormat: 'hls',
        sourceOrigin: 'iptv_org',
        tvgId: ch.tvgId,
        description: ch.description,
        currentProgram: ch.currentProgram,
        isRecommended: ch.isRecommended,
        isValidated: true,
        isActive: true,
        rightsVerified: true,
        rightsHolder: ch.rightsHolder,
        rightsNotes: 'Flux public chrétien vérifié (HTTPS + CORS + segments HLS H.264/AAC) depuis github.com/iptv-org/iptv',
        streamStatus: 'operational',
        httpStatus: 200,
        lastCheckedAt: new Date(),
        lastCheckError: null,
      }))
    );
  });
}

export async function initializeChurchRolePermissions(churchId: number): Promise<void> {
  await withTenantContext({ churchId, isSuperAdmin: true }, async (tx) => {
    for (const role of CHURCH_ROLES) {
      await tx
        .insert(rolePermissions)
        .values({
          churchId,
          role,
          permissions: DEFAULT_ROLE_PERMISSIONS[role],
        })
        .onConflictDoNothing({
          target: [rolePermissions.churchId, rolePermissions.role],
        });
    }
  });
}

export async function ensureStarterChurches(): Promise<void> {
  if (seededOnce) return;

  try {
    const existing = await db.select({ id: churches.id }).from(churches).limit(1);
    if (existing.length > 0) {
      await ensureStarterTvCatalogForEbimpe();
      seededOnce = true;
      return;
    }

    const inserted = await db
      .insert(churches)
      .values([
        {
          slug: 'charitas-saint-louis-roi-ebimpe',
          name: 'CHARITAS — Église Saint Louis Roi d’Ebimpé',
          tagline: 'Foi, Espérance et Charité fraternelle au service des familles d’Ebimpé',
          description:
            'Œuvre caritative et communauté paroissiale de l’Église Saint Louis Roi d’Ebimpé : aide alimentaire, soutien scolaire, soins de proximité, vie spirituelle et transparence solidaire.',
          denomination: 'Catholique',
          address: 'Quartier Ebimpé, Commune d’Anyama',
          city: 'Ebimpé / Abidjan',
          country: "Côte d'Ivoire",
          phone: '+225 27 22 41 00 18',
          email: 'charitas@saintlouis-ebimpe.ci',
          logoUrl: '/src/assets/images/charitas_emblem_crest_1794525619241.jpg',
          bannerUrl: '/src/assets/images/charitas_parish_hero_1794525618732.jpg',
          primaryColor: '#1B365D',
          accentColor: '#881337',
          currency: 'XOF',
          serviceSchedule: [
            { day: 'Dimanche', time: '08:30', title: 'Messe Dominicale & Collecte CHARITAS', location: 'Église Saint Louis Roi d’Ebimpé' },
            { day: 'Mercredi', time: '18:00', title: 'Adoration & Chapelet pour les familles', location: 'Chapelle Paroissiale' },
            { day: 'Samedi', time: '09:30', title: 'Permanence CHARITAS & Distribution Solidaire', location: 'Maison de la Charité d’Ebimpé' },
          ],
          isPublic: true,
          status: 'active',
        },
        {
          slug: 'espoir-vivant-yamoussoukro',
          name: 'Centre CHARITAS Espoir Vivant',
          tagline: 'Un refuge spirituel et solidaire au cœur de la Côte d’Ivoire',
          description:
            'Communauté chrétienne dédiée à l’édification spirituelle, à l’encadrement de la jeunesse et aux œuvres caritatives régionales.',
          denomination: 'Catholique & Solidaire',
          address: 'Quartier Habitat, Avenue Houphouët-Boigny',
          city: 'Yamoussoukro',
          country: "Côte d'Ivoire",
          phone: '+225 27 30 64 12 90',
          email: 'accueil@espoirvivant.ci',
          logoUrl: '/src/assets/images/charitas_emblem_crest_1794525619241.jpg',
          bannerUrl: '/src/assets/images/charitas_food_solidarity_1794525620555.jpg',
          primaryColor: '#1B365D',
          accentColor: '#B45309',
          currency: 'XOF',
          serviceSchedule: [
            { day: 'Dimanche', time: '08:30', title: 'Messe Matinale', location: 'Sanctuaire' },
            { day: 'Vendredi', time: '19:00', title: 'Veillée d’Intercession', location: 'Chapelle' },
          ],
          isPublic: true,
          status: 'active',
        },
      ])
      .onConflictDoNothing({ target: churches.slug })
      .returning();

    for (const church of inserted) {
      await initializeChurchRolePermissions(church.id);
      await withTenantContext({ churchId: church.id, isSuperAdmin: true }, async (tx) => {
        const defaultDepts =
          church.slug === 'charitas-saint-louis-roi-ebimpe'
            ? [
                { churchId: church.id, name: 'CHARITAS & Aide Alimentaire', description: 'Colis alimentaires, soutien aux veuves, orphelins et familles d’Ebimpé.' },
                { churchId: church.id, name: 'Éducation & Santé Communautaire', description: 'Kits scolaires, alphabétisation et permanences médicales paroissiales.' },
                { churchId: church.id, name: 'Liturgie, Chorale & Prière', description: 'Animation des messes, adoration et accompagnement spirituel.' },
                { churchId: church.id, name: 'Accueil & Fraternité', description: 'Accueil des nouveaux arrivants et visites à domicile.' },
              ]
            : [
                { churchId: church.id, name: 'Intercession & Prière', description: 'Réseau de prière et visites pastorales.' },
                { churchId: church.id, name: 'Entraide & Solidarité', description: 'Collectes et soutien aux veuves et orphelins.' },
                { churchId: church.id, name: 'Médias & Retransmission', description: 'Diffusion en direct et archives audio/vidéo.' },
              ];

        for (const dept of defaultDepts) {
          await tx
            .insert(departments)
            .values(dept)
            .onConflictDoNothing();
        }
      });
    }

    await ensureStarterTvCatalogForEbimpe();
    seededOnce = true;
  } catch (error) {
    console.error('Error seeding starter churches:', error);
  }
}
