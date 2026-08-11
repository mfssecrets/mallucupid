package com.mallucupid.app.data.remote

import com.mallucupid.app.data.model.*
import retrofit2.http.*

interface MalluCupidApi {

    @Headers("Content-Type: application/json")
    @POST("/login")
    suspend fun login(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-login")
    suspend fun userLogin(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/signup")
    suspend fun signup(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-signup")
    suspend fun userSignup(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/verify")
    suspend fun verifyOtp(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-verify")
    suspend fun userVerifyOtp(@Body body: Map<String, String>): AuthResponse

    @GET("/session")
    suspend fun getSession(): AuthResponse

    @POST("/logout")
    suspend fun logout(): AuthResponse

    @GET("/profile")
    suspend fun getProfile(): ProfileResponse

    @POST("/profile")
    suspend fun updateProfile(@Body body: Map<String, Any?>): ProfileResponse

    @GET("/exclusive-rooms")
    suspend fun getExclusiveRooms(): Map<String, List<ExclusiveRoom>>

    @GET("/wallet")
    suspend fun getWallet(): Map<String, Any>
}