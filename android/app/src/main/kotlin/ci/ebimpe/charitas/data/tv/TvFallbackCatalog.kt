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
            val entries = fetchAndParseM3u(RELIGIOUS_M3U_URL)
                .filter { isChristianReligious(it.name, it.group) }
            var channels = entries.mapIndexed { index, e ->
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
            channels = channels.sortedByDescending { ch ->
                preferredKeywords.count { k -> ch.name.lowercase().contains(k) } * 10 +
                    (if (ch.streamUrl.startsWith("https", true)) 5 else 0)
            }
            val dto = PublicTvCatalogResponseDto(
                churchId = churchId,
                churchName = "CHARITAS TV — Chaînes religieuses (iptv-org)",
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
        base.copy(
            churchId = churchId,
            categories = channels.map { it.category }.distinct().sorted(),
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
