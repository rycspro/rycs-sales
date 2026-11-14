import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Bookmark, BriefcaseBusiness, CheckCircle2, Clock, Copy, Eye, Filter, Link2, Lock, MapPin, MessageCircle, MessageSquare, Search, Send, Share2, ShieldCheck, UserPlus, UserRound, UserRoundSearch, UsersRound, X } from "lucide-react";
import Chat from "../Chat.jsx";
import { api, apiPatch } from "../../lib/api.js";
import { dataCurta, money } from "../../lib/utils.js";
import { compatibilidadeSellerCampanha } from "../../../shared/compatibilidade.js";
import FichaProfissional from "./FichaProfissional.jsx";

const PERFIL = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "Porta a porta", "sem-exp": "Em formação" };

// Bandeira do país do profissional (emoji). Default Brasil, que é o padrão do cadastro.
const BANDEIRAS = {
  "brasil": "🇧🇷", "brazil": "🇧🇷", "portugal": "🇵🇹", "argentina": "🇦🇷",
  "estados unidos": "🇺🇸", "eua": "🇺🇸", "usa": "🇺🇸", "united states": "🇺🇸",
  "méxico": "🇲🇽", "mexico": "🇲🇽", "espanha": "🇪🇸", "spain": "🇪🇸",
  "chile": "🇨🇱", "colômbia": "🇨🇴", "colombia": "🇨🇴", "peru": "🇵🇪",
  "uruguai": "🇺🇾", "paraguai": "🇵🇾", "bolívia": "🇧🇴", "bolivia": "🇧🇴",
};
const bandeiraPais = (p) => BANDEIRAS[String(p || "").trim().toLowerCase()] || "🌎";
const STATUS = { aprovado: "Ativo/aprovado", parcial: "Ativo parcial", pendente: "Pendente", recusado: "Removido/recusado" };
const nota = (n) => Number(n || 0);
const arr = (v) => Array.isArray(v) ? v : [];
// Minúsculo e SEM acentos: busca por "monica" encontra "Mônica", "jose" → "José" etc.
const norm = (v) => String(v || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

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

export default function ProfissionaisEmpresa({ emp, db, up, aviso, recarregar, bloqueado, irParaPlano }) {
  const [popupPlano, setPopupPlano] = useState(false);
  const [listaApi, setListaApi] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [campanhaDestino, setCampanhaDestino] = useState("");
  const [obs, setObs] = useState({});
  const [f, setF] = useState({ busca: "", funcao: "", campanha: "", status: "", performance: "", regiao: "", score: "", genero: "", pais: "" });
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [ordenarAberto, setOrdenarAberto] = useState(false);
  const [ordenar, setOrdenar] = useState({ campo: "", direcao: "desc" }); // campo: "" | score | compatibilidade | idade
  const [buscaAberta, setBuscaAberta] = useState(false);
  const buscaRef = useRef(null);
  const [convites, setConvites] = useState({});
  const [salvos, setSalvos] = useState({});
  const [chatRapido, setChatRapido] = useState(null);
  const [mostrarSalvos, setMostrarSalvos] = useState(false);
  const [bioExpandida, setBioExpandida] = useState(false);
  const [convidarAberto, setConvidarAberto] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });

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

  const opcoes = useMemo(() => {
    const estadoMap = new Map();
    profissionais.forEach((p) => {
      const raw = (p.estado || "").trim();
      if (!raw) return;
      const key = norm(raw);
      if (!estadoMap.has(key) || raw.length > estadoMap.get(key).length) estadoMap.set(key, raw);
    });
    return {
      funcoes: [...new Set(profissionais.map((p) => p.perfil).filter(Boolean))],
      regioes: [...estadoMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, label]) => ({ key, label })),
      paises: [...new Set(profissionais.map((p) => p.pais).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [profissionais]);

  const fitCultural = (p, campanhaId = f.campanha) => {
    const campanha = campanhasEmpresa.find((c) => c.id === campanhaId) || p.campanhas?.[0] || campanhasEmpresa[0] || {};
    return { campanha, ...compatibilidadeSellerCampanha(p, campanha, emp) };
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
      const regiao = p.estado || "";
      const campanhaMatch = !f.campanha || p.campanhas?.some((c) => c.id === f.campanha);
      const performanceOk = !f.performance || (f.performance === "alta" ? p.taxaAprovacao >= 80 : f.performance === "media" ? p.taxaAprovacao >= 50 && p.taxaAprovacao < 80 : p.taxaAprovacao < 50);
      const st = Number(p.scoreTriagem ?? 0);
      const scoreOk = !f.score || (f.score === "80" ? st >= 80 : f.score === "50" ? st >= 50 && st < 80 : st < 50);
      return (!f.busca || norm(p.nome).includes(norm(f.busca)))
        && (!f.funcao || p.perfil === f.funcao)
        && campanhaMatch
        && (!f.status || p.status === f.status || p.parceria === f.status || p.aplicacoes?.[emp.id] === f.status)
        && performanceOk
        && (!f.regiao || norm(regiao) === f.regiao)
        && scoreOk
        && (!f.pais || p.pais === f.pais)
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

    // Classificação escolhida pelo usuário (score / compatibilidade / idade).
    if (ordenar.campo) {
      const valor = (p) => {
        if (ordenar.campo === "score") return Number(p.scoreTriagem ?? 0);
        if (ordenar.campo === "compatibilidade") return Number(fitCultural(p).percentual ?? 0);
        if (ordenar.campo === "idade") return calcularIdade(p.dataNascimento) ?? -1;
        return 0;
      };
      const sinal = ordenar.direcao === "asc" ? 1 : -1;
      return [...lista].sort((a, b) => (valor(a) - valor(b)) * sinal || completude(b) - completude(a));
    }

    return lista.sort((a, b) => completude(b) - completude(a));
  }, [profissionais, f, emp.id, mostrarSalvos, salvos, ordenar, campanhasEmpresa]);

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

  const filtrosAtivos = [f.genero, f.pais, f.funcao, f.campanha, f.status, f.performance, f.regiao, f.score].filter(Boolean).length;

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
              {/* X fechar */}
              <button
                type="button"
                onClick={() => { setBuscaAberta(false); setFiltroAberto(false); setF({ busca: "", funcao: "", campanha: "", status: "", performance: "", regiao: "", score: "", genero: "", pais: "" }); }}
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
        <button
          type="button"
          className={`vx-btn${filtroAberto ? " vx-btn-primary" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
          onClick={() => setFiltroAberto((v) => !v)}
          title="Filtrar profissionais"
        >
          <Filter size={14} strokeWidth={2.3} />
          Filtrar
          {filtrosAtivos > 0 && <span style={{ background: filtroAberto ? "rgba(255,255,255,.25)" : "var(--brand)", color: "#fff", borderRadius: 20, fontSize: 11, padding: "1px 6px", fontWeight: 700 }}>{filtrosAtivos}</span>}
        </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={`vx-btn${ordenar.campo ? " vx-btn-primary" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
            onClick={() => setOrdenarAberto((v) => !v)}
            title="Classificar profissionais"
          >
            <ArrowUpDown size={14} strokeWidth={2.3} />
            Classificar
          </button>
          {ordenarAberto && (
            <>
              <div onClick={() => setOrdenarAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
              <div className="vx-card" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, width: 232, padding: 12, boxShadow: "0 10px 28px rgba(0,0,0,.14)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <span className="vx-label">Classificar por</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 7 }}>
                    {[["score", "Score"], ["compatibilidade", "Compatibilidade"], ["idade", "Idade"]].map(([campo, label]) => {
                      const on = ordenar.campo === campo;
                      return (
                        <button key={campo} type="button"
                          onClick={() => setOrdenar((o) => ({ ...o, campo: o.campo === campo ? "" : campo }))}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`, background: on ? "var(--brand-50)" : "var(--surface)", color: on ? "var(--brand)" : "var(--ink)", fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                          {label}{on && <CheckCircle2 size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <span className="vx-label">Ordem</span>
                  <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                    {[["desc", "Maior → menor", ArrowDown], ["asc", "Menor → maior", ArrowUp]].map(([dir, label, Icone]) => {
                      const on = ordenar.direcao === dir;
                      return (
                        <button key={dir} type="button" disabled={!ordenar.campo}
                          onClick={() => setOrdenar((o) => ({ ...o, direcao: dir }))}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 6px", borderRadius: 8, border: `1px solid ${on && ordenar.campo ? "var(--brand)" : "var(--border)"}`, background: on && ordenar.campo ? "var(--brand-50)" : "var(--surface)", color: on && ordenar.campo ? "var(--brand)" : "var(--muted)", fontSize: 11.5, fontWeight: 600, cursor: ordenar.campo ? "pointer" : "not-allowed", opacity: ordenar.campo ? 1 : 0.5, fontFamily: "inherit" }}>
                          <Icone size={13} />{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {ordenar.campo && (
                  <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setOrdenar({ campo: "", direcao: "desc" })}>
                    Limpar classificação
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="vx-btn"
            style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
            onClick={() => { setConvidarAberto((v) => !v); setLinkCopiado(false); }}
            title="Convidar profissional"
          >
            <Share2 size={14} strokeWidth={2.3} />
          </button>
          {convidarAberto && (
            <>
              <div onClick={() => setConvidarAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
              <div className="vx-card" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, width: 370, padding: 20, boxShadow: "0 10px 28px rgba(0,0,0,.14)", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* X fechar */}
                <button
                  type="button"
                  onClick={() => setConvidarAberto(false)}
                  style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.45 }}
                  title="Fechar"
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.45"; }}
                >
                  <X size={14} color="var(--ink)" />
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserPlus size={20} color="var(--brand)" />
                  <h3 className="vx-disp" style={{ fontSize: 15, margin: 0 }}>Convide um profissional</h3>
                </div>
                <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
                  Compartilhe o link de cadastro para que novos profissionais entrem na RYCS e possam trabalhar com a sua empresa.
                </p>
                <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><CheckCircle2 size={12} color="var(--brand)" /> Cadastro rápido e gratuito</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><CheckCircle2 size={12} color="var(--brand)" /> Acesso a campanhas de vendas reais</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><CheckCircle2 size={12} color="var(--brand)" /> Comissões por resultado comprovado</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={12} color="var(--brand)" /> Treinamentos e suporte da plataforma</div>
                </div>

                {/* Campos UTM */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="vx-label" style={{ fontSize: 11.5 }}>Personalizar rastreamento</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text" placeholder="Origem (ex: linkedin)"
                      value={utm.source} onChange={(e) => setUtm((u) => ({ ...u, source: e.target.value }))}
                      style={{ flex: 1, padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: "var(--surface)", color: "var(--ink)", outline: "none", minWidth: 0 }}
                    />
                    <input
                      type="text" placeholder="Meio (ex: post)"
                      value={utm.medium} onChange={(e) => setUtm((u) => ({ ...u, medium: e.target.value }))}
                      style={{ flex: 1, padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: "var(--surface)", color: "var(--ink)", outline: "none", minWidth: 0 }}
                    />
                  </div>
                  <input
                    type="text" placeholder="Campanha (ex: recrutamento-nov)"
                    value={utm.campaign} onChange={(e) => setUtm((u) => ({ ...u, campaign: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: "var(--surface)", color: "var(--ink)", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                {/* Link gerado */}
                {(() => {
                  const params = new URLSearchParams();
                  if (utm.source.trim()) params.set("utm_source", utm.source.trim());
                  if (utm.medium.trim()) params.set("utm_medium", utm.medium.trim());
                  if (utm.campaign.trim()) params.set("utm_campaign", utm.campaign.trim());
                  if (emp?.id) params.set("ref", emp.id);
                  const qs = params.toString();
                  const link = `${window.location.origin}/cadastro/profissional${qs ? `?${qs}` : ""}`;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, padding: "9px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {link}
                      </div>
                      <button
                        type="button"
                        className={`vx-btn${linkCopiado ? " vx-btn-primary" : ""}`}
                        style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0 }}
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          setLinkCopiado(true);
                          setTimeout(() => setLinkCopiado(false), 3000);
                        }}
                      >
                        {linkCopiado ? <><CheckCircle2 size={13} /> Copiado!</> : <><Copy size={13} /> Copiar</>}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
        {filtrosAtivos > 0 && (
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setF({ busca: f.busca, funcao: "", campanha: "", status: "", performance: "", regiao: "", score: "", genero: "", pais: "" })}>
            Limpar filtros
          </button>
        )}
      </div>
    </div>

    {filtroAberto && (
      <div className="vx-card" style={{ padding: 16, maxWidth: "none", marginBottom: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Gênero */}
        <div>
          <span className="vx-label">Gênero</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
            {[
              { value: "", label: "Todos", Icon: UsersRound },
              { value: "feminino", label: "Mulher", Icon: UserRound, cor: "#e74694" },
              { value: "masculino", label: "Homem", Icon: UserRound, cor: "#2563eb" },
            ].map((opt) => {
              const ativo = f.genero === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => setF({ ...f, genero: opt.value })}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10,
                    border: ativo ? "2px solid " + (opt.cor || "var(--brand)") : "1px solid var(--border)",
                    background: ativo ? (opt.cor || "var(--brand)") + "12" : "var(--surface-2)",
                    color: ativo ? (opt.cor || "var(--brand)") : "var(--muted)",
                    fontWeight: ativo ? 600 : 500, fontSize: 13, cursor: "pointer", transition: "all .2s",
                  }}>
                  <opt.Icon size={15} color={ativo ? (opt.cor || "var(--brand)") : "var(--muted)"} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Função */}
        <div>
          <span className="vx-label">Função</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
            {[
              { value: "", label: "Todos" },
              { value: "sdr", label: "SDR" },
              { value: "closer", label: "Closer" },
              { value: "bdr", label: "BDR" },
            ].map((opt) => {
              const ativo = f.funcao === opt.value;
              return (
                <button key={`fn-${opt.value}`} type="button"
                  onClick={() => setF({ ...f, funcao: opt.value === "" ? "" : (ativo ? "" : opt.value) })}
                  style={{
                    padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: ativo ? 600 : 500,
                    border: ativo ? "2px solid var(--brand)" : "1px solid var(--border)",
                    background: ativo ? "var(--brand-50)" : "var(--surface-2)",
                    color: ativo ? "var(--brand)" : "var(--muted)", cursor: "pointer", transition: "all .2s",
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Demais filtros */}
        <div className="vx-filterbar" style={{ maxWidth: "none" }}>
          <label><span className="vx-label">Campanha</span><select className="vx-input" value={f.campanha} onChange={(e) => setF({ ...f, campanha: e.target.value })}><option value="">Todas</option>{campanhasEmpresa.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></label>
          <label><span className="vx-label">Status</span><select className="vx-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Todos</option><option value="aprovado">Ativo/aprovado</option><option value="pendente">Pendente</option><option value="recusado">Removido/recusado</option></select></label>
          <label><span className="vx-label">Performance</span><select className="vx-input" value={f.performance} onChange={(e) => setF({ ...f, performance: e.target.value })}><option value="">Todas</option><option value="alta">Alta aprovação</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>
          <label><span className="vx-label">País</span><select className="vx-input" value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value })}><option value="">Todos</option>{opcoes.paises.map((x) => <option key={x} value={x}>{bandeiraPais(x)} {x}</option>)}</select></label>
          <label><span className="vx-label">Estado</span><select className="vx-input" value={f.regiao} onChange={(e) => setF({ ...f, regiao: e.target.value })}><option value="">Todos</option>{opcoes.regioes.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span className="vx-label">Score</span><select className="vx-input" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })}><option value="">Todos</option><option value="80">80+ (verde)</option><option value="50">50-79 (amarelo)</option><option value="0">Abaixo de 50</option></select></label>
        </div>
      </div>
    )}

    {carregando ? <div className="vx-card vx-skeleton" style={{ height: 280 }} /> : (
      <div className="vx-prof-grid">
        {filtrados.map((p) => {
          const scoreVal = p.scoreTriagem != null ? Number(p.scoreTriagem) : null;
          const scoreCor = (scoreVal ?? 0) >= 80 ? "#0E7490" : (scoreVal ?? 0) >= 50 ? "#b45309" : "#dc2626";
          const scoreBg  = (scoreVal ?? 0) >= 80 ? "#ecfeff" : (scoreVal ?? 0) >= 50 ? "#fffbeb" : "#fef2f2";
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
                <span title="Score" style={{ position: "absolute", top: 10, right: 10, background: scoreCor, color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px", letterSpacing: ".01em" }}>
                  {scoreVal != null ? `Score ${scoreVal.toFixed(0)}%` : "Score —"}
                </span>
              </div>

              {/* CONTEÚDO — flex:1, botão sempre no fundo */}
              <div className="vx-prof-card__body">
                <div className="vx-prof-card__info">
                  {/* nome + idade */}
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      <span title={p.pais || "País não informado"} style={{ marginRight: 5 }}>{bandeiraPais(p.pais)}</span>
                      {capitalizar([p.nome, p.sobrenome].filter(Boolean).join(" ") || p.nome)}
                    </span>
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
                    ? <button className="vx-prof-card__btn vx-prof-card__btn--success" disabled style={{ flex: 1 }}>✓ Enviado</button>
                    : conviteStatus === "recusado"
                    ? <button className="vx-prof-card__btn vx-prof-card__btn--danger" onClick={(e) => enviarConvite(e, p.id)} style={{ flex: 1 }}>Reenviar convite</button>
                    : <button className="vx-prof-card__btn" disabled={conviteStatus === "enviando"} onClick={(e) => enviarConvite(e, p.id)}
                        style={{ flex: 1, background: "transparent", color: "var(--muted)", border: "1.5px solid var(--border-strong)", opacity: conviteStatus === "enviando" ? 0.6 : 1, fontWeight: 400 }}>
                        {conviteStatus === "enviando" ? "Enviando…" : "Enviar Convite"}
                      </button>
                  }
                  <button
                    className="vx-prof-card__btn"
                    onClick={(e) => { e.stopPropagation(); if (bloqueado) { setPopupPlano(true); return; } setChatRapido({ sellerId: p.id, nome: p.nome, foto: p.foto }); }}
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
      return <FichaProfissional p={p} fit={fit} onFechar={() => setSelecionado(null)} acoes={
        <section className="vx-card" style={{ padding: 14, marginTop: 14 }}>
          <h3 className="vx-disp" style={{ fontSize: 15 }}>Ações</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-sm" onClick={() => alterarTime(p, "aprovado")}><UserPlus size={13} />Aprovar profissional</button>
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
      } />;
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

    {popupPlano && (
      <div onClick={() => setPopupPlano(false)} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 24px 48px rgba(0,0,0,.2)", width: "100%", maxWidth: 400, padding: "28px 26px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Lock size={22} color="var(--brand)" strokeWidth={2} />
          </div>
          <h3 className="vx-disp" style={{ margin: "0 0 6px", fontSize: 18 }}>Assine um plano para conversar</h3>
          <p className="vx-mut" style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6 }}>Para enviar mensagens aos profissionais, ative um plano. Seus dados continuam salvos.</p>
          <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => { setPopupPlano(false); irParaPlano?.(); }}>Ver planos</button>
          <button className="vx-btn vx-btn-block" style={{ marginTop: 8 }} onClick={() => setPopupPlano(false)}>Agora não</button>
        </div>
      </div>
    )}
  </div>;
}
