import { useEffect, useState } from "react";
import { Link2, RefreshCw, Unplug, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.jsx";

// Integração com a Meta: a empresa conecta a própria conta, escolhe a Página
// (de onde vêm os leads dos formulários) e a conta de anúncios (métricas).

const PERIODOS = [["last_7d", "7 dias"], ["last_30d", "30 dias"], ["this_month", "Este mês"], ["last_month", "Mês passado"]];
const moeda = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const num = (v) => Number(v || 0).toLocaleString("pt-BR");
const dataHora = (t) => (t ? new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const STATUS_LEAD = { criado: "Entregue", duplicado: "Já existia", sem_profissional: "Aguardando profissional", erro: "Com erro", pendente: "Processando" };

function Caixa({ titulo, descricao, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: 14 }}>
      {titulo && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase" }}>{titulo}</div>}
      {descricao && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>{descricao}</div>}
      <div style={{ marginTop: titulo || descricao ? 16 : 0 }}>{children}</div>
    </div>
  );
}

function Seletor({ label, valor, onChange, opcoes, vazio }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>{label}</div>
      <select className="vx-input" value={valor || ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
    </label>
  );
}

function Indicador({ rotulo, valor }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{rotulo}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{valor}</div>
    </div>
  );
}

export default function IntegracaoMeta({ aviso, campanhas = [] }) {
  const [conexao, setConexao] = useState(null);
  const [opcoes, setOpcoes] = useState(null);
  const [escolha, setEscolha] = useState({ pageId: "", adAccountId: "", campaignId: "" });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [periodo, setPeriodo] = useState("last_30d");
  const [metricas, setMetricas] = useState(null);
  const [leads, setLeads] = useState(null);

  const carregar = async () => {
    const c = await api("/meta/conexao");
    setConexao(c || { conectado: false });
    if (c?.conectado && c.status !== "ativa") {
      const o = await api("/meta/opcoes");
      if (o?.error) setErro(o.error); else setOpcoes(o);
    }
    if (c?.conectado) {
      setEscolha({ pageId: c.pagina?.id || "", adAccountId: c.contaAnuncios?.id || "", campaignId: c.campaignId || "" });
      setLeads(await api("/meta/leads"));
    }
  };

  useEffect(() => {
    // Volta do login da Meta: mostra o resultado e limpa o endereço.
    const q = new URLSearchParams(window.location.search);
    const r = q.get("meta");
    if (r) {
      if (r === "conectado") aviso?.("Conta da Meta conectada. Agora escolha a Página e a conta de anúncios.");
      else if (r === "cancelado") aviso?.("Conexão com a Meta cancelada.");
      else setErro("Não foi possível concluir o login na Meta. Tente de novo.");
      q.delete("meta"); q.delete("motivo");
      window.history.replaceState({}, "", `${window.location.pathname}${q.toString() ? `?${q}` : ""}`);
    }
    carregar();
  }, []);

  useEffect(() => {
    if (conexao?.status !== "ativa" || !conexao.contaAnuncios) return;
    setMetricas(null);
    api(`/meta/metricas?periodo=${periodo}`).then((m) => setMetricas(m || { error: "Sem resposta da Meta." }));
  }, [conexao?.status, conexao?.contaAnuncios?.id, periodo]);

  const conectar = async () => {
    setOcupado(true); setErro("");
    const r = await api("/meta/iniciar", {});
    if (r?.url) { window.location.href = r.url; return; }
    setErro(r?.error || "Não foi possível iniciar a conexão."); setOcupado(false);
  };

  const salvar = async () => {
    if (!escolha.pageId) return setErro("Escolha a Página do Facebook.");
    setOcupado(true); setErro("");
    const r = await api("/meta/configurar", escolha);
    setOcupado(false);
    if (r?.error) return setErro(r.error);
    aviso?.("Integração ativa. Os novos leads dos formulários vão chegar aqui automaticamente.");
    setOpcoes(null); carregar();
  };

  const trocar = async () => {
    setOcupado(true); setErro("");
    const o = await api("/meta/opcoes");
    setOcupado(false);
    if (o?.error) return setErro(o.error);
    setOpcoes(o);
  };

  const sair = async () => {
    if (!window.confirm("Desconectar a Meta? A RYCS deixa de receber os leads dos seus formulários.")) return;
    setOcupado(true);
    await apiDelete("/meta/conexao");
    setOcupado(false); setOpcoes(null); setMetricas(null); setLeads(null);
    aviso?.("Meta desconectada.");
    carregar();
  };

  if (!conexao) return <div style={{ padding: 30, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const cabecalho = (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px", letterSpacing: -0.3 }}>Integrações</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
        Conecte o Facebook e o Instagram para receber na hora os leads dos seus anúncios e acompanhar o desempenho das campanhas.
      </p>
    </div>
  );

  const alerta = erro && (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, color: "var(--ink)" }}>
      <AlertTriangle size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} /> <span>{erro}</span>
    </div>
  );

  if (!conexao.conectado) return (
    <>
      {cabecalho}{alerta}
      <Caixa titulo="Meta (Facebook e Instagram)" descricao="Você entra com a sua conta do Facebook e escolhe a Página e a conta de anúncios. A RYCS só lê os leads dos seus formulários e as métricas dos seus anúncios.">
        {!conexao.configurada && <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>A integração ainda está sendo ativada pela RYCS.</p>}
        <button className="vx-btn vx-btn-primary" disabled={ocupado || !conexao.configurada} onClick={conectar} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Link2 size={15} /> {ocupado ? "Abrindo a Meta..." : "Conectar Meta"}
        </button>
      </Caixa>
    </>
  );

  const escolhendo = !!opcoes;
  return (
    <>
      {cabecalho}{alerta}
      <Caixa titulo="Meta (Facebook e Instagram)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
            {conexao.status === "ativa" ? <CheckCircle2 size={18} style={{ color: "#16a34a", flexShrink: 0 }} /> : <AlertTriangle size={18} style={{ color: "#d97706", flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                {conexao.status === "ativa" ? "Conectada" : conexao.status === "expirada" ? "Acesso expirado — reconecte" : "Falta escolher a Página"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {conexao.usuario && `Conta: ${conexao.usuario}`}
                {conexao.pagina && ` · Página: ${conexao.pagina.nome}`}
                {conexao.contaAnuncios && ` · Anúncios: ${conexao.contaAnuncios.nome}`}
              </div>
              {conexao.tokenExpiraEm && <div style={{ fontSize: 12, color: "var(--muted)" }}>Acesso válido até {new Date(conexao.tokenExpiraEm).toLocaleDateString("pt-BR")}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(conexao.status === "expirada" || conexao.status === "reconfirmar") && <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={ocupado} onClick={conectar} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RefreshCw size={13} /> Reconectar</button>}
            {conexao.status === "ativa" && !escolhendo && <button className="vx-btn vx-btn-sm" disabled={ocupado} onClick={trocar}>Alterar Página ou conta</button>}
            <button className="vx-btn vx-btn-sm" disabled={ocupado} onClick={sair} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Unplug size={13} /> Desconectar</button>
          </div>
        </div>

        {escolhendo && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
            <Seletor label="Página do Facebook (de onde vêm os leads)" valor={escolha.pageId} onChange={(v) => setEscolha((e) => ({ ...e, pageId: v }))} opcoes={opcoes.paginas} vazio="Escolha a Página" />
            <Seletor label="Conta de anúncios (para as métricas)" valor={escolha.adAccountId} onChange={(v) => setEscolha((e) => ({ ...e, adAccountId: v }))} opcoes={opcoes.contasAnuncios} vazio="Sem métricas por enquanto" />
            <Seletor label="Campanha da RYCS que recebe os leads (opcional)" valor={escolha.campaignId} onChange={(v) => setEscolha((e) => ({ ...e, campaignId: v }))} opcoes={campanhas.map((c) => ({ id: c.id, nome: c.titulo }))} vazio="Nenhuma campanha específica" />
            {!opcoes.paginas.length && <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Nenhuma Página apareceu. Reconecte e marque a Página na tela da Meta.</p>}
            <button className="vx-btn vx-btn-primary" disabled={ocupado || !escolha.pageId} onClick={salvar}>{ocupado ? "Salvando..." : "Ativar recebimento de leads"}</button>
          </div>
        )}
        {conexao.ultimoErro && conexao.status !== "ativa" && <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--muted)" }}>Último erro ({dataHora(conexao.ultimoErroEm)}): {conexao.ultimoErro}</div>}
      </Caixa>

      {conexao.status === "ativa" && leads && (
        <Caixa titulo="Leads recebidos da Meta" descricao={`Último lead: ${dataHora(conexao.ultimoLeadEm)}. Cada lead vai para um profissional aprovado da sua equipe, que é avisado na hora.`}>
          {!leads.recentes?.length ? <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Nenhum lead ainda. Assim que alguém preencher o formulário do seu anúncio, ele aparece aqui.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ color: "var(--muted)", textAlign: "left" }}><th style={{ padding: "6px 8px" }}>Quando</th><th style={{ padding: "6px 8px" }}>Lead</th><th style={{ padding: "6px 8px" }}>Campanha</th><th style={{ padding: "6px 8px" }}>Profissional</th><th style={{ padding: "6px 8px" }}>Situação</th></tr></thead>
                <tbody>{leads.recentes.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{dataHora(l.recebidoEm)}</td>
                    <td style={{ padding: "8px" }}>{l.nome || "—"}</td>
                    <td style={{ padding: "8px" }}>{l.metaCampaignNome || "—"}</td>
                    <td style={{ padding: "8px" }}>{l.profissional || "—"}</td>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{STATUS_LEAD[l.status] || l.status}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </Caixa>
      )}

      {conexao.status === "ativa" && conexao.contaAnuncios && (
        <Caixa titulo="Desempenho das campanhas">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {PERIODOS.map(([k, l]) => <button key={k} className={`vx-btn vx-btn-sm${periodo === k ? " vx-btn-primary" : ""}`} onClick={() => setPeriodo(k)}>{l}</button>)}
          </div>
          {!metricas ? <div className="vx-spinner" /> : metricas.error ? <p style={{ fontSize: 13, color: "var(--muted)" }}>{metricas.error}</p> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
                <Indicador rotulo="Investido" valor={moeda(metricas.total.gasto)} />
                <Indicador rotulo="Leads (Meta)" valor={num(metricas.total.leads)} />
                <Indicador rotulo="Custo por lead" valor={moeda(metricas.total.custoPorLead)} />
                <Indicador rotulo="Cliques" valor={num(metricas.total.cliques)} />
                <Indicador rotulo="CTR" valor={`${metricas.total.ctr.toFixed(2).replace(".", ",")}%`} />
              </div>
              {!metricas.campanhas.length ? <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Nenhuma campanha com veiculação neste período.</p> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ color: "var(--muted)", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px" }}>Campanha</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Investido</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Cliques</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Leads</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Na RYCS</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Custo/lead</th></tr></thead>
                    <tbody>{metricas.campanhas.map((c) => (
                      <tr key={c.id} style={{ borderTop: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" }}>
                        <td style={{ padding: "8px" }}>{c.nome}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{moeda(c.gasto)}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{num(c.cliques)}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{num(c.leads)}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{num(c.leadsNaRycs)}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{moeda(c.custoPorLead)}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>Valores da conta {metricas.conta.nome} na moeda da conta. Atualizado {dataHora(metricas.atualizadoEm)}.</div>
            </>
          )}
        </Caixa>
      )}
    </>
  );
}
