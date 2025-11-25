# PHP API para Exchanges - Guía de Instalación

## 📋 Requisitos

- PHP 8.0 o superior
- PostgreSQL 12+ o MySQL 8.0+
- Extensiones PHP requeridas:
  - `pdo_pgsql` o `pdo_mysql`
  - `openssl`
  - `json`
  - `curl`

## 🚀 Instalación en Hostinger

### 1. Crear Base de Datos

1. Accede al panel de Hostinger
2. Ve a **Bases de datos MySQL** o **PostgreSQL**
3. Crea una nueva base de datos
4. Anota:
   - Nombre de la base de datos
   - Usuario
   - Contraseña
   - Host (normalmente `localhost`)

### 2. Importar Esquema SQL

1. Accede a **phpMyAdmin** o **Adminer** en Hostinger
2. Selecciona tu base de datos
3. Importa el archivo `database/schema.sql`
4. Verifica que todas las tablas se crearon correctamente

### 3. Configurar API PHP

1. Sube la carpeta `php-api/` a tu servidor Hostinger
2. Edita `php-api/config/database.php`:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'tu_nombre_bd');
define('DB_USER', 'tu_usuario_bd');
define('DB_PASS', 'tu_contraseña_bd');
define('EXCHANGE_ENCRYPTION_KEY', 'genera-una-clave-segura-min-32-caracteres');
define('JWT_SECRET', 'genera-otra-clave-segura-min-32-caracteres');
```

3. Actualiza `ALLOWED_ORIGINS` con tu dominio:

```php
define('ALLOWED_ORIGINS', ['https://tudominio.com']);
```

### 4. Configurar .htaccess (Apache)

Crea un archivo `.htaccess` en la carpeta `php-api/`:

```apache
RewriteEngine On

# CORS Preflight
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=200,L]

# API Routes - Exchanges
RewriteRule ^api/save-exchange-keys$ api/save-exchange-keys.php [L]
RewriteRule ^api/sync-exchange-balance$ api/sync-exchange-balance.php [L]
RewriteRule ^api/disconnect-exchange$ api/disconnect-exchange.php [L]

# API Routes - Trading Bots
RewriteRule ^api/trading-bots/create-bot$ api/trading-bots/create-bot.php [L]
RewriteRule ^api/trading-bots/get-bots$ api/trading-bots/get-bots.php [L]
RewriteRule ^api/trading-bots/update-bot$ api/trading-bots/update-bot.php [L]
RewriteRule ^api/trading-bots/delete-bot$ api/trading-bots/delete-bot.php [L]
RewriteRule ^api/trading-bots/toggle-bot$ api/trading-bots/toggle-bot.php [L]
RewriteRule ^api/trading-bots/run-bot$ api/trading-bots/run-bot.php [L]
RewriteRule ^api/trading-bots/run-all-active-bots$ api/trading-bots/run-all-active-bots.php [L]
RewriteRule ^api/trading-bots/get-bot-slots$ api/trading-bots/get-bot-slots.php [L]
RewriteRule ^api/trading-bots/get-bot-logs$ api/trading-bots/get-bot-logs.php [L]

