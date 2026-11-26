# RYCS Voice — Infraestrutura SIP/Asterisk

## Visão geral da arquitetura

```
┌──────────────┐     WebSocket/SRTP      ┌──────────────┐    SIP Trunk     ┌──────────────┐
│  Navegador   │ ◄──────────────────────► │   Asterisk   │ ◄─────────────► │  Operadora   │
│  (WebRTC)    │                          │   (PJSIP)    │                 │  SIP (PSTN)  │
└──────────────┘                          └──────┬───────┘                 └──────────────┘
                                                 │ ARI (HTTP + WS)
                                                 ▼
                                          ┌──────────────┐
                                          │  Backend     │
                                          │  RYCS Voice  │
                                          │  (Node.js)   │
                                          └──────────────┘
```

**Fluxo de uma ligação:**
1. Profissional clica "Ligar" no navegador (DiscadoraProfissional).
2. Backend cria canal via ARI do Asterisk.
3. Asterisk conecta o navegador ao profissional via WebRTC (WebSocket + SRTP).
4. Asterisk origina a chamada ao lead pela operadora SIP (trunk PSTN).
5. Ao conectar, Asterisk faz bridge entre os dois canais.
6. Eventos ARI chegam ao backend via WebSocket (atendeu, desligou, falha).
7. Backend atualiza voice_calls, voice_call_events, voice_usage_events.

---

## Requisitos do servidor Asterisk

### Hardware/VM recomendada (AWS EC2)
| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| vCPUs | 2 | 4 |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB SSD | 50 GB SSD (para gravações futuras) |
| Instância EC2 | t3.small | t3.medium |
| SO | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Portas de rede (Security Group)

| Porta | Protocolo | Origem | Uso |
|-------|-----------|--------|-----|
| 5060 | UDP/TCP | IP da operadora SIP | Sinalização SIP |
| 5061 | TCP (TLS) | IP da operadora SIP | Sinalização SIP segura |
| 8089 | TCP (WSS) | 0.0.0.0/0 (HTTPS) | WebSocket para WebRTC |
| 10000-20000 | UDP | 0.0.0.0/0 | RTP/SRTP (áudio) |
| 8088 | TCP | IP do backend RYCS | ARI HTTP |
| 22 | TCP | IP de administração | SSH |

> **Nunca** exponha a porta ARI (8088) à internet. Use Security Group restrito ao IP do backend.

---

## Instalação do Asterisk na AWS

### 1. Provisionar instância EC2

```bash
# Ubuntu 22.04 LTS, t3.medium, SSD 50GB
# Security group com as portas acima
# Elastic IP atribuído (necessário para SIP e DNS)
```

### 2. Instalar dependências

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential wget libssl-dev libncurses5-dev \
  libnewt-dev libxml2-dev linux-headers-$(uname -r) libsqlite3-dev \
  uuid-dev libjansson-dev libsrtp2-dev libpjproject-dev
```

### 3. Compilar Asterisk 20 LTS

```bash
cd /usr/local/src
sudo wget https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz
sudo tar xzf asterisk-20-current.tar.gz
cd asterisk-20.*/

# Habilitar módulos necessários
sudo contrib/scripts/get_mp3_source.sh
sudo ./configure --with-pjproject-bundled --with-jansson-bundled
sudo make menuselect  # Habilitar: res_pjsip, res_ari, res_http_websocket, codec_opus
sudo make -j$(nproc)
sudo make install
sudo make samples
sudo make config
sudo ldconfig
```

### 4. Criar usuário Asterisk

```bash
sudo adduser --system --group --no-create-home asterisk
sudo chown -R asterisk:asterisk /var/{run,lib,log,spool}/asterisk
sudo chown -R asterisk:asterisk /etc/asterisk
```

---

## Configuração PJSIP

### `/etc/asterisk/pjsip.conf`

```ini
; ── Transporte WSS (WebRTC) ──────────────────────────────────
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/letsencrypt/live/voice.rycs.pro/fullchain.pem
priv_key_file=/etc/letsencrypt/live/voice.rycs.pro/privkey.pem

; ── Transporte UDP (SIP trunk) ───────────────────────────────
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=<ELASTIC_IP>
external_signaling_address=<ELASTIC_IP>
local_net=172.16.0.0/12

; ── Template para ramais WebRTC ──────────────────────────────
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

