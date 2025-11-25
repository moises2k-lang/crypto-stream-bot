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

// Validar datos requeridos
if (!isset($data['name'])) {
    sendErrorResponse('El nombre del bot es requerido', 400);
}

try {
    $pdo = getDBConnection();
    
    // Valores por defecto
    $defaults = [
        'exchange_name' => 'Bybit',
        'account_type' => 'demo',
        'symbol' => 'XMR/USDT:USDT',
        'is_active' => false,
        'is_testnet' => true,
        'num_slots' => 6,
        'total_alloc_pct' => 0.6,
        'base_capital_mode' => 'initial',
        'levels_method' => 'atr',
        'atr_period' => 14,
        'atr_timeframe' => '5m',
        'tp_method' => 'atr_above_entry',
        'tp_fixed' => 0,
        'tp_pct' => 0.005,
        'tp_atr_mult' => 0.5,
        'recenter_threshold_pct' => 0.001
    ];
    
    // Convertir arrays a formato PostgreSQL
    $level_pcts = isset($data['level_pcts']) ? 
        '{' . implode(',', $data['level_pcts']) . '}' : 
        '{0,-0.03,-0.06,-0.12,-0.25,-0.5}';
    
    $level_atr_mults = isset($data['level_atr_mults']) ? 
        '{' . implode(',', $data['level_atr_mults']) . '}' : 
        '{0,1,2,3,4,5}';
    
    $stmt = $pdo->prepare("
        INSERT INTO trading_bots (
            user_id, name, exchange_name, account_type, symbol,
            is_active, is_testnet, leverage, num_slots, total_alloc_pct,
            base_capital_mode, levels_method, level_pcts, level_atr_mults,
            atr_period, atr_timeframe, tp_method, tp_fixed, tp_pct,
            tp_atr_mult, recenter_threshold_pct
        ) VALUES (
            :user_id, :name, :exchange_name, :account_type, :symbol,
            :is_active, :is_testnet, :leverage, :num_slots, :total_alloc_pct,
            :base_capital_mode, :levels_method, :level_pcts, :level_atr_mults,
            :atr_period, :atr_timeframe, :tp_method, :tp_fixed, :tp_pct,
            :tp_atr_mult, :recenter_threshold_pct
        )
        RETURNING id, name, exchange_name, account_type, symbol, is_active, 
                  is_testnet, num_slots, created_at
    ");
    
    $stmt->execute([
        'user_id' => $user['id'],
        'name' => $data['name'],
        'exchange_name' => $data['exchange_name'] ?? $defaults['exchange_name'],
        'account_type' => $data['account_type'] ?? $defaults['account_type'],
        'symbol' => $data['symbol'] ?? $defaults['symbol'],
        'is_active' => $data['is_active'] ?? $defaults['is_active'],
        'is_testnet' => $data['is_testnet'] ?? $defaults['is_testnet'],
        'leverage' => $data['leverage'] ?? null,
        'num_slots' => $data['num_slots'] ?? $defaults['num_slots'],
        'total_alloc_pct' => $data['total_alloc_pct'] ?? $defaults['total_alloc_pct'],
        'base_capital_mode' => $data['base_capital_mode'] ?? $defaults['base_capital_mode'],
        'levels_method' => $data['levels_method'] ?? $defaults['levels_method'],
        'level_pcts' => $level_pcts,
        'level_atr_mults' => $level_atr_mults,
        'atr_period' => $data['atr_period'] ?? $defaults['atr_period'],
        'atr_timeframe' => $data['atr_timeframe'] ?? $defaults['atr_timeframe'],
        'tp_method' => $data['tp_method'] ?? $defaults['tp_method'],
        'tp_fixed' => $data['tp_fixed'] ?? $defaults['tp_fixed'],
        'tp_pct' => $data['tp_pct'] ?? $defaults['tp_pct'],
        'tp_atr_mult' => $data['tp_atr_mult'] ?? $defaults['tp_atr_mult'],
        'recenter_threshold_pct' => $data['recenter_threshold_pct'] ?? $defaults['recenter_threshold_pct']
    ]);
    
    $bot = $stmt->fetch();
    
    sendSuccessResponse([
        'bot' => $bot,
        'message' => 'Bot creado exitosamente'
    ]);
    
} catch (Exception $e) {
    error_log("Error creating bot: " . $e->getMessage());
    sendErrorResponse('Error al crear el bot', 500);
}
