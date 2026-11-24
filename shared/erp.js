// ERPs que a empresa pode conectar. `campos` é o que ela cola na tela; o Bling
// usa login (OAuth). "generico" atende qualquer outro ERP: ele envia produtos e
// clientes para um endereço exclusivo da empresa e recebe os pedidos aprovados.

export const ERPS = {
  bling: { nome: "Bling", login: true, campos: [], ajuda: "Você entra na sua conta do Bling e autoriza a RYCS." },
  tiny: {
    nome: "Olist Tiny", campos: [{ chave: "token", rotulo: "Token da API", secreto: true }],
    ajuda: "No Tiny: Configurações → E-commerce → Token API. Copie o token e cole aqui.",
  },
  omie: {
    nome: "Omie", campos: [{ chave: "appKey", rotulo: "App Key" }, { chave: "appSecret", rotulo: "App Secret", secreto: true }],
    ajuda: "No Omie: Portal do Desenvolvedor → Meus Aplicativos. Copie a App Key e a App Secret.",
  },
  generico: {
    nome: "Outro ERP", campos: [{ chave: "url", rotulo: "Endereço que recebe os pedidos (opcional)", tipo: "url" }],
    ajuda: "Para qualquer ERP com API ou webhook. A RYCS gera um endereço exclusivo para receber produtos e clientes, e envia os pedidos aprovados para o endereço que você informar.",
  },
};
export const erpValido = (p) => Object.prototype.hasOwnProperty.call(ERPS, p);

// Credencial obrigatória em branco → mensagem de erro; senão null.
export function validarCredenciais(provedor, dados = {}) {
  if (!erpValido(provedor) || ERPS[provedor].login) return "ERP inválido.";
  for (const c of ERPS[provedor].campos) {
    const v = String(dados[c.chave] || "").trim();
    if (c.tipo === "url") {
      if (v && !/^https:\/\/[^\s]+$/i.test(v)) return "O endereço precisa começar com https://.";
    } else if (!v) return `Preencha ${c.rotulo}.`;
    if (v.length > 500) return `${c.rotulo} muito longo.`;
  }
  return null;
}
