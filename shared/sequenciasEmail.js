// Sequências automáticas de e-mail do funil (profissional e empresa).
//
// Regras gerais:
// - no máximo 1 e-mail de sequência por pessoa a cada 20h;
// - quem cumpre a ação sai da sequência (o passo é pulado na hora do envio);
// - cada e-mail tem um único botão;
// - descadastro em todos; quem se descadastra não recebe mais nenhum;
// - domínio aquecido aos poucos: teto diário global que cresce por dia.
//
// Este módulo é puro (sem banco): decide QUAL e-mail cabe agora para uma
// pessoa e monta o texto. O servidor busca o contexto e envia.

import { VALOR_EMPRESA_ATIVA, PCT_PRIMEIRA_MENSALIDADE, BONUS_INDICACAO_PROFISSIONAIS } from "./indicacoes.js";
import { PLANOS_PROFISSIONAL } from "./planosProfissional.js";

export const DIA = 24 * 60 * 60 * 1000;
export const INTERVALO_MIN_POR_PESSOA = 20 * 60 * 60 * 1000;
export const DIAS_INATIVIDADE = 5;
// Janela de envio no horário de Brasília (UTC-3).
export const JANELA_ENVIO = { de: 9, ate: 20 };
// Aquecimento: começa em 150/dia e sobe 50 por dia até o teto.
export const AQUECIMENTO = { inicial: 150, passo: 50, teto: 2000 };

export const tetoDoDia = (diasDesdeLancamento) =>
  Math.min(AQUECIMENTO.teto, AQUECIMENTO.inicial + AQUECIMENTO.passo * Math.max(0, Math.floor(diasDesdeLancamento)));

export function dentroDaJanela(agora) {
  const horaBrasilia = (new Date(agora).getUTCHours() + 24 - 3) % 24;
  return horaBrasilia >= JANELA_ENVIO.de && horaBrasilia < JANELA_ENVIO.ate;
}

// Profissional no Brasil recebe em português; os demais (Índia, etc.) em inglês.
export function idiomaDoPais(pais) {
  const p = String(pais || "").trim().toLowerCase();
  if (!p || p === "brasil" || p === "brazil" || p === "br") return "pt";
  return "en";
}

// Ordem = prioridade quando o teto diário aperta.
export const SEQUENCIAS = {
  onboarding: { nome: "Onboarding", publico: "vendedor" },
  indicacoes: { nome: "Indicações", publico: "vendedor" },
  graduacao: { nome: "Graduação", publico: "vendedor" },
  repescagem: { nome: "Repescagem", publico: "vendedor" },
  // Desligada: substituída pela reativação (shared/reativacaoEmpresas.js). Fica
  // aqui só para o histórico de envios aparecer no painel.
  empresas_offline: { nome: "Empresas offline (desligada)", publico: "empresa" },
  reativacao_empresas: { nome: "Reativação de empresas", publico: "empresa" },
};
export const ORDEM_SEQUENCIAS = Object.keys(SEQUENCIAS);

const diasDesde = (ts, agora) => (agora - ts) / DIA;
// Episódio de inatividade: o mesmo período parado não repete a sequência, mas
// um novo período (depois de voltar a usar) começa outra.
const episodio = (ultimaAtividade) => new Date(ultimaAtividade).toISOString().slice(0, 10);

