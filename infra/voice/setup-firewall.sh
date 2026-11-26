#!/usr/bin/env bash
set -euo pipefail

# RYCS Voice — Firewall (UFW) para o servidor Asterisk
# Uso: sudo bash setup-firewall.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.voice"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

BACKEND_IP="${BACKEND_IP:-3.132.225.173}"
ADMIN_IP="${ADMIN_IP:-}"

echo "=== RYCS Voice — Firewall ==="

ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH (restrito se IP admin definido)
if [ -n "$ADMIN_IP" ]; then
  ufw allow from "$ADMIN_IP" to any port 22 proto tcp comment "SSH admin"
else
  ufw allow 22/tcp comment "SSH (restringir após setup)"
fi

# SIP (operadora — restringir ao IP da operadora após contratação)
ufw allow 5060/udp comment "SIP signaling"

# WebSocket WSS (WebRTC dos SDRs — público)
ufw allow 8089/tcp comment "WebSocket WSS (WebRTC)"

# RTP/SRTP (áudio — público, range grande)
ufw allow 10000:20000/udp comment "RTP/SRTP audio"

# ARI (somente backend RYCS)
ufw allow from "$BACKEND_IP" to any port 8088 proto tcp comment "ARI HTTP (backend RYCS)"

# Certbot (renovação de certificados)
ufw allow 80/tcp comment "HTTP certbot renewal"

ufw --force enable
ufw status verbose

echo ""
echo "=== Firewall configurado ==="
echo "IMPORTANTE: Após contratar a operadora SIP, restringir porta 5060 ao IP dela:"
echo "  ufw delete allow 5060/udp"
echo "  ufw allow from <IP_OPERADORA> to any port 5060 proto udp"
