// Rótulos e formatos das telas de WhatsApp do admin.
import { money } from "../../lib/utils.js";

export const dataHora = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
export const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);

// Valor em dinheiro na moeda da conta. Custo por mensagem precisa de mais casas.
export function valor(n, moeda, unitario = false) {
  if (n == null) return "—";
  if (!unitario) return money(n, moeda || "BRL");
  const m = String(moeda || "BRL").toUpperCase();
  try { return Number(n).toLocaleString(m === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency: m, minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
  catch { return `${m} ${Number(n).toFixed(4)}`; }
}

export const CATEGORIA = {
  MARKETING: "Marketing", UTILITY: "Utilidade", AUTHENTICATION: "Autenticação", AUTHENTICATION_INTERNATIONAL: "Autenticação internacional",
  SERVICE: "Atendimento", REFERRAL_CONVERSION: "Vindo de anúncio", MARKETING_LITE: "Marketing Lite",
  marketing: "Marketing", utility: "Utilidade", authentication: "Autenticação", service: "Atendimento", referral_conversion: "Vindo de anúncio",
};
export const categoria = (c) => CATEGORIA[c] || c || "—";

export const STATUS_MENSAGEM = {
  fila: ["Na fila", "var(--muted)"], enviado: ["Enviada", "var(--brand)"], falhou: ["Falhou", "var(--red)"],
  sent: ["Enviada", "var(--brand)"], delivered: ["Entregue", "var(--green)"], read: ["Lida", "var(--green)"], failed: ["Falhou", "var(--red)"],
};

export const STATUS_MODELO = {
  APPROVED: ["Aprovado", "var(--green)"], PENDING: ["Em análise", "var(--amber)"], REJECTED: ["Recusado", "var(--red)"],
  PAUSED: ["Pausado", "var(--amber)"], DISABLED: ["Desativado", "var(--red)"], IN_APPEAL: ["Em recurso", "var(--amber)"],
};

export const QUALIDADE = {
  GREEN: ["Alta", "var(--green)"], YELLOW: ["Média", "var(--amber)"], RED: ["Baixa", "var(--red)"], UNKNOWN: ["Ainda sem avaliação", "var(--muted)"], "": ["—", "var(--muted)"],
};

export const LIMITE = {
  TIER_50: "50 pessoas por dia", TIER_250: "250 pessoas por dia", TIER_1K: "1.000 pessoas por dia", TIER_2K: "2.000 pessoas por dia",
  TIER_10K: "10.000 pessoas por dia", TIER_100K: "100.000 pessoas por dia", TIER_UNLIMITED: "Sem limite",
};

export const PODE_ENVIAR = { AVAILABLE: ["Pode enviar", "var(--green)"], LIMITED: ["Envio limitado", "var(--amber)"], BLOCKED: ["Bloqueado", "var(--red)"] };

export const QUEM_PAGA = {
  SELF: "O próprio negócio Rycs Sales Machine, pela forma de pagamento cadastrada na Meta.",
  CLIENT_OWNED: "O negócio dono da conta, pela forma de pagamento cadastrada na Meta.",
  ON_BEHALF_OF: "Um parceiro da Meta (provedor) que administra a conta.",
};

export const caixa = { border: "1px solid var(--border)", borderRadius: 10, padding: 12 };

export function Selo({ par }) {
  const [txt, cor] = par || ["—", "var(--muted)"];
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: cor }}>{txt}</span>;
}

export function ErroMeta({ erro }) {
  if (!erro) return null;
  return <div style={{ fontSize: 12.5, color: "var(--red)", lineHeight: 1.5 }}>A Meta não liberou esta informação: {erro}</div>;
}
