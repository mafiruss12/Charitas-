package ci.ebimpe.charitas.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.People
import androidx.compose.material.icons.rounded.Phone
import androidx.compose.material.icons.rounded.PlayCircle
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.core.database.BibleVerseEntity
import ci.ebimpe.charitas.core.model.PublicShowcaseResponseDto
import ci.ebimpe.charitas.core.network.VisitorContactRequest
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.ui.theme.CharitasAmber
import ci.ebimpe.charitas.ui.theme.CharitasBurgundy
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
    val context = LocalContext.current
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
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // ==================== 1. HERO SECTION (DEEP BLUE GRADIENT + PHOTOGRAPHY) ====================
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color(0xFF04112B),
                                Color(0xFF0A2B6E),
                                Color(0xFF1750B5)
                            )
                        )
                    )
                    .padding(horizontal = 16.dp, vertical = 20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    // Church Header Branding
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
                                    .size(46.dp)
                                    .clip(CircleShape)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = "CHARITAS",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color.White,
                                    fontWeight = FontWeight.ExtraBold,
                                    letterSpacing = 1.sp
                                )
                                Text(
                                    text = "ÉGLISE SAINT LOUIS ROI D’EBIMPÉ",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = CharitasGold,
                                    fontWeight = FontWeight.SemiBold
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

                    // Badge: "Une église connectée pour une communauté solidaire"
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color.White.copy(alpha = 0.12f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.22f)),
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                Icons.Rounded.People,
                                contentDescription = null,
                                tint = CharitasGold,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "Une église connectée pour une communauté solidaire",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.95f),
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Main Slogan & Headline
                    Column(modifier = Modifier.padding(top = 2.dp)) {
                        Text(
                            text = "Ensemble, faisons",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        )
                        Text(
                            text = "le bien autour de nous",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = CharitasGold
                        )
                        Box(
                            modifier = Modifier
                                .padding(top = 2.dp)
                                .height(3.dp)
                                .width(180.dp)
                                .background(CharitasGold, RoundedCornerShape(2.dp))
                        )
                    }

                    // Paragraph summary
                    Text(
                        text = "CHARITAS est la plateforme de notre église pour partager, communiquer, soutenir les plus vulnérables et bâtir une communauté plus solidaire.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.9f),
                        lineHeight = 20.sp
                    )

                    // Hero Community Photography Card (priest, volunteers, elderly woman in Ebimpé)
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp)),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF071D49)),
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, Color.White.copy(alpha = 0.25f))
                    ) {
                        AsyncImage(
                            model = "file:///android_asset/images/charite_hero_community_1794553951858.jpg",
                            contentDescription = "Responsable religieux et bénévoles CHARITAS à Ebimpé",
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 10f),
                            contentScale = ContentScale.Crop
                        )
                    }

                    // Hero CTA Buttons
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = onOpenAuth,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(50),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CharitasGold,
                                contentColor = Color(0xFF061A40)
                            )
                        ) {
                            Icon(
                                Icons.Rounded.Favorite,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Rejoindre notre communauté",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                Icons.Rounded.ArrowForward,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = onOpenTv,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(50),
                                border = androidx.compose.foundation.BorderStroke(1.dp, CharitasGold.copy(alpha = 0.7f)),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = Color(0xFF04112B).copy(alpha = 0.7f),
                                    contentColor = CharitasGold
                                )
                            ) {
                                Icon(Icons.Rounded.LiveTv, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("CHARITAS TV", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            }

                            Button(
                                onClick = { showContactDialog = true },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(50),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White.copy(alpha = 0.15f),
                                    contentColor = Color.White
                                )
                            ) {
                                Icon(Icons.Rounded.Email, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Contact", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            }
                        }
                    }

                    if (fromCache) {
                        Text(
                            text = "Affichage depuis le cache local hors connexion.",
                            style = MaterialTheme.typography.labelSmall,
                            color = CharitasGold
                        )
                    }
                }
            }
        }

        // ==================== 2. THE 5 INTERACTIVE FEATURE CARDS ====================
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Fonctionnalités & Piliers paroissiaux",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )

                val features = listOf(
                    Triple(
                        "Communauté active et engagée",
                        Brush.linearGradient(listOf(Color(0xFF2563EB), Color(0xFF1D4ED8))),
                        Icons.Rounded.People
                    ) to onOpenAuth,
                    Triple(
                        "Actions de solidarité et d'entraide",
                        Brush.linearGradient(listOf(Color(0xFF10B981), Color(0xFF0D9488))),
                        Icons.Rounded.VolunteerActivism
                    ) to onOpenEvents,
                    Triple(
                        "Événements et rencontres",
                        Brush.linearGradient(listOf(Color(0xFF6366F1), Color(0xFF7C3AED))),
                        Icons.Rounded.CalendarMonth
                    ) to onOpenEvents,
                    Triple(
                        "Actualités et messages",
                        Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFF97316))),
                        Icons.Rounded.Notifications
                    ) to onOpenAuth,
                    Triple(
                        "Soutien spirituel et bienveillance",
                        Brush.linearGradient(listOf(Color(0xFF06B6D4), Color(0xFF0284C7))),
                        Icons.Rounded.AutoStories
                    ) to onOpenBible
                )

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(features) { (item, action) ->
                        val (title, brush, icon) = item
                        Card(
                            modifier = Modifier
                                .width(200.dp)
                                .clickable { action() },
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(brush),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = icon,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                                Text(
                                    text = title,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 2
                                )
                            }
                        }
                    }
                }
            }
        }

        // ==================== 3. SECTION "NOTRE MISSION" (BIBLE + SMARTPHONE + CHECKLIST) ====================
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Image Bible + Smartphone CHARITAS
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        AsyncImage(
                            model = "file:///android_asset/images/charite_mission_smartphone_1794553951626.jpg",
                            contentDescription = "Bible et smartphone CHARITAS",
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 9f),
                            contentScale = ContentScale.Crop
                        )
                    }

                    // Badge "Notre mission"
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color(0xFF1D4ED8).copy(alpha = 0.12f)
                    ) {
                        Text(
                            text = "🎯 Notre mission",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF1D4ED8),
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }

                    Text(
                        text = "Partager l’amour de Dieu et agir pour les autres",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Text(
                        text = "À travers CHARITAS, nous unissons nos forces pour soutenir les démunis, partager la parole de Dieu et construire une société plus fraternelle à Ebimpé.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 18.sp
                    )

                    // Checklist items
                    val checklist = listOf(
                        "Partager des messages et des prières",
                        "Faire des dons en toute sécurité",
                        "Participer aux œuvres de charité",
                        "Rester connecté avec votre église"
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        checklist.forEach { itemText ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Rounded.CheckCircle,
                                    contentDescription = null,
                                    tint = Color(0xFF1D4ED8),
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = itemText,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }

                    Button(
                        onClick = onOpenAuth,
                        shape = RoundedCornerShape(50),
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1D4ED8))
                    ) {
                        Text("Rejoindre maintenant", fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(Icons.Rounded.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // ==================== 4. VERSET DU JOUR (CRAMPON 1923 · HORS LIGNE) ====================
        offlineVerse?.let { verse ->
            item {
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.elevatedCardColors(
                        containerColor = Color(0xFF04112B)
                    ),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CharitasGold.copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "VERSET DU JOUR (CRAMPON 1923)",
                                style = MaterialTheme.typography.labelSmall,
                                color = CharitasGold,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.sp
                            )
                            Icon(
                                Icons.Rounded.AutoStories,
                                contentDescription = null,
                                tint = CharitasGold,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "« ${verse.text} »",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White,
                            lineHeight = 22.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${verse.bookNameFr} ${verse.chapter}:${verse.verse}",
                                style = MaterialTheme.typography.titleSmall,
                                color = CharitasGold,
                                fontWeight = FontWeight.Bold
                            )
                            TextButton(
                                onClick = onOpenBible,
                                colors = ButtonDefaults.textButtonColors(contentColor = Color.White)
                            ) {
                                Text("Lire dans la Bible", fontWeight = FontWeight.SemiBold)
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(Icons.Rounded.ArrowForward, contentDescription = null, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }
            }
        }

        // ==================== 5. HORAIRES & MESSES PAROISSIALES ====================
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Rounded.CalendarMonth,
                            contentDescription = null,
                            tint = Color(0xFF1D4ED8),
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Horaires des cultes & messes à Ebimpé",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    val defaultSchedules = listOf(
                        "Dimanche" to "08:30" to "Messe Dominicale & Collecte CHARITAS",
                        "Mercredi" to "18:00" to "Adoration & Chapelet pour les familles",
                        "Samedi" to "09:30" to "Permanence CHARITAS & Distribution Solidaire"
                    )

                    defaultSchedules.forEach { (timePair, title) ->
                        val (day, time) = timePair
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    MaterialTheme.colorScheme.surface.copy(alpha = 0.7f),
                                    RoundedCornerShape(12.dp)
                                )
                                .padding(10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = title,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = "Église Saint Louis Roi d’Ebimpé",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFF1D4ED8).copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = "$day $time",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFF1D4ED8),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            Icons.Rounded.LocationOn,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "Quartier Ebimpé, Commune d’Anyama, Côte d'Ivoire",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }

    // Modal dialogue pour contacter la paroisse
    if (showContactDialog) {
        var name by remember { mutableStateOf(currentUser?.fullName ?: "") }
        var phone by remember { mutableStateOf(currentUser?.phone ?: "") }
        var msg by remember { mutableStateOf("") }
        var sending by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showContactDialog = false },
            title = { Text("Contacter l’Église Saint Louis Roi") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Laissez votre message à l'équipe pastorale ou à la permanence CHARITAS d’Ebimpé.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Votre nom complet") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Téléphone ou WhatsApp") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = msg,
                        onValueChange = { msg = it },
                        label = { Text("Votre message ou demande d'aide") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3
                    )
                }
            },
            confirmButton = {
                Button(
                    enabled = name.isNotBlank() && msg.isNotBlank() && !sending,
                    onClick = {
                        sending = true
                        scope.launch {
                            val req = VisitorContactRequest(
                                churchId = churchId,
                                fullName = name.trim(),
                                phone = phone.trim().ifBlank { null },
                                message = msg.trim()
                            )
                            runCatching { container.apiService.submitVisitorContact(req) }
                            sending = false
                            showContactDialog = false
                            feedbackMessage = "Votre message a été transmis à la paroisse."
                        }
                    }
                ) {
                    Text(if (sending) "Envoi..." else "Envoyer")
                }
            },
            dismissButton = {
                TextButton(onClick = { showContactDialog = false }) {
                    Text("Annuler")
                }
            }
        )
    }
}
