import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2, Globe2, MapPin, Briefcase, Target, ChevronRight, ArrowLeft, ArrowRight,
  Wallet, CheckCircle2, Clock, Flag, Search, SlidersHorizontal, X, Coins, ChevronDown, Check, ArrowDownUp,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { PAISES, bandeiraPais } from "../../../shared/paises.js";
import { FUNCOES } from "../../../shared/funcoes.js";
import { classificarCampanha, codigoPais, parsePaisesAceitos } from "../../../shared/oportunidades.js";

// Lembra a aba escolhida ao voltar de uma página de detalhe (sem depender do
// index.jsx). Vive no módulo, então sobrevive ao remonte do componente.
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
  let label = "";
  if (vals.length) {
    const min = Math.min(...vals), max = Math.max(...vals);
    label = min === max ? money(min, moeda) : `${money(min, moeda)}–${money(max, moeda)}`;
    label += " por tarefa";
  }
  if (pct > 0) label = label ? `${label} · ${pct}% comissão` : `${pct}% de comissão`;
  return { label: label || "A combinar", chips: base, moeda };
}

function Logo({ empresa, size = 44 }) {
  const r = Math.round(size * 0.23);
  return empresa.logo
    ? <img src={empresa.logo} alt="" style={{ width: size, height: size, borderRadius: r, objectFit: "cover", flexShrink: 0 }} />
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
  const FILTROS_VAZIO = { busca: "", pais: "", funcao: "", moeda: "", pagamento: "", remMin: "", ordenar: "recentes" };
  const [filtros, setFiltros] = useState(FILTROS_VAZIO);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const setFiltro = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));
  const limparFiltros = () => setFiltros(FILTROS_VAZIO);

  const opcoes = useMemo(() => {
    const paises = new Set(), funcoes = new Set(), moedas = new Set();
    for (const { c, emp } of classificadas) {
      if (emp.pais) paises.add(emp.pais);
      if (c.funcao) funcoes.add(c.funcao);
      if (emp.moeda) moedas.add(emp.moeda);
    }
    return { paises: [...paises], funcoes: [...funcoes], moedas: [...moedas] };
  }, [classificadas]);

  const aplicarFiltros = (lista) => {
    const q = filtros.busca.trim().toLowerCase();
    let out = lista.filter(({ c, emp }) => {
      if (q && !`${c.titulo || ""} ${emp.nome || ""} ${c.descricao || ""}`.toLowerCase().includes(q)) return false;
      if (filtros.pais && emp.pais !== filtros.pais) return false;
      if (filtros.funcao && c.funcao !== filtros.funcao) return false;
      if (filtros.moeda && emp.moeda !== filtros.moeda) return false;
      const tarefas = parseObj(c.tarefas);
      if (filtros.pagamento === "tarefa" && !Object.values(tarefas).some((v) => Number(v) > 0)) return false;
      if (filtros.pagamento === "comissao" && !(Number(c.percentualComissao) > 0)) return false;
      if (filtros.remMin && maxTarefa(c) < Number(filtros.remMin)) return false;
      return true;
    });
    out = [...out].sort((a, b) => filtros.ordenar === "remuneracao"
      ? maxTarefa(b.c) - maxTarefa(a.c)
      : (b.c.criadoEm || 0) - (a.c.criadoEm || 0));
    return out;
  };

  const empresasFiltradas = useMemo(() => {
    const q = filtros.busca.trim().toLowerCase();
    // Empresas com logo/imagem sempre primeiro; as sem logo vão para o fim.
    // sort é estável, então dentro de cada grupo a ordem original é mantida.
    return empresas.filter((e) =>
      (!q || (e.nome || "").toLowerCase().includes(q)) &&
      (!filtros.pais || e.pais === filtros.pais) &&
      (!filtros.moeda || e.moeda === filtros.moeda))
      .sort((a, b) => (b.logo ? 1 : 0) - (a.logo ? 1 : 0));
  }, [empresas, filtros]);

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
    return <DetalheEmpresa emp={emp} itens={itens} metrica={metricas[emp.id]} eu={eu}
      onVoltar={() => setEmpresaSel(null)} onAbrirCampanha={(c) => setCampanhaSel(c.id)} />;
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
          Explore empresas e descubra campanhas nacionais e internacionais.
        </p>
      </div>

      <FolderTabs abas={abas} aba={aba} setAba={setAba} />
      <div role="tabpanel" style={{ border: "1px solid var(--border)", borderRadius: "0 12px 12px 12px", background: "var(--surface)", padding: 16 }}>
        <BarraFiltros filtros={filtros} setFiltro={setFiltro} opcoes={opcoes} empresa={aba === "empresas"}
          maisFiltros={maisFiltros} setMaisFiltros={setMaisFiltros} limpar={limparFiltros}
          total={aba === "empresas" ? empresasFiltradas.length : aba === "nacionais" ? aplicarFiltros(nacionais).length : aplicarFiltros(internacionais).length} />

        {aba === "empresas" && (
          <GridEmpresas empresas={empresasFiltradas} metricas={metricas} campsPorEmpresa={campsPorEmpresa} onAbrir={(e) => setEmpresaSel(e.id)} />
        )}
        {aba === "nacionais" && (
          <GridCampanhas key={`nac-${JSON.stringify(filtros)}`} itens={aplicarFiltros(nacionais)} onAbrir={(c) => setCampanhaSel(c.id)}
            vazio="Nenhuma campanha nacional corresponde aos filtros." />
        )}
        {aba === "internacionais" && (
          <GridCampanhas key={`intl-${JSON.stringify(filtros)}`} itens={aplicarFiltros(internacionais)} internacional onAbrir={(c) => setCampanhaSel(c.id)}
            vazio="Nenhuma campanha internacional corresponde aos filtros." />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function GridEmpresas({ empresas, metricas, campsPorEmpresa, onAbrir }) {
  if (!empresas.length) return <Vazio Icon={Building2} texto="Nenhuma empresa disponível no momento." />;
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
      {empresas.map((e) => {
        const m = metricas[e.id] || {};
        const nCamp = campsPorEmpresa[e.id] || 0;
        return (
          <button key={e.id} type="button" onClick={() => onAbrir(e)}
            className="vx-card" style={{ padding: 16, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12, font: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Logo empresa={e} size={48} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nome}</div>
                <div className="vx-mut" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>{bandeiraPais(e.pais)}</span> {nomePais(e.pais)}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div className="vx-eyebrow" style={{ fontSize: 10 }}>Campanhas</div>
                <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{nCamp}</div>
              </div>
              <div>
                <div className="vx-eyebrow" style={{ fontSize: 10 }}>Pago aos profissionais</div>
                <div className="vx-mono" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--brand)" }}>{money(m.totalPago || 0, e.moeda)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--brand)", fontSize: 12.5, fontWeight: 600 }}>
              {nCamp ? "Ver oportunidades" : "Ver empresa"} <ChevronRight size={14} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CampanhaCard({ item, internacional, onAbrir }) {
  const { c, emp, cls } = item;
  const rem = remuneracao(c, emp.moeda);
  const aceitos = parsePaisesAceitos(c.paisesAceitos);
  const st = (c.candidaturas || [])[0]?.status;
  return (
    <button type="button" onClick={() => onAbrir(c)} className="vx-card"
      style={{ padding: 14, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 9, font: "inherit" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Logo empresa={emp} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="vx-mut" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.nome}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.titulo || "Campanha"}</div>
        </div>
        {st === "aprovado" && <CheckCircle2 size={15} style={{ color: "var(--green, #22c55e)", flexShrink: 0 }} />}
        {st === "pendente" && <Clock size={15} style={{ color: "var(--amber)", flexShrink: 0 }} />}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11.5 }}>
        {c.funcao && <span className="vx-chip" style={{ fontSize: 11 }}><Briefcase size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{String(c.funcao).toUpperCase()}</span>}
        <span className="vx-chip" style={{ fontSize: 11 }}><span aria-hidden="true" style={{ marginRight: 4 }}>{bandeiraPais(cls.paisEmpresa)}</span>{nomePais(cls.paisEmpresa)}</span>
        {c.modeloOperacao && <span className="vx-chip" style={{ fontSize: 11 }}>{c.modeloOperacao}</span>}
      </div>

      <div>
        <div className="vx-eyebrow" style={{ fontSize: 10 }}>Remuneração</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", marginTop: 1 }}>
          <Wallet size={12} style={{ marginRight: 4, verticalAlign: -1 }} />{rem.label}
        </div>
      </div>

      {internacional && aceitos.length > 0 && (
        <div className="vx-mut" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <Globe2 size={11} /> Aceita: {aceitos.map(nomePais).slice(0, 3).join(", ")}{aceitos.length > 3 ? ` +${aceitos.length - 3}` : ""}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", color: "var(--brand)", fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>
        Ver campanha <ChevronRight size={14} />
      </div>
    </button>
  );
}

function GridCampanhas({ itens, internacional, onAbrir, vazio }) {
  // Renderização incremental: evita montar centenas de cards de uma vez.
  // O `key` no pai (assinatura dos filtros) remonta e reseta o limite ao filtrar.
  const [limite, setLimite] = useState(12);
  if (!itens.length) return <Vazio Icon={internacional ? Globe2 : Flag} texto={vazio} />;
  const visiveis = itens.slice(0, limite);
  return (
    <>
      <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
        {visiveis.map((item) => <CampanhaCard key={item.c.id} item={item} internacional={internacional} onAbrir={onAbrir} />)}
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
function DetalheEmpresa({ emp, itens, metrica, onVoltar, onAbrirCampanha }) {
  return (
    <div className="vx-fade">
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar
      </button>
      <div className="vx-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Logo empresa={emp} size={60} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <h2 className="vx-disp" style={{ fontSize: 20, margin: 0 }}>{emp.nome}</h2>
            <div className="vx-mut" style={{ fontSize: 12.5, display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>{bandeiraPais(emp.pais)}</span> {nomePais(emp.pais)}</span>
              {emp.segmento && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Briefcase size={12} /> {emp.segmento}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div><div className="vx-eyebrow" style={{ fontSize: 10 }}>Campanhas</div><div className="vx-mono" style={{ fontSize: 18, fontWeight: 700 }}>{itens.length}</div></div>
            <div><div className="vx-eyebrow" style={{ fontSize: 10 }}>Pago aos profissionais</div><div className="vx-mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--brand)" }}>{money(metrica?.totalPago || 0, emp.moeda)}</div></div>
          </div>
        </div>
        {(emp.icp || emp.produto) && (
          <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.6, margin: "14px 0 0" }}>{emp.produto || emp.icp}</p>
        )}
      </div>

      <div className="vx-eyebrow" style={{ marginBottom: 12 }}>Campanhas disponíveis</div>
      <GridCampanhas itens={itens} onAbrir={onAbrirCampanha} vazio="Esta empresa não tem campanhas abertas para o seu perfil no momento." />
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
          background: ativo ? "#EAF4FF" : "#fff", color: ativo ? AZUL_FILTRO : "var(--ink)", transition: "border-color .15s, background .15s",
        }}>
        <Icon size={15} /> {valorLabel || rotulo}
        <ChevronDown size={14} style={{ transition: "transform .2s", transform: aberto ? "rotate(180deg)" : "none", opacity: 0.7 }} />
      </button>
      {aberto && pos && createPortal(
        <div ref={popRef} role="menu" style={{
          position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 1300,
          background: "var(--surface-solid, #fff)", border: "1px solid var(--border)", borderRadius: 12,
          boxShadow: "0 10px 34px rgba(20,30,45,.16)", overflow: "hidden",
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
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: sel ? "#EAF4FF" : "transparent",
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

function BarraFiltros({ filtros, setFiltro, opcoes, empresa, maisFiltros, setMaisFiltros, limpar, total }) {
  // Debounce da busca textual: o input é local e só propaga ao filtro após uma
  // pausa, evitando refiltrar a cada tecla.
  const [buscaLocal, setBuscaLocal] = useState(filtros.busca);
  useEffect(() => { setBuscaLocal(filtros.busca); }, [filtros.busca]);
  useEffect(() => {
    const t = setTimeout(() => { if (buscaLocal !== filtros.busca) setFiltro("busca", buscaLocal); }, 280);
    return () => clearTimeout(t);
  }, [buscaLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  const opcoesPais = opcoes.paises.map((p) => ({ value: p, label: nomePais(p), flag: bandeiraPais(p) }));
  const opcoesFuncao = opcoes.funcoes.map((f) => ({ value: f, label: FUNCOES[f]?.nome || f }));
  const opcoesMoeda = opcoes.moedas.map((m) => ({ value: m, label: m }));
  const opcoesPagamento = [{ value: "tarefa", label: "Por tarefa" }, { value: "comissao", label: "Comissão" }];

  // Filtros ativos (para contador, chips e "limpar").
  const ativos = [];
  if (filtros.pais) ativos.push(["pais", nomePais(filtros.pais)]);
  if (!empresa && filtros.funcao) ativos.push(["funcao", FUNCOES[filtros.funcao]?.nome || filtros.funcao]);
  if (!empresa && filtros.pagamento) ativos.push(["pagamento", filtros.pagamento === "tarefa" ? "Por tarefa" : "Comissão"]);
  if (filtros.moeda) ativos.push(["moeda", filtros.moeda]);
  if (!empresa && filtros.remMin) ativos.push(["remMin", `≥ ${filtros.remMin}`]);

  const ordenarLabel = { recentes: "Mais recentes", remuneracao: "Maior remuneração" }[filtros.ordenar] || "Mais recentes";

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Linha 1 — pesquisa */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, height: 44, border: "1px solid #E2E8F0", borderRadius: 10, background: "#fff", overflow: "hidden", marginBottom: 10 }}>
        <Search size={16} style={{ margin: "0 8px 0 12px", color: "var(--muted)", flexShrink: 0 }} />
        <input value={buscaLocal} onChange={(e) => setBuscaLocal(e.target.value)} aria-label="Buscar"
          placeholder="Cargo, empresa ou campanha"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 14, height: "100%", padding: 0, fontFamily: "inherit" }} />
        {buscaLocal && (
          <button type="button" aria-label="Limpar busca" onClick={() => setBuscaLocal("")}
            style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "0 6px", display: "grid", placeItems: "center" }}><X size={15} /></button>
        )}
        <button type="button" aria-label="Buscar" onClick={() => setFiltro("busca", buscaLocal)}
          style={{ width: 44, height: 44, border: "none", background: AZUL_FILTRO, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Linha 2 — botões de filtro (largura do conteúdo, não esticam) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {!empresa && opcoesFuncao.length > 0 && (
          <PopoverFiltro Icon={Briefcase} rotulo="Função" largura={240}
            valorLabel={filtros.funcao ? (FUNCOES[filtros.funcao]?.nome || filtros.funcao) : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesFuncao} valor={filtros.funcao} buscavel onEscolher={(v) => { setFiltro("funcao", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {opcoesPais.length > 0 && (
          <PopoverFiltro Icon={MapPin} rotulo="Localização" largura={260}
            valorLabel={filtros.pais ? nomePais(filtros.pais) : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesPais} valor={filtros.pais} buscavel onEscolher={(v) => { setFiltro("pais", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {!empresa && (
          <PopoverFiltro Icon={Wallet} rotulo="Pagamento" largura={200}
            valorLabel={filtros.pagamento ? (filtros.pagamento === "tarefa" ? "Por tarefa" : "Comissão") : null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesPagamento} valor={filtros.pagamento} onEscolher={(v) => { setFiltro("pagamento", v); fechar(); }} />}
          </PopoverFiltro>
        )}
        {opcoesMoeda.length > 0 && (
          <PopoverFiltro Icon={Coins} rotulo="Moeda" largura={180}
            valorLabel={filtros.moeda || null}>
            {(fechar) => <ListaOpcoes opcoes={opcoesMoeda} valor={filtros.moeda} onEscolher={(v) => { setFiltro("moeda", v); fechar(); }} />}
          </PopoverFiltro>
        )}
      </div>

      {/* Linha 3 — ações secundárias */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {!empresa && (
          <button type="button" onClick={() => setMaisFiltros((v) => !v)} aria-expanded={maisFiltros}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 11px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontFamily: "inherit",
              border: "1px solid var(--border)", background: maisFiltros ? "var(--surface-2)" : "#fff", color: "var(--ink)" }}>
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

      {/* Filtros avançados */}
      {maisFiltros && !empresa && (
        <div style={{ marginTop: 12, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
            <label>
              <div className="vx-label">Remuneração mínima por tarefa</div>
              <input className="vx-input vx-mono" type="number" min="0" value={filtros.remMin}
                onChange={(e) => setFiltro("remMin", e.target.value)} placeholder="0" aria-label="Remuneração mínima" />
            </label>
          </div>
          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10 }}>
            Os filtros refletem apenas o que as campanhas publicadas informam. Mais critérios (idioma, experiência, modalidade) entram conforme as campanhas passam a registrá-los.
          </div>
        </div>
      )}

      {/* Seleções ativas (compacto) */}
      {ativos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {ativos.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFiltro(k, "")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${AZUL_FILTRO}`, background: "#EAF4FF", color: AZUL_FILTRO, fontFamily: "inherit" }}>
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
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: sel ? "#EAF4FF" : "transparent",
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
