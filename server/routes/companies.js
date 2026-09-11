import { Router } from "express";
import db from "../db.js";
import { camposPendentesEmpresa, STATUS_EMPRESA } from "../../shared/empresa.js";
import { extratoEmpresa, posicaoEmpresa } from "../services/financeiro.js";
import { emailEmpresaEmAnalise, emailStatusEmpresa } from "../services/email.js";

const router = Router();

router.patch("/companies/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  if (role === "empresa" && entityId !== id)
    return res.status(403).json({ error: "Sem permissão para editar outra empresa" });
  if (role === "vendedor")
    return res.status(403).json({ error: "Vendedores não podem editar empresas" });

  const fields = req.body;
  // saldo/totalAportado/aportes só mudam por pagamento confirmado no gateway
  // ou por liberação de ação — nunca por escrita direta do cliente.
  const allowed = ["nome", "produto", "ticket", "icp", "plano", "destaque", "vagas", "cor", "documento",
    "razaoSocial", "endereco", "segmento", "regiao", "diferenciais", "objecoes", "representanteLegal",
    "contatoFinanceiro", "contatoComercial"];
  const jsonFields = ["comissoes", "curso", "qualificacao", "materiais"];
  const sets = [];
  const vals = [];

  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(k === "destaque" ? (v ? 1 : 0) : v);
    } else if (jsonFields.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(JSON.stringify(v));
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nenhum campo válido" });
  vals.push(id);
  db.prepare(`UPDATE companies SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.get("/companies/:id/readiness", (req, res) => {
  const { id } = req.params;
  if (req.user.role === "empresa" && req.user.entityId !== id) return res.status(403).json({ error: "Sem permissão" });
  if (req.user.role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  const pendencias = camposPendentesEmpresa(empresa);
  res.json({ prontaParaAnalise: pendencias.length === 0, pendencias, status: empresa.statusCadastro, caixa: posicaoEmpresa(id) });
});

router.post("/companies/:id/submit-review", async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== "empresa" || req.user.entityId !== id) return res.status(403).json({ error: "Sem permissão" });
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  const pendencias = camposPendentesEmpresa(empresa);
  if (pendencias.length) return res.status(422).json({ error: "Complete o cadastro antes de enviar.", pendencias });
  if (empresa.statusCadastro === "em_analise") return res.json({ ok: true, status: "em_analise", duplicado: true });
  db.prepare("UPDATE companies SET statusCadastro = 'em_analise' WHERE id = ?").run(id);
  const usuario = db.prepare("SELECT email FROM users WHERE entityId = ? AND role = 'empresa'").get(id);
  if (usuario?.email) await emailEmpresaEmAnalise(empresa.nome, usuario.email);
  res.json({ ok: true, status: "em_analise" });
});

router.patch("/companies/:id/status", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });
  const status = String(req.body?.status || "");
  if (!STATUS_EMPRESA.includes(status)) return res.status(400).json({ error: "Status inválido" });
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (status === "aprovada") {
    const pendencias = camposPendentesEmpresa(empresa);
    if (pendencias.length) return res.status(422).json({ error: "Cadastro incompleto", pendencias });
  }
  db.prepare("UPDATE companies SET statusCadastro = ?, aprovadoPor = ?, aprovadoEm = ? WHERE id = ?")
    .run(status, status === "aprovada" ? req.user.id : null, status === "aprovada" ? Date.now() : null, req.params.id);
  if (status !== empresa.statusCadastro) {
    const usuario = db.prepare("SELECT email FROM users WHERE entityId = ? AND role = 'empresa'").get(empresa.id);
    if (usuario?.email) await emailStatusEmpresa(empresa.nome, usuario.email, status);
  }
  res.json({ ok: true, status });
});

router.get("/company/finance", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  res.json({ posicao: posicaoEmpresa(req.user.entityId), extrato: extratoEmpresa(req.user.entityId, req.query.limit) });
});

// Tabelas penduradas na empresa. Os filhos saem antes do pai, senão a
// foreign key barra a exclusão.
const DEPENDENTES = [
  ["assistant_history", "companyId"],
  ["knowledge_history", "companyId"],
  ["knowledge_documents", "companyId"],
  ["course_progress", "companyId"],
  ["applications", "companyId"],
  ["messages", "companyId"],
  ["submissions", "companyId"],
  ["company_score_dimensions", "companyId"],
  ["subscriptions", "companyId"],
  ["deposit_requests", "companyId"],
];

// Exclusão definitiva de uma empresa. Só a plataforma pode chamar.
//
// Como no profissional, platform_earnings fica de fora: é a receita já
// realizada da plataforma, não dado da empresa.
router.delete("/companies/:id", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const { id } = req.params;
  const empresa = db.prepare("SELECT id, nome, saldo FROM companies WHERE id = ?").get(id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  // Saldo em caixa é dinheiro que a empresa aportou e ainda não gastou;
  // ações em análise são trabalho de vendedor esperando veredito. Apagar
  // qualquer um dos dois sem aviso deixa alguém no prejuízo.
  const emAnalise = db.prepare(
    "SELECT COUNT(*) n FROM submissions WHERE companyId = ? AND status IN ('analisando', 'ia_aprovado')"
  ).get(id).n;
  const forcar = req.query.forcar === "true";

  if (!forcar && (empresa.saldo > 0 || emAnalise)) {
    return res.status(409).json({
      error: "Empresa com valores em aberto",
      saldo: empresa.saldo,
      acoesEmAnalise: emAnalise,
      comoProsseguir: "Devolva o saldo e resolva as ações pendentes, ou repita com ?forcar=true.",
    });
  }

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(id);
  const removidos = {};

  db.transaction(() => {
    // lead_events aponta para leads, e campaign_applications para campaigns:
    // os netos precisam sair antes dos filhos.
    const leads = db.prepare("SELECT id FROM leads WHERE companyId = ?").all(id).map((l) => l.id);
    for (const leadId of leads) db.prepare("DELETE FROM lead_events WHERE leadId = ?").run(leadId);
    if (leads.length) removidos.leads = db.prepare("DELETE FROM leads WHERE companyId = ?").run(id).changes;

    const campanhas = db.prepare("SELECT id FROM campaigns WHERE companyId = ?").all(id).map((c) => c.id);
    for (const campaignId of campanhas) db.prepare("DELETE FROM campaign_applications WHERE campaignId = ?").run(campaignId);
    if (campanhas.length) removidos.campaigns = db.prepare("DELETE FROM campaigns WHERE companyId = ?").run(id).changes;

    for (const [tabela, coluna] of DEPENDENTES) {
      const r = db.prepare(`DELETE FROM ${tabela} WHERE ${coluna} = ?`).run(id);
      if (r.changes) removidos[tabela] = r.changes;
    }
    if (user) {
      for (const tabela of ["notifications", "uploads"]) {
        const r = db.prepare(`DELETE FROM ${tabela} WHERE userId = ?`).run(user.id);
        if (r.changes) removidos[tabela] = r.changes;
      }
      const ref = db.prepare(
        "DELETE FROM referrals WHERE indicadorUserId = ? OR indicadoUserId = ?"
      ).run(user.id, user.id);
      if (ref.changes) removidos.referrals = ref.changes;
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    }
    db.prepare("DELETE FROM companies WHERE id = ?").run(id);
  })();

  console.log(`[admin] empresa excluída: ${empresa.nome}`);
  res.json({ removido: { id, nome: empresa.nome }, registros: removidos, forcado: forcar });
});

export default router;
