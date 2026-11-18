# Rastreamento da RYCS na Meta (campanhas de cadastro)

Pixel: **RYCS Plataforma** (`1690802939434598`), no Business "Rycs Sales Machine", ligado à conta de anúncios "RYCS SALES MACHINE". O ID fica em `shared/metaPixel.js`.

## Como funciona

| Camada | Onde | O quê |
| --- | --- | --- |
| Aviso de cookies (LGPD) | landing e app | Sem "Aceitar", nada vai para a Meta. A escolha fica no cookie `rycs_consentimento` em `.rycs.pro` e vale nos dois domínios. Na landing, "Preferências de cookies" no rodapé reabre o aviso. |
| Pixel (navegador) | `landing/index.html`, `src/lib/rastreio.js` | PageView, ViewContent (abriu o cadastro), EtapaCadastro (passou de etapa) e CompleteRegistration (conta criada). |
| API de Conversões (servidor) | `server/services/metaConversoes.js` | O mesmo CompleteRegistration, com o mesmo `event_id` (a Meta junta os dois), e dados de correspondência em SHA-256: e-mail, telefone, nome, cidade, UF, país, nascimento, gênero, IP, navegador, `fbp` e `fbc`. |
| Eventos de qualidade (servidor) | mesma rotina, a cada 10 min | Profissional: EmailConfirmado, PerfilCompleto, SubmitApplication (candidatura), AprovadoEmCampanha. Empresa: EmailConfirmado, PlanoEscolhido, CampanhaPublicada, Purchase (1º depósito confirmado, com o valor real). |

`content_category` diferencia `profissional` de `empresa` em todos os eventos. Os dados de correspondência ficam guardados por 30 dias e depois são apagados.

## Ativar a API de Conversões

1. Gerenciador de Eventos → RYCS Plataforma → Configurações → API de Conversões → **Gerar token de acesso**.
2. Salve como secret do GitHub (o valor é colado no terminal, nunca no código ou no chat):
   ```bash
   gh secret set META_CAPI_TOKEN --repo rycspro/rycs-sales
   ```
3. O próximo deploy da `main` grava o token no servidor e a rotina liga sozinha (`[meta-capi] API de Conversões ativa` no log).

Para testar fora da produção, `META_TEST_EVENT_CODE` (código da aba "Eventos de teste") manda os eventos só para essa aba. Não use em produção: eventos de teste não contam para os anúncios.

## Nos anúncios

Parâmetros de URL de todo anúncio (o painel de jornada da RYCS lê a origem por eles):

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}
```

Conversões personalizadas a criar no Gerenciador de Eventos, para otimizar cada público separado:

- **Cadastro Profissional**: CompleteRegistration com `content_category` = `profissional`
- **Cadastro Empresa**: CompleteRegistration com `content_category` = `empresa`
- Depois de ~50 por semana, trocar a otimização para um evento de qualidade (ex.: PerfilCompleto ou SubmitApplication).
