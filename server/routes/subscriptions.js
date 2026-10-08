import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError, garantirCliente } from "../services/asaas.js";
import { acessoDaEmpresa, primeiraCobranca } from "../../shared/assinatura.js";
import { PLANOS, ORDEM_PLANOS, planoDe } from "../../shared/planos.js";
import { calcularVoucher, normalizarVoucher, validarVoucher } from "../services/vouchers.js";
import { qualificarIndicacao } from "../services/indicacoes.js";
import { TRIAL_SECRETO_DIAS, TRIAL_LINK_VALIDADE_DIAS, podeConcederTrialSecreto, podeResgatarConvite, estadoDoConvite, MOTIVOS_CONVITE } from "../../shared/trialSecreto.js";

const router = Router();

router.get("/plans", (_req, res) => {
  res.json(ORDEM_PLANOS.map((k) => ({ chave: k, ...PLANOS[k] })));
});

router.get("/vouchers/validate", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error:"Apenas empresas" });
  const plano = String(req.query.plano || ""), base = PLANOS[plano];
  if (!base || !base.preco) return res.status(400).json({ error:"Plano inválido" });
  const validacao = validarVoucher(db,{codigo:req.query.codigo,plano,companyId:req.user.entityId});
  if (!validacao.ok) return res.status(422).json({ error:validacao.error });
  res.json({ ok:true, codigo:validacao.voucher.codigo, tipo:validacao.voucher.tipo, valor:validacao.voucher.valor, ...calcularVoucher(base.preco,validacao.voucher) });
});

