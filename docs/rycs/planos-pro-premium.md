# Fase 11 — Planos do profissional: Grátis, Pro e Premium

Status: **proposta para aprovação**. Nada foi implementado. O passo 3 (código) só começa depois do "ok" do usuário.

Escopo: só o plano do **profissional (vendedor)**. Os planos da **empresa** (`shared/planos.js`: Sandbox/Start/Growth/Scale/Premium-isenção) não mudam.

Fontes lidas:
- `~/Downloads/RYCS-Planos-Profissionais.pdf` (proposta interna de nov/2026, v1.4): RYCS Pro a R$ 19,90/mês e R$ 199/ano.
- `docs/rycs/PROMPT-MESTRE.md` **não existe** neste repositório nem em `~/Documents/rycs-sales`. Também não achei outros PDFs de planos em `docs/rycs/`. Se o prompt mestre tiver regras que contradizem este documento, ele precisa ser trazido para o repo.

---

## 1. O que existe hoje (passo 1)

### 1.1 Conclusão principal

**Não existe no código nenhuma assinatura paga do profissional.** O "RYCS Pro" de R$ 19,90/mês e R$ 199/ano só existe no PDF de proposta. Nenhum arquivo de `server/`, `shared/`, `src/`, `test/`, `landing/` ou `public/` contém 19,90, R$ 199, 197 ou 497 ligados ao profissional, nem tela "Seja RYCS Pro", nem checkout do vendedor, nem webhook que ligue pagamento ao vendedor.

Consequência para a migração: **pelo sistema, ninguém assina o Pro antigo.** Se algum Pro foi vendido fora do app (Pix manual, link avulso), é preciso levantar essa lista à mão (ver §6).

### 1.2 Onde "Pro" e "Premium" aparecem, e o que significam de fato

| Arquivo:linha | O que é | Tem a ver com o plano pago? |
|---|---|---|
| `server/services/score.js:5-10` | `LEVELS`: níveis por Score e ações aprovadas. `key: "pro", label: "RYCS Pro"` (Score ≥ 60 e 20 ações). | Não. É **nível por mérito**, gravado em `sellers.nivel`. Mesmo nome do plano: conflito (§2.1). |
| `server/services/score.js:82-94` | `calcularNivel` e `UPDATE sellers SET nota, nivel`. | Não. |
| `shared/academy.js:11-23` | `NIVEIS` do selo da Academy: `certified` / `pro` (roxo) / `elite` (âmbar `#B45309`). | Não. Selo por mérito. Conflita com "etiqueta Pro" e com "etiqueta dourada" da certificação (§2.1). |
| `server/services/betaEnvironment.js:56-62` | Profissionais de teste com `nivel = "pro"`. | Não (nível). |
| `server/db.js:44-61` | Tabela `sellers`: tem `nivel`, `nota`, `disponivel`, `pendente`, `sacado`. **Nenhuma coluna de plano/assinatura.** | — |
| `server/db.js:343-354` | Tabela `subscriptions`: `companyId TEXT NOT NULL`. Só empresa. | Não serve para vendedor sem mexer na regra da empresa. |
| `server/routes/companies.js:485`, `server/db.js:1592` | `companies.assinatura = 'pro'` em empresa criada pelo admin. | Não (empresa). |
| `server/routes/subscriptions.js:174`, `server/services/acessoEmpresa.js:16` | Acesso da empresa responde `plano: "pro"`. | Não (empresa). |
| `shared/empresa.js:25`, `shared/assinatura.js:22-81`, `shared/planos.js:49-88`, `server/routes/billing.js:45-72`, `src/components/admin/CobrancaEmpresa.jsx`, `src/components/admin/AssinaturasAdmin.jsx` | `tipoEmpresa = "premium"` e plano `premium` da **empresa** (isenção dada pelo admin). | Não. Mesmo nome do novo plano do profissional (§2.1). |

