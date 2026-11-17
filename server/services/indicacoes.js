import db, { uid, agora } from "../db.js";
import { notificar } from "../routes/notifications.js";
import {
  gerarCodigo, normalizarCodigo, recompensaDe, GATILHOS,
  VALOR_EMPRESA_ATIVA, valorPrimeiraMensalidade, blocosDeBonus, BONUS_INDICACAO_PROFISSIONAIS,
} from "../../shared/indicacoes.js";
import { planoDe } from "../../shared/planos.js";

const reais = (v) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

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

  // Profissional indicando empresa ou profissional segue a regra nova: o valor
  // começa em zero e acumula o que for de fato creditado.
  const v2 = indicador.role === "vendedor";
  try {
    db.prepare(`INSERT INTO referrals (id, codigo, indicadorUserId, indicadoUserId, papelIndicador, papelIndicado, valor, status, criadoEm, regra)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`)
      .run(uid(), c, indicador.id, novoUserId, indicador.role, papelIndicado, v2 ? 0 : premio.valor, agora(), v2 ? "v2" : "v1");
  } catch {
    return null; // já vinculado
  }

  notificar(indicador.id, "indicacao", "Sua indicação se cadastrou",
    premio.descricao || `A recompensa de ${reais(premio.valor)} é liberada após ${GATILHOS[papelIndicado]}.`);
  return indicador.id;
}

function creditar(indicador, valor) {
  if (!(valor > 0)) return;
  if (indicador.role === "vendedor") {
    db.prepare("UPDATE sellers SET disponivel = disponivel + ? WHERE id = ?").run(valor, indicador.entityId);
  } else if (indicador.role === "empresa") {
    db.prepare("UPDATE companies SET saldo = saldo + ? WHERE id = ?").run(valor, indicador.entityId);
  }
}

const indicadorDe = (ref) => db.prepare("SELECT id, role, entityId FROM users WHERE id = ?").get(ref.indicadorUserId);

// Chamado quando a empresa indicada tem o pagamento de um plano confirmado
// (ou, na regra antiga, quando o indicado produz a atividade que qualifica).
// Idempotente: cada recompensa é paga uma única vez.
export function qualificarIndicacao(userIdDoIndicado, plano = null) {
  const ref = db.prepare("SELECT * FROM referrals WHERE indicadoUserId = ?").get(userIdDoIndicado);
  if (!ref) return null;
  const indicador = indicadorDe(ref);
  if (!indicador?.entityId) return null;

  if (ref.regra !== "v2") {
    if (ref.status !== "pendente") return null;
    db.transaction(() => {
      db.prepare("UPDATE referrals SET status = 'pago', qualificadoEm = ? WHERE id = ?").run(agora(), ref.id);
      creditar(indicador, ref.valor);
    })();
    notificar(indicador.id, "indicacao", "Recompensa de indicação liberada!", `${reais(ref.valor)} creditados na sua conta.`);
    return ref;
  }

  // Regra nova: só a empresa indicada gera percentual de mensalidade.
  if (ref.papelIndicado !== "empresa" || ref.pagamentoEm) return null;
  const valor = valorPrimeiraMensalidade(plano ? planoDe(plano)?.preco : 0);
  if (!(valor > 0)) return null;
  db.transaction(() => {
    db.prepare("UPDATE referrals SET status = 'pago', pagamentoEm = ?, qualificadoEm = COALESCE(qualificadoEm, ?), valor = valor + ? WHERE id = ?")
      .run(agora(), agora(), valor, ref.id);
    creditar(indicador, valor);
  })();
  notificar(indicador.id, "indicacao", "Sua empresa indicada assinou um plano!", `${reais(valor)} creditados na sua conta.`);
  return { ...ref, valor };
}

