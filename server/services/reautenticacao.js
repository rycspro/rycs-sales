// Reautenticação para operações financeiras sensíveis (troca de Pix, saque,
// dados bancários).
//
// O modal de confirmação já está publicado no frontend (Carteira + troca de Pix
// tratam `reauth:true`), então a exigência fica ATIVA por padrão em produção.
// Em test/dev continua desligada (para não quebrar fluxos e testes que não
// confirmam senha), salvo REAUTH_FINANCEIRO=1. Override explícito em qualquer
// ambiente: REAUTH_FINANCEIRO=0 desliga; REAUTH_FINANCEIRO=1 liga.
//
// Limite de tentativas em memória (processo único). Para múltiplas instâncias,
// trocar por um store compartilhado — documentado na entrega.

import bcrypt from "bcryptjs";
import db from "../db.js";

export const reauthAtivo = () =>
  process.env.REAUTH_FINANCEIRO === "1" ||
  (process.env.NODE_ENV === "production" && process.env.REAUTH_FINANCEIRO !== "0");

const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map(); // chave -> { falhas, primeira, travadoAte }

export function estadoLimite(chave, agoraMs = Date.now()) {
  const t = tentativas.get(chave);
  if (!t) return { bloqueado: false, restantes: MAX_FALHAS };
  if (t.travadoAte && agoraMs < t.travadoAte) return { bloqueado: true, travadoAte: t.travadoAte };
  if (t.primeira && agoraMs - t.primeira > JANELA_MS) { tentativas.delete(chave); return { bloqueado: false, restantes: MAX_FALHAS }; }
  return { bloqueado: false, restantes: Math.max(0, MAX_FALHAS - t.falhas) };
}

export function registrarFalha(chave, agoraMs = Date.now()) {
  const t = tentativas.get(chave) || { falhas: 0, primeira: agoraMs, travadoAte: 0 };
  t.falhas += 1;
  if (t.falhas >= MAX_FALHAS) t.travadoAte = agoraMs + JANELA_MS;
  tentativas.set(chave, t);
  return t;
}

export function limparTentativas(chave) { tentativas.delete(chave); }

export function senhaConfere(userId, senha) {
  if (!senha) return false;
  const u = db.prepare("SELECT senha FROM users WHERE id = ?").get(userId);
  if (!u?.senha) return false;
  try { return bcrypt.compareSync(String(senha), u.senha); } catch { return false; }
}

// Verifica a reautenticação de uma operação. Retorna { ok } ou
// { ok:false, status, error } pronto para a resposta HTTP. A senha nunca é
// logada nem devolvida.
export function exigirReauth(req, { userId, senha, acao, ip }) {
  if (!reauthAtivo()) return { ok: true, pulado: true };
  const chave = `${userId}:${ip || req?.ip || "?"}:${acao}`;
  const limite = estadoLimite(chave);
  if (limite.bloqueado) return { ok: false, status: 429, error: "Muitas tentativas. Tente novamente mais tarde." };
  if (!senha) return { ok: false, status: 401, error: "Confirme sua senha para continuar." };
  if (!senhaConfere(userId, senha)) {
    registrarFalha(chave);
    return { ok: false, status: 401, error: "Senha incorreta." };
  }
  limparTentativas(chave);
  return { ok: true };
}
