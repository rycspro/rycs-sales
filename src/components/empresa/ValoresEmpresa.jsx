import { useEffect, useMemo, useState } from "react";
import { Archive, CircleDollarSign, Download, FileText, Megaphone, TrendingUp, User, Wallet } from "lucide-react";
import { api, API_URL, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { sugerirValores, impactoNoRoi } from "../../../shared/valorTarefa.js";
import { metricasEmpresa } from "../../../shared/analytics.js";
import { money as moneyLib, dataCurta } from "../../lib/utils.js";


function formatarBRL(valor) {
  if (!valor && valor !== 0) return "";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(str) {
  if (!str) return 0;
  return Number(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

function OrcamentoCampanhas({ campanhas }) {
  const ativas = campanhas.filter((c) => c.status === "ativa" || c.status === "rascunho");
  const totalOrcado = ativas.reduce((acc, c) => acc + Number(c.orcamento || 0), 0);

  return (
    <div>
      <div className="vx-grid vx-g4" style={{ marginBottom: 18 }}>
        {[
          ["Campanhas ativas", campanhas.filter((c) => c.status === "ativa").length.toLocaleString("pt-BR"), Megaphone],
          ["Total orçado", money(totalOrcado), Wallet],
          ["Campanhas rascunho", campanhas.filter((c) => c.status === "rascunho").length.toLocaleString("pt-BR"), FileText],
          ["Campanhas encerradas", campanhas.filter((c) => c.status === "encerrada" || c.status === "pausada").length.toLocaleString("pt-BR"), Archive],
        ].map(([label, val, Icon]) => (
          <div key={label} className="vx-glass-panel vx-tile">
            <div className="vx-tile-top">
              <span>{label}</span>
              <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <div className="vx-tile-val">{val}</div>
          </div>
        ))}
      </div>

      {campanhas.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Wallet size={26} color="var(--muted)" style={{ marginBottom: 8 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>Nenhuma campanha criada</div>
          <div className="vx-mut" style={{ fontSize: 13 }}>Crie uma campanha para ver os orçamentos aqui.</div>
        </div>
      ) : (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Orçamento</th>
                <th style={{ textAlign: "right" }}>Vagas</th>
                <th>Região</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.titulo}</td>
                  <td><span className={`vx-campaign-status is-${c.status}`} style={{ fontSize: 11 }}>{c.status}</span></td>
                  <td className="vx-mono" style={{ textAlign: "right" }}>{c.orcamento > 0 ? money(c.orcamento) : <span className="vx-mut">Sem limite</span>}</td>
                  <td className="vx-mono" style={{ textAlign: "right" }}>{c.vagas || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{c.regiao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="vx-chart-source" style={{ marginTop: 10 }}>
        Orçamentos cadastrados nas campanhas. Consumo real disponível em Insights → Financeiro.
      </div>
    </div>
  );
}

function Comissoes({ emp }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api("/leads/comissoes").then((r) => { setDados(r); setCarregando(false); }).catch(() => setCarregando(false));
  }, [emp.id]);

  if (carregando) return <div className="vx-mut" style={{ padding: 20 }}>Carregando…</div>;
  if (!dados) return <div className="vx-mut" style={{ padding: 20 }}>Não foi possível carregar.</div>;

  const { vendedores = [], total } = dados;
  const totalVendas = vendedores.reduce((s, v) => s + v.totalVendas, 0);
  const totalComissoes = vendedores.reduce((s, v) => s + v.totalComissoes, 0);

  return (
    <div>
      <div className="vx-grid vx-g3" style={{ marginBottom: 18 }}>
        {[
          ["Fechamentos", total, TrendingUp],
          ["Total em vendas", money(totalVendas), CircleDollarSign],
          ["Comissões a pagar", money(totalComissoes), Wallet],
        ].map(([label, val, Icon]) => (
          <div key={label} className="vx-glass-panel vx-tile">
            <div className="vx-tile-top"><span>{label}</span><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></div>
            <div className="vx-tile-val">{val}</div>
          </div>
        ))}
      </div>

      {vendedores.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <CircleDollarSign size={26} color="var(--muted)" style={{ marginBottom: 8 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>Sem fechamentos registrados</div>
          <div className="vx-mut" style={{ fontSize: 13 }}>Mova um lead para "Fechado" com o valor da venda para calcular comissões.</div>
        </div>
      ) : (
        <div className="vx-grid">
          {vendedores.map((v) => (
            <div key={v.sellerId} className="vx-card" style={{ padding: 16 }}>
              <div className="vx-row" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={16} color="var(--brand)" />
                  <b>{v.nome}</b>
                </div>
                <span className="vx-chip">{v.fechamentos} fechamento{v.fechamentos !== 1 ? "s" : ""}</span>
              </div>
              <div className="vx-grid vx-g3" style={{ marginBottom: 10 }}>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Volume de vendas</div><b className="vx-mono">{money(v.totalVendas)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Comissão total</div><b className="vx-mono" style={{ color: "var(--brand)" }}>{money(v.totalComissoes)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Taxa média</div><b className="vx-mono">{v.totalVendas > 0 ? (v.totalComissoes / v.totalVendas * 100).toFixed(1) : "—"}%</b></div>
              </div>
              <div className="vx-table-wrap">
                <table className="vx-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Lead</th><th>Campanha</th><th>Venda</th><th>Comissão</th><th>Data</th></tr></thead>
                  <tbody>
                    {v.leads.map((l) => (
                      <tr key={l.id}>
                        <td>{l.nome}</td>
                        <td>{l.campanhaTitulo || "—"}</td>
                        <td className="vx-mono">{money(l.valorVenda)}</td>
                        <td className="vx-mono" style={{ color: "var(--brand)" }}>{money(l.comissaoCalculada)}</td>
                        <td style={{ color: "var(--text-2)", fontSize: 11.5 }}>{dataCurta(l.atualizadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigComissoes({ emp, db, up, aviso }) {
  const [v, setV] = useState(emp.comissoes);
  const [premissas, setPremissas] = useState({ ticketMedio: "", margem: "30", conversao: "" });
  useEffect(() => setV(emp.comissoes), [emp.id]);

  const historico = useMemo(() => metricasEmpresa({
    submissions: db?.submissions || [], campaigns: db?.campaigns || [],
    leads: db?.leads || [], companyId: emp.id, filtros: {},
  }), [db, emp.id]);

  const sugestao = useMemo(() => sugerirValores({
    ticketMedio: Number(String(premissas.ticketMedio).replace(",", ".")),
    margem: Number(premissas.margem) / 100,
    conversaoReuniaoVenda: Number(String(premissas.conversao).replace(",", ".")) / 100,
    historico, plano: emp.assinatura,
  }), [premissas, historico, emp.assinatura]);

  const aplicar = () => {
    setV((atual) => ({ ...atual, ...Object.fromEntries(sugestao.tarefas.map((t) => [t.tipo, t.bruto])) }));
    aviso("Sugestão preenchida. Revise e salve.");
  };

  const salvar = () => {
    const limpo = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(String(x).replace(",", ".")) || 0]));
    apiPatch(`/companies/${emp.id}`, { comissoes: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, comissoes: limpo } : c) }));
    aviso("Tabela de comissões atualizada.");
  };

  return (
    <div>
      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-row" style={{ marginBottom: 12 }}>
          <div>
            <b style={{ fontSize: 15 }}>Calculadora de sugestão</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>Preencha as premissas para receber uma sugestão com base no seu negócio.</div>
          </div>
        </div>
        <div className="vx-grid vx-g3">
          {[["ticketMedio", "Ticket médio (R$)"], ["margem", "Margem bruta (%)"], ["conversao", "Conversão reunião→venda (%)"]].map(([k, l]) => (
            <label key={k}>
              <div className="vx-label">{l}</div>
              <input className="vx-input vx-mono" value={premissas[k]}
                onChange={(e) => setPremissas({ ...premissas, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        {sugestao.disponivel && (
          <button className="vx-btn vx-btn-sm" style={{ marginTop: 12 }} onClick={aplicar}>
            Aplicar sugestão
          </button>
        )}
        {!sugestao.disponivel && premissas.ticketMedio && (
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 8 }}>{sugestao.motivo}</div>
        )}
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-row" style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 15 }}>Tabela de comissões padrão</b>
          <span className="vx-chip vx-mut" style={{ fontSize: 11 }}>Vale para campanhas sem tabela própria</span>
        </div>
        <div className="vx-grid vx-g3">
          {ORDEM_ACOES.map((k) => (
            <label key={k}>
              <div className="vx-label">{ACOES[k]?.nome || k}</div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-2)", pointerEvents: "none" }}>R$</span>
                <input className="vx-input vx-mono" style={{ paddingLeft: 26 }}
                  value={v?.[k] ?? ""} onChange={(e) => setV((prev) => ({ ...prev, [k]: e.target.value }))} />
              </div>
            </label>
          ))}
        </div>
        <button className="vx-btn vx-btn-primary" style={{ marginTop: 16 }} onClick={salvar}>Salvar tabela</button>
      </div>
    </div>
  );
}

const VISOES_POR_ESCOPO = {
  orcamento: [["orcamento", "Orçamento"]],
  comissoes: [["comissoes", "Comissões"], ["config", "Configurar comissões"]],
};

export default function ValoresEmpresa({ emp, db, up, aviso, onAdicionarSaldo, escopo = "orcamento" }) {
  const visoes = VISOES_POR_ESCOPO[escopo] || VISOES_POR_ESCOPO.orcamento;
  const [visao, setVisao] = useState(visoes[0][0]);
  const ehComissoes = escopo === "comissoes";
  const campanhas = useMemo(
    () => (db.campaigns || []).filter((c) => c.companyId === emp.id),
    [db.campaigns, emp.id],
  );

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Financeiro comercial</div>
          <h1 className="vx-disp">{ehComissoes ? "Comissões" : "Pagamento dos Profissionais"}</h1>
          <p>{ehComissoes
            ? "Comissões dos profissionais e configuração das tabelas de pagamento."
            : "Orçamentos das campanhas para o pagamento dos profissionais."}</p>
        </div>
        {!ehComissoes && (
          <button className="vx-btn vx-btn-primary" style={{ flexShrink: 0, gap: 7 }} onClick={() => onAdicionarSaldo?.()}>
            <Wallet size={15} /> Adicionar Saldo
          </button>
        )}
      </div>

      {visoes.length > 1 && (
        <div className="vx-seg vx-subnav" style={{ marginBottom: 20 }}>
          {visoes.map(([key, label]) => (
            <button key={key} data-on={visao === key ? "1" : "0"} onClick={() => setVisao(key)}>{label}</button>
          ))}
        </div>
      )}

      {visao === "orcamento" && <OrcamentoCampanhas campanhas={campanhas} />}
      {visao === "comissoes" && <Comissoes emp={emp} />}
      {visao === "config" && <ConfigComissoes emp={emp} db={db} up={up} aviso={aviso} />}
    </div>
  );
}
