package ci.ebimpe.charitas.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import ci.ebimpe.charitas.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class AppVersionInfo(
    val versionCode: Int,
    val versionName: String,
    val forceUpdate: Boolean,
    val releaseNotes: String,
    val apkUrl: String?,
    val pageUrl: String?,
    val minSupportedVersionCode: Int = 1
)

sealed class UpdateCheckResult {
    data object UpToDate : UpdateCheckResult()
    data class Available(val info: AppVersionInfo) : UpdateCheckResult()
    data class Error(val message: String) : UpdateCheckResult()
}

object InAppUpdateChecker {

    const val DEFAULT_MANIFEST_URL =
        "https://raw.githubusercontent.com/mafiruss12/Charitas-/main/public/app-version.json"
    private const val GITHUB_RELEASES_API =
        "https://api.github.com/repos/mafiruss12/Charitas-/releases/latest"
    const val FALLBACK_LATEST_APK_URL =
        "https://github.com/mafiruss12/Charitas-/releases/latest/download/charitas-ebimpe.apk"
    const val FALLBACK_RELEASES_PAGE =
        "https://github.com/mafiruss12/Charitas-/releases/latest"

    fun currentVersionCode(): Int = BuildConfig.VERSION_CODE
    fun currentVersionName(): String = BuildConfig.VERSION_NAME

    suspend fun check(manifestUrl: String = DEFAULT_MANIFEST_URL): UpdateCheckResult =
        withContext(Dispatchers.IO) {
            try {
                val manifestCandidates = buildList {
                    val cacheBuster = "t=${System.currentTimeMillis()}"
                    val sep = if (manifestUrl.contains("?")) "&" else "?"
                    add("$manifestUrl$sep$cacheBuster")
                    if (BuildConfig.IS_BACKEND_CONFIGURED && BuildConfig.API_BASE_URL.startsWith("https://")) {
                        add("${BuildConfig.API_BASE_URL.trimEnd('/')}/app-version.json?$cacheBuster")
                    }
                }

                var manifestInfo: AppVersionInfo? = null
                for (candidateUrl in manifestCandidates) {
                    manifestInfo = runCatching { fetchManifest(candidateUrl) }.getOrNull()
                    if (manifestInfo != null && manifestInfo.versionCode > 0) break
                }

                // Query GitHub Releases latest to resolve the exact direct .apk asset URL
                val releaseInfo = runCatching { fetchLatestGithubRelease() }.getOrNull()

                val effectiveInfo = when {
                    manifestInfo != null && releaseInfo != null -> {
                        val bestApkUrl = releaseInfo.apkUrl ?: manifestInfo.apkUrl ?: FALLBACK_LATEST_APK_URL
                        val bestPageUrl = releaseInfo.pageUrl ?: manifestInfo.pageUrl ?: FALLBACK_RELEASES_PAGE
                        if (releaseInfo.versionCode > manifestInfo.versionCode) {
                            releaseInfo.copy(
                                forceUpdate = manifestInfo.forceUpdate,
                                minSupportedVersionCode = manifestInfo.minSupportedVersionCode,
                                apkUrl = bestApkUrl,
                                pageUrl = bestPageUrl
                            )
                        } else {
                            manifestInfo.copy(
                                apkUrl = bestApkUrl,
                                pageUrl = bestPageUrl
                            )
                        }
                    }
                    manifestInfo != null -> manifestInfo.copy(
                        apkUrl = manifestInfo.apkUrl ?: FALLBACK_LATEST_APK_URL,
                        pageUrl = manifestInfo.pageUrl ?: FALLBACK_RELEASES_PAGE
                    )
                    releaseInfo != null -> releaseInfo
                    else -> error("Aucune source de mise à jour joignable.")
                }

                val current = currentVersionCode()
                val currentName = currentVersionName()
                val updateRequired = current < effectiveInfo.minSupportedVersionCode ||
                    (effectiveInfo.forceUpdate && current < effectiveInfo.versionCode)
                val updateAvailable = current < effectiveInfo.versionCode ||
                    (effectiveInfo.versionCode == current && isNewerVersionName(effectiveInfo.versionName, currentName))

                when {
                    updateRequired -> UpdateCheckResult.Available(effectiveInfo.copy(forceUpdate = true))
                    updateAvailable -> UpdateCheckResult.Available(effectiveInfo)
                    else -> UpdateCheckResult.UpToDate
                }
            } catch (e: Exception) {
                val safeMsg = when {
                    e.message?.contains("<") == true -> "Manifest de mise à jour invalide."
                    else -> "Vérification impossible hors connexion ou serveur indisponible. Réessayez avec Internet."
                }
                UpdateCheckResult.Error(safeMsg)
            }
        }

