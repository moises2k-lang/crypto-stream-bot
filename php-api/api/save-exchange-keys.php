<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/encryption.php';

setCORSHeaders();

// Get authenticated user
$user = requireAuth();
$userId = $user['user_id'];

// Get request body
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    sendError('Invalid JSON', 400);
}

$exchange = $input['exchange'] ?? null;
$apiKey = $input['apiKey'] ?? null;
$apiSecret = $input['apiSecret'] ?? null;
$accountType = $input['accountType'] ?? 'real';

// Validate input
if (!$exchange || !$apiKey || !$apiSecret) {
    sendError('Missing required fields: exchange, apiKey, apiSecret', 400);
}

if (!in_array($accountType, ['demo', 'real'])) {
    sendError('Invalid account type. Must be demo or real', 400);
}

$allowedExchanges = ['Binance', 'Bybit'];
if (!in_array($exchange, $allowedExchanges)) {
    sendError('Invalid exchange. Allowed: ' . implode(', ', $allowedExchanges), 400);
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    // Encrypt API credentials using the same salt
    $commonSalt = random_bytes(16);
    $apiKeyEncrypted = encryptData($apiKey, EXCHANGE_ENCRYPTION_KEY, $commonSalt);
    $apiSecretEncrypted = encryptData($apiSecret, EXCHANGE_ENCRYPTION_KEY, $commonSalt);

    // Upsert exchange credentials
    $stmt = $pdo->prepare("
        INSERT INTO exchange_credentials 
            (user_id, exchange_name, account_type, api_key_ciphertext, api_key_iv, 
             api_secret_ciphertext, api_secret_iv, salt, updated_at)
        VALUES 
            (:user_id, :exchange_name, :account_type, :api_key_ciphertext, :api_key_iv,
             :api_secret_ciphertext, :api_secret_iv, :salt, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, exchange_name, account_type) 
        DO UPDATE SET 
            api_key_ciphertext = EXCLUDED.api_key_ciphertext,
            api_key_iv = EXCLUDED.api_key_iv,
            api_secret_ciphertext = EXCLUDED.api_secret_ciphertext,
            api_secret_iv = EXCLUDED.api_secret_iv,
            salt = EXCLUDED.salt,
            updated_at = CURRENT_TIMESTAMP
    ");

    $stmt->execute([
        'user_id' => $userId,
        'exchange_name' => $exchange,
        'account_type' => $accountType,
        'api_key_ciphertext' => $apiKeyEncrypted['ciphertext'],
        'api_key_iv' => $apiKeyEncrypted['iv'],
        'api_secret_ciphertext' => $apiSecretEncrypted['ciphertext'],
        'api_secret_iv' => $apiSecretEncrypted['iv'],
        'salt' => $apiKeyEncrypted['salt']
    ]);

    // Create API key preview
    $apiKeyPreview = strlen($apiKey) > 12 
        ? substr($apiKey, 0, 6) . '...' . substr($apiKey, -6)
        : substr($apiKey, 0, 3) . '...' . substr($apiKey, -3);

    // Check if this is the first exchange connection
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM exchange_connections 
        WHERE user_id = :user_id AND is_connected = true
    ");
    $stmt->execute(['user_id' => $userId]);
    $result = $stmt->fetch();
    $isFirstConnection = ($result['count'] == 0);

    // Upsert exchange connection status
    $stmt = $pdo->prepare("
        INSERT INTO exchange_connections 
            (user_id, exchange_name, account_type, is_connected, api_key_preview, 
             connected_at, updated_at)
        VALUES 
            (:user_id, :exchange_name, :account_type, true, :api_key_preview,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, exchange_name, account_type) 
        DO UPDATE SET 
            is_connected = true,
            api_key_preview = EXCLUDED.api_key_preview,
            connected_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
    ");

    $stmt->execute([
        'user_id' => $userId,
        'exchange_name' => $exchange,
        'account_type' => $accountType,
        'api_key_preview' => $apiKeyPreview
    ]);

    // If first connection, activate free trial
    $trialStarted = false;
    if ($isFirstConnection) {
        $stmt = $pdo->prepare("
            SELECT * FROM free_trials 
            WHERE user_id = :user_id
        ");
        $stmt->execute(['user_id' => $userId]);
        $trial = $stmt->fetch();

        if ($trial && !$trial['has_used_trial'] && !$trial['is_active']) {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+3 days'));
            
            $stmt = $pdo->prepare("
                UPDATE free_trials 
                SET started_at = CURRENT_TIMESTAMP,
                    expires_at = :expires_at,
                    is_active = true,
                    has_used_trial = true,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = :user_id
            ");
            $stmt->execute([
                'user_id' => $userId,
                'expires_at' => $expiresAt
            ]);
            
            $trialStarted = true;
        }
    }

    $pdo->commit();

    sendResponse([
        'success' => true,
        'trial_started' => $trialStarted,
        'message' => 'Exchange keys saved successfully'
    ], 200);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Save exchange keys error: " . $e->getMessage());
    sendError('Failed to save exchange keys: ' . $e->getMessage(), 500);
}
