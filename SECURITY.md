# Sécurité & Contrôle d'Accès — Sanctuaire

## 1. Authentification & Sessions
- **Google Sign-In** via Firebase Auth (`signInWithPopup`), vérifié côté serveur par `firebase-admin`.
- **Email & Mot de passe** haché par `bcryptjs` (coût 10), jetons HMAC-SHA256 conservés uniquement en mémoire côté client (jamais dans `localStorage`).
- **Réinitialisation de mot de passe** : jetons aléatoires 24 octets hachés SHA-256, expiration 30 min, usage unique.

## 2. Contrôle d'Accès Granulaire (RBAC) & Confidentialité
- 11 rôles et 28 permissions granulaires configurables par église.
- Dossiers humanitaires (`beneficiaries`, `aid_requests`, `beneficiary_family_members`) restreints à `humanitarian.manage`.
- Journal spirituel privé (`spiritual_journal`) protégé par politique RLS propriétaire unique (`user_id` + `church_id`), inaccessible aux administrateurs et pasteurs.
- Assistant IA serveur (`@google/genai`) soumis à `ai.use` (mode `admin_draft` réservé aux gestionnaires) et sans accès aux données confidentielles.

## 3. PostgreSQL Row Level Security (RLS) & Immuabilité Financière
- **54 politiques RLS** actives dans PostgreSQL sur l'ensemble des tables tenant (`ENABLE ROW LEVEL SECURITY`, `USING` et `WITH CHECK`).
- Grand livre `financial_ledger` protégé contre toute modification ou suppression directe par le trigger PostgreSQL `prevent_financial_ledger_mutation()` et chaînage SHA-256.
- Webhooks de paiement vérifiés par signature HMAC-SHA256 (`PAYMENT_WEBHOOK_SECRET`) et idempotence par `external_event_id`.

## 4. Protection Réseau & Gouvernance Centrale
- Limiteurs de débit (`src/middleware/rateLimit.ts`) sur `/api/auth`, `/api/webhooks` et `/api/churches/:churchId/ai`.
- Suspension centrale d'église appliquée immédiatement côté middleware (`403`).
