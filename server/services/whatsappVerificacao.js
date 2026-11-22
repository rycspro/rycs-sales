import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import db, { agora } from "../db.js";
import { graph, GRAPH } from "./meta.js";
import {
  CODIGO_TAMANHO, VALIDADE_MS, MAX_TENTATIVAS, INTERVALO_REENVIO_MS, MAX_ENVIOS_POR_HORA,
  numeroWhatsapp, whatsVerificado, mensagemCodigo,
  VALIDADE_RECEBIDA_MS, textoVerificacao, extrairCodigo, mesmoWhatsapp,
} from "../../shared/whatsappVerificacao.js";

// Ambiente: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_WABA_ID (os
// mesmos dos disparos), WHATSAPP_TEMPLATE_CODIGO (modelo de autenticação) e
// WHATSAPP_TEMPLATE_IDIOMA. WHATSAPP_API_BASE só existe para os testes.
const config = () => ({
  token: process.env.WHATSAPP_TOKEN || "",
  numeroId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  template: process.env.WHATSAPP_TEMPLATE_CODIGO || "rycs_codigo_verificacao",
  idioma: process.env.WHATSAPP_TEMPLATE_IDIOMA || "pt_BR",
  base: process.env.WHATSAPP_API_BASE || GRAPH(),
  contaId: process.env.WHATSAPP_WABA_ID || "",
});
const configBasica = () => { const c = config(); return !!(c.token && c.numeroId && c.contaId); };

// O modelo de autenticação é criado e aprovado no Gerenciador do WhatsApp.
// Enquanto não estiver aprovado, a verificação aparece como indisponível em vez
// de deixar o profissional pedir um código que a Meta recusaria.
const CACHE_MODELO_MS = 10 * 60 * 1000;
let cacheModelo = { em: 0, aprovado: false };
async function modeloAprovado() {
  if (Date.now() - cacheModelo.em < CACHE_MODELO_MS) return cacheModelo.aprovado;
  const c = config();
  let aprovado = false;
  try {
    const r = await graph(`${c.base}/${c.contaId}/message_templates`, {
      token: c.token, params: { name: c.template, fields: "name,language,status", limit: 20 },
    });
    aprovado = (r.data || []).some((t) => t.name === c.template && t.language === c.idioma && t.status === "APPROVED");
  } catch (e) {
    console.error("[whatsapp-verificacao] consulta do modelo:", e?.message);
  }
  cacheModelo = { em: Date.now(), aprovado };
  return aprovado;
}
export const verificacaoConfigurada = async () => configBasica() && modeloAprovado();

// Situação do modelo na Meta, para o admin acompanhar (sem cache).
export async function estadoModelo() {
  const c = config();
  const base = { configurado: configBasica(), nome: c.template, idioma: c.idioma, status: null, motivo: "" };
  if (!base.configurado) return base;
  const r = await graph(`${c.base}/${c.contaId}/message_templates`, {
    token: c.token, params: { name: c.template, fields: "name,language,status,rejected_reason", limit: 20 },
  });
  const t = (r.data || []).find((x) => x.name === c.template && x.language === c.idioma);
  return { ...base, status: t?.status || null, motivo: t?.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : "" };
}

// O Gerenciador do WhatsApp recusa criar modelo de autenticação nesta conta;
// pela API, com o token do servidor, funciona. Código com botão "Copiar código"
// e validade igual à do sistema.
export async function criarModelo() {
  const atual = await estadoModelo();
  if (!atual.configurado || atual.status) return atual;
  const c = config();
  await graph(`${c.base}/${c.contaId}/message_templates`, {
    token: c.token, metodo: "POST",
    dados: {
      name: c.template, language: c.idioma, category: "AUTHENTICATION",
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: VALIDADE_MS / 60000 },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
      ],
    },
  });
  cacheModelo = { em: 0, aprovado: false };
  return estadoModelo();
}

const HORA = 60 * 60 * 1000;

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_verificacoes (
    sellerId TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    codigoHash TEXT NOT NULL,
    expiraEm INTEGER NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    enviadoEm INTEGER NOT NULL,
    janelaEm INTEGER NOT NULL,
    enviosNaJanela INTEGER NOT NULL DEFAULT 1
  )
