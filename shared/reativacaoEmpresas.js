// Reativação de empresas offline: 7 dias úteis, 1 e-mail por dia e WhatsApp
// nos dias 1, 3, 5 e 7. Quem cria ou retoma campanha sai na hora.
//
// Módulo puro (sem banco): segmenta, decide o passo do dia e monta os textos.
// O servidor (server/services/reativacaoEmpresas.js) busca os dados e envia.

export const SEQ = "reativacao_empresas";
export const DIA = 24 * 60 * 60 * 1000;
export const DIAS = 7;
export const DIAS_WHATSAPP = [1, 3, 5, 7];
export const HORA_EMAIL = 9;
export const HORA_WHATSAPP = 14;
export const FIM_JANELA = 20;
export const DIAS_NUNCA_ATIVOU = 3;
export const INATIVO_PADRAO = 15;
export const CARENCIA_DIAS = 60;
export const MAX_FALHAS_EMAIL = 3;

// Case do dia 4 e oferta do dia 6: só com resultado real e autorizado e com
// a oferta decidida. Enquanto estiverem vazios, o e-mail do dia é pulado.
// CASE: { empresa, reunioes, dias, resultado }  ·  OFERTA: { texto, prazoDias }
export const CASE = null;
export const OFERTA = null;

// ─── Horário de Brasília (UTC-3, sem horário de verão) ──────────────────────
const brt = (ms) => new Date(Number(ms) - 3 * 60 * 60 * 1000);
export const dataBrasilia = (ms) => brt(ms).toISOString().slice(0, 10);
export const horaBrasilia = (ms) => brt(ms).getUTCHours();
export const diaUtil = (ms) => { const d = brt(ms).getUTCDay(); return d >= 1 && d <= 5; };
export const janelaEmail = (ms) => diaUtil(ms) && horaBrasilia(ms) >= HORA_EMAIL && horaBrasilia(ms) < FIM_JANELA;
export const janelaWhatsapp = (ms) => diaUtil(ms) && horaBrasilia(ms) >= HORA_WHATSAPP && horaBrasilia(ms) < FIM_JANELA;

// ─── Segmentação ───────────────────────────────────────────────────────────
// `e`: { statusCadastro, criadoEm, campanhas, campanhasAtivas, ultimaCampanhaEm, ultimoAcessoEm }
export function segmentoDa(e, agora, { diasInativo = INATIVO_PADRAO } = {}) {
  if (e.statusCadastro !== "aprovada" || e.campanhasAtivas > 0) return null;
  if (!e.campanhas) return agora - (e.criadoEm || agora) > DIAS_NUNCA_ATIVOU * DIA ? "nunca_ativou" : null;
  const ultima = Math.max(e.ultimoAcessoEm || 0, e.ultimaCampanhaEm || 0, e.criadoEm || 0);
  return agora - ultima >= diasInativo * DIA ? "parou_de_usar" : null;
}

// Por que a empresa não entra na sequência agora ("" = pode entrar).
// `e`: { inscricaoAtiva, ultimaInscricaoEm, motivoEmail, motivoWhatsapp }
export function motivoDeFora(e, agora) {
  if (e.inscricaoAtiva) return "ja_inscrita";
  if (e.ultimaInscricaoEm && agora - e.ultimaInscricaoEm < CARENCIA_DIAS * DIA) return "carencia_60_dias";
  if (e.motivoEmail) return e.motivoEmail;
  if (e.motivoWhatsapp === "pediu_para_sair") return "whatsapp_pediu_para_sair";
  return "";
}

// Criou campanha depois de entrar, ou tem campanha ativa: reativou.
export const reativou = (e, inscricao) => e.campanhasAtivas > 0 || (e.ultimaCampanhaEm || 0) > inscricao.inicioEm;

