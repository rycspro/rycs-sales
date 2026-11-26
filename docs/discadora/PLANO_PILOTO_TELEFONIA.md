# RYCS Voice — Plano Técnico para Telefonia Real

## Piloto: 22 SDRs / 2.640 chamadas por dia

### 1. Dimensionamento

| Parâmetro | Valor |
|-----------|-------|
| SDRs ativos | 22 |
| Chamadas/dia | 2.640 (120 por SDR) |
| Chamadas simultâneas (pico) | ~22 (1 por SDR) |
| Duração média (atendidas) | ~2 min |
| Taxa de atendimento estimada | ~35% (924 atendidas/dia) |
| Minutos atendidos/dia | ~1.848 min |
| Minutos tarifáveis/dia (inclui não atendidas¹) | ~3.108 min |
| Minutos tarifáveis/mês (22 dias úteis) | ~68.376 min |

¹ Operadoras tarifam a partir do atendimento pela rede (ring), tipicamente 6s mínimos para não atendidas que geram sinalização.

### 2. Custo operacional detalhado

#### 2.1 Infraestrutura AWS

| Item | Especificação | Custo mensal |
|------|---------------|--------------|
| EC2 t3.medium (Asterisk) | 2 vCPU, 4 GB RAM, us-east-2 | US$ 33,41 (~R$ 183) |
| EBS gp3 50 GB | disco do Asterisk | US$ 4,00 (~R$ 22) |
| Elastic IP | IP fixo associado à instância | US$ 0,00 (associado) |
| Transferência de dados | ~50 GB/mês (áudio RTP) | US$ 4,50 (~R$ 25)² |
| **Subtotal AWS** | | **~R$ 230/mês** |

² Primeiros 100 GB/mês de saída custam US$ 0,09/GB. Áudio G.711 = ~87 kbps × 2 canais × 68.376 min ≈ 45 GB/mês.

#### 2.2 Telefonia — tarifas por operadora (referência)

As tarifas abaixo são médias de mercado em nov/2026. A arquitetura permite substituir a operadora SIP sem reconstruir a discadora.

| Componente | Operadora A (Nvoip) | Operadora B (Zenvia) | Operadora C (Twilio) |
|------------|---------------------|----------------------|----------------------|
| Fixo local/min | R$ 0,059 | R$ 0,075 | US$ 0,013 (~R$ 0,071) |
| Celular/min | R$ 0,149 | R$ 0,179 | US$ 0,040 (~R$ 0,220) |
| Tarifação mínima | 6s (0,1 min) | 6s (0,1 min) | 1s (0,017 min) |
| Arredondamento | 6/6s | 6/6s | 1/1s |
| DID (número) | R$ 5/mês por DDD | R$ 10/mês por DDD | US$ 1/mês |
| Canal simultâneo | Sem limite fixo | Sem limite fixo | Sem limite fixo³ |
| Setup fee (conexão) | R$ 0,00 | R$ 0,00 | US$ 0,00 |

³ Trunks SIP geralmente não cobram por canal; a limitação é do contrato (CPS — calls per second).

#### 2.3 Chamadas não atendidas

| Cenário | Comportamento |
|---------|--------------|
| Não atendida (timeout 30s) | Operadora tarifa se houve ring. Mínimo ~6s = 0,1 min |
| Ocupado / caixa postal | Tarifa mínima se a rede sinalizou |
| Número inválido / inexistente | Sem tarifação (rejeição imediata) |
| Sem resposta (nenhum ring) | Sem tarifação |

Estimativa conservadora: 65% das 2.640 chamadas/dia não atendem = 1.716 × 0,1 min × R$ 0,149 = **~R$ 25,56/dia**.

#### 2.4 Cenários de custo mensal (22 dias úteis)

| Cenário | Fixo | Celular | Mix (40/60) |
|---------|------|---------|-------------|
| **Minutos tarifáveis/mês** | 68.376 | 68.376 | 68.376 |
| **Tarifa/min** | R$ 0,059 | R$ 0,149 | R$ 0,113⁴ |
| **Custo minutos** | R$ 4.034 | R$ 10.188 | R$ 7.726 |
| **Não atendidas (mínimo)** | R$ 112 | R$ 562 | R$ 382 |
| **DIDs (3 DDDs)** | R$ 15 | R$ 15 | R$ 15 |
| **Subtotal operadora** | **R$ 4.161** | **R$ 10.765** | **R$ 8.123** |

⁴ Mix assume 40% fixo + 60% celular, típico de B2B outbound.

#### 2.5 Impostos

| Imposto | Alíquota | Sobre |
|---------|----------|-------|
| ICMS | 25-30% (varia por estado) | Serviço de telecomunicações |
| PIS/COFINS | 9,25% | Faturamento operadora |
| ISS | 2-5% | Pode incidir sobre SaaS |

