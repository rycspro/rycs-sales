import { Router } from "express";
import db, { uid, agora } from "../db.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { camposPendentesEmpresa, STATUS_EMPRESA } from "../../shared/empresa.js";
import { ACOES } from "../../shared/acoes.js";
import { normalizarRegras, PADRAO, SEMPRE_MANUAL, VERSAO_REGRAS } from "../../shared/aprovacoes.js";
import { avaliarFoto } from "../../shared/fotoPerfil.js";
import { extratoEmpresa, posicaoEmpresa } from "../services/financeiro.js";
import { emailStatusEmpresa } from "../services/email.js";
import Anthropic from "@anthropic-ai/sdk";
import { extrairTextoPdf } from "../services/reportPdf.js";
import { montarDossieEmpresa, narrativaEmpresa } from "../services/dossieEmpresa.js";

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
    "contatoFinanceiro", "contatoComercial", "situacaoCadastral", "dataAbertura", "naturezaJuridica", "cnaes", "telefoneEmpresa", "emailEmpresa"];
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

router.post("/companies/:id/cnpj/extract", async (req,res)=>{
  if(req.user.role!=="empresa"||req.user.entityId!==req.params.id)return res.status(403).json({error:"Sem permissão"});
  const base64=String(req.body?.base64||""),mimetype=String(req.body?.mimetype||"");
  const buffer=Buffer.from(base64,"base64");if(!buffer.length||buffer.length>5*1024*1024)return res.status(413).json({error:"Arquivo deve ter até 5 MB"});
  let texto="";if(mimetype==="application/pdf"){try{texto=extrairTextoPdf(buffer);}catch(e){return res.status(422).json({error:e.message});}}
  if(!process.env.ANTHROPIC_API_KEY){if(!texto)return res.status(503).json({error:"Leitura de imagem requer o serviço de IA configurado. Você pode preencher os dados manualmente."});const cnpj=texto.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/)?.[0]||"";return res.json({dados:{documento:cnpj.replace(/\D/g,""),razaoSocial:"",nome:"",situacaoCadastral:"",dataAbertura:"",naturezaJuridica:"",cnaes:"",endereco:"",telefoneEmpresa:"",emailEmpresa:""},preview:texto.slice(0,800),confianca:"baixa"});}
  try{const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});const conteudo=texto?[{type:"text",text:`Extraia do cartão CNPJ abaixo. Responda só JSON com documento, razaoSocial, nome, situacaoCadastral, dataAbertura, naturezaJuridica, cnaes, endereco, telefoneEmpresa, emailEmpresa. Use string vazia quando ausente.\n${texto.slice(0,12000)}`}]:[{type:"image",source:{type:"base64",media_type:mimetype,data:base64}},{type:"text",text:"Extraia este cartão CNPJ. Responda só JSON com documento, razaoSocial, nome, situacaoCadastral, dataAbertura, naturezaJuridica, cnaes, endereco, telefoneEmpresa, emailEmpresa. Use string vazia quando ausente."}];const out=await client.messages.create({model:"claude-sonnet-4-6",max_tokens:700,messages:[{role:"user",content:conteudo}]});const raw=out.content.map((b)=>b.text||"").join("").replace(/```json|```/g,"").trim(),dados=JSON.parse(raw);dados.documento=String(dados.documento||"").replace(/\D/g,"");res.json({dados,preview:raw,confianca:"assistida"});}catch(e){res.status(502).json({error:"Não foi possível ler o cartão CNPJ. Preencha manualmente ou tente outro arquivo."});}
});

