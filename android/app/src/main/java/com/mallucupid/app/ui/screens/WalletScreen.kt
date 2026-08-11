package com.mallucupid.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mallucupid.app.ui.theme.GlassCard
import com.mallucupid.app.ui.theme.MalluCupidTheme
import com.mallucupid.app.ui.theme.Rose500

@Composable
fun WalletScreen(
    viewModel: WalletViewModel
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = "My Wallet", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Rose500)
        Spacer(modifier = Modifier.height(32.dp))

        when (uiState) {
            is WalletUiState.Loading -> {
                CircularProgressIndicator(color = Rose500)
            }
            is WalletUiState.Success -> {
                val data = (uiState as WalletUiState.Success).data
                WalletContent(data)
            }
            is WalletUiState.Error -> {
                Text(text = (uiState as WalletUiState.Error).message, color = Color.Red)
            }
        }
    }
}

@Composable
fun WalletContent(data: Map<String, Any>) {
    val balance = data["available_balance"] ?: 0.0
    val lifetime = data["lifetime_earnings"] ?: 0.0

    Column(modifier = Modifier.fillMaxWidth()) {
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = "Available Balance", fontSize = 16.sp, color = Color.Gray)
                Text(text = "₹$balance", fontSize = 32.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = "Lifetime Earnings", fontSize = 16.sp, color = Color.Gray)
                Text(text = "₹$lifetime", fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = { /* Withdrawal implementation */ },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Rose500)
        ) {
            Text("Request Withdrawal")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun WalletPreview() {
    MalluCupidTheme {
        Box(modifier = Modifier.padding(16.dp)) {
            WalletContent(
                data = mapOf(
                    "available_balance" to 1250.50,
                    "lifetime_earnings" to 5000.00
                )
            )
        }
    }
}