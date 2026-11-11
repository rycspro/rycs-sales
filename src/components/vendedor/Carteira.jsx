import { useUnsavedChanges } from "../../lib/unsavedChanges.js";
import { chavePixValida } from "../../../shared/documentoConta.js";
import { useState } from "react";
import { Wallet, Clock, Banknote, CheckCircle2 } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { SAQUE_MINIMO } from "../../../shared/saque.js";
import { Stat, Campo } from "../ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import MeusEnvios from "./MeusEnvios.jsx";

const SITUACAO_TOM = {
  pago: "vx-badge-brand",
  solicitado: "vx-badge-amber",
  falhou: "vx-badge-muted",
  cancelado: "vx-badge-muted",
};

async function pedirRevisaoHumana(recarregar, aviso, t, sub) {
  const r = await api(`/submissions/${sub.id}/contestar`, {});
  if (r?.error) return aviso(r.error);
  await recarregar();
  aviso(t("seller.submissions.sentForReview"));
}

export default function Carteira({ eu, db, setDb, up, aviso, recarregar }) {
  const { t } = useI18n();
  const [pix, setPix] = useState(eu.pix || "");
  const [pixTipo, setPixTipo] = useState(eu.pixTipo || "");
  const [salvandoPix, setSalvandoPix] = useState(false);
  const pixAlterado = pix.trim() !== (eu.pix || "") || pixTipo !== (eu.pixTipo || "");
  useUnsavedChanges(pixAlterado);
  const [valor, setValor] = useState("");
  const meus = db.submissions.filter((s) => s.sellerId === eu.id);
  const saques = db.withdrawals.filter((w) => w.sellerId === eu.id);
  const MIN = SAQUE_MINIMO;

  const salvarPix = async () => {
    if (!chavePixValida(pix, pixTipo)) { aviso(t("seller.wallet.pixInvalid")); return false; }
    if (!window.confirm(t("seller.wallet.pixConfirm"))) return false;
    setSalvandoPix(true);
    const r = await apiPatch(`/sellers/${eu.id}`, { pix: pix.trim(), pixTipo });
    setSalvandoPix(false);
    if (!r || r.error) { aviso(r?.error || t("seller.wallet.pixSaveError")); return false; }
    up(d => ({ sellers: d.sellers.map(s => s.id === eu.id ? { ...s, pix: pix.trim(), pixTipo } : s) }));
    aviso(t("seller.wallet.pixUpdated")); return true;
  };

  const sacar = async () => {
    const v = Number(String(valor).replace(",", "."));
    if (!pix.trim()) return aviso(t("seller.wallet.enterPixKey"));
    if (!v || v < MIN) return aviso(t("seller.wallet.minWithdrawal", { min: money(MIN) }));

    if (!pixTipo) return aviso(t("seller.wallet.choosePixType"));
    if (!chavePixValida(pix, pixTipo)) return aviso(t("seller.wallet.pixInvalid"));
    if (pixAlterado && !await salvarPix()) return;

    const r = await api("/payments/withdraw", { valor: v });
    if (!r || r.error) return aviso(r?.error || t("seller.wallet.withdrawError"));

    await recarregar();
    setValor("");
    aviso(r.message || t("seller.wallet.withdrawRequested"));
  };

  return (
    <div className="vx-fade">
      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label={t("seller.wallet.available")} value={money(eu.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label={t("seller.wallet.underReview")} value={money(eu.pendente)} Icon={Clock} tone="amber" />
        <Stat label={t("seller.wallet.withdrawn")} value={money(eu.sacado)} Icon={Banknote} tone="indigo" />
        <Stat label={t("seller.wallet.approvedActions")} value={meus.filter((s) => s.status === "liberado").length} Icon={CheckCircle2} tone="muted" mono={false} />
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>{t("seller.wallet.withdrawViaPix")}</div>
        <Campo label={t("seller.wallet.keyType")}>
          <select className="vx-input" value={pixTipo} onChange={(e) => setPixTipo(e.target.value)}>
            <option value="">{t("seller.wallet.select")}</option>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
            <option value="PHONE">{t("seller.wallet.phone")}</option>
            <option value="EMAIL">{t("seller.wallet.email")}</option>
            <option value="EVP">{t("seller.wallet.randomKey")}</option>
          </select>
        </Campo>
        <Campo label={t("seller.wallet.pixKey")}>
          <input className="vx-input" value={pix} onChange={(e) => setPix(e.target.value)}
            placeholder={{CPF:"000.000.000-00",CNPJ:"00.000.000/0001-00",PHONE:"(11) 90000-0000",EMAIL:"voce@email.com",EVP:t("seller.wallet.randomKeyPlaceholder")}[pixTipo] || t("seller.wallet.chooseTypeFirst")} />
        </Campo>
        <button className="vx-btn vx-btn-block" disabled={!pixAlterado || salvandoPix} onClick={salvarPix}>{salvandoPix ? t("common.saving") : t("seller.wallet.savePaymentInfo")}</button>
        <Campo label={t("seller.wallet.amount", { min: money(MIN) })}>
          <input className="vx-input vx-mono" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" disabled={eu.disponivel < MIN} onClick={sacar}>
          {eu.disponivel < MIN ? t("seller.wallet.needMore", { amount: money(Math.max(0, MIN - eu.disponivel)) }) : t("seller.wallet.requestWithdrawal")}
        </button>
      </div>

      {saques.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>{t("seller.wallet.withdrawals")}</h3>
          <div className="vx-grid" style={{ marginBottom: 20 }}>
            {saques.map((w) => (
              <div key={w.id} className="vx-card vx-row" style={{ padding: 14, fontSize: 13.5 }}>
                <div>
                  <b className="vx-mono">{money(w.valor)}</b>
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>{w.pix} · {dataCurta(w.criadoEm)}</div>
                </div>
                <span className={"vx-badge " + (SITUACAO_TOM[w.status] || SITUACAO_TOM.solicitado)}>
                  {t(`seller.wallet.status.${w.status}`)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>{t("seller.wallet.actionsStatement")}</h3>
      <MeusEnvios empresa={null} eu={eu} db={db} up={up} pedirRevisao={(sub) => pedirRevisaoHumana(recarregar, aviso, t, sub)} />
    </div>
  );
}
