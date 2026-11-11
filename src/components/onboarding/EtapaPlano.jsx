import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { formatarData } from "../../../shared/assinatura.js";
import { normalizarDocumento } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Etapa 5: plano e pagamento. Planos e preços vêm de shared/planos.js pelo
// servidor; nada fixo aqui. O cartão vai ao gateway (Asaas) na requisição do
// checkout e não fica na RYCS: o que volta é bandeira e quatro dígitos.
// Pix comum fica na RYCS; débito é concluído na fatura segura do Asaas.

const digitos = (v) => String(v || "").replace(/\D/g, "");
const mascaraCartao = (v) => digitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
const mascaraValidade = (v) => { const d = digitos(v).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
const mascaraCep = (v) => { const d = digitos(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

function validarCartao(c, t) {
  const e = {};
  if (c.nome.trim().length < 3) e.nome = t("onb.plan.errCardName");
  if (digitos(c.numero).length < 13) e.numero = t("onb.plan.errCardNumber");
  const [mes, ano] = c.validade.split("/").map(Number);
  const agora = new Date();
  const fimValidade = new Date(2000 + (ano || 0), mes || 0, 1);
  if (!(mes >= 1 && mes <= 12) || !ano || fimValidade <= agora) e.validade = t("onb.plan.errExpiry");
  if (!/^\d{3,4}$/.test(c.cvv)) e.cvv = t("onb.plan.errCvv");
  if (!normalizarDocumento(c.documento)) e.documento = t("onb.plan.errDocument");
  if (digitos(c.cep).length !== 8) e.cep = t("onb.plan.errZip");
  if (!c.numeroEndereco.trim()) e.numeroEndereco = t("onb.plan.errAddressNumber");
  return e;
}

export default function EtapaPlano({ aoAtualizar, aoAvancar, aoVoltar }) {
  const { t } = useI18n();
  const id = useId();
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const [plano, setPlano] = useState("");
  const [cartao, setCartao] = useState({ nome: "", numero: "", validade: "", cvv: "", documento: "", cep: "", numeroEndereco: "", telefone: "" });
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [forma, setForma] = useState("pix"); // cartao | pix
  const [pix, setPix] = useState(null); // QR aberto: { payload, imagem, primeiraCobranca }
  const [copiado, setCopiado] = useState(false);
  const consulta = useRef(null);

  const carregar = async () => {
    setErroCarga("");
    const r = await api("/onboarding/plano");
    if (!r || r.error) return setErroCarga(r?.error || t("onb.plan.errLoad"));
    setDados(r);
    setPlano((p) => p || r.planos[0]?.chave || "");
  };
  useEffect(() => { carregar(); }, []);

  const terminar = async () => {
    const r = await api("/onboarding");
    if (r && !r.error) { aoAtualizar(r); aoAvancar(r); }
  };

  const manter = async () => {
    setErro("");
    setEnviando(true);
    const r = await api("/onboarding/plano/manter", {});
    setEnviando(false);
    if (!r || r.error) return setErro(r?.error || t("onb.plan.errContinue"));
    aoAtualizar(r);
    aoAvancar(r);
  };

  // Enquanto o QR está aberto, pergunta ao servidor se o banco já autorizou.
  useEffect(() => {
    if (!pix) return undefined;
    let vivo = true;
    const verificar = async () => {
      const r = await api(`/subscription/payment-status?id=${encodeURIComponent(pix.subscriptionId)}`);
      if (!vivo || !r || r.error) return;
      if (["ativa", "trial"].includes(r.status)) { clearInterval(consulta.current); await terminar(); }
      else if (r.status === "cancelada") {
        clearInterval(consulta.current);
        setPix(null);
        setErro(t("onb.plan.errCancelled"));
      }
    };
    consulta.current = setInterval(verificar, 4000);
    return () => { vivo = false; clearInterval(consulta.current); };
  }, [pix]);

  const assinarPix = async () => {
    const doc = normalizarDocumento(cartao.documento);
    if (!doc) {
      setErros({ documento: t("onb.plan.errDocument") });
      document.getElementById(`${id}-documento`)?.focus();
      return;
    }
    setErros({});
    setEnviando(true);
    const r = await api("/subscription", { plano, onboarding: true, formaPagamento: forma === "debito" ? "DEBIT_CARD" : "PIX", titular: { documento: doc } });
    setEnviando(false);
    if (!r || r.error) {
      if (r?.campo) setErros({ [r.campo]: r.error });
      return setErro(r?.error ? `${t("onb.plan.errPaymentInit")}: ${r.error}` : t("onb.plan.errPaymentInit"));
    }
    if (r.jaPago) return terminar();
    setPix({ payload: r.pixCopiaECola, imagem: r.pixQrCodeBase64, primeiraCobranca: r.primeiraCobranca,
      subscriptionId: r.subscriptionId, invoiceUrl: r.invoiceUrl, valor: r.valorFinal });
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(pix.payload); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { /* o campo continua selecionável */ }
  };

  const assinar = async (e) => {
    e.preventDefault();
    setErro("");
    if (forma !== "cartao") return assinarPix();
    const v = validarCartao(cartao, t);
    setErros(v);
    if (Object.keys(v).length) {
      document.getElementById(`${id}-${Object.keys(v)[0]}`)?.focus();
      return;
    }
    const [mes, ano] = cartao.validade.split("/");
    setEnviando(true);
    const r = await api("/subscription", {
      plano, onboarding: true, formaPagamento: "CREDIT_CARD",
      cartao: { nome: cartao.nome, numero: digitos(cartao.numero), validadeMes: mes, validadeAno: ano, cvv: cartao.cvv },
      titular: { nome: cartao.nome, documento: digitos(cartao.documento), cep: digitos(cartao.cep), numero: cartao.numeroEndereco, telefone: digitos(cartao.telefone) },
    });
    setEnviando(false);
    if (!r || r.error) {
      // Recusa do cartão vem do gateway com o motivo. Os dados ficam na tela
      // para corrigir; o CVV é pedido de novo.
      setCartao((c) => ({ ...c, cvv: "" }));
      if (r?.campo) setErros({ [r.campo]: r.error });
      return setErro(r?.error ? `${t("onb.plan.errCardRegister")}: ${r.error}` : t("onb.plan.errCardRegister"));
    }
    if (r.status === "ativa") return terminar();
    setPix({ subscriptionId: r.subscriptionId, valor: r.valorFinal });
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>{t("onb.tryAgain")}</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">{t("onb.plan.loading")}</div>;

  const escolhido = dados.planos.find((p) => p.chave === plano);
  const cobrancaEm = new Date();

  if (dados.atual) return (
    <div>
      <div className="vx-onb-eyebrow">{t("onb.stepOf", { n: 5, total: 6 })}</div>
      <h1 className="vx-disp vx-onb-titulo">{t("onb.plan.yourPlan")}</h1>
      <div className="vx-onb-card vx-onb-secao" style={{ maxWidth: 640 }}>
        <div className="vx-onb-icone" aria-hidden="true"><Check size={22} /></div>
        <p style={{ fontSize: 15, margin: "0 0 6px" }}>{dados.atual.nome ? t("onb.plan.alreadyHasPlan", { plan: dados.atual.nome }) : t("onb.plan.alreadyHasAccess")}</p>
        <p className="vx-mut" style={{ fontSize: 14, margin: 0 }}>{t("onb.plan.noExtraCharge")}</p>
        {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
        <div className="vx-onb-acoes">
          <button type="button" className="vx-btn" onClick={aoVoltar}>{t("onb.back")}</button>
          <button type="button" className="vx-btn vx-btn-primary" onClick={manter} disabled={enviando}>{enviando ? t("onb.saving") : t("onb.plan.keepPlan")}</button>
        </div>
      </div>
    </div>
  );

  if (pix) return (
    <div>
      <div className="vx-onb-eyebrow">{t("onb.stepOf", { n: 5, total: 6 })}</div>
      <h1 className="vx-disp vx-onb-titulo">{forma === "cartao" ? t("onb.plan.confirmingPayment") : forma === "debito" ? t("onb.plan.payWithDebit") : t("onb.plan.payWithPix")}</h1>
      <div className="vx-onb-card vx-onb-secao" style={{ maxWidth: 640 }}>
        <p className="vx-mut" style={{ fontSize: 14, lineHeight: 1.7 }}>
          {forma === "cartao" ? t("onb.plan.waitingCard") : forma === "debito" ? t("onb.plan.debitDesc") : t("onb.plan.pixDesc")}
        </p>
        <p><b>{money(pix.valor ?? escolhido?.preco)}</b> · {t("onb.plan.plan")} {escolhido?.nome}</p>
        {forma === "debito" && pix.invoiceUrl && <a className="vx-btn vx-btn-primary" href={pix.invoiceUrl} target="_blank" rel="noreferrer">{t("onb.plan.continueDebit")}</a>}
        {pix.imagem && <img src={`data:image/png;base64,${pix.imagem}`} alt="QR Code Pix" width={220} height={220} style={{ display: "block", margin: "0 auto 14px" }} />}
        {pix.payload && (
          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-pix`}>{t("onb.plan.pixCopyPaste")}</label>
            <textarea id={`${id}-pix`} className="vx-input vx-mono" rows={3} readOnly value={pix.payload} onFocus={(e) => e.target.select()} />
            <button type="button" className="vx-btn" style={{ minHeight: 44, marginTop: 8 }} onClick={copiar}>
              <Copy size={15} aria-hidden="true" /> {copiado ? t("onb.plan.codeCopied") : t("onb.plan.copyCode")}
            </button>
          </div>
        )}
        <p className="vx-onb-dica" role="status">{t("onb.plan.waitingBank")}</p>
        <div className="vx-onb-acoes">
          <button type="button" className="vx-btn" onClick={() => { setPix(null); setForma("cartao"); }}>{t("onb.plan.useCreditCard")}</button>
          <span />
        </div>
      </div>
    </div>
  );

  const campo = (chave, label, props = {}, mascara = (v) => v) => (
    <div className="vx-onb-campo">
      <label className="vx-label" htmlFor={`${id}-${chave}`}>{label}</label>
      <input id={`${id}-${chave}`} className="vx-input" value={cartao[chave]}
        onChange={(e) => { setCartao((c) => ({ ...c, [chave]: mascara(e.target.value) })); if (erros[chave]) setErros((x) => ({ ...x, [chave]: undefined })); }}
        aria-invalid={erros[chave] ? true : undefined} aria-describedby={erros[chave] ? `${id}-${chave}-erro` : undefined} {...props} />
      {erros[chave] && <div id={`${id}-${chave}-erro`} className="vx-onb-erro" role="alert">{erros[chave]}</div>}
    </div>
  );

  return (
    <form onSubmit={assinar} noValidate>
      <div className="vx-onb-eyebrow">{t("onb.stepOf", { n: 5, total: 6 })}</div>
      <h1 className="vx-disp vx-onb-titulo">{t("onb.plan.choosePlan")}</h1>
      <p className="vx-mut vx-onb-card-apoio">{t("onb.plan.choosePlanDesc")}</p>

      <div className="vx-onb-plano">
        <fieldset className="vx-onb-planos">
          <legend className="vx-label">{t("onb.plan.plans")}</legend>
          {dados.planos.map((p) => (
            <label key={p.chave} className="vx-onb-card vx-onb-opcao" data-on={plano === p.chave ? "1" : "0"}>
              <input type="radio" name={`${id}-plano`} value={p.chave} checked={plano === p.chave} onChange={() => setPlano(p.chave)} />
              <span>
                <b className="vx-disp">{p.nome}</b>
                <span className="vx-onb-preco">{money(p.preco)}<small>/{t("onb.plan.month")}</small></span>
                <ul>{(p.inclui || []).map((i) => <li key={i}>{i}</li>)}</ul>
              </span>
            </label>
          ))}
        </fieldset>

        <section className="vx-onb-card" aria-labelledby={`${id}-pag`}>
          <h2 id={`${id}-pag`} className="vx-disp" style={{ fontSize: 18, margin: "0 0 14px" }}>{t("onb.plan.payment")}</h2>
          <fieldset className="vx-onb-campo" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
            <legend className="vx-label">{t("onb.plan.paymentMethod")}</legend>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["pix", "Pix"], ["cartao", t("onb.plan.credit")], ["debito", t("onb.plan.debit")]].map(([v, rotulo]) => (
                <label key={v} className="vx-btn" data-on={forma === v ? "1" : "0"}
                  style={{ minHeight: 44, flex: 1, justifyContent: "center", ...(forma === v ? { borderColor: "var(--brand)", color: "var(--brand)" } : {}) }}>
                  <input type="radio" name={`${id}-forma`} value={v} checked={forma === v}
                    onChange={() => { setForma(v); setErros({}); setErro(""); }} style={{ marginRight: 6 }} />
                  {rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          {forma === "cartao" ? <>
            {campo("nome", t("onb.plan.cardName"), { autoComplete: "cc-name" })}
            {campo("numero", t("onb.plan.cardNumber"), { autoComplete: "cc-number", inputMode: "numeric" }, mascaraCartao)}
            <div className="vx-onb-dois">
              {campo("validade", t("onb.plan.expiry"), { autoComplete: "cc-exp", inputMode: "numeric", placeholder: "MM/AA" }, mascaraValidade)}
              {campo("cvv", "CVV", { autoComplete: "cc-csc", inputMode: "numeric", maxLength: 4 }, (v) => digitos(v).slice(0, 4))}
            </div>
            {campo("documento", t("onb.plan.holderDoc"), { inputMode: "numeric" }, (v) => digitos(v).slice(0, 14))}
            <div className="vx-onb-dois">
              {campo("cep", t("onb.plan.billingZip"), { autoComplete: "postal-code", inputMode: "numeric" }, mascaraCep)}
              {campo("numeroEndereco", t("onb.plan.addressNumber"), { autoComplete: "address-line2" })}
            </div>
          </> : <>
            <p className="vx-mut" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" }}>
              {forma === "debito" ? t("onb.plan.debitNote") : t("onb.plan.pixNote")}
            </p>
            {campo("documento", t("onb.plan.companyDoc"), { inputMode: "numeric" }, (v) => digitos(v).slice(0, 14))}
          </>}

          <dl className="vx-onb-resumo">
            <div><dt>{t("onb.plan.plan")}</dt><dd>{escolhido ? `${escolhido.nome} · ${money(escolhido.preco)}/${t("onb.plan.month")}` : "—"}</dd></div>
            <div><dt>{forma === "cartao" ? t("onb.plan.chargedToday") : t("onb.plan.amountDue")}</dt><dd>{money(escolhido?.preco)}</dd></div>
            <div><dt>{forma === "cartao" ? t("onb.plan.firstCharge") : t("onb.plan.dueDate")}</dt><dd>{escolhido ? `${money(escolhido.preco)} ${t("onb.plan.on")} ${formatarData(cobrancaEm)}` : "—"}</dd></div>
          </dl>

          <div aria-live="polite">{erro && <div className="vx-onb-erro" role="alert">{erro}</div>}</div>
          <button type="submit" className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" disabled={enviando || !plano}>
            {forma !== "cartao"
              ? (enviando ? t("onb.plan.preparingPayment") : forma === "debito" ? t("onb.plan.continueDebit") : t("onb.plan.generateQR"))
              : enviando ? t("onb.plan.processingPayment") : t("onb.plan.payAndContinue")}
          </button>
          <p className="vx-onb-dica" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <ShieldCheck size={15} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
            {forma !== "cartao" ? t("onb.plan.securityNotePix") : t("onb.plan.securityNoteCard")}
          </p>
        </section>
      </div>

      <div className="vx-onb-acoes">
        <button type="button" className="vx-btn" onClick={aoVoltar} disabled={enviando}>{t("onb.back")}</button>
        <span />
      </div>
    </form>
  );
}
