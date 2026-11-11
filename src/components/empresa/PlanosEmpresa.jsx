import { useCallback, useEffect, useState } from "react";
import { Check, Copy, CreditCard, Loader, QrCode, ShieldCheck, Sparkles, X } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { PLANOS, ORDEM_PLANOS } from "../../../shared/planos.js";
import { useI18n } from "../../lib/i18n.jsx";

const PLANOS_ESTATICOS = ORDEM_PLANOS.filter((k) => PLANOS[k].preco > 0).map((k) => ({
  chave: k, nome: PLANOS[k].nome, preco: PLANOS[k].preco, takeRate: PLANOS[k].takeRate, inclui: PLANOS[k].inclui,
}));

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const mascaraCartao = (v) => SO_DIGITOS(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

export default function PlanosEmpresa({ aviso, recarregar }) {
  const { t } = useI18n();
  const [planos, setPlanos] = useState([]);
  const [atual, setAtual] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [voucher, setVoucher] = useState("");
  const [desconto, setDesconto] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [cobranca, setCobranca] = useState(null);
  const [forma, setForma] = useState("PIX");
  const [cartao, setCartao] = useState({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
  const [titular, setTitular] = useState({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });

  const carregar = useCallback(async () => {
    const [p, s] = await Promise.all([api("/plans"), api("/subscription")]);
    if (Array.isArray(p) && p.length > 0) setPlanos(p.filter((x) => x.preco > 0));
    else setPlanos(PLANOS_ESTATICOS);
    if (s && !s.error) setAtual(s);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirModal = (p) => {
    setSelecionado(p);
    setCobranca(null);
    setVoucher("");
    setDesconto(null);
    setForma("PIX");
    setCartao({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
    setTitular({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });
  };

  const aplicar = async () => {
    const r = await api(`/vouchers/validate?codigo=${encodeURIComponent(voucher)}&plano=${selecionado.chave}`);
    if (r?.error) { setDesconto(null); return aviso(r.error); }
    setDesconto(r);
    aviso(t("sub.voucherApplied"));
  };

  const contratar = async () => {
    if (forma === "CREDIT_CARD") {
      const faltando = Object.entries(cartao).filter(([, v]) => !String(v).trim());
      if (faltando.length) return aviso(t("sub.fillCard"));
      if (!titular.cep || !titular.numero) return aviso(t("sub.fillBillingAddress"));
    }

    setProcessando(true);
    const r = await api("/subscription", {
      plano: selecionado.chave,
      voucher: voucher || undefined,
      formaPagamento: forma,
      cartao: forma === "CREDIT_CARD" ? cartao : undefined,
      titular,
    });
    setProcessando(false);

    if (!r || r.error) return aviso(r?.error || t("sub.paymentError"));

    setCartao(c => ({ ...c, numero: "", cvv: "" }));
    if (r.jaPago) { aviso(t("sub.paymentConfirmed")); setSelecionado(null); await carregar(); return; }
    if (r.pixCopiaECola || r.pixQrCodeBase64) { setCobranca(r); return; }

    setCobranca(r);
    await carregar();
    aviso(r.message || t("sub.awaitingPayment"));
  };

  useEffect(() => {
    if (!cobranca?.subscriptionId || cobranca.confirmado || !selecionado) return;
    let ativo = true;
    const verificar = async () => {
      const r = await api(`/subscription/payment-status?id=${encodeURIComponent(cobranca.subscriptionId)}`);
      if (!ativo || !r || r.error) return;
      if (["ativa", "trial"].includes(r.status)) {
        setCobranca(c => c ? { ...c, confirmado: true } : c);
        await carregar(); await recarregar?.();
      } else if (r.status === "cancelada") { setCobranca(null); aviso(t("sub.checkoutCancelled")); }
    };
    verificar(); const timer = setInterval(verificar, 4000);
    return () => { ativo = false; clearInterval(timer); };
  }, [cobranca, selecionado, carregar]);

  const cancelar = async () => {
    const r = await apiDelete("/subscription");
    if (r?.error) return aviso(r.error);
    await carregar();
    await recarregar?.();
    aviso(r.message);
  };

  if (!planos.length) return <div className="vx-card vx-skeleton" style={{ height: 180 }} />;

  const precoFinal = desconto?.valorFinal ?? selecionado?.preco;

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">{t("sub.businessSubscription")}</div>
          <h1 className="vx-disp">{t("sub.rycsPlans")}</h1>
          <p>{t("sub.rycsPlansDesc")}</p>
        </div>
        <span className="vx-chip">{t("sub.current")}: {atual?.detalhes?.nome || "Sandbox"}</span>
      </div>

      <div className="vx-grid vx-g3">
        {planos.map((p) => {
          const recomendado = Number(p.preco) === 999.9;
          const ehAtual = p.chave === atual?.plano;
          return (
            <article key={p.chave} className={`vx-card vx-plan-card${recomendado ? " vx-plan-recommended" : ""}`}>
              {recomendado && <span className="vx-plan-ribbon"><Sparkles size={12} />{t("sub.recommended")}</span>}
              <h2 className="vx-disp">{p.nome}</h2>
              <div className="vx-plan-price">{money(p.preco)}<small>/mês</small></div>
              <span className="vx-chip">{t("sub.taskRate")}: {Math.round(p.takeRate * 100)}%</span>
              <div className="vx-plan-benefits">{p.inclui.map((i) => <div key={i}><Check size={13} />{i}</div>)}</div>
              <button className={`vx-btn vx-btn-block ${ehAtual ? "" : "vx-btn-primary"}`} disabled={ehAtual} onClick={() => abrirModal(p)}>
                {ehAtual ? t("sub.currentPlan") : t("sub.subscribe")}
              </button>
            </article>
          );
        })}
      </div>

      {atual?.assinatura?.status === "pendente" && (
        <div className="vx-notice vx-notice-amber" style={{ marginTop: 14 }}>
          {t("sub.pendingPaymentNotice")}
        </div>
      )}
      {["ativa", "pendente", "trial"].includes(atual?.assinatura?.status) && (
        <button className="vx-btn vx-btn-danger" style={{ marginTop: 14 }} onClick={cancelar}>{t("sub.cancel")}</button>
      )}

      {/* Modal de checkout */}
      {selecionado && (
        <div className="vx-overlay" onClick={() => setSelecionado(null)}>
          <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="vx-row">
              <div>
                <div className="vx-eyebrow">{t("sub.secureCheckout")}</div>
                <h2 className="vx-disp" style={{ margin: "3px 0" }}>{selecionado.nome}</h2>
              </div>
              <button className="vx-btn vx-btn-ghost" onClick={() => setSelecionado(null)}><X size={16} /></button>
            </div>

            {!cobranca ? (
              <>
                {/* Resumo */}
                <div className="vx-checkout-total">
                  <span>{t("sub.originalValue")}</span><b>{money(selecionado.preco)}</b>
                  {desconto && (
                    <>
                      <span>Voucher {desconto.codigo}</span><b>- {money(desconto.desconto)}</b>
                      <span>{t("sub.total")}</span><strong>{money(desconto.valorFinal)}</strong>
                    </>
                  )}
                </div>

                {/* Voucher */}
                <label style={{ display: "block", marginBottom: 16 }}>
                  <span className="vx-label">Voucher</span>
                  <div style={{ display: "flex", gap: 7 }}>
                    <input className="vx-input" value={voucher}
                      onChange={(e) => { setVoucher(e.target.value.toUpperCase()); setDesconto(null); }} />
                    <button className="vx-btn" onClick={aplicar} disabled={!voucher}>{t("sub.apply")}</button>
                  </div>
                </label>

                {/* Forma de pagamento */}
                <div className="vx-eyebrow" style={{ marginBottom: 10 }}>{t("sub.paymentMethod")}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[["CREDIT_CARD", t("sub.creditCard")], ["DEBIT_CARD", t("sub.debitCard")], ["PIX", "Pix"]].map(([k, label]) => (
                    <button key={k} className="vx-btn" onClick={() => setForma(k)} style={{
                      flex: 1, fontSize: 12,
                      borderColor: forma === k ? "var(--brand)" : undefined,
                      background: forma === k ? "var(--brand-50)" : undefined,
                      color: forma === k ? "var(--brand)" : undefined,
                    }}>{label}</button>
                  ))}
                </div>

                {/* Formulário de cartão */}
                {forma === "CREDIT_CARD" && (
                  <>
                    <label><div className="vx-label">{t("sub.cardName")}</div>
                      <input className="vx-input" value={cartao.nome}
                        onChange={(e) => setCartao({ ...cartao, nome: e.target.value })} autoComplete="cc-name" /></label>

                    <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">{t("sub.cardNumber")}</div>
                      <input className="vx-input vx-mono" inputMode="numeric" value={mascaraCartao(cartao.numero)}
                        onChange={(e) => setCartao({ ...cartao, numero: SO_DIGITOS(e.target.value) })}
                        placeholder="0000 0000 0000 0000" autoComplete="cc-number" /></label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                      <label><div className="vx-label">{t("sub.cardMonth")}</div>
                        <input className="vx-input vx-mono" inputMode="numeric" maxLength={2} placeholder="12"
                          value={cartao.validadeMes}
                          onChange={(e) => setCartao({ ...cartao, validadeMes: SO_DIGITOS(e.target.value).slice(0, 2) })} /></label>
                      <label><div className="vx-label">{t("sub.cardYear")}</div>
                        <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="2030"
                          value={cartao.validadeAno}
                          onChange={(e) => setCartao({ ...cartao, validadeAno: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
                      <label><div className="vx-label">CVV</div>
                        <input className="vx-input vx-mono" inputMode="numeric" maxLength={4} placeholder="123"
                          value={cartao.cvv}
                          onChange={(e) => setCartao({ ...cartao, cvv: SO_DIGITOS(e.target.value).slice(0, 4) })} /></label>
                    </div>

                    <div className="vx-eyebrow" style={{ margin: "16px 0 10px" }}>{t("sub.billingAddress")}</div>
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
                      {t("sub.cardSecurityNote")}
                    </div>
                  </>
                )}

                {forma === "DEBIT_CARD" && <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7 }}>
                  {t("sub.debitDesc")}
                </p>}
                {forma === "PIX" && (
                  <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                    <QrCode size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    {t("sub.pixCheckoutDesc")}
                  </div>
                )}

                <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}
                  disabled={processando} onClick={contratar}>
                  {processando
                    ? <><Loader size={15} /> {t("sub.processing")}</>
                    : <><CreditCard size={15} /> {t("sub.confirm")} {money(precoFinal ?? selecionado.preco)}</>}
                </button>
                <p className="vx-chart-source">
                  {t("sub.noChargeWithoutConfirm")}
                </p>
              </>
            ) : (
              <div style={{ textAlign: "center", paddingTop: 8 }}>
                <h3 className="vx-disp">{cobranca.confirmado ? (cobranca.status === "trial" ? t("sub.cardRegistered") : t("sub.paymentConfirmedTitle")) : forma === "PIX" ? t("sub.payWithPix") : t("sub.awaitingPaymentTitle")}</h3>
                {!cobranca.confirmado && cobranca.pixQrCodeBase64 && (
                  <img alt="QR Code Pix" src={`data:image/png;base64,${cobranca.pixQrCodeBase64}`}
                    style={{ width: 210, maxWidth: "100%", background: "#fff", padding: 8, borderRadius: 12 }} />
                )}
                {!cobranca.confirmado && cobranca.pixCopiaECola && (
                  <button className="vx-btn vx-btn-primary vx-btn-block"
                    onClick={async () => { try { await navigator.clipboard.writeText(cobranca.pixCopiaECola); aviso(t("pay.pixCopied")); } catch { aviso(t("pay.pixCopyManual")); } }}>
                    <Copy size={14} />{t("pay.copyPix")}
                  </button>
                )}
                {!cobranca.confirmado && cobranca.pixCopiaECola && <textarea aria-label="Pix copia e cola" className="vx-input vx-mono" readOnly rows={3} value={cobranca.pixCopiaECola} onFocus={e => e.target.select()} />}
                {!cobranca.confirmado && forma !== "PIX" && cobranca.invoiceUrl && (
                  <a className="vx-btn vx-btn-block" href={cobranca.invoiceUrl} target="_blank" rel="noreferrer">
                    {t("sub.continueDebit")}
                  </a>
                )}
                <div className="vx-notice vx-notice-amber" style={{ marginTop: 12 }}>
                  {cobranca.confirmado ? (cobranca.status === "trial" ? t("sub.cardRegisteredTrial") : t("sub.paymentConfirmedPlan")) : t("sub.awaitingConfirmAuto")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
