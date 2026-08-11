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
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Initial)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String, isCreator: Boolean) {
        viewModelScope.launch {
            _uiState.value = LoginUiState.Loading
            val loginFlow = if (isCreator) {
                authRepository.login(email, password)
            } else {
                authRepository.userLogin(email, password)
            }
            
            loginFlow.collect { result ->
                result.onSuccess { response ->
                    _uiState.value = LoginUiState.Success(response)
                }.onFailure { error ->
                    _uiState.value = LoginUiState.Error(error.message ?: "Login failed")
                }
            }
        }
    }

    fun verifyOtp(email: String, token: String) {
        viewModelScope.launch {
            _uiState.value = LoginUiState.Loading
            authRepository.verifyOtp(email, token).collect { result ->
                result.onSuccess { response ->
                    _uiState.value = LoginUiState.Success(response)
                }.onFailure { error ->
                    _uiState.value = LoginUiState.Error(error.message ?: "Verification failed")
                }
            }
        }
    }
}

sealed class LoginUiState {
    object Initial : LoginUiState()
    object Loading : LoginUiState()
    data class Success(val response: AuthResponse) : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}