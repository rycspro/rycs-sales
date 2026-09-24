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

## Autonomia operacional

Objetivo: resolver sozinho problemas operacionais simples antes de solicitar intervenção humana.

1. Antes de pedir ajuda humana, tente diagnosticar o problema sozinho.

2. Se encontrar erro de Git, remote, branch, commit, push, build, deploy, Railway ou configuração local segura, tente corrigir automaticamente usando as ferramentas e credenciais já disponíveis no ambiente.

3. Antes de solicitar intervenção humana:
   - identifique a causa;
   - tente corrigir;
   - tente novamente a operação;
   - verifique se existe uma alternativa segura;
   - utilize ferramentas já autenticadas e disponíveis.

4. Não interrompa a execução apenas porque apareceu um erro operacional simples.

5. Problemas de Git devem ser tratados autonomamente sempre que possível, incluindo:
   - verificar git status;
   - verificar branch atual;
   - verificar git remote -v;
   - corrigir origin quando estiver claramente incorreto;
   - verificar upstream;
   - fazer push novamente;
   - usar credenciais já configuradas.

6. Problemas de deploy devem ser tratados autonomamente sempre que possível.

   Neste projeto:
   - GitHub: https://github.com/rycspro/rycs-sales.git
   - Branch de produção: main
   - Destino final: Railway

   Fluxo:
   commit → push origin/main → GitHub recebe → Railway inicia deploy automático → confirmar deployment saudável.

7. Se o push para main disparar o deploy corretamente, não criar outro deployment manual na Railway.

8. Se o deploy falhar:
   - identificar a causa;
   - consultar apenas os logs necessários;
   - corrigir se estiver dentro do escopo e for seguro;
   - fazer nova tentativa;
   - evitar ciclos repetitivos desnecessários.

9. Só solicitar intervenção humana quando houver uma ação que realmente não possa ser concluída autonomamente:
   - autorização de login no navegador;
   - autenticação que exija confirmação física do usuário;
   - falta real de permissão na conta;
   - decisão de negócio ambígua;
   - alteração destrutiva;
   - risco de perda de dados;
   - ação que exija um secret/token que não esteja disponível.

10. Nunca solicitar ao usuário que envie tokens, senhas ou secrets pelo chat se houver uma forma segura de autenticação.

11. Não reduzir a autonomia apenas porque o modelo está usando esforço baixo.

12. Sempre que uma tarefa puder ser concluída com segurança usando as ferramentas já disponíveis, conclua sem interromper o usuário.

13. Ao finalizar, informe de forma curta: tarefa concluída · build · commit · push · status do deploy na Railway.

## DEPLOY AUTOMÁTICO

O ambiente de produção deste projeto é a Railway.

O GitHub é o repositório de código e o push para a branch main dispara automaticamente o deploy na Railway.

Repositório:
https://github.com/rycspro/rycs-sales.git

Branch de produção:
main

### Regra permanente

Sempre que uma tarefa ou lote solicitado estiver completamente concluído, faça automaticamente o processo de publicação, sem esperar que eu peça "faça o deploy".

Fluxo obrigatório:

1. Finalizar todas as alterações do lote.
2. Validar somente o que foi alterado.
3. Rodar os testes necessários uma única vez.
4. Rodar o build uma única vez.
5. Se houver erro causado pelas alterações, corrigir antes de continuar.
6. Fazer git add somente dos arquivos necessários.
7. Fazer um único commit referente ao lote.
8. Confirmar que o remote origin está correto.
9. O origin correto é: https://github.com/rycspro/rycs-sales.git
10. Fazer push para origin/main.
11. O push para main deve disparar automaticamente o deploy na Railway.
12. Confirmar que a nova versão foi recebida/publicada pela Railway.
13. Se o deploy estiver saudável, encerrar a tarefa.
14. Não repetir build, commit, push ou deploy sem necessidade.
15. Não ficar consultando logs repetidamente.
16. Consultar logs somente se houver falha real no deployment.

### Se o Git estiver configurado incorretamente

Verificar:

git remote -v

Se necessário, corrigir com:

git remote set-url origin https://github.com/rycspro/rycs-sales.git

### Se houver erro de autenticação no GitHub

- Verificar autenticação existente.
- Tentar usar o GitHub CLI.
- Usar gh auth login se necessário.
- Solicitar intervenção humana somente se for necessária autorização pelo navegador.
- Depois continuar automaticamente o push e o deploy.

### Regra importante

Não considerar a tarefa concluída apenas porque o código foi alterado ou commitado.

Uma tarefa só é considerada totalmente concluída quando:

código implementado
→ validação concluída
→ build aprovado
→ commit realizado
→ push para main realizado
→ Railway recebeu/publicou a nova versão.

### Exceções

NÃO fazer deploy automático se:

- eu disser explicitamente "não faça deploy";
- eu disser "somente analise";
- eu disser "não altere nada";
- a alteração for destrutiva e exigir minha confirmação;
- houver risco real de perda de dados;
- testes ou build estiverem falhando.

Nunca armazenar tokens, senhas, chaves de API ou secrets no CLAUDE.md.

## Comunicação
Ao finalizar uma tarefa, responda de forma curta com:
- o que foi concluído;
- se testes passaram;
- se build passou;
- se commit/push foram feitos;
- se o deploy foi disparado;
- qualquer problema real que ainda precise de decisão humana.
