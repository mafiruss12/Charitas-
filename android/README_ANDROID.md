# CHARITAS — Application Mobile Officielle Android
**Église Saint Louis Roi d’Ebimpé**

Application Android native développée en **Kotlin**, **Jetpack Compose**, **Material 3**, architecture modulaire propre et stratégie **Offline-First**, connectée au backend Express / PostgreSQL existant de CHARITAS.

---

## 1. Architecture Modulaire (`/android`)

- `:core:model` — DTOs Kotlinx Serialization synchronisés avec les routes `/api/*`, matrice RBAC (11 rôles officiels, 28 permissions), modèles Outbox.
- `:core:security` — Stockage chiffré Android Keystore (`EncryptedSharedPreferences` AES256-GCM / AES256-SIV) pour le jeton Bearer, identifiant utilisateur, `activeChurchId`, préférences DataStore (thème clair/sombre/système, taille police Bible, horaires de rappels).
- `:core:database` — Base locale Room + SQLite **FTS4** :
  - Bible complète domaine public **La Bible Augustin Crampon 1923** (`73 livres` AT + NT, `35 610 versets`),
  - Signets, notes personnelles, historique des chapitres lus,
  - Plans de lecture et méditations téléchargés hors ligne,
  - Cache JSON strictement cloisonné (`public:*` vs `isPrivateUserScope = 1` purgé à la déconnexion),
  - File **Outbox** avec `clientMutationId` UUID.
- `:core:network` — Client Retrofit + OkHttp (`TokenProvider` dynamique), `NetworkMonitor` (`ConnectivityManager`), client WebSocket `wss://.../ws?token=...` (`subscribe:church`).
- `:app` — Interface Material 3 (Splash, Accueil public, Bible hors ligne, Réseau social + Groupes, CHARITAS TV Media3 HLS, Événements + QR Code ZXing + Solidarité + Replays, Messagerie + Notifications, Administration RBAC, Profil/Paramètres/Rappels WorkManager).

---

## 2. Prérequis & Installation

- **JDK** : Version 17 (Temurin ou Oracle JDK 17)
- **Android Studio** : Ladybug (2024.2+) ou plus récent
- **Android SDK** : `compileSdk = 35`, `targetSdk = 35`, `minSdk = 24`

### Configuration des URLs backend (`android/gradle.properties`)

```properties
CHARITAS_API_BASE_URL=https://ais-pre-me5vci35n2h2uqqtli4572-274830859723.europe-west1.run.app
CHARITAS_DEBUG_API_BASE_URL=https://ais-dev-me5vci35n2h2uqqtli4572-274830859723.europe-west1.run.app
```

Aucune clé secrète, mot de passe ou jeton n'est intégré dans le code source Android.

---

## 3. Commandes de compilation APK / AAB & Tests

> **Note importante :** Ce bac à sable Linux ne contient pas de JDK, Gradle ni Android SDK. La compilation binaire APK / AAB doit être exécutée dans **Android Studio** ou via le workflow GitHub Actions `.github/workflows/android-build.yml`.

```bash
cd android

# Exécuter les tests unitaires Kotlin + FTS4
gradle testDebugUnitTest

# Générer l'APK de test (debug)
gradle assembleDebug
# Sortie : app/build/outputs/apk/debug/app-debug.apk

# Générer l'Android App Bundle Play Store (release avec R8 / shrinkResources)
gradle bundleRelease
# Sortie : app/build/outputs/bundle/release/app-release.aab
```

### Signature Play Store (Release)
1. Créez un keystore de signature sécurisé (`keytool -genkey -v -keystore charitas-release.jks ...`).
2. Ne commitez jamais le `.jks` ni ses mots de passe dans Git ; passez-les via variables d'environnement CI (`SIGNING_KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) ou configurez `signingConfigs.release` dans `app/build.gradle.kts` lors de la publication.

---

## 4. Fonctionnement Hors Connexion & Intégrité

- **Bible Crampon 1923 (73 livres)** : 100 % embarquée (`assets/bible_crampon_1923.json`), indexée dans SQLite FTS4 au premier lancement.
- **Mode Visiteur sans inscription** : accès immédiat à l'Accueil, Bible complète, Verset du jour, Méditations téléchargées, Plans de lecture, CHARITAS TV, Événements, Dons/Solidarité, Replays et formulaire de contact paroissial.
- **Outbox Offline-First** : lorsqu'un membre crée un post, un commentaire, une réaction ou envoie un message hors ligne, l'élément reste marqué **« En attente d'envoi — non confirmé par le serveur »** jusqu'à réception d'un HTTP 2xx. En cas d'erreur 4xx, l'action passe en statut `FAILED` avec le message serveur réel.
- **Notifications locales** : `WorkManager` + `NotificationCompat` (4 canaux Android), autorisation explicite `POST_NOTIFICATIONS` sous Android 13+, livraison adaptative respectant l'économie d'énergie Doze.

---

## 5. Sécurité & Confidentialité des Données

- Chiffrement matériel Android Keystore via `EncryptedSharedPreferences` (`MasterKey.KeyScheme.AES256_GCM`).
- `android:allowBackup="false"` et `data_extraction_rules.xml` bloquant la fuite du coffre-fort sur sauvegardes cloud/ADB.
- `network_security_config.xml` imposant **HTTPS strict** en production (`cleartextTrafficPermitted="false"`).
- **Purge immédiate** : `repository.logout()` déconnecte le WebSocket, supprime le jeton Keystore, vide la file Outbox et efface tous les caches SQLite marqués `isPrivateUserScope = 1`.
- **Données humanitaires sensibles** : aucun dossier nominatif complet de bénéficiaire n'est persisté hors ligne.

---

## 6. Guide d'évolution & Maintenance

- Pour ajouter un nouvel endpoint REST : ajouter le DTO dans `:core:model/ApiModels.kt`, déclarer la signature Retrofit dans `:core:network/CharitasApiService.kt`, puis l'exposer via `CharitasRepository`.
- Toute évolution du schéma Room (`Entities.kt`) doit incrémenter la `version` de `CharitasDatabase` et fournir une `Migration` explicite.
