#!/bin/bash
# Setup da Evolution API no EC2 — stack isolada: Postgres + Redis + Evolution API.
# Executar como ec2-user no servidor de produção (via workflow setup-evolution).
#
# Arquitetura:
#   - Rede Docker isolada "rycs-evolution-net" (DNS por nome de container).
#   - Postgres e Redis SEM portas publicadas (só acessíveis dentro da rede).
#   - Evolution API publicada SÓ no IP interno do docker0 (NÃO em interface
#     pública) para o backend rycs-app (no bridge default) alcançar.
#   - Webhook Evolution -> backend pela URL pública HTTPS (autenticada por apikey).
#
# NÃO altera o container rycs-app nem o deploy de produção.
# NÃO altera a integração oficial da Meta.
# NÃO expõe nenhuma porta administrativa publicamente.

set -euo pipefail

NET="rycs-evolution-net"
CN="rycs-evolution-api"
PG="rycs-evolution-postgres"
RD="rycs-evolution-redis"
IMAGE="evoapicloud/evolution-api:v2.2.3"
PG_IMAGE="postgres:16-alpine"
RD_IMAGE="redis:7-alpine"
ENV_FILE="/home/ec2-user/env_producao.txt"
PG_VOL="rycs_evolution_pgdata"
RD_VOL="rycs_evolution_redisdata"
WEBHOOK_URL="https://app.rycs.pro/api/webhooks/evolution"

echo "═══════════════════════════════════════════════"
echo "  RYCS — Setup Evolution API (Postgres + Redis)"
echo "═══════════════════════════════════════════════"

# ── 0. Preflight de recursos (aborta se faltar RAM/disco) ─────────────────
AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')
DISK_MB=$(df -m / | awk 'NR==2{print $4}')
echo "Recursos: ${AVAIL_MB}MB RAM disponível, ${DISK_MB}MB disco livre em /"
if [ "${AVAIL_MB:-0}" -lt 600 ]; then
  echo "✗ RAM disponível insuficiente (<600MB). Abortando para não arriscar o rycs-app."
  exit 1
fi
if [ "${DISK_MB:-0}" -lt 1500 ]; then
  echo "✗ Disco livre insuficiente (<1.5GB). Abortando."
  exit 1
fi
echo "✓ Recursos suficientes"

# ── 1. Segredos (gerar e persistir no env; reutilizar se já existirem) ────
upsert_env() {
  local chave="$1" valor="$2"
  if grep -q "^${chave}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${chave}=.*|${chave}=${valor}|" "$ENV_FILE"
  else
    echo "${chave}=${valor}" >> "$ENV_FILE"
  fi
}
# || true: sob pipefail, grep sem match retorna não-zero e o set -e mataria o
# script na atribuição VAR=$(read_env ...) quando a chave ainda não existe.
read_env() { grep "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true; }

EVO_KEY=$(read_env EVOLUTION_API_KEY)
if [ -z "$EVO_KEY" ]; then
  EVO_KEY=$(openssl rand -hex 32)
  upsert_env EVOLUTION_API_KEY "$EVO_KEY"
  echo "✓ EVOLUTION_API_KEY gerada"
else
  echo "✓ EVOLUTION_API_KEY reutilizada"
fi

DB_PASS=$(read_env EVOLUTION_DB_PASSWORD)
if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -hex 24)
  upsert_env EVOLUTION_DB_PASSWORD "$DB_PASS"
  echo "✓ EVOLUTION_DB_PASSWORD gerada"
else
  echo "✓ EVOLUTION_DB_PASSWORD reutilizada"
fi

# IP interno do docker0 — o backend rycs-app (bridge default) alcança a Evolution por aqui.
HOST_IP=$(ip -4 addr show docker0 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1 || echo "172.17.0.1")
upsert_env EVOLUTION_API_URL "http://${HOST_IP}:8080"
upsert_env EVOLUTION_WEBHOOK_URL "$WEBHOOK_URL"
echo "✓ EVOLUTION_API_URL=http://${HOST_IP}:8080 (interno, não público)"
echo "✓ EVOLUTION_WEBHOOK_URL=${WEBHOOK_URL}"

# ── 2. Rede isolada ───────────────────────────────────────────────────────
docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET"
echo "✓ Rede $NET pronta"

# ── 3. Volumes persistentes ───────────────────────────────────────────────
docker volume create "$PG_VOL" >/dev/null 2>&1 || true
docker volume create "$RD_VOL" >/dev/null 2>&1 || true

# ── 4. Postgres (sem porta publicada) ─────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${PG}$"; then
  docker rm -f "$PG" 2>/dev/null || true
  docker run -d --name "$PG" --restart unless-stopped \
    --network "$NET" --memory 512m \
    -e POSTGRES_USER=evolution \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -e POSTGRES_DB=evolution \
    -v "${PG_VOL}:/var/lib/postgresql/data" \
    "$PG_IMAGE"
  echo "✓ Postgres iniciado"
else
  echo "✓ Postgres já em execução"
fi

echo -n "Aguardando Postgres aceitar conexões"
pgok=0
for i in $(seq 1 20); do
  if docker exec "$PG" pg_isready -U evolution >/dev/null 2>&1; then pgok=1; break; fi
  echo -n "."; sleep 2
done
echo
[ "$pgok" = "1" ] && echo "✓ Postgres pronto" || { echo "✗ Postgres não respondeu"; docker logs --tail 20 "$PG"; exit 1; }

