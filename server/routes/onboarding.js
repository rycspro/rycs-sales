import { Router } from "express";
import db, { uid, agora } from "../db.js";
import {
  TRIAL_ONBOARDING_DIAS, MOTIVOS_CONVITE_ONBOARDING, estadoConviteOnboarding, conviteServeParaEmail,
  validadeConviteDias, normalizarWhatsapp, validarPerfilEmpresa, normalizarPermissoes, ticketParaNumero,
  formatarTicket, avaliarLogo, validarArquivoAcademy, normalizarLink, validarSuporte, extensaoDe, categoriaAcademy,
  PARTES_IA, normalizarParte, parteCompleta,
} from "../../shared/onboarding.js";
import { hashToken, novoToken, obterOnboarding, concluir, serializar, trialDoOnboarding } from "../services/onboarding.js";
import { armazenamentoDisponivel, salvar, remover, ArquivoGrandeDemais } from "../services/arquivos.js";
import { iaDisponivel, geracaoAtual, serializarGeracao, criarGeracao, tentarDeNovo } from "../services/iaOnboarding.js";
import { acessoDaEmpresa } from "../../shared/assinatura.js";
import { PLANOS, ORDEM_PLANOS } from "../../shared/planos.js";
import { requisitosPublicacao, saldoDisponivel, isPosPago, isPremium } from "../../shared/empresa.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const conviteDoToken = (token) =>
  db.prepare("SELECT * FROM onboarding_convites WHERE tokenHash = ?").get(hashToken(token));

// ---------------------------------------------------------------------------
// Público: quem abre o link ainda não tem conta.
export const onboardingPublico = Router();

// Diz se o convite serve e para qual e-mail, sem consumi-lo. Revelar o e-mail
// só a quem tem o link é seguro: o link foi gerado para essa pessoa.
onboardingPublico.get("/onboarding/convites/:token", (req, res) => {
  const convite = conviteDoToken(req.params.token);
  const estado = estadoConviteOnboarding(convite);
  if (!estado.ok) return res.status(404).json({ ok: false, motivo: estado.motivo, error: MOTIVOS_CONVITE_ONBOARDING[estado.motivo] });
  res.json({ ok: true, email: convite.email, trialDias: convite.trialDias, expiraEm: convite.expiraEm });
});

// ---------------------------------------------------------------------------
// Autenticado.
const router = Router();

const soEmpresa = (req, res) => {
  if (req.user?.role !== "empresa" || !req.user.entityId) {
    res.status(403).json({ error: "Apenas empresas." });
    return false;
  }
  return true;
};

router.get("/onboarding", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const linha = obterOnboarding(req.user.entityId);
  if (!linha) return res.status(404).json({ error: "Empresa não encontrada." });
  res.json(serializar(linha));
});

// Etapa 1 para quem já tinha conta: falta só o WhatsApp, que é obrigatório.
router.post("/onboarding/acesso", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const whatsapp = normalizarWhatsapp(req.body?.whatsapp);
  if (!whatsapp) return res.status(400).json({ error: "Informe um WhatsApp válido, com DDD.", campo: "whatsapp" });
  db.prepare("UPDATE companies SET whatsapp = ? WHERE id = ?").run(whatsapp, req.user.entityId);
  const linha = concluir(req.user.entityId, "acesso");
  if (!linha) return res.status(409).json({ error: "Não foi possível concluir esta etapa." });
  res.json(serializar(linha));
});

// ---------------------------------------------------------------------------
// Etapa 2: perfil da empresa.

