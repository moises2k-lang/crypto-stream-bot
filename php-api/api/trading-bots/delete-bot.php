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
    
    // Verificar propiedad y eliminar
    $stmt = $pdo->prepare("DELETE FROM trading_bots WHERE id = :bot_id AND user_id = :user_id");
    $stmt->execute(['bot_id' => $bot_id, 'user_id' => $user['id']]);
    
    if ($stmt->rowCount() === 0) {
        sendErrorResponse('Bot no encontrado', 404);
    }
    
    sendSuccessResponse(['message' => 'Bot eliminado exitosamente']);
    
} catch (Exception $e) {
    error_log("Error deleting bot: " . $e->getMessage());
    sendErrorResponse('Error al eliminar el bot', 500);
}
