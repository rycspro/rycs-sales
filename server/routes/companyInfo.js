import { Router } from "express";
import db, { uid, agora } from "../db.js";

const router = Router();

const SECOES = ["sobre", "produtos", "abordagens", "processos"];
const TIPOS = ["bloco", "produto", "orientacao", "procedimento", "custom"];

// Só empresas acessam a própria base de conhecimento estruturada.
const empresa = (req, res) => {
  if (req.user.role !== "empresa") { res.status(403).json({ error: "Apenas empresas" }); return null; }
  return req.user.entityId;
};

const parse = (valor, padrao) => { try { return JSON.parse(valor || ""); } catch { return padrao; } };

const serializar = (row) => ({
  ...row,
  dados: parse(row.dados, {}),
  anexos: parse(row.anexos, []),
});

// Lista entradas da empresa. Filtra por ?secao= quando informado.
router.get("/company-info", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const secao = req.query.secao ? String(req.query.secao) : null;
  const rows = secao
    ? db.prepare("SELECT * FROM company_info_entries WHERE companyId = ? AND secao = ? ORDER BY ordem ASC, criadoEm ASC").all(companyId, secao)
    : db.prepare("SELECT * FROM company_info_entries WHERE companyId = ? ORDER BY secao ASC, ordem ASC, criadoEm ASC").all(companyId);
  res.json({ entradas: rows.map(serializar) });
});

// Uma entrada só conta como "cheia" quando tem conteúdo real — o título, que em
// blocos sugeridos já nasce preenchido, não basta. Em registros exige nome + ao
// menos um campo com conteúdo.
const entradaCheia = (e) => {
  const d = parse(e.dados, {});
  const txt = (v) => String(v || "").trim().length > 0;
  if (e.secao === "sobre") return txt(e.conteudo);
  if (!txt(e.titulo)) return false;
  return txt(e.descricao) || txt(e.conteudo) || txt(d.caracteristicas) || txt(d.beneficios) ||
    txt(d.diferenciais) || txt(d.publico) || txt(d.preco) || txt(d.complementos) ||
    txt(d.objetivo) || txt(d.observacoes) || (Array.isArray(d.etapas) && d.etapas.some((x) => txt(x)));
};

// Resumo: estado de preenchimento por seção (contagem real, sem percentuais).
// 'vazio' = sem entradas; 'preenchido' = todas cheias; 'parcial' = começou mas
// ainda há entradas sem conteúdo.
router.get("/company-info/resumo", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const rows = db.prepare("SELECT secao, titulo, descricao, conteudo, dados FROM company_info_entries WHERE companyId = ?").all(companyId);
  const resumo = {};
  for (const s of SECOES) resumo[s] = { total: 0, cheias: 0 };
  for (const r of rows) {
    if (!resumo[r.secao]) resumo[r.secao] = { total: 0, cheias: 0 };
    resumo[r.secao].total += 1;
    if (entradaCheia(r)) resumo[r.secao].cheias += 1;
  }
  for (const s of Object.keys(resumo)) {
    const { total, cheias } = resumo[s];
    resumo[s].estado = total === 0 ? "vazio" : cheias === total ? "preenchido" : "parcial";
  }
  res.json({ resumo });
});

router.post("/company-info", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const secao = String(req.body?.secao || "");
  if (!SECOES.includes(secao)) return res.status(400).json({ error: "Seção inválida" });
  const tipo = TIPOS.includes(req.body?.tipo) ? req.body.tipo : "bloco";
  const id = uid(), ts = agora();
  const ordemInformada = Number.isFinite(req.body?.ordem) ? req.body.ordem : null;
  const ordem = ordemInformada ?? (db.prepare("SELECT COALESCE(MAX(ordem), -1) + 1 m FROM company_info_entries WHERE companyId = ? AND secao = ?").get(companyId, secao).m);
  db.prepare(`INSERT INTO company_info_entries
    (id, companyId, secao, tipo, titulo, descricao, conteudo, dados, anexos, ordem, status, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, companyId, secao, tipo,
      String(req.body?.titulo || ""), String(req.body?.descricao || ""), String(req.body?.conteudo || ""),
      JSON.stringify(req.body?.dados ?? {}), JSON.stringify(req.body?.anexos ?? []),
      ordem, "rascunho", ts, ts);
  res.json(serializar(db.prepare("SELECT * FROM company_info_entries WHERE id = ?").get(id)));
});

router.patch("/company-info/:id", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const atual = db.prepare("SELECT * FROM company_info_entries WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!atual) return res.status(404).json({ error: "Registro não encontrado" });
  const sets = [], vals = [];
  const texto = ["titulo", "descricao", "conteudo", "status"];
  for (const k of texto) if (k in (req.body || {})) { sets.push(`${k} = ?`); vals.push(String(req.body[k] ?? "")); }
  if ("tipo" in (req.body || {}) && TIPOS.includes(req.body.tipo)) { sets.push("tipo = ?"); vals.push(req.body.tipo); }
  if ("ordem" in (req.body || {}) && Number.isFinite(req.body.ordem)) { sets.push("ordem = ?"); vals.push(req.body.ordem); }
  if ("dados" in (req.body || {})) { sets.push("dados = ?"); vals.push(JSON.stringify(req.body.dados ?? {})); }
  if ("anexos" in (req.body || {})) { sets.push("anexos = ?"); vals.push(JSON.stringify(req.body.anexos ?? [])); }
  if (!sets.length) return res.status(400).json({ error: "Nenhum campo válido" });
  sets.push("atualizadoEm = ?"); vals.push(agora(), atual.id, companyId);
  db.prepare(`UPDATE company_info_entries SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`).run(...vals);
  res.json(serializar(db.prepare("SELECT * FROM company_info_entries WHERE id = ?").get(atual.id)));
});

// Reordenação em lote: [{ id, ordem }, ...] da mesma empresa.
router.put("/company-info/reordenar", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  const ts = agora();
  const stmt = db.prepare("UPDATE company_info_entries SET ordem = ?, atualizadoEm = ? WHERE id = ? AND companyId = ?");
  db.transaction(() => { for (const it of itens) if (it?.id && Number.isFinite(it.ordem)) stmt.run(it.ordem, ts, it.id, companyId); })();
  res.json({ ok: true });
});

router.delete("/company-info/:id", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const row = db.prepare("SELECT id FROM company_info_entries WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!row) return res.status(404).json({ error: "Registro não encontrado" });
  db.prepare("DELETE FROM company_info_entries WHERE id = ? AND companyId = ?").run(row.id, companyId);
  res.json({ ok: true });
});

export default router;
