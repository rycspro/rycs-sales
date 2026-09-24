# CLAUDE.md

## Regras gerais
- Trabalhe somente no escopo solicitado.
- Não analise o projeto inteiro sem necessidade.
- Não refatore áreas fora do escopo.
- Preserve a arquitetura atual.
- Reutilize componentes, funções e padrões existentes.
- Não crie soluções paralelas se já existir estrutura funcionando.
- Não altere regras de negócio fora do pedido.
- Não apague dados existentes.
- Não faça mudanças destrutivas sem confirmação.

## Economia de tokens e contexto
- Seja econômico no uso de contexto.
- Abra somente os arquivos necessários.
- Evite varrer o repositório inteiro.
- Não gere explicações longas durante a execução.
- Priorize execução.
- Implemente o lote inteiro antes de validar.

## Fluxo de trabalho
Ao receber um lote de tarefas:
1. Entenda o objetivo.
2. Localize somente os arquivos relacionados.
3. Implemente todas as tarefas do lote.
4. Valide apenas o que foi alterado.
5. Rode testes necessários uma única vez.
6. Rode build uma única vez.
7. Corrija somente erros relacionados ao lote.

## Deploy
Este projeto usa GitHub conectado à Railway.

Quando eu disser "faça o deploy":
1. Finalize todas as alterações.
2. Valide somente o que foi alterado.
3. Rode testes uma única vez.
4. Rode build uma única vez.
5. Faça git add.
6. Faça um único commit.
7. Faça git push para origin/main.
8. Considere o push para main como gatilho do deploy da Railway.
9. Não fique monitorando logs após push bem-sucedido.
10. Só consulte logs se houver erro real.

## Git
- Use a branch main para produção.
- Não faça commits desnecessários.
- Faça um commit por lote concluído.
- Não faça push repetido sem necessidade.
- Nunca exponha tokens, secrets ou chaves.

## Banco e produção
- Considere que existem usuários e dados reais.
- Preserve dados existentes.
- Não recrie tabelas sem necessidade.
- Use migrações seguras quando necessário.
- Evite alterações destrutivas.

## Frontend
- Preserve a identidade visual existente.
- Preserve responsividade.
- Reutilize componentes existentes.
- Não redesenhe telas fora do escopo.

## Backend
- Preserve autenticação, permissões, APIs e integrações existentes.
- Não duplique lógica.
- Reutilize serviços existentes.

## Comunicação
Ao finalizar uma tarefa, responda de forma curta com:
- o que foi concluído;
- se testes passaram;
- se build passou;
- se commit/push foram feitos;
- se o deploy foi disparado;
- qualquer problema real que ainda precise de decisão humana.
