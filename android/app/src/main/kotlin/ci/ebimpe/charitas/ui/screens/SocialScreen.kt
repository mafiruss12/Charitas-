package ci.ebimpe.charitas.ui.screens

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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Comment
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import ci.ebimpe.charitas.core.model.CommunityGroupDto
import ci.ebimpe.charitas.core.model.OutboxOperationType
import ci.ebimpe.charitas.core.model.OutboxStatus
import ci.ebimpe.charitas.core.model.SocialCommentDto
import ci.ebimpe.charitas.core.model.SocialPostDto
import ci.ebimpe.charitas.core.network.CreateCommentRequest
import ci.ebimpe.charitas.core.network.CreatePostRequest
import ci.ebimpe.charitas.core.network.NetworkClientFactory
import ci.ebimpe.charitas.core.network.ReactRequest
import ci.ebimpe.charitas.data.sync.RepoResult
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

@Composable
fun SocialScreen(
    container: CharitasAppContainer,
    onOpenAuth: () -> Unit
) {
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

    var showCreatePost by remember { mutableStateOf(false) }
    var commentsPost by remember { mutableStateOf<SocialPostDto?>(null) }

    val canPost = currentUser != null && container.repository.hasPermission(CharitasPermissions.SOCIAL_POST)
    val canViewGroups = currentUser != null && container.repository.hasPermission(CharitasPermissions.SOCIAL_VIEW)

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

    Scaffold(
        floatingActionButton = {
            if (canPost) {
                FloatingActionButton(onClick = { showCreatePost = true }) {
                    Icon(Icons.Rounded.Add, contentDescription = "Nouvelle publication")
                }
            }
        }
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            TabRow(selectedTabIndex = tabIndex) {
                Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }, text = { Text("Fil paroissial") })
                Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }, text = { Text("Groupes") })
            }

            if (tabIndex == 0) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp),
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
                    IconButton(onClick = { scope.launch { reload() } }) {
                        Icon(Icons.Rounded.Refresh, contentDescription = "Actualiser")
                    }
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (currentUser == null) {
                        item {
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        "Mode visiteur · Connectez-vous pour publier et réagir.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        modifier = Modifier.weight(1f)
                                    )
                                    TextButton(onClick = onOpenAuth) { Text("Connexion") }
                                }
                            }
                        }
                    }

                    // Show queued local outbox posts explicitly marked non-confirmed
                    items(pendingPostOps, key = { "outbox_${it.id}" }) { op ->
                        val req = runCatching { json.decodeFromString<CreatePostRequest>(op.payloadJson) }.getOrNull()
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.HourglassTop, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (op.status == OutboxStatus.FAILED.name) {
                                            "Échec d'envoi : ${op.lastError ?: "Rejet serveur"}"
                                        } else {
                                            "En attente d'envoi — publication non confirmée par le serveur"
                                        },
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.secondary,
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
                                CircularProgressIndicator()
                            }
                        }
                    }

                    items(posts, key = { it.id }) { post ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(post.authorName, fontWeight = FontWeight.Bold)
                                    Text(post.postType.uppercase(), style = MaterialTheme.typography.labelMedium)
                                }
                                Text(post.content, style = MaterialTheme.typography.bodyLarge)
                                if (post.pollOptions.isNotEmpty()) {
                                    post.pollOptions.forEach { opt ->
                                        Text("• ${opt.label} (${opt.votesCount} votes)", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
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
                                        Icon(Icons.Rounded.Favorite, contentDescription = null)
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Amen (${post.likesCount})")
                                    }
                                    TextButton(onClick = { commentsPost = post }) {
                                        Icon(Icons.Rounded.Comment, contentDescription = null)
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Commentaires (${post.commentsCount})")
                                    }
                                }
                            }
                        }
                    }

                    infoMessage?.let {
                        item { Text(it, style = MaterialTheme.typography.labelMedium) }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (!canViewGroups) {
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("Connectez-vous pour consulter et rejoindre les groupes paroissiaux.")
                                Button(onClick = onOpenAuth) { Text("Se connecter") }
                            }
                        }
                    } else {
                        items(groups, key = { it.id }) { g ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(g.name, fontWeight = FontWeight.Bold)
                                        g.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                                        Text("${g.membersCount} membre(s) · ${g.category}", style = MaterialTheme.typography.labelMedium)
                                    }
                                    OutlinedButton(onClick = {
                                        scope.launch {
                                            runCatching { container.apiService.toggleGroupJoin(churchId, g.id) }
                                            reload()
                                        }
                                    }) {
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
                        listOf("text" to "Texte", "photo" to "Photo", "short_video" to "Vidéo").forEach { (t, lbl) ->
                            FilterChip(selected = postType == t, onClick = { postType = t }, label = { Text(lbl) })
                        }
                    }
                    OutlinedTextField(
                        value = content,
                        onValueChange = { content = it },
                        label = { Text("Votre témoignage ou annonce") },
                        minLines = 3
                    )
                    if (postType != "text") {
                        OutlinedTextField(
                            value = mediaUrl,
                            onValueChange = { mediaUrl = it },
                            label = { Text("URL HTTPS du média") }
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
                    }
                ) { Text("Publier") }
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
                    comments.take(6).forEach { c ->
                        Text("${c.authorName}: ${c.content}", style = MaterialTheme.typography.bodyMedium)
                    }
                    if (currentUser != null) {
                        OutlinedTextField(
                            value = newComment,
                            onValueChange = { newComment = it },
                            label = { Text("Ajouter un commentaire") }
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
                        }
                    ) { Text("Envoyer") }
                }
            },
            dismissButton = {
                TextButton(onClick = { commentsPost = null }) { Text("Fermer") }
            }
        )
    }
}
