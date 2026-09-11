export const normalizarVoucher = (codigo) => String(codigo || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);

export function calcularVoucher(preco, voucher) {
  const original = Math.max(0, Number(preco) || 0);
  const bruto = voucher?.tipo === "percentual" ? original * (Number(voucher.valor) || 0) / 100 : Number(voucher?.valor) || 0;
  const desconto = Math.min(original, Math.max(0, Math.round(bruto * 100) / 100));
  return { valorOriginal: original, desconto, valorFinal: Math.round((original - desconto) * 100) / 100 };
}

export function validarVoucher(db, { codigo, plano, companyId, agora = Date.now() }) {
  const limpo = normalizarVoucher(codigo);
  if (!limpo) return { ok:false, error:"Informe o código do voucher" };
  const voucher = db.prepare("SELECT * FROM vouchers WHERE codigo = ?").get(limpo);
  if (!voucher || voucher.status !== "ativo") return { ok:false, error:"Voucher inválido ou inativo" };
  if (voucher.validadeEm && Number(voucher.validadeEm) < agora) return { ok:false, error:"Voucher expirado" };
  let planos = []; try { planos=JSON.parse(voucher.planos||"[]"); } catch {}
  if (planos.length && !planos.includes(plano)) return { ok:false, error:"Voucher não se aplica a este plano" };
  const usos = db.prepare("SELECT COUNT(*) n FROM voucher_redemptions WHERE voucherId = ? AND status IN ('reservado','confirmado')").get(voucher.id).n;
  if (voucher.limiteTotal && usos >= voucher.limiteTotal) return { ok:false, error:"Limite total do voucher atingido" };
  const usosEmpresa = db.prepare("SELECT COUNT(*) n FROM voucher_redemptions WHERE voucherId = ? AND companyId = ? AND status IN ('reservado','confirmado')").get(voucher.id, companyId).n;
  if (voucher.limitePorEmpresa && usosEmpresa >= voucher.limitePorEmpresa) return { ok:false, error:"Voucher já utilizado por esta empresa" };
  return { ok:true, voucher };
}
