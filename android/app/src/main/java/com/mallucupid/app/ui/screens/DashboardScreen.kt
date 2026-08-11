package com.mallucupid.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.mallucupid.app.ui.theme.GlassCard
import com.mallucupid.app.ui.theme.MalluCupidTheme
import com.mallucupid.app.ui.theme.Rose500

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        when (uiState) {
            is DashboardUiState.Loading -> {
                CircularProgressIndicator(
                    color = Rose500,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
            is DashboardUiState.Success -> {
                DashboardContent((uiState as DashboardUiState.Success).response)
            }
            is DashboardUiState.Error -> {
                Text(
                    text = (uiState as DashboardUiState.Error).message,
                    color = Color.Red,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }
    }
}

@Composable
fun DashboardContent(data: com.mallucupid.app.data.model.ProfileResponse) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Hi, ${data.profile?.fullName ?: data.profile?.username ?: "Creator"}",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(text = "@${data.profile?.username ?: "username"}", color = Color.Gray)
            }
            
            AsyncImage(
                model = data.profile?.avatarUrl,
                contentDescription = "Avatar",
                modifier = Modifier
                    .size(64.dp)
                    .padding(4.dp),
                contentScale = ContentScale.Crop
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            StatCard("Posts", data.stats?.posts ?: 0, Modifier.weight(1f))
            StatCard("Followers", data.stats?.followers ?: 0, Modifier.weight(1f))
            StatCard("Following", data.stats?.following ?: 0, Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(text = "My Posts", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        Spacer(modifier = Modifier.height(16.dp))

        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(data.posts ?: emptyList()) { post ->
                AsyncImage(
                    model = post.mediaUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .aspectRatio(1f)
                        .padding(2.dp),
                    contentScale = ContentScale.Crop
                )
            }
        }
    }
}

@Composable
fun StatCard(label: String, value: Int, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = value.toString(), fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text(text = label, fontSize = 12.sp, color = Color.Gray)
        }
    }
}

@Preview(showBackground = true)
@Composable
fun DashboardPreview() {
    MalluCupidTheme {
        DashboardContent(
            data = com.mallucupid.app.data.model.ProfileResponse(
                profile = null, // Mock profile
                stats = com.mallucupid.app.data.model.ProfileStats(10, 100, 50),
                posts = emptyList()
            )
        )
    }
}