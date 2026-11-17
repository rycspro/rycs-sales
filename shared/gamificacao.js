// Gamificação do profissional — camada SEPARADA do RYCS Score e do nível
// operacional (sellers.nota / sellers.nivel), que continuam intocados.
//
// Aqui vivem só definições puras (sem banco): faixas de XP, catálogo de
// conquistas e os helpers de nível. O servidor (server/services/gamificacao.js)
// avalia os dados reais e concede XP/conquistas de forma idempotente; a tela lê
// o resultado. Nenhum XP vem do frontend.

// ─── Faixas de nível (XP acumulado) ───────────────────────────────────────
// Cores de identificação próprias da RYCS (não são troféus genéricos).
export const FAIXAS = [
  { chave: "starter", nome: "Starter", min: 0, cor: "#5B6B7F" },
  { chave: "bronze", nome: "Bronze", min: 200, cor: "#B06E3B" },
  { chave: "prata", nome: "Prata", min: 500, cor: "#8C97A3" },
  { chave: "ouro", nome: "Ouro", min: 1000, cor: "#C79A2B" },
  { chave: "platina", nome: "Platina", min: 2000, cor: "#6E93B8" },
  { chave: "elite", nome: "Elite", min: 4000, cor: "#7C3AED" },
];

export function nivelPorXp(xp) {
  const v = Math.max(0, Number(xp) || 0);
  let i = 0;
  for (let k = 0; k < FAIXAS.length; k++) if (v >= FAIXAS[k].min) i = k;
  const atual = FAIXAS[i];
  const proximo = FAIXAS[i + 1] || null;
  const base = atual.min;
  const teto = proximo ? proximo.min : atual.min;
  const progresso = proximo ? Math.min(100, Math.round(((v - base) / (teto - base)) * 100)) : 100;
  return {
    chave: atual.chave, nome: atual.nome, cor: atual.cor, numero: i + 1,
    xp: v, min: base, proximo, progresso,
    faltam: proximo ? Math.max(0, proximo.min - v) : 0,
  };
}

// ─── Catálogo de conquistas ────────────────────────────────────────────────
// `metrica` aponta para um número calculado no servidor; `alvo` é o limiar.
// `xp` é concedido UMA vez, quando a conquista é desbloqueada (idempotente).
// Métricas booleanas usam alvo 1.
export const CATEGORIAS = {
  perfil: "Perfil profissional",
  avaliacoes: "Testes e avaliações",
  academy: "Academy",
  performance: "Performance",
  ganhos: "Ganhos",
};

export const CONQUISTAS = [
  // A — Perfil
  { id: "primeiros-passos", categoria: "perfil", nome: "Primeiros Passos", descricao: "Você criou sua conta profissional na RYCS.", metrica: "contaCriada", alvo: 1, xp: 0 },
  { id: "identidade-completa", categoria: "perfil", nome: "Identidade Completa", descricao: "Preencheu os dados essenciais do seu perfil.", metrica: "perfilEssencial", alvo: 1, xp: 50 },
  { id: "minha-historia", categoria: "perfil", nome: "Minha História", descricao: "Escreveu e salvou sua apresentação.", metrica: "bioSalva", alvo: 1, xp: 50 },
  { id: "minha-apresentacao", categoria: "perfil", nome: "Minha Apresentação", descricao: "Enviou um vídeo de apresentação.", metrica: "videoEnviado", alvo: 1, xp: 25 },
  { id: "perfil-completo", categoria: "perfil", nome: "Perfil Completo", descricao: "Completou todo o currículo comercial.", metrica: "perfilCompleto", alvo: 1, xp: 50 },

  // B — Avaliações
  { id: "primeira-avaliacao", categoria: "avaliacoes", nome: "Primeira Avaliação", descricao: "Concluiu sua primeira avaliação profissional.", metrica: "avaliacoesDistintas", alvo: 1, xp: 40 },
  { id: "explorador-habilidades", categoria: "avaliacoes", nome: "Explorador de Habilidades", descricao: "Concluiu três avaliações distintas.", metrica: "avaliacoesDistintas", alvo: 3, xp: 40 },
  { id: "profissional-evolucao", categoria: "avaliacoes", nome: "Profissional em Evolução", descricao: "Concluiu cinco avaliações distintas.", metrica: "avaliacoesDistintas", alvo: 5, xp: 40 },

  // C — Academy
  { id: "primeiro-aprendizado", categoria: "academy", nome: "Primeiro Aprendizado", descricao: "Concluiu seu primeiro treinamento da Academy.", metrica: "treinosConcluidos", alvo: 1, xp: 50 },
  { id: "profissional-certificado", categoria: "academy", nome: "Profissional Certificado", descricao: "Conquistou sua primeira certificação verificável.", metrica: "certificados", alvo: 1, xp: 75 },
  { id: "conhecimento-expansao", categoria: "academy", nome: "Conhecimento em Expansão", descricao: "Concluiu três treinamentos distintos.", metrica: "treinosConcluidos", alvo: 3, xp: 60 },
  { id: "especialista-academy", categoria: "academy", nome: "Especialista Academy", descricao: "Conquistou três certificações distintas.", metrica: "certificados", alvo: 3, xp: 100 },

  // D — Performance
  { id: "primeira-entrega", categoria: "performance", nome: "Primeira Entrega", descricao: "Teve sua primeira tarefa aprovada.", metrica: "tarefasAprovadas", alvo: 1, xp: 100 },
  { id: "em-movimento", categoria: "performance", nome: "Em Movimento", descricao: "Cinco tarefas aprovadas.", metrica: "tarefasAprovadas", alvo: 5, xp: 60 },
  { id: "profissional-ativo", categoria: "performance", nome: "Profissional Ativo", descricao: "Dez tarefas aprovadas.", metrica: "tarefasAprovadas", alvo: 10, xp: 80 },
  { id: "consistencia", categoria: "performance", nome: "Consistência", descricao: "Vinte e cinco tarefas aprovadas.", metrica: "tarefasAprovadas", alvo: 25, xp: 120 },
  { id: "alta-performance", categoria: "performance", nome: "Alta Performance", descricao: "Cinquenta tarefas aprovadas.", metrica: "tarefasAprovadas", alvo: 50, xp: 200 },

  // E — Ganhos (valores em BRL, conforme o motor financeiro existente)
  { id: "primeiro-ganho", categoria: "ganhos", nome: "Primeiro Ganho", descricao: "Recebeu sua primeira remuneração confirmada.", metrica: "ganhosConfirmados", alvo: 0.01, xp: 50 },
  { id: "primeiro-saque", categoria: "ganhos", nome: "Primeiro Saque", descricao: "Concluiu seu primeiro saque.", metrica: "saquePago", alvo: 1, xp: 50 },
  { id: "mil-em-ganhos", categoria: "ganhos", nome: "R$ 1.000 em Ganhos", descricao: "Acumulou R$ 1.000 em ganhos confirmados.", metrica: "ganhosConfirmados", alvo: 1000, xp: 100 },
  { id: "dez-mil-em-ganhos", categoria: "ganhos", nome: "R$ 10.000 em Ganhos", descricao: "Acumulou R$ 10.000 em ganhos confirmados.", metrica: "ganhosConfirmados", alvo: 10000, xp: 150 },
];

export const CONQUISTA_POR_ID = Object.fromEntries(CONQUISTAS.map((c) => [c.id, c]));

// XP incremental (fora das conquistas de marco): cada tarefa aprovada além da
// primeira vale +20. Idempotente por submissionId no servidor.
export const XP_POR_TAREFA_ADICIONAL = 20;
