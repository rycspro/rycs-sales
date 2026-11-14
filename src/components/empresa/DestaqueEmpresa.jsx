import { useEffect, useRef, useState } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { DESTAQUES, ORDEM_DESTAQUES } from "../../../shared/planos.js";
import { Check, Copy, Globe, Loader, QrCode, ShieldCheck, Star, X } from "lucide-react";

// Modal de checkout do destaque — pagamento nacional por Pix (QR único que
// ativa o destaque) ou internacional (Stripe, em US$).
function ModalCheckoutDestaque({ tipo, onFechar, onConfirmado, aviso }) {
  const d = DESTAQUES[tipo];
  const [forma, setForma] = useState("");
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState("escolha"); // escolha | pix | confirmado
  const [pixQr, setPixQr] = useState(null); // { pixCopiaECola, pixQrCodeBase64, depositoId }
  const [stripe, setStripe] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => { api("/stripe/status").then((r) => r && !r.error && setStripe(r)); }, []);

  // Enquanto o QR está aberto, pergunta ao servidor se o pagamento já foi
  // confirmado (o webhook marca o pedido como 'confirmado' e ativa o destaque).
  useEffect(() => {
    if (etapa !== "pix" || !pixQr?.depositoId) { clearInterval(pollRef.current); return undefined; }
    pollRef.current = setInterval(async () => {
      const r = await api("/deposits");
      const pedido = Array.isArray(r) ? r.find((x) => x.id === pixQr.depositoId) : null;
      if (pedido?.status === "confirmado") {
        clearInterval(pollRef.current);
        setEtapa("confirmado");
        onConfirmado?.();
      }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [etapa, pixQr?.depositoId]);

  const origem = forma ? (forma === "STRIPE" ? "internacional" : "nacional") : null;

  const copiarPix = async () => {
    try { await navigator.clipboard.writeText(pixQr.pixCopiaECola); aviso("Código Pix copiado!"); }
    catch { /* o campo continua selecionável */ }
  };

  const contratar = async () => {
    if (forma === "STRIPE") {
      setProcessando(true);
      const r = await api("/destaque/stripe", { tipo, retorno: window.location.pathname });
      setProcessando(false);
      if (!r || r.error || !r.url) return aviso(r?.error || "Não foi possível abrir o pagamento internacional.");
      window.location.href = r.url;
      return;
    }

    setProcessando(true);
    const r = await api("/destaque/checkout", { tipo, formaPagamento: "PIX" });
    setProcessando(false);

    if (r?.error) return aviso(r.error);

    if (r.jaPago) {
      setEtapa("confirmado");
      onConfirmado?.();
      return;
    }

    if (r.pixCopiaECola || r.pixQrCodeBase64) {
      setPixQr({ pixCopiaECola: r.pixCopiaECola, pixQrCodeBase64: r.pixQrCodeBase64, depositoId: r.depositoId });
      setEtapa("pix");
      return;
    }

    aviso("Não foi possível gerar o Pix. Tente de novo.");
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

        {etapa === "pix" && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <QrCode size={28} color="var(--brand)" />
            <div style={{ fontSize: 17, fontWeight: 800, margin: "8px 0 4px" }}>Pague o Pix para ativar</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              O destaque é ativado automaticamente assim que o pagamento for confirmado. Esta tela avança sozinha.
            </div>
            {pixQr?.pixQrCodeBase64 && (
              <img src={`data:image/png;base64,${pixQr.pixQrCodeBase64}`} alt="QR Code Pix"
                style={{ width: 200, height: 200, margin: "0 auto 16px", display: "block", borderRadius: 10 }} />
            )}
            {pixQr?.pixCopiaECola && (
              <button className="vx-btn vx-btn-primary vx-btn-block" onClick={copiarPix}>
                <Copy size={15} /> Copiar código Pix
              </button>
            )}
            <div className="vx-mut" style={{ fontSize: 12, marginTop: 12, display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
              <Loader size={13} /> Aguardando a confirmação do pagamento…
            </div>
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
                { id: "nacional", forma: "PIX", titulo: "Pagamento nacional", sub: "Pix · R$", icone: <QrCode size={26} strokeWidth={1.8} aria-hidden="true" /> },
                ...(stripe?.ativo ? [{ id: "internacional", forma: "STRIPE", titulo: "Pagamento internacional", sub: "Cartão · US$", icone: <Globe size={26} strokeWidth={1.8} aria-hidden="true" /> }] : []),
              ].map(({ id, forma: f, titulo, sub, icone }) => {
                const on = origem === id;
                return (
                  <button key={id} type="button"
                    onClick={() => setForma(f)}
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

            {forma === "PIX" && (
              <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                <QrCode size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Geramos um QR Code Pix após a confirmação. O destaque é ativado assim que o pagamento for confirmado.
              </div>
            )}

            {forma === "STRIPE" && (
              <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
                <ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Para empresas fora do Brasil: pagamento em dólar no formulário seguro do Stripe, com cartão
                internacional. O destaque é ativado quando o Stripe confirmar.
              </div>
            )}

            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}
              disabled={processando || !forma} onClick={contratar}>
              {processando
                ? <><Loader size={15} /> Processando…</>
                : forma === "STRIPE"
                  ? <><Globe size={15} /> Continuar para o pagamento</>
                  : <><QrCode size={15} /> Pagar {money(d.preco)} com Pix</>}
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
Pix · cancele quando quiser
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
