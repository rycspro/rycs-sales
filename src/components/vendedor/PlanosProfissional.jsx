import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Loader, QrCode, ShieldCheck, Sparkles, X } from "lucide-react";
import NumberFlow from "@number-flow/react";
import confetti from "canvas-confetti";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { mascararDocumento } from "../../../shared/documentoConta.js";
import { PLANOS_PROFISSIONAL, PLANOS_PAGOS_PROFISSIONAL, BENEFICIOS_VITRINE, CICLOS, mensalidadeProfissional, valorProfissionalNoCiclo } from "../../../shared/planosProfissional.js";
import { descontoDoCiclo } from "../../../shared/planos.js";

// Planos do profissional (Grátis/Pro/Premium), no mesmo template da vitrine de
// planos da empresa (PlanosEmpresa + PricingPlanos): faixa larga do plano
// gratuito, seletor mensal/semestral/anual com os mesmos descontos, cards com
// preço animado, checkout em janela e QR Code do Pix. Preços e benefícios vêm
// de shared/planosProfissional.js. Pagamento só por Pix. O texto nunca promete mais vendas: o Grátis continua completo.

const SO_DIGITOS = (v) => String(v).replace(/\D/g, "");
const pct = (d) => Math.round(d * 100);
const OPCOES_CICLO = [
  { id: CICLOS.MENSAL, label: "Mensal" },
  { id: CICLOS.SEMESTRAL, label: "Semestral" },
  { id: CICLOS.ANUAL, label: "Anual" },
];
const CICLO_NOME = { MENSAL: "Mensal", SEMESTRAL: "Semestral", ANUAL: "Anual" };
const CICLO_SUFIXO = { MENSAL: "/mês", SEMESTRAL: "/semestre", ANUAL: "/ano" };
const dataBr = (t) => (t ? new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

// Tópicos de cada card: o que o plano soma ao anterior, com o detalhe do plano
// quando ele existe ("Ilimitado", "Completo"...).
const comDetalhe = (b, chave) => (typeof b[chave] === "string" ? `${b.texto}: ${b[chave]}` : b.texto);
const INCLUI = {
  gratis: BENEFICIOS_VITRINE.filter((b) => b.gratis).map((b) => comDetalhe(b, "gratis")),
  pro: BENEFICIOS_VITRINE.filter((b) => b.pro && !b.gratis).map((b) => comDetalhe(b, "pro")),
  premium: ["Tudo do Pro", ...BENEFICIOS_VITRINE.filter((b) => b.premium && b.premium !== b.pro).map((b) => comDetalhe(b, "premium"))],
};

export default function PlanosProfissional({ aviso }) {
  const [info, setInfo] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [cpf, setCpf] = useState("");
  const [processando, setProcessando] = useState(false);
  const [pix, setPix] = useState(null);
  const [ciclo, setCiclo] = useState(CICLOS.MENSAL);
  const segRef = useRef(null);

  const alternar = (novo) => {
    setCiclo(novo);
    if (descontoDoCiclo(novo) > 0 && segRef.current) {
      const r = segRef.current.getBoundingClientRect();
      confetti({
        particleCount: 50, spread: 60, startVelocity: 30, gravity: 1.2, decay: 0.94, ticks: 200, shapes: ["circle"],
        origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
        colors: ["#2563EB", "#4338CA", "#0EA5E9", "#60A5FA"],
      });
    }
  };

  const carregar = async () => setInfo(await api("/profissional/plano"));
  useEffect(() => { carregar(); }, []);

  // Enquanto o QR estiver aberto, confere se o pagamento caiu.
  useEffect(() => {
    if (!pix) return undefined;
    const id = setInterval(async () => {
      const r = await api("/profissional/plano");
      if (r && !r.error) {
        setInfo(r);
        if (r.plano && r.plano !== "gratis") { setPix(null); setSelecionado(null); aviso?.(`Plano ${PLANOS_PROFISSIONAL[r.plano]?.nome} ativado!`); }
      }
    }, 6000);
    return () => clearInterval(id);
  }, [pix]);

  if (!info) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  if (info.error) return <div className="vx-card" style={{ padding: 20 }}>{info.error}</div>;

  const atual = info.plano || "gratis";
  const noGratis = atual === "gratis";
  const assinatura = info.assinatura;
  const podeCancelar = assinatura && assinatura.origem === "asaas" && ["ativa", "atrasada", "pendente"].includes(assinatura.status);
  const precisaCpf = !info.temDocumento;

  const abrir = (chave) => {
    if (!info.cobrancaAtiva) return aviso?.("A assinatura dos planos ainda não está disponível.");
    if (!noGratis) return aviso?.("A troca de plano no meio do período ainda não está disponível.");
    setCpf("");
    setSelecionado({ ...PLANOS_PROFISSIONAL[chave], ciclo, valor: valorProfissionalNoCiclo(chave, ciclo) });
  };

  const pagar = async () => {
    if (precisaCpf && SO_DIGITOS(cpf).length !== 11) return aviso?.("Informe o seu CPF com 11 números.");
    setProcessando(true);
    const r = await api("/profissional/assinatura", { plano: selecionado.chave, ciclo: selecionado.ciclo, ...(precisaCpf ? { cpf: SO_DIGITOS(cpf) } : {}) });
    setProcessando(false);
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível gerar a cobrança.");
    await carregar();
    if (r.pix?.qrCode || r.pix?.copiaECola) setPix(r.pix);
    else { setSelecionado(null); aviso?.("Cobrança gerada. Se o Pix não aparecer, tente de novo em instantes."); }
  };

  const cancelar = async () => {
    if (!window.confirm("Cancelar a renovação? Você mantém os benefícios até o fim do período já pago.")) return;
    const r = await apiDelete("/profissional/assinatura");
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível cancelar.");
    aviso?.("Renovação cancelada.");
    carregar();
  };

  return (
    <div className="vx-fade" id="vx-planos-grid">
      <div style={{ padding: "4px 0 16px" }}>
        <div className="vx-eyebrow">Assinatura profissional</div>
        <h1 className="vx-disp" style={{ margin: "2px 0 3px" }}>Planos RYCS</h1>
        <p style={{ margin: 0 }}>O plano Grátis já permite se candidatar sem limite, trabalhar e sacar. Pro e Premium somam ferramentas, treino e prioridade de visibilidade. Nenhum plano garante propostas, vendas ou ganhos, e o Score continua decidindo a ordem.</p>
      </div>

      {!noGratis && (
        <div className="vx-mut" style={{ fontSize: 13, marginBottom: 14 }}>
          {info.estado === "cancelada"
            ? `Renovação cancelada. Seus benefícios do ${PLANOS_PROFISSIONAL[atual]?.nome} valem até ${dataBr(info.ate)}.`
            : `Seu plano ${PLANOS_PROFISSIONAL[atual]?.nome} vale até ${dataBr(info.ate)}.`}
          {info.estado === "atrasada" && " O pagamento da renovação está em aberto."}
        </div>
      )}

      <div style={{ padding: "4px 0 8px" }}>
        {/* Plano gratuito — faixa larga, em 3 camadas: nome + preço, tópicos, ação. */}
        <div
          className="vx-free-banner"
          style={{
            display: "grid", gridTemplateColumns: "minmax(140px, 190px) 1fr auto",
            alignItems: "center", gap: 24, padding: "20px 24px", marginBottom: 20,
            borderRadius: "var(--radius-lg, 16px)",
            ...(noGratis
              ? { border: "none", background: "linear-gradient(120deg, #2563EB 0%, #4338CA 52%, #0EA5E9 100%)", boxShadow: "0 10px 26px rgba(37,99,235,.28)", color: "#fff" }
              : { border: "1px solid var(--border)", background: "var(--bg-card, #fff)", boxShadow: "var(--shadow-card)", color: "var(--ink)" }),
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, borderRight: noGratis ? "1px solid rgba(255,255,255,.25)" : "1px solid var(--border)", paddingRight: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: noGratis ? "rgba(255,255,255,.85)" : "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase" }}>
              {PLANOS_PROFISSIONAL.gratis.nome}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.03em", color: noGratis ? "#fff" : "var(--ink)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>R$ 0</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: noGratis ? "rgba(255,255,255,.85)" : "var(--muted)" }}>/mês</span>
            </div>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "8px 20px" }}>
            {INCLUI.gratis.map((i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 500, color: noGratis ? "#fff" : "var(--ink)" }}>
                <Check size={15} color={noGratis ? "#fff" : "var(--brand)"} strokeWidth={2.6} style={{ flexShrink: 0 }} /> {i}
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled
            style={{
              fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, minWidth: 150, minHeight: 44,
              padding: "10px 18px", borderRadius: 10, fontFamily: "inherit", fontSize: 13.5, cursor: "default",
              border: noGratis ? "1px solid rgba(255,255,255,.45)" : "1px solid var(--border)",
              background: noGratis ? "rgba(255,255,255,.18)" : "transparent",
              color: noGratis ? "#fff" : "var(--muted)",
            }}
          >
            {noGratis ? "Plano atual" : "Incluso em todos"}
          </button>
        </div>

        {/* Alternância mensal / semestral / anual (mesmos descontos da empresa) */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <div ref={segRef} role="radiogroup" aria-label="Ciclo de cobrança"
            style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "var(--surface-2, #F1F5F9)", border: "1px solid var(--border)", flexWrap: "nowrap", justifyContent: "center", width: "100%", maxWidth: 360 }}>
            {OPCOES_CICLO.map((o) => {
              const ativo = ciclo === o.id;
              const desc = descontoDoCiclo(o.id);
              return (
                <button key={o.id} type="button" role="radio" aria-checked={ativo} onClick={() => alternar(o.id)}
                  style={{
                    flex: "1 1 0", minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                    padding: "8px 6px", borderRadius: 999, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
                    color: ativo ? "#fff" : "var(--muted)", background: ativo ? "var(--brand)" : "transparent",
                    boxShadow: ativo ? "var(--shadow-brand, 0 1px 3px rgba(37,99,235,.35))" : "none", transition: "background .2s, color .2s",
                  }}>
                  {o.label}
                  {desc > 0 && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, flexShrink: 0, padding: "2px 5px", borderRadius: 999, background: ativo ? "rgba(255,255,255,.22)" : "var(--brand-50)", color: ativo ? "#fff" : "var(--brand)" }}>-{pct(desc)}%</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards dos planos pagos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16, alignItems: "start" }}>
          {PLANOS_PAGOS_PROFISSIONAL.map((chave, index) => {
            const p = PLANOS_PROFISSIONAL[chave];
            const destaque = chave === "premium";
            const ehAtual = chave === atual;
            return (
              <motion.article
                key={chave}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 260, damping: 28, delay: 0.02 + index * 0.025 }}
                className={`vx-card${ehAtual ? " vx-card--active" : ""}`}
                style={{ position: "relative", padding: "26px 22px", display: "flex", flexDirection: "column", border: destaque ? "2px solid var(--brand)" : undefined, overflow: "hidden" }}
              >
                {ehAtual && (
                  <div style={{ position: "absolute", top: 0, left: 0, display: "flex", alignItems: "center", gap: 4, background: "var(--brand)", color: "#fff", padding: "4px 10px", borderBottomRightRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    <Check size={12} strokeWidth={3} /> Seu plano
                  </div>
                )}
                {destaque && (
                  <div style={{ position: "absolute", top: 0, right: 0, display: "flex", alignItems: "center", gap: 4, background: "var(--brand)", color: "#fff", padding: "4px 10px", borderBottomLeftRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    <Sparkles size={12} /> Completo
                  </div>
                )}

                <div style={{ fontSize: 13, fontWeight: 700, color: ehAtual ? "rgba(255,255,255,.85)" : "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginTop: 6 }}>
                  {p.nome}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, margin: "16px 0 2px" }}>
                  <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.03em", color: ehAtual ? "#fff" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                    <NumberFlow value={mensalidadeProfissional(chave, ciclo)} format={{ style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }} locales="pt-BR" transformTiming={{ duration: 500, easing: "ease-out" }} willChange />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: ehAtual ? "rgba(255,255,255,.85)" : "var(--muted)" }}>/mês</span>
                </div>
                <div style={{ fontSize: 11.5, color: ehAtual ? "rgba(255,255,255,.7)" : "var(--muted)", textAlign: "center", marginBottom: 4 }}>
                  {ciclo === CICLOS.ANUAL ? `${money(valorProfissionalNoCiclo(chave, ciclo))} cobrado anualmente · economize ${pct(descontoDoCiclo(ciclo))}%`
                    : ciclo === CICLOS.SEMESTRAL ? `${money(valorProfissionalNoCiclo(chave, ciclo))} a cada 6 meses · economize ${pct(descontoDoCiclo(ciclo))}%`
                    : "cobrado mensalmente"}
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 9 }}>
                  {INCLUI[chave].map((i) => (
                    <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: ehAtual ? "#fff" : "var(--text-2, var(--ink))", textAlign: "left" }}>
                      <Check size={15} color={ehAtual ? "#fff" : "var(--brand)"} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} /> {i}
                    </li>
                  ))}
                </ul>

                <div style={{ borderTop: ehAtual ? "1px solid rgba(255,255,255,.25)" : "1px solid var(--border)", margin: "18px 0 14px" }} />

                <button
                  type="button"
                  className={`vx-btn vx-btn-block ${ehAtual ? "" : "vx-btn-primary"}`}
                  disabled={ehAtual || !info.cobrancaAtiva}
                  onClick={() => abrir(chave)}
                  style={{ marginTop: "auto", fontWeight: 700, minHeight: 44, ...(ehAtual ? { background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.3)" } : {}) }}
                >
                  {ehAtual ? "Plano atual" : !info.cobrancaAtiva ? "Disponível em breve" : noGratis ? (p.cta || "Assinar") : "Trocar para este plano"}
                </button>
              </motion.article>
            );
          })}
        </div>
      </div>

      {podeCancelar && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 40, paddingTop: 24, paddingBottom: 24, textAlign: "center" }}>
          <p className="vx-mut" style={{ margin: "0 0 12px", fontSize: 13 }}>Deseja encerrar sua assinatura? Você mantém os benefícios até o fim do período já pago.</p>
          <button className="vx-btn vx-btn-danger" onClick={cancelar}>Cancelar assinatura</button>
        </div>
      )}

      {/* Checkout */}
      {selecionado && !pix && (
        <div className="vx-overlay" onClick={() => setSelecionado(null)}>
          <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="vx-row">
              <div>
                <div className="vx-eyebrow">Checkout seguro</div>
                <h2 className="vx-disp" style={{ margin: "3px 0" }}>{selecionado.nome}</h2>
              </div>
              <button className="vx-btn vx-btn-ghost" aria-label="Fechar" onClick={() => setSelecionado(null)}><X size={16} /></button>
            </div>

            <div className="vx-checkout-total">
              <span>Plano {selecionado.nome} · {CICLO_NOME[selecionado.ciclo]}</span><b>{money(selecionado.valor)}</b>
              <span>Cobrança</span><b>{money(selecionado.valor)}{CICLO_SUFIXO[selecionado.ciclo]}</b>
            </div>

            {precisaCpf && (
              <label style={{ display: "block", marginBottom: 16 }}>
                <span className="vx-label">Seu CPF</span>
                <input className="vx-input vx-mono" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                  value={mascararDocumento(cpf)} onChange={(e) => setCpf(SO_DIGITOS(e.target.value).slice(0, 11))} />
                <span className="vx-mut" style={{ display: "block", fontSize: 12, marginTop: 6 }}>Pedimos uma vez só: o meio de pagamento exige o CPF de quem assina.</span>
              </label>
            )}

            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Forma de pagamento</div>
            <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>
              <QrCode size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Pix. O QR Code aparece na próxima tela e o plano é liberado assim que o pagamento for confirmado.
            </div>
            <div className="vx-mut" style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
              <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              Renova automaticamente a cada {selecionado.ciclo === CICLOS.MENSAL ? "mês" : selecionado.ciclo === CICLOS.SEMESTRAL ? "6 meses" : "ano"}. Você pode cancelar a renovação quando quiser e mantém os benefícios até o fim do período pago.
            </div>

            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16, minHeight: 44 }}
              disabled={processando || (precisaCpf && SO_DIGITOS(cpf).length !== 11)} onClick={pagar}>
              {processando ? <><Loader size={15} /> Processando…</> : <><QrCode size={15} /> Pagar com Pix {money(selecionado.valor)}</>}
            </button>
            <p className="vx-chart-source">Nenhuma cobrança é feita sem esta confirmação. Ativação apenas após confirmação do gateway.</p>
          </div>
        </div>
      )}

      {pix && (
        <div className="vx-overlay" style={{ zIndex: 1100 }}>
          <div className="vx-sheet" style={{ maxWidth: 420, textAlign: "center", padding: "32px 28px" }}>
            <QrCode size={30} color="var(--brand)" />
            <h2 style={{ margin: "12px 0 4px", fontSize: 20 }}>Pague com Pix para ativar</h2>
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px" }}>
              Seu plano é liberado automaticamente assim que o pagamento for confirmado.
            </p>
            {pix.qrCode && (
              <img src={`data:image/png;base64,${pix.qrCode}`} alt="QR Code Pix da assinatura"
                style={{ width: 200, height: 200, margin: "0 auto 16px", display: "block", borderRadius: 10 }} />
            )}
            {pix.copiaECola && (
              <button className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }} onClick={() => { navigator.clipboard?.writeText(pix.copiaECola); aviso?.("Código Pix copiado!"); }}>
                Copiar código Pix
              </button>
            )}
            <button className="vx-btn vx-btn-block" style={{ marginTop: 8, minHeight: 44 }} onClick={() => { setPix(null); setSelecionado(null); carregar(); }}>
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
