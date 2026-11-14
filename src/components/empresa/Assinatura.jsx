import { useEffect, useRef, useState } from "react";
import { Check, ArrowLeft, Loader, QrCode, Gift, Sparkles, CheckCircle } from "lucide-react";
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

// Planos pagos, na ordem do catálogo. O "free" saiu da oferta.
const PLANOS_OFERTADOS = ORDEM_PLANOS.filter((k) => PLANOS[k]?.preco > 0);

export default function Assinatura({ emp, acesso, aviso, aoAtivar }) {
  const [passo, setPasso] = useState(0);
  const [plano, setPlano] = useState(null);
  const [forma, setForma] = useState("PIX");
  const [trialDias, setTrialDias] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [pix, setPix] = useState(null);
  const [pixConfirmado, setPixConfirmado] = useState(false);
  const pixPollRef = useRef(null);

  useEffect(() => {
    if (!pix?.subscriptionId) { clearInterval(pixPollRef.current); return; }
    pixPollRef.current = setInterval(async () => {
      const r = await api("/subscription");
      if (r?.assinatura?.status === "ativa") {
        clearInterval(pixPollRef.current);
        setPix(null);
        setPixConfirmado(true);
      }
    }, 5000);
    return () => clearInterval(pixPollRef.current);
  }, [pix?.subscriptionId]);

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
  const cobrancaEm = primeiraCobranca({ trialDias: 0 });
  const temTrial = false;

  const ativar = async () => {
    setEnviando(true);
    const r = await api("/subscription", {
      plano,
      formaPagamento: "PIX",
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

  // -------------------------------------------------------- Pagamento confirmado
  if (pixConfirmado) return (
    <div className="vx-fade" style={{ maxWidth: 520 }}>
      <div className="vx-card" style={{ padding: 32, textAlign: "center" }}>
        <CheckCircle size={56} color="var(--brand)" style={{ marginBottom: 16 }} />
        <div className="vx-disp" style={{ fontSize: 20, margin: "0 0 8px" }}>Pagamento confirmado</div>
        <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 24px" }}>
          Seu plano está ativo. Boas vendas!
        </p>
        <button className="vx-btn vx-btn-primary" onClick={() => { setPixConfirmado(false); aoAtivar?.(); }}>
          Continuar
        </button>
      </div>
    </div>
  );

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
          const recomendado = Number(p.preco) === 999.9;
          return (
            <div key={k} className={`vx-card vx-plan-card${recomendado ? " vx-plan-recommended" : ""}`}
              style={{ padding: 18, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
              {recomendado && <span className="vx-plan-ribbon"><Sparkles size={12} />RECOMENDADO</span>}
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
              <button
                className="vx-btn vx-btn-primary vx-btn-block"
                style={{ marginTop: "auto" }}
                disabled={resgatando}
                onClick={() => { if (convite) return resgatarConvite(k); setPlano(k); setPasso(1); }}
              >
                {convite
                  ? (resgatando ? "Ativando…" : `Ativar ${convite.dias} dias grátis`)
                  : "Contratar"}
              </button>
            </div>
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

      {/* Banner de trial */}
      {temTrial && (
        <div style={{
          background: "var(--success, #16a34a)", color: "#fff",
          borderRadius: 10, padding: "12px 16px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600,
        }}>
          <span style={{ fontSize: 20 }}>🎁</span>
          <span>{trialDias} dias grátis · sem cobrança agora</span>
        </div>
      )}

      {/* O combinado, à vista, antes de qualquer campo */}
      <div className="vx-card" style={{ padding: 18, borderColor: temTrial ? "var(--success, #16a34a)" : "var(--brand-100)", background: temTrial ? "#f0fdf4" : "var(--brand-50)" }}>
        <div className="vx-row"><b style={{ fontSize: 15 }}>Plano {detalhes.nome}</b>
          <b className="vx-mono" style={{ fontSize: 17, color: "var(--brand)" }}>{money(detalhes.preco)}/mês</b></div>
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
          {temTrial ? (
            <>
              <b style={{ color: "var(--success, #16a34a)" }}>Cobrado hoje: R$ 0,00</b><br />
              Primeira cobrança em <b>{formatarData(cobrancaEm)}</b> · {money(detalhes.preco)}/mês
            </>
          ) : (
            <>Primeira cobrança em <b>{formatarData(cobrancaEm)}</b>, e depois todo mês na mesma data.</>
          )}
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Forma de pagamento</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <QrCode size={18} color="var(--brand)" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Pix</span>
        </div>
        <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.7 }}>
          Geramos um QR Code na próxima tela. O acesso é liberado assim que o pagamento for confirmado.
          <div style={{ marginTop: 8 }}>A cobrança é à vista, mês a mês.</div>
        </div>
      </div>

      <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }} disabled={enviando} onClick={ativar}>
        {enviando ? <><Loader size={15} /> Ativando…</> : <><QrCode size={15} /> ATIVAR MINHA CONTA</>}
      </button>
    </div>
  );
}
