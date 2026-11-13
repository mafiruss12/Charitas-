# Correctifs CI / Android (mission restante)

## Diagnostic (2026-11-13)

| Pipeline | Cause de l'echec |
|----------|------------------|
| `CI — Build & Typecheck` | `npm ci` exige un `package-lock.json` absent (seul `bun.lock` est present) |
| `Android CI` | Pas d'installation Android SDK / platform 35 avant `gradle testDebugUnitTest` |

## Correctifs prets

Les fichiers corriges sont dans ce dossier :

- `ops/github-workflows/ci.yml`
- `ops/github-workflows/android-build.yml`

### Appliquer (2 options)

**A. Copier manuellement sur GitHub**

1. Ouvre `.github/workflows/ci.yml` → remplace par le contenu de `ops/github-workflows/ci.yml`
2. Ouvre `.github/workflows/android-build.yml` → remplace par le contenu de `ops/github-workflows/android-build.yml`
3. Commit sur `main`
4. Actions → *Android CI* → *Run workflow*

**B. Token avec scope `workflow`**

Un PAT classique avec scopes `repo` **et** `workflow` permet a l'agent de pousser directement dans `.github/workflows/`.

## Apres succes Android

Artifacts telechargeables :

- `charitas-ebimpe-debug-apk`
- `charitas-ebimpe-release-aab` (si le bundle release reussit)

## Build local (Android Studio)

```bash
cd android
# JDK 17 + Android SDK 35
gradle assembleDebug
# APK: app/build/outputs/apk/debug/
```
