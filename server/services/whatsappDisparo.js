// Disparo em massa pelo WhatsApp da própria RYCS (Cloud API), sempre com um
// template já aprovado pela Meta. O admin escolhe o template e o público; o
// envio corre em segundo plano, um por vez, e cada mensagem fica registrada com
// o wamid. Os status de entrega chegam pelo webhook (whatsapp_status, gravado
// em ./whatsapp.js) e são cruzados aqui pelo wamid.
//
// Ambiente: WHATSAPP_TOKEN (token de usuário do sistema com
// whatsapp_business_messaging e whatsapp_business_management),
// WHATSAPP_PHONE_NUMBER_ID (número que envia) e WHATSAPP_WABA_ID (conta que
// guarda os templates).

import db, { uid, agora } from "../db.js";
import { graph, ErroMeta } from "./meta.js";
import { pendenciasPerfil } from "../../shared/perfilVendedor.js";
import "./whatsapp.js"; // garante a tabela whatsapp_status usada nos relatórios

const TOKEN = () => process.env.WHATSAPP_TOKEN || "";
const NUMERO_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const CONTA_ID = () => process.env.WHATSAPP_WABA_ID || "";

export function faltandoConfig() {
  return [["WHATSAPP_TOKEN", TOKEN()], ["WHATSAPP_PHONE_NUMBER_ID", NUMERO_ID()], ["WHATSAPP_WABA_ID", CONTA_ID()]]
    .filter(([, v]) => !v).map(([k]) => k);
}
export const envioConfigurado = () => faltandoConfig().length === 0;

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_disparos (
    id TEXT PRIMARY KEY,
    adminId TEXT NOT NULL,
    template TEXT NOT NULL,
    idioma TEXT NOT NULL,
    templateDados TEXT NOT NULL,
    variaveis TEXT NOT NULL DEFAULT '[]',
    publico TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'enviando',
    erro TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    concluidoEm INTEGER
  );
  CREATE TABLE IF NOT EXISTS whatsapp_envios (
    id TEXT PRIMARY KEY,
    disparoId TEXT NOT NULL,
    sellerId TEXT,
    numero TEXT NOT NULL,
    nome TEXT DEFAULT '',
    wamid TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'fila',
    erro TEXT DEFAULT '',
    enviadoEm INTEGER,
    UNIQUE (disparoId, numero)
  );
  CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_disparo ON whatsapp_envios(disparoId, status);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_wamid ON whatsapp_envios(wamid);
