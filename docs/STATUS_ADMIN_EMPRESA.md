# Status — Admin da Empresa

Atualizado em 2026-09-11. Produção: https://app.rycs.pro.

Este documento é a fonte de continuidade: se o contexto for compactado ou o
trabalho migrar de ferramenta, comece por ele em vez de reinvestigar o projeto.

## Como ler o status

- **CONCLUÍDO E PUBLICADO** — implementado, testado, acessível na interface e no ar.
- **PARCIAL** — funciona, mas parte do requisito não foi entregue. A coluna Pendência diz o quê.
- **BLOQUEADO** — depende de credencial, serviço externo ou decisão fora do código.

Um requisito não é CONCLUÍDO quando existe só backend, só tela, botão sem ação
ou dado fixo apresentado como real.

## Matriz

| # | Requisito | Status | Arquivos | Teste | Validação visual | Pendência |
|---|---|---|---|---|---|---|
| 1 | Design system global | CONCLUÍDO E PUBLICADO | `src/styles.js`, `src/components/ui.jsx` | build | desktop 1280 e mobile 800 sem overflow | — |
| 2 | Botão global "Inteligência Artificial" | PARCIAL | `EmpresaAI.jsx`, `knowledge.js` | RAG (3) | botão presente em todas as telas | Registra e confirma a análise; não executa mutação operacional |
| 3 | Núcleo RAG compartilhado | PARCIAL | `services/rag.js`, `routes/knowledge.js` | 3 testes RAG | fontes e versão na resposta | Busca lexical local; sem embeddings |
| 4 | Dashboard do proprietário | CONCLUÍDO E PUBLICADO | `PainelEmpresa.jsx`, `shared/analytics.js` | cálculo de ROI e retorno | 4 roscas, 8 indicadores, 4 filtros | — |
| 5 | ROI projetado | CONCLUÍDO E PUBLICADO | `shared/analytics.js` | 3 cenários determinísticos | premissas ausentes listadas, sem número inventado | — |
| 6 | Nova experiência de Campanhas | PARCIAL | `CampanhasEmpresa.jsx`, `routes/campaigns.js` | publicação e bloqueio por caixa | 10 etapas com progresso | IA não injeta automaticamente todos os campos |
| 7 | Upload e importação de leads | CONCLUÍDO E PUBLICADO | `src/lib/importers.js`, `LeadsEmpresa.jsx`, `/leads/import` | parser CSV com aspas | relatório com válidos, duplicados e erro por linha | XLSX depende de `DecompressionStream` |
| 8 | Profissionais Ativos | CONCLUÍDO E PUBLICADO | `ProfissionaisEmpresa.jsx`, `routes/sellers.js` | escopo por sessão | cards, filtros, perfil, parceria | — |
| 9 | Time da empresa | CONCLUÍDO E PUBLICADO | `TimeEmpresa.jsx`, `Chat.jsx` | — | dossiê, Academy, mensagem | — |
| 10 | Diagnóstico operacional | PARCIAL | `EmpresaAI.jsx` | — | fluxo por texto e ditado | Questionário guiado dedicado não construído |
| 11 | Tipos de tarefa | CONCLUÍDO E PUBLICADO | `shared/acoes.js`, `TabelaEmpresa.jsx` | reunião agendada (2) | cinco tipos em campanha e tabela | — |
| 12 | Sugestão de valores | PARCIAL | `shared/valorTarefa.js`, `TabelaEmpresa.jsx` | taxa 12%: R$ 10,00 → R$ 8,80 | bruto, taxa e líquido antes de confirmar | Faixa, fatores, amostra e impacto no ROI não exibidos |
| 13 | RYCS Academy (dois ambientes) | CONCLUÍDO E PUBLICADO | `RycsAcademyEmpresa.jsx`, `QualificacaoEmpresa.jsx` | Academy (2) | trilhas, prova, certificado | Catálogo sem curso pago configurado |
| 14 | Gamificação | PARCIAL | `shared/academy.js` | Academy | progresso, níveis, certificação | Sem conquistas além dos níveis atuais |
| 15 | Treinamento da empresa com IA | PARCIAL | `/assistant/training-draft` | — | rascunho revisável | Áudio e vídeo exigem transcrição revisada |
| 16 | Questionário automático | CONCLUÍDO E PUBLICADO | `routes/academy.js` | Academy | 5–10 questões com fonte e gabarito | — |
| 17 | Aprovações (renomear + regras) | CONCLUÍDO E PUBLICADO | `shared/aprovacoes.js`, `RegrasAprovacao.jsx`, `TrilhaAuditoria.jsx`, `routes/submissions.js` | **8 testes de regra** | aba de regras, trilha encadeada por ação | — |
| 18 | Leitura do cartão CNPJ | BLOQUEADO | `routes/companies.js`, `CadastroEmpresa.jsx` | — | upload, prévia e confirmação | Extração de imagem exige `ANTHROPIC_API_KEY`; PDF escaneado exige OCR |
| 19 | Base de Conhecimento | PARCIAL | `routes/knowledge.js`, `EmpresaAI.jsx` | RAG | texto, TXT, MD, PDF, versão, permissão | Link e áudio entram como transcrição manual |
| 20 | Financeiro | CONCLUÍDO E PUBLICADO | `FinanceiroEmpresa.jsx`, `/company/finance`, `/company/finance/export` | razão conferido no fluxo real | extrato com tarefa, campanha e profissional; CSV | — |
| 21 | Relatórios | PARCIAL | `routes/reports.js`, `services/reportPdf.js` | PDF com logo | geração, importação e download | PDF escaneado sem OCR; filtros avançados incompletos |
| 22 | Três planos | CONCLUÍDO E PUBLICADO | `shared/planos.js`, `PlanosEmpresa.jsx` | preço e taxa | Growth R$ 999,90 marcado como recomendado | — |
| 23 | Voucher | CONCLUÍDO E PUBLICADO | `services/vouchers.js` | cálculo de desconto | aplicado no checkout | Criação administrativa via API protegida |
| 24 | Checkout e Pix Asaas | BLOQUEADO | `routes/subscriptions.js`, `routes/payments.js` | idempotência do webhook | modal, voucher, QR | Sandbox Asaas não exercitado; nenhuma cobrança executada |
| 25 | Indicações somente de empresas | CONCLUÍDO E PUBLICADO | `shared/indicacoes.js`, `services/indicacoes.js` | fluxo do webhook | histórico preservado | — |
| 26 | Notificações e suporte | CONCLUÍDO E PUBLICADO | `NotificacoesEmpresa.jsx`, `routes/leads.js`, `routes/reports.js` | — | central com filtros, marcar lidas | — |