### 1.3 Cobrança, Asaas e webhook (hoje, só empresa)

| Arquivo:linha | O que faz |
|---|---|
| `server/services/asaas.js:41-105` | Cliente HTTP do Asaas (`asaas()`), `asaasAtivo()`, `garantirCliente(db, empresa)`. O cliente é sempre a empresa. |
| `server/routes/subscriptions.js:12-13` | `CICLO_ASAAS = { MENSAL: "MONTHLY", SEMESTRAL: "SEMIANNUALLY", ANUAL: "YEARLY" }`. O ciclo anual já é suportado. |
| `server/routes/subscriptions.js:404-720` | `POST /subscription` (empresa): cria `POST /subscriptions` no Asaas com `cycle`, `externalReference: "sub:<id>"` (linhas 597-599, 672), grava em `subscriptions`. |
| `server/routes/subscriptions.js:815-830` | Pix Automático da empresa: `/pix/automatic/authorizations` com `frequency: "MONTHLY"`. |
| `server/routes/subscriptions.js:933-960` | `DELETE /subscription`: cancela no Asaas. |
| `server/routes/payments.js:426-470` | **Webhook único do Asaas** (`/payments/webhook`), com token `ASAAS_WEBHOOK_TOKEN` e idempotência em `gateway_events`. `PAYMENT_RECEIVED/CONFIRMED` → `creditarDeposito`; `OVERDUE/REFUSED/DECLINED/REFUNDED/CHARGEBACK` → desliga destaque da empresa (`externalReference` `destaque:`) ou `marcarInadimplencia(payment.subscription)`. |
| `server/routes/stripe.js`, `server/services/stripe.js` | Stripe (internacional), só empresa. |

Risco que o passo 3 precisa tratar: hoje **todo** `PAYMENT_RECEIVED` cai em `creditarDeposito` e toda falha com `payment.subscription` cai em `marcarInadimplencia` da empresa. Pagamento do profissional precisa ser desviado **antes** disso, pela `externalReference`.

### 1.4 Regras do profissional que os planos vão tocar

| Arquivo:linha | Regra atual |
|---|---|
| `shared/saque.js:11` | `SAQUE_MINIMO = 10` (R$), igual para todos. |
| `server/routes/payments.js:127-135` | `POST /payments/withdraw` aplica o mínimo. |
| `server/routes/payments.js:207-400` | Saque passa por conferência do admin (`reconciliar`, `pagar-pix`, `estornar`). É a "fila de conferência" que o Pro pularia. |
| `src/components/vendedor/Carteira.jsx:5,35,86-87` | Tela usa o mesmo `SAQUE_MINIMO`. |
| `server/routes/sellers.js:40` | Lista de profissionais: `ORDER BY nota DESC, criadoEm DESC`. Ponto onde entraria o desempate do Pro. |
| `shared/indicacoes.js:9-19` | Indicação: profissional ganha R$ 100 quando indica **empresa**. Não existe bônus por profissional que assina. |
| `server/services/acessoProfissional.js:3-19` | Único "portão" do profissional hoje: status da triagem (`aprovado`/`parcial`). Não depende de plano. |
| `src/components/vendedor/PainelVendedor.jsx:74-89` | Painel mostra o nível (`g.nivel`) da gamificação. |

**Não encontrei no código:** discadora, lembretes por WhatsApp para contatos do profissional, treinador de vendas com IA para o profissional, scripts com IA por campanha para o profissional, mentoria, vitrine Top Talent, carta de recomendação, cursos de nicho pagos, Certificação Profissional/Avançada paga. Esses recursos **ainda precisam ser construídos**; o plano só declara a permissão deles agora. (`shared/campaignSimulation.js` e `server/routes/academyEmpresa.js` citam simulação, mas do lado da empresa. Confirmar no passo 3.)

### 1.5 Como o plano do vendedor é guardado hoje

