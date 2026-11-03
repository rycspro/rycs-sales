import { useEffect, useMemo, useState } from "react";
import { Award, BarChart3, BriefcaseBusiness, CheckCircle2, ClipboardList, Eye, Filter, MapPin, MessageSquare, RotateCcw, Search, Send, ShieldCheck, UserMinus, UserPlus, UserRoundSearch, X } from "lucide-react";
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
  const [f, setF] = useState({ busca: "", funcao: "", campanha: "", status: "", performance: "", regiao: "", score: "" });
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [convites, setConvites] = useState({});

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
        && scoreOk;
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
  }, [profissionais, f, emp.id]);

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
      <span className="vx-chip"><UserRoundSearch size={13} />{filtrados.length} profissionais</span>
    </div>

    <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: 13, color: "var(--muted)", pointerEvents: "none" }} />
        <input className="vx-input" style={{ paddingLeft: 32 }} placeholder="Buscar por nome…" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} />
      </div>
      <button
        type="button"
        className={`vx-btn${filtrosAtivos ? " vx-btn-primary" : ""}`}
        style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        onClick={() => setFiltroAberto((v) => !v)}
      >
        <Filter size={14} strokeWidth={2.3} />
        Filtrar
        {filtrosAtivos > 0 && <span style={{ background: filtrosAtivos ? "rgba(255,255,255,.25)" : "var(--brand)", color: "#fff", borderRadius: 20, fontSize: 11, padding: "1px 6px", fontWeight: 700 }}>{filtrosAtivos}</span>}
      </button>
      {filtrosAtivos > 0 && (
        <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ alignSelf: "center" }} onClick={() => setF({ busca: f.busca, funcao: "", campanha: "", status: "", performance: "", regiao: "", score: "" })}>
          Limpar filtros
        </button>
      )}
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
      <div className="vx-prof-grid" style={{ gridAutoRows: "1fr" }}>
        {filtrados.map((p) => {
          const scoreVal = nota(p.nota) || 100;
          const scoreCor = scoreVal >= 80 ? "#0E7490" : scoreVal >= 50 ? "#b45309" : "#dc2626";
          const scoreBg  = scoreVal >= 80 ? "#ecfeff" : scoreVal >= 50 ? "#fffbeb" : "#fef2f2";
          return (
            <article key={p.id} className="vx-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer" }}
              onClick={() => { setSelecionado(p); setCampanhaDestino(""); }}>
              {/* foto */}
              <div style={{ width: "100%", aspectRatio: "3/1", background: "var(--surface-2)", position: "relative", flexShrink: 0 }}>
                {p.foto
                  ? <img src={p.foto} alt={p.nome} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 40, fontWeight: 700, color: "var(--brand)", fontFamily: "var(--font-disp)", letterSpacing: -1 }}>{iniciais(p.nome)}</div>
                }
                {/* badge score canto superior direito */}
                <span style={{ position: "absolute", top: 10, right: 10, background: "#0E7490", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 11px", backdropFilter: "blur(4px)", letterSpacing: ".01em" }}>
                  {scoreVal}
                </span>
              </div>

              {/* info */}
              <div style={{ padding: "12px 14px 0", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                {/* linha 1: nome + idade */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.nome}</span>
                  {calcularIdade(p.dataNascimento) !== null && (
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{calcularIdade(p.dataNascimento)} anos</span>
                  )}
                </div>
                {/* linha 2: função */}
                <span style={{ fontSize: 12, color: "var(--muted)" }}><b style={{ color: "var(--ink-2)", fontWeight: 600 }}>Função:</b> {PERFIL[p.perfil] || p.perfil || "Não informada"}</span>
                {/* linha 3: localização */}
                {[p.cidade, p.estado].filter(Boolean).length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}><b style={{ color: "var(--ink-2)", fontWeight: 600 }}>Local:</b> {[p.cidade, p.estado].filter(Boolean).join(", ")}</span>
                )}
                {/* linha 4: compatibilidade */}
                <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${fitCultural(p).percentual}%`, borderRadius: 99, background: fitCultural(p).percentual >= 70 ? "var(--brand)" : fitCultural(p).percentual >= 40 ? "#F59E0B" : "#EF4444" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{fitCultural(p).percentual}% compat.</span>
                </div>
                {/* botão convite */}
                {(() => {
                  const status = convites[p.id];
                  if (status === "aprovado") return (
                    <div style={{ marginTop: 6, padding: "7px 0 0", borderTop: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--brand)", textAlign: "center" }}>✓ Parceria ativa</div>
                  );
                  if (status === "pendente") return (
                    <div style={{ marginTop: 6, padding: "7px 0 0", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>Convite enviado · aguardando</div>
                  );
                  if (status === "recusado") return (
                    <button onClick={(e) => enviarConvite(e, p.id)} style={{ marginTop: 6, width: "100%", padding: "7px 0", borderTop: "1px solid var(--border)", background: "none", border: "none", borderRadius: 0, fontSize: 12, color: "#EF4444", cursor: "pointer", fontWeight: 600 }}>Reenviar convite</button>
                  );
                  return (
                    <button onClick={(e) => enviarConvite(e, p.id)} disabled={status === "enviando"}
                      style={{ marginTop: 6, width: "100%", padding: "8px 0", background: "var(--brand)", color: "#fff", border: "none", borderRadius: "0 0 10px 10px", fontSize: 13, fontWeight: 700, cursor: status === "enviando" ? "default" : "pointer", opacity: status === "enviando" ? 0.7 : 1, letterSpacing: ".01em" }}>
                      {status === "enviando" ? "Enviando…" : "Enviar Convite"}
                    </button>
                  );
                })()}
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
      return <div className="vx-overlay" onClick={() => setSelecionado(null)}>
        <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980 }}>
          <div className="vx-row"><div><div className="vx-eyebrow">Perfil completo</div><h2 className="vx-disp" style={{ margin: "4px 0" }}>{p.nome}</h2></div><button className="vx-btn vx-btn-ghost" onClick={() => setSelecionado(null)}><X size={16} /></button></div>
          <div className="vx-row" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div className="vx-avatar" style={{ width: 76, height: 76, fontSize: 22, ...(p.foto ? { padding: 0, overflow: "hidden" } : {}) }}>{p.foto ? <img src={p.foto} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciais(p.nome)}</div>
            <div style={{ flex: 1, minWidth: 240 }}><p className="vx-mut" style={{ marginTop: 0 }}>{text(p.bio || p.experiencia, "Apresentação em atualização.")}</p><Tags itens={[PERFIL[p.perfil] || p.perfil, ...arr(p.modalidades)].filter(Boolean)} /></div>
          </div>

          <div className="vx-grid vx-g4" style={{ marginTop: 14 }}>
            <Metric label="Score geral" value={p.nota || 0} />
            <Metric label="Tarefas aprovadas" value={`${p.tarefasAprovadas || 0}/${p.tarefasRealizadas || 0}`} />
            <Metric label="Taxa de aprovação" value={`${p.taxaAprovacao || 0}%`} />
            <Metric label="Ganhos totais" value={money(p.ganhosTotais || 0)} />
            <Metric label="Reuniões" value={p.reunioesGeradas || 0} />
            <Metric label="Visitas" value={p.visitas || 0} />
            <Metric label="Vendas" value={p.vendas || 0} />
            <Metric label="Nota média" value={p.nota || "N/D"} />
          </div>

          <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Dados do perfil</h3>
              <p><MapPin size={13} style={{ verticalAlign: -2 }} /> {text([p.cidade, p.estado].filter(Boolean).join(" / "), "Cidade/região não informada")}</p>
              <p><BriefcaseBusiness size={13} style={{ verticalAlign: -2 }} /> Função principal: {text(PERFIL[p.perfil] || p.perfil)}</p>
              <p>Outras funções</p><Tags itens={arr(p.skills)} />
              <p>Disponibilidade: {text(p.disponibilidade)}</p>
              <p>Preferências e operações preferidas</p><Tags itens={arr(p.modalidades)} />
              <p>Segmentos onde atuou</p><Tags itens={arr(p.segmentos)} />
            </section>

            <section className="vx-card" style={{ padding: 14 }}>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Resumo com IA</h3>
              <p className="vx-mut" style={{ lineHeight: 1.6 }}>{resumoIA(p)}</p>
              <h3 className="vx-disp" style={{ fontSize: 15 }}>Fit cultural</h3>
              <div className="vx-row"><b className="vx-mono" style={{ fontSize: 24 }}>{fit.percentual}%</b><span className="vx-chip">{fit.campanha?.titulo || "campanha de referência"}</span></div>
              <p className="vx-mut">Compatibilidade: {fit.pontos.join("; ")}.</p>
              <p className="vx-mut">Pontos de atenção: {fit.atencao.join("; ")}.</p>
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
  </div>;
}
