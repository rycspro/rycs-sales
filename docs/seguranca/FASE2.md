# RYCS — Segurança Fase 2 (branch `security/hotfix`)

Documento de acompanhamento das correções implementadas e dos itens que
dependem de decisão comercial, integração externa ou infraestrutura.

## 1. Correções implementadas (com testes)
| Item | Commit | Teste |
|---|---|---|
| V7 — revogação global de sessão (tokenVersion) + auditoria | `7bcb6f0` | `test/seguranca-sessao.test.js` |
| Reautenticação financeira (saque/Pix, flag) | `13488d1` | `test/reautenticacao-financeira.test.js` |
| V4 — webhook Asaas (header-only, timingSafeEqual, vínculo) | `2fcb15f` | `test/webhook-asaas-v4.test.js` |
| V5 — reconciliação read-only + rota admin | `521d5f0` | `test/reconciliacao-financeira.test.js` |
| V6 — uploads (sanitização + download assinado por dono) | `dd87a88` | `test/uploads-seguranca.test.js` |
| (Hotfix Fase 1: V1/V2/V3) | `beb7f15`, `1e19213` | 4 testes de segurança |

## 2. Ações manuais / ativação (dependem de configuração externa)
1. **Reautenticação financeira:** ligar com `REAUTH_FINANCEIRO=1` **após** publicar o modal
   de confirmação de senha no frontend (White Editorial, azul `#318CE7`). Com a flag
   desligada (padrão), o fluxo atual é preservado — nada quebra.
2. **V4 — confirmação por API do Asaas:** o código valida vínculo (empresa/valor/moeda/
   solicitação) e autentica por header com `timingSafeEqual`. A confirmação ativa por
   `GET /payments/:id` ficou como passo guardado por `asaasAtivo()` (fail-closed) e
   **requer o contrato real do Asaas** (nomes de campos `status`/`value`/`customer`) para
   ser habilitada com segurança.
3. **V6 — bucket privado:** o download assinado (`GET /uploads/:id/url`) está pronto e a
   chave S3 é armazenada. **Tornar o bucket privado é ação de infra (AWS/S3)** e deve ser
   feita só depois de o frontend passar a consumir a URL assinada. **O rollback jamais
   reabre o bucket** — o estado seguro é o novo default.
4. **V7:** a migração aditiva (`users.tokenVersion`) roda sozinha no boot. O frontend já
   trata 401 ("Sessão expirada"); recomenda-se um aviso "sua sessão expirou após a troca
   de senha".

## 3. Item 8 — 5 testes financeiros preexistentes (BLOQUEADO: decisão comercial)
`shared/planos.js` hoje tem **6 planos** com takeRates `0.50/0.20/0.15/0.12/0.10/0.05`,
enquanto `test/planos-takeRate.test.js` espera o modelo antigo de 3 planos
`starter 0.30 / growth 0.15 / scale 0.07`. Por CLAUDE.md, `shared/planos.js` é a fonte de
verdade — o que indica que **o teste está obsoleto**, não os preços.

**Não foi alterado nada** (preços nem testes) porque o prompt exige confirmar a regra
oficial primeiro. Pendência: o dono do produto deve confirmar a tabela oficial de
takeRates; só então atualiza-se os cenários de teste para refleti-la. Enquanto isso, essas
5 falhas são **pré-existentes** e independentes desta fase (comprovado rodando na base
limpa).

## 4. Item 9 — residuais de hardening
- **Rate limiting de webhooks:** já coberto pelo `apiLimiter` global (120/min por IP) em
  `/api`. Sem mudança adicional necessária.
- **CSP (helmet contentSecurityPolicy:false):** habilitar exige uma política testada
  contra todo o SPA (fontes, imagens, scripts). **Não habilitado agora** para não quebrar
  a interface; recomenda-se uma política `report-only` primeiro.
- **Prompt injection no auditor de IA (`/api/analisar`):** a saída já é restrita a um enum
  (`veredito`) e truncada; o risco é o texto de prova do vendedor influenciar o veredito.
  Mitigação recomendada (não aplicada, para não mudar a lógica de auditoria sem aprovação):
  delimitar a prova como dado e instruir o sistema a ignorar instruções embutidas.
- **Exposição de CV/foto:** `GET /sellers/:id/curriculo` é visível a qualquer empresa e
  `GET /sellers/:id/foto` não tem checagem além de autenticação — **por design de
  marketplace**. Para Índia/DPDP, recomenda-se restringir a empresas com vínculo/candidatura
  (decisão de produto).
- **Mass assignment / cookies / CORS / erros:** já em bom estado (allowlists, `httpOnly`/
  `secure`/`sameSite=lax`, origens restritas, handler de erro genérico).
- **Backups SQLite:** recomenda-se backup consistente via API de backup do SQLite
  (snapshot WAL) e teste de restauração — ação de operação/infra.

## 5. Item 10 — Arquitetura financeira multimoeda (PROJETO, não implementado)
Entregue separadamente das correções de segurança, **sem migrar o ledger histórico nem
ativar saque internacional** (requer aprovação do modelo de dados).

Princípios:
1. **Moeda explícita no ledger:** coluna aditiva `financial_ledger.moeda` (default `BRL`
   para o histórico); todo lançamento carrega a moeda.
2. **Valores em unidade mínima:** usar `shared/moedas.js` (`paraMenorUnidade`) e inteiros
   nas contas, evitando ponto flutuante.
3. **Saldo segregado por (entidade, moeda):** tabela `balances(entityId, moeda, saldo,
   reservado)` — nunca somar BRL e USD.
4. **Idempotência por provedor + transação:** chave inclui o provedor (`asaas`/`stripe`/
   rail-IN) para não colidir entre rails.
5. **Câmbio registrado:** conversão só em pontos explícitos, com a taxa gravada no ledger.
6. **Reconciliação por provedor e moeda** (estende o V5).
7. **Roteamento de saque por país/provedor** + **bloqueio seguro** quando não há rail
   habilitado para a moeda do profissional (ex.: hoje só BRL/Asaas/Pix; Índia exige rail
   INR + KYC/AML). Até lá, **bloquear saque para `pais != BR`** com mensagem clara.

## 6. Rollback
- Nenhuma migração destrutiva: as colunas (`tokenVersion`, `pixAlteradoEm`, `uploads.s3key`)
  e a tabela `security_audit` são **aditivas**; reverter o código as deixa inertes.
- Rollback por `git revert` dos commits desta fase restaura o comportamento anterior.
  ⚠️ Reverter reabre as respectivas vulnerabilidades — é medida de emergência.
- V6: o rollback **não** reabre o bucket público.
