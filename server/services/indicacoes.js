import db, { uid, agora } from "../db.js";
import { notificar } from "../routes/notifications.js";
import { gerarCodigo, normalizarCodigo, recompensaDe, GATILHOS } from "../../shared/indicacoes.js";

// Cada usuário recebe um código na primeira vez que consulta o seu.
export function codigoDoUsuario(userId) {
  const u = db.prepare("SELECT codigoIndicacao FROM users WHERE id = ?").get(userId);
  if (u?.codigoIndicacao) return u.codigoIndicacao;

  // Colisão é improvável, mas a coluna não é única — tentar de novo é mais
  // barato do que dois usuários dividirem o mesmo código.
  for (let i = 0; i < 8; i++) {
    const c = gerarCodigo();
    const existe = db.prepare("SELECT id FROM users WHERE codigoIndicacao = ?").get(c);
    if (!existe) {
      db.prepare("UPDATE users SET codigoIndicacao = ? WHERE id = ?").run(c, userId);
      return c;
    }
  }
  return null;
}

// Registra o vínculo no cadastro. Nada é creditado aqui: a recompensa só
// aparece quando o indicado produzir atividade real.
export function vincularIndicacao(codigo, novoUserId, papelIndicado) {
  const c = normalizarCodigo(codigo);
  if (!c) return null;

  const indicador = db.prepare("SELECT id, role FROM users WHERE codigoIndicacao = ?").get(c);
  if (!indicador) return null;
  if (indicador.id === novoUserId) return null; // não se indica sozinho

  const premio = recompensaDe(indicador.role, papelIndicado);
  if (!premio) return null;

  try {
    db.prepare(`INSERT INTO referrals (id, codigo, indicadorUserId, indicadoUserId, papelIndicador, papelIndicado, valor, status, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`)
      .run(uid(), c, indicador.id, novoUserId, indicador.role, papelIndicado, premio.valor, agora());
  } catch {
    return null; // já vinculado
  }

  notificar(indicador.id, "indicacao", "Sua indicação se cadastrou",
    `A recompensa de R$ ${premio.valor.toFixed(2)} é liberada após ${GATILHOS[papelIndicado]}.`);
  return indicador.id;
}

// Chamado quando o indicado produz a atividade que qualifica a recompensa.
// Idempotente: só age sobre indicações ainda pendentes.
export function qualificarIndicacao(userIdDoIndicado) {
  const ref = db.prepare("SELECT * FROM referrals WHERE indicadoUserId = ? AND status = 'pendente'").get(userIdDoIndicado);
  if (!ref) return null;

  const indicador = db.prepare("SELECT id, role, entityId FROM users WHERE id = ?").get(ref.indicadorUserId);
  if (!indicador?.entityId) return null;

  db.transaction(() => {
    db.prepare("UPDATE referrals SET status = 'pago', qualificadoEm = ? WHERE id = ?").run(agora(), ref.id);
    if (indicador.role === "vendedor") {
      db.prepare("UPDATE sellers SET disponivel = disponivel + ? WHERE id = ?").run(ref.valor, indicador.entityId);
    } else if (indicador.role === "empresa") {
      db.prepare("UPDATE companies SET saldo = saldo + ? WHERE id = ?").run(ref.valor, indicador.entityId);
    }
  })();

  notificar(indicador.id, "indicacao", "Recompensa de indicação liberada!",
    `R$ ${ref.valor.toFixed(2)} creditados na sua conta.`);
  return ref;
}

export function resumoDoUsuario(userId) {
  const lista = db.prepare(`
    SELECT r.*, u.email AS emailIndicado
    FROM referrals r JOIN users u ON u.id = r.indicadoUserId
    WHERE r.indicadorUserId = ? ORDER BY r.criadoEm DESC LIMIT 50
  `).all(userId);

  return {
    codigo: codigoDoUsuario(userId),
    indicacoes: lista.map((r) => ({
      // O e-mail de quem foi indicado é dado de terceiro: mostra só o
      // suficiente para a pessoa reconhecer quem indicou.
      contato: mascararEmail(r.emailIndicado),
      papel: r.papelIndicado,
      valor: r.valor,
      status: r.status,
      criadoEm: r.criadoEm,
    })),
    totalGanho: lista.filter((r) => r.status === "pago").reduce((a, r) => a + r.valor, 0),
    totalPendente: lista.filter((r) => r.status === "pendente").reduce((a, r) => a + r.valor, 0),
  };
}

function mascararEmail(email) {
  const [nome, dominio] = String(email || "").split("@");
  if (!dominio) return "—";
  const visivel = nome.slice(0, 2);
  return `${visivel}${"•".repeat(Math.max(3, nome.length - 2))}@${dominio}`;
}