**Não é guardado.** A tabela `sellers` não tem coluna de plano e a `subscriptions` exige `companyId`. O único campo parecido é `sellers.nivel` (`starter`/`pro`/`expert`/`elite`), que é nível por Score, recalculado em `server/services/score.js:82-84`, e **não pode** ser reaproveitado como plano pago.

---

## 2. Decisões de estrutura

### 2.1 Nomes sem colisão

- Arquivo novo `shared/planosProfissional.js`. `shared/planos.js` (empresa) não é tocado.
- Chaves: `gratis`, `pro`, `premium`. Ficam em módulo e tabela próprios, então não se misturam com `tipoEmpresa = "premium"` nem com `sellers.nivel = "pro"`.
- **Conflito visível na tela:** o nível por Score se chama "RYCS Pro" (`score.js:7`) e o selo da Academy tem nível "Pro" (`academy.js:13`). Com o plano pago chamado "Pro", o profissional não vai saber se a etiqueta veio de mérito ou de pagamento. Precisa de decisão (ver §8). Sugestão: renomear só o **rótulo** do nível de Score (a chave `pro` em `sellers.nivel` fica, sem migração de dados).
- Etiqueta dourada: no PDF, dourada = Certificação Avançada. No código, o selo `elite` da Academy já usa âmbar. Antes de criar a etiqueta, decidir se "dourada" é o selo `elite` atual ou um selo novo de certificação (ver §8).

### 2.2 Onde o plano passa a viver

Tabela nova, criada com `CREATE TABLE IF NOT EXISTS` (aditiva, não toca dado existente):

```
assinaturas_profissional
  id               TEXT PRIMARY KEY
  sellerId         TEXT NOT NULL  -> sellers.id
  plano            TEXT NOT NULL  -- 'pro' | 'premium'
  ciclo            TEXT NOT NULL  -- 'anual' (deixa espaço para outro ciclo no futuro)
  status           TEXT NOT NULL  -- 'pendente' | 'ativa' | 'atrasada' | 'cancelada' | 'reembolsada' | 'expirada'
  origem           TEXT NOT NULL  -- 'asaas' | 'admin' | 'migracao'
  asaasId          TEXT           -- id da subscription no Asaas
  asaasCustomerId  TEXT
  ultimoPaymentId  TEXT
  valor            REAL           -- valor cobrado no ciclo, em reais
  inicio           INTEGER
  pagoAte          INTEGER        -- fim do período já pago: benefício vale até aqui
  proximaCobranca  INTEGER
  canceladoEm      INTEGER
  motivo           TEXT DEFAULT ''-- motivo do admin / do cancelamento
  criadoEm         INTEGER NOT NULL
  atualizadoEm     INTEGER
```

O plano **efetivo** não fica gravado em `sellers`. Ele é calculado por uma função pura, no mesmo padrão de `acessoDaEmpresa` em `shared/assinatura.js`:

```
planoDoProfissional(assinaturas, agora) -> { plano: 'gratis'|'pro'|'premium', ate, estado }
```

Regra: vale a assinatura com `pagoAte > agora` e status `ativa`, `atrasada` (dentro da carência) ou `cancelada` (cancelou, mas já pagou o período). `reembolsada` e `expirada` não valem. Sem nenhuma, `gratis`. Como o rebaixamento sai do `pagoAte`, não precisa de cron para "tirar o Pro" no fim do período.

### 2.3 Tabela de permissões (entitlements)

Um único lugar diz o que cada plano tem. O código pergunta por **recurso**, nunca pelo nome do plano:

```js
// shared/planosProfissional.js
pode(plano, "saqueNaHora")           // boolean
limite(plano, "minutosDiscadora")    // número | Infinity | null (pendente = bloqueado)
desconto(plano, "certAvancada")      // fração, ex.: 0.30
```

No servidor, `exigirPermissao("recurso")` (middleware) e `consumirCota(sellerId, "recurso", qtd)`. No front, o mesmo `pode()` importado de `shared/`, com o plano vindo da API. Fica proibido `if (plano === "pro")` fora deste módulo.

