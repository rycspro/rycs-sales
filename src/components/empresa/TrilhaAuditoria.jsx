import { useEffect, useState } from "react";
import { FileCheck2, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { useI18n } from "../../lib/i18n.jsx";

function buildEventos(t) {
  return {
    envio: t("audit.actionSent"),
    triagem: t("audit.autoTriage"),
    decisao_automatica: t("audit.approvedByRule"),
    decisao_manual: t("audit.humanDecision"),
    contestacao: t("audit.contestation"),
    liberacao: t("audit.transferReleased"),
  };
}

function buildAtores(t) {
  return { empresa: t("audit.actorCompany"), vendedor: t("audit.actorSeller"), admin: t("audit.actorPlatform"), sistema: t("audit.actorSystem") };
}

export default function TrilhaAuditoria({ submissionId }) {
  const { t } = useI18n();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api(`/submissions/${submissionId}/trilha`).then((r) => {
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar a trilha.");
      setDados(r);
    });
  }, [submissionId]);

  const EVENTOS = buildEventos(t);
  const ATORES = buildAtores(t);

  if (erro) return <div className="vx-notice vx-notice-amber" style={{ marginTop: 10 }}>{erro}</div>;
  if (!dados) return <div className="vx-skeleton" style={{ height: 60, marginTop: 10 }} />;

  const integra = dados.integridade?.integra;

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div className="vx-row" style={{ marginBottom: 8 }}>
        <span className="vx-eyebrow">{t("audit.title")}</span>
        <span className={"vx-badge " + (integra ? "vx-badge-brand" : "vx-badge-red")}>
          {integra
            ? <><ShieldCheck size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{t("audit.chainIntact")}</>
            : <><ShieldAlert size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{dados.integridade?.erro || t("audit.chainBroken")}</>}
        </span>
      </div>

      {!dados.eventos.length && (
        <p className="vx-mut" style={{ fontSize: 12 }}>
          {t("audit.legacyNote")}
        </p>
      )}

      {dados.eventos.map((e) => (
        <div key={e.sequencia} style={{ display: "flex", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
          <span className="vx-mono vx-mut" style={{ fontSize: 11, flexShrink: 0, width: 18 }}>{e.sequencia}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5 }}>
              <b>{EVENTOS[e.tipo] || e.tipo}</b>
              {e.statusNovo && <span className="vx-mut"> · {e.statusAnterior ? `${e.statusAnterior} → ` : ""}{e.statusNovo}</span>}
            </div>
            {e.observacao && <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{e.observacao}</div>}
            <div className="vx-mut vx-mono" style={{ fontSize: 10.5, marginTop: 2 }}>
              {ATORES[e.atorRole] || e.atorRole} · {dataCurta(e.criadoEm)}
              {e.dados?.confianca != null && ` · confiança ${e.dados.confianca}%`}
              {e.motivoCodigo && ` · ${e.motivoCodigo}`}
            </div>
          </div>
        </div>
      ))}

      {!!dados.evidencias?.length && (
        <div style={{ marginTop: 9 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 4 }}>
            <FileCheck2 size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
            {t("audit.registeredEvidence")}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {dados.evidencias.map((ev) => (
              <span key={ev.campo} className="vx-chip" title={`Tipo: ${ev.metadados?.tipo || "declaração"} · verificação de conteúdo: ${ev.metadados?.verificacaoDeConteudo || "não disponível"}`}>
                {ev.campo}
                {ev.metadados?.host ? ` · ${ev.metadados.host}` : ""}
              </span>
            ))}
          </div>
          <div className="vx-chart-source">
            A trilha guarda o hash da evidência, não o conteúdo: prova que o dado não mudou sem reexpor telefone e documento a cada consulta.
            Links externos não são baixados pela plataforma.
          </div>
        </div>
      )}
    </div>
  );
}
