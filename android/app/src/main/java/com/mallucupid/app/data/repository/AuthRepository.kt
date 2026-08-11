package com.mallucupid.app.data.repository

import com.mallucupid.app.data.model.AuthResponse
import com.mallucupid.app.data.remote.MalluCupidApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: MalluCupidApi
) {

    fun login(email: String, password: String): Flow<Result<AuthResponse>> = flow {
        try {
            val response = api.login(mapOf("email" to email, "password" to password))
            if (response.error != null) {
                emit(Result.failure(Exception(response.error)))
            } else {
                emit(Result.success(response))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    fun userLogin(email: String, password: String): Flow<Result<AuthResponse>> = flow {
        try {
            val response = api.userLogin(mapOf("email" to email, "password" to password))
            if (response.error != null) {
                emit(Result.failure(Exception(response.error)))
            } else {
                emit(Result.success(response))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    fun signup(email: String, username: String, password: String): Flow<Result<AuthResponse>> = flow {
        try {
            val response = api.signup(
                mapOf(
                    "email" to email,
                    "username" to username,
                    "password" to password
                )
            )
            if (response.error != null) {
                emit(Result.failure(Exception(response.error)))
            } else {
                emit(Result.success(response))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    fun verifyOtp(email: String, token: String): Flow<Result<AuthResponse>> = flow {
        try {
            val response = api.verifyOtp(mapOf("email" to email, "token" to token))
            if (response.error != null) {
                emit(Result.failure(Exception(response.error)))
            } else {
                emit(Result.success(response))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    fun getSession(): Flow<Result<AuthResponse>> = flow {
        try {
            val response = api.getSession()
            emit(Result.success(response))
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    fun logout(): Flow<Result<Boolean>> = flow {
        try {
            api.logout()
            emit(Result.success(true))
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
}