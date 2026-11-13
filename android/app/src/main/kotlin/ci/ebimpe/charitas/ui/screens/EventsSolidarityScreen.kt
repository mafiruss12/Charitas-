package ci.ebimpe.charitas.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayCircle
import androidx.compose.material.icons.rounded.QrCode2
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.core.model.CharitasPermissions
import ci.ebimpe.charitas.core.model.ChurchEventDto
import ci.ebimpe.charitas.core.model.MediaItemDto
import ci.ebimpe.charitas.core.model.PublicSolidarityResponseDto
import ci.ebimpe.charitas.core.network.QrCheckinRequest
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.ui.components.CharitasMediaPlayer
import ci.ebimpe.charitas.ui.components.QrTicketCard
import kotlinx.coroutines.launch

@Composable
fun EventsSolidarityScreen(
    container: CharitasAppContainer,
    onOpenAuth: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val churchId by container.repository.activeChurchId.collectAsState()
    val currentUser by container.repository.currentUser.collectAsState()
    val isOnline by container.repository.isOnline.collectAsState()

    var tabIndex by remember { mutableIntStateOf(0) }
    var events by remember { mutableStateOf<List<ChurchEventDto>>(emptyList()) }
    var solidarity by remember { mutableStateOf<PublicSolidarityResponseDto?>(null) }
    var mediaItems by remember { mutableStateOf<List<MediaItemDto>>(emptyList()) }
    var activeMedia by remember { mutableStateOf<MediaItemDto?>(null) }
    var selectedQrEvent by remember { mutableStateOf<ChurchEventDto?>(null) }
    var checkinTargetEvent by remember { mutableStateOf<ChurchEventDto?>(null) }
    var feedback by remember { mutableStateOf<String?>(null) }

    val canManageEvents = currentUser != null && container.repository.hasPermission(CharitasPermissions.EVENTS_MANAGE)

    suspend fun reload() {
        when (val evRes = container.repository.loadEvents(churchId)) {
            is RepoResult.Success -> events = evRes.data.events
            is RepoResult.Error -> feedback = evRes.message
        }
        when (val solRes = container.repository.loadPublicSolidarity(churchId)) {
            is RepoResult.Success -> solidarity = solRes.data
            is RepoResult.Error -> Unit
        }
        when (val medRes = container.repository.loadPublicMedia(churchId)) {
            is RepoResult.Success -> mediaItems = medRes.data.media
            is RepoResult.Error -> Unit
        }
    }

    LaunchedEffect(churchId, currentUser, isOnline) {
        reload()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = tabIndex) {
            Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }, text = { Text("Événements & QR") })
            Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }, text = { Text("Solidarité") })
            Tab(selected = tabIndex == 2, onClick = { tabIndex = 2 }, text = { Text("Replays") })
        }

        when (tabIndex) {
            0 -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    feedback?.let { item { Text(it, style = MaterialTheme.typography.labelMedium) } }
                    items(events, key = { it.id }) { ev ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(ev.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text("${ev.startsAt} · ${ev.location ?: "Paroisse d’Ebimpé"}", style = MaterialTheme.typography.bodyMedium)
                                ev.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                Text("${ev.registrationsCount} inscrit(s) · ${ev.checkedInCount} présent(s)", style = MaterialTheme.typography.labelMedium)

                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (currentUser == null) {
                                        OutlinedButton(onClick = onOpenAuth) { Text("Se connecter pour s'inscrire") }
                                    } else if (ev.myRegistration == null) {
                                        Button(
                                            enabled = isOnline,
                                            onClick = {
                                                scope.launch {
                                                    val res = runCatching { container.apiService.registerForEvent(churchId, ev.id) }.getOrNull()
                                                    feedback = if (res?.isSuccessful == true) "Inscription confirmée !" else "Inscription impossible."
                                                    reload()
                                                }
                                            }
                                        ) { Text("S'inscrire") }
                                    } else {
                                        OutlinedButton(onClick = { selectedQrEvent = ev }) {
                                            Icon(Icons.Rounded.QrCode2, contentDescription = null)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("Mon billet QR")
                                        }
                                    }
                                    if (canManageEvents) {
                                        OutlinedButton(onClick = { checkinTargetEvent = ev }) {
                                            Icon(Icons.Rounded.QrCodeScanner, contentDescription = null)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Valider QR")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            1 -> {
                val data = solidarity
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        Text("Campagnes de dons & transparence", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    items(data?.campaigns.orEmpty(), key = { "camp_${it.id}" }) { camp ->
                        val ratio = if (camp.goalAmount > 0) (camp.collectedAmount.toFloat() / camp.goalAmount.toFloat()).coerceIn(0f, 1f) else 0f
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(camp.title, fontWeight = FontWeight.Bold)
                                camp.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                LinearProgressIndicator(progress = { ratio }, modifier = Modifier.fillMaxWidth())
                                Text("${camp.collectedAmount} / ${camp.goalAmount} ${camp.currency}", style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Rapports d'intervention sociale", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    items(data?.reports.orEmpty(), key = { "rep_${it.id}" }) { rep ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(rep.title, fontWeight = FontWeight.Bold)
                                Text(rep.summary, style = MaterialTheme.typography.bodyMedium)
                                Text("${rep.beneficiariesHelpedCount} foyer(s) soutenu(s) · ${rep.publishedDate}", style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Missions bénévoles ouvertes", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    items(data?.volunteerMissions.orEmpty(), key = { "vol_${it.id}" }) { mission ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Rounded.VolunteerActivism, contentDescription = null)
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(mission.missionTitle, fontWeight = FontWeight.Bold)
                                    mission.roleDescription?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                    Text("Date : ${mission.scheduledDate} · Statut : ${mission.status}", style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    }
                }
            }

            2 -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    activeMedia?.let { playing ->
                        item {
                            CharitasMediaPlayer(
                                streamUrl = playing.mediaUrl,
                                title = playing.title,
                                isOnline = isOnline
                            )
                        }
                    }
                    items(mediaItems, key = { it.id }) { m ->
                        Card(modifier = Modifier.fillMaxWidth(), onClick = { activeMedia = m }) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Rounded.PlayCircle, contentDescription = null)
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(m.title, fontWeight = FontWeight.Bold)
                                    m.speakerName?.let { Text(it, style = MaterialTheme.typography.labelMedium) }
                                    m.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                }
                                Text(m.durationLabel ?: m.mediaType.uppercase(), style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                }
            }
        }
    }

    selectedQrEvent?.let { ev ->
        AlertDialog(
            onDismissRequest = { selectedQrEvent = null },
            title = { Text("Billet d'accès paroissial") },
            text = {
                QrTicketCard(
                    payload = ev.myRegistration?.qrPayload ?: "",
                    eventTitle = ev.title
                )
            },
            confirmButton = {
                TextButton(onClick = { selectedQrEvent = null }) { Text("Fermer") }
            }
        )
    }

    checkinTargetEvent?.let { ev ->
        var payloadInput by remember { mutableStateOf("") }
        var scanResult by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { checkinTargetEvent = null },
            title = { Text("Validation QR · ${ev.title}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Saisissez ou collez le code QR du billet participant :")
                    OutlinedTextField(
                        value = payloadInput,
                        onValueChange = { payloadInput = it },
                        label = { Text("Code QR (CHARITAS-EVT-...)") }
                    )
                    scanResult?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                }
            },
            confirmButton = {
                Button(
                    enabled = payloadInput.isNotBlank() && isOnline,
                    onClick = {
                        scope.launch {
                            val res = runCatching {
                                container.apiService.checkinEventQr(churchId, ev.id, QrCheckinRequest(payloadInput.trim()))
                            }.getOrNull()
                            scanResult = if (res?.isSuccessful == true) {
                                res.body()?.message ?: "Présence validée !"
                            } else {
                                "Code QR invalide ou non autorisé."
                            }
                            reload()
                        }
                    }
                ) { Text("Valider") }
            },
            dismissButton = {
                TextButton(onClick = { checkinTargetEvent = null }) { Text("Fermer") }
            }
        )
    }
}
