// Colaboradores internos — rotas do admin e da área do colaborador.
// Regras em server/services/colaboradores.js; especificação em docs/colaboradores/SPEC.md.
import { Router } from "express";
import db, { uid } from "../db.js";
import * as C from "../services/colaboradores.js";
import {
  TERMO_VERSAO, TERMO_SECOES, explicarFormula, mascararCpf, mesBR, dataBR, somarDias, feriadosNacionais, NATUREZAS,
  TIPOS_LANCAMENTO, CAMPOS_CONTRATO, VINCULOS, REGIMES, TIPOS_AUSENCIA, TIPOS_PROVA, cpfValido,
} from "../../shared/colaboradores.js";

const router = Router();
const hoje = () => dataBR(Date.now());
// trust proxy está ligado no index: req.ip já é o IP real, sem confiar em cabeçalho do cliente.
const ip = (req) => req.ip || "";

const h = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof C.ErroColab) return res.status(e.status).json({ error: e.message, reducoes: e.reducoes });
    console.error("[colaboradores]", e);
    res.status(500).json({ error: "Erro ao processar. Tente de novo." });
  }
};

const soAdmin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Apenas administradores" }));

// Colaborador logado. `liberado` exige contrato assinado, termo aceito e
// vínculo ativo (seção 9); quem saiu continua lendo contrato e relatórios (13.9).
function eu(exigeLiberado) {
  return (req, res, next) => {
    const colab = C.colaboradorPorUsuario(req.user.id);
    if (!colab) return res.status(404).json({ error: "Você não é colaborador interno." });
    const a = C.acesso(colab);
    if (exigeLiberado && !a.liberado) {
      return res.status(403).json({ error: a.encerrado ? "Seu vínculo foi encerrado." : !a.contratoAssinado ? "Assine o contrato para ver as tarefas." : "Aceite o termo de transparência para continuar." });
    }
    req.colab = colab;
    req.acessoColab = a;
    next();
  };
}

const periodo = (req) => {
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fim || "") ? req.query.fim : hoje();
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(req.query.inicio || "") ? req.query.inicio : `${fim.slice(0, 7)}-01`;
  return { inicio, fim };
};
const mesQuery = (req) => (/^\d{4}-\d{2}$/.test(req.query.mes || "") ? req.query.mes : mesBR(Date.now()));

// ───────────────────────────── Área do colaborador ─────────────────────────────

router.get("/colaborador/eu", h((req, res) => {
  const colab = C.colaboradorPorUsuario(req.user.id);
  if (!colab) return res.json({ colaborador: null });
  const regra = C.regraDe(colab);
  res.json({
    colaborador: { ...colab, cpf: mascararCpf(colab.cpf) },
    acesso: C.acesso(colab),
    termo: { versao: TERMO_VERSAO, secoes: TERMO_SECOES },
    contratos: C.contratos(colab),
    regra: {
      diasPrevistos: regra.diasPrevistos, horario: regra.horario, meta: regra.meta, medirPresenca: regra.medirPresenca,
      registroAtividade: regra.registroAtividade, diaTrabalhado: regra.diaTrabalhado, alertaDiasSemAtividade: regra.alertaDiasSemAtividade,
      formula: explicarFormula(regra),
    },
    avisos: C.avisos("colaborador", colab.id, { abertos: false, limite: 20 }),
    rotulos: { vinculos: VINCULOS, regimes: REGIMES, ausencias: TIPOS_AUSENCIA, provas: TIPOS_PROVA, lancamentos: TIPOS_LANCAMENTO },
  });
}));

router.post("/colaborador/termo", eu(false), h((req, res) => {
  if (req.colab.status !== "ativo") return res.status(403).json({ error: "Seu vínculo foi encerrado." });
  if (!req.acessoColab.contratoAssinado) return res.status(403).json({ error: "Assine o contrato primeiro." });
  C.aceitarTermo(req.colab, { ip: ip(req), userAgent: req.headers["user-agent"] });
  res.json({ ok: true, acesso: C.acesso(req.colab) });
}));

router.get("/colaborador/contratos/:id", eu(false), h((req, res) => {
  const c = C.contratoCompleto(req.colab, req.params.id);
  if (!c) return res.status(404).json({ error: "Documento não encontrado." });
  const { codigoHash, codigoExpira, codigoTentativas, ...resto } = c;
  res.json(resto);
}));