Muitas operadoras SIP já incluem ICMS na tarifa publicada. Verificar na contratação. Se fora: multiplicar custo de minutos por ~1,30.

#### 2.6 Gravações (futuro — desabilitadas inicialmente)

| Item | Especificação | Custo mensal |
|------|---------------|--------------|
| S3 Standard | ~40 GB/mês (G.711 mono, ~1 MB/min × 1.848 min atendidos/dia × 22 dias) | US$ 0,92 (~R$ 5) |
| S3 Lifecycle (90 dias) | Expiração automática | — |
| Transferência S3 → usuário | Download sob demanda, ~5 GB/mês | US$ 0,45 (~R$ 2,50) |
| **Subtotal gravações** | | **~R$ 7,50/mês** |

#### 2.7 Resumo consolidado (cenário mix 40/60, Operadora A)

| Componente | Custo mensal |
|------------|--------------|
| AWS (EC2 + EBS + Elastic IP + rede) | R$ 230 |
| Minutos (68.376 min, mix 40/60) | R$ 7.726 |
| Não atendidas (mínimo tarifado) | R$ 382 |
| DIDs (3 DDDs) | R$ 15 |
| Gravações (desabilitadas) | R$ 0 |
| **Total piloto (22 SDRs)** | **~R$ 8.353/mês** |
| **Custo por SDR** | **~R$ 380/mês** |
| **Custo por chamada atendida** | **~R$ 0,41** |

#### 2.8 Piloto inicial (2 SDRs)

| Componente | Custo mensal |
|------------|--------------|
| AWS (mesma instância, já provisionada para 22) | R$ 230 |
| Minutos (~6.216 min, mix) | R$ 702 |
| Não atendidas | R$ 35 |
| DIDs (1 DDD) | R$ 5 |
| **Total piloto inicial** | **~R$ 972/mês** |

### 3. Arquitetura agnóstica de operadora

A discadora NÃO depende de uma operadora específica. O backend se comunica com o Asterisk via ARI (protocolo padrão). O Asterisk fala SIP com qualquer operadora. Para trocar:

1. Atualizar credenciais no `pjsip.conf` (ou via variáveis de ambiente)
2. Reiniciar registro SIP: `asterisk -rx "pjsip send register operadora"`
3. Zero alterações no backend ou frontend

Múltiplas operadoras podem coexistir (trunk primário + fallback).

### 4. Stack de software

```
Asterisk 20 LTS
├── PJSIP (sinalização SIP + WebRTC)
├── ARI (REST API + WebSocket para o backend)
├── Codec Opus (WebRTC) + G.711 (PSTN)
└── TLS/SRTP (criptografia)

Backend RYCS (Node.js — já existente)
├── sipProvider.js (ARI client — implementado nesta fase)
├── voice.js (rotas REST — já implementadas)
├── queueEngine.js (motor de filas — já implementado)
└── WebSocket events (ARI → voice_calls, voice_call_events)

Frontend RYCS (React — já existente)
├── DiscadoraProfissional.jsx (modo navegador — a habilitar)
├── DiscadoraEmpresa.jsx (gestão — já implementado)
└── useVoice.js (hook — já implementado)
```

### 5. Passos para primeira ligação real

1. Provisionar EC2 com scripts de `infra/voice/`
2. Executar `infra/voice/install-asterisk.sh`
3. Configurar DNS `voice.rycs.pro` → Elastic IP
4. Executar `infra/voice/setup-tls.sh`
5. Contratar operadora SIP
6. Preencher credenciais em `infra/voice/.env.voice`
7. Aplicar configs: `infra/voice/apply-configs.sh`
8. Testar trunk: `asterisk -rx "pjsip show registrations"`
9. Adicionar variáveis ARI nos GitHub Secrets
10. Habilitar voice para empresa de teste
11. Ligar para número de teste

### 6. Conformidade regulatória

| Requisito | Status | Ação |
|-----------|--------|------|
| MP 1.396/2026 (telemarketing) | Pendente | Implementar cotas por plano, opt-out |
| LGPD (gravação) | Pendente | Consentimento prévio, retenção 90 dias |
| DNC (Do Not Call) | Implementado | Check automático antes de ligar |
| Horário de ligação | Implementado | 08:00-20:00 (seg-sex) no company_settings |
| CallerID | Obrigatório | Número real com DDD, sem mascaramento |

### 7. Métricas do piloto

| Métrica | Meta |
|---------|------|
| Latência de setup (ring) | < 3s |
| MOS (qualidade de áudio) | > 3.5 |
| Taxa de chamadas completadas | > 85% |
| Uptime Asterisk | > 99.5% |
| Latência ARI events → DB | < 500ms |
| Downtime durante atualização | < 30s |

---

**Atualizado em 2026-11-26. Nenhum recurso foi provisionado ou contratado.**
