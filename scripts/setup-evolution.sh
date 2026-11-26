#!/bin/bash
# Setup da Evolution API no EC2.
# Executar como ec2-user no servidor de produção.
#
# Usa docker run diretamente (sem docker-compose).
# NÃO expõe a porta 8080 publicamente (só localhost).
# NÃO altera o container principal da RYCS.
# NÃO altera a integração oficial da Meta.

set -euo pipefail

CONTAINER_NAME="rycs-evolution-api"
IMAGE="atendai/evolution-api:v2.2.3"
ENV_FILE="/home/ec2-user/env_producao.txt"
VOLUME_NAME="rycs_evolution_instances"

echo "═══════════════════════════════════════════════"
echo "  RYCS — Setup Evolution API (WhatsApp Pessoal)"
echo "═══════════════════════════════════════════════"

# 1. Gerar chave forte se não existir
if grep -q "^EVOLUTION_API_KEY=" "$ENV_FILE" 2>/dev/null; then
  EVO_KEY=$(grep "^EVOLUTION_API_KEY=" "$ENV_FILE" | cut -d= -f2-)
  echo "✓ EVOLUTION_API_KEY já definida no env_producao.txt"
else
  EVO_KEY=$(openssl rand -hex 32)
  echo "EVOLUTION_API_KEY=$EVO_KEY" >> "$ENV_FILE"
  echo "✓ EVOLUTION_API_KEY gerada e adicionada ao env_producao.txt"
fi

# 2. Adicionar EVOLUTION_API_URL se não existir
if ! grep -q "^EVOLUTION_API_URL=" "$ENV_FILE" 2>/dev/null; then
  echo "EVOLUTION_API_URL=http://localhost:8080" >> "$ENV_FILE"
  echo "✓ EVOLUTION_API_URL adicionada ao env_producao.txt"
else
  echo "✓ EVOLUTION_API_URL já definida"
fi

# 3. Descobrir o IP do host para o container acessar o backend RYCS.
HOST_IP=$(ip -4 addr show docker0 2>/dev/null | grep -oP 'inet \K[\d.]+' || echo "172.17.0.1")
WEBHOOK_URL="http://${HOST_IP}:3001/api/webhooks/evolution"
echo "✓ Webhook URL: $WEBHOOK_URL"

# 4. Pull da imagem
echo "Baixando imagem $IMAGE..."
docker pull "$IMAGE"
echo "✓ Imagem baixada"

# 5. Parar container anterior se existir
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Parando container anterior..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  echo "✓ Container anterior removido"
fi

# 6. Criar volume se não existir
docker volume create "$VOLUME_NAME" 2>/dev/null || true

