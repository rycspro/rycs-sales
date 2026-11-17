# Teste prático de segurança — RYCS (`security/integracao-final`)

Validação prática com **backend real em ambiente local isolado**, banco descartável e
**requisições HTTP reais** de atacante (não só leitura de código). Dois roteiros de
ataque ao vivo (porta 42777, banco temporário, credenciais fictícias) + regressões
automatizadas. **Sem push/merge/deploy.**

- Usuários fictícios: admin, Empresa A, Empresa B, Profissional A (vinculado a A),
  Profissional B (vinculado a B), Profissional sem vínculo. Campanhas, candidaturas,
  depósitos, saldos e saques semeados.
- Base: `security/integracao-final` (18 commits consolidados preservados). `origin/main`
  avançou para `31631ad` (fix de boot, não-segurança) durante o trabalho — divergência a
  reconciliar na revisão; não afeta os testes (o backend sobe e passa).

## Tabela de vulnerabilidades

| # | Vulnerabilidade | Como foi reproduzida (HTTP real) | Correção | Arquivo | Teste | Antes → Depois | Commit |
|---|---|---|---|---|---|---|---|
| 1 | Estorno de saque pago **sem registro no gateway** (`asaasId` nulo) devolvia o saldo — pagaria em dobro se o Pix tivesse saído | `POST /admin/withdrawals/:id/estornar` (admin) sobre saque `status='pago'` sem `asaasId` | Trava `409` quando `pago` e sem `asaasId` (defesa em profundidade; o caminho com `asaasId` já consultava o banco) | `server/routes/payments.js` | `test/seguranca-estorno.test.js` | **200 + saldo devolvido → 409, saldo intacto** | `bb6ea03` |

> Observação honesta: nenhum fluxo da API atual chega a `pago` sem `asaasId` (todo
> caminho que marca pago grava `asaasId`, real ou `BETA-SIMULADO`). O estado foi forçado
> no banco para o teste; a correção é defesa em profundidade contra estados
> manuais/futuros. É admin-only (não é escalonamento de tenant).

Demais achados do rescan anterior (POST /submissions cross-tenant **[ALTA]** e IDOR em
GET /deposits/:id) já tinham sido corrigidos no commit `1b5aed9` e foram **confirmados na
prática** aqui (ver cenários M2/M3 e DEP abaixo).

## Cenários de dinheiro (§3) — 16/16 bloqueados na prática

