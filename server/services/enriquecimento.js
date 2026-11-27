// Enriquecimento de leads — replica os dados da Speedio usando fontes gratuitas.
//
// Camadas:
//   1. Extração de CNPJ do site da empresa (scraping leve)
//   2. CNPJ.ws / BrasilAPI  → Receita Federal (grátis, 3 req/min)
//   3. Modelo de estimativa  → faturamento e funcionários
//   4. Classificador NLP     → decisores (cargo → departamento + nível)
//   5. Hunter.io (opcional)  → emails profissionais (50/mês grátis)
//   6. Validação SMTP        → emails válidos/inválidos
//   7. HLR Lookup (opcional) → telefones válidos/inválidos

import db, { uid, agora } from "../db.js";

// ── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS enriq_empresas (
    id TEXT PRIMARY KEY,
    contatoId TEXT NOT NULL,
    cnpj TEXT,
    razaoSocial TEXT DEFAULT '',
    nomeFantasia TEXT DEFAULT '',
    uf TEXT DEFAULT '',
    cidade TEXT DEFAULT '',
    bairro TEXT DEFAULT '',
    cep TEXT DEFAULT '',
    logradouro TEXT DEFAULT '',
    numero TEXT DEFAULT '',
    complemento TEXT DEFAULT '',
    capitalSocial REAL,
    porte TEXT DEFAULT '',
    naturezaJuridica TEXT DEFAULT '',
    naturezaJuridicaDesc TEXT DEFAULT '',
    situacaoCadastral TEXT DEFAULT '',
    dataSituacao TEXT DEFAULT '',
    simplesNacional INTEGER,
    mei INTEGER,
    dataAbertura TEXT DEFAULT '',
    idadeEmpresa TEXT DEFAULT '',
    qtdFiliais INTEGER DEFAULT 0,
    cnaePrimario TEXT DEFAULT '',
    cnaePrimarioDesc TEXT DEFAULT '',
    cnaesSecundarios TEXT DEFAULT '[]',
    inscricaoEstadual TEXT DEFAULT '',

    -- Estimativas (modelo próprio)
    faixaFaturamento TEXT DEFAULT '',
    faixaFuncionarios TEXT DEFAULT '',
    faturamentoEstimado REAL,
    funcionariosEstimado INTEGER,

    -- Contatos da Receita
    telefonesRF TEXT DEFAULT '[]',
    emailRF TEXT DEFAULT '',

    -- Validação
    telefonesValidados TEXT DEFAULT '[]',
    telefonesInvalidos TEXT DEFAULT '[]',
    emailsValidados TEXT DEFAULT '[]',
    emailsInvalidos TEXT DEFAULT '[]',

    -- Redes sociais
    linkedinEmpresa TEXT DEFAULT '',
    facebookEmpresa TEXT DEFAULT '',
    instagramEmpresa TEXT DEFAULT '',
    twitterEmpresa TEXT DEFAULT '',

    -- Tecnologias
    tecnologias TEXT DEFAULT '[]',

    -- Contexto regional (IBGE)
    pibMunicipio REAL,
    populacaoMunicipio INTEGER,

    -- Meta
    fonte TEXT DEFAULT '',
    enriquecidoEm INTEGER,
    atualizadoEm INTEGER,
    status TEXT DEFAULT 'pendente',

    UNIQUE(contatoId)
  );
  CREATE INDEX IF NOT EXISTS idx_enriq_emp_contato ON enriq_empresas(contatoId);
  CREATE INDEX IF NOT EXISTS idx_enriq_emp_cnpj ON enriq_empresas(cnpj);

  CREATE TABLE IF NOT EXISTS enriq_socios (
    id TEXT PRIMARY KEY,
    empresaId TEXT NOT NULL,
    nome TEXT NOT NULL,
    qualificacao TEXT DEFAULT '',
    cpfParcial TEXT DEFAULT '',
    dataEntrada TEXT DEFAULT '',
    faixaEtaria TEXT DEFAULT '',
    FOREIGN KEY (empresaId) REFERENCES enriq_empresas(id)
  );
  CREATE INDEX IF NOT EXISTS idx_enriq_socios_emp ON enriq_socios(empresaId);

  CREATE TABLE IF NOT EXISTS enriq_decisores (
    id TEXT PRIMARY KEY,
    empresaId TEXT NOT NULL,
    contatoId TEXT NOT NULL,
    nome TEXT NOT NULL,
    cargo TEXT DEFAULT '',
    departamento TEXT DEFAULT '',
    nivel TEXT DEFAULT '',
    localizacao TEXT DEFAULT '',
    emailProfissional TEXT DEFAULT '',
    emailStatus TEXT DEFAULT '',
    linkedinUrl TEXT DEFAULT '',
    linkedinUrn TEXT DEFAULT '',
    resumo TEXT DEFAULT '',
    foto TEXT DEFAULT '',
    fonte TEXT DEFAULT '',
    atualizadoEm INTEGER,
    FOREIGN KEY (empresaId) REFERENCES enriq_empresas(id)
  );
  CREATE INDEX IF NOT EXISTS idx_enriq_dec_emp ON enriq_decisores(empresaId);
  CREATE INDEX IF NOT EXISTS idx_enriq_dec_contato ON enriq_decisores(contatoId);

  CREATE TABLE IF NOT EXISTS enriq_hierarquia (
    id TEXT PRIMARY KEY,
    empresaId TEXT NOT NULL,
    empresaMaeId TEXT,
    cnpjMae TEXT DEFAULT '',
    razaoSocialMae TEXT DEFAULT '',
    tipo TEXT DEFAULT 'filial',
    FOREIGN KEY (empresaId) REFERENCES enriq_empresas(id)
  );

  CREATE TABLE IF NOT EXISTS enriq_log (
    id TEXT PRIMARY KEY,
    contatoId TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT DEFAULT 'ok',
    detalhes TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_enriq_log_contato ON enriq_log(contatoId);
`);


// ── 1. Extração de CNPJ do site ────────────────────────────────────────────

const CNPJ_RE = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g;

export async function extrairCnpjDoSite(url) {
  if (!url) return null;
  try {
    const limpo = url.startsWith("http") ? url : `https://${url}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(limpo, {
      signal: ctrl.signal,
      headers: { "User-Agent": "RYCS-Enriquecimento/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const matches = html.match(CNPJ_RE);
    if (!matches) return null;
    for (const m of matches) {
      const digits = m.replace(/\D/g, "");
      if (digits.length === 14 && validarCnpj(digits)) return digits;
    }
    return null;
  } catch {
    return null;
  }
}

