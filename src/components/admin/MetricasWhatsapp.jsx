import { dataCurta } from "../../lib/utils.js";

// Desempenho do WhatsApp: o mesmo painel dos e-mails, com o que a Meta informa.
const pctTxt = (v) => (v == null ? "—" : `${String(v).replace(".", ",")}%`);
const KPIS = [
  ["enviados", "Enviados", null, ""],
  ["taxaEntrega", "Entrega", "entregues", "entregues"],
  ["taxaLeitura", "Leitura", "lidos", "leram"],
  ["taxaResposta", "Respostas", "responderam", "responderam"],
  ["taxaFalha", "Falhas", "falhas", "falharam"],
  ["taxaSaida", "Pediram para sair", "saidas", "saíram"],
];

const caixa = { border: "1px solid var(--border)", borderRadius: 10, padding: 12 };

export default function MetricasWhatsapp({ m }) {
  if (!m) return null;
  const r = m.recebidas;
  return (
    <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="vx-disp" style={{ fontSize: 15 }}>Desempenho do WhatsApp</div>
      <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
        Tudo o que saiu pelo número oficial: disparos do admin e reativação de empresas. Leitura e respostas são sobre as entregues.
        Leitura é aproximada: quem desligou a confirmação de leitura nunca aparece como lido. A Meta não informa cliques nos botões de link.
        Respostas contam quem tocou num botão ou escreveu em até 3 dias, sem os pedidos para sair.
        {m.ultimoAviso ? ` Último aviso da Meta: ${dataCurta(m.ultimoAviso)}.` : ""}
      </div>

      {m.semAvisoDaMeta && (
        <div role="alert" style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid var(--amber)", fontSize: 12.5, lineHeight: 1.6 }}>
          <b>Nenhum aviso de entrega ou leitura chegou da Meta</b> para as mensagens enviadas. Sem esses avisos, entrega, leitura e falhas ficam zeradas
          e o disparo não percebe bloqueios. Confira no painel da Meta se o app RYCS está publicado (fora do modo de desenvolvimento).
        </div>
      )}
      {m.bloqueioRecente && (
        <div role="alert" style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid var(--red)", fontSize: 12.5, lineHeight: 1.6 }}>
          <b>A Meta avisou nas últimas 24h que está limitando o número</b> porque muitas mensagens foram bloqueadas ou denunciadas.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 10, marginTop: 14 }}>
        {KPIS.map(([k, rotulo, qtd, verbo]) => (
          <div key={k} style={caixa}>
            <div className="vx-mut" style={{ fontSize: 12 }}>{rotulo}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{k === "enviados" ? m.total.enviados : pctTxt(m.total[k])}</div>
            {qtd && <div className="vx-mut" style={{ fontSize: 11.5 }}>{m.total[qtd]} {verbo}</div>}
          </div>
        ))}
        <div style={caixa}>
          <div className="vx-mut" style={{ fontSize: 12 }}>Recebidas</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{r.mensagens}</div>
          <div className="vx-mut" style={{ fontSize: 11.5 }}>de {r.pessoas} {r.pessoas === 1 ? "pessoa" : "pessoas"}</div>
        </div>
      </div>

      {m.modelos.length === 0 ? (
        <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 14 }}>Nenhuma mensagem enviada pelo número ainda.</div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "right", color: "var(--muted)" }}>
                <th scope="col" style={{ textAlign: "left", padding: "6px 8px" }}>Modelo</th>
                {KPIS.map(([k, rotulo]) => <th key={k} scope="col" style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{rotulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {m.modelos.map((x) => (
                <tr key={`${x.modelo}|${x.idioma}`} style={{ borderTop: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  <th scope="row" style={{ textAlign: "left", fontWeight: 500, padding: "8px", whiteSpace: "nowrap" }}>
                    {x.modelo} <span className="vx-mut" style={{ fontSize: 11.5 }}>{x.idioma} · {x.origem}</span>
                  </th>
                  {KPIS.map(([c]) => <td key={c} style={{ padding: "8px" }}>{c === "enviados" ? x.enviados : pctTxt(x[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {m.errosMaisComuns.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12.5 }}>
          <b>Falhas mais comuns</b>
          {m.errosMaisComuns.map((e) => (
            <div key={e.erro} className="vx-row" style={{ gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.erro}</span>
              <span className="vx-mono">{e.n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