router.get("/colaborador/contratos/:id/documento", eu(false), h((req, res) => {
  const c = C.contratoCompleto(req.colab, req.params.id);
  if (!c) return res.status(404).send("Documento não encontrado.");
  res.type("html").send(C.documentoHtml(req.colab, c));
}));

router.post("/colaborador/contratos/:id/codigo", eu(false), h(async (req, res) => {
  if (req.colab.status !== "ativo") return res.status(403).json({ error: "Seu vínculo foi encerrado." });
  res.json(await C.enviarCodigo(req.colab, req.params.id));
}));

router.post("/colaborador/contratos/:id/assinar", eu(false), h((req, res) => {
  if (req.colab.status !== "ativo") return res.status(403).json({ error: "Seu vínculo foi encerrado." });
  const c = C.assinar(req.colab, req.params.id, req.body?.codigo, { ip: ip(req), userAgent: req.headers["user-agent"], nomeDigitado: req.body?.nome });
  res.json({ ok: true, status: c.status, acesso: C.acesso(req.colab) });
}));

router.get("/colaborador/tarefas", eu(true), h((req, res) => {
  res.json({ ocorrencias: C.ocorrenciasDoColaborador(req.colab) });
}));

router.post("/colaborador/tarefas/:id/pegar", eu(true), h((req, res) => {
  C.pegarOcorrencia(req.colab, req.params.id);
  res.json({ ok: true });
}));

router.post("/colaborador/tarefas/:id/prova", eu(true), h(async (req, res) => {
  const o = await C.enviarProva(req.colab, req.params.id, req.body || {});
  res.json({ ok: true, ocorrencia: o });
}));

router.get("/colaborador/provas/:id/arquivo", h(async (req, res) => {
  const a = await C.arquivoDaProva(req.params.id);
  if (!a) return res.status(404).json({ error: "Arquivo não encontrado." });
  const dono = C.colaboradorPorUsuario(req.user.id);
  if (req.user.role !== "admin" && dono?.id !== a.colaboradorId) return res.status(403).json({ error: "Sem permissão" });
  res.setHeader("Content-Type", a.mimetype);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(a.nome)}"`);
  res.send(a.buffer);
}));

router.get("/colaborador/painel", eu(false), h((req, res) => {
  const { inicio, fim } = periodo(req);
  res.json(C.painelDe(req.colab, inicio, fim));
}));

router.get("/colaborador/extrato", eu(false), h((req, res) => {
  res.json(C.extrato(req.colab, mesQuery(req)));
}));

router.get("/colaborador/ausencias", eu(false), h((req, res) => res.json({ ausencias: C.ausenciasDe(req.colab) })));
router.post("/colaborador/ausencias", eu(true), h((req, res) => {
  res.json({ ok: true, id: C.pedirAusencia(req.colab, req.body || {}, req.user.id, false) });
}));

router.get("/colaborador/registros", eu(false), h((req, res) => res.json({ registros: C.registrosDe(req.colab, somarDias(hoje(), -14)) })));
router.post("/colaborador/registro", eu(true), h((req, res) => {
  C.registrarAtividade(req.colab, req.body?.tipo);
  res.json({ ok: true });
}));

router.get("/colaborador/contestacoes", eu(false), h((req, res) => res.json({ contestacoes: C.contestacoesDe(req.colab) })));
router.post("/colaborador/contestacoes", eu(false), h((req, res) => {
  res.json({ ok: true, id: C.contestar(req.colab, req.body || {}) });
}));

router.get("/colaborador/relatorios", eu(false), h((req, res) => res.json({ relatorios: C.relatoriosDe(req.colab) })));

router.post("/colaborador/avisos/:id/lido", eu(false), h((req, res) => {
  db.prepare("UPDATE colab_avisos SET lidoEm = COALESCE(lidoEm, ?) WHERE id = ? AND colaboradorId = ? AND destino = 'colaborador'").run(Date.now(), req.params.id, req.colab.id);
  res.json({ ok: true });
}));

// ───────────────────────────── Admin ─────────────────────────────

router.get("/admin/colaboradores", soAdmin, h((req, res) => {
  res.json({
    colaboradores: C.resumoAdmin(),
    avisos: C.avisos("admin", null, { abertos: true, limite: 100 }),
    fila: C.filaRevisao().length,
    rotulos: { vinculos: VINCULOS, regimes: REGIMES, ausencias: TIPOS_AUSENCIA, provas: TIPOS_PROVA, lancamentos: TIPOS_LANCAMENTO, naturezas: NATUREZAS, campos: CAMPOS_CONTRATO },
  });
}));