function perfilDaEmpresa(companyId, emailUsuario) {
  const c = db.prepare(`SELECT nome, produto, ticket, icp, segmento, nicho, diferenciais, regrasMarca, permissoesMarca, logo
                        FROM companies WHERE id = ?`).get(companyId);
  if (!c) return null;
  let permissoes = {};
  try { permissoes = JSON.parse(c.permissoesMarca || "{}"); } catch { /* fica o padrão */ }
  // O cadastro da etapa 1 usa o começo do e-mail como nome provisório.
  // Mostrar isso como se fosse o nome da empresa seria inventar um dado.
  const provisorio = emailUsuario && c.nome === String(emailUsuario).split("@")[0];
  return {
    nome: provisorio ? "" : c.nome,
    produto: c.produto || "",
    ticket: ticketParaNumero(c.ticket),
    nicho: c.nicho || c.segmento || "",
    diferencial: c.diferenciais || "",
    publico: c.icp || "",
    regrasMarca: c.regrasMarca || "",
    permissoesMarca: normalizarPermissoes(permissoes),
    logo: c.logo || "",
  };
}

const emailDoUsuario = (id) => db.prepare("SELECT email FROM users WHERE id = ?").get(id)?.email || "";

router.get("/onboarding/empresa", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const perfil = perfilDaEmpresa(req.user.entityId, emailDoUsuario(req.user.id));
  if (!perfil) return res.status(404).json({ error: "Empresa não encontrada." });
  res.json(perfil);
});

