// Trial comercial concedido somente pela operação da RYCS.
//
// Ele não é uma oferta de checkout: o cliente não o vê nem consegue acioná-lo
// pela API de empresa. A regra mora em módulo compartilhado para que a tela
// administrativa e o servidor não discordem sobre duração ou elegibilidade.
export const TRIAL_SECRETO_DIAS = 7;

export function podeConcederTrialSecreto({ estadoAtual, jaUsouTrial = false } = {}) {
  if (jaUsouTrial) {
    return { ok: false, erro: "Esta empresa já utilizou um período de trial." };
  }

  if (estadoAtual === "ativa" || estadoAtual === "trial") {
    return { ok: false, erro: "A empresa já possui uma assinatura com acesso liberado." };
  }

  // Premium não paga mensalidade: conceder trial a ela é oferecer desconto
  // sobre zero, e queimaria o único trial a que a empresa teria direito se
  // algum dia voltasse a ser padrão.
  if (estadoAtual === "premium") {
    return { ok: false, erro: "Empresa premium já tem acesso liberado sem mensalidade." };
  }

  if (estadoAtual === "pendente") {
    return { ok: false, erro: "Existe um checkout pendente. Resolva-o antes de conceder o trial." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Convite por link
//
// O mesmo trial de sete dias, agora entregável: a operação gera um link e
// manda para quem quiser. Diferente da concessão por empresa, aqui não se sabe
// de antemão quem vai resgatar — então o link precisa se defender sozinho.
//
// Três defesas, e cada uma cobre uma falha diferente:
//   uso único   — o link vaza e vira mil trials
//   validade    — o link fica esquecido num grupo e é usado meses depois
//   uma por CNPJ— a mesma empresa resgata vários links em sequência
//
// O token não é guardado no banco: guarda-se o hash. Link de convite é
// credencial, e credencial em texto puro no banco é a mesma falha da senha.

export const TRIAL_LINK_VALIDADE_DIAS = 30;

export const MOTIVOS_CONVITE = {
  inexistente: "Este convite não existe ou o endereço está incompleto.",
  usado: "Este convite já foi utilizado.",
  expirado: "Este convite expirou.",
  jaTemAcesso: "Sua conta já tem acesso liberado — não é preciso usar o convite.",
  jaUsouTrial: "Esta empresa já utilizou um período de trial.",
};

// Um convite é válido enquanto não foi usado e não venceu. A checagem de quem
// resgata é separada: o link pode estar bom e a empresa não poder usar.
export function estadoDoConvite(link, agora = Date.now()) {
  if (!link) return { ok: false, motivo: "inexistente" };
  if (link.usadoEm) return { ok: false, motivo: "usado" };
  if (link.expiraEm && agora > link.expiraEm) return { ok: false, motivo: "expirado" };
  return { ok: true };
}

// Quem pode resgatar. Reaproveita a regra de elegibilidade da concessão
// interna: se a empresa não pode receber trial ali, também não pode aqui.
export function podeResgatarConvite({ link, estadoAtual, jaUsouTrial = false }, agora = Date.now()) {
  const doLink = estadoDoConvite(link, agora);
  if (!doLink.ok) return { ok: false, motivo: doLink.motivo, erro: MOTIVOS_CONVITE[doLink.motivo] };

  const daEmpresa = podeConcederTrialSecreto({ estadoAtual, jaUsouTrial });
  if (!daEmpresa.ok) {
    const motivo = jaUsouTrial ? "jaUsouTrial" : "jaTemAcesso";
    return { ok: false, motivo, erro: daEmpresa.erro };
  }

  return { ok: true };
}
