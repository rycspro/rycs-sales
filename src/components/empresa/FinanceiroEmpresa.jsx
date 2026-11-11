import { useEffect, useMemo, useState } from "react";
import { Download, Landmark, Lock, Receipt, TrendingDown, Wallet } from "lucide-react";
import { api, API_URL } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { Stat, Vazio, Donut } from "../ui.jsx";
import { ACOES } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

const MOVIMENTOS_KEYS = {
  deposito: { key: "fin.mov.deposit", tom: "brand" },
  reserva: { key: "fin.mov.reserve", tom: "amber" },
  estorno_reserva: { key: "fin.mov.reversal", tom: "muted" },
  liquidacao: { key: "fin.mov.released", tom: "red" },
};

export default function FinanceiroEmpresa({ emp, db, aviso }) {
  const { t } = useI18n();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState({ dias: "30", de: "", ate: "", tipo: "", campaignId: "" });
  const [periodo, setPeriodo] = useState("30");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (periodo === "custom") {
      if (filtros.de) p.set("de", filtros.de);
      if (filtros.ate) p.set("ate", filtros.ate);
    } else if (filtros.dias) {
      p.set("dias", filtros.dias);
    }
    if (filtros.tipo) p.set("tipo", filtros.tipo);
    if (filtros.campaignId) p.set("campaignId", filtros.campaignId);
    return p.toString();
  }, [filtros, periodo]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    api(`/company/finance?${query}`).then((r) => {
      if (!ativo) return;
      setCarregando(false);
      if (!r || r.error) return setErro(r?.error || t("fin.loadError"));
      setDados(r);
    });
    return () => { ativo = false; };
  }, [query]);

  const exportar = () => {
    // O download precisa do cookie de sessão, então vai pelo próprio
    // navegador em vez de fetch — o arquivo chega direto na pasta do usuário.
    window.open(`${API_URL}/api/company/finance/export?${query}`, "_blank");
    aviso?.(t("fin.exportDone"));
  };

  const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
  const posicao = dados?.posicao || { saldo: 0, reservado: 0, disponivel: 0 };
  const resumo = dados?.resumo || { depositado: 0, utilizado: 0, taxas: 0, repassado: 0, movimentos: 0 };

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">{t("fin.eyebrow")}</div>
          <h1 className="vx-disp">{t("fin.title")}</h1>
          <p>{t("fin.desc")}</p>
        </div>
        <button className="vx-btn" onClick={exportar} disabled={!dados?.extrato?.length}>
          <Download size={14} /> {t("fin.exportCsv")}
        </button>
      </div>

      <div className="vx-grid vx-g3" style={{ marginTop: 4 }}>
        <label>
          <span className="vx-label">{t("fin.period")}</span>
          <select className="vx-input" value={periodo} onChange={(e) => {
            const v = e.target.value;
            setPeriodo(v);
            if (v === "custom") setFiltros((f) => ({ ...f, dias: "" }));
            else setFiltros((f) => ({ ...f, dias: v, de: "", ate: "" }));
          }}>
            <option value="7">{t("period.last7")}</option>
            <option value="30">{t("period.last30")}</option>
            <option value="90">{t("period.last90")}</option>
            <option value="">{t("period.all")}</option>
            <option value="custom">{t("period.custom")}</option>
          </select>
        </label>
        {periodo === "custom" && (
          <>
            <label>
              <span className="vx-label">{t("period.from")}</span>
              <input type="date" className="vx-input" value={filtros.de} max={filtros.ate || undefined}
                onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))} />
            </label>
            <label>
              <span className="vx-label">{t("period.to")}</span>
              <input type="date" className="vx-input" value={filtros.ate} min={filtros.de || undefined}
                onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))} />
            </label>
          </>
        )}
        <label>
          <span className="vx-label">{t("fin.movement")}</span>
          <select className="vx-input" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
            <option value="">{t("fin.allMovements")}</option>
            {Object.entries(MOVIMENTOS_KEYS).map(([k, m]) => <option key={k} value={k}>{t(m.key)}</option>)}
          </select>
        </label>
        <label>
          <span className="vx-label">{t("fin.campaign")}</span>
          <select className="vx-input" value={filtros.campaignId} onChange={(e) => setFiltros({ ...filtros, campaignId: e.target.value })}>
            <option value="">{t("fin.allCampaigns")}</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        </label>
      </div>

      <div className="vx-grid vx-g3" style={{ marginTop: 16 }}>
        <Stat label={t("fin.available")} value={money(posicao.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label={t("fin.reservedActions")} value={money(posicao.reservado)} Icon={Lock} tone="amber" />
        <Stat label={t("fin.balance")} value={money(posicao.saldo)} Icon={Landmark} tone="muted" />
      </div>

      <div className="vx-grid vx-g4" style={{ marginTop: 12 }}>
        <Stat label={t("fin.deposited")} value={money(resumo.depositado)} Icon={Landmark} tone="brand" />
        <Stat label={t("fin.utilized")} value={money(resumo.utilizado)} Icon={TrendingDown} tone="red" />
        <Stat label={t("fin.platformFee")} value={money(resumo.taxas)} Icon={Receipt} tone="amber" />
        <Stat label={t("fin.paidToPros")} value={money(resumo.repassado)} Icon={Wallet} tone="muted" />
      </div>

      {(resumo.taxas > 0 || resumo.repassado > 0) && (
        <div style={{ marginTop: 16 }}>
          <Donut
            titulo={t("fin.whereItWent")}
            centro={money(resumo.utilizado)}
            formatar={money}
            itens={[
              { nome: t("fin.paidToPro"), valor: resumo.repassado, cor: "var(--brand)" },
              { nome: t("fin.platformFee"), valor: resumo.taxas, cor: "var(--amber)" },
            ]}
          />
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div className="vx-row" style={{ marginBottom: 10 }}>
          <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>{t("fin.statement")}</h2>
          <span className="vx-chip vx-mono">{resumo.movimentos} {t("fin.movementCount", { count: resumo.movimentos })}</span>
        </div>

        {carregando && <div className="vx-card" style={{ padding: 18 }}><div className="vx-skeleton" style={{ height: 18, marginBottom: 9 }} /><div className="vx-skeleton" style={{ height: 18, marginBottom: 9 }} /><div className="vx-skeleton" style={{ height: 18 }} /></div>}

        {!carregando && erro && <div className="vx-notice vx-notice-amber">{erro}</div>}

        {!carregando && !erro && !dados?.extrato?.length && (
          <Vazio
            titulo={t("fin.noMovements")}
            texto={t("fin.noMovementsDesc")}
          />
        )}

        {!carregando && !erro && !!dados?.extrato?.length && (
          <div className="vx-table-wrap">
            <table className="vx-table">
              <thead>
                <tr>
                  <th>{t("fin.date")}</th><th>{t("fin.movement")}</th><th>{t("fin.origin")}</th>
                  <th style={{ textAlign: "right" }}>{t("fin.gross")}</th>
                  <th style={{ textAlign: "right" }}>{t("fin.fee")}</th>
                  <th style={{ textAlign: "right" }}>{t("fin.value")}</th>
                </tr>
              </thead>
              <tbody>
                {dados.extrato.map((l) => {
                  const mk = MOVIMENTOS_KEYS[l.tipo];
                  const m = mk ? { nome: t(mk.key), tom: mk.tom } : { nome: l.tipo, tom: "muted" };
                  return (
                    <tr key={l.id}>
                      <td className="vx-mono" style={{ whiteSpace: "nowrap" }}>{dataCurta(l.criadoEm)}</td>
                      <td><span className={`vx-badge vx-badge-${m.tom}`}>{m.nome}</span></td>
                      <td>
                        {l.tarefa ? <b style={{ fontSize: 13 }}>{ACOES[l.tarefa]?.nome || l.tarefa}</b> : <span className="vx-mut">{l.referencia || "—"}</span>}
                        {(l.campanha || l.profissional) && (
                          <div className="vx-mut" style={{ fontSize: 11.5 }}>
                            {[l.campanha, l.profissional].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="vx-mono" style={{ textAlign: "right" }}>{l.bruto != null ? money(l.bruto) : "—"}</td>
                      <td className="vx-mono" style={{ textAlign: "right" }}>{l.taxa != null ? money(l.taxa) : "—"}</td>
                      <td className="vx-mono" style={{ textAlign: "right", color: l.valor < 0 ? "var(--red)" : "var(--brand)" }}>
                        {l.valor < 0 ? "−" : "+"}{money(Math.abs(l.valor))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="vx-chart-source">
          {t("fin.disclaimer")}
        </div>
      </div>
    </div>
  );
}
