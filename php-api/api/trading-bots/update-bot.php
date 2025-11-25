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

if (!isset($data['bot_id'])) {
    sendErrorResponse('El ID del bot es requerido', 400);
}

try {
    $pdo = getDBConnection();
    
    // Verificar que el bot pertenece al usuario
    $checkStmt = $pdo->prepare("SELECT id FROM trading_bots WHERE id = :bot_id AND user_id = :user_id");
    $checkStmt->execute(['bot_id' => $data['bot_id'], 'user_id' => $user['id']]);
    
    if (!$checkStmt->fetch()) {
        sendErrorResponse('Bot no encontrado', 404);
    }
    
    // Construir query dinámicamente
    $fields = [];
    $params = ['bot_id' => $data['bot_id']];
    
    $allowedFields = [
        'name', 'exchange_name', 'account_type', 'symbol', 'is_active',
        'is_testnet', 'leverage', 'num_slots', 'total_alloc_pct',
        'base_capital_mode', 'levels_method', 'atr_period', 'atr_timeframe',
        'tp_method', 'tp_fixed', 'tp_pct', 'tp_atr_mult', 'recenter_threshold_pct'
    ];
    
    foreach ($allowedFields as $field) {
        if (isset($data[$field])) {
            $fields[] = "$field = :$field";
            $params[$field] = $data[$field];
        }
    }
    
    // Manejar arrays especiales
    if (isset($data['level_pcts'])) {
        $fields[] = "level_pcts = :level_pcts";
        $params['level_pcts'] = '{' . implode(',', $data['level_pcts']) . '}';
    }
    
    if (isset($data['level_atr_mults'])) {
        $fields[] = "level_atr_mults = :level_atr_mults";
        $params['level_atr_mults'] = '{' . implode(',', $data['level_atr_mults']) . '}';
    }
    
    if (empty($fields)) {
        sendErrorResponse('No hay campos para actualizar', 400);
    }
    
    $sql = "UPDATE trading_bots SET " . implode(', ', $fields) . " WHERE id = :bot_id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    sendSuccessResponse(['message' => 'Bot actualizado exitosamente']);
    
} catch (Exception $e) {
    error_log("Error updating bot: " . $e->getMessage());
    sendErrorResponse('Error al actualizar el bot', 500);
}