router.get("/admin/colaboradores-usuarios", soAdmin, h((req, res) => {
  const q = String(req.query.email || "").trim().toLowerCase();
  if (q.length < 3) return res.json({ usuarios: [] });
  const rows = db.prepare(`SELECT u.id, u.email, u.role, s.nome AS nomeProfissional, s.documento FROM users u
    LEFT JOIN sellers s ON s.id = u.entityId AND u.role = 'vendedor' WHERE LOWER(u.email) LIKE ? ORDER BY u.email LIMIT 10`).all(`%${q}%`);
  res.json({ usuarios: rows.map((u) => ({ ...u, jaColaborador: !!C.colaboradorPorUsuario(u.id) })) });
}));

router.post("/admin/colaboradores", soAdmin, h((req, res) => {
  const b = req.body || {};
  if (b.cpf && !cpfValido(b.cpf)) return res.status(400).json({ error: "CPF inválido." });
  if (b.cargoId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dataInicio || "")) return res.status(400).json({ error: "Informe a data em que a pessoa começou a trabalhar." });
    return res.json(C.adicionarNoCargo(b, req.user.id));
  }
  res.json(C.ativarColaborador(b, req.user.id));
}));

// Organograma em cards: áreas, cargos e pessoas.
router.get("/admin/colaboradores-organograma", soAdmin, h((req, res) => res.json(C.organograma())));
router.post("/admin/colaboradores-areas", soAdmin, h((req, res) => res.json({ id: C.criarArea(req.body || {}, req.user.id) })));
router.patch("/admin/colaboradores-areas/:aid", soAdmin, h((req, res) => { C.editarArea(req.params.aid, req.body || {}, req.user.id); res.json({ ok: true }); }));
router.delete("/admin/colaboradores-areas/:aid", soAdmin, h((req, res) => { C.removerArea(req.params.aid, req.user.id); res.json({ ok: true }); }));
router.post("/admin/colaboradores-cargos", soAdmin, h((req, res) => res.json({ id: C.criarCargo(req.body || {}, req.user.id) })));
router.patch("/admin/colaboradores-cargos/:cid", soAdmin, h((req, res) => { C.editarCargo(req.params.cid, req.body || {}, req.user.id); res.json({ ok: true }); }));
router.delete("/admin/colaboradores-cargos/:cid", soAdmin, h((req, res) => { C.removerCargo(req.params.cid, req.user.id); res.json({ ok: true }); }));

router.put("/admin/colaboradores-config/empresa", soAdmin, h((req, res) => {
  const b = req.body?.empresa || {};
  const e = Object.fromEntries(["nome", "cnpj", "endereco", "representante", "cidade"].map((k) => [k, String(b[k] || "").trim().slice(0, 200)]));
  C.gravarConfig("empresa", e);
  C.auditar(req.user.id, "dados_empresa", null, "config", "empresa", e);
  // Quem entrou antes dos dados da empresa e ficou sem contrato recebe agora.
  let gerados = 0;
  if (C.empresaCompleta()) {
    for (const c of db.prepare("SELECT * FROM colaboradores WHERE status = 'ativo' AND NOT EXISTS (SELECT 1 FROM colab_contratos k WHERE k.colaboradorId = colaboradores.id AND k.tipo = 'contrato' AND k.status IN ('pendente','assinado'))").all()) {
      try { C.gerarContrato(c, "contrato", req.user.id); gerados++; } catch (err) { console.error("[colab] contrato pendente:", err.message); }
    }
  }
  res.json({ empresa: C.empresa(), completa: C.empresaCompleta(), contratosGerados: gerados });
}));

const carregar = (req, res, next) => {
  const c = C.colaboradorPorId(req.params.id);
  if (!c) return res.status(404).json({ error: "Colaborador não encontrado." });
  req.colab = c;
  next();
};

