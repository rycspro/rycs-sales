// Confirmação e lembretes das reuniões marcadas pelo quiz, por e-mail e pelo
// WhatsApp oficial da RYCS. Textos e cronograma: shared/lembretesReuniao.js.
//
// Freios para proteger a conta do WhatsApp:
// - só manda modelo aprovado pela Meta (enquanto não estiver aprovado, só o
//   e-mail sai e o WhatsApp fica registrado como "aguardando modelo");
// - quem pediu para sair (SAIR, PARAR…) não recebe mais nada;
// - se a Meta avisou que está limitando o número, o WhatsApp para;
// - reunião cancelada, realizada ou que já passou encerra os lembretes.
import { randomUUID } from "node:crypto";
import db, { agora } from "../db.js";
import { sendEmail, layoutSequencia, urlApp } from "./email.js";
import {
  envioConfigurado, enviarTemplate, numeroWhatsapp, descadastrados, variacoes, bloqueioRecente,
  registrarSaida, listarTemplates, erroFatal,
} from "./whatsappDisparo.js";
import { cronogramaLembretes, mensagemLembrete, MODELOS_LEMBRETE, IDIOMA_MODELOS } from "../../shared/lembretesReuniao.js";

const MIN = 60 * 1000;
const MAX_TENTATIVAS = 3;

db.exec(`
  CREATE TABLE IF NOT EXISTS agenda_lembretes (
    id TEXT PRIMARY KEY,
    reuniaoId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    canal TEXT NOT NULL,
    enviarEm INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    erro TEXT NOT NULL DEFAULT '',
    enviadoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    UNIQUE (reuniaoId, tipo, canal)
  );
  CREATE INDEX IF NOT EXISTS idx_agenda_lembretes_fila ON agenda_lembretes(status, enviarEm);
`);

const dadosReuniao = db.prepare(`SELECT r.id, r.status, r.nome, r.email, r.telefone, h.inicio, h.fim
  FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId WHERE r.id = ?`);

// Chamado logo depois de a reserva ser gravada.
export function agendarLembretes(reuniaoId) {
  const r = dadosReuniao.get(reuniaoId);
  if (!r || r.status !== "agendada") return 0;
  const t = agora();
  const canais = ["email", ...(numeroWhatsapp(r.telefone) ? ["whatsapp"] : [])];
  const inserir = db.prepare(`INSERT OR IGNORE INTO agenda_lembretes (id, reuniaoId, tipo, canal, enviarEm, criadoEm) VALUES (?, ?, ?, ?, ?, ?)`);
  let n = 0;
  db.transaction(() => {
    for (const item of cronogramaLembretes(r.inicio, t)) {
      for (const canal of canais) n += inserir.run(randomUUID(), reuniaoId, item.tipo, canal, item.enviarEm, t).changes;
    }
  })();
  return n;
}

// Reunião cancelada, realizada ou sem comparecimento: o que falta não sai.
export function cancelarLembretes(reuniaoId, motivo = "reunião encerrada") {
  return db.prepare("UPDATE agenda_lembretes SET status = 'cancelado', erro = ? WHERE reuniaoId = ? AND status = 'pendente'").run(motivo, reuniaoId).changes;
}

// Resumo para o painel: quantos saíram, quantos faltam, quantos não saíram.
export function resumoLembretes(ids) {
  if (!ids.length) return {};
  const linhas = db.prepare(`SELECT reuniaoId, status, COUNT(*) n FROM agenda_lembretes WHERE reuniaoId IN (${ids.map(() => "?").join(",")}) GROUP BY reuniaoId, status`).all(...ids);
  const r = {};
  for (const l of linhas) (r[l.reuniaoId] ||= { enviados: 0, programados: 0, naoEnviados: 0 })[l.status === "enviado" ? "enviados" : l.status === "pendente" ? "programados" : "naoEnviados"] += l.n;
  return r;
}

// Modelos aprovados na Meta (consulta a cada 10 minutos).
let cacheModelos = { em: 0, nomes: new Set() };
async function modelosAprovados() {
  if (Date.now() - cacheModelos.em < 10 * MIN) return cacheModelos.nomes;
  let nomes = new Set();
  try {
    nomes = new Set((await listarTemplates()).filter((t) => t.idioma === IDIOMA_MODELOS).map((t) => t.nome));
  } catch (e) {
    console.warn("[lembretes] consulta dos modelos:", e?.message);
  }
  cacheModelos = { em: Date.now(), nomes };
  return nomes;
}

