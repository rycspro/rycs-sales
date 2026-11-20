// Colaboradores internos — regras de negócio no servidor.
// Especificação: docs/colaboradores/SPEC.md. Cálculos puros: shared/colaboradores.js.
//
// Princípios que este arquivo respeita:
// - A IA só resume e alerta. Nada aqui deixa a IA aprovar, recusar, descontar
//   ou mexer em vínculo (seções 4.1 e 10).
// - Lançamentos nunca são editados nem apagados: `reconciliar` grava a
//   diferença entre o valor devido e o já lançado (seção 5).
// - Sem foto, localização, tela ou teclado: só entra o que o colaborador
//   registra na plataforma.
import { createHash, randomInt } from "crypto";
import { Readable } from "stream";
import { lookup } from "dns/promises";
import { isIP } from "net";
import Anthropic from "@anthropic-ai/sdk";
import db, { uid, agora } from "../db.js";
import { sendEmail } from "./email.js";
import { salvar, lerBuffer } from "./arquivos.js";
import {
  normalizarRegra, regraPadrao, dataBR, mesBR, somarDias, segundaDaSemana, ultimoDiaDoMes, mesSeguinte, mesAnterior,
  fimDoDiaTs, inicioDoDiaTs, feriadosNacionais, foraDaJornada, calcularDias, calcularPainel, tendencia, ausenciasSeguidas,
  sugerirMeta, calibracaoTerminou, camposDoContrato, preencherContrato, mudouContrato, formatarCents, TIPOS_LANCAMENTO,
  NATUREZAS, VINCULOS, REGIMES, TERMO_VERSAO, dataBRFormatada, formatarCpf, minutoBR, reducoes, aplicarPadroes,
} from "../../shared/colaboradores.js";

const MODELO_IA = process.env.COLAB_IA_MODELO || "claude-sonnet-5-5";
const MAX_ARQUIVO = 8 * 1024 * 1024;
const TIPOS_ARQUIVO = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const json = (s, padrao = {}) => { try { return s ? JSON.parse(s) : padrao; } catch { return padrao; } };
const sha256 = (v) => createHash("sha256").update(v).digest("hex");
const hojeBR = () => dataBR(agora());
const escapar = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export class ErroColab extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

// ───────────────────────────── Auditoria e config ─────────────────────────────

