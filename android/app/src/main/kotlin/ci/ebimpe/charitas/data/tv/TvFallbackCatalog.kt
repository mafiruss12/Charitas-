package ci.ebimpe.charitas.data.tv

import ci.ebimpe.charitas.core.model.PublicTvCatalogResponseDto
import ci.ebimpe.charitas.core.model.TvChannelDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * Catalogue TV de secours quand l'API CHARITAS (/api/public/tv/catalog) est
 * indisponible (404, HTML, timeout). Source publique iptv-org religious.
 */
object TvFallbackCatalog {

    const val RELIGIOUS_M3U_URL =
        "https://iptv-org.github.io/iptv/categories/religious.m3u"

    private val preferredKeywords = listOf(
        "3abn", "ewtn", "tbn", "daystar", "hope", "god tv", "godtv",
        "vatican", "kto", "emci", "shalom", "bethel", "gospel", "jesus",
        "church", "catholic", "catholique", "christian", "chrétien", "louange"
    )

    suspend fun load(
        churchId: Int = 0,
        category: String? = null,
        search: String? = null,
        maxChannels: Int = 80
    ): PublicTvCatalogResponseDto = withContext(Dispatchers.IO) {
        val entries = fetchAndParseM3u(RELIGIOUS_M3U_URL)
        var channels = entries.mapIndexed { index, e ->
            TvChannelDto(
                id = -(index + 1),
                churchId = churchId,
                name = e.name,
                category = e.group.ifBlank { "TV chrétiennes internationales" },
                language = e.language,
                country = e.country,
                logoUrl = e.logo,
                streamUrl = e.url,
                streamFormat = if (e.url.contains(".m3u8", ignoreCase = true)) "hls" else "hls",
                description = "Flux public (secours iptv-org)",
                isRecommended = preferredKeywords.any { k -> e.name.lowercase().contains(k) },
                isValidated = true,
                isActive = true,
                streamStatus = "operational"
            )
        }

        // Prefer Christian-named channels first
        channels = channels.sortedByDescending { ch ->
            preferredKeywords.count { k -> ch.name.lowercase().contains(k) }
        }

        if (!category.isNullOrBlank() && !category.equals("Toutes", true)) {
            val q = category.lowercase()
            channels = channels.filter {
                it.category.lowercase().contains(q) || it.name.lowercase().contains(q)
            }
        }
        if (!search.isNullOrBlank()) {
            val q = search.lowercase()
            channels = channels.filter {
                "${it.name} ${it.category} ${it.country ?: ""}".lowercase().contains(q)
            }
        }

        channels = channels.take(maxChannels)
        val categories = channels.map { it.category }.distinct().sorted()
        val recommended = channels.filter { it.isRecommended }.ifEmpty { channels.take(8) }

        PublicTvCatalogResponseDto(
            churchId = churchId,
            churchName = "CHARITAS TV (catalogue secours)",
            verifiedAt = null,
            categories = categories,
            channels = channels,
            recommendedChannels = recommended,
            broadcasts = emptyList()
        )
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
            connectTimeout = 15_000
            readTimeout = 20_000
            requestMethod = "GET"
            setRequestProperty("User-Agent", "CharitasAndroid/1.0")
            setRequestProperty("Accept", "*/*")
        }
        try {
            if (conn.responseCode !in 200..299) error("M3U HTTP ${conn.responseCode}")
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
                val name = line.substringAfterLast(",").trim().ifBlank { "Chaîne" }
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
                    if (stream.startsWith("http")) {
                        out += M3uEntry(
                            name = name,
                            url = stream,
                            logo = logo,
                            group = group,
                            language = "—",
                            country = country
                        )
                    }
                    i = j
                }
            }
            i++
        }
        return out
    }
}
