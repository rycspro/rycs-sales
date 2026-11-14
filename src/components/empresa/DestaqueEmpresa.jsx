import { useEffect, useState } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { DESTAQUES, ORDEM_DESTAQUES } from "../../../shared/planos.js";
import { Check, Star, X, Clock } from "lucide-react";

// Preço em reais com centavos (ex.: "R$ 39,90").
const precoBRL = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Modal de pagamento Pix do destaque: mostra o QR, conta o tempo de expiração,
// acompanha o status e, ao confirmar, ativa o destaque (feito pelo webhook).
function ModalPixDestaque({ cobranca, onFechar, onConfirmado }) {
  const [etapa, setEtapa] = useState("pix"); // pix | processando | confirmado
  const expiraEm = cobranca.pixExpiracao ? new Date(cobranca.pixExpiracao).getTime() : Date.now() + 30 * 60000;
  const [restante, setRestante] = useState(() => Math.max(0, expiraEm - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setRestante(Math.max(0, expiraEm - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiraEm]);

  useEffect(() => {
    if (etapa !== "pix" || !cobranca.depositoId) return;
    let vivo = true;
    const t = setInterval(async () => {
      const r = await api(`/deposits/${cobranca.depositoId}`).catch(() => null);
      if (!vivo || !r) return;
      if (r.status === "confirmado") {
        setEtapa("processando");
        setTimeout(() => { if (vivo) { setEtapa("confirmado"); onConfirmado?.(); } }, 1600);
      }
    }, 4000);
    return () => { vivo = false; clearInterval(t); };
  }, [etapa, cobranca.depositoId]);

  const expirado = restante <= 0;
  const totalSeg = Math.floor(restante / 1000);
  const mm = String(Math.floor(totalSeg / 60)).padStart(2, "0");
  const ss = String(totalSeg % 60).padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(248,250,252,.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,.14)", width: "100%", maxWidth: 420, padding: "26px 26px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Ativar {DESTAQUES[cobranca.tipo]?.nome || "destaque"}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>O destaque é ativado após a confirmação do Pix.</div>
          </div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onFechar}><X size={16} /></button>
        </div>

        {etapa === "pix" && (
          <div style={{ textAlign: "center" }}>
            {cobranca.pixQrCodeBase64 && (
              <img src={`data:image/png;base64,${cobranca.pixQrCodeBase64}`} alt="QR Code Pix"
                style={{ width: 180, height: 180, margin: "10px auto 14px", display: "block", borderRadius: 10 }} />
            )}
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Pague {precoBRL(cobranca.valor)} via Pix</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7, margin: "0 auto 14px", padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              background: expirado ? "#FEE2E2" : "var(--brand-50, #EFF6FF)", color: expirado ? "#DC2626" : "var(--brand)",
            }}>
              <Clock size={14} />
              {expirado ? "Pix expirado — gere um novo" : <>Expira em <span className="vx-mono">{mm}:{ss}</span></>}
            </div>
            {cobranca.pixCopiaECola && (
              <button className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
                onClick={() => { navigator.clipboard?.writeText(cobranca.pixCopiaECola); }}>
                Copiar código Pix
              </button>
            )}
            <button className="vx-btn" style={{ width: "100%", justifyContent: "center" }} onClick={onFechar}>Fechar</button>
          </div>
        )}

        {etapa === "processando" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div className="vx-spinner" style={{ margin: "0 auto 18px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Processando seu pagamento…</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Confirmamos o Pix. Ativando seu destaque.</div>
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
      </div>
    </div>
  );
}

// Destaque da empresa na vitrine: quatro versões contratadas à parte, com
// pagamento via Pix. O destaque só liga quando o pagamento é confirmado.
export default function DestaqueEmpresa({ emp, up, aviso, recarregar }) {
  const ativo = emp.destaqueTipo || (emp.destaque ? "topo" : "");
  const [carregando, setCarregando] = useState("");
  const [cobranca, setCobranca] = useState(null);

  const iniciar = async (key) => {
    setCarregando(key);
    const r = await api("/destaque/checkout", { tipo: key });
    setCarregando("");
    if (!r || r.error) return aviso(r?.error || "Não foi possível gerar a cobrança.");
    setCobranca(r);
  };

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
          Aumente a visibilidade da sua empresa na vitrine. Disponível para qualquer empresa, independente do plano contratado — ative com um Pix e cancele quando quiser.
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
                <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{precoBRL(d.preco)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>/mês</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", marginBottom: 4 }}>
                ative com Pix · cancele quando quiser
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
                onClick={() => on ? cancelar() : iniciar(key)}
                disabled={!!carregando}
                style={{ marginTop: "auto", fontWeight: 700 }}
              >
                {on ? "Cancelar destaque" : carregando === key ? "Gerando Pix…" : "Ativar destaque"}
              </button>
            </article>
          );
        })}
      </div>

      {cobranca && (
        <ModalPixDestaque
          cobranca={cobranca}
          onFechar={() => setCobranca(null)}
          onConfirmado={() => { recarregar?.(); }}
        />
      )}
    </div>
  );
}
