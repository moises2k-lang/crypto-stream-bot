<?php
require_once __DIR__ . '/../config/database.php';

// Derive encryption key using PBKDF2
function deriveKey($passphrase, $salt) {
    return hash_pbkdf2('sha256', $passphrase, $salt, 100000, 32, true);
}

// Encrypt data using AES-256-GCM
function encryptData($plaintext, $passphrase, $salt = null) {
    if ($salt === null) {
        $salt = random_bytes(16);
    }
    
    $key = deriveKey($passphrase, $salt);
    $iv = random_bytes(12);
    
    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-256-gcm',
        $key,
        OPENSSL_RAW_DATA,
        $iv,
        $tag
    );
    
    if ($ciphertext === false) {
        throw new Exception('Encryption failed');
    }
    
    return [
        'ciphertext' => base64_encode($ciphertext . $tag),
        'iv' => base64_encode($iv),
        'salt' => base64_encode($salt)
    ];
}

// Decrypt data using AES-256-GCM
function decryptData($ciphertext, $iv, $salt, $passphrase) {
    $key = deriveKey($passphrase, base64_decode($salt));
    $ivBytes = base64_decode($iv);
    $ciphertextBytes = base64_decode($ciphertext);
    
    // Extract tag (last 16 bytes)
    $tag = substr($ciphertextBytes, -16);
    $ciphertextData = substr($ciphertextBytes, 0, -16);
    
    $plaintext = openssl_decrypt(
        $ciphertextData,
        'aes-256-gcm',
        $key,
        OPENSSL_RAW_DATA,
        $ivBytes,
        $tag
    );
    
    if ($plaintext === false) {
        throw new Exception('Decryption failed');
    }
    
    return $plaintext;
}