router.post("/vouchers", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error:"Apenas a plataforma" });
  const codigo=normalizarVoucher(req.body?.codigo), tipo=req.body?.tipo, valor=Number(req.body?.valor);
  if(!codigo||!["fixo","percentual"].includes(tipo)||!valor||valor<0) return res.status(400).json({error:"Código, tipo e valor válidos são obrigatórios"});
  if(tipo==="percentual"&&valor>100) return res.status(400).json({error:"Percentual máximo de 100%"});
  try{const id=uid();db.prepare(`INSERT INTO vouchers (id,codigo,tipo,valor,validadeEm,limiteTotal,limitePorEmpresa,planos,status,criadoEm) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id,codigo,tipo,valor,req.body.validadeEm||null,Number(req.body.limiteTotal)||0,Number(req.body.limitePorEmpresa)||1,JSON.stringify(req.body.planos||[]),req.body.status||"ativo",agora());res.json({id,codigo});}catch{return res.status(409).json({error:"Código já existe"});}
});

// Trial não é uma oferta pública. A concessão de sete dias só existe na rota
// administrativa abaixo; o checkout comum sempre começa com cobrança normal.
const TRIAL_DIAS_PUBLICO = 0;

// O estado de acesso da empresa. A tela pergunta aqui em vez de decidir
// sozinha — duas decisões separadas produziriam o caso em que a tela libera e
// a API recusa.
// Visão da plataforma: toda empresa e o estado da cobrança dela.
//
// Inclui quem nunca assinou. Listar só quem tem assinatura esconderia
// exatamente o grupo que a operação precisa ver — as empresas usando a
// plataforma sem pagar.
router.get("/admin/subscriptions", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const empresas = db.prepare("SELECT id, nome, assinatura, tipoEmpresa, criadoEm FROM companies ORDER BY nome").all();
  const assinaturas = db.prepare(
    "SELECT * FROM subscriptions WHERE status != 'cancelada' ORDER BY criadoEm DESC"
  ).all();
  const trialsUsados = new Set(db.prepare(
    "SELECT DISTINCT companyId FROM subscriptions WHERE trialDias > 0"
  ).all().map((s) => s.companyId));
  const porEmpresa = new Map();
  for (const a of assinaturas) if (!porEmpresa.has(a.companyId)) porEmpresa.set(a.companyId, a);

  const linhas = empresas.map((e) => {
    const assinatura = porEmpresa.get(e.id) || null;
    const acesso = acessoDaEmpresa({ empresa: e, assinatura });
    return {
      companyId: e.id,
      empresa: e.nome,
      plano: acesso.plano ? planoDe(acesso.plano).nome : null,
      planoChave: acesso.plano || null,
      valor: assinatura?.valor ?? (acesso.plano ? planoDe(acesso.plano).preco : null),
      estado: acesso.estado,
      liberado: acesso.liberado,
      proximaCobranca: assinatura?.proximaCobranca || assinatura?.trialFim || null,
      trialFim: assinatura?.trialFim || null,
      formaPagamento: assinatura?.formaPagamento || null,
      cartaoFinal: assinatura?.cartaoFinal || null,
      falhaMotivo: assinatura?.falhaMotivo || null,
      trialUsado: trialsUsados.has(e.id),
      trialElegivel: podeConcederTrialSecreto({
        estadoAtual: acesso.estado,
        jaUsouTrial: trialsUsados.has(e.id),
      }).ok,
      desde: e.criadoEm,
    };
  });

  const resumo = linhas.reduce((acc, l) => ({ ...acc, [l.estado]: (acc[l.estado] || 0) + 1 }), {});
  res.json({ linhas, resumo, total: linhas.length });
});

router.get("/subscription/access", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.json({ liberado: true, estado: "ativa" });

  const billing = db.prepare("SELECT billing_status, access_status FROM company_billing WHERE companyId = ?").get(entityId);

  // Bloqueio administrativo vem antes de tudo — inclusive de isenção e de
  // premium. É a decisão deliberada de um humano sobre um caso concreto, e
  // deixá-la depois da isenção criava o estado em que o admin bloqueia a
  // empresa, a tela continua liberada, e ninguém entende por quê.
  if (billing?.access_status === "bloqueado") {
    return res.json({ liberado: false, estado: "inadimplente", plano: null, titulo: "Acesso suspenso", mensagem: "Entre em contato com a RYCS para regularizar seu acesso.", acao: null, assinatura: null, trialDisponivel: TRIAL_DIAS_PUBLICO });
  }

  // Isenção de mensalidade concedida pelo admin sobrepõe o status de
  // assinatura: a empresa tem acesso completo sem precisar de cobrança.
  if (billing?.billing_status === "isenta") {
    return res.json({ liberado: true, estado: "ativa", plano: "pro", titulo: "", mensagem: "", acao: null, assinatura: null, trialDisponivel: TRIAL_DIAS_PUBLICO });
  }

  const empresa = db.prepare("SELECT assinatura, tipoEmpresa FROM companies WHERE id = ?").get(entityId);
  const assinatura = db.prepare(
    "SELECT * FROM subscriptions WHERE companyId = ? AND status != 'cancelada' ORDER BY criadoEm DESC LIMIT 1"
  ).get(entityId);

  res.json({ ...acessoDaEmpresa({ empresa, assinatura }), assinatura: assinatura || null, trialDisponivel: TRIAL_DIAS_PUBLICO });
});

// Concessão interna, deliberada e rastreável de sete dias. Não chama o Asaas,
// não usa cartão e não é exposta à empresa no checkout público.
// ---------------------------------------------------------------------------
// Convites de trial por link
//
// O token só existe em claro uma vez: na resposta que cria o convite. O banco
// guarda o hash. Se alguém copiar a tabela inteira, não sai um trial de lá.
const hashDoToken = (t) => createHash("sha256").update(String(t)).digest("hex");

router.post("/admin/trial-links", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const dias = Math.max(1, Math.min(90, Number(req.body?.dias) || TRIAL_SECRETO_DIAS));
  const plano = String(req.body?.plano || "").trim();
  if (plano && !PLANOS[plano]?.preco) return res.status(400).json({ error: "Plano inválido." });

  const token = randomBytes(32).toString("hex");
  const id = uid();
  const criadoEm = agora();
  const expiraEm = criadoEm + TRIAL_LINK_VALIDADE_DIAS * 86400000;

  db.prepare(`INSERT INTO trial_links (id, tokenHash, dias, plano, criadoPor, criadoEm, expiraEm, observacao)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, hashDoToken(token), dias, plano, req.user.id, criadoEm, expiraEm, String(req.body?.observacao || "").slice(0, 200));

  console.log(`[trial] convite gerado por ${req.user.id} — ${dias} dias${plano ? `, plano ${plano}` : ", qualquer plano"}`);

  const base = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
  res.status(201).json({
    id, dias, plano: plano || null, expiraEm,
    // Mostrado uma vez só. Não há como recuperá-lo depois, por desenho.
    token,
    url: `${base}/trial/${token}`,
    aviso: "Copie agora: este link não pode ser exibido de novo.",
  });
});

