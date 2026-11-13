package ci.ebimpe.charitas.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Handshake
import androidx.compose.material.icons.rounded.PlayCircle
import androidx.compose.material.icons.rounded.QrCode2
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Radio
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.core.model.CharitasPermissions
import ci.ebimpe.charitas.core.model.ChurchEventDto
import ci.ebimpe.charitas.core.model.MediaItemDto
import ci.ebimpe.charitas.core.model.PublicSolidarityResponseDto
import ci.ebimpe.charitas.core.network.QrCheckinRequest
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.ui.components.CharitasMediaPlayer
import ci.ebimpe.charitas.ui.components.QrTicketCard
import ci.ebimpe.charitas.ui.theme.CharitasAmber
import ci.ebimpe.charitas.ui.theme.CharitasBurgundy
import ci.ebimpe.charitas.ui.theme.CharitasDeepNavy
import ci.ebimpe.charitas.ui.theme.CharitasGold
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Top Harmonized Parish Banner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(CharitasDeepNavy, CharitasRoyalNavy)
                    )
                )
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_charitas_crest),
                        contentDescription = "Logo CHARITAS",
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "ÉVÉNEMENTS & SOLIDARITÉ",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "Actions caritatives & Billetterie QR Ebimpé",
                            style = MaterialTheme.typography.labelSmall,
                            color = CharitasGold,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                IconButton(onClick = { scope.launch { reload() } }) {
                    Icon(
                        Icons.Rounded.Refresh,
                        contentDescription = "Actualiser",
                        tint = Color.White
                    )
                }
            }
        }

        // Sub-Navigation Tabs
        TabRow(
            selectedTabIndex = tabIndex,
            containerColor = CharitasDeepNavy,
            contentColor = CharitasGold
        ) {
            Tab(
                selected = tabIndex == 0,
                onClick = { tabIndex = 0 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.CalendarMonth, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Événements & QR", fontWeight = FontWeight.SemiBold)
                    }
                },
                selectedContentColor = CharitasGold,
                unselectedContentColor = Color.White.copy(alpha = 0.7f)
            )
            Tab(
                selected = tabIndex == 1,
                onClick = { tabIndex = 1 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.VolunteerActivism, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Solidarité", fontWeight = FontWeight.SemiBold)
                    }
                },
                selectedContentColor = CharitasGold,
                unselectedContentColor = Color.White.copy(alpha = 0.7f)
            )
            Tab(
                selected = tabIndex == 2,
                onClick = { tabIndex = 2 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.PlayCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Replays", fontWeight = FontWeight.SemiBold)
                    }
                },
                selectedContentColor = CharitasGold,
                unselectedContentColor = Color.White.copy(alpha = 0.7f)
            )
        }

        when (tabIndex) {
            0 -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    feedback?.let { item { Text(it, style = MaterialTheme.typography.labelMedium) } }
                    items(events, key = { it.id }) { ev ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        ev.title,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = CharitasRoyalNavy
                                    )
                                    if (ev.isLive) {
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = Color(0xFFDC2626)
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Icon(Icons.Rounded.Radio, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("EN DIRECT", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }

                                Text(
                                    "${ev.startsAt} · ${ev.location ?: "Sanctuaire d’Ebimpé"}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                ev.description?.let {
                                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text(
                                    "${ev.registrationsCount} inscrit(s) · ${ev.checkedInCount} présent(s)",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.secondary
                                )

                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.padding(top = 4.dp)
                                ) {
                                    if (currentUser == null) {
                                        OutlinedButton(
                                            onClick = onOpenAuth,
                                            shape = RoundedCornerShape(50)
                                        ) { Text("Se connecter pour s'inscrire") }
                                    } else if (ev.myRegistration == null) {
                                        Button(
                                            enabled = isOnline,
                                            onClick = {
                                                scope.launch {
                                                    val res = runCatching { container.apiService.registerForEvent(churchId, ev.id) }.getOrNull()
                                                    feedback = if (res?.isSuccessful == true) "Inscription confirmée !" else "Inscription impossible."
                                                    reload()
                                                }
                                            },
                                            shape = RoundedCornerShape(50),
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = CharitasGold,
                                                contentColor = CharitasDeepNavy
                                            )
                                        ) { Text("S'inscrire (Billet QR)", fontWeight = FontWeight.Bold) }
                                    } else {
                                        OutlinedButton(
                                            onClick = { selectedQrEvent = ev },
                                            shape = RoundedCornerShape(50)
                                        ) {
                                            Icon(Icons.Rounded.QrCode2, contentDescription = null, tint = CharitasRoyalNavy)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("Mon billet QR", fontWeight = FontWeight.Bold)
                                        }
                                    }
                                    if (canManageEvents) {
                                        OutlinedButton(
                                            onClick = { checkinTargetEvent = ev },
                                            shape = RoundedCornerShape(50)
                                        ) {
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
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    item {
                        Text(
                            "Campagnes de dons & transparence",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = CharitasRoyalNavy
                        )
                    }
                    items(data?.campaigns.orEmpty(), key = { "camp_${it.id}" }) { camp ->
                        val ratio = if (camp.goalAmount > 0) (camp.collectedAmount.toFloat() / camp.goalAmount.toFloat()).coerceIn(0f, 1f) else 0f
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(camp.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                                camp.description?.let {
                                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                LinearProgressIndicator(
                                    progress = { ratio },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(4.dp)),
                                    color = CharitasGold,
                                    trackColor = CharitasRoyalNavy.copy(alpha = 0.15f)
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        "${camp.collectedAmount} / ${camp.goalAmount} ${camp.currency}",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = CharitasRoyalNavy
                                    )
                                    Text(
                                        "${(ratio * 100).toInt()}% réalisé",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = CharitasBurgundy,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "Rapports d'intervention sociale",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = CharitasRoyalNavy
                        )
                    }
                    items(data?.reports.orEmpty(), key = { "rep_${it.id}" }) { rep ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(rep.title, fontWeight = FontWeight.Bold)
                                Text(rep.summary, style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    "${rep.beneficiariesHelpedCount} foyer(s) soutenu(s) · Publié le ${rep.publishedDate}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.secondary
                                )
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "Missions bénévoles ouvertes",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = CharitasRoyalNavy
                        )
                    }
                    items(data?.volunteerMissions.orEmpty(), key = { "vol_${it.id}" }) { mission ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(CharitasRoyalNavy.copy(alpha = 0.1f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Rounded.VolunteerActivism, contentDescription = null, tint = CharitasRoyalNavy)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(mission.missionTitle, fontWeight = FontWeight.Bold)
                                    mission.roleDescription?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                    Text(
                                        "Date : ${mission.scheduledDate} · Statut : ${mission.status}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.secondary
                                    )
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
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(18.dp),
                                colors = CardDefaults.cardColors(containerColor = CharitasDeepNavy),
                                border = androidx.compose.foundation.BorderStroke(1.5.dp, CharitasGold)
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    CharitasMediaPlayer(
                                        streamUrl = playing.mediaUrl,
                                        title = playing.title,
                                        isOnline = isOnline,
                                        showInfoFooter = true
                                    )
                                }
                            }
                        }
                    }
                    items(mediaItems, key = { it.id }) { m ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            onClick = { activeMedia = m }
                        ) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Rounded.PlayCircle, contentDescription = null, tint = CharitasRoyalNavy, modifier = Modifier.size(32.dp))
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(m.title, fontWeight = FontWeight.Bold)
                                    m.speakerName?.let { Text(it, style = MaterialTheme.typography.labelMedium) }
                                    m.description?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                }
                                Text(
                                    m.durationLabel ?: m.mediaType.uppercase(),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = CharitasBurgundy,
                                    fontWeight = FontWeight.Bold
                                )
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
                        label = { Text("Code QR (CHARITAS-EVT-...)") },
                        modifier = Modifier.fillMaxWidth()
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
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CharitasGold, contentColor = CharitasDeepNavy)
                ) { Text("Valider", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { checkinTargetEvent = null }) { Text("Fermer") }
            }
        )
    }
}
