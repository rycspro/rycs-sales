import { ShieldCheck } from "lucide-react";
import HoloCard from "../HoloCard.jsx";

// Formulário de cartão de crédito do checkout nacional (Asaas), usado na tela
// de planos e na proposta Enterprise.
//
// Os dados vão direto ao gateway na requisição do checkout. A RYCS não guarda
// número nem CVV — volta só o que o gateway devolve tokenizado.

export const CARTAO_VAZIO = { nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" };
export const TITULAR_VAZIO = { nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" };

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const mascaraCartao = (v) => SO_DIGITOS(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

// O que falta preencher antes de mandar ao gateway, ou "" se está completo.
export function erroDoCartao(cartao, titular) {
  if (!cartao.nome || !cartao.numero || !cartao.validadeMes || !cartao.validadeAno || !cartao.cvv)
    return "Preencha todos os dados do cartão.";
  if (![11, 14].includes(SO_DIGITOS(titular.documento).length)) return "Informe o CPF ou CNPJ do titular do cartão.";
  if (!titular.cep || !titular.numero) return "Informe CEP e número do endereço de cobrança.";
  return "";
}

export default function FormularioCartao({ cartao, setCartao, titular, setTitular }) {
  return (
    <>
      <div style={{ margin: "4px auto 16px", maxWidth: 320 }}>
        <HoloCard
          holder={cartao.nome || "RYCS"}
          number={cartao.numero || "0000000000000000"}
          expires={cartao.validadeMes && cartao.validadeAno ? `${String(cartao.validadeMes).padStart(2, "0")}/${String(cartao.validadeAno).slice(-2)}` : "••/••"}
          cvv="•••"
          tier="Crédito"
        />
      </div>
      <label><div className="vx-label">Nome impresso no cartão</div>
        <input className="vx-input" value={cartao.nome}
          onChange={(e) => setCartao({ ...cartao, nome: e.target.value })} autoComplete="cc-name" /></label>

      <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">Número do cartão</div>
        <input className="vx-input vx-mono" inputMode="numeric" value={mascaraCartao(cartao.numero)}
          onChange={(e) => setCartao({ ...cartao, numero: SO_DIGITOS(e.target.value) })}
          placeholder="0000 0000 0000 0000" autoComplete="cc-number" /></label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
        <label><div className="vx-label">Mês</div>
          <input className="vx-input vx-mono" inputMode="numeric" maxLength={2} placeholder="12"
            value={cartao.validadeMes}
            onChange={(e) => setCartao({ ...cartao, validadeMes: SO_DIGITOS(e.target.value).slice(0, 2) })} /></label>
        <label><div className="vx-label">Ano</div>
          <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="2030"
            value={cartao.validadeAno}
            onChange={(e) => setCartao({ ...cartao, validadeAno: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
        <label><div className="vx-label">CVV</div>
          <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="123"
            type="password" value={cartao.cvv}
            onChange={(e) => setCartao({ ...cartao, cvv: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
      </div>

      <div className="vx-eyebrow" style={{ margin: "16px 0 10px" }}>Endereço de cobrança</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label><div className="vx-label">CEP</div>
          <input className="vx-input vx-mono" inputMode="numeric" value={titular.cep}
            onChange={(e) => setTitular({ ...titular, cep: SO_DIGITOS(e.target.value).slice(0, 8) })} /></label>
        <label><div className="vx-label">Número</div>
          <input className="vx-input" value={titular.numero}
            onChange={(e) => setTitular({ ...titular, numero: e.target.value })} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
        <label><div className="vx-label">CPF ou CNPJ do titular</div>
          <input className="vx-input vx-mono" inputMode="numeric" value={titular.documento}
            onChange={(e) => setTitular({ ...titular, documento: SO_DIGITOS(e.target.value).slice(0, 14) })} /></label>
        <label><div className="vx-label">E-mail do titular</div>
          <input className="vx-input" type="email" value={titular.email}
            onChange={(e) => setTitular({ ...titular, email: e.target.value })} /></label>
        <label><div className="vx-label">Telefone</div>
          <input className="vx-input vx-mono" inputMode="tel" value={titular.telefone}
            onChange={(e) => setTitular({ ...titular, telefone: e.target.value })} placeholder="(11) 99999-0000" /></label>
      </div>

      <div className="vx-mut" style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
        <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        Os dados do cartão vão direto ao processador de pagamento. A RYCS não guarda o número nem o CVV.
      </div>
    </>
  );
}
