import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import {
  Phone, Users, Clock, Target, Settings, BarChart3, List, History,
  TrendingUp, Zap, Plus, Trash2, CheckCircle2, Calendar, PhoneCall,
  AlertTriangle, Building2, User, XCircle, FileText, Play, Pause,
  Edit3, Save, ChevronDown, ChevronUp, Eye, PhoneOff, Upload
} from "lucide-react";
import ConfigurarDiscadora from "./ConfigurarDiscadora.jsx";

function Card({ children, style, ...p }) {
  return <div style={{ background: "var(--surface-solid)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", ...style }} {...p}>{children}</div>;
}

function StatCard({ label, valor, icon: Icon, cor, sub }) {
  return (
    <Card style={{ padding: "16px 20px", flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {Icon && <Icon size={16} style={{ color: cor || "var(--brand)" }} />}
        <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

const ABAS = [
  { id: "configurar", label: "Configurar", Icon: Upload },
  { id: "visao", label: "Visão geral", Icon: BarChart3 },
  { id: "operacao", label: "Operação", Icon: Zap },
  { id: "historico", label: "Histórico", Icon: History },
  { id: "desempenho", label: "Desempenho", Icon: TrendingUp },
  { id: "consumo", label: "Telefonia", Icon: Phone },
  { id: "avancado", label: "Avançado", Icon: Settings },
];

export default function DiscadoraEmpresa({ emp, aviso, time = [] }) {
  // Sem aba escolhida ainda: abre em Configurar até existir lista na fila.
  const [aba, setAba] = useState(null);
  const [stats, setStats] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [filas, setFilas] = useState([]);
  const [settings, setSettings] = useState(null);
  const [calls, setCalls] = useState([]);
  const [uso, setUso] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [s, sl, f, st, c, u] = await Promise.all([
        api.get("/voice/stats"),
        api.get("/voice/stats/sellers"),
        api.get("/voice/queues"),
        api.get("/voice/settings"),
        api.get("/voice/calls", { limit: 50 }),
        api.get("/voice/usage"),
      ]);
      setStats(s);
      setSellers(sl);
      setFilas(f);
      setAba((a) => a ?? (f.some((q) => (q.stats?.total || 0) > 0) ? "visao" : "configurar"));
      setSettings(st);
      setCalls(c);
      setUso(u);
    } catch {}
  }, []);

  useEffect(() => {
    api.get("/voice/status").then((r) => { setVoiceStatus(r); if (r.habilitada) carregar(); }).catch(() => setVoiceStatus({ habilitada: false }));
  }, [carregar]);

  if (voiceStatus && !voiceStatus.habilitada) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <Phone size={48} style={{ color: "var(--muted-2)", marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Discadora não ativada</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 420, margin: "0 auto" }}>
          A discadora comercial ainda não está habilitada para a sua empresa.
          Entre em contato com a equipe RYCS para solicitar a ativação.
        </p>
      </div>
    );
  }

  const abaAtual = aba || "configurar";

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Phone size={18} style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Discadora</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Central de operação comercial</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16, overflowX: "auto", borderBottom: "1px solid var(--border)" }}>
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)} aria-current={abaAtual === a.id ? "page" : undefined}
            style={{ padding: "8px 14px", minHeight: 44, fontSize: 13, fontWeight: abaAtual === a.id ? 600 : 400, color: abaAtual === a.id ? "var(--brand)" : "var(--muted)", background: "transparent", border: "none", borderBottom: abaAtual === a.id ? "2px solid var(--brand)" : "2px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <a.Icon size={14} /> {a.label}
          </button>
        ))}
      </div>

      {abaAtual === "configurar" && <ConfigurarDiscadora time={time} filas={filas} settings={settings} aviso={aviso} onAtualizar={carregar} />}
      {abaAtual === "visao" && <VisaoGeral stats={stats} sellers={sellers} filas={filas} settings={settings} uso={uso} />}
      {abaAtual === "operacao" && <Operacao sellers={sellers} stats={stats} />}
      {abaAtual === "historico" && <HistoricoCalls calls={calls} />}
      {abaAtual === "desempenho" && <DesempenhoSellers sellers={sellers} />}
      {abaAtual === "consumo" && <Consumo uso={uso} />}
      {abaAtual === "avancado" && (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>Ajustes finos e várias filas. Para subir lista e liberar profissionais, use a aba Configurar.</p>
          <Configuracoes settings={settings} aviso={aviso} onAtualizar={carregar} />
          <div style={{ marginTop: 20 }}><GerenciarFilas filas={filas} time={time} aviso={aviso} onAtualizar={carregar} /></div>
        </>
      )}
    </div>
  );
}

