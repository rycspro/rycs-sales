// Roteiro comercial guiado (discadora e videochamada).
//
// O roteiro é dado, nunca código: cada empresa cria o seu (à mão ou a partir
// de um documento) e ele fica salvo estruturado em voice_scripts.estrutura.
// Este módulo é puro e roda nos dois lados:
// - servidor: valida o que a empresa salva, aplica condições e confere o que
//   a IA devolve durante a chamada (evidência tem que estar na fala);
// - navegador: mostra progresso, pergunta atual e condições na hora.
//
// Formato:
// {
//   blocos: [{ id, titulo, orientacao, condicao,
//     topicos: [{ id, titulo, orientacao,
//       perguntas: [{ id, texto, variacoes[], orientacao, obrigatoria,
//                     campo: { tipo, opcoes[] }, condicao, revisar }] }] }],
//   criterios: [{ id, descricao, perguntaId, operador, valor, efeito }]
// }
// condicao = { perguntaId, operador, valor } | null — o item só aparece quando
// a condição vale. Estado de uma execução:
// { perguntaAtual, feitas: { id: { em, origem } }, respostas: { id: { valor, origem, trecho, em } } }

export const TIPOS_CAMPO = [
  { id: "texto", label: "Texto" },
  { id: "numero", label: "Número" },
  { id: "moeda", label: "Valor (R$)" },
  { id: "sim_nao", label: "Sim / Não" },
  { id: "opcao", label: "Opções" },
  { id: "data", label: "Data" },
];

export const OPERADORES = [
  { id: "igual", label: "é igual a" },
  { id: "diferente", label: "é diferente de" },
  { id: "contem", label: "contém" },
  { id: "maior", label: "é maior que" },
  { id: "menor", label: "é menor que" },
  { id: "preenchido", label: "foi respondida" },
  { id: "vazio", label: "não foi respondida" },
];

export const EFEITOS_CRITERIO = [
  { id: "qualifica", label: "Qualifica o contato" },
  { id: "desqualifica", label: "Desqualifica o contato" },
];

export const LIMITES = {
  blocos: 30, topicos: 20, perguntas: 40, perguntasTotal: 200,
  titulo: 160, texto: 600, orientacao: 1500, variacoes: 8, opcoes: 20,
  criterios: 30, valor: 500, trecho: 400,
};

const TIPOS = new Set(TIPOS_CAMPO.map((t) => t.id));
const OPS = new Set(OPERADORES.map((o) => o.id));
const SEM_VALOR = new Set(["preenchido", "vazio"]);

export const novoId = (prefixo) => `${prefixo}_${Math.random().toString(36).slice(2, 10)}`;

