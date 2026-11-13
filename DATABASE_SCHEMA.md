# Schéma de Base de Données PostgreSQL — Sanctuaire

Total : **54 politiques RLS actives et vérifiées** (`pg_policies` avec `qual` et `with_check` non nuls).

## Phase 1 : Fondation Multi-Églises
| Table | Rôle | RLS |
| :--- | :--- | :---: |
| `users` | Comptes utilisateurs fédérés Firebase Auth & locaux | Global identité |
| `password_resets` | Jetons SHA-256 à usage unique (30 min) | Global identité |
| `churches` | Tenants (églises), branding, devise, modules activés, statut | Catalogue public / gouvernance |
| `departments` | Départements & ministères par église | **Oui** (`church_id`) |
| `church_memberships` | Membres, 11 rôles, statuts | **Oui** (`church_id` ou `user_id`) |
| `role_permissions` | Matrice RBAC (28 permissions) par église et rôle | **Oui** (`church_id`) |
| `invitations` | Codes d'invitation ciblés et révocables | **Oui** (`church_id`) |
| `visitors` | Suivi pastoral & conversion en membre | **Oui** (`church_id`) |
| `audit_logs` | Journal d'audit administratif | **Oui** (`church_id`) |

## Phase 2 : Réseau Social, Messagerie, Vie Spirituelle & Événements
- Social : `community_groups`, `community_group_members`, `social_posts`, `social_stories`, `social_comments`, `social_reactions`, `social_bookmarks`, `user_follows`, `poll_options`, `poll_votes`, `content_reports`.
- Messagerie : `conversations`, `conversation_participants`, `chat_messages`, `user_blocks`, `notifications`.
- Vie Spirituelle : `spiritual_contents`, `reading_plans`, `reading_plan_progress`, `spiritual_journal` (**RLS strict propriétaire unique `user_id` + `church_id`**), `prayer_requests`, `prayer_interactions`, `testimonies`, `bible_quizzes`, `bible_quiz_attempts`, `spiritual_bookmarks`.
- Événements : `church_events`, `event_registrations`.

## Phase 3 : Dons, Paiements CI & Humanitaire
- `donation_campaigns`, `donations`, `donation_receipts`, `payment_webhook_events`.
- `beneficiaries`, `beneficiary_family_members`, `aid_requests`, `aid_distributions`, `volunteer_assignments`, `intervention_reports`.
- `financial_ledger` : **Append-only** protégé par trigger SQL `trg_financial_ledger_immutable` et chaînage SHA-256 par type de fonds (`church`, `humanitarian`, `commercial`).

## Phase 4 : Marketplace, Enchères, Académie & Média
- `marketplace_products`, `marketplace_orders`, `marketplace_order_items`.
- `auctions`, `auction_bids`.
- `media_library`, `academy_courses`, `academy_enrollments`.

## Phase 5 : Administration Centrale SaaS
- `saas_subscriptions` : Plans (`essential`, `growth`, `network`), statut, tarifs et quotas par église (RLS actif).