export function auditar(autorId, acao, colaboradorId, alvoTipo = "", alvoId = "", dados = {}) {
  db.prepare("INSERT INTO colab_auditoria (id, autorId, acao, colaboradorId, alvoTipo, alvoId, dados, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(uid(), autorId || null, acao, colaboradorId || null, alvoTipo, alvoId ? String(alvoId) : "", JSON.stringify(dados), agora());
}

export function lerConfig(chave, padrao) {
  const r = db.prepare("SELECT valor FROM colab_config WHERE chave = ?").get(chave);
  return r ? json(r.valor, padrao) : padrao;
}
export function gravarConfig(chave, valor) {
  db.prepare("INSERT INTO colab_config (chave, valor, atualizadoEm) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizadoEm = excluded.atualizadoEm")
    .run(chave, JSON.stringify(valor), agora());
}

export function padroes() { return lerConfig("padroes", {}); }
export function configAvisos() {
  return { relatorioEmail: true, destinatarios: "", lembreteEmail: true, alertaEmail: false, ...lerConfig("avisos", {}) };
}
function emailsAdmins() {
  const cfg = configAvisos();
  const lista = String(cfg.destinatarios || "").split(/[,;\s]+/).map((e) => e.trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (lista.length) return lista;
  return db.prepare("SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL").all().map((a) => a.email);
}

export function naturezas() {
  const padrao = Object.fromEntries(Object.keys(TIPOS_LANCAMENTO).map((t) => [t, "a_classificar"]));
  return { fixo: "a_classificar", ...padrao, ...lerConfig("naturezas", {}) };
}

// ───────────────────────────── Colaborador e regra ─────────────────────────────

export const colaboradorPorUsuario = (userId) => db.prepare("SELECT * FROM colaboradores WHERE userId = ?").get(userId) || null;
export const colaboradorPorId = (id) => db.prepare("SELECT * FROM colaboradores WHERE id = ?").get(id) || null;
const ativos = () => db.prepare("SELECT * FROM colaboradores WHERE status = 'ativo'").all();

function linhaRegra(colab, data) {
  if (data) {
    const r = db.prepare("SELECT * FROM colab_regras WHERE colaboradorId = ? AND vigenciaInicio <= ? ORDER BY vigenciaInicio DESC, versao DESC LIMIT 1").get(colab.id, data);
    if (r) return r;
  }
  return db.prepare("SELECT * FROM colab_regras WHERE colaboradorId = ? ORDER BY versao DESC LIMIT 1").get(colab.id) || null;
}

export function regraDe(colab, data) {
  const l = linhaRegra(colab, data);
  return normalizarRegra(l ? json(l.regra) : regraPadrao({ vinculo: colab.vinculo, regime: colab.regime }), { vinculo: colab.vinculo, regime: colab.regime });
}
export function versaoRegra(colab) {
  return db.prepare("SELECT MAX(versao) AS v FROM colab_regras WHERE colaboradorId = ?").get(colab.id)?.v || 0;
}

export function historicoRegras(colab) {
  return db.prepare("SELECT versao, regra, vigenciaInicio, motivo, criadoPor, criadoEm FROM colab_regras WHERE colaboradorId = ? ORDER BY versao DESC").all(colab.id)
    .map((r) => ({ ...r, regra: normalizarRegra(json(r.regra)) }));
}

function inserirRegra(colab, regra, autor, vigenciaInicio, motivo) {
  const versao = versaoRegra(colab) + 1;
  db.prepare("INSERT INTO colab_regras (id, colaboradorId, versao, regra, vigenciaInicio, motivo, criadoPor, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(uid(), colab.id, versao, JSON.stringify(normalizarRegra(regra, colab)), vigenciaInicio, motivo || "", autor, agora());
  return versao;
}

// ───────────────────────────── Ativação ─────────────────────────────

export function ativarColaborador({ userId, nome, cpf, funcao, vinculo, regime, dataInicio, jornadaHoras, regra }, autor) {
  const u = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!u) throw new ErroColab("Usuário não encontrado.", 404);
  if (colaboradorPorUsuario(userId)) throw new ErroColab("Este usuário já é colaborador interno.", 409);
  if (!nome?.trim()) throw new ErroColab("Informe o nome completo.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio || "")) throw new ErroColab("Informe a data real de início do trabalho.");
  const id = uid();
  const v = VINCULOS[vinculo] ? vinculo : "clt";
  const rg = REGIMES[regime] ? regime : v === "clt" ? "presencial" : "";
  db.transaction(() => {
    db.prepare(`INSERT INTO colaboradores (id, userId, nome, cpf, funcao, vinculo, regime, dataInicio, jornadaHoras, status, criadoPor, criadoEm, atualizadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?, ?, ?)`)
      .run(id, userId, nome.trim(), String(cpf || "").replace(/\D/g, ""), (funcao || "").trim(), v, rg, dataInicio, Number(jornadaHoras) || 0, autor, agora(), agora());
    const colab = colaboradorPorId(id);
    const base = aplicarPadroes(regraPadrao({ vinculo: v, regime: rg, hoje: hojeBR() }), padroes());
    inserirRegra(colab, { ...base, ...(regra || {}), meta: { ...base.meta, ...(regra?.meta || {}), calibracaoDesde: hojeBR() } }, autor, dataInicio, "Ativação");
    auditar(autor, "ativar", id, "colaborador", id, { vinculo: v, regime: rg, dataInicio });
  })();
  const colab = colaboradorPorId(id);
  // Ao ligar a chave, o contrato sai do modelo do vínculo, se existir (seção 9).
  let contrato = null;
  try { contrato = gerarContrato(colab, "contrato", autor); } catch (e) { contrato = { erro: e.message }; }
  return { colaborador: colab, contrato };
}

export function atualizarCadastro(colab, campos, autor) {
  const novo = {
    nome: campos.nome?.trim() || colab.nome,
    cpf: campos.cpf !== undefined ? String(campos.cpf).replace(/\D/g, "") : colab.cpf,
    funcao: campos.funcao !== undefined ? String(campos.funcao).trim() : colab.funcao,
    regime: campos.regime !== undefined && (REGIMES[campos.regime] || campos.regime === "") ? campos.regime : colab.regime,
    jornadaHoras: campos.jornadaHoras !== undefined ? Number(campos.jornadaHoras) || 0 : colab.jornadaHoras,
    dataInicio: /^\d{4}-\d{2}-\d{2}$/.test(campos.dataInicio || "") ? campos.dataInicio : colab.dataInicio,
  };
  db.prepare("UPDATE colaboradores SET nome = ?, cpf = ?, funcao = ?, regime = ?, jornadaHoras = ?, dataInicio = ?, atualizadoEm = ? WHERE id = ?")
    .run(novo.nome, novo.cpf, novo.funcao, novo.regime, novo.jornadaHoras, novo.dataInicio, agora(), colab.id);
  auditar(autor, "editar_cadastro", colab.id, "colaborador", colab.id, { antes: { ...colab }, depois: novo });
  return colaboradorPorId(colab.id);
}

// Salva uma nova versão da regra. Se mudar remuneração ou jornada e já houver
// contrato assinado, gera o aditivo (seção 9). Redução de valor exige que o
// admin confirme ter lido o aviso do art. 468 (seção 13.7).
export function salvarRegra(colab, regraNova, { autor, vigenciaInicio, motivo, confirmarReducao }) {
  const atual = regraDe(colab);
  const nova = normalizarRegra(regraNova, colab);
  const reduz = colab.vinculo === "clt" ? reducoes(atual, nova) : [];
  if (reduz.length && !confirmarReducao) {
    const e = new ErroColab("Esta alteração reduz valores de um empregado.", 409);
    e.reducoes = reduz;
    throw e;
  }
  const vig = /^\d{4}-\d{2}-\d{2}$/.test(vigenciaInicio || "") ? vigenciaInicio : hojeBR();
  const versao = inserirRegra(colab, nova, autor, vig, motivo);
  auditar(autor, "alterar_regra", colab.id, "regra", String(versao), { antes: atual, depois: nova, vigenciaInicio: vig, reducoes: reduz });
  let aditivo = null;
  if (mudouContrato(atual, nova) && contratoAssinado(colab)) {
    try { aditivo = gerarContrato(colab, "aditivo", autor); } catch (e) { aditivo = { erro: e.message }; }
  }
  return { versao, aditivo, reducoes: reduz };
}

export function encerrarVinculo(colab, { dataSaida, motivo }, autor) {
  if (colab.status === "encerrado") throw new ErroColab("O vínculo já está encerrado.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataSaida || "")) throw new ErroColab("Informe a data de saída.");
  db.prepare("UPDATE colaboradores SET status = 'encerrado', dataSaida = ?, motivoSaida = ?, atualizadoEm = ? WHERE id = ?")
    .run(dataSaida, motivo || "", agora(), colab.id);
  // Tarefas reservadas e ainda abertas voltam para a fila dos outros.
  db.prepare("UPDATE colab_ocorrencias SET colaboradorId = NULL, reservadaEm = NULL WHERE colaboradorId = ? AND status = 'aberta' AND chave LIKE '%:*:%'").run(colab.id);
  auditar(autor, "encerrar_vinculo", colab.id, "colaborador", colab.id, { dataSaida, motivo });
  return colaboradorPorId(colab.id);
}

// ───────────────────────────── Feriados e meses ─────────────────────────────

export function feriadosCadastrados() {
  return db.prepare("SELECT * FROM colab_feriados ORDER BY data").all();
}
export function feriadosSet(anos) {
  const s = new Set();
  for (const a of anos) for (const f of feriadosNacionais(a)) s.add(f.data);
  for (const f of feriadosCadastrados()) s.add(f.data);
  return s;
}
const anosEntre = (ini, fim) => { const out = []; for (let a = Number(ini.slice(0, 4)); a <= Number(fim.slice(0, 4)); a++) out.push(a); return out; };

export const mesFechado = (mes) => !!db.prepare("SELECT 1 FROM colab_fechamentos WHERE mes = ?").get(mes);
function mesAberto(mes) {
  let m = mes;
  while (mesFechado(m)) m = mesSeguinte(m);
  return m;
}

// ───────────────────────────── Lançamentos ─────────────────────────────

// Grava a diferença entre o valor devido de uma origem e o que já foi lançado.
// Positiva = crédito do tipo da origem; negativa = estorno. Idempotente.
export function reconciliar({ colab, origemTipo, origemId, devidoCents, descricao, autor, motivo = "" }) {
  return db.transaction(() => {
    const ja = db.prepare("SELECT COALESCE(SUM(valorCents), 0) AS s, COUNT(*) AS n FROM colab_lancamentos WHERE colaboradorId = ? AND origemTipo = ? AND origemId = ?")
      .get(colab.id, origemTipo, String(origemId));
    const dif = Math.round(Number(devidoCents) || 0) - Number(ja.s);
    if (!dif) return null;
    const id = uid();
    db.prepare(`INSERT OR IGNORE INTO colab_lancamentos (id, colaboradorId, mes, tipo, origemTipo, origemId, valorCents, descricao, motivo, autor, chave, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, colab.id, mesAberto(mesBR(agora())), dif > 0 ? origemTipo : "estorno", origemTipo, String(origemId), dif,
        descricao || "", motivo, autor || "sistema", `${origemTipo}:${origemId}:${ja.n}`, agora());
    return id;
  })();
}

export function lancarAjuste(colab, { valorCents, motivo }, autor) {
  const v = Math.round(Number(valorCents));
  if (!v) throw new ErroColab("Informe o valor do ajuste.");
  if (!motivo?.trim()) throw new ErroColab("Todo ajuste precisa de motivo.");
  const origemId = uid();
  db.prepare(`INSERT INTO colab_lancamentos (id, colaboradorId, mes, tipo, origemTipo, origemId, valorCents, descricao, motivo, autor, chave, criadoEm)
              VALUES (?, ?, ?, 'ajuste', 'ajuste', ?, ?, ?, ?, ?, ?, ?)`)
    .run(uid(), colab.id, mesAberto(mesBR(agora())), origemId, v, "Ajuste manual", motivo.trim(), autor, `ajuste:${origemId}:0`, agora());
  auditar(autor, "ajuste", colab.id, "lancamento", origemId, { valorCents: v, motivo });
}

// ───────────────────────────── Contrato ─────────────────────────────

export function modelos() {
  return db.prepare("SELECT id, tipo, vinculo, titulo, versao, ativo, criadoEm, texto FROM colab_contrato_modelos ORDER BY tipo, vinculo, versao DESC").all();
}
export function salvarModelo({ tipo, vinculo, titulo, texto }, autor) {
  const t = tipo === "aditivo" ? "aditivo" : "contrato";
  if (!VINCULOS[vinculo]) throw new ErroColab("Escolha o tipo de vínculo do modelo.");
  if (!titulo?.trim() || !texto?.trim()) throw new ErroColab("Informe título e texto do modelo.");
  const versao = (db.prepare("SELECT MAX(versao) AS v FROM colab_contrato_modelos WHERE tipo = ? AND vinculo = ?").get(t, vinculo)?.v || 0) + 1;
  const id = uid();
  db.transaction(() => {
    db.prepare("UPDATE colab_contrato_modelos SET ativo = 0 WHERE tipo = ? AND vinculo = ?").run(t, vinculo);
    db.prepare("INSERT INTO colab_contrato_modelos (id, tipo, vinculo, titulo, versao, texto, ativo, criadoPor, criadoEm) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
      .run(id, t, vinculo, titulo.trim(), versao, texto, autor, agora());
  })();
  auditar(autor, "salvar_modelo", null, "modelo", id, { tipo: t, vinculo, versao });
  return { id, versao };
}
const modeloAtivo = (tipo, vinculo) =>
  db.prepare("SELECT * FROM colab_contrato_modelos WHERE tipo = ? AND vinculo = ? AND ativo = 1 ORDER BY versao DESC LIMIT 1").get(tipo, vinculo);

export function gerarContrato(colab, tipo, autor) {
  const modelo = modeloAtivo(tipo, colab.vinculo);
  if (!modelo) throw new ErroColab(`Ainda não há modelo de ${tipo} para "${VINCULOS[colab.vinculo]}". Cadastre o modelo aprovado pelo advogado.`);
  const regra = regraDe(colab);
  const { texto, faltando } = preencherContrato(modelo.texto, camposDoContrato(colab, regra, hojeBR()));
  if (faltando.length) throw new ErroColab(`Faltam dados para preencher o ${tipo}: ${faltando.join(", ")}.`);
  // Um pendente do mesmo tipo é substituído pelo novo (fica cancelado no histórico).
  db.prepare("UPDATE colab_contratos SET status = 'cancelado' WHERE colaboradorId = ? AND tipo = ? AND status = 'pendente'").run(colab.id, tipo);
  const id = uid();
  db.prepare(`INSERT INTO colab_contratos (id, colaboradorId, tipo, modeloId, modeloVersao, regraVersao, titulo, texto, hash, status, criadoPor, criadoEm)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`)
    .run(id, colab.id, tipo, modelo.id, modelo.versao, versaoRegra(colab), modelo.titulo, texto, sha256(texto), autor, agora());
  auditar(autor, "gerar_" + tipo, colab.id, "contrato", id, { modeloVersao: modelo.versao });
  const u = db.prepare("SELECT email FROM users WHERE id = ?").get(colab.userId);
  notificar(colab, tipo === "aditivo" ? "Aditivo para você aceitar" : "Seu contrato está pronto", "Abra a área Colaborador RYCS para ler e assinar.");
  if (u?.email) sendEmail(u.email, tipo === "aditivo" ? "Há um aditivo para você aceitar" : "Seu contrato com a RYCS está pronto",
    `<p>Olá, ${escapar(colab.nome.split(" ")[0])}.</p><p>${tipo === "aditivo" ? "Há um aditivo ao seu contrato" : "O seu contrato"} está disponível na área <b>Colaborador RYCS</b> da plataforma. Leia com calma e assine por lá.</p>`).catch(() => {});
  return db.prepare("SELECT id, tipo, status, modeloVersao, criadoEm FROM colab_contratos WHERE id = ?").get(id);
}

export function contratos(colab) {
  return db.prepare("SELECT id, tipo, titulo, status, modeloVersao, regraVersao, hash, assinadoEm, ip, criadoEm, codigoVerificacao FROM colab_contratos WHERE colaboradorId = ? ORDER BY criadoEm DESC").all(colab.id);
}
export const contratoAssinado = (colab) =>
  !!db.prepare("SELECT 1 FROM colab_contratos WHERE colaboradorId = ? AND tipo = 'contrato' AND status = 'assinado'").get(colab.id);

export function contratoCompleto(colab, contratoId) {
  return db.prepare("SELECT * FROM colab_contratos WHERE id = ? AND colaboradorId = ?").get(contratoId, colab.id) || null;
}

// Assinatura na fase 1 (seção 13.8): código de 6 dígitos por e-mail.
export async function enviarCodigo(colab, contratoId) {
  const c = contratoCompleto(colab, contratoId);
  if (!c || c.status !== "pendente") throw new ErroColab("Documento não está pendente de assinatura.", 404);
  const codigo = String(randomInt(0, 1000000)).padStart(6, "0");
  db.prepare("UPDATE colab_contratos SET codigoHash = ?, codigoExpira = ?, codigoTentativas = 0 WHERE id = ?")
    .run(sha256(`${c.id}:${codigo}`), agora() + 15 * 60 * 1000, c.id);
  const u = db.prepare("SELECT email FROM users WHERE id = ?").get(colab.userId);
  if (!u?.email) throw new ErroColab("Sua conta não tem e-mail cadastrado.");
  await sendEmail(u.email, `Código para assinar: ${codigo}`,
    `<p>Use o código <b style="font-size:20px;letter-spacing:3px">${codigo}</b> para assinar o documento "${escapar(c.titulo)}".</p><p>O código vale por 15 minutos. Se não foi você quem pediu, ignore este e-mail.</p>`);
  return { enviadoPara: u.email.replace(/^(.{2}).*(@.*)$/, "$1***$2") };
}

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Código curto que identifica a assinatura e aparece no documento. Permite
// conferir depois, no admin, que aquele documento foi assinado na plataforma.
export const codigoDeVerificacao = (c, assinadoEm) => {
  const h = sha256(`${c.id}:${c.hash}:${assinadoEm}`).slice(0, 12).toUpperCase();
  return `RYCS-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
};

export function verificarCodigo(codigo) {
  const c = db.prepare("SELECT c.id, c.tipo, c.titulo, c.status, c.hash, c.assinadoEm, c.modeloVersao, k.nome FROM colab_contratos c JOIN colaboradores k ON k.id = c.colaboradorId WHERE c.codigoVerificacao = ?")
    .get(String(codigo || "").trim().toUpperCase());
  return c || null;
}

export function assinar(colab, contratoId, codigo, { ip, userAgent, nomeDigitado }) {
  const c = contratoCompleto(colab, contratoId);
  if (!c || c.status !== "pendente") throw new ErroColab("Documento não está pendente de assinatura.", 404);
  if (semAcento(nomeDigitado) !== semAcento(colab.nome)) throw new ErroColab(`Digite o seu nome completo exatamente como está no documento: ${colab.nome}.`);
  if (!c.codigoHash || !c.codigoExpira || c.codigoExpira < agora()) throw new ErroColab("Código expirado. Peça um novo.");
  if ((c.codigoTentativas || 0) >= 5) throw new ErroColab("Muitas tentativas. Peça um novo código.");
  if (sha256(`${c.id}:${String(codigo || "").trim()}`) !== c.codigoHash) {
    db.prepare("UPDATE colab_contratos SET codigoTentativas = codigoTentativas + 1 WHERE id = ?").run(c.id);
    throw new ErroColab("Código incorreto.");
  }
  if (sha256(c.texto) !== c.hash) throw new ErroColab("O texto do documento não confere com o original. Fale com o administrador.", 409);
  const em = agora();
  const verif = codigoDeVerificacao(c, em);
  db.prepare("UPDATE colab_contratos SET status = 'assinado', assinadoEm = ?, ip = ?, userAgent = ?, codigoHash = NULL, nomeDigitado = ?, codigoVerificacao = ? WHERE id = ?")
    .run(em, ip || "", String(userAgent || "").slice(0, 300), String(nomeDigitado).trim().slice(0, 200), verif, c.id);
  auditar(colab.userId, "assinar_" + c.tipo, colab.id, "contrato", c.id, { hash: c.hash, ip, codigoVerificacao: verif });
  return contratoCompleto(colab, c.id);
}

export function documentoHtml(colab, c) {
  const rodape = c.status === "assinado"
    ? `Assinado eletronicamente na plataforma RYCS por ${escapar(colab.nome)} (nome digitado: "${escapar(c.nomeDigitado || colab.nome)}") em ${new Date(c.assinadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}, com código de confirmação enviado ao e-mail cadastrado. IP ${escapar(c.ip || "—")}.<br><b>Código de verificação: ${escapar(c.codigoVerificacao || "—")}</b>`
    : "Documento ainda não assinado.";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(c.titulo)}</title>
<style>body{font:15px/1.6 Georgia,serif;color:#111;background:#fff;max-width:760px;margin:32px auto;padding:0 16px}h1{font-size:20px}pre{white-space:pre-wrap;font:inherit}footer{margin-top:32px;border-top:1px solid #999;padding-top:12px;font:12px/1.5 system-ui,sans-serif;color:#333}@media print{button{display:none}}</style></head>
<body><button onclick="window.print()" style="min-height:44px;padding:8px 16px;margin-bottom:16px">Salvar em PDF ou imprimir</button>
<h1>${escapar(c.titulo)}</h1><pre>${escapar(c.texto)}</pre>
<footer>${rodape}<br>Tipo: ${escapar(c.tipo)} · Modelo versão ${c.modeloVersao} · Regra versão ${c.regraVersao}<br>SHA-256 do texto: ${escapar(c.hash)}</footer></body></html>`;
}

// ───────────────────────────── Termo ─────────────────────────────

export const termoAceito = (colab) =>
  !!db.prepare("SELECT 1 FROM colab_termo_aceites WHERE colaboradorId = ? AND versao = ?").get(colab.id, TERMO_VERSAO);

export function aceitarTermo(colab, { ip, userAgent }) {
  db.prepare("INSERT OR IGNORE INTO colab_termo_aceites (id, colaboradorId, userId, versao, ip, userAgent, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(uid(), colab.id, colab.userId, TERMO_VERSAO, ip || "", String(userAgent || "").slice(0, 300), agora());
  auditar(colab.userId, "aceitar_termo", colab.id, "termo", TERMO_VERSAO, { ip });
}

export function acesso(colab) {
  const assinado = contratoAssinado(colab);
  const termo = termoAceito(colab);
  return {
    contratoAssinado: assinado,
    termoAceito: termo,
    encerrado: colab.status === "encerrado",
    liberado: assinado && termo && colab.status === "ativo",
  };
}

// ───────────────────────────── Notificações ─────────────────────────────

function notificar(colab, titulo, corpo) {
  try {
    db.prepare("INSERT INTO notifications (id, userId, tipo, titulo, corpo, lida, criadoEm) VALUES (?, ?, 'colaborador', ?, ?, 0, ?)")
      .run(uid(), colab.userId, titulo, corpo, agora());
  } catch { /* notificação é acessória */ }
}

function registrarAviso({ colab, destino, tipo, titulo, texto, chave, dados = {} }) {
  const r = db.prepare("INSERT OR IGNORE INTO colab_avisos (id, colaboradorId, destino, tipo, titulo, texto, dados, chave, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(uid(), colab?.id || null, destino, tipo, titulo, texto || "", JSON.stringify(dados), chave, agora());
  const novo = r.changes > 0;
  // Alerta por e-mail na hora, só se o admin ligou em Configuração.
  if (novo && destino === "admin" && configAvisos().alertaEmail)
    for (const e of emailsAdmins()) sendEmail(e, titulo, `<p>${escapar(texto)}</p><p>Detalhes no admin, em Colaboradores.</p>`).catch(() => {});
  return novo;
}

export function avisos(destino, colabId, { abertos = true, limite = 100 } = {}) {
  const filtro = colabId ? "AND colaboradorId = ?" : "";
  const args = colabId ? [destino, colabId] : [destino];
  return db.prepare(`SELECT * FROM colab_avisos WHERE destino = ? ${filtro} ${abertos ? "AND resolvidoEm IS NULL" : ""} ORDER BY criadoEm DESC LIMIT ${Number(limite)}`).all(...args)
    .map((a) => ({ ...a, dados: json(a.dados) }));
}
export function resolverAviso(id, autor) {
  db.prepare("UPDATE colab_avisos SET resolvidoEm = ?, lidoEm = COALESCE(lidoEm, ?) WHERE id = ?").run(agora(), agora(), id);
  auditar(autor, "resolver_aviso", null, "aviso", id);
}

// ───────────────────────────── Tarefas ─────────────────────────────

export function salvarTarefa(dados, autor, id = null) {
  const atrib = ["pessoa", "funcao", "todos"].includes(dados.atribuicao) ? dados.atribuicao : "pessoa";
  if (!dados.titulo?.trim()) throw new ErroColab("Dê um título à tarefa.");
  if (atrib !== "todos" && !String(dados.alvo || "").trim()) throw new ErroColab(atrib === "pessoa" ? "Escolha o colaborador." : "Informe a função.");
  const rec = ["unica", "diaria", "semanal"].includes(dados.recorrencia) ? dados.recorrencia : "unica";
  if (rec === "unica" && !/^\d{4}-\d{2}-\d{2}$/.test(dados.prazoData || "")) throw new ErroColab("Tarefa única precisa de prazo.");
  const campos = {
    titulo: dados.titulo.trim(), descricao: String(dados.descricao || "").trim(), atribuicao: atrib,
    alvo: atrib === "todos" ? "" : String(dados.alvo).trim(), prazoData: rec === "unica" ? dados.prazoData : null, recorrencia: rec,
    valorCents: dados.valorCents === "" || dados.valorCents == null ? null : Math.max(0, Math.round(Number(dados.valorCents) || 0)),
    tipoProva: ["link", "arquivo", "texto"].includes(dados.tipoProva) ? dados.tipoProva : "texto",
    aprovacao: dados.aprovacao === "automatica" ? "automatica" : "manual",
    contaMeta: dados.contaMeta === false || dados.contaMeta === 0 ? 0 : 1,
  };
  if (id) {
    db.prepare(`UPDATE colab_tarefas SET titulo=?, descricao=?, atribuicao=?, alvo=?, prazoData=?, recorrencia=?, valorCents=?, tipoProva=?, aprovacao=?, contaMeta=?, atualizadoEm=? WHERE id = ?`)
      .run(campos.titulo, campos.descricao, campos.atribuicao, campos.alvo, campos.prazoData, campos.recorrencia, campos.valorCents, campos.tipoProva, campos.aprovacao, campos.contaMeta, agora(), id);
    auditar(autor, "editar_tarefa", atrib === "pessoa" ? campos.alvo : null, "tarefa", id, campos);
    return id;
  }
  const novo = uid();
  const status = dados.status === "sugerida" ? "sugerida" : "ativa";
  db.prepare(`INSERT INTO colab_tarefas (id, titulo, descricao, atribuicao, alvo, prazoData, recorrencia, valorCents, tipoProva, aprovacao, contaMeta, status, sugeridaPorIA, criadoPor, criadoEm, atualizadoEm)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(novo, campos.titulo, campos.descricao, campos.atribuicao, campos.alvo, campos.prazoData, campos.recorrencia, campos.valorCents,
      campos.tipoProva, campos.aprovacao, campos.contaMeta, status, dados.sugeridaPorIA ? 1 : 0, autor, agora(), agora());
  auditar(autor, status === "sugerida" ? "sugerir_tarefa" : "criar_tarefa", atrib === "pessoa" ? campos.alvo : null, "tarefa", novo, campos);
  if (status === "ativa") gerarOcorrencias();
  return novo;
}

export function mudarStatusTarefa(id, status, autor) {
  if (!["ativa", "arquivada"].includes(status)) throw new ErroColab("Status inválido.");
  db.prepare("UPDATE colab_tarefas SET status = ?, atualizadoEm = ? WHERE id = ?").run(status, agora(), id);
  auditar(autor, status === "ativa" ? "ativar_tarefa" : "arquivar_tarefa", null, "tarefa", id);
  if (status === "ativa") gerarOcorrencias();
}

export const listarTarefas = () => db.prepare("SELECT * FROM colab_tarefas WHERE status != 'arquivada' ORDER BY status DESC, criadoEm DESC").all();

const funcaoIgual = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Cria as ocorrências do dia (e da semana) de cada tarefa ativa. Idempotente
// pela chave: tarefa + pessoa (ou * para fila compartilhada) + data.
export function gerarOcorrencias(hoje = hojeBR()) {
  const tarefas = db.prepare("SELECT * FROM colab_tarefas WHERE status = 'ativa'").all();
  const colabs = ativos();
  const ins = db.prepare(`INSERT OR IGNORE INTO colab_ocorrencias (id, tarefaId, colaboradorId, chave, dataRef, prazoEm, status, criadoEm)
                          VALUES (?, ?, ?, ?, ?, ?, 'aberta', ?)`);
  db.transaction(() => {
    for (const t of tarefas) {
      const criada = dataBR(t.criadoEm);
      const datas = t.recorrencia === "unica" ? [criada]
        : t.recorrencia === "semanal" ? [segundaDaSemana(hoje)]
          : [somarDias(hoje, -1), hoje].filter((d) => d >= criada);
      for (const ref of datas) {
        const prazo = t.recorrencia === "unica" ? fimDoDiaTs(t.prazoData)
          : t.recorrencia === "semanal" ? fimDoDiaTs(somarDias(ref, 6)) : fimDoDiaTs(ref);
        if (t.atribuicao === "pessoa") {
          const c = colabs.find((x) => x.id === t.alvo);
          if (!c) continue;
          if (t.recorrencia === "diaria") {
            const r = regraDe(c, ref);
            if (!r.diasPrevistos.includes(new Date(`${ref}T12:00:00Z`).getUTCDay())) continue;
          }
          if (ref < c.dataInicio && t.recorrencia !== "unica") continue;
          ins.run(uid(), t.id, c.id, `${t.id}:${c.id}:${ref}`, ref, prazo, agora());
        } else {
          ins.run(uid(), t.id, null, `${t.id}:*:${ref}`, ref, prazo, agora());
        }
      }
    }
    db.prepare("UPDATE colab_ocorrencias SET status = 'expirada' WHERE status = 'aberta' AND prazoEm < ?").run(agora());
  })();
}

function linhaOcorrencia(o) {
  return { ...o, prova: json(o.prova), checagens: json(o.checagens) };
}

// Tarefas que o colaborador vê: as dele e as da fila (função ou todos) que
// ninguém pegou ainda.
export function ocorrenciasDoColaborador(colab, { desde } = {}) {
  gerarOcorrencias();
  const limite = desde || somarDias(hojeBR(), -45);
  const rows = db.prepare(`SELECT o.*, t.titulo, t.descricao, t.tipoProva, t.aprovacao, t.atribuicao, t.alvo, t.recorrencia, t.valorCents AS valorTarefa, t.contaMeta
    FROM colab_ocorrencias o JOIN colab_tarefas t ON t.id = o.tarefaId
    WHERE o.dataRef >= ? AND (o.colaboradorId = ? OR (o.colaboradorId IS NULL AND o.status = 'aberta' AND t.status = 'ativa'))
    ORDER BY o.prazoEm ASC`).all(limite, colab.id);
  return rows.filter((o) => o.colaboradorId === colab.id || o.atribuicao === "todos" || (o.atribuicao === "funcao" && funcaoIgual(o.alvo, colab.funcao)))
    .map(linhaOcorrencia);
}

export function pegarOcorrencia(colab, id) {
  const o = db.prepare("SELECT o.*, t.atribuicao, t.alvo FROM colab_ocorrencias o JOIN colab_tarefas t ON t.id = o.tarefaId WHERE o.id = ?").get(id);
  if (!o) throw new ErroColab("Tarefa não encontrada.", 404);
  if (o.atribuicao === "funcao" && !funcaoIgual(o.alvo, colab.funcao)) throw new ErroColab("Esta tarefa é de outra função.", 403);
  if (o.colaboradorId === colab.id) return;
  const r = db.prepare("UPDATE colab_ocorrencias SET colaboradorId = ?, reservadaEm = ? WHERE id = ? AND colaboradorId IS NULL AND status = 'aberta'").run(colab.id, agora(), id);
  if (!r.changes) throw new ErroColab("Outra pessoa já pegou esta tarefa.", 409);
}

// Bloqueia endereços internos (metadados da AWS, rede privada) para a
// checagem de link não virar porta de entrada para a rede do servidor.
function ipPrivado(ip) {
  if (isIP(ip) === 6) return /^(::1|fc|fd|fe80|::ffff:(127|10|192\.168|169\.254))/i.test(ip) || ip === "::";
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
async function linkAcessivel(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  try {
    const ends = await lookup(u.hostname, { all: true });
    if (!ends.length || ends.some((e) => ipPrivado(e.address))) return false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let r = await fetch(u, { method: "HEAD", redirect: "manual", signal: ctrl.signal }).catch(() => null);
    if (!r || r.status === 405 || r.status === 403) r = await fetch(u, { method: "GET", redirect: "manual", signal: ctrl.signal }).catch(() => null);
    clearTimeout(t);
    return !!r && r.status < 400;
  } catch { return false; }
}

const normalizarTexto = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export async function enviarProva(colab, ocorrenciaId, { link, texto, arquivo }) {
  const o = db.prepare("SELECT o.*, t.titulo, t.descricao, t.tipoProva, t.aprovacao, t.valorCents AS valorTarefa FROM colab_ocorrencias o JOIN colab_tarefas t ON t.id = o.tarefaId WHERE o.id = ?").get(ocorrenciaId);
  if (!o || o.colaboradorId !== colab.id) throw new ErroColab("Tarefa não encontrada.", 404);
  if (!["aberta", "recusada"].includes(o.status)) throw new ErroColab("Esta tarefa não aceita envio agora.");
  if (o.prazoEm < agora()) throw new ErroColab("O prazo desta tarefa terminou.");

  const prova = { tipo: o.tipoProva, texto: String(texto || "").trim().slice(0, 5000) };
  let hash = null;
  let camposOk = true;
  if (o.tipoProva === "link") {
    prova.link = String(link || "").trim();
    camposOk = /^https?:\/\/\S+$/i.test(prova.link);
    if (camposOk) { const u = new URL(prova.link); u.hash = ""; hash = sha256(`link:${u.toString().replace(/\/$/, "")}`); }
  } else if (o.tipoProva === "arquivo") {
    if (!arquivo?.base64 || !TIPOS_ARQUIVO[arquivo.mimetype]) camposOk = false;
    else {
      const buf = Buffer.from(String(arquivo.base64).replace(/^data:[^,]+,/, ""), "base64");
      if (!buf.length) camposOk = false;
      else if (buf.length > MAX_ARQUIVO) throw new ErroColab("Arquivo maior que 8 MB.");
      else {
        hash = sha256(buf);
        const chave = `colaboradores/${colab.id}/${o.id}-${hash.slice(0, 12)}.${TIPOS_ARQUIVO[arquivo.mimetype]}`;
        await salvar(chave, Readable.from(buf), { contentType: arquivo.mimetype, maxBytes: MAX_ARQUIVO });
        prova.arquivo = { chave, nome: String(arquivo.nome || "arquivo").slice(0, 120), mimetype: arquivo.mimetype, tamanho: buf.length };
      }
    }
  } else {
    camposOk = prova.texto.length >= 3;
    if (camposOk) hash = sha256(`texto:${normalizarTexto(prova.texto)}`);
  }
  if (!camposOk) throw new ErroColab(o.tipoProva === "link" ? "Informe um link válido (começando com http)." : o.tipoProva === "arquivo" ? "Anexe um PDF ou imagem (PNG, JPG ou WEBP)." : "Descreva o que foi feito.");

  const linkOk = o.tipoProva === "link" ? await linkAcessivel(prova.link) : null;
  const repetida = hash ? db.prepare("SELECT id FROM colab_ocorrencias WHERE provaHash = ? AND id != ? LIMIT 1").get(hash, o.id) : null;
  const checagens = { camposObrigatorios: true, linkAcessivel: linkOk, repetida: !!repetida };
  const agoraTs = agora();
  const fora = foraDaJornada(agoraTs, regraDe(colab, dataBR(agoraTs)), feriadosSet([new Date().getUTCFullYear()])) ? 1 : 0;
  const auto = o.aprovacao === "automatica" && linkOk !== false && !repetida;

  db.prepare(`UPDATE colab_ocorrencias SET status = ?, prova = ?, provaHash = ?, repetida = ?, checagens = ?, enviadoEm = ?, foraJornada = ?,
              autoAprovada = ?, conferidaAdmin = 0, motivo = '', revisadoPor = ?, revisadoEm = ?, observacaoIA = '' WHERE id = ?`)
    .run(auto ? "aprovada" : "enviada", JSON.stringify(prova), hash, repetida ? 1 : 0, JSON.stringify(checagens), agoraTs, fora,
      auto ? 1 : 0, auto ? "sistema" : null, auto ? agoraTs : null, o.id);
  if (auto) lancarTarefa(colab, o.id, "sistema");
  if (repetida) registrarAviso({ colab, destino: "admin", tipo: "prova_repetida", titulo: `Prova repetida — ${colab.nome}`,
    texto: `A prova de "${o.titulo}" é igual a uma já usada em outra tarefa.`, chave: `repetida:${o.id}:${hash}`, dados: { ocorrenciaId: o.id, igualA: repetida.id } });
  auditar(colab.userId, "enviar_prova", colab.id, "ocorrencia", o.id, { checagens, autoAprovada: auto });
  // A IA lê depois da resposta, sem atrasar o envio. Só deixa observação.
  observarProva(o.id).catch(() => {});
  return linhaOcorrencia(db.prepare("SELECT * FROM colab_ocorrencias WHERE id = ?").get(o.id));
}

export async function arquivoDaProva(ocorrenciaId) {
  const o = db.prepare("SELECT prova, colaboradorId FROM colab_ocorrencias WHERE id = ?").get(ocorrenciaId);
  const a = json(o?.prova).arquivo;
  if (!a?.chave) return null;
  return { buffer: await lerBuffer(a.chave, MAX_ARQUIVO), mimetype: a.mimetype, nome: a.nome, colaboradorId: o.colaboradorId };
}

function lancarTarefa(colab, ocorrenciaId, autor) {
  const o = db.prepare("SELECT o.*, t.titulo, t.valorCents AS valorTarefa FROM colab_ocorrencias o JOIN colab_tarefas t ON t.id = o.tarefaId WHERE o.id = ?").get(ocorrenciaId);
  const regra = regraDe(colab, o.dataRef);
  const valor = o.status === "aprovada" ? (o.valorTarefa ?? regra.variavel.tarefaCents ?? 0) : 0;
  reconciliar({ colab, origemTipo: "tarefa", origemId: o.id, devidoCents: valor, descricao: o.titulo, autor });
}

// Aprovar, recusar (sempre com motivo) ou reverter uma aprovação automática.
// Só o admin. Depois do fechamento do mês, não muda mais (seção 4.1).
export function revisarOcorrencia(id, acao, motivo, autor) {
  const o = db.prepare("SELECT * FROM colab_ocorrencias WHERE id = ?").get(id);
  if (!o || !o.colaboradorId) throw new ErroColab("Tarefa não encontrada.", 404);
  const colab = colaboradorPorId(o.colaboradorId);
  if (o.revisadoEm && mesFechado(mesBR(o.revisadoEm)) && o.status === "aprovada") throw new ErroColab("O mês desta aprovação já foi fechado. Use um ajuste no mês aberto.");
  if (acao === "aprovar") {
    if (!["enviada", "recusada", "aprovada"].includes(o.status)) throw new ErroColab("Não há prova para aprovar.");
    db.prepare("UPDATE colab_ocorrencias SET status = 'aprovada', motivo = '', revisadoPor = ?, revisadoEm = ?, conferidaAdmin = 1 WHERE id = ?").run(autor, agora(), id);
  } else if (acao === "recusar") {
    if (!motivo?.trim()) throw new ErroColab("Recusa precisa de motivo.");
    if (!["enviada", "aprovada"].includes(o.status)) throw new ErroColab("Não há prova para recusar.");
    db.prepare("UPDATE colab_ocorrencias SET status = 'recusada', motivo = ?, revisadoPor = ?, revisadoEm = ?, conferidaAdmin = 1 WHERE id = ?").run(motivo.trim(), autor, agora(), id);
    notificar(colab, "Uma prova foi recusada", `Motivo: ${motivo.trim()}. Você pode corrigir e reenviar até o prazo.`);
  } else if (acao === "conferida") {
    db.prepare("UPDATE colab_ocorrencias SET conferidaAdmin = 1 WHERE id = ?").run(id);
  } else throw new ErroColab("Ação inválida.");
  lancarTarefa(colab, id, autor);
  auditar(autor, `${acao}_prova`, colab.id, "ocorrencia", id, { motivo, statusAnterior: o.status });
}

// Fila do admin: provas aguardando, aprovadas sozinhas com observação da IA
// ou repetidas, ainda não conferidas.
export function filaRevisao() {
  return db.prepare(`SELECT o.*, t.titulo, t.tipoProva, t.aprovacao, c.nome AS colaboradorNome FROM colab_ocorrencias o
    JOIN colab_tarefas t ON t.id = o.tarefaId JOIN colaboradores c ON c.id = o.colaboradorId
    WHERE o.status = 'enviada' OR (o.status = 'aprovada' AND o.conferidaAdmin = 0 AND (o.observacaoIA != '' OR o.repetida = 1))
    ORDER BY o.enviadoEm ASC LIMIT 200`).all().map(linhaOcorrencia);
}

export function aprovadasAutomaticamente(desde) {
  return db.prepare(`SELECT o.*, t.titulo, t.tipoProva, c.nome AS colaboradorNome FROM colab_ocorrencias o
    JOIN colab_tarefas t ON t.id = o.tarefaId JOIN colaboradores c ON c.id = o.colaboradorId
    WHERE o.autoAprovada = 1 AND o.status = 'aprovada' AND o.revisadoEm >= ? ORDER BY o.revisadoEm DESC LIMIT 200`).all(desde).map(linhaOcorrencia);
}

// ───────────────────────────── Presença ─────────────────────────────

function atividades(colab, inicio, fim) {
  const a = {};
  const ini = inicioDoDiaTs(inicio), f = fimDoDiaTs(fim);
  for (const o of db.prepare("SELECT enviadoEm, status, revisadoEm FROM colab_ocorrencias WHERE colaboradorId = ? AND enviadoEm BETWEEN ? AND ?").all(colab.id, ini, f)) {
    const d = dataBR(o.enviadoEm);
    a[d] = a[d] || { envios: 0, aprovadas: 0, registros: 0 };
    a[d].envios++;
    if (o.status === "aprovada") a[d].aprovadas++;
  }
  for (const r of db.prepare("SELECT data FROM colab_registros WHERE colaboradorId = ? AND data BETWEEN ? AND ? AND tipo = 'inicio'").all(colab.id, inicio, fim)) {
    a[r.data] = a[r.data] || { envios: 0, aprovadas: 0, registros: 0 };
    a[r.data].registros++;
  }
  return a;
}

export const ausenciasDe = (colab) => db.prepare("SELECT * FROM colab_ausencias WHERE colaboradorId = ? ORDER BY dataInicio DESC").all(colab.id);

// A medição começa no aceite do termo, não na data de início do contrato:
// o painel começa do zero, sem inventar histórico anterior (seção 13.4).
export function inicioMedicao(colab) {
  const r = db.prepare("SELECT MIN(criadoEm) AS em FROM colab_termo_aceites WHERE colaboradorId = ?").get(colab.id);
  return r?.em ? dataBR(r.em) : null;
}

export function diasDe(colab, inicio, fim, hoje = hojeBR()) {
  const med = inicioMedicao(colab);
  if (!med) return [];
  const ini = [inicio, colab.dataInicio, med].sort().pop();
  const fimEf = colab.dataSaida && colab.dataSaida < fim ? colab.dataSaida : fim;
  if (ini > fimEf) return [];
  const regra = regraDe(colab, fimEf);
  return calcularDias({
    inicio: ini, fim: fimEf, regra, hoje,
    atividades: atividades(colab, ini, fimEf),
    ausencias: ausenciasDe(colab),
    feriados: feriadosSet(anosEntre(ini, fimEf)),
  });
}

function ocorrenciasPeriodo(colab, inicio, fim) {
  return db.prepare(`SELECT o.status, o.dataRef, o.foraJornada, o.enviadoEm, o.repetida, t.contaMeta FROM colab_ocorrencias o JOIN colab_tarefas t ON t.id = o.tarefaId
    WHERE o.colaboradorId = ? AND o.dataRef BETWEEN ? AND ?`).all(colab.id, inicio, fim);
}

export function painelDe(colab, inicio, fim, hoje = hojeBR()) {
  const regra = regraDe(colab, fim);
  const dias = diasDe(colab, inicio, fim, hoje);
  const ocs = ocorrenciasPeriodo(colab, inicio, fim);
  const p = calcularPainel({ dias, ocorrencias: ocs, regra });
  // Tendência: últimos 14 dias contra os 14 anteriores.
  const ate = fim < hoje ? fim : somarDias(hoje, -1);
  const n1 = calcularPainel({ dias: diasDe(colab, somarDias(ate, -13), ate, hoje), ocorrencias: ocorrenciasPeriodo(colab, somarDias(ate, -13), ate), regra }).nota;
  const n0 = calcularPainel({ dias: diasDe(colab, somarDias(ate, -27), somarDias(ate, -14), hoje), ocorrencias: ocorrenciasPeriodo(colab, somarDias(ate, -27), somarDias(ate, -14)), regra }).nota;
  const seq = ausenciasSeguidas(dias);
  const alertas = [];
  if (regra.medirPresenca && seq.dias >= regra.alertaDiasSemAtividade) alertas.push({ tipo: "sem_atividade", texto: `${seq.dias} dias previstos seguidos sem atividade (desde ${dataBRFormatada(seq.desde)}).` });
  if (tendencia(n1, n0) === "caindo") alertas.push({ tipo: "queda", texto: `Produtividade caiu: ${n0} → ${n1} nas últimas duas semanas.` });
  const repetidas = ocs.filter((o) => o.repetida).length;
  if (repetidas) alertas.push({ tipo: "repetida", texto: `${repetidas} prova(s) repetida(s) no período.` });
  const fora = ocs.filter((o) => o.foraJornada && o.enviadoEm >= inicioDoDiaTs(somarDias(hoje, -7))).length;
  if (fora >= 3) alertas.push({ tipo: "fora_jornada", texto: `${fora} envios fora da jornada nos últimos 7 dias. Pode ser hora extra: informe o contador.` });
  return {
    ...p, inicio, fim, tendencia: tendencia(n1, n0), notaRecente: n1, notaAnterior: n0, alertas, dias,
    medirPresenca: regra.medirPresenca, metaInfo: { ...regra.meta },
  };
}

// ───────────────────────────── Ausências, registros, contestação ─────────────────────────────

export function pedirAusencia(colab, { dataInicio, dataFim, tipo, observacao }, autor, aprovadaPeloAdmin = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio || "") || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim || "") || dataFim < dataInicio) throw new ErroColab("Informe as datas da ausência.");
  const tipos = ["ferias", "folga", "atestado", "licenca", "outro"];
  if (!tipos.includes(tipo)) throw new ErroColab("Escolha o tipo da ausência.");
  const id = uid();
  // O atestado em si não sobe para a plataforma (dado de saúde, seção 13.2).
  db.prepare(`INSERT INTO colab_ausencias (id, colaboradorId, dataInicio, dataFim, tipo, status, observacao, pedidoPor, decididoPor, decididoEm, criadoEm)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, colab.id, dataInicio, dataFim, tipo, aprovadaPeloAdmin ? "aprovada" : "pedida", String(observacao || "").slice(0, 500), autor,
      aprovadaPeloAdmin ? autor : null, aprovadaPeloAdmin ? agora() : null, agora());
  auditar(autor, aprovadaPeloAdmin ? "registrar_ausencia" : "pedir_ausencia", colab.id, "ausencia", id, { dataInicio, dataFim, tipo });
  if (!aprovadaPeloAdmin) registrarAviso({ colab, destino: "admin", tipo: "ausencia_pedida", titulo: `Pedido de ausência — ${colab.nome}`,
    texto: `${dataBRFormatada(dataInicio)} a ${dataBRFormatada(dataFim)} (${tipo}).`, chave: `ausencia_pedida:${id}`, dados: { ausenciaId: id } });
  return id;
}

export function decidirAusencia(id, aprovar, autor) {
  const a = db.prepare("SELECT * FROM colab_ausencias WHERE id = ?").get(id);
  if (!a) throw new ErroColab("Ausência não encontrada.", 404);
  db.prepare("UPDATE colab_ausencias SET status = ?, decididoPor = ?, decididoEm = ? WHERE id = ?").run(aprovar ? "aprovada" : "recusada", autor, agora(), id);
  db.prepare("UPDATE colab_avisos SET resolvidoEm = ? WHERE chave = ?").run(agora(), `ausencia_pedida:${id}`);
  const colab = colaboradorPorId(a.colaboradorId);
  notificar(colab, aprovar ? "Ausência aprovada" : "Ausência não aprovada", `${dataBRFormatada(a.dataInicio)} a ${dataBRFormatada(a.dataFim)}.`);
  auditar(autor, aprovar ? "aprovar_ausencia" : "recusar_ausencia", a.colaboradorId, "ausencia", id);
}

export function registrarAtividade(colab, tipo) {
  if (!regraDe(colab).registroAtividade) throw new ErroColab("O registro de atividade não está ligado para você.");
  if (!["inicio", "fim"].includes(tipo)) throw new ErroColab("Tipo inválido.");
  const data = hojeBR();
  const ja = db.prepare("SELECT 1 FROM colab_registros WHERE colaboradorId = ? AND data = ? AND tipo = ?").get(colab.id, data, tipo);
  if (ja) throw new ErroColab(tipo === "inicio" ? "O início de hoje já foi registrado." : "O encerramento de hoje já foi registrado.");
  db.prepare("INSERT INTO colab_registros (id, colaboradorId, tipo, data, em) VALUES (?, ?, ?, ?, ?)").run(uid(), colab.id, tipo, data, agora());
}
export const registrosDe = (colab, desde) => db.prepare("SELECT tipo, data, em FROM colab_registros WHERE colaboradorId = ? AND data >= ? ORDER BY em DESC").all(colab.id, desde);

export function contestar(colab, { alvoTipo, alvoId, texto }) {
  if (!["dia", "ocorrencia"].includes(alvoTipo) || !alvoId) throw new ErroColab("Escolha o que contestar.");
  if (!texto?.trim()) throw new ErroColab("Explique o que aconteceu.");
  const id = uid();
  db.prepare("INSERT INTO colab_contestacoes (id, colaboradorId, alvoTipo, alvoId, texto, status, criadoEm) VALUES (?, ?, ?, ?, ?, 'aberta', ?)")
    .run(id, colab.id, alvoTipo, String(alvoId), texto.trim().slice(0, 1000), agora());
  registrarAviso({ colab, destino: "admin", tipo: "contestacao", titulo: `Contestação — ${colab.nome}`, texto: texto.trim().slice(0, 200), chave: `contestacao:${id}`, dados: { contestacaoId: id, alvoTipo, alvoId } });
  auditar(colab.userId, "contestar", colab.id, alvoTipo, alvoId, { texto });
  return id;
}
export function responderContestacao(id, resposta, autor) {
  const c = db.prepare("SELECT * FROM colab_contestacoes WHERE id = ?").get(id);
  if (!c) throw new ErroColab("Contestação não encontrada.", 404);
  if (!resposta?.trim()) throw new ErroColab("Escreva a resposta.");
  db.prepare("UPDATE colab_contestacoes SET status = 'resolvida', resposta = ?, decididoPor = ?, decididoEm = ? WHERE id = ?").run(resposta.trim(), autor, agora(), id);
  db.prepare("UPDATE colab_avisos SET resolvidoEm = ? WHERE chave = ?").run(agora(), `contestacao:${id}`);
  notificar(colaboradorPorId(c.colaboradorId), "Sua contestação foi respondida", resposta.trim().slice(0, 200));
  auditar(autor, "responder_contestacao", c.colaboradorId, "contestacao", id, { resposta });
}
export const contestacoesDe = (colab) => db.prepare("SELECT * FROM colab_contestacoes WHERE colaboradorId = ? ORDER BY criadoEm DESC").all(colab.id);

// ───────────────────────────── Variável automático ─────────────────────────────

function sincronizarCadastros(colab) {
  const r0 = regraDe(colab);
  const tsInicio = inicioDoDiaTs(colab.dataInicio);
  const cpf = String(colab.cpf || "");
  const fone = telefoneDe(colab);
  const rows = db.prepare(`SELECT r.id, r.status, r.qualificadoEm, r.criadoEm, s.documento, s.whats FROM referrals r
    LEFT JOIN users u ON u.id = r.indicadoUserId LEFT JOIN sellers s ON s.id = u.entityId AND u.role = 'vendedor'
    WHERE r.indicadorUserId = ? AND r.criadoEm >= ?`).all(colab.userId, tsInicio);
  for (const r of rows) {
    const regra = regraDe(colab, dataBR(r.criadoEm));
    const valido = regra.variavel.cadastroCriterio === "cadastro" ? true : !!r.qualificadoEm;
    // Não conta cadastro com o CPF ou o telefone do próprio colaborador (4.2).
    const proprio = (cpf && String(r.documento || "").replace(/\D/g, "") === cpf) || (fone && ultimos(r.whats) === fone);
    const cancelado = ["cancelado", "estornado", "fraude"].includes(r.status);
    if (cancelado && foraDaGarantia(colab, regra, r.qualificadoEm || r.criadoEm, "cadastro", r.id)) continue;
    const devido = valido && !proprio && !cancelado ? regra.variavel.cadastroCents : 0;
    if (devido || r0.variavel.cadastroCents || jaLancado(colab, "cadastro", r.id))
      reconciliar({ colab, origemTipo: "cadastro", origemId: r.id, devidoCents: devido, descricao: "Cadastro trazido por indicação" });
  }
}

const ultimos = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
function telefoneDe(colab) {
  const u = db.prepare("SELECT s.whats FROM users u LEFT JOIN sellers s ON s.id = u.entityId AND u.role = 'vendedor' WHERE u.id = ?").get(colab.userId);
  return ultimos(u?.whats);
}
// Passado o prazo de garantia, um cancelamento não estorna o que já foi lançado.
function foraDaGarantia(colab, regra, desdeTs, tipo, id) {
  const dias = Number(regra.variavel.garantiaDias);
  return jaLancado(colab, tipo, id) && dias >= 0 && agora() > Number(desdeTs) + dias * 86400000;
}

const jaLancado = (colab, tipo, id) => !!db.prepare("SELECT 1 FROM colab_lancamentos WHERE colaboradorId = ? AND origemTipo = ? AND origemId = ?").get(colab.id, tipo, String(id));

function sincronizarEmpresas(colab) {
  const tsInicio = inicioDoDiaTs(colab.dataInicio);
  const rows = db.prepare(`SELECT c.id, c.companyId, c.status, c.baseCents, c.moeda, c.criadoEm, a.criadoEm AS atribuidaEm, co.nome AS empresa
    FROM affiliate_commissions c LEFT JOIN affiliate_attributions a ON a.companyId = c.companyId LEFT JOIN companies co ON co.id = c.companyId
    WHERE c.affiliateUserId = ? AND c.criadoEm >= ? ORDER BY c.criadoEm ASC`).all(colab.userId, tsInicio);
  const primeiraPorEmpresa = {};
  for (const r of rows) if (!primeiraPorEmpresa[r.companyId]) primeiraPorEmpresa[r.companyId] = r.id;
  for (const r of rows) {
    const regra = regraDe(colab, dataBR(r.criadoEm));
    const e = regra.variavel.empresaPagante;
    const meses = Math.max(1, Number(e.meses) || 1);
    const dentro = meses === 1 ? primeiraPorEmpresa[r.companyId] === r.id : r.criadoEm < (r.atribuidaEm || r.criadoEm) + meses * 30 * 86400000;
    // Só BRL: valor em outra moeda não se soma ao extrato em reais.
    const cancelada = ["cancelada", "estornada"].includes(r.status);
    if (cancelada && foraDaGarantia(colab, regra, r.criadoEm, "empresa_pagante", r.id)) continue;
    const valido = dentro && r.moeda === "BRL" && !cancelada;
    const devido = !valido ? 0 : e.modo === "percentual" ? Math.round((Number(r.baseCents) || 0) * (Number(e.percentual) || 0) / 100) : Number(e.valorCents) || 0;
    if (devido || jaLancado(colab, "empresa_pagante", r.id))
      reconciliar({ colab, origemTipo: "empresa_pagante", origemId: r.id, devidoCents: devido, descricao: `Empresa pagante: ${r.empresa || "empresa"}` });
  }
}

function sincronizarDiarias(colab, hoje) {
  const ini = somarDias(hoje, -40);
  const dias = diasDe(colab, ini, somarDias(hoje, -1), hoje);
  for (const d of dias) {
    if (mesFechado(d.data.slice(0, 7))) continue;
    const regra = regraDe(colab, d.data);
    const crit = regra.diaTrabalhado.criterio;
    const valor = crit === "aprovada" ? d.aprovadas : crit === "registro" ? d.registros : d.envios;
    const trabalhou = d.situacao === "presente" || (d.situacao === "extra" && valor >= Math.max(1, regra.diaTrabalhado.minimo));
    const devido = trabalhou ? regra.variavel.diariaCents : 0;
    if (devido || jaLancado(colab, "diaria", d.data))
      reconciliar({ colab, origemTipo: "diaria", origemId: d.data, devidoCents: devido, descricao: `Diária de ${dataBRFormatada(d.data)}` });
  }
}

// ───────────────────────────── Extrato ─────────────────────────────

export function extrato(colab, mes) {
  const regra = regraDe(colab, ultimoDiaDoMes(mes));
  const lancamentos = db.prepare("SELECT * FROM colab_lancamentos WHERE colaboradorId = ? AND mes = ? ORDER BY criadoEm ASC").all(colab.id, mes);
  const variavel = lancamentos.reduce((s, l) => s + l.valorCents, 0);
  const teto = regra.tetoMensalCents > 0 ? regra.tetoMensalCents : null;
  // Previsto: provas enviadas ainda sem decisão, pelo valor que teriam.
  const previstas = db.prepare(`SELECT o.id, o.dataRef, t.titulo, t.valorCents FROM colab_ocorrencias o JOIN colab_tarefas t ON t.id = o.tarefaId
    WHERE o.colaboradorId = ? AND o.status = 'enviada'`).all(colab.id)
    .map((o) => ({ id: o.id, titulo: o.titulo, valorCents: o.valorCents ?? regraDe(colab, o.dataRef).variavel.tarefaCents ?? 0 }))
    .filter((o) => o.valorCents > 0);
  return {
    mes, fechado: mesFechado(mes), vinculo: colab.vinculo,
    fixoCents: regra.fixoCents, lancamentos, variavelCents: variavel,
    tetoCents: teto, variavelDevidoCents: teto ? Math.min(variavel, teto) : variavel,
    excedenteCents: teto && variavel > teto ? variavel - teto : 0,
    previstas, previstoCents: previstas.reduce((s, p) => s + p.valorCents, 0),
    pagamento: colab.vinculo === "clt" ? "folha" : regra.permiteSaque ? "saque" : "fechamento",
  };
}

// ───────────────────────────── Fechamento (seções 5 e 13.5) ─────────────────────────────

// Fixo que valeu em cada trecho do mês (mudança no meio do mês aparece
// separada, para o contador calcular a proporção).
function vigenciasDoFixo(colab, mes) {
  const ini = `${mes}-01`, fim = ultimoDiaDoMes(mes);
  const linhas = db.prepare("SELECT versao, regra, vigenciaInicio FROM colab_regras WHERE colaboradorId = ? ORDER BY vigenciaInicio ASC, versao ASC").all(colab.id);
  const porData = new Map();
  for (const l of linhas) porData.set(l.vigenciaInicio < ini ? ini : l.vigenciaInicio, normalizarRegra(json(l.regra)).fixoCents);
  const out = [];
  for (const [desde, fixoCents] of [...porData.entries()].sort()) {
    if (desde > fim) continue;
    if (out.length && out[out.length - 1].fixoCents === fixoCents) continue;
    out.push({ desde, fixoCents });
  }
  return out;
}

export function previaFechamento(mes) {
  const nat = naturezas();
  const fim = ultimoDiaDoMes(mes);
  const colabs = db.prepare("SELECT * FROM colaboradores WHERE dataInicio <= ? AND (dataSaida IS NULL OR dataSaida >= ?) ORDER BY nome").all(fim, `${mes}-01`);
  const registro = db.prepare("SELECT * FROM colab_fechamentos WHERE mes = ?").get(mes);
  const pessoas = colabs.map((c) => {
    const ex = extrato(c, mes);
    const p = painelDe(c, `${mes}-01`, fim, hojeBR());
    return {
      colaboradorId: c.id, nome: c.nome, cpf: formatarCpf(c.cpf), funcao: c.funcao, vinculo: c.vinculo, regime: c.regime,
      fixoCents: ex.fixoCents, fixoVigencias: vigenciasDoFixo(c, mes), naturezaFixo: nat.fixo,
      linhas: ex.lancamentos.map((l) => ({ data: dataBR(l.criadoEm), tipo: l.tipo, natureza: nat[l.tipo === "estorno" ? l.origemTipo : l.tipo] || "a_classificar", descricao: l.descricao, motivo: l.motivo, valorCents: l.valorCents })),
      variavelCents: ex.variavelCents, tetoCents: ex.tetoCents, excedenteCents: ex.excedenteCents, variavelDevidoCents: ex.variavelDevidoCents,
      pagamento: ex.pagamento,
      dias: { previstos: p.previstos, presentes: p.presentes, parciais: p.parciais, ausentes: p.ausentes, justificadas: p.justificadas, extras: p.extras },
      nota: p.nota,
    };
  });
  return { mes, fechado: !!registro, fechadoEm: registro?.fechadoEm || null, pessoas, naturezas: nat };
}

export function fecharMes(mes, autor) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErroColab("Mês inválido.");
  if (mes >= mesBR(agora())) throw new ErroColab("Só dá para fechar um mês que já terminou.");
  if (mesFechado(mes)) throw new ErroColab("Este mês já está fechado.");
  if (mesAnterior(mes) >= "2026-01" && !mesFechado(mesAnterior(mes)) && db.prepare("SELECT 1 FROM colab_lancamentos WHERE mes = ?").get(mesAnterior(mes)))
    throw new ErroColab(`Feche antes o mês ${mesAnterior(mes)}.`);
  for (const c of ativos()) { try { sincronizarTudo(c, hojeBR()); } catch (e) { console.error("[colab] sync no fechamento:", e.message); } }
  const previa = previaFechamento(mes);
  const creditos = [];
  db.transaction(() => {
    db.prepare("INSERT INTO colab_fechamentos (id, mes, fechadoPor, fechadoEm, resumo) VALUES (?, ?, ?, ?, ?)").run(uid(), mes, autor, agora(), JSON.stringify(previa));
    // Sem vínculo e com saque previsto: o variável vai para o saldo (seção 2.4).
    for (const p of previa.pessoas) {
      if (p.pagamento !== "saque" || p.variavelDevidoCents <= 0) continue;
      const c = colaboradorPorId(p.colaboradorId);
      const u = db.prepare("SELECT role, entityId FROM users WHERE id = ?").get(c.userId);
      if (u?.role !== "vendedor" || !u.entityId) { creditos.push({ nome: p.nome, ok: false, motivo: "sem carteira de profissional" }); continue; }
      const chave = `colab-fechamento:${mes}:${c.id}`;
      if (db.prepare("SELECT 1 FROM financial_ledger WHERE idempotencyKey = ?").get(chave)) continue;
      const valor = p.variavelDevidoCents / 100;
      db.prepare("UPDATE sellers SET disponivel = disponivel + ? WHERE id = ?").run(valor, u.entityId);
      const s = db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(u.entityId);
      db.prepare(`INSERT INTO financial_ledger (id, companyId, sellerId, submissionId, tipo, valor, saldoEmpresa, reservadoEmpresa, saldoProfissional, idempotencyKey, dados, criadoEm)
                  VALUES (?, NULL, ?, NULL, 'colaborador_variavel', ?, NULL, NULL, ?, ?, ?, ?)`)
        .run(uid(), u.entityId, valor, s?.disponivel ?? null, chave, JSON.stringify({ mes, colaboradorId: c.id }), agora());
      creditos.push({ nome: p.nome, ok: true, valorCents: p.variavelDevidoCents });
    }
  })();
  auditar(autor, "fechar_mes", null, "mes", mes, { pessoas: previa.pessoas.length, creditos });
  return { ...previaFechamento(mes), creditos };
}

const centsBR = (c) => (Number(c || 0) / 100).toFixed(2).replace(".", ",");
export function fechamentoCsv(mes, colaboradorId = null) {
  const f = previaFechamento(mes);
  if (colaboradorId) f.pessoas = f.pessoas.filter((p) => p.colaboradorId === colaboradorId);
  const linhas = [["mes", "colaborador", "cpf", "funcao", "vinculo", "regime", "data", "tipo", "natureza", "descricao", "valor_reais"].join(";")];
  const cel = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  for (const p of f.pessoas) {
    const base = [mes, p.nome, p.cpf, p.funcao, VINCULOS[p.vinculo] || p.vinculo, REGIMES[p.regime] || p.regime];
    for (const v of p.fixoVigencias) if (v.fixoCents || p.fixoVigencias.length > 1)
      linhas.push([...base, v.desde, "fixo", NATUREZAS[p.naturezaFixo], `Fixo mensal vigente a partir de ${dataBRFormatada(v.desde)} (pago pela folha)`, centsBR(v.fixoCents)].map(cel).join(";"));
    for (const l of p.linhas) linhas.push([...base, l.data, TIPOS_LANCAMENTO[l.tipo] || l.tipo, NATUREZAS[l.natureza] || l.natureza, l.motivo ? `${l.descricao} — ${l.motivo}` : l.descricao, centsBR(l.valorCents)].map(cel).join(";"));
    if (p.excedenteCents) linhas.push([...base, ultimoDiaDoMes(mes), "teto", "", "Excedente acima do teto mensal (não devido)", centsBR(-p.excedenteCents)].map(cel).join(";"));
    linhas.push([...base, "", "dias", "", `Previstos ${p.dias.previstos} · trabalhados ${p.dias.presentes} · parciais ${p.dias.parciais} · ausentes ${p.dias.ausentes} · justificados ${p.dias.justificadas} · extras ${p.dias.extras}`, ""].map(cel).join(";"));
  }
  return "﻿" + linhas.join("\n");
}

export function fechamentoHtml(mes, colaboradorId) {
  const f = previaFechamento(mes);
  const pessoas = colaboradorId ? f.pessoas.filter((p) => p.colaboradorId === colaboradorId) : f.pessoas;
  const blocos = pessoas.map((p) => `
    <section><h2>${escapar(p.nome)}</h2><p>CPF ${escapar(p.cpf)} · ${escapar(p.funcao || "—")} · ${escapar(VINCULOS[p.vinculo] || p.vinculo)}${p.regime ? ` · ${escapar(REGIMES[p.regime] || p.regime)}` : ""}</p>
    <table><thead><tr><th>Data</th><th>Tipo</th><th>Natureza</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead><tbody>
    ${p.fixoVigencias.filter((v) => v.fixoCents || p.fixoVigencias.length > 1).map((v) => `<tr><td>${dataBRFormatada(v.desde)}</td><td>Fixo</td><td>${escapar(NATUREZAS[p.naturezaFixo])}</td><td>Fixo mensal vigente a partir desta data (pago pela folha)</td><td class="v">${formatarCents(v.fixoCents)}</td></tr>`).join("")}
    ${p.linhas.map((l) => `<tr><td>${dataBRFormatada(l.data)}</td><td>${escapar(TIPOS_LANCAMENTO[l.tipo] || l.tipo)}</td><td>${escapar(NATUREZAS[l.natureza] || l.natureza)}</td><td>${escapar(l.descricao)}${l.motivo ? ` — ${escapar(l.motivo)}` : ""}</td><td class="v">${formatarCents(l.valorCents)}</td></tr>`).join("")}
    </tbody></table>
    <p><b>Variável:</b> ${formatarCents(p.variavelCents)}${p.tetoCents ? ` · teto ${formatarCents(p.tetoCents)} · devido ${formatarCents(p.variavelDevidoCents)}` : ""} · <b>Pagamento:</b> ${p.pagamento === "folha" ? "pela folha (contador)" : p.pagamento === "saque" ? "saldo e saque na plataforma" : "no fechamento"}</p>
    <p><b>Dias:</b> previstos ${p.dias.previstos} · trabalhados ${p.dias.presentes} · parciais ${p.dias.parciais} · ausentes ${p.dias.ausentes} · justificados ${p.dias.justificadas} · fora dos dias previstos ${p.dias.extras}</p></section>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fechamento ${mes}</title>
<style>body{font:13px/1.5 system-ui,sans-serif;color:#111;background:#fff;max-width:960px;margin:24px auto;padding:0 16px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left}.v{text-align:right;white-space:nowrap}section{margin-bottom:28px;page-break-inside:avoid}@media print{button{display:none}}</style></head>
<body><button onclick="window.print()" style="min-height:44px;padding:8px 16px">Salvar em PDF ou imprimir</button>
<h1>Fechamento de ${mes} — colaboradores internos</h1><p>${f.fechado ? `Mês fechado em ${new Date(f.fechadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` : "Prévia: mês ainda aberto."} A classificação de cada valor é a definida pelo contador.</p>${blocos || "<p>Nenhum colaborador no período.</p>"}</body></html>`;
}

// ───────────────────────────── IA (só resume e observa) ─────────────────────────────

let clienteIA = null;
function ia() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!clienteIA) clienteIA = new Anthropic();
  return clienteIA;
}
async function perguntarIA(system, prompt, maxTokens = 600) {
  const c = ia();
  if (!c) return null;
  try {
    const r = await c.messages.create({ model: MODELO_IA, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] });
    return r.content?.map((b) => b.text || "").join("").trim() || null;
  } catch (e) {
    console.error("[colab] IA:", e.message);
    return null;
  }
}

async function observarProva(ocorrenciaId) {
  const o = db.prepare("SELECT o.*, t.titulo, t.descricao FROM colab_ocorrencias o JOIN colab_tarefas t ON t.id = o.tarefaId WHERE o.id = ?").get(ocorrenciaId);
  if (!o) return;
  const prova = json(o.prova);
  if (!prova.texto && !prova.link) return;
  const resp = await perguntarIA(
    "Você confere provas de tarefas internas de uma empresa. Não aprova nem recusa: só aponta, em uma frase curta em português, se algo parece estranho (prova sem relação com a tarefa, vazia de conteúdo, genérica demais). Responda APENAS em JSON: {\"estranho\": true|false, \"observacao\": \"...\"}.",
    `Tarefa: ${o.titulo}\nDescrição: ${o.descricao || "-"}\nProva (texto): ${prova.texto || "-"}\nProva (link): ${prova.link || "-"}`, 200);
  if (!resp) return;
  const m = /\{[\s\S]*\}/.exec(resp);
  const r = m ? json(m[0], null) : null;
  if (r?.estranho && r.observacao) db.prepare("UPDATE colab_ocorrencias SET observacaoIA = ? WHERE id = ?").run(String(r.observacao).slice(0, 400), o.id);
}

export async function sugerirTarefasIA({ funcao, contexto }, autor) {
  const resp = await perguntarIA(
    "Você sugere tarefas internas para uma equipe pequena de uma plataforma brasileira de vendas (RYCS). Tarefas concretas, verificáveis por prova (link, arquivo ou texto). Responda APENAS em JSON: [{\"titulo\": \"...\", \"descricao\": \"...\", \"tipoProva\": \"link|arquivo|texto\", \"recorrencia\": \"unica|diaria|semanal\"}], no máximo 5 itens, em português do Brasil.",
    `Função: ${funcao || "qualquer"}\nContexto dado pelo administrador: ${contexto || "-"}`, 900);
  if (!resp) throw new ErroColab("A IA não está disponível agora.", 503);
  const m = /\[[\s\S]*\]/.exec(resp);
  const lista = (m ? json(m[0], []) : []).slice(0, 5);
  const ids = [];
  for (const t of lista) {
    if (!t?.titulo) continue;
    const rec = ["unica", "diaria", "semanal"].includes(t.recorrencia) ? t.recorrencia : "semanal";
    ids.push(salvarTarefa({
      titulo: String(t.titulo).slice(0, 140), descricao: String(t.descricao || "").slice(0, 1000),
      atribuicao: funcao ? "funcao" : "todos", alvo: funcao || "", recorrencia: rec,
      prazoData: rec === "unica" ? somarDias(hojeBR(), 7) : null, tipoProva: t.tipoProva, status: "sugerida", sugeridaPorIA: true,
    }, autor));
  }
  return ids;
}

function resumoDeterministico(nome, p) {
  const partes = [];
  if (p.medirPresenca) partes.push(`${p.presentes} de ${p.previstos} dias previstos trabalhados${p.ausentes ? `, ${p.ausentes} sem atividade` : ""}${p.justificadas ? `, ${p.justificadas} justificados` : ""}`);
  partes.push(`${p.feitas} tarefa(s) feita(s)${p.meta ? ` para uma meta de ${p.meta}` : ""}`);
  if (p.taxaAprovacao != null) partes.push(`${p.taxaAprovacao}% de aprovação das provas`);
  if (p.nota != null) partes.push(`nota ${p.nota} (${p.faixa?.toLowerCase()})`);
  return `${nome}: ${partes.join("; ")}.`;
}

async function gerarRelatorio(colab, periodo, referencia, inicio, fim) {
  if (db.prepare("SELECT 1 FROM colab_relatorios WHERE colaboradorId = ? AND periodo = ? AND referencia = ?").get(colab.id, periodo, referencia)) return null;
  const p = painelDe(colab, inicio, fim, hojeBR());
  const { dias: _dias, ...dados } = p;
  const base = resumoDeterministico(colab.nome.split(" ")[0], p);
  const texto = await perguntarIA(
    "Você escreve o resumo de produtividade de um colaborador para o dono de uma empresa pequena. Português do Brasil, tom neutro e respeitoso, no máximo 3 frases. Só descreva os números e a tendência; não julgue a pessoa, não sugira punição, desconto ou demissão.",
    `Período: ${dataBRFormatada(inicio)} a ${dataBRFormatada(fim)}\nResumo numérico: ${base}\nTendência: ${p.tendencia}\nAlertas: ${p.alertas.map((a) => a.texto).join(" | ") || "nenhum"}`, 300);
  const resumo = texto || base;
  db.prepare("INSERT OR IGNORE INTO colab_relatorios (id, colaboradorId, periodo, referencia, inicio, fim, dados, resumo, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(uid(), colab.id, periodo, referencia, inicio, fim, JSON.stringify(dados), resumo, agora());
  return { colab, p, resumo };
}

export const relatoriosDe = (colab) => db.prepare("SELECT id, periodo, referencia, inicio, fim, resumo, dados, criadoEm FROM colab_relatorios WHERE colaboradorId = ? ORDER BY criadoEm DESC LIMIT 30").all(colab.id)
  .map((r) => ({ ...r, dados: json(r.dados) }));

async function enviarRelatorioAdmins(titulo, itens) {
  if (!itens.length || !configAvisos().relatorioEmail) return;
  const admins = emailsAdmins().map((email) => ({ email }));
  // Uma linha por pessoa no topo ("em dia" ou o que mudou), detalhe no painel (13.12).
  const linhas = itens.map(({ colab, p, resumo }) => `<li><b>${escapar(colab.nome)}</b> — ${p.alertas.length ? escapar(p.alertas.map((a) => a.texto).join(" ")) : "em dia"}<br><span style="color:#555">${escapar(resumo)}</span></li>`).join("");
  const html = `<p>${escapar(titulo)}</p><ul>${linhas}</ul><p>O detalhe de cada pessoa está no admin, em Colaboradores. A IA só resume: nenhuma decisão foi tomada sobre pagamento ou vínculo.</p>`;
  for (const a of admins) await sendEmail(a.email, titulo, html).catch(() => {});
}

// ───────────────────────────── Avisos automáticos (13.12) ─────────────────────────────

async function avisosDoColaborador(colab, hoje, agoraTs) {
  const regra = regraDe(colab, hoje);
  const fer = feriadosSet([Number(hoje.slice(0, 4))]);
  const ausenteHoje = ausenciasDe(colab).some((a) => a.status === "aprovada" && a.dataInicio <= hoje && a.dataFim >= hoje);
  const dias = diasDe(colab, somarDias(hoje, -14), somarDias(hoje, -1), hoje);

  // Calibração da meta terminou: sugere a meta ao admin (13.11). Conta a
  // partir do aceite do termo, quando a medição de fato começou.
  const desdeCal = [regra.meta.calibracaoDesde, inicioMedicao(colab)].filter(Boolean).sort().pop();
  if (desdeCal && calibracaoTerminou({ ...regra, meta: { ...regra.meta, calibracaoDesde: desdeCal } }, hoje)) {
    const desde = desdeCal;
    const dCal = diasDe(colab, desde, somarDias(hoje, -1), hoje);
    const sugerida = sugerirMeta({ dias: dCal, ocorrencias: ocorrenciasPeriodo(colab, desde, somarDias(hoje, -1)), regra });
    registrarAviso({ colab, destino: "admin", tipo: "meta_sugerida", titulo: `Meta sugerida — ${colab.nome}`,
      texto: sugerida ? `Com base nas ${4} semanas medidas, a média foi de ${sugerida} por ${regra.meta.periodo === "semana" ? "semana" : "dia"}. Aprove, mude ou recuse.` : "A calibração terminou sem envios suficientes para sugerir uma meta.",
      chave: `meta:${colab.id}:${desde}`, dados: { sugerida, periodo: regra.meta.periodo } });
  }

  if (!regra.medirPresenca) return;

  // Lembrete ao próprio colaborador, só em dia previsto e dentro do horário.
  if (!ausenteHoje && !foraDaJornada(agoraTs, regra, fer)) {
    const pendentes = dias.filter((d) => d.situacao === "ausente" && !db.prepare("SELECT 1 FROM colab_avisos WHERE chave = ?").get(`lembrete:${colab.id}:${d.data}`));
    if (pendentes.length) {
      for (const d of pendentes) registrarAviso({ colab, destino: "colaborador", tipo: "lembrete", titulo: "Dia sem envio",
        texto: `Em ${dataBRFormatada(d.data)} não houve envio. Se foi folga ou atestado, registre a ausência na sua área.`, chave: `lembrete:${colab.id}:${d.data}`, dados: { data: d.data } });
      const datas = pendentes.map((d) => dataBRFormatada(d.data)).join(", ");
      notificar(colab, "Dia sem envio", `Não houve envio em ${datas}. Se foi folga ou atestado, registre a ausência.`);
      const u = db.prepare("SELECT email FROM users WHERE id = ?").get(colab.userId);
      if (u?.email && configAvisos().lembreteEmail) await sendEmail(u.email, "Lembrete: dia sem envio na plataforma",
        `<p>Olá, ${escapar(colab.nome.split(" ")[0])}.</p><p>Não encontramos envio em ${escapar(datas)}. Se foi folga, férias ou atestado, registre a ausência na área <b>Colaborador RYCS</b>; assim o dia não conta como falta.</p><p>Se você trabalhou e algo não apareceu, conteste o dia por lá.</p>`).catch(() => {});
    }
  }

  // Admin só por exceção: sequência de dias sem atividade.
  const seq = ausenciasSeguidas(dias);
  if (seq.dias >= regra.alertaDiasSemAtividade)
    registrarAviso({ colab, destino: "admin", tipo: "sem_atividade", titulo: `${colab.nome}: ${seq.dias} dias sem atividade`,
      texto: `Dias previstos sem envio desde ${dataBRFormatada(seq.desde)}. A própria pessoa já recebeu lembrete.`, chave: `sem_atividade:${colab.id}:${seq.desde}`, dados: seq });

  // Queda por duas semanas seguidas.
  const seg = segundaDaSemana(hoje);
  const nota = (ini) => calcularPainel({ dias: diasDe(colab, ini, somarDias(ini, 6), hoje), ocorrencias: ocorrenciasPeriodo(colab, ini, somarDias(ini, 6)), regra }).nota;
  const [w2, w1, w0] = [nota(somarDias(seg, -21)), nota(somarDias(seg, -14)), nota(somarDias(seg, -7))];
  if (w2 != null && w1 != null && w0 != null && w1 <= w2 - 5 && w0 <= w1 - 5)
    registrarAviso({ colab, destino: "admin", tipo: "queda", titulo: `${colab.nome}: produtividade caindo`, texto: `Notas semanais: ${w2} → ${w1} → ${w0}.`, chave: `queda:${colab.id}:${seg}`, dados: { w2, w1, w0 } });

  // Envios fora da jornada (13.13): informativo, pode ser hora extra.
  const fora = db.prepare("SELECT COUNT(*) AS n FROM colab_ocorrencias WHERE colaboradorId = ? AND foraJornada = 1 AND enviadoEm >= ?").get(colab.id, inicioDoDiaTs(somarDias(seg, -7)))?.n || 0;
  if (fora >= 3 && colab.vinculo === "clt" && colab.regime !== "teletrabalho_producao")
    registrarAviso({ colab, destino: "admin", tipo: "fora_jornada", titulo: `${colab.nome}: envios fora da jornada`,
      texto: `${fora} envios fora do horário ou em dia não previsto na última semana. Pode ser hora extra: informe o contador.`, chave: `fora_jornada:${colab.id}:${seg}`, dados: { envios: fora } });
}

// ───────────────────────────── Rotina ─────────────────────────────

function sincronizarTudo(colab, hoje) {
  sincronizarCadastros(colab);
  sincronizarEmpresas(colab);
  sincronizarDiarias(colab, hoje);
}

export async function processarColaboradores(agoraTs = agora()) {
  const hoje = dataBR(agoraTs);
  gerarOcorrencias(hoje);
  const manha = minutoBR(agoraTs) >= 7 * 60;
  for (const colab of ativos()) {
    try {
      sincronizarTudo(colab, hoje);
      if (manha) await avisosDoColaborador(colab, hoje, agoraTs);
    } catch (e) { console.error(`[colab] ${colab.id}:`, e.message); }
  }
  if (!manha) return;
  // Relatório semanal (segunda) e mensal (dia 1), uma vez por período.
  const seg = segundaDaSemana(hoje);
  const semRef = somarDias(seg, -7);
  const rodar = async (chave, periodo, ref, ini, fim, titulo) => {
    if (lerConfig(chave, null)) return;
    // Marca antes de gerar para duas rodadas não mandarem o e-mail duas vezes;
    // cada relatório é idempotente por pessoa e período.
    gravarConfig(chave, { em: agoraTs });
    const itens = [];
    for (const c of ativos()) {
      const med = inicioMedicao(c);
      if (!med || med > fim) continue;
      const r = await gerarRelatorio(c, periodo, ref, ini, fim).catch((e) => { console.error(`[colab] relatório ${c.id}:`, e.message); return null; });
      if (r) itens.push(r);
    }
    await enviarRelatorioAdmins(titulo, itens);
  };
  await rodar(`relatorio:semana:${semRef}`, "semana", semRef, semRef, somarDias(seg, -1), `Colaboradores: semana de ${dataBRFormatada(semRef)} a ${dataBRFormatada(somarDias(seg, -1))}`);
  const mesRef = mesAnterior(hoje.slice(0, 7));
  await rodar(`relatorio:mes:${mesRef}`, "mes", mesRef, `${mesRef}-01`, ultimoDiaDoMes(mesRef), `Colaboradores: resumo de ${mesRef}`);
}

export function iniciarColaboradores() {
  const tick = () => processarColaboradores().catch((e) => console.error("[colab] rotina:", e.message));
  setTimeout(tick, 30 * 1000).unref?.();
  setInterval(tick, 60 * 60 * 1000).unref?.();
}

// ───────────────────────────── Visões ─────────────────────────────

export function resumoAdmin(hoje = hojeBR()) {
  const mes = hoje.slice(0, 7);
  return db.prepare("SELECT c.*, u.email FROM colaboradores c JOIN users u ON u.id = c.userId ORDER BY c.status, c.nome").all().map((c) => {
    const p = painelDe(c, `${mes}-01`, hoje, hoje);
    const ex = extrato(c, mes);
    return {
      id: c.id, nome: c.nome, email: c.email, funcao: c.funcao, vinculo: c.vinculo, regime: c.regime, status: c.status,
      dataInicio: c.dataInicio, dataSaida: c.dataSaida, ...acesso(c),
      nota: p.nota, faixa: p.faixa, tendencia: p.tendencia, presenca: p.presenca, medirPresenca: p.medirPresenca,
      feitas: p.feitas, meta: p.meta, metaStatus: p.metaInfo?.status, ausentes: p.ausentes, alertas: p.alertas,
      saldoMesCents: ex.variavelCents,
      avisosAbertos: db.prepare("SELECT COUNT(*) AS n FROM colab_avisos WHERE destino = 'admin' AND colaboradorId = ? AND resolvidoEm IS NULL").get(c.id).n,
    };
  });
}