router.get("/admin/colaboradores/:id", soAdmin, carregar, h((req, res) => {
  const c = req.colab;
  const mes = mesQuery(req);
  const { inicio, fim } = periodo(req);
  res.json({
    colaborador: { ...c, email: db.prepare("SELECT email FROM users WHERE id = ?").get(c.userId)?.email },
    cargos: db.prepare("SELECT c.id, c.nome, c.vinculo, a.nome AS area FROM colab_cargos c JOIN colab_areas a ON a.id = c.areaId ORDER BY a.ordem, c.ordem").all(),
    acesso: C.acesso(c),
    regra: C.regraDe(c),
    versaoRegra: C.versaoRegra(c),
    historicoRegras: C.historicoRegras(c),
    formula: explicarFormula(C.regraDe(c)),
    contratos: C.contratos(c),
    ausencias: C.ausenciasDe(c),
    contestacoes: C.contestacoesDe(c),
    painel: C.painelDe(c, inicio, fim),
    extrato: C.extrato(c, mes),
    avisos: C.avisos("admin", c.id, { abertos: false, limite: 50 }),
    relatorios: C.relatoriosDe(c),
    registros: C.registrosDe(c, somarDias(hoje(), -14)),
    auditoria: db.prepare("SELECT acao, autorId, alvoTipo, alvoId, criadoEm FROM colab_auditoria WHERE colaboradorId = ? ORDER BY criadoEm DESC LIMIT 50").all(c.id),
  });
}));

router.patch("/admin/colaboradores/:id", soAdmin, carregar, h((req, res) => {
  if (req.body?.cpf && !cpfValido(req.body.cpf)) return res.status(400).json({ error: "CPF inválido." });
  if (req.body?.cargoId && req.body.cargoId !== req.colab.cargoId) C.moverParaCargo(req.colab, req.body.cargoId, req.user.id);
  res.json({ colaborador: C.atualizarCadastro(req.colab, req.body || {}, req.user.id) });
}));

router.put("/admin/colaboradores/:id/regra", soAdmin, carregar, h((req, res) => {
  const { regra, vigenciaInicio, motivo, confirmarReducao } = req.body || {};
  if (!regra) return res.status(400).json({ error: "Envie a regra." });
  res.json(C.salvarRegra(req.colab, regra, { autor: req.user.id, vigenciaInicio, motivo, confirmarReducao }));
}));

// Meta sugerida pela calibração: o admin aprova (com o valor que quiser) ou
// recomeça a medição. Nenhuma meta vale sem esta decisão (13.11).
router.post("/admin/colaboradores/:id/meta", soAdmin, carregar, h((req, res) => {
  const { acao, quantidade, avisoId } = req.body || {};
  const regra = C.regraDe(req.colab);
  let meta;
  if (acao === "aprovar") {
    const q = Number(quantidade);
    if (!(q > 0)) return res.status(400).json({ error: "Informe a meta." });
    meta = { ...regra.meta, quantidade: q, status: "ativa" };
  } else if (acao === "recalibrar") {
    meta = { ...regra.meta, quantidade: null, status: "calibrando", calibracaoDesde: hoje() };
  } else return res.status(400).json({ error: "Ação inválida." });
  const r = C.salvarRegra(req.colab, { ...regra, meta }, { autor: req.user.id, vigenciaInicio: hoje(), motivo: acao === "aprovar" ? "Meta aprovada" : "Nova calibração" });
  if (avisoId) C.resolverAviso(avisoId, req.user.id);
  res.json(r);
}));

router.post("/admin/colaboradores/:id/contrato", soAdmin, carregar, h((req, res) => {
  res.json({ contrato: C.gerarContrato(req.colab, req.body?.tipo === "aditivo" ? "aditivo" : "contrato", req.user.id) });
}));

router.get("/admin/colaboradores/:id/contratos/:cid/documento", soAdmin, carregar, h((req, res) => {
  const c = C.contratoCompleto(req.colab, req.params.cid);
  if (!c) return res.status(404).send("Documento não encontrado.");
  res.type("html").send(C.documentoHtml(req.colab, c));
}));

// Confere um código de verificação impresso num documento assinado.
router.get("/admin/colaboradores-verificar/:codigo", soAdmin, h((req, res) => {
  const c = C.verificarCodigo(req.params.codigo);
  res.json(c ? { valido: true, documento: c } : { valido: false });
}));

router.post("/admin/colaboradores/:id/encerrar", soAdmin, carregar, h((req, res) => {
  res.json({ colaborador: C.encerrarVinculo(req.colab, req.body || {}, req.user.id) });
}));

router.post("/admin/colaboradores/:id/ajuste", soAdmin, carregar, h((req, res) => {
  C.lancarAjuste(req.colab, req.body || {}, req.user.id);
  res.json({ ok: true });
}));

