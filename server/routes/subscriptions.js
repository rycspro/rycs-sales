import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError } from "../services/asaas.js";
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
  if (!empresa.asaasCustomerId)
    return res.status(400).json({ error: "Faça um depósito primeiro para registrar sua empresa no gateway." });

  const subId = uid();
  try {
    let voucher=null, calculo={valorOriginal:plano.preco,desconto:0,valorFinal:plano.preco};
    if(req.body?.voucher){const v=validarVoucher(db,{codigo:req.body.voucher,plano:chave,companyId:entityId});if(!v.ok)return res.status(422).json({error:v.error});voucher=v.voucher;calculo=calcularVoucher(plano.preco,voucher);}
    if(calculo.valorFinal<5)return res.status(422).json({error:"O total do checkout precisa ser de pelo menos R$ 5,00 para pagamento via Pix."});
    const cobranca = await asaas("/subscriptions", {
      method: "POST",
      body: {
        customer: empresa.asaasCustomerId,
        billingType: "PIX",
        value: calculo.valorFinal,
        nextDueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        cycle: "MONTHLY",
        description: `RYCS ${plano.nome} — assinatura mensal`,
        externalReference: `sub:${entityId}`,
      },
    });

    let pagamento=null,pix=null;
    try{const lista=await asaas(`/payments?subscription=${encodeURIComponent(cobranca.id)}&limit=1`);pagamento=lista?.data?.[0]||null;if(pagamento?.id)pix=await asaas(`/payments/${pagamento.id}/pixQrCode`);}catch(e){console.warn("[asaas] QR da assinatura:",e.message);}

    db.transaction(()=>{db.prepare(`INSERT INTO subscriptions (id, companyId, plano, status, asaasId, valor, valorOriginal, desconto, voucherId, paymentId, invoiceUrl, criadoEm)
                VALUES (?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(subId, entityId, chave, cobranca.id, calculo.valorFinal, calculo.valorOriginal, calculo.desconto, voucher?.id||null, pagamento?.id||null, pagamento?.invoiceUrl||cobranca.invoiceUrl||null, agora());
      if(voucher)db.prepare(`INSERT INTO voucher_redemptions (id,voucherId,companyId,subscriptionId,valorOriginal,desconto,valorFinal,status,criadoEm) VALUES (?,?,?,?,?,?,?,'reservado',?)`).run(uid(),voucher.id,entityId,subId,calculo.valorOriginal,calculo.desconto,calculo.valorFinal,agora());})();

    // O plano só passa a valer no primeiro pagamento confirmado — o webhook
    // é quem ativa. Liberar antes daria acesso sem receber.
    res.json({
      ok: true, subscriptionId: subId, asaasId: cobranca.id, ...calculo,
      pixCopiaECola:pix?.payload||null,pixQrCodeBase64:pix?.encodedImage||null,invoiceUrl:pagamento?.invoiceUrl||cobranca.invoiceUrl||null,status:"pendente",
      message: "Assinatura criada. O plano é liberado assim que o primeiro pagamento for confirmado.",
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
export function ativarAssinatura(asaasSubscriptionId) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE asaasId = ?").get(asaasSubscriptionId);
  if (!sub || sub.status === "ativa") return;

  db.transaction(() => {
    db.prepare("UPDATE subscriptions SET status = 'ativa', inicio = COALESCE(inicio, ?) WHERE id = ?")
      .run(agora(), sub.id);
    db.prepare("UPDATE companies SET assinatura = ? WHERE id = ?").run(sub.plano, sub.companyId);
    db.prepare("UPDATE voucher_redemptions SET status = 'confirmado', confirmadoEm = ? WHERE subscriptionId = ? AND status = 'reservado'").run(agora(),sub.id);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(sub.companyId);
  if (user) { notificar(user.id, "assinatura", `Plano ${planoDe(sub.plano).nome} ativado!`); qualificarIndicacao(user.id); }
}

export default router;
