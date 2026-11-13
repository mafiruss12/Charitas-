package ci.ebimpe.charitas.update

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

@Composable
fun InAppUpdateDialog(
    info: AppVersionInfo,
    onDismiss: () -> Unit,
    onUpdate: () -> Unit
) {
    val context = LocalContext.current
    AlertDialog(
        onDismissRequest = { if (!info.forceUpdate) onDismiss() },
        title = {
            Text(
                if (info.forceUpdate) "Mise a jour obligatoire"
                else "Nouvelle version disponible"
            )
        },
        text = {
            Column {
                Text(
                    "Charitas " + info.versionName + " (code " + info.versionCode + ") est disponible. " +
                        "Version installee : " + InAppUpdateChecker.currentVersionName() +
                        " (" + InAppUpdateChecker.currentVersionCode().toString() + ")."
                )
                if (info.releaseNotes.isNotBlank()) {
                    Spacer(androidx.compose.ui.modifier.Modifier.height(8.dp))
                    Text(info.releaseNotes, style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(androidx.compose.ui.modifier.Modifier.height(8.dp))
                Text(
                    "Telechargement via GitHub Releases.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        },
        confirmButton = {
            Button(onClick = {
                if (!InAppUpdateChecker.canRequestPackageInstalls(context)) {
                    InAppUpdateChecker.openInstallPermissionSettings(context)
                }
                onUpdate()
            }) {
                Text("Mettre a jour")
            }
        },
        dismissButton = {
            if (!info.forceUpdate) {
                TextButton(onClick = onDismiss) { Text("Plus tard") }
            }
        }
    )
}
