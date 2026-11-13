# Mises à jour in-app (Android Charitas)

## Fonctionnement

1. Au démarrage (après le splash) et depuis **Paramètres → Vérifier les mises à jour**, l'app lit :
   `https://raw.githubusercontent.com/mafiruss12/Charitas-/main/public/app-version.json`
2. Si `versionCode` distant **>** `BuildConfig.VERSION_CODE`, une boîte de dialogue propose la mise à jour.
3. **Mettre à jour** :
   - télécharge l'APK (`apkUrl`) via le gestionnaire de téléchargements Android, ou
   - ouvre `pageUrl` (page Releases GitHub) si le lien APK direct est indisponible.
4. L'utilisateur autorise l'installation depuis Charitas si Android le demande (`REQUEST_INSTALL_PACKAGES`).

## Publier une nouvelle version

1. Incrémente dans `android/app/build.gradle.kts` :
   - `versionCode` (entier, obligatoire)
   - `versionName` (ex. `"1.0.1"`)
2. Mets à jour `public/app-version.json` :
   - mêmes `versionCode` / `versionName`
   - `releaseNotes` (texte affiché)
   - `forceUpdate: true` si la version minimale doit être imposée
   - `apkUrl` : lien **direct** vers le fichier `.apk` (Release GitHub asset, CDN, etc.)
3. Build & publie l'APK (Actions Android ou Android Studio).
4. Crée une **GitHub Release** et attache l'APK nommé comme dans `apkUrl`, **ou** héberge l'APK ailleurs et mets le lien HTTPS.

## Force update

Si `forceUpdate: true` **ou** si `versionCode` installé `< minSupportedVersionCode`, le bouton « Plus tard » est masqué.

## Play Store (option futur)

Quand l'app sera sur le Play Store, on pourra ajouter l'API officielle *Play In-App Updates* en parallèle de ce mécanisme (sideload / église).