Valor `null` = número ainda não definido. Enquanto for `null`, o recurso fica **desligado** para todos, e nenhum número é inventado.

| Recurso (chave) | Tipo | Grátis | Pro | Premium | Existe hoje? |
|---|---|---|---|---|---|
| `perfil`, `candidaturas`, `saques` | bool | sim | sim | sim | sim. **Nunca** depende de plano. |
| `etiquetaPro` | bool | não | sim | sim (etiqueta Premium? §8) | não |
| `desempateScore` | bool | não | sim | sim | não (`sellers.js:40`) |
| `prioridadeCampanhasPremium` | bool | não | não | sim | não |
| `vagasAntecipadasHoras` | número | 0 | 24 | 24 (mais? §8) | não |
| `alertaVagaApp` / `alertaVagaWhatsApp` | bool | não | sim | sim | não |
| `saqueNaHora` (pula a conferência, dentro do antifraude) | bool | não | sim | sim | não (`payments.js:207-400`) |
| `saqueMinimo` (R$) | número | 10 (`SAQUE_MINIMO`) | **pendente** | **pendente** | parcial |
| `cursosNicho` | bool | pagos | incluídos | incluídos | não |
| `descontoTrilhaChallenger` | fração | 0 | **pendente** | 1 (incluída) | não |
| `certProfissionalIncluida` | bool | não | sim | sim | não |
| `renovacoesCertProfissional` | número | 0 | 1 | ilimitadas enquanto assinar | não |
| `descontoCertAvancada` | fração | 0 | 0,30 | — | não |
| `tentativasCertAvancadaIncluidas` | número | 0 | 0 | **pendente** (texto diz "tentativa"; 1?) | não |
| `treinadorIA` | limite/mês | 0 | ilimitado | ilimitado | não |
| `treinadorCenariosAvancados` | bool | não | não | sim | não |
| `scriptsIAPorCampanha` | bool | não | sim | sim | não |
| `painel` | nível | básico | completo | completo + comparação com os melhores | parcial (`PainelVendedor.jsx`) |
| `minutosDiscadora` | cota/mês | 0 | **pendente** | **pendente** (maior que Pro) | não |
| `discadoraGravacaoTranscricaoFeedback` | bool | não | não | sim | não |
| `lembretesWhatsApp` | cota/mês | 0 | **pendente** (básico) | **pendente** (completo) | não |
| `mentoriaGrupoMensal`, `comunidade` | bool | não | não | sim | não |
| `revisaoHumanaPorTrimestre` | número | 0 | 0 | 1 (quem revisa: pendente) | não |
| `vitrineTopTalent`, `cartaRecomendacao` | bool | não | não | sim, **só** com etiqueta dourada | não |
| `suporte` | nível | normal | prioritário | canal direto | não |
| `bonusIndicacaoAssinante` (R$) | número | 0 | **pendente** | **pendente** (maior) | não (`indicacoes.js` só paga por empresa) |
| `acessoAntecipado` | bool | não | não | sim | não |

Regras de produto que a tabela precisa garantir (e que viram teste):
1. Grátis segue completo para trabalhar e ganhar: `perfil`, `candidaturas` e `saques` não aparecem como permissão de plano.
2. Destaque do Pro nunca passa por cima do Score: o desempate só reordena profissionais **dentro da mesma faixa de Score**. Implementação: ordenar por `faixa = floor(nota / tolerancia)` desc, depois `desempateScore` desc, depois `nota` desc. Faixa em vez de "diferença ≤ X" porque a comparação por diferença não é transitiva e quebra a ordenação. A tolerância é pendência.
3. Etiqueta dourada não vem do pagamento: Premium dá o **direito de fazer** a Certificação Avançada (tentativa incluída), não a etiqueta. `vitrineTopTalent` e `cartaRecomendacao` exigem plano Premium **e** certificação avançada aprovada.
4. Nenhum texto de venda promete mais vendas ou ganho.
5. Sem bônus de comissão em nenhum plano: comissão não lê o plano.

