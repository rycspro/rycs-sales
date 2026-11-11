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

O ambiente de produção deste projeto roda na **AWS**. A migração a partir da Railway foi concluída — a Railway não é mais usada.

Regras:

1. **Não há deploy automático neste repositório.** Não existe GitHub Actions nem pipeline ligado ao GitHub; um `git push` **não publica nada** em produção.
2. O deploy em produção é feito pela **equipe de infraestrutura, na AWS, fora deste repositório** (build da imagem Docker e execução no servidor). O processo não vive no código e não deve ser presumido a partir daqui.
3. **Um assistente não deve tentar fazer deploy** — nem na AWS, nem na Railway, nem em qualquer outro lugar. Não rode comandos de deploy, não instale CLIs de infraestrutura, não configure credenciais de nuvem.
4. O papel do assistente termina em **código versionado**: implementar, validar o que mudou e, quando o usuário pedir, commitar e dar `git push`. Deixe claro que isso salva o código no GitHub, mas **não** o coloca no ar.
5. "Publicar" / "subir em produção" é decisão e ação humana da equipe da AWS. Ao terminar um lote, avise que o código está no GitHub e pronto para a equipe deployar.

Nunca armazenar token, senha ou secret (AWS, GitHub ou qualquer outro) no CLAUDE.md.

## Git

Git é usado para versionamento e histórico de commits.

- A branch `main` é a linha de produção; prefira abrir uma branch para o lote e deixar o merge/publicação a cargo da equipe.
- Não faça commits desnecessários.
- Faça um commit por lote concluído.
- Não faça push repetido sem necessidade.
- Nunca exponha tokens, secrets ou chaves.
- Só commite/pushe quando o usuário pedir.
- Commitar e dar push salva o código no GitHub — **não** publica em produção (ver "Deploy e publicação").

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

6. Deploy **não** é tratado por aqui. Produção roda na AWS e é publicada pela equipe, fora deste repositório (ver "Deploy e publicação"). O assistente não faz deploy: entrega o código versionado no GitHub.

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

13. Ao finalizar, informe de forma curta: tarefa concluída · build · commit · push (lembrando que o deploy em produção é feito pela equipe na AWS).

## Entrega de um lote (versionamento)

Repositório: https://github.com/rycspro/rycs-sales.git · Branch de produção: `main`.

Lembrete: versionar **não** publica. Produção é publicada pela equipe na AWS, fora deste repositório (ver "Deploy e publicação"). Só commite/pushe quando o usuário pedir.

Quando o usuário pedir para versionar um lote concluído:

1. Finalize as alterações do lote.
2. Valide apenas o que mudou (parse/build do que foi tocado).
3. Rode os testes necessários uma única vez, quando aplicável.
4. Corrija erros causados pelas alterações antes de continuar.
5. `git add` apenas dos arquivos do lote.
6. Um único commit descrevendo o lote.
7. Confirme o remote: `git remote -v` deve ser `https://github.com/rycspro/rycs-sales.git` (corrija com `git remote set-url origin …` se preciso).
8. Dê push — de preferência numa branch do lote; `main` só se o usuário pedir.
9. Encerre informando que o código está no GitHub e pronto para a equipe publicar na AWS. Não tente fazer deploy.

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
- se commit/push foram feitos (o deploy em produção é feito pela equipe na AWS);
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
