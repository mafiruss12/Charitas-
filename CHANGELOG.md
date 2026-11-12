# Journal des Modifications (Changelog)

## Phase 1 — Fondation & Gestion Multi-Églises (2026-11-12)
- Socle Cloud SQL PostgreSQL + Drizzle ORM + Politiques RLS multi-tenant sur toutes les tables d'église.
- Authentification Google Sign-In (Firebase Auth) + Email/Mot de passe + Récupération/Réinitialisation de mot de passe.
- Création et personnalisation complète d'églises (logo, couleurs, devise, horaires, visibilité).
- Gestion des membres, responsables, départements, invitations, visiteurs (avec conversion en membre), matrice RBAC (11 rôles / 28 permissions) et journal d'audit.
- Suite de tests automatisés Phase 1 (5/5 tests passés).

## Phase 2 — Réseau Social, Messagerie Temps Réel, Vie Spirituelle & Événements (2026-11-12)
- Réseau social complet multi-tenant : fil d'actualité, vidéos courtes verticales, stories 24h, sondages, groupes, hashtags, favoris, abonnements et modération.
- Messagerie temps réel via WebSocket (`/ws`) : discussions privées, groupes, salon public, enregistrement vocal, pièces jointes, présence en ligne, accusés de lecture, blocage et signalisation d'appels audio/vidéo WebRTC.
- Espace vie spirituelle : Bible Louis Segond avec recherche et favoris, verset quotidien, méditations, plans de lecture, journal spirituel strictement privé (politique RLS propriétaire unique), mur de prière, témoignages, prédications/podcasts et quiz bibliques notés côté serveur.
- Événements & cultes : calendrier, inscriptions avec billets QR code PNG signés et validation de présence sécurisée.
- Suite de tests automatisés Phase 2 (5/5 tests passés).

## Phase 3 — Dons, Passerelles CI & Œuvres Humanitaires (2026-11-12)
- Campagnes de financement (Église vs Humanitaire), dons ponctuels/récurrents/anonymes/nominatifs et reçus numériques vérifiables.
- Architecture de paiement Côte d'Ivoire (Orange Money, MTN MoMo, Moov Money, Wave, Carte) avec webhooks HMAC-SHA256 vérifiés côté serveur (sans jamais simuler une confirmation de paiement) et guichet espèces réservé aux trésoriers (`donations.manage`).
- Grand livre financier inaltérable (`financial_ledger`) protégé par trigger PostgreSQL (`BEFORE UPDATE OR DELETE`) et chaînage SHA-256, séparation stricte des fonds et export CSV/Excel + impression PDF.
- Gestion humanitaire complète : dossiers bénéficiaires & familles strictement confidentiels (`humanitarian.manage`), évaluation/priorisation des demandes, distributions avec preuves, gestion des bénévoles et rapports d'intervention publics.
- Suite de tests automatisés Phase 3 (4/4 tests passés).

## Phase 4 — Marketplace, Enchères Solidaires, Académie & Assistant IA (2026-11-12)
- Marketplace & Boutique Solidaire (`src/routes/commerce.ts`, `MarketplacePanel.tsx`) avec séparation comptable (`commercial` vs `humanitarian`) et confirmation webhook HMAC-SHA256 sur les commandes en ligne.
- Enchères Solidaires (`AuctionsPanel.tsx`) : soumission, modération, protection anti-surenchère vendeur (`403`), prix de réserve et adjudication au grand livre.
- Médiathèque & Académie certifiante (`src/routes/academyMedia.ts`, `AcademyMediaPanel.tsx`) avec suivi des leçons, quiz corrigé côté serveur et génération de codes certificats.
- Assistant IA serveur `@google/genai` (`src/routes/ai.ts`, `AiAssistantPanel.tsx`) utilisant `gemini-4-hydrogen` sous contrôle strict RBAC et sans jamais exposer les dossiers humanitaires ou le journal spirituel privé.
- Suite de tests automatisés Phase 4 (5/5 tests passés).

## Phase 5 — Console Centrale Super Admin, Sécurité & Audit Complet (2026-11-12)
- Administration centrale multi-églises (`/api/superadmin/*`, `SuperAdminPanel.tsx`) : statistiques globales, suspension/réactivation d'églises, bascule des modules activés, plans SaaS (`saas_subscriptions`) et modération globale.
- Sécurité renforcée : limiteurs de débit (`src/middleware/rateLimit.ts`) sur authentification, webhooks et IA ; blocage automatique des églises suspendues ; vérification de complétude des 54 politiques RLS PostgreSQL (`pg_policies`).
- Suite de tests automatisés Phase 5 (3/3 tests passés) — Total cumulé : 22/22 tests passés.