## O que mudou nesta rodada

1. **Financeiro (req 20).** `GET /company/finance` existia e nenhuma tela o
   consumia — "Financeiro" renderizava o Dashboard de novo. Agora há tela
   própria: posição de caixa, consolidado do período, rosca de repasse versus
   taxa, extrato ligado a tarefa/campanha/profissional, filtros e export CSV.
   O endpoint passou a enriquecer cada linha do razão e ganhou `/export`.

2. **Notificações (req 26).** Era um card estático dizendo "veja no sino".
   Agora consome `/notifications`, com filtros por tipo, marcar como lida
   individual e em massa. Foram adicionados os eventos que faltavam:
   importação de leads (empresa e profissional) e relatório pronto/importado.

3. **Aprovação automática (req 17).** Não existia. Regras por empresa
   (`shared/aprovacoes.js`): ações elegíveis, confiança mínima, teto por ação
   e amostragem manual. Venda nunca entra, em duas camadas independentes.

4. **Trilha de auditoria ligada.** `services/auditTrail.js` implementava uma
   cadeia de eventos com hash encadeado e **nenhuma rota o chamava**. Agora
   envio, evidências, triagem, decisão automática, decisão manual, contestação
   e liberação viram eventos verificáveis, expostos em `/submissions/:id/trilha`
   e visíveis na tela de Aprovações.

## Decisões de projeto que valem registro

- **A aprovação automática não move dinheiro.** Ela leva a ação de "revisão
  manual" para "conferida" — o mesmo estado de quem foi conferido à mão. O
  repasse continua exclusivo da plataforma.
- **A regra age sobre risco e confiança, não sobre veredito.** A triagem
  interna nunca emite "aprovado": ela classifica risco e devolve para
  conferência. Uma primeira versão da regra exigia veredito "aprovado" e por
  isso nunca teria disparado — funcionalidade morta. Corrigido antes do commit.
- **A trilha guarda o hash da evidência, não o conteúdo.** Telefone e documento
  têm espaço de busca pequeno; o HMAC impede tentativa de reversão offline.
- **`platform_earnings` nunca é apagado** nas exclusões de empresa e de
  profissional: é o livro de receita da plataforma, não dado do excluído.

## Validação

- `npm test`: 28/28 aprovados (20 anteriores + 8 novos de regras de aprovação).
- `npm run build`: aprovado.
- Fluxo financeiro exercitado ponta a ponta no servidor local: envio → reserva
  → conferência → liberação → razão. Bruto R$ 12,00, taxa R$ 1,44, líquido
  R$ 10,56 — coerente com a taxa de 12% do plano.
- Aprovação automática exercitada: ação elegível saiu direto como "conferida",
  com a regra registrada na trilha; a empresa recebeu 403 ao tentar liberar.
- Trilha verificada: `{ integra: true, eventos: 3 }` em envio → decisão
  automática → liberação.

## Ambiente

- Banco: SQLite em volume persistente (`DB_PATH=/data/data.db`). Colunas novas
  são aditivas via `adicionarColuna`; esta rodada acrescentou
  `companies.regrasAprovacao`.
- Variáveis usadas: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENV`,
  `DB_PATH`, `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SECURITY_KEY`.
- Variáveis ausentes que travam requisitos: `ANTHROPIC_API_KEY` (req 18),
  credenciais de sandbox Asaas (req 24), `RESEND_API_KEY` (e-mail).
- Não existe staging dedicado; o preview local é a pré-produção visual.
- Nenhuma cobrança real foi executada.