# 7. Iniciar container
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -v "${VOLUME_NAME}:/evolution/instances" \
  --memory 512m \
  -e SERVER_URL=http://localhost:8080 \
  -e SERVER_PORT=8080 \
  -e AUTHENTICATION_TYPE=apikey \
  -e "AUTHENTICATION_API_KEY=${EVO_KEY}" \
  -e AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true \
  -e DATABASE_ENABLED=false \
  -e DEL_INSTANCE=false \
  -e CONFIG_SESSION_PHONE_CLIENT=RYCS \
  -e CONFIG_SESSION_PHONE_NAME=Chrome \
  -e "WEBHOOK_GLOBAL_URL=${WEBHOOK_URL}" \
  -e WEBHOOK_GLOBAL_ENABLED=true \
  -e WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false \
  -e WEBHOOK_EVENTS_APPLICATION_STARTUP=false \
  -e WEBHOOK_EVENTS_QRCODE_UPDATED=true \
  -e WEBHOOK_EVENTS_MESSAGES_SET=false \
  -e WEBHOOK_EVENTS_MESSAGES_UPSERT=true \
  -e WEBHOOK_EVENTS_MESSAGES_UPDATE=true \
  -e WEBHOOK_EVENTS_MESSAGES_DELETE=false \
  -e WEBHOOK_EVENTS_SEND_MESSAGE=true \
  -e WEBHOOK_EVENTS_CONTACTS_SET=false \
  -e WEBHOOK_EVENTS_CONTACTS_UPSERT=false \
  -e WEBHOOK_EVENTS_CONTACTS_UPDATE=false \
  -e WEBHOOK_EVENTS_PRESENCE_UPDATE=false \
  -e WEBHOOK_EVENTS_CHATS_SET=false \
  -e WEBHOOK_EVENTS_CHATS_UPSERT=false \
  -e WEBHOOK_EVENTS_CHATS_UPDATE=false \
  -e WEBHOOK_EVENTS_CHATS_DELETE=false \
  -e WEBHOOK_EVENTS_GROUPS_UPSERT=false \
  -e WEBHOOK_EVENTS_GROUPS_UPDATE=false \
  -e WEBHOOK_EVENTS_GROUP_PARTICIPANTS_UPDATE=false \
  -e WEBHOOK_EVENTS_CONNECTION_UPDATE=true \
  -e WEBHOOK_EVENTS_CALL=false \
  -e STORE_MESSAGES=false \
  -e STORE_MESSAGE_UP=false \
  -e STORE_CONTACTS=false \
  -e STORE_CHATS=false \
  -e CLEAN_STORE_CLEANING_INTERVAL=7200 \
  -e CLEAN_STORE_MESSAGES=true \
  -e CLEAN_STORE_MESSAGE_UP=true \
  -e CLEAN_STORE_CONTACTS=true \
  -e CLEAN_STORE_CHATS=true \
  -e LOG_LEVEL=WARN \
  -e LOG_COLOR=true \
  -e LOG_BAILEYS=error \
  "$IMAGE"

echo "✓ Container $CONTAINER_NAME iniciado"

# 8. Aguardar health check
echo -n "Aguardando health check"
ok=0
for i in $(seq 1 20); do
  if curl -sf --max-time 3 http://localhost:8080/ >/dev/null 2>&1; then
    ok=1
    break
  fi
  echo -n "."
  sleep 3
done
echo

if [ "$ok" = "1" ]; then
  echo "✓ Evolution API respondendo em localhost:8080"
else
  echo "✗ Evolution API não respondeu. Logs:"
  docker logs --tail 20 "$CONTAINER_NAME" 2>&1 || true
  exit 1
fi

# 9. Testar comunicação com o backend RYCS
echo -n "Testando webhook do backend RYCS... "
RESP=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: $EVO_KEY" \
  -d '{"event":"test","instance":"setup-check","data":{}}' \
  http://localhost:3001/api/webhooks/evolution 2>/dev/null || echo "000")

if [ "$RESP" = "200" ]; then
  echo "OK (HTTP 200)"
else
  echo "AVISO: HTTP $RESP (reiniciando o backend para pegar as novas env vars)"
  docker restart rycs-app 2>/dev/null || true
  sleep 10
  RESP2=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "apikey: $EVO_KEY" \
    -d '{"event":"test","instance":"setup-check","data":{}}' \
    http://localhost:3001/api/webhooks/evolution 2>/dev/null || echo "000")
  echo "Após restart: HTTP $RESP2"
fi

# 10. Verificar que a porta não está exposta publicamente
PUBLIC=$(ss -tlnp | grep ":8080" | grep -v "127.0.0.1" | head -1 || true)
if [ -n "$PUBLIC" ]; then
  echo "⚠ ALERTA: a porta 8080 está escutando em interface pública!"
else
  echo "✓ Porta 8080 apenas em localhost (seguro)"
fi

echo
echo "═══════════════════════════════════════════════"
echo "  Setup concluído!"
echo ""
echo "  Logs:    docker logs -f $CONTAINER_NAME"
echo "  Parar:   docker stop $CONTAINER_NAME"
echo "  Restart: docker restart $CONTAINER_NAME"
echo "═══════════════════════════════════════════════"