// Lista os convites para a operação acompanhar. Sem token nenhum — só o
// estado, para não transformar a tela do admin em fonte de links ativos.
router.get("/admin/trial-links", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const links = db.prepare("SELECT * FROM trial_links ORDER BY criadoEm DESC LIMIT 100").all().map((l) => {
    const empresa = l.usadoPor ? db.prepare("SELECT nome FROM companies WHERE id = ?").get(l.usadoPor) : null;
    const estado = estadoDoConvite(l);
    return {
      id: l.id, dias: l.dias, plano: l.plano || null,
      criadoEm: l.criadoEm, expiraEm: l.expiraEm,
      usadoEm: l.usadoEm, usadoPor: empresa?.nome || null,
      estado: l.usadoEm ? "usado" : estado.ok ? "disponivel" : "expirado",
    };
  });
  res.json({ links });
});

// Consulta pública do convite. Diz se serve, sem consumir e sem revelar nada
// além do necessário para a tela se desenhar.
router.get("/trial/:token", (req, res) => {
  const link = db.prepare("SELECT * FROM trial_links WHERE tokenHash = ?").get(hashDoToken(req.params.token));
  const estado = estadoDoConvite(link);
  if (!estado.ok) return res.status(404).json({ ok: false, motivo: estado.motivo, error: MOTIVOS_CONVITE[estado.motivo] });
  res.json({ ok: true, dias: link.dias, plano: link.plano || null, expiraEm: link.expiraEm });
});

// Resgate. A empresa logada troca o convite por sete dias no plano que ela
// escolher — sem checkout, sem cartão e sem passar pelo Asaas.
router.post("/trial/:token/resgatar", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem resgatar um convite." });

  const link = db.prepare("SELECT * FROM trial_links WHERE tokenHash = ?").get(hashDoToken(req.params.token));

  const empresa = db.prepare("SELECT id, assinatura FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada." });

  const atual = db.prepare(
    "SELECT * FROM subscriptions WHERE companyId = ? AND status != 'cancelada' ORDER BY criadoEm DESC LIMIT 1"
  ).get(entityId);
  const acesso = acessoDaEmpresa({ empresa, assinatura: atual || null });
  const jaUsouTrial = !!db.prepare("SELECT 1 FROM subscriptions WHERE companyId = ? AND trialDias > 0 LIMIT 1").get(entityId);

  const permissao = podeResgatarConvite({ link, estadoAtual: acesso.estado, jaUsouTrial });
  if (!permissao.ok) return res.status(409).json({ error: permissao.erro, motivo: permissao.motivo });

  // O convite pode fixar o plano; quando não fixa, a empresa escolhe qualquer
  // um dos pagos. Plano inválido não vira trial silenciosamente.
  const plano = link.plano || String(req.body?.plano || "").trim();
  if (!PLANOS[plano]?.preco) return res.status(400).json({ error: "Escolha um plano para ativar o período gratuito." });

  const inicio = agora();
  const trialFim = inicio + link.dias * 86400000;
  const subId = uid();

  let consumido = false;
  db.transaction(() => {
    // Marcar o uso e criar a assinatura na MESMA transação, com a condição
    // usadoEm IS NULL, é o que torna o uso único de verdade: dois resgates
    // simultâneos do mesmo link, só um passa.
    const marca = db.prepare(
      "UPDATE trial_links SET usadoPor = ?, usadoEm = ?, subscriptionId = ? WHERE id = ? AND usadoEm IS NULL"
    ).run(entityId, inicio, subId, link.id);
    if (marca.changes === 0) return;
    consumido = true;

    db.prepare(`INSERT INTO subscriptions
      (id, companyId, plano, status, valor, valorOriginal, inicio, proximaCobranca, trialFim, trialDias, trialOrigem, formaPagamento, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, 'trial', ?, ?, ?, ?, ?, ?, 'convite_link', 'ADMIN_TRIAL', ?, ?)`)
      .run(subId, entityId, plano, PLANOS[plano].preco, PLANOS[plano].preco,
           inicio, trialFim, trialFim, link.dias, inicio, inicio);
    db.prepare("UPDATE companies SET assinatura = ? WHERE id = ?").run(plano, entityId);
  })();

  if (!consumido) return res.status(409).json({ error: MOTIVOS_CONVITE.usado, motivo: "usado" });

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(entityId);
  if (user) {
    notificar(user.id, "assinatura", "Período gratuito liberado",
      `Seu acesso ao plano ${planoDe(plano).nome} está liberado até ${new Date(trialFim).toLocaleDateString("pt-BR")}. ` +
      "Depois dessa data será necessário contratar um plano para continuar.");
  }
  console.log(`[trial] convite resgatado pela empresa ${entityId} — plano ${plano}, até ${new Date(trialFim).toISOString()}`);

  res.status(201).json({ ok: true, plano, dias: link.dias, trialFim, subscriptionId: subId });
});