; ── Trunk da operadora SIP ───────────────────────────────────
; Substituir pelos dados reais da operadora contratada.
[operadora]
type=registration
transport=transport-udp
outbound_auth=operadora-auth
server_uri=sip:<HOST_OPERADORA>
client_uri=sip:<USUARIO>@<HOST_OPERADORA>
retry_interval=60

[operadora-auth]
type=auth
auth_type=userpass
username=<USUARIO_OPERADORA>
password=<SENHA_OPERADORA>

[operadora-endpoint]
type=endpoint
transport=transport-udp
context=rycs-incoming
disallow=all
allow=ulaw
allow=alaw
outbound_auth=operadora-auth
aors=operadora-aor
from_domain=<HOST_OPERADORA>

[operadora-aor]
type=aor
contact=sip:<HOST_OPERADORA>:5060
qualify_frequency=60

[operadora-identify]
type=identify
endpoint=operadora-endpoint
match=<IP_OPERADORA>
```

---

## Configuração WebRTC

### `/etc/asterisk/http.conf`

```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/letsencrypt/live/voice.rycs.pro/fullchain.pem
tlsprivatekey=/etc/letsencrypt/live/voice.rycs.pro/privkey.pem
```

### Certificado TLS (Let's Encrypt)

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d voice.rycs.pro
# Renovação automática via cron
echo "0 3 * * * certbot renew --quiet && systemctl reload asterisk" | sudo crontab -
```

### DNS necessário

| Registro | Tipo | Valor |
|----------|------|-------|
| voice.rycs.pro | A | <ELASTIC_IP_ASTERISK> |

---

## Integração ARI (Asterisk REST Interface)

### `/etc/asterisk/ari.conf`

```ini
[general]
enabled=yes
pretty=yes

[rycs-voice]
type=user
read_only=no
password=<ARI_PASSWORD>
password_format=plain
```

### `/etc/asterisk/extensions.conf` (dialplan mínimo)

```ini
[rycs-outgoing]
; Chamadas originadas pela RYCS Voice via ARI
exten => _X.,1,NoOp(RYCS Voice outgoing call to ${EXTEN})
 same => n,Stasis(rycs-voice,outgoing,${EXTEN})
 same => n,Hangup()

[rycs-incoming]
; Chamadas recebidas (futuro: callback, retorno)
exten => _X.,1,NoOp(RYCS Voice incoming from ${CALLERID(num)})
 same => n,Stasis(rycs-voice,incoming,${CALLERID(num)})
 same => n,Hangup()
```

### Comunicação Backend ↔ ARI

O backend RYCS se conecta ao ARI via:
- **HTTP REST**: `https://voice.rycs.pro:8088/ari/` — criar canais, bridges, controlar chamadas.
- **WebSocket**: `wss://voice.rycs.pro:8088/ari/events?app=rycs-voice` — receber eventos em tempo real.

Fluxo para originar uma ligação:
```
1. POST /ari/channels
   { endpoint: "PJSIP/<numero>@operadora-endpoint",
     app: "rycs-voice",
     appArgs: "outgoing,<lead_id>" }

2. Evento: StasisStart → backend cria bridge

3. POST /ari/bridges/{id}/addChannel
   → conecta canal do profissional (WebRTC) + canal do lead (PSTN)

4. Eventos: ChannelStateChange, ChannelHangupRequest, StasisEnd
   → backend atualiza voice_calls e voice_call_events
```

---

## Variáveis de ambiente

### Backend RYCS (server/.env)

```env
# ── Asterisk / SIP (desabilitado até configuração) ──
ASTERISK_ARI_URL=https://voice.rycs.pro:8088/ari
ASTERISK_ARI_USER=rycs-voice
ASTERISK_ARI_PASSWORD=
ASTERISK_WS_URL=wss://voice.rycs.pro:8088/ari/events?app=rycs-voice

# ── Operadora SIP ──
SIP_TRUNK_HOST=
SIP_TRUNK_USER=
SIP_TRUNK_PASS=
SIP_CALLER_ID=

# ── WebRTC ──
WEBRTC_WSS_URL=wss://voice.rycs.pro:8089/ws
```

> **Nunca** preencha credenciais reais no `.env.example`. Use o GitHub Secrets para produção.

### Exemplo `.env.example` (sem credenciais reais)

