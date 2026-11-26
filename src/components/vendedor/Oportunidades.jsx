import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2, Globe2, MapPin, Briefcase, Target, ChevronRight, ArrowLeft, ArrowRight,
  Wallet, CheckCircle2, Clock, Flag, Search, SlidersHorizontal, X, Coins, ChevronDown, Check, ArrowDownUp,
  Eye, Bookmark, Users, Ban, XCircle,
} from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { PAISES, bandeiraPais } from "../../../shared/paises.js";
import { FUNCOES } from "../../../shared/funcoes.js";
import { classificarCampanha, codigoPais, parsePaisesAceitos } from "../../../shared/oportunidades.js";
import { SEGMENTOS } from "../../../shared/segmentos.js";
import { MODELOS_TRABALHO, OBJETIVOS_UI, NIVEIS_EXPERIENCIA } from "../../../shared/campaignEngine.js";

const SEGMENTO_LABEL = Object.fromEntries(SEGMENTOS.map((s) => [s.valor, s.label]));
const segmentoLabel = (val) => SEGMENTO_LABEL[val] || val || "";

let abaMemoria = "empresas";

const NOME_PAIS = Object.fromEntries(PAISES.map((p) => [p.code, p.nome]));
const nomePais = (code) => NOME_PAIS[String(code || "").toUpperCase()] || code || "—";

const parseObj = (v) => { if (v && typeof v === "object") return v; try { return JSON.parse(v || "{}"); } catch { return {}; } };
const maxTarefa = (c) => { const vs = Object.values(parseObj(c.tarefas)).map(Number).filter((n) => n > 0); return vs.length ? Math.max(...vs) : 0; };

// Remuneração REAL oferecida ao profissional: valores de `tarefas` (por ação) +
// percentual de comissão. Nunca o orçamento/saldo interno da empresa.
function remuneracao(c, moeda) {
  const tarefas = parseObj(c.tarefas);
  const comissoes = parseObj(c.comissoes);
  const base = Object.keys(tarefas).length ? tarefas : comissoes;
  const vals = Object.values(base).map(Number).filter((v) => v > 0);
  const pct = Number(c.percentualComissao) || 0;
  const max = vals.length ? Math.max(...vals) : 0;
  let label = "";
  if (max > 0) label = `Até ${money(max, moeda)} por tarefa`;
  if (pct > 0) label = label ? `${label} · ${pct}% comissão` : `${pct}% de comissão`;
  return { label: label || "A combinar", max, chips: base, moeda };
}

