import { Router } from "express";
import db from "../db.js";
import { selectSellers } from "../services/sellerLeve.js";
import { enderecoMidia } from "../../shared/midia.js";
import { BETA_DEFAULT_BALANCE, ajustarSaldoBeta, isBetaEnvironment, resetBetaEnvironment } from "../services/betaEnvironment.js";
import { avaliarProfissional, estadoGamificacao } from "../services/gamificacao.js";

const router = Router();

const lista = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };

function parseSeller(row) {
  return {
    ...row,
    respostas: lista(row.respostas),
    segmentos: lista(row.segmentos),
    modalidades: lista(row.modalidades),
    regioes: lista(row.regioes),
    skills: lista(row.skills),
  };
}

// A logo é guardada como data URI (até centenas de KB). Mandá-la inline no
// /state fazia a resposta de todo mundo pesar meio megabyte e ser recarregada
// a cada ação, o que deixava o site inteiro lento. Vai por URL, como a foto do
// profissional; a versão no fim muda quando a logo muda, então o navegador
// pode guardar a imagem em cache sem mostrar uma logo antiga.
// Colunas que guardam arquivo (data URI) não são lidas na consulta do
// /state: o SQLite devolve só o tamanho (octet_length não lê o conteúdo) e o
// valor, se for pequeno. O que é grande vira versão leve uma vez só e fica em
// memória, validada pelo tamanho — prova e anexo não mudam depois de gravados,
// e se a logo mudar o tamanho muda junto.
const LIMITE_LEVE = 16 * 1024;
const colunasLeves = {};
function selectLeve(tabela, pesadas, where = "") {
  colunasLeves[tabela] ||= db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name)
    .map((n) => pesadas.includes(n)
      ? `CASE WHEN octet_length(${n}) > ${LIMITE_LEVE} THEN NULL ELSE ${n} END AS ${n}, octet_length(${n}) AS ${n}__bytes`
      : n)
    .join(", ");
  return `SELECT ${colunasLeves[tabela]} FROM ${tabela} ${where}`;
}

const cacheLeve = new Map();
function leve(chave, bytes, calcular) {
  const hit = cacheLeve.get(chave);
  if (hit && hit.bytes === bytes) return hit.valor;
  const valor = calcular();
  if (cacheLeve.size > 20_000) cacheLeve.clear();
  cacheLeve.set(chave, { bytes, valor });
  return valor;
}

// Devolve a linha com a coluna resolvida: o valor pequeno como veio, ou a
// versão leve do valor grande (lido do banco só quando não está em cache).
function resolverPesada(tabela, row, coluna, transformar) {
  const bytes = row[`${coluna}__bytes`];
  delete row[`${coluna}__bytes`];
  if (row[coluna] != null || !bytes) return transformar(row[coluna]);
  return leve(`${tabela}:${coluna}:${row.id}`, bytes, () =>
    transformar(db.prepare(`SELECT ${coluna} FROM ${tabela} WHERE id = ?`).get(row.id)?.[coluna]));
}

export const selectCompanies = (where) => selectLeve("companies", ["logo"], where);
export const selectSubmissions = (where) => selectLeve("submissions", ["prova"], where);
export const selectMessages = (where) => selectLeve("messages", ["anexo"], where);

export function urlDaLogo(id, logo) {
  if (!logo || !String(logo).startsWith("data:")) return logo || "";
  return enderecoMidia(`/api/companies/${id}/logo`, logo);
}

// Foto e vídeo de prova (ex.: foto da visita tirada na hora) ficam embutidos
// na prova. O admin recebe todas as tarefas da plataforma, então isso fazia o
// /state dele carregar dezenas de megabytes. Cada arquivo vira um endereço
// que aponta para o mesmo lugar dentro da prova.
export function provaSemArquivos(id, prova) {
  const andar = (v, caminho) => {
    if (typeof v === "string")
      return v.startsWith("data:") ? enderecoMidia(`/api/submissions/${id}/midia`, v, { c: caminho.join(".") }) : v;
    if (Array.isArray(v)) return v.map((x, i) => andar(x, [...caminho, i]));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, andar(x, [...caminho, k])]));
    return v;
  };
  return andar(prova, []);
}

