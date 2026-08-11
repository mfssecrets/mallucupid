package com.mallucupid.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mallucupid.app.data.model.CreatorPost
import com.mallucupid.app.data.repository.PostRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CreatePostViewModel @Inject constructor(
    private val postRepository: PostRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<CreatePostUiState>(CreatePostUiState.Initial)
    val uiState: StateFlow<CreatePostUiState> = _uiState.asStateFlow()

    fun createPost(caption: String, price: Double, isPaid: Boolean) {
        viewModelScope.launch {
            _uiState.value = CreatePostUiState.Loading
            postRepository.createPost(caption, price, isPaid).collect { result ->
                result.onSuccess { post ->
                    _uiState.value = CreatePostUiState.Success(post)
                }.onFailure { error ->
                    _uiState.value = CreatePostUiState.Error(error.message ?: "Failed to create post")
                }
            }
        }
    }
}

sealed class CreatePostUiState {
    object Initial : CreatePostUiState()
    object Loading : CreatePostUiState()
    data class Success(val post: CreatorPost) : CreatePostUiState()
    data class Error(val message: String) : CreatePostUiState()
}