| Cenário | Resultado | Evidência |
|---|---|---|
| Empresa A mexe em saldo/empresa de B | SEGURO | `PATCH /companies/B` → 403; saldo B intacto |
| Empresa seta o próprio saldo pelo corpo | SEGURO | campo fora do allowlist → ignorado |
| Profissional cria submissão como terceiro | SEGURO | `sellerId` alheio → 403 |
| Profissional sem vínculo recebe comissão | SEGURO | `POST /submissions` companyId sem parceria → 403; reservado intacto |
| Alterar valor da comissão pelo corpo | SEGURO | `valor` ignorado; usa a tabela da empresa (10, não 99999) |
| Aprovação duplicada da mesma tarefa | SEGURO | 2ª liberação → 409; `platform_earnings`=1 |
| Saque duplicado (sequencial) | SEGURO | 2º → 400 saldo insuficiente |
| Dois saques simultâneos no mesmo saldo | SEGURO | só 1×200, 1 saque, saldo ≥ 0 |
| Depósito duplicado por webhook | SEGURO | credita 1×; `financial_ledger` idempotente (UNIQUE tipo+key) |
| Webhook falso (token inválido) | SEGURO | 401; saldo intacto |
| Estorno após pago (com gateway) | SEGURO | consulta o banco; gateway off → 503, sem devolver |
| Estorno após pago (sem asaasId) | SEGURO (corrigido) | 409 (correção #1) |
| Cancelar/contestar tarefa já liberada | SEGURO | contestar liberada → 400 |
| Alteração de Pix por empresa / outro prof | SEGURO | `PATCH /sellers/:id` → 403 |
| Sessão revogada | SEGURO | `logout-all` → `/auth/me` 401 |

## Permissões (§4) — sweep HTTP, 0 vulnerabilidade real

Testados GET/POST/PATCH/DELETE com troca de papel, manipulação de ID e campos protegidos
no corpo, nas famílias: campanhas, empresas, profissionais, contatos, leads, candidaturas,
submissões, pagamentos/saques, academy, uploads, integrações, config, admin,
notificações. **Todos bloqueados** (403/404) ou corretamente escopados.

Um 200 foi investigado e **não** é vulnerabilidade: `GET /academy/trilhas` devolve o
catálogo de treinamento estático (`trilhaPublica`), **sem gabarito e sem dado de tenant** —
conteúdo público por desenho. Falso-positivo.

## Frontend (§5)

- Build: **verde**. Fio da reautenticação verificado em código: `ModalConfirmarSenha.jsx`
  envia `senha` (nunca armazenada) e `Carteira.jsx` trata `reauth:true` reabrindo o modal e
  reenviando o saque.
- Enforcement do backend com `REAUTH_FINANCEIRO=1` validado por HTTP real em
  `test/reautenticacao-financeira.test.js`: saque/Pix sem senha → 401, senha errada → 401,
  senha certa → 200, tentativas limitadas + auditoria.
- **Limitação registrada:** não foi executado E2E de navegador (clique real login→saque com
  dev server + backend). O enforcement (camada de segurança) está coberto no backend.

## Asaas e S3 (§6)

- **Asaas (mocks fiéis ao contrato):** `test/webhook-asaas-v4.test.js` e
  `test/webhook-asaas-confirmacao.test.js` cobrem confirmação real (fail-closed),
  idempotência, falha da API (4xx definitivo vs 5xx retriável), reentrega e vínculo com a
  empresa. Reconfirmado ao vivo (M8/M9). **Limitação:** sem ambiente de homologação Asaas
  com credenciais de teste — não validado contra a API real.
- **S3 (mocks / fallback local):** `test/uploads-seguranca.test.js` (sanitização de nome
  anti path-traversal, autorização de download por dono) e `test/uploads-migracao.test.js`
  (derivação de s3key, backfill admin-only idempotente, compat legada). **Limitação:** sem
  bucket S3 real — URLs assinadas e expiração não validadas contra o provedor.

## Segunda rodada (§7)

- Suíte completa: **262/262** (antes das mudanças: 261; +1 teste de estorno).
- Build do frontend: **verde**.
- Concorrência financeira (`concorrencia-financeira`, `deposito-idempotente`) e
  cross-tenant (`seguranca-autorizacao`, `seguranca-contatos`, `seguranca-sessao`,
  `seguranca-vendedor`): **verdes**.
- Nenhuma funcionalidade legítima quebrada; nenhum teste removido ou enfraquecido.

## Totais

- **Vulnerabilidades novas encontradas:** 1 (estorno sem `asaasId`; latente/defesa em
  profundidade).
- **Vulnerabilidades corrigidas:** 1 (commit `bb6ea03`). As 2 do rescan anterior (submissions
  ALTA, deposits IDOR) confirmadas fechadas na prática.
- **Testes:** 262 aprovados, 0 reprovados.
- **Funcionalidades ainda com risco (baixo/registrado):** contacts PATCH/distribuir não
  valida `sellerId` contra o time; PII de `foto`/`curriculo` ampla por desenho de
  marketplace; rota `/leads/comissoes` sombreada (bug funcional, não-segurança).
- **Pendências de integração externa / infra / decisão comercial:** homologação Asaas real;
  bucket S3 real (URLs assinadas/expiração); E2E de navegador; decisão de ligar
  `REAUTH_FINANCEIRO` em produção; preços/comissões não alterados (fora de escopo).

## Pronta para staging?

**Sim, para a camada de segurança de backend** — isolamento multi-tenant, fluxos
financeiros, webhooks assinados, revogação de sessão e reautenticação estão corrigidos e
cobertos por testes reproduzíveis (262 verdes) e por ataque HTTP ao vivo. **Antes de
produção**, faltam: validação em staging com Asaas/S3 reais, E2E de navegador, revisão
humana do PR e decisão sobre a flag de reautenticação. Não se declara segurança total sem
essas evidências.