const txt = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const txtLongo = (v, max) => String(v ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

function normalizarCondicao(c, idsValidos) {
  if (!c || typeof c !== "object") return null;
  const perguntaId = txt(c.perguntaId, 40);
  const operador = OPS.has(c.operador) ? c.operador : "igual";
  if (!perguntaId || (idsValidos && !idsValidos.has(perguntaId))) return null;
  return { perguntaId, operador, valor: SEM_VALOR.has(operador) ? "" : txt(c.valor, LIMITES.valor) };
}

// Saneia o que vem da tela ou da IA: ids únicos, limites, tipos conhecidos,
// condições só para perguntas que existem. Nada é inventado: item vazio sai.
export function normalizarEstrutura(bruta) {
  const usados = new Set();
  const idUnico = (id, prefixo) => {
    let v = txt(id, 40).replace(/[^\w-]/g, "");
    if (!v || usados.has(v)) v = novoId(prefixo);
    usados.add(v);
    return v;
  };
  let total = 0;
  const blocos = (Array.isArray(bruta?.blocos) ? bruta.blocos : []).slice(0, LIMITES.blocos).map((b) => ({
    id: idUnico(b?.id, "b"),
    titulo: txt(b?.titulo, LIMITES.titulo),
    orientacao: txtLongo(b?.orientacao, LIMITES.orientacao),
    condicao: b?.condicao || null,
    topicos: (Array.isArray(b?.topicos) ? b.topicos : []).slice(0, LIMITES.topicos).map((t) => ({
      id: idUnico(t?.id, "t"),
      titulo: txt(t?.titulo, LIMITES.titulo),
      orientacao: txtLongo(t?.orientacao, LIMITES.orientacao),
      perguntas: (Array.isArray(t?.perguntas) ? t.perguntas : []).slice(0, LIMITES.perguntas).filter((p) => txt(p?.texto, 5)).filter(() => ++total <= LIMITES.perguntasTotal).map((p) => {
        const tipo = TIPOS.has(p?.campo?.tipo) ? p.campo.tipo : "texto";
        const opcoes = tipo === "opcao" ? [...new Set((Array.isArray(p?.campo?.opcoes) ? p.campo.opcoes : []).map((o) => txt(o, 120)).filter(Boolean))].slice(0, LIMITES.opcoes) : [];
        return {
          id: idUnico(p?.id, "p"),
          texto: txt(p.texto, LIMITES.texto),
          variacoes: [...new Set((Array.isArray(p?.variacoes) ? p.variacoes : []).map((v) => txt(v, LIMITES.texto)).filter(Boolean))].slice(0, LIMITES.variacoes),
          orientacao: txtLongo(p?.orientacao, LIMITES.orientacao),
          obrigatoria: !!p?.obrigatoria,
          campo: { tipo: tipo === "opcao" && !opcoes.length ? "texto" : tipo, opcoes },
          condicao: p?.condicao || null,
          revisar: !!p?.revisar,
        };
      }),
    })).filter((t) => t.titulo || t.orientacao || t.perguntas.length),
  })).filter((b) => b.titulo || b.orientacao || b.topicos.length);

  // Condições e critérios só podem apontar para perguntas que existem.
  const ids = new Set(blocos.flatMap((b) => b.topicos.flatMap((t) => t.perguntas.map((p) => p.id))));
  for (const b of blocos) {
    b.condicao = normalizarCondicao(b.condicao, ids);
    for (const t of b.topicos) for (const p of t.perguntas) {
      p.condicao = normalizarCondicao(p.condicao, ids);
      if (p.condicao?.perguntaId === p.id) p.condicao = null;
    }
  }
  const criterios = (Array.isArray(bruta?.criterios) ? bruta.criterios : []).slice(0, LIMITES.criterios).map((c) => {
    const cond = normalizarCondicao(c, ids);
    const descricao = txt(c?.descricao, LIMITES.texto);
    if (!cond && !descricao) return null;
    return {
      id: idUnico(c?.id, "c"), descricao,
      perguntaId: cond?.perguntaId || "", operador: cond?.operador || "igual", valor: cond?.valor || "",
      efeito: c?.efeito === "desqualifica" ? "desqualifica" : "qualifica",
    };
  }).filter(Boolean);
  return { blocos, criterios };
}

export function lerEstrutura(json) {
  if (!json) return null;
  try {
    const e = typeof json === "string" ? JSON.parse(json) : json;
    return Array.isArray(e?.blocos) ? e : null;
  } catch { return null; }
}

// Lista plana, na ordem do roteiro.
export function listarPerguntas(estrutura) {
  const lista = [];
  for (const b of estrutura?.blocos || []) for (const t of b.topicos || []) for (const p of t.perguntas || []) {
    lista.push({ ...p, blocoId: b.id, blocoTitulo: b.titulo, topicoId: t.id, topicoTitulo: t.titulo, indice: lista.length });
  }
  return lista;
}

export function contarPerguntas(estrutura) {
  return listarPerguntas(estrutura).length;
}

// ── Texto ────────────────────────────────────────────────────────────

export const normalizarTexto = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const PALAVRAS_VAZIAS = new Set(("a o as os um uma uns umas de da do das dos e em no na nos nas ao aos para pra pro por com sem que se " +
  "ou mas como qual quais quanto quanta quantos quantas quando onde porque pq voce voces vc vcs seu sua seus suas meu minha meus minhas " +
  "eu ele ela eles elas isso esse essa este esta aqui ai la tem ter tinha ja nao sim e eh entao tipo assim bem muito mais menos hoje " +
  "agora sobre me te lhe nos gente vai vou foi ser estar esta estao sao era fala falar pode poderia consegue sabe acha").split(" "));

const raiz = (p) => (p.length > 5 ? p.slice(0, 5) : p.replace(/s$/, ""));
export function palavrasChave(s) {
  return [...new Set(normalizarTexto(s).split(" ").filter((p) => p.length >= 3 && !PALAVRAS_VAZIAS.has(p)).map(raiz))];
}

// Quanto do texto da pergunta aparece no trecho (0 a 1).
export function semelhanca(pergunta, trecho) {
  const a = palavrasChave(pergunta);
  if (!a.length) return { nota: 0, comuns: 0 };
  const b = new Set(palavrasChave(trecho));
  const comuns = a.filter((p) => b.has(p)).length;
  return { nota: comuns / a.length, comuns };
}

// A evidência citada pela IA precisa estar na fala de verdade.
export function trechoNaFala(trecho, fala) {
  const t = normalizarTexto(trecho);
  const f = normalizarTexto(fala);
  if (!t || !f) return false;
  if (f.includes(t)) return true;
  const palavras = t.split(" ").filter((p) => p.length >= 2);
  if (!palavras.length) return false;
  const conjunto = new Set(f.split(" "));
  return palavras.filter((p) => conjunto.has(p)).length / palavras.length >= 0.8;
}

// ── Condições, progresso e próxima pergunta ──────────────────────────

const numero = (v) => {
  const s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return NaN;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : NaN;
};

export function avaliarCondicao(cond, respostas = {}) {
  if (!cond?.perguntaId) return true;
  const bruto = respostas[cond.perguntaId]?.valor;
  const preenchido = bruto !== undefined && bruto !== null && String(bruto).trim() !== "";
  if (cond.operador === "preenchido") return preenchido;
  if (cond.operador === "vazio") return !preenchido;
  if (!preenchido) return false;
  const v = normalizarTexto(bruto);
  const alvo = normalizarTexto(cond.valor);
  switch (cond.operador) {
    case "diferente": return v !== alvo;
    case "contem": return !!alvo && v.includes(alvo);
    case "maior": return numero(bruto) > numero(cond.valor);
    case "menor": return numero(bruto) < numero(cond.valor);
    default: return v === alvo;
  }
}

export function perguntasVisiveis(estrutura, respostas = {}) {
  const blocosOcultos = new Set((estrutura?.blocos || []).filter((b) => !avaliarCondicao(b.condicao, respostas)).map((b) => b.id));
  return listarPerguntas(estrutura).filter((p) => !blocosOcultos.has(p.blocoId) && avaliarCondicao(p.condicao, respostas));
}

const respondida = (estado, id) => {
  const v = estado?.respostas?.[id]?.valor;
  return v !== undefined && v !== null && String(v).trim() !== "";
};
const concluida = (estado, id) => !!estado?.feitas?.[id] || respondida(estado, id);

// Primeira pergunta visível e pendente depois de `aposId`; se não houver,
// a primeira pendente desde o começo. Null quando tudo foi feito.
export function proximaPergunta(estrutura, estado, aposId = null) {
  const visiveis = perguntasVisiveis(estrutura, estado?.respostas);
  const pendentes = visiveis.filter((p) => !concluida(estado, p.id));
  if (!pendentes.length) return null;
  const todas = listarPerguntas(estrutura);
  const pos = aposId ? todas.findIndex((p) => p.id === aposId) : -1;
  return (pendentes.find((p) => p.indice > pos) || pendentes[0]).id;
}

export function progresso(estrutura, estado) {
  const visiveis = perguntasVisiveis(estrutura, estado?.respostas);
  const feitas = visiveis.filter((p) => concluida(estado, p.id)).length;
  const respondidas = visiveis.filter((p) => respondida(estado, p.id)).length;
  const obrigatoriasPendentes = visiveis.filter((p) => p.obrigatoria && !respondida(estado, p.id)).map((p) => p.id);
  return { total: visiveis.length, feitas, respondidas, obrigatoriasPendentes, percentual: visiveis.length ? Math.round((feitas / visiveis.length) * 100) : 0 };
}

export function avaliarCriterios(estrutura, respostas = {}) {
  const motivos = [];
  let qualifica = 0;
  let pendente = 0;
  for (const c of estrutura?.criterios || []) {
    if (!c.perguntaId) continue;
    const resp = respostas[c.perguntaId]?.valor;
    if ((resp === undefined || String(resp).trim() === "") && !["vazio", "preenchido"].includes(c.operador)) { pendente++; continue; }
    if (!avaliarCondicao(c, respostas)) continue;
    if (c.efeito === "desqualifica") motivos.push(c.descricao || "Critério de desqualificação atingido");
    else qualifica++;
  }
  if (motivos.length) return { status: "desqualificado", motivos };
  const total = (estrutura?.criterios || []).filter((c) => c.perguntaId && c.efeito === "qualifica").length;
  if (total && qualifica === total) return { status: "qualificado", motivos: [] };
  return { status: pendente || total ? "pendente" : "sem_criterios", motivos: [] };
}

// Ajusta o valor ao tipo do campo. Devolve null quando não serve (ex.: opção
// que não existe na lista) — melhor deixar em branco do que gravar errado.
export function valorDoCampo(pergunta, valor) {
  const bruto = txt(valor, LIMITES.valor);
  if (!bruto) return null;
  const tipo = pergunta?.campo?.tipo || "texto";
  if (tipo === "sim_nao") {
    const n = normalizarTexto(bruto);
    if (/^(sim|s|yes|claro|com certeza|positivo)\b/.test(n)) return "Sim";
    if (/^(nao|n|no|negativo|nunca)\b/.test(n)) return "Não";
    return null;
  }
  if (tipo === "opcao") {
    const n = normalizarTexto(bruto);
    return (pergunta.campo.opcoes || []).find((o) => normalizarTexto(o) === n) || null;
  }
  if (tipo === "numero" || tipo === "moeda") {
    const v = bruto.replace(/[.,;:!?]+$/, "");
    return Number.isFinite(numero(v)) ? v : null;
  }
  return bruto;
}

// ── Casamento local (sem IA) ─────────────────────────────────────────
// Usado quando a IA está fora ou como primeira passada barata: reconhece a
// pergunta pelas palavras-chave (pergunta e variações) e só preenche resposta
// quando ela é evidente (sim/não no começo da fala seguinte, ou um número).

const frases = (texto) => String(texto || "").split(/(?<=[.?!])\s+|\n+/).map((f) => f.trim()).filter(Boolean);

export function casarLocal(estrutura, estado, texto) {
  const visiveis = perguntasVisiveis(estrutura, estado?.respostas);
  const pendentes = visiveis.filter((p) => !estado?.feitas?.[p.id]);
  const partes = frases(texto);
  const feitas = [];
  const respostas = [];
  partes.forEach((frase, i) => {
    let melhor = null;
    for (const p of pendentes) {
      if (feitas.some((f) => f.id === p.id)) continue;
      for (const alvo of [p.texto, ...(p.variacoes || [])]) {
        const s = semelhanca(alvo, frase);
        const minimo = palavrasChave(alvo).length <= 2 ? s.comuns >= 1 && s.nota >= 1 : s.comuns >= 2 && s.nota >= 0.6;
        if (minimo && (!melhor || s.nota > melhor.nota)) melhor = { id: p.id, nota: s.nota, pergunta: p };
      }
    }
    if (!melhor) return;
    feitas.push({ id: melhor.id, trecho: frase.slice(0, LIMITES.trecho) });
    const seguinte = partes[i + 1];
    if (!seguinte || respondida(estado, melhor.id)) return;
    const tipo = melhor.pergunta.campo?.tipo;
    if (tipo === "sim_nao") {
      const v = valorDoCampo(melhor.pergunta, seguinte.split(/[\s,.!]/)[0]);
      if (v) respostas.push({ id: melhor.id, valor: v, trecho: seguinte.slice(0, LIMITES.trecho) });
    } else if (tipo === "numero" || tipo === "moeda") {
      const nums = seguinte.match(/\d[\d.,]*/g) || [];
      if (nums.length === 1) respostas.push({ id: melhor.id, valor: nums[0].replace(/[.,]+$/, ""), trecho: seguinte.slice(0, LIMITES.trecho) });
    }
  });
  return { feitas, respostas };
}

// Aplica perguntas feitas e respostas ao estado, sem sobrescrever o que o
// profissional corrigiu à mão. Devolve o novo estado.
export function aplicarAchados(estrutura, estado, { feitas = [], respostas = [] }, origem, agora = Date.now()) {
  const novo = { perguntaAtual: estado?.perguntaAtual || null, feitas: { ...(estado?.feitas || {}) }, respostas: { ...(estado?.respostas || {}) } };
  const porId = new Map(listarPerguntas(estrutura).map((p) => [p.id, p]));
  let ultimaFeita = null;
  for (const f of feitas) {
    if (!porId.has(f.id)) continue;
    if (novo.feitas[f.id]) continue; // já feita: não volta o ponteiro
    novo.feitas[f.id] = { em: agora, origem, trecho: txt(f.trecho, LIMITES.trecho) };
    ultimaFeita = f.id;
  }
  for (const r of respostas) {
    const p = porId.get(r.id);
    if (!p || novo.respostas[r.id]?.origem === "manual") continue;
    const valor = valorDoCampo(p, r.valor);
    if (valor === null) continue;
    novo.respostas[r.id] = { valor, origem, trecho: txt(r.trecho, LIMITES.trecho), em: agora };
    if (!novo.feitas[r.id]) novo.feitas[r.id] = { em: agora, origem, trecho: "" };
  }
  // Avança: a pergunta atual vira a próxima pendente depois da última feita.
  const atualConcluida = !novo.perguntaAtual || concluida(novo, novo.perguntaAtual);
  if (ultimaFeita || atualConcluida) {
    novo.perguntaAtual = proximaPergunta(estrutura, novo, ultimaFeita || novo.perguntaAtual);
  }
  return novo;
}

// Perguntas feitas e ainda sem resposta: a IA continua escutando por elas.
export function aguardandoResposta(estrutura, estado) {
  return perguntasVisiveis(estrutura, estado?.respostas).filter((p) => estado?.feitas?.[p.id] && !respondida(estado, p.id)).map((p) => p.id);
}

// ── Motor interno de importação (sem IA) ─────────────────────────────
// Lê o texto do documento linha a linha: títulos viram blocos, linhas com "?"
// viram perguntas, o resto vira orientação. Tudo marcado para revisão.

const pareceTitulo = (l) => {
  const s = l.trim();
  if (s.length < 3 || s.length > 90 || /[?]$/.test(s)) return false;
  if (/^(\d+[.)]|[IVX]+[.)]|#+)\s+\S/.test(s)) return true;
  if (/:$/.test(s) && s.split(" ").length <= 8) return true;
  const letras = s.replace(/[^A-Za-zÀ-ú]/g, "");
  return letras.length >= 4 && letras === letras.toUpperCase() && s.split(" ").length <= 8;
};

// Texto de PDF costuma vir numa linha só: quebra nas frases e separa o título
// em maiúsculas que vem grudado no começo ("QUALIFICAÇÃO Quantos...").
function separarLinhas(texto) {
  let t = String(texto || "").replace(/\r/g, "");
  if ((t.match(/\n/g) || []).length < t.length / 300) t = t.replace(/([.?!])\s+/g, "$1\n");
  return t.split(/\n+/).flatMap((l) => {
    const m = l.trim().match(/^([A-ZÀ-Ý0-9][A-ZÀ-Ý0-9 ]{3,}?)\s+(?=[A-ZÀ-Ý][a-zà-ÿ])(.*)$/);
    return m ? [m[1], m[2]] : [l];
  });
}

export function estruturarTextoInterno(texto) {
  const linhas = separarLinhas(texto).map((l) => l.replace(/^[\s•\-–*·]+/, "").trim()).filter(Boolean);
  const blocos = [];
  let bloco = null;
  const garantirBloco = () => {
    if (!bloco) { bloco = { titulo: "Roteiro", orientacao: "", topicos: [{ titulo: "", orientacao: "", perguntas: [] }] }; blocos.push(bloco); }
    return bloco;
  };
  for (const l of linhas) {
    if (pareceTitulo(l)) {
      bloco = { titulo: l.replace(/^(\d+[.)]|[IVX]+[.)]|#+)\s+/, "").replace(/:$/, ""), orientacao: "", topicos: [{ titulo: "", orientacao: "", perguntas: [] }] };
      blocos.push(bloco);
      continue;
    }
    const b = garantirBloco();
    const topico = b.topicos[b.topicos.length - 1];
    const perguntas = l.match(/[^.?!]*\?/g);
    if (perguntas) {
      for (const p of perguntas) topico.perguntas.push({ texto: p.trim(), obrigatoria: false, campo: { tipo: "texto", opcoes: [] }, revisar: true });
      const resto = l.replace(/[^.?!]*\?/g, "").trim();
      if (resto) topico.orientacao = `${topico.orientacao}\n${resto}`.trim();
    } else {
      const alvo = topico.perguntas.length ? topico.perguntas[topico.perguntas.length - 1] : null;
      if (alvo) alvo.orientacao = `${alvo.orientacao || ""}\n${l}`.trim();
      else b.orientacao = `${b.orientacao}\n${l}`.trim();
    }
  }
  return normalizarEstrutura({ blocos, criterios: [] });
}
