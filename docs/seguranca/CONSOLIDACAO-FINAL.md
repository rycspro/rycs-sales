# Consolidação de Segurança — RYCS

Branch única consolidada: **`security/integracao-final`** (worktree isolado, derivado de
`origin/main` @ `301e42f`). **Nada de push/merge/deploy** — pronta para revisão.

Estado: **testes 261/261 verdes**, **build do frontend verde**. As branches originais
(`security/hotfix`, `security/authz-audit`) **não foram modificadas**.

---

## 1. Mapeamento (ETAPA 1)

| Fonte | Base | O que traz |
|---|---|---|
| `origin/main` 301e42f | — | Já inclui `c330f6e` (fecha 4 brechas entre papéis: GET/PATCH campaigns, quiz vendedor, PATCH sellers empresa→403). Catálogo de planos/take-rate já atualizado. |
| `security/hotfix` (14 commits) | 97fac43 (antiga) | V1 (BOLA contatos via `escopo.js`), V2 (empresa editando profissional), V3 (crédito duplicado Asaas), V4 (webhook header-only + confirmação real fail-closed), V5 (reconciliação), V6 (uploads/S3), V7 (revogação de sessão por tokenVersion), reautenticação financeira, trilha de auditoria. |
| `security/authz-audit` (2 commits) | 7a70ed5 (pós-c330f6e) | H1 (vazamento de candidaturas), H2 (destaque/plano mass-assignment), H3 (GET /state vaza em erro), M2 (progresso de curso entre empresas), quiz (visibilidade + limite de tentativas). |

**Sobreposições detectadas**
- **V2 / sellers.js**: `c330f6e` (na main, 1 linha) × `hotfix` (`podeEditarVendedor`). O do hotfix é *superset* (bloqueia empresa **e** acrescenta reautenticação/auditoria de Pix). → mantida a do hotfix; a linha de c330f6e virou redundante.
- **V1 / contacts.js**: `hotfix` (centralizado em `escopo.js`, cobre as 5 rotas) × `authz-audit` (inline, mesma lógica). Eram **duplicatas**. → mantida a do hotfix (escopo.js); a inline foi descartada.
- **campaigns.js**: `c330f6e` (main) + `authz-audit` (H1/quiz) — complementares, sem conflito (hotfix não toca esse arquivo).

## 2. Integração (ETAPA 2)

Cherry-pick do range do hotfix (`97fac43..security/hotfix`, com `-x`) sobre `origin/main`,
seguido das correções exclusivas da `authz-audit`. Conflitos resolvidos **analisando a
lógica**, nunca merge automático.

**Commits integrados (18):**
```
6b4a020 V1/V2/V3 (hotfix)            8e34de9 V4 webhook header-only
3fd7b3f testes concorrência/idemp.   af0833f V6 uploads sanitização
651796a V7 + trilha auditoria        f556d98 V5 reconciliação
4aa4755 reautenticação financeira    6069fde V4 confirmação real Asaas
31d70fb docs Fase 2                   554c902 V5 ampliada
9465e81 testes durabilidade trilha   7ea87a5 V6 migração s3key
8a841a2 item6 CSP/prompt/authz CV     a91f4c5 reauth modal (frontend)
e8c4ca5 authz-audit integrada (H1/H2/H3/M2/quiz)
a2629ca test(pix) stub GET /payments/:id p/ V4
1b5aed9 authz do rescan (submissions ALTA + deposits IDOR)
```

**Duplicatas eliminadas:** V2 (linha de c330f6e absorvida por `podeEditarVendedor`);
V1 contacts (inline descartada em favor de `escopo.js`).

**Conflitos resolvidos:** `sellers.js` (guard do PATCH → versão do hotfix);
`contacts.js` (→ versão do hotfix).

## 3. Validação das correções (ETAPA 3)

| Item | Onde | Estado |
|---|---|---|
| V1 contatos entre empresas | contacts.js + escopo.js | ✅ fechado |
| V2 edição indevida de profissional | sellers.js `podeEditarVendedor` | ✅ fechado |
| V3 crédito duplicado Asaas | ledger `UNIQUE(tipo,idempotencyKey)` | ✅ fechado |
| V4 autenticação/validação de pagamento | webhook header-only + confirmação real fail-closed | ✅ fechado |
| V5 reconciliação financeira | serviço read-only + rota admin | ✅ fechado |
| V6 proteção de uploads | chave sanitizada + download assinado por dono + migração s3key | ✅ fechado |
| V7 revogação de sessão | `tokenVersion` no JWT + `/auth/logout-all` | ✅ fechado |
| Acesso indevido a campanhas | c330f6e (GET/PATCH) | ✅ fechado |
| Vazamento de candidaturas | campaigns.js H1 | ✅ fechado |
| Alteração de planos/destaque | companies.js H2 (só admin) | ✅ fechado |
| Vazamento em GET /state | state.js H3 (fallback vazio) | ✅ fechado |
| Progresso de curso entre empresas | course.js M2 (vínculo aprovado) | ✅ fechado |
| Acesso a quizzes | campaigns.js (ativa+visível + maxTentativas) | ✅ fechado |
| Reautenticação financeira | reautenticacao.js (atrás de flag) + saque/Pix | ✅ presente |
| Auditoria de operações sensíveis | securityAudit.js + tabela security_audit | ✅ presente |
| **Reserva cross-tenant em POST /submissions** | submissions.js (achado novo do rescan) | ✅ fechado |
| **IDOR em GET /deposits/:id** | deposits.js (achado novo do rescan) | ✅ fechado |