`);

// O código nunca fica guardado: só o HMAC, preso ao profissional e ao número.
const hashCodigo = (sellerId, numero, codigo) =>
  createHmac("sha256", process.env.JWT_SECRET || "dev").update(`${sellerId}:${numero}:${codigo}`).digest("hex");

const falha = (status, error, extra = {}) => ({ status, corpo: { error, ...extra } });

function numeroEmOutraConta(sellerId, numero) {
  return db.prepare("SELECT id, whats, pais FROM sellers WHERE whatsVerificadoNumero = ? AND id != ?").all(numero, sellerId)
    .some((s) => numeroWhatsapp(s.whats, s.pais) === numero);
}

export async function statusVerificacao(sellerId) {
  const s = db.prepare("SELECT whats, pais, whatsVerificadoNumero, whatsVerificadoEm FROM sellers WHERE id = ?").get(sellerId);
  if (!s) return null;
  const numero = numeroWhatsapp(s.whats, s.pais);
  const p = db.prepare("SELECT numero, expiraEm, enviadoEm FROM whatsapp_verificacoes WHERE sellerId = ?").get(sellerId);
  const pendente = p && p.numero === numero && p.expiraEm > agora() ? { expiraEm: p.expiraEm, reenviarEm: p.enviadoEm + INTERVALO_REENVIO_MS } : null;
  const r = db.prepare("SELECT codigo, numero, expiraEm FROM whatsapp_verificacoes_recebidas WHERE sellerId = ?").get(sellerId);
  const numeroRycs = r && r.numero === numero && r.expiraEm > agora() ? await numeroDaRycs() : null;
  return {
    configurado: await verificacaoConfigurada(),
    recebimento: configRecebimento(),
    numero,
    verificado: whatsVerificado(s),
    verificadoEm: whatsVerificado(s) ? s.whatsVerificadoEm : null,
    pendente,
    recebida: numeroRycs ? pedidoRecebida(r.codigo, numeroRycs, r.expiraEm) : null,
  };
}

// ── Verificação por mensagem recebida ────────────────────────────────────────
// O profissional envia um texto com código para o WhatsApp da RYCS. O número
// que chega pela API oficial prova que o WhatsApp é dele. Não precisa de modelo
// aprovado e a conversa iniciada pelo cliente não tem custo.

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_verificacoes_recebidas (
    sellerId TEXT PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    numero TEXT NOT NULL,
    expiraEm INTEGER NOT NULL,
    criadoEm INTEGER NOT NULL
  )
`);

export const configRecebimento = () => { const c = config(); return !!(c.token && c.numeroId); };

// Empresas do quiz (/diagnostico) usam o mesmo caminho: mandam o código do
// próprio WhatsApp. O número que chega pela API oficial vira o contato
// verificado do pré-cadastro (corrige número digitado errado).
db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_verificacoes_empresas (
    precadastroId TEXT PRIMARY KEY,
    codigo TEXT UNIQUE,
    expiraEm INTEGER NOT NULL DEFAULT 0,
    numero TEXT NOT NULL DEFAULT '',
    verificadoEm INTEGER,
    criadoEm INTEGER NOT NULL
  )