// Dossiê da empresa: o que ela vende, para quem, que vendedor serve nessa
// operação e como ela se comporta com quem já trabalhou para ela.
//
// Junta três fontes que sozinhas não dizem nada: o cadastro (o que ela
// declara), as campanhas (o que ela realmente busca) e as submissões (como
// ela trata quem entrega).
router.get("/companies/:id/dossie", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  const campanhas = db.prepare("SELECT * FROM campaigns WHERE companyId = ?").all(empresa.id)
    .map((c) => ({ ...c, tarefas: JSON.parse(c.tarefas || "{}") }));
  const submissions = db.prepare("SELECT * FROM submissions WHERE companyId = ?").all(empresa.id);

  const dossie = montarDossieEmpresa({ empresa, campanhas, submissions });

  // Igual ao dossiê do profissional: a narrativa é opcional e nunca segura a
  // resposta. Sem chave configurada ela vem nula, e a tela diz isso.
  dossie.narrativa = await narrativaEmpresa(dossie);

  res.json({ dossie });
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
  // Cadastro completo aprova na hora. A plataforma deixou de ser fila de
  // espera também aqui — mesma razão do lado do profissional: esperar sem
  // prazo nem motivo faz a empresa desistir antes de operar.
  //
  // A exigência de cadastro completo FICA. Ela não é burocracia: é o que
  // impede uma empresa sem CNPJ e sem representante legal de publicar
  // campanha e ficar devendo comissão a um vendedor que já trabalhou.
  const pendencias = camposPendentesEmpresa(empresa);
  if (pendencias.length) return res.status(422).json({ error: "Complete o cadastro antes de enviar.", pendencias });
  if (empresa.statusCadastro === "aprovada") return res.json({ ok: true, status: "aprovada", duplicado: true });

  db.prepare("UPDATE companies SET statusCadastro = 'aprovada', aprovadoEm = ? WHERE id = ?").run(Date.now(), id);
  const usuario = db.prepare("SELECT email FROM users WHERE entityId = ? AND role = 'empresa'").get(id);
  if (usuario?.email) await emailStatusEmpresa(empresa.nome, usuario.email, "aprovada");
  res.json({ ok: true, status: "aprovada" });
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

// Extrato enriquecido: cada linha do razão ganha o nome da tarefa, da
// campanha e do profissional. Sem isso o financeiro é uma lista de valores
// sem a pergunta que a empresa realmente faz — "esse débito veio de quê?".
function extratoDetalhado(companyId, { dias, tipo, campaignId } = {}) {
  const linhas = extratoEmpresa(companyId, 300);
  const desde = dias ? Date.now() - Number(dias) * 86400000 : 0;

  const submissoes = new Map();
  for (const l of linhas) {
    if (!l.submissionId || submissoes.has(l.submissionId)) continue;
    const s = db.prepare(`SELECT s.id, s.tipo, s.campaignId, s.sellerId, c.titulo AS campanha, v.nome AS profissional
                          FROM submissions s
                          LEFT JOIN campaigns c ON c.id = s.campaignId
                          LEFT JOIN sellers v ON v.id = s.sellerId
                          WHERE s.id = ?`).get(l.submissionId);
    if (s) submissoes.set(l.submissionId, s);
  }

  return linhas
    .map((l) => {
      const s = l.submissionId ? submissoes.get(l.submissionId) : null;
      return {
        id: l.id,
        tipo: l.tipo,
        valor: l.valor,
        criadoEm: l.criadoEm,
        saldoEmpresa: l.saldoEmpresa,
        reservadoEmpresa: l.reservadoEmpresa,
        submissionId: l.submissionId,
        tarefa: s?.tipo || null,
        campaignId: s?.campaignId || null,
        campanha: s?.campanha || null,
        profissional: s?.profissional || null,
        taxa: l.dados?.taxa ?? null,
        bruto: l.dados?.bruto ?? null,
        liquido: l.dados?.liquido ?? null,
        referencia: l.dados?.referencia || l.dados?.gateway || l.dados?.motivo || "",
      };
    })
    .filter((l) => (!desde || l.criadoEm >= desde)
      && (!tipo || l.tipo === tipo)
      && (!campaignId || l.campaignId === campaignId));
}

router.get("/company/finance", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const id = req.user.entityId;

  const extrato = extratoDetalhado(id, {
    dias: req.query.dias,
    tipo: req.query.tipo,
    campaignId: req.query.campaignId,
  });

  // Consolidado do período filtrado. Os valores saem do razão, não de uma
  // contagem paralela: dois números que deveriam bater precisam vir da
  // mesma fonte, senão um dia divergem sem ninguém perceber.
  const soma = (f) => Math.round(extrato.filter(f).reduce((n, l) => n + Math.abs(l.valor), 0) * 100) / 100;
  const resumo = {
    depositado: soma((l) => l.tipo === "deposito"),
    utilizado: soma((l) => l.tipo === "liquidacao"),
    taxas: Math.round(extrato.reduce((n, l) => n + (Number(l.taxa) || 0), 0) * 100) / 100,
    repassado: Math.round(extrato.reduce((n, l) => n + (Number(l.liquido) || 0), 0) * 100) / 100,
    movimentos: extrato.length,
  };

  const empresa = db.prepare("SELECT assinatura, plano, destaque FROM companies WHERE id = ?").get(id);
  const assinatura = db.prepare(
    "SELECT plano, status, valor, proximaCobranca FROM subscriptions WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 1"
  ).get(id) || null;

  res.json({
    posicao: posicaoEmpresa(id),
    resumo,
    extrato,
    assinatura,
    plano: empresa?.assinatura || empresa?.plano || "free",
    destaque: !!empresa?.destaque,
  });
});