// Decide o próximo e-mail para um profissional. `ctx`:
// { ancora, novo, perfilCompleto, inativo, indicacaoUsada, plano,
//   ultimaAtividade, enviados: Map<chave, enviadoEm> }
export function proximoEmailVendedor(ctx, agora) {
  const dia = diasDesde(ctx.ancora, agora);
  const ja = (c) => ctx.enviados.has(c);
  const passos = [
    { chave: "onboarding:boas_vindas", seq: "onboarding", quando: ctx.novo && dia >= 0 && dia < 2 },
    { chave: "onboarding:perfil_falta", seq: "onboarding", quando: dia >= 1 && !ctx.perfilCompleto && !ctx.inativo },
    { chave: "onboarding:oportunidade", seq: "onboarding", quando: dia >= 2 && !ctx.inativo },
    { chave: "onboarding:aviso_inativacao", seq: "onboarding", quando: dia >= 3 && !ctx.perfilCompleto && !ctx.inativo },
    { chave: "indicacoes:indique", seq: "indicacoes", quando: dia >= 4 && ctx.perfilCompleto && !ctx.inativo },
    { chave: "indicacoes:codigo_nao_usado", seq: "indicacoes", quando: dia >= 5 && ctx.perfilCompleto && !ctx.indicacaoUsada && ja("indicacoes:indique") },
    { chave: "graduacao:academy", seq: "graduacao", quando: dia >= 6 && !ctx.inativo },
    { chave: "graduacao:planos", seq: "graduacao", quando: dia >= 7 && !ctx.inativo && (ctx.plano || "gratis") === "gratis" },
  ];
  for (const p of passos) if (p.quando && !ja(p.chave)) return p;

  // Repescagem só depois do onboarding, para não atropelar a sequência inicial.
  const parado = diasDesde(ctx.ultimaAtividade, agora);
  if (dia >= 8 && !ctx.inativo && parado >= DIAS_INATIVIDADE) {
    const ep = episodio(ctx.ultimaAtividade);
    const em = (c) => ctx.enviados.get(`repescagem:${c}@${ep}`);
    const rep = [
      { chave: `repescagem:precisa@${ep}`, quando: true },
      { chave: `repescagem:novas@${ep}`, quando: !!em("precisa") && agora - em("precisa") >= 3 * DIA },
      { chave: `repescagem:ultima@${ep}`, quando: !!em("novas") && agora - em("novas") >= 4 * DIA },
    ];
    for (const p of rep) if (p.quando && !ja(p.chave)) return { ...p, seq: "repescagem" };
  }
  return null;
}

