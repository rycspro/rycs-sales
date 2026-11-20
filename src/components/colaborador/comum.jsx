// Peças de interface usadas pelo admin e pela área do colaborador.
import { dataCurta } from "../../lib/utils.js";
import { DIAS_SEMANA, formatarCents, dataBRFormatada, TIPOS_LANCAMENTO, TIPOS_AUSENCIA } from "../../../shared/colaboradores.js";

export const ALVO = { minHeight: 44 };

export const SITUACAO = {
  presente: { txt: "Trabalhado", cor: "var(--brand)" }, parcial: { txt: "Parcial", cor: "var(--amber)" },
  ausente: { txt: "Sem atividade", cor: "var(--red)" }, justificada: { txt: "Justificado", cor: "var(--indigo)" },
  feriado: { txt: "Feriado", cor: "var(--muted)" }, folga: { txt: "Folga", cor: "var(--muted)" },
  extra: { txt: "Fora dos dias previstos", cor: "var(--indigo)" }, em_andamento: { txt: "Em andamento", cor: "var(--muted)" },
};
export const TENDENCIA = { subindo: "Subindo", caindo: "Caindo", estavel: "Estável", sem_base: "Sem base ainda" };

export function Num({ label, valor, sub }) {
  return (
    <div className="vx-card" style={{ padding: 14 }}>
      <div className="vx-eyebrow" style={{ margin: 0 }}>{label}</div>
      <div className="vx-disp vx-mono" style={{ fontSize: 22, marginTop: 6 }}>{valor}</div>
      {sub && <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function PainelResumo({ p, formula }) {
  return (
    <>
      <div className="vx-g4" style={{ gap: 10, marginBottom: 12 }}>
        <Num label="Nota" valor={p.nota ?? "—"} sub={p.faixa || "Sem dados no período"} />
        <Num label="Presença" valor={p.presenca != null ? `${p.presenca}%` : "—"} sub={p.medirPresenca ? `${p.presentes} de ${p.previstos} dias · ${p.ausentes} sem atividade` : "Não medida: mede entregas"} />
        <Num label="Tarefas" valor={p.feitas} sub={p.meta ? `meta do período: ${p.meta}` : p.metaInfo?.status === "calibrando" ? "meta em calibração" : "sem meta"} />
        <Num label="Aprovação" valor={p.taxaAprovacao != null ? `${p.taxaAprovacao}%` : "—"} sub={`Tendência: ${TENDENCIA[p.tendencia]}`} />
      </div>
      {formula && <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 12px" }}>{formula}</p>}
      {p.alertas?.length > 0 && <div className="vx-notice vx-notice-amber" role="status" style={{ marginBottom: 12 }}>{p.alertas.map((a) => <div key={a.tipo}>{a.texto}</div>)}</div>}
    </>
  );
}

export function ListaDias({ dias, onContestar }) {
  const mostrar = dias.slice().reverse().filter((x) => x.situacao !== "folga" || x.envios);
  if (!mostrar.length) return null;
  return (
    <div className="vx-table-wrap" style={{ marginBottom: 16 }}>
      <table className="vx-table" style={{ minWidth: 0 }}>
        <thead><tr><th scope="col">Dia</th><th scope="col">Situação</th><th scope="col">Envios</th>{onContestar && <th scope="col" aria-label="Ação" />}</tr></thead>
        <tbody>{mostrar.map((x) => (
          <tr key={x.data}>
            <td>{dataBRFormatada(x.data)} <span className="vx-mut">{DIAS_SEMANA[new Date(`${x.data}T12:00:00Z`).getUTCDay()].slice(0, 3)}</span></td>
            <td style={{ color: SITUACAO[x.situacao]?.cor }}>{SITUACAO[x.situacao]?.txt}{x.motivo ? ` (${TIPOS_AUSENCIA[x.motivo] || x.motivo})` : ""}</td>
            <td className="vx-mono">{x.envios}</td>
            {onContestar && <td>{x.situacao === "ausente" && <button className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={() => onContestar(x.data)}>Contestar</button>}</td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function TabelaExtrato({ ex }) {
  return (
    <>
      <div className="vx-g4" style={{ gap: 10, marginBottom: 12 }}>
        <Num label="Fixo (informativo)" valor={formatarCents(ex.fixoCents)} sub={ex.vinculo === "clt" ? "pago pela folha" : ""} />
        <Num label="Variável lançado" valor={formatarCents(ex.variavelCents)} sub={ex.tetoCents ? `teto ${formatarCents(ex.tetoCents)}` : ""} />
        <Num label="Previsto" valor={formatarCents(ex.previstoCents)} sub="provas aguardando revisão" />
        <Num label="Pagamento" valor={ex.pagamento === "folha" ? "Folha" : ex.pagamento === "saque" ? "Saque" : "Fechamento"} sub={ex.fechado ? "mês fechado" : "mês aberto"} />
      </div>
      {ex.excedenteCents > 0 && <div className="vx-notice vx-notice-amber" style={{ marginBottom: 10 }}>{formatarCents(ex.excedenteCents)} acima do teto mensal não são devidos.</div>}
      {!ex.lancamentos.length ? <p className="vx-mut" style={{ fontSize: 13 }}>Nenhum lançamento neste mês.</p> : (
        <div className="vx-table-wrap">
          <table className="vx-table" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Data</th><th scope="col">Tipo</th><th scope="col">Descrição</th><th scope="col" style={{ textAlign: "right" }}>Valor</th></tr></thead>
            <tbody>{ex.lancamentos.map((l) => (
              <tr key={l.id}><td>{dataCurta(l.criadoEm)}</td><td>{TIPOS_LANCAMENTO[l.tipo] || l.tipo}</td><td>{l.descricao}{l.motivo ? ` — ${l.motivo}` : ""}</td>
                <td className="vx-mono" style={{ textAlign: "right", color: l.valorCents < 0 ? "var(--red)" : undefined }}>{formatarCents(l.valorCents)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function DiasPrevistos({ valor, onChange }) {
  const alternar = (d) => onChange(valor.includes(d) ? valor.filter((x) => x !== d) : [...valor, d].sort());
  return (
    <fieldset style={{ border: 0, padding: 0, margin: "4px 0 10px" }}>
      <legend className="vx-label">Dias de trabalho previstos</legend>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {DIAS_SEMANA.map((nome, i) => (
          <label key={i} className="vx-chip" style={{ display: "inline-flex", minHeight: 44, cursor: "pointer", gap: 6 }}>
            <input type="checkbox" checked={valor.includes(i)} onChange={() => alternar(i)} /> {nome}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
