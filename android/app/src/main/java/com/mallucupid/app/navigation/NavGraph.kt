package com.mallucupid.app.navigation

import android.util.Log
import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.mallucupid.app.ui.screens.*

private const val TAG = "MalluCupidNav"

sealed class Screen(val route: String) {
    object Landing : Screen("landing")
    object Login : Screen("login")
    object Signup : Screen("signup")
    object OTP : Screen("otp/{email}") {
        fun createRoute(email: String) = "otp/$email"
    }
    object CreatorDashboard : Screen("creator_dashboard")
    object FanDashboard : Screen("fan_dashboard")
    object WebShell : Screen("web_shell/{path}") {
        fun createRoute(path: String) = "web_shell/${path.removePrefix("/")}" 
    }
}

@Composable
fun MalluCupidNavGraph(
    navController: NavHostController = rememberNavController(),
    startDestination: String = Screen.Landing.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Landing.route) {
            LandingScreen(
                onGetStarted = {
                    Log.d(TAG, "GetStarted clicked, navigating to ${Screen.Login.route}")
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Landing.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Login.route) {
            val viewModel: LoginViewModel = hiltViewModel()
            LoginScreen(
                viewModel = viewModel,
                onLoginSuccess = { role ->
                    Log.d(TAG, "Login success, role=$role")
                    if (role == "creator") {
                        navController.navigate(Screen.CreatorDashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    } else {
                        navController.navigate(Screen.FanDashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                },
                onNavigateToSignup = {
                    navController.navigate(Screen.Signup.route)
                }
            )
        }

        composable(Screen.Signup.route) {
            val viewModel: SignupViewModel = hiltViewModel()
            SignupScreen(
                viewModel = viewModel,
                onSignupSuccess = { email ->
                    Log.d(TAG, "Signup success for $email")
                    navController.navigate(Screen.OTP.createRoute(email))
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                }
            )
        }

        composable(Screen.OTP.route) { backStackEntry ->
            val email = backStackEntry.arguments?.getString("email") ?: ""
            val viewModel: LoginViewModel = hiltViewModel()
            OTPScreen(
                email = email,
                viewModel = viewModel,
                onVerifySuccess = {
                    navController.navigate(Screen.CreatorDashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.CreatorDashboard.route) {
            CreatorMainScreen()
        }

        composable(Screen.FanDashboard.route) {
            FanDashboardScreen(
                onNavigateToWebApp = { path ->
                    navController.navigate(Screen.WebShell.createRoute(path))
                }
            )
        }

        composable(Screen.WebShell.route) { backStackEntry ->
            val webPath = backStackEntry.arguments?.getString("path") ?: ""
            val targetUrl = if (webPath.isEmpty()) {
                "https://www.mallucupid.com"
            } else {
                "https://www.mallucupid.com/$webPath"
            }
            WebViewScreen(
                url = targetUrl,
                title = "MalluCupid",
                onBack = {
                    if (!navController.popBackStack()) {
                        navController.navigate(Screen.FanDashboard.route) {
                            popUpTo(Screen.FanDashboard.route) { inclusive = true }
                        }
                    }
                }
            )
        }
    }
}
