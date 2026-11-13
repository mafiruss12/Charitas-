package ci.ebimpe.charitas.ui.screens

import android.content.Intent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Comment
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.core.model.CharitasPermissions
import ci.ebimpe.charitas.core.model.CommunityGroupDto
import ci.ebimpe.charitas.core.model.OutboxOperationType
import ci.ebimpe.charitas.core.model.OutboxStatus
import ci.ebimpe.charitas.core.model.PollOptionDto
import ci.ebimpe.charitas.core.model.SocialCommentDto
import ci.ebimpe.charitas.core.model.SocialPostDto
import ci.ebimpe.charitas.core.network.CreateCommentRequest
import ci.ebimpe.charitas.core.network.CreatePostRequest
import ci.ebimpe.charitas.core.network.NetworkClientFactory
import ci.ebimpe.charitas.core.network.ReactRequest
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.ui.components.CharitasMediaPlayer
import ci.ebimpe.charitas.ui.theme.CharitasAmber
import ci.ebimpe.charitas.ui.theme.CharitasBurgundy
import ci.ebimpe.charitas.ui.theme.CharitasDeepNavy
import ci.ebimpe.charitas.ui.theme.CharitasGold
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

@Composable
fun SocialScreen(
    container: CharitasAppContainer,
    onOpenAuth: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val churchId by container.repository.activeChurchId.collectAsState()
    val currentUser by container.repository.currentUser.collectAsState()
    val isOnline by container.repository.isOnline.collectAsState()
    val outboxOps by container.database.outboxDao().observeAll().collectAsState(initial = emptyList())
    val json = NetworkClientFactory.jsonSerializer

    var tabIndex by remember { mutableIntStateOf(0) }
    var selectedType by remember { mutableStateOf<String?>(null) }
    var posts by remember { mutableStateOf<List<SocialPostDto>>(emptyList()) }
    var groups by remember { mutableStateOf<List<CommunityGroupDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var infoMessage by remember { mutableStateOf<String?>(null) }

    // Reels TikTok state
    var reelIndex by remember { mutableIntStateOf(0) }

    var showCreatePost by remember { mutableStateOf(false) }
    var commentsPost by remember { mutableStateOf<SocialPostDto?>(null) }

    val canPost = currentUser != null && container.repository.hasPermission(CharitasPermissions.SOCIAL_POST)
    val canViewGroups = currentUser != null && container.repository.hasPermission(CharitasPermissions.SOCIAL_VIEW)

    // Fallback default parish reels matching the Web experience
    val defaultReels = remember {
        listOf(
            SocialPostDto(
                id = -101,
                churchId = 1,
                authorName = "Chœur Saint Louis d’Ebimpé",
                postType = "short_video",
                content = "Répétition de la cantate d'action de grâce pour la messe solennelle. Joie, foi et ferveur fraternelle à Ebimpé.",
                mediaUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                hashtags = listOf("#Chorale", "#Ebimpé", "#Louange", "#ActionDeGrace"),
                likesCount = 84,
                commentsCount = 19,
                sharesCount = 12,
                createdAt = "2026-11-13T10:00:00Z"
            ),
            SocialPostDto(
                id = -102,
                churchId = 1,
                authorName = "Jeunesse Paroissiale Saint Louis",
                postType = "short_video",
                content = "Témoignage de conversion et engagement caritatif : comment la foi a transformé le service des plus démunis au village.",
                mediaUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                hashtags = listOf("#Jeunesse", "#Solidarité", "#Foi", "#CharitasEbimpé"),
                likesCount = 126,
                commentsCount = 28,
                sharesCount = 34,
                createdAt = "2026-11-12T16:30:00Z"
            ),
            SocialPostDto(
                id = -103,
                churchId = 1,
                authorName = "Père Curé — Paroisse d’Ebimpé",
                postType = "short_video",
                content = "« Que la paix et la grâce du Christ reposent sur chaque famille d’Ebimpé. Prions ensemble pour la concorde et la charité. »",
                mediaUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
                hashtags = listOf("#Homélie", "#Prière", "#Paix", "#Ebimpé"),
                likesCount = 210,
                commentsCount = 45,
                sharesCount = 68,
                createdAt = "2026-11-11T08:15:00Z"
            ),
            SocialPostDto(
                id = -104,
                churchId = 1,
                authorName = "Équipe Solidarité & Caritas",
                postType = "short_video",
                content = "Retour en images sur la distribution des vivres aux aînés et aux familles vulnérables d’Ebimpé. Merci pour votre générosité !",
                mediaUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                hashtags = listOf("#Solidarité", "#AmourDuProchain", "#Ebimpé"),
                likesCount = 153,
                commentsCount = 31,
                sharesCount = 22,
                createdAt = "2026-11-10T14:00:00Z"
            )
        )
    }

    suspend fun reload() {
        loading = true
        when (val res = container.repository.loadFeed(churchId, type = selectedType)) {
            is RepoResult.Success -> {
                posts = res.data.posts
                infoMessage = if (res.fromCache) "Fil affiché depuis le cache hors connexion." else null
            }
            is RepoResult.Error -> infoMessage = res.message
        }
        if (canViewGroups && isOnline) {
            runCatching { container.apiService.getGroups(churchId) }.getOrNull()?.body()?.let {
                groups = it.groups
            }
        }
        loading = false
    }

    LaunchedEffect(churchId, selectedType, currentUser, isOnline) {
        reload()
    }

    val pendingPostOps = remember(outboxOps) {
        outboxOps.filter { it.operationType == OutboxOperationType.CREATE_POST.name }
    }

    // Combine fetched short videos with default parish reels
    val allReels = remember(posts, defaultReels) {
        val fetchedShorts = posts.filter { it.postType == "short_video" }
        if (fetchedShorts.isNotEmpty()) fetchedShorts else defaultReels
    }

    val currentReel = allReels.getOrNull(reelIndex.coerceIn(0, (allReels.size - 1).coerceAtLeast(0)))

    Scaffold(
        floatingActionButton = {
            if (canPost && tabIndex != 1) {
                FloatingActionButton(
                    onClick = { showCreatePost = true },
                    containerColor = CharitasGold,
                    contentColor = CharitasDeepNavy
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = "Nouvelle publication")
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Top Harmonized Parish Brand Banner (Identical to Web Header)
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
                                text = "CHARITAS COMMUNAUTÉ",
                                style = MaterialTheme.typography.titleSmall,
                                color = Color.White,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = "Église Saint Louis Roi d’Ebimpé",
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
                            tint = Color.White.copy(alpha = 0.9f)
                        )
                    }
                }
            }

            // Tabs Row (Fil, Reels TikTok 9:16, Groupes)
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
                            Icon(Icons.Rounded.Newspaper, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Fil d’actualité", fontWeight = FontWeight.SemiBold)
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
                            Icon(Icons.Rounded.Movie, contentDescription = null, modifier = Modifier.size(16.dp), tint = CharitasBurgundy)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Reels TikTok", fontWeight = FontWeight.Bold, color = CharitasGold)
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
                            Icon(Icons.Rounded.Groups, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Groupes", fontWeight = FontWeight.SemiBold)
                        }
                    },
                    selectedContentColor = CharitasGold,
                    unselectedContentColor = Color.White.copy(alpha = 0.7f)
                )
            }

            // Tab 0: FIL PAROISSIAL
            if (tabIndex == 0) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    LazyRow(
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        val filters = listOf(
                            null to "Tout",
                            "text" to "Messages",
                            "photo" to "Photos",
                            "short_video" to "Vidéos",
                            "poll" to "Sondages"
                        )
                        items(filters) { (key, label) ->
                            FilterChip(
                                selected = selectedType == key,
                                onClick = { selectedType = key },
                                label = { Text(label) }
                            )
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (currentUser == null) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = CharitasRoyalNavy.copy(alpha = 0.08f)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, CharitasGold.copy(alpha = 0.4f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            "Espace paroissien & visiteur",
                                            fontWeight = FontWeight.Bold,
                                            style = MaterialTheme.typography.titleSmall
                                        )
                                        Text(
                                            "Connectez-vous pour réagir (Amen ❤️), commenter et partager des témoignages.",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Button(
                                        onClick = onOpenAuth,
                                        shape = RoundedCornerShape(50),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = CharitasGold,
                                            contentColor = CharitasDeepNavy
                                        )
                                    ) {
                                        Text("Connexion", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }

                    // Queued local outbox posts
                    items(pendingPostOps, key = { "outbox_${it.id}" }) { op ->
                        val req = runCatching { json.decodeFromString<CreatePostRequest>(op.payloadJson) }.getOrNull()
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, CharitasAmber.copy(alpha = 0.5f))
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.HourglassTop, contentDescription = null, tint = CharitasAmber)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (op.status == OutboxStatus.FAILED.name) {
                                            "Échec d'envoi : ${op.lastError ?: "Rejet serveur"}"
                                        } else {
                                            "En attente d'envoi — non encore synchronisé"
                                        },
                                        style = MaterialTheme.typography.labelMedium,
                                        color = CharitasAmber,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Text(req?.content ?: "")
                            }
                        }
                    }

                    if (loading && posts.isEmpty()) {
                        item {
                            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = CharitasRoyalNavy)
                            }
                        }
                    }

                    items(posts, key = { it.id }) { post ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                // Author & Metadata
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(38.dp)
                                                .clip(CircleShape)
                                                .background(CharitasRoyalNavy),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = post.authorName.take(1).uppercase(),
                                                color = CharitasGold,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(post.authorName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
                                            Text("Paroisse d’Ebimpé", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(50),
                                        color = CharitasRoyalNavy.copy(alpha = 0.1f)
                                    ) {
                                        Text(
                                            text = post.postType.uppercase(),
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = CharitasRoyalNavy,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                        )
                                    }
                                }

                                // Content Body
                                Text(
                                    text = post.content,
                                    style = MaterialTheme.typography.bodyMedium,
                                    lineHeight = 21.sp
                                )

                                // Photo Media Preview if available
                                if (!post.mediaUrl.isNullOrBlank() && post.postType == "photo") {
                                    AsyncImage(
                                        model = post.mediaUrl,
                                        contentDescription = "Photo de ${post.authorName}",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(200.dp)
                                            .clip(RoundedCornerShape(12.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                }

                                // Poll rendering if available
                                if (post.pollOptions.isNotEmpty()) {
                                    val totalVotes = post.pollOptions.sumOf { it.votesCount }.coerceAtLeast(1)
                                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        post.pollOptions.forEach { opt ->
                                            val pct = (opt.votesCount.toFloat() / totalVotes.toFloat()).coerceIn(0f, 1f)
                                            Column(modifier = Modifier.fillMaxWidth()) {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween
                                                ) {
                                                    Text(opt.label, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                                                    Text("${opt.votesCount} (${(pct * 100).toInt()}%)", style = MaterialTheme.typography.labelSmall)
                                                }
                                                Spacer(modifier = Modifier.height(2.dp))
                                                LinearProgressIndicator(
                                                    progress = { pct },
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .height(6.dp)
                                                        .clip(RoundedCornerShape(3.dp)),
                                                    color = CharitasRoyalNavy
                                                )
                                            }
                                        }
                                    }
                                }

                                // Action Buttons: Amen, Comments, Share
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        TextButton(
                                            onClick = {
                                                if (currentUser == null) {
                                                    onOpenAuth()
                                                } else {
                                                    scope.launch {
                                                        container.repository.enqueueMutation(
                                                            churchId = churchId,
                                                            type = OutboxOperationType.TOGGLE_REACTION,
                                                            targetId = post.id.toString(),
                                                            payloadJson = json.encodeToString(ReactRequest("amen"))
                                                        )
                                                        reload()
                                                    }
                                                }
                                            }
                                        ) {
                                            Icon(
                                                Icons.Rounded.Favorite,
                                                contentDescription = null,
                                                tint = CharitasBurgundy,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Amen (${post.likesCount})", color = CharitasBurgundy, fontWeight = FontWeight.Bold)
                                        }

                                        TextButton(onClick = { commentsPost = post }) {
                                            Icon(
                                                Icons.Rounded.Comment,
                                                contentDescription = null,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("(${post.commentsCount})")
                                        }
                                    }

                                    IconButton(onClick = {
                                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(
                                                Intent.EXTRA_TEXT,
                                                "« ${post.content} » — ${post.authorName} (CHARITAS Église Saint Louis Roi d'Ebimpé)"
                                            )
                                        }
                                        context.startActivity(Intent.createChooser(shareIntent, "Partager la publication"))
                                    }) {
                                        Icon(
                                            Icons.Rounded.Share,
                                            contentDescription = "Partager",
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    infoMessage?.let {
                        item { Text(it, style = MaterialTheme.typography.labelMedium) }
                    }
                }
            }

            // Tab 1: REELS TIKTOK (9:16) — Mode Plein Écran & Capsules Spirituelles
            else if (tabIndex == 1) {
                if (currentReel == null) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Aucune vidéo courte disponible.")
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Reels Sub-Header
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = CharitasBurgundy
                                ) {
                                    Text(
                                        "REELS TIKTOK",
                                        color = Color.White,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Capsule ${reelIndex + 1} / ${allReels.size}",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = CharitasRoyalNavy
                                )
                            }

                            // Prev / Next navigation buttons
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                IconButton(
                                    onClick = { reelIndex = (reelIndex - 1).coerceAtLeast(0) },
                                    enabled = reelIndex > 0
                                ) {
                                    Icon(Icons.Rounded.KeyboardArrowUp, contentDescription = "Précédent")
                                }
                                IconButton(
                                    onClick = { reelIndex = (reelIndex + 1).coerceAtMost(allReels.size - 1) },
                                    enabled = reelIndex < allReels.size - 1
                                ) {
                                    Icon(Icons.Rounded.KeyboardArrowDown, contentDescription = "Suivant")
                                }
                            }
                        }

                        // Immersive 9:16 Vertical Video Player Card
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .clip(RoundedCornerShape(24.dp))
                                .background(Color.Black)
                        ) {
                            // Video playback using CharitasMediaPlayer configured for 9:16 vertical reels
                            if (!currentReel.mediaUrl.isNullOrBlank()) {
                                CharitasMediaPlayer(
                                    streamUrl = currentReel.mediaUrl,
                                    title = currentReel.content,
                                    isOnline = isOnline,
                                    aspectRatio = 9f / 16f,
                                    showInfoFooter = false,
                                    autoLoop = true,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                // Rich Gradient Card if no video URL
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.verticalGradient(
                                                colors = listOf(CharitasDeepNavy, CharitasRoyalNavy, CharitasBurgundy)
                                            )
                                        )
                                        .padding(24.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = currentReel.content,
                                        color = Color.White,
                                        style = MaterialTheme.typography.titleMedium,
                                        textAlign = TextAlign.Center,
                                        lineHeight = 26.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }

                            // Right Floating TikTok Action Column (Amen ❤️, Comments 💬, Share ↗️)
                            Column(
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(end = 12.dp, bottom = 28.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                // Amen button
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(
                                        modifier = Modifier
                                            .size(46.dp)
                                            .clip(CircleShape)
                                            .background(Color.Black.copy(alpha = 0.55f))
                                            .clickable {
                                                if (currentUser == null) {
                                                    onOpenAuth()
                                                } else {
                                                    scope.launch {
                                                        container.repository.enqueueMutation(
                                                            churchId = churchId,
                                                            type = OutboxOperationType.TOGGLE_REACTION,
                                                            targetId = currentReel.id.toString(),
                                                            payloadJson = json.encodeToString(ReactRequest("amen"))
                                                        )
                                                    }
                                                }
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Rounded.Favorite,
                                            contentDescription = "Amen",
                                            tint = Color(0xFFEF4444),
                                            modifier = Modifier.size(24.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        "${currentReel.likesCount}",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                // Comments button
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(
                                        modifier = Modifier
                                            .size(46.dp)
                                            .clip(CircleShape)
                                            .background(Color.Black.copy(alpha = 0.55f))
                                            .clickable { commentsPost = currentReel },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Rounded.Comment,
                                            contentDescription = "Commentaires",
                                            tint = Color.White,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        "${currentReel.commentsCount}",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                // Share button
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(
                                        modifier = Modifier
                                            .size(46.dp)
                                            .clip(CircleShape)
                                            .background(Color.Black.copy(alpha = 0.55f))
                                            .clickable {
                                                val send = Intent(Intent.ACTION_SEND).apply {
                                                    type = "text/plain"
                                                    putExtra(
                                                        Intent.EXTRA_TEXT,
                                                        "Regardez cette capsule CHARITAS : « ${currentReel.content} » — Paroisse Saint Louis d'Ebimpé"
                                                    )
                                                }
                                                context.startActivity(Intent.createChooser(send, "Partager le Reel"))
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Rounded.Share,
                                            contentDescription = "Partager",
                                            tint = CharitasGold,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        "Partager",
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }

                            // Bottom Caption & Tags Overlay
                            Box(
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .fillMaxWidth(0.80f)
                                    .background(
                                        Brush.verticalGradient(
                                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                                        )
                                    )
                                    .padding(start = 16.dp, end = 8.dp, bottom = 18.dp, top = 24.dp)
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = "@${currentReel.authorName}",
                                        color = Color.White,
                                        fontWeight = FontWeight.ExtraBold,
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                    Text(
                                        text = currentReel.content,
                                        color = Color.White.copy(alpha = 0.95f),
                                        style = MaterialTheme.typography.bodySmall,
                                        maxLines = 3,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (currentReel.hashtags.isNotEmpty()) {
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                                            modifier = Modifier.padding(top = 2.dp)
                                        ) {
                                            currentReel.hashtags.forEach { tag ->
                                                Text(
                                                    tag,
                                                    color = CharitasGold,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Reel Carousel selector at the bottom
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                        ) {
                            items(allReels.indices.toList()) { idx ->
                                val r = allReels[idx]
                                val selected = idx == reelIndex
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (selected) CharitasRoyalNavy else MaterialTheme.colorScheme.surfaceVariant,
                                    border = if (selected) androidx.compose.foundation.BorderStroke(1.5.dp, CharitasGold) else null,
                                    modifier = Modifier.clickable { reelIndex = idx }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            "#${idx + 1}",
                                            fontWeight = FontWeight.Bold,
                                            color = if (selected) CharitasGold else MaterialTheme.colorScheme.onSurfaceVariant,
                                            fontSize = 12.sp
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            r.authorName,
                                            fontWeight = FontWeight.Medium,
                                            color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
                                            fontSize = 12.sp,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Tab 2: GROUPES & COMMUNAUTÉS
            else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (!canViewGroups) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = CharitasRoyalNavy.copy(alpha = 0.08f)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, CharitasGold.copy(alpha = 0.4f))
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text(
                                        "Consulter et rejoindre les groupes",
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                    Text(
                                        "Connectez-vous pour rejoindre la chorale, le groupe des jeunes, l'équipe solidarité ou les catéchistes.",
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                    Button(
                                        onClick = onOpenAuth,
                                        shape = RoundedCornerShape(50),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = CharitasGold,
                                            contentColor = CharitasDeepNavy
                                        )
                                    ) {
                                        Text("Se connecter", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    } else {
                        items(groups, key = { it.id }) { g ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(g.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                                        g.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            "${g.membersCount} membre(s) · Catégorie : ${g.category}",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    OutlinedButton(
                                        onClick = {
                                            scope.launch {
                                                runCatching { container.apiService.toggleGroupJoin(churchId, g.id) }
                                                reload()
                                            }
                                        },
                                        shape = RoundedCornerShape(50)
                                    ) {
                                        Text(if (g.isMember) "Quitter" else "Rejoindre")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreatePost) {
        var content by remember { mutableStateOf("") }
        var mediaUrl by remember { mutableStateOf("") }
        var postType by remember { mutableStateOf("text") }

        AlertDialog(
            onDismissRequest = { showCreatePost = false },
            title = { Text("Publier dans la communauté") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("text" to "Texte", "photo" to "Photo", "short_video" to "Vidéo (Reel)").forEach { (t, lbl) ->
                            FilterChip(selected = postType == t, onClick = { postType = t }, label = { Text(lbl) })
                        }
                    }
                    OutlinedTextField(
                        value = content,
                        onValueChange = { content = it },
                        label = { Text("Votre témoignage ou annonce") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (postType != "text") {
                        OutlinedTextField(
                            value = mediaUrl,
                            onValueChange = { mediaUrl = it },
                            label = { Text("URL HTTPS du média ou vidéo") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    enabled = content.isNotBlank(),
                    onClick = {
                        scope.launch {
                            container.repository.enqueueMutation(
                                churchId = churchId,
                                type = OutboxOperationType.CREATE_POST,
                                targetId = null,
                                payloadJson = json.encodeToString(
                                    CreatePostRequest(
                                        postType = postType,
                                        content = content.trim(),
                                        mediaUrl = mediaUrl.trim().ifBlank { null }
                                    )
                                )
                            )
                            showCreatePost = false
                            reload()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CharitasGold, contentColor = CharitasDeepNavy)
                ) { Text("Publier", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showCreatePost = false }) { Text("Annuler") }
            }
        )
    }

    commentsPost?.let { post ->
        var comments by remember { mutableStateOf<List<SocialCommentDto>>(emptyList()) }
        var newComment by remember { mutableStateOf("") }

        LaunchedEffect(post.id) {
            if (currentUser != null && isOnline) {
                runCatching { container.apiService.getPostComments(churchId, post.id) }.getOrNull()?.body()?.let {
                    comments = it.comments
                }
            }
        }

        AlertDialog(
            onDismissRequest = { commentsPost = null },
            title = { Text("Commentaires · ${post.authorName}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (comments.isEmpty()) {
                        Text("Aucun commentaire pour l'instant. Soyez le premier !", style = MaterialTheme.typography.bodySmall)
                    } else {
                        comments.take(6).forEach { c ->
                            Text("${c.authorName}: ${c.content}", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    if (currentUser != null) {
                        OutlinedTextField(
                            value = newComment,
                            onValueChange = { newComment = it },
                            label = { Text("Ajouter un commentaire") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            },
            confirmButton = {
                if (currentUser != null) {
                    Button(
                        enabled = newComment.isNotBlank(),
                        onClick = {
                            scope.launch {
                                container.repository.enqueueMutation(
                                    churchId = churchId,
                                    type = OutboxOperationType.CREATE_COMMENT,
                                    targetId = post.id.toString(),
                                    payloadJson = json.encodeToString(CreateCommentRequest(newComment.trim()))
                                )
                                newComment = ""
                                commentsPost = null
                                reload()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CharitasGold, contentColor = CharitasDeepNavy)
                    ) { Text("Envoyer", fontWeight = FontWeight.Bold) }
                }
            },
            dismissButton = {
                TextButton(onClick = { commentsPost = null }) { Text("Fermer") }
            }
        )
    }
}
