import { useEffect, useState } from "react";
import { AlertTriangle, Gauge, Percent, ShieldCheck, Wallet } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";

// A empresa configura o que pode ser conferido sozinho. A tela é explícita
// sobre o limite dessa automação: ela dispensa a conferência da empresa, nunca
// o repasse da plataforma.
export default function RegrasAprovacao({ aviso }) {
  const [dados, setDados] = useState(null);
  const [regras, setRegras] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api("/company/approval-rules").then((r) => {
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar as regras.");
      setDados(r);
      setRegras(r.regras);
    });
  }, []);

  const salvar = async () => {
    setSalvando(true);
    const r = await apiPatch("/company/approval-rules", regras);
    setSalvando(false);
    if (r?.error) return aviso?.(r.error);
    setRegras(r.regras);
    aviso?.("Regras salvas. Valem para as próximas ações enviadas.");
  };

  if (erro) return <div className="vx-notice vx-notice-amber">{erro}</div>;
  if (!regras) return <div className="vx-card" style={{ padding: 18 }}><div className="vx-skeleton" style={{ height: 22 }} /></div>;

  const alternarTipo = (t) => setRegras((r) => ({
    ...r,
    tipos: r.tipos.includes(t) ? r.tipos.filter((x) => x !== t) : [...r.tipos, t],
  }));

  const elegiveis = ORDEM_ACOES.filter((t) => !dados.sempreManual.includes(t));

  return (
    <div className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row">
        <div>
          <div className="vx-eyebrow">Conferência sem intervenção</div>
          <h3 className="vx-disp" style={{ fontSize: 17, margin: "3px 0" }}>Aprovação automática</h3>
        </div>
        <label className="vx-chip" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={regras.ativo}
            onChange={(e) => setRegras({ ...regras, ativo: e.target.checked })}
            style={{ marginRight: 6 }}
          />
          {regras.ativo ? "Ligada" : "Desligada"}
        </label>
      </div>

      <div className="vx-notice" style={{ marginTop: 10 }}>
        <ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        A regra substitui apenas a <b>sua</b> conferência: a ação vai direto para “conferida”.
        O repasse do dinheiro continua passando pela plataforma, como em qualquer ação conferida à mão.
      </div>

      <div style={{ marginTop: 16, opacity: regras.ativo ? 1 : .55, pointerEvents: regras.ativo ? "auto" : "none" }}>
        <div className="vx-label">Ações elegíveis</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 6 }}>
          {elegiveis.map((t) => {
            const a = dados.amostra.porTipo[t] || {};
            return (
              <button
                key={t}
                type="button"
                className={"vx-chip" + (regras.tipos.includes(t) ? " vx-badge-brand" : "")}
                onClick={() => alternarTipo(t)}
                title={a.total ? `${a.total} envio(s) em 30 dias · confiança média ${a.confiancaMedia}% · maior valor ${money(a.valorMaximo)}` : "Sem envios nos últimos 30 dias"}
                style={{ cursor: "pointer", borderColor: regras.tipos.includes(t) ? "var(--brand)" : "var(--border)" }}
              >
                {ACOES[t]?.nome || t}
                {a.total ? <span className="vx-mut" style={{ marginLeft: 5 }}>· {a.total}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="vx-chart-source">
          {dados.sempreManual.map((t) => ACOES[t]?.nome || t).join(", ")} nunca entra na automação:
          move o maior valor da plataforma e é o alvo mais provável de fraude.
        </div>

        <div className="vx-grid vx-g3" style={{ marginTop: 14 }}>
          <label>
            <div className="vx-label"><Gauge size={12} style={{ verticalAlign: -2 }} /> Confiança mínima</div>
            <input
              className="vx-input vx-mono" type="number" min="50" max="100"
              value={regras.confiancaMinima}
              onChange={(e) => setRegras({ ...regras, confiancaMinima: e.target.value })}
            />
            <div className="vx-mut" style={{ fontSize: 11, marginTop: 3 }}>Abaixo disso vai para revisão humana.</div>
          </label>
          <label>
            <div className="vx-label"><Wallet size={12} style={{ verticalAlign: -2 }} /> Teto por ação (R$)</div>
            <input
              className="vx-input vx-mono" type="number" min="0" step="0.01"
              value={regras.valorMaximo}
              onChange={(e) => setRegras({ ...regras, valorMaximo: e.target.value })}
            />
            <div className="vx-mut" style={{ fontSize: 11, marginTop: 3 }}>Acima do teto, sempre humano. Zero desliga o teto.</div>
          </label>
          <label>
            <div className="vx-label"><Percent size={12} style={{ verticalAlign: -2 }} /> Amostragem manual</div>
            <input
              className="vx-input vx-mono" type="number" min="0" max="100"
              value={regras.amostragem}
              onChange={(e) => setRegras({ ...regras, amostragem: e.target.value })}
            />
            <div className="vx-mut" style={{ fontSize: 11, marginTop: 3 }}>% das elegíveis que continua sendo conferida à mão.</div>
          </label>
        </div>

        {regras.amostragem === 0 && (
          <div className="vx-notice vx-notice-amber" style={{ marginTop: 12 }}>
            <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            Com amostragem em zero, nenhuma ação aprovada sozinha será olhada por uma pessoa.
            Um erro de regra só apareceria quando já tivesse virado prejuízo.
          </div>
        )}
      </div>

      <button className="vx-btn vx-btn-primary" style={{ marginTop: 16 }} disabled={salvando} onClick={salvar}>
        {salvando ? "Salvando…" : "Salvar regras"}
      </button>
      <div className="vx-chart-source">
        Toda decisão — automática ou humana — entra na trilha de auditoria com regra, confiança, responsável e data.
        Amostra dos últimos 30 dias: {dados.amostra.total} ação(ões) enviada(s).
      </div>
    </div>
  );
}