`);

// Código único entre profissionais e empresas: o webhook acha o dono pelo código.
function codigoRecebidaLivre() {
  let codigo;
  do codigo = String(randomInt(0, 10 ** CODIGO_TAMANHO)).padStart(CODIGO_TAMANHO, "0");
  while (db.prepare("SELECT 1 FROM whatsapp_verificacoes_recebidas WHERE codigo = ? UNION SELECT 1 FROM whatsapp_verificacoes_empresas WHERE codigo = ?").get(codigo, codigo));
  return codigo;
}

// Situação da verificação de uma empresa. `pedido` traz o link do WhatsApp com
// o texto pronto; é renovado quando expira.
export async function verificacaoEmpresa(precadastroId) {
  const atual = db.prepare("SELECT * FROM whatsapp_verificacoes_empresas WHERE precadastroId = ?").get(precadastroId);
  if (atual?.verificadoEm) return { disponivel: true, verificado: true, numero: atual.numero, verificadoEm: atual.verificadoEm };
  if (!configRecebimento()) return { disponivel: false, verificado: false };
  const numeroRycs = await numeroDaRycs();
  if (!numeroRycs) return { disponivel: false, verificado: false };
  const t = agora();
  if (atual?.codigo && atual.expiraEm > t)
    return { disponivel: true, verificado: false, pedido: pedidoRecebida(atual.codigo, numeroRycs, atual.expiraEm) };
  const codigo = codigoRecebidaLivre();
  db.prepare(`INSERT INTO whatsapp_verificacoes_empresas (precadastroId, codigo, expiraEm, criadoEm) VALUES (?, ?, ?, ?)
    ON CONFLICT(precadastroId) DO UPDATE SET codigo = excluded.codigo, expiraEm = excluded.expiraEm`)
    .run(precadastroId, codigo, t + VALIDADE_RECEBIDA_MS, t);
  return { disponivel: true, verificado: false, pedido: pedidoRecebida(codigo, numeroRycs, t + VALIDADE_RECEBIDA_MS) };
}

// Só leitura (painel interno): número verificado ou nada.
export function whatsappEmpresaVerificado(precadastroId) {
  const v = db.prepare("SELECT numero, verificadoEm FROM whatsapp_verificacoes_empresas WHERE precadastroId = ? AND verificadoEm IS NOT NULL").get(precadastroId);
  return v || null;
}

let numeroRycsCache = "";
async function numeroDaRycs() {
  if (process.env.WHATSAPP_NUMERO_EXIBICAO) return process.env.WHATSAPP_NUMERO_EXIBICAO.replace(/\D/g, "");
  if (numeroRycsCache) return numeroRycsCache;
  const c = config();
  try {
    const r = await graph(`${c.base}/${c.numeroId}`, { token: c.token, params: { fields: "display_phone_number" } });
    numeroRycsCache = String(r.display_phone_number || "").replace(/\D/g, "");
  } catch (e) {
    console.error("[whatsapp-verificacao] número da RYCS:", e?.message);
  }
  return numeroRycsCache;
}

const pedidoRecebida = (codigo, numeroRycs, expiraEm) => ({
  codigo,
  texto: textoVerificacao(codigo),
  link: `https://wa.me/${numeroRycs}?text=${encodeURIComponent(textoVerificacao(codigo))}`,
  expiraEm,
});

export async function iniciarRecebida(sellerId) {
  if (!configRecebimento()) return falha(503, "A verificação pelo WhatsApp ainda não está disponível.");
  const s = db.prepare("SELECT whats, pais, whatsVerificadoNumero FROM sellers WHERE id = ?").get(sellerId);
  if (!s) return falha(404, "Profissional não encontrado.");
  const numero = numeroWhatsapp(s.whats, s.pais);
  if (!numero) return falha(400, "Cadastre um WhatsApp válido, com DDD, no seu perfil.");
  if (whatsVerificado(s)) return falha(409, "Este WhatsApp já está verificado.");
  if (numeroEmOutraConta(sellerId, numero)) return falha(409, "Este número já está verificado em outra conta.");
  const numeroRycs = await numeroDaRycs();
  if (!numeroRycs) return falha(503, "A verificação pelo WhatsApp ainda não está disponível.");

  const t = agora();
  const atual = db.prepare("SELECT codigo, numero, expiraEm FROM whatsapp_verificacoes_recebidas WHERE sellerId = ?").get(sellerId);
  if (atual && atual.numero === numero && atual.expiraEm > t)
    return { status: 200, corpo: pedidoRecebida(atual.codigo, numeroRycs, atual.expiraEm) };

  const codigo = codigoRecebidaLivre();
  db.prepare(`INSERT INTO whatsapp_verificacoes_recebidas (sellerId, codigo, numero, expiraEm, criadoEm) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(sellerId) DO UPDATE SET codigo = excluded.codigo, numero = excluded.numero, expiraEm = excluded.expiraEm, criadoEm = excluded.criadoEm`)
    .run(sellerId, codigo, numero, t + VALIDADE_RECEBIDA_MS, t);
  return { status: 200, corpo: pedidoRecebida(codigo, numeroRycs, t + VALIDADE_RECEBIDA_MS) };
}

