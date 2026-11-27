import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { URL } from "url";
import https from "https";
import http from "http";

const router = Router();

const soEmpresa = (req, res) => {
  if (req.user?.role !== "empresa" || !req.user?.entityId) {
    res.status(403).json({ error: "Apenas empresas" });
    return null;
  }
  return req.user.entityId;
};

const j = (v, d) => { try { return JSON.parse(v || ""); } catch { return d; } };

const serializar = (row) => {
  if (!row) return null;
  return {
    ...row,
    segmentos: j(row.segmentos, []),
    modelosNegocio: j(row.modelosNegocio, []),
    abrangencias: j(row.abrangencias, []),
    abrangenciaDetalhes: j(row.abrangenciaDetalhes, {}),
    modelosAtendimento: j(row.modelosAtendimento, []),
    produtosVinculados: j(row.produtosVinculados, []),
    modelosReceita: j(row.modelosReceita, []),
    tiposCliente: j(row.tiposCliente, []),
    necessidades: j(row.necessidades, []),
    processoVenda: j(row.processoVenda, []),
    diferenciais: j(row.diferenciais, []),
    reconhecimento: j(row.reconhecimento, []),
    tomComunicacao: j(row.tomComunicacao, []),
    valores: j(row.valores, []),
    objetivos: j(row.objetivos, []),
    conteudoGerado: j(row.conteudoGerado, {}),
  };
};

// Campos JSON — arrays
const CAMPOS_ARRAY = ["segmentos","modelosNegocio","abrangencias","modelosAtendimento","produtosVinculados","modelosReceita","tiposCliente","necessidades","processoVenda","diferenciais","reconhecimento","tomComunicacao","valores","objetivos"];
// Campos JSON — objetos
const CAMPOS_OBJ = ["abrangenciaDetalhes","conteudoGerado"];
// Campos texto simples
const CAMPOS_TEXTO = ["segmentoCustom","porte","tempoMercado","cicloVenda","infoComplementar"];

// GET /company-identity
router.get("/company-identity", (req, res) => {
  const companyId = soEmpresa(req, res); if (!companyId) return;
  const row = db.prepare("SELECT * FROM company_identity WHERE companyId = ?").get(companyId);
  res.json({ identity: serializar(row) });
});

