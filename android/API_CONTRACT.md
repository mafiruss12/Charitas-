# Contrat API Mobile & État des Fonctionnalités — CHARITAS Android

## 1. Correspondance Web <-> Mobile Android

| Fonctionnalité | Endpoint Backend Utilisé | État | Mode Visiteur | Mode Hors Ligne |
|---|---|---|---|---|
| **Accueil paroissial & horaires** | `GET /api/public/showcase` | Opérationnel | Oui | Cache JSON public |
| **Formulaire contact visiteur** | `POST /api/public/visitor-contact` | Opérationnel | Oui | Nécessite réseau |
| **Authentification (Login/Register/Reset)** | `POST /api/auth/login`, `/register`, `/forgot-password`, `/reset-password` | Opérationnel | N/A | Token chiffré Keystore + profil `/me` en cache |
| **Profil membre & églises** | `GET /api/auth/me`, `PATCH /api/auth/me` | Opérationnel | Non | Lecture cache privé |
| **Bible Crampon 1923 (73 livres AT+NT)** | Asset embarqué `bible_crampon_1923.json` + Room FTS4 | Opérationnel | Oui | **100 % Hors Ligne** (35 610 versets) |
| **Signets Bible synchronisés** | `POST /api/churches/:churchId/spiritual/bookmarks` | Opérationnel | Local Room | File Outbox + sync |
| **Plans de lecture & Méditations** | `GET /api/public/spiritual/daily`, `GET .../spiritual/overview`, `POST .../toggle-day` | Opérationnel | Oui | SQLite cache + Outbox |
| **Fil social & Groupes** | `GET /api/public/feed`, `GET/POST .../social/posts`, `react`, `comments`, `groups` | Opérationnel | Lecture fil public | Cache + Outbox (statut pending explicite) |
| **Messagerie temps réel** | `GET/POST .../messaging/conversations/...` + WebSocket `wss://.../ws` | Opérationnel | Non | Cache messages + Outbox |
| **Notifications** | `GET .../notifications`, `POST .../notifications/read-all` + `WorkManager` local | Opérationnel | Rappels locaux | Rappels quotidiens 100 % hors ligne |
| **CHARITAS TV (HLS)** | `GET /api/public/tv/catalog`, `POST .../tv/favorites/:channelId` | Opérationnel | Oui | Catalogue en cache (flux live nécessite réseau) |
| **Événements & Billets QR / Pointage** | `GET /api/public/events`, `GET/POST .../events/:id/register`, `checkin-qr` | Opérationnel | Lecture publique | Billet QR consultable hors ligne |
| **Solidarité, Dons, Missions, Replays** | `GET /api/public/solidarity`, `GET /api/public/media` | Opérationnel | Oui | Cache JSON public |
| **Administration & Charte graphique** | `GET .../members`, `GET .../audit-logs`, `PATCH .../settings` | Opérationnel (RBAC) | Non | Nécessite réseau + permissions serveur |

---

## 2. Routes Publiques Ajoutées de Manière Non Destructive (`/src/routes/churches.ts`)

Ces 3 routes en lecture seule exposent uniquement des contenus paroissiaux publics sans aucune donnée personnelle de membre ni de bénéficiaire humanitaire :
- `GET /api/public/spiritual/daily?churchId=` — Verset du jour, méditations, prédications, podcasts et plans de lecture.
- `GET /api/public/media?churchId=` — Médiathèque de replays et conférences.
- `GET /api/public/solidarity?churchId=` — Campagnes de dons, rapports publics d'intervention sociale et missions bénévoles ouvertes.

---

## 3. Manques Backend Identifiés (Transparence Architecturale)

Les éléments suivants n'existent pas encore dans le backend Node/Express actuel et sont explicitement documentés comme évolutions futures :

1. **Enregistrement de jetons Push FCM (`device_tokens`)** :
   - État actuel : Aucune table ni route `POST /api/devices/register` pour Firebase Cloud Messaging côté serveur.
   - Comportement mobile : L'application utilise les **rappels locaux `WorkManager` hors connexion** (verset du jour, méditation) + la synchronisation temps réel WebSocket (`/ws`) et HTTP des notifications lorsque l'application est active.
2. **Téléversement binaire multipart de photos/vidéos** :
   - État actuel : Les routes `/social/posts` et `/media` attendent une chaîne `mediaUrl` (pas encore d'endpoint `multipart/form-data` avec Cloud Storage).
   - Comportement mobile : Les publications multimédias acceptent une URL HTTPS, sans faux upload binaire.
3. **Révocation serveur de jeton & Refresh Token court** :
   - État actuel : Les jetons locaux HMAC ont une durée de vie de 7 jours sans endpoint `POST /api/auth/logout` côté serveur.
   - Comportement mobile : La déconnexion détruit le jeton dans `EncryptedSharedPreferences`, coupe le WebSocket et purge les caches privés SQLite.