async function responder(para, texto) {
  const c = config();
  try {
    await graph(`${c.base}/${c.numeroId}/messages`, {
      token: c.token, metodo: "POST",
      dados: { messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } },
    });
  } catch (e) {
    console.warn("[whatsapp-verificacao] resposta:", e?.message);
  }
}

// Chamado com cada aviso do webhook da Meta. Mensagem com código válido vinda
// do número cadastrado no perfil conclui a verificação.
export async function verificarPorMensagens(corpo) {
  if (corpo?.object !== "whatsapp_business_account") return 0;
  let verificados = 0;
  for (const entrada of corpo.entry || []) {
    for (const mudanca of entrada.changes || []) {
      if (mudanca.field !== "messages") continue;
      for (const m of mudanca.value?.messages || []) {
        const codigo = extrairCodigo(m.text?.body || m.button?.text || "");
        if (!codigo || !m.from) continue;
        const p = db.prepare("SELECT * FROM whatsapp_verificacoes_recebidas WHERE codigo = ?").get(codigo);
        const empresa = !p && db.prepare("SELECT * FROM whatsapp_verificacoes_empresas WHERE codigo = ?").get(codigo);
        if (empresa) {
          if (empresa.expiraEm <= agora()) {
            await responder(m.from, "Este código expirou. Volte à página da RYCS e toque em confirmar o WhatsApp de novo.");
            continue;
          }
          db.prepare("UPDATE whatsapp_verificacoes_empresas SET numero = ?, verificadoEm = ?, codigo = NULL WHERE precadastroId = ?")
            .run(String(m.from).replace(/\D/g, ""), agora(), empresa.precadastroId);
          verificados++;
          await responder(m.from, "Pronto! Seu WhatsApp foi confirmado na RYCS. Volte à página para escolher o horário da sua conversa.");
          continue;
        }
        if (!p || p.expiraEm <= agora()) {
          await responder(m.from, "Este código de verificação expirou. Gere um novo no seu perfil da RYCS.");
          continue;
        }
        if (!mesmoWhatsapp(m.from, p.numero)) {
          await responder(m.from, "Este número não é o WhatsApp cadastrado no seu perfil da RYCS. Envie a mensagem do número que está no perfil.");
          continue;
        }
        const ok = db.transaction(() => {
          if (numeroEmOutraConta(p.sellerId, p.numero)) return false;
          db.prepare("UPDATE sellers SET whatsVerificadoNumero = ?, whatsVerificadoEm = ? WHERE id = ?").run(p.numero, agora(), p.sellerId);
          db.prepare("DELETE FROM whatsapp_verificacoes_recebidas WHERE sellerId = ?").run(p.sellerId);
          return true;
        })();
        if (ok) { verificados++; await responder(m.from, "Pronto! Seu WhatsApp foi verificado na RYCS. Pode voltar para a plataforma."); }
      }
    }
  }
  return verificados;
}

