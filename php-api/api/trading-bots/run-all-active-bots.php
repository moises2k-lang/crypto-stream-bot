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
    
    // Obtener todos los bots activos del usuario
    $stmt = $pdo->prepare("
        SELECT id, name FROM trading_bots 
        WHERE user_id = :user_id AND is_active = true
    ");
    $stmt->execute(['user_id' => $user['id']]);
    $activeBots = $stmt->fetchAll();
    
    if (empty($activeBots)) {
        sendSuccessResponse([
            'message' => 'No hay bots activos para ejecutar',
            'executed' => 0
        ]);
        return;
    }
    
    $results = [];
    $successCount = 0;
    $errorCount = 0;
    
    foreach ($activeBots as $bot) {
        // Hacer llamada interna al endpoint run-bot.php
        $ch = curl_init();
        
        $url = 'http://' . $_SERVER['HTTP_HOST'] . '/api/trading-bots/run-bot.php';
        $postData = json_encode(['bot_id' => $bot['id']]);
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION']
            ]
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $result = [
            'bot_id' => $bot['id'],
            'bot_name' => $bot['name'],
            'success' => $httpCode === 200
        ];
        
        if ($httpCode === 200) {
            $successCount++;
        } else {
            $errorCount++;
            $result['error'] = $response;
        }
        
        $results[] = $result;
    }
    
    sendSuccessResponse([
        'message' => "Ejecución completada: {$successCount} exitosos, {$errorCount} errores",
        'total' => count($activeBots),
        'success' => $successCount,
        'errors' => $errorCount,
        'results' => $results
    ]);
    
} catch (Exception $e) {
    error_log("Error running all active bots: " . $e->getMessage());
    sendErrorResponse('Error al ejecutar bots activos', 500);
}
