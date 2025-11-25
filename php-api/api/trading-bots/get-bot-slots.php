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
    
    // Obtener slots
    $stmt = $pdo->prepare("
        SELECT 
            id, slot_id, status, entry_price, tp_price, qty, filled_qty,
            size_usdt, buy_order_id, tp_order_id, last_update_ts
        FROM bot_slots
        WHERE bot_id = :bot_id
        ORDER BY slot_id ASC
    ");
    
    $stmt->execute(['bot_id' => $bot_id]);
    $slots = $stmt->fetchAll();
    
    sendSuccessResponse(['slots' => $slots]);
    
} catch (Exception $e) {
    error_log("Error fetching bot slots: " . $e->getMessage());
    sendErrorResponse('Error al obtener slots del bot', 500);
}