function validarCnpj(cnpj) {
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (str, pesos) => {
    let s = 0;
    for (let i = 0; i < pesos.length; i++) s += Number(str[i]) * pesos[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(cnpj[12]) === d1 && Number(cnpj[13]) === d2;
}


// ── 2. Provider CNPJ.ws (grátis, 3 req/min) ───────────────────────────────

const CNPJWS_QUEUE = [];
let cnpjwsProcessando = false;

async function cnpjwsThrottle(fn) {
  return new Promise((resolve, reject) => {
    CNPJWS_QUEUE.push({ fn, resolve, reject });
    if (!cnpjwsProcessando) processarFilaCnpjws();
  });
}

async function processarFilaCnpjws() {
  cnpjwsProcessando = true;
  while (CNPJWS_QUEUE.length) {
    const { fn, resolve, reject } = CNPJWS_QUEUE.shift();
    try { resolve(await fn()); }
    catch (e) { reject(e); }
    if (CNPJWS_QUEUE.length) await new Promise((r) => setTimeout(r, 21000)); // 3 req/min = 1 a cada 20s
  }
  cnpjwsProcessando = false;
}

export async function buscarCnpjWs(cnpj) {
  return cnpjwsThrottle(async () => {
    const url = `https://publica.cnpj.ws/cnpj/${cnpj.replace(/\D/g, "")}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RYCS-Enriquecimento/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 429) {
      console.warn("[enriq] CNPJ.ws rate limit, aguardando...");
      await new Promise((r) => setTimeout(r, 60000));
      const retry = await fetch(url, {
        headers: { "User-Agent": "RYCS-Enriquecimento/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!retry.ok) return { error: `CNPJ.ws ${retry.status}` };
      return retry.json();
    }
    if (!res.ok) return { error: `CNPJ.ws ${res.status}` };
    return res.json();
  });
}

// Fallback: BrasilAPI
export async function buscarBrasilApi(cnpj) {
  try {
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g, "")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { error: `BrasilAPI ${res.status}` };
    return res.json();
  } catch (e) {
    return { error: e.message };
  }
}


// ── 3. Modelo de estimativa de faturamento / funcionários ──────────────────

const FAIXAS_FATURAMENTO = [
  { porte: "MEI", min: 0, max: 81000, faixa: "Até R$ 81 mil" },
  { porte: "ME", min: 81000, max: 360000, faixa: "R$ 81 mil – R$ 360 mil" },
  { porte: "EPP", min: 360000, max: 4800000, faixa: "R$ 360 mil – R$ 4,8 M" },
  { porte: "DEMAIS_PEQUENO", min: 4800000, max: 30000000, faixa: "R$ 4,8 M – R$ 30 M" },
  { porte: "DEMAIS_MEDIO", min: 30000000, max: 300000000, faixa: "R$ 30 M – R$ 300 M" },
  { porte: "DEMAIS_GRANDE", min: 300000000, max: null, faixa: "Acima de R$ 300 M" },
];

const FAIXAS_FUNCIONARIOS = [
  { min: 0, max: 0, faixa: "Sem funcionários (MEI/autônomo)" },
  { min: 1, max: 5, faixa: "1 – 5" },
  { min: 6, max: 19, faixa: "6 – 19" },
  { min: 20, max: 49, faixa: "20 – 49" },
  { min: 50, max: 99, faixa: "50 – 99" },
  { min: 100, max: 249, faixa: "100 – 249" },
  { min: 250, max: 499, faixa: "250 – 499" },
  { min: 500, max: 999, faixa: "500 – 999" },
  { min: 1000, max: null, faixa: "1.000+" },
];

export function estimarFaturamento({ porte, capitalSocial, simples, mei, qtdFiliais }) {
  if (mei) return { faixa: "Até R$ 81 mil", estimado: 60000 };

  const capital = capitalSocial || 0;
  let baseIdx = 0;

  if (porte === "ME" || porte === "MICRO EMPRESA") baseIdx = 1;
  else if (porte === "EPP" || porte === "EMPRESA DE PEQUENO PORTE") baseIdx = 2;
  else if (porte === "DEMAIS" || porte === "DEMAIS EMPRESAS" || porte === "") {
    if (capital < 500000) baseIdx = 3;
    else if (capital < 10000000) baseIdx = 4;
    else baseIdx = 5;
  }

  if (simples && baseIdx > 2) baseIdx = 2; // Simples tem teto de R$ 4,8M

  const f = FAIXAS_FATURAMENTO[baseIdx];
  const filialBonus = Math.min((qtdFiliais || 0) * 0.1, 1);
  const capitalBonus = capital > 1000000 ? 0.3 : capital > 100000 ? 0.1 : 0;
  const ponto = (f.max || f.min * 3) * (0.5 + filialBonus + capitalBonus);
  const estimado = Math.round(Math.min(ponto, f.max || ponto));

  return { faixa: f.faixa, estimado };
}

export function estimarFuncionarios({ porte, capitalSocial, mei, qtdFiliais }) {
  if (mei) return { faixa: "Sem funcionários (MEI/autônomo)", estimado: 0 };

  const capital = capitalSocial || 0;
  let est = 1;

  if (porte === "ME" || porte === "MICRO EMPRESA") {
    est = capital > 100000 ? 8 : 3;
  } else if (porte === "EPP" || porte === "EMPRESA DE PEQUENO PORTE") {
    est = capital > 500000 ? 35 : 15;
  } else {
    if (capital < 1000000) est = 60;
    else if (capital < 10000000) est = 200;
    else if (capital < 100000000) est = 600;
    else est = 1500;
  }

  est += (qtdFiliais || 0) * 5;
  const faixa = FAIXAS_FUNCIONARIOS.find((f) => est >= f.min && (f.max === null || est <= f.max));
  return { faixa: faixa?.faixa || "Indeterminado", estimado: est };
}


// ── 4. Classificador de decisores (NLP/regex no cargo) ─────────────────────

const DEPARTAMENTOS = {
  "Comercial": /comercial|vendas|sales|business dev|account|closer|sdr|bdr|inside sales|hunter|farmer/i,
  "TI": /ti\b|t\.i\.|tecnologia|developer|desenvolvedor|software|data|devops|infra|cloud|cto|tech|programa/i,
  "Marketing": /marketing|comunica|branding|growth|conteúdo|content|mídia|social media|performance|seo|digital/i,
  "Financeiro": /financ|contab|fiscal|tesourar|controller|cfo|tributár/i,
  "RH": /rh\b|r\.h\.|recursos humanos|people|talent|gente|gestão de pessoas|human resources/i,
  "Jurídico": /juríd|legal|compliance|advogad|direito/i,
  "Operacional": /opera|logíst|supply|cadeia|produção|qualidade|processo|industrial|fábrica/i,
  "Administrativo": /admin|secretár|escritório|office|gerente geral|general manager/i,
  "Gestão": /ceo|presidente|diretor|diret|sócio|fundador|owner|co-founder|cofound|partner|managing/i,
};

const NIVEIS = {
  "Alto": /ceo|cto|cfo|cmo|coo|cio|cpo|chief|presidente|vice.?presidente|vp\b|diretor|director|sócio|fundador|founder|partner|owner|head of|country manager/i,
  "Médio": /gerente|manager|coordenador|coordinator|supervisor|líder|lead\b|team lead|head\b|chefe/i,
  "Baixo": /analista|analyst|especialista|specialist|assistente|assistant|consultor|consultant|estagiári|intern|trainee|técnico|executivo de contas/i,
};

export function classificarCargo(cargo) {
  if (!cargo) return { departamento: "Outros", nivel: "Não classificado" };

  let departamento = "Outros";
  for (const [dept, re] of Object.entries(DEPARTAMENTOS)) {
    if (re.test(cargo)) { departamento = dept; break; }
  }

  let nivel = "Não classificado";
  for (const [niv, re] of Object.entries(NIVEIS)) {
    if (re.test(cargo)) { nivel = niv; break; }
  }

  return { departamento, nivel };
}


// ── 5. Validação de email (SMTP check simples) ────────────────────────────

import { createConnection } from "net";
import { resolveMx } from "dns/promises";

export async function validarEmailSmtp(email) {
  if (!email || !email.includes("@")) return { valido: false, motivo: "formato" };
  const [, dominio] = email.split("@");
  try {
    const mx = await resolveMx(dominio);
    if (!mx.length) return { valido: false, motivo: "sem_mx" };
    mx.sort((a, b) => a.priority - b.priority);

    return new Promise((resolve) => {
      const timer = setTimeout(() => { sock.destroy(); resolve({ valido: null, motivo: "timeout" }); }, 8000);
      const sock = createConnection(25, mx[0].exchange);
      let step = 0, buf = "";

      sock.on("data", (data) => {
        buf += data.toString();
        if (step === 0 && buf.includes("220")) {
          step++;
          sock.write(`EHLO rycs.pro\r\n`);
          buf = "";
        } else if (step === 1 && buf.includes("250")) {
          step++;
          sock.write(`MAIL FROM:<verificacao@rycs.pro>\r\n`);
          buf = "";
        } else if (step === 2 && buf.includes("250")) {
          step++;
          sock.write(`RCPT TO:<${email}>\r\n`);
          buf = "";
        } else if (step === 3) {
          const valido = buf.includes("250");
          sock.write("QUIT\r\n");
          sock.destroy();
          clearTimeout(timer);
          resolve({ valido, motivo: valido ? "aceito" : "rejeitado" });
        }
      });
      sock.on("error", () => { clearTimeout(timer); resolve({ valido: null, motivo: "conexao_falhou" }); });
    });
  } catch {
    return { valido: false, motivo: "dns_falhou" };
  }
}


// ── 6. Validação de telefone (stub — ativar com HLR provider) ────────────

const HLR_API_KEY = process.env.HLR_API_KEY || "";

export async function validarTelefone(telefone) {
  if (!telefone) return { valido: null, motivo: "vazio" };
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return { valido: false, motivo: "curto" };

  if (!HLR_API_KEY) {
    // Sem HLR, valida formato básico (DDD + 9 dígitos para celular)
    const celular = digits.length === 11 && digits[2] === "9";
    const fixo = digits.length === 10;
    return { valido: celular || fixo ? null : false, motivo: celular || fixo ? "formato_ok" : "formato_invalido" };
  }

  // Com HLR provider (Numverify, Twilio, etc.)
  try {
    const url = `https://apilayer.net/api/validate?access_key=${HLR_API_KEY}&number=${digits}&country_code=BR`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return {
      valido: data.valid === true,
      motivo: data.valid ? "hlr_ativo" : "hlr_inativo",
      operadora: data.carrier || "",
      tipo: data.line_type || "",
    };
  } catch {
    return { valido: null, motivo: "hlr_falhou" };
  }
}


// ── 7. Hunter.io (opcional, 50 créditos/mês grátis) ───────────────────────

const HUNTER_KEY = process.env.HUNTER_API_KEY || "";

export async function buscarHunter(dominio) {
  if (!HUNTER_KEY || !dominio) return null;
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(dominio)}&api_key=${HUNTER_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || null;
  } catch {
    return null;
  }
}

export async function buscarEmailHunter(dominio, nome) {
  if (!HUNTER_KEY || !dominio || !nome) return null;
  try {
    const [primeiro, ...resto] = nome.trim().split(/\s+/);
    const ultimo = resto.pop() || "";
    const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(dominio)}&first_name=${encodeURIComponent(primeiro)}&last_name=${encodeURIComponent(ultimo)}&api_key=${HUNTER_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || null;
  } catch {
    return null;
  }
}


// ── 8. Pipeline principal de enriquecimento ────────────────────────────────

function normalizarCnpjWs(data) {
  if (!data || data.error) return null;
  const est = data.estabelecimento || {};
  const simples = data.simples || {};

  const socios = (data.socios || []).map((s) => ({
    nome: s.nome || "",
    qualificacao: s.qualificacao_socio?.descricao || "",
    cpfParcial: s.cpf_representante_legal || "",
    dataEntrada: s.data_entrada || "",
    faixaEtaria: s.faixa_etaria || "",
  }));

  const cnaesSecundarios = (est.atividades_secundarias || []).map((a) => ({
    cnae: a.id || "",
    desc: a.descricao || "",
  }));

  const telefones = [];
  if (est.ddd1 && est.telefone1) telefones.push(`(${est.ddd1}) ${est.telefone1}`);
  if (est.ddd2 && est.telefone2) telefones.push(`(${est.ddd2}) ${est.telefone2}`);

  return {
    cnpj: est.cnpj || data.cnpj_raiz || "",
    razaoSocial: data.razao_social || "",
    nomeFantasia: est.nome_fantasia || "",
    uf: est.estado?.sigla || "",
    cidade: est.cidade?.nome || "",
    bairro: est.bairro || "",
    cep: est.cep || "",
    logradouro: `${est.tipo_logradouro || ""} ${est.logradouro || ""}`.trim(),
    numero: est.numero || "",
    complemento: est.complemento || "",
    capitalSocial: data.capital_social || 0,
    porte: data.porte?.descricao || "",
    naturezaJuridica: data.natureza_juridica?.id || "",
    naturezaJuridicaDesc: data.natureza_juridica?.descricao || "",
    situacaoCadastral: est.situacao_cadastral || "",
    dataSituacao: est.data_situacao_cadastral || "",
    simplesNacional: simples.simples === "Sim" ? 1 : 0,
    mei: simples.mei === "Sim" ? 1 : 0,
    dataAbertura: est.data_inicio_atividade || "",
    qtdFiliais: 0, // CNPJ.ws não devolve, calcular depois
    cnaePrimario: est.atividade_principal?.id || "",
    cnaePrimarioDesc: est.atividade_principal?.descricao || "",
    cnaesSecundarios: JSON.stringify(cnaesSecundarios),
    inscricaoEstadual: est.inscricoes_estaduais?.[0]?.inscricao_estadual || "",
    telefonesRF: JSON.stringify(telefones),
    emailRF: est.email || "",
    socios,
  };
}

function calcularIdade(dataAbertura) {
  if (!dataAbertura) return "";
  const [ano, mes, dia] = dataAbertura.split("-").map(Number);
  if (!ano) return "";
  const hoje = new Date();
  let anos = hoje.getFullYear() - ano;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) anos--;
  if (anos <= 0) return "Menos de 1 ano";
  return `${anos} ano${anos > 1 ? "s" : ""}`;
}

