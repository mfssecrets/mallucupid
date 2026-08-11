package com.mallucupid.app.data.repository

import com.mallucupid.app.data.model.ProfileResponse
import com.mallucupid.app.data.remote.MalluCupidApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(
    private val api: MalluCupidApi
) {

    fun getProfile(): Flow<Result<ProfileResponse>> = flow {
        try {
            val response = api.getProfile()
            if (response.error != null) {
                emit(Result.failure(Exception(response.error)))
            } else {
                emit(Result.success(response))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    fun updateProfile(data: Map<String, Any?>): Flow<Result<ProfileResponse>> = flow {
        try {
            val response = api.updateProfile(data)
            if (response.error != null) {
                emit(Result.failure(Exception(response.error)))
            } else {
                emit(Result.success(response))
            }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
}