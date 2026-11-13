# Audit Technique & Plan de Réalisation — CHARITAS Android (Église Saint Louis Roi d’Ebimpé)

Audit complet de la plateforme existante **CHARITAS** et plan d’architecture en 8 phases pour construire l’application Android native (**Kotlin, Jetpack Compose, Material 3, Offline-First**) connectée au backend existant sans casser le site web ni les données de production.

---

## Décisions & Points de Validation Utilisateur

> [!IMPORTANT]
> Ce document présente l’audit réel du code existant avant toute création de fichier. Aucun code web, base de données ou branche Git n’a été modifié. Veuillez valider les choix structurants ci-dessous avant le lancement de l’implémentation.

- **Périmètre de livraison binaire (APK / AAB)** : L’audit de l’environnement d’exécution confirme qu’**aucun JDK (`java`), Gradle, ni Android SDK (`sdkmanager` / `adb`) n’est installé dans ce conteneur** et qu’**aucun dépôt `.git` n’est initialisé localement**. Nous livrerons l’ensemble du code source Android complet (Kotlin, Jetpack Compose, Material 3, Gradle Kotlin DSL, schéma Room/SQLite, tests unitaires et workflow CI GitHub Actions prêt pour générer l’APK/AAB), **mais la compilation binaire `.apk` et `.aab` devra être exécutée sur votre poste (Android Studio) ou via GitHub Actions** avec Android SDK 35 & JDK 17.
- **Évolution backend contrôlée (avec votre accord préalable)** : Pour satisfaire pleinement le **mode Visiteur sans compte (Phase 6)** (méditations, plans de lecture et médiathèque téléchargeables sans inscription) ainsi que les pièces jointes mobiles, l’ajout ciblé de **3 routes publiques en lecture seule** (`/api/public/spiritual/daily`, `/api/public/media`, `/api/public/solidarity`) et d’un **endpoint de téléversement média** sera proposé de manière non destructive. Par défaut, l’app Android consomme exclusivement les routes déjà en production.
- **Traduction biblique hors connexion (Phase 3)** : Le module web `bible-fr` actuel ne contient qu’un **extrait partiel de 213 lignes** (quelques chapitres sélectionnés). Pour offrir une Bible complète Ancien & Nouveau Testament utilisable hors ligne dans le respect strict des droits d’auteur, l’application Android embarquera la traduction **Louis Segond 1910 (Domaine Public)** complète en base locale SQLite/Room indexée FTS.
- **Identité & Emplacement du code Android** : Intégration dans un sous-dossier autonome dédié (`/android`) du projet afin de cohabiter proprement avec le backend Node/Express et le frontend web sans interférer avec `npm run build`.

---

## 1. Rapport d’Audit du Projet CHARITAS Existant

### 1.1 Constat Environnement, Dépôt & Infrastructure
- **Dépôt GitHub** : Aucun dossier `.git` ni télécommande GitHub n’est présent dans l’espace de travail conteneurisé. Toute synchronisation avec un dépôt GitHub distant nécessitera de fournir/lier le dépôt cible et de valider explicitement la branche de travail (sans jamais pousser sur `main` sans accord).
- **Backend réel en place** : Serveur **Node.js + Express + TypeScript** complété par un serveur **WebSocket (`ws` sur `/ws`)**, connecté à **PostgreSQL (Cloud SQL `europe-west2`)** via **Drizzle ORM** (**60 tables** recensées dans le schéma).
- **Sécurité & Multi-Tenant** :
  - **54 politiques PostgreSQL Row Level Security (RLS)** actives via transactions scopées (`churchId`, `userId`, `isSuperAdmin`), isolant strictement chaque église.
  - **Authentification double** : jetons locaux HMAC-SHA256 signés (`local.<payload>.<sig>`, validité 7 jours) pour Email/Mot de passe (`bcryptjs`) **et** vérification côté serveur de jetons **Firebase ID Token** (`firebase-admin`) pour Google Sign-In.
  - **RBAC granulaire** : **11 rôles** (*super_admin, church_admin, senior_pastor, associate_pastor, department_leader, treasurer, humanitarian_lead, moderator, volunteer, member, visitor*) et **28 permissions** configurables par paroisse.
  - **Protection des données sensibles** : dossiers bénéficiaires humanitaires réservés à `humanitarian.manage`, journal spirituel privé verrouillé par RLS propriétaire unique (`isSuperAdmin: false`), grand livre financier (`financial_ledger`) immuable en écriture seule (*append-only* + chaînage SHA-256).

