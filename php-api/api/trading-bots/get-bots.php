<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/auth.php';

setCORSHeaders();

// Verificar autenticación
$user = verifyAuth();
if (!$user) {
    sendErrorResponse('No autorizado', 401);
}

try {
    $pdo = getDBConnection();
    
    $stmt = $pdo->prepare("
        SELECT 
            id, name, exchange_name, account_type, symbol,
            is_active, is_testnet, leverage, num_slots, total_alloc_pct,
            base_capital_mode, levels_method, level_pcts, level_atr_mults,
            atr_period, atr_timeframe, tp_method, tp_fixed, tp_pct,
            tp_atr_mult, recenter_threshold_pct, last_run_at,
            created_at, updated_at
        FROM trading_bots
        WHERE user_id = :user_id
        ORDER BY created_at DESC
    ");
    
    $stmt->execute(['user_id' => $user['id']]);
    $bots = $stmt->fetchAll();
    
    sendSuccessResponse(['bots' => $bots]);
    
} catch (Exception $e) {
    error_log("Error fetching bots: " . $e->getMessage());
    sendErrorResponse('Error al obtener los bots', 500);
}