// Mesmo caso para anexo de chat (até 5MB cada): o arquivo vai por endereço.
export function mensagemSemArquivo(m) {
  if (!m?.anexo || !m.anexo.includes("data:")) return m;
  try {
    const anexo = JSON.parse(m.anexo);
    if (typeof anexo?.dados !== "string" || !anexo.dados.startsWith("data:")) return m;
    return { ...m, anexo: JSON.stringify({ ...anexo, dados: enderecoMidia(`/api/messages/${m.id}/anexo`, anexo.dados) }) };
  } catch { return m; }
}

function parseCompany(row, preloadedDims) {
  const logo = resolverPesada("companies", row, "logo", (v) => urlDaLogo(row.id, v));
  return {
    ...row,
    logo,
    scoreDimensions: preloadedDims || {},
    destaque: !!row.destaque,
    visivel: row.visivel == null ? true : !!row.visivel,
    comissoes: JSON.parse(row.comissoes || "{}"),
    curso: JSON.parse(row.curso || "[]"),
    qualificacao: JSON.parse(row.qualificacao || "{}"),
    materiais: JSON.parse(row.materiais || "[]"),
    aportes: JSON.parse(row.aportes || "[]"),
  };
}

function parseSub(row) {
  const prova = resolverPesada("submissions", row, "prova", (v) => {
    const p = JSON.parse(v || "{}");
    return v?.includes("data:") ? provaSemArquivos(row.id, p) : p;
  });
  return { ...row, prova, arquivos: JSON.parse(row.arquivos || "[]") };
}

const parseMensagem = (row) => {
  const anexo = resolverPesada("messages", row, "anexo", (v) => mensagemSemArquivo({ id: row.id, anexo: v }).anexo);
  return { ...row, anexo };
};

function parseCampaign(row) {
  return {
    ...row,
    comissoes: JSON.parse(row.comissoes || "{}"),
    treinamento: JSON.parse(row.treinamento || "[]"),
    tarefas: JSON.parse(row.tarefas || "{}"),
    evidencias: JSON.parse(row.evidencias || "{}"),
    criteriosAprovacao: JSON.parse(row.criteriosAprovacao || "{}"),
    quiz: JSON.parse(row.quiz || "[]"),
    etapasPipeline: (() => { try { return JSON.parse(row.etapasPipeline || "[]"); } catch { return []; } })(),
    aceitaLeadProprio: !!row.aceitaLeadProprio,
    exigeCertificacao: !!row.exigeCertificacao,
  };
}

