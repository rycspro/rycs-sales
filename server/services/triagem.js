import { PERGUNTAS, CATEGORIAS, classificar } from "../../shared/triagem.js";

// Cálculo da triagem — inteiramente no servidor.
//
// O cliente envia apenas os índices marcados e os textos das respostas
// abertas. Peso, gabarito e rubrica nunca saem daqui: se saíssem, bastaria
// ler a resposta da rede para gabaritar a avaliação.

const porId = new Map(PERGUNTAS.map((p) => [p.id, p]));

// Resposta aberta é avaliada por rubrica de palavras-chave. É uma medida
// grosseira, então nunca zera nem crava nota máxima: fica entre 3 e 9, e a
// avaliação humana continua possível depois.
function pontuarAberta(texto, rubrica) {
  const t = String(texto || "").toLowerCase().trim();
  if (t.length < 15) return { pontos: 1, nota: "resposta curta demais para avaliar" };

  const bons = (rubrica?.bons || []).filter((k) => t.includes(k)).length;
  const ruins = (rubrica?.ruins || []).filter((k) => t.includes(k)).length;

  // Elaboração conta: quem detalha o raciocínio demonstra domínio.
  const elaboracao = Math.min(2, Math.floor(t.length / 120));
  const bruto = 3 + bons * 1.6 - ruins * 1.8 + elaboracao;

  return {
    pontos: Math.max(1, Math.min(9, Number(bruto.toFixed(2)))),
    nota: ruins > bons ? "resposta indica postura passiva" : bons > 0 ? "resposta consistente" : "resposta genérica",
  };
}

function pontuarMultipla(indices, opcoes) {
  const marcadas = (Array.isArray(indices) ? indices : []).filter((i) => opcoes[i]);
  if (!marcadas.length) return 0;
  // Média das marcadas, com bônus por cobertura — quem domina mais canais
  // vale mais, mas marcar tudo sem critério não maximiza.
  const media = marcadas.reduce((a, i) => a + opcoes[i][1], 0) / marcadas.length;
  const cobertura = Math.min(1.5, marcadas.length * 0.25);
  return Math.min(10, media + cobertura);
}

export function calcular(respostas) {
  const porCategoria = {};
  const detalhe = [];

  for (const chave of Object.keys(CATEGORIAS)) porCategoria[chave] = { soma: 0, max: 0 };

  for (const p of PERGUNTAS) {
    const r = respostas?.[p.id];
    let pontos = 0;
    let nota = "";

    if (p.tipo === "unica") {
      const i = Number(r);
      pontos = Number.isInteger(i) && p.opcoes[i] ? p.opcoes[i][1] : 0;
    } else if (p.tipo === "multipla") {
      pontos = pontuarMultipla(r, p.opcoes);
    } else if (p.tipo === "aberta") {
      const a = pontuarAberta(r, p.rubrica);
      pontos = a.pontos;
      nota = a.nota;
    }

    porCategoria[p.categoria].soma += pontos;
    porCategoria[p.categoria].max += 10;
    detalhe.push({ id: p.id, categoria: p.categoria, pontos: Number(pontos.toFixed(2)), nota });
  }

  // Score final é a média ponderada das categorias pelos pesos do documento.
  let score = 0;
  const categorias = {};
  for (const [chave, def] of Object.entries(CATEGORIAS)) {
    const c = porCategoria[chave];
    const pct = c.max > 0 ? (c.soma / c.max) * 100 : 0;
    categorias[chave] = Number(pct.toFixed(2));
    score += (pct * def.peso) / 100;
  }

  // Duas casas, sem arredondar para cima: o documento exige que 90,00 caia em
  // condicionada e só acima disso aprove.
  score = Math.floor(score * 100) / 100;

  return { score, categorias, detalhe, status: classificar(score), perfil: montarPerfil(respostas, categorias) };
}

// Perfil comercial derivado das respostas — alimenta o matching depois.
function montarPerfil(respostas, categorias) {
  const perfil = {};

  for (const p of PERGUNTAS) {
    if (!p.perfil) continue;
    const r = respostas?.[p.id];
    if (p.tipo === "multipla") {
      perfil[p.perfil] = (Array.isArray(r) ? r : []).map((i) => p.opcoes[i]?.[0]).filter(Boolean);
    } else if (p.tipo === "unica" && p.opcoes[Number(r)]) {
      perfil[p.perfil] = p.opcoes[Number(r)][0];
    }
  }

  // Perfil predominante: comparar prospecção com fechamento separa quem abre
  // porta de quem fecha contrato.
  const caca = (categorias.prospeccao + categorias.disciplina) / 2;
  const fecha = (categorias.negociacao + categorias.fechamento + categorias.objecoes) / 3;
  const consultivo = (categorias.qualificacao + categorias.reunioes) / 2;

  let predominante = "Generalista";
  if (caca >= fecha && caca >= consultivo) predominante = "Hunter";
  else if (fecha >= caca && fecha >= consultivo) predominante = "Closer";
  else predominante = "Consultivo";
  if (consultivo >= 75 && predominante !== "Consultivo") predominante += " + Consultivo";

  perfil.predominante = predominante;
  perfil.funcaoSugerida = predominante.startsWith("Hunter") ? "sdr"
    : predominante.startsWith("Closer") ? "closer" : "bdr";

  return perfil;
}

export const perguntaExiste = (id) => porId.has(id);