export async function enriquecerContato(contatoId, entityId) {
  const contato = db.prepare("SELECT * FROM loja_leads_contatos WHERE id = ?").get(contatoId);
  if (!contato) return { error: "Contato não encontrado." };

  const ts = agora();
  const logs = [];
  const log = (provider, status, detalhes) => {
    logs.push({ provider, status, detalhes });
    db.prepare("INSERT INTO enriq_log (id, contatoId, provider, status, detalhes, criadoEm) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uid(), contatoId, provider, status, detalhes, ts);
  };

  // Já enriquecido recentemente? (menos de 30 dias)
  const existente = db.prepare("SELECT * FROM enriq_empresas WHERE contatoId = ?").get(contatoId);
  if (existente && existente.enriquecidoEm && (ts - existente.enriquecidoEm) < 30 * 24 * 3600 * 1000) {
    return { empresa: existente, jaEnriquecido: true };
  }

  // 1) Extrair CNPJ do site
  let cnpj = existente?.cnpj || null;
  if (!cnpj && contato.site) {
    cnpj = await extrairCnpjDoSite(contato.site);
    log("scraping_cnpj", cnpj ? "ok" : "nao_encontrado", cnpj || contato.site);
  }

  // 2) Buscar dados da Receita (CNPJ.ws com fallback BrasilAPI)
  let dadosRF = null;
  if (cnpj) {
    const ws = await buscarCnpjWs(cnpj);
    if (ws && !ws.error) {
      dadosRF = normalizarCnpjWs(ws);
      log("cnpjws", "ok", cnpj);
    } else {
      log("cnpjws", "erro", ws?.error || "sem resposta");
      const br = await buscarBrasilApi(cnpj);
      if (br && !br.error) {
        dadosRF = normalizarBrasilApi(br);
        log("brasilapi", "ok", cnpj);
      } else {
        log("brasilapi", "erro", br?.error || "sem resposta");
      }
    }
  }

  // 3) Estimar faturamento e funcionários
  let faturamento = { faixa: "", estimado: null };
  let funcionarios = { faixa: "", estimado: null };
  if (dadosRF) {
    faturamento = estimarFaturamento({
      porte: dadosRF.porte,
      capitalSocial: dadosRF.capitalSocial,
      simples: dadosRF.simplesNacional,
      mei: dadosRF.mei,
      qtdFiliais: dadosRF.qtdFiliais,
    });
    funcionarios = estimarFuncionarios({
      porte: dadosRF.porte,
      capitalSocial: dadosRF.capitalSocial,
      mei: dadosRF.mei,
      qtdFiliais: dadosRF.qtdFiliais,
    });
  }

  // 4) Hunter.io (emails + firmographics do domínio)
  let hunterData = null;
  const dominio = extrairDominio(contato.site);
  if (dominio) {
    hunterData = await buscarHunter(dominio);
    log("hunter", hunterData ? "ok" : "skip", dominio);
  }

  // 5) Validar email da Receita
  let emailStatus = "";
  if (dadosRF?.emailRF) {
    const v = await validarEmailSmtp(dadosRF.emailRF);
    emailStatus = v.valido === true ? "valido" : v.valido === false ? "invalido" : "inconclusivo";
    log("smtp_email", emailStatus, dadosRF.emailRF);
  }

  // 6) Validar telefones
  const telsValidados = [];
  const telsInvalidos = [];
  const telsRF = dadosRF?.telefonesRF ? JSON.parse(dadosRF.telefonesRF) : [];
  const todosTels = [...new Set([contato.telefone, ...telsRF].filter(Boolean))];
  for (const tel of todosTels.slice(0, 5)) {
    const v = await validarTelefone(tel);
    if (v.valido === true) telsValidados.push(tel);
    else if (v.valido === false) telsInvalidos.push(tel);
    else telsValidados.push(tel); // inconclusivo = mantém
  }

  // 7) Montar redes sociais do Hunter
  const redes = {
    linkedin: hunterData?.linkedin || "",
    facebook: hunterData?.facebook || "",
    instagram: hunterData?.instagram || "",
    twitter: hunterData?.twitter || "",
  };
  const tecnologias = hunterData?.technologies || [];

  // 8) Salvar empresa enriquecida
  const empresaId = existente?.id || uid();
  const empresa = {
    id: empresaId,
    contatoId,
    cnpj: cnpj || "",
    razaoSocial: dadosRF?.razaoSocial || "",
    nomeFantasia: dadosRF?.nomeFantasia || "",
    uf: dadosRF?.uf || "",
    cidade: dadosRF?.cidade || contato.cidade || "",
    bairro: dadosRF?.bairro || "",
    cep: dadosRF?.cep || "",
    logradouro: dadosRF?.logradouro || "",
    numero: dadosRF?.numero || "",
    complemento: dadosRF?.complemento || "",
    capitalSocial: dadosRF?.capitalSocial || null,
    porte: dadosRF?.porte || "",
    naturezaJuridica: dadosRF?.naturezaJuridica || "",
    naturezaJuridicaDesc: dadosRF?.naturezaJuridicaDesc || "",
    situacaoCadastral: dadosRF?.situacaoCadastral || "",
    dataSituacao: dadosRF?.dataSituacao || "",
    simplesNacional: dadosRF?.simplesNacional ?? null,
    mei: dadosRF?.mei ?? null,
    dataAbertura: dadosRF?.dataAbertura || "",
    idadeEmpresa: calcularIdade(dadosRF?.dataAbertura),
    qtdFiliais: dadosRF?.qtdFiliais || 0,
    cnaePrimario: dadosRF?.cnaePrimario || "",
    cnaePrimarioDesc: dadosRF?.cnaePrimarioDesc || "",
    cnaesSecundarios: dadosRF?.cnaesSecundarios || "[]",
    inscricaoEstadual: dadosRF?.inscricaoEstadual || "",
    faixaFaturamento: faturamento.faixa,
    faixaFuncionarios: funcionarios.faixa,
    faturamentoEstimado: faturamento.estimado,
    funcionariosEstimado: funcionarios.estimado,
    telefonesRF: dadosRF?.telefonesRF || "[]",
    emailRF: dadosRF?.emailRF || "",
    telefonesValidados: JSON.stringify(telsValidados),
    telefonesInvalidos: JSON.stringify(telsInvalidos),
    emailsValidados: JSON.stringify(emailStatus === "valido" ? [dadosRF.emailRF] : []),
    emailsInvalidos: JSON.stringify(emailStatus === "invalido" ? [dadosRF?.emailRF] : []),
    linkedinEmpresa: redes.linkedin,
    facebookEmpresa: redes.facebook,
    instagramEmpresa: redes.instagram,
    twitterEmpresa: redes.twitter,
    tecnologias: JSON.stringify(tecnologias),
    pibMunicipio: null,
    populacaoMunicipio: null,
    fonte: [cnpj ? "cnpjws" : "", hunterData ? "hunter" : ""].filter(Boolean).join(","),
    enriquecidoEm: ts,
    atualizadoEm: ts,
    status: cnpj ? "enriquecido" : "parcial",
  };

  if (existente) {
    db.prepare(`UPDATE enriq_empresas SET
      cnpj=?, razaoSocial=?, nomeFantasia=?, uf=?, cidade=?, bairro=?, cep=?,
      logradouro=?, numero=?, complemento=?, capitalSocial=?, porte=?,
      naturezaJuridica=?, naturezaJuridicaDesc=?, situacaoCadastral=?, dataSituacao=?,
      simplesNacional=?, mei=?, dataAbertura=?, idadeEmpresa=?, qtdFiliais=?,
      cnaePrimario=?, cnaePrimarioDesc=?, cnaesSecundarios=?, inscricaoEstadual=?,
      faixaFaturamento=?, faixaFuncionarios=?, faturamentoEstimado=?, funcionariosEstimado=?,
      telefonesRF=?, emailRF=?, telefonesValidados=?, telefonesInvalidos=?,
      emailsValidados=?, emailsInvalidos=?,
      linkedinEmpresa=?, facebookEmpresa=?, instagramEmpresa=?, twitterEmpresa=?,
      tecnologias=?, fonte=?, enriquecidoEm=?, atualizadoEm=?, status=?
      WHERE id=?`).run(
      empresa.cnpj, empresa.razaoSocial, empresa.nomeFantasia, empresa.uf, empresa.cidade,
      empresa.bairro, empresa.cep, empresa.logradouro, empresa.numero, empresa.complemento,
      empresa.capitalSocial, empresa.porte, empresa.naturezaJuridica, empresa.naturezaJuridicaDesc,
      empresa.situacaoCadastral, empresa.dataSituacao, empresa.simplesNacional, empresa.mei,
      empresa.dataAbertura, empresa.idadeEmpresa, empresa.qtdFiliais,
      empresa.cnaePrimario, empresa.cnaePrimarioDesc, empresa.cnaesSecundarios, empresa.inscricaoEstadual,
      empresa.faixaFaturamento, empresa.faixaFuncionarios, empresa.faturamentoEstimado, empresa.funcionariosEstimado,
      empresa.telefonesRF, empresa.emailRF, empresa.telefonesValidados, empresa.telefonesInvalidos,
      empresa.emailsValidados, empresa.emailsInvalidos,
      empresa.linkedinEmpresa, empresa.facebookEmpresa, empresa.instagramEmpresa, empresa.twitterEmpresa,
      empresa.tecnologias, empresa.fonte, empresa.enriquecidoEm, empresa.atualizadoEm, empresa.status,
      empresaId
    );
  } else {
    db.prepare(`INSERT INTO enriq_empresas (
      id, contatoId, cnpj, razaoSocial, nomeFantasia, uf, cidade, bairro, cep,
      logradouro, numero, complemento, capitalSocial, porte,
      naturezaJuridica, naturezaJuridicaDesc, situacaoCadastral, dataSituacao,
      simplesNacional, mei, dataAbertura, idadeEmpresa, qtdFiliais,
      cnaePrimario, cnaePrimarioDesc, cnaesSecundarios, inscricaoEstadual,
      faixaFaturamento, faixaFuncionarios, faturamentoEstimado, funcionariosEstimado,
      telefonesRF, emailRF, telefonesValidados, telefonesInvalidos,
      emailsValidados, emailsInvalidos,
      linkedinEmpresa, facebookEmpresa, instagramEmpresa, twitterEmpresa,
      tecnologias, fonte, enriquecidoEm, atualizadoEm, status
    ) VALUES (${Array(45).fill("?").join(",")})`).run(
      empresa.id, empresa.contatoId, empresa.cnpj, empresa.razaoSocial, empresa.nomeFantasia,
      empresa.uf, empresa.cidade, empresa.bairro, empresa.cep, empresa.logradouro, empresa.numero,
      empresa.complemento, empresa.capitalSocial, empresa.porte, empresa.naturezaJuridica,
      empresa.naturezaJuridicaDesc, empresa.situacaoCadastral, empresa.dataSituacao,
      empresa.simplesNacional, empresa.mei, empresa.dataAbertura, empresa.idadeEmpresa, empresa.qtdFiliais,
      empresa.cnaePrimario, empresa.cnaePrimarioDesc, empresa.cnaesSecundarios, empresa.inscricaoEstadual,
      empresa.faixaFaturamento, empresa.faixaFuncionarios, empresa.faturamentoEstimado, empresa.funcionariosEstimado,
      empresa.telefonesRF, empresa.emailRF, empresa.telefonesValidados, empresa.telefonesInvalidos,
      empresa.emailsValidados, empresa.emailsInvalidos,
      empresa.linkedinEmpresa, empresa.facebookEmpresa, empresa.instagramEmpresa, empresa.twitterEmpresa,
      empresa.tecnologias, empresa.fonte, empresa.enriquecidoEm, empresa.atualizadoEm, empresa.status
    );
  }

  // 9) Salvar sócios
  if (dadosRF?.socios?.length) {
    db.prepare("DELETE FROM enriq_socios WHERE empresaId = ?").run(empresaId);
    const ins = db.prepare("INSERT INTO enriq_socios (id, empresaId, nome, qualificacao, cpfParcial, dataEntrada, faixaEtaria) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const s of dadosRF.socios) {
      ins.run(uid(), empresaId, s.nome, s.qualificacao, s.cpfParcial, s.dataEntrada, s.faixaEtaria);
    }
  }

  // 10) Classificar sócios como decisores
  if (dadosRF?.socios?.length) {
    db.prepare("DELETE FROM enriq_decisores WHERE empresaId = ? AND fonte = 'qsa'").run(empresaId);
    const ins = db.prepare("INSERT INTO enriq_decisores (id, empresaId, contatoId, nome, cargo, departamento, nivel, fonte, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, 'qsa', ?)");
    for (const s of dadosRF.socios) {
      const { departamento, nivel } = classificarCargo(s.qualificacao);
      ins.run(uid(), empresaId, contatoId, s.nome, s.qualificacao, departamento, nivel, ts);
    }
  }

  // 11) Decisores do Hunter (se disponível)
  if (hunterData?.emails?.length) {
    db.prepare("DELETE FROM enriq_decisores WHERE empresaId = ? AND fonte = 'hunter'").run(empresaId);
    const ins = db.prepare("INSERT INTO enriq_decisores (id, empresaId, contatoId, nome, cargo, departamento, nivel, emailProfissional, emailStatus, linkedinUrl, fonte, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hunter', ?)");
    for (const e of hunterData.emails.slice(0, 20)) {
      const nome = `${e.first_name || ""} ${e.last_name || ""}`.trim();
      if (!nome) continue;
      const { departamento, nivel } = classificarCargo(e.position || "");
      ins.run(uid(), empresaId, contatoId, nome, e.position || "", departamento, nivel, e.value || "", e.verification?.status || "", e.linkedin || "", ts);
    }
  }

  return { empresa, socios: dadosRF?.socios || [], decisores: listarDecisores(empresaId), logs };
}


// ── Consultas ──────────────────────────────────────────────────────────────

export function obterEnriquecimento(contatoId) {
  const empresa = db.prepare("SELECT * FROM enriq_empresas WHERE contatoId = ?").get(contatoId);
  if (!empresa) return null;
  empresa.socios = db.prepare("SELECT * FROM enriq_socios WHERE empresaId = ? ORDER BY dataEntrada").all(empresa.id);
  empresa.decisores = listarDecisores(empresa.id);
  empresa.hierarquia = db.prepare("SELECT * FROM enriq_hierarquia WHERE empresaId = ?").all(empresa.id);
  return empresa;
}

function listarDecisores(empresaId) {
  return db.prepare("SELECT * FROM enriq_decisores WHERE empresaId = ? ORDER BY nivel, nome").all(empresaId);
}

export function obterLogEnriquecimento(contatoId) {
  return db.prepare("SELECT * FROM enriq_log WHERE contatoId = ? ORDER BY criadoEm DESC LIMIT 50").all(contatoId);
}

export function estatisticasEnriquecimento() {
  const total = db.prepare("SELECT COUNT(*) n FROM enriq_empresas").get().n;
  const enriquecidos = db.prepare("SELECT COUNT(*) n FROM enriq_empresas WHERE status = 'enriquecido'").get().n;
  const parciais = db.prepare("SELECT COUNT(*) n FROM enriq_empresas WHERE status = 'parcial'").get().n;
  const pendentes = db.prepare("SELECT COUNT(*) n FROM enriq_empresas WHERE status = 'pendente'").get().n;
  const totalDecisores = db.prepare("SELECT COUNT(*) n FROM enriq_decisores").get().n;
  const totalSocios = db.prepare("SELECT COUNT(*) n FROM enriq_socios").get().n;
  return { total, enriquecidos, parciais, pendentes, totalDecisores, totalSocios };
}


// ── Enriquecimento em lote ─────────────────────────────────────────────────

export async function enriquecerLote(contatoIds, entityId) {
  const resultados = [];
  for (const id of contatoIds) {
    try {
      const r = await enriquecerContato(id, entityId);
      resultados.push({ contatoId: id, status: r.error ? "erro" : "ok", error: r.error });
    } catch (e) {
      resultados.push({ contatoId: id, status: "erro", error: e.message });
    }
  }
  return resultados;
}


// ── Helpers ────────────────────────────────────────────────────────────────

function extrairDominio(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizarBrasilApi(data) {
  if (!data) return null;
  const socios = (data.qsa || []).map((s) => ({
    nome: s.nome_socio || "",
    qualificacao: s.qualificacao_socio || "",
    cpfParcial: s.cnpj_cpf_do_socio || "",
    dataEntrada: s.data_entrada_sociedade || "",
    faixaEtaria: s.faixa_etaria || "",
  }));

  const cnaesSecundarios = (data.cnaes_secundarios || data.cnaes_secundarias || []).map((a) => ({
    cnae: String(a.codigo || ""),
    desc: a.descricao || "",
  }));

  const telefones = [];
  if (data.ddd_telefone_1) telefones.push(data.ddd_telefone_1);
  if (data.ddd_telefone_2) telefones.push(data.ddd_telefone_2);

  return {
    cnpj: data.cnpj || "",
    razaoSocial: data.razao_social || "",
    nomeFantasia: data.nome_fantasia || "",
    uf: data.uf || "",
    cidade: data.municipio || "",
    bairro: data.bairro || "",
    cep: data.cep || "",
    logradouro: `${data.descricao_tipo_de_logradouro || ""} ${data.logradouro || ""}`.trim(),
    numero: data.numero || "",
    complemento: data.complemento || "",
    capitalSocial: data.capital_social || 0,
    porte: data.porte || data.descricao_porte || "",
    naturezaJuridica: String(data.codigo_natureza_juridica || ""),
    naturezaJuridicaDesc: data.natureza_juridica || "",
    situacaoCadastral: data.descricao_situacao_cadastral || "",
    dataSituacao: data.data_situacao_cadastral || "",
    simplesNacional: data.opcao_pelo_simples ? 1 : 0,
    mei: data.opcao_pelo_mei ? 1 : 0,
    dataAbertura: data.data_inicio_atividade || "",
    qtdFiliais: 0,
    cnaePrimario: String(data.cnae_fiscal || ""),
    cnaePrimarioDesc: data.cnae_fiscal_descricao || "",
    cnaesSecundarios: JSON.stringify(cnaesSecundarios),
    inscricaoEstadual: "",
    telefonesRF: JSON.stringify(telefones),
    emailRF: data.email || "",
    socios,
  };
}
