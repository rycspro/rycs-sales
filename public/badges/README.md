# Medalhas 3D colecionáveis — "Suas conquistas"

Esta pasta recebe os **21 assets 3D** das conquistas do profissional. O componente
`src/components/vendedor/AchievementBadge.jsx` carrega cada medalha de
`/badges/<id>.webp`. Enquanto o arquivo não existir, a medalha cai num *slot*
placeholder (moldura metálica da categoria) — basta soltar o `.webp` aqui que a
imagem real assume automaticamente, sem mexer em código.

## Especificação dos arquivos

- **Formato:** WebP com transparência (fundo alfa). AVIF também é aceito — se
  trocar, ajuste a extensão em `assetMedalha()` no componente.
- **Dimensão:** 168×168 px (renderizar @2x do tamanho exibido ≈ 84 px).
- **Enquadramento:** medalha centralizada, com margem de ~8% para a sombra/brilho
  não serem cortados. Perspectiva 3D consistente entre todas (mesma câmera/luz).
- **Estilo:** Premium 3D Collectible — borda metálica, centro em esmalte colorido,
  alto-relevo, iluminação realista, sombras suaves. Gemas/cristais/estrelas nas
  especiais. Nada de ícone linear, emoji ou objeto 3D solto.
- **Peso alvo:** ≤ 40 KB por arquivo.
- Os estados (conquistada / em progresso / bloqueada) são aplicados pelo
  componente (selo, brilho, saturação, cadeado) — **entregar só a medalha
  colorida “conquistada”**; o resto é derivado em CSS.

## Direção de cor por categoria

| Categoria        | Metal / família de cor                      | Esmalte central |
|------------------|---------------------------------------------|-----------------|
| Perfil           | prata + azul                                | #318CE7         |
| Avaliações       | dourado + roxo                              | #7C3AED         |
| Academy          | dourado + roxo (certificação)               | #6D28D9         |
| Performance      | bronze / cobre / laranja                    | #E8792B         |
| Ganhos           | verde + dourado + pedras preciosas          | #16A34A         |

Conquistas **especiais (elite)** ganham acabamento platina/diamante + gema:
`perfil-completo`, `especialista-academy`, `profissional-evolucao`,
`consistencia`, `alta-performance`, `dez-mil-em-ganhos`.

## Os 21 arquivos (nome = id da conquista)

### Perfil e identidade (prata/azul)
- `primeiros-passos.webp` — primeira medalha; símbolo: pegada/estrela de início.
- `identidade-completa.webp` — crachá/ID.
- `minha-historia.webp` — pergaminho/livro aberto.
- `minha-apresentacao.webp` — play/câmera de vídeo.
- `perfil-completo.webp` — escudo com check (ELITE: gema).

### Avaliações (dourado/roxo)
- `primeira-avaliacao.webp` — prancheta com check.
- `explorador-habilidades.webp` — bússola/alvo (3 testes).
- `profissional-evolucao.webp` — gráfico ascendente (ELITE: gema).

### Academy (dourado/roxo)
- `primeiro-aprendizado.webp` — capelo/graduação.
- `profissional-certificado.webp` — selo/certificado com fita.
- `conhecimento-expansao.webp` — pilha de livros.
- `especialista-academy.webp` — coroa de louros (ELITE: gema).

### Performance / experiência (bronze/cobre/laranja)
- `primeira-entrega.webp` — bandeira de largada.
- `em-movimento.webp` — foguete/raio (5 tarefas).
- `profissional-ativo.webp` — engrenagem/medalha (10 tarefas).
- `consistencia.webp` — chama/sequência (25 tarefas, ELITE: gema).
- `alta-performance.webp` — troféu (50 tarefas, ELITE: platina/diamante).

### Ganhos financeiros (verde/dourado/gemas)
- `primeiro-ganho.webp` — moeda.
- `primeiro-saque.webp` — cofre/saída de dinheiro.
- `mil-em-ganhos.webp` — pilha de moedas + gema verde.
- `dez-mil-em-ganhos.webp` — baú do tesouro (ELITE: diamante).
