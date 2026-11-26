#!/usr/bin/env bash
set -euo pipefail

# RYCS Voice — Certificado TLS (Let's Encrypt) para o servidor Asterisk
# Uso: sudo bash setup-tls.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.voice"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

DOMAIN="${VOICE_DOMAIN:?Defina VOICE_DOMAIN}"
EMAIL="${CERT_EMAIL:-admin@rycs.pro}"

echo "=== RYCS Voice — Certificado TLS ==="
echo "Domínio: $DOMAIN"
echo "E-mail: $EMAIL"

# Instalar certbot se necessário
command -v certbot >/dev/null || apt-get install -y certbot

# Parar serviços que usam porta 80
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true

# Obter certificado
certbot certonly --standalone \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

# Renovação automática com reload do Asterisk
CRON_LINE="0 3 * * * certbot renew --quiet --post-hook 'systemctl reload asterisk'"
(crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_LINE") | crontab -

# Permissões para Asterisk ler os certificados
chmod 755 /etc/letsencrypt/live/ /etc/letsencrypt/archive/
chmod 644 /etc/letsencrypt/live/"$DOMAIN"/*.pem

echo "=== Certificado TLS configurado ==="
echo "Certificado: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "Chave: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
