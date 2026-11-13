package ci.ebimpe.charitas.ui.screens

import android.content.Intent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.Radio
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.core.model.PublicTvCatalogResponseDto
import ci.ebimpe.charitas.core.model.TvChannelDto
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.ui.components.CharitasMediaPlayer
import ci.ebimpe.charitas.ui.theme.CharitasDeepNavy
import ci.ebimpe.charitas.ui.theme.CharitasGold
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy
import kotlinx.coroutines.launch

@Composable
fun TvScreen(container: CharitasAppContainer) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val churchId by container.repository.activeChurchId.collectAsState()
    val currentUser by container.repository.currentUser.collectAsState()
    val isOnline by container.repository.isOnline.collectAsState()

    var catalog by remember { mutableStateOf<PublicTvCatalogResponseDto?>(null) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var search by remember { mutableStateOf("") }
    var activeChannel by remember { mutableStateOf<TvChannelDto?>(null) }
    var loading by remember { mutableStateOf(true) }
    var message by remember { mutableStateOf<String?>(null) }

    val fallbackCategories = listOf(
        "TV chrétiennes africaines",
        "TV chrétiennes internationales",
        "TV chrétiennes francophones",
        "Gospel et louange",
        "Prédications",
        "Enseignements bibliques",
        "Cultes en direct",
        "Conférences chrétiennes"
    )

    suspend fun reload() {
        loading = true
        when (val res = container.repository.loadTvCatalog(churchId, category = selectedCategory, search = search.ifBlank { null })) {
            is RepoResult.Success -> {
                catalog = res.data
                if (activeChannel == null) {
                    activeChannel = res.data.recommendedChannels.firstOrNull() ?: res.data.channels.firstOrNull()
                }
                message = if (res.fromCache) "Catalogue TV affiché depuis le cache hors connexion." else null
            }
            is RepoResult.Error -> message = res.message
        }
        loading = false
    }

    LaunchedEffect(churchId, selectedCategory, search, isOnline) {
        reload()
    }

    val categories = catalog?.categories?.takeIf { it.isNotEmpty() } ?: fallbackCategories
    val channels = catalog?.channels.orEmpty()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Top Harmonized Banner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(CharitasDeepNavy, CharitasRoyalNavy)
                    )
                )
                .padding(horizontal = 16.dp, vertical = 14.dp)
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
                            .size(38.dp)
                            .clip(CircleShape)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "CHARITAS TV",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = Color(0xFFDC2626)
                            ) {
                                Text(
                                    "DIRECT",
                                    color = Color.White,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                )
                            }
                        }
                        Text(
                            text = "Chaînes chrétiennes & direct paroissial d’Ebimpé",
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

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Live Video Player with Gold border
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = CharitasDeepNavy),
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, CharitasGold.copy(alpha = 0.6f))
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        CharitasMediaPlayer(
                            streamUrl = activeChannel?.streamUrl,
                            title = activeChannel?.let { "${it.name} · ${it.category}" } ?: "Sélectionnez une chaîne",
                            isOnline = isOnline,
                            showInfoFooter = true
                        )
                    }
                }
            }

            // Search Bar
            item {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    label = { Text("Rechercher une chaîne, un thème ou une émission…") },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Categories Filter Bar
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    item {
                        FilterChip(
                            selected = selectedCategory == null,
                            onClick = { selectedCategory = null },
                            label = { Text("Toutes (${channels.size})") }
                        )
                    }
                    items(categories) { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = cat },
                            label = { Text(cat) }
                        )
                    }
                }
            }

            if (loading && channels.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = CharitasRoyalNavy)
                    }
                }
            }

            // Channels List
            items(channels, key = { it.id }) { ch ->
                val selected = activeChannel?.id == ch.id
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { activeChannel = ch },
                    shape = RoundedCornerShape(16.dp),
                    colors = if (selected) {
                        CardDefaults.cardColors(containerColor = CharitasRoyalNavy.copy(alpha = 0.12f))
                    } else {
                        CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    },
                    border = if (selected) {
                        androidx.compose.foundation.BorderStroke(1.5.dp, CharitasGold)
                    } else {
                        androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    }
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (selected) CharitasRoyalNavy else MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Rounded.LiveTv,
                                contentDescription = null,
                                tint = if (selected) CharitasGold else CharitasRoyalNavy,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    ch.name,
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleSmall
                                )
                                if (selected) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = CharitasGold
                                    ) {
                                        Text(
                                            "EN COURS",
                                            color = CharitasDeepNavy,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                            }
                            Text(
                                "${ch.category} · ${ch.language}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            ch.currentProgram?.let {
                                Text(
                                    it,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        if (currentUser != null && isOnline) {
                            IconButton(onClick = {
                                scope.launch {
                                    runCatching { container.apiService.toggleTvFavorite(churchId, ch.id) }
                                    message = "Chaîne ${ch.name} mise à jour dans vos favoris."
                                }
                            }) {
                                Icon(
                                    Icons.Rounded.FavoriteBorder,
                                    contentDescription = "Favori",
                                    tint = CharitasBurgundy
                                )
                            }
                        }
                        IconButton(onClick = {
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "Regardez ${ch.name} en direct sur CHARITAS TV — Église Saint Louis Roi d’Ebimpé : ${ch.streamUrl}"
                                )
                            }
                            context.startActivity(Intent.createChooser(send, "Partager la chaîne"))
                        }) {
                            Icon(
                                Icons.Rounded.Share,
                                contentDescription = "Partager",
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }

            message?.let {
                item {
                    Text(
                        it,
                        style = MaterialTheme.typography.labelMedium,
                        color = CharitasRoyalNavy,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}