# Security headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "DENY"
Header set X-XSS-Protection "1; mode=block"
```

### 5. Configurar Permisos

```bash
chmod 755 php-api/
chmod 644 php-api/config/*.php
chmod 644 php-api/api/*.php
chmod 644 php-api/utils/*.php
```

## 📡 Endpoints API

### Base URL
```
https://tudominio.com/php-api
```

### Exchange API

#### 1. Guardar Claves de Exchange

**POST** `/api/save-exchange-keys`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Body:
```json
{
  "exchange": "Binance",
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "accountType": "real"
}
```

#### 2. Sincronizar Balance

**POST** `/api/sync-exchange-balance`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Body (opcional):
```json
{
  "exchangeName": "Binance"
}
```

#### 3. Desconectar Exchange

**POST** `/api/disconnect-exchange`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Body:
```json
{
  "exchange": "Binance",
  "accountType": "real"
}
```

### Trading Bots API

#### 1. Crear Bot

**POST** `/api/trading-bots/create-bot`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Body:
```json
{
  "name": "Mi Bot DCA",
  "exchange_name": "Bybit",
  "account_type": "demo",
  "symbol": "BTC/USDT:USDT",
  "num_slots": 6,
  "total_alloc_pct": 0.6,
  "levels_method": "atr",
  "tp_method": "atr_above_entry"
}
```

#### 2. Obtener Bots del Usuario

**GET** `/api/trading-bots/get-bots`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
```

#### 3. Actualizar Bot

**PUT** `/api/trading-bots/update-bot`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Body:
```json
{
  "bot_id": "uuid-del-bot",
  "name": "Nuevo nombre",
  "num_slots": 8,
  "is_active": true
}
```

#### 4. Eliminar Bot

**DELETE** `/api/trading-bots/delete-bot?bot_id={bot_id}`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
```

#### 5. Activar/Desactivar Bot

**POST** `/api/trading-bots/toggle-bot`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Body:
```json
{
  "bot_id": "uuid-del-bot",
  "is_active": true
}
```

#### 6. Ejecutar Bot Individual

**POST** `/api/trading-bots/run-bot`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

Body:
```json
{
  "bot_id": "uuid-del-bot"
}
```

#### 7. Ejecutar Todos los Bots Activos

**POST** `/api/trading-bots/run-all-active-bots`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
```

#### 8. Obtener Slots de un Bot

**GET** `/api/trading-bots/get-bot-slots?bot_id={bot_id}`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
```

#### 9. Obtener Logs de un Bot

**GET** `/api/trading-bots/get-bot-logs?bot_id={bot_id}&limit=100`

Headers:
```
Authorization: Bearer {JWT_TOKEN}
```

## 🔐 Seguridad

### Generar Claves Seguras

En PHP:
```php
// Para EXCHANGE_ENCRYPTION_KEY
echo bin2hex(random_bytes(32));

// Para JWT_SECRET
echo bin2hex(random_bytes(32));
```

### Recomendaciones

1. **Nunca** expongas las claves en el código
2. Usa HTTPS siempre
3. Implementa rate limiting
4. Mantén PHP actualizado
5. Revisa logs regularmente

## 🧪 Testing

Prueba la API con curl:

```bash
# Test CORS
curl -X OPTIONS https://tudominio.com/php-api/api/save-exchange-keys \
  -H "Origin: https://tudominio.com" \
  -v

# Test endpoint (necesitas un JWT válido)
curl -X POST https://tudominio.com/php-api/api/sync-exchange-balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 📝 Notas Importantes

### Para PostgreSQL
El esquema SQL usa sintaxis PostgreSQL. Si funciona directamente.

### Para MySQL
Realiza estos cambios en `database/schema.sql`:

1. Reemplaza `UUID` por `CHAR(36)`
2. Reemplaza `gen_random_uuid()` por `UUID()`
3. Cambia `TIMESTAMP WITH TIME ZONE` por `TIMESTAMP`
4. Reemplaza `app_role` enum con:
   ```sql
   role ENUM('admin', 'user') NOT NULL
   ```

### Proxy para Binance/Bybit

Si tu ubicación está bloqueada por los exchanges, necesitas agregar soporte de proxy en las funciones `fetchBinanceBalance` y `fetchBybitBalance`:

```php
curl_setopt($ch, CURLOPT_PROXY, "tu-proxy:puerto");
curl_setopt($ch, CURLOPT_PROXYUSERPWD, "usuario:contraseña");
```

## 📚 Próximos Pasos

Este paquete incluye las funciones **core de exchanges** y **trading bots**. Necesitarás implementar:

- Sistema de autenticación completo (login, register)
- Integración completa de APIs de Bybit/Binance (precio actual, ATR, colocar órdenes)
- Notificaciones Telegram
- Panel de administración
- Gestión de suscripciones

### Notas sobre Trading Bots

Las funciones `run-bot.php` y `run-all-active-bots.php` contienen placeholders para las llamadas a las APIs de Bybit. Necesitas implementar:

1. **getCurrentPrice()**: Obtener precio actual del mercado
2. **fetchATR()**: Calcular Average True Range
3. **getUserBalance()**: Obtener balance de la cuenta
4. **placeBuyOrder()**: Colocar orden de compra limit
5. **placeTPOrder()**: Colocar orden de take-profit
6. **cancelOrder()**: Cancelar una orden existente

Todas estas funciones deben usar el **proxy de Webshare** para evitar geo-blocking.

## 🆘 Soporte

Si encuentras errores:

1. Revisa los logs de PHP en Hostinger
2. Verifica la conexión a la base de datos
3. Confirma que las claves de encriptación están configuradas
4. Asegúrate de que CORS está correctamente configurado