```env
ASTERISK_ARI_URL=https://voice.example.com:8088/ari
ASTERISK_ARI_USER=rycs-voice
ASTERISK_ARI_PASSWORD=TROCAR_POR_SENHA_SEGURA
ASTERISK_WS_URL=wss://voice.example.com:8088/ari/events?app=rycs-voice
SIP_TRUNK_HOST=sip.operadora.com.br
SIP_TRUNK_USER=TROCAR
SIP_TRUNK_PASS=TROCAR
SIP_CALLER_ID=+5511999999999
WEBRTC_WSS_URL=wss://voice.example.com:8089/ws
```

---

## Estratégia de gravação (futura)

Gravações ficam **desabilitadas** até validação jurídica (LGPD / consentimento):

1. Asterisk grava localmente em `/var/spool/asterisk/recording/`.
2. Script move para S3 (bucket privado, criptografado, lifecycle 90 dias).
3. Backend referencia `voice_recordings.path` = chave S3.
4. Acesso somente via URL pré-assinada com expiração de 5 minutos.

---

## Procedimento para a primeira ligação real

### Pré-requisitos
1. Instância EC2 com Asterisk configurado.
2. Certificado TLS válido para `voice.rycs.pro`.
3. DNS `voice.rycs.pro` apontando para o Elastic IP.
4. Conta ativa na operadora SIP com trunk configurado.
5. Credenciais ARI e SIP preenchidas no backend.
6. Provedor SIP ativado no código (atualmente stub retorna `pendente: true`).

### Passos
1. Testar conectividade: `asterisk -rx "pjsip show registrations"` → trunk deve estar `Registered`.
2. Testar áudio: ligar para um número de teste da operadora.
3. No backend: implementar `sipProvider.js` usando as chamadas ARI documentadas acima.
4. No frontend: habilitar botão "Modo Navegador" no DiscadoraProfissional.
5. Teste: habilitar voice para uma empresa de teste, criar fila, adicionar lead, iniciar sessão com modo SIP, ligar.
6. Validar: eventos ARI chegam ao backend, voice_calls atualizado, duração correta.

---

## Procedimento de rollback

Caso haja problema após habilitar o provedor SIP:

1. **Imediato**: Desabilitar voice para a empresa via admin: `POST /api/voice/admin/habilitar { companyId, habilitada: false }`.
2. **Provider**: No `sipProvider.js`, garantir que `canInitiate: false` desativa originar chamadas.
3. **Asterisk**: `systemctl stop asterisk` para parar toda telefonia.
4. **DNS**: Remover registro `voice.rycs.pro` se necessário.
5. **Backend**: Reverter deploy (git revert + push na main).

A feature flag `voice_habilitada` garante que nenhuma empresa é afetada sem ativação explícita pelo admin.

---

## Credenciais necessárias da operadora SIP

Para contratar uma operadora SIP no Brasil, serão necessários:

| Item | Descrição |
|------|-----------|
| Host SIP | Endereço do servidor da operadora (ex: `sip.operadora.com.br`) |
| Usuário SIP | Login de autenticação do trunk |
| Senha SIP | Senha de autenticação |
| DID / CallerID | Número(s) de origem com DDD (ex: +5511...) |
| Codec suportados | Tipicamente G.711 (ulaw/alaw), Opus |
| IP de sinalização | IP(s) da operadora para whitelist no security group |

### Operadoras SIP sugeridas (Brasil)
- **Nvoip** — API REST + SIP, preço por minuto
- **TotalVoice/Zenvia** — API + SIP trunk
- **Vono/GVT** — trunk SIP tradicional
- **Twilio** — SIP trunking global (mais caro, maior suporte)

> Nenhuma operadora foi contratada. Esta etapa requer autorização e orçamento.

---

## Resumo de custos estimados

| Recurso | Custo mensal estimado |
|---------|----------------------|
| EC2 t3.medium (Asterisk) | ~US$ 30 |
| Elastic IP | ~US$ 3,65 (se não associado) |
| Operadora SIP (minutos) | Variável (~R$ 0,06–0,15/min fixo BR) |
| S3 para gravações (futuro) | ~US$ 2/GB |
| Certificado TLS | Gratuito (Let's Encrypt) |

> **Nenhum recurso foi provisionado.** Esta documentação é preparatória.