### 2.4 Preços

`shared/planosProfissional.js` guarda preço em reais: Pro R$ 197/ano, Premium R$ 497/ano, Grátis R$ 0. Nada de valor fixo em tela ou rota; a vitrine lê deste arquivo (mesma regra do CLAUDE.md para `shared/planos.js`). Preços em dólar e rúpia ficam fora até serem definidos (`shared/precosInternacionais.js` é da empresa e não será reaproveitado sem decisão).

---

## 3. Cobrança anual pelo Asaas

Nacional: **só Pix** (decisão já registrada para o projeto; o PDF ainda cita cartão e Pix Automático, isso fica desatualizado).

### 3.1 Abertura

1. `POST /api/profissional/assinatura { plano }`, com `authMiddleware` e `role === "vendedor"`.
2. Garante o cliente no Asaas para o **vendedor** (função irmã de `garantirCliente`, usando CPF de `sellers.documento`). Guarda `asaasCustomerId` na assinatura.
3. Cria `POST /subscriptions` no Asaas com `billingType: "PIX"`, `cycle: "YEARLY"`, `value` lido de `shared/planosProfissional.js`, `nextDueDate` = hoje, `externalReference: "prof:<assinaturaId>"`, descrição "RYCS Pro — assinatura anual".
4. Grava `assinaturas_profissional` com `status = 'pendente'`. Mostra o QR Code Pix da primeira cobrança.
5. Benefício só liga quando o webhook confirmar o pagamento.

Pix Automático anual (débito sem o profissional pagar o QR todo ano) é possível no Asaas, mas o projeto hoje só usa `MONTHLY`. Fica como decisão (§8). Sem ele, a renovação gera uma cobrança Pix por ano, e o profissional paga o QR Code.

### 3.2 Webhook

Mesmo endpoint (`server/routes/payments.js:426`), com um desvio **antes** da lógica da empresa: se `payment.externalReference` começa com `prof:`, a rotina do profissional trata o evento e retorna. A trava de idempotência atual (`gateway_events`) continua valendo, e a rotina também confere `ultimoPaymentId` para não estender o período duas vezes (o Asaas manda `RECEIVED` e `CONFIRMED` para o mesmo pagamento).

| Evento Asaas | Efeito |
|---|---|
| `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` (1ª cobrança) | `status = 'ativa'`, `inicio = agora`, `pagoAte = vencimento + 12 meses`. |
| `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` (renovação) | `pagoAte = max(pagoAte, vencimento) + 12 meses`. Pagou atrasado não perde nem ganha dias: o ano conta do vencimento. |
| `PAYMENT_OVERDUE` (renovação vencida) | `status = 'atrasada'`. Benefícios seguem por uma **carência** (dias: pendência). Passada a carência, a função de plano devolve `gratis`. Aviso no app e WhatsApp. |
| Cancelamento pelo profissional | `DELETE /subscriptions/<id>` no Asaas (para as próximas cobranças), `status = 'cancelada'`, `canceladoEm`. **Benefício segue até `pagoAte`.** |
| `PAYMENT_REFUNDED` | `status = 'reembolsada'`, benefício cai na hora. Direito de arrependimento (7 dias da compra on-line) tem que ser aceito com reembolso integral; prazo e regra fora disso: pendência com advogado. |
| `PAYMENT_CHARGEBACK_REQUESTED` | Mesmo efeito do reembolso + registro no antifraude (o saque na hora fica bloqueado para essa conta). |
| `PAYMENT_DELETED` (cobrança removida antes de paga) | Se a assinatura nunca ficou ativa, `status = 'expirada'`. |