`);
// Mensagens avulsas (respostas do admin, modelo mandado numa conversa, respostas
// automáticas): ficam aqui para aparecerem no histórico das conversas.
db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_saidas (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    tipo TEXT NOT NULL,
    texto TEXT NOT NULL DEFAULT '',
    modelo TEXT DEFAULT '',
    origem TEXT DEFAULT '',
    adminId TEXT DEFAULT '',
    wamid TEXT DEFAULT '',
    enviadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_whatsapp_saidas_numero ON whatsapp_saidas(numero, enviadoEm);
`);
const sqlSaida = db.prepare(`INSERT INTO whatsapp_saidas (id, numero, tipo, texto, modelo, origem, adminId, wamid, enviadoEm)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
export function registrarSaida({ numero, tipo, texto = "", modelo = "", origem = "", adminId = "", wamid = "" }) {
  const id = uid();
  const em = Date.now();
  sqlSaida.run(id, String(numero), tipo, String(texto), modelo, origem, adminId, wamid, em);
  return { id, enviadoEm: em };
}

// Valores exatos das variáveis de cada envio, para o admin ver a mensagem como saiu.
if (!db.prepare("PRAGMA table_info(whatsapp_envios)").all().some((c) => c.name === "parametros"))
  db.exec("ALTER TABLE whatsapp_envios ADD COLUMN parametros TEXT DEFAULT ''");

// ── Números ───────────────────────────────────────────────────────────

const DDI = { brasil: "55", india: "91", "estados unidos": "1", eua: "1", usa: "1", "reino unido": "44", portugal: "351" };
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// Número no formato que a Cloud API espera (só dígitos, com DDI). Vazio quando
// não dá para ter certeza do país: melhor pular do que mandar para outra pessoa.
export function numeroWhatsapp(whats, pais = "Brasil") {
  const bruto = String(whats || "").trim();
  let d = bruto.replace(/\D/g, "");
  if (!d) return "";
  const valido = (n) => (n.length >= 10 && n.length <= 15 ? n : "");
  if (bruto.startsWith("+")) return valido(d);
  if (d.startsWith("00")) return valido(d.slice(2));
  d = d.replace(/^0+/, "");
  const ddi = DDI[semAcento(pais || "Brasil").trim().toLowerCase()];
  if (!ddi) return "";
  if (ddi === "55") {
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
    return d.length === 10 || d.length === 11 ? `55${d}` : "";
  }
  return valido(d.startsWith(ddi) && d.length > 10 ? d : `${ddi}${d}`);
}

// No Brasil o WhatsApp às vezes identifica o celular sem o nono dígito.
export function variacoes(n) {
  const v = [n];
  if (/^55\d{11}$/.test(n) && n[4] === "9") v.push(n.slice(0, 4) + n.slice(5));
  if (/^55\d{10}$/.test(n) && /[6-9]/.test(n[4])) v.push(`${n.slice(0, 4)}9${n.slice(4)}`);
  return v;
}

// ── Quem pediu para sair ──────────────────────────────────────────────

const normalizar = (t) => semAcento(t).trim().toLowerCase().replace(/[.!]+$/, "");
// "Agora não" / "Not now" são os botões de recusa do template de aceite.
const PALAVRAS_SAIR = new Set(["stop", "stop messages", "parar", "parar mensagens", "sair", "cancelar",
  "descadastrar", "nao quero receber", "nao quero mais receber", "unsubscribe", "agora nao", "not now"].map(normalizar));

// Mensagem recebida que pede para sair. Exceção: "Agora não" da reativação de
// empresas (payload "reativacao:agora_nao:…") é só uma resposta, não um pedido para sair.
export function pedidoDeSaida({ tipo, texto, payload }) {
  if (!["text", "button", "interactive"].includes(tipo) || String(texto || "").length > 40) return false;
  if (String(payload || "").startsWith("reativacao:") && !String(payload).startsWith("reativacao:parar")) return false;
  return PALAVRAS_SAIR.has(normalizar(texto));
}

export function descadastrados() {
  const rows = db.prepare(`SELECT de, tipo, texto, json_extract(dados, '$.button.payload') AS payload FROM whatsapp_mensagens
    WHERE tipo IN ('text','button','interactive') AND length(texto) <= 40`).all();
  const s = new Set();
  for (const r of rows) if (pedidoDeSaida(r)) for (const x of variacoes(String(r.de))) s.add(x);
  return s;
}

// ── Público ───────────────────────────────────────────────────────────

// `ddi` limita ao país do número; `filtro` olha a linha do vendedor;
// `comPendencias` libera a variável "pendências do perfil".
// Inativado (perfil incompleto) não é ativo: a mensagem de aceite diz "sua conta está ativa".
export const PUBLICOS = {
  ativos: { label: "Vendedores ativos", where: "status = 'aprovado' AND inativoEm IS NULL" },
  perfil_incompleto: {
    label: "Perfil incompleto (Brasil)",
    where: "status = 'aprovado' AND COALESCE(NULLIF(pais, ''), 'Brasil') = 'Brasil'",
    ddi: "55",
    filtro: (s) => pendenciasPerfil(s).length > 0,
    comPendencias: true,
  },
};

// Campos que a regra de perfil completo lê. A foto vem só como "tem ou não tem",
// para não carregar a imagem inteira de cada vendedor.
const CAMPOS_PERFIL_SQL = `CASE WHEN TRIM(COALESCE(foto, '')) <> '' THEN 'sim' ELSE '' END AS foto,
  titulo, bio, disponibilidade, cidade, segmentos, modalidades, skills`;
const sqlPerfil = db.prepare(`SELECT ${CAMPOS_PERFIL_SQL} FROM sellers WHERE id = ?`);

// "foto de perfil, cidade e habilidades (skills)": o que falta no perfil, do
// jeito que entra na variável do template. Mesma regra dos e-mails.
export function textoPendencias(s) {
  const itens = pendenciasPerfil(s).map((l) => l.toLowerCase());
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : itens[0] || "";
}

const usaPendencias = (variaveis) => Array.isArray(variaveis) && variaveis.some((v) => v?.origem === "pendencias");

const primeiroNome = (nome) => {
  const p = String(nome || "").trim().split(/\s+/)[0] || "";
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "";
};

const sqlRecebidos = db.prepare(`SELECT DISTINCT e.numero FROM whatsapp_envios e
  JOIN whatsapp_disparos d ON d.id = e.disparoId WHERE d.template = ? AND e.status IN ('enviado','fila')`);

// Com `template`, quem já recebeu esse template (em qualquer idioma) fica de
// fora: a segunda rodada continua de onde a primeira parou, sem repetir ninguém.
export function destinatarios(publico, { template } = {}) {
  const p = PUBLICOS[publico];
  if (!p) return null;
  const rows = db.prepare(`SELECT id, nome, whats, pais, ${CAMPOS_PERFIL_SQL} FROM sellers WHERE ${p.where} ORDER BY criadoEm`).all()
    .filter((s) => !p.filtro || p.filtro(s));
  const sair = descadastrados();
  const recebidos = new Set(template ? sqlRecebidos.all(template).map((r) => r.numero) : []);
  const vistos = new Set();
  const lista = [];
  let semNumero = 0, optOut = 0, duplicados = 0, jaReceberam = 0;
  for (const s of rows) {
    const numero = numeroWhatsapp(s.whats, s.pais);
    if (!numero || (p.ddi && !numero.startsWith(p.ddi))) { semNumero++; continue; }
    if (variacoes(numero).some((x) => sair.has(x))) { optOut++; continue; }
    if (vistos.has(numero)) { duplicados++; continue; }
    vistos.add(numero);
    if (recebidos.has(numero)) { jaReceberam++; continue; }
    lista.push({ sellerId: s.id, numero, nome: primeiroNome(s.nome) });
  }
  return { label: p.label, lista, total: rows.length, semNumero, descadastrados: optOut, duplicados, jaReceberam };
}

// ── Freios que protegem a conta ───────────────────────────────────────
//
// O número oficial é o ativo mais valioso do WhatsApp da RYCS: se muita gente
// bloqueia ou denuncia, a Meta derruba a qualidade e pode travar a conta. Por
// isso o disparo é deliberadamente conservador.

export const LIMITE_24H = 250; // pessoas diferentes a cada 24h, somando todos os disparos
export const LOTE_PADRAO = 50;
export const LOTE_MAXIMO = 250;
export const HORARIO = { inicio: 8, fim: 20 }; // no horário local de quem recebe
const DIA = 24 * 60 * 60 * 1000;
const ERRO_BLOQUEIOS = "131048"; // "Spam rate limit": muitas mensagens bloqueadas ou denunciadas
const TAXA_FALHA_MAXIMA = 0.3;
const MINIMO_PARA_TAXA = 20;

const sqlUsados24h = db.prepare(`SELECT COUNT(DISTINCT numero) AS n FROM whatsapp_envios
  WHERE status = 'fila' OR (status = 'enviado' AND enviadoEm > ?)`);
const sqlBloqueio = db.prepare(`SELECT 1 FROM whatsapp_status WHERE status = 'failed' AND erro LIKE ? AND recebidoEm > ? LIMIT 1`);
const sqlFalhas = db.prepare(`SELECT
    (SELECT COUNT(*) FROM whatsapp_envios WHERE disparoId = @id AND status = 'enviado') AS enviados,
    (SELECT COUNT(*) FROM whatsapp_envios WHERE disparoId = @id AND status = 'falhou' AND erro GLOB '[0-9]*') AS falhasEnvio,
    (SELECT COUNT(DISTINCT e.id) FROM whatsapp_envios e JOIN whatsapp_status s ON s.wamid = e.wamid
      WHERE e.disparoId = @id AND e.wamid <> '' AND s.status = 'failed') AS falhasEntrega`);
const sqlNaFila = db.prepare("SELECT COUNT(*) AS n FROM whatsapp_envios WHERE disparoId = ? AND status = 'fila'");

// Vagas no limite de 24h: quem recebeu nas últimas 24h e quem ainda está na fila.
export function vagas24h(ms = Date.now()) {
  return Math.max(0, LIMITE_24H - sqlUsados24h.get(ms - DIA).n);
}

// A Meta avisou nas últimas 24h que está limitando o número por bloqueios.
export const bloqueioRecente = (ms = Date.now()) => !!sqlBloqueio.get(`${ERRO_BLOQUEIOS}%`, ms - DIA);

const FUSOS = [["55", "America/Sao_Paulo"], ["91", "Asia/Kolkata"], ["351", "Europe/Lisbon"], ["44", "Europe/London"], ["1", "America/New_York"]];
export const fusoDoNumero = (numero) => (FUSOS.find(([ddi]) => String(numero).startsWith(ddi)) || FUSOS[0])[1];

export function dentroDoHorario(numero, ms = Date.now()) {
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: fusoDoNumero(numero), hour: "numeric", hourCycle: "h23" }).format(ms));
  return hora >= HORARIO.inicio && hora < HORARIO.fim;
}

// Motivo para parar o disparo agora, ou "" para seguir.
function freio(id, ms) {
  if (bloqueioRecente(ms)) return `${ERRO_BLOQUEIOS} A Meta está limitando o número porque muitas mensagens foram bloqueadas ou denunciadas.`;
  const n = sqlFalhas.get({ id });
  const tentados = n.enviados + n.falhasEnvio;
  if (tentados >= MINIMO_PARA_TAXA && (n.falhasEnvio + n.falhasEntrega) / tentados >= TAXA_FALHA_MAXIMA)
    return `Muitas falhas (${n.falhasEnvio + n.falhasEntrega} de ${tentados}). Disparo parado para proteger a conta.`;
  return "";
}

// ── Templates ─────────────────────────────────────────────────────────

const placeholders = (texto) => [...new Set([...String(texto || "").matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];

// Resumo do template da Meta com o que este disparo sabe preencher. Hoje só
// variáveis do corpo; cabeçalho de mídia e botões com valor ficam de fora.
export function resumirTemplate(t) {
  const componentes = t.components || [];
  const comp = (tipo) => componentes.find((c) => c.type === tipo);
  const header = comp("HEADER");
  const botoes = comp("BUTTONS")?.buttons || [];
  const formato = t.parameter_format === "NAMED" ? "NAMED" : "POSITIONAL";
  let variaveis = placeholders(comp("BODY")?.text);
  if (formato === "POSITIONAL") variaveis = variaveis.sort((a, b) => Number(a) - Number(b));

  let motivo = "";
  if (componentes.some((c) => !["HEADER", "BODY", "FOOTER", "BUTTONS"].includes(c.type))) motivo = "Formato de template ainda não suportado aqui.";
  else if (header && header.format && header.format !== "TEXT") motivo = "Cabeçalho com mídia ainda não é suportado aqui.";
  else if (header && placeholders(header.text).length) motivo = "Cabeçalho com variável ainda não é suportado aqui.";
  else if (botoes.some((b) => !["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(b.type) || (b.type === "URL" && /\{\{/.test(b.url || ""))))
    motivo = "Botão que precisa de valor no envio ainda não é suportado aqui.";

  return {
    nome: t.name, idioma: t.language, categoria: t.category, formato,
    cabecalho: header?.format === "TEXT" ? header.text || "" : "",
    corpo: comp("BODY")?.text || "", rodape: comp("FOOTER")?.text || "",
    botoes: botoes.map((b) => ({ tipo: b.type, texto: b.text || "", url: b.url || "" })),
    variaveis, suportado: !motivo, motivo,
  };
}

export async function listarTemplates() {
  const r = await graph(`/${CONTA_ID()}/message_templates`, {
    token: TOKEN(),
    params: { status: "APPROVED", fields: "name,language,category,status,components,parameter_format", limit: 100 },
  });
  return (r.data || []).filter((t) => !t.status || t.status === "APPROVED").map(resumirTemplate);
}

// Uma escolha por variável, na ordem do template: { origem: "nome" } usa o
// primeiro nome do vendedor; { origem: "pendencias" } o que falta no perfil de
// cada um; { origem: "fixo", texto } usa o mesmo texto para todos.
export function validarVariaveis(tpl, variaveis) {
  if (!Array.isArray(variaveis) || variaveis.length !== tpl.variaveis.length) return "Preencha todas as variáveis do template.";
  for (const v of variaveis) {
    if (v?.origem === "nome" || v?.origem === "pendencias") continue;
    if (v?.origem !== "fixo" || !String(v.texto || "").trim()) return "Preencha todas as variáveis do template.";
    if (String(v.texto).length > 300) return "Texto da variável muito longo.";
  }
  return "";
}

export function montarComponentes(tpl, variaveis, nome, pendencias = "") {
  if (!tpl.variaveis.length) return [];
  const parametros = tpl.variaveis.map((ph, i) => {
    const v = variaveis[i] || {};
    const text = String((v.origem === "nome" ? nome : v.origem === "pendencias" ? pendencias : v.texto) || "").trim();
    return tpl.formato === "NAMED" ? { type: "text", parameter_name: ph, text } : { type: "text", text };
  });
  return [{ type: "body", parameters: parametros }];
}

export async function enviarTemplate({ numero, tpl, componentes }) {
  const corpo = {
    messaging_product: "whatsapp", recipient_type: "individual", to: numero, type: "template",
    template: { name: tpl.nome, language: { code: tpl.idioma }, ...(componentes.length ? { components: componentes } : {}) },
  };
  const r = await graph(`/${NUMERO_ID()}/messages`, { token: TOKEN(), metodo: "POST", dados: corpo });
  return r.messages?.[0]?.id || "";
}

// Texto livre: só vale dentro da janela de 24h aberta por uma mensagem da pessoa.
// Fica registrado para aparecer no histórico da conversa.
export async function enviarTexto({ numero, texto, origem = "Resposta automática", adminId = "" }) {
  const corpo = { messaging_product: "whatsapp", recipient_type: "individual", to: numero, type: "text", text: { body: texto } };
  const r = await graph(`/${NUMERO_ID()}/messages`, { token: TOKEN(), metodo: "POST", dados: corpo });
  const wamid = r.messages?.[0]?.id || "";
  registrarSaida({ numero, tipo: "texto", texto, origem, adminId, wamid });
  return wamid;
}

// Erro da Meta que vale para tudo (token, conta, número limitado): parar de enviar.
export const erroFatal = (err) => err instanceof ErroMeta && (err.tokenInvalido || ERROS_FATAIS.has(err.codigo));
export { descreverErro };

// ── Disparo ───────────────────────────────────────────────────────────

export const disparoEmAndamento = () => db.prepare("SELECT id FROM whatsapp_disparos WHERE status = 'enviando' LIMIT 1").get();

// `limite` é o tamanho da rodada: começar pequeno e olhar bloqueios antes de ampliar.
export function criarDisparo({ adminId, tpl, variaveis, publico, limite = LOTE_PADRAO }) {
  if (bloqueioRecente()) throw new Error("A Meta avisou nas últimas 24h que está limitando o número por bloqueios. Espere antes de disparar de novo.");
  if (usaPendencias(variaveis) && !PUBLICOS[publico]?.comPendencias)
    throw new Error(`A variável de pendências só funciona com o público "${PUBLICOS.perfil_incompleto.label}".`);
  const tamanho = Math.trunc(Number(limite));
  if (!(tamanho >= 1 && tamanho <= LOTE_MAXIMO)) throw new Error(`Escolha de 1 a ${LOTE_MAXIMO} pessoas por rodada.`);
  const vagas = vagas24h();
  if (!vagas) throw new Error(`Limite de segurança atingido: ${LIMITE_24H} pessoas a cada 24h. Tente de novo mais tarde.`);
  const d = destinatarios(publico, { template: tpl.nome });
  if (!d) throw new Error("Público inválido.");
  if (!d.lista.length) throw new Error("Ninguém nesse público para receber este template.");
  d.lista = d.lista.slice(0, Math.min(tamanho, vagas));
  const id = uid();
  const ts = agora();
  const inserir = db.prepare("INSERT OR IGNORE INTO whatsapp_envios (id, disparoId, sellerId, numero, nome) VALUES (?, ?, ?, ?, ?)");
  db.transaction(() => {
    db.prepare(`INSERT INTO whatsapp_disparos (id, adminId, template, idioma, templateDados, variaveis, publico, total, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, adminId, tpl.nome, tpl.idioma, JSON.stringify(tpl), JSON.stringify(variaveis), d.label, d.lista.length, ts);
    for (const p of d.lista) inserir.run(uid(), id, p.sellerId, p.numero, p.nome);
  })();
  return { id, ...d };
}