// Exportação do extrato. CSV com separador ponto e vírgula e BOM: é o que o
// Excel em português abre sem pedir importação manual.
router.get("/company/finance/export", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });

  const extrato = extratoDetalhado(req.user.entityId, {
    dias: req.query.dias,
    tipo: req.query.tipo,
    campaignId: req.query.campaignId,
  });

  const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cabecalho = ["Data", "Movimento", "Valor", "Tarefa", "Campanha", "Profissional", "Bruto", "Taxa", "Líquido", "Referência"];
  const linhas = extrato.map((l) => [
    new Date(l.criadoEm).toLocaleString("pt-BR"),
    l.tipo,
    Number(l.valor).toFixed(2).replace(".", ","),
    l.tarefa ? (ACOES[l.tarefa]?.nome || l.tarefa) : "",
    l.campanha || "",
    l.profissional || "",
    l.bruto != null ? Number(l.bruto).toFixed(2).replace(".", ",") : "",
    l.taxa != null ? Number(l.taxa).toFixed(2).replace(".", ",") : "",
    l.liquido != null ? Number(l.liquido).toFixed(2).replace(".", ",") : "",
    l.referencia || "",
  ].map(escapar).join(";"));

  res.type("text/csv; charset=utf-8")
    .set("Content-Disposition", `attachment; filename=extrato-rycs-${Date.now()}.csv`)
    .send("\ufeff" + [cabecalho.map(escapar).join(";"), ...linhas].join("\n"));
});

// Tabelas penduradas na empresa. Os filhos saem antes do pai, senão a
// foreign key barra a exclusão.
const DEPENDENTES = [
  ["assistant_history", "companyId"],
  ["knowledge_history", "companyId"],
  ["knowledge_documents", "companyId"],
  ["company_reports", "companyId"],
  ["course_progress", "companyId"],
  ["applications", "companyId"],
  ["partnership_requests", "companyId"],
  ["messages", "companyId"],
  ["submissions", "companyId"],
  ["company_score_dimensions", "companyId"],
  ["voucher_redemptions", "companyId"],
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

// Regras de aprovação automática da empresa.
router.get("/company/approval-rules", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const row = db.prepare("SELECT regrasAprovacao FROM companies WHERE id = ?").get(req.user.entityId);
  let guardado = {};
  try { guardado = JSON.parse(row?.regrasAprovacao || "{}"); } catch { guardado = {}; }

  // Quantas ações cada critério teria pego nos últimos 30 dias. Ligar a regra
  // às cegas é o caminho curto para aprovar sozinho o que não devia.
  const desde = Date.now() - 30 * 86400000;
  const recentes = db.prepare(
    "SELECT tipo, valor, confianca, status FROM submissions WHERE companyId = ? AND criadoEm >= ?"
  ).all(req.user.entityId, desde);

  res.json({
    regras: normalizarRegras(guardado),
    padrao: PADRAO,
    sempreManual: SEMPRE_MANUAL,
    versao: VERSAO_REGRAS,
    amostra: {
      total: recentes.length,
      porTipo: Object.fromEntries(Object.keys(ACOES).map((t) => {
        const doTipo = recentes.filter((s) => s.tipo === t);
        return [t, {
          total: doTipo.length,
          confiancaMedia: doTipo.length
            ? Math.round(doTipo.reduce((n, s) => n + (Number(s.confianca) || 0), 0) / doTipo.length)
            : null,
          valorMaximo: doTipo.reduce((n, s) => Math.max(n, Number(s.valor) || 0), 0),
        }];
      })),
    },
  });
});

router.patch("/company/approval-rules", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const regras = normalizarRegras(req.body);
  db.prepare("UPDATE companies SET regrasAprovacao = ? WHERE id = ?")
    .run(JSON.stringify(regras), req.user.entityId);
  console.log(`[aprovacoes] regras atualizadas: ${req.user.entityId} ativo=${regras.ativo}`);
  res.json({ regras });
});

// Logo da empresa. Passa pela mesma verificação técnica da foto de perfil:
// formato, peso, resolução e enquadramento — nada de conteúdo.
router.post("/companies/:id/logo", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "admin" && entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });

  const { base64, mimetype, largura, altura } = req.body || {};
  if (!base64) return res.status(400).json({ error: "Envie a imagem" });

  const tamanhoBytes = Math.round((String(base64).length * 3) / 4);
  const avaliacao = avaliarFoto({ mimetype, tamanhoBytes, largura: Number(largura), altura: Number(altura) });
  if (!avaliacao.aprovada)
    return res.status(422).json({ error: "A imagem não passou na verificação.", avaliacao });

  const dataUri = `data:${mimetype};base64,${base64}`;
  db.prepare("UPDATE companies SET logo = ? WHERE id = ?").run(dataUri, req.params.id);
  res.json({ ok: true, logo: dataUri, avaliacao });
});

