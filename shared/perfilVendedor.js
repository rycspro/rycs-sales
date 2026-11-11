// Explica o score de triagem do vendedor e deriva pontos positivos/negativos
// a partir do quiz de cadastro (xp1–xp4) e do perfil DISC. Mesma fórmula de
// calcularScoreOnboarding — aqui exposta de forma legível para a empresa.
import { DIMENSOES } from "./discQuiz.js";

const TIPO_VENDA_PTS = { ambos: 12, b2b: 10, b2c: 8, nenhuma: 2 };
const DEDICACAO_PTS = { integral: 20, meio: 15, parcial: 10, pontual: 5 };

const ANOS_LABEL = ["menos de 1 ano", "até 1 ano", "1 a 3 anos", "3 a 5 anos", "mais de 5 anos"];
const TIPO_LABEL = { ambos: "B2B e B2C", b2b: "B2B (empresas)", b2c: "B2C (consumidor)", nenhuma: "sem experiência B2B/B2C" };
const DED_LABEL = { integral: "tempo integral (8h+)", meio: "meio período", parcial: "parcial", pontual: "pontual" };

function dados(xp, disc) {
  xp = xp || {}; disc = disc || {};
  const anos = Math.max(0, Math.min(Number(xp.xp1) || 0, 4));
  const canais = Array.isArray(xp.xp2) ? xp.xp2.filter((c) => c && c !== "Ainda não tenho canal definido") : [];
  return { xp, disc, anos, canais };
}

// Quebra do score em componentes (cada um com pontos obtidos e máximo).
export function detalharScore(xp, disc) {
  const { anos, canais } = dados(xp, disc);
  xp = xp || {}; disc = disc || {};
  const componentes = [
    { chave: "experiencia", label: "Experiência em vendas", pontos: Math.min(anos, 4) * 7.5, max: 30, valor: ANOS_LABEL[anos] || "não informado" },
    { chave: "canais", label: "Canais de venda", pontos: Math.min(canais.length, 6) * 3, max: 18, valor: canais.length ? `${canais.length} canal(is)` : "nenhum" },
    { chave: "tipoVenda", label: "Tipo de venda", pontos: TIPO_VENDA_PTS[xp.xp3] || 2, max: 12, valor: TIPO_LABEL[xp.xp3] || "não informado" },
    { chave: "dedicacao", label: "Disponibilidade", pontos: DEDICACAO_PTS[xp.xp4] || 5, max: 20, valor: DED_LABEL[xp.xp4] || "não informado" },
    { chave: "disc", label: "Perfil comportamental (DISC)", pontos: (disc.predominante ? 10 : 0) + (disc.secundario && disc.secundario !== disc.predominante ? 5 : 0), max: 15, valor: disc.predominante ? (DIMENSOES[disc.predominante]?.nome || disc.predominante) : "não concluído" },
    { chave: "base", label: "Cadastro completo", pontos: 5, max: 5, valor: "concluído" },
  ];
  const total = Math.min(Math.floor(componentes.reduce((s, c) => s + c.pontos, 0) * 100) / 100, 100);
  return { total, componentes };
}

// Pontos positivos e negativos (legíveis) a partir das respostas do quiz.
export function pontosVendedor(xp, disc) {
  const { anos, canais } = dados(xp, disc);
  xp = xp || {}; disc = disc || {};
  const positivos = [];
  const negativos = [];

  if (anos >= 3) positivos.push(`Boa bagagem em vendas (${ANOS_LABEL[anos]})`);
  else if (anos <= 1) negativos.push("Pouca experiência em vendas");

  if (canais.length >= 3) positivos.push(`Atua em vários canais de venda (${canais.length})`);
  else if (canais.length <= 1) negativos.push("Poucos canais de venda dominados");

  if (xp.xp3 === "ambos") positivos.push("Experiência em B2B e B2C");
  else if (!xp.xp3 || xp.xp3 === "nenhuma") negativos.push("Sem experiência B2B/B2C definida");

  if (xp.xp4 === "integral") positivos.push("Disponibilidade em tempo integral");
  else if (xp.xp4 === "parcial" || xp.xp4 === "pontual") negativos.push(`Disponibilidade ${DED_LABEL[xp.xp4]}`);

  if (disc.predominante && DIMENSOES[disc.predominante]) {
    const d = DIMENSOES[disc.predominante];
    positivos.push(`Perfil ${d.nome}: ${d.descricao.replace(/\.$/, "").toLowerCase()}`);
  } else {
    negativos.push("Perfil comportamental (DISC) não concluído");
  }

  return { positivos, negativos };
}

// Resumo em uma frase do porquê do score.
export function explicacaoScore(xp, disc) {
  const { componentes, total } = detalharScore(xp, disc);
  const fortes = componentes.filter((c) => c.max >= 12 && c.pontos / c.max >= 0.7).map((c) => c.label.toLowerCase());
  const fracos = componentes.filter((c) => c.max >= 12 && c.pontos / c.max < 0.4).map((c) => c.label.toLowerCase());
  const partes = [];
  if (fortes.length) partes.push(`puxado para cima por ${fortes.join(", ")}`);
  if (fracos.length) partes.push(`reduzido por ${fracos.join(", ")}`);
  return `Score ${Math.round(total)}% calculado a partir do cadastro: ${partes.length ? partes.join("; ") : "distribuição equilibrada entre os critérios"}.`;
}