Mudança de plano:
- Pro → Premium: pendência (cobrar a diferença proporcional ou cobrar o Premium cheio e estender). Sugestão a validar: crédito proporcional do Pro abatido do Premium.
- Premium → Pro: só no fim do período pago, sem reembolso parcial.

O que fica gravado em cada mudança: linha de auditoria (`auditTrail` já existe em `server/services/auditTrail.js`) com quem, quando e por quê, inclusive concessão manual pelo admin (`origem = 'admin'`).

### 3.3 Nada de cobrança real nesta fase

- Variável `PLANOS_PROFISSIONAL_ATIVO` desligada em produção: sem ela, a tela mostra os planos com "em breve" e a rota de assinatura responde 503.
- Testes e validação só no sandbox do Asaas.
- Liberar cobrança real exige: advogado (modelo de cobrar profissional, termos, arrependimento) e contador (nota fiscal, tributação da assinatura).

---

## 4. Migração de quem assina o Pro antigo

1. **Pelo sistema, ninguém assina.** Não há tabela, cobrança nem webhook de assinatura de profissional (§1.1). Então não há dado para migrar automaticamente.
2. Se algum Pro de R$ 19,90/mês ou R$ 199/ano foi vendido fora do app, o admin registra cada pessoa com `origem = 'migracao'`, `plano = 'pro'`, `pagoAte` = fim do período que ela pagou. Ninguém perde o que pagou.
3. Quem comprou o anual de R$ 199 com a promessa de "1 Certificação Profissional" recebe a certificação incluída, como prometido.
4. Na renovação, essas pessoas passam ao preço novo, com aviso antecipado (prazo: pendência com advogado). Sem renovação automática para quem pagou por fora: ao fim do `pagoAte`, ela vira Grátis e recebe o convite para assinar.
5. `sellers.nivel = 'pro'` (nível por Score) **não** vira plano. Quem tem esse nível não ganha nem perde nada com a Fase 11.
6. O PDF `RYCS-Planos-Profissionais.pdf` fica desatualizado (fala de Pro mensal R$ 19,90 e anual R$ 199). Atualizar fora do repo.

---

## 5. Cotas mensais e aviso a 80%

Tabela nova (aditiva):

```
uso_profissional
  sellerId   TEXT NOT NULL
  recurso    TEXT NOT NULL   -- 'minutosDiscadora' | 'lembretesWhatsApp' | ...
  periodo    TEXT NOT NULL   -- 'AAAA-MM' no fuso America/Sao_Paulo
  usado      REAL DEFAULT 0
  avisado80  INTEGER DEFAULT 0
  avisado100 INTEGER DEFAULT 0
  PRIMARY KEY (sellerId, recurso, periodo)
```

- `consumirCota(sellerId, recurso, qtd)` roda numa transação: lê o limite pela tabela de permissões, confere se cabe, soma, e devolve `{ ok, usado, limite, restante }`. Sem espaço, recusa **antes** de gastar (a ligação não começa, o lembrete não sai).
- Reset mensal sem cron: o período novo é uma linha nova.
- Ao cruzar 80% pela primeira vez no mês: notificação no app (tabela `notifications`, `server/db.js:267`) e, se o profissional aceitou, WhatsApp. `avisado80 = 1` evita repetir. O mesmo a 100%.
- Discadora: minutos arredondados para cima por ligação (regra a confirmar).
- Lembretes: um por mensagem enviada, e **só** para contato com consentimento registrado (LGPD e regra do WhatsApp). Precisa de um registro de consentimento por contato, que hoje não existe.
- Cota não acumula de um mês para o outro (a confirmar).
- Rebaixamento no meio do mês: o limite novo vale na hora; o já usado fica.

---

## 6. Proposta do passo 3 (para aprovar, não iniciado)

Ordem sugerida, cada item com teste e build antes de seguir:

