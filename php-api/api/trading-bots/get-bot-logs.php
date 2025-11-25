<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/auth.php';

setCORSHeaders();

// Verificar autenticación
$user = verifyAuth();
if (!$user) {
    sendErrorResponse('No autorizado', 401);
}

$bot_id = $_GET['bot_id'] ?? null;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;

if (!$bot_id) {
    sendErrorResponse('El ID del bot es requerido', 400);
}

try {
    $pdo = getDBConnection();
    
    // Verificar propiedad del bot
    $checkStmt = $pdo->prepare("SELECT id FROM trading_bots WHERE id = :bot_id AND user_id = :user_id");
    $checkStmt->execute(['bot_id' => $bot_id, 'user_id' => $user['id']]);
    
    if (!$checkStmt->fetch()) {
        sendErrorResponse('Bot no encontrado', 404);
    }
    
    // Obtener logs
    $stmt = $pdo->prepare("
        SELECT 
            id, log_level, message, details, timestamp
        FROM bot_logs
        WHERE bot_id = :bot_id
        ORDER BY timestamp DESC
        LIMIT :limit
    ");
    
    $stmt->bindValue('bot_id', $bot_id);
    $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $logs = $stmt->fetchAll();
    
    sendSuccessResponse(['logs' => $logs]);
    
} catch (Exception $e) {
    error_log("Error fetching bot logs: " . $e->getMessage());
    sendErrorResponse('Error al obtener logs del bot', 500);
}
