package ci.ebimpe.charitas.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ci.ebimpe.charitas.R
import ci.ebimpe.charitas.ui.theme.CharitasGold
import ci.ebimpe.charitas.ui.theme.CharitasRoyalNavy

enum class AnimatedLogoIntensity {
    SUBTLE,
    CARD,
    HERO,
    SPLASH
}

@Composable
fun AnimatedParishLogo(
    size: Dp = 44.dp,
    intensity: AnimatedLogoIntensity = AnimatedLogoIntensity.CARD,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "charitas_logo_motion")

    val orbitAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 7500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "orbit_angle"
    )

    val floatScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (intensity == AnimatedLogoIntensity.SUBTLE) 1.02f else 1.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "float_scale"
    )

    val rippleProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ripple_progress"
    )

    val revealScale = remember { Animatable(if (intensity == AnimatedLogoIntensity.SPLASH) 0.58f else 1f) }
    LaunchedEffect(intensity) {
        if (intensity == AnimatedLogoIntensity.SPLASH) {
            revealScale.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 700, easing = FastOutSlowInEasing)
            )
        }
    }

    val ringPadding = when (intensity) {
        AnimatedLogoIntensity.SUBTLE -> 2.dp
        AnimatedLogoIntensity.CARD -> 3.dp
        AnimatedLogoIntensity.HERO -> 5.dp
        AnimatedLogoIntensity.SPLASH -> 8.dp
    }

    Box(
        modifier = modifier.size(size + ringPadding * 2),
        contentAlignment = Alignment.Center
    ) {
        if (intensity == AnimatedLogoIntensity.HERO || intensity == AnimatedLogoIntensity.SPLASH) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val baseRadius = this.size.minDimension / 2f
                val waveScale = 0.85f + rippleProgress * 0.38f
                val alpha = (1f - rippleProgress) * 0.58f
                drawCircle(
                    color = CharitasGold.copy(alpha = alpha),
                    radius = (baseRadius * waveScale).coerceAtMost(baseRadius * 1.15f),
                    style = Stroke(width = 2.dp.toPx())
                )
            }
        }

        // Rotating orbital golden/royal-blue sweep ring
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer { rotationZ = orbitAngle }
        ) {
            val strokePx = when (intensity) {
                AnimatedLogoIntensity.SUBTLE -> 1.8.dp.toPx()
                AnimatedLogoIntensity.CARD -> 2.2.dp.toPx()
                AnimatedLogoIntensity.HERO -> 2.8.dp.toPx()
                AnimatedLogoIntensity.SPLASH -> 3.5.dp.toPx()
            }
            drawCircle(
                brush = Brush.sweepGradient(
                    colors = listOf(
                        CharitasGold,
                        CharitasRoyalNavy.copy(alpha = 0.25f),
                        Color.White.copy(alpha = 0.85f),
                        CharitasGold.copy(alpha = 0.18f),
                        CharitasGold
                    )
                ),
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )
        }

        // Circular emblem with smooth breathing pulse
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(ringPadding)
                .graphicsLayer {
                    val combined = floatScale * revealScale.value
                    scaleX = combined
                    scaleY = combined
                }
                .clip(CircleShape)
                .background(Color.White)
                .border(1.5.dp, CharitasGold.copy(alpha = 0.9f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.logo_saint_louis_ebimpe),
                contentDescription = "Logo Paroisse Saint Louis Roi d’Ebimpé",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
            )
        }
    }
}
