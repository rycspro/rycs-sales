import { useEffect, useState } from "react";
import { CreditCard, Check, ShieldCheck, ArrowLeft, Loader, QrCode, Gift } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { PLANOS, ORDEM_PLANOS } from "../../../shared/planos.js";
import { formatarData, primeiraCobranca } from "../../../shared/assinatura.js";
import { lerConvite, limparConvite } from "../../lib/rotas.js";

// Escolha de plano e checkout.
//
// Dois passos e nada mais: qual plano, e como pagar. Tudo que a empresa
// precisa saber antes de confirmar fica visível na mesma tela — plano, valor
// mensal, período gratuito e a data exata da primeira cobrança. Cobrança
// recorrente combinada sem data à vista é o que gera contestação depois.
//
// Nenhum dado de cartão fica na RYCS. Número e CVV vão direto ao gateway na
// requisição do checkout; o que volta e é guardado são a bandeira e os quatro
// últimos dígitos, só para a empresa reconhecer o cartão na tela.

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const mascaraCartao = (v) => SO_DIGITOS(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

// Planos pagos, na ordem do catálogo. O "free" saiu da oferta.
const PLANOS_OFERTADOS = ORDEM_PLANOS.filter((k) => PLANOS[k]?.preco > 0);

export default function Assinatura({ emp, acesso, aviso, aoAtivar }) {
  const [passo, setPasso] = useState(0);
  const [plano, setPlano] = useState(null);
  const [forma, setForma] = useState("CREDIT_CARD");
  const [trialDias, setTrialDias] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [pix, setPix] = useState(null);

  const [cartao, setCartao] = useState({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
  const [titular, setTitular] = useState({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });

  // Convite de trial, quando a empresa chegou por um link privado. Validado no
  // servidor: um token inventado não vira oferta na tela.
  const [convite, setConvite] = useState(null);
  const [resgatando, setResgatando] = useState(false);

  // O período gratuito é decidido pelo servidor, não pela tela: assim a oferta
  // muda por configuração e as duas pontas concordam sobre a data da cobrança.
  useEffect(() => { api("/subscription/access").then((r) => setTrialDias(Number(r?.trialDisponivel || 0))); }, []);

  useEffect(() => {
    const token = lerConvite();
    if (!token) return;
    api(`/trial/${token}`).then((r) => {
      // Convite ruim não fica pendurado atrapalhando o checkout normal.
      if (!r?.ok) { limparConvite(); return; }
      setConvite({ token, ...r });
    });
  }, []);

  const resgatarConvite = async (chave) => {
    setResgatando(true);
    const r = await api(`/trial/${convite.token}/resgatar`, { plano: chave });
    setResgatando(false);
    if (!r || r.error) {
      // Convite queimado ou empresa inelegível: some com ele e deixa a empresa
      // seguir pelo caminho normal, em vez de travar numa oferta impossível.
      if (r?.motivo) { limparConvite(); setConvite(null); }
      return aviso(r?.error || "Não foi possível ativar o período gratuito.");
    }
    limparConvite();
    aviso(`Período gratuito ativado até ${formatarData(r.trialFim)}.`);
    aoAtivar?.(r);
  };

  const detalhes = plano ? PLANOS[plano] : null;
  const cobrancaEm = primeiraCobranca({ trialDias: forma === "CREDIT_CARD" ? trialDias : 0 });
  const temTrial = forma === "CREDIT_CARD" && trialDias > 0;

  const ativar = async () => {
    if (forma === "CREDIT_CARD") {
      const faltando = Object.entries(cartao).filter(([, v]) => !String(v).trim());
      if (faltando.length) return aviso("Preencha todos os dados do cartão.");
      if (!titular.cep || !titular.numero) return aviso("Informe CEP e número do endereço de cobrança.");
    }

    setEnviando(true);
    const r = await api("/subscription", {
      plano,
      formaPagamento: forma,
      cartao: forma === "CREDIT_CARD" ? cartao : undefined,
      titular: forma === "CREDIT_CARD" ? { ...titular, documento: titular.documento || emp.documento } : undefined,
    });
    setEnviando(false);

    if (!r || r.error) return aviso(r?.error || "Não foi possível ativar a assinatura.");

    // O servidor pode devolver um checkout que já existia, com link novo.
    if (r.jaPago) { aviso("Pagamento confirmado. Liberando seu acesso."); return aoAtivar?.(r); }
    if (r.pixCopiaECola || r.pixQrCodeBase64) { setPix(r); return; }
    if (r.status === "pendente" && r.invoiceUrl) {
      // Sem QR, mas com fatura: abrir a fatura é o caminho de pagamento.
      window.open(r.invoiceUrl, "_blank", "noopener");
      aviso(r.message || "Abrimos a fatura numa nova aba para você pagar.");
      return;
    }
    aviso(r.message || "Conta ativada.");
    aoAtivar?.(r);
  };

  // ------------------------------------------------------------ Pix pendente
  if (pix) return (
    <div className="vx-fade" style={{ maxWidth: 520 }}>
      <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
        <QrCode size={26} color="var(--brand)" />
        <div className="vx-disp" style={{ fontSize: 20, margin: "10px 0 4px" }}>Pague para ativar</div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
          Seu acesso é liberado automaticamente assim que o pagamento for confirmado.
        </p>
        {pix.pixQrCodeBase64 && (
          <img src={`data:image/png;base64,${pix.pixQrCodeBase64}`} alt="QR Code do Pix"
            style={{ width: 200, height: 200, margin: "14px auto", display: "block", borderRadius: 10 }} />
        )}
        {pix.pixCopiaECola && (
          <button className="vx-btn vx-btn-block" onClick={() => { navigator.clipboard?.writeText(pix.pixCopiaECola); aviso("Código copiado."); }}>
            Copiar código Pix
          </button>
        )}
      </div>
    </div>
  );

  // ------------------------------------------------------------ passo: plano
  if (passo === 0) return (
    <div className="vx-fade" style={{ maxWidth: 760 }}>
      <div className="vx-eyebrow">Assinatura</div>
      <h2 className="vx-disp" style={{ fontSize: 24, margin: "5px 0 4px" }}>
        {acesso?.titulo || "Escolha o seu plano"}
      </h2>
      <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
        {acesso?.mensagem || "Escolha um plano para publicar campanhas e receber profissionais."}
      </p>

      {convite && (
        <div className="vx-card" style={{ padding: 16, marginTop: 16, borderColor: "var(--brand)", background: "var(--brand-50)" }}>
          <div className="vx-eyebrow" style={{ color: "var(--brand)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Gift size={12} /> Convite de teste gratuito
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.65 }}>
            Você tem <b>{convite.dias} dias grátis</b>{convite.plano ? <> no plano <b>{PLANOS[convite.plano]?.nome}</b></> : <> no plano que escolher</>}.
            Não pedimos cartão agora. Ao fim do período, será necessário contratar um plano para continuar —
            e nada da sua conta é apagado nessa troca.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 20, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        {PLANOS_OFERTADOS.filter((k) => !convite?.plano || k === convite.plano).map((k) => {
          const p = PLANOS[k];
          return (
            <button key={k} className="vx-card"
              disabled={resgatando}
              onClick={() => { if (convite) return resgatarConvite(k); setPlano(k); setPasso(1); }}
              style={{ padding: 18, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="vx-disp" style={{ fontSize: 17 }}>{p.nome}</div>
              <div className="vx-disp vx-mono" style={{ fontSize: 26, color: "var(--brand)" }}>
                {money(p.preco)}<span className="vx-mut" style={{ fontSize: 13 }}>/mês</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "grid", gap: 6, fontSize: 12.5, color: "var(--text-2)" }}>
                {p.inclui.map((i) => (
                  <li key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                    <Check size={13} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} /> {i}
                  </li>
                ))}
              </ul>
              {convite && (
                <div className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10, pointerEvents: "none" }}>
                  {resgatando ? "Ativando…" : `Ativar ${convite.dias} dias grátis`}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------- passo: checkout
  return (
    <div className="vx-fade" style={{ maxWidth: 560 }}>
      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setPasso(0)} style={{ marginBottom: 12 }}>
        <ArrowLeft size={13} /> Trocar de plano
      </button>

      {/* O combinado, à vista, antes de qualquer campo */}
      <div className="vx-card" style={{ padding: 18, borderColor: "var(--brand-100)", background: "var(--brand-50)" }}>
        <div className="vx-row"><b style={{ fontSize: 15 }}>Plano {detalhes.nome}</b>
          <b className="vx-mono" style={{ fontSize: 17, color: "var(--brand)" }}>{money(detalhes.preco)}/mês</b></div>
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
          {temTrial ? (
            <>
              Seu período gratuito termina em <b>{formatarData(cobrancaEm)}</b>.<br />
              Após essa data, seu plano será cobrado automaticamente por <b>{money(detalhes.preco)}/mês</b>.
            </>
          ) : (
            <>Primeira cobrança em <b>{formatarData(cobrancaEm)}</b>, e depois todo mês na mesma data.</>
          )}
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Forma de pagamento</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["CREDIT_CARD", "Cartão de crédito"], ["PIX", "Pix"]].map(([k, t]) => (
            <button key={k} className="vx-btn" onClick={() => setForma(k)} style={{
              flex: 1,
              borderColor: forma === k ? "var(--brand)" : undefined,
              background: forma === k ? "var(--brand-50)" : undefined,
              color: forma === k ? "var(--brand)" : undefined,
            }}>{t}</button>
          ))}
        </div>

        {forma === "CREDIT_CARD" ? (
          <>
            <label><div className="vx-label">Nome impresso no cartão</div>
              <input className="vx-input" value={cartao.nome} onChange={(e) => setCartao({ ...cartao, nome: e.target.value })} autoComplete="cc-name" /></label>

            <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">Número do cartão</div>
              <input className="vx-input vx-mono" inputMode="numeric" value={mascaraCartao(cartao.numero)}
                onChange={(e) => setCartao({ ...cartao, numero: SO_DIGITOS(e.target.value) })}
                placeholder="0000 0000 0000 0000" autoComplete="cc-number" /></label>

            <div className="vx-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
              <label><div className="vx-label">Mês</div>
                <input className="vx-input vx-mono" inputMode="numeric" maxLength={2} placeholder="12"
                  value={cartao.validadeMes} onChange={(e) => setCartao({ ...cartao, validadeMes: SO_DIGITOS(e.target.value).slice(0, 2) })} /></label>
              <label><div className="vx-label">Ano</div>
                <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="2030"
                  value={cartao.validadeAno} onChange={(e) => setCartao({ ...cartao, validadeAno: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
              <label><div className="vx-label">CVV</div>
                <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="123"
                  value={cartao.cvv} onChange={(e) => setCartao({ ...cartao, cvv: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
            </div>

            <div className="vx-eyebrow" style={{ margin: "18px 0 10px" }}>Endereço de cobrança</div>
            <div className="vx-grid vx-g2" style={{ gap: 10 }}>
              <label><div className="vx-label">CEP</div>
                <input className="vx-input vx-mono" inputMode="numeric" value={titular.cep}
                  onChange={(e) => setTitular({ ...titular, cep: SO_DIGITOS(e.target.value).slice(0, 8) })} /></label>
              <label><div className="vx-label">Número</div>
                <input className="vx-input" value={titular.numero}
                  onChange={(e) => setTitular({ ...titular, numero: e.target.value })} /></label>
            </div>
            <div className="vx-grid vx-g2" style={{ gap: 10, marginTop: 10 }}>
              <label><div className="vx-label">E-mail do titular</div>
                <input className="vx-input" type="email" value={titular.email}
                  onChange={(e) => setTitular({ ...titular, email: e.target.value })} /></label>
              <label><div className="vx-label">Telefone</div>
                <input className="vx-input vx-mono" inputMode="tel" value={titular.telefone}
                  onChange={(e) => setTitular({ ...titular, telefone: e.target.value })} /></label>
            </div>

            <div className="vx-mut" style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
              <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              Os dados do cartão vão direto ao processador de pagamento. A RYCS não guarda o número nem o CVV.
            </div>
          </>
        ) : (
          <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7 }}>
            Geramos um QR Code na próxima tela. O acesso é liberado assim que o pagamento for confirmado.
            <div style={{ marginTop: 8 }}>No Pix não há período gratuito — a cobrança é à vista, mês a mês.</div>
          </div>
        )}
      </div>

      <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }} disabled={enviando} onClick={ativar}>
        {enviando ? <><Loader size={15} /> Ativando…</> : <><CreditCard size={15} /> ATIVAR MINHA CONTA</>}
      </button>
    </div>
  );
}
