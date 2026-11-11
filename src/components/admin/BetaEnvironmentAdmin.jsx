import { useState } from "react";
import { api } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function BetaEnvironmentAdmin({ aviso, recarregar }) {
  const { t } = useI18n();
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ajustando, setAjustando] = useState("");
  const resetar = async () => {
    if (confirmacao !== "RESETAR BETA") return aviso(t("admin.beta.typeConfirm"));
    if (!window.confirm(t("admin.beta.confirmReset"))) return;
    setEnviando(true);
    const r = await api("/state/reset", { confirmacao });
    setEnviando(false);
    if (r?.error) return aviso(r.error);
    setConfirmacao("");
    await recarregar();
    aviso(r?.message || t("admin.beta.resetSuccess"));
  };
  const ajustarSaldo = async (acao) => {
    if (!window.confirm(t("admin.beta.confirmBalance"))) return;
    setAjustando(acao);
    const r = await api("/state/beta/balance", { acao });
    setAjustando("");
    if (r?.error) return aviso(r.error);
    await recarregar();
    aviso(r?.message || t("admin.beta.simDone"));
  };
  return <div className="vx-fade" style={{ maxWidth: 680 }}>
    <div className="vx-card" style={{ padding: 22, borderColor: "var(--amber)", marginBottom: 14 }}>
      <div className="vx-eyebrow" style={{ color: "var(--amber)" }}>{t("admin.beta.simTitle")}</div>
      <h2 className="vx-disp" style={{ margin: "4px 0 8px" }}>{t("admin.beta.balanceTitle")}</h2>
      <p className="vx-mut" style={{ marginTop: 0 }}>{t("admin.beta.balanceDesc")}</p>
      <div className="vx-beta-actions">
        {[
          ["add_1000", t("admin.beta.add1k")],
          ["add_10000", t("admin.beta.add10k")],
          ["add_100000", t("admin.beta.add100k")],
          ["zerar", t("admin.beta.zeroBalance")],
          ["restaurar", t("admin.beta.restoreDefault")],
        ].map(([acao, label]) => (
          <button key={acao} className="vx-btn" disabled={!!ajustando} onClick={() => ajustarSaldo(acao)}>
            {ajustando === acao ? t("admin.beta.simulating") : label}
          </button>
        ))}
      </div>
    </div>
    <div className="vx-card" style={{ padding: 22, borderColor: "var(--amber)" }}>
      <div className="vx-eyebrow" style={{ color: "var(--amber)" }}>{t("admin.beta.testOnly")}</div>
      <h2 className="vx-disp" style={{ margin: "4px 0 8px" }}>{t("admin.beta.resetTitle")}</h2>
      <p className="vx-mut" style={{ marginTop: 0 }}>{t("admin.beta.resetDesc")}</p>
      <label className="vx-label">{t("admin.beta.typeLabel")}</label>
      <input className="vx-input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="RESETAR BETA" autoComplete="off" />
      <button className="vx-btn vx-btn-danger" disabled={enviando || confirmacao !== "RESETAR BETA"} onClick={resetar} style={{ marginTop: 14 }}>{enviando ? t("admin.beta.resetting") : t("admin.beta.resetBtn")}</button>
    </div>
  </div>;
}