## 4. Testes de integração (ETAPA 4) — todos verdes

Os 10 cenários exigidos estão cobertos pela suíte combinada (261/261):

1. Empresa A ✗ dados de B — `seguranca-autorizacao` (contatos, state), `seguranca-contatos`.
2. Profissional ✗ altera campanhas — c330f6e + testes de campaigns.
3. Profissional ✗ altera Pix de terceiros — `seguranca-vendedor` (PATCH sellers + reauth).
4. Empresa ✗ modifica plano/destaque — `seguranca-autorizacao` (H2).
5. Webhook falsificado ✗ gera crédito — `webhook-asaas-v4` (token/header).
6. Webhook duplicado ✗ duplica saldo — `deposito-idempotente`.
7. Saques simultâneos ✗ saldo negativo — `concorrencia-financeira`.
8. Sessão revogada ✗ acessa — `seguranca-sessao` (V7).
9. Erro interno ✗ vaza dados de outros — `seguranca-autorizacao` (H3).
10. Fluxos legítimos seguem — `pix-automatico`, `onboarding-*`, etc.
+ novos: `seguranca-autorizacao` cobre submissions cross-tenant e IDOR de deposits.

## 5. Auditoria final sobre o consolidado (ETAPA 5)

Inventário **fresco** de todas as rotas (não reaproveitou auditorias anteriores). Achados:

- **[ALTA] POST /submissions** confiava no `companyId` do corpo → reserva de caixa de
  outro tenant (empresa com companyId alheio; vendedor sem vínculo no caminho sem
  campanha). **Corrigido** (commit `1b5aed9`): só vendedor-dono/admin; vendedor exige
  parceria `applications` aprovada. Regressão adicionada.
- **[BAIXA] GET /deposits/:id**: vendedor lia depósito de qualquer empresa (IDOR).
  **Corrigido** (`1b5aed9`): só dona/admin. Regressão adicionada.
- **[BAIXA] contacts PATCH/distribuir**: `sellerId` atribuído sem validar que o
  profissional é do time da empresa. **Em aberto** (ver §6) — a empresa expõe apenas os
  próprios contatos, risco controlado.
- **[INFORMATIVO] PII de profissionais**: `GET /sellers/:id/curriculo` (qualquer empresa)
  e `/foto` (qualquer logado) — por desenho de marketplace. Sem ação.
- **[NÃO-SEGURANÇA] `/leads/comissoes`** é sombreada por `/leads/:id` (ordem de registro):
  responde 404. Bug funcional, sem impacto de autorização.

Todo o restante (fluxos financeiros admin-gated, revogação de sessão, reautenticação,
webhooks assinados, isolamento via `escopo.js`, allowlists anti mass-assignment em
sellers/companies/campaigns/leads/knowledge/company-info) foi reverificado e está correto.

## 6. Vulnerabilidades ainda abertas / pendências

**Em aberto (baixo risco, registrados — sem decisão de negócio para fechar agora):**
- contacts PATCH/distribuir: validar `sellerId` contra `applications` aprovada do time
  (a empresa só expõe os próprios contatos; hardening recomendado).
- `GET /sellers/:id/foto` e `/curriculo`: PII ampla por desenho de marketplace — confirmar
  com produto se deve exigir vínculo.
- `POST /sellers` (autocadastro em triagem) e `/leads/comissoes` (rota sombreada): itens
  conhecidos, não-autorização.

**Pendências de frontend:** a reautenticação financeira (`ModalConfirmarSenha.jsx` +
marcador `reauth:true`) está atrás de **flag** no backend (`reautenticacao.js`); ligar a
flag em produção exige validar o fluxo do modal no app (saque/troca de Pix).

**Pendências de Asaas:** a confirmação real V4 (`consultarPagamento` → `GET /payments/:id`)
é fail-closed — em produção, garantir que `ASAAS_API_KEY`/base estejam configurados (sem
eles e com webhook ativo em produção, o crédito é recusado por desenho). Validar contra o
contrato real os campos `status/value/customer`.

**Pendências de AWS:** uploads V6 assumem bucket privado + download assinado; confirmar a
policy do S3 em produção e rodar a migração `/admin/uploads/backfill-keys` (aditiva) para
os uploads legados.

## 7. Diferenças vs `main` e condições para staging/produção

- 18 commits, **58 arquivos, +2055/−885**. Migrações **somente aditivas** (colunas
  `users.tokenVersion`, `sellers.pixAlteradoEm`, `uploads.s3key`; tabelas `security_audit`,
  `gateway_events`) — rodam no boot, sem passo manual destrutivo.
- **Não** altera preços, comissões ou regras comerciais.

**Para staging:** subir a branch; confirmar variáveis (`JWT_SECRET`, `ASAAS_API_KEY` +
base, `ASAAS_WEBHOOK_TOKEN`, bucket S3); rodar o backfill de uploads; exercitar saque, Pix
Automático e webhooks com dados de teste; decidir se a flag de reautenticação entra ligada.

**Para produção:** aprovação humana do PR; migrações aditivas confirmadas; monitorar a
trilha `security_audit` e as recusas fail-closed do webhook nas primeiras horas.

> Ressalva: a suíte isolada passar **não** declara a RYCS segura. Faltam validação em
> staging com integrações reais (Asaas/S3), revisão humana e teste dos fluxos de frontend
> sob a flag de reautenticação.
