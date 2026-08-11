package com.mallucupid.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mallucupid.app.data.repository.WalletRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val walletRepository: WalletRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<WalletUiState>(WalletUiState.Loading)
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    init {
        loadWallet()
    }

    fun loadWallet() {
        viewModelScope.launch {
            _uiState.value = WalletUiState.Loading
            walletRepository.getWallet().collect { result ->
                result.onSuccess { data ->
                    _uiState.value = WalletUiState.Success(data)
                }.onFailure { error ->
                    _uiState.value = WalletUiState.Error(error.message ?: "Failed to load wallet")
                }
            }
        }
    }
}

sealed class WalletUiState {
    object Loading : WalletUiState()
    data class Success(val data: Map<String, Any>) : WalletUiState()
    data class Error(val message: String) : WalletUiState()
}