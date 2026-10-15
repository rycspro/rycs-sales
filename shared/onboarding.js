// Onboarding da empresa: as seis etapas, a ordem entre elas e as regras de
// acesso que o servidor e a tela precisam aplicar igual.
//
// A especificação mora em docs/onboarding/SPEC.md. Aqui fica só o que é regra:
// quem decide em qual etapa a empresa está é sempre o servidor, a partir do
// progresso salvo. A URL apenas pede; se pedir uma etapa à frente, volta para
// a primeira não concluída.

export const ETAPAS = [
  { n: 1, chave: "acesso", label: "Acesso" },
  { n: 2, chave: "empresa", label: "Empresa" },
  { n: 3, chave: "academy", label: "Marketing Academy" },
  { n: 4, chave: "ia", label: "IA RAG" },
  { n: 5, chave: "plano", label: "Plano" },
  { n: 6, chave: "campanha", label: "Campanha" },
];

export const CHAVES_ETAPAS = ETAPAS.map((e) => e.chave);

// Etapas já entregues. Enquanto o fluxo não está completo, só elas seguram a
// empresa fora do painel: parar numa etapa que ainda não existe trancaria a
// conta sem ter o que preencher. Cada passo entregue entra nesta lista.
export const ETAPAS_PRONTAS = ["acesso"];

// Decide se o onboarding fica na frente do painel.
//   - Concluído: nunca.
//   - Empresa que já existia antes do onboarding: só quando o fluxo inteiro
//     estiver pronto (ou se a operação ligar isso de propósito).
//   - Demais: só se a etapa atual já foi entregue.
export function onboardingBloqueia({ etapas, origem, exigirExistentes = false }) {
  const atual = etapaAtual(etapas);
  if (!atual) return false;
  const fluxoCompleto = CHAVES_ETAPAS.every((c) => ETAPAS_PRONTAS.includes(c));
  if (origem === "existente" && !fluxoCompleto && !exigirExistentes) return false;
  return ETAPAS_PRONTAS.includes(atual.chave);
}

// Trial do link de convite "com trial". Os links sem trial e o cadastro pelo
// site começam com cobrança normal.
export const TRIAL_ONBOARDING_DIAS = 3;

export const SENHA_MIN_EMPRESA = 8;

// Intervalo mínimo entre dois links de recuperação para o mesmo e-mail.
export const REENVIO_RESET_MS = 60 * 1000;

export const CONVITE_VALIDADE_PADRAO_DIAS = 7;
export const CONVITE_VALIDADE_MAX_DIAS = 90;

export const etapaDe = (chave) => ETAPAS.find((e) => e.chave === chave) || null;

// Progresso salvo: { acesso: "concluida", empresa: "pendente", ... }.
// Qualquer chave ausente ou com valor estranho conta como pendente.
export function normalizarEtapas(etapas) {
  const base = etapas && typeof etapas === "object" ? etapas : {};
  return Object.fromEntries(CHAVES_ETAPAS.map((c) => [c, base[c] === "concluida" ? "concluida" : "pendente"]));
}

// Primeira etapa não concluída. Com tudo concluído, devolve null.
export function etapaAtual(etapas) {
  const e = normalizarEtapas(etapas);
  return ETAPAS.find((x) => e[x.chave] !== "concluida") || null;
}

export const onboardingConcluido = (etapas) => etapaAtual(etapas) === null;

// Pode abrir etapas já concluídas (para revisar) e a atual. Nunca uma à frente.
export function podeAbrirEtapa(etapas, chave) {
  const alvo = etapaDe(chave);
  if (!alvo) return false;
  const atual = etapaAtual(etapas);
  return !atual || alvo.n <= atual.n;
}

// Concluir exige que todas as anteriores estejam concluídas. Devolve o novo
// progresso, ou null quando a ordem não permite.
export function concluirEtapa(etapas, chave) {
  const alvo = etapaDe(chave);
  if (!alvo) return null;
  const e = normalizarEtapas(etapas);
  const anterioresOk = ETAPAS.filter((x) => x.n < alvo.n).every((x) => e[x.chave] === "concluida");
  if (!anterioresOk) return null;
  return { ...e, [chave]: "concluida" };
}

export function validarSenhaEmpresa(senha) {
  if (!senha || String(senha).length < SENHA_MIN_EMPRESA)
    return `A senha precisa ter pelo menos ${SENHA_MIN_EMPRESA} caracteres.`;
  return null;
}

// WhatsApp brasileiro: DDD + número (10 ou 11 dígitos), com ou sem o 55.
// Guardado só com dígitos e sempre com o 55, para o link wa.me funcionar.
export function normalizarWhatsapp(valor) {
  let d = String(valor || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) return null;
  return d;
}

export function formatarWhatsapp(digitos) {
  const d = String(digitos || "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export const podeReenviarReset = (ultimoEnvio, agora = Date.now()) =>
  !ultimoEnvio || agora - ultimoEnvio >= REENVIO_RESET_MS;

// ---------------------------------------------------------------------------
// Convite de onboarding
//
// Gerado no admin para uma empresa específica: preso a um e-mail, uso único,
// validade escolhida por quem gera, com ou sem trial. O banco guarda só o hash
// do token, como nos convites de trial.

export const MOTIVOS_CONVITE_ONBOARDING = {
  inexistente: "Este convite não existe ou o endereço está incompleto.",
  usado: "Este convite já foi utilizado.",
  expirado: "Este convite expirou. Peça um novo link à RYCS.",
  revogado: "Este convite foi cancelado. Peça um novo link à RYCS.",
  outroEmail: "Este convite foi gerado para outro e-mail.",
};

export function estadoConviteOnboarding(convite, agora = Date.now()) {
  if (!convite) return { ok: false, motivo: "inexistente" };
  if (convite.revogadoEm) return { ok: false, motivo: "revogado" };
  if (convite.usadoEm) return { ok: false, motivo: "usado" };
  if (convite.expiraEm && agora > convite.expiraEm) return { ok: false, motivo: "expirado" };
  return { ok: true };
}

export function conviteServeParaEmail(convite, email, agora = Date.now()) {
  const estado = estadoConviteOnboarding(convite, agora);
  if (!estado.ok) return estado;
  const a = String(convite.email || "").trim().toLowerCase();
  const b = String(email || "").trim().toLowerCase();
  if (!a || a !== b) return { ok: false, motivo: "outroEmail" };
  return { ok: true };
}

export function validadeConviteDias(valor) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n) || n < 1) return CONVITE_VALIDADE_PADRAO_DIAS;
  return Math.min(CONVITE_VALIDADE_MAX_DIAS, n);
}
