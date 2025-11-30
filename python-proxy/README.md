# Exchange Proxy Server

Este servidor Python actúa como proxy para Binance y Bybit, evitando el geo-blocking.

## Instalación en Ubuntu Server

```bash
# 1. Instalar Python y pip
sudo apt update
sudo apt install python3 python3-pip python3-venv -y

# 2. Crear directorio y subir archivos
mkdir -p /var/www/exchange-proxy
cd /var/www/exchange-proxy

# Subir exchange_proxy.py y requirements.txt a este directorio

# 3. Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# 4. Instalar dependencias
pip install -r requirements.txt

# 5. Configurar variable de entorno (API KEY de seguridad)
export PROXY_API_KEY="tu-clave-secreta-muy-segura"

# 6. Probar el servidor
python3 exchange_proxy.py
```

## Configuración con systemd (para que corra automáticamente)

Crear archivo `/etc/systemd/system/exchange-proxy.service`:

```ini
[Unit]
Description=Exchange Proxy Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/exchange-proxy
Environment="PROXY_API_KEY=tu-clave-secreta-muy-segura"
Environment="PORT=8080"
ExecStart=/var/www/exchange-proxy/venv/bin/gunicorn -w 4 -b 0.0.0.0:8080 exchange_proxy:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Luego:

```bash
sudo systemctl daemon-reload
sudo systemctl enable exchange-proxy
sudo systemctl start exchange-proxy
sudo systemctl status exchange-proxy
```

## Configuración con Nginx (Reverse Proxy + SSL)

Crear archivo `/etc/nginx/sites-available/exchange-proxy`:

```nginx
server {
    listen 80;
    server_name sistema.mbconstruccion.com;
    
    location /api/exchange/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/exchange-proxy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Añadir SSL con Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d sistema.mbconstruccion.com
```

## Uso desde Edge Functions

URL del proxy: `https://sistema.mbconstruccion.com/api/exchange/balance`

Headers:
```
Authorization: Bearer tu-clave-secreta-muy-segura
Content-Type: application/json
```

Body:
```json
{
  "exchange": "binance",
  "apiKey": "...",
  "apiSecret": "...",
  "accountType": "spot"
}
```

## Firewall

```bash
# Abrir puerto 80 y 443 para HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

## Notas de Seguridad

1. **Cambia el PROXY_API_KEY** por una clave segura
2. Usa HTTPS en producción (configurado con certbot)
3. El servidor solo acepta requests con el API key correcto
4. Las credenciales de los exchanges solo se usan para hacer la petición, no se guardan
