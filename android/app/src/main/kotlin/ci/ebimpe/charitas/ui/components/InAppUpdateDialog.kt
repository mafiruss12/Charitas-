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
import androidx.compose.ui.Modifier
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
                if (info.forceUpdate) "Mise à jour obligatoire"
                else "Nouvelle version disponible"
            )
        },
        text = {
            Column {
                Text(
                    "Charitas ${info.versionName} (code ${info.versionCode}) est disponible.\n" +
                        "Version installée : ${InAppUpdateChecker.currentVersionName()} " +
                        "(${InAppUpdateChecker.currentVersionCode()})."
                )
                if (info.releaseNotes.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(info.releaseNotes, style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "La mise à jour s'installe sans passer par le Play Store. " +
                        "Autorisez l'installation depuis cette source si Android le demande.",
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
                Text("Mettre à jour")
            }
        },
        dismissButton = {
            if (!info.forceUpdate) {
                TextButton(onClick = onDismiss) { Text("Plus tard") }
            }
        }
    )
}