router.post("/admin/subscriptions/:companyId/secret-trial", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const companyId = String(req.params.companyId || "");
  const plano = String(req.body?.plano || "").trim();
  if (!PLANOS[plano]?.preco) return res.status(400).json({ error: "Selecione um plano pago válido." });

  const empresa = db.prepare("SELECT id, assinatura FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada." });

  const atual = db.prepare(
    "SELECT * FROM subscriptions WHERE companyId = ? AND status != 'cancelada' ORDER BY criadoEm DESC LIMIT 1"
  ).get(companyId);
  const acesso = acessoDaEmpresa({ empresa, assinatura: atual || null });
  const jaUsouTrial = !!db.prepare(
    "SELECT 1 FROM subscriptions WHERE companyId = ? AND trialDias > 0 LIMIT 1"
  ).get(companyId);
  const elegibilidade = podeConcederTrialSecreto({ estadoAtual: acesso.estado, jaUsouTrial });
  if (!elegibilidade.ok) return res.status(409).json({ error: elegibilidade.erro });

  const inicio = agora();
  const trialFim = inicio + TRIAL_SECRETO_DIAS * 86400000;
  const subId = uid();

  db.transaction(() => {
    db.prepare(`INSERT INTO subscriptions
      (id, companyId, plano, status, valor, valorOriginal, inicio, proximaCobranca, trialFim, trialDias, trialOrigem, formaPagamento, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, 'trial', ?, ?, ?, ?, ?, ?, 'admin_secreto', 'ADMIN_TRIAL', ?, ?)`)
      .run(subId, companyId, plano, PLANOS[plano].preco, PLANOS[plano].preco,
        inicio, trialFim, trialFim, TRIAL_SECRETO_DIAS, inicio, inicio);
    db.prepare("UPDATE companies SET assinatura = ? WHERE id = ?").run(plano, companyId);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
  if (user) {
    notificar(user.id, "assinatura", "Período de acesso liberado",
      `Seu acesso ao plano ${planoDe(plano).nome} está liberado até ${new Date(trialFim).toLocaleDateString("pt-BR")}.`);
  }

  res.status(201).json({
    ok: true,
    subscriptionId: subId,
    plano,
    status: "trial",
    trialDias: TRIAL_SECRETO_DIAS,
    trialFim,
  });
});

router.get("/subscription", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });

  const empresa = db.prepare("SELECT assinatura FROM companies WHERE id = ?").get(entityId);
  const atual = db.prepare("SELECT * FROM subscriptions WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 1").get(entityId);
  const chave = empresa?.assinatura || "free";

  res.json({ plano: chave, detalhes: { chave, ...planoDe(chave) }, assinatura: atual || null });
});

