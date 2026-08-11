package com.mallucupid.app.data.repository

import com.mallucupid.app.data.remote.MalluCupidApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionRepository @Inject constructor(
    private val api: MalluCupidApi
) {
    fun getSession(): Flow<Result<Map<String, Any>>> = flow {
        try {
            val response = api.getSession()
            emit(Result.success(mapOf("user" to (response.user ?: emptyMap<String, Any>()))))
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
}
