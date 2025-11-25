<?php
require_once __DIR__ . '/../config/database.php';

// Generate JWT token
function generateJWT($userId) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'user_id' => $userId,
        'exp' => time() + JWT_EXPIRATION,
        'iat' => time()
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

// Verify JWT token
function verifyJWT($token) {
    if (!$token) {
        return null;
    }

    $tokenParts = explode('.', $token);
    if (count($tokenParts) !== 3) {
        return null;
    }

    list($header, $payload, $signature) = $tokenParts;

    $validSignature = hash_hmac('sha256', $header . "." . $payload, JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($validSignature));

    if ($signature !== $base64UrlSignature) {
        return null;
    }

    $payloadData = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);

    if ($payloadData['exp'] < time()) {
        return null;
    }

    return $payloadData;
}

// Get user from authorization header
function getAuthenticatedUser() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return null;
    }

    $token = $matches[1];
    $payload = verifyJWT($token);

    if (!$payload) {
        return null;
    }

    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT user_id, email, full_name, is_active FROM profiles WHERE user_id = :user_id");
        $stmt->execute(['user_id' => $payload['user_id']]);
        $user = $stmt->fetch();

        if (!$user || !$user['is_active']) {
            return null;
        }

        return $user;
    } catch (Exception $e) {
        error_log("Auth error: " . $e->getMessage());
        return null;
    }
}

// Send JSON response
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

// Send error response
function sendError($message, $statusCode = 400) {
    sendResponse(['error' => $message], $statusCode);
}

// Require authentication
function requireAuth() {
    $user = getAuthenticatedUser();
    if (!$user) {
        sendError('Unauthorized', 401);
    }
    return $user;
}
