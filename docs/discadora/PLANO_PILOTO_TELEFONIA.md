# RYCS Voice — Plano Técnico para Telefonia Real

## Piloto: 22 SDRs / 2.640 chamadas por dia

### 1. Dimensionamento

| Parâmetro | Valor |
|-----------|-------|
| SDRs ativos | 22 |
| Chamadas/dia | 2.640 (120 por SDR) |
| Chamadas simultâneas (pico) | ~22 (1 por SDR) |
| Duração média estimada | 2 min |
| Minutos/dia | ~5.280 min |
| Minutos/mês (22 dias úteis) | ~116.160 min |

### 2. Infraestrutura AWS necessária

#### Servidor Asterisk (EC2)
| Item | Especificação |
|------|---------------|
| Instância | t3.medium (2 vCPU, 4 GB RAM) |
| SO | Ubuntu 22.04 LTS |
| Disco | 50 GB gp3 SSD |
| Elastic IP | 1 IP fixo |
| Custo estimado | ~US$ 33/mês |

**Justificativa**: 22 chamadas simultâneas são leves para Asterisk. t3.medium suporta até ~100 canais simultâneos com codec G.711. Para escalar acima de 50 SDRs, considerar t3.large.

#### Security Group (portas)
| Porta | Protocolo | Origem | Uso |
|-------|-----------|--------|-----|
| 5060 | UDP | IP operadora SIP | Sinalização SIP |
| 8089 | TCP (WSS) | 0.0.0.0/0 | WebSocket WebRTC |
| 10000-20000 | UDP | 0.0.0.0/0 | RTP/SRTP (áudio) |
| 8088 | TCP | IP backend RYCS (3.132.225.173) | ARI HTTP |
| 22 | TCP | IP admin | SSH |

#### DNS
| Registro | Tipo | Valor |
|----------|------|-------|
| voice.rycs.pro | A | Elastic IP do Asterisk |

#### Certificado TLS
- Let's Encrypt (gratuito) para voice.rycs.pro
- Renovação automática via certbot + cron

### 3. Stack de software

```
Asterisk 20 LTS
├── PJSIP (sinalização SIP + WebRTC)
├── ARI (REST API + WebSocket para o backend)
├── Codec Opus (WebRTC) + G.711 (PSTN)
└── TLS/SRTP (criptografia)

Backend RYCS (Node.js — já existente)
├── sipProvider.js (implementar — conecta ao ARI)
├── voice.js (rotas REST — já implementadas)
├── queueEngine.js (motor de filas — já implementado)
└── WebSocket events (ARI → voice_calls, voice_call_events)

Frontend RYCS (React — já existente)
├── DiscadoraProfissional.jsx (modo navegador — habilitar)
├── DiscadoraEmpresa.jsx (gestão — já implementado)
└── useVoice.js (hook — já implementado)
```

### 4. Operadora SIP (Brasil)

#### Recomendações

| Operadora | Custo fixo/min | Custo celular/min | API | Observações |
|-----------|----------------|-------------------|-----|-------------|
| **Nvoip** | ~R$ 0,06 | ~R$ 0,15 | REST + SIP | Melhor custo-benefício, API robusta |
| Zenvia (TotalVoice) | ~R$ 0,08 | ~R$ 0,18 | REST + SIP | Suporte enterprise |
| Twilio | ~US$ 0,013 | ~US$ 0,04 | REST + SIP | Global, mais caro |

#### Custo estimado (Nvoip, 100% celular)
- 116.160 min/mês × R$ 0,15 = **~R$ 17.424/mês**
- Com mix 50% fixo / 50% celular: **~R$ 12.194/mês**

#### Contratação necessária
- Conta ativa na operadora
- Trunk SIP com autenticação IP ou usuário/senha
- DID com DDD (número de saída visível para o lead)
- Credenciais: host, usuário, senha, CallerID, IP de sinalização

### 5. Implementação do sipProvider.js

O `sipProvider.js` já existe como stub. Implementação real requer:

```
1. Conexão ARI (HTTP + WebSocket)
   - POST /ari/channels → originar chamada
   - POST /ari/bridges → criar bridge
   - POST /ari/bridges/{id}/addChannel → conectar canais
   - WS /ari/events → receber eventos em tempo real

2. Fluxo de uma ligação:
   a) SDR clica "Ligar" → backend recebe POST /api/voice/calls/iniciar
   b) sipProvider.originarChamada() → POST /ari/channels (endpoint PJSIP)
   c) Asterisk: WebRTC ↔ SDR, SIP ↔ Lead
   d) Eventos ARI → atualiza voice_calls (status, duração)
   e) SDR registra resultado → voice_call_dispositions

3. WebRTC no navegador:
   - SIP.js ou JsSIP (biblioteca WebRTC-SIP)
   - Conexão WSS ao Asterisk (porta 8089)
   - Codec Opus (qualidade + baixa latência)
```

