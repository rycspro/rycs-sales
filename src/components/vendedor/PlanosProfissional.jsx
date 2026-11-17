import { useEffect, useState } from "react";
import { Check, Minus, Crown, QrCode } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { PLANOS_PROFISSIONAL, ORDEM_PLANOS_PROFISSIONAL, BENEFICIOS_VITRINE } from "../../../shared/planosProfissional.js";

// Vitrine dos planos do profissional (Grátis/Pro/Premium). Preços e
// benefícios vêm de shared/planosProfissional.js. Enquanto a cobrança estiver
// desligada no servidor, os planos pagos aparecem como "em breve".
// O texto nunca promete mais vendas: o plano grátis continua completo.

const dataBr = (t) => (t ? new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

function Celula({ valor }) {
  if (valor === true) return <Check size={16} aria-label="Incluído" style={{ color: "var(--brand)" }} />;
  if (!valor) return <Minus size={16} aria-label="Não incluído" style={{ color: "var(--muted-2)" }} />;
  return <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{valor}</span>;
}

export default function PlanosProfissional({ aviso }) {
  const [info, setInfo] = useState(null);
  const [enviando, setEnviando] = useState("");
  const [pix, setPix] = useState(null);

  const carregar = async () => setInfo(await api("/profissional/plano"));
  useEffect(() => { carregar(); }, []);

  const assinar = async (plano) => {
    setEnviando(plano);
    const r = await api("/profissional/assinatura", { plano });
    setEnviando("");
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível gerar a cobrança.");
    setPix(r.pix || null);
    if (!r.pix) aviso?.("Cobrança gerada. O Pix aparece na sua área de pagamentos do Asaas.");
    carregar();
  };

  const cancelar = async () => {
    if (!window.confirm("Cancelar a renovação? Você mantém os benefícios até o fim do período já pago.")) return;
    const r = await apiDelete("/profissional/assinatura");
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível cancelar.");
    aviso?.("Renovação cancelada.");
    carregar();
  };

  if (!info) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  if (info.error) return <div className="vx-card" style={{ padding: 20 }}>{info.error}</div>;

  const atual = info.plano || "gratis";
  const assinatura = info.assinatura;
  const podeCancelar = assinatura && assinatura.origem === "asaas" && ["ativa", "atrasada", "pendente"].includes(assinatura.status);

  return (
    <div className="vx-fade">
      <div style={{ marginBottom: 18 }}>
        <div className="vx-eyebrow">Planos</div>
        <h1 className="vx-disp" style={{ fontSize: 24, margin: "6px 0 6px" }}>Escolha como quer trabalhar</h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, maxWidth: 640 }}>
          O plano Grátis já permite se candidatar sem limite, trabalhar e sacar. Pro e Premium somam ferramentas, treino e prioridade de visibilidade. Nenhum plano garante propostas, vendas ou ganhos, e o Score continua decidindo a ordem.
        </p>
      </div>

      {atual !== "gratis" && (
        <div className="vx-card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Crown size={18} style={{ color: "var(--brand)" }} aria-hidden />
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong>Seu plano: {PLANOS_PROFISSIONAL[atual]?.nome}</strong>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {info.estado === "cancelada" ? `Renovação cancelada. Benefícios até ${dataBr(info.ate)}.` : `Vale até ${dataBr(info.ate)}.`}
              {info.estado === "atrasada" && " Pagamento da renovação em aberto."}
            </div>
          </div>
          {podeCancelar && <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={cancelar}>Cancelar renovação</button>}
        </div>
      )}

      {pix && (
        <div className="vx-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}><QrCode size={16} aria-hidden /> <strong>Pague com Pix para ativar</strong></div>
          {pix.qrCode && <img src={`data:image/png;base64,${pix.qrCode}`} alt="QR Code Pix da assinatura" width={180} height={180} />}
          {pix.copiaECola && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="pix-copia" style={{ fontSize: 12.5, color: "var(--muted)" }}>Pix copia e cola</label>
              <textarea id="pix-copia" className="vx-input" readOnly rows={3} value={pix.copiaECola} style={{ width: "100%" }} />
            </div>
          )}
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "8px 0 0" }}>O plano liga assim que o pagamento for confirmado.</p>
        </div>
      )}

      <div className="vx-grid vx-g3" style={{ marginBottom: 20 }}>
        {ORDEM_PLANOS_PROFISSIONAL.map((chave) => {
          const p = PLANOS_PROFISSIONAL[chave];
          const ehAtual = atual === chave;
          const pago = chave !== "gratis";
          return (
            <div key={chave} className="vx-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, borderColor: ehAtual ? "var(--brand)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 16 }}>{p.nome}</strong>
                {ehAtual && <span className="vx-badge vx-badge-brand">Seu plano</span>}
                {!ehAtual && pago && !info.cobrancaAtiva && <span className="vx-badge vx-badge-muted">Em breve</span>}
              </div>
              <div>
                <span style={{ fontSize: 24, fontWeight: 700 }}>{pago ? money(p.precoAnual) : "R$ 0"}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{pago ? " por ano" : " para sempre"}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", flex: 1 }}>{p.resumo}</p>
              {pago && !ehAtual && (
                <button type="button" className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }}
                  disabled={!info.cobrancaAtiva || atual !== "gratis" || !!enviando} onClick={() => assinar(chave)}>
                  {!info.cobrancaAtiva ? "Disponível em breve" : enviando === chave ? "Gerando Pix…" : `Assinar ${p.nome}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="vx-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <caption className="vx-eyebrow" style={{ textAlign: "left", padding: "14px 16px 6px" }}>O que cada plano inclui</caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: "8px 16px" }}>Benefício</th>
              {ORDEM_PLANOS_PROFISSIONAL.map((c) => <th key={c} scope="col" style={{ padding: "8px 12px", textAlign: "center" }}>{PLANOS_PROFISSIONAL[c].nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {BENEFICIOS_VITRINE.map((b) => (
              <tr key={b.texto} style={{ borderTop: "1px solid var(--border)" }}>
                <th scope="row" style={{ textAlign: "left", fontWeight: 400, padding: "10px 16px", color: "var(--ink)" }}>{b.texto}</th>
                {ORDEM_PLANOS_PROFISSIONAL.map((c) => <td key={c} style={{ textAlign: "center", padding: "10px 12px" }}><Celula valor={b[c]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
        Pagamento anual por Pix. Você pode cancelar a renovação quando quiser e mantém os benefícios até o fim do período pago. Recursos com cota mensal (discadora e lembretes) mostram o limite aqui quando estiverem disponíveis.
      </p>
    </div>
  );
}
