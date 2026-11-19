import { Handshake, Copy, Building2, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { money, dataCurta } from "../lib/utils.js";
import { ROTAS } from "../lib/rotas.js";
import { TIPOS_COMISSAO_CANAL, STATUS_COMISSAO_CANAL } from "../../shared/parceriaCanal.js";

// Painel do parceiro de canal (dentro de Indicar). Mostra só dados reais da
// carteira dele: nada de projeção aqui — projeção mora na proposta.
const reais = (cents) => money((Number(cents) || 0) / 100);

function Numero({ rotulo, valor, Icon, destaque }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", display: "grid", gap: 2, minWidth: 0 }}>
      <div className="vx-mut" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} /> {rotulo}</div>
      <div className="vx-mono" style={{ fontSize: 20, fontWeight: 700, color: destaque ? "var(--brand)" : "var(--ink)" }}>{valor}</div>
    </div>
  );
}

export default function ParceriaCanal({ p, aviso }) {
  const link = `${window.location.origin}${ROTAS.onboarding}?ref=${p.codigo}`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); aviso("Link copiado."); }
    catch { aviso("Não foi possível copiar. Selecione e copie manualmente."); }
  };
  const prox = p.proximoNivel;

  return (
    <div className="vx-card" style={{ padding: 20, marginBottom: 18, borderTop: "3px solid var(--brand)" }}>
      <div className="vx-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Handshake size={14} /> Parceria de canal</div>
      <h2 className="vx-disp" style={{ fontSize: 22, margin: "6px 0 4px" }}>
        {p.recorrenciaFixa ? "Recorrência" : `Nível ${p.nivel.nome}`} · {p.percentuais.recorrencia}% todo mês
      </h2>
      <p className="vx-mut" style={{ fontSize: 13.5, margin: "0 0 14px", maxWidth: 640 }}>
        Você ganha {p.percentuais.fechamento}% da primeira mensalidade de cada empresa, {p.percentuais.recorrencia}% das mensalidades seguintes
        e {p.percentuais.uso}% da taxa de uso das campanhas, enquanto a empresa pagar. Cada comissão é liberada para saque no 1º dia do mês seguinte ao pagamento.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Numero Icon={Building2} rotulo="Empresas pagantes" valor={`${p.pagantes} de ${p.empresasNaCarteira}`} />
        <Numero Icon={TrendingUp} rotulo="Gerado este mês" valor={reais(p.totais.mesCents)} destaque />
        <Numero Icon={Clock} rotulo="Aguardando liberação" valor={reais(p.totais.pendenteCents)} />
        <Numero Icon={CheckCircle2} rotulo="Liberado até hoje" valor={reais(p.totais.liberadoCents)} />
      </div>

      {prox && (
        <div className="vx-mut" style={{ fontSize: 13, marginBottom: 14 }}>
          Faltam <b style={{ color: "var(--ink)" }}>{prox.faltam}</b> empresa{prox.faltam === 1 ? "" : "s"} pagante{prox.faltam === 1 ? "" : "s"} para o nível {prox.nome} ({prox.pct}% para a carteira toda).
        </div>
      )}

      <label style={{ display: "block", marginBottom: 18 }}>
        <div className="vx-label">Seu link para empresas</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="vx-input vx-mono" readOnly value={link} onFocus={(e) => e.target.select()} style={{ minWidth: 0, flex: 1, fontSize: 12.5 }} />
          <button type="button" className="vx-btn" onClick={copiar} style={{ minHeight: 44 }}><Copy size={14} /> Copiar</button>
        </div>
      </label>

      <h3 className="vx-disp" style={{ fontSize: 15, margin: "0 0 8px" }}>Sua carteira</h3>
      {!p.empresas.length ? (
        <div className="vx-mut" style={{ fontSize: 13, padding: "10px 0 4px" }}>Nenhuma empresa ainda. As empresas que se cadastrarem pelo seu link aparecem aqui.</div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, fontSize: 13 }}>
            <thead>
              <tr>
                {["Empresa", "Plano", "Situação", "Comissão gerada"].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "var(--surface-2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.empresas.map((e) => (
                <tr key={e.companyId || e.desde} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 600 }}>{e.nome}</td>
                  <td style={{ padding: "9px 12px" }}>{e.plano || "—"}</td>
                  <td style={{ padding: "9px 12px", color: e.pagante ? "var(--green-700)" : "var(--muted)" }}>{e.pagante ? "Pagante" : "Sem plano ativo"}</td>
                  <td style={{ padding: "9px 12px" }} className="vx-mono">{reais(e.comissaoCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.ultimas.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 15, margin: "0 0 8px" }}>Últimas comissões</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {p.ultimas.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <div style={{ minWidth: 0 }}>
                  <b>{c.empresa || "Empresa"}</b> · {TIPOS_COMISSAO_CANAL[c.tipo] || c.tipo} ({c.percentualSnapshot}%)
                  <div className="vx-mut" style={{ fontSize: 12 }}>
                    {dataCurta(c.criadoEm)} · {STATUS_COMISSAO_CANAL[c.status] || c.status}
                    {c.status === "pendente" && c.disponivelEm ? ` · libera em ${dataCurta(c.disponivelEm)}` : ""}
                  </div>
                </div>
                <span className="vx-mono" style={{ fontWeight: 700, textDecoration: ["cancelada", "estornada"].includes(c.status) ? "line-through" : "none" }}>{reais(c.comissaoCents)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
