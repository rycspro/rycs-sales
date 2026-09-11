import { useState, useEffect, useMemo } from "react";
import { Sparkles, Check } from "lucide-react";
import { apiPatch } from "../../lib/api.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { calcularValorTarefa, sugerirValores, impactoNoRoi } from "../../../shared/valorTarefa.js";
import { metricasEmpresa } from "../../../shared/analytics.js";
import { money } from "../../lib/utils.js";

export default function TabelaEmpresa({ emp, db, up, aviso }) {
  const [v, setV] = useState(emp.comissoes);
  const [premissas, setPremissas] = useState({ ticketMedio: "", margem: "30", conversao: "" });
  useEffect(() => setV(emp.comissoes), [emp.id]);

  // O histórico da própria empresa tem prioridade sobre o que for digitado:
  // o que já aconteceu vale mais que a estimativa de quem está estimando.
  const historico = useMemo(() => metricasEmpresa({
    submissions: db?.submissions || [], campaigns: db?.campaigns || [],
    leads: db?.leads || [], companyId: emp.id, filtros: {},
  }), [db, emp.id]);

  const sugestao = useMemo(() => sugerirValores({
    ticketMedio: Number(String(premissas.ticketMedio).replace(",", ".")),
    margem: Number(premissas.margem) / 100,
    conversaoReuniaoVenda: Number(String(premissas.conversao).replace(",", ".")) / 100,
    historico,
    plano: emp.assinatura,
  }), [premissas, historico, emp.assinatura]);

  const impacto = useMemo(() => sugestao.disponivel
    ? impactoNoRoi({
        tarefas: sugestao.tarefas,
        metaAgendadas: Math.max(20, historico.agendadas || 20),
        ticketMedio: sugestao.premissas.ticket,
        conversao: sugestao.premissas.conversao,
        comparecimento: sugestao.premissas.comparecimento || 1,
      })
    : null, [sugestao, historico]);

  const aplicar = () => {
    setV((atual) => ({ ...atual, ...Object.fromEntries(sugestao.tarefas.map((t) => [t.tipo, t.bruto])) }));
    aviso("Sugestão preenchida na tabela. Revise e salve — nada foi alterado ainda.");
  };
  const salvar = () => {
    const limpo = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(String(x).replace(",", ".")) || 0]));
    apiPatch(`/companies/${emp.id}`, { comissoes: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, comissoes: limpo } : c) }));
    aviso("Tabela atualizada. Vale para as próximas ações.");
  };
  return (
    <>
      <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
        Você define quanto vale cada ação. Reunião agendada e venda são as duas fontes principais da plataforma —
        as outras servem de combustível para elas.
      </p>
      <div className="vx-card" style={{ padding: 18 }}>
        {ORDEM_ACOES.map((k) => (
          <div key={k} className="vx-row" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <b style={{ fontSize: 13.5 }}>{ACOES[k].nome}</b>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>{ACOES[k].regra}</div>
            </div>
            <div style={{width:150,flex:"none"}}><input className="vx-input vx-mono" style={{ textAlign: "right" }} value={v[k] ?? ""} inputMode="decimal" aria-label={`Valor bruto de ${ACOES[k].nome}`}
              onChange={(e) => setV({ ...v, [k]: e.target.value })} /><div className="vx-mut" style={{fontSize:10.5,textAlign:"right",marginTop:3}}>Profissional recebe {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(calcularValorTarefa(Number(String(v[k]||0).replace(",",".")),emp.assinatura).liquido)}</div></div>
          </div>
        ))}
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }} onClick={salvar}>Salvar tabela</button>
        <div className="vx-chart-source">Taxa real do plano: {Math.round(calcularValorTarefa(100,emp.assinatura).percentual*100)}%. Fórmula: líquido = valor bruto - taxa da plataforma. O cálculo é exibido antes da confirmação e não altera valores automaticamente.</div>
      </div>

      <div className="vx-card" style={{ padding: 18, marginTop: 16 }}>
        <div className="vx-eyebrow">Cálculo determinístico</div>
        <h3 className="vx-disp" style={{ fontSize: 17, margin: "3px 0 10px" }}>
          <Sparkles size={15} style={{ verticalAlign: -2, marginRight: 5 }} />
          Sugestão de valores
        </h3>

        <div className="vx-grid vx-g3">
          <label><div className="vx-label">Ticket médio (R$)</div>
            <input className="vx-input vx-mono" inputMode="decimal" placeholder="3000"
              value={premissas.ticketMedio} onChange={(e) => setPremissas({ ...premissas, ticketMedio: e.target.value })} /></label>
          <label><div className="vx-label">Margem (%)</div>
            <input className="vx-input vx-mono" inputMode="decimal"
              value={premissas.margem} onChange={(e) => setPremissas({ ...premissas, margem: e.target.value })} /></label>
          <label><div className="vx-label">Conversão reunião → venda (%)</div>
            <input className="vx-input vx-mono" inputMode="decimal"
              placeholder={historico.realizadas ? `histórico: ${(historico.vendas / historico.realizadas * 100).toFixed(0)}` : "informe"}
              value={premissas.conversao} onChange={(e) => setPremissas({ ...premissas, conversao: e.target.value })}
              disabled={historico.realizadas > 0} /></label>
        </div>

        {!sugestao.disponivel ? (
          <div className="vx-notice vx-notice-amber" style={{ marginTop: 14 }}>
            Falta: {sugestao.ausentes.join(", ")}. {sugestao.motivo}
          </div>
        ) : <>
          <div className="vx-table-wrap" style={{ marginTop: 14 }}>
            <table className="vx-table">
              <thead><tr>
                <th>Tarefa</th>
                <th style={{ textAlign: "right" }}>Sugerido</th>
                <th style={{ textAlign: "right" }}>Taxa</th>
                <th style={{ textAlign: "right" }}>Profissional recebe</th>
                <th style={{ textAlign: "right" }}>Faixa</th>
              </tr></thead>
              <tbody>
                {sugestao.tarefas.map((t) => (
                  <tr key={t.tipo}>
                    <td><b style={{ fontSize: 13 }}>{ACOES[t.tipo]?.nome || t.tipo}</b></td>
                    <td className="vx-mono" style={{ textAlign: "right" }}>{money(t.bruto)}</td>
                    <td className="vx-mono vx-mut" style={{ textAlign: "right" }}>−{money(t.taxa)}</td>
                    <td className="vx-mono" style={{ textAlign: "right", color: "var(--brand)" }}>{money(t.liquido)}</td>
                    <td className="vx-mono vx-mut" style={{ textAlign: "right" }}>{money(t.minimo)} – {money(t.maximo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
            <div>
              <div className="vx-eyebrow" style={{ marginBottom: 5 }}>Fatores considerados</div>
              <ul className="vx-mut" style={{ fontSize: 12, paddingLeft: 16, margin: 0 }}>
                {sugestao.fatores.map((f, i) => <li key={i} style={{ marginBottom: 3 }}>{f}</li>)}
              </ul>
            </div>
            <div>
              <div className="vx-eyebrow" style={{ marginBottom: 5 }}>Fontes · confiança {sugestao.confianca}</div>
              {sugestao.fontes.map((f, i) => (
                <div key={i} className="vx-mut" style={{ fontSize: 12, marginBottom: 3 }}>
                  <b>{f.nome}</b> — {f.detalhe}
                </div>
              ))}
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>Amostra: {sugestao.amostra} registro(s).</div>
            </div>
          </div>

          {impacto && (
            <div className="vx-notice" style={{ marginTop: 14 }}>
              <b>Efeito no investimento e no ROI</b>
              <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>
                Com {impacto.agendadas} reuniões agendadas: {impacto.realizadas} realizadas, {impacto.vendas} venda(s).
                Investimento {money(impacto.investimento)} · receita {money(impacto.receita)}
                {impacto.roi != null && <> · ROI <b>{impacto.roi.toFixed(1)}%</b></>}
                {impacto.custoPorVenda != null && <> · custo por venda {money(impacto.custoPorVenda)}</>}
              </div>
            </div>
          )}

          <button className="vx-btn" style={{ marginTop: 14 }} onClick={aplicar}>
            <Check size={14} /> Preencher a tabela com a sugestão
          </button>
          <div className="vx-chart-source">
            A sugestão não altera nada sozinha: ela preenche os campos acima para você aceitar, editar ou ignorar.
            Não chamamos isso de valor de mercado — não há fonte externa auditável para essa afirmação aqui.
          </div>
        </>}
      </div>
    </>
  );
}
