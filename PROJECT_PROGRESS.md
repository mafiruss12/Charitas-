# État d'Avancement du Projet — Sanctuaire

Dernière mise à jour : 2026-11-12

---

## PHASE 5 — FINALISATION, ADMINISTRATION CENTRALE & SÉCURITÉ : VALIDÉE

### Fonctionnalités développées & Statuts
| Fonctionnalité | Statut |
| :--- | :--- |
| Console Centrale Super Admin multi-églises (`/api/superadmin/*`, `SuperAdminPanel.tsx`) | **TERMINÉE ET TESTÉE** |
| Supervision globale (églises actives/suspendues, utilisateurs, dons consolidés, enchères, signalements) | **TERMINÉE ET TESTÉE** |
| Suspension/réactivation d'églises (blocage HTTP 403 immédiat côté middleware pour non-super-admins) | **TERMINÉE ET TESTÉE** |
| Activation/désactivation granulaire des modules par église & gestion des plans SaaS (`saas_subscriptions`) | **TERMINÉE ET TESTÉE** |
| Modération globale inter-églises | **TERMINÉE ET TESTÉE** |
| Durcissement sécurité : limiteurs de débit (`rateLimit.ts`), audit complet 54/54 politiques RLS PostgreSQL | **TERMINÉE ET TESTÉE** |

### Tests Phase 5
- `npx tsx --test tests/phase5.test.ts` : **3/3 tests passés** (RBAC Super Admin, suspension église + bascule modules + plan SaaS, modération globale & audit PostgreSQL `pg_policies` 54/54).

---

## PHASE 4 — MARKETPLACE, ENCHÈRES SOLIDAIRES, MULTIMÉDIA, ACADÉMIE & ASSISTANT IA : VALIDÉE

### Fonctionnalités développées & Statuts
| Fonctionnalité | Statut |
| :--- | :--- |
| Marketplace & Boutique Solidaire (catalogue, panier/commandes, séparation fonds commerciaux/humanitaires, confirmation webhook HMAC, décrémentation de stock) | **TERMINÉE ET TESTÉE** |
| Ventes aux enchères solidaires (soumission, modération, anti-surenchère vendeur 403, compte à rebours, prix de réserve, adjudication gagnant & crédit ledger) | **TERMINÉE ET TESTÉE** |
| Médiathèque (replays, conférences, louange, enseignements) | **TERMINÉE ET TESTÉE** |
| Académie chrétienne & humanitaire (cours, leçons, supports PDF, quiz noté côté serveur, certificats uniques) | **TERMINÉE ET TESTÉE** |
| Assistant IA `@google/genai` côté serveur (`gemini-4-hydrogen`, recherche biblique, résumé prédication, catalogue public, rédaction admin sous RBAC, zéro exposition de données confidentielles) | **TERMINÉE ET TESTÉE** |

### Tests Phase 4
- `npx tsx --test tests/phase4.test.ts` : **5/5 tests passés**.

---

## PHASE 3 — DONS ET ŒUVRES HUMANITAIRES : VALIDÉE
- Campagnes Église & Humanitaire, passerelles Côte d'Ivoire (Orange Money, MTN MoMo, Moov Money, Wave, Carte) via webhooks HMAC vérifiés (aucune confirmation factice), guichet espèces trésorier, dossiers bénéficiaires confidentiels (`humanitarian.manage`), grand livre immuable (`financial_ledger` + trigger SQL + chaînage SHA-256), export CSV/Excel & PDF.
- `npx tsx --test tests/phase3.test.ts` : **4/4 tests passés**.

## PHASE 2 — RÉSEAU SOCIAL, MESSAGERIE ET VIE SPIRITUELLE : VALIDÉE
- Réseau social complet, messagerie temps réel WebSocket (`/ws` + signalisation WebRTC), Bible Louis Segond, journal spirituel strictement privé (RLS propriétaire unique), événements & billets QR signés.
- `npx tsx --test tests/phase2.test.ts` : **5/5 tests passés**.

## PHASE 1 — FONDATION ET GESTION MULTI-ÉGLISES : VALIDÉE
- Auth (Firebase Google + Email/Mot de passe + reset), création/personnalisation d'églises, 11 rôles & 28 permissions configurables, membres, départements, visiteurs, invitations, audit & RLS multi-tenant.
- `npx tsx --test tests/phase1.test.ts` : **5/5 tests passés**.

---

### Identifiants externes requis pour mise en production commerciale
- Clés API marchandes Côte d'Ivoire (`ORANGE_MONEY_MERCHANT_KEY`, `MTN_MOMO_SUBSCRIPTION_KEY`, `MOOV_MONEY_API_KEY`, `WAVE_API_KEY`, `STRIPE_SECRET_KEY`) + `PAYMENT_WEBHOOK_SECRET` (sinon mode Sandbox explicite sans confirmation factice).
- `SMTP_HOST` (envoi réel d'emails transactionnels).
