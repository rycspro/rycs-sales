import { useEffect, useMemo, useRef, useState } from "react";
import { Award, BarChart3, Bookmark, BriefcaseBusiness, CheckCircle2, ClipboardList, Clock, Eye, Filter, MapPin, MessageCircle, MessageSquare, RotateCcw, Search, Send, ShieldCheck, UserMinus, UserPlus, UserRound, UserRoundSearch, UsersRound, X } from "lucide-react";
import Chat from "../Chat.jsx";
import { api, apiPatch } from "../../lib/api.js";
import { dataCurta, money } from "../../lib/utils.js";

const PERFIL = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "Porta a porta", "sem-exp": "Em formação" };
const STATUS = { aprovado: "Ativo/aprovado", parcial: "Ativo parcial", pendente: "Pendente", recusado: "Removido/recusado" };
const nota = (n) => Number(n || 0);
const arr = (v) => Array.isArray(v) ? v : [];
const norm = (v) => String(v || "").toLocaleLowerCase("pt-BR");
const text = (v, empty = "Não informado") => v || empty;

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("") || "PR";
}

function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  if (isNaN(nasc)) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--;
  return idade > 0 && idade < 100 ? idade : null;
}

function Metric({ label, value }) {
  return <div className="vx-scenario"><span>{label}</span><strong>{value}</strong></div>;
}

function Tags({ itens }) {
  return arr(itens).length ? <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{itens.map((x) => <span key={x} className="vx-chip">{x}</span>)}</div> : <span className="vx-mut">Não informado</span>;
}

