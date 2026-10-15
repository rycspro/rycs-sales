# Decisões do onboarding (valem sobre o SPEC)

Tomadas com o dono do produto em 2026-10-15, antes do passo 1. Quando o SPEC e esta lista discordam, vale esta lista.

| Tema | Decisão |
|---|---|
| Visual | Design system atual da plataforma (`src/styles.js`: `--brand`, Inter, Space Grotesk). Os tokens de `design/tokens.css` não são usados. |
| Etapa 1 | Pede nome e logo da empresa, e-mail, senha (mínimo de 8) e WhatsApp, todos obrigatórios (nome e logo entraram na etapa 1 em 2026-10-15, a pedido do dono). Produto, ticket e público vão para a etapa 2, que mostra nome e logo já preenchidos para revisão. |
| Trial | 3 dias, só para quem entra por um link de convite **com trial**. Cadastro pelo site e link sem trial começam sem trial. Os textos de "7 dias" do pacote viram 3 dias, ou somem quando não há trial. |
| Links de convite | Gerados no admin ("Links de onboarding"), um por empresa: preso ao e-mail, uso único, com ou sem trial, validade escolhida por quem gera (padrão de 7 dias, máximo de 90). O token é guardado só como hash. |
| Empresas existentes | Todas passam pelo onboarding, com os dados que já têm preenchidos. Sem WhatsApp, começam pela etapa 1. Quem já paga também passa pela etapa 5, revisando plano e cartão sem nova cobrança se mantiver o mesmo plano. Quem já tem campanha também cria uma nova na etapa 6. |
| Etapa 4 (IA) | Usa o que a empresa preencheu, tudo o que ela enviou na etapa 3 (apresentações, documentos, fotos, vídeos e áudios) e as estratégias de vendas do Academy da RYCS. Sem embeddings. Único provedor além da Claude: a transcrição da fala de vídeos e áudios (OpenAI, decidido em 2026-10-15). |
| Etapa 5 | Planos e preços de `shared/planos.js`. Cartão sempre tokenizado pelo Asaas, sem guardar número nem CVV. |
| Etapa 6 sem saldo | "Publicar campanha" pede o depósito (Pix) ali mesmo. O onboarding só termina depois do depósito. |
| Storage | Bucket da Railway (compatível com S3). Limites: documentos e apresentações 50 MB, fotos 20 MB, vídeos 500 MB, áudios 100 MB. |
| Publicação | Cada passo é publicado ao terminar. Até o fluxo ficar completo, só as etapas entregues (`ETAPAS_PRONTAS` em `shared/onboarding.js`) seguram a empresa fora do painel, e as empresas que já existiam só entram no fluxo quando ele estiver completo (ou com `ONBOARDING_EMPRESAS_EXISTENTES=1`). |

## Como ficou implementado (2026-10-15)

| Tema | Implementação |
|---|---|
| Storage | `server/services/arquivos.js`. Usa `S3_*` ou as variáveis que a Railway cria ao conectar o bucket (`BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`). Bucket criado: `rycs-academy` (iad). Em produção, sem bucket conectado, o envio de arquivos aparece como indisponível e a etapa 3 segue com links e contato. |
| IA | `server/services/iaOnboarding.js`, modelo `claude-opus-5-5` (troca por `IA_ONBOARDING_MODELO`), saída validada por JSON Schema e fila em `ia_geracoes`. Sem `ANTHROPIC_API_KEY`, a etapa 4 avisa que a IA não está ativa e deixa seguir sem estratégias. Nada é inventado no lugar. |
| Leitura dos materiais | `server/services/leituraMateriais.js`. DOCX, PPTX (com notas) e XLSX: texto extraído no servidor. PDF: a Claude lê o arquivo (com imagens); se não der, vale o texto local. Fotos: descritas pela Claude (até 20). Vídeos: 8 quadros pelo ffmpeg (instalado no Dockerfile) + fala transcrita, e a Claude faz a ficha. Áudios: transcritos. PPT, DOC, XLS e KEY não são lidos e a etapa 3 pede PDF. Transcrição só com `OPENAI_API_KEY` (modelo em `TRANSCRICAO_MODELO`, padrão `whisper-1`); sem ela, vídeos entram só pelos quadros. A ficha fica guardada no material e só é refeita quando o leitor muda de versão. |
| Cartão | O checkout é o `POST /subscription` de sempre, com `onboarding: true`: só cartão, trial do convite e o documento do titular. A RYCS guarda bandeira e 4 dígitos. |
| Campanha | É criada pelo `NovaCampanha` de sempre. A etapa termina com a campanha criada e saldo no caixa. O que faltar para publicar aparece na lista e se resolve no painel. |
| Fora do escopo | O score mínimo continua por empresa (Dados da Operação) e os materiais da Academy não são escolhidos por campanha. Os dois pedem regra nova antes. |
