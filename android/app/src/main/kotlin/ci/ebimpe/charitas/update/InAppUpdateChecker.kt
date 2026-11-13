package ci.ebimpe.charitas.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
import java.net.HttpURLConnection
import java.net.URL

/**
 * Manifest distant de version (hébergé sur le site / GitHub raw / CDN).
 * Comparé à [BuildConfig.VERSION_CODE] pour décider d'une mise à jour in-app.
 */
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

    /** URL par défaut : fichier versionné dans le dépôt (raw GitHub). */
    const val DEFAULT_MANIFEST_URL =
        "https://raw.githubusercontent.com/mafiruss12/Charitas-/main/public/app-version.json"

    fun currentVersionCode(): Int = BuildConfig.VERSION_CODE
    fun currentVersionName(): String = BuildConfig.VERSION_NAME

    suspend fun check(manifestUrl: String = DEFAULT_MANIFEST_URL): UpdateCheckResult =
        withContext(Dispatchers.IO) {
            try {
                val info = fetchManifest(manifestUrl)
                val current = currentVersionCode()
                when {
                    current < info.minSupportedVersionCode ||
                        (info.forceUpdate && current < info.versionCode) ->
                        UpdateCheckResult.Available(info.copy(forceUpdate = true))
                    current < info.versionCode ->
                        UpdateCheckResult.Available(info)
                    else -> UpdateCheckResult.UpToDate
                }
            } catch (e: Exception) {
                UpdateCheckResult.Error(e.message ?: "Impossible de vérifier les mises à jour.")
            }
        }

    private fun fetchManifest(url: String): AppVersionInfo {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 12_000
            readTimeout = 15_000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) error("Manifest HTTP $code")
            val body = conn.inputStream.bufferedReader().use { it.readText() }
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

    /**
     * Lance le téléchargement de l'APK via [DownloadManager].
     * @return id DownloadManager ou null si URL absente
     */
    fun enqueueApkDownload(context: Context, info: AppVersionInfo): Long? {
        val url = info.apkUrl ?: return null
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("Charitas ${info.versionName}")
            .setDescription("Téléchargement de la mise à jour…")
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
        val target = info.apkUrl ?: info.pageUrl ?: return
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(target)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun installDownloadedApk(context: Context, apkFile: File) {
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
    }
}
