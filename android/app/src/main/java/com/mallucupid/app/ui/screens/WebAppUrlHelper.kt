package com.mallucupid.app.ui.screens

import android.net.Uri

fun shouldOpenInApp(url: String, baseUrl: String): Boolean {
    if (url.isBlank()) return false

    val normalizedUrl = url.trim()
    if (normalizedUrl.startsWith("mailto:") || normalizedUrl.startsWith("tel:") || normalizedUrl.startsWith("sms:")) {
        return false
    }

    if (normalizedUrl.startsWith("/")) {
        return true
    }

    val parsed = Uri.parse(normalizedUrl)
    val host = parsed.host?.lowercase().orEmpty()
    val baseHost = Uri.parse(baseUrl).host?.lowercase().orEmpty()

    return when {
        host.isEmpty() -> true
        host == baseHost || host.endsWith(".$baseHost") -> true
        host == "localhost" || host.startsWith("127.0.0.1") -> true
        else -> false
    }
}