router.post("/admin/colaboradores/:id/ausencias", soAdmin, carregar, h((req, res) => {
  res.json({ ok: true, id: C.pedirAusencia(req.colab, req.body || {}, req.user.id, true) });
}));

router.patch("/admin/colaboradores-ausencias/:aid", soAdmin, h((req, res) => {
  C.decidirAusencia(req.params.aid, !!req.body?.aprovar, req.user.id);
  res.json({ ok: true });
}));

router.post("/admin/colaboradores-contestacoes/:cid/responder", soAdmin, h((req, res) => {
  C.responderContestacao(req.params.cid, req.body?.resposta, req.user.id);
  res.json({ ok: true });
}));

router.post("/admin/colaboradores-avisos/:aid/resolver", soAdmin, h((req, res) => {
  C.resolverAviso(req.params.aid, req.user.id);
  res.json({ ok: true });
}));

// Configuração: modelos de contrato, feriados e natureza de cada valor.
router.get("/admin/colaboradores-config", soAdmin, h((req, res) => {
  const ano = Number(hoje().slice(0, 4));
  res.json({
    empresa: C.empresa(),
    padroes: C.padroes(),
    avisos: C.configAvisos(),
    modelos: C.modelos(),
    feriadosNacionais: [...feriadosNacionais(ano), ...feriadosNacionais(ano + 1)],
    feriados: C.feriadosCadastrados(),
    naturezas: C.naturezas(),
    rotulos: { naturezas: NATUREZAS, lancamentos: TIPOS_LANCAMENTO, campos: CAMPOS_CONTRATO, vinculos: VINCULOS },
  });
}));

router.post("/admin/colaboradores-config/modelos", soAdmin, h((req, res) => res.json(C.salvarModelo(req.body || {}, req.user.id))));

router.post("/admin/colaboradores-config/feriados", soAdmin, h((req, res) => {
  const { data, nome } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "") || !nome?.trim()) return res.status(400).json({ error: "Informe data e nome do feriado." });
  db.prepare("INSERT OR IGNORE INTO colab_feriados (id, data, nome, criadoPor, criadoEm) VALUES (?, ?, ?, ?, ?)").run(uid(), data, nome.trim(), req.user.id, Date.now());
  C.auditar(req.user.id, "cadastrar_feriado", null, "feriado", data, { nome });
  res.json({ ok: true });
}));

router.delete("/admin/colaboradores-config/feriados/:fid", soAdmin, h((req, res) => {
  db.prepare("DELETE FROM colab_feriados WHERE id = ?").run(req.params.fid);
  C.auditar(req.user.id, "remover_feriado", null, "feriado", req.params.fid);
  res.json({ ok: true });
}));

// Padrões para novos colaboradores (não muda quem já existe).
router.put("/admin/colaboradores-config/padroes", soAdmin, h((req, res) => {
  const b = req.body?.padroes || {};
  const limpo = {};
  if (Array.isArray(b.diasPrevistos)) limpo.diasPrevistos = b.diasPrevistos.map(Number).filter((d) => d >= 0 && d <= 6);
  if (b.horario && /^\d{2}:\d{2}$/.test(b.horario.inicio || "") && /^\d{2}:\d{2}$/.test(b.horario.fim || "")) limpo.horario = { inicio: b.horario.inicio, fim: b.horario.fim };
  if (b.diaTrabalhado && ["envio", "aprovada", "registro"].includes(b.diaTrabalhado.criterio)) limpo.diaTrabalhado = { criterio: b.diaTrabalhado.criterio, minimo: Math.max(1, Number(b.diaTrabalhado.minimo) || 1) };
  if (b.alertaDiasSemAtividade != null) limpo.alertaDiasSemAtividade = Math.max(1, Number(b.alertaDiasSemAtividade) || 3);
  if (b.pesos) limpo.pesos = { meta: Number(b.pesos.meta) || 0, aprovacao: Number(b.pesos.aprovacao) || 0, presenca: Number(b.pesos.presenca) || 0 };
  if (b.registroAtividade != null) limpo.registroAtividade = !!b.registroAtividade;
  if (b.meta && ["dia", "semana"].includes(b.meta.periodo)) limpo.meta = { periodo: b.meta.periodo };
  if (b.garantiaDias != null) limpo.garantiaDias = Math.max(0, Number(b.garantiaDias) || 0);
  C.gravarConfig("padroes", limpo);
  C.auditar(req.user.id, "padroes", null, "config", "padroes", limpo);
  res.json({ padroes: C.padroes() });
}));

