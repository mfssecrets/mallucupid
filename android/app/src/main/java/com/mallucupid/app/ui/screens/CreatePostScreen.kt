package com.mallucupid.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mallucupid.app.ui.theme.MalluCupidTheme
import com.mallucupid.app.ui.theme.Rose500

@Composable
fun CreatePostScreen(
    viewModel: CreatePostViewModel,
    onPostCreated: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is CreatePostUiState.Success) {
            onPostCreated()
        }
    }

    CreatePostContent(
        uiState = uiState,
        onCreatePost = { caption, price, isPaid -> viewModel.createPost(caption, price, isPaid) }
    )
}

@Composable
fun CreatePostContent(
    uiState: CreatePostUiState,
    onCreatePost: (String, Double, Boolean) -> Unit
) {
    var caption by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var isPaid by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = "Create New Post", fontSize = 24.sp, color = Rose500)
        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = caption,
            onValueChange = { if (it.length <= 200) caption = it },
            label = { Text("Caption") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3
        )
        Spacer(modifier = Modifier.height(16.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Checkbox(checked = isPaid, onCheckedChange = { isPaid = it })
            Text(text = "Paid Post")
        }

        if (isPaid) {
            OutlinedTextField(
                value = price,
                onValueChange = { price = it },
                label = { Text("Price (INR)") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = { onCreatePost(caption, price.toDoubleOrNull() ?: 0.0, isPaid) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Rose500),
            enabled = uiState !is CreatePostUiState.Loading
        ) {
            if (uiState is CreatePostUiState.Loading) {
                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
            } else {
                Text("Post")
            }
        }

        if (uiState is CreatePostUiState.Error) {
            Text(text = uiState.message, color = Color.Red, modifier = Modifier.padding(top = 8.dp))
        }
    }
}

@Preview(showBackground = true)
@Composable
fun CreatePostPreview() {
    MalluCupidTheme {
        CreatePostContent(
            uiState = CreatePostUiState.Initial,
            onCreatePost = { _, _, _ -> }
        )
    }
}