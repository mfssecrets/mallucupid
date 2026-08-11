package com.mallucupid.app.data.remote

import android.content.Context
import androidx.core.content.edit
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import java.util.concurrent.ConcurrentHashMap

class PersistentCookieJar(context: Context) : CookieJar {
    private val sharedPreferences = context.getSharedPreferences("mallucupid_cookies", Context.MODE_PRIVATE)
    private val cookies = ConcurrentHashMap<String, MutableMap<String, Cookie>>()

    init {
        val allCookies = sharedPreferences.all
        for ((key, value) in allCookies) {
            val cookieString = value as? String ?: continue
            val cookie = parseCookie(cookieString) ?: continue
            val domain = cookie.domain
            val domainCookies = cookies.getOrPut(domain) { ConcurrentHashMap() }
            domainCookies[cookie.name] = cookie
        }
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val domain = url.host
        val domainCookies = this.cookies.getOrPut(domain) { ConcurrentHashMap() }
        for (cookie in cookies) {
            domainCookies[cookie.name] = cookie
            sharedPreferences.edit {
                putString("${domain}_${cookie.name}", serializeCookie(cookie))
            }
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val result = mutableListOf<Cookie>()
        val host = url.host
        
        // Exact match
        cookies[host]?.values?.let { result.addAll(it) }
        
        // Parent domains (simplistic implementation)
        for ((domain, domainCookies) in cookies) {
            if (host.endsWith(domain) && host != domain) {
                result.addAll(domainCookies.values)
            }
        }
        
        return result.filter { it.expiresAt > System.currentTimeMillis() }
    }

    private fun serializeCookie(cookie: Cookie): String {
        return "${cookie.name}|${cookie.value}|${cookie.expiresAt}|${cookie.domain}|${cookie.path}|${cookie.secure}|${cookie.httpOnly}|${cookie.hostOnly}"
    }

    private fun parseCookie(s: String): Cookie? {
        val parts = s.split("|")
        if (parts.size < 8) return null
        return try {
            Cookie.Builder()
                .name(parts[0])
                .value(parts[1])
                .expiresAt(parts[2].toLong())
                .domain(parts[3])
                .path(parts[4])
                .apply { if (parts[5].toBoolean()) secure() }
                .apply { if (parts[6].toBoolean()) httpOnly() }
                .build()
        } catch (ignored: Exception) {
            null
        }
    }

    fun clear() {
        cookies.clear()
        sharedPreferences.edit { clear() }
    }
}