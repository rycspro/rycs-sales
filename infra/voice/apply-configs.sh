#!/usr/bin/env bash
set -euo pipefail

# RYCS Voice — Aplica configs do Asterisk a partir do .env.voice
# Uso: sudo bash apply-configs.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.voice"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado. Copie .env.voice.example e preencha."
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

DOMAIN="${VOICE_DOMAIN:?Defina VOICE_DOMAIN}"
ELASTIC_IP="${ELASTIC_IP:?Defina ELASTIC_IP}"
ARI_USER="${ARI_USER:-rycs-voice}"
ARI_PASS="${ARI_PASS:?Defina ARI_PASS}"
SIP_HOST="${SIP_TRUNK_HOST:-}"
SIP_USER="${SIP_TRUNK_USER:-}"
SIP_PASS="${SIP_TRUNK_PASS:-}"
SIP_CALLER_ID="${SIP_CALLER_ID:-}"
LOCAL_NET="${LOCAL_NET:-172.16.0.0/12}"
BACKEND_IP="${BACKEND_IP:-3.132.225.173}"
STUN_SERVER="${STUN_SERVER:-stun:stun.l.google.com:19302}"

echo "=== Aplicando configurações Asterisk ==="
echo "Domínio: $DOMAIN"
echo "IP público: $ELASTIC_IP"

# ── pjsip.conf ──
cat > /etc/asterisk/pjsip.conf << PJSIP
; RYCS Voice — Gerado por apply-configs.sh

; ── Transporte WSS (WebRTC dos SDRs) ──
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/letsencrypt/live/${DOMAIN}/fullchain.pem
priv_key_file=/etc/letsencrypt/live/${DOMAIN}/privkey.pem

; ── Transporte UDP (trunk SIP com operadora) ──
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=${ELASTIC_IP}
external_signaling_address=${ELASTIC_IP}
local_net=${LOCAL_NET}

; ── Template para ramais WebRTC (SDRs) ──
[webrtc-template](!)
type=endpoint
transport=transport-wss
context=rycs-outgoing
disallow=all
allow=opus
allow=ulaw
dtls_auto_generate_cert=yes
webrtc=yes
media_encryption=dtls
media_use_received_transport=yes
ice_support=yes
use_avpf=yes
rtcp_mux=yes
direct_media=no
PJSIP

# Trunk SIP (se configurado)
if [ -n "$SIP_HOST" ] && [ -n "$SIP_USER" ]; then
  cat >> /etc/asterisk/pjsip.conf << TRUNK

; ── Trunk da operadora SIP ──
[operadora]
type=registration
transport=transport-udp
outbound_auth=operadora-auth
server_uri=sip:${SIP_HOST}
client_uri=sip:${SIP_USER}@${SIP_HOST}
retry_interval=60

[operadora-auth]
type=auth
auth_type=userpass
username=${SIP_USER}
password=${SIP_PASS}

[operadora-endpoint]
type=endpoint
transport=transport-udp
context=rycs-incoming
disallow=all
allow=ulaw
allow=alaw
outbound_auth=operadora-auth
aors=operadora-aor
from_domain=${SIP_HOST}
${SIP_CALLER_ID:+from_user=${SIP_CALLER_ID}}

[operadora-aor]
type=aor
contact=sip:${SIP_HOST}:5060
qualify_frequency=60

[operadora-identify]
type=identify
endpoint=operadora-endpoint
match=${SIP_HOST}
TRUNK
  echo "Trunk SIP configurado para ${SIP_HOST}"
else
  echo "AVISO: Trunk SIP não configurado (SIP_TRUNK_HOST vazio)"
fi

# ── http.conf (ARI + WebSocket) ──
cat > /etc/asterisk/http.conf << HTTP
[general]
enabled=yes
bindaddr=127.0.0.1
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/letsencrypt/live/${DOMAIN}/fullchain.pem
tlsprivatekey=/etc/letsencrypt/live/${DOMAIN}/privkey.pem
HTTP

# ── ari.conf ──
cat > /etc/asterisk/ari.conf << ARI
[general]
enabled=yes
pretty=yes
allowed_origins=https://app.rycs.pro

[${ARI_USER}]
type=user
read_only=no
password=${ARI_PASS}
password_format=plain
ARI

# ── extensions.conf (dialplan) ──
cat > /etc/asterisk/extensions.conf << DIAL
[general]
static=yes
writeprotect=no

[rycs-outgoing]
exten => _X.,1,NoOp(RYCS Voice outgoing to \${EXTEN})
 same => n,Stasis(rycs-voice,outgoing,\${EXTEN})
 same => n,Hangup()

[rycs-incoming]
exten => _X.,1,NoOp(RYCS Voice incoming from \${CALLERID(num)})
 same => n,Stasis(rycs-voice,incoming,\${CALLERID(num)})
 same => n,Hangup()

[rycs-webrtc]
exten => _X.,1,NoOp(RYCS WebRTC call from \${CALLERID(num)})
 same => n,Stasis(rycs-voice,webrtc,\${EXTEN})
 same => n,Hangup()
DIAL

# ── rtp.conf ──
cat > /etc/asterisk/rtp.conf << RTP
[general]
rtpstart=10000
rtpend=20000
strictrtp=yes
icesupport=yes
stunaddr=${STUN_SERVER}
RTP

# ── logger.conf ──
cat > /etc/asterisk/logger.conf << LOG
[general]
dateformat=%F %T.%3q

[logfiles]
console => notice,warning,error
messages => notice,warning,error
full => notice,warning,error,debug,verbose
LOG

# Recarregar Asterisk
if systemctl is-active --quiet asterisk; then
  asterisk -rx "core reload" 2>/dev/null || true
  echo "Asterisk recarregado."
else
  systemctl start asterisk
  echo "Asterisk iniciado."
fi

echo "=== Configuração aplicada com sucesso ==="
