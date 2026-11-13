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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.core.database.BibleVerseEntity
import ci.ebimpe.charitas.core.model.PublicShowcaseResponseDto
import ci.ebimpe.charitas.core.network.VisitorContactRequest
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.ui.theme.CharitasDeepNavy
import ci.ebimpe.charitas.ui.theme.CharitasGold
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    container: CharitasAppContainer,
    onOpenBible: () -> Unit,
    onOpenTv: () -> Unit,
    onOpenEvents: () -> Unit,
    onOpenAuth: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val churchId by container.repository.activeChurchId.collectAsState()
    val currentUser by container.repository.currentUser.collectAsState()
    val memberships by container.repository.memberships.collectAsState()
    val isOnline by container.repository.isOnline.collectAsState()

    var loading by remember { mutableStateOf(true) }
    var showcase by remember { mutableStateOf<PublicShowcaseResponseDto?>(null) }
    var fromCache by remember { mutableStateOf(false) }
    var offlineVerse by remember { mutableStateOf<BibleVerseEntity?>(null) }
    var showContactDialog by remember { mutableStateOf(false) }
    var feedbackMessage by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        loading = true
        offlineVerse = container.bibleImporter.getDeterministicOfflineDailyVerse()
        when (val res = container.repository.loadShowcase(churchId)) {
            is RepoResult.Success -> {
                showcase = res.data
                fromCache = res.fromCache
            }
            is RepoResult.Error -> {
                feedbackMessage = res.message
            }
        }
        container.repository.syncSpiritualForVisitorAndMember(churchId)
        loading = false
    }

    LaunchedEffect(churchId, isOnline) {
        reload()
    }

    val church = showcase?.featuredChurch

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(CharitasDeepNavy, CharitasRoyalNavy)
                        )
                    )
                    .padding(20.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Image(
                                painter = painterResource(id = R.drawable.ic_charitas_crest),
                                contentDescription = "CHARITAS",
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = church?.name ?: "CHARITAS — Église Saint Louis Roi d’Ebimpé",
                                    style = MaterialTheme.typography.titleLarge,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = church?.tagline ?: "Foi · Charité · Communauté",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = CharitasGold
                                )
                            }
                        }
                        IconButton(onClick = { scope.launch { reload() } }) {
                            Icon(Icons.Rounded.Refresh, contentDescription = "Actualiser", tint = Color.White)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = church?.description
                            ?: "Bienvenue dans l’espace officiel de l’Église Saint Louis Roi d’Ebimpé : Parole de Dieu hors ligne, messes, directs CHARITAS TV et solidarité chrétienne.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.9f)
                    )

                    Spacer(modifier = Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(onClick = { showContactDialog = true }) {
                            Icon(Icons.Rounded.Email, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Contacter la paroisse")
                        }
                        if (currentUser == null) {
                            OutlinedButton(onClick = onOpenAuth) {
                                Text("Se connecter", color = Color.White)
                            }
                        }
                    }
                    if (fromCache) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Affichage depuis le cache local hors connexion.",
                            style = MaterialTheme.typography.labelMedium,
                            color = CharitasGold
                        )
                    }
                }
            }
        }

        if (memberships.size > 1) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Mes églises", style = MaterialTheme.typography.titleMedium)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(memberships) { m ->
                            val selected = m.churchId == churchId
                            if (selected) {
                                Button(onClick = {}) { Text(m.churchName) }
                            } else {
                                OutlinedButton(onClick = { container.repository.selectChurch(m.churchId) }) {
                                    Text(m.churchName)
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                FilledTonalButton(
                    onClick = onOpenBible,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.AutoStories, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Bible")
                }
                FilledTonalButton(
                    onClick = onOpenTv,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.LiveTv, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("TV Direct")
                }
                FilledTonalButton(
                    onClick = onOpenEvents,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.VolunteerActivism, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Solidarité")
                }
            }
        }

        offlineVerse?.let { verse ->
            item {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.elevatedCardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "VERSET DU JOUR (CRAMPON 1923 · HORS LIGNE)",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "« ${verse.text} »",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${verse.bookNameFr} ${verse.chapter}:${verse.verse}",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            TextButton(onClick = onOpenBible) {
                                Text("Lire le chapitre")
                            }
                        }
                    }
                }
            }
        }

        if (loading && showcase == null) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        }

        church?.serviceSchedule?.takeIf { it.isNotEmpty() }?.let { schedule ->
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Horaires des messes & cultes", style = MaterialTheme.typography.titleMedium)
                        schedule.forEach { slot ->
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(slot.title, fontWeight = FontWeight.SemiBold)
                                        slot.location?.let {
                                            Text(it, style = MaterialTheme.typography.labelMedium)
                                        }
                                    }
                                    Text("${slot.day} · ${slot.time}", fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                        if (!church.address.isNullOrBlank()) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Rounded.LocationOn, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("${church.address} · ${church.city ?: "Ebimpé"}", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        }

        showcase?.upcomingEvents?.takeIf { it.isNotEmpty() }?.let { events ->
            item {
                Text("Prochains rendez-vous paroissiaux", style = MaterialTheme.typography.titleMedium)
            }
            items(events.take(3)) { ev ->
                Card(modifier = Modifier.fillMaxWidth(), onClick = onOpenEvents) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Rounded.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(ev.title, style = MaterialTheme.typography.titleMedium)
                            Text(
                                "${ev.startsAt} · ${ev.location ?: "Paroisse Saint Louis Roi"}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }

        showcase?.activeCampaigns?.takeIf { it.isNotEmpty() }?.let { campaigns ->
            item {
                Text("Solidarité & collectes actives", style = MaterialTheme.typography.titleMedium)
            }
            items(campaigns.take(2)) { camp ->
                val progress = if (camp.goalAmount > 0) {
                    (camp.collectedAmount.toFloat() / camp.goalAmount.toFloat()).coerceIn(0f, 1f)
                } else 0f
                Card(modifier = Modifier.fillMaxWidth(), onClick = onOpenEvents) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(camp.title, style = MaterialTheme.typography.titleMedium)
                        LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
                        Text(
                            "${camp.collectedAmount} / ${camp.goalAmount} ${camp.currency}",
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                }
            }
        }

        feedbackMessage?.let { msg ->
            item {
                Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }

    if (showContactDialog) {
        var name by remember { mutableStateOf("") }
        var email by remember { mutableStateOf("") }
        var phone by remember { mutableStateOf("") }
        var message by remember { mutableStateOf("") }
        var sending by remember { mutableStateOf(false) }
        var resultNote by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showContactDialog = false },
            title = { Text("Contacter la paroisse d’Ebimpé") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nom complet*") })
                    OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email (optionnel)") })
                    OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Téléphone (optionnel)") })
                    OutlinedTextField(
                        value = message,
                        onValueChange = { message = it },
                        label = { Text("Message / intention") },
                        minLines = 3
                    )
                    resultNote?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                }
            },
            confirmButton = {
                Button(
                    enabled = name.isNotBlank() && !sending,
                    onClick = {
                        scope.launch {
                            sending = true
                            resultNote = runCatching {
                                val res = container.apiService.submitVisitorContact(
                                    VisitorContactRequest(
                                        churchId = church?.id ?: churchId,
                                        fullName = name.trim(),
                                        email = email.trim().ifBlank { null },
                                        phone = phone.trim().ifBlank { null },
                                        message = message.trim().ifBlank { null }
                                    )
                                )
                                if (res.isSuccessful) {
                                    "Votre message a bien été transmis au secrétariat."
                                } else {
                                    "Envoi impossible (${res.code()})."
                                }
                            }.getOrElse { "Connexion requise pour envoyer ce formulaire." }
                            sending = false
                        }
                    }
                ) { Text(if (sending) "Envoi..." else "Envoyer") }
            },
            dismissButton = {
                TextButton(onClick = { showContactDialog = false }) { Text("Fermer") }
            }
        )
    }
}