const marcar = db.prepare("UPDATE agenda_lembretes SET status = ?, erro = ?, enviadoEm = ?, tentativas = tentativas + ? WHERE id = ?");
const adiar = db.prepare("UPDATE agenda_lembretes SET tentativas = tentativas + 1, erro = ?, enviarEm = ? WHERE id = ?");

async function enviarEmail(l, r, msg) {
  const link = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE", text: "Reunião com a RYCS",
    dates: `${new Date(r.inicio).toISOString().replace(/[-:]|\.\d{3}/g, "")}/${new Date(r.fim).toISOString().replace(/[-:]|\.\d{3}/g, "")}`,
    details: "Um especialista da RYCS chama você no WhatsApp no horário marcado.",
  })}`;
  const html = layoutSequencia({
    titulo: msg.titulo, paragrafos: msg.paragrafos, botao: "Salvar no Google Agenda", link,
    rodape: "Precisa remarcar? Avise o especialista ou responda a mensagem da RYCS no WhatsApp.", descadastro: `${urlApp()}/privacidade`,
    textoDescadastro: "Você recebe este e-mail porque agendou uma reunião com a RYCS.", preheader: msg.assunto,
  });
  const res = await sendEmail(r.email, msg.assunto, html, { tags: [{ name: "fluxo", value: "reuniao" }, { name: "tipo", value: l.tipo.replace(/[^a-z0-9_-]/gi, "_") }] });
  if (!res.ok) throw new Error(res.error || "falha no envio do e-mail");
}

// Devolve o motivo para não mandar pelo WhatsApp, ou "" se pode mandar.
async function bloqueioWhatsapp(numero, modeloNome) {
  if (!envioConfigurado()) return "WhatsApp não configurado no servidor";
  if (bloqueioRecente()) return "a Meta está limitando o número; envio suspenso";
  const saiu = descadastrados();
  if (variacoes(numero).some((v) => saiu.has(v))) return "a pessoa pediu para não receber mensagens";
  if (!(await modelosAprovados()).has(modeloNome)) return `modelo ${modeloNome} ainda não aprovado pela Meta`;
  return "";
}

let rodando = false;
export async function processarLembretes() {
  if (rodando) return;
  rodando = true;
  try {
    const t = agora();
    const devidos = db.prepare("SELECT * FROM agenda_lembretes WHERE status = 'pendente' AND enviarEm <= ? ORDER BY enviarEm LIMIT 40").all(t);
    for (const l of devidos) {
      const r = dadosReuniao.get(l.reuniaoId);
      if (!r || r.status !== "agendada" || r.inicio <= t) { marcar.run("cancelado", "reunião encerrada ou já começou", null, 0, l.id); continue; }
      // Servidor fora do ar por muito tempo: lembrete velho não sai fora de hora.
      if (l.tipo !== "confirmacao" && t - l.enviarEm > 3 * 60 * MIN) { marcar.run("pulado", "passou da hora", null, 0, l.id); continue; }
      const msg = mensagemLembrete(l.tipo, r, t);
      try {
        if (l.canal === "email") {
          await enviarEmail(l, r, msg);
        } else {
          const numero = numeroWhatsapp(r.telefone);
          const modelo = MODELOS_LEMBRETE[msg.modelo];
          const motivo = numero ? await bloqueioWhatsapp(numero, modelo.nome) : "sem número de WhatsApp";
          if (motivo) { marcar.run("pulado", motivo, null, 0, l.id); continue; }
          const componentes = [{ type: "body", parameters: msg.variaveis.map((text) => ({ type: "text", text: String(text) })) }];
          const wamid = await enviarTemplate({ numero, tpl: { nome: modelo.nome, idioma: IDIOMA_MODELOS }, componentes });
          registrarSaida({ numero, tipo: "template", modelo: modelo.nome, texto: msg.assunto, origem: "Lembrete de reunião", wamid });
        }
        marcar.run("enviado", "", agora(), 1, l.id);
      } catch (e) {
        const erro = String(e?.message || e).slice(0, 300);
        if (erroFatal(e) || l.tentativas + 1 >= MAX_TENTATIVAS) marcar.run("erro", erro, null, 1, l.id);
        else adiar.run(erro, agora() + 10 * MIN, l.id);
        console.warn(`[lembretes] ${l.canal} ${l.tipo}:`, erro);
      }
    }
  } finally {
    rodando = false;
  }
}

export function iniciarLembretes() {
  setTimeout(() => processarLembretes().catch(() => null), 5000).unref?.();
  setInterval(() => processarLembretes().catch((e) => console.error("[lembretes]", e?.message)), 2 * MIN).unref?.();
}
