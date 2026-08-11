package com.mallucupid.app.ui.screens

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mallucupid.app.ui.theme.Rose300
import com.mallucupid.app.ui.theme.Rose500

@Composable
fun LandingScreen(onGetStarted: () -> Unit) {
    val transition = rememberInfiniteTransition(label = "landing_transition")
    val animate1 by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 4200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "animate1"
    )
    val animate2 by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "animate2"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF0F172A), Color(0xFF111827), Color(0xFF0A1223))
                )
            )
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawLandingLights(this, animate1, animate2)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "MalluCupid",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Build your creator brand with premium content, private unlocks, and fan-first engagement.",
                    fontSize = 16.sp,
                    color = Color(0xFFCBD5E1),
                    lineHeight = 24.sp,
                    textAlign = TextAlign.Start,
                    modifier = Modifier.fillMaxWidth(0.9f)
                )
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                shape = RoundedCornerShape(32.dp),
                color = Color.White.copy(alpha = 0.08f),
                tonalElevation = 8.dp,
                shadowElevation = 12.dp
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Launch your creator journey",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Join a modern creator marketplace built for premium fans and paid unlocks.",
                                fontSize = 14.sp,
                                color = Color(0xFF94A3B8),
                                lineHeight = 20.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Box(
                            modifier = Modifier
                                .width(72.dp)
                                .height(72.dp)
                                .background(
                                    brush = Brush.radialGradient(
                                        colors = listOf(Rose500.copy(alpha = 0.8f), Rose300.copy(alpha = 0.35f))
                                    ),
                                    shape = CircleShape
                                )
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = onGetStarted,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Rose500),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Text(text = "Get Started", fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

private fun drawLandingLights(scope: DrawScope, offset1: Float, offset2: Float) {
    scope.drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Rose500.copy(alpha = 0.22f), Color.Transparent),
            center = Offset(scope.size.width * 0.2f, scope.size.height * 0.22f),
            radius = scope.size.width * 0.26f
        ),
        radius = scope.size.width * 0.26f,
        center = Offset(scope.size.width * 0.2f, scope.size.height * 0.22f)
    )

    scope.drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Rose300.copy(alpha = 0.18f), Color.Transparent),
            center = Offset(scope.size.width * 0.8f, scope.size.height * 0.16f),
            radius = scope.size.width * 0.18f
        ),
        radius = scope.size.width * 0.18f,
        center = Offset(scope.size.width * 0.8f, scope.size.height * 0.16f)
    )

    val yOffset = offset1 * scope.size.height * 0.12f
    scope.drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Color(0xFF2563EB).copy(alpha = 0.22f), Color.Transparent),
            center = Offset(scope.size.width * 0.35f, scope.size.height * (0.65f + yOffset * 0.001f)),
            radius = scope.size.width * 0.14f
        ),
        radius = scope.size.width * 0.14f,
        center = Offset(scope.size.width * 0.35f, scope.size.height * (0.65f + yOffset * 0.001f))
    )

    val xOffset = offset2 * scope.size.width * 0.16f
    scope.drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Color(0xFF8B5CF6).copy(alpha = 0.18f), Color.Transparent),
            center = Offset(scope.size.width * (0.6f + xOffset * 0.001f), scope.size.height * 0.85f),
            radius = scope.size.width * 0.12f
        ),
        radius = scope.size.width * 0.12f,
        center = Offset(scope.size.width * (0.6f + xOffset * 0.001f), scope.size.height * 0.85f)
    )
}
