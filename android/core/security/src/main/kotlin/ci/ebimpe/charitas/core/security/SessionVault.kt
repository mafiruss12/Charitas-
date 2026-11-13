package ci.ebimpe.charitas.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "charitas_user_settings")

enum class AppThemeMode {
    SYSTEM,
    LIGHT,
    DARK
}

data class NotificationPreferences(
    val dailyVerseEnabled: Boolean = true,
    val dailyVerseHour: Int = 7,
    val dailyVerseMinute: Int = 0,
    val meditationEnabled: Boolean = true,
    val meditationHour: Int = 19,
    val meditationMinute: Int = 30,
    val eventsEnabled: Boolean = true,
    val communitySyncEnabled: Boolean = true
)

data class AppPreferencesState(
    val themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    val bibleFontSizeSp: Float = 18f,
    val notifications: NotificationPreferences = NotificationPreferences()
)

interface TokenProvider {
    fun getToken(): String?
}

class SessionVault(private val context: Context) : TokenProvider {

    private val encryptedPrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "charitas_secure_session_vault",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private val _isAuthenticated = MutableStateFlow(encryptedPrefs.getString(KEY_TOKEN, null) != null)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _activeChurchId = MutableStateFlow(encryptedPrefs.getInt(KEY_CHURCH_ID, 1))
    val activeChurchId: StateFlow<Int> = _activeChurchId.asStateFlow()

    override fun getToken(): String? = encryptedPrefs.getString(KEY_TOKEN, null)

    fun getCurrentUserId(): Int? {
        val uid = encryptedPrefs.getInt(KEY_USER_ID, -1)
        return if (uid > 0) uid else null
    }

    fun getCurrentUserEmail(): String? = encryptedPrefs.getString(KEY_USER_EMAIL, null)

    fun saveSession(token: String, userId: Int, email: String, churchId: Int? = null) {
        encryptedPrefs.edit().apply {
            putString(KEY_TOKEN, token)
            putInt(KEY_USER_ID, userId)
            putString(KEY_USER_EMAIL, email)
            if (churchId != null && churchId > 0) {
                putInt(KEY_CHURCH_ID, churchId)
                _activeChurchId.value = churchId
            }
            apply()
        }
        _isAuthenticated.value = true
    }

    fun setActiveChurchId(churchId: Int) {
        if (churchId <= 0) return
        encryptedPrefs.edit().putInt(KEY_CHURCH_ID, churchId).apply()
        _activeChurchId.value = churchId
    }

    fun clearSession() {
        val preservedChurchId = encryptedPrefs.getInt(KEY_CHURCH_ID, 1)
        encryptedPrefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_EMAIL)
            .putInt(KEY_CHURCH_ID, preservedChurchId)
            .apply()
        _isAuthenticated.value = false
    }

    val preferencesFlow: Flow<AppPreferencesState> = context.settingsDataStore.data.map { prefs ->
        val themeStr = prefs[KEY_THEME_MODE] ?: AppThemeMode.SYSTEM.name
        val theme = runCatching { AppThemeMode.valueOf(themeStr) }.getOrDefault(AppThemeMode.SYSTEM)
        AppPreferencesState(
            themeMode = theme,
            bibleFontSizeSp = (prefs[KEY_BIBLE_FONT_SIZE] ?: 18f).coerceIn(14f, 28f),
            notifications = NotificationPreferences(
                dailyVerseEnabled = prefs[KEY_NOTIF_VERSE_ENABLED] ?: true,
                dailyVerseHour = prefs[KEY_NOTIF_VERSE_HOUR] ?: 7,
                dailyVerseMinute = prefs[KEY_NOTIF_VERSE_MIN] ?: 0,
                meditationEnabled = prefs[KEY_NOTIF_MED_ENABLED] ?: true,
                meditationHour = prefs[KEY_NOTIF_MED_HOUR] ?: 19,
                meditationMinute = prefs[KEY_NOTIF_MED_MIN] ?: 30,
                eventsEnabled = prefs[KEY_NOTIF_EVENTS_ENABLED] ?: true,
                communitySyncEnabled = prefs[KEY_NOTIF_COMM_ENABLED] ?: true
            )
        )
    }

    suspend fun updateThemeMode(mode: AppThemeMode) {
        context.settingsDataStore.edit { it[KEY_THEME_MODE] = mode.name }
    }

    suspend fun updateBibleFontSize(sizeSp: Float) {
        context.settingsDataStore.edit { it[KEY_BIBLE_FONT_SIZE] = sizeSp.coerceIn(14f, 28f) }
    }

    suspend fun updateNotificationPreferences(next: NotificationPreferences) {
        context.settingsDataStore.edit {
            it[KEY_NOTIF_VERSE_ENABLED] = next.dailyVerseEnabled
            it[KEY_NOTIF_VERSE_HOUR] = next.dailyVerseHour.coerceIn(0, 23)
            it[KEY_NOTIF_VERSE_MIN] = next.dailyVerseMinute.coerceIn(0, 59)
            it[KEY_NOTIF_MED_ENABLED] = next.meditationEnabled
            it[KEY_NOTIF_MED_HOUR] = next.meditationHour.coerceIn(0, 23)
            it[KEY_NOTIF_MED_MIN] = next.meditationMinute.coerceIn(0, 59)
            it[KEY_NOTIF_EVENTS_ENABLED] = next.eventsEnabled
            it[KEY_NOTIF_COMM_ENABLED] = next.communitySyncEnabled
        }
    }

    companion object {
        private const val KEY_TOKEN = "session_bearer_token"
        private const val KEY_USER_ID = "session_user_id"
        private const val KEY_USER_EMAIL = "session_user_email"
        private const val KEY_CHURCH_ID = "active_church_id"

        private val KEY_THEME_MODE = stringPreferencesKey("theme_mode")
        private val KEY_BIBLE_FONT_SIZE = floatPreferencesKey("bible_font_size_sp")
        private val KEY_NOTIF_VERSE_ENABLED = booleanPreferencesKey("notif_verse_enabled")
        private val KEY_NOTIF_VERSE_HOUR = intPreferencesKey("notif_verse_hour")
        private val KEY_NOTIF_VERSE_MIN = intPreferencesKey("notif_verse_min")
        private val KEY_NOTIF_MED_ENABLED = booleanPreferencesKey("notif_med_enabled")
        private val KEY_NOTIF_MED_HOUR = intPreferencesKey("notif_med_hour")
        private val KEY_NOTIF_MED_MIN = intPreferencesKey("notif_med_min")
        private val KEY_NOTIF_EVENTS_ENABLED = booleanPreferencesKey("notif_events_enabled")
        private val KEY_NOTIF_COMM_ENABLED = booleanPreferencesKey("notif_comm_enabled")
    }
}