// Cadastro da empresa indicada aprovado pela RYCS: paga a ativação uma vez.
export function ativarIndicacaoEmpresa(companyId) {
  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
  if (!user) return null;
  const ref = db.prepare("SELECT * FROM referrals WHERE indicadoUserId = ? AND regra = 'v2' AND papelIndicado = 'empresa' AND ativadaEm IS NULL").get(user.id);
  if (!ref) return null;
  const indicador = indicadorDe(ref);
  if (!indicador?.entityId) return null;
  db.transaction(() => {
    db.prepare("UPDATE referrals SET status = 'pago', ativadaEm = ?, qualificadoEm = COALESCE(qualificadoEm, ?), valor = valor + ? WHERE id = ?")
      .run(agora(), agora(), VALOR_EMPRESA_ATIVA, ref.id);
    creditar(indicador, VALOR_EMPRESA_ATIVA);
  })();
  notificar(indicador.id, "indicacao", "Sua empresa indicada foi aprovada!", `${reais(VALOR_EMPRESA_ATIVA)} creditados na sua conta.`);
  return ref;
}

// Profissional indicado completou o perfil: conta para o bônus de bloco de
// quem indicou. Paga cada bloco completo uma única vez.
export function qualificarIndicacaoProfissional(userIdDoIndicado) {
  const ref = db.prepare("SELECT * FROM referrals WHERE indicadoUserId = ? AND regra = 'v2' AND papelIndicado = 'vendedor' AND qualificadoEm IS NULL").get(userIdDoIndicado);
  if (!ref) return null;
  const indicador = indicadorDe(ref);
  if (!indicador?.entityId || indicador.role !== "vendedor") return null;

  let pago = 0;
  db.transaction(() => {
    db.prepare("UPDATE referrals SET status = 'qualificada', qualificadoEm = ? WHERE id = ?").run(agora(), ref.id);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE indicadorUserId = ? AND papelIndicado = 'vendedor' AND qualificadoEm IS NOT NULL").get(indicador.id);
    const seller = db.prepare("SELECT bonusIndicacaoBlocos FROM sellers WHERE id = ?").get(indicador.entityId);
    const novos = blocosDeBonus(n) - (seller?.bonusIndicacaoBlocos || 0);
    if (novos > 0) {
      pago = novos * BONUS_INDICACAO_PROFISSIONAIS.valor;
      db.prepare("UPDATE sellers SET bonusIndicacaoBlocos = bonusIndicacaoBlocos + ? WHERE id = ?").run(novos, indicador.entityId);
      // O bônus fica registrado na indicação que fechou o bloco.
      db.prepare("UPDATE referrals SET status = 'pago', valor = valor + ? WHERE id = ?").run(pago, ref.id);
      creditar(indicador, pago);
    }
  })();
  if (pago > 0) {
    notificar(indicador.id, "indicacao", "Bônus de indicação liberado!",
      `Você fechou um bloco de ${BONUS_INDICACAO_PROFISSIONAIS.bloco} profissionais com perfil completo: ${reais(pago)} creditados.`);
  }
  return { ref, pago };
}

export function resumoDoUsuario(userId) {
  const lista = db.prepare(`
    SELECT r.*, u.email AS emailIndicado
    FROM referrals r JOIN users u ON u.id = r.indicadoUserId
    WHERE r.indicadorUserId = ? ORDER BY r.criadoEm DESC LIMIT 200
  `).all(userId);

  const profissionais = lista.filter((r) => r.papelIndicado === "vendedor");
  const qualificados = profissionais.filter((r) => r.qualificadoEm).length;

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
    profissionais: {
      total: profissionais.length,
      qualificados,
      bloco: BONUS_INDICACAO_PROFISSIONAIS.bloco,
      faltam: BONUS_INDICACAO_PROFISSIONAIS.bloco - (qualificados % BONUS_INDICACAO_PROFISSIONAIS.bloco),
    },
    totalGanho: lista.filter((r) => r.valor > 0 && r.status !== "pendente").reduce((a, r) => a + r.valor, 0),
    totalPendente: lista.filter((r) => r.status === "pendente" && r.regra !== "v2").reduce((a, r) => a + r.valor, 0),
  };
}

function mascararEmail(email) {
  const [nome, dominio] = String(email || "").split("@");
  if (!dominio) return "—";
  const visivel = nome.slice(0, 2);
  return `${visivel}${"•".repeat(Math.max(3, nome.length - 2))}@${dominio}`;
}
