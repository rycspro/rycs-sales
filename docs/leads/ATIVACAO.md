# Ativação: WhatsApp, Instagram, ERP, pedidos e grupo de suporte

O código já está pronto. Cada integração só aparece para o cliente quando a
variável dela existe no servidor; até lá a tela diz "em ativação". Segredos vão
em GitHub → Settings → Secrets → Actions, nunca no repositório.

| Recurso | Segredos no GitHub | Onde conseguir |
|---|---|---|
| WhatsApp da empresa e do vendedor | `WHATSAPP_SIGNUP_CONFIG_ID` | App RYCS na Meta |
| Instagram | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | App RYCS na Meta, produto Instagram |
| Bling | `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` | developer.bling.com.br |
| Tiny, Omie, outro ERP | nenhum | funcionam já |
| Pedidos e auditoria (motor interno) | nenhum | funcionam já |
| Auditoria e leitura de pedido pela Claude | `ANTHROPIC_API_KEY` no servidor | opcional |

## WhatsApp (Meta)

Usa o Cadastro Incorporado com coexistência: o cliente lê um QR code no
aplicativo **WhatsApp Business** e continua usando o celular. WhatsApp pessoal
não é aceito pela Meta.

1. App RYCS (2059962201426463): publicar (hoje está em modo de desenvolvimento).
2. Virar **Tech Provider** e pedir na Análise do App o acesso avançado de
   `whatsapp_business_messaging` e `whatsapp_business_management` (dois vídeos:
   mensagem enviada e recebida; criação de modelo).
3. Login do Facebook para Empresas → Configurações → criar a configuração
   "WhatsApp Embedded Signup". O número dela é o `WHATSAPP_SIGNUP_CONFIG_ID`.
4. Login do Facebook para Empresas → Configurações: ligar Client OAuth, Web
   OAuth, HTTPS obrigatório e "Login com o SDK do JavaScript"; domínio permitido
   `https://app.rycs.pro`.
5. WhatsApp → Configuração → campos do webhook: `messages`,
   `smb_message_echoes`, `history`, `smb_app_state_sync`, `account_update`,
   `group_lifecycle_update`.

## Instagram (Meta)

1. App RYCS → adicionar o produto Instagram → "API com login do Instagram".
   Copiar o ID e o segredo **do Instagram** (são diferentes dos do app).
2. URI de redirecionamento: `https://app.rycs.pro/api/instagram/callback`.
3. Webhook do produto: `https://app.rycs.pro/api/webhooks/meta`, mesmo token de
   verificação do app, campos `messages`, `messaging_postbacks`, `comments`,
   `mentions`.
4. Análise do App: acesso avançado de `instagram_business_basic`,
   `instagram_business_manage_messages` e `instagram_business_manage_comments`.

## Bling

Criar o aplicativo em developer.bling.com.br com o link de redirecionamento
`https://app.rycs.pro/api/erp/bling/callback` e os escopos de produtos, contatos
(leitura e escrita) e pedidos de venda (escrita).

## Grupo de suporte depois do pagamento

- Criar grupo pela API é exclusivo de **conta oficial verificada** (Official
  Business Account). Quando o número da RYCS for, cada empresa ganha um grupo
  próprio sozinha.
- Até lá: admin → WhatsApp → Grupos de suporte. Um link padrão para todas, ou o
  link de cada empresa. O convite sai sozinho.
- Modelo `rycs_grupo_suporte` (Utilidade, pt_BR): texto em
  `shared/grupoSuporte.js`. Precisa ser criado e aprovado na Meta. Antes disso o
  WhatsApp só vai para quem escreveu nas últimas 24h; os outros recebem no
  sistema e por e-mail.

## Regras que o código garante

- Mensagem de cliente de empresa nunca entra na caixa da RYCS
  (`separarAviso`, em `server/services/canaisWhatsapp.js`).
- Número do vendedor: só guarda conversa com lead da empresa em que ele está
  aprovado. Nada do histórico pessoal é pedido à Meta.
- Auditoria só aponta. Item sem mensagem que o sustente é descartado.
- Preço do pedido vem do catálogo, nunca da IA. Nada vai ao ERP sem aprovação, e
  cada pedido vai uma vez; envio interrompido fica em "Conferir no ERP".
- Token e credenciais ficam cifrados no banco.
- Fora de 24h da última mensagem do cliente, a resposta é pelo celular (regra da
  Meta) e aparece na RYCS.

## Ainda não verificado com conta real

As chamadas foram testadas com respostas simuladas. No primeiro uso real,
conferir: conexão e histórico do WhatsApp, login e webhook do Instagram, login do
Bling, e um pedido de teste em cada ERP.
