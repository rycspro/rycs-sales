import { useState, useEffect, useMemo } from "react";
import { Wallet, ClipboardList, Banknote, Users, TrendingUp, Clock, LockKeyhole, CalendarCheck, Presentation, Target } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, agora, dataCurta } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { Donut, Stat } from "../ui.jsx";
import CompanyScore from "../CompanyScore.jsx";
import { metricasEmpresa, projetarROI, valorMonetario } from "../../../shared/analytics.js";

export default function PainelEmpresa({ emp, db, up, aviso }) {
  const [rec, setRec] = useState("");
  const [cobranca, setCobranca] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [doc, setDoc] = useState("");
  const [minimo, setMinimo] = useState(1);
  const [financeiro, setFinanceiro] = useState(null);
  const [filtros, setFiltros] = useState({ dias: "30", campaignId: "", sellerId: "", tipo: "" });
  const [premissas, setPremissas] = useState({ metaVendas: 5, ticketMedio: valorMonetario(emp.ticket), taxaComparecimento: "", taxaConversao: "", custoAgendada: "" });

  useEffect(() => {
    api("/deposits/config").then((c) => { if (c?.minimo) setMinimo(c.minimo); });
    api("/company/finance").then((f) => { if (f?.posicao) setFinanceiro(f); });
  }, []);

  const salvarDocumento = async () => {
    const limpo = doc.replace(/\D/g, "");
    if (limpo.length !== 11 && limpo.length !== 14)
      return aviso("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    await apiPatch(`/companies/${emp.id}`, { documento: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, documento: limpo } : c) }));
    aviso("Documento salvo.");
  };
  const subsTodos = db.submissions.filter((s) => s.companyId === emp.id);
  const metricas = useMemo(() => metricasEmpresa({ submissions: db.submissions, campaigns: db.campaigns || [], leads: db.leads || [], companyId: emp.id, filtros }), [db.submissions, db.campaigns, db.leads, emp.id, filtros]);
  const projecao = useMemo(() => projetarROI({ metricas, ...premissas, taxaComparecimento: Number(premissas.taxaComparecimento) / 100, taxaConversao: Number(premissas.taxaConversao) / 100 }), [metricas, premissas]);
  const pagos = subsTodos.filter((s) => s.status === "liberado");
  const gasto = pagos.reduce((a, s) => a + Number(s.valor || 0), 0);
  const time = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado").length;
  const reservado = financeiro?.posicao?.reservado ?? Number(emp.saldoReservado || 0);
  const disponivel = financeiro?.posicao?.disponivel ?? Math.max(0, Number(emp.saldo || 0) - reservado);

  // Fluxo manual: a empresa declara o depósito e paga por Pix; a plataforma
  // confirma o recebimento e só então o caixa é creditado. Nada entra aqui.
  const abastecer = async () => {
    const v = Number(String(rec).replace(",", "."));
    if (!v || v < minimo) return aviso(`Depósito mínimo de ${money(minimo)}.`);
    setGerando(true);
    const r = await api("/deposits", { valor: v });
    setGerando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível registrar o depósito.");
    setCobranca({ ...r, valor: v });
    setRec("");
  };

  return (
    <>
      <div className="vx-page-head">
        <div><div className="vx-eyebrow">Visão do proprietário</div><h1 className="vx-disp">Desempenho comercial</h1><p>Indicadores calculados exclusivamente a partir dos registros da sua empresa.</p></div>
        <div className="vx-filterbar">
          <select className="vx-input" aria-label="Período" value={filtros.dias} onChange={(e) => setFiltros({ ...filtros, dias: e.target.value })}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="">Todo período</option></select>
          <select className="vx-input" aria-label="Campanha" value={filtros.campaignId} onChange={(e) => setFiltros({ ...filtros, campaignId: e.target.value })}><option value="">Todas campanhas</option>{(db.campaigns || []).filter((c) => c.companyId === emp.id).map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select>
          <select className="vx-input" aria-label="Profissional" value={filtros.sellerId} onChange={(e) => setFiltros({ ...filtros, sellerId: e.target.value })}><option value="">Todos profissionais</option>{db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado").map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
          <select className="vx-input" aria-label="Tipo de tarefa" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}><option value="">Todas tarefas</option>{Object.entries(ACOES).map(([k, a]) => <option key={k} value={k}>{a.nome}</option>)}</select>
        </div>
      </div>

      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Reuniões agendadas" value={metricas.agendadas} Icon={CalendarCheck} tone="brand" mono={false} />
        <Stat label="Reuniões realizadas" value={metricas.realizadas} Icon={Presentation} tone="indigo" mono={false} />
        <Stat label="Vendas realizadas" value={metricas.vendas} Icon={Target} tone="amber" mono={false} />
        <Stat label="ROI atual" value={metricas.roi == null ? "—" : `${metricas.roi.toFixed(1)}%`} Icon={TrendingUp} tone={metricas.roi != null && metricas.roi < 0 ? "red" : "brand"} />
      </div>

      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Investimento" value={money(metricas.investimento)} Icon={Banknote} tone="muted" />
        <Stat label="Retorno registrado" value={money(metricas.retorno)} Icon={TrendingUp} tone="brand" />
        <Stat label="Tarefas filtradas" value={metricas.subs.length} Icon={ClipboardList} tone="indigo" mono={false} />
        <Stat label="Profissionais no time" value={time} Icon={Users} tone="muted" mono={false} />
      </div>

      <div className="vx-grid vx-g2 vx-dashboard-charts" style={{ marginBottom: 22 }}>
        <Donut titulo="Conversão comercial" itens={[{ nome: "Agendadas", valor: metricas.agendadas }, { nome: "Realizadas", valor: metricas.realizadas }, { nome: "Vendas", valor: metricas.vendas }]} />
        <Donut titulo="Tarefas por situação" itens={metricas.status.map((s) => ({ nome: ({ liberado:"Aprovadas", revisao:"Em revisão", conferido:"Conferidas", ia_recusado:"Recusadas pela IA", recusado:"Recusadas", analisando:"Analisando" })[s.chave] || s.chave, valor: s.valor }))} />
        <Donut titulo="Investimento versus retorno" centro={money(metricas.retorno)} formatar={money} itens={[{ nome: "Investimento", valor: metricas.investimento }, { nome: "Retorno", valor: metricas.retorno }]} />
        <Donut titulo="Desempenho por campanha" itens={metricas.campanhas.filter((c) => c.total).map((c) => ({ nome: c.nome, valor: c.aprovadas, fonte: `${c.total} tarefas registradas` }))} />
      </div>

      <section className="vx-card" style={{ padding: 18, marginBottom: 22 }}>
        <div className="vx-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}><div><div className="vx-eyebrow">Planejamento determinístico</div><div className="vx-disp" style={{ fontSize: 18 }}>ROI projetado</div><p className="vx-mut" style={{ margin: "4px 0 0", fontSize: 12.5 }}>Projeção não é garantia. Ajuste as premissas e confira a fonte.</p></div>{projecao.disponivel && <span className={`vx-badge ${projecao.confianca === "alta" ? "vx-badge-brand" : "vx-badge-amber"}`}>Confiança {projecao.confianca} · amostra {projecao.amostra}</span>}</div>
        <div className="vx-grid vx-g4" style={{ marginTop: 14 }}>
          <label><span className="vx-label">Meta de vendas</span><input className="vx-input" type="number" min="1" value={premissas.metaVendas} onChange={(e) => setPremissas({ ...premissas, metaVendas: e.target.value })}/></label>
          <label><span className="vx-label">Ticket médio</span><input className="vx-input" type="number" min="0" value={premissas.ticketMedio} onChange={(e) => setPremissas({ ...premissas, ticketMedio: e.target.value })}/></label>
          <label><span className="vx-label">Comparecimento %</span><input className="vx-input" type="number" min="1" max="100" placeholder={metricas.agendadas ? `${Math.round(metricas.realizadas / metricas.agendadas * 100)} histórico` : "Informe"} value={premissas.taxaComparecimento} onChange={(e) => setPremissas({ ...premissas, taxaComparecimento: e.target.value })}/></label>
          <label><span className="vx-label">Conversão %</span><input className="vx-input" type="number" min="1" max="100" placeholder={metricas.realizadas ? `${Math.round(metricas.vendas / metricas.realizadas * 100)} histórico` : "Informe"} value={premissas.taxaConversao} onChange={(e) => setPremissas({ ...premissas, taxaConversao: e.target.value })}/></label>
          <label><span className="vx-label">Custo por agendada</span><input className="vx-input" type="number" min="0" placeholder={metricas.agendadas ? money(metricas.investimento / metricas.agendadas) : "Informe"} value={premissas.custoAgendada} onChange={(e) => setPremissas({ ...premissas, custoAgendada: e.target.value })}/></label>
        </div>
        {!projecao.disponivel ? <div className="vx-notice vx-notice-amber" style={{ marginTop: 14 }}>Complete: {projecao.ausentes.join(", ")}. Sem essas premissas não exibimos números inventados.</div> : <><div className="vx-grid vx-g3" style={{ marginTop: 14 }}>{Object.entries(projecao.cenarios).map(([nome, c]) => <div className="vx-scenario" key={nome}><span>{nome}</span><strong className="vx-mono">{c.roi.toFixed(1)}% ROI</strong><small>{c.agendadas} agendadas → {c.realizadas} realizadas → {c.vendas} vendas</small><small>{money(c.investimento)} investimento · {money(c.receita)} receita</small></div>)}</div><div className="vx-chart-source">Fonte: {projecao.fonte}. Fórmula: (retorno - investimento) / investimento × 100.</div></>}
      </section>

      <div style={{ marginBottom: 16 }}>
        <CompanyScore nota={emp.nota} dimensoes={emp.scoreDimensions} />
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 8 }}>Abastecer caixa</div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
          Você só paga pelo que foi conferido. O valor sai do caixa no momento em que a ação é liberada.
        </p>
        {!emp.documento && (
          <div style={{ marginBottom: 10 }}>
            <div className="vx-label">CNPJ ou CPF do titular</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="vx-input vx-mono" value={doc} onChange={(e) => setDoc(e.target.value)}
                placeholder="00.000.000/0001-00" inputMode="numeric" />
              <button className="vx-btn" onClick={salvarDocumento}>Salvar</button>
            </div>
            <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>
              Exigido pelo banco para emitir a cobrança em nome da sua empresa.
            </div>
          </div>
        )}
        <input className="vx-input vx-mono" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="100,00" inputMode="decimal" />
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[Math.max(minimo, 50), 100, 500].map((v) => (
            <button key={v} className="vx-btn vx-btn-sm" onClick={() => setRec(String(v))}>{money(v)}</button>
          ))}
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 10 }} disabled={gerando} onClick={abastecer}>
          {gerando ? "Registrando…" : "Depositar por Pix"}
        </button>

        {cobranca && (
          <div className="vx-card" style={{ padding: 16, marginTop: 12, background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
            <div className="vx-disp" style={{ fontSize: 15 }}>
              {cobranca.modo === "gateway" ? "Cobrança de" : "Depósito de"} {money(cobranca.valor)}
            </div>
            <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>{cobranca.instrucoes}</p>

            {cobranca.pixQrCodeBase64 && (
              <img src={`data:image/png;base64,${cobranca.pixQrCodeBase64}`} alt="QR Code Pix"
                style={{ width: 190, display: "block", margin: "14px auto", borderRadius: 10, background: "#fff", padding: 8 }} />
            )}

            {cobranca.pixCopiaECola && (
              <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 6 }}
                onClick={() => { navigator.clipboard?.writeText(cobranca.pixCopiaECola); aviso("Código Pix copiado."); }}>
                Copiar código Pix
              </button>
            )}

            {cobranca.invoiceUrl && (
              <a className="vx-btn vx-btn-sm vx-btn-block" style={{ marginTop: 6 }} target="_blank" rel="noreferrer" href={cobranca.invoiceUrl}>
                Abrir fatura
              </a>
            )}

            {cobranca.pix && (
              <div style={{ marginTop: 12 }}>
                <div className="vx-label">Chave Pix da RYCS</div>
                <div className="vx-row" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <span className="vx-mono" style={{ fontSize: 13, wordBreak: "break-all" }}>{cobranca.pix}</span>
                  <button className="vx-btn vx-btn-sm" style={{ flex: "none" }}
                    onClick={() => { navigator.clipboard?.writeText(cobranca.pix); aviso("Chave Pix copiada."); }}>Copiar</button>
                </div>
                <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>Titular: {cobranca.titular}</div>
              </div>
            )}

            {cobranca.referencia && (
              <div style={{ marginTop: 12 }}>
                <div className="vx-label">Coloque esta referência na transferência</div>
                <div className="vx-row" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <span className="vx-mono vx-disp" style={{ fontSize: 15, color: "var(--brand)" }}>{cobranca.referencia}</span>
                  <button className="vx-btn vx-btn-sm" style={{ flex: "none" }}
                    onClick={() => { navigator.clipboard?.writeText(cobranca.referencia); aviso("Referência copiada."); }}>Copiar</button>
                </div>
              </div>
            )}

            <button className="vx-btn vx-btn-ghost vx-btn-sm vx-btn-block" style={{ marginTop: 10 }} onClick={() => setCobranca(null)}>Fechar</button>
          </div>
        )}
        <hr className="vx-sep" />
        <div className="vx-row" style={{ fontSize: 13 }}>
          <span className="vx-mut">Pago em comissões</span><b className="vx-mono">{money(gasto)}</b>
        </div>
        <div className="vx-row" style={{ fontSize: 13, marginTop: 6 }}>
          <span className="vx-mut">Total já investido na plataforma</span><b className="vx-mono">{money(emp.totalAportado || 0)}</b>
        </div>
      </div>

      {financeiro?.extrato?.length > 0 && <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 10 }}>Extrato operacional</div>
        {financeiro.extrato.slice(0, 8).map((m) => <div key={m.id} className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}><div><b>{({ deposito: "Depósito", reserva: "Reserva de tarefa", estorno_reserva: "Reserva liberada", liquidacao: "Tarefa paga" })[m.tipo] || m.tipo}</b><div className="vx-mut" style={{ fontSize: 11.5 }}>{dataCurta(m.criadoEm)}</div></div><b className="vx-mono" style={{ color: m.valor < 0 ? "var(--red)" : "var(--brand)" }}>{money(m.valor)}</b></div>)}
      </div>}

      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>
          <Clock size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Atividade recente
        </div>
        {subsTodos.length === 0 && <div className="vx-mut" style={{ fontSize: 13, padding: "8px 0" }}>Nenhuma ação registrada ainda.</div>}
        {subsTodos.slice(0, 8).map((s) => {
          const seller = db.sellers.find((sl) => sl.id === s.sellerId);
          const statusCor = { liberado: "var(--brand)", recusado: "var(--red)", revisao: "var(--amber)", ia_aprovado: "var(--indigo)", analisando: "var(--muted)" };
          const statusLabel = { liberado: "Aprovada", recusado: "Recusada", revisao: "Revisão", ia_aprovado: "Pré-aprovada", analisando: "Analisando", conferido: "Conferida" };
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: statusCor[s.status] || "var(--muted)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ACOES[s.tipo]?.nome || s.tipo} — {money(s.valor)}</div>
                <div className="vx-mut" style={{ fontSize: 12 }}>{seller?.nome || "Vendedor"} · {dataCurta(s.criadoEm)}</div>
              </div>
              <span className="vx-badge" style={{ background: `${statusCor[s.status] || "var(--muted)"}15`, color: statusCor[s.status] || "var(--muted)", fontSize: 11 }}>
                {statusLabel[s.status] || s.status}
              </span>
            </div>
          );
        })}
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 4 }}>Posição na vitrine</div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
          Empresas em destaque aparecem no topo da lista dos vendedores e recebem cerca de 3x mais candidaturas.
        </p>
        <div className="vx-row" style={{ padding: "10px 0" }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Destaque no topo</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>R$ 490/mês, cancela quando quiser</div>
          </div>
          <button className={"vx-btn vx-btn-sm" + (emp.destaque ? "" : " vx-btn-primary")}
            onClick={() => { apiPatch(`/companies/${emp.id}`, { destaque: !emp.destaque }); up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, destaque: !c.destaque } : c) })); aviso(emp.destaque ? "Destaque cancelado." : "Destaque ativado."); }}>
            {emp.destaque ? "Cancelar destaque" : "Ativar destaque"}
          </button>
        </div>
      </div>
    </>
  );
}
