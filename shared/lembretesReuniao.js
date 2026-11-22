// Fluxo de mensagens da reunião marcada pelo quiz (/diagnostico): confirmação
// na hora e lembretes até o horário, pelo WhatsApp oficial da RYCS (modelos
// de Utilidade, aprovados pela Meta) e por e-mail.
//
// Cuidado com a conta do WhatsApp (pedido do dono da RYCS): lembrete de 12 em
// 12 horas só nas últimas 48 horas, nada entre 22h e 7h (Brasília), e quem
// pede para sair não recebe mais nada. Os textos são aviso de compromisso,
// não oferta — é o que mantém os modelos na categoria Utilidade.

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const FUSO = "America/Sao_Paulo";

// Modelos do WhatsApp. {{1}} nome, {{2}} data ou "em quanto tempo", {{3}} hora.
// O corpo aqui é o mesmo cadastrado na Meta (conta de mensagens "Rycs Sales
// Machine"); a Meta não aceita corpo que comece com variável.
export const MODELOS_LEMBRETE = {
  confirmacao: {
    nome: "rycs_reuniao_confirmada",
    corpo: "Olá, {{1}}! Sua reunião com a RYCS está confirmada para {{2}}, às {{3}} (horário de Brasília).\n\nNo horário, um especialista da RYCS chama você aqui neste WhatsApp, por ligação ou chamada de vídeo.\n\nSe precisar remarcar, é só responder esta mensagem.",
    exemplo: ["Ana", "segunda-feira, 23/11", "10:00"],
  },
  lembrete: {
    nome: "rycs_reuniao_lembrete",
    corpo: "Olá, {{1}}! Passando para lembrar da sua reunião com a RYCS: {{2}}, às {{3}} (horário de Brasília).\n\nO especialista vai chamar você aqui no WhatsApp. Se não puder no horário, responda esta mensagem para remarcarmos.",
    exemplo: ["Ana", "amanhã", "10:00"],
  },
  em_breve: {
    nome: "rycs_reuniao_em_breve",
    corpo: "Olá, {{1}}! Sua reunião com a RYCS começa em {{2}}, às {{3}} (horário de Brasília).\n\nDeixe o WhatsApp por perto: o especialista chama você por aqui.",
    exemplo: ["Ana", "1 hora", "10:00"],
  },
};
export const IDIOMA_MODELOS = "pt_BR";

// Cronograma: confirmação na hora; de 12 em 12 horas nas últimas 48 horas;
// 2 horas e 1 hora antes.
const ETAPAS = [
  { tipo: "lembrete-48h", modelo: "lembrete", antes: 48 * HORA },
  { tipo: "lembrete-36h", modelo: "lembrete", antes: 36 * HORA },
  { tipo: "lembrete-24h", modelo: "lembrete", antes: 24 * HORA },
  { tipo: "lembrete-12h", modelo: "lembrete", antes: 12 * HORA },
  { tipo: "em-breve-2h", modelo: "em_breve", antes: 2 * HORA },
  { tipo: "em-breve-1h", modelo: "em_breve", antes: 1 * HORA },
];
export const MODELO_DO_TIPO = Object.fromEntries([["confirmacao", "confirmacao"], ...ETAPAS.map((e) => [e.tipo, e.modelo])]);

// Hora de Brasília (UTC−3, sem horário de verão desde 2019).
const horaBrasilia = (t) => new Date(t - 3 * HORA).getUTCHours();
export const horarioSilencioso = (t) => { const h = horaBrasilia(t); return h >= 22 || h < 7; };

export function cronogramaLembretes(inicio, agora) {
  const lista = [{ tipo: "confirmacao", enviarEm: agora }];
  for (const e of ETAPAS) {
    const enviarEm = inicio - e.antes;
    // Os de 12 em 12 horas não colam na confirmação; os de 2h e 1h só não
    // saem se o horário já passou.
    const folga = e.modelo === "lembrete" ? 2 * HORA : 10 * MIN;
    if (enviarEm < agora + folga || horarioSilencioso(enviarEm)) continue;
    lista.push({ tipo: e.tipo, enviarEm });
  }
  return lista;
}

// ── Textos ─────────────────────────────────────────────────────────────
const dataBR = (t, opcoes) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, ...opcoes }).format(new Date(t));
const diaBR = (t) => dataBR(t, { year: "numeric", month: "2-digit", day: "2-digit" });
export const horaReuniao = (t) => dataBR(t, { hour: "2-digit", minute: "2-digit" });
export const dataReuniao = (t) => `${dataBR(t, { weekday: "long" })}, ${dataBR(t, { day: "2-digit", month: "2-digit" })}`;
// "hoje", "amanhã" ou "segunda-feira, 23/11", no relógio de Brasília.
export function quandoReuniao(inicio, agora) {
  if (diaBR(inicio) === diaBR(agora)) return "hoje";
  if (diaBR(inicio) === diaBR(agora + 24 * HORA)) return "amanhã";
  return dataReuniao(inicio);
}
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "tudo bem";
const escapar = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Uma mensagem pronta para os dois canais: variáveis do modelo do WhatsApp e
// assunto/parágrafos do e-mail.
export function mensagemLembrete(tipo, { nome, inicio, telefone = "" }, agora) {
  const modelo = MODELO_DO_TIPO[tipo];
  const n = primeiroNome(nome);
  const hora = horaReuniao(inicio);
  if (modelo === "confirmacao") {
    const data = dataReuniao(inicio);
    return {
      modelo, variaveis: [n, data, hora],
      assunto: `Reunião confirmada: ${data}, às ${hora}`,
      titulo: "Sua reunião com a RYCS está confirmada",
      paragrafos: [
        `Olá, ${escapar(n)}! Sua reunião com a RYCS está confirmada para <strong>${escapar(data)}, às ${hora}</strong> (horário de Brasília).`,
        `No horário, um especialista da RYCS chama você no WhatsApp${telefone ? ` ${escapar(telefone)}` : ""}, por ligação ou chamada de vídeo.`,
        "Para aproveitar melhor, tenha à mão o valor médio de uma venda e quantas vendas vocês fazem por mês. Se alguém decide com você, convide para participar.",
      ],
    };
  }
  if (modelo === "lembrete") {
    const quando = quandoReuniao(inicio, agora);
    return {
      modelo, variaveis: [n, quando, hora],
      assunto: `Lembrete: sua reunião com a RYCS é ${quando}, às ${hora}`,
      titulo: `Sua reunião é ${quando}, às ${hora}`,
      paragrafos: [
        `${escapar(n)}, passando para lembrar da sua reunião com a RYCS: <strong>${escapar(quando)}, às ${hora}</strong> (horário de Brasília).`,
        "O especialista vai chamar você no WhatsApp. Se não puder no horário, avise pelo WhatsApp da RYCS para remarcarmos.",
      ],
    };
  }
  const falta = tipo === "em-breve-2h" ? "2 horas" : "1 hora";
  return {
    modelo, variaveis: [n, falta, hora],
    assunto: `Sua reunião com a RYCS começa em ${falta}`,
    titulo: `Começa em ${falta}, às ${hora}`,
    paragrafos: [
      `${escapar(n)}, sua reunião com a RYCS começa em <strong>${falta}, às ${hora}</strong> (horário de Brasília).`,
      "Deixe o WhatsApp por perto: o especialista chama você por lá.",
    ],
  };
}
