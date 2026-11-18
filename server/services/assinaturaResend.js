// Assinatura dos webhooks do Resend (Svix). Sem banco, para poder testar.
import { createHmac, timingSafeEqual } from "crypto";

// ─── Assinatura do webhook (Svix) ─────────────────────────────────────────
// Conteúdo assinado: `${svix-id}.${svix-timestamp}.${corpo}`, HMAC-SHA256 com
// o segredo (base64, depois do prefixo "whsec_"). O cabeçalho svix-signature
// traz uma ou mais assinaturas "v1,<base64>".
const TOLERANCIA_S = 5 * 60;
export function assinaturaResendValida({ id, timestamp, assinatura, corpo, segredo = process.env.RESEND_WEBHOOK_SECRET, agora = Date.now() }) {
  if (!segredo || !id || !timestamp || !assinatura || corpo == null) return false;
  if (Math.abs(agora / 1000 - Number(timestamp)) > TOLERANCIA_S) return false;
  let chave;
  try { chave = Buffer.from(String(segredo).replace(/^whsec_/, ""), "base64"); } catch { return false; }
  const esperado = createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest();
  return String(assinatura).split(" ").some((parte) => {
    const [versao, valor] = parte.split(",");
    if (versao !== "v1" || !valor) return false;
    const recebido = Buffer.from(valor, "base64");
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  });
}
