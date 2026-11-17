# RYCS — Preparação e validação de staging

Branch `security/integracao-final`, atualizada com `origin/main` (até `a1dbfb3`), 20 commits
de segurança preservados. **Sem push/merge/deploy.** Tudo validado localmente, isolado,
com banco descartável e segredos fictícios.

- Suíte após a integração: **283/283 verdes** · Build do frontend: **verde**.
- Config isolada de staging: [`.env.staging.example`](../../.env.staging.example).

---

## 1. Integração com a main (tarefas 1-2) — feito

- `origin/main` avançou de `301e42f` → `a1dbfb3` (13 commits: Big Five/DISC, sidebar,
  menu, cadastro, boot fix, webhook credita 1×, ESLint gate). Mesclada na branch.
- Conflitos resolvidos **pela lógica**, não automaticamente:
  - `server/routes/payments.js` (webhook de depósito): combinados o **V4**
    (`motivoRecusaDeposito`, validação de vínculo) **e** a idempotência explícita da main
    (`jaCreditado` via `financial_ledger`). Os dois são complementares e ambos ficaram.
  - `test/deposito-idempotente.test.js` (add/add): preservados os três casos — resolução
    por `externalReference` (meu), por `asaasCustomerId` (main) e reentrega exata
    (`duplicado:true`).
  - `server/index.js` auto-merge: health-com-banco (main) + CSP report-only (segurança)
    coexistem.
- Suíte 283/283 e build verdes após a integração.

## 2. Config isolada de staging (tarefa 3) — feito

`.env.staging.example` define: `NODE_ENV=staging`, banco separado (`DB_PATH=/data-staging`),
segredos **exclusivos** (JWT/AUDIT/ADMIN), `REAUTH_FINANCEIRO=1`, Asaas **sandbox**
(`ASAAS_ENV=sandbox` + token de webhook próprio), bucket S3 **privado** de staging, CORS do
domínio de staging, integrações externas vazias (ignoradas com segurança). Sem dados
financeiros reais; `DEV_SEM_LOGIN` vazio.

Para E2E de navegador local, a API e o front precisam da **mesma origem** (o cookie é
`sameSite=lax`): usar o proxy do Vite (`/api` → backend) e abrir o app por `localhost`.

## 3. Migrações aditivas (tarefa 8) — VALIDADO localmente

Banco criado com o schema atual, semeado com dados fictícios, depois **degradado** para
simular um prod legado (removidas as colunas/tabelas de segurança); ao subir o código atual,
as migrações aditivas (`adicionarColuna` / `CREATE TABLE IF NOT EXISTS`) **re-aplicaram tudo
sem perder dados**:

```
DEGRADADO: tokenVersion=false, pixAlteradoEm=false, security_audit=ausente, gateway_events=ausente
APÓS BOOT: tokenVersion/pixAlteradoEm/s3key/security_audit/gateway_events re-adicionados
           empresa saldo=500 preservado · user tokenVersion=0 (default) · seller disponivel=250 preservado
RESULTADO: OK — migrações aditivas re-aplicadas, dados preservados
```

Aditivas e idempotentes; seguras para rodar no boot de staging/produção.

## 4. E2E de navegador + REAUTH_FINANCEIRO=1 (tarefas 6, 7, 9) — VALIDADO localmente

Backend real (`NODE_ENV=staging`, `REAUTH_FINANCEIRO=1`, banco descartável) + Vite dev
(proxy same-origin). Navegador dirigido com dados fictícios:

| Fluxo | Evidência |
|---|---|
| Entrada (idioma → perfil → login) | renderiza; fluxo navegável |
| Login **empresa** | 200, dashboard carrega (Início/Campanhas/Leads/Pagamentos) |
| **Campanhas** | "CAMPANHAS ATIVAS: 1"; "Campanha E2E / Publicada" listada |
| Login **profissional** | 200, shell do vendedor (Carteira/Oportunidades/Meu Perfil) |
| **Saldo** (Carteira) | "DISPONÍVEL R$ 500,00" (= seed) |
| **Saque com reauth (senha errada)** | modal "Confirme sua senha" → "Senha incorreta."; saldo intacto |
| **Saque com reauth (senha correta)** | debita; **DISPONÍVEL R$ 450,00**; saque "Processando" |
| Integridade no banco | `disponivel=450`, 1 withdrawal `solicitado` R$50, ledger `saque_reservado -50`, `sacado=0` |

A reautenticação financeira (modal `ModalConfirmarSenha` + `reauth:true`) funciona
ponta-a-ponta com a flag ligada. A app inicia corretamente, o usuário executa suas
atividades legítimas e os controles de segurança continuam funcionando.

