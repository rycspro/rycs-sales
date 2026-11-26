#!/bin/bash
# Setup da Evolution API no EC2 (3.132.225.173).
# Executar como ec2-user no servidor de produção.
#
# Pré-requisitos:
#   - Docker e Docker Compose instalados
#   - Backend RYCS rodando na porta 3001
#
# Uso:
#   chmod +x scripts/setup-evolution.sh
#   ./scripts/setup-evolution.sh
#
# NÃO expõe a porta 8080 publicamente (só localhost).
# NÃO altera o container principal da RYCS.
# NÃO altera a integração oficial da Meta.

set -euo pipefail

EVOLUTION_DIR="/home/ec2-user/rycs-evolution"
ENV_FILE="/home/ec2-user/env_producao.txt"

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

# 3. Criar diretório e copiar docker-compose
mkdir -p "$EVOLUTION_DIR"
cd /home/ec2-user/rycs-sales

cp docker-compose.evolution.yml "$EVOLUTION_DIR/docker-compose.yml"
echo "✓ docker-compose.yml copiado para $EVOLUTION_DIR"

# 4. Criar arquivo .env para o docker-compose
cat > "$EVOLUTION_DIR/.env" <<ENVEOF
EVOLUTION_API_KEY=$EVO_KEY
EVOLUTION_SERVER_URL=http://localhost:8080
EVOLUTION_WEBHOOK_URL=http://host.docker.internal:3001/api/webhooks/evolution
ENVEOF
echo "✓ .env criado em $EVOLUTION_DIR"

# 5. Pull da imagem e start
cd "$EVOLUTION_DIR"
docker compose pull
docker compose up -d
echo "✓ Evolution API iniciada"

# 6. Aguardar health check
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
  echo "✗ Evolution API não respondeu. Verifique os logs:"
  echo "  docker compose -f $EVOLUTION_DIR/docker-compose.yml logs"
  exit 1
fi

# 7. Testar comunicação com o backend RYCS
echo -n "Testando webhook do backend RYCS... "
RESP=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: $EVO_KEY" \
  -d '{"event":"test","instance":"setup-check","data":{}}' \
  http://localhost:3001/api/webhooks/evolution 2>/dev/null || echo "000")

if [ "$RESP" = "200" ]; then
  echo "OK (HTTP 200)"
else
  echo "AVISO: HTTP $RESP (o backend pode precisar de restart com as novas env vars)"
fi

# 8. Verificar que a porta não está exposta publicamente
PUBLIC=$(ss -tlnp | grep ":8080" | grep -v "127.0.0.1" | head -1 || true)
if [ -n "$PUBLIC" ]; then
  echo "⚠ ALERTA: a porta 8080 está escutando em interface pública!"
  echo "  $PUBLIC"
  echo "  Corrija o docker-compose para usar 127.0.0.1:8080:8080"
else
  echo "✓ Porta 8080 apenas em localhost (seguro)"
fi

echo
echo "═══════════════════════════════════════════════"
echo "  Setup concluído!"
echo ""
echo "  Para reiniciar o backend RYCS com as novas env vars:"
echo "    docker restart rycs-app"
echo ""
echo "  Para ver os logs da Evolution API:"
echo "    cd $EVOLUTION_DIR && docker compose logs -f"
echo ""
echo "  Para parar a Evolution API:"
echo "    cd $EVOLUTION_DIR && docker compose down"
echo "═══════════════════════════════════════════════"
