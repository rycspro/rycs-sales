## Onboarding da empresa (RYCS)

- A especificação do fluxo de cadastro da empresa está em `docs/onboarding/SPEC.md`. Leia antes de mexer em qualquer tela ou rota do onboarding.
- Identidade visual: `docs/onboarding/design/tokens.css`. Use os tokens, não valores soltos de cor.
- Telas de referência em `docs/onboarding/design/reference/` (apenas referência; recrie no framework do projeto).
- Interface sempre em português do Brasil.
- O progresso do onboarding é salvo no servidor e é retomável. Não permitir pular etapas pela URL.
- Cartão de crédito: sempre tokenização no gateway. Nunca guardar número de cartão ou CVV.
- Nada gerado pela IA (script, funil, follow-ups) fica ativo antes da aprovação do dono da empresa.
- Planos, preços e recursos vêm de configuração. Nunca fixar valores no código.
- Acessibilidade: todo campo com `label`, foco visível, alvos de toque de 44px ou mais, contraste mínimo 4.5:1.
