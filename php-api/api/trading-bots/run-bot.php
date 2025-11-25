<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/auth.php';
require_once __DIR__ . '/../../utils/encryption.php';

setCORSHeaders();

// Verificar autenticación
$user = verifyAuth();
if (!$user) {
    sendErrorResponse('No autorizado', 401);
}

$data = json_decode(file_get_contents('php://input'), true);
$bot_id = $data['bot_id'] ?? null;

if (!$bot_id) {
    sendErrorResponse('El ID del bot es requerido', 400);
}

/**
 * Log a message to the bot_logs table
 */
function logBotMessage($pdo, $bot_id, $level, $message, $details = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO bot_logs (bot_id, log_level, message, details)
            VALUES (:bot_id, :log_level, :message, :details)
        ");
        $stmt->execute([
            'bot_id' => $bot_id,
            'log_level' => $level,
            'message' => $message,
            'details' => $details ? json_encode($details) : null
        ]);
    } catch (Exception $e) {
        error_log("Error logging bot message: " . $e->getMessage());
    }
}

/**
 * Fetch ATR (Average True Range) - Placeholder
 */
function fetchATR($symbol, $timeframe, $period, $apiKey, $apiSecret, $isTestnet, $proxy) {
    // TODO: Implementar llamada real a Bybit API para obtener ATR
    // Por ahora retornamos un valor simulado
    return 50.0;
}

/**
 * Get current market price - Placeholder
 */
function getCurrentPrice($symbol, $apiKey, $apiSecret, $isTestnet, $proxy) {
    // TODO: Implementar llamada real a Bybit API
    return 150.0; // Precio simulado
}

/**
 * Get user balance - Placeholder
 */
function getUserBalance($apiKey, $apiSecret, $isTestnet, $accountType, $proxy) {
    // TODO: Implementar llamada real a Bybit API
    if ($accountType === 'demo') {
        return 10000.0; // Balance demo
    }
    return 1000.0; // Balance simulado
}

/**
 * Place buy order on exchange
 */
function placeBuyOrder($symbol, $qty, $price, $apiKey, $apiSecret, $isTestnet, $proxy) {
    // TODO: Implementar llamada real a Bybit API
    return 'BUY_ORDER_' . uniqid();
}

/**
 * Place take-profit order on exchange
 */
function placeTPOrder($symbol, $qty, $price, $apiKey, $apiSecret, $isTestnet, $proxy) {
    // TODO: Implementar llamada real a Bybit API
    return 'TP_ORDER_' . uniqid();
}

