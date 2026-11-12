# Guide de Déploiement — Charitas — Église Saint Louis Roi d'Ebimpé

## Variables d'environnement requises (côté serveur uniquement)
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD` : Connexion Cloud SQL PostgreSQL (runtime).
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` : Connexion administrateur pour Drizzle Kit.
- `SESSION_SECRET` : Clé secrète HMAC-SHA256 pour la signature des jetons de session locaux.
- `GEMINI_API_KEY` : Clé API Gemini (côté serveur uniquement pour l'assistant biblique et administratif).
- `SMTP_HOST` (optionnel) : Pour l'envoi réel des emails de réinitialisation de mot de passe en production.

## Commandes locales
- Installation : `npm install`
- Vérification TypeScript : `npm run lint`
- Build frontend : `npm run build`
- Démarrage production : `npm start` (`node server.ts` sur le port `3000`)

## Publication sur GitHub
Le dépôt local est initialisé sur la branche `main` avec le workflow CI `.github/workflows/ci.yml`.
Pour pousser vers votre dépôt GitHub distant :
```bash
git remote add origin https://github.com/<VOTRE-COMPTE>/<VOTRE-DEPOT>.git
git push -u origin main
```
