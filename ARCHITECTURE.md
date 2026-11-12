# Architecture Technique — Sanctuaire

## Vue d'ensemble
Sanctuaire est une plateforme multi-tenant destinée aux églises et organisations chrétiennes, construite sur :
- **Frontend** : React 19, TypeScript, Tailwind CSS v4, Vite, Lucide Icons.
- **Backend** : Node.js 22 + Express (`server.ts`) exposant les API REST `/api/*` et WebSockets (Phase 2+).
- **Base de données** : Cloud SQL PostgreSQL géré via Drizzle ORM (`drizzle-orm/node-postgres` + `pg.Pool`).
- **Authentification** : Firebase Authentication (Google Sign-In OAuth) + sessions locales HMAC-SHA256 avec hachage `bcryptjs`.
- **Sécurité Multi-Tenant** : Double défense — middleware RBAC (`requireChurchPermission`) + PostgreSQL Row Level Security (`withTenantContext`).

## Isolation Multi-Tenant
Chaque requête ciblant une église passe par `requireChurchPermission(permission)` puis exécute ses requêtes SQL via `withTenantContext({ churchId, userId, isSuperAdmin }, ...)`. Ce wrapper ouvre une transaction PostgreSQL et exécute `set_config('app.current_church_id', ..., true)`, permettant aux politiques RLS natives de filtrer et protéger chaque table métier au niveau du moteur SGBD.