// ─── Cronograma ────────────────────────────────────────────────────────────
// No máximo um passo por dia: o dia N só sai num dia útil depois do dia N-1.
export function proximoPasso(insc, agora) {
  if (!insc || insc.status !== "ativa") return null;
  if (insc.diaAtual > 0 && dataBrasilia(insc.ultimoPassoEm) >= dataBrasilia(agora)) return null;
  if (insc.diaAtual >= DIAS) return { concluir: true };
  if (!diaUtil(agora)) return null;
  return { dia: insc.diaAtual + 1 };
}

// WhatsApp do passo de hoje (dias 1, 3, 5 e 7), só na mesma data do passo.
export function whatsappDoPasso(insc, agora) {
  if (!insc || insc.status !== "ativa" || !DIAS_WHATSAPP.includes(insc.diaAtual)) return null;
  if (dataBrasilia(insc.ultimoPassoEm) !== dataBrasilia(agora)) return null;
  return { dia: insc.diaAtual, modelo: MODELOS_WHATSAPP[insc.diaAtual].nome };
}

// ─── Textos dos e-mails ────────────────────────────────────────────────────
const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function primeiroNome(nome) {
  const p = String(nome || "").trim().split(/\s+/)[0] || "";
  if (p.length < 2 || /\d/.test(p)) return "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

const TITULOS = {
  1: "Sua conta está parada", 2: "Vendedores disponíveis", 3: "Primeira campanha em 5 minutos",
  4: "Prova social", 5: "Monto com você em 15 minutos", 6: "Oferta para começar", 7: "Última mensagem",
};

// `d`: { nome (primeiro nome ou ""), empresa, vendedoresAtivos, diasInativo, linkAgenda, prazoOferta }
// Devolve { assunto, preheader, titulo, paragrafos (HTML seguro), botao, destino } ou { pular }.
export function textoEmail(dia, segmento, d) {
  const n = d.nome ? esc(d.nome) : "";
  const nt = d.nome || "";
  const e = `<b>${esc(d.empresa)}</b>`;
  const et = d.empresa;
  // "{nome}, resto" ou, sem nome, "Resto".
  const com = (nome, resto) => (nome ? `${nome}, ${resto}` : maiuscula(resto));
  const oi = n ? `Oi, ${n}.` : "Oi!";
  const parou = segmento === "parou_de_usar";
  let t;
  switch (dia) {
    case 1:
      t = parou ? {
        assunto: com(nt, `a operação da ${et} na Rycs parou`),
        paragrafos: [oi,
          `Faz ${Number(d.diasInativo) || 0} dias que nenhuma campanha da ${e} roda na Rycs.`,
          "Cada dia parado é um dia sem ninguém prospectando para você. Os vendedores continuam aqui, prontos para retomar de onde parou."],
        botao: "Retomar minha campanha",
      } : {
        assunto: com(nt, `a ${et} ainda não começou a vender na Rycs`),
        paragrafos: [oi,
          `Você criou a conta da ${e} na Rycs, mas nenhuma campanha está rodando.`,
          "Enquanto isso, tem vendedor esperando uma oportunidade para prospectar, agendar reunião e trazer cliente para você.",
          "Funciona assim: você cria a campanha, os vendedores executam, e você paga só pelo que acontecer. Reunião agendada, reunião realizada, venda fechada."],
        botao: "Ativar minha campanha",
      };
      t.preheader = "Os vendedores estão prontos. Falta só você ligar.";
      break;
    case 2: {
      const v = Number(d.vendedoresAtivos) || 0;
      if (v < 1) return { pular: "sem_vendedores_ativos" };
      t = {
        assunto: `${v} vendedores disponíveis para a ${et}`,
        preheader: "Prontos para prospectar para você essa semana.",
        paragrafos: [
          com(n, `hoje a Rycs tem <b>${v} vendedores ativos</b> esperando campanhas novas.`),
          "Eles prospectam, agendam reuniões e fazem o primeiro contato com seus clientes. Todos passam pela Rycs Sales Academy.",
          "Você não contrata, não paga salário e não treina ninguém. Só paga quando a tarefa é entregue."],
        botao: "Colocar vendedores para trabalhar",
      };
      break;
    }
    case 3:
      t = {
        assunto: "Sua primeira campanha leva 5 minutos",
        preheader: "Três passos e os vendedores começam.",
        paragrafos: [
          com(n, "montar uma campanha na Rycs é mais simples do que parece:"),
          "1. Diga quem é o seu cliente ideal.<br/>2. Escolha a tarefa e quanto paga por ela.<br/>3. Publique.",
          "A partir daí, os vendedores pegam a tarefa e você acompanha tudo pelo painel."],
        botao: "Criar campanha agora",
      };
      break;
    case 4: {
      if (!CASE) return { pular: "sem_case" };
      t = {
        assunto: `Como a ${CASE.empresa} gerou ${CASE.reunioes} reuniões em ${CASE.dias} dias`,
        preheader: "Sem contratar nenhum vendedor.",
        paragrafos: [
          com(n, `a ${esc(CASE.empresa)} tinha o mesmo problema de muita empresa: precisava de reunião com cliente e não tinha time para prospectar.`),
          `Ela criou uma campanha na Rycs e, em ${esc(CASE.dias)} dias, os vendedores agendaram ${esc(CASE.reunioes)} reuniões. ${esc(CASE.resultado)}`,
          `A ${e} pode começar do mesmo jeito.`],
        botao: "Quero esse resultado",
      };
      break;
    }
    case 5:
      if (!d.linkAgenda) return { pular: "sem_link_agenda" };
      t = {
        assunto: "Quer que eu monte a campanha com você?",
        preheader: "15 minutos e ela sai pronta.",
        paragrafos: [
          com(n, "às vezes o que falta é só alguém sentar junto."),
          `Me dá 15 minutos que eu configuro a primeira campanha da ${e} com você, ao vivo. Você sai da conversa com os vendedores já trabalhando.`],
        botao: "Agendar 15 minutos",
        destino: "agenda",
      };
      break;
    case 6:
      if (!OFERTA || !d.prazoOferta) return { pular: "sem_oferta" };
      t = {
        assunto: `Um empurrão para a ${et} começar`,
        preheader: `Válido até ${d.prazoOferta}.`,
        paragrafos: [
          com(n, "quero facilitar sua decisão."),
          `Ativando uma campanha até ${esc(d.prazoOferta)}, você ganha ${esc(OFERTA.texto)}.`,
          "Sem letra miúda: é só criar a campanha dentro do prazo."],
        botao: "Aproveitar a oferta",
      };
      break;
    case 7:
      t = {
        assunto: nt ? `Última mensagem sobre isso, ${nt}` : "Última mensagem sobre isso",
        preheader: "Depois disso, eu paro de insistir.",
        paragrafos: [
          com(n, "esse é o último e-mail dessa série."),
          "Se agora não é o momento, tudo bem. Sua conta continua aqui.",
          `Se for, é um clique para os vendedores começarem a trabalhar para a ${e}.`],
        botao: "Ativar agora",
      };
      break;
    default:
      return { pular: "dia_invalido" };
  }
  return { destino: "campanha", titulo: TITULOS[dia], ...t };
}

// ─── WhatsApp ──────────────────────────────────────────────────────────────
// Corpo não pode começar nem terminar com variável (regra da Meta).
export const LINK_BASE_WHATSAPP = "https://app.rycs.pro/";
export const MODELOS_WHATSAPP = {
  1: {
    nome: "rycs_reativacao_d1", variaveis: ["nome", "empresa"],
    corpo: "Oi, {{1}}! Aqui é o Martin, da Rycs. A conta da {{2}} está sem nenhuma campanha rodando. Nossos vendedores estão prontos para prospectar e agendar reuniões para você, e você só paga pelo que acontecer.",
    botoes: [{ tipo: "URL", texto: "Ativar campanha" }, { tipo: "QUICK_REPLY", texto: "Parar mensagens", acao: "parar" }],
  },
  3: {
    nome: "rycs_reativacao_d3", variaveis: ["nome", "vendedoresAtivos"],
    corpo: "Oi, {{1}}! Criar a primeira campanha na Rycs leva uns 5 minutos: você define o cliente ideal, escolhe a tarefa e publica. Hoje temos {{2}} vendedores disponíveis.",
    botoes: [{ tipo: "URL", texto: "Criar campanha" }, { tipo: "QUICK_REPLY", texto: "Parar mensagens", acao: "parar" }],
  },
  5: {
    nome: "rycs_reativacao_d5", variaveis: ["nome", "empresa"],
    corpo: "Oi, {{1}}! Quer que eu configure a primeira campanha da {{2}} junto com você? São 15 minutos e você sai com os vendedores trabalhando.",
    botoes: [
      { tipo: "QUICK_REPLY", texto: "Quero agendar", acao: "agendar" },
      { tipo: "QUICK_REPLY", texto: "Agora não", acao: "agora_nao" },
      { tipo: "QUICK_REPLY", texto: "Parar mensagens", acao: "parar" }],
  },
  7: {
    nome: "rycs_reativacao_d7", variaveis: ["nome"],
    corpo: "Oi, {{1}}! Essa é minha última mensagem sobre isso. Se fizer sentido retomar, é só tocar no botão abaixo. Se não, tudo certo, sua conta continua lá.",
    botoes: [{ tipo: "URL", texto: "Retomar agora" }, { tipo: "QUICK_REPLY", texto: "Parar mensagens", acao: "parar" }],
  },
};
export const IDIOMA_WHATSAPP = "pt_BR";
export const sufixoLinkWhatsapp = (dia) =>
  `?aba=campanhas&utm_source=whatsapp&utm_campaign=${SEQ}&utm_content=dia_${dia}`;

// Valores das variáveis, na ordem. Sem nome, usa o nome da empresa.
// `d`: { nome, empresa, vendedoresAtivos }. Valor vazio = não dá para enviar.
export function parametrosWhatsapp(dia, d) {
  const m = MODELOS_WHATSAPP[dia];
  if (!m) return null;
  const valores = { nome: d.nome || d.empresa || "", empresa: d.empresa || "", vendedoresAtivos: Number(d.vendedoresAtivos) > 0 ? String(d.vendedoresAtivos) : "" };
  return m.variaveis.map((v) => String(valores[v] || "").trim());
}

// Payload dos botões de resposta: identifica a inscrição e a ação.
export const payloadResposta = (acao, inscricaoId) => `reativacao:${acao}:${inscricaoId}`;
export function lerPayload(p) {
  const [prefixo, acao, inscricaoId] = String(p || "").split(":");
  if (prefixo !== "reativacao" || !["parar", "agendar", "agora_nao"].includes(acao)) return null;
  return { acao, inscricaoId: inscricaoId || "" };
}

// JSON de criação dos modelos (Graph API /message_templates), para revisão.
export function modelosParaMeta() {
  const exemplos = { nome: "Ana", empresa: "Sua Empresa", vendedoresAtivos: "40" };
  return Object.entries(MODELOS_WHATSAPP).map(([dia, m]) => ({
    name: m.nome,
    language: IDIOMA_WHATSAPP,
    category: "MARKETING",
    components: [
      { type: "BODY", text: m.corpo, example: { body_text: [m.variaveis.map((v) => exemplos[v])] } },
      { type: "FOOTER", text: "Rycs" },
      {
        type: "BUTTONS",
        buttons: m.botoes.map((b) => (b.tipo === "URL"
          ? { type: "URL", text: b.texto, url: `${LINK_BASE_WHATSAPP}{{1}}`, example: [`${LINK_BASE_WHATSAPP}${sufixoLinkWhatsapp(dia)}`] }
          : { type: "QUICK_REPLY", text: b.texto })),
      },
    ],
  }));
}
