import { useEffect, useRef, useState } from "react";
import { Check, X, QrCode } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import NovaCampanha from "../empresa/NovaCampanha.jsx";
import { ETAPAS, PARTES_IA } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Etapa 6: primeira campanha. A criação é a mesma tela de sempre
// (NovaCampanha). Depois de criada: as estratégias aprovadas ficam ligadas
// a ela, o caixa é abastecido por Pix e a campanha é publicada. O onboarding
// termina com a campanha criada e o depósito feito; o que ainda faltar para
// publicar aparece na lista e se resolve no painel.

function Estrategias({ estrategias }) {
  const { t } = useI18n();
  if (!estrategias) return <p className="vx-mut" style={{ fontSize: 14 }}>{t("onb.campaign.noStrategies")}</p>;
  return (
    <ul className="vx-onb-estrategias">
      {PARTES_IA.map((p) => (
        <li key={p.chave}>
          <b>{p.label}</b>
          <span className="vx-mut">{p.chave === "followups"
            ? t("onb.campaign.followupCount", { count: (estrategias.followups || []).length })
            : p.campos.map(([, r]) => r).join(" · ")}</span>
        </li>
      ))}
    </ul>
  );
}

function Deposito({ sugerido, aoGerado }) {
  const { t } = useI18n();
  const [valor, setValor] = useState(String(Math.max(5, Math.ceil(sugerido || 0))));
  const [minimo, setMinimo] = useState(1);
  const [cobranca, setCobranca] = useState(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  useEffect(() => { api("/deposits/config").then((c) => { if (c?.minimo) setMinimo(c.minimo); }); }, []);

  const gerar = async (e) => {
    e.preventDefault();
    const v = Number(String(valor).replace(/\./g, "").replace(",", "."));
    if (!v || v < minimo) return setErro(t("onb.campaign.minDeposit", { min: money(minimo) }));
    setErro("");
    setGerando(true);
    const r = await api("/deposits", { valor: v });
    setGerando(false);
    if (!r || r.error) return setErro(r?.error || t("onb.campaign.errPix"));
    setCobranca({ ...r, valor: v });
    aoGerado?.();
  };

  if (cobranca) return (
    <div className="vx-onb-pix" role="status">
      <QrCode size={22} aria-hidden="true" />
      <p><b>{t("onb.campaign.pixGenerated", { amount: money(cobranca.valor) })}</b> {cobranca.instrucoes}</p>
      {cobranca.pixQrCodeBase64 && <img src={`data:image/png;base64,${cobranca.pixQrCodeBase64}`} alt="QR Code do Pix" width={200} height={200} />}
      {cobranca.pixCopiaECola && (
        <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => navigator.clipboard?.writeText(cobranca.pixCopiaECola)}>{t("onb.campaign.copyPixCode")}</button>
      )}
      {cobranca.pix && <p>Chave Pix: <b>{cobranca.pix}</b> · referência <b>{cobranca.referencia}</b></p>}
      <p className="vx-onb-dica">{t("onb.campaign.autoRefresh")}</p>
    </div>
  );

  return (
    <form onSubmit={gerar} className="vx-onb-linha" noValidate>
      <label className="vx-label" htmlFor="onb-deposito" style={{ position: "absolute", left: -9999 }}>{t("onb.campaign.depositLabel")}</label>
      <div className="vx-onb-moeda" style={{ flex: 1 }}>
        <span aria-hidden="true">R$</span>
        <input id="onb-deposito" className="vx-input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} aria-describedby={erro ? "onb-deposito-erro" : undefined} />
      </div>
      <button type="submit" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} disabled={gerando}>{gerando ? t("onb.campaign.generating") : t("onb.campaign.generatePix")}</button>
      {erro && <div id="onb-deposito-erro" className="vx-onb-erro" role="alert" style={{ flexBasis: "100%" }}>{erro}</div>}
    </form>
  );
}