### 1.2 État des Fonctionnalités Web & Correspondance Android

| Domaine | État Backend / Web Existant | API / Transport Réel | Équivalent Android & Écart Identifié |
|---|---|---|---|
| **Accueil public & Églises** | Opérationnel | `GET /api/public/showcase`, `/public/churches`, `POST /public/visitor-contact` | Écran Accueil public caché en Room (mode hors connexion immédiat). **Complet.** |
| **Auth, Profil & Thème** | Opérationnel | `POST /api/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `GET/PATCH /api/auth/me` | Authentification native + stockage sécurisé `EncryptedSharedPreferences`/Keystore + Google Sign-In via Credential Manager Android. **Manque backend :** pas de endpoint `/logout` révocable ni de refresh token court terme. |
| **Réseau social & Vidéos courtes** | Opérationnel (membres) + Aperçu public | `GET /api/public/feed`, `/api/churches/:id/social/posts`, `/stories`, `/comments`, `/react`, `/poll-vote`, `/groups`, `/reports` | Flux temps réel, lecteur vertical court format Media3, file hors connexion (*Outbox*) pour brouillons de posts/commentaires. **Manque backend :** pas d’upload binaire direct (photos/vidéos caméra téléphone) sans URL externe. |
| **Messagerie & Appels** | Opérationnel (membres) | `/api/churches/:id/messaging/*` + WebSocket `/ws` (`chat:message`, `presence:update`, `call:signal`) | Messagerie temps réel OkHttp WebSocket + file d’envoi différée avec badge *« En attente de réseau »* (jamais marqué envoyé avant ACK serveur). |
| **Notifications** | Partiel (Interne Web/DB uniquement) | `GET /churches/:id/notifications`, `POST .../notifications/read-all` + WS | Notifications locales quotidiennes Android via `WorkManager` + notifications in-app synchronisées. **Manque backend :** aucun enregistrement de jetons FCM (`push_tokens`) pour notifications push application fermée. |
| **Vie spirituelle & Bible** | Partiel (Extrait biblique, auth requis) | `/api/churches/:id/spiritual/overview`, `/bible`, `/bookmarks`, `/journal`, `/prayers`, `/reading-plans` | Base complète **LSG 1910 (66 livres)** embarrassée offline en Room + FTS, notes, favoris, plans et lecteur audio/texte. **Manque backend :** pas d’endpoint public `/public/spiritual/daily` sans connexion pour visiteurs. |
| **Événements & QR Présence** | Opérationnel | `GET /api/public/events`, `/api/churches/:id/events`, `/register`, `/checkin-qr` | Calendrier synchronisé offline + affichage QR membre + scanner caméra (ML Kit / CameraX) pour organisateurs. **Complet.** |
| **CHARITAS TV** | Opérationnel | `GET /api/public/tv/catalog`, `/public/tv/channels/:id`, favoris, historique, régie admin | Lecteur natif **AndroidX Media3 (ExoPlayer HLS)** ultra-fluide plein écran + PiP + avertissement clair hors connexion. **Complet.** |
| **Dons & Humanitaire / Bénévolat** | Opérationnel (clés paiement prod requises) | `/api/churches/:id/donations/*`, `/humanitarian/*`, `webhooks/payments/:provider` | Consultation transparente + suivi missions bénévoles + dossiers confidentiels soumis strictement à `humanitarian.manage`. **Complet** (paiements réels dépendent des clés `.env` serveur). |
| **Marketplace, Enchères, Académie & Admin** | Opérationnel (membres / admins) | `/commerce/*`, `/academy/*`, `/media/*`, `/tenant/*`, `/superadmin/*` | Modules accessibles selon `permissions[]` renvoyées par `/auth/me` et filtrage strict UI + API. **Manque backend :** accès visiteur médiathèque sans compte (`/public/media`). |

---

## 2. Expérience Utilisateur & Identité Visuelle Android

- **Parcours clés** :
  - *Premier lancement (Visiteur immédiat)* : Splash Screen animé CHARITAS (blason royal + transition fluide) → accès immédiat à l’écran d’accueil paroissial (Saint Louis Roi d’Ebimpé), à la **Bible complète hors ligne**, au Verset du jour, aux événements publics et à **CHARITAS TV** (si connecté), avec incitation discrète à se connecter uniquement sur les actions privées.
  - *Navigation mobile-first (Material 3)* : Barre inférieure adaptative à 5 piliers (**Accueil**, **Communauté**, **Bible**, **TV & Directs**, **Menu/Profil**) complétée par un tiroir/grille secondaire pour Messagerie, Groupes, Dons, Événements QR, Solidarité et Administration (affichée dynamiquement selon les permissions).
  - *Indicateur réseau permanent* : Bannière discrète en haut d’écran en mode avion/hors ligne (*« Mode hors connexion actif — Bible, notes et contenus enregistrés disponibles »*) et masquage/blocage explicite des actions serveur obligatoires (TV en direct, envoi instantané de messages privés, enchères).
- **Identité Visuelle & Thèmes Material 3** :
  - *Palette officielle CHARITAS* : Bleu Royal Sanctuaire (`#1B365D`), Bleu Nuit Profond TV (`#04112B`), Bordeaux Liturgique (`#881337`), Or Lumière (`#F5B82E` / `#B45309`), Papier Chaleureux en thème clair (`#FAF7F2` / `#F3EFE6`) et Ardoise Profonde en thème sombre (`#0B111E`).
  - *Typographie & Accessibilité* : Hiérarchie éditoriale inspirée du web (*Serif* noble pour titres bibliques et liturgiques, *Sans-Serif* lisible pour l’interface, chiffres tabulaires pour montants et chapitres) + curseur natif de taille de texte biblique (`14sp` à `28sp`) avec support haut contraste et tailles d’écran compactes à tablettes.

---

## 3. Décisions Techniques Clés & Arbitrages

- **Couche Réseau Unique (Réutilisation 100 % Backend)** :
  - *Choix* : Client **OkHttp + Retrofit + Kotlinx Serialization** + client **WebSocket OkHttp** pointant directement sur les endpoints `/api/*` et `/ws` existants.
  - *Pourquoi* : Zéro duplication de logique métier ou de sécurité ; toute règle RLS PostgreSQL et permission RBAC reste souveraine côté serveur.
- **Persistance Locale & Offline-First (Room + FTS + DataStore)** :
  - *Choix* : Base **Room (SQLite)** multi-tables (catalogue biblique complet **LSG 1910** avec index **FTS4**, notes/signets/historique locaux, cache vitrine/posts/événements/conversations, file d’attente **Outbox** avec `clientMutationId` UUID) + **Proto/Preferences DataStore** chiffré via **Android Keystore** pour la session et les réglages de notifications.
  - *Pourquoi* : Requête instantanée (< 20 ms) en mode avion sur plus de 31 000 versets bibliques, synchronisation idempotente sans doublons au retour du réseau, et séparation stricte entre données publiques visiteur et données privées d’un utilisateur connecté (purgées automatiquement à la déconnexion).
- **Lecteur Multimédia & Streaming (AndroidX Media3)** :
  - *Choix* : **Media3 ExoPlayer (HLS)** pour CHARITAS TV, vidéos courtes sociales et sermons audio/vidéo avec gestion automatique de l’état hors ligne et téléchargement local autorisé via `DownloadManager` / Media3 Cache.
- **Planification Notifications (WorkManager + NotificationCompat)** :
  - *Choix* : `PeriodicWorkRequest` + planification journalière adaptable (`WorkManager`) respectant `POST_NOTIFICATIONS` (Android 13+), le mode Économie d’énergie / Doze (avec avertissement utilisateur transparent sur la précision système sans promesse à la seconde près).

---

## 4. Architecture Technique & Feuille de Route (8 Phases)

### 4.1 Architecture Globale du Projet Android

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CHARITAS ANDROID (Kotlin / Compose M3)               │
├─────────────────────────────────────────────────────────────────────────┤
│  Présentation (Compose UI + ViewModels Unidirectionnels)                │
│  ├── Splash & Onboarding Visiteur   ├── Bible Hors Ligne (LSG 1910)     │
│  ├── Accueil / Église / Solidarité  ├── CHARITAS TV (Media3 HLS)        │
│  ├── Réseau Social & Groupes        ├── Événements & Scanner QR         │
│  └── Messagerie & Notifications     └── Espace Admin (RBAC dynamique)   │
├─────────────────────────────────────────────────────────────────────────┤
│  Domaine & Synchronisation (Offline-First Engine)                       │
│  ├── SyncCoordinator (ConnectivityManager + WorkManager)                │
│  ├── OutboxQueue (UUID idempotent, résolution conflits serveur-gagne)   │
│  ├── SessionVault (Android Keystore + purge complète au logout)         │
│  └── ReminderScheduler (Verset du jour, Méditation, Événements)         │
├─────────────────────────────┬───────────────────────────────────────────┤
│  Stockage Local Sécurisé    │  Couche Réseau Sécurisée (TLS + Bearer)   │
│  ├── Room DB + FTS4 (Bible) │  ├── Retrofit REST (/api/*)               │
│  ├── Cache Paroisse / Flux  │  ├── OkHttp WebSocket (/ws)               │
│  └── Keystore EncryptedPref │  └── Credential Manager (Google Sign-In)  │
└─────────────────────────────┴───────────────────┬───────────────────────┘
                                                  │ HTTPS / WSS
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             BACKEND CHARITAS EXISTANT (Express + Cloud SQL RLS)         │
│   Auth HMAC/Firebase · 11 Rôles / 28 Permissions · 60 Tables · 54 RLS   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Plan de Réalisation Progressif (Phases 1 à 8)

1. **Phase 1 — Socle Gradle Android, Identité & Sécurité Session** :
   - Création du projet Gradle Kotlin DSL (`/android`), thème Material 3 CHARITAS clair/sombre, Splash Screen animé, gestionnaire d’état réseau temps réel (`NetworkMonitor`), coffre de session Android Keystore, écran de connexion/inscription & réinitialisation + point d’entrée Visiteur immédiat.
2. **Phase 2 — Intégration API & Fonctionnalités Communautaires** :
   - Écrans Accueil Paroissial, Réseau Social (fil, réactions, commentaires, sondages, vidéos courtes Media3), Groupes, Profils & Abonnements, Messagerie REST + WebSocket `/ws`, Événements + QR Code & Scanner organisateur, **CHARITAS TV (ExoPlayer HLS)**, Solidarité/Dons et Régie/Administration conditionnée aux permissions RBAC.
3. **Phase 3 — Module Biblique Complet Hors Connexion (LSG 1910)** :
   - Intégration des 66 livres AT/NT Domaine Public en asset + peuplement Room/FTS4, navigation Livre/Chapitre/Verset, recherche plein texte instantanée offline, surlignage/favoris, notes personnelles, historique de lecture, plans de lecture avec suivi de progression, Verset du jour, méditations hors ligne, taille de police réglable et partage natif Android (`Intent.ACTION_SEND`).
4. **Phase 4 — Notifications Locales & Synchronisées** :
   - Canaux de notifications distincts (*Verset du jour*, *Méditations*, *Événements*, *Communauté*), gestion de la permission `POST_NOTIFICATIONS` (API 33+), écran de préférences (heures personnalisables, activation par catégorie), tâches `WorkManager` et synchronisation des notifications serveur dès connexion rétablie.
5. **Phase 5 — Moteur Offline-First & File d’Attente (*Outbox*)** :
   - Cache lecture multi-modules, file d’attente transactionnelle pour actions compatibles hors connexion (notes/favoris/progression/brouillons de commentaires ou publications), badge d’état *« En attente d’envoi »* (jamais *« Envoyé »* avant confirmation serveur HTTP `2xx`), déduplication et stratégie de résolution de conflits.
6. **Phase 6 — Expérience Visiteur Sans Compte** :
   - Parcours complet visiteur sur Bible, Verset du jour, méditations et vidéos mises en cache, infos publiques de l’église Saint Louis Roi d’Ebimpé, événements et actions de solidarité publics, avec modale d’authentification contextuelle uniquement sur actions privées.
7. **Phase 7 — Durcissement Sécurité & Protection des Données** :
   - Aucun secret ou clé API en dur dans l’APK (`BuildConfig` injecté), obfuscation R8/ProGuard, désactivation `allowBackup` pour données sensibles (`dataExtractionRules`), vérification RBAC UI + serveur, purge des caches privés (journal, messages, dons, bénéficiaires) à la déconnexion.
8. **Phase 8 — Tests, CI GitHub Actions & Documentation Complète** :
   - Tests unitaires JVM (Repository offline, Outbox, Sync, Recherche FTS Bible, Validation RBAC) exécutés, tests d’instrumentation UI Compose définis, pipeline GitHub Actions Android (`.github/workflows/android-build.yml`) produisant APK de test & AAB de publication dès exécution sur runner JDK 17/Android SDK, et guide complet d’exploitation/API.
