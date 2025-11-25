<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';

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
$accountType = $input['accountType'] ?? 'real';

// Validate input
if (!$exchange) {
    sendError('Missing required field: exchange', 400);
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    // Delete exchange credentials
    $stmt = $pdo->prepare("
        DELETE FROM exchange_credentials 
        WHERE user_id = :user_id 
            AND exchange_name = :exchange_name
            AND account_type = :account_type
    ");
    $deletedCreds = $stmt->execute([
        'user_id' => $userId,
        'exchange_name' => $exchange,
        'account_type' => $accountType
    ]);

    // Delete exchange connection
    $stmt = $pdo->prepare("
        DELETE FROM exchange_connections 
        WHERE user_id = :user_id 
            AND exchange_name = :exchange_name
            AND account_type = :account_type
    ");
    $deletedConn = $stmt->execute([
        'user_id' => $userId,
        'exchange_name' => $exchange,
        'account_type' => $accountType
    ]);

    $pdo->commit();

    sendResponse([
        'success' => true,
        'message' => "Exchange {$exchange} ({$accountType}) disconnected successfully"
    ], 200);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Disconnect exchange error: " . $e->getMessage());
    sendError('Failed to disconnect exchange: ' . $e->getMessage(), 500);
}
