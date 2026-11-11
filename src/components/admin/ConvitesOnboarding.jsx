import { useEffect, useId, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { TRIAL_ONBOARDING_DIAS, CONVITE_VALIDADE_PADRAO_DIAS, CONVITE_VALIDADE_MAX_DIAS } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Links de onboarding gerados pela operação, um por empresa: preso ao e-mail,
// uso único, com ou sem trial, e validade escolhida aqui. O link aparece uma
// vez só — o servidor guarda apenas o hash.

export default function ConvitesOnboarding({ aviso }) {
  const { t } = useI18n();
  const ROTULO_ESTADO = {
    disponivel: [t("admin.invites.stateAvailable"), "brand"],
    usado: [t("admin.invites.stateUsed"), "muted"],
    expirado: [t("admin.invites.stateExpired"), "amber"],
    revogado: [t("admin.invites.stateCanceled"), "red"],
  };
  const id = useId();
  const [email, setEmail] = useState("");
  const [comTrial, setComTrial] = useState(true);
  const [validade, setValidade] = useState(CONVITE_VALIDADE_PADRAO_DIAS);
  const [observacao, setObservacao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [gerado, setGerado] = useState(null);
  const [lista, setLista] = useState(null);

  const carregar = () => api("/admin/onboarding-convites").then((r) => setLista(r?.convites || []));
  useEffect(() => { carregar(); }, []);

  const gerar = async (e) => {
    e.preventDefault();
    setErro("");
    setGerando(true);
    const r = await api("/admin/onboarding-convites", { email, comTrial, validadeDias: validade, observacao });
    setGerando(false);
    if (!r || r.error) { setErro(r?.error || t("admin.invites.generateError")); return; }
    setGerado(r);
    setEmail(""); setObservacao("");
    carregar();
  };

  const revogar = async (c) => {
    if (!window.confirm(t("admin.invites.confirmRevoke", { email: c.email }))) return;
    const r = await api(`/admin/onboarding-convites/${c.id}/revogar`, {});
    if (r?.error) return aviso?.(r.error);
    carregar();
  };

  return (
    <div className="vx-fade">
      <div className="vx-disp" style={{ fontSize: 22, marginBottom: 6 }}>{t("admin.invites.title")}</div>
      <p className="vx-mut" style={{ fontSize: 13, marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
        {t("admin.invites.description", { days: TRIAL_ONBOARDING_DIAS })}
      </p>

      <form className="vx-card" style={{ padding: 18, marginBottom: 16 }} onSubmit={gerar}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <div>
            <label className="vx-label" htmlFor={`${id}-email`}>{t("admin.invites.companyEmail")}</label>
            <input id={`${id}-email`} className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="vx-label" htmlFor={`${id}-validade`}>{t("admin.invites.validity")}</label>
            <input id={`${id}-validade`} className="vx-input" type="number" min={1} max={CONVITE_VALIDADE_MAX_DIAS}
              value={validade} onChange={(e) => setValidade(e.target.value)} required />
          </div>
          <div>
            <label className="vx-label" htmlFor={`${id}-obs`}>{t("admin.invites.note")}</label>
            <input id={`${id}-obs`} className="vx-input" value={observacao} maxLength={200} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: "14px 0 0", display: "flex", gap: 18, flexWrap: "wrap" }}>
          <legend className="vx-label">{t("admin.invites.linkType")}</legend>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, cursor: "pointer" }}>
            <input type="radio" name={`${id}-tipo`} checked={comTrial} onChange={() => setComTrial(true)} />
            {t("admin.invites.withTrial", { days: TRIAL_ONBOARDING_DIAS })}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, cursor: "pointer" }}>
            <input type="radio" name={`${id}-tipo`} checked={!comTrial} onChange={() => setComTrial(false)} />
            {t("admin.invites.noTrial")}
          </label>
        </fieldset>
        {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
        <button className="vx-btn vx-btn-primary" type="submit" disabled={gerando} style={{ marginTop: 10, minHeight: 44 }}>
          <Link2 size={14} /> {gerando ? t("admin.invites.generating") : t("admin.invites.generateLink")}
        </button>
      </form>

      {gerado && (
        <div className="vx-card" role="status" style={{ padding: 16, marginBottom: 16, borderColor: "var(--brand)", background: "var(--brand-50)" }}>
          <div className="vx-eyebrow" style={{ color: "var(--brand)", marginBottom: 7 }}>
            Link para {gerado.email} — {gerado.trialDias ? `com ${gerado.trialDias} dias de trial` : "sem trial"} — copie agora
          </div>
          <div className="vx-mono" style={{ fontSize: 12, wordBreak: "break-all", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>
            {gerado.url}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" style={{ minHeight: 44 }}
              onClick={() => { navigator.clipboard?.writeText(gerado.url); aviso?.(t("admin.invites.linkCopied")); }}>
              <Copy size={13} /> {t("admin.invites.copyLink")}
            </button>
            <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={() => setGerado(null)}>{t("common.close")}</button>
          </div>
          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>
            {gerado.aviso} Expira em {new Date(gerado.expiraEm).toLocaleDateString("pt-BR")}.
          </div>
        </div>
      )}

      <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
        {lista === null && <div className="vx-onb-estado">{t("common.loading")}</div>}
        {lista?.length === 0 && <div className="vx-onb-estado">{t("admin.invites.noLinks")}</div>}
        {lista?.map((c) => {
          const [rotulo, tom] = ROTULO_ESTADO[c.estado] || ROTULO_ESTADO.expirado;
          return (
            <div key={c.id} className="vx-row" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, wordBreak: "break-all" }}>{c.email}</div>
                <div className="vx-mut" style={{ fontSize: 12 }}>
                  {c.trialDias ? `Trial de ${c.trialDias} dias` : "Sem trial"} · gerado {dataCurta(c.criadoEm)} · expira {dataCurta(c.expiraEm)}
                  {c.usadoPor ? ` · usado por ${c.usadoPor}` : ""}{c.observacao ? ` · ${c.observacao}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`vx-badge vx-badge-${tom}`}>{rotulo}</span>
                {c.estado === "disponivel" && (
                  <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" style={{ minHeight: 44 }} onClick={() => revogar(c)}>{t("admin.invites.cancel")}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
