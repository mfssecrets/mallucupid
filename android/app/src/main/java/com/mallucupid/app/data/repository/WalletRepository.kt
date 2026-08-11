package com.mallucupid.app.data.repository

import com.mallucupid.app.data.remote.MalluCupidApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WalletRepository @Inject constructor(
    private val api: MalluCupidApi
) {
    fun getWallet(): Flow<Result<Map<String, Any>>> = flow {
        try {
            val response = api.getWallet()
            emit(Result.success(response))
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
}