export default function EtapaCampanha({ estado, emp, aviso, aoAtualizar, aoAvancar, aoVoltar }) {
  const { t } = useI18n();
  const [dados, setDados] = useState(null);
  const [erroCarga, setErroCarga] = useState("");
  const [aguardandoPix, setAguardandoPix] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [pendencias, setPendencias] = useState([]);
  const [erro, setErro] = useState("");
  const timer = useRef(null);

  const carregar = async () => {
    const r = await api("/onboarding/campanha");
    if (!r || r.error) { setErroCarga(r?.error || t("onb.campaign.errLoad")); return; }
    setErroCarga("");
    setDados(r);
  };
  useEffect(() => { carregar(); return () => clearTimeout(timer.current); }, []);

  // Pix gerado: confere a cada 5 segundos se o saldo entrou.
  useEffect(() => {
    if (!aguardandoPix || dados?.caixaOk) return;
    timer.current = setTimeout(carregar, 5000);
    return () => clearTimeout(timer.current);
  }, [aguardandoPix, dados]); // eslint-disable-line react-hooks/exhaustive-deps

  const concluir = async () => {
    setErro("");
    const r = await api("/onboarding/campanha/concluir", {});
    if (!r || r.error) return setErro(r?.error || t("onb.campaign.errFinish"));
    aoAtualizar(r);
  };

  const publicar = async () => {
    setErro("");
    setPendencias([]);
    setPublicando(true);
    const r = await api(`/campaigns/${dados.campanha.id}/status`, { status: "ativa" });
    setPublicando(false);
    if (r?.ok) { aviso?.(t("onb.campaign.published")); return concluir(); }
    setPendencias(r?.pendencias || []);
    setErro(r?.error || t("onb.campaign.errPublish"));
    carregar();
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>{t("onb.tryAgain")}</button>
    </div>
  );
  if (!dados || !emp) return <div className="vx-onb-estado" role="status">{t("onb.campaign.loading")}</div>;

  const selos = (
    <ul className="vx-onb-selos" aria-label={t("onb.campaign.completedSteps")}>
      {ETAPAS.filter((e) => estado.etapas[e.chave] === "concluida").map((e) => (
        <li key={e.chave}><Check size={13} aria-hidden="true" /> {e.label}</li>
      ))}
    </ul>
  );

  return (
    <div>
      <div className="vx-onb-eyebrow">{t("onb.stepOf", { n: 6, total: 6 })}{estado.trialDias ? ` · ${t("onb.campaign.trialActive")}` : ""}</div>
      <h1 className="vx-disp vx-onb-titulo">{t("onb.campaign.title")}</h1>
      {selos}

      <section className="vx-onb-card vx-onb-secao">
        <h2 className="vx-disp">{t("onb.campaign.strategiesApplied")}</h2>
        <p className="vx-onb-dica" style={{ marginTop: -8 }}>{t("onb.campaign.strategiesReadOnly")}</p>
        <Estrategias estrategias={dados.estrategias} />
      </section>

      {!dados.campanha ? (
        <NovaCampanha emp={emp} aviso={aviso} aoCancelar={aoVoltar}
          aoCriar={async (criada) => {
            const r = await api("/onboarding/campanha", { campaignId: criada.id });
            if (!r || r.error) setErro(r?.error || t("onb.campaign.errLink"));
            carregar();
          }} />
      ) : (
        <section className="vx-onb-card vx-onb-secao" aria-live="polite">
          <h2 className="vx-disp">{dados.campanha.titulo}</h2>
          <p className="vx-mut" style={{ marginTop: -8, fontSize: 14 }}>
            {dados.campanha.status === "ativa" ? t("onb.campaign.statusPublished") : t("onb.campaign.statusDraft")}
            {dados.campanha.orcamento ? ` ${t("onb.campaign.budget", { amount: money(dados.campanha.orcamento) })}` : ""}
            {dados.saldoDisponivel != null ? ` ${t("onb.campaign.balance", { amount: money(dados.saldoDisponivel) })}` : ""}
          </p>

          {!dados.caixaOk && <>
            <h3 className="vx-onb-eyebrow" style={{ margin: "16px 0 8px" }}>{t("onb.campaign.addBalance")}</h3>
            <p className="vx-mut" style={{ fontSize: 14, marginTop: 0 }}>{t("onb.campaign.addBalanceDesc")}</p>
            <Deposito sugerido={Math.max(0, dados.campanha.orcamento - (dados.saldoDisponivel || 0))} aoGerado={() => setAguardandoPix(true)} />
          </>}

          <h3 className="vx-onb-eyebrow" style={{ margin: "18px 0 8px" }}>{t("onb.campaign.toPublish")}</h3>
          <ul className="vx-onb-requisitos">
            {dados.requisitos.map((r) => (
              <li key={r.label} data-ok={r.ok ? "1" : "0"}>
                {r.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                <span>{r.label}<span className="vx-sr">{r.ok ? " (ok)" : " (pendente)"}</span></span>
              </li>
            ))}
          </ul>
          {pendencias.length > 0 && <p className="vx-onb-dica">{t("onb.campaign.missing", { items: pendencias.join(", ") })}</p>}
          {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}

          <div className="vx-onb-acoes">
            <button type="button" className="vx-btn" onClick={concluir} disabled={!dados.caixaOk || publicando}>
              {t("onb.campaign.saveDraft")}
            </button>
            <button type="button" className="vx-btn vx-btn-primary" onClick={publicar} disabled={!dados.caixaOk || publicando || dados.campanha.status === "ativa"}>
              {publicando ? t("onb.campaign.publishing") : t("onb.campaign.publishCampaign")}
            </button>
          </div>
          {!dados.caixaOk && <p className="vx-onb-dica">{t("onb.campaign.buttonsUnlock")}</p>}
        </section>
      )}
    </div>
  );
}