export async function enviarCodigo(sellerId) {
  if (!(await verificacaoConfigurada())) return falha(503, "A verificação pelo WhatsApp ainda não está disponível.");
  const s = db.prepare("SELECT whats, pais, whatsVerificadoNumero FROM sellers WHERE id = ?").get(sellerId);
  if (!s) return falha(404, "Profissional não encontrado.");
  const numero = numeroWhatsapp(s.whats, s.pais);
  if (!numero) return falha(400, "Cadastre um WhatsApp válido, com DDD, no seu perfil.");
  if (whatsVerificado(s)) return falha(409, "Este WhatsApp já está verificado.");
  if (numeroEmOutraConta(sellerId, numero)) return falha(409, "Este número já está verificado em outra conta.");

  const t = agora();
  const atual = db.prepare("SELECT enviadoEm, janelaEm, enviosNaJanela FROM whatsapp_verificacoes WHERE sellerId = ?").get(sellerId);
  if (atual && t - atual.enviadoEm < INTERVALO_REENVIO_MS) {
    const segundos = Math.ceil((INTERVALO_REENVIO_MS - (t - atual.enviadoEm)) / 1000);
    return falha(429, `Aguarde ${segundos}s para pedir outro código.`, { segundos });
  }
  const novaJanela = !atual || t - atual.janelaEm >= HORA;
  if (!novaJanela && atual.enviosNaJanela >= MAX_ENVIOS_POR_HORA)
    return falha(429, "Limite de códigos atingido. Tente de novo daqui a uma hora.");

  const codigo = String(randomInt(0, 10 ** CODIGO_TAMANHO)).padStart(CODIGO_TAMANHO, "0");
  const c = config();
  try {
    await graph(`${c.base}/${c.numeroId}/messages`, { token: c.token, metodo: "POST", dados: mensagemCodigo(numero, codigo, c) });
  } catch (e) {
    console.error("[whatsapp-verificacao] envio:", e?.message);
    return falha(502, "Não foi possível enviar o código pelo WhatsApp. Confira o número e tente de novo.");
  }

  db.prepare(`INSERT INTO whatsapp_verificacoes (sellerId, numero, codigoHash, expiraEm, tentativas, enviadoEm, janelaEm, enviosNaJanela)
    VALUES (?, ?, ?, ?, 0, ?, ?, 1)
    ON CONFLICT(sellerId) DO UPDATE SET numero = excluded.numero, codigoHash = excluded.codigoHash, expiraEm = excluded.expiraEm,
      tentativas = 0, enviadoEm = excluded.enviadoEm,
      janelaEm = CASE WHEN ? THEN excluded.janelaEm ELSE whatsapp_verificacoes.janelaEm END,
      enviosNaJanela = CASE WHEN ? THEN 1 ELSE whatsapp_verificacoes.enviosNaJanela + 1 END`)
    .run(sellerId, numero, hashCodigo(sellerId, numero, codigo), t + VALIDADE_MS, t, t, novaJanela ? 1 : 0, novaJanela ? 1 : 0);
  return { status: 200, corpo: { ok: true, expiraEm: t + VALIDADE_MS, reenviarEm: t + INTERVALO_REENVIO_MS } };
}

export function confirmarCodigo(sellerId, codigoInformado) {
  const codigo = String(codigoInformado || "").replace(/\D/g, "");
  if (codigo.length !== CODIGO_TAMANHO) return falha(400, `Digite o código de ${CODIGO_TAMANHO} dígitos.`);
  const s = db.prepare("SELECT whats, pais FROM sellers WHERE id = ?").get(sellerId);
  const p = db.prepare("SELECT * FROM whatsapp_verificacoes WHERE sellerId = ?").get(sellerId);
  const numero = numeroWhatsapp(s?.whats, s?.pais);
  if (!p || p.expiraEm <= agora() || p.numero !== numero) return falha(400, "Código expirado. Peça um novo.");
  if (p.tentativas >= MAX_TENTATIVAS) return falha(429, "Muitas tentativas. Peça um novo código.");

  const certo = Buffer.from(p.codigoHash, "hex");
  const tentativa = Buffer.from(hashCodigo(sellerId, numero, codigo), "hex");
  if (certo.length !== tentativa.length || !timingSafeEqual(certo, tentativa)) {
    db.prepare("UPDATE whatsapp_verificacoes SET tentativas = tentativas + 1 WHERE sellerId = ?").run(sellerId);
    const restantes = MAX_TENTATIVAS - p.tentativas - 1;
    return falha(400, restantes > 0 ? `Código incorreto. Restam ${restantes} tentativa(s).` : "Código incorreto. Peça um novo código.", { restantes });
  }

  const t = agora();
  const resultado = db.transaction(() => {
    if (numeroEmOutraConta(sellerId, numero)) return falha(409, "Este número já está verificado em outra conta.");
    db.prepare("UPDATE sellers SET whatsVerificadoNumero = ?, whatsVerificadoEm = ? WHERE id = ?").run(numero, t, sellerId);
    db.prepare("DELETE FROM whatsapp_verificacoes WHERE sellerId = ?").run(sellerId);
    return { status: 200, corpo: { ok: true, numero, verificadoEm: t } };
  })();
  return resultado;
}
