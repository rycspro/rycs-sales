import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Circle, Search } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";

// Jornada de cada profissional e empresa: de onde veio (Meta, Google, convite,
// direto), o que já fez dentro da plataforma, onde parou e há quanto tempo.

const PERIODOS = [["30", "30 dias"], ["90", "90 dias"], ["7", "7 dias"], ["0", "Todo o período"]];
const PARADOS = [["0", "Qualquer tempo"], ["3", "Parados há 3+ dias"], ["7", "Parados há 7+ dias"], ["14", "Parados há 14+ dias"]];
const ORDENS = [["recentes", "Mais recentes"], ["parados", "Mais tempo parados"], ["progresso", "Menor progresso"]];
const BADGE_ORIGEM = { meta: "vx-badge-indigo", google: "vx-badge-amber", convite: "vx-badge-brand", outros: "vx-badge-muted", organico: "vx-badge-muted" };
const POR_PAGINA = 60;

function Barra({ pct, cor = "var(--brand)", altura = 8 }) {
  return (
    <div style={{ height: altura, background: "var(--surface-2)", borderRadius: altura, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: cor, borderRadius: altura, transition: "width .4s" }} />
    </div>
  );
}

function Indicador({ label, valor, sub }) {
  return (
    <div className="vx-card" style={{ padding: "14px 16px" }}>
      <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{valor}</div>
      {sub && <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Funil({ titulo, descricao, passos, selecionada, onSelecionar }) {
  if (!passos?.length) return null;
  return (
    <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{titulo}</div>
      <p className="vx-mut" style={{ fontSize: 12.5, margin: "3px 0 14px" }}>{descricao}</p>
      <div style={{ display: "grid", gap: 10 }}>
        {passos.map((p, i) => {
          const ativa = selecionada === p.chave;
          const clicavel = !!onSelecionar && p.paradosAqui > 0;
          const conteudo = (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>{i + 1}. {p.label}</span>
                <span className="vx-mut" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <b style={{ color: "var(--ink)" }}>{p.total}</b> · {p.pct}%
                  {p.perdidos > 0 && i > 0 && <span style={{ color: "var(--danger)" }}> · −{p.perdidos}</span>}
                  {p.paradosAqui > 0 && <span style={{ color: "var(--amber)" }}> · {p.paradosAqui} parado{p.paradosAqui > 1 ? "s" : ""} aqui</span>}
                </span>
              </div>
              <Barra pct={p.pct} cor={ativa ? "var(--amber)" : "var(--brand)"} />
            </>
          );
          return clicavel ? (
            <button key={p.chave} type="button" onClick={() => onSelecionar(ativa ? "" : p.chave)} aria-pressed={ativa}
              title="Mostrar quem parou nesta etapa"
              style={{ all: "unset", cursor: "pointer", display: "block", padding: "6px 8px", margin: "-6px -8px", borderRadius: 8, background: ativa ? "var(--amber-50)" : "transparent", minHeight: 32 }}>
              {conteudo}
            </button>
          ) : <div key={p.chave}>{conteudo}</div>;
        })}
      </div>
    </div>
  );
}

function Linha({ item, aberto, onAlternar }) {
  const parado = item.diasParado;
  const corParado = parado == null ? "vx-badge-muted" : parado >= 7 ? "vx-badge-red" : parado >= 3 ? "vx-badge-amber" : "vx-badge-muted";
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button type="button" onClick={onAlternar} aria-expanded={aberto}
        style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%", padding: "12px 14px", minHeight: 44,
          display: "grid", gridTemplateColumns: "minmax(180px,1.4fr) minmax(130px,1fr) minmax(150px,1.2fr) minmax(150px,1fr)", gap: 12, alignItems: "center" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
          {aberto ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />}
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, color: "var(--ink)", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nome}</span>
            <span className="vx-mut" style={{ display: "block", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.email} · {dataCurta(item.criadoEm)}</span>
          </span>
        </span>
        <span style={{ minWidth: 0 }}>
          <span className={`vx-badge ${BADGE_ORIGEM[item.origem] || "vx-badge-muted"}`}>{item.origemLabel}</span>
          {item.campanhaOrigem && <span className="vx-mut" style={{ display: "block", fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.campanhaOrigem}</span>}
        </span>
        <span>
          <span style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
            <span className="vx-mut">{item.concluidas}/{item.total} etapas</span>
            <b style={{ color: "var(--ink)" }}>{item.pct}%</b>
          </span>
          <Barra pct={item.pct} cor={item.pct === 100 ? "var(--green)" : "var(--brand)"} altura={6} />
        </span>
        <span style={{ fontSize: 12.5 }}>
          {item.etapaAtual ? (
            <>
              <span style={{ display: "block", color: "var(--ink)", fontWeight: 600 }}>Parou em: {item.etapaAtual.label}</span>
              {parado != null && <span className={`vx-badge ${corParado}`} style={{ marginTop: 3 }}>{parado === 0 ? "ativo hoje" : `parado há ${parado} dia${parado > 1 ? "s" : ""}`}</span>}
            </>
          ) : <span className="vx-badge vx-badge-brand">Jornada completa</span>}
        </span>
      </button>
      {aberto && (
        <ol style={{ listStyle: "none", margin: 0, padding: "4px 14px 16px 37px", display: "grid", gap: 6 }}>
          {item.etapas.map((e) => {
            const atual = item.etapaAtual?.chave === e.chave;
            return (
              <li key={e.chave} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: e.feito ? "var(--ink)" : atual ? "var(--amber)" : "var(--muted)", fontWeight: atual ? 700 : 400 }}>
                {e.feito ? <Check size={14} color="var(--green)" strokeWidth={2.6} /> : <Circle size={12} color={atual ? "var(--amber)" : "var(--muted)"} />}
                <span>{e.label}</span>
                <span className="vx-mut" style={{ fontSize: 11.5 }}>{e.feito ? (e.em ? dataCurta(e.em) : "feito") : atual ? "← parou aqui" : ""}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function JornadaAdmin() {
  const id = useId();
  const [tipo, setTipo] = useState("vendedor");
  const [dias, setDias] = useState("30");
  const [origem, setOrigem] = useState("");
  const [busca, setBusca] = useState("");
  const [minParado, setMinParado] = useState("0");
  const [ordem, setOrdem] = useState("recentes");
  const [etapaFiltro, setEtapaFiltro] = useState("");
  const [abertos, setAbertos] = useState(() => new Set());
  const [limite, setLimite] = useState(POR_PAGINA);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setDados(null); setErro(""); setEtapaFiltro(""); setAbertos(new Set()); setLimite(POR_PAGINA);
    const q = new URLSearchParams({ tipo, dias, ...(origem ? { origem } : {}) });
    api(`/admin/jornada?${q}`).then((r) => {
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar a jornada.");
      setDados(r);
    });
  }, [tipo, dias, origem]);

  const lista = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    const min = Number(minParado);
    const filtrada = dados.itens.filter((i) =>
      (!termo || `${i.nome} ${i.email}`.toLowerCase().includes(termo)) &&
      (!etapaFiltro || i.etapaAtual?.chave === etapaFiltro) &&
      (!min || (i.etapaAtual && (i.diasParado ?? 0) >= min)));
    const ordenar = {
      recentes: (a, b) => b.criadoEm - a.criadoEm,
      parados: (a, b) => (b.etapaAtual ? b.diasParado ?? -1 : -2) - (a.etapaAtual ? a.diasParado ?? -1 : -2),
      progresso: (a, b) => a.pct - b.pct || b.criadoEm - a.criadoEm,
    }[ordem];
    return [...filtrada].sort(ordenar);
  }, [dados, busca, minParado, ordem, etapaFiltro]);

  const resumo = useMemo(() => {
    const itens = dados?.itens || [];
    const completos = itens.filter((i) => !i.etapaAtual).length;
    const parados7 = itens.filter((i) => i.etapaAtual && (i.diasParado ?? 0) >= 7).length;
    const media = itens.length ? Math.round(itens.reduce((s, i) => s + i.pct, 0) / itens.length) : 0;
    return { total: itens.length, completos, parados7, media };
  }, [dados]);

  const alternar = (itemId) => setAbertos((s) => {
    const n = new Set(s);
    if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
    return n;
  });

  const nomeTipo = tipo === "empresa" ? "empresas" : "profissionais";
  const etapaFiltroLabel = dados?.funil.find((f) => f.chave === etapaFiltro)?.label;

  return (
    <div className="vx-fade">
      <div className="vx-disp" style={{ fontSize: 22, marginBottom: 6 }}>Rastreamento de jornada</div>
      <p className="vx-mut" style={{ fontSize: 13, marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
        Do clique no anúncio até a última etapa dentro da plataforma: de onde cada pessoa veio, o que já fez,
        onde parou e há quanto tempo. Clique numa etapa do funil para ver quem está parado nela.
      </p>

      <div className="vx-seg vx-subnav" style={{ marginBottom: 14 }}>
        {[["vendedor", "Profissionais"], ["empresa", "Empresas"]].map(([k, l]) => (
          <button key={k} type="button" data-on={tipo === k ? "1" : "0"} onClick={() => setTipo(k)}>{l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 16 }}>
        <label>
          <span className="vx-label" id={`${id}-p`}>Cadastrados em</span>
          <select className="vx-input" aria-labelledby={`${id}-p`} value={dias} onChange={(e) => setDias(e.target.value)}>
            {PERIODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="vx-label" id={`${id}-o`}>Origem</span>
          <select className="vx-input" aria-labelledby={`${id}-o`} value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Todas as origens</option>
            {(dados?.origens || []).map((o) => <option key={o.chave} value={o.chave}>{o.label} ({o.total})</option>)}
            {origem && !dados?.origens?.some((o) => o.chave === origem) && <option value={origem}>{origem}</option>}
          </select>
        </label>
        <label>
          <span className="vx-label" id={`${id}-t`}>Tempo parado</span>
          <select className="vx-input" aria-labelledby={`${id}-t`} value={minParado} onChange={(e) => setMinParado(e.target.value)}>
            {PARADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="vx-label" id={`${id}-r`}>Ordenar por</span>
          <select className="vx-input" aria-labelledby={`${id}-r`} value={ordem} onChange={(e) => setOrdem(e.target.value)}>
            {ORDENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {erro && <div className="vx-card" style={{ padding: 14, color: "var(--danger)", marginBottom: 16 }}>{erro}</div>}
      {!dados && !erro && <div className="vx-card vx-skeleton" style={{ height: 220, marginBottom: 16 }} />}

      {dados && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
          <Indicador label={`Total de ${nomeTipo}`} valor={resumo.total} />
          <Indicador label="Jornada completa" valor={resumo.completos} sub={resumo.total ? `${Math.round((resumo.completos / resumo.total) * 100)}% do total` : null} />
          <Indicador label="Progresso médio" valor={`${resumo.media}%`} />
          <Indicador label="Parados há 7+ dias" valor={resumo.parados7} />
        </div>

        <Funil
          titulo="Antes do cadastro"
          descricao="Visitantes anônimos (registrados a partir desta versão): quem chegou, abriu o cadastro, até onde preencheu e quantos criaram a conta."
          passos={dados.cadastro.map((p, i, arr) => ({ ...p, perdidos: i ? Math.max(0, arr[i - 1].total - p.total) : 0, paradosAqui: 0 }))}
        />
        <Funil
          titulo="Dentro da plataforma"
          descricao={`${tipo === "empresa" ? "Quantas empresas cumpriram" : "Quantos profissionais cumpriram"} cada etapa e quantos estão parados nela.`}
          passos={dados.funil}
          selecionada={etapaFiltro}
          onSelecionar={setEtapaFiltro}
        />

        <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
              {lista.length} {lista.length === 1 ? (tipo === "empresa" ? "empresa" : "profissional") : nomeTipo}
              {etapaFiltroLabel && (
                <button type="button" className="vx-btn vx-btn-sm" style={{ marginLeft: 10 }} onClick={() => setEtapaFiltro("")}>
                  Parados em “{etapaFiltroLabel}” ✕
                </button>
              )}
            </div>
            <label style={{ position: "relative", flex: "0 1 260px" }}>
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar por nome ou e-mail</span>
              <Search size={14} color="var(--muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input className="vx-input" style={{ paddingLeft: 30 }} placeholder="Buscar nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 680 }}>
              {lista.slice(0, limite).map((item) => (
                <Linha key={item.id} item={item} aberto={abertos.has(item.id)} onAlternar={() => alternar(item.id)} />
              ))}
            </div>
          </div>
          {!lista.length && <div className="vx-mut" style={{ padding: 28, textAlign: "center", fontSize: 13 }}>Ninguém encontrado com esses filtros.</div>}
          {lista.length > limite && (
            <div style={{ padding: 12, textAlign: "center" }}>
              <button type="button" className="vx-btn vx-btn-sm" onClick={() => setLimite((l) => l + POR_PAGINA)}>Mostrar mais ({lista.length - limite})</button>
            </div>
          )}
        </div>
      </>}
    </div>
  );
}
