import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Globe2, MapPin, Briefcase, Target, ChevronRight, ArrowLeft,
  Wallet, CheckCircle2, Clock, Flag, Search, SlidersHorizontal, X,
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
function BarraFiltros({ filtros, setFiltro, opcoes, empresa, maisFiltros, setMaisFiltros, limpar, total }) {
  const selStyle = { fontSize: 13, padding: "7px 10px" };
  const ativos = [];
  if (filtros.busca) ativos.push(["busca", `"${filtros.busca}"`]);
  if (filtros.pais) ativos.push(["pais", nomePais(filtros.pais)]);
  if (filtros.funcao) ativos.push(["funcao", (FUNCOES[filtros.funcao]?.nome || filtros.funcao)]);
  if (filtros.moeda) ativos.push(["moeda", filtros.moeda]);
  if (filtros.pagamento) ativos.push(["pagamento", filtros.pagamento === "tarefa" ? "Por tarefa" : "Comissão"]);
  if (filtros.remMin) ativos.push(["remMin", `≥ ${filtros.remMin}`]);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 180px", minWidth: 150 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input className="vx-input" value={filtros.busca} onChange={(e) => setFiltro("busca", e.target.value)}
            placeholder="Buscar empresa ou campanha" aria-label="Buscar"
            style={{ paddingLeft: 30, fontSize: 13 }} />
        </div>
        {opcoes.paises.length > 1 && (
          <select className="vx-input" style={selStyle} value={filtros.pais} onChange={(e) => setFiltro("pais", e.target.value)} aria-label="País">
            <option value="">País</option>
            {opcoes.paises.map((p) => <option key={p} value={p}>{nomePais(p)}</option>)}
          </select>
        )}
        {!empresa && opcoes.funcoes.length > 1 && (
          <select className="vx-input" style={selStyle} value={filtros.funcao} onChange={(e) => setFiltro("funcao", e.target.value)} aria-label="Função">
            <option value="">Função</option>
            {opcoes.funcoes.map((f) => <option key={f} value={f}>{FUNCOES[f]?.nome || f}</option>)}
          </select>
        )}
        {!empresa && (
          <select className="vx-input" style={selStyle} value={filtros.ordenar} onChange={(e) => setFiltro("ordenar", e.target.value)} aria-label="Ordenar">
            <option value="recentes">Mais recentes</option>
            <option value="remuneracao">Maior remuneração</option>
          </select>
        )}
        <button type="button" className="vx-btn vx-btn-sm" onClick={() => setMaisFiltros((v) => !v)} aria-expanded={maisFiltros}>
          <SlidersHorizontal size={13} /> Mais filtros
        </button>
        {ativos.length > 0 && (
          <button type="button" className="vx-btn vx-btn-sm" onClick={limpar}>Limpar</button>
        )}
        <span className="vx-mono" style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>{total} resultado{total === 1 ? "" : "s"}</span>
      </div>

      {maisFiltros && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {opcoes.moedas.length > 1 && (
            <select className="vx-input" style={selStyle} value={filtros.moeda} onChange={(e) => setFiltro("moeda", e.target.value)} aria-label="Moeda">
              <option value="">Moeda</option>
              {opcoes.moedas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {!empresa && (
            <select className="vx-input" style={selStyle} value={filtros.pagamento} onChange={(e) => setFiltro("pagamento", e.target.value)} aria-label="Tipo de pagamento">
              <option value="">Tipo de pagamento</option>
              <option value="tarefa">Por tarefa</option>
              <option value="comissao">Comissão</option>
            </select>
          )}
          {!empresa && (
            <input className="vx-input" type="number" min="0" style={{ ...selStyle, width: 150 }} value={filtros.remMin}
              onChange={(e) => setFiltro("remMin", e.target.value)} placeholder="Remuneração mín." aria-label="Remuneração mínima" />
          )}
        </div>
      )}

      {ativos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {ativos.map(([k, label]) => (
            <button key={k} type="button" className="vx-chip" onClick={() => setFiltro(k, "")}
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, borderColor: "var(--brand)", color: "var(--brand)" }}>
              {label} <X size={12} />
            </button>
          ))}
        </div>
      )}
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