function VisaoGeral({ stats, sellers, filas, settings, uso }) {
  if (!stats) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const profAtivos = stats.profissionaisAtivos || 0;
  const profPausados = stats.profissionaisPausados || 0;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <StatCard label="Profissionais ativos" valor={profAtivos} icon={Users} cor="var(--green)" sub={profPausados ? `${profPausados} pausados` : undefined} />
        <StatCard label="Ligações hoje" valor={stats.totalLigacoes || 0} icon={PhoneCall} cor="var(--brand)" />
        <StatCard label="Atendidas" valor={stats.atendidas || 0} icon={CheckCircle2} cor="var(--green)"
          sub={`${stats.taxaAtendimento || 0}% de atendimento`} />
        <StatCard label="Reuniões" valor={stats.reunioes || 0} icon={Calendar} cor="var(--indigo)" />
        <StatCard label="Vendas" valor={stats.vendas || 0} icon={Target} cor="var(--green)" />
        <StatCard label="Tempo médio" valor={stats.tempoMedio ? `${Math.round(stats.tempoMedio / 60)}min` : "–"} icon={Clock} cor="var(--sky-600)" />
      </div>

      {stats.simulados > 0 && (
        <div style={{ padding: "8px 16px", background: "var(--indigo-50)", borderRadius: "var(--radius-sm)", color: "var(--indigo)", fontSize: 12, marginBottom: 16 }}>
          {stats.simulados} ligações simuladas incluídas nos números acima. Dados simulados não representam ligações reais.
        </div>
      )}

      {/* Quick seller table */}
      {sellers.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>EQUIPE HOJE</div>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>Profissional</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>Status</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>Ligações</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>Atendidas</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>Reuniões</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>Vendas</th>
                </tr>
              </thead>
              <tbody>
                {sellers.slice(0, 10).map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <User size={14} style={{ color: "var(--brand)" }} />
                      </div>
                      <span style={{ fontWeight: 500 }}>{s.nome}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: s.statusOperacional === "ativo" ? "var(--green-50)" : s.statusOperacional === "pausado" ? "var(--amber-50)" : "var(--surface-3)", color: s.statusOperacional === "ativo" ? "var(--green)" : s.statusOperacional === "pausado" ? "var(--amber)" : "var(--muted)" }}>
                        {s.statusOperacional || "offline"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 500 }}>{s.ligacoes || 0}</td>
                    <td style={{ textAlign: "center", color: "var(--green)" }}>{s.atendidas || 0}</td>
                    <td style={{ textAlign: "center", color: "var(--indigo)" }}>{s.reunioes || 0}</td>
                    <td style={{ textAlign: "center", color: "var(--green)", fontWeight: 600 }}>{s.vendas || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quick queue summary */}
      {filas.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>FILAS ATIVAS</div>
          <div style={{ display: "grid", gap: 8 }}>
            {filas.map((f) => (
              <div key={f.id} style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{f.nome}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{f.stats?.total || 0} leads · {f.stats?.pendentes || 0} pendentes</div>
                </div>
                <div style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: f.status === "ativa" ? "var(--green-50)" : "var(--surface-3)", color: f.status === "ativa" ? "var(--green)" : "var(--muted)" }}>{f.status}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Operacao({ sellers, stats }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>OPERAÇÃO EM TEMPO REAL</div>
      {sellers.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Nenhum profissional vinculado às filas.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sellers.map((s) => (
            <div key={s.id} style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={16} style={{ color: "var(--brand)" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{s.nome}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.perfil}</div>
                </div>
              </div>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: s.statusOperacional === "ativo" ? "var(--green-50)" : s.statusOperacional === "pausado" ? "var(--amber-50)" : "var(--surface-3)", color: s.statusOperacional === "ativo" ? "var(--green)" : s.statusOperacional === "pausado" ? "var(--amber)" : "var(--muted)", fontWeight: 600 }}>
                {s.statusOperacional === "ativo" ? "Em operação" : s.statusOperacional === "pausado" ? "Pausado" : "Offline"}
              </span>
              <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                <span><strong>{s.ligacoes || 0}</strong> lig.</span>
                <span style={{ color: "var(--green)" }}><strong>{s.atendidas || 0}</strong> atend.</span>
                <span style={{ color: "var(--indigo)" }}><strong>{s.reunioes || 0}</strong> reun.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GerenciarFilas({ filas, time, aviso, onAtualizar }) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [campanhas, setCampanhas] = useState([]);
  const [campSel, setCampSel] = useState("");

  useEffect(() => {
    api.get("/campaigns").then(setCampanhas).catch(() => {});
  }, []);

  const criar = async () => {
    if (!nome.trim()) return aviso?.("Nome da fila é obrigatório.");
    try {
      await api.post("/voice/queues", { nome: nome.trim(), campaignId: campSel || undefined });
      setNome("");
      setCampSel("");
      setCriando(false);
      onAtualizar();
      aviso?.("Fila criada.");
    } catch (e) {
      aviso?.("Erro: " + (e.message || "Falha ao criar fila"));
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)" }}>FILAS DE DISCAGEM</div>
        <button onClick={() => setCriando(!criando)}
          style={{ padding: "6px 14px", borderRadius: "var(--radius-pill)", background: "var(--brand)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={14} /> Nova fila
        </button>
      </div>

      {criando && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Nome da fila</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Prospecção B2B"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13 }} />
            </div>
            <div style={{ minWidth: 180 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Campanha (opcional)</label>
              <select value={campSel} onChange={(e) => setCampSel(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13 }}>
                <option value="">Nenhuma</option>
                {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </div>
            <button onClick={criar} style={{ padding: "8px 20px", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Criar</button>
          </div>
        </Card>
      )}

      {filas.length === 0 && !criando && (
        <Card style={{ padding: 40, textAlign: "center" }}>
          <List size={40} style={{ color: "var(--muted-2)", marginBottom: 12 }} />
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Nenhuma fila criada</p>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Crie uma fila para começar a distribuir leads para os profissionais.</p>
        </Card>
      )}

      {filas.map((f) => <FilaCard key={f.id} fila={f} time={time} aviso={aviso} onAtualizar={onAtualizar} />)}
    </div>
  );
}

function FilaCard({ fila, time = [], aviso, onAtualizar }) {
  const [aberto, setAberto] = useState(false);
  const [membros, setMembros] = useState([]);
  const [profDisponiveis, setProfDisponiveis] = useState([]);
  const [profSel, setProfSel] = useState("");
  const [leadsDisponiveis, setLeadsDisponiveis] = useState([]);
  const [adicionandoLeads, setAdicionandoLeads] = useState(false);
  const [campanhaFiltro, setCampanhaFiltro] = useState("");
  const [campanhas, setCampanhas] = useState([]);

  const carregarDetalhes = async () => {
    try {
      // O time aprovado vem do painel da empresa (não existe rota /profissionais).
      const [m, camps] = await Promise.all([
        api.get(`/voice/queues/${fila.id}/members`),
        api.get("/campaigns"),
      ]);
      setMembros(m);
      setProfDisponiveis(time.filter((p) => !m.some((mem) => mem.sellerId === p.id)));
      setCampanhas(camps);
    } catch {}
  };

  useEffect(() => { if (aberto) carregarDetalhes(); }, [aberto]);

  const adicionarMembro = async () => {
    if (!profSel) return;
    try {
      await api.post(`/voice/queues/${fila.id}/members`, { sellerIds: [profSel] });
      setProfSel("");
      carregarDetalhes();
      aviso?.("Profissional adicionado à fila.");
    } catch (e) { aviso?.("Erro: " + (e.message || "Falha")); }
  };

  const removerMembro = async (sellerId) => {
    try {
      await api.delete(`/voice/queues/${fila.id}/members/${sellerId}`);
      carregarDetalhes();
      aviso?.("Profissional removido.");
    } catch (e) { aviso?.("Erro: " + (e.message || "Falha")); }
  };

  const carregarLeads = async () => {
    setAdicionandoLeads(true);
    try {
      const leads = await api.get("/leads", campanhaFiltro ? { campaignId: campanhaFiltro } : {});
      setLeadsDisponiveis(leads.filter((l) => l.telefone));
    } catch { setLeadsDisponiveis([]); }
  };

  const adicionarLeadsSelecionados = async () => {
    const ids = leadsDisponiveis.slice(0, 100).map((l) => l.id);
    if (!ids.length) return aviso?.("Nenhum lead com telefone disponível.");
    try {
      const r = await api.post(`/voice/queues/${fila.id}/leads`, { leadIds: ids });
      aviso?.(`${r.adicionados} leads adicionados à fila.`);
      setAdicionandoLeads(false);
      setLeadsDisponiveis([]);
      onAtualizar();
    } catch (e) { aviso?.("Erro: " + (e.message || "Falha")); }
  };

  return (
    <Card style={{ padding: 16, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setAberto(!aberto)}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{fila.nome}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {fila.stats?.total || 0} leads · {fila.stats?.pendentes || 0} pendentes · {fila.stats?.reservasAtivas || 0} em atendimento
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: fila.status === "ativa" ? "var(--green-50)" : "var(--surface-3)", color: fila.status === "ativa" ? "var(--green)" : "var(--muted)" }}>{fila.status}</span>
          {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {aberto && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {/* Info */}
          <div style={{ marginBottom: 12, fontSize: 12, color: "var(--muted)" }}>
            Estratégia: {fila.estrategia} · Max tentativas: {fila.maxTentativas} · Horário: {fila.horarioInicio}–{fila.horarioFim}
          </div>

          {/* Membros */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>PROFISSIONAIS</div>
            {membros.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>Nenhum profissional associado.</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {membros.map((m) => (
                <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: "var(--radius-pill)", background: "var(--brand-50)", color: "var(--brand)", fontSize: 12 }}>
                  <User size={12} /> {m.nome}
                  <button onClick={(e) => { e.stopPropagation(); removerMembro(m.sellerId); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 0, marginLeft: 4, lineHeight: 1 }}>
                    <XCircle size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={profSel} onChange={(e) => setProfSel(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 12 }}>
                <option value="">Selecionar profissional...</option>
                {profDisponiveis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <button onClick={adicionarMembro} disabled={!profSel}
                style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", background: profSel ? "var(--brand)" : "var(--muted-2)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: profSel ? "pointer" : "default" }}>
                Adicionar
              </button>
            </div>
          </div>

          {/* Leads */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>LEADS</div>
            {!adicionandoLeads ? (
              <button onClick={() => { carregarLeads(); }}
                style={{ padding: "6px 14px", borderRadius: "var(--radius-sm)", background: "var(--brand-50)", color: "var(--brand)", border: "1px solid var(--brand-100)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                + Adicionar leads do pipeline
              </button>
            ) : (
              <div style={{ padding: 10, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <select value={campanhaFiltro} onChange={(e) => { setCampanhaFiltro(e.target.value); }}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 12 }}>
                    <option value="">Todos os leads</option>
                    {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                  </select>
                  <button onClick={carregarLeads} style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", background: "var(--brand-50)", color: "var(--brand)", border: "1px solid var(--brand-100)", fontSize: 12, cursor: "pointer" }}>Buscar</button>
                </div>
                {leadsDisponiveis.length > 0 ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{leadsDisponiveis.length} leads com telefone encontrados (máx. 100)</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={adicionarLeadsSelecionados}
                        style={{ padding: "6px 14px", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Adicionar {Math.min(leadsDisponiveis.length, 100)} leads
                      </button>
                      <button onClick={() => { setAdicionandoLeads(false); setLeadsDisponiveis([]); }}
                        style={{ padding: "6px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-3)", color: "var(--muted)", border: "none", fontSize: 12, cursor: "pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Carregando leads ou nenhum disponível com telefone...</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function HistoricoCalls({ calls }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>HISTÓRICO DE LIGAÇÕES</div>
      {calls.length === 0 && <p style={{ color: "var(--muted)" }}>Nenhuma ligação registrada.</p>}
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Profissional", "Lead", "Telefone", "Resultado", "Duração", "Origem", "Data"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px" }}>{c.sellerNome || "–"}</td>
                <td style={{ padding: "6px 8px" }}>{c.leadNome || "–"}</td>
                <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{c.numeroDestino}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: c.resultado === "reuniao_agendada" || c.resultado === "venda" ? "var(--green-50)" : c.resultado === "atendeu" ? "var(--brand-50)" : "var(--surface-3)", color: c.resultado === "reuniao_agendada" || c.resultado === "venda" ? "var(--green)" : c.resultado === "atendeu" ? "var(--brand)" : "var(--muted)" }}>{c.resultado || "–"}</span>
                </td>
                <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{c.duracaoTotal ? `${Math.round(c.duracaoTotal / 60)}min` : "–"}</td>
                <td style={{ padding: "6px 8px" }}>
                  {c.origemDados === "declarado" && <span style={{ fontSize: 10, color: "var(--amber)", background: "var(--amber-50)", padding: "1px 6px", borderRadius: "var(--radius-pill)" }}>declarado</span>}
                  {c.origemDados === "verificado" && <span style={{ fontSize: 10, color: "var(--green)", background: "var(--green-50)", padding: "1px 6px", borderRadius: "var(--radius-pill)" }}>verificado</span>}
                  {c.origemDados === "simulado" && <span style={{ fontSize: 10, color: "var(--indigo)", background: "var(--indigo-50)", padding: "1px 6px", borderRadius: "var(--radius-pill)" }}>simulado</span>}
                </td>
                <td style={{ padding: "6px 8px", color: "var(--muted-2)", fontSize: 12 }}>{new Date(c.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DesempenhoSellers({ sellers }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>DESEMPENHO INDIVIDUAL</div>
      {sellers.length === 0 && <p style={{ color: "var(--muted)" }}>Nenhum profissional com atividade.</p>}
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Profissional", "Campanha", "Status", "Ligações", "Atendidas", "Reuniões", "Vendas", "Conversão", "Tempo", "Última ativ."].map((h) => (
                <th key={h} style={{ textAlign: h === "Profissional" ? "left" : "center", padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sellers.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User size={14} style={{ color: "var(--brand)" }} />
                  </div>
                  <span style={{ fontWeight: 500 }}>{s.nome}</span>
                </td>
                <td style={{ textAlign: "center", fontSize: 12, color: "var(--muted)" }}>{s.perfil}</td>
                <td style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: s.statusOperacional === "ativo" ? "var(--green-50)" : "var(--surface-3)", color: s.statusOperacional === "ativo" ? "var(--green)" : "var(--muted)" }}>{s.statusOperacional || "offline"}</span>
                </td>
                <td style={{ textAlign: "center", fontWeight: 500 }}>{s.ligacoes || 0}</td>
                <td style={{ textAlign: "center", color: "var(--green)" }}>{s.atendidas || 0}</td>
                <td style={{ textAlign: "center", color: "var(--indigo)" }}>{s.reunioes || 0}</td>
                <td style={{ textAlign: "center", color: "var(--green)", fontWeight: 600 }}>{s.vendas || 0}</td>
                <td style={{ textAlign: "center" }}>{s.ligacoes ? `${Math.round(((s.reunioes || 0) / s.ligacoes) * 100)}%` : "–"}</td>
                <td style={{ textAlign: "center", color: "var(--muted)" }}>{s.tempoTotal ? `${Math.round(s.tempoTotal / 60)}min` : "–"}</td>
                <td style={{ textAlign: "center", fontSize: 12, color: "var(--muted-2)" }}>{s.ultimaAtividade ? new Date(s.ultimaAtividade).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sellers.some((s) => s.declarados > 0) && (
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--amber)", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle size={12} /> Alguns dados são declarados pelo profissional e não verificados pela infraestrutura.
        </div>
      )}
    </Card>
  );
}

function Consumo({ uso }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>TELEFONIA E CONSUMO</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{uso?.totalMinutos ? Math.round(uso.totalMinutos) : 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Minutos consumidos</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>R$ {uso?.totalCusto?.toFixed(2) || "0,00"}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Custo total</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{uso?.minutosVerificados ? Math.round(uso.minutosVerificados) : 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Minutos pelo navegador · {uso?.ligacoesNavegador || 0} ligações</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--indigo)" }}>{uso?.minutosSimulados ? Math.round(uso.minutosSimulados) : 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Minutos simulados</div>
        </div>
      </div>

      <Card style={{ marginTop: 20, padding: 16, background: "var(--surface-2)", border: "1px dashed var(--border-strong)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Como as ligações são contadas</div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          No modo Navegador, a ligação sai pela operadora da RYCS: atendimento, duração e minutos são medidos automaticamente.
          No modo Celular, o profissional usa a própria linha e informa o resultado; esses dados aparecem como declarados.
        </p>
      </Card>
    </Card>
  );
}

function Configuracoes({ settings, aviso, onAtualizar }) {
  const [form, setForm] = useState({
    ativo: settings?.ativo || false,
    horarioInicio: settings?.horarioInicio || "08:00",
    horarioFim: settings?.horarioFim || "20:00",
    metaDiaria: settings?.metaDiaria || 30,
    maxTentativas: settings?.maxTentativas || 3,
    intervaloRetentativa: settings?.intervaloRetentativa || 3600,
  });

  useEffect(() => {
    if (settings) setForm({
      ativo: !!settings.ativo,
      horarioInicio: settings.horarioInicio || "08:00",
      horarioFim: settings.horarioFim || "20:00",
      metaDiaria: settings.metaDiaria || 30,
      maxTentativas: settings.maxTentativas || 3,
      intervaloRetentativa: settings.intervaloRetentativa || 3600,
    });
  }, [settings]);

  const salvar = async () => {
    try {
      await api.put("/voice/settings", form);
      aviso?.("Configurações salvas.");
      onAtualizar();
    } catch (e) {
      aviso?.("Erro: " + (e.message || "Falha"));
    }
  };

  const campo = (label, key, tipo = "text", extra) => (
    <div style={{ minWidth: 180 }}>
      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{label}</label>
      <input type={tipo} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: tipo === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
        style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13 }} {...extra} />
    </div>
  );

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>CONFIGURAÇÕES DA DISCADORA</div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
          <span style={{ fontWeight: 500, fontSize: 14 }}>Ativar discadora para esta empresa</span>
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        {campo("Horário início", "horarioInicio", "time")}
        {campo("Horário fim", "horarioFim", "time")}
        {campo("Meta diária (ligações)", "metaDiaria", "number")}
        {campo("Máx. tentativas por lead", "maxTentativas", "number")}
        {campo("Intervalo retentativa (seg)", "intervaloRetentativa", "number")}
      </div>

      <button onClick={salvar}
        style={{ padding: "10px 24px", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <Save size={16} /> Salvar configurações
      </button>
    </Card>
  );
}
