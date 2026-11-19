# Rastreamento da RYCS na Meta (campanhas de cadastro)

Pixel: **RYCS Plataforma** (`1690802939434598`), no Business "Rycs Sales Machine", ligado à conta de anúncios "RYCS SALES MACHINE". O ID fica em `shared/metaPixel.js`.

## Como funciona

| Camada | Onde | O quê |
| --- | --- | --- |
| Aviso de cookies (LGPD) | landing e app | Sem "Aceitar", nada vai para a Meta. A escolha fica no cookie `rycs_consentimento` em `.rycs.pro` e vale nos dois domínios. Na landing, "Preferências de cookies" no rodapé reabre o aviso. |
| Pixel (navegador) | `landing/index.html`, `src/lib/rastreio.js` | PageView, ViewContent (abriu o cadastro), EtapaCadastro (passou de etapa) e CompleteRegistration (conta criada). Todo evento leva o ID do visitante da RYCS (`external_id`, em SHA-256); no cadastro entram também e-mail, telefone, nome, cidade, UF, país, nascimento e gênero. |
| API de Conversões (servidor) | `server/services/metaConversoes.js` | ViewContent e EtapaCadastro (uma vez por visitante e etapa) e CompleteRegistration, com o mesmo `event_id` do pixel (a Meta junta os dois), e dados de correspondência em SHA-256: e-mail, telefone, nome, cidade, UF, país, nascimento, gênero, ID do visitante e da conta, IP, navegador, `fbp` e `fbc`. |
| Eventos de qualidade (servidor) | mesma rotina, a cada 10 min | Profissional: EmailConfirmado, PerfilCompleto, SubmitApplication (candidatura), AprovadoEmCampanha. Empresa: EmailConfirmado, PlanoEscolhido, CampanhaPublicada, Purchase (1º depósito confirmado, com o valor real). |

`content_category` diferencia `profissional` de `empresa` em todos os eventos.

**Correspondência avançada.** O ID do visitante (`rycs_vid`, o mesmo da landing ao app) vai como `external_id` em todos os eventos, do pixel e do servidor; depois do cadastro, o servidor manda também o ID da conta. É isso que liga, na Meta, o clique no anúncio, a landing, cada etapa do cadastro, a conta criada e os marcos depois dela. A correspondência avançada automática do pixel também está ligada no Gerenciador de Eventos (desde 2026-11-19). A normalização (e-mail, telefone com DDI, nome sem acento…) fica em `shared/metaPixel.js`, igual para o navegador e o servidor. Os dados de correspondência ficam guardados por 30 dias e depois são apagados.

## Ativar a API de Conversões

1. Gerenciador de Eventos → RYCS Plataforma → Configurações → API de Conversões → **Gerar token de acesso**.
2. Salve como secret do GitHub (nunca no código ou no chat): repositório rycs-sales → Settings → Secrets and variables → Actions → New repository secret → `META_CAPI_TOKEN`.
3. O próximo deploy da `main` grava o token no servidor e a rotina liga sozinha (`[meta-capi] API de Conversões ativa` no log).

Para testar fora da produção, `META_TEST_EVENT_CODE` (código da aba "Eventos de teste") manda os eventos só para essa aba. Não use em produção: eventos de teste não contam para os anúncios.

## No admin: aba Campanhas

Admin → **Campanhas** mostra o histórico de cada campanha, separado em **campanhas de profissionais** e **campanhas de empresas**:

- campanha → conjunto → anúncio (clique para abrir), com visitas, quem abriu o cadastro, contas criadas e taxa visita → conta;
- o que as contas fizeram depois (profissional: e-mail, perfil, candidatura, aprovação; empresa: e-mail, plano, campanha publicada, depósito com valor por moeda);
- país das contas (Índia x Brasil, empresas do mundo todo);
- histórico por dia (visitas, contas e gasto) de todas as campanhas ou da campanha aberta;
- saúde do rastreamento: pixel, API de Conversões, eventos enviados à Meta (com erros, se houver) e a nota de qualidade da correspondência que a Meta dá a cada evento (0 a 10). A nota usa o `META_ADS_TOKEN`: o usuário do sistema precisa ter o pixel **RYCS Plataforma** atribuído (Configurações do negócio → Usuários do sistema → Atribuir ativos → Conjuntos de dados/Pixels).

O tipo de cada campanha sai dos dados (qual cadastro as pessoas abriram e criaram). Enquanto não há dados, vale o nome: use "PROF" ou "EMP" no nome da campanha.

### Leads dos formulários instantâneos, gasto e custo (token META_ADS_TOKEN)

Campanhas de **formulário instantâneo** (objetivo Leads, destino "no anúncio") não passam pelo site: o pixel não vê esses leads. A RYCS busca os leads na Meta a cada 10 minutos (ou no botão "Buscar leads agora") e mostra por campanha, conjunto e anúncio, quantos já criaram conta (mesmo e-mail ou telefone) e a lista para exportar em CSV. O mesmo token traz gasto, cliques, custo por lead e custo por conta.

1. Configurações do negócio (Rycs Sales Machine) → Usuários → **Usuários do sistema** → adicionar (função Admin).
2. **Atribuir ativos**:
   - Contas de anúncios → RYCS SALES MACHINE → ver desempenho;
   - Páginas → **Rycs Sales Machine** → incluir acesso a **leads**.
3. **Gerar token** no app da RYCS com as permissões `ads_read`, `leads_retrieval`, `pages_show_list`, `pages_read_engagement` e `pages_manage_ads`.
4. GitHub → Settings → Secrets and variables → Actions → secret **`META_ADS_TOKEN`** → rodar o deploy.

Sem esse token a aba funciona só com os dados do site (visitas e contas). A Meta guarda os leads por 90 dias: a primeira busca traz todos desse período.

## Nos anúncios

Parâmetros de URL de todo anúncio (o painel de jornada da RYCS lê a origem por eles):

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}
```

Links de destino (o `?lang=` abre o cadastro já no idioma da campanha):

| Campanha | Link |
| --- | --- |
| Profissionais Índia | `https://app.rycs.pro/cadastro/profissional?lang=en` (ou `lang=hi`) |
| Profissionais Brasil | `https://app.rycs.pro/cadastro/profissional` |
| Empresas mundo | `https://app.rycs.pro/cadastro/empresa?lang=en` (Brasil sem `lang`) |

Conversões personalizadas a criar no Gerenciador de Eventos, para otimizar cada público separado:

- **Cadastro Profissional**: CompleteRegistration com `content_category` = `profissional`
- **Cadastro Empresa**: CompleteRegistration com `content_category` = `empresa`
- Depois de ~50 por semana, trocar a otimização para um evento de qualidade (ex.: PerfilCompleto ou SubmitApplication).
