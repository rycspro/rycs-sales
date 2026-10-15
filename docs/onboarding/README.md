# Onboarding da empresa na RYCS: pacote para o Claude Code

Este pacote tem tudo o que o Claude Code precisa para implementar o fluxo de cadastro da empresa (6 etapas) dentro do projeto Rycs.

## Como usar (3 passos)

1. **Copie a pasta** `rycs-onboarding/` para dentro do seu projeto, em `docs/onboarding/`.
   Resultado esperado: `seu-projeto/docs/onboarding/SPEC.md`, etc.
2. **Abra o Claude Code** na raiz do projeto e cole o conteúdo de `00-PROMPT-INICIAL.md`.
3. **Aprove o plano** que o Claude Code apresentar. Depois ele implementa uma etapa por vez, testando e fazendo commit ao final de cada uma.

Opcional: copie o conteúdo de `CLAUDE.md.trecho.md` para o `CLAUDE.md` do projeto, para que as regras valham em qualquer sessão futura.

## O que tem em cada arquivo

| Arquivo | Para que serve |
|---|---|
| `00-PROMPT-INICIAL.md` | O texto que você cola no Claude Code para começar |
| `SPEC.md` | Especificação completa: regras de UX, as 6 etapas, dados, segurança, critérios de aceite e ordem de entrega |
| `CLAUDE.md.trecho.md` | Trecho para adicionar ao `CLAUDE.md` do projeto |
| `design/tokens.css` | Cores, fontes, raios e alturas da identidade RYCS como variáveis CSS |
| `design/tokens.json` | Os mesmos valores em JSON (para Tailwind, tema ou design tokens) |
| `design/reference/*.dc.html` | As 7 telas desenhadas (referência visual de layout, textos e estados) |

## Sobre as telas de referência

Os arquivos em `design/reference/` são o protótipo desenhado, em HTML com estilos dentro dos elementos. O Claude Code deve **ler como referência** de layout, textos, campos e estados, e recriar no framework do seu projeto. Não são para copiar e colar em produção.

Mapa das telas:

| Arquivo | Etapa |
|---|---|
| `Main.dc.html` | 1 · Acesso (login, olho da senha, recuperação e reenvio) |
| `Empresa.dc.html` | 2 · Perfil da empresa |
| `Academy.dc.html` | 3 · Marketing Academy |
| `IA.dc.html` | 4a · IA trabalhando |
| `Aprovacao.dc.html` | 4b · Aprovação do dono |
| `Plano.dc.html` | 5 · Plano e pagamento |
| `Campanha.dc.html` | 6 · Primeira campanha |

## O que ainda é preciso informar

- Nomes, preços e recursos dos planos (a tela de plano mostra campos em branco de propósito).
- Limites de tamanho de arquivo por tipo.
- Textos finais dos Termos de Uso e da Política de Privacidade.
- Gateway de pagamento e provedor de e-mail transacional, se o projeto ainda não tiver.

## Figma

Há um arquivo parcial no Figma (componentes, login, perfil e Marketing Academy): https://www.figma.com/design/SRmCyPtctzHSTeuLPJpRLS
As etapas 4 a 6 ainda não foram desenhadas lá; use as telas de `design/reference/`.