// ─── Textos ────────────────────────────────────────────────────────────────

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";
const brl = (v, idioma) => idioma === "en"
  ? `BRL ${Number(v).toFixed(2)}`
  : `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
const pct = Math.round(PCT_PRIMEIRA_MENSALIDADE * 100);
const pro = PLANOS_PROFISSIONAL.pro.preco;
const premium = PLANOS_PROFISSIONAL.premium.preco;
const bloco = BONUS_INDICACAO_PROFISSIONAIS.bloco;

// Cada texto devolve { assunto, titulo, paragrafos (HTML seguro), botao, aba }.
// `aba` é a tela da plataforma que o botão abre.
const TEXTOS = {
  "onboarding:boas_vindas": {
    pt: (d) => ({
      assunto: `${d.n}, bem-vindo à RYCS`,
      titulo: `Bem-vindo à RYCS, ${d.n}`,
      paragrafos: [
        "A RYCS conecta você a empresas que pagam por cada ação de venda: prospecção, agendamento de reunião e fechamento.",
        "Você escolhe as campanhas, faz as ações e recebe por cada uma aprovada. O saque é por Pix.",
        "O primeiro passo é completar o seu perfil. É ele que as empresas veem antes de aceitar você.",
      ],
      botao: "Completar meu perfil", aba: "perfil",
    }),
    en: (d) => ({
      assunto: `${d.n}, welcome to RYCS`,
      titulo: `Welcome to RYCS, ${d.n}`,
      paragrafos: [
        "RYCS connects you with companies that pay for each sales action: prospecting, booking meetings and closing.",
        "You pick the campaigns, do the actions and get paid for each one that is approved.",
        "Your first step is to complete your profile. It is what companies see before they accept you.",
      ],
      botao: "Complete my profile", aba: "perfil",
    }),
  },
  "onboarding:perfil_falta": {
    pt: (d) => ({
      assunto: `${d.n}, falta pouco pro seu perfil ser aprovado`,
      titulo: "Falta pouco para o seu perfil ser aprovado",
      paragrafos: [
        `Ainda falta: <b>${esc(d.pendencias.join(", "))}</b>.`,
        "Perfil com foto e descrição é o que faz a empresa aceitar você nas campanhas. Leva uns 5 minutos.",
      ],
      botao: "Colocar foto e descrição", aba: "perfil",
    }),
    en: (d) => ({
      assunto: `${d.n}, your profile is almost ready`,
      titulo: "Your profile is almost ready",
      paragrafos: [
        `Still missing: <b>${esc(d.pendencias.join(", "))}</b>.`,
        "A profile with a photo and a description is what gets you accepted into campaigns. It takes about 5 minutes.",
      ],
      botao: "Add photo and description", aba: "perfil",
    }),
  },
  "onboarding:oportunidade": {
    pt: (d) => ({
      assunto: `${d.n}, sua primeira oportunidade`,
      titulo: "Sua primeira oportunidade",
      paragrafos: [
        d.campanhasAtivas > 0
          ? `Hoje há <b>${d.campanhasAtivas} ${d.campanhasAtivas === 1 ? "campanha ativa" : "campanhas ativas"}</b> na RYCS esperando profissionais.`
          : "Novas campanhas entram na RYCS toda semana.",
        `E você também ganha trazendo empresas: <b>${brl(VALOR_EMPRESA_ATIVA, "pt")}</b> por empresa cadastrada e aprovada, e <b>${pct}% da primeira mensalidade</b> quando ela assina um plano pago.`,
      ],
      botao: "Ver oportunidades", aba: "oportunidades",
    }),
    en: (d) => ({
      assunto: `${d.n}, your first opportunity`,
      titulo: "Your first opportunity",
      paragrafos: [
        d.campanhasAtivas > 0
          ? `There ${d.campanhasAtivas === 1 ? "is" : "are"} <b>${d.campanhasAtivas} active ${d.campanhasAtivas === 1 ? "campaign" : "campaigns"}</b> on RYCS waiting for professionals today.`
          : "New campaigns join RYCS every week.",
        `You also earn by bringing companies: <b>${brl(VALOR_EMPRESA_ATIVA, "en")}</b> for each company that signs up and is approved, plus <b>${pct}% of its first monthly fee</b> when it subscribes to a paid plan.`,
      ],
      botao: "See opportunities", aba: "oportunidades",
    }),
  },
  // Lembrete de perfil. A chave guarda o nome antigo por causa do histórico de envios.
  "onboarding:aviso_inativacao": {
    pt: (d) => ({
      assunto: `${d.n}, complete seu perfil e apareça primeiro`,
      titulo: "Complete seu perfil e apareça primeiro",
      paragrafos: [
        `Seu perfil continua incompleto. Falta: <b>${esc(d.pendencias.join(", "))}</b>.`,
        "Sua conta continua ativa. Na lista que as empresas veem, os perfis mais completos aparecem primeiro.",
      ],
      botao: "Completar meu perfil", aba: "perfil",
    }),
    en: (d) => ({
      assunto: `${d.n}, complete your profile and show up first`,
      titulo: "Complete your profile and show up first",
      paragrafos: [
        `Your profile is still incomplete. Missing: <b>${esc(d.pendencias.join(", "))}</b>.`,
        "Your account stays active. In the list companies see, the most complete profiles show up first.",
      ],
      botao: "Complete my profile", aba: "perfil",
    }),
  },
  "indicacoes:indique": {
    pt: (d) => ({
      assunto: `${d.n}, indique ${bloco} profissionais e ganhe um bônus`,
      titulo: `Indique ${bloco} profissionais e ganhe ${brl(BONUS_INDICACAO_PROFISSIONAIS.valor, "pt")}`,
      paragrafos: [
        `A cada ${bloco} profissionais que entram pelo seu link e completam o perfil, você ganha <b>${brl(BONUS_INDICACAO_PROFISSIONAIS.valor, "pt")}</b> no saldo.`,
        `Seu código: <b>${esc(d.codigo)}</b>. O botão abaixo leva para a página com o seu link pronto para copiar.`,
      ],
      botao: "Pegar meu link de indicação", aba: "indicar",
    }),
    en: (d) => ({
      assunto: `${d.n}, refer ${bloco} professionals and earn a bonus`,
      titulo: `Refer ${bloco} professionals and earn ${brl(BONUS_INDICACAO_PROFISSIONAIS.valor, "en")}`,
      paragrafos: [
        `For every ${bloco} professionals who join through your link and complete their profile, you get <b>${brl(BONUS_INDICACAO_PROFISSIONAIS.valor, "en")}</b> in your balance.`,
        `Your code: <b>${esc(d.codigo)}</b>. The button below opens the page with your link ready to copy.`,
      ],
      botao: "Get my referral link", aba: "indicar",
    }),
  },
  "indicacoes:codigo_nao_usado": {
    pt: (d) => ({
      assunto: `${d.n}, seu código de indicação ainda não foi usado`,
      titulo: "Seu código de indicação ainda não foi usado",
      paragrafos: [
        `Ninguém entrou com o código <b>${esc(d.codigo)}</b> ainda.`,
        "Mande o link para colegas de vendas no WhatsApp ou no LinkedIn. Quem entra e completa o perfil conta para o seu bônus.",
      ],
      botao: "Compartilhar meu link", aba: "indicar",
    }),
    en: (d) => ({
      assunto: `${d.n}, your referral code hasn't been used yet`,
      titulo: "Your referral code hasn't been used yet",
      paragrafos: [
        `Nobody has joined with code <b>${esc(d.codigo)}</b> yet.`,
        "Send the link to sales colleagues on WhatsApp or LinkedIn. Everyone who joins and completes their profile counts toward your bonus.",
      ],
      botao: "Share my link", aba: "indicar",
    }),
  },
  "graduacao:academy": {
    pt: (d) => ({
      assunto: `${d.n}, conheça a RYCS Sales Academy`,
      titulo: "RYCS Sales Academy",
      paragrafos: [
        "Na Academy você faz os cursos de vendas da RYCS e ganha a certificação, que você leva para a vida toda.",
        "Os cursos estão liberados na sua conta. Comece pelo primeiro módulo.",
      ],
      botao: "Abrir a Academy", aba: "academy",
    }),
    en: (d) => ({
      assunto: `${d.n}, meet RYCS Sales Academy`,
      titulo: "RYCS Sales Academy",
      paragrafos: [
        "At the Academy you take the RYCS sales courses and earn a certification you keep for life.",
        "The courses are already unlocked in your account. Start with the first module.",
      ],
      botao: "Open the Academy", aba: "academy",
    }),
  },
  "graduacao:planos": {
    pt: (d) => ({
      assunto: `${d.n}, Pro ou Premium?`,
      titulo: "Pro ou Premium: qual combina com você",
      paragrafos: [
        `<b>Pro, ${brl(pro, "pt")} por mês:</b> ferramentas, treino e prioridade de visibilidade para as empresas.`,
        `<b>Premium, ${brl(premium, "pt")} por mês:</b> tudo do Pro, com o professor de vendas de IA, mentoria e acesso às campanhas premium.`,
        "No plano semestral ou anual a mensalidade fica mais barata.",
      ],
      botao: "Comparar os planos", aba: "planos",
    }),
    en: (d) => ({
      assunto: `${d.n}, Pro or Premium?`,
      titulo: "Pro or Premium: which one fits you",
      paragrafos: [
        `<b>Pro, ${brl(pro, "en")} a month:</b> tools, training and priority visibility to companies.`,
        `<b>Premium, ${brl(premium, "en")} a month:</b> everything in Pro, plus the AI sales coach, mentoring and access to premium campaigns.`,
        "Semiannual and annual plans lower the monthly price.",
      ],
      botao: "Compare plans", aba: "planos",
    }),
  },
  "repescagem:precisa": {
    pt: (d) => ({
      assunto: `${d.n}, a plataforma está precisando de você`,
      titulo: "A plataforma está precisando de você",
      paragrafos: [
        d.campanhasAtivas > 0
          ? `Há <b>${d.campanhasAtivas} ${d.campanhasAtivas === 1 ? "campanha ativa" : "campanhas ativas"}</b> com vagas para profissionais agora.`
          : "Tem oportunidade nova esperando por você.",
        "Faz uns dias que você não entra. Dá uma olhada no que chegou.",
      ],
      botao: "Ver oportunidades", aba: "oportunidades",
    }),
    en: (d) => ({
      assunto: `${d.n}, the platform needs you`,
      titulo: "The platform needs you",
      paragrafos: [
        d.campanhasAtivas > 0
          ? `There ${d.campanhasAtivas === 1 ? "is" : "are"} <b>${d.campanhasAtivas} active ${d.campanhasAtivas === 1 ? "campaign" : "campaigns"}</b> with open spots right now.`
          : "There are new opportunities waiting for you.",
        "You haven't logged in for a few days. Take a look at what's new.",
      ],
      botao: "See opportunities", aba: "oportunidades",
    }),
  },
  "repescagem:novas": {
    pt: (d) => ({
      assunto: `${d.n}, empresas novas entraram essa semana`,
      titulo: "Empresas novas entraram essa semana",
      paragrafos: [
        d.empresasNovasSemana > 0
          ? `<b>${d.empresasNovasSemana} ${d.empresasNovasSemana === 1 ? "empresa nova entrou" : "empresas novas entraram"}</b> na RYCS nos últimos 7 dias.`
          : "Novas campanhas foram abertas na RYCS.",
        "Quem chega primeiro nas campanhas novas pega as melhores vagas.",
      ],
      botao: "Ver as empresas", aba: "oportunidades",
    }),
    en: (d) => ({
      assunto: `${d.n}, new companies joined this week`,
      titulo: "New companies joined this week",
      paragrafos: [
        d.empresasNovasSemana > 0
          ? `<b>${d.empresasNovasSemana} new ${d.empresasNovasSemana === 1 ? "company" : "companies"}</b> joined RYCS in the last 7 days.`
          : "New campaigns have opened on RYCS.",
        "Those who get to new campaigns first get the best spots.",
      ],
      botao: "See the companies", aba: "oportunidades",
    }),
  },
  "repescagem:ultima": {
    pt: (d) => ({
      assunto: `${d.n}, última chamada`,
      titulo: "Última chamada",
      paragrafos: [
        "Este é o último lembrete que mandamos sobre as oportunidades abertas.",
        "Se quiser continuar ganhando com a RYCS, é só entrar e escolher uma campanha.",
      ],
      botao: "Voltar para a RYCS", aba: "oportunidades",
    }),
    en: (d) => ({
      assunto: `${d.n}, last call`,
      titulo: "Last call",
      paragrafos: [
        "This is the last reminder we'll send about the open opportunities.",
        "If you want to keep earning with RYCS, just log in and pick a campaign.",
      ],
      botao: "Back to RYCS", aba: "oportunidades",
    }),
  },
};

const RODAPE = { pt: "Equipe RYCS", en: "The RYCS team" };
export const TEXTO_DESCADASTRO = {
  pt: "Não quer mais receber estes e-mails? Descadastre-se",
  en: "Don't want these emails? Unsubscribe",
};

// Monta o e-mail de uma chave ("seq:passo@episodio"). `dados`: { nome,
// empresa, pendencias, codigo, campanhasAtivas, empresasNovasSemana, passo }.
export function montarTexto(chave, idioma, dados) {
  const lang = idioma === "en" ? "en" : "pt";
  const base = chave.split("@")[0];
  const d = { ...dados, n: primeiroNome(dados.nome) || (lang === "en" ? "Hi" : "Olá") };
  const t = TEXTOS[base]?.[lang]?.(d);
  if (!t) return null;
  return { ...t, rodape: RODAPE[lang], textoDescadastro: TEXTO_DESCADASTRO[lang] };
}

export const CHAVES_TEXTOS = Object.keys(TEXTOS);
