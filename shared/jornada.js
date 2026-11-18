// Jornada de cada profissional e de cada empresa, do primeiro clique (anúncio
// da Meta, Google, convite ou acesso direto) até a última etapa operacional.
//
// O servidor junta os marcos que já existem nas tabelas de origem; aqui fica só
// a regra: quais são as etapas, em que ordem, onde a pessoa parou e há quanto
// tempo. As etapas não precisam ser cumpridas em ordem — "onde parou" é a
// primeira que ainda falta.

export const ETAPAS_VENDEDOR = [
  { chave: "acesso", label: "Primeiro acesso" },
  { chave: "conta", label: "Conta criada" },
  { chave: "email", label: "E-mail confirmado" },
  { chave: "perfil", label: "Perfil completo" },
  { chave: "academy", label: "Iniciou a Academy" },
  { chave: "candidatura", label: "Candidatou-se a campanha" },
  { chave: "aprovado", label: "Aprovado em campanha" },
  { chave: "acao", label: "Enviou a 1ª ação" },
  { chave: "acao_aprovada", label: "1ª ação aprovada" },
  { chave: "pagamento", label: "Recebeu o 1º pagamento" },
];

export const ETAPAS_EMPRESA = [
  { chave: "acesso", label: "Primeiro acesso" },
  { chave: "conta", label: "Conta criada" },
  { chave: "empresa", label: "Dados da empresa" },
  { chave: "academy", label: "Marketing Academy" },
  { chave: "ia", label: "IA configurada" },
  { chave: "plano", label: "Plano escolhido" },
  { chave: "campanha", label: "Criou campanha" },
  { chave: "publicada", label: "Campanha publicada" },
  { chave: "saldo", label: "Depositou saldo" },
  { chave: "profissional", label: "Aprovou profissional" },
  { chave: "acao", label: "Recebeu a 1ª ação" },
  { chave: "conversao", label: "1ª ação aprovada" },
];

// Etapas do formulário de cadastro, antes de a conta existir.
export const ETAPAS_CADASTRO = {
  vendedor: [
    { chave: "pessoal", label: "Dados pessoais" },
    { chave: "profissional", label: "Perfil profissional" },
    { chave: "experiencia", label: "Experiência" },
  ],
  empresa: [{ chave: "acesso", label: "Dados de acesso enviados" }],
};

export const EVENTOS_PUBLICOS = ["visita", "cadastro_aberto", "cadastro_etapa"];

export const CAMPOS_ORIGEM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "landing", "referrer"];

export const ORIGENS = {
  meta: "Meta Ads",
  google: "Google",
  convite: "Convite",
  outros: "Outras campanhas",
  organico: "Direto / orgânico",
};

const DIA = 24 * 60 * 60 * 1000;

// Mantém só os campos conhecidos, como texto curto. Entra dado de fora
// (query string, corpo de requisição pública): nada além disso é guardado.
export function limparOrigem(origem) {
  if (!origem || typeof origem !== "object") return {};
  const limpo = {};
  for (const campo of CAMPOS_ORIGEM) {
    const v = origem[campo];
    if (v == null || v === "") continue;
    // fbclid/gclid passam de 120 caracteres, e cortados não servem para a Meta/Google.
    limpo[campo] = String(v).slice(0, campo === "fbclid" || campo === "gclid" ? 500 : 120);
  }
  return limpo;
}

export function classificarOrigem(origem = {}) {
  const fonte = String(origem.utm_source || "").toLowerCase();
  const meio = String(origem.utm_medium || "").toLowerCase();
  if (origem.fbclid || /^(fb|facebook|ig|instagram|meta|an|msg)$|facebook|instagram/.test(fonte)) return "meta";
  if (origem.gclid || /google|youtube/.test(fonte)) return "google";
  if (/convite|indica|referral/.test(meio) || fonte === "plataforma") return "convite";
  if (fonte) return "outros";
  return "organico";
}

// marcos: { [chave]: timestamp | true | null }. `true` = feito sem data conhecida.
export function montarJornada(definicao, marcos = {}, agora = Date.now()) {
  const etapas = definicao.map((e) => {
    const m = marcos[e.chave];
    return { chave: e.chave, label: e.label, feito: !!m, em: typeof m === "number" ? m : null };
  });
  const concluidas = etapas.filter((e) => e.feito).length;
  const atual = etapas.find((e) => !e.feito) || null;
  const datas = etapas.map((e) => e.em).filter(Boolean);
  const ultimaAtividade = datas.length ? Math.max(...datas) : null;
  return {
    etapas,
    concluidas,
    total: etapas.length,
    pct: Math.round((concluidas / etapas.length) * 100),
    etapaAtual: atual ? { chave: atual.chave, label: atual.label } : null,
    ultimaAtividade,
    diasParado: atual && ultimaAtividade ? Math.max(0, Math.floor((agora - ultimaAtividade) / DIA)) : null,
  };
}

// Quantos chegaram a cada etapa e quanto se perdeu em relação à anterior.
export function agregarFunil(definicao, jornadas) {
  const base = jornadas.length;
  let anterior = base;
  return definicao.map((e, i) => {
    const total = jornadas.filter((j) => j.etapas[i]?.feito).length;
    const linha = {
      chave: e.chave,
      label: e.label,
      total,
      pct: base ? Math.round((total / base) * 100) : 0,
      perdidos: Math.max(0, anterior - total),
      paradosAqui: jornadas.filter((j) => j.etapaAtual?.chave === e.chave).length,
    };
    anterior = total;
    return linha;
  });
}
