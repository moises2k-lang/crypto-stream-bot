<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/encryption.php';

setCORSHeaders();

// Get authenticated user
$user = requireAuth();
$userId = $user['user_id'];

// Get request body (optional: sync specific exchange)
$input = json_decode(file_get_contents('php://input'), true);
$exchangeName = $input['exchangeName'] ?? null;

try {
    $pdo = getDBConnection();
    
    // Get all connected exchanges or specific one
    if ($exchangeName) {
        $stmt = $pdo->prepare("
            SELECT ec.*, conn.is_connected 
            FROM exchange_credentials ec
            JOIN exchange_connections conn 
                ON ec.user_id = conn.user_id 
                AND ec.exchange_name = conn.exchange_name
                AND ec.account_type = conn.account_type
            WHERE ec.user_id = :user_id 
                AND ec.exchange_name = :exchange_name
                AND conn.is_connected = true
        ");
        $stmt->execute([
            'user_id' => $userId,
            'exchange_name' => $exchangeName
        ]);
    } else {
        $stmt = $pdo->prepare("
            SELECT ec.*, conn.is_connected 
            FROM exchange_credentials ec
            JOIN exchange_connections conn 
                ON ec.user_id = conn.user_id 
                AND ec.exchange_name = conn.exchange_name
                AND ec.account_type = conn.account_type
            WHERE ec.user_id = :user_id 
                AND conn.is_connected = true
        ");
        $stmt->execute(['user_id' => $userId]);
    }
    
    $credentials = $stmt->fetchAll();
    
    if (empty($credentials)) {
        sendResponse([
            'total_balance' => 0,
            'message' => 'No connected exchanges found',
            'logs' => []
        ], 200);
    }

    $totalBalance = 0;
    $logs = [];

    foreach ($credentials as $cred) {
        $exchange = $cred['exchange_name'];
        $accountType = $cred['account_type'];
        
        try {
            // Decrypt API credentials
            $apiKey = decryptData(
                $cred['api_key_ciphertext'],
                $cred['api_key_iv'],
                $cred['salt'],
                EXCHANGE_ENCRYPTION_KEY
            );
            
            $apiSecret = decryptData(
                $cred['api_secret_ciphertext'],
                $cred['api_secret_iv'],
                $cred['salt'],
                EXCHANGE_ENCRYPTION_KEY
            );

            $logs[] = "🔗 Connecting to {$exchange} ({$accountType})";

            // For demo accounts, use stored balance
            if ($accountType === 'demo') {
                $accountBalance = 10000; // Default demo balance
                $logs[] = "✅ Demo account balance: \${$accountBalance}";
            } else {
                // Call exchange API to get real balance
                // Here you would integrate with exchange APIs using cURL or a PHP library
                // For now, we'll simulate the response
                
                $accountBalance = fetchExchangeBalance($exchange, $apiKey, $apiSecret, $logs);
            }

            $totalBalance += $accountBalance;
            $logs[] = "✓ {$accountType} balance: \${$accountBalance}";

        } catch (Exception $e) {
            $logs[] = "❌ Error for {$accountType}: " . $e->getMessage();
            error_log("Balance sync error for {$exchange} ({$accountType}): " . $e->getMessage());
        }
    }

    // Update user stats with total balance
    $stmt = $pdo->prepare("
        INSERT INTO user_stats (user_id, total_balance, updated_at)
        VALUES (:user_id, :total_balance, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_balance = EXCLUDED.total_balance,
            updated_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([
        'user_id' => $userId,
        'total_balance' => $totalBalance
    ]);

    $logs[] = "💰 Total balance updated: \${$totalBalance}";

    sendResponse([
        'total_balance' => $totalBalance,
        'logs' => $logs
    ], 200);

} catch (Exception $e) {
    error_log("Sync balance error: " . $e->getMessage());
    sendError('Failed to sync balance: ' . $e->getMessage(), 500);
}

// Function to fetch balance from exchange API
function fetchExchangeBalance($exchange, $apiKey, $apiSecret, &$logs) {
    // IMPORTANT: This is a placeholder. You need to implement actual exchange API calls
    // For Binance and Bybit, you would use their REST APIs
    
    // Example for Binance:
    if ($exchange === 'Binance') {
        return fetchBinanceBalance($apiKey, $apiSecret, $logs);
    }
    
    // Example for Bybit:
    if ($exchange === 'Bybit') {
        return fetchBybitBalance($apiKey, $apiSecret, $logs);
    }
    
    throw new Exception("Unsupported exchange: {$exchange}");
}

function fetchBinanceBalance($apiKey, $apiSecret, &$logs) {
    // Binance API endpoint
    $endpoint = 'https://api.binance.com/api/v3/account';
    $timestamp = round(microtime(true) * 1000);
    
    $params = ['timestamp' => $timestamp];
    $queryString = http_build_query($params);
    $signature = hash_hmac('sha256', $queryString, $apiSecret);
    
    $url = "{$endpoint}?{$queryString}&signature={$signature}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-MBX-APIKEY: {$apiKey}"
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        $logs[] = "⚠️ Binance API error: HTTP {$httpCode}";
        throw new Exception("Binance API returned HTTP {$httpCode}");
    }
    
    $data = json_decode($response, true);
    
    // Find USDT balance
    $usdtBalance = 0;
    foreach ($data['balances'] ?? [] as $balance) {
        if ($balance['asset'] === 'USDT') {
            $usdtBalance = floatval($balance['free']) + floatval($balance['locked']);
            break;
        }
    }
    
    $logs[] = "✅ Binance balance fetched: \${$usdtBalance}";
    return $usdtBalance;
}

function fetchBybitBalance($apiKey, $apiSecret, &$logs) {
    // Bybit API endpoint (V5)
    $endpoint = 'https://api.bybit.com/v5/account/wallet-balance';
    $timestamp = round(microtime(true) * 1000);
    
    $params = [
        'accountType' => 'UNIFIED',
        'api_key' => $apiKey,
        'timestamp' => $timestamp
    ];
    
    ksort($params);
    $queryString = http_build_query($params);
    $signature = hash_hmac('sha256', $queryString, $apiSecret);
    
    $url = "{$endpoint}?{$queryString}&sign={$signature}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        $logs[] = "⚠️ Bybit API error: HTTP {$httpCode}";
        throw new Exception("Bybit API returned HTTP {$httpCode}");
    }
    
    $data = json_decode($response, true);
    
    // Extract USDT balance from Unified account
    $usdtBalance = 0;
    if ($data['result']['list'][0]['coin'] ?? null) {
        foreach ($data['result']['list'][0]['coin'] as $coin) {
            if ($coin['coin'] === 'USDT') {
                $usdtBalance = floatval($coin['walletBalance'] ?? 0);
                break;
            }
        }
    }
    
    $logs[] = "✅ Bybit balance fetched: \${$usdtBalance}";
    return $usdtBalance;
}