// Avisos e relatórios: e-mail do relatório, destinatários, lembrete e alerta imediato.
router.put("/admin/colaboradores-config/avisos", soAdmin, h((req, res) => {
  const b = req.body?.avisos || {};
  const limpo = {
    relatorioEmail: !!b.relatorioEmail, lembreteEmail: !!b.lembreteEmail, alertaEmail: !!b.alertaEmail,
    destinatarios: String(b.destinatarios || "").slice(0, 500),
  };
  C.gravarConfig("avisos", limpo);
  C.auditar(req.user.id, "config_avisos", null, "config", "avisos", limpo);
  res.json({ avisos: C.configAvisos() });
}));

// Chave "Colaborador interno" na ficha do profissional (seção 1).
router.get("/admin/colaboradores-por-profissional/:sellerId", soAdmin, h((req, res) => {
  const u = db.prepare("SELECT id, email FROM users WHERE role = 'vendedor' AND entityId = ?").get(req.params.sellerId);
  if (!u) return res.json({ usuario: null, colaborador: null });
  const c = C.colaboradorPorUsuario(u.id);
  res.json({ usuario: u, colaborador: c ? { id: c.id, status: c.status, funcao: c.funcao, vinculo: c.vinculo, ...C.acesso(c) } : null });
}));

router.put("/admin/colaboradores-config/naturezas", soAdmin, h((req, res) => {
  const entrada = req.body?.naturezas || {};
  const limpo = Object.fromEntries(Object.entries(entrada).filter(([k, v]) => (k === "fixo" || TIPOS_LANCAMENTO[k]) && NATUREZAS[v]));
  C.gravarConfig("naturezas", limpo);
  C.auditar(req.user.id, "naturezas", null, "config", "naturezas", limpo);
  res.json({ naturezas: C.naturezas() });
}));

// Tarefas e revisão.
router.get("/admin/colaboradores-tarefas", soAdmin, h((req, res) => {
  C.gerarOcorrencias();
  res.json({
    tarefas: C.listarTarefas(),
    fila: C.filaRevisao(),
    automaticas: C.aprovadasAutomaticamente(Date.now() - 14 * 86400000),
    colaboradores: db.prepare("SELECT id, nome, funcao FROM colaboradores WHERE status = 'ativo' ORDER BY nome").all(),
  });
}));

router.post("/admin/colaboradores-tarefas", soAdmin, h((req, res) => res.json({ id: C.salvarTarefa(req.body || {}, req.user.id) })));
router.put("/admin/colaboradores-tarefas/:tid", soAdmin, h((req, res) => res.json({ id: C.salvarTarefa(req.body || {}, req.user.id, req.params.tid) })));
router.patch("/admin/colaboradores-tarefas/:tid/status", soAdmin, h((req, res) => {
  C.mudarStatusTarefa(req.params.tid, req.body?.status, req.user.id);
  res.json({ ok: true });
}));
router.post("/admin/colaboradores-tarefas/sugerir", soAdmin, h(async (req, res) => {
  res.json({ ids: await C.sugerirTarefasIA(req.body || {}, req.user.id) });
}));
router.post("/admin/colaboradores-ocorrencias/:oid/revisar", soAdmin, h((req, res) => {
  C.revisarOcorrencia(req.params.oid, req.body?.acao, req.body?.motivo, req.user.id);
  res.json({ ok: true });
}));

// Fechamento do mês e exportação para o contador.
router.get("/admin/colaboradores-fechamento", soAdmin, h((req, res) => res.json(C.previaFechamento(mesQuery(req)))));
router.post("/admin/colaboradores-fechamento", soAdmin, h((req, res) => res.json(C.fecharMes(req.body?.mes, req.user.id))));
router.get("/admin/colaboradores-fechamento.csv", soAdmin, h((req, res) => {
  const mes = mesQuery(req);
  const cid = req.query.colaboradorId ? String(req.query.colaboradorId) : null;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="fechamento-colaboradores-${mes}${cid ? "-" + cid.slice(0, 8) : ""}.csv"`);
  res.send(C.fechamentoCsv(mes, cid));
}));
router.get("/admin/colaboradores-fechamento.html", soAdmin, h((req, res) => {
  res.type("html").send(C.fechamentoHtml(mesQuery(req), req.query.colaboradorId || null));
}));

export default router;
