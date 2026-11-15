package ci.ebimpe.charitas.data.tv

import ci.ebimpe.charitas.core.model.PublicTvCatalogResponseDto
import ci.ebimpe.charitas.core.model.TvChannelDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicReference

/**
 * Catalogue TV CHARITAS basé uniquement sur la catégorie **Religious**
 * de [iptv-org/iptv](https://github.com/iptv-org/iptv) :
 * https://iptv-org.github.io/iptv/categories/religious.m3u
 *
 * Filtrage supplémentaire : exclusion des chaînes clairement non chrétiennes
 * (même playlist "religious" iptv-org contient parfois d'autres confessions).
 */
object TvFallbackCatalog {

    const val RELIGIOUS_M3U_URL =
        "https://iptv-org.github.io/iptv/categories/religious.m3u"

    private val cache = AtomicReference<PublicTvCatalogResponseDto?>(null)
    private var cacheAtMs: Long = 0
    private const val CACHE_TTL_MS = 30 * 60 * 1000L

    private val preferredKeywords = listOf(
        "3abn", "ewtn", "tbn", "daystar", "hope channel", "god tv", "godtv",
        "vatican", "kto", "emci", "shalom", "bethel", "gospel", "jesus",
        "christ", "christian", "church", "catholic", "catholique", "chrétien",
        "chretien", "louange", "bible", "evangel", "évang", "mariam", "mariologie",
        "telepace", "lumen", "cnl", "sonlife", "amazing", "maranatha", "redeem"
    )

    private val nonChristian = Regex(
        """\b(islam|islamic|quran|qur.?an|coran|muslim|makkah|mecca|madina|medina|""" +
            """shia|sunni|azan|adhan|iqra|hindu|hinduism|buddhist|buddh|""" +
            """sikh|jewish|torah|judaism|scientolog|peace\s*tv|huda\s*tv)\b""",
        RegexOption.IGNORE_CASE
    )

    private val embeddedChannels = listOf(
        TvChannelDto(
            id = -101,
            churchId = 1,
            name = "Evandis Gospel TV",
            category = "Gospel et louange",
            language = "Français",
            country = "France",
            logoUrl = "https://i.imgur.com/v8TiqhH.png",
            streamUrl = "https://evandis.streamakaci.tv/str_evandis_evandis/str_evandis_multi/playlist.m3u8",
            streamFormat = "hls",
            description = "Chaîne chrétienne francophone dédiée au gospel, à la louange et aux temps de prière.",
            currentProgram = "Louange & Gospel en direct",
            isRecommended = true,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        ),
        TvChannelDto(
            id = -102,
            churchId = 1,
            name = "3ABN French",
            category = "TV chrétiennes francophones",
            language = "Français",
            country = "International",
            logoUrl = "https://i.imgur.com/B5gsM7m.png",
            streamUrl = "https://3abn.bozztv.com/3abn2/Fre_live/smil:Fre_live.smil/playlist.m3u8",
            streamFormat = "hls",
            description = "Programmes chrétiens francophones : enseignements bibliques, santé et famille.",
            currentProgram = "Émissions chrétiennes en français",
            isRecommended = true,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        ),
        TvChannelDto(
            id = -103,
            churchId = 1,
            name = "KTO Télévision Catholique",
            category = "TV chrétiennes francophones",
            language = "Français",
            country = "France / International",
            logoUrl = "https://i.imgur.com/b5JjC4D.png",
            streamUrl = "https://live-kto.akamaized.net/hls/live/2033285/KTO/master.m3u8",
            streamFormat = "hls",
            description = "Télévision catholique francophone : messes, méditations et vie de l’Église.",
            currentProgram = "Programmes & Messes en direct",
            isRecommended = true,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        ),
        TvChannelDto(
            id = -104,
            churchId = 1,
            name = "EWTN Africa-Asia",
            category = "TV chrétiennes africaines",
            language = "Anglais / Afrique",
            country = "Afrique",
            logoUrl = "https://play-lh.googleusercontent.com/3716tvZCgzpIt-X1giV8jKwCdC8zwOI4eMUfO_ETWzNX6eGKIi2RiUK9a_fr6BCzjw",
            streamUrl = "https://cdn3.wowza.com/1/ZVBYYXFLLzE0c3NC/Qk1FMURC/hls/live/playlist.m3u8",
            streamFormat = "hls",
            description = "Réseau catholique mondial : messes quotidiennes, chapelet et catéchèse.",
            currentProgram = "EWTN Catholic Live Feed",
            isRecommended = true,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        ),
        TvChannelDto(
            id = -105,
            churchId = 1,
            name = "Hope Channel Africa",
            category = "TV chrétiennes africaines",
            language = "Anglais / Afrique",
            country = "Afrique du Sud",
            logoUrl = "https://i.imgur.com/SFacyYO.png",
            streamUrl = "https://jstre.am/live/jsl:i1onRBELcGV.m3u8",
            streamFormat = "hls",
            description = "Télévision chrétienne africaine axée sur l’espérance et l’Évangile.",
            currentProgram = "Hope Africa Direct",
            isRecommended = true,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        ),
        TvChannelDto(
            id = -106,
            churchId = 1,
            name = "Catholic TV",
            category = "TV chrétiennes internationales",
            language = "Anglais",
            country = "États-Unis",
            logoUrl = "https://i.imgur.com/EL0rWD3.png",
            streamUrl = "https://catholictvhd-lh.akamaized.net/hls/live/2043390/CTVLiveHD/master.m3u8",
            streamFormat = "hls",
            description = "Liturgie catholique, messes en direct et méditations.",
            currentProgram = "Messe & Vie de l’Église",
            isRecommended = false,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        ),
        TvChannelDto(
            id = -107,
            churchId = 1,
            name = "Catholic Faith Network",
            category = "Cultes en direct",
            language = "Anglais",
            country = "États-Unis",
            logoUrl = "https://upload.wikimedia.org/wikipedia/en/0/07/Catholic_Faith_Network_2018.png",
            streamUrl = "https://uni8rtmp.tulix.tv/cfntv/cfntv/playlist.m3u8",
            streamFormat = "hls",
            description = "Célébrations eucharistiques en direct et commentaires bibliques.",
            currentProgram = "Célébrations en direct",
            isRecommended = false,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        ),
        TvChannelDto(
            id = -108,
            churchId = 1,
            name = "Shalom World Prayer",
            category = "Prédications",
            language = "Anglais",
            country = "International",
            logoUrl = "https://i.imgur.com/uUrTto3.png",
            streamUrl = "https://broadcaster-1.cclouds.in/srt-4/channel4_abr/playlist.m3u8",
            streamFormat = "hls",
            description = "Chaîne catholique d’adoration, prédications, chapelet et intercession.",
            currentProgram = "Intercession & Prédications",
            isRecommended = false,
            isValidated = true,
            isActive = true,
            streamStatus = "operational"
        )
    )