// Salva o perfil. Com concluir=true, valida os obrigatórios e avança a etapa;
// sem ele, guarda o que houver (o rascunho não se perde se a pessoa sair).
router.post("/onboarding/empresa", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const { perfil, erros } = validarPerfilEmpresa(req.body || {});
  const concluirEtapa = req.body?.concluir === true;
  if (erros.ticket || (concluirEtapa && Object.keys(erros).length))
    return res.status(400).json({ error: "Revise os campos destacados.", erros });

  const sets = {
    produto: perfil.produto, ticket: perfil.ticket == null ? "" : formatarTicket(perfil.ticket),
    nicho: perfil.nicho, diferenciais: perfil.diferencial, icp: perfil.publico,
    regrasMarca: perfil.regrasMarca, permissoesMarca: JSON.stringify(perfil.permissoesMarca),
  };
  // Nome vazio num rascunho não apaga o nome provisório: a coluna é obrigatória.
  if (perfil.nome) sets.nome = perfil.nome;
  const cols = Object.keys(sets);
  db.prepare(`UPDATE companies SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .run(...cols.map((c) => sets[c]), req.user.entityId);

  if (!concluirEtapa) return res.json({ ok: true, ...serializar(obterOnboarding(req.user.entityId)) });
  const linha = concluir(req.user.entityId, "empresa");
  if (!linha) return res.status(409).json({ error: "Conclua a etapa anterior primeiro." });
  res.json({ ok: true, ...serializar(linha) });
});

router.post("/onboarding/empresa/logo", (req, res) => {
  if (!soEmpresa(req, res)) return;
  if (req.body?.remover === true) {
    db.prepare("UPDATE companies SET logo = '' WHERE id = ?").run(req.user.entityId);
    return res.json({ ok: true, logo: "" });
  }
  const base64 = String(req.body?.base64 || "");
  const mimetype = String(req.body?.mimetype || "");
  const buffer = Buffer.from(base64, "base64");
  const erro = avaliarLogo({
    mimetype, tamanhoBytes: buffer.length,
    svgTexto: mimetype === "image/svg+xml" ? buffer.toString("utf8") : "",
  });
  if (erro) return res.status(422).json({ error: erro });
  const logo = `data:${mimetype};base64,${buffer.toString("base64")}`;
  db.prepare("UPDATE companies SET logo = ? WHERE id = ?").run(logo, req.user.entityId);
  res.json({ ok: true, logo });
});

// ---------------------------------------------------------------------------
// Etapa 3: Marketing Academy.

const materialPublico = (m) => ({
  id: m.id, categoria: m.categoria, nome: m.nome, url: m.url || null,
  tamanho: m.tamanho || 0, mimetype: m.mimetype || "", criadoEm: m.criadoEm,
});

router.get("/onboarding/academy", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const materiais = db.prepare("SELECT * FROM academy_materiais WHERE companyId = ? ORDER BY criadoEm").all(req.user.entityId);
  const e = db.prepare("SELECT suporteNome, suporteWhatsapp, suporteEmail FROM companies WHERE id = ?").get(req.user.entityId);
  res.json({
    materiais: materiais.map(materialPublico),
    suporte: { nome: e?.suporteNome || "", whatsapp: e?.suporteWhatsapp || "", email: e?.suporteEmail || "" },
    armazenamento: armazenamentoDisponivel(),
  });
});

// Envio do arquivo: o corpo da requisição é o próprio arquivo, que segue em
// stream para o storage. O nome vem no cabeçalho X-Arquivo-Nome.
router.post("/onboarding/academy/arquivos/:categoria", async (req, res) => {
  if (!soEmpresa(req, res)) return;
  if (!armazenamentoDisponivel())
    return res.status(503).json({ error: "O envio de arquivos ainda não está disponível. Você pode adicionar links e seguir." });
  let nome = "";
  try { nome = decodeURIComponent(String(req.get("x-arquivo-nome") || "")); } catch { /* fica vazio */ }
  nome = nome.replace(/[\\/\u0000-\u001f]/g, "").slice(0, 200);
  const categoria = req.params.categoria;
  const declarado = Number(req.get("content-length") || 0);
  const erro = validarArquivoAcademy({ categoria, nome, tamanho: declarado });
  if (erro) return res.status(422).json({ error: erro });

  const id = uid();
  const chave = `onboarding/${req.user.entityId}/${id}.${extensaoDe(nome)}`;
  const mimetype = String(req.get("content-type") || "").split(";")[0].slice(0, 120);
  try {
    const tamanho = await salvar(chave, req, { contentType: mimetype, maxBytes: categoriaAcademy(categoria).limite });
    db.prepare(`INSERT INTO academy_materiais (id, companyId, categoria, nome, chave, mimetype, tamanho, statusIndexacao, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`)
      .run(id, req.user.entityId, categoria, nome, chave, mimetype, tamanho, agora());
    res.status(201).json(materialPublico(db.prepare("SELECT * FROM academy_materiais WHERE id = ?").get(id)));
  } catch (e) {
    if (e instanceof ArquivoGrandeDemais) return res.status(413).json({ error: validarArquivoAcademy({ categoria, nome, tamanho: Infinity }) });
    console.error("[onboarding] envio de arquivo:", e.message);
    res.status(502).json({ error: "Não foi possível enviar o arquivo. Tente de novo." });
  }
});

router.post("/onboarding/academy/links", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const url = normalizarLink(req.body?.url);
  if (!url) return res.status(400).json({ error: "Informe um link válido, como https://suaempresa.com.br." });
  const total = db.prepare("SELECT COUNT(*) n FROM academy_materiais WHERE companyId = ? AND categoria = 'link'").get(req.user.entityId).n;
  if (total >= 50) return res.status(422).json({ error: "Limite de 50 links." });
  const id = uid();
  db.prepare(`INSERT INTO academy_materiais (id, companyId, categoria, nome, url, statusIndexacao, criadoEm)
              VALUES (?, ?, 'link', ?, ?, 'sem_texto', ?)`).run(id, req.user.entityId, new URL(url).hostname, url, agora());
  res.status(201).json(materialPublico(db.prepare("SELECT * FROM academy_materiais WHERE id = ?").get(id)));
});

// Excluir apaga o arquivo do storage também (LGPD: a empresa pode retirar o
// que enviou).
router.delete("/onboarding/academy/materiais/:id", async (req, res) => {
  if (!soEmpresa(req, res)) return;
  const m = db.prepare("SELECT * FROM academy_materiais WHERE id = ? AND companyId = ?").get(req.params.id, req.user.entityId);
  if (!m) return res.status(404).json({ error: "Material não encontrado." });
  if (m.chave) {
    try { await remover(m.chave); }
    catch (e) { console.error("[onboarding] remoção de arquivo:", e.message); return res.status(502).json({ error: "Não foi possível remover o arquivo. Tente de novo." }); }
  }
  db.prepare("DELETE FROM academy_materiais WHERE id = ?").run(m.id);
  res.json({ ok: true });
});

function salvarSuporte(companyId, dados) {
  const { suporte, erros } = validarSuporte(dados || {});
  if (Object.keys(erros).length) return { erros };
  db.prepare("UPDATE companies SET suporteNome = ?, suporteWhatsapp = ?, suporteEmail = ? WHERE id = ?")
    .run(suporte.nome, suporte.whatsapp, suporte.email, companyId);
  return { suporte };
}

router.post("/onboarding/academy/suporte", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const r = salvarSuporte(req.user.entityId, req.body);
  if (r.erros) return res.status(400).json({ error: "Revise o contato de suporte.", erros: r.erros });
  res.json({ ok: true, suporte: r.suporte });
});

// "Enviar para a IA analisar": conclui a etapa e põe a geração na fila.
// Material não é obrigatório.
router.post("/onboarding/academy/concluir", (req, res) => {
  if (!soEmpresa(req, res)) return;
  if (req.body?.suporte) {
    const r = salvarSuporte(req.user.entityId, req.body.suporte);
    if (r.erros) return res.status(400).json({ error: "Revise o contato de suporte.", erros: r.erros });
  }
  const linha = concluir(req.user.entityId, "academy");
  if (!linha) return res.status(409).json({ error: "Conclua as etapas anteriores primeiro." });
  // Depois de aprovado, voltar aqui não refaz a geração.
  if (JSON.parse(linha.etapas).ia !== "concluida" && iaDisponivel()) criarGeracao(req.user.entityId);
  res.json({ ok: true, ...serializar(linha) });
});

// ---------------------------------------------------------------------------
// Etapa 4: IA.

router.get("/onboarding/ia", (req, res) => {
  if (!soEmpresa(req, res)) return;
  res.json({ disponivel: iaDisponivel(), geracao: serializarGeracao(geracaoAtual(req.user.entityId)) });
});

router.post("/onboarding/ia/gerar", (req, res) => {
  if (!soEmpresa(req, res)) return;
  if (!iaDisponivel()) return res.status(503).json({ error: "A IA não está disponível no momento." });
  const atual = geracaoAtual(req.user.entityId);
  if (atual && ["pendente", "processando"].includes(atual.status)) return res.json({ geracao: serializarGeracao(atual) });
  res.json({ geracao: serializarGeracao(criarGeracao(req.user.entityId)) });
});

router.post("/onboarding/ia/tentar", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const g = tentarDeNovo(req.user.entityId);
  if (!g) return res.status(409).json({ error: "Não há geração com falha para tentar de novo." });
  res.json({ geracao: serializarGeracao(g) });
});

const geracaoPronta = (req, res) => {
  const g = geracaoAtual(req.user.entityId);
  if (!g || g.status !== "pronta") { res.status(409).json({ error: "As estratégias ainda não estão prontas para revisão." }); return null; }
  return g;
};

router.post("/onboarding/ia/conteudo", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const g = geracaoPronta(req, res);
  if (!g) return;
  const parte = String(req.body?.parte || "");
  const conteudo = normalizarParte(parte, req.body?.conteudo);
  if (!conteudo) return res.status(400).json({ error: "Parte inválida." });
  if (!parteCompleta(parte, conteudo)) return res.status(400).json({ error: "Preencha todos os campos desta parte." });
  const atual = JSON.parse(g.conteudo || "{}");
  const aprovacoes = JSON.parse(g.aprovacoes || "{}");
  atual[parte] = conteudo;
  aprovacoes[parte] = false; // editou, precisa aprovar de novo
  db.prepare("UPDATE ia_geracoes SET conteudo = ?, aprovacoes = ?, atualizadoEm = ? WHERE id = ?")
    .run(JSON.stringify(atual), JSON.stringify(aprovacoes), agora(), g.id);
  res.json({ geracao: serializarGeracao(geracaoAtual(req.user.entityId)) });
});

router.post("/onboarding/ia/aprovar", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const g = geracaoPronta(req, res);
  if (!g) return;
  const parte = String(req.body?.parte || "");
  if (!PARTES_IA.some((p) => p.chave === parte)) return res.status(400).json({ error: "Parte inválida." });
  const aprovacoes = JSON.parse(g.aprovacoes || "{}");
  aprovacoes[parte] = req.body?.aprovado !== false;
  db.prepare("UPDATE ia_geracoes SET aprovacoes = ?, atualizadoEm = ? WHERE id = ?").run(JSON.stringify(aprovacoes), agora(), g.id);
  res.json({ geracao: serializarGeracao(geracaoAtual(req.user.entityId)) });
});

router.post("/onboarding/ia/ajustes", (req, res) => {
  if (!soEmpresa(req, res)) return;
  if (!iaDisponivel()) return res.status(503).json({ error: "A IA não está disponível no momento." });
  const pedido = String(req.body?.pedido || "").trim();
  if (pedido.length < 5) return res.status(400).json({ error: "Conte o que você quer ajustar." });
  const g = geracaoAtual(req.user.entityId);
  if (!g || !["pronta", "falhou"].includes(g.status)) return res.status(409).json({ error: "Aguarde a geração atual terminar." });
  res.json({ geracao: serializarGeracao(criarGeracao(req.user.entityId, { pedidoAjuste: pedido })) });
});

// Aprovar tudo: a versão aprovada fica registrada e a etapa conclui. Antes
// disso, nada do que a IA gerou é usado em lugar nenhum.
router.post("/onboarding/ia/aprovar-tudo", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const g = geracaoPronta(req, res);
  if (!g) return;
  const conteudo = JSON.parse(g.conteudo || "{}");
  if (!PARTES_IA.every((p) => parteCompleta(p.chave, conteudo[p.chave])))
    return res.status(409).json({ error: "Alguma parte está incompleta. Revise antes de aprovar." });
  const t = agora();
  db.prepare("UPDATE ia_geracoes SET status = 'aprovada', aprovacoes = ?, aprovadoEm = ?, atualizadoEm = ? WHERE id = ?")
    .run(JSON.stringify(Object.fromEntries(PARTES_IA.map((p) => [p.chave, true]))), t, t, g.id);
  const linha = concluir(req.user.entityId, "ia");
  if (!linha) return res.status(409).json({ error: "Conclua as etapas anteriores primeiro." });
  res.json({ ok: true, ...serializar(linha) });
});

// Sem IA configurada, a etapa não tem como rodar. Seguir sem estratégias é
// melhor do que prender a empresa ou mostrar texto inventado.
router.post("/onboarding/ia/pular", (req, res) => {
  if (!soEmpresa(req, res)) return;
  if (iaDisponivel()) return res.status(409).json({ error: "A IA está disponível: gere e revise as estratégias." });
  const linha = concluir(req.user.entityId, "ia");
  if (!linha) return res.status(409).json({ error: "Conclua as etapas anteriores primeiro." });
  res.json({ ok: true, ...serializar(linha) });
});

// ---------------------------------------------------------------------------
// Etapa 5: plano. O checkout em si é o POST /subscription, com onboarding:true.

function acessoAtual(companyId) {
  const billing = db.prepare("SELECT billing_status, access_status FROM company_billing WHERE companyId = ?").get(companyId);
  const empresa = db.prepare("SELECT assinatura, tipoEmpresa, documento FROM companies WHERE id = ?").get(companyId);
  const assinatura = db.prepare("SELECT * FROM subscriptions WHERE companyId = ? AND status != 'cancelada' ORDER BY criadoEm DESC LIMIT 1").get(companyId);
  if (billing?.billing_status === "isenta") return { liberado: true, estado: "ativa", plano: null, isenta: true, empresa };
  return { ...acessoDaEmpresa({ empresa, assinatura: assinatura || null }), empresa };
}

router.get("/onboarding/plano", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const acesso = acessoAtual(req.user.entityId);
  res.json({
    planos: ORDEM_PLANOS.filter((k) => PLANOS[k]?.preco > 0).map((k) => ({ chave: k, ...PLANOS[k] })),
    trialDias: trialDoOnboarding(req.user.entityId),
    atual: acesso.liberado ? { plano: acesso.plano, estado: acesso.estado, nome: acesso.plano ? PLANOS[acesso.plano]?.nome || acesso.plano : null } : null,
    temDocumento: !!acesso.empresa?.documento,
  });
});

// Quem já tem acesso liberado (plano pago, trial, premium ou isenção) segue
// com o que tem: nada é cobrado de novo.
router.post("/onboarding/plano/manter", (req, res) => {
  if (!soEmpresa(req, res)) return;
  if (!acessoAtual(req.user.entityId).liberado) return res.status(409).json({ error: "Escolha um plano para continuar." });
  const linha = concluir(req.user.entityId, "plano");
  if (!linha) return res.status(409).json({ error: "Conclua as etapas anteriores primeiro." });
  res.json({ ok: true, ...serializar(linha) });
});

// ---------------------------------------------------------------------------
// Etapa 6: primeira campanha. A criação usa o POST /campaigns de sempre; aqui
// só se liga a campanha ao onboarding e se acompanha o que falta.

const lerJson = (v, padrao) => { try { return JSON.parse(v || ""); } catch { return padrao; } };

function estrategiasAprovadas(companyId) {
  const g = db.prepare("SELECT conteudo FROM ia_geracoes WHERE companyId = ? AND status = 'aprovada' ORDER BY versao DESC LIMIT 1").get(companyId);
  return g ? lerJson(g.conteudo, null) : null;
}

const caixaOk = (empresa) => isPosPago(empresa) || isPremium(empresa) || saldoDisponivel(empresa) > 0;

router.get("/onboarding/campanha", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const linha = obterOnboarding(req.user.entityId);
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.user.entityId);
  const c = linha?.campanhaId ? db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(linha.campanhaId, req.user.entityId) : null;
  const campanha = c ? { ...c, tarefas: lerJson(c.tarefas, {}), treinamento: lerJson(c.treinamento, []) } : null;
  res.json({
    campanha: campanha ? { id: campanha.id, titulo: campanha.titulo, status: campanha.status, orcamento: Number(campanha.orcamento || 0) } : null,
    requisitos: campanha ? requisitosPublicacao(campanha, empresa) : [],
    saldoDisponivel: Number.isFinite(saldoDisponivel(empresa)) ? saldoDisponivel(empresa) : null,
    caixaOk: caixaOk(empresa),
    estrategias: estrategiasAprovadas(req.user.entityId),
  });
});

router.post("/onboarding/campanha", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const c = db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(String(req.body?.campaignId || ""), req.user.entityId);
  if (!c) return res.status(404).json({ error: "Campanha não encontrada." });
  const estrategias = estrategiasAprovadas(req.user.entityId);
  db.transaction(() => {
    db.prepare("UPDATE onboarding SET campanhaId = ?, atualizadoEm = ? WHERE companyId = ?").run(c.id, agora(), req.user.entityId);
    if (estrategias) db.prepare("UPDATE campaigns SET estrategias = ? WHERE id = ?").run(JSON.stringify(estrategias), c.id);
  })();
  res.json({ ok: true });
});

// O onboarding termina com a campanha criada e o caixa abastecido (decisão
// em DECISOES.md). Se a publicação ainda tiver pendências (treinamento,
// cadastro), a empresa resolve no painel, e a tela diz quais são.
router.post("/onboarding/campanha/concluir", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const linha = obterOnboarding(req.user.entityId);
  if (!linha?.campanhaId) return res.status(409).json({ error: "Crie a campanha primeiro." });
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.user.entityId);
  if (!caixaOk(empresa)) return res.status(409).json({ error: "Adicione saldo para concluir. O depósito por Pix é confirmado automaticamente." });
  const nova = concluir(req.user.entityId, "campanha");
  if (!nova) return res.status(409).json({ error: "Conclua as etapas anteriores primeiro." });
  res.json({ ok: true, ...serializar(nova) });
});

// Convite aberto por quem já tem conta: entra no login e o convite é aplicado
// ao onboarding da empresa. Vale só para o e-mail para o qual foi gerado.
router.post("/onboarding/convites/:token/aplicar", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const convite = conviteDoToken(req.params.token);
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(req.user.id);
  const estado = conviteServeParaEmail(convite, user?.email);
  if (!estado.ok) return res.status(409).json({ error: MOTIVOS_CONVITE_ONBOARDING[estado.motivo], motivo: estado.motivo });

  const linha = obterOnboarding(req.user.entityId);
  if (!linha) return res.status(404).json({ error: "Empresa não encontrada." });
  if (JSON.parse(linha.etapas || "{}").plano === "concluida")
    return res.status(409).json({ error: "O plano desta empresa já foi escolhido.", motivo: "planoEscolhido" });

  const t = agora();
  let aplicado = false;
  db.transaction(() => {
    const marca = db.prepare("UPDATE onboarding_convites SET usadoEm = ?, usadoPor = ? WHERE id = ? AND usadoEm IS NULL AND revogadoEm IS NULL")
      .run(t, req.user.entityId, convite.id);
    if (!marca.changes) return;
    db.prepare("UPDATE onboarding SET conviteId = ?, trialDias = ?, atualizadoEm = ? WHERE companyId = ?")
      .run(convite.id, convite.trialDias, t, req.user.entityId);
    aplicado = true;
  })();
  if (!aplicado) return res.status(409).json({ error: MOTIVOS_CONVITE_ONBOARDING.usado, motivo: "usado" });
  res.json(serializar(obterOnboarding(req.user.entityId)));
});

// ---------------------------------------------------------------------------
// Admin: gerar, listar e cancelar convites.
const soAdmin = (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Apenas a plataforma" });
    return false;
  }
  return true;
};

router.post("/admin/onboarding-convites", (req, res) => {
  if (!soAdmin(req, res)) return;
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Informe o e-mail da empresa." });
  const trialDias = req.body?.comTrial ? TRIAL_ONBOARDING_DIAS : 0;
  const validade = validadeConviteDias(req.body?.validadeDias);

  const token = novoToken();
  const id = uid();
  const criadoEm = agora();
  const expiraEm = criadoEm + validade * 86400000;
  db.prepare(`INSERT INTO onboarding_convites (id, tokenHash, email, trialDias, criadoPor, criadoEm, expiraEm, observacao)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, hashToken(token), email, trialDias, req.user.id, criadoEm, expiraEm, String(req.body?.observacao || "").slice(0, 200));

  console.log(`[onboarding] convite gerado por ${req.user.id} — ${trialDias ? `trial ${trialDias} dias` : "sem trial"}, validade ${validade} dias`);

  const base = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
  res.status(201).json({
    id, email, trialDias, expiraEm, validadeDias: validade,
    // Mostrado uma vez só: o banco guarda apenas o hash.
    url: `${base}/comecar/${token}`,
    aviso: "Copie agora: este link não pode ser exibido de novo.",
  });
});

router.get("/admin/onboarding-convites", (req, res) => {
  if (!soAdmin(req, res)) return;
  const convites = db.prepare("SELECT * FROM onboarding_convites ORDER BY criadoEm DESC LIMIT 200").all().map((c) => {
    const empresa = c.usadoPor ? db.prepare("SELECT nome FROM companies WHERE id = ?").get(c.usadoPor) : null;
    const estado = estadoConviteOnboarding(c);
    return {
      id: c.id, email: c.email, trialDias: c.trialDias, observacao: c.observacao,
      criadoEm: c.criadoEm, expiraEm: c.expiraEm, usadoEm: c.usadoEm, usadoPor: empresa?.nome || null,
      estado: estado.ok ? "disponivel" : estado.motivo,
    };
  });
  res.json({ convites });
});

router.post("/admin/onboarding-convites/:id/revogar", (req, res) => {
  if (!soAdmin(req, res)) return;
  const r = db.prepare("UPDATE onboarding_convites SET revogadoEm = ? WHERE id = ? AND usadoEm IS NULL AND revogadoEm IS NULL")
    .run(agora(), req.params.id);
  if (!r.changes) return res.status(409).json({ error: "Este convite já foi usado ou cancelado." });
  res.json({ ok: true });
});

export default router;