### 6. Passos de implementação (ordem)

#### Fase 1 — Infraestrutura (~1 dia)
1. Provisionar EC2 t3.medium na mesma região (us-east-2)
2. Instalar Asterisk 20 LTS com PJSIP, ARI, Opus
3. Configurar Security Group
4. Atribuir Elastic IP
5. Configurar DNS voice.rycs.pro
6. Instalar certificado TLS (Let's Encrypt)

#### Fase 2 — Configuração Asterisk (~1 dia)
1. Configurar pjsip.conf (transporte WSS + UDP)
2. Configurar ari.conf (usuário rycs-voice)
3. Configurar extensions.conf (dialplan)
4. Testar conectividade: `asterisk -rx "pjsip show registrations"`

#### Fase 3 — Operadora SIP (~2-3 dias úteis)
1. Contratar Nvoip (ou equivalente)
2. Configurar trunk SIP no Asterisk
3. Testar ligação manual: `asterisk -rx "channel originate ..."`
4. Validar CallerID e qualidade de áudio

#### Fase 4 — Backend sipProvider (~2 dias)
1. Implementar conexão ARI (HTTP + WebSocket)
2. Implementar originarChamada(), desligar(), transferir()
3. Implementar listener de eventos ARI
4. Atualizar voice_calls com dados reais
5. Testes de integração com Asterisk

#### Fase 5 — Frontend WebRTC (~2 dias)
1. Adicionar SIP.js ao frontend
2. Implementar "Modo Navegador" no DiscadoraProfissional
3. Registro automático WebRTC no Asterisk
4. Controles: atender, desligar, mute, hold
5. Indicadores de qualidade (jitter, latência)

#### Fase 6 — Piloto (~3-5 dias)
1. Habilitar voice para a empresa RYCS interna
2. Criar fila com 2-3 SDRs de teste
3. Importar leads de teste (números internos)
4. Validar fluxo completo: ligar → conversar → registrar resultado
5. Medir: latência de setup, qualidade de áudio, eventos registrados
6. Escalar para 22 SDRs gradualmente

### 7. Custos totais estimados (mensal)

| Item | Custo |
|------|-------|
| EC2 t3.medium | ~US$ 33 (~R$ 180) |
| Elastic IP | Incluído (associado) |
| Minutos telefonia (Nvoip, mix) | ~R$ 12.194 |
| DNS + TLS | Gratuito |
| **Total estimado** | **~R$ 12.374/mês** |

### 8. Conformidade regulatória

| Requisito | Status | Ação |
|-----------|--------|------|
| MP 1.396/2026 (telemarketing) | Pendente | Implementar cotas por plano, respeitar opt-out |
| LGPD (gravação) | Pendente | Consentimento prévio, criptografia, retenção 90 dias |
| DNC (Do Not Call) | Implementado | Lista DNC no sistema, check automático antes de ligar |
| Horário de ligação | A implementar | Bloquear fora de 8h-20h (seg-sáb), conforme regulação |
| CallerID | Obrigatório | Número real com DDD, sem mascaramento |

### 9. Métricas do piloto

| Métrica | Meta |
|---------|------|
| Taxa de setup < 3s | > 95% |
| Qualidade de áudio (MOS) | > 3.5 |
| Taxa de chamadas completadas | > 85% |
| Uptime Asterisk | > 99.5% |
| Latência ARI events | < 500ms |

### 10. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Instabilidade de áudio | Média | Alto | Codec Opus, jitter buffer, monitoramento MOS |
| Sobrecarga do Asterisk | Baixa | Alto | Monitoramento CPU/RAM, escalar para t3.large |
| Operadora fora do ar | Baixa | Alto | Trunk secundário, fallback para modo celular |
| Bloqueio de número | Média | Médio | Rotação de DIDs, compliance com DNC/opt-out |
| Latência de rede | Baixa | Médio | Asterisk na mesma região AWS, QoS |

### 11. Rollback

1. **Feature flag**: `voice_habilitada = 0` desabilita a discadora por empresa
2. **Provider fallback**: se SIP falhar, o modo celular (tel:) continua funcional
3. **Asterisk**: `systemctl stop asterisk` para toda telefonia
4. **DNS**: remover `voice.rycs.pro` para cortar acesso WebRTC
5. **Backend**: sipProvider.canInitiate() = false sem deploy

---

**Documento gerado em 2026-11-26. Nenhum recurso foi provisionado ou contratado.**
