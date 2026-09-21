import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError, garantirCliente } from "../services/asaas.js";
import { acessoDaEmpresa, primeiraCobranca } from "../../shared/assinatura.js";
import { PLANOS, ORDEM_PLANOS, planoDe } from "../../shared/planos.js";
import { calcularVoucher, normalizarVoucher, validarVoucher } from "../services/vouchers.js";
import { qualificarIndicacao } from "../services/indicacoes.js";

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

// Dias de período gratuito. Configurável por ambiente: zero desliga o trial
// sem mexer em código, que é o que a operação precisa para testar oferta.
const TRIAL_DIAS = Math.max(0, Number(process.env.TRIAL_DIAS || 0));

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

  const empresas = db.prepare("SELECT id, nome, assinatura, criadoEm FROM companies ORDER BY nome").all();
  const assinaturas = db.prepare(
    "SELECT * FROM subscriptions WHERE status != 'cancelada' ORDER BY criadoEm DESC"
  ).all();
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
      desde: e.criadoEm,
    };
  });

  const resumo = linhas.reduce((acc, l) => ({ ...acc, [l.estado]: (acc[l.estado] || 0) + 1 }), {});
  res.json({ linhas, resumo, total: linhas.length });
});

router.get("/subscription/access", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.json({ liberado: true, estado: "ativa" });

  const empresa = db.prepare("SELECT assinatura FROM companies WHERE id = ?").get(entityId);
  const assinatura = db.prepare(
    "SELECT * FROM subscriptions WHERE companyId = ? AND status != 'cancelada' ORDER BY criadoEm DESC LIMIT 1"
  ).get(entityId);

  res.json({ ...acessoDaEmpresa({ empresa, assinatura }), assinatura: assinatura || null, trialDisponivel: TRIAL_DIAS });
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

  const pendente = db.prepare("SELECT id FROM subscriptions WHERE companyId = ? AND plano = ? AND status = 'pendente' ORDER BY criadoEm DESC LIMIT 1").get(entityId,chave);
  if (pendente) return res.status(409).json({ error:"Já existe um checkout pendente para este plano. Aguarde o pagamento ou cancele antes de criar outro.", subscriptionId:pendente.id });

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
    const trialDias = forma === "CREDIT_CARD" ? TRIAL_DIAS : 0;
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

  const atual = db.prepare("SELECT * FROM subscriptions WHERE companyId = ? AND status IN ('ativa','pendente') ORDER BY criadoEm DESC LIMIT 1").get(entityId);
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