// PUT /company-identity — upsert
router.put("/company-identity", (req, res) => {
  const companyId = soEmpresa(req, res); if (!companyId) return;
  const existing = db.prepare("SELECT id FROM company_identity WHERE companyId = ?").get(companyId);
  const ts = agora();
  const body = req.body || {};

  if (!existing) {
    const id = uid();
    const cols = ["id","companyId","criadoEm","atualizadoEm"];
    const vals = [id, companyId, ts, ts];
    for (const k of CAMPOS_ARRAY) { cols.push(k); vals.push(JSON.stringify(Array.isArray(body[k]) ? body[k] : [])); }
    for (const k of CAMPOS_OBJ) { cols.push(k); vals.push(JSON.stringify((body[k] && typeof body[k] === "object") ? body[k] : {})); }
    for (const k of CAMPOS_TEXTO) { cols.push(k); vals.push(String(body[k] ?? "")); }
    db.prepare(`INSERT INTO company_identity (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...vals);
    return res.json({ identity: serializar(db.prepare("SELECT * FROM company_identity WHERE companyId = ?").get(companyId)) });
  }

  const sets = [], sqlVals = [];
  for (const k of CAMPOS_ARRAY) if (k in body) { sets.push(`${k} = ?`); sqlVals.push(JSON.stringify(Array.isArray(body[k]) ? body[k] : [])); }
  for (const k of CAMPOS_OBJ) if (k in body) { sets.push(`${k} = ?`); sqlVals.push(JSON.stringify((body[k] && typeof body[k] === "object") ? body[k] : {})); }
  for (const k of CAMPOS_TEXTO) if (k in body) { sets.push(`${k} = ?`); sqlVals.push(String(body[k] ?? "")); }
  if (!sets.length) return res.json({ identity: serializar(db.prepare("SELECT * FROM company_identity WHERE companyId = ?").get(companyId)) });
  sets.push("atualizadoEm = ?"); sqlVals.push(ts, companyId);
  db.prepare(`UPDATE company_identity SET ${sets.join(", ")} WHERE companyId = ?`).run(...sqlVals);
  res.json({ identity: serializar(db.prepare("SELECT * FROM company_identity WHERE companyId = ?").get(companyId)) });
});

// Calcula completude da identidade estruturada (0–100)
router.get("/company-identity/completude", (req, res) => {
  const companyId = soEmpresa(req, res); if (!companyId) return;
  const row = db.prepare("SELECT * FROM company_identity WHERE companyId = ?").get(companyId);
  if (!row) return res.json({ pct: 0 });
  const r = serializar(row);
  const checks = [
    r.segmentos.length > 0,
    r.modelosNegocio.length > 0,
    !!r.porte,
    !!r.tempoMercado,
    r.abrangencias.length > 0,
    r.modelosAtendimento.length > 0,
    r.produtosVinculados.length > 0,
    r.modelosReceita.length > 0,
    r.tiposCliente.length > 0,
    r.necessidades.length > 0,
    r.processoVenda.length > 0,
    !!r.cicloVenda,
    r.diferenciais.length > 0,
    r.tomComunicacao.length > 0,
    r.valores.length > 0,
    r.objetivos.length > 0,
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  res.json({ pct });
});

// POST /company-identity/gerar-conteudo — gera blocos institucionais com IA
router.post("/company-identity/gerar-conteudo", async (req, res) => {
  const companyId = soEmpresa(req, res); if (!companyId) return;

  const identity = serializar(db.prepare("SELECT * FROM company_identity WHERE companyId = ?").get(companyId));
  const company = db.prepare("SELECT nome, ticket FROM companies WHERE id = ?").get(companyId);
  if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

  // Produtos vinculados — busca detalhes no catálogo
  const produtos = (identity?.produtosVinculados || []).map((id) => {
    const p = db.prepare("SELECT nome, preco FROM erp_produtos WHERE externoId = ? AND companyId = ?").get(id, companyId);
    return p || { nome: id };
  }).filter(Boolean);

  const nome = company.nome || "nossa empresa";
  const segm = (identity?.segmentos || []).join(", ") || "não informado";
  const modelos = (identity?.modelosNegocio || []).join(", ");
  const porte = identity?.porte || "";
  const tempo = identity?.tempoMercado || "";
  const abr = (identity?.abrangencias || []).join(", ");
  const atend = (identity?.modelosAtendimento || []).join(", ");
  const clientes = (identity?.tiposCliente || []).join(", ");
  const nec = (identity?.necessidades || []).join(", ");
  const proc = (identity?.processoVenda || []).join(", ");
  const ciclo = identity?.cicloVenda || "";
  const dif = (identity?.diferenciais || []).join(", ");
  const rec = (identity?.reconhecimento || []).join(", ");
  const tom = (identity?.tomComunicacao || []).join(", ");
  const vals = (identity?.valores || []).join(", ");
  const obj = (identity?.objetivos || []).join(", ");
  const info = identity?.infoComplementar || "";
  const listaProdutos = produtos.map((p) => `- ${p.nome}${p.descricao ? `: ${p.descricao}` : ""}${p.preco ? ` (${p.moeda || "BRL"} ${p.preco})` : ""}`).join("\n");

  const temIA = !!process.env.ANTHROPIC_API_KEY;

  let blocos;

  if (temIA) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const prompt = `Você é redator institucional. Gere conteúdo profissional para a empresa "${nome}" com base nos dados abaixo.

DADOS DA EMPRESA:
- Segmento: ${segm}
- Modelo de negócio: ${modelos}
- Porte: ${porte}
- Tempo de mercado: ${tempo}
- Abrangência: ${abr}
- Atendimento: ${atend}
- Clientes: ${clientes}
- Necessidades atendidas: ${nec}
- Processo de venda: ${proc}
- Ciclo de venda: ${ciclo}
- Diferenciais: ${dif}
- Como quer ser reconhecida: ${rec}
- Tom de comunicação: ${tom}
- Valores: ${vals}
- Objetivos: ${obj}
- Informações complementares: ${info}
${listaProdutos ? `\nPRODUTOS/SERVIÇOS:\n${listaProdutos}` : ""}

REGRAS ABSOLUTAS:
- Não invente anos de experiência, quantidade de clientes, faturamento, prêmios, certificações ou parcerias que não foram informados.
- Quando uma informação não foi fornecida, omita-a. Nunca complete com suposições.
- Missão e visão são SUGESTÕES (indique isso no texto).
- Use tom ${tom || "profissional"}.
- Escreva em português do Brasil.

Retorne SOMENTE um JSON válido com esta estrutura (sem markdown, sem comentários):
{
  "apresentacao": "Texto de apresentação da empresa (2-4 frases)",
  "oQueFaz": "O que a empresa faz — produtos, serviços e soluções (2-4 frases)",
  "publicoAlvo": "Descrição dos clientes e necessidades atendidas (2-3 frases)",
  "diferenciais": "Diferenciais competitivos (2-4 frases)",
  "posicionamento": "Como a empresa deseja ser percebida (2-3 frases)",
  "propostaDeValor": "Benefícios e necessidades atendidas (2-3 frases)",
  "missaoVisao": "Sugestão de missão e visão — SUGESTÃO PENDENTE DE APROVAÇÃO (3-5 frases)",
  "identidadeComunicacao": "Tom de voz, estilo e características da marca (2-3 frases)"
}`;

      const msg = await client.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const texto = msg.content?.[0]?.text || "{}";
      const limpo = texto.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      blocos = JSON.parse(limpo);
    } catch (e) {
      blocos = gerarTemplate({ nome, segm, modelos, porte, tempo, abr, atend, clientes, nec, dif, rec, tom, vals, obj, info, listaProdutos });
    }
  } else {
    blocos = gerarTemplate({ nome, segm, modelos, porte, tempo, abr, atend, clientes, nec, dif, rec, tom, vals, obj, info, listaProdutos });
  }

  // Salva no conteudoGerado da identity
  const ts = agora();
  const existing = db.prepare("SELECT id FROM company_identity WHERE companyId = ?").get(companyId);
  if (existing) {
    db.prepare("UPDATE company_identity SET conteudoGerado = ?, atualizadoEm = ? WHERE companyId = ?")
      .run(JSON.stringify(blocos), ts, companyId);
  } else {
    db.prepare("INSERT INTO company_identity (id,companyId,conteudoGerado,criadoEm,atualizadoEm) VALUES (?,?,?,?,?)")
      .run(uid(), companyId, JSON.stringify(blocos), ts, ts);
  }

  // Atualiza ou cria entradas na company_info_entries para manter compatibilidade
  const MAPA = {
    apresentacao: "Apresentação da empresa",
    oQueFaz: "O que a empresa faz",
    publicoAlvo: "Perfil do público-alvo",
    diferenciais: "Diferenciais competitivos",
    posicionamento: "Posicionamento de mercado",
    propostaDeValor: "Proposta de valor",
    missaoVisao: "Missão, visão e valores",
    identidadeComunicacao: "Identidade e comunicação",
  };
  for (const [chave, titulo] of Object.entries(MAPA)) {
    if (!blocos[chave]) continue;
    const existente = db.prepare("SELECT id FROM company_info_entries WHERE companyId = ? AND secao = 'sobre' AND titulo = ?").get(companyId, titulo);
    if (existente) {
      db.prepare("UPDATE company_info_entries SET conteudo = ?, status = 'rascunho', atualizadoEm = ? WHERE id = ?")
        .run(blocos[chave], ts, existente.id);
    } else {
      const maxOrdem = db.prepare("SELECT COALESCE(MAX(ordem),-1)+1 m FROM company_info_entries WHERE companyId = ? AND secao = 'sobre'").get(companyId);
      db.prepare("INSERT INTO company_info_entries (id,companyId,secao,tipo,titulo,conteudo,dados,anexos,ordem,status,criadoEm,atualizadoEm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(uid(), companyId, "sobre", "bloco", titulo, blocos[chave], "{}", "[]", maxOrdem.m, "rascunho", ts, ts);
    }
  }

  res.json({ ok: true, blocos });
});

// Gerador de conteúdo por template (sem IA)
function gerarTemplate({ nome, segm, modelos, porte, tempo, abr, atend, clientes, nec, dif, rec, tom, vals, obj }) {
  const temProdutos = clientes || nec;
  return {
    apresentacao: [
      nome ? `${nome} é uma empresa` : "Somos uma empresa",
      segm ? ` do segmento de ${segm}` : "",
      porte ? `, de porte ${porte.toLowerCase()}` : "",
      tempo ? `, com ${tempo.toLowerCase()} de mercado` : "",
      abr ? `. Atua ${abr.toLowerCase()}` : "",
      ".",
    ].join("").replace(/\. \./g, "."),
    oQueFaz: temProdutos
      ? `A empresa oferece soluções voltadas para ${clientes || "seus clientes"}${nec ? `, focando em ${nec.toLowerCase()}` : ""}${atend ? `. O atendimento é realizado de forma ${atend.toLowerCase()}` : ""}.`
      : "Descrição dos produtos e serviços será gerada após o preenchimento das informações.",
    publicoAlvo: clientes
      ? `Os principais clientes atendidos são ${clientes.toLowerCase()}${nec ? `, com necessidades de ${nec.toLowerCase()}` : ""}.`
      : "Preencha o campo de público-alvo para gerar esta descrição.",
    diferenciais: dif
      ? `Os principais diferenciais competitivos incluem: ${dif.toLowerCase()}.`
      : "Selecione os diferenciais para gerar esta descrição.",
    posicionamento: rec
      ? `A empresa busca ser reconhecida como ${rec.toLowerCase()}${tom ? `, comunicando-se de forma ${tom.toLowerCase()}` : ""}.`
      : "Selecione o posicionamento desejado para gerar esta descrição.",
    propostaDeValor: nec
      ? `${nome || "A empresa"} ajuda seus clientes a ${nec.toLowerCase()}${dif ? `, com destaque para ${dif.toLowerCase()}` : ""}.`
      : "Preencha as necessidades atendidas para gerar a proposta de valor.",
    missaoVisao: [
      "SUGESTÃO PENDENTE DE APROVAÇÃO. ",
      `Missão: Oferecer soluções${segm ? ` no segmento de ${segm}` : ""} que ${nec ? nec.toLowerCase() : "atendam às necessidades dos clientes"}.`,
      vals ? ` Valores: ${vals}.` : "",
      obj ? ` Visão: ${obj.split(",")[0]}.` : "",
    ].join(""),
    identidadeComunicacao: tom
      ? `A comunicação da empresa é ${tom.toLowerCase()}${vals ? `, orientada pelos valores de ${vals.toLowerCase()}` : ""}.`
      : "Selecione o tom de comunicação para gerar esta descrição.",
  };
}

// POST /company-identity/analisar-site — extrai informações do site (proteção SSRF)
router.post("/company-identity/analisar-site", async (req, res) => {
  const companyId = soEmpresa(req, res); if (!companyId) return;

  const urlRaw = String(req.body?.url || "").trim();
  if (!urlRaw) return res.status(400).json({ error: "URL não informada" });

  // Validação e proteção SSRF
  let parsed;
  try {
    parsed = new URL(urlRaw);
  } catch {
    return res.status(400).json({ error: "URL inválida" });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "Apenas URLs http/https são permitidas" });
  }
  const host = parsed.hostname.toLowerCase();
  const blocos = [
    /^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^::1$/,
    /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    /^169\.254\./, /^fc00:/i, /^fe80:/i,
  ];
  if (blocos.some((r) => r.test(host))) {
    return res.status(400).json({ error: "Acesso a endereços privados não é permitido" });
  }

  // Busca com timeout e limite de tamanho
  const MAX_BYTES = 500_000;
  const TIMEOUT_MS = 10_000;
  try {
    const conteudo = await new Promise((resolve, reject) => {
      const proto = parsed.protocol === "https:" ? https : http;
      const req2 = proto.get(parsed.toString(), { timeout: TIMEOUT_MS, headers: { "User-Agent": "RYCS-Site-Analyzer/1.0", Accept: "text/html" } }, (resp) => {
        if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode >= 400)) {
          return reject(new Error(`HTTP ${resp.statusCode}`));
        }
        // Bloqueia redirect para endereços privados
        if ([301,302,303,307,308].includes(resp.statusCode)) {
          const loc = resp.headers?.location || "";
          try { const u = new URL(loc, parsed.toString()); if (blocos.some((r) => r.test(u.hostname))) return reject(new Error("Redirect bloqueado")); } catch {}
        }
        let raw = "";
        let bytes = 0;
        resp.setEncoding("utf8");
        resp.on("data", (chunk) => {
          bytes += Buffer.byteLength(chunk, "utf8");
          if (bytes > MAX_BYTES) { resp.destroy(); return reject(new Error("Resposta muito grande")); }
          raw += chunk;
        });
        resp.on("end", () => resolve(raw));
        resp.on("error", reject);
      });
      req2.on("timeout", () => { req2.destroy(); reject(new Error("Timeout")); });
      req2.on("error", reject);
    });

    // Extrai texto limpo do HTML
    const texto = conteudo
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 8000);

    // Usa IA se disponível
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ sugestoes: null, textoExtraido: texto.slice(0, 500), mensagem: "Análise por IA não disponível. Revise as informações manualmente." });
    }

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Analise o conteúdo deste site e extraia informações sobre a empresa. Retorne SOMENTE um JSON válido (sem markdown) com os campos que você conseguiu identificar com segurança:

CONTEÚDO DO SITE:
${texto}

JSON esperado (omita campos que não conseguiu identificar):
{
  "nomeEmpresa": "...",
  "segmentos": ["..."],
  "modelosNegocio": ["B2B","B2C"],
  "tiposCliente": ["..."],
  "necessidades": ["..."],
  "diferenciais": ["..."],
  "tomComunicacao": ["..."],
  "descricao": "Breve descrição do que a empresa faz"
}`,
      }],
    });

    const txt = msg.content?.[0]?.text || "{}";
    const limpo = txt.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const sugestoes = JSON.parse(limpo);
    return res.json({ sugestoes, textoExtraido: texto.slice(0, 300) });
  } catch (e) {
    return res.status(400).json({ error: `Não foi possível analisar o site: ${e.message}` });
  }
});

export default router;
