package ci.ebimpe.charitas.ui.screens

import android.content.Intent
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.LiveTv
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.core.model.PublicTvCatalogResponseDto
import ci.ebimpe.charitas.core.model.TvChannelDto
import ci.ebimpe.charitas.data.sync.RepoResult
import ci.ebimpe.charitas.ui.components.CharitasMediaPlayer
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

    LaunchedEffect(churchId, selectedCategory, search, isOnline) {
        loading = true
        when (val res = container.repository.loadTvCatalog(churchId, category = selectedCategory, search = search.ifBlank { null })) {
            is RepoResult.Success -> {
                catalog = res.data
                if (activeChannel == null) {
                    activeChannel = res.data.recommendedChannels.firstOrNull() ?: res.data.channels.firstOrNull()
                }
                message = if (res.fromCache) "Catalogue TV affiché depuis le cache." else null
            }
            is RepoResult.Error -> message = res.message
        }
        loading = false
    }

    val categories = catalog?.categories?.takeIf { it.isNotEmpty() } ?: fallbackCategories
    val channels = catalog?.channels.orEmpty()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "CHARITAS TV — Chaînes chrétiennes en direct",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        }

        item {
            CharitasMediaPlayer(
                streamUrl = activeChannel?.streamUrl,
                title = activeChannel?.let { "${it.name} · ${it.category}" } ?: "Aucune chaîne sélectionnée",
                isOnline = isOnline
            )
        }

        item {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Rechercher une chaîne ou émission") },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                item {
                    FilterChip(
                        selected = selectedCategory == null,
                        onClick = { selectedCategory = null },
                        label = { Text("Toutes") }
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
                    CircularProgressIndicator()
                }
            }
        }

        items(channels, key = { it.id }) { ch ->
            val selected = activeChannel?.id == ch.id
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { activeChannel = ch },
                colors = if (selected) {
                    CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                } else {
                    CardDefaults.cardColors()
                }
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Rounded.LiveTv, contentDescription = null)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(ch.name, fontWeight = FontWeight.Bold)
                        Text("${ch.category} · ${ch.language}", style = MaterialTheme.typography.labelMedium)
                        ch.currentProgram?.let {
                            Text(it, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    if (currentUser != null && isOnline) {
                        IconButton(onClick = {
                            scope.launch {
                                runCatching { container.apiService.toggleTvFavorite(churchId, ch.id) }
                                message = "Chaîne ${ch.name} mise à jour dans vos favoris."
                            }
                        }) {
                            Icon(Icons.Rounded.FavoriteBorder, contentDescription = "Favori")
                        }
                    }
                    IconButton(onClick = {
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, "Regardez ${ch.name} sur CHARITAS TV — Église Saint Louis Roi d’Ebimpé")
                        }
                        context.startActivity(Intent.createChooser(send, "Partager la chaîne"))
                    }) {
                        Icon(Icons.Rounded.Share, contentDescription = "Partager")
                    }
                }
            }
        }

        message?.let {
            item { Text(it, style = MaterialTheme.typography.labelMedium) }
        }
    }
}
