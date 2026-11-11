import { useState, useEffect, useCallback } from "react";
import { Banknote, CheckCircle2, XCircle, Clock } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { Vazio } from "../ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";

export default function DepositosAdmin({ aviso, recarregar }) {
  const { t } = useI18n();
  const [lista, setLista] = useState(null);
  const [processando, setProcessando] = useState("");
  const [motivo, setMotivo] = useState({});

  const carregar = useCallback(async () => {
    const r = await api("/deposits");
    if (Array.isArray(r)) setLista(r);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const decidir = async (d, status) => {
    if (status === "confirmado" &&
        !window.confirm(t("admin.deposits.confirmEntry", { amount: money(d.valor), company: d.empresaNome })))
      return;

    setProcessando(d.id);
    const r = await apiPatch(`/deposits/${d.id}`, { status, observacao: motivo[d.id] || "" });
    setProcessando("");
    if (r?.error) return aviso(r.error);
    await carregar();
    await recarregar?.();
    aviso(status === "confirmado" ? t("admin.deposits.credited", { amount: money(d.valor) }) : t("admin.deposits.rejected"));
  };

  if (!lista) return <div className="vx-mut" style={{ padding: 20 }}>{t("common.loading")}</div>;

  const pendentes = lista.filter((d) => d.status === "pendente");
  const resolvidos = lista.filter((d) => d.status !== "pendente");

  return (
    <div className="vx-fade">
      <div className="vx-card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flex: "none",
            background: "var(--amber-50)", border: "1px solid var(--amber-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Banknote size={19} color="var(--amber)" strokeWidth={2.1} />
          </div>
          <div>
            <div className="vx-disp" style={{ fontSize: 17 }}>{t("admin.deposits.title")}</div>
            <p className="vx-mut" style={{ fontSize: 13, marginTop: 3 }}>
              {t("admin.deposits.instructions")}
            </p>
          </div>
        </div>
      </div>

      <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>
        {t("admin.deposits.awaitingConfirmation")} {pendentes.length > 0 && `(${pendentes.length})`}
      </h3>

      {pendentes.length === 0 ? (
        <Vazio texto={t("admin.deposits.emptyText")} />
      ) : (
        <div className="vx-grid" style={{ marginBottom: 24 }}>
          {pendentes.map((d) => (
            <div key={d.id} className="vx-card" style={{ padding: 16 }}>
              <div className="vx-row" style={{ marginBottom: 10 }}>
                <div>
                  <div className="vx-disp" style={{ fontSize: 17 }}>{money(d.valor)}</div>
                  <div className="vx-mut" style={{ fontSize: 12.5 }}>
                    {d.empresaNome} · {dataCurta(d.criadoEm)}
                  </div>
                </div>
                <span className="vx-badge vx-badge-amber"><Clock size={11} /> {t("admin.deposits.pending")}</span>
              </div>

              <div style={{ padding: "9px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 10 }}>
                <span className="vx-mut" style={{ fontSize: 11.5 }}>{t("admin.deposits.reference")}</span>
                <div className="vx-mono" style={{ fontSize: 13.5, color: "var(--brand)" }}>{d.referencia}</div>
              </div>

              <input className="vx-input" placeholder={t("admin.deposits.notePlaceholder")}
                value={motivo[d.id] || ""} onChange={(e) => setMotivo((m) => ({ ...m, [d.id]: e.target.value }))} />

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="vx-btn vx-btn-primary" style={{ flex: 1 }}
                  disabled={processando === d.id} onClick={() => decidir(d, "confirmado")}>
                  <CheckCircle2 size={14} /> {t("admin.deposits.received")}
                </button>
                <button className="vx-btn vx-btn-danger" style={{ flex: "none" }}
                  disabled={processando === d.id || !(motivo[d.id] || "").trim()}
                  onClick={() => decidir(d, "recusado")}>
                  <XCircle size={14} /> {t("admin.deposits.reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolvidos.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>{t("admin.deposits.history")}</h3>
          <div className="vx-grid">
            {resolvidos.slice(0, 20).map((d) => {
              const ok = d.status === "confirmado";
              return (
                <div key={d.id} className="vx-card vx-row" style={{ padding: 13, fontSize: 13 }}>
                  <div>
                    <b className="vx-mono">{money(d.valor)}</b>
                    <div className="vx-mut" style={{ fontSize: 11.5 }}>
                      {d.empresaNome} · {d.referencia}
                      {d.observacao ? ` · ${d.observacao}` : ""}
                    </div>
                  </div>
                  <span className={"vx-badge " + (ok ? "vx-badge-brand" : "vx-badge-red")}>
                    {ok ? t("admin.deposits.confirmed") : t("admin.deposits.refused")}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
