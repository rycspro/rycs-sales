# Decisões do onboarding (valem sobre o SPEC)

Tomadas com o dono do produto em 2026-10-15, antes do passo 1. Quando o SPEC e esta lista discordam, vale esta lista.

| Tema | Decisão |
|---|---|
| Visual | Design system atual da plataforma (`src/styles.js`: `--brand`, Inter, Space Grotesk). Os tokens de `design/tokens.css` não são usados. |
| Etapa 1 | Pede só e-mail, senha (mínimo de 8) e WhatsApp, que é obrigatório. Nome, produto, ticket e público vão para a etapa 2. |
| Trial | 3 dias, só para quem entra por um link de convite **com trial**. Cadastro pelo site e link sem trial começam sem trial. Os textos de "7 dias" do pacote viram 3 dias, ou somem quando não há trial. |
| Links de convite | Gerados no admin ("Links de onboarding"), um por empresa: preso ao e-mail, uso único, com ou sem trial, validade escolhida por quem gera (padrão de 7 dias, máximo de 90). O token é guardado só como hash. |
| Empresas existentes | Todas passam pelo onboarding, com os dados que já têm preenchidos. Sem WhatsApp, começam pela etapa 1. Quem já paga também passa pela etapa 5, revisando plano e cartão sem nova cobrança se mantiver o mesmo plano. Quem já tem campanha também cria uma nova na etapa 6. |
| Etapa 4 (IA) | Usa o que a empresa preencheu e as estratégias de vendas do Academy da RYCS. Sem embeddings nem provedor novo. |
| Etapa 5 | Planos e preços de `shared/planos.js`. Cartão sempre tokenizado pelo Asaas, sem guardar número nem CVV. |
| Etapa 6 sem saldo | "Publicar campanha" pede o depósito (Pix) ali mesmo. O onboarding só termina depois do depósito. |
| Storage | Bucket da Railway (compatível com S3). Limites: documentos e apresentações 50 MB, fotos 20 MB, vídeos 500 MB, áudios 100 MB. |
| Publicação | Mudou em 2026-10-15, depois do passo 1: cada passo é publicado ao terminar, com o onboarding ligado para todas as empresas, mesmo travando as atuais nas etapas ainda em construção (decisão do dono do produto). |