    private fun isNewerVersionName(remote: String, local: String): Boolean {
        val rParts = remote.trim().removePrefix("v").split("-", ".")
            .mapNotNull { it.toIntOrNull() }
        val lParts = local.trim().removePrefix("v").split("-", ".")
            .mapNotNull { it.toIntOrNull() }
        val maxLen = maxOf(rParts.size, lParts.size)
        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val l = lParts.getOrElse(i) { 0 }
            if (r != l) return r > l
        }
        return false
    }

    private fun openConnectionFollowingRedirects(url: String, acceptHeader: String): HttpURLConnection {
        var currentUrl = url
        repeat(6) {
            val conn = (URL(currentUrl).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 25_000
                instanceFollowRedirects = false
                requestMethod = "GET"
                setRequestProperty("Accept", acceptHeader)
                setRequestProperty("Cache-Control", "no-cache")
                setRequestProperty("User-Agent", "Charitas-Android/${BuildConfig.VERSION_NAME}")
            }
            val code = conn.responseCode
            if (code in listOf(301, 302, 303, 307, 308)) {
                val location = conn.getHeaderField("Location")
                conn.disconnect()
                if (location.isNullOrBlank()) error("Redirection invalide ($code).")
                currentUrl = URL(URL(currentUrl), location).toString()
            } else {
                return conn
            }
        }
        error("Trop de redirections réseau.")
    }

    private fun fetchManifest(url: String): AppVersionInfo {
        val conn = openConnectionFollowingRedirects(url, "application/json")
        try {
            val code = conn.responseCode
            if (code !in 200..299) error("Manifest HTTP $code")
            val body = conn.inputStream.bufferedReader().use { it.readText() }.trim()
            if (body.startsWith("<")) {
                error("Réponse non-JSON reçue pour le manifest.")
            }
            val json = JSONObject(body)
            return AppVersionInfo(
                versionCode = json.optInt("versionCode", 0),
                versionName = json.optString("versionName", "?"),
                forceUpdate = json.optBoolean("forceUpdate", false),
                releaseNotes = json.optString("releaseNotes", ""),
                apkUrl = json.optString("apkUrl").takeIf { it.isNotBlank() },
                pageUrl = json.optString("pageUrl").takeIf { it.isNotBlank() },
                minSupportedVersionCode = json.optInt("minSupportedVersionCode", 1)
            )
        } finally {
            conn.disconnect()
        }
    }

    private fun fetchLatestGithubRelease(): AppVersionInfo? {
        val conn = openConnectionFollowingRedirects(GITHUB_RELEASES_API, "application/vnd.github+json")
        try {
            val code = conn.responseCode
            if (code !in 200..299) return null
            val body = conn.inputStream.bufferedReader().use { it.readText() }.trim()
            if (body.startsWith("<")) return null
            val json = JSONObject(body)
            val tagName = json.optString("tag_name", "").trim()
            val htmlUrl = json.optString("html_url").takeIf { it.isNotBlank() } ?: FALLBACK_RELEASES_PAGE
            val notes = json.optString("body", "").take(450)
            val assets = json.optJSONArray("assets")
            var releaseApkUrl: String? = null
            if (assets != null) {
                for (i in 0 until assets.length()) {
                    val asset = assets.optJSONObject(i) ?: continue
                    val name = asset.optString("name", "")
                    val dlUrl = asset.optString("browser_download_url", "")
                    if (name == "charitas-ebimpe.apk" && dlUrl.isNotBlank()) {
                        releaseApkUrl = dlUrl
                        break
                    }
                    if (name.endsWith(".apk") && !name.contains("debug") && dlUrl.isNotBlank()) {
                        releaseApkUrl = dlUrl
                    }
                }
            }
            val cleanedTag = tagName.removePrefix("v").substringBefore("-")
            val inferredCode = Regex("versionCode\\D+(\\d+)", RegexOption.IGNORE_CASE)
                .find(notes)
                ?.groupValues
                ?.getOrNull(1)
                ?.toIntOrNull()
                ?: 0

            return AppVersionInfo(
                versionCode = inferredCode,
                versionName = cleanedTag.ifBlank { "?" },
                forceUpdate = false,
                releaseNotes = notes,
                apkUrl = releaseApkUrl ?: FALLBACK_LATEST_APK_URL,
                pageUrl = htmlUrl,
                minSupportedVersionCode = 1
            )
        } finally {
            conn.disconnect()
        }
    }

    suspend fun downloadApkWithProgress(
        context: Context,
        apkUrl: String,
        versionCode: Int,
        onProgress: (Int) -> Unit
    ): Result<File> = withContext(Dispatchers.IO) {
        runCatching {
            val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
            updatesDir.listFiles()?.forEach { oldFile ->
                if (oldFile.name.endsWith(".apk")) oldFile.delete()
            }
            val targetFile = File(updatesDir, "charitas-ebimpe-$versionCode.apk")
            val tempFile = File(updatesDir, "charitas-ebimpe-$versionCode.apk.part")
            if (tempFile.exists()) tempFile.delete()

            val conn = openConnectionFollowingRedirects(apkUrl, "*/*")
            try {
                val code = conn.responseCode
                if (code !in 200..299) {
                    error("Téléchargement APK impossible (HTTP $code).")
                }
                val contentType = conn.contentType?.lowercase().orEmpty()
                if (contentType.contains("text/html")) {
                    error("Lien APK invalide (page HTML reçue).")
                }

                val totalBytes = conn.contentLengthLong
                var downloadedBytes = 0L
                var lastPct = -1

                conn.inputStream.use { input ->
                    FileOutputStream(tempFile).use { output ->
                        val buffer = ByteArray(16 * 1024)
                        while (true) {
                            val read = input.read(buffer)
                            if (read <= 0) break
                            output.write(buffer, 0, read)
                            downloadedBytes += read
                            if (totalBytes > 0) {
                                val pct = ((downloadedBytes * 100) / totalBytes).toInt().coerceIn(0, 100)
                                if (pct != lastPct) {
                                    lastPct = pct
                                    withContext(Dispatchers.Main) { onProgress(pct) }
                                }
                            }
                        }
                        output.flush()
                    }
                }
                if (tempFile.length() < 100_000L) {
                    error("Fichier APK téléchargé incomplet ou corrompu.")
                }
                if (targetFile.exists()) targetFile.delete()
                if (!tempFile.renameTo(targetFile)) {
                    tempFile.copyTo(targetFile, overwrite = true)
                    tempFile.delete()
                }
                withContext(Dispatchers.Main) { onProgress(100) }
                targetFile
            } finally {
                conn.disconnect()
            }
        }
    }

    fun canRequestPackageInstalls(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else true
    }

    fun openInstallPermissionSettings(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    fun enqueueApkDownload(context: Context, info: AppVersionInfo): Long? {
        val url = info.apkUrl ?: return null
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("Charitas ${info.versionName}")
            .setDescription("Téléchargement de la mise à jour CHARITAS…")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)
            .setDestinationInExternalFilesDir(
                context,
                Environment.DIRECTORY_DOWNLOADS,
                "charitas-update-${info.versionCode}.apk"
            )
        return dm.enqueue(request)
    }

    fun openPageOrApk(context: Context, info: AppVersionInfo) {
        val target = info.apkUrl ?: info.pageUrl ?: FALLBACK_RELEASES_PAGE
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(target)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun installDownloadedApk(context: Context, apkFile: File): Boolean {
        return runCatching {
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        }.getOrDefault(false)
    }
}