function Logo({ empresa, size = 44, r: rOverride }) {
  const r = rOverride ?? Math.round(size * 0.23);
  return empresa.logo
    ? <img src={empresa.logo} alt="" style={{ width: size, height: size, borderRadius: r, objectFit: "contain", flexShrink: 0, background: "var(--surface-2, #f5f5f5)" }} />
    : <div style={{ width: size, height: size, borderRadius: r, flexShrink: 0, background: empresa.cor || "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.32, fontWeight: 700 }}>
        {String(empresa.nome || "?").slice(0, 2).toUpperCase()}
      </div>;
}

// ─────────────────────────────────────────────────────────────────────────
// Abas estilo fichário (folder tabs) — conectadas ao painel, acessíveis.
// ─────────────────────────────────────────────────────────────────────────
function FolderTabs({ abas, aba, setAba }) {
  const refs = useRef({});
  const onKey = (e) => {
    const i = abas.findIndex((a) => a.id === aba);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = (i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length;
      setAba(abas[n].id); refs.current[abas[n].id]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label="Oportunidades" onKeyDown={onKey}
      style={{ display: "flex", gap: 4, alignItems: "flex-end", paddingLeft: 4, position: "relative", zIndex: 1 }}>
      {abas.map((a) => {
        const on = a.id === aba;
        const Icon = a.Icon;
        return (
          <button key={a.id} role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
            ref={(el) => (refs.current[a.id] = el)} onClick={() => setAba(a.id)}
            style={{
              display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
              font: "inherit", fontSize: 13.5, fontWeight: on ? 700 : 500,
              color: on ? "var(--ink)" : "var(--muted)",
              padding: on ? "11px 16px 13px" : "9px 15px 11px",
              border: "1px solid var(--border)", borderBottom: on ? "1px solid var(--surface)" : "1px solid var(--border)",
              borderRadius: "11px 11px 0 0",
              background: on ? "var(--surface)" : "var(--surface-2)",
              transform: on ? "translateY(1px)" : "none",
              marginBottom: on ? -1 : 0,
              transition: "all .2s ease", whiteSpace: "nowrap",
            }}>
            <Icon size={15} style={{ color: on ? "var(--brand)" : "var(--muted)" }} />
            {a.label}
            <span className="vx-mono" style={{ fontSize: 11, opacity: 0.7 }}>{a.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
export default function Oportunidades({ eu, db, aviso, recarregar, abrirCampanha }) {
  const [aba, setAbaRaw] = useState(abaMemoria);
  const setAba = (v) => { abaMemoria = v; setAbaRaw(v); };
  const [empresaSel, setEmpresaSel] = useState(null);
  const [campanhaSel, setCampanhaSel] = useState(null);
  const [metricas, setMetricas] = useState({});

  useEffect(() => {
    api("/oportunidades/metricas-empresas").then((r) => { if (r && !r.error) setMetricas(r.metricas || {}); });
  }, []);

  const [salvas, setSalvas] = useState(new Set());
  useEffect(() => {
    api("/campaigns/saved").then((r) => { if (r?.ids) setSalvas(new Set(r.ids)); });
  }, []);
  const toggleSalvar = async (campaignId) => {
    const isSaved = salvas.has(campaignId);
    setSalvas((prev) => { const next = new Set(prev); isSaved ? next.delete(campaignId) : next.add(campaignId); return next; });
    if (isSaved) {
      await apiDelete(`/campaigns/${campaignId}/save`);
    } else {
      await api(`/campaigns/${campaignId}/save`, {});
    }
  };

  const empresas = useMemo(() => (db.companies || []).filter((c) => c.visivel !== false), [db.companies]);
  const empresasMap = useMemo(() => Object.fromEntries(empresas.map((e) => [e.id, e])), [empresas]);
  const campanhas = useMemo(() => (db.campaigns || []).filter((c) => c.status === "ativa"), [db.campaigns]);

  // Classifica cada campanha ativa relativa ao país do profissional.
  const classificadas = useMemo(() => campanhas.map((c) => {
    const emp = empresasMap[c.companyId] || {};
    const cls = classificarCampanha({ alcance: c.alcance, paisesAceitos: c.paisesAceitos, paisEmpresa: emp.pais, paisProfissional: eu.pais });
    return { c, emp, cls };
  }), [campanhas, empresasMap, eu.pais]);

  const nacionais = useMemo(() => classificadas.filter((x) => x.cls.nacional), [classificadas]);
  const internacionais = useMemo(() => classificadas.filter((x) => x.cls.internacional), [classificadas]);

  const campsPorEmpresa = useMemo(() => {
    const m = {};
    for (const c of campanhas) m[c.companyId] = (m[c.companyId] || 0) + 1;
    return m;
  }, [campanhas]);

  // ---------------- filtros (F4) ----------------
  const FILTROS_VAZIO = { busca: "", pais: "", segmento: "", funcao: "", moeda: "", pagamento: "", remMin: "", ordenar: "recentes", salvas: false, modeloTrabalho: "", objetivo: "", experiencia: "" };
  const [filtros, setFiltros] = useState(FILTROS_VAZIO);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const setFiltro = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));
  const limparFiltros = () => setFiltros(FILTROS_VAZIO);

  const opcoesEmpresas = useMemo(() => {
    const paises = new Set(), segmentos = new Set();
    for (const e of empresas) {
      if (e.pais) paises.add(e.pais);
      if (e.segmento) segmentos.add(e.segmento);
    }
    return { paises: [...paises], segmentos: [...segmentos] };
  }, [empresas]);

  const opcoes = useMemo(() => {
    const paises = new Set(), funcoes = new Set(), moedas = new Set(), modelos = new Set(), objetivos = new Set();
    for (const { c, emp } of classificadas) {
      if (emp.pais) paises.add(emp.pais);
      if (c.funcao) funcoes.add(c.funcao);
      if (emp.moeda) moedas.add(emp.moeda);
      if (c.modeloTrabalho) modelos.add(c.modeloTrabalho);
      if (c.objetivoUI) objetivos.add(c.objetivoUI);
    }
    return { paises: [...paises], funcoes: [...funcoes], moedas: [...moedas], modelos: [...modelos], objetivos: [...objetivos] };
  }, [classificadas]);

  const aplicarFiltros = (lista) => {
    const q = filtros.busca.trim().toLowerCase();
    let out = lista.filter(({ c, emp }) => {
      if (filtros.salvas && !salvas.has(c.id)) return false;
      if (q && !`${c.titulo || ""} ${emp.nome || ""} ${c.descricao || ""}`.toLowerCase().includes(q)) return false;
      if (filtros.pais && emp.pais !== filtros.pais) return false;
      if (filtros.funcao && c.funcao !== filtros.funcao) return false;
      if (filtros.moeda && emp.moeda !== filtros.moeda) return false;
      const tarefas = parseObj(c.tarefas);
      if (filtros.pagamento === "tarefa" && !Object.values(tarefas).some((v) => Number(v) > 0)) return false;
      if (filtros.pagamento === "comissao" && !(Number(c.percentualComissao) > 0)) return false;
      if (filtros.remMin && maxTarefa(c) < Number(filtros.remMin)) return false;
      if (filtros.modeloTrabalho && c.modeloTrabalho !== filtros.modeloTrabalho) return false;
      if (filtros.objetivo && c.objetivoUI !== filtros.objetivo) return false;
      if (filtros.experiencia && c.nivelExperiencia !== filtros.experiencia) return false;
      return true;
    });
    out = [...out].sort((a, b) => filtros.ordenar === "remuneracao"
      ? maxTarefa(b.c) - maxTarefa(a.c)
      : (b.c.criadoEm || 0) - (a.c.criadoEm || 0));
    return out;
  };

  const empresasFiltradas = useMemo(() => {
    const q = filtros.busca.trim().toLowerCase();
    const descEmpresa = (e) => e.descricaoInstitucional || e.produto || e.icp || "";
    return empresas.filter((e) =>
      (!q || `${e.nome || ""} ${segmentoLabel(e.segmento)} ${descEmpresa(e)}`.toLowerCase().includes(q)) &&
      (!filtros.pais || e.pais === filtros.pais) &&
      (!filtros.segmento || e.segmento === filtros.segmento))
      .sort((a, b) => {
        const ca = campsPorEmpresa[a.id] || 0;
        const cb = campsPorEmpresa[b.id] || 0;
        if (ca !== cb) return cb - ca;
        return (a.nome || "").localeCompare(b.nome || "");
      });
  }, [empresas, filtros, campsPorEmpresa]);

  // ---- candidatura (mantém a lógica e os controles de segurança atuais) ----
  const [candidatando, setCandidatando] = useState(false);
  const candidatar = async (campanha, mensagem) => {
    setCandidatando(true);
    const r = await api(`/campaigns/${campanha.id}/apply`, { mensagem: (mensagem || "").trim() });
    setCandidatando(false);
    if (r?.error) return aviso(r.error);
    aviso("Candidatura enviada! A empresa vai analisar seu perfil.");
    recarregar?.();
  };

  // ---- navegação interna ----
  if (campanhaSel) {
    const item = classificadas.find((x) => x.c.id === campanhaSel) || { c: campanhas.find((c) => c.id === campanhaSel), emp: {} };
    if (!item?.c) { setCampanhaSel(null); return null; }
    return <DetalheCampanha item={item} eu={eu} candidatar={candidatar} candidatando={candidatando}
      abrirCampanha={abrirCampanha} onVoltar={() => setCampanhaSel(null)} />;
  }
  if (empresaSel) {
    const emp = empresasMap[empresaSel];
    if (!emp) { setEmpresaSel(null); return null; }
    const itens = classificadas.filter((x) => x.c.companyId === emp.id);
    return <DetalheEmpresa emp={emp} itens={itens}
      onVoltar={() => setEmpresaSel(null)} onAbrirCampanha={(c) => setCampanhaSel(c.id)}
      salvas={salvas} onSalvar={toggleSalvar} />;
  }

  const abas = [
    { id: "empresas", label: "Empresas", Icon: Building2, count: empresas.length },
    { id: "nacionais", label: "Oportunidades nacionais", Icon: Flag, count: nacionais.length },
    { id: "internacionais", label: "Oportunidades internacionais", Icon: Globe2, count: internacionais.length },
  ];

  return (
    <div className="vx-fade">
      <div style={{ marginBottom: 14 }}>
        <h2 className="vx-disp" style={{ fontSize: 20, margin: 0 }}>Oportunidades</h2>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>
          Conheça empresas e encontre novas oportunidades profissionais.
        </p>
      </div>

      <FolderTabs abas={abas} aba={aba} setAba={setAba} />
      <div role="tabpanel" style={{ border: "1px solid var(--border)", borderRadius: "0 12px 12px 12px", background: "var(--surface)", padding: 16 }}>
        <BarraFiltros filtros={filtros} setFiltro={setFiltro} opcoes={opcoes} opcoesEmpresas={opcoesEmpresas} empresa={aba === "empresas"}
          maisFiltros={maisFiltros} setMaisFiltros={setMaisFiltros} limpar={limparFiltros}
          total={aba === "empresas" ? empresasFiltradas.length : aba === "nacionais" ? aplicarFiltros(nacionais).length : aplicarFiltros(internacionais).length}
          salvasCount={salvas.size} onToggleSalvas={() => setFiltro("salvas", !filtros.salvas)} />

        {aba === "empresas" && (
          <GridEmpresas empresas={empresasFiltradas} onAbrir={(e) => setEmpresaSel(e.id)} />
        )}
        {aba === "nacionais" && (
          <GridCampanhas key={`nac-${JSON.stringify(filtros)}`} itens={aplicarFiltros(nacionais)} onAbrir={(c) => setCampanhaSel(c.id)}
            salvas={salvas} onSalvar={toggleSalvar}
            vazio="Nenhuma campanha nacional corresponde aos filtros." />
        )}
        {aba === "internacionais" && (
          <GridCampanhas key={`intl-${JSON.stringify(filtros)}`} itens={aplicarFiltros(internacionais)} internacional onAbrir={(c) => setCampanhaSel(c.id)}
            salvas={salvas} onSalvar={toggleSalvar}
            vazio="Nenhuma campanha internacional corresponde aos filtros." />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function GridEmpresas({ empresas, onAbrir }) {
  if (!empresas.length) return <Vazio Icon={Building2} texto="Nenhuma empresa disponível no momento." />;
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", padding: "4px 0" }}>
      {empresas.map((e) => <EmpresaCardVitrine key={e.id} empresa={e} onAbrir={() => onAbrir(e)} />)}
    </div>
  );
}

function EmpresaCardVitrine({ empresa, onAbrir }) {
  const [hoverBtn, setHoverBtn] = useState(false);
  const desc = empresa.descricaoInstitucional || empresa.produto || empresa.icp || "";
  const seg = segmentoLabel(empresa.segmento);
  return (
    <div className="vx-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Logo empresa={empresa} size={64} r={12} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {empresa.nome}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#318CE7", marginTop: 3 }}>
            {seg || "Segmento não informado"}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {desc || "Esta empresa ainda não adicionou uma descrição institucional."}
          </div>
          <div className="vx-mut" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
            {empresa.pais
              ? <><span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>{bandeiraPais(empresa.pais)}</span> {nomePais(empresa.pais)}</>
              : "Localização não informada"}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
        <button type="button" onClick={onAbrir}
          onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            height: 40, border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 600,
            fontFamily: "inherit", transition: "background .15s, color .15s",
            background: hoverBtn ? "#318CE7" : "#EDF5FF", color: hoverBtn ? "#fff" : "#318CE7",
          }}>
          Ver campanhas <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CampanhaCard({ item, internacional, onAbrir, salva, onSalvar }) {
  const { c, emp, cls } = item;
  const rem = remuneracao(c, emp.moeda);
  const aceitos = parsePaisesAceitos(c.paisesAceitos);
  const st = (c.candidaturas || [])[0]?.status;
  const seg = segmentoLabel(emp.segmento);
  const [hoverBtn, setHoverBtn] = useState(false);
  const [hoverSave, setHoverSave] = useState(false);

  const location = c.cidade && c.estado ? `${c.cidade}, ${c.estado}` : c.regiao || "";
  const vagas = Number(c.vagas) || 0;
  const funcaoLabel = c.funcao ? (FUNCOES[c.funcao]?.nome || String(c.funcao)) : "";

  const btnLabel = st === "aprovado" ? "Acessar campanha"
    : st === "pendente" ? "Candidatura em análise"
    : st === "recusado" ? "Candidatar-se novamente"
    : c.candidaturasAbertas === false ? "Candidaturas encerradas"
    : vagas > 0 && (c._totalCandidaturas || 0) >= vagas ? "Vagas preenchidas"
    : "Candidatar-se";

  const btnDisabled = st === "pendente" || c.candidaturasAbertas === false
    || (vagas > 0 && (c._totalCandidaturas || 0) >= vagas && st !== "aprovado");

  const btnStyle = st === "aprovado"
    ? { background: "#22c55e", color: "#fff" }
    : st === "pendente"
    ? { background: "var(--surface-2)", color: "var(--muted)", cursor: "default" }
    : st === "recusado"
    ? { background: "var(--surface-2)", color: "var(--ink)" }
    : btnDisabled
    ? { background: "var(--surface-2)", color: "var(--muted)", cursor: "default" }
    : { background: hoverBtn ? "#318CE7" : "#2563EB", color: "#fff" };

  const BtnIcon = st === "aprovado" ? CheckCircle2
    : st === "pendente" ? Clock
    : st === "recusado" ? XCircle
    : btnDisabled ? Ban : null;

  return (
    <div className="vx-card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header: logo + nome + segmento + icons */}
      <div style={{ padding: "16px 16px 0", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Logo empresa={emp} size={42} r={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {emp.nome}
          </div>
          <div style={{ fontSize: 12, color: "#318CE7", fontWeight: 600, marginTop: 2 }}>
            {seg || "Segmento não informado"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" aria-label="Ver campanha" onClick={() => onAbrir(c)}
            style={{ width: 30, height: 30, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", borderRadius: 6 }}>
            <Eye size={16} />
          </button>
          <button type="button" aria-label={salva ? "Remover dos salvos" : "Salvar campanha"}
            onClick={(e) => { e.stopPropagation(); onSalvar?.(c.id); }}
            onMouseEnter={() => setHoverSave(true)} onMouseLeave={() => setHoverSave(false)}
            style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", borderRadius: 6,
              color: salva ? "#318CE7" : hoverSave ? "#318CE7" : "var(--muted)", transition: "color .15s" }}>
            <Bookmark size={16} fill={salva ? "#318CE7" : "none"} />
          </button>
        </div>
      </div>

      {/* Title + description */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {c.titulo || "Campanha"}
        </div>
        {c.descricao && (
          <div style={{ fontSize: 13, color: "var(--ink-2, var(--muted))", lineHeight: 1.5, marginTop: 6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {c.descricao}
          </div>
        )}
      </div>

      {/* Info chips */}
      <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {location && (
          <span className="vx-chip" style={{ fontSize: 11 }}>
            <MapPin size={11} style={{ marginRight: 3, verticalAlign: -1 }} />{location}
          </span>
        )}
        {vagas > 0 && (
          <span className="vx-chip" style={{ fontSize: 11 }}>
            <Users size={11} style={{ marginRight: 3, verticalAlign: -1 }} />{vagas} vaga{vagas > 1 ? "s" : ""}
          </span>
        )}
        {cls.paisEmpresa && (
          <span className="vx-chip" style={{ fontSize: 11 }}>
            <span aria-hidden="true" style={{ marginRight: 4 }}>{bandeiraPais(cls.paisEmpresa)}</span>{nomePais(cls.paisEmpresa)}
          </span>
        )}
        {(c.modeloTrabalho || c.modeloOperacao) && (
          <span className="vx-chip" style={{ fontSize: 11 }}>
            {c.modeloTrabalho === "presencial" ? <MapPin size={10} style={{ marginRight: 3, verticalAlign: -1 }} /> : c.modeloTrabalho === "hibrido" ? <Building2 size={10} style={{ marginRight: 3, verticalAlign: -1 }} /> : null}
            {MODELOS_TRABALHO[c.modeloTrabalho]?.nome || c.modeloOperacao || ""}
          </span>
        )}
        {funcaoLabel && (
          <span className="vx-chip" style={{ fontSize: 11 }}>
            <Briefcase size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{funcaoLabel}
          </span>
        )}
      </div>

      {/* Remuneration block */}
      <div style={{ margin: "12px 16px 0", padding: "12px 14px", borderRadius: 10,
        background: "var(--rem-bg, #EDF6FF)", border: "1px solid var(--rem-border, rgba(37,99,235,.12))" }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)", marginBottom: 4 }}>
          Remuneração
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#2563EB", lineHeight: 1.2 }}>
          {rem.label}
        </div>
        {Number(c.percentualComissao) > 0 && rem.max > 0 && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
            + {c.percentualComissao}% de comissão
          </div>
        )}
      </div>

      {/* International countries */}
      {internacional && aceitos.length > 0 && (
        <div className="vx-mut" style={{ padding: "8px 16px 0", fontSize: 11, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <Globe2 size={11} /> Aceita: {aceitos.map(nomePais).slice(0, 3).join(", ")}{aceitos.length > 3 ? ` +${aceitos.length - 3}` : ""}
        </div>
      )}

      {/* Spacer to push button to bottom */}
      <div style={{ flex: 1 }} />

      {/* CTA button */}
      <div style={{ padding: "14px 16px 16px" }}>
        <button type="button"
          onClick={() => onAbrir(c)}
          disabled={btnDisabled && st !== "aprovado"}
          onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            height: 42, border: "none", borderRadius: 10, cursor: btnDisabled && st !== "aprovado" ? "default" : "pointer",
            fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", transition: "background .15s, color .15s",
            ...btnStyle,
          }}>
          {BtnIcon && <BtnIcon size={14} />}
          {btnLabel}
          {st === "aprovado" && <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
}

function GridCampanhas({ itens, internacional, onAbrir, vazio, salvas, onSalvar }) {
  const [limite, setLimite] = useState(12);
  if (!itens.length) return <Vazio Icon={internacional ? Globe2 : Flag} texto={vazio} />;
  const visiveis = itens.slice(0, limite);
  return (
    <>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 310px), 1fr))" }}>
        {visiveis.map((item) => <CampanhaCard key={item.c.id} item={item} internacional={internacional} onAbrir={onAbrir}
          salva={salvas?.has(item.c.id)} onSalvar={onSalvar} />)}
      </div>
      {itens.length > limite && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button type="button" className="vx-btn vx-btn-sm" onClick={() => setLimite((l) => l + 12)}>
            Ver mais campanhas ({itens.length - limite})
          </button>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function DetalheEmpresa({ emp, itens, onVoltar, onAbrirCampanha, salvas, onSalvar }) {
  const desc = emp.descricaoInstitucional || emp.produto || emp.icp || "";
  const seg = segmentoLabel(emp.segmento);
  return (
    <div className="vx-fade" style={{ maxWidth: 780, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar
      </button>
      <div className="vx-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Logo empresa={emp} size={72} r={14} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>{emp.nome}</h2>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#318CE7", marginTop: 4 }}>
              {seg || "Segmento não informado"}
            </div>
            {desc ? (
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65, margin: "12px 0 0" }}>{desc}</p>
            ) : (
              <p className="vx-mut" style={{ fontSize: 13, margin: "12px 0 0", fontStyle: "italic" }}>Esta empresa ainda não adicionou uma descrição institucional.</p>
            )}
            <div className="vx-mut" style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
              {emp.pais
                ? <><span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{bandeiraPais(emp.pais)}</span> {nomePais(emp.pais)}</>
                : "Localização não informada"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div className="vx-eyebrow">Campanhas disponíveis</div>
        <span className="vx-mono" style={{ fontSize: 12, color: "var(--muted)" }}>({itens.length})</span>
      </div>
      {itens.length > 0 ? (
        <GridCampanhas itens={itens} onAbrir={onAbrirCampanha} salvas={salvas} onSalvar={onSalvar} vazio="" />
      ) : (
        <div className="vx-card" style={{ padding: 32, textAlign: "center" }}>
          <Building2 size={32} style={{ color: "var(--muted)", marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Nenhuma campanha disponível</div>
          <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>Esta empresa não tem campanhas abertas para o seu perfil no momento.</p>
          <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginTop: 16 }}>
            <ArrowLeft size={14} /> Voltar às empresas
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function DetalheCampanha({ item, candidatar, candidatando, abrirCampanha, onVoltar }) {
  const { c, emp, cls } = item;
  const [mensagem, setMensagem] = useState("");
  const rem = remuneracao(c, emp.moeda);
  const aceitos = parsePaisesAceitos(c.paisesAceitos);
  const st = (c.candidaturas || [])[0]?.status;
  const tarefas = parseObj(c.tarefas);
  const acoes = ORDEM_ACOES.filter((k) => tarefas[k]);

  const Linha = ({ rotulo, children }) => children ? (
    <div style={{ marginBottom: 14 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{rotulo}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{children}</div>
    </div>
  ) : null;

  return (
    <div className="vx-fade" style={{ maxWidth: 680, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="vx-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
          <Logo empresa={emp} size={52} />
          <div style={{ minWidth: 0 }}>
            <h1 className="vx-disp" style={{ fontSize: 21, margin: 0 }}>{c.titulo || "Campanha"}</h1>
            <div className="vx-mut" style={{ fontSize: 13, marginTop: 2 }}>{emp.nome} · {nomePais(cls.paisEmpresa)}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {c.funcao && <span className="vx-chip"><Briefcase size={11} style={{ marginRight: 3, verticalAlign: -1 }} />{String(c.funcao).toUpperCase()}</span>}
          {c.modeloOperacao && <span className="vx-chip">{c.modeloOperacao}</span>}
          {c.regiao && <span className="vx-chip"><MapPin size={11} style={{ marginRight: 3, verticalAlign: -1 }} />{c.regiao}</span>}
          <span className="vx-chip">{cls.internacional ? "Internacional" : "Nacional"}</span>
        </div>

        <div className="vx-notice" style={{ marginBottom: 16 }}>
          <div className="vx-eyebrow" style={{ fontSize: 10 }}>Remuneração</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--brand)", marginTop: 2 }}>{rem.label}</div>
          {acoes.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {acoes.map((k) => <span key={k} className="vx-chip vx-mono" style={{ fontSize: 11.5 }}>{ACOES[k]?.nome || k} <b style={{ color: "var(--brand)" }}>{money(tarefas[k], emp.moeda)}</b></span>)}
            </div>
          )}
        </div>

        <Linha rotulo="Descrição">{c.descricao}</Linha>
        <Linha rotulo="Objetivo">{c.objetivo}</Linha>
        <Linha rotulo="Público-alvo">{c.publico || c.icp}</Linha>
        <Linha rotulo="Requisitos">{c.requisitos}</Linha>
        {cls.internacional && aceitos.length > 0 && (
          <Linha rotulo="Países aceitos">{aceitos.map(nomePais).join(", ")}</Linha>
        )}
        {c.exigeCertificacao ? <Linha rotulo="Elegibilidade">Esta campanha exige certificação na Academy da função.</Linha> : null}

        {/* Candidatura — na página de detalhe, nunca dentro do card. */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          {st === "aprovado" ? (
            <button className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => abrirCampanha?.(c)}>
              Acessar campanha <ChevronRight size={14} />
            </button>
          ) : st === "pendente" ? (
            <button className="vx-btn" style={{ width: "100%", justifyContent: "center" }} disabled>Candidatura em análise</button>
          ) : c.candidaturasAbertas === false ? (
            <button className="vx-btn" style={{ width: "100%", justifyContent: "center" }} disabled>Candidaturas encerradas</button>
          ) : (
            <>
              <textarea className="vx-input" rows={3} maxLength={1000} value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Mensagem para a empresa (opcional): conte por que você é ideal para esta campanha."
                style={{ resize: "vertical", marginBottom: 10, fontSize: 13 }} />
              <button className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center" }}
                disabled={candidatando} onClick={() => candidatar(c, mensagem)}>
                {candidatando ? "Enviando…" : st === "recusado" ? "Candidatar-se novamente" : "Candidatar-se a esta campanha"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Barra de filtros (F4): busca, país, função, ordenação + "mais filtros"
// (moeda, tipo de pagamento, remuneração mínima). Chips removíveis e "limpar".
const AZUL_FILTRO = "#318CE7";

// Popover compacto ancorado a um botão. Renderiza via portal (não é cortado por
// overflow do card), fecha ao clicar fora ou com Esc, e é acessível por teclado.
function PopoverFiltro({ Icon, rotulo, valorLabel, largura = 240, children }) {
  const [aberto, setAberto] = useState(false);
  const btnRef = useRef(null), popRef = useRef(null);
  const [pos, setPos] = useState(null);
  const ativo = !!valorLabel;

  useEffect(() => {
    if (!aberto) return;
    const recalcular = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(largura, window.innerWidth - 20);
      let left = r.left;
      if (left + w > window.innerWidth - 10) left = Math.max(10, window.innerWidth - w - 10);
      setPos({ left, top: r.bottom + 6, width: w });
    };
    recalcular();
    popRef.current?.querySelector("input,button")?.focus();
    const fora = (e) => { if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") { setAberto(false); btnRef.current?.focus(); } };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", recalcular);
    window.addEventListener("scroll", recalcular, true);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", recalcular);
      window.removeEventListener("scroll", recalcular, true);
    };
  }, [aberto, largura]);

  return (
    <>
      <button ref={btnRef} type="button" aria-haspopup="menu" aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 13px", borderRadius: 8, cursor: "pointer",
          fontSize: 12.5, fontWeight: ativo ? 600 : 500, fontFamily: "inherit", whiteSpace: "nowrap",
          border: `1px solid ${ativo ? AZUL_FILTRO : "var(--border)"}`,
          background: ativo ? "var(--brand-50)" : "var(--surface-solid, #fff)", color: ativo ? AZUL_FILTRO : "var(--ink)", transition: "border-color .15s, background .15s",
        }}>
        <Icon size={15} /> {valorLabel || rotulo}
        <ChevronDown size={14} style={{ transition: "transform .2s", transform: aberto ? "rotate(180deg)" : "none", opacity: 0.7 }} />
      </button>
      {aberto && pos && createPortal(
        <div ref={popRef} role="menu" style={{
          position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 1300,
          background: "var(--surface-solid, #fff)", border: "1px solid var(--border)", borderRadius: 12,
          boxShadow: "0 10px 34px rgba(20,30,45,.16)", overflow: "hidden",
          // Portado para o document.body (fora de .vx-app): precisa declarar a
          // fonte editorial, senão herda a fonte do body e sai diferente da página.
          fontFamily: "'General Sans','Inter',system-ui,-apple-system,sans-serif", color: "var(--ink)",
        }}>
          {children(() => setAberto(false))}
        </div>, document.body)}
    </>
  );
}

// Lista de opções (seleção única) com busca interna quando a lista é longa.
function ListaOpcoes({ opcoes, valor, onEscolher, buscavel }) {
  const [q, setQ] = useState("");
  const visiveis = buscavel && q ? opcoes.filter((o) => String(o.label).toLowerCase().includes(q.toLowerCase())) : opcoes;
  const item = (sel, label, flag, onClick, key) => (
    <button key={key} type="button" role="menuitemradio" aria-checked={sel} onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: sel ? "var(--brand-50)" : "transparent",
        padding: "9px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", color: sel ? AZUL_FILTRO : "var(--ink)", fontWeight: sel ? 600 : 400 }}
      onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "var(--surface-2)"; }}
      onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
      {flag && <span aria-hidden="true">{flag}</span>}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {sel && <Check size={15} />}
    </button>
  );
  return (
    <>
      {buscavel && opcoes.length > 7 && (
        <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
          <input className="vx-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ height: 34, fontSize: 13 }} />
        </div>
      )}
      <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
        {item(!valor, "Todas", null, () => onEscolher(""), "__todas")}
        {visiveis.map((o) => item(valor === o.value, o.label, o.flag, () => onEscolher(o.value), o.value))}
        {visiveis.length === 0 && <div className="vx-mut" style={{ padding: "10px 12px", fontSize: 12.5 }}>Nada encontrado.</div>}
      </div>
    </>
  );
}

function BarraFiltros({ filtros, setFiltro, opcoes, opcoesEmpresas, empresa, maisFiltros, setMaisFiltros, limpar, total, salvasCount, onToggleSalvas }) {
  const [buscaLocal, setBuscaLocal] = useState(filtros.busca);
  useEffect(() => { setBuscaLocal(filtros.busca); }, [filtros.busca]);
  useEffect(() => {
    const t = setTimeout(() => { if (buscaLocal !== filtros.busca) setFiltro("busca", buscaLocal); }, 280);
    return () => clearTimeout(t);
  }, [buscaLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  const opcoesPaisEmp = empresa && opcoesEmpresas ? opcoesEmpresas.paises.map((p) => ({ value: p, label: nomePais(p), flag: bandeiraPais(p) })) : [];
  const opcoesSegmento = empresa && opcoesEmpresas ? opcoesEmpresas.segmentos.map((s) => ({ value: s, label: segmentoLabel(s) })) : [];
  const opcoesPais = opcoes.paises.map((p) => ({ value: p, label: nomePais(p), flag: bandeiraPais(p) }));
  const opcoesFuncao = opcoes.funcoes.map((f) => ({ value: f, label: FUNCOES[f]?.nome || f }));
  const opcoesMoeda = opcoes.moedas.map((m) => ({ value: m, label: m }));
  const opcoesPagamento = [{ value: "tarefa", label: "Por tarefa" }, { value: "comissao", label: "Comissão" }];

  const ativos = [];
  if (filtros.pais) ativos.push(["pais", nomePais(filtros.pais)]);
  if (empresa && filtros.segmento) ativos.push(["segmento", segmentoLabel(filtros.segmento)]);
  if (!empresa && filtros.funcao) ativos.push(["funcao", FUNCOES[filtros.funcao]?.nome || filtros.funcao]);
  if (!empresa && filtros.pagamento) ativos.push(["pagamento", filtros.pagamento === "tarefa" ? "Por tarefa" : "Comissão"]);
  if (!empresa && filtros.moeda) ativos.push(["moeda", filtros.moeda]);
  if (!empresa && filtros.remMin) ativos.push(["remMin", `≥ ${filtros.remMin}`]);
  if (!empresa && filtros.modeloTrabalho) ativos.push(["modeloTrabalho", MODELOS_TRABALHO[filtros.modeloTrabalho]?.nome || filtros.modeloTrabalho]);
  if (!empresa && filtros.objetivo) ativos.push(["objetivo", OBJETIVOS_UI[filtros.objetivo]?.nome || filtros.objetivo]);
  if (!empresa && filtros.experiencia) ativos.push(["experiencia", NIVEIS_EXPERIENCIA.find((n) => n.id === filtros.experiencia)?.label || filtros.experiencia]);

  const ordenarLabel = { recentes: "Mais recentes", remuneracao: "Maior remuneração" }[filtros.ordenar] || "Mais recentes";

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, height: 44, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-solid, #fff)", overflow: "hidden", marginBottom: 10 }}>
        <Search size={16} style={{ margin: "0 8px 0 12px", color: "var(--muted)", flexShrink: 0 }} />
        <input value={buscaLocal} onChange={(e) => setBuscaLocal(e.target.value)} aria-label="Buscar"
          placeholder={empresa ? "Buscar empresa ou segmento..." : "Cargo, empresa ou campanha"}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 14, height: "100%", padding: 0, fontFamily: "inherit", color: "var(--ink)" }} />
        {buscaLocal && (
          <button type="button" aria-label="Limpar busca" onClick={() => setBuscaLocal("")}
            style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "0 6px", display: "grid", placeItems: "center" }}><X size={15} /></button>
        )}
        <button type="button" aria-label="Buscar" onClick={() => setFiltro("busca", buscaLocal)}
          style={{ width: 44, height: 44, border: "none", background: AZUL_FILTRO, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <ArrowRight size={18} />
        </button>
      </div>

      {empresa && <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Explore as empresas</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {empresa && opcoesSegmento.length > 0 && (
          <PopoverFiltro Icon={Briefcase} rotulo="Segmento de atuação" largura={260}
            valorLabel={filtros.segmento ? segmentoLabel(filtros.segmento) : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesSegmento} valor={filtros.segmento} buscavel onEscolher={(v) => { setFiltro("segmento", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {!empresa && opcoesFuncao.length > 0 && (
          <PopoverFiltro Icon={Briefcase} rotulo="Função" largura={240}
            valorLabel={filtros.funcao ? (FUNCOES[filtros.funcao]?.nome || filtros.funcao) : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesFuncao} valor={filtros.funcao} buscavel onEscolher={(v) => { setFiltro("funcao", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {(empresa ? opcoesPaisEmp : opcoesPais).length > 0 && (
          <PopoverFiltro Icon={MapPin} rotulo="País" largura={260}
            valorLabel={filtros.pais ? nomePais(filtros.pais) : null}>
            {(fechar) => <ListaOpcoes opcoes={empresa ? opcoesPaisEmp : opcoesPais} valor={filtros.pais} buscavel onEscolher={(v) => { setFiltro("pais", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {!empresa && (
          <PopoverFiltro Icon={Wallet} rotulo="Pagamento" largura={200}
            valorLabel={filtros.pagamento ? (filtros.pagamento === "tarefa" ? "Por tarefa" : "Comissão") : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesPagamento} valor={filtros.pagamento} onEscolher={(v) => { setFiltro("pagamento", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {!empresa && opcoes.modelos.length > 0 && (
          <PopoverFiltro Icon={Globe2} rotulo="Modelo" largura={220}
            valorLabel={filtros.modeloTrabalho ? (MODELOS_TRABALHO[filtros.modeloTrabalho]?.nome || filtros.modeloTrabalho) : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoes.modelos.map((m) => ({ value: m, label: MODELOS_TRABALHO[m]?.nome || m }))} valor={filtros.modeloTrabalho} onEscolher={(v) => { setFiltro("modeloTrabalho", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {!empresa && opcoes.objetivos.length > 0 && (
          <PopoverFiltro Icon={Target} rotulo="Objetivo" largura={260}
            valorLabel={filtros.objetivo ? (OBJETIVOS_UI[filtros.objetivo]?.nome || filtros.objetivo) : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoes.objetivos.map((o) => ({ value: o, label: OBJETIVOS_UI[o]?.nome || o }))} valor={filtros.objetivo} buscavel onEscolher={(v) => { setFiltro("objetivo", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {!empresa && opcoesMoeda.length > 0 && (
          <PopoverFiltro Icon={Coins} rotulo="Moeda" largura={180}
            valorLabel={filtros.moeda || null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesMoeda} valor={filtros.moeda} onEscolher={(v) => { setFiltro("moeda", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {!empresa && salvasCount > 0 && (
          <button type="button" onClick={onToggleSalvas}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 13px", borderRadius: 8, cursor: "pointer",
              fontSize: 12.5, fontWeight: filtros.salvas ? 600 : 500, fontFamily: "inherit", whiteSpace: "nowrap",
              border: `1px solid ${filtros.salvas ? AZUL_FILTRO : "var(--border)"}`,
              background: filtros.salvas ? "var(--brand-50)" : "var(--surface-solid, #fff)", color: filtros.salvas ? AZUL_FILTRO : "var(--ink)", transition: "border-color .15s, background .15s",
            }}>
            <Bookmark size={15} fill={filtros.salvas ? AZUL_FILTRO : "none"} /> Salvas
            <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: filtros.salvas ? AZUL_FILTRO : "var(--surface-2)", color: filtros.salvas ? "#fff" : "var(--muted)", display: "grid", placeItems: "center" }}>
              {salvasCount}
            </span>
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {!empresa && (
          <button type="button" onClick={() => setMaisFiltros((v) => !v)} aria-expanded={maisFiltros}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 11px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontFamily: "inherit",
              border: "1px solid var(--border)", background: maisFiltros ? "var(--surface-2)" : "var(--surface-solid, #fff)", color: "var(--ink)" }}>
            <SlidersHorizontal size={14} /> Filtros avançados
            {ativos.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: AZUL_FILTRO, color: "#fff", display: "grid", placeItems: "center" }}>{ativos.length}</span>}
          </button>
        )}
        {ativos.length > 0 && (
          <button type="button" onClick={limpar} className="vx-btn vx-btn-ghost vx-btn-sm" style={{ gap: 5 }}><X size={13} /> Limpar filtros</button>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span className="vx-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{total} resultado{total === 1 ? "" : "s"}</span>
          {!empresa && (
            <PopoverFiltro Icon={ArrowDownUp} rotulo={ordenarLabel} valorLabel={null} largura={190}>
              {(fechar) => <ListaOpcoesSimples opcoes={[{ value: "recentes", label: "Mais recentes" }, { value: "remuneracao", label: "Maior remuneração" }]} valor={filtros.ordenar} onEscolher={(v) => { setFiltro("ordenar", v || "recentes"); fechar(); }} />}
            </PopoverFiltro>
          )}
        </span>
      </div>

      {maisFiltros && !empresa && (
        <div style={{ marginTop: 12, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
            <label>
              <div className="vx-label">Remuneração mínima por tarefa</div>
              <input className="vx-input vx-mono" type="number" min="0" value={filtros.remMin}
                onChange={(e) => setFiltro("remMin", e.target.value)} placeholder="0" aria-label="Remuneração mínima" />
            </label>
            <label>
              <div className="vx-label">Nível de experiência</div>
              <select className="vx-input" value={filtros.experiencia} onChange={(e) => setFiltro("experiencia", e.target.value)}>
                <option value="">Todos</option>
                {NIVEIS_EXPERIENCIA.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {ativos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {ativos.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFiltro(k, "")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${AZUL_FILTRO}`, background: "var(--brand-50)", color: AZUL_FILTRO, fontFamily: "inherit" }}>
              {label} <X size={12} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Lista simples sem busca (ex.: ordenação).
function ListaOpcoesSimples({ opcoes, valor, onEscolher }) {
  return (
    <div style={{ padding: "4px 0" }}>
      {opcoes.map((o) => {
        const sel = valor === o.value;
        return (
          <button key={o.value} type="button" role="menuitemradio" aria-checked={sel} onClick={() => onEscolher(o.value)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: sel ? "var(--brand-50)" : "transparent",
              padding: "9px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", color: sel ? AZUL_FILTRO : "var(--ink)", fontWeight: sel ? 600 : 400 }}>
            <span style={{ flex: 1 }}>{o.label}</span>{sel && <Check size={15} />}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Vazio({ Icon, texto }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <Icon size={34} color="var(--muted)" />
      <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 10 }}>{texto}</p>
    </div>
  );
}
