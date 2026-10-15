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

## DEPLOY AUTOMÁTICO DIRETO NA RAILWAY

O ambiente de produção deste projeto é a Railway.

O deploy deve ser feito diretamente através da Railway CLI usando o código local atual.

Fluxo padrão obrigatório:

1. Finalizar todas as alterações do lote.
2. Validar somente o que foi alterado.
3. Rodar os testes necessários uma única vez.
4. Rodar build local uma única vez, quando aplicável.
5. Se testes/build estiverem corretos, fazer o deploy diretamente na Railway.
6. Usar: railway up
7. Se o projeto já estiver corretamente vinculado ao projeto e serviço da Railway, reutilizar essa configuração.
8. Não exigir git push para realizar deploy.
9. Não bloquear o deploy por problemas de autenticação do GitHub.
10. GitHub e deploy da Railway são processos independentes neste projeto.
11. O código pode ser commitado normalmente para histórico, mas git push não é requisito para publicar.
12. Após railway up, confirmar que o deployment terminou com sucesso.
13. Não repetir deploy sem necessidade.
14. Não consultar logs repetidamente após sucesso.
15. Consultar logs somente se o deployment falhar.

### Autonomia da Railway

Antes de pedir intervenção humana:
- verificar se Railway CLI está instalada;
- verificar se já existe autenticação válida;
- verificar se o projeto está vinculado;
- verificar projeto, ambiente e serviço atuais;
- tentar resolver configurações locais seguras automaticamente.

Se o projeto ainda não estiver vinculado:
- usar railway link para vincular ao projeto correto;
- não criar um projeto Railway novo sem autorização.

Se a Railway exigir login:
- iniciar railway login;
- pedir intervenção humana somente se for necessária autorização no navegador.

### Regra de conclusão

Uma tarefa só deve ser considerada publicada quando:

código concluído → validação concluída → testes/build aprovados → railway up executado → deployment da Railway com status de sucesso.

Não considerar git push como deploy.

Nunca armazenar Railway Token, senha ou secret no CLAUDE.md.

## Git

Git é usado para versionamento e histórico de commits.

- Use a branch main para produção.
- Não faça commits desnecessários.
- Faça um commit por lote concluído.
- Não faça push repetido sem necessidade.
- Nunca exponha tokens, secrets ou chaves.
- Falha de git push não deve impedir deploy na Railway.
- Não tentar corrigir autenticação do GitHub durante um deploy Railway.
- GitHub não faz parte do fluxo obrigatório de publicação.

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
   - Deploy direto via Railway CLI: railway up
   - Destino final: Railway
   - GitHub é usado apenas para histórico — não é requisito de deploy.

   Fluxo:
   código concluído → testes/build aprovados → railway up → confirmar deployment saudável.

7. Se railway up concluir com sucesso, não criar outro deployment.

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

## Onboarding da empresa (RYCS)

- A especificação do fluxo de cadastro da empresa está em `docs/onboarding/SPEC.md`, e as decisões que valem sobre ela estão em `docs/onboarding/DECISOES.md`. Leia as duas antes de mexer em qualquer tela ou rota do onboarding.
- Identidade visual: o design system atual (`src/styles.js`). Use as variáveis de lá, nunca valores de cor soltos. Os tokens de `docs/onboarding/design/` não são usados.
- Telas de referência em `docs/onboarding/design/reference/` servem só de referência: recrie no framework do projeto.
- Interface sempre em português do Brasil.
- O progresso do onboarding é salvo no servidor e pode ser retomado. Não permitir pular etapas pela URL.
- Cartão de crédito: sempre tokenizado no gateway. Nunca guardar número de cartão ou CVV.
- Nada gerado pela IA (script, funil, follow-ups) fica ativo antes da aprovação do dono da empresa.
- Planos, preços e recursos vêm de `shared/planos.js`. Nunca fixar valores no código.
- Acessibilidade: todo campo com `label`, foco visível, alvos de toque de 44px ou mais, contraste mínimo de 4.5:1.
- Cada passo do onboarding segue o deploy automático normal ao terminar.