function buildSellersWithRelations(sellers) {
  const ids = sellers.map((s) => s.id);
  const usarFiltro = ids.length < 200 && ids.length > 0;

  const placeholders = usarFiltro ? ids.map(() => "?").join(",") : null;

  const apps = usarFiltro
    ? db.prepare(`SELECT * FROM applications WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM applications").all();
  const progress = usarFiltro
    ? db.prepare(`SELECT * FROM course_progress WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM course_progress").all();
  const scores = usarFiltro
    ? db.prepare(`SELECT * FROM score_dimensions WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM score_dimensions").all();
  const certifications = usarFiltro
    ? db.prepare(`SELECT * FROM certifications WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM certifications").all();
  const courseCertifications = usarFiltro
    ? db.prepare(`
        SELECT ce.sellerId, c.funcao, ce.percentual, ce.emitidoEm AS criadoEm, ce.codigo, c.titulo AS curso
        FROM course_certificates ce
        JOIN courses c ON c.id = ce.courseId
        WHERE c.funcao != '' AND ce.sellerId IN (${placeholders})
      `).all(...ids)
    : db.prepare(`
        SELECT ce.sellerId, c.funcao, ce.percentual, ce.emitidoEm AS criadoEm, ce.codigo, c.titulo AS curso
        FROM course_certificates ce
        JOIN courses c ON c.id = ce.courseId
        WHERE c.funcao != ''
      `).all();

  // Agrupa uma vez por profissional em vez de varrer as listas inteiras para
  // cada um (com a base toda no admin, isso era quadrático).
  const agrupar = (linhas) => {
    const m = new Map();
    for (const l of linhas) { const a = m.get(l.sellerId); if (a) a.push(l); else m.set(l.sellerId, [l]); }
    return (id) => m.get(id) || [];
  };
  const appsDe = agrupar(apps), progressDe = agrupar(progress), scoresDe = agrupar(scores);
  const certsDe = agrupar(certifications), certsCursoDe = agrupar(courseCertifications);

  return sellers.map((s) => {
    const aplicacoes = {};
    appsDe(s.id).forEach((a) => { aplicacoes[a.companyId] = a.status; });

    const curso = {};
    progressDe(s.id).forEach((p) => {
      const val = JSON.parse(p.moduleIds || "[]");
      curso[p.companyId] = val;
    });

    const scoreDimensions = {};
    scoresDe(s.id).forEach((sc) => {
      if (!scoreDimensions[sc.role]) scoreDimensions[sc.role] = {};
      scoreDimensions[sc.role][sc.dimension] = sc.valor;
    });

    const aplicacoesDetalhe = {};
    appsDe(s.id).forEach((a) => {
      aplicacoesDetalhe[a.companyId] = { status: a.status, criterios: JSON.parse(a.criterios || "[]"), quizScore: a.quizScore, mensagem: a.mensagem || "", criadoEm: a.criadoEm || null, campanhasAuto: a.campanhasAuto };
    });
    const parsed = parseSeller(s);
    const temFoto = !!(parsed.foto);
    parsed.foto = temFoto ? `/api/sellers/${s.id}/foto` : null;
    // A imagem original (sem recorte) é tão pesada quanto a foto: serve por URL,
    // nunca no /state. `fotoEnquadramento` (JSON pequeno) segue no estado.
    const temFotoOriginal = !!(parsed.fotoOriginal);
    parsed.fotoOriginal = temFotoOriginal ? `/api/sellers/${s.id}/foto-original` : null;
    // Currículo é base64 de até 8MB por profissional. Mandá-lo no /state faz a
    // resposta inteira pesar dezenas de MB (trava o painel admin). Serve por URL,
    // igual à foto — quem precisa do arquivo abre /api/sellers/:id/curriculo.
    const temCurriculo = !!(parsed.curriculo);
    parsed.curriculo = temCurriculo ? `/api/sellers/${s.id}/curriculo` : null;
    // Vídeo de apresentação (MP4 em data URI, já houve de 14MB): mesmo caso.
    parsed.videoApresentacao = parsed.videoApresentacao ? `/api/sellers/${s.id}/video-apresentacao` : "";
    return {
      ...parsed, aplicacoes, aplicacoesDetalhe, curso, scoreDimensions,
      certificacoes: [
        ...certsDe(s.id),
        ...certsCursoDe(s.id).map((c) => ({ ...c, nivel: "course" })),
      ],
    };
  });
}

export function getFullState() {
  const sellers = buildSellersWithRelations(db.prepare(selectSellers()).all());

  const allDims = db.prepare("SELECT companyId, dimension, valor FROM company_score_dimensions").all();
  const dimsByCompany = {};
  allDims.forEach((d) => {
    if (!dimsByCompany[d.companyId]) dimsByCompany[d.companyId] = {};
    dimsByCompany[d.companyId][d.dimension] = d.valor;
  });
  const companies = db.prepare(selectCompanies()).all().map((row) => parseCompany(row, dimsByCompany[row.id]));
  const submissions = db.prepare(selectSubmissions("ORDER BY criadoEm DESC")).all().map(parseSub);
  const withdrawals = db.prepare("SELECT * FROM withdrawals ORDER BY criadoEm DESC").all();
  // Nenhuma tela do admin usa mensagens nem leads; eram a maior parte do que
  // sobrava no /state dele.
  const messages = [];
  const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY criadoEm DESC").all().map(parseCampaign);
  const leads = [];
  const campaignApps = db.prepare("SELECT * FROM campaign_applications").all();

  const appsPorCampanha = new Map();
  for (const a of campaignApps) { const l = appsPorCampanha.get(a.campaignId); if (l) l.push(a); else appsPorCampanha.set(a.campaignId, [a]); }
  campaigns.forEach((c) => {
    c.candidaturas = appsPorCampanha.get(c.id) || [];
  });

  return { sellers, companies, submissions, withdrawals, messages, campaigns, leads };
}

// Queries diretas por papel — evita carregar o banco inteiro para filtrar em JS.

function getEmpresaState(entityId) {
  const meuId = entityId;

  const dims = db.prepare("SELECT dimension, valor FROM company_score_dimensions WHERE companyId = ?").all(meuId);
  const dimMap = {};
  dims.forEach((d) => { dimMap[d.dimension] = d.valor; });
  const companies = db.prepare(selectCompanies("WHERE id = ?")).all(meuId).map((row) => parseCompany(row, dimMap));

  const campaigns = db.prepare("SELECT * FROM campaigns WHERE companyId = ? ORDER BY criadoEm DESC").all(meuId).map(parseCampaign);
  const campIds = campaigns.map((c) => c.id);
  const campaignApps = campIds.length
    ? db.prepare(`SELECT * FROM campaign_applications WHERE campaignId IN (${campIds.map(() => "?").join(",")})`)
        .all(...campIds)
    : [];
  campaigns.forEach((c) => { c.candidaturas = campaignApps.filter((a) => a.campaignId === c.id); });

  const idsCandidatos = new Set(campaignApps.map((a) => a.sellerId));
  const apps = db.prepare("SELECT * FROM applications WHERE companyId = ?").all(meuId);
  apps.forEach((a) => idsCandidatos.add(a.sellerId));

  // Solicitações pendentes de profissionais (com mensagem e data)
  const solicitacoesPendentes = apps
    .filter((a) => a.status === "pendente")
    .map((a) => ({ sellerId: a.sellerId, mensagem: a.mensagem || "", criadoEm: a.criadoEm || null }));

  // inclui também sellers que têm mensagens com esta empresa
  const messages = db.prepare(selectMessages("WHERE companyId = ? ORDER BY ts ASC")).all(meuId).map(parseMensagem);
  messages.forEach((m) => { if (m.sellerId) idsCandidatos.add(m.sellerId); });

  const sellerIds = [...idsCandidatos];
  let sellers = [];
  if (sellerIds.length) {
    const raw = db.prepare(selectSellers(`WHERE id IN (${sellerIds.map(() => "?").join(",")})`))
      .all(...sellerIds);
    sellers = buildSellersWithRelations(raw);
  }

  const submissions = db.prepare(selectSubmissions("WHERE companyId = ? ORDER BY criadoEm DESC")).all(meuId).map(parseSub);
  const leads = db.prepare("SELECT * FROM leads WHERE companyId = ? ORDER BY atualizadoEm DESC").all(meuId);

  const campanhasAutoDefault = companies[0]?.campanhasAutoDefault ?? 0;

  return { sellers, companies, submissions, withdrawals: [], messages, campaigns, leads, solicitacoesPendentes, campanhasAutoDefault: !!campanhasAutoDefault };
}

function getVendedorState(entityId) {
  const meuId = entityId;
  const rawSeller = db.prepare(selectSellers("WHERE id = ?")).all(meuId);
  const sellers = buildSellersWithRelations(rawSeller);
  const meuVendedor = sellers[0];
  // Sem etapa de aprovação: todo profissional vê as empresas ativas e as
  // campanhas publicadas. O status deixou de bloquear o acesso.
  const oportunidadesLiberadas = true;

  let companies = [];
  if (oportunidadesLiberadas) {
    const allDims = db.prepare("SELECT companyId, dimension, valor FROM company_score_dimensions").all();
    const dimsByCompany = {};
    allDims.forEach((d) => {
      if (!dimsByCompany[d.companyId]) dimsByCompany[d.companyId] = {};
      dimsByCompany[d.companyId][d.dimension] = d.valor;
    });
    companies = db.prepare(selectCompanies("WHERE visivel = 1")).all().map((row) => parseCompany(row, dimsByCompany[row.id])).map((c) => ({
      ...c,
      qualificacao: {
        ...c.qualificacao,
        questoes: (c.qualificacao?.questoes || []).map(({ correta, ...q }) => q),
      },
    }));
  }

  const submissions = db.prepare(selectSubmissions("WHERE sellerId = ? ORDER BY criadoEm DESC")).all(meuId).map(parseSub);
  const withdrawals = db.prepare("SELECT * FROM withdrawals WHERE sellerId = ? ORDER BY criadoEm DESC").all(meuId);
  const messages = db.prepare(selectMessages("WHERE sellerId = ? ORDER BY ts ASC")).all(meuId).map(parseMensagem);
  const leads = db.prepare("SELECT * FROM leads WHERE sellerId = ? ORDER BY atualizadoEm DESC").all(meuId);

  let campaigns = [];
  if (oportunidadesLiberadas) {
    // Esconde também as campanhas de empresas marcadas como invisíveis.
    campaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'ativa' AND companyId IN (SELECT id FROM companies WHERE visivel = 1) ORDER BY criadoEm DESC").all().map(parseCampaign);
    const campIds = campaigns.map((c) => c.id);
    const campaignApps = campIds.length
      ? db.prepare(`SELECT * FROM campaign_applications WHERE campaignId IN (${campIds.map(() => "?").join(",")}) AND sellerId = ?`)
          .all(...campIds, meuId)
      : [];
    const tentativas = db.prepare(
      "SELECT campaignId, MAX(score) as score, MAX(aprovado) as aprovado FROM campaign_quiz_attempts WHERE sellerId = ? GROUP BY campaignId"
    ).all(meuId);
    const quizByCamp = {};
    tentativas.forEach((t) => { quizByCamp[t.campaignId] = t; });
    campaigns = campaigns.map((c) => {
      const melhor = quizByCamp[c.id];
      return {
        ...c,
        candidaturas: campaignApps.filter((a) => a.campaignId === c.id),
        quiz: c.quiz.map(({ correta, ...q }) => q),
        quizAprovado: melhor ? !!melhor.aprovado : false,
        quizScore: melhor?.score ?? null,
      };
    });
  }

  // Gamificação: reconhece conquistas/XP a partir dos dados reais (idempotente)
  // e devolve o estado para o Painel. Falha aqui nunca derruba o state.
  let gamificacao = null;
  try { avaliarProfissional(meuId); gamificacao = estadoGamificacao(meuId); }
  catch (e) { console.error(`[gamificacao] falha para ${meuId}:`, e.message); }

  return { sellers, companies, submissions, withdrawals, messages, campaigns, leads, gamificacao };
}

function getFilteredState(user) {
  const { role, entityId } = user;

  // Se o estado de uma empresa ou profissional falhar, a resposta é um erro
  // (a tela oferece tentar de novo). Antes caía no estado completo, que é o
  // banco de todas as empresas e profissionais.
  if (role === "empresa") return getEmpresaState(entityId);
  if (role === "vendedor") return getVendedorState(entityId);
  if (role === "admin") return getFullState();
  const erro = new Error("Papel sem estado"); erro.status = 403; throw erro;
}

router.get("/state", (req, res) => {
  let state;
  try { state = getFilteredState(req.user); }
  catch (err) {
    console.error(`[state] erro para ${req.user.role} ${req.user.entityId}:`, err.message);
    return res.status(err.status || 500).json({ error: "Não foi possível carregar os dados." });
  }
  const notifs = db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY criadoEm DESC LIMIT 50").all(req.user.id);
  state.notifications = notifs;
  res.json(state);
});

router.post("/state/reset", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin pode resetar" });
  if (!isBetaEnvironment()) return res.status(403).json({ error: "Reset indisponível fora do ambiente Beta." });
  if (req.body?.confirmacao !== "RESETAR BETA") return res.status(400).json({ error: "Confirmação inválida." });
  try {
    resetBetaEnvironment();
    res.json({ ok: true, message: "Ambiente Beta restaurado para a base de QA." });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Não foi possível resetar o Beta." });
  }
});

router.post("/state/beta/balance", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin pode ajustar saldo Beta" });
  if (!isBetaEnvironment()) return res.status(403).json({ error: "Controle de saldo indisponível fora do ambiente Beta." });
  const acao = req.body?.acao;
  const mapa = {
    add_1000: { valor: 1000, modo: "add" },
    add_10000: { valor: 10000, modo: "add" },
    add_100000: { valor: 100000, modo: "add" },
    zerar: { valor: 0, modo: "set" },
    restaurar: { valor: BETA_DEFAULT_BALANCE, modo: "set" },
  };
  const ajuste = mapa[acao];
  if (!ajuste) return res.status(400).json({ error: "Ação Beta inválida." });
  try {
    const r = ajustarSaldoBeta({ ...ajuste, actorId: req.user.id });
    res.json({ ok: true, saldo: r.saldo, message: "SIMULAÇÃO: saldo Beta ajustado sem valor real." });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Não foi possível ajustar o saldo Beta." });
  }
});

export default router;
