<?php

$secret_key = "12345678-1234-1234-1234-123456789012"; // Your exact same 36-char key

// Retrieve the URL parameter (PHP automatically URL-decodes `$_GET` variables)
$text_output = isset($_GET['text_output']) ? $_GET['text_output'] : null;

if ($text_output) {
    // 1. Derive the exact same 32-byte decryption key via SHA-256 
    // Setting the third param to `true` returns raw binary data
    $keyBytes = hash('sha256', $secret_key, true);

    // 2. Base64 decode the input parameter
    $combinedBytes = base64_decode($text_output);

    if ($combinedBytes !== false) {
        // 3. Extract the 16-byte IV that we prefixed in PowerShell
        $ivLength = openssl_cipher_iv_length('aes-256-cbc'); // Always 16 for AES
        $iv = substr($combinedBytes, 0, $ivLength);

        // 4. Extract the remaining ciphertext
        $ciphertext = substr($combinedBytes, $ivLength);

        // 5. Decrypt using openssl
        $text_value = openssl_decrypt(
            $ciphertext,
            'aes-256-cbc',
            $keyBytes,
            OPENSSL_RAW_DATA, // Use OPENSSL_RAW_DATA so openssl doesn't try to base64 unpack it again
            $iv
        );

        if ($text_value !== false) {
            echo "Decrypted Text Value: " . htmlspecialchars($text_value);
        } else {
            echo "Decryption failed. Please ensure the key and text_output are correct.";
        }
    } else {
        echo "Base64 decoding failed. The input string is corrupted.";
    }
} else {
    echo "URL parameter 'text_output' is missing.";
}

?>