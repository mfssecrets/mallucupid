package com.mallucupid.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mallucupid.app.data.model.ProfileResponse
import com.mallucupid.app.data.repository.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val profileRepository: ProfileRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadProfile()
    }

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            profileRepository.getProfile().collect { result ->
                result.onSuccess { response ->
                    _uiState.value = DashboardUiState.Success(response)
                }.onFailure { error ->
                    _uiState.value = DashboardUiState.Error(error.message ?: "Failed to load dashboard")
                }
            }
        }
    }
}

sealed class DashboardUiState {
    object Loading : DashboardUiState()
    data class Success(val response: ProfileResponse) : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
}