export default function ProfissionaisEmpresa({ emp, db, up, aviso, recarregar }) {
  const [listaApi, setListaApi] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [campanhaDestino, setCampanhaDestino] = useState("");
  const [obs, setObs] = useState({});
  const [f, setF] = useState({ busca: "", funcao: "", campanha: "", status: "", performance: "", regiao: "", score: "", genero: "" });
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const buscaRef = useRef(null);
  const [convites, setConvites] = useState({});
  const [salvos, setSalvos] = useState({});
  const [chatRapido, setChatRapido] = useState(null);
  const [mostrarSalvos, setMostrarSalvos] = useState(false);
  const [bioExpandida, setBioExpandida] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const r = await api("/professionals/active");
    if (Array.isArray(r)) {
      setListaApi(r);
      setObs(Object.fromEntries(r.map((p) => [p.id, p.observacaoInterna || ""])));
      setConvites(Object.fromEntries(r.map((p) => [p.id, p.parceria || null])));
    }
    setCarregando(false);
  };

  const toggleSalvo = (e, id) => { e.stopPropagation(); setSalvos((prev) => ({ ...prev, [id]: !prev[id] })); };

  // Tempo médio de resposta por vendedor (calculado das mensagens existentes)
  const temposResposta = useMemo(() => {
    const result = {};
    const msgs = (db.messages || []).filter((m) => m.companyId === emp.id);
    const sellers = [...new Set(msgs.map((m) => m.sellerId))];
    for (const sellerId of sellers) {
      const conv = msgs.filter((m) => m.sellerId === sellerId).sort((a, b) => a.ts - b.ts);
      const gaps = [];
      for (let i = 0; i < conv.length - 1; i++) {
        if (conv[i].de === "empresa" && conv[i + 1].de === "vendedor") {
          gaps.push((conv[i + 1].ts - conv[i].ts) / 1000 / 60);
        }
      }
      if (gaps.length) {
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        result[sellerId] = avg < 60 ? "< 1h" : avg < 240 ? "1–4h" : avg < 1440 ? "< 24h" : "> 24h";
      }
    }
    return result;
  }, [db.messages, emp.id]);

  const enviarConvite = async (e, profId) => {
    e.stopPropagation();
    setConvites((prev) => ({ ...prev, [profId]: "enviando" }));
    const r = await api(`/professionals/${profId}/partnership`, {});
    setConvites((prev) => ({ ...prev, [profId]: r?.status || "pendente" }));
  };

  useEffect(() => { carregar(); }, [emp.id]);

  const campanhasEmpresa = useMemo(() => (db.campaigns || []).filter((c) => c.companyId === emp.id), [db.campaigns, emp.id]);

  const profissionais = useMemo(() => listaApi.map((p) => {
    const local = (db.sellers || []).find((s) => s.id === p.id) || {};
    const submissions = (db.submissions || []).filter((s) => s.companyId === emp.id && s.sellerId === p.id);
    const leads = (db.leads || []).filter((l) => l.companyId === emp.id && l.sellerId === p.id);
    const campanhas = p.campanhas?.length ? p.campanhas : campanhasEmpresa
      .filter((c) => c.candidaturas?.some((a) => a.sellerId === p.id))
      .map((c) => ({ ...c, candidaturaStatus: c.candidaturas?.find((a) => a.sellerId === p.id)?.status }));
    const aprovadas = submissions.filter((s) => s.status === "liberado").length;
    const recusadas = submissions.filter((s) => s.status === "recusado").length;
    const reunioes = submissions.filter((s) => s.status === "liberado" && s.tipo === "agendamento").length;
    const visitas = submissions.filter((s) => s.status === "liberado" && s.tipo === "realizada").length;
    const vendas = submissions.filter((s) => s.status === "liberado" && s.tipo === "venda").length;
    return {
      ...p,
      ...local,
      campanhas,
      campanhasAtivas: p.campanhasAtivas ?? campanhas.filter((c) => c.candidaturaStatus === "aprovado" && c.status !== "encerrada").length,
      tarefasRealizadas: p.tarefasRealizadas ?? submissions.length,
      tarefasAprovadas: p.tarefasAprovadas ?? aprovadas,
      tarefasRecusadas: p.tarefasRecusadas ?? recusadas,
      taxaAprovacao: p.taxaAprovacao ?? (submissions.length ? Math.round(aprovadas / submissions.length * 100) : 0),
      resultadosGerados: p.resultadosGerados ?? reunioes + visitas + vendas + leads.length,
      reunioesGeradas: p.reunioesGeradas ?? reunioes,
      visitas: p.visitas ?? visitas,
      vendas: p.vendas ?? vendas,
      ganhosTotais: p.ganhosTotais ?? submissions.filter((s) => s.status === "liberado").reduce((t, s) => t + Number(s.liquido || s.valor || 0), 0),
      leadsGerados: p.leadsGerados ?? leads.length,
    };
  }), [listaApi, db, emp.id, campanhasEmpresa]);

  const opcoes = useMemo(() => ({
    funcoes: [...new Set(profissionais.map((p) => p.perfil).filter(Boolean))],
    regioes: [...new Set(profissionais.map((p) => [p.cidade, p.estado].filter(Boolean).join(" / ")).filter(Boolean))],
  }), [profissionais]);

  const fitCultural = (p, campanhaId = f.campanha) => {
    const campanha = campanhasEmpresa.find((c) => c.id === campanhaId) || p.campanhas?.[0] || campanhasEmpresa[0] || {};
    const pontos = [];
    const atencao = [];
    let score = 35;
    if (campanha.funcao && p.perfil === campanha.funcao) { score += 18; pontos.push("função alinhada à campanha"); } else if (campanha.funcao) atencao.push("função principal diferente da campanha");
    if (campanha.regiao && norm(`${p.cidade} ${p.estado} ${arr(p.regioes).join(" ")}`).includes(norm(campanha.regiao))) { score += 10; pontos.push("região compatível"); } else if (campanha.regiao) atencao.push("região não confirmada");
    if (campanha.segmento && arr(p.segmentos).some((s) => norm(campanha.segmento).includes(norm(s)) || norm(s).includes(norm(campanha.segmento)))) { score += 14; pontos.push("experiência no segmento"); } else if (campanha.segmento) atencao.push("segmento sem histórico explícito");
    if (arr(p.modalidades).some((m) => norm(`${emp.produto} ${emp.icp} ${campanha.objetivo}`).includes(norm(m)))) { score += 8; pontos.push("preferências próximas da operação"); }
    if (p.disponibilidade) { score += 7; pontos.push("disponibilidade declarada"); } else atencao.push("disponibilidade não informada");
    if (nota(p.nota) >= 80) { score += 8; pontos.push("score operacional alto"); } else atencao.push("score requer acompanhamento");
    return { campanha, percentual: Math.min(100, score), pontos: pontos.length ? pontos : ["dados reais disponíveis, sem compatibilidade forte registrada"], atencao: atencao.length ? atencao : ["sem ponto crítico identificado nos dados disponíveis"] };
  };

  const resumoIA = (p) => {
    const partes = [];
    if (p.perfilComercial?.estilo) partes.push(`Perfil comportamental: ${p.perfilComercial.estilo}.`);
    if (p.experiencia) partes.push(`Experiência: ${p.experiencia}.`);
    const fortes = [...arr(p.skills), ...arr(p.segmentos)].slice(0, 5);
    if (fortes.length) partes.push(`Pontos fortes: ${fortes.join(", ")}.`);
    if (p.perfil || arr(p.modalidades).length) partes.push(`Operação ideal: ${[PERFIL[p.perfil] || p.perfil, ...arr(p.modalidades).slice(0, 3)].filter(Boolean).join(", ")}.`);
    if (p.perfilComercial?.abordagem) partes.push(`Estilo de abordagem: ${p.perfilComercial.abordagem}.`);
    if (p.tarefasRealizadas || p.resultadosGerados) partes.push(`Resultados históricos: ${p.tarefasAprovadas}/${p.tarefasRealizadas} tarefas aprovadas, ${p.resultadosGerados} resultado(s) gerado(s).`);
    return partes.length ? partes.join(" ") : "Sem dados reais suficientes para gerar resumo confiável.";
  };

  const filtrados = useMemo(() => {
    const lista = profissionais.filter((p) => {
      if (mostrarSalvos && !salvos[p.id]) return false;
      const regiao = [p.cidade, p.estado].filter(Boolean).join(" / ");
      const campanhaMatch = !f.campanha || p.campanhas?.some((c) => c.id === f.campanha);
      const performanceOk = !f.performance || (f.performance === "alta" ? p.taxaAprovacao >= 80 : f.performance === "media" ? p.taxaAprovacao >= 50 && p.taxaAprovacao < 80 : p.taxaAprovacao < 50);
      const scoreOk = !f.score || (f.score === "80" ? nota(p.nota) >= 80 : f.score === "50" ? nota(p.nota) >= 50 && nota(p.nota) < 80 : nota(p.nota) < 50);
      return (!f.busca || norm(p.nome).includes(norm(f.busca)))
        && (!f.funcao || p.perfil === f.funcao)
        && campanhaMatch
        && (!f.status || p.status === f.status || p.parceria === f.status || p.aplicacoes?.[emp.id] === f.status)
        && performanceOk
        && (!f.regiao || regiao === f.regiao)
        && scoreOk
        && (!f.genero || p.genero === f.genero);
    });

    const completude = (p) => {
      let pts = 0;
      if (p.foto) pts += 40;
      if (p.nome) pts += 10;
      if (p.perfil) pts += 8;
      if (p.bio || p.experiencia) pts += 8;
      if (p.cidade || p.estado) pts += 6;
      if (arr(p.skills).length) pts += 6;
      if (arr(p.segmentos).length) pts += 5;
      if (arr(p.modalidades).length) pts += 4;
      if (p.disponibilidade) pts += 4;
      if (nota(p.nota) > 0) pts += 4;
      if (p.tarefasRealizadas > 0) pts += 3;
      if (p.whatsapp) pts += 2;
      return pts;
    };

    return lista.sort((a, b) => completude(b) - completude(a));
  }, [profissionais, f, emp.id, mostrarSalvos, salvos]);

  const salvarObs = async (id, valor) => {
    const r = await api(`/professionals/${id}/note`, { observacao: valor });
    if (r?.error) return aviso?.(r.error);
    setListaApi((x) => x.map((p) => p.id === id ? { ...p, observacaoInterna: r.observacao || "" } : p));
    aviso?.("Observação interna salva.");
  };

  const convidarParaCampanha = async (p) => {
    if (!campanhaDestino) return aviso?.("Selecione uma campanha antes de convidar.");
    const r = await api("/applications/invite", { sellerId: p.id, companyId: emp.id, campaignId: campanhaDestino });
    if (r?.error) return aviso?.(r.error);
    recarregar?.();
    aviso?.("Profissional convidado. Candidatura aberta — aprove para liberar acesso.");
  };

  const alterarTime = async (p, status) => {
    if (!p.aplicacoes?.[emp.id] && status !== "pendente") {
      // Não tem candidatura ainda: cria via invite
      const r = await api("/applications/invite", { sellerId: p.id, companyId: emp.id });
      if (r?.error) return aviso?.(r.error);
      recarregar?.();
      return aviso?.("Candidatura criada. Aprove o profissional.");
    }
    const r = await apiPatch("/applications", { sellerId: p.id, companyId: emp.id, status });
    if (r?.error) return aviso?.(r.error);
    up?.((d) => ({ sellers: d.sellers.map((s) => s.id === p.id ? { ...s, aplicacoes: { ...s.aplicacoes, [emp.id]: status } } : s) }));
    recarregar?.();
    aviso?.(status === "aprovado" ? "Profissional aprovado." : status === "pendente" ? "Candidatura reaberta." : "Profissional removido do time.");
  };

  const filtrosAtivos = [f.funcao, f.campanha, f.status, f.performance, f.regiao, f.score].filter(Boolean).length;

  return <div className="vx-fade">
    <div className="vx-page-head">
      <div><h1 className="vx-disp">Profissionais</h1><p>Gestão dos profissionais disponíveis, usando somente dados reais da plataforma.</p></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="vx-chip"><UserRoundSearch size={13} />{filtrados.length} profissionais</span>
        <div style={{ position: "relative" }}>
          {!buscaAberta ? (
            <button
              type="button"
              onClick={() => { setBuscaAberta(true); setTimeout(() => buscaRef.current?.focus(), 60); }}
              style={{
                width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)",
                background: filtrosAtivos ? "var(--brand)" : "var(--surface-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "background .2s", position: "relative"
              }}
              title="Buscar e filtrar"
            >
              <Search size={16} color={filtrosAtivos ? "#fff" : "var(--muted)"} />
              {filtrosAtivos > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -4, background: "var(--brand)",
                  color: "#fff", borderRadius: 20, fontSize: 10, padding: "1px 5px", fontWeight: 700,
                  border: "2px solid var(--surface)", lineHeight: 1.4
                }}>{filtrosAtivos}</span>
              )}
            </button>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 4, borderRadius: 24,
              border: "1px solid var(--border)", background: "var(--surface-2)",
              padding: "0 6px 0 14px", height: 40, width: 320,
              animation: "vxSearchExpand .25s ease-out"
            }}>
              <Search size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
              <input
                ref={buscaRef}
                className="vx-input"
                type="text"
                value={f.busca}
                onChange={(e) => setF({ ...f, busca: e.target.value })}
                placeholder="Buscar por nome…"
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: 14, color: "var(--ink)", height: "100%", padding: 0,
                  borderRadius: 0, boxShadow: "none"
                }}
              />
              {/* Botão filtrar dentro da barra */}
              <button
                type="button"
                onClick={() => setFiltroAberto((v) => !v)}
                title="Filtrar"
                style={{
                  width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: filtrosAtivos ? "var(--brand)" : "transparent",
                  color: filtrosAtivos ? "#fff" : "var(--muted)",
                  position: "relative",
                }}
              >
                <Filter size={13} strokeWidth={2.3} />
                {filtrosAtivos > 0 && (
                  <span style={{
                    position: "absolute", top: 0, right: 0, background: "#fff",
                    color: "var(--brand)", borderRadius: 20, fontSize: 9, padding: "0px 4px", fontWeight: 700,
                    lineHeight: 1.6, border: "1px solid var(--brand)"
                  }}>{filtrosAtivos}</span>
                )}
              </button>
              {/* X fechar */}
              <button
                type="button"
                onClick={() => { setBuscaAberta(false); setF({ ...f, busca: "" }); }}
                style={{
                  width: 28, height: 28, borderRadius: "50%", border: "none",
                  background: "transparent", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0
                }}
                title="Fechar busca"
              >
                <X size={14} color="var(--muted)" />
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className={`vx-btn${mostrarSalvos ? " vx-btn-primary" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
          onClick={() => setMostrarSalvos((v) => !v)}
          title={mostrarSalvos ? "Ver todos" : "Ver salvos"}
        >
          <Bookmark size={14} fill={mostrarSalvos ? "currentColor" : "none"} strokeWidth={2.3} />
          Salvos
          {mostrarSalvos && <span style={{ background: "rgba(255,255,255,.25)", color: "#fff", borderRadius: 20, fontSize: 11, padding: "1px 6px", fontWeight: 700 }}>{Object.values(salvos).filter(Boolean).length}</span>}
        </button>
        {filtrosAtivos > 0 && (
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setF({ busca: f.busca, funcao: "", campanha: "", status: "", performance: "", regiao: "", score: "", genero: "" })}>
            Limpar filtros
          </button>
        )}
      </div>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {/* Filtro gênero */}
      {[
        { value: "", label: "Todos", Icon: UsersRound },
        { value: "feminino", label: "Mulher", Icon: UserRound, cor: "#e74694" },
        { value: "masculino", label: "Homem", Icon: UserRound, cor: "#2563eb" },
      ].map((opt) => {
        const ativo = f.genero === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setF({ ...f, genero: opt.value })}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 10,
              border: ativo ? "2px solid " + (opt.cor || "var(--brand)") : "1px solid var(--border)",
              background: ativo ? (opt.cor || "var(--brand)") + "12" : "var(--surface-2)",
              color: ativo ? (opt.cor || "var(--brand)") : "var(--muted)",
              fontWeight: ativo ? 600 : 500, fontSize: 13,
              cursor: "pointer", transition: "all .2s"
            }}
          >
            <opt.Icon size={15} color={ativo ? (opt.cor || "var(--brand)") : "var(--muted)"} />
            {opt.label}
          </button>
        );
      })}

      {/* Divisor */}
      <div style={{ width: 1, height: 28, background: "var(--border)", flexShrink: 0, margin: "0 2px" }} />

      {/* Filtro função */}
      {[
        { value: "", label: "Todos" },
        { value: "sdr", label: "SDR" },
        { value: "closer", label: "Closer" },
        { value: "bdr", label: "BDR" },
      ].map((opt) => {
        const ativo = f.funcao === opt.value;
        return (
          <button
            key={`fn-${opt.value}`}
            type="button"
            onClick={() => setF({ ...f, funcao: opt.value === "" ? "" : (ativo ? "" : opt.value) })}
            style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: ativo ? 600 : 500,
              border: ativo ? "2px solid var(--brand)" : "1px solid var(--border)",
              background: ativo ? "var(--brand-50)" : "var(--surface-2)",
              color: ativo ? "var(--brand)" : "var(--muted)",
              cursor: "pointer", transition: "all .2s"
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>

    {filtroAberto && (
      <div className="vx-card vx-filterbar" style={{ padding: 14, maxWidth: "none", marginBottom: 16 }}>
        <label><span className="vx-label">Função</span><select className="vx-input" value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value })}><option value="">Todas</option>{opcoes.funcoes.map((x) => <option key={x} value={x}>{PERFIL[x] || x}</option>)}</select></label>
        <label><span className="vx-label">Campanha</span><select className="vx-input" value={f.campanha} onChange={(e) => setF({ ...f, campanha: e.target.value })}><option value="">Todas</option>{campanhasEmpresa.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></label>
        <label><span className="vx-label">Status</span><select className="vx-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todos</option><option value="aprovado">Ativo/aprovado</option><option value="pendente">Pendente</option><option value="recusado">Removido/recusado</option></select></label>
        <label><span className="vx-label">Performance</span><select className="vx-input" value={f.performance} onChange={(e) => setF({ ...f, performance: e.target.value })}><option value="">Todas</option><option value="alta">Alta aprovação</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>
        <label><span className="vx-label">Região</span><select className="vx-input" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })}><option value="">Todas</option>{opcoes.regioes.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
        <label><span className="vx-label">Score</span><select className="vx-input" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })}><option value="">Todos</option><option value="80">80+ (verde)</option><option value="50">50-79 (amarelo)</option><option value="0">Abaixo de 50</option></select></label>
      </div>
    )}

    {carregando ? <div className="vx-card vx-skeleton" style={{ height: 280 }} /> : (
      <div className="vx-prof-grid">
        {filtrados.map((p) => {
          const scoreVal = Number(p.nota ?? 100);
          const scoreCor = scoreVal >= 80 ? "#0E7490" : scoreVal >= 50 ? "#b45309" : "#dc2626";
          const scoreBg  = scoreVal >= 80 ? "#ecfeff" : scoreVal >= 50 ? "#fffbeb" : "#fef2f2";
          const fit = fitCultural(p);
          const conviteStatus = convites[p.id];
          return (
            <article key={p.id} className="vx-prof-card"
              onClick={() => { setSelecionado(p); setCampanhaDestino(""); }}>

              {/* FOTO — 220px fixos, qualquer proporção é cortada */}
              <div className="vx-prof-card__img">
                {p.foto
                  ? <img src={p.foto} alt={p.nome} loading="lazy" decoding="async" />
                  : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 36, fontWeight: 700, color: "var(--brand)", fontFamily: "var(--font-disp)" }}>{iniciais(p.nome)}</div>
                }
                <span style={{ position: "absolute", top: 10, right: 10, background: "#0E7490", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px", letterSpacing: ".01em" }}>
                  {scoreVal}
                </span>
              </div>

              {/* CONTEÚDO — flex:1, botão sempre no fundo */}
              <div className="vx-prof-card__body">
                <div className="vx-prof-card__info">
                  {/* nome + idade */}
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{capitalizar([p.nome, p.sobrenome].filter(Boolean).join(" ") || p.nome)}</span>
                    {calcularIdade(p.dataNascimento) !== null && (
                      <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{calcularIdade(p.dataNascimento)} anos</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}><b style={{ color: "var(--ink-2)", fontWeight: 600 }}>Função:</b> {PERFIL[p.perfil] || p.perfil || "Não informada"}</span>
                  {(p.bio || p.experiencia) && (
                    <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 1 }}>
                      {(p.bio || p.experiencia).slice(0, 120)}
                    </span>
                  )}
                  {/* barra de compatibilidade */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${fit.percentual}%`, borderRadius: 99, background: fit.percentual >= 70 ? "var(--brand)" : fit.percentual >= 40 ? "#F59E0B" : "#EF4444" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{fit.percentual}% compat.</span>
                  </div>
                  {/* tempo de resposta */}
                  {temposResposta[p.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <Clock size={10} color="var(--muted)" />
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Resp. {temposResposta[p.id]}</span>
                    </div>
                  )}
                </div>

                {/* BOTÃO — sempre no fundo via margin-top:auto */}
                <div className="vx-prof-card__actions" style={{ display: "flex", gap: 6 }}>
                  {conviteStatus === "aprovado"
                    ? <button className="vx-prof-card__btn vx-prof-card__btn--success" disabled style={{ flex: 1 }}>✓ Parceria ativa</button>
                    : conviteStatus === "pendente"
                    ? <button className="vx-prof-card__btn vx-prof-card__btn--muted" disabled style={{ flex: 1 }}>Enviado · aguardando</button>
                    : conviteStatus === "recusado"
                    ? <button className="vx-prof-card__btn vx-prof-card__btn--danger" onClick={(e) => enviarConvite(e, p.id)} style={{ flex: 1 }}>Reenviar convite</button>
                    : <button className="vx-prof-card__btn" disabled={conviteStatus === "enviando"} onClick={(e) => enviarConvite(e, p.id)}
                        style={{ flex: 1, background: "transparent", color: "#64748b", border: "1.5px solid #cbd5e1", opacity: conviteStatus === "enviando" ? 0.6 : 1, fontWeight: 400 }}>
                        {conviteStatus === "enviando" ? "Enviando…" : "Enviar Convite"}
                      </button>
                  }
                  <button
                    className="vx-prof-card__btn"
                    onClick={(e) => { e.stopPropagation(); setChatRapido({ sellerId: p.id, nome: p.nome, foto: p.foto }); }}
                    title="Enviar mensagem"
                    style={{ width: 44, minWidth: 44, flex: "none", background: "transparent", color: "var(--muted)", border: "1.5px solid var(--border)" }}
                  >
                    <MessageCircle size={14} />
                  </button>
                  <button
                    className="vx-prof-card__btn"
                    onClick={(e) => toggleSalvo(e, p.id)}
                    title={salvos[p.id] ? "Remover dos salvos" : "Salvar profissional"}
                    style={{ width: 44, minWidth: 44, flex: "none", background: salvos[p.id] ? "var(--brand)" : "transparent", color: salvos[p.id] ? "#fff" : "var(--muted)", border: salvos[p.id] ? "none" : "1.5px solid var(--border)" }}
                  >
                    <Bookmark size={14} fill={salvos[p.id] ? "#fff" : "none"} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    )}

    {!carregando && !filtrados.length && <div className="vx-card" style={{ padding: 28, textAlign: "center" }}><UserRoundSearch size={28} color="var(--muted)" /><h3 className="vx-disp">Nenhum profissional encontrado</h3><p className="vx-mut">Ajuste os filtros desta página.</p></div>}

    {selecionado && (() => {
      const p = profissionais.find((x) => x.id === selecionado.id) || selecionado;
      const fit = fitCultural(p);
      const nomeCompleto = capitalizar([p.nome, p.sobrenome].filter(Boolean).join(" ") || p.nome);
      const idadeP = calcularIdade(p.dataNascimento);
      return <div className="vx-overlay" onClick={() => setSelecionado(null)}>
        <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1020 }}>

          {/* ── Cabeçalho: fechar ── */}
          <div className="vx-row" style={{ marginBottom: 16 }}>
            <div className="vx-eyebrow">Perfil completo</div>
            <button className="vx-btn vx-btn-ghost" onClick={() => setSelecionado(null)}><X size={16} /></button>
          </div>

          {/* ── HERO: foto (3:4) + coluna direita ── */}
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

            {/* Coluna esquerda — somente foto 3:4 */}
            <div style={{ width: 180, minWidth: 180, flexShrink: 0 }}>
              <div style={{ width: 180, height: 240, borderRadius: 16, overflow: "hidden", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {p.foto
                  ? <img src={p.foto} alt={nomeCompleto} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
                  : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 52, fontWeight: 700, color: "var(--brand)", fontFamily: "var(--font-disp)" }}>{iniciais(p.nome)}</div>
                }
              </div>
            </div>

            {/* Coluna direita — nome, bio, canais */}
            <div style={{ flex: 1, minWidth: 240 }}>
              {/* A. Nome */}
              <h2 className="vx-disp" style={{ margin: "0 0 12px", fontSize: 24 }}>{nomeCompleto}</h2>

              {/* B. Biografia (clamp 6 linhas) */}
              <div style={{ marginBottom: 12 }}>
                {(p.bio || p.experiencia) ? (
                  <>
                    <p className="vx-mut" style={{
                      fontSize: 13, lineHeight: 1.65, margin: 0,
                      display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical",
                      overflow: "hidden", textAlign: "justify",
                      maxHeight: "calc(1.65em * 6)",
                    }}>{p.bio || p.experiencia}</p>
                    {(p.bio || p.experiencia).length > 320 && (
                      <button
                        type="button"
                        onClick={() => setBioExpandida(true)}
                        style={{ background: "none", border: "none", padding: 0, marginTop: 4, fontSize: 12.5, color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}
                      >Ler biografia completa →</button>
                    )}
                  </>
                ) : (
                  <p className="vx-mut" style={{ fontSize: 13, margin: 0, fontStyle: "italic" }}>Apresentação em atualização.</p>
                )}
              </div>

              {/* C. Canais de Atendimento */}
              {(() => {
                const canais = [
                  p.whats && { label: "WhatsApp", icon: "📱", href: `https://wa.me/${p.whats.replace(/\D/g, "")}` },
                  p.email && { label: "E-mail", icon: "✉️", href: `mailto:${p.email}` },
                  arr(p.modalidades).some((m) => /video|confer/i.test(m)) && { label: "Videoconferência", icon: "🎥", href: null },
                  p.telefone && { label: "Telefone", icon: "📞", href: `tel:${p.telefone}` },
                ].filter(Boolean);
                return canais.length > 0 ? (
                  <div>
                    <div className="vx-eyebrow" style={{ marginBottom: 7 }}>Canais de Atendimento</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {canais.map(({ label, icon, href }) =>
                        href
                          ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="vx-chip" style={{ fontSize: 12, textDecoration: "none", color: "var(--ink)" }}>{icon} {label}</a>
                          : <span key={label} className="vx-chip" style={{ fontSize: 12 }}>{icon} {label}</span>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* ── Dados do Perfil — card horizontal largura total ── */}
          <div className="vx-card" style={{ padding: "14px 18px", marginTop: 20 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 12 }}>Dados do Perfil</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px 20px", fontSize: 13 }}>
              <div>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>Função</div>
                <b>{text(PERFIL[p.perfil] || p.perfil)}</b>
              </div>
              <div>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>Localização</div>
                <b>{text([p.cidade, p.estado].filter(Boolean).join(" / "), "—")}</b>
              </div>
              {p.disponibilidade && (
                <div>
                  <div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>Disponibilidade</div>
                  <b>{p.disponibilidade}</b>
                </div>
              )}
              {arr(p.segmentos).length > 0 && (
                <div style={{ gridColumn: "span 2" }}>
                  <div className="vx-mut" style={{ fontSize: 11, marginBottom: 5 }}>Segmentos</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {arr(p.segmentos).map((s) => <span key={s} className="vx-chip" style={{ fontSize: 11 }}>{s}</span>)}
                  </div>
                </div>
              )}
              {arr(p.skills).length > 0 && (
                <div style={{ gridColumn: "span 2" }}>
                  <div className="vx-mut" style={{ fontSize: 11, marginBottom: 5 }}>Habilidades</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {arr(p.skills).map((s) => <span key={s} className="vx-chip" style={{ fontSize: 11 }}>{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Indicadores de Desempenho — seção independente ── */}
          <div style={{ marginTop: 16 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 12 }}>Indicadores de Desempenho</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {[
                { label: "Score", val: p.nota ?? 100 },
                { label: "Tarefas", val: `${p.tarefasAprovadas || 0}/${p.tarefasRealizadas || 0}` },
                { label: "Aprovação", val: `${p.taxaAprovacao || 0}%` },
                { label: "Vendas", val: p.vendas || 0 },
                { label: "Compatibilidade", val: `${fit.percentual}%` },
              ].map(({ label, val }) => (
                <div key={label} className="vx-card" style={{ padding: "12px 8px", textAlign: "center" }}>
                  <div className="vx-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--brand)" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Modal secundário: biografia completa ── */}
          {bioExpandida && (
            <div className="vx-overlay" onClick={() => setBioExpandida(false)} style={{ zIndex: 1100 }}>
              <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <div className="vx-row" style={{ marginBottom: 16 }}>
                  <h3 className="vx-disp" style={{ margin: 0 }}>Biografia — {nomeCompleto}</h3>
                  <button className="vx-btn vx-btn-ghost" onClick={() => setBioExpandida(false)}><X size={16} /></button>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--ink)", margin: 0, whiteSpace: "pre-wrap", textAlign: "justify" }}>{p.bio || p.experiencia}</p>
              </div>
            </div>
          )}

          {/* ── Métricas completas ── */}
          <div className="vx-grid vx-g4" style={{ marginTop: 20 }}>
            <Metric label="Score geral" value={p.nota ?? 100} />
            <Metric label="Tarefas aprovadas" value={`${p.tarefasAprovadas || 0}/${p.tarefasRealizadas || 0}`} />
            <Metric label="Taxa de aprovação" value={`${p.taxaAprovacao || 0}%`} />
            <Metric label="Ganhos totais" value={money(p.ganhosTotais || 0)} />
            <Metric label="Reuniões" value={p.reunioesGeradas || 0} />
            <Metric label="Visitas" value={p.visitas || 0} />
            <Metric label="Vendas" value={p.vendas || 0} />
            <Metric label="Leads" value={p.leadsGerados || 0} />
          </div>

          <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Resumo com IA</h3>
              <p className="vx-mut" style={{ lineHeight: 1.6 }}>{resumoIA(p)}</p>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Fit cultural</h3>
              <div className="vx-row"><b className="vx-mono" style={{ fontSize: 24 }}>{fit.percentual}%</b><span className="vx-chip">{fit.campanha?.titulo || "campanha de referência"}</span></div>
              <p className="vx-mut">Compatibilidade: {fit.pontos.join("; ")}.</p>
              <p className="vx-mut">Pontos de atenção: {fit.atencao.join("; ")}.</p>
            </section>

            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Certificações</h3>
              {p.certificacoes?.length ? p.certificacoes.map((c) => <span key={`${c.funcao}-${c.percentual}`} className="vx-chip" style={{ marginRight: 6, marginBottom: 6 }}><CheckCircle2 size={12} />{PERFIL[c.funcao] || c.funcao} · {c.percentual}%</span>) : <p className="vx-mut">Nenhuma certificação publicada.</p>}
              <p className="vx-mut" style={{ marginTop: 8 }}>Treinamentos concluídos: {p.certificacoes?.length || 0}</p>
            </section>
          </div>

          <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Histórico e resultados</h3>
              {p.campanhas?.length ? <div className="vx-compact-list">{p.campanhas.slice(0, 8).map((c) => <div key={c.id}><div><b>{c.titulo}</b><span>{PERFIL[c.funcao] || c.funcao || "Função não informada"} · {c.regiao || "sem região"}</span></div><span className="vx-chip">{c.candidaturaStatus || c.status}</span></div>)}</div> : <p className="vx-mut">Sem histórico de campanhas nesta empresa.</p>}
              <p className="vx-mut">Tarefas recusadas: {p.tarefasRecusadas || 0} · Leads: {p.leadsGerados || 0}</p>
            </section>

            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Treinamentos, feedbacks e certificações</h3>
              {p.certificacoes?.length ? p.certificacoes.map((c) => <span key={`${c.funcao}-${c.percentual}`} className="vx-chip" style={{ marginRight: 6, marginBottom: 6 }}><CheckCircle2 size={12} />{PERFIL[c.funcao] || c.funcao} · {c.percentual}%</span>) : <p className="vx-mut">Nenhuma certificação publicada.</p>}
              <p className="vx-mut">Treinamentos concluídos: {p.certificacoes?.length || 0}</p>
              <p className="vx-mut">Feedbacks: não há feedbacks publicados para esta empresa.</p>
            </section>
          </div>

          <section className="vx-card" style={{ padding: 14, marginTop: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>Ações</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="vx-btn vx-btn-sm" onClick={() => alterarTime(p, "aprovado")}><UserPlus size={13} />Aprovar profissional</button>
              <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => alterarTime(p, "recusado")}><UserMinus size={13} />Remover</button>
              {p.aplicacoes?.[emp.id] === "recusado" && (
                <button className="vx-btn vx-btn-sm" onClick={() => alterarTime(p, "pendente")}><RotateCcw size={13} />Reabrir candidatura</button>
              )}
              <button className="vx-btn vx-btn-sm" onClick={() => aviso?.("Histórico exibido no modal.")}><ClipboardList size={13} />Visualizar histórico</button>
              <button className="vx-btn vx-btn-sm" onClick={() => aviso?.("Treinamentos exibidos no modal.")}><Award size={13} />Visualizar treinamentos</button>
              <button className="vx-btn vx-btn-sm" onClick={() => aviso?.("Resultados exibidos no modal.")}><BarChart3 size={13} />Visualizar resultados</button>
            </div>
            <div className="vx-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <select className="vx-input" style={{ maxWidth: 280 }} value={campanhaDestino} onChange={(e) => setCampanhaDestino(e.target.value)}>
                <option value="">Selecionar campanha para convidar</option>
                {campanhasEmpresa.filter((c) => c.status === "ativa").map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => convidarParaCampanha(p)}><Send size={13} />Convidar para campanha</button>
            </div>
            <textarea className="vx-input" style={{ marginTop: 10, minHeight: 74 }} value={obs[p.id] || ""} onChange={(e) => setObs({ ...obs, [p.id]: e.target.value })} placeholder="Observação interna" />
            <button className="vx-btn vx-btn-sm" style={{ marginTop: 8 }} onClick={() => salvarObs(p.id, obs[p.id] || "")}><MessageSquare size={13} />Salvar observação interna</button>
          </section>
        </div>
      </div>;
    })()}

    {/* ── Popup de chat rápido ── */}
    {chatRapido && (
      <div style={{
        position: "fixed", bottom: 20, right: 20, width: 340, zIndex: 300,
        background: "var(--surface)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,.18)",
        border: "1px solid var(--border)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          {chatRapido.foto
            ? <img src={chatRapido.foto} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} alt="" />
            : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{iniciais(chatRapido.nome)}</div>
          }
          <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>{capitalizar(chatRapido.nome)}</span>
          <button className="vx-btn vx-btn-ghost" style={{ padding: "4px 6px" }} onClick={() => setChatRapido(null)}><X size={14} /></button>
        </div>
        <Chat empresa={emp} sellerId={chatRapido.sellerId} db={db} up={up} de="empresa" />
      </div>
    )}
  </div>;
}
