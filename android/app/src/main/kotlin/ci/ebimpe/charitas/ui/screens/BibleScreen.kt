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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.ui.theme.CharitasDeepNavy
import ci.ebimpe.charitas.ui.theme.CharitasGold
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.BookmarkBorder
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.EditNote
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ci.ebimpe.charitas.CharitasAppContainer
import ci.ebimpe.charitas.core.database.BibleBookEntity
import ci.ebimpe.charitas.core.database.BibleBookmarkEntity
import ci.ebimpe.charitas.core.database.BibleHistoryEntity
import ci.ebimpe.charitas.core.database.BibleNoteEntity
import ci.ebimpe.charitas.core.database.BibleSearchSanitizer
import ci.ebimpe.charitas.core.database.BibleVerseEntity
import ci.ebimpe.charitas.core.model.OutboxOperationType
import ci.ebimpe.charitas.core.model.ReadingPlanDayDto
import ci.ebimpe.charitas.core.network.BookmarkToggleRequest
import ci.ebimpe.charitas.core.network.NetworkClientFactory
import ci.ebimpe.charitas.core.network.TogglePlanDayRequest
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

@Composable
fun BibleScreen(container: CharitasAppContainer) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val bibleDao = container.database.bibleDao()
    val cacheDao = container.database.offlineCacheDao()
    val churchId by container.repository.activeChurchId.collectAsState()
    val currentUser by container.repository.currentUser.collectAsState()

    val prefs by container.sessionVault.preferencesFlow.collectAsState(initial = ci.ebimpe.charitas.core.security.AppPreferencesState())
    val allBooks by bibleDao.observeAllBooks().collectAsState(initial = emptyList())
    val bookmarks by bibleDao.observeBookmarks().collectAsState(initial = emptyList())
    val notes by bibleDao.observeNotes().collectAsState(initial = emptyList())
    val history by bibleDao.observeReadingHistory().collectAsState(initial = emptyList())
    val readingPlans by cacheDao.observeReadingPlans().collectAsState(initial = emptyList())
    val meditations by cacheDao.observeMeditations().collectAsState(initial = emptyList())

    var selectedTab by remember { mutableIntStateOf(0) }
    var testamentFilter by remember { mutableStateOf("ALL") }
    var selectedBook by remember { mutableStateOf<BibleBookEntity?>(null) }
    var selectedChapter by remember { mutableIntStateOf(1) }
    var verses by remember { mutableStateOf<List<BibleVerseEntity>>(emptyList()) }
    var isImporting by remember { mutableStateOf(true) }

    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<BibleVerseEntity>>(emptyList()) }
    var noteTargetVerse by remember { mutableStateOf<BibleVerseEntity?>(null) }

    LaunchedEffect(Unit) {
        isImporting = true
        container.bibleImporter.ensureImported()
        container.repository.syncSpiritualForVisitorAndMember(churchId)
        isImporting = false
    }

    LaunchedEffect(allBooks) {
        if (selectedBook == null && allBooks.isNotEmpty()) {
            selectedBook = allBooks.firstOrNull { it.id == "JHN" } ?: allBooks.first()
        }
    }

    LaunchedEffect(selectedBook, selectedChapter) {
        val book = selectedBook ?: return@LaunchedEffect
        val validChapter = selectedChapter.coerceIn(1, book.chaptersCount.coerceAtLeast(1))
        if (validChapter != selectedChapter) selectedChapter = validChapter
        verses = bibleDao.getChapterVerses(book.id, validChapter)
        if (verses.isNotEmpty()) {
            bibleDao.recordHistory(
                BibleHistoryEntity(
                    bookId = book.id,
                    bookNameFr = book.nameFr,
                    chapter = validChapter
                )
            )
        }
    }

    LaunchedEffect(searchQuery) {
        val fts = BibleSearchSanitizer.toFtsQuery(searchQuery)
        searchResults = if (fts.isBlank()) emptyList() else bibleDao.searchVersesFts(fts)
    }

    val bookmarkRefs = remember(bookmarks) { bookmarks.map { it.reference }.toSet() }
    val json = NetworkClientFactory.jsonSerializer

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
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
                verticalAlignment = Alignment.CenterVertically
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
                        text = "LA SAINTE BIBLE (CRAMPON 1923)",
                        style = MaterialTheme.typography.titleSmall,
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = "Canon catholique intégral (73 livres) · 100% hors ligne",
                        style = MaterialTheme.typography.labelSmall,
                        color = CharitasGold,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = CharitasDeepNavy,
            contentColor = CharitasGold
        ) {
            listOf("Lecture", "Recherche", "Favoris/Notes", "Plans", "Méditations").forEachIndexed { idx, label ->
                Tab(
                    selected = selectedTab == idx,
                    onClick = { selectedTab = idx },
                    text = { Text(label, maxLines = 1, fontWeight = FontWeight.SemiBold) },
                    selectedContentColor = CharitasGold,
                    unselectedContentColor = Color.White.copy(alpha = 0.7f)
                )
            }
        }

        if (isImporting && allBooks.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                    Spacer(modifier = Modifier.height(10.dp))
                    Text("Chargement des 73 livres (Bible Crampon 1923 hors ligne)…")
                }
            }
            return@Column
        }

        when (selectedTab) {
            0 -> {
                Column(modifier = Modifier.fillMaxSize()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        listOf("ALL" to "Tous (73)", "AT" to "Ancien T.", "NT" to "Nouveau T.").forEach { (code, title) ->
                            FilterChip(
                                selected = testamentFilter == code,
                                onClick = { testamentFilter = code },
                                label = { Text(title) }
                            )
                        }
                    }

                    val filteredBooks = remember(allBooks, testamentFilter) {
                        if (testamentFilter == "ALL") allBooks else allBooks.filter { it.testament == testamentFilter }
                    }

                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(filteredBooks, key = { it.id }) { b ->
                            FilterChip(
                                selected = selectedBook?.id == b.id,
                                onClick = {
                                    selectedBook = b
                                    selectedChapter = 1
                                },
                                label = { Text(b.nameFr) }
                            )
                        }
                    }

                    selectedBook?.let { book ->
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items((1..book.chaptersCount).toList()) { ch ->
                                FilterChip(
                                    selected = selectedChapter == ch,
                                    onClick = { selectedChapter = ch },
                                    label = { Text("Ch. $ch") }
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Taille : ${prefs.bibleFontSizeSp.toInt()}sp", style = MaterialTheme.typography.labelMedium)
                        Spacer(modifier = Modifier.width(10.dp))
                        Slider(
                            value = prefs.bibleFontSizeSp,
                            onValueChange = { nextSize ->
                                scope.launch { container.sessionVault.updateBibleFontSize(nextSize) }
                            },
                            valueRange = 14f..28f,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(verses, key = { it.rowId }) { v ->
                            val ref = "${v.bookNameFr} ${v.chapter}:${v.verse}"
                            val isSaved = bookmarkRefs.contains(ref)

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSaved) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface,
                                tonalElevation = 1.dp,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${v.chapter}:${v.verse}",
                                            style = MaterialTheme.typography.labelMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Row {
                                            IconButton(onClick = {
                                                scope.launch {
                                                    if (isSaved) {
                                                        bibleDao.deleteBookmarkByRef(ref)
                                                    } else {
                                                        bibleDao.upsertBookmark(
                                                            BibleBookmarkEntity(
                                                                bookId = v.bookId,
                                                                chapter = v.chapter,
                                                                verse = v.verse,
                                                                reference = ref,
                                                                verseText = v.text
                                                            )
                                                        )
                                                    }
                                                    if (currentUser != null) {
                                                        container.repository.enqueueMutation(
                                                            churchId = churchId,
                                                            type = OutboxOperationType.TOGGLE_BIBLE_BOOKMARK,
                                                            targetId = ref,
                                                            payloadJson = json.encodeToString(BookmarkToggleRequest(ref, v.text))
                                                        )
                                                    }
                                                }
                                            }) {
                                                Icon(
                                                    imageVector = if (isSaved) Icons.Rounded.Bookmark else Icons.Rounded.BookmarkBorder,
                                                    contentDescription = "Marque-page"
                                                )
                                            }
                                            IconButton(onClick = { noteTargetVerse = v }) {
                                                Icon(Icons.Rounded.EditNote, contentDescription = "Ajouter une note")
                                            }
                                            IconButton(onClick = {
                                                val send = Intent(Intent.ACTION_SEND).apply {
                                                    type = "text/plain"
                                                    putExtra(
                                                        Intent.EXTRA_TEXT,
                                                        "« ${v.text} » — $ref (La Bible Crampon 1923 · CHARITAS Saint Louis Roi d’Ebimpé)"
                                                    )
                                                }
                                                context.startActivity(Intent.createChooser(send, "Partager le verset"))
                                            }) {
                                                Icon(Icons.Rounded.Share, contentDescription = "Partager")
                                            }
                                        }
                                    }
                                    Text(
                                        text = v.text,
                                        fontSize = prefs.bibleFontSizeSp.sp,
                                        lineHeight = (prefs.bibleFontSizeSp + 7f).sp
                                    )
                                }
                            }
                        }
                    }
                }
            }

            1 -> {
                Column(modifier = Modifier.fillMaxSize().padding(12.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        label = { Text("Rechercher un mot-clé dans les 73 livres (hors ligne)") },
                        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(searchResults, key = { it.rowId }) { hit ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedBook = allBooks.firstOrNull { it.id == hit.bookId }
                                        selectedChapter = hit.chapter
                                        selectedTab = 0
                                    }
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        "${hit.bookNameFr} ${hit.chapter}:${hit.verse}",
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Text(hit.text, style = MaterialTheme.typography.bodyMedium)
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
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    item { Text("Versets favoris (${bookmarks.size})", style = MaterialTheme.typography.titleMedium) }
                    items(bookmarks, key = { it.id }) { bm ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable {
                                            selectedBook = allBooks.firstOrNull { it.id == bm.bookId }
                                            selectedChapter = bm.chapter
                                            selectedTab = 0
                                        }
                                ) {
                                    Text(bm.reference, fontWeight = FontWeight.Bold)
                                    Text(bm.verseText, style = MaterialTheme.typography.bodyMedium)
                                }
                                IconButton(onClick = { scope.launch { bibleDao.deleteBookmarkByRef(bm.reference) } }) {
                                    Icon(Icons.Rounded.Delete, contentDescription = "Supprimer")
                                }
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Notes personnelles (${notes.size})", style = MaterialTheme.typography.titleMedium)
                    }
                    items(notes, key = { it.id }) { note ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(note.reference, fontWeight = FontWeight.Bold)
                                    Text(note.noteText)
                                }
                                IconButton(onClick = { scope.launch { bibleDao.deleteNote(note.id) } }) {
                                    Icon(Icons.Rounded.Delete, contentDescription = "Supprimer")
                                }
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Historique récent de lecture", style = MaterialTheme.typography.titleMedium)
                    }
                    items(history, key = { it.id }) { h ->
                        TextButton(onClick = {
                            selectedBook = allBooks.firstOrNull { it.id == h.bookId }
                            selectedChapter = h.chapter
                            selectedTab = 0
                        }) {
                            Text("${h.bookNameFr} · Chapitre ${h.chapter}")
                        }
                    }
                }
            }

            3 -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (readingPlans.isEmpty()) {
                        item {
                            Text("Aucun plan synchronisé pour le moment. Connectez-vous au réseau au moins une fois pour télécharger les plans de lecture.")
                        }
                    }
                    items(readingPlans, key = { it.id }) { plan ->
                        val days = remember(plan.daysJson) {
                            runCatching { json.decodeFromString<List<ReadingPlanDayDto>>(plan.daysJson) }.getOrDefault(emptyList())
                        }
                        val completed = plan.completedDaysCsv.split(",").mapNotNull { it.toIntOrNull() }.toSet()

                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(plan.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text(plan.description, style = MaterialTheme.typography.bodyMedium)
                                days.forEach { d ->
                                    val checked = completed.contains(d.day)
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Checkbox(
                                            checked = checked,
                                            onCheckedChange = {
                                                scope.launch {
                                                    val next = if (checked) completed - d.day else completed + d.day
                                                    cacheDao.updatePlanProgress(plan.id, next.sorted().joinToString(","))
                                                    if (currentUser != null) {
                                                        container.repository.enqueueMutation(
                                                            churchId = churchId,
                                                            type = OutboxOperationType.TOGGLE_PLAN_DAY,
                                                            targetId = plan.id.toString(),
                                                            payloadJson = json.encodeToString(TogglePlanDayRequest(d.day))
                                                        )
                                                    }
                                                }
                                            }
                                        )
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("Jour ${d.day} · ${d.title} (${d.scripture})", fontWeight = FontWeight.Medium)
                                            Text(d.reflection, style = MaterialTheme.typography.bodyMedium)
                                        }
                                        if (checked) {
                                            Icon(Icons.Rounded.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            4 -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (meditations.isEmpty()) {
                        item {
                            Text("Les méditations téléchargées apparaîtront ici dès la première synchronisation.")
                        }
                    }
                    items(meditations, key = { it.id }) { m ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = "${m.kind.uppercase()} · ${m.publishedDate}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Text(m.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                m.scriptureRef?.let {
                                    Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                                }
                                Text(m.content, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        }
    }

    noteTargetVerse?.let { target ->
        val ref = "${target.bookNameFr} ${target.chapter}:${target.verse}"
        var noteBody by remember(target.rowId) { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { noteTargetVerse = null },
            title = { Text("Note sur $ref") },
            text = {
                OutlinedTextField(
                    value = noteBody,
                    onValueChange = { noteBody = it },
                    label = { Text("Votre réflexion ou prière") },
                    minLines = 3
                )
            },
            confirmButton = {
                Button(
                    enabled = noteBody.isNotBlank(),
                    onClick = {
                        scope.launch {
                            bibleDao.upsertNote(
                                BibleNoteEntity(
                                    bookId = target.bookId,
                                    chapter = target.chapter,
                                    verse = target.verse,
                                    reference = ref,
                                    noteText = noteBody.trim()
                                )
                            )
                            noteTargetVerse = null
                        }
                    }
                ) { Text("Enregistrer") }
            },
            dismissButton = {
                TextButton(onClick = { noteTargetVerse = null }) { Text("Annuler") }
            }
        )
    }
}
