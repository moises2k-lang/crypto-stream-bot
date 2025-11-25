<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/auth.php';

setCORSHeaders();

// Verificar autenticación
$user = verifyAuth();
if (!$user) {
    sendErrorResponse('No autorizado', 401);
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['bot_id']) || !isset($data['is_active'])) {
    sendErrorResponse('bot_id e is_active son requeridos', 400);
}

try {
    $pdo = getDBConnection();
    
    $stmt = $pdo->prepare("
        UPDATE trading_bots 
        SET is_active = :is_active 
        WHERE id = :bot_id AND user_id = :user_id
        RETURNING id, name, is_active
    ");
    
    $stmt->execute([
        'bot_id' => $data['bot_id'],
        'is_active' => $data['is_active'],
        'user_id' => $user['id']
    ]);
    
    $bot = $stmt->fetch();
    
    if (!$bot) {
        sendErrorResponse('Bot no encontrado', 404);
    }
    
    sendSuccessResponse([
        'bot' => $bot,
        'message' => $data['is_active'] ? 'Bot activado' : 'Bot desactivado'
    ]);
    
} catch (Exception $e) {
    error_log("Error toggling bot: " . $e->getMessage());
    sendErrorResponse('Error al cambiar estado del bot', 500);
}
