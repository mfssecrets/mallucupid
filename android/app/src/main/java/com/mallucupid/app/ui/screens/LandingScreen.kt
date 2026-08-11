package com.mallucupid.app.ui.screens

import androidx.compose.animation.core.LinearEasing
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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mallucupid.app.ui.theme.Rose100
import com.mallucupid.app.ui.theme.Rose300
import com.mallucupid.app.ui.theme.Rose500

@Composable
fun LandingScreen(onGetStarted: () -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "orbit")
    val offset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "orbit"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Rose100, Color.White, Rose300)
                )
            )
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawAnimatedGlow(this, offset)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 40.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Surface(
                shape = RoundedCornerShape(28.dp),
                tonalElevation = 3.dp,
                shadowElevation = 8.dp,
                color = Color.White.copy(alpha = 0.9f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "MalluCupid",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = Rose500
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "A modern creator platform for sharing, unlocking, and connecting with your audience.",
                        fontSize = 16.sp,
                        color = Color(0xFF4B5563),
                        lineHeight = 24.sp
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = onGetStarted,
                        colors = ButtonDefaults.buttonColors(containerColor = Rose500),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Get Started", fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

private fun drawAnimatedGlow(scope: DrawScope, offset: Float) {
    val centerX = scope.size.width * 0.5f
    val centerY = scope.size.height * (0.25f + offset * 0.2f)
    val glowRadius = scope.size.width * 0.32f
    scope.drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Rose300.copy(alpha = 0.42f), Color.Transparent),
            center = Offset(centerX, centerY),
            radius = glowRadius
        ),
        radius = glowRadius,
        center = Offset(centerX, centerY)
    )

    scope.drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(Rose500.copy(alpha = 0.22f), Color.Transparent),
            center = Offset(scope.size.width * 0.8f, scope.size.height * 0.72f),
            radius = scope.size.width * 0.2f
        ),
        radius = scope.size.width * 0.2f,
        center = Offset(scope.size.width * 0.8f, scope.size.height * 0.72f)
    )
}
