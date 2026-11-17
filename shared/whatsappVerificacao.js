// Verificação do WhatsApp do profissional: a RYCS manda um código de 6 dígitos
// pelo WhatsApp oficial dela e o profissional confirma na plataforma. Prova que
// o número é dele e tem WhatsApp ativo — não dá acesso às conversas.

export const CODIGO_TAMANHO = 6;
export const VALIDADE_MS = 10 * 60 * 1000;
export const MAX_TENTATIVAS = 5;
export const INTERVALO_REENVIO_MS = 60 * 1000;
export const MAX_ENVIOS_POR_HORA = 5;

const ehBrasil = (pais) => !pais || /^(br|brasil|brazil)$/i.test(String(pais).trim());

// Só dígitos, com DDI. O cadastro já guarda o número com DDI; número
// brasileiro digitado sem DDI (10 ou 11 dígitos) ganha o 55.
export function numeroWhatsapp(valor, pais = "") {
  const d = String(valor || "").replace(/\D/g, "");
  if (ehBrasil(pais)) {
    if (d.length === 10 || d.length === 11) return `55${d}`;
    return /^55\d{10,11}$/.test(d) ? d : null;
  }
  return d.length >= 8 && d.length <= 15 ? d : null;
}

// Vale enquanto o número verificado for o mesmo do perfil: trocou o número,
// precisa verificar de novo.
export function whatsVerificado(seller) {
  const verificado = String(seller?.whatsVerificadoNumero || "");
  return !!verificado && numeroWhatsapp(seller?.whats, seller?.pais) === verificado;
}

export function formatarNumero(numero) {
  const d = String(numero || "");
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : d ? `+${d}` : "";
}

// Modelo de autenticação da Meta: o código vai no corpo e no botão "Copiar código".
export function mensagemCodigo(numero, codigo, { template, idioma }) {
  return {
    messaging_product: "whatsapp",
    to: numero,
    type: "template",
    template: {
      name: template,
      language: { code: idioma },
      components: [
        { type: "body", parameters: [{ type: "text", text: codigo }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: codigo }] },
      ],
    },
  };
}
