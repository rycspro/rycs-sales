#!/usr/bin/env bash
set -euo pipefail

# RYCS Voice — Monitoramento, health checks, logs e backup
# Uso: sudo bash setup-monitoring.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== RYCS Voice — Monitoramento ==="

# ── 1. Health check script ──
cat > /usr/local/bin/rycs-voice-health << 'HEALTH'
#!/usr/bin/env bash
# Health check do Asterisk — retorna JSON com status

ERRORS=()
STATUS="ok"

# Asterisk rodando?
if ! systemctl is-active --quiet asterisk; then
  ERRORS+=("asterisk_down")
  STATUS="critical"
fi

# ARI acessível?
if ! curl -sf --max-time 5 http://127.0.0.1:8088/ari/asterisk/info -u "${ARI_USER:-rycs-voice}:${ARI_PASS:-}" >/dev/null 2>&1; then
  ERRORS+=("ari_unreachable")
  STATUS="critical"
fi

# Trunk SIP registrado? (se configurado)
if command -v asterisk &>/dev/null && asterisk -rx "pjsip show registrations" 2>/dev/null | grep -q "operadora"; then
  if ! asterisk -rx "pjsip show registrations" 2>/dev/null | grep -q "Registered"; then
    ERRORS+=("sip_trunk_unregistered")
    [ "$STATUS" = "ok" ] && STATUS="warning"
  fi
fi

# Certificado TLS válido?
DOMAIN="${VOICE_DOMAIN:-voice.rycs.pro}"
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT" ]; then
  DAYS_LEFT=$(( ( $(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2 | xargs -I{} date -d {} +%s) - $(date +%s) ) / 86400 ))
  if [ "$DAYS_LEFT" -lt 7 ]; then
    ERRORS+=("tls_expiring_${DAYS_LEFT}d")
    [ "$STATUS" = "ok" ] && STATUS="warning"
  fi
fi

# Disco
DISK_PERCENT=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "$DISK_PERCENT" -gt 90 ]; then
  ERRORS+=("disk_${DISK_PERCENT}pct")
  [ "$STATUS" = "ok" ] && STATUS="warning"
fi

# Canais ativos
CHANNELS=$(asterisk -rx "core show channels count" 2>/dev/null | grep "active" | awk '{print $1}' || echo "0")

echo "{\"status\":\"$STATUS\",\"channels\":$CHANNELS,\"disk\":$DISK_PERCENT,\"errors\":[$(printf '"%s",' "${ERRORS[@]}" | sed 's/,$//' )]}"
HEALTH
chmod +x /usr/local/bin/rycs-voice-health

# ── 2. Log rotation ──
cat > /etc/logrotate.d/asterisk << 'LOGROTATE'
/var/log/asterisk/messages
/var/log/asterisk/full {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        /usr/sbin/asterisk -rx "logger reload" > /dev/null 2>&1 || true
    endscript
}
LOGROTATE

# ── 3. Backup de configuração (diário) ──
cat > /usr/local/bin/rycs-voice-backup << 'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/var/backups/asterisk"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d)

tar czf "$BACKUP_DIR/asterisk-config-$DATE.tar.gz" /etc/asterisk/ 2>/dev/null
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
echo "Backup salvo: $BACKUP_DIR/asterisk-config-$DATE.tar.gz"
BACKUP
chmod +x /usr/local/bin/rycs-voice-backup

# Cron de backup
CRON_BACKUP="0 2 * * * /usr/local/bin/rycs-voice-backup >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v rycs-voice-backup; echo "$CRON_BACKUP") | crontab -

# ── 4. Fail2ban para SIP ──
cat > /etc/fail2ban/jail.d/asterisk.conf << 'FAIL2BAN'
[asterisk]
enabled  = true
port     = 5060
protocol = udp
filter   = asterisk
logpath  = /var/log/asterisk/messages
maxretry = 5
bantime  = 3600
findtime = 600
FAIL2BAN

systemctl restart fail2ban 2>/dev/null || true

# ── 5. Procedimento de recuperação ──
cat > /usr/local/bin/rycs-voice-recover << 'RECOVER'
#!/usr/bin/env bash
set -euo pipefail
echo "=== RYCS Voice — Recuperação ==="

# 1. Reiniciar Asterisk
echo "Reiniciando Asterisk..."
systemctl restart asterisk
sleep 5

# 2. Verificar health
HEALTH=$(/usr/local/bin/rycs-voice-health)
echo "Health: $HEALTH"

if echo "$HEALTH" | grep -q '"critical"'; then
  echo "CRÍTICO: Asterisk não recuperou. Verificar logs:"
  echo "  tail -50 /var/log/asterisk/messages"
  echo "  journalctl -u asterisk --since '5 min ago'"
  exit 1
fi

# 3. Re-registrar trunk SIP
asterisk -rx "pjsip send register operadora" 2>/dev/null || true
sleep 3

echo "=== Recuperação concluída ==="
/usr/local/bin/rycs-voice-health
RECOVER
chmod +x /usr/local/bin/rycs-voice-recover

echo "=== Monitoramento configurado ==="
echo "Health check: /usr/local/bin/rycs-voice-health"
echo "Backup: /usr/local/bin/rycs-voice-backup (diário às 02:00)"
echo "Recuperação: /usr/local/bin/rycs-voice-recover"
