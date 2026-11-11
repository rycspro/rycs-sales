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

## Deploy e publicação

Produção roda na **AWS (EC2)**, servindo `app.rycs.pro`. A Railway foi substituída.

**O deploy é automático.** Há um GitHub Actions (`.github/workflows/deploy.yml`) que, a cada **push na branch `main`**, conecta por SSH ao servidor EC2, faz `git pull`, reconstrói a imagem Docker e reinicia o container (com health check em `/api/health`). Existe também `monitor.yml`, que checa `app.rycs.pro` periodicamente.

Regras:

1. **Push na `main` publica em produção.** Trate a `main` como produção: só suba código já validado (build/testes do que mudou).
2. Em outras branches o deploy **não** dispara — use branch para trabalho em andamento e deixe a `main` só para o que vai ao ar.
3. O assistente **não** mexe em infraestrutura nem no servidor (EC2, Docker, Caddy, SSH): o deploy acontece sozinho pelo Actions quando a `main` recebe push. Não rode comandos de deploy à mão nem instale CLIs de nuvem.
4. As credenciais de acesso ao servidor ficam em **GitHub Secrets** (`EC2_SSH_KEY`) — nunca no repositório.
5. O banco de produção persiste em `/data` no servidor; migrações aditivas (colunas novas via `adicionarColuna`) rodam sozinhas quando o servidor inicia. Evite mudanças destrutivas de schema.

Nunca armazenar token, senha ou secret (AWS, GitHub ou qualquer outro) no CLAUDE.md.

## Git

Git é usado para versionamento e histórico de commits.

- A branch `main` é produção: **push na `main` dispara o deploy automático na AWS** (ver "Deploy e publicação"). Para trabalho em andamento, use uma branch.
- Não faça commits desnecessários.
- Faça um commit por lote concluído.
- Não faça push repetido sem necessidade.
- Nunca exponha tokens, secrets ou chaves.
- Só commite/pushe quando o usuário pedir; antes de push na `main`, garanta que o build do que mudou está ok.

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

2. Se encontrar erro de Git, remote, branch, commit, push, build ou configuração local segura, tente corrigir automaticamente usando as ferramentas e credenciais já disponíveis no ambiente. (Deploy não entra aqui — ver "Deploy e publicação".)

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

6. Deploy **não** é feito à mão. É automático: push na `main` dispara o GitHub Actions que publica na AWS (ver "Deploy e publicação"). O assistente não mexe no servidor/EC2 — entrega o código no GitHub e o Actions cuida do resto.

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

13. Ao finalizar, informe de forma curta: tarefa concluída · build · commit · push (push na `main` dispara o deploy automático na AWS).

## Entrega de um lote (versionamento)

Repositório: https://github.com/rycspro/rycs-sales.git · Branch de produção: `main`.

Lembrete: **push na `main` publica em produção** (deploy automático na AWS — ver "Deploy e publicação"). Para trabalho em andamento use uma branch. Só commite/pushe quando o usuário pedir.

Quando o usuário pedir para versionar um lote concluído:

1. Finalize as alterações do lote.
2. Valide apenas o que mudou (parse/build do que foi tocado).
3. Rode os testes necessários uma única vez, quando aplicável.
4. Corrija erros causados pelas alterações antes de continuar.
5. `git add` apenas dos arquivos do lote.
6. Um único commit descrevendo o lote.
7. Confirme o remote: `git remote -v` deve ser `https://github.com/rycspro/rycs-sales.git` (corrija com `git remote set-url origin …` se preciso).
8. Dê push — numa branch para trabalho em andamento; na `main` apenas quando o usuário quiser publicar (push na `main` = deploy automático na AWS).
9. Encerre informando o que foi feito. Se foi push na `main`, lembre que o deploy automático foi disparado; não mexa no servidor à mão.

### Se o push pedir autenticação do GitHub

- Tente a autenticação já configurada; pode usar o GitHub CLI (`gh auth login`) se disponível.
- Peça intervenção humana só se exigir autorização pelo navegador.

### Não versione automaticamente se

- o usuário disser "não faça deploy", "somente analise" ou "não altere nada";
- a alteração for destrutiva ou houver risco de perda de dados (confirme antes);
- testes ou build estiverem falhando.

Nunca armazenar tokens, senhas, chaves de API ou secrets no CLAUDE.md.

## Comunicação
Ao finalizar uma tarefa, responda de forma curta com:
- o que foi concluído;
- se testes passaram;
- se build passou;
- se commit/push foram feitos (push na `main` dispara o deploy automático na AWS);
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
