# Análise do App: Instagram para todos os clientes

Pacote pronto para colar em developers.facebook.com → app RYCS
(2059962201426463). A Meta prefere textos em inglês.

## Ordem

1. Configurações do app: ícone `docs/leads/icone-app-1024.png`, privacidade
   `https://app.rycs.pro/privacidade/`, termos `https://app.rycs.pro/termos/`,
   categoria "Business and pages", e-mail comercial.
2. Produto Instagram → API com login do Instagram → configurações de login:
   - redirecionamento: `https://app.rycs.pro/api/instagram/callback`
   - desautorização: `https://app.rycs.pro/api/instagram/desautorizar`
   - exclusão de dados: `https://app.rycs.pro/api/instagram/excluir-dados`
   - webhook: `https://app.rycs.pro/api/webhooks/meta`, campos `messages`,
     `messaging_postbacks`, `comments`, `mentions`
3. Salvar `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` nos Secrets do GitHub e
   rodar o deploy (Actions → Deploy to AWS → Run workflow).
4. Conectar o Instagram da RYCS como testador. A Meta exige ao menos uma chamada
   de API com sucesso antes do pedido.
5. Verificação de acesso (Tech Provider): a empresa já é verificada; falta
   declarar que a RYCS atende outras empresas.
6. Gravar um vídeo por permissão e enviar o pedido.
7. Aprovado: publicar o app. A partir daí qualquer cliente conecta.

## instagram_business_basic

> RYCS Sales Machine is a B2B sales platform. A business connects its own
> Instagram professional account with Business Login. We use
> instagram_business_basic to read the account ID, username and profile picture,
> so the business can see which account is connected and so incoming messages and
> comments are routed to the right company. Without it we cannot identify the
> connected account.

Vídeo: entrar na RYCS → Leads → Instagram → aceitar o aviso → "Entrar com o
Instagram" → autorizar → voltar com o @ conectado na tela.

## instagram_business_manage_messages

> Businesses use RYCS as their inbox for customer conversations. We use
> instagram_business_manage_messages to receive direct messages sent by customers
> to the connected account and to let the business's team reply from RYCS within
> the messaging window. All replies are typed and sent by a person. Messages are
> visible only to that business.

Vídeo: de outra conta, mandar um direct → ele aparece em Leads → Instagram →
responder → mostrar a resposta chegando na outra conta.

## instagram_business_manage_comments

> We use instagram_business_manage_comments to show comments left on the connected
> account's posts next to its direct messages, and to let the business reply
> publicly or send one private reply, so no lead is lost. All replies are typed
> and sent by a person.

Vídeo: de outra conta, comentar numa publicação → aparece na aba Comentários →
responder no comentário → mostrar a resposta no Instagram.

## Instructions for the reviewer

> 1. Open https://app.rycs.pro and log in with the test company account below.
> 2. In the left menu open Leads → Instagram. Labels are in Portuguese:
>    "Entrar com o Instagram" = Log in with Instagram, "Directs" = Direct messages,
>    "Comentários" = Comments, "Responder no comentário" = Reply to comment,
>    "Mandar no direct" = Send private reply.
> 3. Tick the consent box and click "Entrar com o Instagram".
> 4. Send a direct message and a comment from another account. They appear in the
>    list within about 10 seconds. Open one, type a reply and press the send button.

O usuário e a senha da empresa de teste são criados por você e digitados direto no
formulário da Meta. Não guardar aqui.
