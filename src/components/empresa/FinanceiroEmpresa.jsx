import { useEffect, useMemo, useState } from "react";
import { Download, Landmark, Lock, Receipt, TrendingDown, Wallet } from "lucide-react";
import { api, API_URL } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { Stat, Vazio, Donut } from "../ui.jsx";
import { ACOES } from "../../lib/constants.js";

// Nomes que a empresa entende. O razão guarda o tipo técnico do movimento;
// traduzir aqui mantém o banco estável e a tela legível.
const MOVIMENTOS = {
  deposito: { nome: "Depósito", tom: "brand", sinal: "entrada" },
  reserva: { nome: "Reserva de ação", tom: "amber", sinal: "bloqueio" },
  estorno_reserva: { nome: "Reserva devolvida", tom: "muted", sinal: "liberação" },
  liquidacao: { nome: "Ação liberada", tom: "red", sinal: "saída" },
};

export default function FinanceiroEmpresa({ emp, db, aviso }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState({ dias: "30", tipo: "", campaignId: "" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filtros.dias) p.set("dias", filtros.dias);
    if (filtros.tipo) p.set("tipo", filtros.tipo);
    if (filtros.campaignId) p.set("campaignId", filtros.campaignId);
    return p.toString();
  }, [filtros]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    api(`/company/finance?${query}`).then((r) => {
      if (!ativo) return;
      setCarregando(false);
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar o financeiro.");
      setDados(r);
    });
    return () => { ativo = false; };
  }, [query]);

  const exportar = () => {
    // O download precisa do cookie de sessão, então vai pelo próprio
    // navegador em vez de fetch — o arquivo chega direto na pasta do usuário.
    window.open(`${API_URL}/api/company/finance/export?${query}`, "_blank");
    aviso?.("Extrato exportado em CSV.");
  };

  const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
  const posicao = dados?.posicao || { saldo: 0, reservado: 0, disponivel: 0 };
  const resumo = dados?.resumo || { depositado: 0, utilizado: 0, taxas: 0, repassado: 0, movimentos: 0 };

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Caixa e razão</div>
          <h1 className="vx-disp">Financeiro</h1>
          <p>Valores vindos do motor financeiro determinístico. Cada linha aponta a tarefa, a campanha e o profissional que a originaram.</p>
        </div>
        <button className="vx-btn" onClick={exportar} disabled={!dados?.extrato?.length}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <div className="vx-grid vx-g3" style={{ marginTop: 4 }}>
        <label>
          <span className="vx-label">Período</span>
          <select className="vx-input" value={filtros.dias} onChange={(e) => setFiltros({ ...filtros, dias: e.target.value })}>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="">Todo período</option>
          </select>
        </label>
        <label>
          <span className="vx-label">Movimento</span>
          <select className="vx-input" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
            <option value="">Todos os movimentos</option>
            {Object.entries(MOVIMENTOS).map(([k, m]) => <option key={k} value={k}>{m.nome}</option>)}
          </select>
        </label>
        <label>
          <span className="vx-label">Campanha</span>
          <select className="vx-input" value={filtros.campaignId} onChange={(e) => setFiltros({ ...filtros, campaignId: e.target.value })}>
            <option value="">Todas as campanhas</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        </label>
      </div>

      <div className="vx-grid vx-g3" style={{ marginTop: 16 }}>
        <Stat label="Disponível" value={money(posicao.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label="Reservado em ações" value={money(posicao.reservado)} Icon={Lock} tone="amber" />
        <Stat label="Saldo em caixa" value={money(posicao.saldo)} Icon={Landmark} tone="muted" />
      </div>

      <div className="vx-grid vx-g4" style={{ marginTop: 12 }}>
        <Stat label="Depositado no período" value={money(resumo.depositado)} Icon={Landmark} tone="brand" />
        <Stat label="Utilizado no período" value={money(resumo.utilizado)} Icon={TrendingDown} tone="red" />
        <Stat label="Taxa da plataforma" value={money(resumo.taxas)} Icon={Receipt} tone="amber" />
        <Stat label="Repassado a profissionais" value={money(resumo.repassado)} Icon={Wallet} tone="muted" />
      </div>

      {(resumo.taxas > 0 || resumo.repassado > 0) && (
        <div style={{ marginTop: 16 }}>
          <Donut
            titulo="Para onde foi o valor utilizado"
            centro={money(resumo.utilizado)}
            formatar={money}
            itens={[
              { nome: "Repassado ao profissional", valor: resumo.repassado, cor: "var(--brand)" },
              { nome: "Taxa da plataforma", valor: resumo.taxas, cor: "var(--amber)" },
            ]}
          />
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div className="vx-row" style={{ marginBottom: 10 }}>
          <h2 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Extrato</h2>
          <span className="vx-chip vx-mono">{resumo.movimentos} movimento{resumo.movimentos === 1 ? "" : "s"}</span>
        </div>

        {carregando && <div className="vx-card" style={{ padding: 18 }}><div className="vx-skeleton" style={{ height: 18, marginBottom: 9 }} /><div className="vx-skeleton" style={{ height: 18, marginBottom: 9 }} /><div className="vx-skeleton" style={{ height: 18 }} /></div>}

        {!carregando && erro && <div className="vx-notice vx-notice-amber">{erro}</div>}

        {!carregando && !erro && !dados?.extrato?.length && (
          <Vazio
            titulo="Nenhum movimento no filtro"
            texto="Depósitos, reservas e liberações de ação aparecem aqui assim que acontecerem. Amplie o período ou limpe os filtros."
          />
        )}

        {!carregando && !erro && !!dados?.extrato?.length && (
          <div className="vx-table-wrap">
            <table className="vx-table">
              <thead>
                <tr>
                  <th>Data</th><th>Movimento</th><th>Origem</th>
                  <th style={{ textAlign: "right" }}>Bruto</th>
                  <th style={{ textAlign: "right" }}>Taxa</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.extrato.map((l) => {
                  const m = MOVIMENTOS[l.tipo] || { nome: l.tipo, tom: "muted" };
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
          Reserva bloqueia o valor quando a ação é enviada; a liberação debita o caixa e repassa o líquido ao profissional.
          Nenhum valor desta tela é calculado no navegador.
        </div>
      </div>
    </div>
  );
}
