# RYCS Voice — Relatório Final da Primeira Entrega

## 1. Status do versionamento

| Item | Status |
|------|--------|
| Commit original | `6571370` em `feature/rycs-voice` |
| Merge na main | Concluído (commit `2a1795f`) |
| Deploy | Ativo em produção (`app.rycs.pro`) via GitHub Actions #534 |
| CI/CD | Estável — runs #533 e #534 passando (Node 22) |
| Feature flag | `voice_habilitada` = 0 por padrão (discadora invisível) |

## 2. Resultado dos testes

**586 testes na suíte completa — todos passando com Node 22**
**34 testes de Voice E2E incluídos — todos passando**

Cobertura:
- Bloqueio sem feature flag
- Habilitação/desabilitação pelo admin
- CRUD de filas, membros, scripts, DNC
- Reserva atômica de leads (concurrent reservation)
- Ligação via mobile provider com resultado
- Próximo lead após conclusão
- Agendamento de reunião cria evento no calendário
- Prevenção de duplicidade (cooldown 30s)
- Histórico de ligações persistido
- Dados simulados isolados (origemDados: "simulado")
- Proteção financeira (uso marcado como simulado)
- Isolamento entre empresas (empresa B vê 0 filas, 0 histórico)
- Vendedor não autorizado recebe 403

## 3. Funcionalidades disponíveis

### Para o Admin
- Toggle visual em "Empresas" para habilitar/desabilitar discadora por empresa
- Logs de auditoria completos

### Para a Empresa (quando habilitada)
- 7 abas: Visão Geral, Operação, Filas, Histórico, Desempenho, Consumo, Configurações
- Gestão de filas com membros e importação de leads
- Scripts comerciais (CRUD)
- Lista DNC (Do Not Call)
- Callbacks pendentes
- Indicadores e desempenho por profissional
- Dados de consumo

### Para o Profissional (quando empresa habilitada)
- Sessão de discagem com controles (iniciar/pausar/retomar/encerrar)
- 11 tipos de resultado com agendamento de reunião/retorno
- Renovação automática de reserva (5 min)
- DNC check automático antes de ligar

## 4. Como testar

### Habilitar discadora para uma empresa
1. Acesse o painel admin (`/admin`)
2. Abra os detalhes de uma empresa
3. Clique em **"Habilitar discadora"** na seção RYCS Voice
4. A empresa verá a aba "Discadora" no menu

### Testar fluxo completo
1. Empresa: criar fila → adicionar membros → importar leads
2. Profissional: acessar aba Discadora → iniciar sessão → pedir próximo lead
3. Ligar (abre app de telefone via `tel:`) → registrar resultado
4. Se "reunião agendada": preencher data/hora → evento criado no calendário

### Rodar testes automatizados
```bash
node --test test/voice.test.js 2>&1 | head -50
```

## 5. Recursos AWS necessários (futuro — SIP)

| Recurso | Especificação | Custo estimado |
|---------|---------------|----------------|
| EC2 (Asterisk) | t3.medium, Ubuntu 22.04, 50GB SSD | ~US$ 30/mês |
| Elastic IP | Atribuído à instância Asterisk | ~US$ 3,65/mês (se não associado) |
| S3 (gravações futuras) | Bucket privado, criptografado | ~US$ 2/GB |
| Certificado TLS | Let's Encrypt (gratuito) | Gratuito |

**Nenhum recurso foi provisionado.** Documentação preparatória em `docs/discadora/INFRA_SIP.md`.

## 6. Configuração DNS necessária

| Registro | Tipo | Valor | Quando |
|----------|------|-------|--------|
| voice.rycs.pro | A | Elastic IP do Asterisk | Quando o servidor Asterisk estiver provisionado |

## 7. Requisitos de segurança

- [x] Feature flag `voice_habilitada` = 0 por padrão (discadora invisível)
- [x] Mock provider bloqueado em produção para não-admin
- [x] `origemDados` rastreia fonte (declarado/verificado/simulado)
- [x] Dados simulados não geram comissão nem indicadores reais
- [x] Isolamento completo entre empresas
- [x] Auditoria em todas as operações sensíveis
- [x] Foreign keys ativas em todos os testes
- [x] Nenhuma credencial SIP exposta no código

## 8. Credenciais SIP necessárias

Para ativar ligações reais via navegador (WebRTC → SIP → PSTN):

| Item | Descrição |
|------|-----------|
| Host SIP | Endereço do servidor da operadora |
| Usuário SIP | Login de autenticação do trunk |
| Senha SIP | Senha de autenticação |
| DID / CallerID | Número(s) de origem com DDD |
| IP de sinalização | IP(s) da operadora para whitelist |

Operadoras sugeridas: **Nvoip**, **TotalVoice/Zenvia**, **Twilio**

## 9. Procedimento para a primeira ligação real

1. Provisionar EC2 com Asterisk 20 LTS configurado
2. Certificado TLS válido para `voice.rycs.pro`
3. DNS `voice.rycs.pro` → Elastic IP
4. Conta ativa na operadora SIP com trunk configurado
5. Credenciais ARI e SIP preenchidas no backend (via GitHub Secrets)
6. Implementar `sipProvider.js` usando as chamadas ARI documentadas
7. Habilitar botão "Modo Navegador" no DiscadoraProfissional
8. Testar: habilitar voice para empresa de teste → criar fila → adicionar lead → ligar
9. Validar: eventos ARI, voice_calls atualizado, duração correta

## 10. Dependências de contratação externa

| Item | Prioridade | Descrição |
|------|------------|-----------|
| Operadora SIP | Alta | Necessária para ligações reais (Nvoip, Zenvia ou Twilio) |
| EC2 Asterisk | Alta | Servidor dedicado para Asterisk (~US$ 30/mês) |
| Elastic IP | Alta | IP fixo para DNS e SIP trunk |
| Validação jurídica (gravação) | Média | LGPD/consentimento antes de habilitar gravação |
| Homologação regulatória | Baixa | MP 1.396/2026, cotas de ligação por plano |

---

**Atualizado em 2026-11-26. RYCS Voice em produção na `main`, deploy automático via GitHub Actions.**
**Plano de piloto para telefonia real: `docs/discadora/PLANO_PILOTO_TELEFONIA.md`**