// ─── ADMIN: Criar empresa com login ───────────────────────────────────────────
router.post("/admin/companies", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const { nome, produto, email, senha, diaFechamento, diaPagamento, modalidadePagamento, limiteCredito, tipoEmpresa } = req.body;
  if (!nome || !produto || !email) return res.status(400).json({ error: "nome, produto e email são obrigatórios" });

  const emailNorm = email.toLowerCase().trim();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(emailNorm))
    return res.status(409).json({ error: "E-mail já cadastrado" });

  const senhaFinal = senha || randomBytes(8).toString("base64url");
  const companyId = uid();
  const userId = uid();
  const tipoFinal = ["padrao", "premium"].includes(tipoEmpresa) ? tipoEmpresa : "padrao";

  db.prepare(`
    INSERT INTO companies (id, nome, produto, ticket, icp, plano, destaque, saldo, vagas, cor,
      totalAportado, criadoEm, comissoes, curso, aportes, statusCadastro, assinatura,
      diaFechamento, diaPagamento, modalidadePagamento, limiteCredito, tipoEmpresa)
    VALUES (?, ?, ?, '', '', 'saldo', 0, 0, 20, '#2563EB',
      0, ?, '{}', '[]', '[]', 'aprovada', 'pro',
      ?, ?, ?, ?, ?)
  `).run(companyId, nome, produto, agora(),
    diaFechamento || null, diaPagamento || null,
    modalidadePagamento || "pre", limiteCredito || 0, tipoFinal);

  db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES (?, ?, ?, 'empresa', ?, 1, ?)")
    .run(userId, emailNorm, bcrypt.hashSync(senhaFinal, 10), companyId, agora());

  res.json({ ok: true, companyId, userId, email: emailNorm, senhaTemporaria: senhaFinal });
});

// ─── ADMIN: Configurar ciclo/modalidade de pagamento de uma empresa ────────────
router.patch("/admin/companies/:id/pagamento", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const empresa = db.prepare("SELECT id FROM companies WHERE id = ?").get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  const { diaFechamento, diaPagamento, modalidadePagamento, limiteCredito, tipoEmpresa } = req.body;
  const sets = [];
  const vals = [];

  if (diaFechamento !== undefined) { sets.push("diaFechamento = ?"); vals.push(diaFechamento || null); }
  if (diaPagamento !== undefined) { sets.push("diaPagamento = ?"); vals.push(diaPagamento || null); }
  if (modalidadePagamento !== undefined) {
    if (!["pre", "pos"].includes(modalidadePagamento)) return res.status(400).json({ error: "modalidadePagamento deve ser 'pre' ou 'pos'" });
    sets.push("modalidadePagamento = ?"); vals.push(modalidadePagamento);
  }
  if (limiteCredito !== undefined) { sets.push("limiteCredito = ?"); vals.push(Number(limiteCredito) || 0); }
  if (tipoEmpresa !== undefined) {
    if (!["padrao", "premium"].includes(tipoEmpresa)) return res.status(400).json({ error: "tipoEmpresa deve ser 'padrao' ou 'premium'" });
    sets.push("tipoEmpresa = ?"); vals.push(tipoEmpresa);
  }

  if (!sets.length) return res.status(400).json({ error: "nenhum campo válido" });
  vals.push(req.params.id);
  db.prepare(`UPDATE companies SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// ─── ADMIN: Processar ciclo de pagamento (liberar saldo para profissionais) ────
router.post("/admin/companies/:id/ciclo/liberar", async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const empresa = db.prepare("SELECT id, nome, diaFechamento, diaPagamento FROM companies WHERE id = ?").get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (!empresa.diaFechamento || !empresa.diaPagamento)
    return res.status(400).json({ error: "Esta empresa não possui ciclo de pagamento configurado." });

  const { liberarCicloEmpresa } = await import("../services/financeiro.js");
  const resultado = liberarCicloEmpresa(empresa.id);
  res.json({ ok: true, empresa: empresa.nome, ...resultado });
});

// ─── ADMIN: Consultar configuração de pagamento de uma empresa ─────────────────
router.get("/admin/companies/:id/pagamento", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const empresa = db.prepare(
    "SELECT id, nome, tipoEmpresa, modalidadePagamento, diaFechamento, diaPagamento, limiteCredito FROM companies WHERE id = ?"
  ).get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  const pendenteCiclo = db.prepare(
    "SELECT COUNT(*) total, COALESCE(SUM(liquido), 0) valor FROM submissions WHERE companyId = ? AND status = 'liberado' AND dataLiberacao IS NOT NULL"
  ).get(req.params.id);

  res.json({ ...empresa, pendenteCiclo });
});

export default router;
