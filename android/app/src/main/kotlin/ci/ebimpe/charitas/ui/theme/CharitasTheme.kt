package ci.ebimpe.charitas.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import ci.ebimpe.charitas.core.security.AppThemeMode

fun parseHexColorOrDefault(hex: String?, fallback: Color): Color {
    if (hex.isNullOrBlank()) return fallback
    return runCatching { Color(android.graphics.Color.parseColor(hex.trim())) }.getOrDefault(fallback)
}

@Composable
fun CharitasTheme(
    themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    brandPrimaryHex: String? = null,
    brandAccentHex: String? = null,
    content: @Composable () -> Unit
) {
    val darkTheme = when (themeMode) {
        AppThemeMode.SYSTEM -> isSystemInDarkTheme()
        AppThemeMode.LIGHT -> false
        AppThemeMode.DARK -> true
    }

    val dynamicPrimary = parseHexColorOrDefault(brandPrimaryHex, CharitasRoyalNavy)
    val dynamicAccent = parseHexColorOrDefault(brandAccentHex, CharitasBurgundy)

    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = CharitasGold,
            onPrimary = CharitasDeepNavy,
            primaryContainer = dynamicPrimary,
            onPrimaryContainer = Color.White,
            secondary = CharitasGold,
            onSecondary = CharitasDeepNavy,
            secondaryContainer = dynamicAccent,
            onSecondaryContainer = Color.White,
            tertiary = CharitasAmber,
            background = CharitasDarkBackground,
            onBackground = CharitasTextPrimaryDark,
            surface = CharitasDarkSurface,
            onSurface = CharitasTextPrimaryDark,
            surfaceVariant = CharitasDarkSurfaceVariant,
            onSurfaceVariant = CharitasTextSecondaryDark,
            outline = CharitasBorderDark,
            error = CharitasError,
            onError = Color.White
        )
    } else {
        lightColorScheme(
            primary = dynamicPrimary,
            onPrimary = Color.White,
            primaryContainer = Color(0xFFE4ECF7),
            onPrimaryContainer = CharitasDeepNavy,
            secondary = dynamicAccent,
            onSecondary = Color.White,
            secondaryContainer = Color(0xFFFDF0E0),
            onSecondaryContainer = CharitasAmber,
            tertiary = CharitasGold,
            background = CharitasWarmIvory,
            onBackground = CharitasTextPrimaryLight,
            surface = CharitasSurfaceWhite,
            onSurface = CharitasTextPrimaryLight,
            surfaceVariant = CharitasSurfaceMuted,
            onSurfaceVariant = CharitasTextSecondaryLight,
            outline = CharitasBorderLight,
            error = CharitasError,
            onError = Color.White
        )
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = colorScheme.background.toArgb()
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CharitasTypography,
        content = content
    )
}