// Erros que valem para o disparo inteiro: continuar só repetiria a falha.
// 131048 é a Meta limitando o número por bloqueios e denúncias.
const ERROS_FATAIS = new Set([4, 368, 80007, 131031, 131042, 131048, 132000, 132001, 132015, 132016]);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const descreverErro = (e) => `${e?.codigo ? `${e.codigo} ` : ""}${e?.message || "Falha no envio"}`.slice(0, 300);

const processando = new Set();

// Quem está fora do horário fica na fila; o disparo volta a olhar a fila a cada 15 min.
const ESPERA_HORARIO_MS = 15 * 60 * 1000;
const aguardando = new Map();
function retomarDepois(id) {
  if (aguardando.has(id)) return;
  const t = setTimeout(() => { aguardando.delete(id); processarDisparo(id).catch(() => null); }, ESPERA_HORARIO_MS);
  t.unref?.();
  aguardando.set(id, t);
}

export async function processarDisparo(id, { pausaMs = 250, relogio = Date.now } = {}) {
  if (processando.has(id)) return;
  processando.add(id);
  try {
    const disp = db.prepare("SELECT * FROM whatsapp_disparos WHERE id = ?").get(id);
    if (!disp || disp.status !== "enviando") return;
    const tpl = JSON.parse(disp.templateDados);
    const variaveis = JSON.parse(disp.variaveis || "[]");
    const comPendencias = usaPendencias(variaveis);
    const marcar = db.prepare("UPDATE whatsapp_envios SET status = ?, wamid = ?, erro = ?, enviadoEm = ? WHERE id = ?");
    const guardarParametros = db.prepare("UPDATE whatsapp_envios SET parametros = ? WHERE id = ?");
    const fila = db.prepare("SELECT * FROM whatsapp_envios WHERE disparoId = ? AND status = 'fila' ORDER BY rowid").all(id);
    let fatal = freio(id, relogio());
    let tentados = 0;

    for (const e of fatal ? [] : fila) {
      if (!dentroDoHorario(e.numero, relogio())) continue;
      // A cada 10 envios confere se a Meta reclamou ou se as falhas passaram do limite.
      if (tentados && tentados % 10 === 0 && (fatal = freio(id, relogio()))) break;
      tentados++;
      // Pendências lidas na hora do envio: quem completou o perfil enquanto
      // esperava na fila não recebe aviso de algo que já resolveu.
      let pendencias = "";
      if (comPendencias) {
        const perfil = e.sellerId ? sqlPerfil.get(e.sellerId) : null;
        pendencias = perfil ? textoPendencias(perfil) : "";
        if (!pendencias) { marcar.run("falhou", "", "Perfil completo antes do envio", agora(), e.id); continue; }
      }
      const componentes = montarComponentes(tpl, variaveis, e.nome, pendencias);
      guardarParametros.run(JSON.stringify((componentes[0]?.parameters || []).map((p) => p.text)), e.id);
      if (componentes[0]?.parameters.some((p) => !p.text)) { marcar.run("falhou", "", "Vendedor sem nome cadastrado", agora(), e.id); continue; }
      for (let tentativa = 1; ; tentativa++) {
        try {
          const wamid = await enviarTemplate({ numero: e.numero, tpl, componentes });
          marcar.run("enviado", wamid, "", agora(), e.id);
        } catch (err) {
          // Limite de vazão da Meta: espera e tenta de novo a mesma mensagem.
          if (err instanceof ErroMeta && err.codigo === 130429 && tentativa < 3) { await esperar(2000 * tentativa); continue; }
          marcar.run("falhou", "", descreverErro(err), agora(), e.id);
          if (err instanceof ErroMeta && (err.tokenInvalido || ERROS_FATAIS.has(err.codigo))) fatal = descreverErro(err);
        }
        break;
      }
      if (fatal) break;
      if (pausaMs) await esperar(pausaMs);
    }

    if (!fatal) fatal = freio(id, relogio());
    const naFila = sqlNaFila.get(id).n;
    if (!fatal && naFila) { retomarDepois(id); return; }
    clearTimeout(aguardando.get(id));
    aguardando.delete(id);
    if (fatal) db.prepare("UPDATE whatsapp_envios SET status = 'falhou', erro = 'Disparo interrompido' WHERE disparoId = ? AND status = 'fila'").run(id);
    const n = db.prepare(`SELECT SUM(status = 'enviado') AS enviados, SUM(status = 'falhou') AS falhas FROM whatsapp_envios WHERE disparoId = ?`).get(id);
    const status = !n.falhas ? "concluido" : !n.enviados ? "falhou" : "parcial";
    db.prepare("UPDATE whatsapp_disparos SET status = ?, erro = ?, concluidoEm = ? WHERE id = ?").run(status, fatal, agora(), id);
  } finally {
    processando.delete(id);
  }
}

