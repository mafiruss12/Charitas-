import { eq } from 'drizzle-orm';
import { db, withTenantContext } from './index.ts';
import { CHURCH_ROLES, DEFAULT_ROLE_PERMISSIONS } from './rbac.ts';
import { churches, departments, rolePermissions } from './schema.ts';

let seededOnce = false;

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
      seededOnce = true;
      return;
    }

    const inserted = await db
      .insert(churches)
      .values([
        {
          slug: 'charitas-saint-louis-roi-ebimpe',
          name: 'Charitas — Église Saint Louis Roi d’Ebimpé',
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
            { day: 'Dimanche', time: '08:30', title: 'Messe Dominicale & Collecte Charitas', location: 'Église Saint Louis Roi d’Ebimpé' },
            { day: 'Mercredi', time: '18:00', title: 'Adoration & Chapelet pour les familles', location: 'Chapelle Paroissiale' },
            { day: 'Samedi', time: '09:30', title: 'Permanence Charitas & Distribution Solidaire', location: 'Maison de la Charité d’Ebimpé' },
          ],
          isPublic: true,
          status: 'active',
        },
        {
          slug: 'espoir-vivant-yamoussoukro',
          name: 'Centre Charitas Espoir Vivant',
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
                { churchId: church.id, name: 'Charitas & Aide Alimentaire', description: 'Colis alimentaires, soutien aux veuves, orphelins et familles d’Ebimpé.' },
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

    seededOnce = true;
  } catch (error) {
    console.error('Error seeding starter churches:', error);
  }
}
