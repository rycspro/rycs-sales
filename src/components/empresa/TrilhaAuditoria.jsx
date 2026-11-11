import { useEffect, useState } from "react";
import { FileCheck2, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";

const EVENTOS = {
  envio: "Ação enviada",
  triagem: "Triagem automática",
  decisao_automatica: "Aprovada pela regra da empresa",
  decisao_manual: "Decisão humana",
  contestacao: "Contestação do profissional",
  liberacao: "Repasse liberado pela plataforma",
};

const ATORES = { empresa: "Empresa", vendedor: "Profissional", admin: "Plataforma", sistema: "Sistema" };

export default function TrilhaAuditoria({ submissionId }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api(`/submissions/${submissionId}/trilha`).then((r) => {
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar a trilha.");
      setDados(r);
    });
  }, [submissionId]);

  if (erro) return <div className="vx-notice vx-notice-amber" style={{ marginTop: 10 }}>{erro}</div>;
  if (!dados) return <div className="vx-skeleton" style={{ height: 60, marginTop: 10 }} />;

  const integra = dados.integridade?.integra;

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div className="vx-row" style={{ marginBottom: 8 }}>
        <span className="vx-eyebrow">Trilha de auditoria</span>
        <span className={"vx-badge " + (integra ? "vx-badge-brand" : "vx-badge-red")}>
          {integra
            ? <><ShieldCheck size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Cadeia íntegra</>
            : <><ShieldAlert size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{dados.integridade?.erro || "Cadeia rompida"}</>}
        </span>
      </div>

      {!dados.eventos.length && (
        <p className="vx-mut" style={{ fontSize: 12 }}>
          Esta ação é anterior à trilha encadeada. Ações enviadas a partir de agora registram cada decisão.
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
            Evidências registradas
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
