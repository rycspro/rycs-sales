import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleDashed } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";

// Histórico das campanhas de anúncio da RYCS: campanha → conjunto → anúncio,
// com visitas, contas criadas, marcos dentro da plataforma, país das contas e
// gasto da Meta. Dois tipos: campanhas de profissionais e de empresas.

const PERIODOS = [["30", "30 dias"], ["7", "7 dias"], ["90", "90 dias"], ["0", "Todo o período"]];
const ORIGENS = [["meta", "Meta Ads"], ["google", "Google"], ["", "Todas as origens"]];
const DIA = 24 * 60 * 60 * 1000;

const num = (n) => (Number(n) || 0).toLocaleString("pt-BR");
const taxa = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const brl = (v) => money(v, "BRL");
let nomesPais;
const nomePais = (code) => {
  if (!code || code === "?") return "Sem país";
  try { return (nomesPais ||= new Intl.DisplayNames(["pt-BR"], { type: "region" })).of(code) || code; } catch { return code; }
};
const diaCurto = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const chaveDia = (ms) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function Indicador({ label, valor, sub }) {
  return (
    <div className="vx-card" style={{ padding: "14px 16px" }}>
      <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{valor}</div>
      {sub && <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Status({ ok, aviso, children }) {
  const Icone = ok ? CheckCircle2 : aviso ? AlertTriangle : CircleDashed;
  const cor = ok ? "var(--green)" : aviso ? "var(--amber)" : "var(--muted)";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
      <Icone size={16} color={cor} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function StatusRastreio({ rastreio, gastoMeta }) {
  const eventos = Object.entries(rastreio.eventos || {}).sort((a, b) => b[1].enviados - a[1].enviados);
  return (
    <div className="vx-card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>Rastreamento</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
        <Status ok>Pixel <b>RYCS Plataforma</b> ({rastreio.pixelId}) na landing e no app, depois do aceite de cookies.</Status>
        {rastreio.capiAtiva
          ? <Status ok>API de Conversões ativa: cadastros e marcos também saem pelo servidor.</Status>
          : <Status aviso>API de Conversões desligada: falta o secret <code>META_CAPI_TOKEN</code> e um deploy.</Status>}
        {gastoMeta.status === "ok" && <Status ok>Gasto, impressões e cliques vêm da conta de anúncios RYCS SALES MACHINE.</Status>}
        {gastoMeta.status === "sem_token" && <Status>Gasto da Meta não conectado: crie o secret <code>META_ADS_TOKEN</code> para ver gasto e custo por conta.</Status>}
        {gastoMeta.status === "erro" && <Status aviso>Não foi possível buscar o gasto na Meta: {gastoMeta.erro}</Status>}
      </div>
      {eventos.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span className="vx-mut" style={{ fontSize: 12, alignSelf: "center" }}>Enviados à Meta pelo servidor no período:</span>
          {eventos.map(([nome, e]) => (
            <span key={nome} className={`vx-badge ${e.erros ? "vx-badge-amber" : "vx-badge-muted"}`}>
              {nome} · {num(e.enviados)}{e.erros ? ` · ${num(e.erros)} com erro` : ""}
            </span>
          ))}
        </div>
      )}
      {rastreio.ultimoErro && (
        <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 8 }}>Último erro ({rastreio.ultimoErro.evento}): {rastreio.ultimoErro.erro}</div>
      )}
    </div>
  );
}

// Um gráfico pequeno por medida (escalas diferentes não dividem eixo). O
// destaque do dia passa de um para o outro: `foco` é compartilhado.
function Barras({ titulo, dias, campo, formatar = num, foco, setFoco }) {
  const max = Math.max(1, ...dias.map((d) => d[campo] || 0));
  const total = dias.reduce((s, d) => s + (d[campo] || 0), 0);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{titulo}</span>
        <span className="vx-mut" style={{ fontVariantNumeric: "tabular-nums" }}>{formatar(total)} no período</span>
      </div>
      <div role="img" aria-label={`${titulo}: ${formatar(total)} no período`}
        style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 96, borderBottom: "1px solid var(--border-strong)" }}
        onMouseLeave={() => setFoco(null)}>
        {dias.map((d, i) => {
          const v = d[campo] || 0;
          return (
            <div key={d.dia} onMouseEnter={() => setFoco(i)} title={`${diaCurto(d.dia)}: ${formatar(v)}`}
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "default" }}>
              <div style={{
                width: "100%", height: v ? `${Math.max(3, (v / max) * 100)}%` : 0, borderRadius: "4px 4px 0 0",
                background: "var(--brand)", opacity: foco == null || foco === i ? 1 : 0.35, transition: "opacity .15s",
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Historico({ dias, comGasto, titulo, onLimpar }) {
  const [foco, setFoco] = useState(null);
  const d = foco != null ? dias[foco] : null;
  return (
    <div className="vx-card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Histórico por dia · {titulo}</div>
        {onLimpar && <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 36 }} onClick={onLimpar}>Ver todas as campanhas</button>}
      </div>
      <div className="vx-mut" aria-live="polite" style={{ fontSize: 12, minHeight: 18, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
        {d ? <>{diaCurto(d.dia)}: <b style={{ color: "var(--ink)" }}>{num(d.visitas)}</b> {d.visitas === 1 ? "visita" : "visitas"} · <b style={{ color: "var(--ink)" }}>{num(d.contas)}</b> {d.contas === 1 ? "conta" : "contas"}{comGasto && <> · <b style={{ color: "var(--ink)" }}>{brl(d.gasto)}</b> de gasto</>}</>
          : "Passe o mouse num dia para ver os números."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
        <Barras titulo="Visitas" dias={dias} campo="visitas" foco={foco} setFoco={setFoco} />
        <Barras titulo="Contas criadas" dias={dias} campo="contas" foco={foco} setFoco={setFoco} />
        {comGasto && <Barras titulo="Gasto" dias={dias} campo="gasto" formatar={brl} foco={foco} setFoco={setFoco} />}
      </div>
      {dias.length > 0 && (
        <div className="vx-mut" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
          <span>{diaCurto(dias[0].dia)}</span><span>{diaCurto(dias[dias.length - 1].dia)}</span>
        </div>
      )}
    </div>
  );
}

// Dias sem movimento também aparecem (barra vazia), do início do período até hoje.
function preencherDias(diasComDados, periodo) {
  const porDia = new Map(diasComDados.map((d) => [d.dia, d]));
  const hoje = Date.now();
  const primeiro = Number(periodo) > 0
    ? hoje - (Number(periodo) - 1) * DIA
    : diasComDados.length ? new Date(`${diasComDados[0].dia}T12:00:00-03:00`).getTime() : hoje;
  const lista = [];
  for (let t = primeiro; chaveDia(t) <= chaveDia(hoje) && lista.length < 800; t += DIA) {
    const k = chaveDia(t);
    if (!lista.length || lista[lista.length - 1].dia !== k) lista.push(porDia.get(k) || { dia: k, visitas: 0, contas: 0, gasto: 0 });
  }
  return lista;
}

const COLUNAS = "minmax(220px,2fr) repeat(3,minmax(72px,.7fr)) repeat(4,minmax(92px,.8fr)) minmax(90px,.8fr) minmax(90px,.8fr) minmax(120px,1fr)";

function Celula({ valor, sub }) {
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--ink)" }}>
      {valor}{sub && <span className="vx-mut" style={{ display: "block", fontSize: 11 }}>{sub}</span>}
    </span>
  );
}

function LinhaGrupo({ g, marcos, nivel, aberto, onAlternar, selecionado, temGasto }) {
  const paises = Object.entries(g.paises || {}).sort((a, b) => b[1] - a[1]);
  const depositos = Object.entries(g.depositos || {}).filter(([, v]) => v > 0).map(([m, v]) => money(v, m)).join(" · ");
  const expansivel = !!onAlternar;
  const Nome = (
    <span style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, paddingLeft: nivel * 18 }}>
      {expansivel ? (aberto ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />) : <span style={{ width: 15 }} />}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: nivel ? 500 : 700, color: "var(--ink)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.nome}>{g.nome}</span>
        {nivel === 0 && g.tipo === "" && <span className="vx-mut" style={{ fontSize: 11 }}>tipo ainda indefinido</span>}
      </span>
    </span>
  );
  const conteudo = (
    <>
      {Nome}
      <Celula valor={num(g.visitas)} sub={g.abriram ? `${num(g.abriram)} abriram` : null} />
      <Celula valor={num(g.contas)} />
      <Celula valor={taxa(g.contas, g.visitas)} />
      {marcos.map((m) => (
        <Celula key={m.chave} valor={num(g.marcos?.[m.chave])} sub={m.chave === "saldo" && depositos ? depositos : taxa(g.marcos?.[m.chave] || 0, g.contas)} />
      ))}
      <Celula valor={temGasto ? brl(g.gasto) : "—"} sub={temGasto && g.cliques ? `${num(g.cliques)} cliques` : null} />
      <Celula valor={g.custoPorConta != null ? brl(g.custoPorConta) : "—"} />
      <span style={{ fontSize: 12, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={paises.map(([p, n]) => `${nomePais(p)}: ${n}`).join("\n")}>
        {paises.length ? paises.slice(0, 3).map(([p, n]) => `${p === "?" ? "—" : p} ${n}`).join(" · ") : "—"}
      </span>
    </>
  );
  const estilo = { display: "grid", gridTemplateColumns: COLUNAS, gap: 10, alignItems: "center", padding: "10px 14px", minHeight: 44, boxSizing: "border-box", width: "100%" };
  return expansivel ? (
    <button type="button" onClick={onAlternar} aria-expanded={aberto}
      style={{ all: "unset", cursor: "pointer", ...estilo, background: selecionado ? "var(--brand-50)" : "transparent" }}>
      {conteudo}
    </button>
  ) : <div style={estilo}>{conteudo}</div>;
}

function TabelaCampanhas({ dados, abertos, alternar, selecionada }) {
  const { marcos, campanhas, total } = dados;
  const temGasto = !!total.temGasto;
  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1180 }}>
          <div className="vx-mut" style={{ display: "grid", gridTemplateColumns: COLUNAS, gap: 10, padding: "10px 14px", fontSize: 11.5, fontWeight: 600, borderBottom: "1px solid var(--border)" }}>
            <span>Campanha → conjunto → anúncio</span><span>Visitas</span><span>Contas</span><span>Visita → conta</span>
            {marcos.map((m) => <span key={m.chave}>{m.label}</span>)}
            <span>Gasto</span><span>Custo por conta</span><span>Países</span>
          </div>
          {campanhas.map((c) => {
            const kc = `c:${c.nome}`;
            return (
              <div key={kc} style={{ borderBottom: "1px solid var(--border)" }}>
                <LinhaGrupo g={c} marcos={marcos} nivel={0} temGasto={temGasto} aberto={abertos.has(kc)} onAlternar={() => alternar(kc, c.nome)} selecionado={selecionada === c.nome} />
                {abertos.has(kc) && c.conjuntos.map((s) => {
                  const ks = `${kc}|s:${s.nome}`;
                  return (
                    <div key={ks}>
                      <LinhaGrupo g={s} marcos={marcos} nivel={1} temGasto={temGasto} aberto={abertos.has(ks)} onAlternar={() => alternar(ks)} />
                      {abertos.has(ks) && s.anuncios.map((a) => (
                        <LinhaGrupo key={`${ks}|a:${a.nome}`} g={a} marcos={marcos} nivel={2} temGasto={temGasto} />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {campanhas.length > 0 && (
            <div style={{ background: "var(--surface-2)" }}>
              <LinhaGrupo g={{ ...total, nome: "Total" }} marcos={marcos} nivel={0} temGasto={temGasto} />
            </div>
          )}
        </div>
      </div>
      {!campanhas.length && (
        <div className="vx-mut" style={{ padding: 28, textAlign: "center", fontSize: 13, lineHeight: 1.6 }}>
          Nenhuma campanha com visitas ou contas neste período. Os anúncios precisam dos parâmetros de URL
          (utm_campaign, utm_term, utm_content) para aparecer aqui.
        </div>
      )}
    </div>
  );
}

export default function CampanhasAdmin() {
  const id = useId();
  const [tipo, setTipo] = useState("vendedor");
  const [dias, setDias] = useState("30");
  const [origem, setOrigem] = useState("meta");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [abertos, setAbertos] = useState(() => new Set());
  const [selecionada, setSelecionada] = useState("");

  useEffect(() => {
    setDados(null); setErro(""); setAbertos(new Set()); setSelecionada("");
    const q = new URLSearchParams({ tipo, dias, origem });
    api(`/admin/campanhas?${q}`).then((r) => {
      if (!r || r.error) return setErro(r?.error || "Não foi possível carregar as campanhas.");
      setDados(r);
    });
  }, [tipo, dias, origem]);

  const alternar = (chave, campanha) => {
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave); else n.add(chave);
      return n;
    });
    if (campanha) setSelecionada((atual) => (atual === campanha ? "" : campanha));
  };

  const serie = useMemo(() => {
    if (!dados) return [];
    const base = selecionada ? dados.campanhas.find((c) => c.nome === selecionada)?.dias : dados.total.dias;
    return preencherDias(base || [], dias);
  }, [dados, selecionada, dias]);

  const t = dados?.total;
  const ultimoMarco = dados?.marcos?.[dados.marcos.length - 1];
  const nomeTipo = tipo === "empresa" ? "empresas" : "profissionais";

  return (
    <div className="vx-fade">
      <div className="vx-disp" style={{ fontSize: 22, marginBottom: 6 }}>Campanhas de anúncio</div>
      <p className="vx-mut" style={{ fontSize: 13, marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
        Histórico de cada campanha de cadastro: visitas, contas criadas, o que as contas fizeram depois, de que país vieram e
        quanto custou. Clique numa campanha para abrir os conjuntos e anúncios e ver o histórico dela por dia.
      </p>

      <div className="vx-seg vx-subnav" style={{ marginBottom: 14 }}>
        {[["vendedor", "Campanhas de profissionais"], ["empresa", "Campanhas de empresas"]].map(([k, l]) => (
          <button key={k} type="button" data-on={tipo === k ? "1" : "0"} onClick={() => setTipo(k)}>{l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 16, maxWidth: 520 }}>
        <label>
          <span className="vx-label" id={`${id}-p`}>Período</span>
          <select className="vx-input" aria-labelledby={`${id}-p`} value={dias} onChange={(e) => setDias(e.target.value)}>
            {PERIODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="vx-label" id={`${id}-o`}>Origem</span>
          <select className="vx-input" aria-labelledby={`${id}-o`} value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {ORIGENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {erro && <div className="vx-card" style={{ padding: 14, color: "var(--danger)", marginBottom: 16 }}>{erro}</div>}
      {!dados && !erro && <div className="vx-card vx-skeleton" style={{ height: 260, marginBottom: 16 }} />}

      {dados && <>
        <StatusRastreio rastreio={dados.rastreio} gastoMeta={dados.gastoMeta} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
          <Indicador label="Visitas" valor={num(t.visitas)} sub={t.abriram ? `${num(t.abriram)} abriram o cadastro` : null} />
          <Indicador label={`Contas de ${nomeTipo}`} valor={num(t.contas)} sub={`${taxa(t.contas, t.visitas)} das visitas`} />
          {t.temGasto && <Indicador label="Gasto" valor={brl(t.gasto)} sub={t.cliques ? `${num(t.cliques)} cliques no link` : null} />}
          {t.temGasto && <Indicador label="Custo por conta" valor={t.custoPorConta != null ? brl(t.custoPorConta) : "—"} />}
          {ultimoMarco && <Indicador label={ultimoMarco.label} valor={num(t.marcos?.[ultimoMarco.chave])} sub={`${taxa(t.marcos?.[ultimoMarco.chave] || 0, t.contas)} das contas`} />}
        </div>

        <Historico dias={serie} comGasto={!!t.temGasto} titulo={selecionada || "todas as campanhas"} onLimpar={selecionada ? () => setSelecionada("") : null} />
        <TabelaCampanhas dados={dados} abertos={abertos} alternar={alternar} selecionada={selecionada} />
      </>}
    </div>
  );
}
