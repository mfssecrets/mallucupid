package com.mallucupid.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mallucupid.app.data.model.AuthResponse
import com.mallucupid.app.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SignupViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SignupUiState>(SignupUiState.Initial)
    val uiState: StateFlow<SignupUiState> = _uiState.asStateFlow()

    fun signup(email: String, username: String, password: String) {
        viewModelScope.launch {
            _uiState.value = SignupUiState.Loading
            authRepository.signup(email, username, password).collect { result ->
                result.onSuccess { response ->
                    _uiState.value = SignupUiState.Success(response)
                }.onFailure { error ->
                    _uiState.value = SignupUiState.Error(error.message ?: "Signup failed")
                }
            }
        }
    }
}

sealed class SignupUiState {
    object Initial : SignupUiState()
    object Loading : SignupUiState()
    data class Success(val response: AuthResponse) : SignupUiState()
    data class Error(val message: String) : SignupUiState()
}