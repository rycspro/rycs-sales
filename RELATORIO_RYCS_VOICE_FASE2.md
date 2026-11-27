# RYCS Voice — Fase 2: Relatório Final

## O que foi implementado

### 1. Plano de Custos Detalhado
- Breakdown AWS: EC2 t3.small (~R$130/mês), IP elástico, armazenamento, transferência
- Custos operadora: fixo R$0,06–0,09/min, celular R$0,15–0,25/min
- Piloto 2 SDRs: ~R$972/mês | 22 SDRs: ~R$8.353/mês
- Arquivo: `docs/discadora/PLANO_PILOTO_TELEFONIA.md`

### 2. Infraestrutura como Código
- `infra/voice/install-asterisk.sh` — Asterisk 20 LTS com PJSIP, ARI, Opus
- `infra/voice/apply-configs.sh` — Gera pjsip.conf, extensions.conf, http.conf, ari.conf, rtp.conf
- `infra/voice/setup-tls.sh` — Let's Encrypt com renovação automática
- `infra/voice/setup-firewall.sh` — UFW (SIP, WSS, RTP, ARI restrito)
- `infra/voice/setup-monitoring.sh` — Health check, logrotate, backup diário, fail2ban, recovery
- `infra/voice/env-voice-example.txt` — Template de variáveis de ambiente

### 3. Provedor SIP Funcional (Desabilitado)
- `sipProvider.js` reescrito com cliente ARI completo (HTTP REST + WebSocket)
- Iniciar/encerrar chamada via ARI, mute, status em tempo real
- Eventos ARI com idempotência (deduplicação por chave)
- Reconexão automática do WebSocket
- Endpoint WebRTC (WSS + STUN) para navegador
- **Desabilitado**: sem variáveis `ASTERISK_ARI_*`, o provedor não inicia

### 4. Consumo e Faturamento
- Tabela `voice_billing_records`: callId, companyId, campaignId, sellerId, duração total/atendida/tarifada, custo operadora, valor comercial
- Rotas: `/voice/billing/resumo`, `/voice/billing/por-profissional`, `/voice/billing/por-campanha`
- Sem cobrança real nesta fase

### 5. Multi-Tenancy
- Tabela `voice_company_limits`: canais simultâneos, chamadas/dia, minutos/mês, prefixos bloqueados, operadora SIP por empresa, números DID
- Rota admin: `/voice/admin/limits` (GET/POST com upsert)
- Controle de canais: `/voice/channels/active` (verifica limite antes de permitir chamada)
- Verificação de destino: `/voice/check-destination` (DNC, prefixo 0900/0300, limite diário)
- Consumo admin: `/voice/admin/consumo` (visão cross-empresa, só admin)

### 6. Testes
- 10 novos testes: billing resumo, por profissional, por campanha, limites admin, leitura de limites, canais ativos, destino válido, bloqueio 0900, admin consumo, isolamento vendedor
- **44/44 testes voice passando**, 595/596 suite total (1 falha pré-existente em sql-schema, não relacionada)

## O que depende de contratação externa

| Recurso | O que contratar | Estimativa |
|---------|----------------|------------|
| EC2 para Asterisk | t3.small Ubuntu 22.04 + IP elástico | ~R$130/mês |
| Operadora SIP | Nvoip, Zenvia ou Twilio (trunk SIP) | ~R$0,06–0,25/min |
| Número DID | Via operadora SIP | ~R$15–50/mês |
| Domínio voice | Subdomínio voice.rycs.pro (DNS A) | Incluído no Vercel |
| TURN server | Opcional (coturn ou serviço) | ~R$50/mês se necessário |

## Credenciais necessárias (GitHub Secrets)

```
ASTERISK_ARI_URL=http://127.0.0.1:8088/ari
ASTERISK_ARI_USER=rycs-voice
ASTERISK_ARI_PASSWORD=<gerar senha forte>
ASTERISK_WS_URL=ws://127.0.0.1:8088/ari/events?app=rycs-voice
WEBRTC_WSS_URL=wss://voice.rycs.pro:8089/ws
SIP_TRUNK_HOST=<fornecido pela operadora>
SIP_TRUNK_USER=<fornecido pela operadora>
SIP_TRUNK_PASS=<fornecido pela operadora>
```

## Como fazer a primeira chamada real

1. **Provisionar EC2** — t3.small, Ubuntu 22.04, IP elástico
2. **Executar scripts** — `install-asterisk.sh`, `apply-configs.sh`, `setup-tls.sh`, `setup-firewall.sh`, `setup-monitoring.sh`
3. **Contratar operadora SIP** — Obter credenciais do trunk + número DID
4. **Preencher variáveis** — Copiar `env-voice-example.txt` para `.env.voice`, preencher credenciais
5. **Re-rodar apply-configs.sh** — Gera configs do Asterisk com as credenciais reais
6. **Testar trunk** — `asterisk -rx "pjsip show registrations"` deve mostrar "Registered"
7. **Habilitar para RYCS** — No admin, voice_habilitada já está ativa para a empresa RYCS
8. **Configurar limites** — POST `/voice/admin/limits` com maxCanais, maxChamadas, etc.
9. **Testar chamada** — Profissional abre discadora, seleciona lead, clica ligar

## Estimativa de custos — Piloto

| Cenário | SDRs | Chamadas/dia | Custo mensal |
|---------|------|-------------|-------------|
| Mínimo | 2 | 240 | ~R$972 |
| Completo | 22 | 2.640 | ~R$8.353 |

Inclui EC2, operadora, números DID, armazenamento de gravações (quando habilitadas).

## Arquitetura operadora-agnóstica

```
Navegador (WebRTC/SIP.js)
    ↓ WSS
Asterisk 20 (PJSIP + ARI)
    ↓ SIP Trunk
Operadora (Nvoip/Zenvia/Twilio/outra)
    ↓ PSTN
Destino
```

Trocar a operadora = alterar credenciais do trunk no `.env.voice` e re-rodar `apply-configs.sh`. Nenhum código da aplicação precisa mudar.
