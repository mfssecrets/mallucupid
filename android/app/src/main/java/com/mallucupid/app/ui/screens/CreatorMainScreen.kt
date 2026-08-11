package com.mallucupid.app.ui.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.mallucupid.app.ui.theme.Rose500

@Composable
fun CreatorMainScreen() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = currentRoute == "dashboard",
                    onClick = { navController.navigate("dashboard") },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                    label = { Text("Home") }
                )
                NavigationBarItem(
                    selected = currentRoute == "create_post",
                    onClick = { navController.navigate("create_post") },
                    icon = { Icon(Icons.Default.Add, contentDescription = "Create") },
                    label = { Text("Post") }
                )
                NavigationBarItem(
                    selected = currentRoute == "wallet",
                    onClick = { navController.navigate("wallet") },
                    icon = { Icon(Icons.Default.Wallet, contentDescription = "Wallet") },
                    label = { Text("Wallet") }
                )
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "dashboard",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("dashboard") {
                val viewModel: DashboardViewModel = hiltViewModel()
                DashboardScreen(viewModel = viewModel)
            }
            composable("create_post") {
                val viewModel: CreatePostViewModel = hiltViewModel()
                CreatePostScreen(
                    viewModel = viewModel,
                    onPostCreated = {
                        navController.navigate("dashboard") {
                            popUpTo("dashboard") { inclusive = true }
                        }
                    }
                )
            }
            composable("wallet") {
                val viewModel: WalletViewModel = hiltViewModel()
                WalletScreen(viewModel = viewModel)
            }
        }
    }
}