1. **Base:** `shared/planosProfissional.js` (preços, permissões, `pode/limite/desconto`, `planoDoProfissional`), tabela `assinaturas_profissional`, testes puros em `test/planosProfissional.test.js`. Rota `GET /api/profissional/plano`. Admin concede/retira plano manualmente (com motivo), para testar sem cobrança.
2. **Cobrança em sandbox:** rota de assinatura, desvio `prof:` no webhook, cancelamento. Teste de rota com `test/apoio/servidor.js`. Atrás de `PLANOS_PROFISSIONAL_ATIVO`.
3. **Tela de planos do profissional:** card "Seja Pro" no perfil e vitrine Grátis/Pro/Premium com tokens de `src/styles.js`, textos em pt-BR, sem promessa de vendas.
4. **Primeiros recursos que já têm onde morar:** etiqueta, desempate por faixa em `sellers.js:40`, saque na hora + mínimo menor (quando definidos), painel completo.
5. **Cotas:** `uso_profissional` + avisos, já prontos para quando a discadora e os lembretes existirem.
6. Recursos que ainda não existem (discadora, lembretes, treinador, scripts IA, cursos de nicho pagos, certificações pagas, mentoria, Top Talent, carta) ficam para fases próprias. Cada um só lê `pode()`/`limite()`.

Arquivos que o passo 3 vai tocar: `shared/planosProfissional.js` (novo), `server/db.js` (só `CREATE TABLE IF NOT EXISTS`), `server/routes/payments.js` (desvio no webhook), uma rota nova do profissional, `server/routes/sellers.js:40`, `shared/saque.js` e `server/routes/payments.js:127-135` (mínimo por plano), telas em `src/components/vendedor/`. **Não toca** `shared/planos.js`, `shared/assinatura.js`, `subscriptions` nem nada da empresa.

---

## 7. Validação externa antes de produção

- **Advogado:** cobrar do profissional por vantagens num marketplace de trabalho; termos de uso da assinatura; direito de arrependimento e reembolso; aviso de reajuste na renovação; texto de "destaque" sem prometer resultado; consentimento para lembretes por WhatsApp.
- **Contador:** emissão de nota da assinatura, tributação, e como registrar plano concedido de graça.

---

## 8. Pendências que dependem do usuário

Números (não inventados neste documento):
1. Minutos da discadora por mês no Pro e no Premium.
2. Limite de lembretes por WhatsApp por mês no Pro e no Premium (e o que é "básico" × "completo").
3. Valor do bônus por indicado que vira assinante (Pro e Premium).
4. Saque mínimo do Pro/Premium (hoje R$ 10 para todos).
5. Desconto do Pro na Trilha Challenger.
6. Quantas tentativas da Certificação Avançada o Premium inclui.
7. Tolerância do desempate ("Scores parecidos" = faixa de quantos pontos).
8. Dias de carência na renovação atrasada.
9. Preços em dólar e rúpia de Pro e Premium (o PDF só tem o Pro antigo).

Regras:
10. Regra de renovação: Pix por QR todo ano, ou Pix Automático anual.
11. Upgrade Pro → Premium no meio do período: proporcional ou não.
12. Reembolso fora dos 7 dias de arrependimento.
13. Quem faz a revisão humana trimestral do Premium (e da conversa da Certificação Avançada).
14. Premium tem etiqueta própria ou usa a mesma "Pro"? Vagas antecipadas do Premium: também 24h ou mais?
15. Renomear o nível por Score "RYCS Pro" (`score.js:7`) e o selo "Pro" da Academy (`academy.js:13`) para não confundir com o plano pago. Sugestão: trocar só o rótulo.
16. "Etiqueta dourada" = selo `elite` atual da Academy, ou um selo novo de Certificação Avançada?
17. O que o "saque na hora" pula exatamente da conferência atual, e quais regras antifraude continuam valendo.
18. Lista de quem comprou o Pro antigo fora do app, se houver.
19. Onde está o `PROMPT-MESTRE.md` citado (não está no repositório).
