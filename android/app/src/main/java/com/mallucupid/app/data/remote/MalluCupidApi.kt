package com.mallucupid.app.data.remote

import com.mallucupid.app.data.model.*
import retrofit2.http.*

interface MalluCupidApi {

    // Creator Auth
    @Headers("Content-Type: application/json")
    @POST("/login")
    suspend fun login(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/signup")
    suspend fun signup(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/verify")
    suspend fun verifyOtp(@Body body: Map<String, String>): AuthResponse

    // User (Fan) Auth
    @Headers("Content-Type: application/json")
    @POST("/user-login")
    suspend fun userLogin(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-signup")
    suspend fun userSignup(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-verify")
    suspend fun userVerifyOtp(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-resend")
    suspend fun userResendOtp(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-forgot")
    suspend fun userForgotPassword(@Body body: Map<String, String>): AuthResponse

    @Headers("Content-Type: application/json")
    @POST("/user-reset")
    suspend fun userResetPassword(@Body body: Map<String, String>): AuthResponse

    // Session
    @GET("/session")
    suspend fun getSession(): AuthResponse

    @POST("/logout")
    suspend fun logout(): AuthResponse

    // Profile
    @GET("/profile")
    suspend fun getProfile(): ProfileResponse

    @POST("/profile")
    suspend fun updateProfile(@Body body: Map<String, Any?>): ProfileResponse

    // Exclusive Rooms
    @GET("/exclusive-rooms")
    suspend fun getExclusiveRooms(): Map<String, List<ExclusiveRoom>>

    // Wallet
    @GET("/wallet")
    suspend fun getWallet(): Map<String, Any>
}
