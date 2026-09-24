import { useState } from "react";
import { api } from "../../lib/api.js";

export default function BetaEnvironmentAdmin({ aviso, recarregar }) {
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ajustando, setAjustando] = useState("");
  const resetar = async () => {
    if (confirmacao !== "RESETAR BETA") return aviso('Digite exatamente "RESETAR BETA" para continuar.');
    if (!window.confirm("Restaurar todos os dados de teste do ambiente Beta? Esta ação não afeta a produção.")) return;
    setEnviando(true);
    const r = await api("/state/reset", { confirmacao });
    setEnviando(false);
    if (r?.error) return aviso(r.error);
    setConfirmacao("");
    await recarregar();
    aviso(r?.message || "Ambiente Beta restaurado.");
  };
  const ajustarSaldo = async (acao) => {
    if (!window.confirm("Executar SIMULAÇÃO de saldo fictício no Beta? Esta ação não possui valor real.")) return;
    setAjustando(acao);
    const r = await api("/state/beta/balance", { acao });
    setAjustando("");
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso(r?.message || "SIMULAÇÃO concluída.");
  };
  return <div className="vx-fade" style={{ maxWidth: 680 }}>
    <div className="vx-card" style={{ padding: 22, borderColor: "var(--amber)", marginBottom: 14 }}>
      <div className="vx-eyebrow" style={{ color: "var(--amber)" }}>SIMULAÇÃO financeira</div>
      <h2 className="vx-disp" style={{ margin: "4px 0 8px" }}>Saldo Beta — sem valor real</h2>
      <p className="vx-mut" style={{ marginTop: 0 }}>Controles exclusivos do Beta para testar campanha, aprovação, take rate, saldo da empresa, saldo do profissional e saques fictícios sem Pix, cartão ou dinheiro real.</p>
      <div className="vx-beta-actions">
        {[
          ["add_1000", "Adicionar R$ 1.000 fictícios"],
          ["add_10000", "Adicionar R$ 10.000 fictícios"],
          ["add_100000", "Adicionar R$ 100.000 fictícios"],
          ["zerar", "Zerar saldo"],
          ["restaurar", "Restaurar saldo padrão"],
        ].map(([acao, label]) => (
          <button key={acao} className="vx-btn" disabled={!!ajustando} onClick={() => ajustarSaldo(acao)}>
            {ajustando === acao ? "Simulando..." : label}
          </button>
        ))}
      </div>
    </div>
    <div className="vx-card" style={{ padding: 22, borderColor: "var(--amber)" }}>
      <div className="vx-eyebrow" style={{ color: "var(--amber)" }}>Exclusivo de testes</div>
      <h2 className="vx-disp" style={{ margin: "4px 0 8px" }}>Resetar ambiente de testes</h2>
      <p className="vx-mut" style={{ marginTop: 0 }}>Restaura a empresa, profissionais, campanha, leads, financeiro, Academy, Cérebro da Operação, relatórios, planos, take rate e modelos de verificação de QA. Esta operação só está disponível no Beta.</p>
      <label className="vx-label">Para confirmar, digite <b>RESETAR BETA</b></label>
      <input className="vx-input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="RESETAR BETA" autoComplete="off" />
      <button className="vx-btn vx-btn-danger" disabled={enviando || confirmacao !== "RESETAR BETA"} onClick={resetar} style={{ marginTop: 14 }}>{enviando ? "Restaurando…" : "Resetar ambiente de testes"}</button>
    </div>
  </div>;
}
