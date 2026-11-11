# RYCS — Regras do Codex

## Escopo

- Trabalhe somente no escopo solicitado.
- Não analise o repositório inteiro sem necessidade.
- Não refatore áreas fora da tarefa.
- Reutilize componentes, funções e padrões existentes.
- Não crie soluções paralelas quando já existir implementação funcional.
- Preserve dados, autenticação, permissões e arquitetura existentes.

## Economia

- Abra somente arquivos necessários.
- Evite buscas e leituras amplas sem necessidade.
- Não gere documentação ou explicações longas durante a execução.
- Implemente todas as tarefas relacionadas do lote antes de validar.
- Não execute testes/build repetidamente.

## Validação

Ao finalizar um lote:

1. validar somente o que foi alterado;
2. rodar os testes necessários uma única vez;
3. rodar build uma única vez quando aplicável;
4. corrigir somente erros relacionados ao lote.

## Beta / Homologação

- Beta é o ambiente oficial de homologação da RYCS.
- É a mesma aplicação/código da Produção, porém rodando em ambiente separado, com dados de teste separados.
- Fluxo padrão: Desenvolvimento → Beta → Validação → Produção.
- Features e correções relevantes devem ser validadas primeiro no Beta.
- Dados fictícios do Beta nunca devem ir para Produção.
- Recursos exclusivos de teste devem funcionar somente no Beta.
- Para tarefas envolvendo Beta, QA ou homologação, leia `docs/BETA.md`.
- Não carregue `docs/BETA.md` quando a tarefa não envolver Beta.

## Deploy e publicação

O ambiente de produção roda na **AWS**. A Railway não é mais usada (migração concluída).

- **Não há deploy automático neste repositório** — sem GitHub Actions; `git push` não publica nada.
- O deploy em produção é feito pela **equipe de infraestrutura na AWS, fora deste repositório**.
- O assistente **não faz deploy** (nem AWS, nem Railway, nem outro): entrega o código versionado no GitHub e avisa que está pronto para a equipe publicar.
- Só commite/pushe quando o usuário pedir; prefira uma branch do lote e deixe o merge/publicação com a equipe.
- Repositório: https://github.com/rycspro/rycs-sales.git · Branch de produção: `main`.

## Autonomia

- Resolva autonomamente problemas operacionais simples e seguros.
- Não interrompa o usuário por detalhes que possam ser resolvidos usando a configuração existente.
- Solicite intervenção humana apenas para autenticação externa, decisão de negócio relevante, ação destrutiva ou risco de perda de dados.

## Segurança

- Nunca exponha secrets, tokens ou senhas.
- Nunca faça alteração destrutiva sem confirmação.
