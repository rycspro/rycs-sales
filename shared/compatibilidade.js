// Compatibilidade entre um profissional e uma campanha da empresa.
//
// Determinística e rastreável: parte de uma base e soma pontos por sinais reais
// (função, região, segmento, preferências, disponibilidade, score operacional).
// Devolve o percentual (0–100) e as listas de pontos fortes e de atenção.
//
// Mesma lógica usada na lista de Profissionais e nas Aprovações de campanha —
// mora aqui para não existir em duas cópias que possam divergir.

const arr = (v) => (Array.isArray(v) ? v : []);
const nota = (n) => Number(n || 0);
const norm = (v) => String(v || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

export function compatibilidadeSellerCampanha(p = {}, campanha = {}, emp = {}) {
  const pontos = [];
  const atencao = [];
  let score = 35;

  if (campanha.funcao && p.perfil === campanha.funcao) { score += 18; pontos.push("função alinhada à campanha"); }
  else if (campanha.funcao) atencao.push("função principal diferente da campanha");

  if (campanha.regiao && norm(`${p.cidade} ${p.estado} ${arr(p.regioes).join(" ")}`).includes(norm(campanha.regiao))) { score += 10; pontos.push("região compatível"); }
  else if (campanha.regiao) atencao.push("região não confirmada");

  if (campanha.segmento && arr(p.segmentos).some((s) => norm(campanha.segmento).includes(norm(s)) || norm(s).includes(norm(campanha.segmento)))) { score += 14; pontos.push("experiência no segmento"); }
  else if (campanha.segmento) atencao.push("segmento sem histórico explícito");

  if (arr(p.modalidades).some((m) => norm(`${emp.produto} ${emp.icp} ${campanha.objetivo}`).includes(norm(m)))) { score += 8; pontos.push("preferências próximas da operação"); }

  if (p.disponibilidade) { score += 7; pontos.push("disponibilidade declarada"); }
  else atencao.push("disponibilidade não informada");

  if (nota(p.nota) >= 80) { score += 8; pontos.push("score operacional alto"); }
  else atencao.push("score requer acompanhamento");

  return {
    percentual: Math.min(100, score),
    pontos: pontos.length ? pontos : ["dados reais disponíveis, sem compatibilidade forte registrada"],
    atencao: atencao.length ? atencao : ["sem ponto crítico identificado nos dados disponíveis"],
  };
}
