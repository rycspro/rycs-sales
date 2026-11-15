// Auditoria de operações sensíveis.
//
// Política:
// - NUNCA registrar senha, token, chave Pix completa, cartão ou valor
//   financeiro bruto sensível. O `contexto` é mascarado antes de gravar.
// - Falha segura: para operações comuns a gravação é best-effort (try/catch,
//   nunca derruba a operação); para operações CRÍTICAS (saque, troca de Pix),
//   quem chama passa `critico: true` e grava DENTRO da mesma transação do
//   negócio (ver `auditarCritico`), de modo que sem trilha não há operação.
// - Retenção: `expurgarAntigos` remove registros além de RETENCAO_DIAS.

import db, { uid, agora } from "../db.js";

export const RETENCAO_DIAS = 730; // 24 meses

// Mascara valores potencialmente sensíveis. Pix/chave: só os 2 últimos
// caracteres. Nunca deixa passar campos de segredo.
const PROIBIDOS = new Set(["senha", "password", "token", "jwt", "secret", "cvv", "cartao", "card"]);
function mascarar(contexto = {}) {
  const out = {};
  for (const [k, v] of Object.entries(contexto)) {
    const chave = String(k).toLowerCase();
    if (PROIBIDOS.has(chave)) continue; // nunca registra
    if (/pix|chave|conta|iban|agencia|documento|cpf|cnpj/.test(chave) && typeof v === "string" && v.length > 2) {
      out[k] = `•••${v.slice(-2)}`;
    } else if (typeof v === "object" && v !== null) {
      out[k] = mascarar(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function registro({ ator = null, papel = null, acao, alvo = null, contexto = {}, resultado = "ok", req = null }) {
  return [
    uid(), ator, papel, acao, alvo,
    JSON.stringify(mascarar(contexto)), resultado,
    req?.ip || null, String(req?.headers?.["user-agent"] || "").slice(0, 200) || null, agora(),
  ];
}

const INSERT = `INSERT INTO security_audit (id, ator, papel, acao, alvo, contexto, resultado, ip, userAgent, criadoEm)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Best-effort: jamais lança para o fluxo de negócio.
export function auditarSeguranca(ev) {
  try { db.prepare(INSERT).run(...registro(ev)); } catch (e) { console.warn("[audit] falha ao registrar:", e.message); }
}

// Crítico: para usar DENTRO de uma transação já aberta pelo chamador, para que
// a operação financeira e a trilha sejam atômicas (sem trilha → rollback).
export function auditarCritico(ev) {
  db.prepare(INSERT).run(...registro(ev));
}

export function expurgarAntigos(agoraMs = agora()) {
  const limite = agoraMs - RETENCAO_DIAS * 24 * 60 * 60 * 1000;
  return db.prepare("DELETE FROM security_audit WHERE criadoEm < ?").run(limite).changes;
}
