package ci.ebimpe.charitas.update

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun InAppUpdateDialog(
    info: AppVersionInfo,
    onDismiss: () -> Unit,
    onUpdate: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var downloading by remember { mutableStateOf(false) }
    var progress by remember { mutableIntStateOf(0) }
    var downloadedApk by remember { mutableStateOf<File?>(null) }
    var needsInstallPermission by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun launchInstallerOrRequestPerm(apkFile: File) {
        if (!InAppUpdateChecker.canRequestPackageInstalls(context)) {
            needsInstallPermission = true
            InAppUpdateChecker.openInstallPermissionSettings(context)
        } else {
            needsInstallPermission = false
            val launched = InAppUpdateChecker.installDownloadedApk(context, apkFile)
            if (!launched) {
                errorMessage = "Impossible d’ouvrir l’installateur Android. Utilisez le bouton Navigateur."
            }
        }
    }

    fun startInAppDownload() {
        val targetUrl = info.apkUrl ?: InAppUpdateChecker.FALLBACK_LATEST_APK_URL
        downloading = true
        progress = 0
        errorMessage = null
        scope.launch {
            val res = InAppUpdateChecker.downloadApkWithProgress(
                context = context,
                apkUrl = targetUrl,
                versionCode = info.versionCode,
                onProgress = { pct -> progress = pct }
            )
            downloading = false
            res.onSuccess { file ->
                downloadedApk = file
                launchInstallerOrRequestPerm(file)
            }.onFailure { err ->
                errorMessage = err.message ?: "Erreur lors du téléchargement de l’APK."
            }
        }
    }

    AlertDialog(
        onDismissRequest = { if (!info.forceUpdate && !downloading) onDismiss() },
        title = {
            Text(
                if (info.forceUpdate) "Mise à jour obligatoire"
                else "Nouvelle version disponible"
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Charitas ${info.versionName} (code ${info.versionCode}) est disponible. " +
                        "Version installée : ${InAppUpdateChecker.currentVersionName()} " +
                        "(${InAppUpdateChecker.currentVersionCode()})."
                )
                if (info.releaseNotes.isNotBlank()) {
                    Text(
                        text = info.releaseNotes,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (downloading) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (progress > 0) {
                            LinearProgressIndicator(
                                progress = { progress / 100f },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Text(
                                text = "Téléchargement de l’APK : $progress %",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold
                            )
                        } else {
                            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                            Text(
                                text = "Connexion et téléchargement en cours…",
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }

                if (needsInstallPermission && downloadedApk != null) {
                    Text(
                        text = "APK prêt ! Autorisez « Installer des applications inconnues » pour CHARITAS dans les paramètres ouverts, puis appuyez sur « Installer maintenant ».",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                errorMessage?.let { msg ->
                    Text(
                        text = msg,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                OutlinedButton(
                    enabled = !downloading,
                    onClick = { InAppUpdateChecker.openPageOrApk(context, info) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Télécharger via le navigateur")
                }
            }
        },
        confirmButton = {
            val readyApk = downloadedApk
            if (readyApk != null && readyApk.exists()) {
                Button(
                    enabled = !downloading,
                    onClick = { launchInstallerOrRequestPerm(readyApk) }
                ) {
                    Text("Installer maintenant")
                }
            } else {
                Button(
                    enabled = !downloading,
                    onClick = {
                        onUpdate?.invoke()
                        startInAppDownload()
                    }
                ) {
                    Text(if (downloading) "Téléchargement…" else "Mettre à jour")
                }
            }
        },
        dismissButton = {
            if (!info.forceUpdate && !downloading) {
                TextButton(onClick = onDismiss) { Text("Plus tard") }
            }
        }
    )
}