    fun embeddedCatalog(
        churchId: Int = 1,
        category: String? = null,
        search: String? = null
    ): PublicTvCatalogResponseDto {
        return filterCatalog(
            PublicTvCatalogResponseDto(
                churchId = churchId,
                churchName = "CHARITAS TV — Église Saint Louis Roi d’Ebimpé",
                verifiedAt = null,
                categories = embeddedChannels.map { it.category }.distinct().sorted(),
                channels = embeddedChannels.map { it.copy(churchId = churchId) },
                recommendedChannels = embeddedChannels.filter { it.isRecommended }.map { it.copy(churchId = churchId) },
                broadcasts = emptyList()
            ),
            churchId = churchId,
            category = category,
            search = search,
            maxChannels = 250
        )
    }

    suspend fun load(
        churchId: Int = 0,
        category: String? = null,
        search: String? = null,
        maxChannels: Int = 250,
        forceRefresh: Boolean = false
    ): PublicTvCatalogResponseDto = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val cached = cache.get()
        val base = if (!forceRefresh && cached != null && now - cacheAtMs < CACHE_TTL_MS) {
            cached
        } else {
            val entries = runCatching {
                fetchAndParseM3u(RELIGIOUS_M3U_URL)
                    .filter { isChristianReligious(it.name, it.group) }
            }.getOrDefault(emptyList())

            var parsedChannels = entries.mapIndexed { index, e ->
                TvChannelDto(
                    id = -(index + 1),
                    churchId = churchId,
                    name = e.name,
                    category = mapCategory(e.name, e.group),
                    language = e.language,
                    country = e.country,
                    logoUrl = e.logo,
                    streamUrl = e.url,
                    streamFormat = if (e.url.contains(".m3u8", true)) "hls" else "hls",
                    description = "Source : iptv-org (Religious) — github.com/iptv-org/iptv",
                    isRecommended = preferredKeywords.any { k -> e.name.lowercase().contains(k) },
                    isValidated = true,
                    isActive = true,
                    streamStatus = "operational"
                )
            }
            parsedChannels = parsedChannels.sortedByDescending { ch ->
                preferredKeywords.count { k -> ch.name.lowercase().contains(k) } * 10 +
                    (if (ch.streamUrl.startsWith("https", true)) 5 else 0)
            }

            val channels = (embeddedChannels.map { it.copy(churchId = churchId) } + parsedChannels)
                .distinctBy { it.streamUrl }

            val dto = PublicTvCatalogResponseDto(
                churchId = churchId,
                churchName = "CHARITAS TV — Église Saint Louis Roi d’Ebimpé",
                verifiedAt = null,
                categories = channels.map { it.category }.distinct().sorted(),
                channels = channels,
                recommendedChannels = channels.filter { it.isRecommended }.ifEmpty { channels.take(12) },
                broadcasts = emptyList()
            )
            cache.set(dto)
            cacheAtMs = now
            dto
        }

