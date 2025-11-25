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

# API Routes
RewriteRule ^api/save-exchange-keys$ api/save-exchange-keys.php [L]
RewriteRule ^api/sync-exchange-balance$ api/sync-exchange-balance.php [L]
RewriteRule ^api/disconnect-exchange$ api/disconnect-exchange.php [L]

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

### 1. Guardar Claves de Exchange

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

### 2. Sincronizar Balance

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

### 3. Desconectar Exchange

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

Este paquete incluye solo las funciones **core de exchanges**. Necesitarás implementar:

- Sistema de autenticación completo (login, register)
- Trading bots
- Notificaciones Telegram
- Panel de administración
- Gestión de suscripciones

## 🆘 Soporte

Si encuentras errores:

1. Revisa los logs de PHP en Hostinger
2. Verifica la conexión a la base de datos
3. Confirma que las claves de encriptación están configuradas
4. Asegúrate de que CORS está correctamente configurado
