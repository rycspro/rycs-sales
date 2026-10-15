Vamos implementar o fluxo de cadastro (onboarding) da empresa na RYCS, em 6 etapas.

Leia, nesta ordem:
1. `docs/onboarding/SPEC.md` (a especificação completa)
2. `docs/onboarding/design/tokens.css` e `tokens.json` (identidade visual)
3. `docs/onboarding/design/reference/*.dc.html` (telas desenhadas, como referência de layout, textos, campos e estados)

Antes de escrever qualquer código, entre em modo de planejamento:
- Explore o projeto: framework, rotas, autenticação, banco de dados, storage de arquivos, componentes de UI, estilos e convenções.
- Aponte o que já existe e deve ser reaproveitado (login, recuperação de senha, upload, pagamento, criação de campanha).
- Aponte conflitos entre a especificação e a arquitetura atual.
- Liste as perguntas que dependem de mim (planos e preços, limites de arquivo, gateway de pagamento, provedor de e-mail).
- Apresente um plano com os arquivos que vai criar ou alterar, seguindo a ordem da seção 10 do SPEC.

Só comece a implementar depois que eu aprovar o plano. Depois:
- Implemente um passo da seção 10 por vez.
- Ao final de cada passo: rode os testes e o lint, resuma o que foi feito e faça o commit.
- Não invente nomes, preços ou recursos de planos. Deixe configurável.
- Nunca guarde número de cartão ou CVV no nosso banco.