- **Troca de Pix com reauth:** não há campo de Pix fora do fluxo de saque na UI; o
  enforcement de `PATCH /sellers/:id {pix}` (sem senha → 401, com senha → 200 + auditoria +
  carimbo) está coberto por `test/reautenticacao-financeira.test.js`.

## 5. Asaas — homologação (tarefa 4): preparado; execução real BLOQUEADA por credenciais

Config: `ASAAS_ENV=sandbox`, `ASAAS_API_KEY=<sandbox>`, `ASAAS_WEBHOOK_TOKEN=<exclusivo>`.

Validado com **mocks fiéis ao contrato** (verde) e por ataque HTTP ao vivo:

| Item | Onde | Status local |
|---|---|---|
| Autenticação do webhook (header `asaas-access-token`, timingSafeEqual, fail-closed) | `webhook-asaas-v4`, ataque M9 | ✅ |
| Confirmação do pagamento pela API (`GET /payments/:id`, fail-closed) | `webhook-asaas-confirmacao`, `pix-automatico` | ✅ |
| Idempotência (mesma cobrança, eventos distintos + reentrega) | `deposito-idempotente`, ataque M8 | ✅ |
| Tratamento de falha (4xx definitivo = recusa; 0/5xx = retriável 503) | `webhook-asaas-v4` | ✅ |
| Vínculo pagamento↔empresa (`motivoRecusaDeposito`) | `webhook-asaas-v4` | ✅ |

**Bloqueador:** sem conta **sandbox do Asaas** com credenciais de teste, não dá para validar
contra a API real (campos `status/value/customer` do `GET /payments/:id`, assinatura/entrega
real do webhook). Não apresento mock como validação de produção.

## 6. S3 — uploads de staging (tarefa 5): preparado; bucket real BLOQUEADO

Config: `S3_BUCKET=rycs-uploads-staging` (privado), `S3_REGION/ENDPOINT/ACCESS_KEY/SECRET_KEY`
exclusivos.

Validado com **mocks / fallback local** (verde):

| Item | Onde | Status local |
|---|---|---|
| Autorização de download (só dono/empresa/admin) | `uploads-seguranca` | ✅ |
| Sanitização de nome (anti path-traversal, `..`/barras) | `uploads-seguranca` | ✅ |
| Compatibilidade com arquivos antigos (derivação de s3key, backfill admin-only idempotente) | `uploads-migracao` | ✅ |
| Isolamento entre empresas | `uploads-seguranca` + `podeVerUpload` | ✅ |

**Bloqueador:** sem **bucket S3/R2 real de staging** (credenciais), não dá para validar
URLs assinadas e expiração contra o provedor nem a ACL privada efetiva. Não apresento mock
como validação de produção.

## 7. Bloqueadores de produção (tarefa 10)

| # | Bloqueador | Natureza | O que falta |
|---|---|---|---|
| 1 | Conta **sandbox Asaas** com credenciais de teste | Integração externa | credenciais; rodar confirmação/idempotência/webhook contra a API real |
| 2 | **Bucket S3/R2** privado de staging | Infra externa | credenciais/bucket; validar URL assinada, expiração, ACL privada |
| 3 | Segredos exclusivos de staging | Infra/segurança | gerar e configurar `JWT_SECRET`, `AUDIT_HMAC_SECRET`, `ADMIN_SECURITY_KEY`, token de webhook (não reaproveitar produção) |
| 4 | Decisão de ligar `REAUTH_FINANCEIRO` em produção | Decisão de produto | validado em staging; definir se entra ligado |
| 5 | Revisão humana do PR + reconciliação com a `main` corrente | Processo | `origin/main` continua avançando; rebase/merge final antes de abrir PR |
| 6 | E2E de navegador em infra de staging real (HTTPS, mesmo domínio) | Infra | o E2E local usou proxy do Vite; repetir no domínio de staging |

### Riscos residuais de baixo impacto (registrados)
- `contacts` PATCH/distribuir não valida `sellerId` contra o time (empresa expõe só os
  próprios contatos).
- PII `foto`/`curriculo` ampla por desenho de marketplace.
- `/leads/comissoes` sombreada por `/leads/:id` (bug funcional, não-segurança).

## 8. Pronta para staging?

**Sim.** A branch integra as correções de segurança com a `main` corrente (283/283 verdes,
build verde), as migrações aditivas são compatíveis com banco legado sem perda de dados, e os
fluxos legítimos + a reautenticação financeira foram validados ponta-a-ponta no navegador com
evidência no banco. Faltam, para **produção**: credenciais sandbox do Asaas, bucket S3 de
staging, segredos exclusivos, decisão da flag e revisão humana. Nada disso é inventado aqui —
está listado como bloqueador. Segurança total não é declarada sem essas validações externas.