// Contratar um plano. O Free é imediato; os pagos geram cobrança recorrente e
// só passam a valer quando o gateway confirmar o pagamento.
router.post("/subscription", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem assinar" });

  const chave = String(req.body?.plano || "").trim();
  if (!PLANOS[chave]) return res.status(400).json({ error: "Plano inválido" });

  const plano = PLANOS[chave];
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  // Checkout pendente não pode mais ser um beco sem saída. Antes isto recusava
  // com 409 e a empresa ficava presa: sem link válido e sem como gerar outro.
  //
  // Mas gerar uma assinatura nova a cada clique também não serve — cada
  // POST /subscriptions abre uma recorrência DE VERDADE no gateway, e duas
  // recorrências é cobrança dobrada todo mês.
  //
  // A saída é reaproveitar: mesmo plano, mesma assinatura, link novo.
  const pendente = db.prepare(
    "SELECT * FROM subscriptions WHERE companyId = ? AND status = 'pendente' ORDER BY criadoEm DESC LIMIT 1"
  ).get(entityId);

  // Só o Pix se reaproveita. Cartão pendente é cobrança em análise ou recusada:
  // ali a empresa precisa informar os dados de novo, e renovar o link sem
  // cartão criaria uma cobrança que ninguém consegue pagar.
  const pendenteEhPix = pendente && (pendente.formaPagamento || "PIX") === "PIX";

  if (pendente && pendenteEhPix && pendente.plano === chave && pendente.asaasId && asaasAtivo()) {
    try {
      const link = await renovarLinkDePagamento(pendente);
      if (link) {
        return res.json({
          ok: true, reaproveitado: true,
          subscriptionId: pendente.id, asaasId: pendente.asaasId,
          valorOriginal: pendente.valorOriginal, desconto: pendente.desconto, valorFinal: pendente.valor,
          status: "pendente", formaPagamento: pendente.formaPagamento || null,
          ...link,
          message: "Geramos um novo link para o checkout que já estava aberto.",
        });
      }
    } catch (err) {
      // Se o gateway não devolver um link utilizável, seguimos adiante e
      // criamos uma assinatura nova — depois de cancelar esta, logo abaixo.
      console.warn("[assinatura] não deu para renovar o link:", err.message);
    }
  }

  // Pendente de OUTRO plano, ou pendente sem link recuperável: cancela antes
  // de abrir a próxima. Deixar as duas vivas no gateway é cobrar duas vezes.
  if (pendente) {
    if (pendente.asaasId && asaasAtivo()) {
      try { await asaas(`/subscriptions/${pendente.asaasId}`, { method: "DELETE" }); }
      catch (e) { console.warn("[asaas] cancelamento do checkout anterior:", e.message); }
    }
    db.transaction(() => {
      db.prepare("UPDATE subscriptions SET status = 'cancelada', atualizadoEm = ? WHERE id = ?").run(agora(), pendente.id);
      db.prepare("UPDATE voucher_redemptions SET status = 'cancelado' WHERE subscriptionId = ? AND status = 'reservado'").run(pendente.id);
    })();
    console.log(`[assinatura] checkout anterior cancelado para abrir outro: empresa ${entityId}`);
  }

  if (chave === "free") {
    db.transaction(() => {
      db.prepare("UPDATE companies SET assinatura = 'free' WHERE id = ?").run(entityId);
      db.prepare("UPDATE subscriptions SET status = 'cancelada' WHERE companyId = ? AND status = 'ativa'").run(entityId);
    })();
    return res.json({ ok: true, plano: "free", message: "Plano alterado para Free." });
  }

  if (!asaasAtivo())
    return res.status(503).json({ error: "Pagamentos indisponíveis no momento. Tente mais tarde." });
  if (!empresa.documento)
    return res.status(400).json({ error: "Cadastre o CNPJ ou CPF da empresa antes de assinar." });

  // Antes exigia depósito prévio para existir cliente no gateway. Ninguém
  // deposita caixa de campanha só para poder assinar: o cliente nasce aqui.
  let customerId;
  try {
    customerId = await garantirCliente(db, empresa);
  } catch (err) {
    return res.status(err.faltaDocumento ? 400 : 502).json({ error: err.message });
  }

  const subId = uid();
  try {
    let voucher=null, calculo={valorOriginal:plano.preco,desconto:0,valorFinal:plano.preco};
    if(req.body?.voucher){const v=validarVoucher(db,{codigo:req.body.voucher,plano:chave,companyId:entityId});if(!v.ok)return res.status(422).json({error:v.error});voucher=v.voucher;calculo=calcularVoucher(plano.preco,voucher);}
    if(calculo.valorFinal<5)return res.status(422).json({error:"O total do checkout precisa ser de pelo menos R$ 5,00 para pagamento via Pix."});
    // Cartão é a forma prioritária; Pix continua aceito e a estrutura já
    // comporta o Pix Automático quando ele entrar.
    const forma = String(req.body?.formaPagamento || "CREDIT_CARD").toUpperCase();
    if (!["CREDIT_CARD", "PIX"].includes(forma))
      return res.status(400).json({ error: "Forma de pagamento inválida." });

    // Com trial, a primeira cobrança cai no fim dele. Sem trial, em 3 dias —
    // prazo que o Pix precisa para o boleto/QR não vencer antes de ser pago.
    const trialDias = TRIAL_DIAS_PUBLICO;
    const vencimento = trialDias
      ? primeiraCobranca({ trialDias })
      : new Date(Date.now() + 3 * 86400000);

    const corpo = {
      customer: customerId,
      billingType: forma,
      value: calculo.valorFinal,
      nextDueDate: vencimento.toISOString().split("T")[0],
      cycle: "MONTHLY",
      description: `RYCS ${plano.nome} — assinatura mensal`,
      externalReference: `sub:${entityId}`,
    };

    // Dados do cartão vão ao gateway e não ficam aqui. O que voltamos a
    // guardar é o que o Asaas devolve tokenizado: bandeira e quatro dígitos.
    if (forma === "CREDIT_CARD") {
      const cartao = req.body?.cartao || {};
      const titular = req.body?.titular || {};
      const faltando = ["numero", "validadeMes", "validadeAno", "cvv", "nome"].filter((k) => !String(cartao[k] || "").trim());
      if (faltando.length) return res.status(400).json({ error: "Preencha todos os dados do cartão." });

      corpo.creditCard = {
        holderName: cartao.nome,
        number: String(cartao.numero).replace(/\D/g, ""),
        expiryMonth: String(cartao.validadeMes).padStart(2, "0"),
        expiryYear: String(cartao.validadeAno).length === 2 ? `20${cartao.validadeAno}` : String(cartao.validadeAno),
        ccv: String(cartao.cvv),
      };
      corpo.creditCardHolderInfo = {
        name: titular.nome || cartao.nome,
        email: titular.email || undefined,
        cpfCnpj: String(titular.documento || empresa.documento).replace(/\D/g, ""),
        postalCode: String(titular.cep || "").replace(/\D/g, ""),
        addressNumber: String(titular.numero || "") || "0",
        phone: String(titular.telefone || empresa.telefoneEmpresa || "").replace(/\D/g, "") || undefined,
      };
      if (req.body?.remoteIp) corpo.remoteIp = String(req.body.remoteIp);
    }

    const cobranca = await asaas("/subscriptions", { method: "POST", body: corpo });

    let pagamento=null,pix=null;
    try{const lista=await asaas(`/payments?subscription=${encodeURIComponent(cobranca.id)}&limit=1`);pagamento=lista?.data?.[0]||null;if(pagamento?.id)pix=await asaas(`/payments/${pagamento.id}/pixQrCode`);}catch(e){console.warn("[asaas] QR da assinatura:",e.message);}

    // Com trial, a assinatura já nasce liberando acesso: o cartão foi
    // cadastrado e a cobrança está agendada. Sem trial, fica pendente até o
    // gateway confirmar — liberar antes seria dar acesso sem receber.
    const statusInicial = trialDias > 0 ? "trial" : "pendente";
    const trialFim = trialDias > 0 ? vencimento.getTime() : null;
    const cartaoInfo = cobranca.creditCard || {};

    db.transaction(()=>{db.prepare(`INSERT INTO subscriptions (id, companyId, plano, status, asaasId, valor, valorOriginal, desconto, voucherId, paymentId, invoiceUrl, criadoEm, trialFim, trialDias, formaPagamento, cartaoFinal, cartaoBandeira, proximaCobranca, atualizadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(subId, entityId, chave, statusInicial, cobranca.id, calculo.valorFinal, calculo.valorOriginal, calculo.desconto, voucher?.id||null, pagamento?.id||null, pagamento?.invoiceUrl||cobranca.invoiceUrl||null, agora(),
           trialFim, trialDias, forma, cartaoInfo.creditCardNumber || "", cartaoInfo.creditCardBrand || "", vencimento.getTime(), agora());
      // Trial já vale como plano corrente na empresa: é o que libera as telas.
      if (trialDias > 0) db.prepare("UPDATE companies SET assinatura = ? WHERE id = ?").run(chave, entityId);
      if(voucher)db.prepare(`INSERT INTO voucher_redemptions (id,voucherId,companyId,subscriptionId,valorOriginal,desconto,valorFinal,status,criadoEm) VALUES (?,?,?,?,?,?,?,'reservado',?)`).run(uid(),voucher.id,entityId,subId,calculo.valorOriginal,calculo.desconto,calculo.valorFinal,agora());})();

    // O plano só passa a valer no primeiro pagamento confirmado — o webhook
    // é quem ativa. Liberar antes daria acesso sem receber.
    res.json({
      ok: true, subscriptionId: subId, asaasId: cobranca.id, ...calculo,
      pixCopiaECola:pix?.payload||null, pixQrCodeBase64:pix?.encodedImage||null,
      invoiceUrl: pagamento?.invoiceUrl||cobranca.invoiceUrl||null,
      status: statusInicial,
      formaPagamento: forma,
      trialDias,
      trialFim,
      primeiraCobranca: vencimento.getTime(),
      cartaoFinal: cartaoInfo.creditCardNumber || null,
      cartaoBandeira: cartaoInfo.creditCardBrand || null,
      message: trialDias > 0
        ? `Conta ativada. Seu período gratuito termina em ${vencimento.toLocaleDateString("pt-BR")} e a cobrança de R$ ${calculo.valorFinal.toFixed(2).replace(".", ",")} acontece automaticamente nessa data.`
        : "Assinatura criada. O plano é liberado assim que o primeiro pagamento for confirmado.",
    });
  } catch (err) {
    console.error("[asaas] assinatura:", err.message);
    res.status(502).json({ error: err instanceof AsaasError ? err.message : "Erro ao criar assinatura" });
  }
});

router.delete("/subscription", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });

  const atual = db.prepare("SELECT * FROM subscriptions WHERE companyId = ? AND status IN ('ativa','pendente','trial') ORDER BY criadoEm DESC LIMIT 1").get(entityId);
  if (!atual) return res.status(404).json({ error: "Nenhuma assinatura ativa" });

  if (atual.asaasId && asaasAtivo()) {
    try { await asaas(`/subscriptions/${atual.asaasId}`, { method: "DELETE" }); }
    catch (e) { console.warn("[asaas] cancelamento:", e.message); }
  }

  db.transaction(() => {
    db.prepare("UPDATE subscriptions SET status = 'cancelada' WHERE id = ?").run(atual.id);
    db.prepare("UPDATE voucher_redemptions SET status = 'cancelado' WHERE subscriptionId = ? AND status = 'reservado'").run(atual.id);
    db.prepare("UPDATE companies SET assinatura = 'free' WHERE id = ?").run(entityId);
  })();

  res.json({ ok: true, message: "Assinatura cancelada. Sua conta voltou ao plano Free." });
});

// Chamado pelo webhook do gateway quando uma cobrança de assinatura é paga.
// Cobrança que falhou ou venceu. Não cancela nem apaga nada: marca o estado
// para a empresa conseguir entrar e regularizar. Bloquear o login de quem
// precisa atualizar o cartão é impedir exatamente quem quer pagar.
// Um link de pagamento vivo para uma assinatura que já existe no gateway.
//
// Cobrança de Pix vence. Quando isso acontece, o checkout continua "pendente"
// aqui mas o QR não paga mais nada — que é exatamente a situação em que a
// empresa precisa de link novo e antes recebia uma recusa.
//
// A assinatura no Asaas NÃO é recriada: pedimos a ela a cobrança corrente, e
// só se não houver nenhuma pagável é que geramos a próxima dentro dela.
async function renovarLinkDePagamento(sub) {
  const PAGAVEL = ["PENDING", "AWAITING_RISK_ANALYSIS", "AWAITING_PAYMENT"];

  const lista = await asaas(`/payments?subscription=${encodeURIComponent(sub.asaasId)}&limit=10`);
  const cobrancas = lista?.data || [];

  // Já pago? Então não é caso de link novo: o webhook é que está atrasado.
  const paga = cobrancas.find((c) => ["RECEIVED", "CONFIRMED"].includes(c.status));
  if (paga) {
    ativarAssinatura(sub.asaasId);
    return { jaPago: true, invoiceUrl: paga.invoiceUrl || null };
  }

  let cobranca = cobrancas.find((c) => PAGAVEL.includes(c.status));

  // Nenhuma cobrança pagável: todas venceram. Cria a próxima dentro da mesma
  // assinatura — uma cobrança a mais, não uma recorrência a mais.
  if (!cobranca) {
    cobranca = await asaas("/payments", {
      method: "POST",
      body: {
        customer: (await asaas(`/subscriptions/${sub.asaasId}`))?.customer,
        billingType: sub.formaPagamento || "PIX",
        value: sub.valor,
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        description: `RYCS ${planoDe(sub.plano).nome} — nova tentativa de pagamento`,
        externalReference: `sub:${sub.companyId}`,
      },
    });
  }

  if (!cobranca?.id) return null;

  let pix = null;
  if ((sub.formaPagamento || "PIX") === "PIX") {
    try { pix = await asaas(`/payments/${cobranca.id}/pixQrCode`); }
    catch (e) { console.warn("[asaas] QR da renovação:", e.message); }
  }

  db.prepare("UPDATE subscriptions SET paymentId = ?, invoiceUrl = ?, atualizadoEm = ? WHERE id = ?")
    .run(cobranca.id, cobranca.invoiceUrl || null, agora(), sub.id);

  return {
    pixCopiaECola: pix?.payload || null,
    pixQrCodeBase64: pix?.encodedImage || null,
    invoiceUrl: cobranca.invoiceUrl || null,
  };
}

export function marcarInadimplencia(asaasSubscriptionId, motivo = "") {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE asaasId = ?").get(asaasSubscriptionId);
  if (!sub || sub.status === "cancelada") return;

  db.prepare("UPDATE subscriptions SET status = 'inadimplente', falhaMotivo = ?, atualizadoEm = ? WHERE id = ?")
    .run(String(motivo).slice(0, 300), agora(), sub.id);

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(sub.companyId);
  if (user) {
    notificar(user.id, "assinatura", "Não conseguimos processar seu pagamento",
      "Atualize a forma de pagamento para voltar a usar a plataforma. Seus dados continuam salvos.");
  }
  console.warn(`[assinatura] inadimplente: empresa ${sub.companyId} — ${motivo}`);
}

export function ativarAssinatura(asaasSubscriptionId) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE asaasId = ?").get(asaasSubscriptionId);
  if (!sub || sub.status === "ativa") return;

  db.transaction(() => {
    // A próxima cobrança é um mês à frente. Guardada aqui para o painel do
    // admin mostrar sem precisar consultar o gateway a cada abertura de tela.
    const proxima = new Date();
    proxima.setMonth(proxima.getMonth() + 1);
    db.prepare("UPDATE subscriptions SET status = 'ativa', inicio = COALESCE(inicio, ?), proximaCobranca = ?, falhaMotivo = NULL, atualizadoEm = ? WHERE id = ?")
      .run(agora(), proxima.getTime(), agora(), sub.id);
    db.prepare("UPDATE companies SET assinatura = ? WHERE id = ?").run(sub.plano, sub.companyId);
    db.prepare("UPDATE voucher_redemptions SET status = 'confirmado', confirmadoEm = ? WHERE subscriptionId = ? AND status = 'reservado'").run(agora(),sub.id);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(sub.companyId);
  if (user) { notificar(user.id, "assinatura", `Plano ${planoDe(sub.plano).nome} ativado!`); qualificarIndicacao(user.id); }
}

export default router;
