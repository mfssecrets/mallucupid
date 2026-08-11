package com.mallucupid.app.data.model

import com.google.gson.annotations.SerializedName

data class User(
    val id: String,
    val email: String,
    @SerializedName("user_metadata") val metadata: UserMetadata
)

data class UserMetadata(
    val role: String,
    val name: String,
    val username: String? = null
)

data class AuthResponse(
    val user: User?,
    val error: String? = null,
    val status: String? = null
)

data class Profile(
    val id: String,
    val username: String,
    @SerializedName("full_name") val fullName: String?,
    val bio: String?,
    @SerializedName("avatar_url") val avatarUrl: String?,
    val location: String,
    @SerializedName("instagram_url") val instagramUrl: String,
    @SerializedName("facebook_url") val facebookUrl: String,
    val gender: String,
    @SerializedName("public_serial") val publicSerial: Int,
    @SerializedName("is_verified") val isVerified: Boolean = false,
    @SerializedName("verification_status") val verificationStatus: String? = null
)

data class CreatorPost(
    val id: String,
    @SerializedName("public_id") val publicId: String,
    val caption: String,
    @SerializedName("media_type") val mediaType: String,
    @SerializedName("media_urls") val mediaUrls: List<String>,
    @SerializedName("media_url") val mediaUrl: String,
    @SerializedName("media_count") val mediaCount: Int,
    @SerializedName("is_paid") val isPaid: Boolean,
    val price: Double,
    @SerializedName("like_count") val likeCount: Int,
    @SerializedName("view_count") val viewCount: Int,
    @SerializedName("created_at") val createdAt: String
)

data class ProfileResponse(
    val profile: Profile?,
    val stats: ProfileStats?,
    val posts: List<CreatorPost>?,
    val error: String? = null
)

data class ProfileStats(
    val posts: Int,
    val followers: Int,
    val following: Int
)

data class ExclusiveRoom(
    val id: String,
    val name: String,
    @SerializedName("thumbnail_url") val thumbnailUrl: String,
    @SerializedName("entry_fee") val entryFee: Double,
    @SerializedName("entry_fee_paise") val entryFeePaise: Long,
    @SerializedName("sort_order") val sortOrder: Int,
    @SerializedName("has_access") val hasAccess: Boolean = false,
    @SerializedName("expires_at") val expiresAt: String? = null
)