import { useState, useEffect } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { ORDEM_PLANOS, PLANOS } from "../../../shared/planos.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function CobrancaEmpresa({ empresa, aviso, onVoltar }) {
  const { t } = useI18n();
  const BILLING_LABELS = {
    ativa: { txt: t("admin.billing.active"), color: "#22A06B" },
    isenta: { txt: t("admin.billing.exempt"), color: "#6366F1" },
    pausada: { txt: t("admin.billing.paused"), color: "#F59E0B" },
  };
  const TIPO_LABELS = {
    padrao: { txt: t("admin.billing.standard"), color: "var(--muted)" },
    premium: { txt: "Premium", color: "#A855F7" },
  };
  const ACCESS_LABELS = {
    ativo: { txt: t("admin.billing.accessActive"), color: "#22A06B" },
    bloqueado: { txt: t("admin.billing.accessBlocked"), color: "#EF4444" },
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { tipo: 'isentar'|'pausar'|'bloquear'|'liberar'|'reativar'|'pagamento' }
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api(`/admin/companies/${empresa.id}/billing`).then((r) => {
      if (r && !r.error) setData(r);
      setLoading(false);
    });
  };

  useEffect(() => { carregar(); }, [empresa.id]);

  const acao = async (billing_status, access_status, extra = {}) => {
    setSalvando(true);
    const body = {};
    if (billing_status) body.billing_status = billing_status;
    if (access_status) body.access_status = access_status;
    if (extra.motivo) body.motivo = extra.motivo;
    if (extra.isencao_ate) body.isencao_ate = extra.isencao_ate;
    if (extra.tipoEmpresa !== undefined) body.tipoEmpresa = extra.tipoEmpresa;
    if (extra.plano !== undefined) body.plano = extra.plano;
    const r = await apiPatch(`/admin/companies/${empresa.id}/billing/status`, body);
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso(t("admin.billing.configSaved"));
    setModal(null);
    setForm({});
    carregar();
  };

  const gerarPagamento = async () => {
    setSalvando(true);
    const r = await api(`/admin/companies/${empresa.id}/billing/payment`, {
      descricao: form.descricao,
      valor: Number(form.valor),
      metodo: form.metodo || "pix",
    });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso(t("admin.billing.chargeCreated"));
    setModal(null);
    setForm({});
  };

  if (loading) return <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>{t("common.loading")}</div>;
  if (!data) return <div className="vx-card" style={{ padding: 24, color: "var(--red)" }}>{t("admin.billing.loadError")}</div>;

  const { billing, historico } = data;
  const bs = BILLING_LABELS[billing.billing_status] || BILLING_LABELS.ativa;
  const as = ACCESS_LABELS[billing.access_status] || ACCESS_LABELS.ativo;
  const ts = TIPO_LABELS[billing.tipoEmpresa] || TIPO_LABELS.padrao;
  const premium = billing.tipoEmpresa === "premium";
  const nomePlano = billing.plano && PLANOS[billing.plano] ? PLANOS[billing.plano].nome : null;

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 20 }}>
        <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={onVoltar}>← {t("common.back")}</button>
        <div className="vx-disp" style={{ fontSize: 18 }}>{t("admin.billing.title")} — {empresa.nome}</div>
      </div>

      {/* Status atual */}
      <div className="vx-grid vx-g2" style={{ marginBottom: 20 }}>
        <div className="vx-card" style={{ padding: 20 }}>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.billing.subscription")}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: bs.color, marginBottom: 10 }}>{bs.txt}</div>
          {billing.billing_status === "isenta" && billing.isencao_motivo && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{t("admin.billing.reason")}: {billing.isencao_motivo}</div>
          )}
          {billing.billing_status === "isenta" && billing.isencao_ate && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{t("admin.billing.until")}: {dataCurta(billing.isencao_ate)}</div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {billing.billing_status !== "isenta" && (
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => { setModal("isentar"); setForm({}); }}>
                {t("admin.billing.makeExempt")}
              </button>
            )}
            {billing.billing_status === "isenta" && (
              <button className="vx-btn vx-btn-sm" onClick={() => acao("ativa", null, { motivo: "Reativação" })}>
                {t("admin.billing.reactivate")}
              </button>
            )}
            {billing.billing_status === "ativa" && (
              <button className="vx-btn vx-btn-sm" onClick={() => { setModal("pausar"); setForm({}); }}>
                {t("admin.billing.pause")}
              </button>
            )}
            {billing.billing_status === "pausada" && (
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => acao("ativa", null, { motivo: "Reativação" })}>
                {t("admin.billing.reactivate")}
              </button>
            )}
          </div>
        </div>

        <div className="vx-card" style={{ padding: 20 }}>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.billing.access")}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: as.color, marginBottom: 14 }}>{as.txt}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {billing.access_status === "ativo" ? (
              <button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => { setModal("bloquear"); setForm({}); }}>
                {t("admin.billing.blockAccess")}
              </button>
            ) : (
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => acao(null, "ativo", { motivo: "Liberação administrativa" })}>
                {t("admin.billing.grantAccess")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tipo da empresa e plano liberado */}
      <div className="vx-grid vx-g2" style={{ marginBottom: 20 }}>
        <div className="vx-card" style={{ padding: 20 }}>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.billing.companyType")}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: ts.color, marginBottom: 10 }}>{ts.txt}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            {premium
              ? t("admin.billing.premiumDesc")
              : t("admin.billing.standardDesc")}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!premium ? (
              <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => { setModal("premium"); setForm({}); }}>
                {t("admin.billing.makePremium")}
              </button>
            ) : (
              <button className="vx-btn vx-btn-sm" onClick={() => { setModal("padrao"); setForm({}); }}>
                {t("admin.billing.backToStandard")}
              </button>
            )}
          </div>
        </div>

        <div className="vx-card" style={{ padding: 20 }}>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.billing.grantedPlan")}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{nomePlano || t("admin.billing.none")}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            {t("admin.billing.grantedPlanDesc")}
          </div>
          <select className="vx-input" value={billing.plano || ""} disabled={salvando}
            aria-label={t("admin.billing.grantedPlan")}
            onChange={(e) => acao(null, null, { plano: e.target.value, motivo: "Plano definido pela plataforma" })}>
            <option value="">{t("admin.billing.noneCompanyPays")}</option>
            {ORDEM_PLANOS.map((k) => (
              <option key={k} value={k}>{PLANOS[k].nome}{PLANOS[k].preco ? ` — R$ ${PLANOS[k].preco}` : ""}</option>
            ))}
            <option value="premium">{t("admin.billing.premiumNoFee")}</option>
          </select>
        </div>
      </div>

      {/* Gerar pagamento */}
      <div className="vx-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <b>{t("admin.billing.generatePayment")}</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>{t("admin.billing.pixCardOnly")}</div>
          </div>
          <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => { setModal("pagamento"); setForm({ metodo: "pix" }); }}>
            + {t("admin.billing.generateCharge")}
          </button>
        </div>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="vx-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
            {t("admin.billing.adminHistory")}
          </div>
          {historico.map((h) => (
            <div key={h.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span className="vx-mono" style={{ fontSize: 11, color: "var(--muted)" }}>{dataCurta(h.criadoEm)}</span>
                <span style={{ fontWeight: 600 }}>
                  {h.status_anterior} → <span style={{ color: "var(--brand)" }}>{h.status_novo}</span>
                </span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{({ billing_status: t("admin.billing.billing"), access_status: t("admin.billing.access"), tipoEmpresa: t("admin.billing.type"), plano: t("admin.billing.plan") })[h.campo] || h.campo}</span>
              </div>
              {h.motivo && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{t("admin.billing.reason")}: {h.motivo}</div>}
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{t("admin.billing.by")}: {h.adminEmail || h.adminId}</div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="vx-card" style={{ width: "100%", maxWidth: 440, padding: 28, margin: 16 }}>

            {modal === "isentar" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 16 }}>{t("admin.billing.makeExemptTitle")}</div>
                <label className="vx-label">{t("admin.billing.reason")}</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder={t("admin.billing.egInternal")} />
                <label className="vx-label" style={{ marginTop: 12 }}>{t("admin.billing.deadline")}</label>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={!form.isencao_ate} onChange={() => setForm({ ...form, isencao_ate: null })} /> {t("admin.billing.noDeadline")}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={!!form.isencao_ate} onChange={() => setForm({ ...form, isencao_ate: new Date().toISOString().split("T")[0] })} /> {t("admin.billing.untilDate")}:
                  </label>
                  {form.isencao_ate !== undefined && form.isencao_ate !== null && (
                    <input type="date" className="vx-input" style={{ width: 140 }} value={form.isencao_ate} onChange={(e) => setForm({ ...form, isencao_ate: e.target.value })} />
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={() => acao("isenta", null, form)}>{t("common.confirm")}</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>{t("common.cancel")}</button>
                </div>
              </>
            )}

            {modal === "premium" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 8 }}>{t("admin.billing.makePremiumTitle")}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
                  {t("admin.billing.makePremiumDesc", { name: empresa.nome })}
                </div>
                <label className="vx-label">{t("admin.billing.reason")}</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder={t("admin.billing.egPartnership")} />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando || !form.motivo} onClick={() => acao(null, null, { tipoEmpresa: "premium", motivo: form.motivo })}>{t("common.confirm")}</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>{t("common.cancel")}</button>
                </div>
              </>
            )}

            {modal === "padrao" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 8 }}>{t("admin.billing.backToStandardTitle")}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
                  {t("admin.billing.backToStandardDesc", { name: empresa.nome })}
                </div>
                <label className="vx-label">{t("admin.billing.reason")}</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder={t("admin.billing.enterReason")} />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando || !form.motivo} onClick={() => acao(null, null, { tipoEmpresa: "padrao", motivo: form.motivo })}>{t("common.confirm")}</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>{t("common.cancel")}</button>
                </div>
              </>
            )}

            {modal === "pausar" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 16 }}>{t("admin.billing.pauseTitle")}</div>
                <label className="vx-label">{t("admin.billing.reasonOptional")}</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder={t("admin.billing.reason")} />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={() => acao("pausada", null, form)}>{t("admin.billing.pause")}</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>{t("common.cancel")}</button>
                </div>
              </>
            )}

            {modal === "bloquear" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 8 }}>{t("admin.billing.blockAccessTitle")}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>{t("admin.billing.blockAccessDesc")}</div>
                <label className="vx-label">{t("admin.billing.reason")}</label>
                <input className="vx-input" value={form.motivo || ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder={t("admin.billing.enterReason")} />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="vx-btn vx-btn-danger" disabled={salvando || !form.motivo} onClick={() => acao(null, "bloqueado", form)}>{t("admin.billing.block")}</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>{t("common.cancel")}</button>
                </div>
              </>
            )}

            {modal === "pagamento" && (
              <>
                <div className="vx-disp" style={{ fontSize: 17, marginBottom: 16 }}>{t("admin.billing.generateCharge")}</div>
                <div style={{ marginBottom: 8, fontSize: 13 }}>{t("admin.billing.company")}: <b>{empresa.nome}</b></div>
                <label className="vx-label">{t("admin.billing.description")}</label>
                <input className="vx-input" value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder={t("admin.billing.egMonthly")} />
                <label className="vx-label" style={{ marginTop: 12 }}>{t("admin.billing.amount")}</label>
                <input className="vx-input" type="number" min="1" value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0.00" />
                <label className="vx-label" style={{ marginTop: 12 }}>{t("admin.billing.paymentMethod")}</label>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={form.metodo === "pix"} onChange={() => setForm({ ...form, metodo: "pix" })} /> PIX
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" checked={form.metodo === "cartao"} onChange={() => setForm({ ...form, metodo: "cartao" })} /> {t("admin.billing.card")}
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="vx-btn vx-btn-primary" disabled={salvando || !form.descricao || !form.valor} onClick={gerarPagamento}>{t("common.confirm")}</button>
                  <button className="vx-btn" onClick={() => setModal(null)}>{t("common.cancel")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