// Disparos que ficaram no meio (o servidor reiniciou) continuam de onde pararam.
export function retomarDisparos() {
  if (!envioConfigurado()) return;
  for (const { id } of db.prepare("SELECT id FROM whatsapp_disparos WHERE status = 'enviando'").all()) processarDisparo(id).catch(() => null);
}

// ── Relatório ─────────────────────────────────────────────────────────

export function listarDisparos() {
  const porStatus = (cond) => `(SELECT COUNT(DISTINCT e.id) FROM whatsapp_envios e JOIN whatsapp_status s ON s.wamid = e.wamid
    WHERE e.disparoId = d.id AND e.wamid <> '' AND ${cond})`;
  return db.prepare(`SELECT d.id, d.template, d.idioma, d.publico, d.total, d.status, d.erro, d.criadoEm, d.concluidoEm,
      (SELECT COUNT(*) FROM whatsapp_envios e WHERE e.disparoId = d.id AND e.status = 'enviado') AS enviados,
      (SELECT COUNT(*) FROM whatsapp_envios e WHERE e.disparoId = d.id AND e.status = 'falhou') AS falhasEnvio,
      ${porStatus("s.status IN ('delivered','read')")} AS entregues,
      ${porStatus("s.status = 'read'")} AS lidos,
      ${porStatus("s.status = 'failed'")} AS falhasEntrega
    FROM whatsapp_disparos d ORDER BY d.criadoEm DESC LIMIT 50`).all()
    .map((d) => ({ ...d, aguardandoHorario: aguardando.has(d.id) }));
}

// Falhas de um disparo: as do envio e as que a Meta avisou depois pelo webhook.
export function falhasDoDisparo(id) {
  return db.prepare(`SELECT e.nome, e.numero, COALESCE(NULLIF(e.erro, ''), s.erro, '') AS erro
    FROM whatsapp_envios e LEFT JOIN whatsapp_status s ON s.wamid = e.wamid AND e.wamid <> '' AND s.status = 'failed'
    WHERE e.disparoId = ? AND (e.status = 'falhou' OR s.id IS NOT NULL)
    ORDER BY e.rowid LIMIT 500`).all(id);
}
