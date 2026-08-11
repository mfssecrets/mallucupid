package com.mallucupid.app.data.repository

import com.mallucupid.app.data.model.CreatorPost
import com.mallucupid.app.data.remote.MalluCupidApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PostRepository @Inject constructor(
    private val api: MalluCupidApi
) {

    // Simple implementation for now, documented flow requires multi-step
    fun createPost(caption: String, price: Double, isPaid: Boolean): Flow<Result<CreatorPost>> = flow {
        // Implementation would involve uploading media first
        emit(Result.failure(Exception("Media upload not fully implemented in mobile MVP yet")))
    }
}