# ── 5. Redis (sem porta publicada) ────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${RD}$"; then
  docker rm -f "$RD" 2>/dev/null || true
  docker run -d --name "$RD" --restart unless-stopped \
    --network "$NET" --memory 128m \
    -v "${RD_VOL}:/data" \
    "$RD_IMAGE" redis-server --appendonly yes
  echo "✓ Redis iniciado"
else
  echo "✓ Redis já em execução"
fi
docker exec "$RD" redis-cli ping >/dev/null 2>&1 && echo "✓ Redis pronto" || echo "⚠ Redis não respondeu ao ping"

# ── 6. Pull da Evolution API ──────────────────────────────────────────────
echo "Baixando $IMAGE..."
docker pull "$IMAGE" >/dev/null
echo "✓ Imagem baixada"

# ── 7. Evolution API (publicada só no IP interno do docker0) ──────────────
docker rm -f "$CN" 2>/dev/null || true
docker run -d --name "$CN" --restart unless-stopped \
  --network "$NET" --memory 768m \
  -p "${HOST_IP}:8080:8080" \
  -e SERVER_TYPE=http \
  -e SERVER_PORT=8080 \
  -e "SERVER_URL=http://${HOST_IP}:8080" \
  -e "AUTHENTICATION_API_KEY=${EVO_KEY}" \
  -e AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true \
  -e DATABASE_ENABLED=true \
  -e DATABASE_PROVIDER=postgresql \
  -e "DATABASE_CONNECTION_URI=postgresql://evolution:${DB_PASS}@${PG}:5432/evolution?schema=public" \
  -e DATABASE_CONNECTION_CLIENT_NAME=evolution_rycs \
  -e DATABASE_SAVE_DATA_INSTANCE=true \
  -e DATABASE_SAVE_DATA_NEW_MESSAGE=false \
  -e DATABASE_SAVE_MESSAGE_UPDATE=false \
  -e DATABASE_SAVE_DATA_CONTACTS=false \
  -e DATABASE_SAVE_DATA_CHATS=false \
  -e DATABASE_SAVE_DATA_LABELS=false \
  -e DATABASE_SAVE_DATA_HISTORIC=false \
  -e CACHE_REDIS_ENABLED=true \
  -e "CACHE_REDIS_URI=redis://${RD}:6379/6" \
  -e CACHE_REDIS_PREFIX_KEY=evolution_rycs \
  -e CACHE_REDIS_SAVE_INSTANCES=false \
  -e CACHE_LOCAL_ENABLED=false \
  -e DEL_INSTANCE=false \
  -e CONFIG_SESSION_PHONE_CLIENT=RYCS \
  -e CONFIG_SESSION_PHONE_NAME=Chrome \
  -e QRCODE_LIMIT=30 \
  -e TELEMETRY_ENABLED=false \
  -e "LOG_LEVEL=ERROR,WARN,INFO,LOG" \
  -e LOG_BAILEYS=info \
  "$IMAGE"
echo "✓ Evolution API iniciada"

# ── 8. Health check (migrations do Prisma rodam no boot) ──────────────────
echo -n "Aguardando Evolution API responder"
ok=0
for i in $(seq 1 30); do
  if curl -sf --max-time 3 "http://${HOST_IP}:8080/" >/dev/null 2>&1; then ok=1; break; fi
  echo -n "."; sleep 3
done
echo
if [ "$ok" = "1" ]; then
  echo "✓ Evolution API respondendo em http://${HOST_IP}:8080"
else
  echo "✗ Evolution API não respondeu. Logs:"
  docker logs --tail 40 "$CN" 2>&1 || true
  exit 1
fi

# ── 9. Backend rycs-app consegue alcançar a Evolution? ────────────────────
echo -n "Testando acesso backend rycs-app -> Evolution... "
if docker exec rycs-app node -e "fetch('http://${HOST_IP}:8080/').then(r=>{console.log('HTTP '+r.status);process.exit(r.ok?0:1)}).catch(e=>{console.log('FALHOU: '+e.message);process.exit(1)})" 2>/dev/null; then
  echo "(rycs-app alcança a Evolution ✓)"
else
  echo "⚠ rycs-app não alcançou a Evolution (verifique após o próximo deploy)"
fi

# ── 10. Webhook público aceita eventos autenticados? ──────────────────────
echo -n "Testando webhook público (apikey)... "
RESP=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 -X POST \
  -H "Content-Type: application/json" -H "apikey: ${EVO_KEY}" \
  -d '{"event":"test","instance":"setup-check","data":{}}' \
  "$WEBHOOK_URL" 2>/dev/null || echo "000")
if [ "$RESP" = "200" ]; then
  echo "OK (HTTP 200)"
else
  echo "HTTP $RESP (o backend aplica a nova EVOLUTION_API_KEY após o próximo deploy)"
fi

# ── 11. Garantir que a porta 8080 NÃO está em interface pública ───────────
PUBLIC=$(ss -tlnp 2>/dev/null | grep ":8080" | grep -vE "127.0.0.1|${HOST_IP}" | head -1 || true)
if [ -n "$PUBLIC" ]; then
  echo "⚠ ALERTA: 8080 em interface pública: $PUBLIC"
else
  echo "✓ Porta 8080 só no IP interno ${HOST_IP} (não pública)"
fi

echo
echo "═══════════════════════════════════════════════"
echo "  Setup concluído. Containers:"
docker ps --filter name="$CN" --filter name="$PG" --filter name="$RD" --format "  {{.Names}}: {{.Status}}"
echo "═══════════════════════════════════════════════"
