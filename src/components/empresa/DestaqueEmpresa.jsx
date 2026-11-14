import { useEffect, useState } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { DESTAQUES, ORDEM_DESTAQUES } from "../../../shared/planos.js";
import { Check, CreditCard, Globe, Loader, ShieldCheck, Star, X } from "lucide-react";
import HoloCard from "../HoloCard.jsx";

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const mascaraCartao = (v) => SO_DIGITOS(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

// Modal de checkout do destaque — cartão de crédito ou débito (nacional)
// ou internacional (Stripe).
function ModalCheckoutDestaque({ tipo, onFechar, onConfirmado, aviso }) {
  const d = DESTAQUES[tipo];
  const [forma, setForma] = useState("");
  const [cartao, setCartao] = useState({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
  const [titular, setTitular] = useState({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState("escolha"); // escolha | processando | confirmado
  const [stripe, setStripe] = useState(null);

  useEffect(() => { api("/stripe/status").then((r) => r && !r.error && setStripe(r)); }, []);

  const origem = forma ? (forma === "STRIPE" ? "internacional" : "nacional") : null;

  const contratar = async () => {
    if (forma === "STRIPE") {
      setProcessando(true);
      const r = await api("/destaque/stripe", { tipo, retorno: window.location.pathname });
      setProcessando(false);
      if (!r || r.error || !r.url) return aviso(r?.error || "Não foi possível abrir o pagamento internacional.");
      window.location.href = r.url;
      return;
    }

    const ehCartao = forma === "CREDIT_CARD" || forma === "DEBIT_CARD";
    if (ehCartao) {
      const faltando = Object.entries(cartao).filter(([, v]) => !String(v).trim());
      if (faltando.length) return aviso("Preencha todos os dados do cartão.");
      if (!titular.cep || !titular.numero) return aviso("Informe CEP e número do endereço de cobrança.");
    }

    setProcessando(true);
    const r = await api("/destaque/checkout", {
      tipo,
      formaPagamento: forma,
      cartao: ehCartao ? cartao : undefined,
      titular: ehCartao ? titular : undefined,
    });
    setProcessando(false);

    if (r?.error) return aviso(r.error);

    if (r.jaPago) {
      aviso("Pagamento confirmado. Ativando seu destaque.");
      onConfirmado?.();
      onFechar();
      return;
    }

    aviso(r.message || "Destaque contratado com sucesso.");
    onConfirmado?.();
    onFechar();
  };

  return (
    <div className="vx-overlay" onClick={onFechar}>
      <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="vx-row">
          <div>
            <div className="vx-eyebrow">Checkout seguro</div>
            <h2 className="vx-disp" style={{ margin: "3px 0" }}>{d.nome}</h2>
          </div>
          <button className="vx-btn vx-btn-ghost" onClick={onFechar}><X size={16} /></button>
        </div>

        {etapa === "processando" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div className="vx-spinner" style={{ margin: "0 auto 18px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Processando seu pagamento…</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Ativando seu destaque.</div>
          </div>
        )}

        {etapa === "confirmado" && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#DCFCE7", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <Check size={36} color="#16A34A" strokeWidth={3} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Destaque ativado!</div>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 18 }}>
              Sua empresa já aparece em destaque na vitrine. Enviamos o comprovante para o seu e-mail.
            </div>
            <button className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onFechar}>Concluir</button>
          </div>
        )}

        {etapa === "escolha" && (
          <>
            {/* Resumo */}
            <div className="vx-checkout-total">
              <span>{d.nome} · mensal</span><b>{money(d.preco)}/mês</b>
            </div>

            {/* Forma de pagamento */}
            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Forma de pagamento</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {[
                { id: "nacional", titulo: "Pagamento nacional", sub: "Cartão de crédito ou débito · R$", icone: <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">🇧🇷</span> },
                ...(stripe?.ativo ? [{ id: "internacional", titulo: "Pagamento internacional", sub: "Cartão · US$", icone: <Globe size={26} strokeWidth={1.8} aria-hidden="true" /> }] : []),
              ].map(({ id, titulo, sub, icone }) => {
                const on = origem === id;
                return (
                  <button key={id} type="button"
                    onClick={() => setForma(id === "nacional" ? "DEBIT_CARD" : "STRIPE")}
                    style={{
                      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      padding: "16px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                      border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`,
                      background: on ? "var(--brand-50)" : "var(--surface)",
                      color: on ? "var(--brand)" : "var(--ink)", transition: "border-color .15s, background .15s",
                    }}>
                    {icone}
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{titulo}</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{sub}</span>
                  </button>
                );
              })}
            </div>

            {/* Formas específicas do pagamento nacional */}
            {origem === "nacional" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[["DEBIT_CARD", "Cartão de débito"], ["CREDIT_CARD", "Cartão de crédito"]].map(([k, t]) => (
                  <button key={k} className="vx-btn" onClick={() => setForma(k)} style={{
                    flex: 1, fontSize: 12,
                    borderColor: forma === k ? "var(--brand)" : undefined,
                    background: forma === k ? "var(--brand-50)" : undefined,
                    color: forma === k ? "var(--brand)" : undefined,
                  }}>{t}</button>
                ))}
              </div>
            )}

            {/* Formulário de cartão */}
            {(forma === "CREDIT_CARD" || forma === "DEBIT_CARD") && (
              <>
                <div style={{ margin: "4px auto 16px", maxWidth: 320 }}>
                  <HoloCard
                    holder={cartao.nome || "RYCS"}
                    number={cartao.numero || "0000000000000000"}
                    expires={cartao.validadeMes && cartao.validadeAno ? `${String(cartao.validadeMes).padStart(2, "0")}/${String(cartao.validadeAno).slice(-2)}` : "••/••"}
                    cvv={cartao.cvv || "•••"}
                    tier={forma === "DEBIT_CARD" ? "Débito" : "Crédito"}
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
                      value={cartao.cvv}
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
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
            )}

            {forma === "STRIPE" && (
              <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                <ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Para empresas fora do Brasil: pagamento em dólar no formulário seguro do Stripe, com cartão
                internacional. O destaque é ativado quando o Stripe confirmar.
              </div>
            )}

            {forma === "PIX_AUTOMATICO" && (
              <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                <QrCode size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Geramos um QR Code de {money(TAXA_ATIVACAO_PIX_AUTOMATICO)} para autorizar o débito automático mensal de {money(d.preco)}.
                O destaque é ativado quando o pagamento for detectado.
              </div>
            )}

            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}
              disabled={processando || !forma} onClick={contratar}>
              {processando
                ? <><Loader size={15} /> Processando…</>
                : forma === "STRIPE"
                  ? <><CreditCard size={15} /> Continuar para o pagamento</>
                  : <><CreditCard size={15} /> Confirmar {money(d.preco)}/mês</>}
            </button>
            <p className="vx-chart-source">
              Nenhuma cobrança é feita sem esta confirmação. Ativação apenas após confirmação do gateway.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DestaqueEmpresa({ emp, up, aviso, recarregar }) {
  const ativo = emp.destaqueTipo || (emp.destaque ? "topo" : "");
  const [checkout, setCheckout] = useState(null);

  const cancelar = async () => {
    const r = await apiPatch(`/companies/${emp.id}`, { destaque: false, destaqueTipo: "" });
    if (r?.error) return aviso(r.error);
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, destaque: false, destaqueTipo: "" } : c) }));
    aviso("Destaque cancelado.");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ padding: "4px 0 16px" }}>
        <div className="vx-eyebrow">Visibilidade na vitrine</div>
        <h1 className="vx-disp" style={{ margin: "2px 0 3px" }}>Destaque da empresa</h1>
        <p style={{ margin: 0 }}>
          Aumente a visibilidade da sua empresa na vitrine. Disponível para qualquer empresa, independente do plano contratado — cancele quando quiser.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, alignItems: "start" }}>
        {ORDEM_DESTAQUES.map((key) => {
          const d = DESTAQUES[key];
          const on = ativo === key;
          return (
            <article
              key={key}
              className="vx-card"
              style={{
                position: "relative", padding: "26px 22px", display: "flex", flexDirection: "column",
                border: (on || d.popular) ? "2px solid var(--brand)" : "1px solid var(--border)",
                background: on ? "var(--brand-50)" : undefined,
                boxShadow: (on || d.popular) ? "var(--shadow-brand)" : "var(--shadow-card)",
                overflow: "hidden",
              }}
            >
              {on && (
                <div style={{ position: "absolute", top: 0, left: 0, display: "flex", alignItems: "center", gap: 4, background: "var(--brand)", color: "#fff", padding: "4px 10px", borderBottomRightRadius: 12, fontSize: 11, fontWeight: 700 }}>
                  <Check size={12} strokeWidth={3} /> Ativo
                </div>
              )}
              {d.popular && !on && (
                <div style={{ position: "absolute", top: 0, right: 0, display: "flex", alignItems: "center", gap: 4, background: "var(--brand)", color: "#fff", padding: "4px 10px", borderBottomLeftRadius: 12, fontSize: 11, fontWeight: 700 }}>
                  <Star size={12} fill="currentColor" /> Mais popular
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginTop: 6 }}>
                {d.nome}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, margin: "16px 0 2px" }}>
                <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{money(d.preco)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>/mês</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", marginBottom: 4 }}>
                cartão ou Pix automático · cancele quando quiser
              </div>
              {d.frase && (
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", textAlign: "center", margin: "8px 0 0", fontWeight: 500, lineHeight: 1.45 }}>
                  {d.frase}
                </div>
              )}

              <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 9 }}>
                {d.itens.map((it) => (
                  <li key={it} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--text-2, var(--ink))", textAlign: "left" }}>
                    <Check size={15} color="var(--brand)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} /> {it}
                  </li>
                ))}
              </ul>

              <div style={{ borderTop: "1px solid var(--border)", margin: "18px 0 14px" }} />

              <button
                type="button"
                className={"vx-btn vx-btn-block " + (on ? "" : "vx-btn-primary")}
                onClick={() => on ? cancelar() : setCheckout(key)}
                style={{ marginTop: "auto", fontWeight: 700 }}
              >
                {on ? "Cancelar destaque" : "Ativar destaque"}
              </button>
            </article>
          );
        })}
      </div>

      {checkout && (
        <ModalCheckoutDestaque
          tipo={checkout}
          aviso={aviso}
          onFechar={() => setCheckout(null)}
          onConfirmado={() => { recarregar?.(); }}
        />
      )}
    </div>
  );
}