        filterCatalog(base, churchId, category, search, maxChannels)
    }

    private fun filterCatalog(
        base: PublicTvCatalogResponseDto,
        churchId: Int,
        category: String?,
        search: String?,
        maxChannels: Int
    ): PublicTvCatalogResponseDto {
        var channels = base.channels
        if (!category.isNullOrBlank() &&
            !category.equals("Toutes", true) &&
            !category.equals("all", true)
        ) {
            val q = category.lowercase()
            channels = channels.filter {
                it.category.lowercase().contains(q) || it.name.lowercase().contains(q)
            }
        }
        if (!search.isNullOrBlank()) {
            val q = search.lowercase()
            channels = channels.filter {
                "${it.name} ${it.category} ${it.country ?: ""} ${it.language}".lowercase().contains(q)
            }
        }
        channels = channels.take(maxChannels)
        return base.copy(
            churchId = churchId,
            categories = base.categories.ifEmpty { channels.map { it.category }.distinct().sorted() },
            channels = channels,
            recommendedChannels = channels.filter { it.isRecommended }.ifEmpty { channels.take(8) }
        )
    }

    private fun isChristianReligious(name: String, group: String): Boolean {
        val hay = "$name $group"
        if (nonChristian.containsMatchIn(hay)) return false
        // Playlist is already category=religious from iptv-org
        return true
    }

    private fun mapCategory(name: String, group: String): String {
        val n = name.lowercase()
        return when {
            listOf("gospel", "louange", "worship", "praise").any { n.contains(it) } -> "Gospel et louange"
            listOf("preach", "sermon", "prédic", "predic", "enseignement", "bible").any { n.contains(it) } ->
                "Prédications"
            listOf("africa", "ivoire", "congo", "nigeria", "kenya", "ghana", "camer").any { n.contains(it) } ->
                "TV chrétiennes africaines"
            listOf("france", "kto", "emci", "francophone", "belgium", "suisse").any { n.contains(it) } ->
                "TV chrétiennes francophones"
            listOf("live", "culte", "mass", "messe").any { n.contains(it) } -> "Cultes en direct"
            else -> "TV chrétiennes internationales"
        }
    }

    private data class M3uEntry(
        val name: String,
        val url: String,
        val logo: String?,
        val group: String,
        val language: String,
        val country: String?
    )

    private fun fetchAndParseM3u(url: String): List<M3uEntry> {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20_000
            readTimeout = 30_000
            requestMethod = "GET"
            setRequestProperty("User-Agent", "CharitasTV/1.0 (+https://github.com/iptv-org/iptv)")
            setRequestProperty("Accept", "application/vnd.apple.mpegurl, audio/x-mpegurl, text/plain, */*")
        }
        try {
            if (conn.responseCode !in 200..299) error("Playlist iptv-org HTTP ${conn.responseCode}")
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            return parseM3u(text)
        } finally {
            conn.disconnect()
        }
    }

    private fun parseM3u(text: String): List<M3uEntry> {
        val out = mutableListOf<M3uEntry>()
        val lines = text.lines()
        var i = 0
        while (i < lines.size) {
            val line = lines[i].trim()
            if (line.startsWith("#EXTINF", ignoreCase = true)) {
                val name = line.substringAfterLast(",").trim().ifBlank { "Chaîne religieuse" }
                val logo = Regex("tvg-logo=\"([^\"]+)\"").find(line)?.groupValues?.getOrNull(1)
                val group = Regex("group-title=\"([^\"]+)\"").find(line)?.groupValues?.getOrNull(1)
                    ?: "Religious"
                val country = Regex("tvg-id=\"([^\"]+)\"").find(line)?.groupValues?.getOrNull(1)
                    ?.substringAfterLast('.')
                    ?.takeIf { it.length in 2..3 }
                var j = i + 1
                while (j < lines.size && lines[j].trim().startsWith("#")) j++
                if (j < lines.size) {
                    val stream = lines[j].trim()
                    if (stream.startsWith("http://") || stream.startsWith("https://")) {
                        out += M3uEntry(name, stream, logo, group, "—", country)
                    }
                    i = j
                }
            }
            i++
        }
        return out
    }
}
