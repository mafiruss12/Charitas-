package ci.ebimpe.charitas.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.core.model.AuditLogDto
import ci.ebimpe.charitas.core.model.CharitasPermissions
import ci.ebimpe.charitas.core.model.CharitasRoles
import ci.ebimpe.charitas.core.model.ChurchMemberDto
import ci.ebimpe.charitas.core.network.UpdateChurchSettingsRequest
import kotlinx.coroutines.launch

@Composable
fun AdminChurchScreen(container: CharitasAppContainer) {
    val scope = rememberCoroutineScope()
    val churchId by container.repository.activeChurchId.collectAsState()
    val isOnline by container.repository.isOnline.collectAsState()
    val membership = container.repository.getCurrentMembership()

    val canBranding = container.repository.hasPermission(CharitasPermissions.CHURCH_BRANDING)
    val canViewMembers = container.repository.hasPermission(CharitasPermissions.MEMBERS_VIEW)
    val canViewAudit = container.repository.hasPermission(CharitasPermissions.AUDIT_VIEW)
    val canHumanitarian = container.repository.hasPermission(CharitasPermissions.HUMANITARIAN_MANAGE)

    var members by remember { mutableStateOf<List<ChurchMemberDto>>(emptyList()) }
    var auditLogs by remember { mutableStateOf<List<AuditLogDto>>(emptyList()) }
    var name by remember(membership) { mutableStateOf(membership?.churchName ?: "CHARITAS — Église Saint Louis Roi d’Ebimpé") }
    var primaryColor by remember(membership) { mutableStateOf(membership?.churchPrimaryColor ?: "#1B365D") }
    var accentColor by remember(membership) { mutableStateOf(membership?.churchAccentColor ?: "#881337") }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(churchId, isOnline) {
        if (!isOnline) return@LaunchedEffect
        if (canViewMembers) {
            runCatching { container.apiService.getMembers(churchId) }.getOrNull()?.body()?.let {
                members = it.members
            }
        }
        if (canViewAudit) {
            runCatching { container.apiService.getAuditLogs(churchId) }.getOrNull()?.body()?.let {
                auditLogs = it.logs
            }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Gouvernance & Administration Paroissiale",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Rôle actuel : ${CharitasRoles.labels[membership?.role] ?: membership?.role ?: "Visiteur"}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.secondary
            )
        }

        if (!canBranding && !canViewMembers && !canViewAudit && !canHumanitarian) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Aucun module d'administration n'est ouvert pour votre rôle actuel. Les autorisations sont contrôlées côté serveur.",
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }
            return@LazyColumn
        }

        if (canBranding) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Personnalisation de l'église", fontWeight = FontWeight.Bold)
                        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom de la paroisse") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = primaryColor, onValueChange = { primaryColor = it }, label = { Text("Couleur principale (#Hex)") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = accentColor, onValueChange = { accentColor = it }, label = { Text("Couleur d'accent (#Hex)") }, modifier = Modifier.fillMaxWidth())
                        Button(
                            enabled = isOnline,
                            onClick = {
                                scope.launch {
                                    val res = runCatching {
                                        container.apiService.updateChurchSettings(
                                            churchId,
                                            UpdateChurchSettingsRequest(
                                                name = name.trim(),
                                                primaryColor = primaryColor.trim(),
                                                accentColor = accentColor.trim()
                                            )
                                        )
                                    }.getOrNull()
                                    statusMessage = if (res?.isSuccessful == true) {
                                        container.repository.restoreSessionIfPresent()
                                        "Identité visuelle mise à jour."
                                    } else {
                                        "Mise à jour refusée ou hors ligne."
                                    }
                                }
                            }
                        ) { Text("Enregistrer la charte") }
                    }
                }
            }
        }

        statusMessage?.let {
            item { Text(it, color = MaterialTheme.colorScheme.primary) }
        }

        if (canHumanitarian) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Accès humanitaire autorisé : conformément à la politique de confidentialité CHARITAS, les dossiers nominatifs complets des bénéficiaires ne sont pas mis en cache sur l'appareil hors ligne.",
                        modifier = Modifier.padding(14.dp),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        if (canViewMembers) {
            item { Text("Annuaire des membres (${members.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            items(members.take(40), key = { it.membershipId }) { m ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(m.fullName, fontWeight = FontWeight.Bold)
                        Text("${CharitasRoles.labels[m.role] ?: m.role} · ${m.email}", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        if (canViewAudit) {
            item { Text("Journal d'audit récent", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            items(auditLogs.take(25), key = { it.id }) { log ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(log.action, fontWeight = FontWeight.SemiBold)
                        Text("${log.actorEmail ?: "Système"} · ${log.createdAt}", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}