try {
    $pdo = getDBConnection();
    
    // Obtener configuración del bot
    $stmt = $pdo->prepare("
        SELECT * FROM trading_bots 
        WHERE id = :bot_id AND user_id = :user_id
    ");
    $stmt->execute(['bot_id' => $bot_id, 'user_id' => $user['id']]);
    $bot = $stmt->fetch();
    
    if (!$bot) {
        sendErrorResponse('Bot no encontrado', 404);
    }
    
    if (!$bot['is_active']) {
        sendErrorResponse('El bot no está activo', 400);
    }
    
    logBotMessage($pdo, $bot_id, 'info', 'Iniciando ejecución del bot', ['bot_name' => $bot['name']]);
    
    // Obtener credenciales del exchange
    $credsStmt = $pdo->prepare("
        SELECT * FROM exchange_credentials 
        WHERE user_id = :user_id 
        AND exchange_name = :exchange_name 
        AND account_type = :account_type
    ");
    $credsStmt->execute([
        'user_id' => $user['id'],
        'exchange_name' => $bot['exchange_name'],
        'account_type' => $bot['account_type']
    ]);
    $credentials = $credsStmt->fetch();
    
    if (!$credentials) {
        logBotMessage($pdo, $bot_id, 'error', 'No se encontraron credenciales del exchange');
        sendErrorResponse('Credenciales del exchange no configuradas', 400);
    }
    
    // Desencriptar credenciales
    $apiKey = decryptData(
        $credentials['api_key_ciphertext'],
        $credentials['api_key_iv'],
        EXCHANGE_ENCRYPTION_KEY,
        $credentials['salt']
    );
    
    $apiSecret = decryptData(
        $credentials['api_secret_ciphertext'],
        $credentials['api_secret_iv'],
        EXCHANGE_ENCRYPTION_KEY,
        $credentials['salt']
    );
    
    // Configuración de proxy (si es necesario)
    $proxy = null; // TODO: Configurar proxy si es necesario
    
    // Obtener precio actual del mercado
    $currentPrice = getCurrentPrice(
        $bot['symbol'],
        $apiKey,
        $apiSecret,
        $bot['is_testnet'],
        $proxy
    );
    
    logBotMessage($pdo, $bot_id, 'info', 'Precio actual obtenido', ['price' => $currentPrice]);
    
    // Obtener balance del usuario
    $balance = getUserBalance(
        $apiKey,
        $apiSecret,
        $bot['is_testnet'],
        $bot['account_type'],
        $proxy
    );
    
    logBotMessage($pdo, $bot_id, 'info', 'Balance obtenido', ['balance' => $balance]);
    
    // Calcular ATR si es necesario
    $atr = null;
    if ($bot['levels_method'] === 'atr' || $bot['tp_method'] === 'atr_above_entry') {
        $atr = fetchATR(
            $bot['symbol'],
            $bot['atr_timeframe'],
            $bot['atr_period'],
            $apiKey,
            $apiSecret,
            $bot['is_testnet'],
            $proxy
        );
        logBotMessage($pdo, $bot_id, 'info', 'ATR calculado', ['atr' => $atr]);
    }
    
    // Obtener slots existentes
    $slotsStmt = $pdo->prepare("SELECT * FROM bot_slots WHERE bot_id = :bot_id ORDER BY slot_id ASC");
    $slotsStmt->execute(['bot_id' => $bot_id]);
    $existingSlots = $slotsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calcular capital por slot
    $totalCapital = $balance * $bot['total_alloc_pct'];
    $capitalPerSlot = $totalCapital / $bot['num_slots'];
    
    // Generar niveles de entrada
    $entryLevels = [];
    if ($bot['levels_method'] === 'atr' && $atr) {
        $level_atr_mults = array_map('floatval', explode(',', trim($bot['level_atr_mults'], '{}')));
        foreach ($level_atr_mults as $mult) {
            $entryLevels[] = $currentPrice - ($atr * $mult);
        }
    } else {
        $level_pcts = array_map('floatval', explode(',', trim($bot['level_pcts'], '{}')));
        foreach ($level_pcts as $pct) {
            $entryLevels[] = $currentPrice * (1 + $pct);
        }
    }
    
    // Limitar a num_slots
    $entryLevels = array_slice($entryLevels, 0, $bot['num_slots']);
    
    logBotMessage($pdo, $bot_id, 'info', 'Niveles de entrada calculados', ['levels' => $entryLevels]);
    
    // Crear o actualizar slots
    foreach ($entryLevels as $index => $entryPrice) {
        $slotId = $index;
        $qty = $capitalPerSlot / $entryPrice;
        
        // Calcular TP
        $tpPrice = $entryPrice;
        if ($bot['tp_method'] === 'atr_above_entry' && $atr) {
            $tpPrice = $entryPrice + ($atr * $bot['tp_atr_mult']);
        } elseif ($bot['tp_method'] === 'percentage') {
            $tpPrice = $entryPrice * (1 + $bot['tp_pct']);
        } elseif ($bot['tp_method'] === 'fixed') {
            $tpPrice = $entryPrice + $bot['tp_fixed'];
        }
        
        // Verificar si el slot existe
        $existingSlot = array_filter($existingSlots, function($s) use ($slotId) {
            return $s['slot_id'] == $slotId;
        });
        $existingSlot = !empty($existingSlot) ? reset($existingSlot) : null;
        
        if ($existingSlot) {
            // Actualizar slot existente si es necesario (recenter logic)
            $priceDiff = abs($existingSlot['entry_price'] - $entryPrice) / $entryPrice;
            if ($priceDiff > $bot['recenter_threshold_pct']) {
                // Recentrar: cancelar órdenes anteriores y crear nuevas
                logBotMessage($pdo, $bot_id, 'info', "Recentrando slot {$slotId}");
                
                // TODO: Cancelar órdenes anteriores en el exchange
                
                // Crear nuevas órdenes
                $buyOrderId = placeBuyOrder($bot['symbol'], $qty, $entryPrice, $apiKey, $apiSecret, $bot['is_testnet'], $proxy);
                
                // Actualizar slot en DB
                $updateStmt = $pdo->prepare("
                    UPDATE bot_slots 
                    SET entry_price = :entry_price, tp_price = :tp_price, 
                        qty = :qty, buy_order_id = :buy_order_id,
                        status = 'waiting', last_update_ts = NOW()
                    WHERE id = :id
                ");
                $updateStmt->execute([
                    'id' => $existingSlot['id'],
                    'entry_price' => $entryPrice,
                    'tp_price' => $tpPrice,
                    'qty' => $qty,
                    'buy_order_id' => $buyOrderId
                ]);
            }
        } else {
            // Crear nuevo slot
            logBotMessage($pdo, $bot_id, 'info', "Creando nuevo slot {$slotId}");
            
            $buyOrderId = placeBuyOrder($bot['symbol'], $qty, $entryPrice, $apiKey, $apiSecret, $bot['is_testnet'], $proxy);
            
            $insertStmt = $pdo->prepare("
                INSERT INTO bot_slots (
                    bot_id, slot_id, status, entry_price, tp_price, qty, 
                    size_usdt, buy_order_id
                ) VALUES (
                    :bot_id, :slot_id, 'waiting', :entry_price, :tp_price, :qty,
                    :size_usdt, :buy_order_id
                )
            ");
            $insertStmt->execute([
                'bot_id' => $bot_id,
                'slot_id' => $slotId,
                'entry_price' => $entryPrice,
                'tp_price' => $tpPrice,
                'qty' => $qty,
                'size_usdt' => $capitalPerSlot,
                'buy_order_id' => $buyOrderId
            ]);
        }
    }
    
    // Actualizar last_run_at del bot
    $updateBotStmt = $pdo->prepare("UPDATE trading_bots SET last_run_at = NOW() WHERE id = :bot_id");
    $updateBotStmt->execute(['bot_id' => $bot_id]);
    
    logBotMessage($pdo, $bot_id, 'info', 'Ejecución del bot completada exitosamente');
    
    sendSuccessResponse([
        'message' => 'Bot ejecutado exitosamente',
        'currentPrice' => $currentPrice,
        'balance' => $balance,
        'atr' => $atr,
        'entryLevels' => $entryLevels
    ]);
    
} catch (Exception $e) {
    error_log("Error running bot: " . $e->getMessage());
    if (isset($pdo) && isset($bot_id)) {
        logBotMessage($pdo, $bot_id, 'error', 'Error en la ejecución del bot', ['error' => $e->getMessage()]);
    }
    sendErrorResponse('Error al ejecutar el bot: ' . $e->getMessage(), 500);
}
