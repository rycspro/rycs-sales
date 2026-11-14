import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, CreditCard, Globe, Loader, ShieldCheck, X, QrCode } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { PLANOS, ORDEM_PLANOS, CICLOS, valorCobradoNoCiclo } from "../../../shared/planos.js";
import PricingPlanos from "./PricingPlanos.jsx";
import CheckoutStripe from "./CheckoutStripe.jsx";
import HoloCard from "../HoloCard.jsx";

const PLANOS_ESTATICOS = ORDEM_PLANOS.filter((k) => PLANOS[k].preco > 0).map((k) => ({
  chave: k, nome: PLANOS[k].nome, preco: PLANOS[k].preco, takeRate: PLANOS[k].takeRate, inclui: PLANOS[k].inclui, trial: PLANOS[k].trial,
}));

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const mascaraCartao = (v) => SO_DIGITOS(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

export default function PlanosEmpresa({ aviso, recarregar }) {
  const [planos, setPlanos] = useState([]);
  const [atual, setAtual] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [ciclo, setCiclo] = useState(CICLOS.MENSAL);
  const [voucher, setVoucher] = useState("");
  const [desconto, setDesconto] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [forma, setForma] = useState("");
  const [cartao, setCartao] = useState({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
  const [titular, setTitular] = useState({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });
  const [salvarCartao, setSalvarCartao] = useState(false);
  const [cartoesSalvos, setCartoesSalvos] = useState([]);
  const [cardSalvoId, setCardSalvoId] = useState(null); // cartão salvo selecionado
  const [stripe, setStripe] = useState(null);
  const [embutido, setEmbutido] = useState(null);
  const [statusPagamento, setStatusPagamento] = useState(null);
  const [pixQr, setPixQr] = useState(null);
  const [vouchersUsados, setVouchersUsados] = useState([]);
  const pixPollRef = useRef(null);

  useEffect(() => {
    if (!pixQr?.subscriptionId) { clearInterval(pixPollRef.current); return; }
    pixPollRef.current = setInterval(async () => {
      const r = await api("/subscription");
      if (r?.assinatura?.status === "ativa") {
        clearInterval(pixPollRef.current);
        setPixQr(null);
        setSelecionado(null);
        setStatusPagamento("confirmado");
        await Promise.all([carregar(), recarregar?.()]);
      }
    }, 5000);
    return () => clearInterval(pixPollRef.current);
  }, [pixQr?.subscriptionId]);

  const carregar = useCallback(async () => {
    const [p, s] = await Promise.all([api("/plans"), api("/subscription")]);
    if (Array.isArray(p) && p.length > 0) setPlanos(p.filter((x) => x.preco > 0));
    else setPlanos(PLANOS_ESTATICOS);
    if (s && !s.error) setAtual(s);
  }, []);

  useEffect(() => {
    carregar();
    api("/stripe/status").then((r) => r && !r.error && setStripe(r));
    api("/saved-cards").then((r) => Array.isArray(r) && setCartoesSalvos(r));
    api("/vouchers/history").then((r) => Array.isArray(r) && setVouchersUsados(r));
  }, [carregar]);

  const abrirModal = (p, cicloEscolhido = CICLOS.MENSAL) => {
    setSelecionado(p);
    setCiclo(cicloEscolhido);
    setVoucher("");
    setDesconto(null);
    setForma("");
    setEmbutido(null);
    setCardSalvoId(null);
    setSalvarCartao(false);
    setCartao({ nome: "", numero: "", validadeMes: "", validadeAno: "", cvv: "" });
    setTitular({ nome: "", email: "", documento: "", cep: "", numero: "", telefone: "" });
  };

  const aplicar = async () => {
    const r = await api(`/vouchers/validate?codigo=${encodeURIComponent(voucher)}&plano=${selecionado.chave}&ciclo=${ciclo}`);
    if (r?.error) { setDesconto(null); return aviso(r.error); }
    setDesconto(r);
    aviso("Voucher aplicado ao checkout.");
  };

  const contratar = async () => {
    // Empresa fora do Brasil: paga em dólar na página do Stripe.
    if (forma === "STRIPE") {
      setProcessando(true);
      const r = await api("/subscription/stripe", { plano: selecionado.chave, ciclo, retorno: window.location.pathname, embutido: !!stripe?.chavePublica });
      setProcessando(false);
      if (r?.clientSecret && r?.chavePublica) { setEmbutido(r); return; }
      if (!r || r.error || !r.url) return aviso(r?.error || "Não foi possível abrir o pagamento internacional.");
      window.location.href = r.url;
      return;
    }
    setProcessando(true);
    const r = await api("/subscription", {
      plano: selecionado.chave,
      ciclo,
      voucher: voucher || undefined,
      formaPagamento: forma,
    });
    setProcessando(false);

    if (!r) return aviso("Sem resposta do servidor. Verifique a conexão e tente de novo.");
    if (r.error) return aviso(r.error);

    if (r.pixCopiaECola || r.pixQrCodeBase64) {
      setPixQr(r);
      return;
    }

    setStatusPagamento(r.jaPago ? "confirmado" : "registrada");
    await Promise.all([carregar(), recarregar?.()]);
  };

  const abrirPortal = async () => {
    const r = await api("/subscription/stripe/portal", { retorno: window.location.pathname });
    if (r?.url) window.location.href = r.url;
    else aviso(r?.error || "Não foi possível abrir o portal de pagamento.");
  };

  const cancelar = async () => {
    const r = await apiDelete("/subscription");
    if (r?.error) return aviso(r.error);
    await carregar();
    await recarregar?.();
    aviso(r.message);
  };

  // Voltar ao plano gratuito. Com assinatura paga ativa/pendente/trial, o caminho
  // correto é cancelar (encerra a recorrência no gateway); sem ela, troca direta.
  const usarGratis = async () => {
    const status = atual?.assinatura?.status;
    if (["ativa", "pendente", "trial", "inadimplente"].includes(status)) return cancelar();
    const r = await api("/subscription", { plano: "free", ciclo: CICLOS.MENSAL });
    if (r?.error) return aviso(r.error);
    await carregar();
    await recarregar?.();
    aviso(r.message || "Plano alterado para Grátis.");
  };

  if (!planos.length) return <div className="vx-card vx-skeleton" style={{ height: 180 }} />;

  // Valor-base do checkout conforme o ciclo escolhido (semestral/anual = 6/12
  // meses com desconto, cobrados de uma vez).
  // Origem do pagamento derivada da forma: vazio = nada escolhido; STRIPE =
  // internacional; qualquer outra (cartão/Pix) = nacional.
  const origem = forma ? (forma === "STRIPE" ? "internacional" : "nacional") : null;
  const baseCiclo = selecionado ? valorCobradoNoCiclo(selecionado.chave, ciclo) : 0;
  const cicloLabel = { MENSAL: "mensal", SEMESTRAL: "semestral", ANUAL: "anual" }[ciclo] || "mensal";
  const cicloSufixo = { MENSAL: "/mês", SEMESTRAL: "/semestre", ANUAL: "/ano" }[ciclo] || "/mês";
  const ehRecorrenteLongo = ciclo !== CICLOS.MENSAL;
  const precoFinal = desconto?.valorFinal ?? baseCiclo;
  const usdPlano = selecionado && stripe?.planos?.find((x) => x.chave === selecionado.chave);
  const precoUsd = usdPlano ? ({ MENSAL: usdPlano.mensal, SEMESTRAL: usdPlano.semestral, ANUAL: usdPlano.anual }[ciclo] ?? usdPlano.mensal) : 0;
  const usd = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div className="vx-fade">
      <div>
        <div style={{ padding: "4px 0 16px" }}>
          <div className="vx-eyebrow">Assinatura empresarial</div>
          <h1 className="vx-disp" style={{ margin: "2px 0 3px" }}>Planos RYCS</h1>
          <p style={{ margin: 0 }}>Escolha o plano que acompanha o ritmo da sua operação: quanto mais você escala, menor a taxa por movimentações. Comece com 5 dias grátis nos planos Scale e Premium, sem compromisso.</p>
        </div>

        <div style={{ padding: "4px 0 8px" }}>
            <PricingPlanos
              plans={planos}
              planoAtualChave={atual?.plano}
              onUsarGratis={usarGratis}
              onContratar={(chave, cicloEscolhido) => {
                const p = planos.find((x) => x.chave === chave);
                if (p) abrirModal(p, cicloEscolhido);
              }}
            />

{["ativa", "pendente", "trial"].includes(atual?.assinatura?.status) && (
              <button className="vx-btn vx-btn-danger" style={{ marginTop: 14 }} onClick={cancelar}>Cancelar assinatura</button>
            )}
            {atual?.assinatura?.gateway === "stripe" && ["ativa", "trial", "inadimplente"].includes(atual?.assinatura?.status) && (
              <button className="vx-btn" style={{ marginTop: 14, marginLeft: 8 }} onClick={abrirPortal}>
                <CreditCard size={14} /> Cartão e faturas (Stripe)
              </button>
            )}
        </div>
      </div>

      {/* Modal de checkout */}
      {selecionado && (
        <div className="vx-overlay" onClick={() => setSelecionado(null)}>
          <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: embutido ? 640 : 520 }}>
            <div className="vx-row">
              <div>
                <div className="vx-eyebrow">Checkout seguro</div>
                <h2 className="vx-disp" style={{ margin: "3px 0" }}>{selecionado.nome}</h2>
              </div>
              <button className="vx-btn vx-btn-ghost" onClick={() => setSelecionado(null)}><X size={16} /></button>
            </div>

            {embutido ? (
              <CheckoutStripe
                chavePublica={embutido.chavePublica}
                clientSecret={embutido.clientSecret}
                subscriptionId={embutido.subscriptionId}
                aoErro={(m) => { setEmbutido(null); aviso(m); }}
                aoConcluir={async (a) => {
                  setEmbutido(null);
                  setSelecionado(null);
                  await carregar();
                  await recarregar?.();
                  aviso(a ? `Plano ${selecionado.nome} liberado!` : "Pagamento recebido. O plano aparece em instantes; atualize a página se precisar.");
                }}
              />
            ) : (
              <>
                {/* Resumo */}
                <div className="vx-checkout-total">
                  <span>Plano {selecionado.nome} · {cicloLabel}</span><b>{money(baseCiclo)}</b>
                  {ehRecorrenteLongo && (
                    <><span>Cobrança</span><b>{money(baseCiclo)}{cicloSufixo}</b></>
                  )}
                  {desconto && (
                    <>
                      <span>Voucher {desconto.codigo}</span><b>- {money(desconto.desconto)}</b>
                      {desconto.valorFinal > 0 && desconto.valorFinal < 5 && (
                        <><span>Taxa complementar (mín. gateway)</span><b>+ {money(5 - desconto.valorFinal)}</b></>
                      )}
                      <span>Total</span><strong>{money(Math.max(desconto.valorFinal, desconto.valorFinal > 0 ? 5 : 0))}</strong>
                    </>
                  )}
                </div>

                {/* Voucher */}
                <label style={{ display: "block", marginBottom: vouchersUsados.length && !desconto ? 6 : 16 }}>
                  <span className="vx-label">Voucher</span>
                  <div style={{ display: "flex", gap: 7 }}>
                    <input className="vx-input" value={voucher}
                      onChange={(e) => { setVoucher(e.target.value.toUpperCase()); setDesconto(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && voucher) aplicar(); }} />
                    <button className="vx-btn" onClick={aplicar} disabled={!voucher}>Aplicar</button>
                  </div>
                </label>
                {vouchersUsados.length > 0 && !desconto && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Vouchers usados anteriormente:</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {vouchersUsados.map((v) => (
                        <button key={v.codigo} className="vx-btn" style={{ fontSize: 11, padding: "3px 10px" }}
                          onClick={() => { setVoucher(v.codigo); }}>
                          {v.codigo}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forma de pagamento — 1º escolhe a origem (nacional/internacional),
                    depois a forma específica. Nacional = Asaas (cartão/Pix, R$);
                    internacional = Stripe (cartão em US$). */}
                <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Forma de pagamento</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  {[
                    { id: "nacional", titulo: "Pagamento nacional", sub: "Pix · R$", icone: <QrCode size={26} strokeWidth={1.8} aria-hidden="true" /> },
                    ...(stripe?.ativo ? [{ id: "internacional", titulo: "Pagamento internacional", sub: "Cartão · US$", icone: <Globe size={26} strokeWidth={1.8} aria-hidden="true" /> }] : []),
                  ].map(({ id, titulo, sub, icone }) => {
                    const on = origem === id;
                    return (
                      <button key={id} type="button"
                        onClick={() => setForma(id === "nacional" ? "PIX" : "STRIPE")}
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

                {/* Pix nacional */}
                {forma === "PIX" && (
                  <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                    <QrCode size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    Geramos um QR Code Pix após a confirmação. O acesso é liberado assim que o pagamento for confirmado.
                    <div style={{ marginTop: 6 }}>A cobrança é à vista, mês a mês.</div>
                  </div>
                )}

                {forma === "STRIPE" && (
                  <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                    <ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    Para empresas fora do Brasil: {usd(precoUsd)}{cicloSufixo}, pagos no formulário seguro do Stripe, aqui mesmo, com cartão
                    internacional (ou UPI, na Índia). Cupons são aplicados direto no Stripe. O plano é liberado quando o Stripe confirmar.
                  </div>
                )}

                <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}
                  disabled={processando || !forma} onClick={contratar}>
                  {processando
                    ? <><Loader size={15} /> Processando…</>
                    : forma === "STRIPE"
                      ? <><CreditCard size={15} /> Continuar para o pagamento ({usd(precoUsd)})</>
                      : <><QrCode size={15} /> Pagar com Pix {money(precoFinal ?? selecionado.preco)}</>}
                </button>
                <p className="vx-chart-source">
                  Nenhuma cobrança é feita sem esta confirmação. Ativação apenas após confirmação do gateway.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {pixQr && (
        <div className="vx-overlay" style={{ zIndex: 1100 }}>
          <div className="vx-sheet" style={{ maxWidth: 420, textAlign: "center", padding: "32px 28px" }}>
            <QrCode size={30} color="var(--brand)" />
            <h2 style={{ margin: "12px 0 4px", fontSize: 20 }}>Pague com Pix para ativar</h2>
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
              Seu acesso é liberado automaticamente assim que o pagamento for confirmado.
            </p>
            {pixQr.pixQrCodeBase64 && (
              <img src={`data:image/png;base64,${pixQr.pixQrCodeBase64}`} alt="QR Code Pix"
                style={{ width: 200, height: 200, margin: "0 auto 16px", display: "block", borderRadius: 10 }} />
            )}
            {pixQr.pixCopiaECola && (
              <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => { navigator.clipboard?.writeText(pixQr.pixCopiaECola); aviso("Código Pix copiado!"); }}>
                Copiar código Pix
              </button>
            )}
            <button className="vx-btn vx-btn-block" style={{ marginTop: 8 }} onClick={() => { setPixQr(null); setSelecionado(null); carregar(); recarregar?.(); }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {statusPagamento && (
        <div className="vx-overlay" style={{ zIndex: 1100 }}>
          <div className="vx-sheet" style={{ maxWidth: 420, textAlign: "center", padding: "40px 32px" }}>
            <CheckCircle size={56} color="var(--brand)" style={{ marginBottom: 16 }} />
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>
              {statusPagamento === "confirmado" ? "Pagamento confirmado" : "Assinatura registrada"}
            </h2>
            <p className="vx-mut" style={{ margin: "0 0 24px" }}>
              {statusPagamento === "confirmado" ? "Seu plano está ativo." : "A primeira cobrança será processada no vencimento."}
            </p>
            <button className="vx-btn vx-btn-primary" onClick={() => { setStatusPagamento(null); setSelecionado(null); }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
