import { useEffect, useMemo, useState } from "react";
import { Search, X, Clock3, ArrowRight, Webhook, Code2, Copy, Check, RefreshCw, Power, ChevronDown } from "lucide-react";
import { api } from "../../../lib/api.js";
import IntegracaoMeta from "../IntegracaoMeta.jsx";
import { PAISES, FILTROS, STATUS, ORDEM_STATUS, statusMeta, rotuloCategoria, integracoesDoPais, paisDoIdioma } from "./catalogo.js";

// ── Seletor de país (menu suspenso) ─────────────────────────────────────────
function SeletorPais({ pais, onEscolher }) {
  const [aberto, setAberto] = useState(false);
  const atual = PAISES.find((p) => p.chave === pais) || PAISES[0];

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    window.addEventListener("click", fechar);
    const onKey = (e) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", fechar); window.removeEventListener("keydown", onKey); };
  }, [aberto]);

  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="vx-btn vx-btn-sm"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 190, justifyContent: "space-between" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{atual.bandeira}</span>{atual.pais}
        </span>
        <ChevronDown size={15} style={{ color: "var(--muted)", transition: "transform .15s", transform: aberto ? "rotate(180deg)" : "none" }} />
      </button>

      {aberto && (
        <div role="listbox" className="vx-fade" style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, minWidth: 220,
          maxHeight: 340, overflowY: "auto", background: "var(--surface-solid)",
          border: "1px solid var(--border-strong)", borderRadius: 12, boxShadow: "var(--shadow-pop)", padding: 6,
        }}>
          {PAISES.map((p) => {
            const on = p.chave === pais;
            return (
              <button
                key={p.chave}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { onEscolher(p.chave); setAberto(false); }}
                style={{
                  width: "100%", textAlign: "left", font: "inherit", fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, border: 0,
                  background: on ? "var(--brand-50)" : "transparent", color: on ? "var(--brand)" : "var(--ink-2)",
                  fontWeight: on ? 600 : 450,
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 17, lineHeight: 1 }}>{p.bandeira}</span>
                <span style={{ flex: 1 }}>{p.pais}</span>
                {on && <Check size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Logotipo oficial da marca ───────────────────────────────────────────────
// Carrega o ícone oficial (SVG, na cor da marca) sobre um ladrilho branco.
// Se a marca não tiver ícone na base ou o carregamento falhar, cai no bloco
// colorido com a inicial — sem distorção e sem quebrar o layout.
function Logo({ item, tam = 44 }) {
  const [erroIcone, setErroIcone] = useState(false);
  const [erroFavicon, setErroFavicon] = useState(false);
  const ladrilho = {
    width: tam, height: tam, borderRadius: 11, background: "#fff", flexShrink: 0,
    border: "1px solid rgba(17,24,39,.08)", display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  };

  // 1ª fonte: ícone oficial da marca (Simple Icons, na cor da marca).
  if (item.slug && !erroIcone) {
    const cor = item.cor.replace("#", "");
    return (
      <div style={ladrilho}>
        <img
          src={`https://cdn.simpleicons.org/${item.slug}/${cor}`}
          alt={item.nome}
          width={Math.round(tam * 0.52)} height={Math.round(tam * 0.52)}
          loading="lazy" onError={() => setErroIcone(true)}
          style={{ display: "block" }}
        />
      </div>
    );
  }

  // Ferramentas genéricas (não são marcas de empresa): ícone de traço.
  const ICONE_LUCIDE = { webhooks: Webhook, "api-rycs": Code2 };
  const IconeGen = ICONE_LUCIDE[item.id];
  if (IconeGen) {
    return (
      <div style={{ ...ladrilho, background: item.cor, border: 0 }}>
        <IconeGen size={Math.round(tam * 0.5)} color="#fff" strokeWidth={2} />
      </div>
    );
  }

  // 2ª fonte: logo real do site (favicon), para marcas sem ícone na base.
  if (item.dominio && !erroFavicon) {
    return (
      <div style={ladrilho}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${item.dominio}&sz=64`}
          alt={item.nome}
          width={Math.round(tam * 0.58)} height={Math.round(tam * 0.58)}
          loading="lazy" onError={() => setErroFavicon(true)}
          style={{ display: "block", objectFit: "contain" }}
        />
      </div>
    );
  }

  // Último recurso: bloco colorido com a inicial da marca.
  return (
    <div style={{
      width: tam, height: tam, borderRadius: 11, background: item.cor, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: item.sigla.length > 2 ? 13 : item.sigla.length > 1 ? 15 : 19,
      letterSpacing: "-.02em", fontFamily: "'Geist','Inter',sans-serif",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)",
    }}>{item.sigla}</div>
  );
}

// ── Indicador de status ─────────────────────────────────────────────────────
function Status({ chave }) {
  const s = STATUS[chave] || STATUS.em_breve;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.cor, flexShrink: 0 }} />
      {s.rotulo}
    </span>
  );
}

// ── Card de integração ──────────────────────────────────────────────────────
function Card({ item, statusChave, onAbrir }) {
  const s = STATUS[statusChave] || STATUS.em_breve;
  const emBreve = statusChave === "em_breve";
  const abrir = () => onAbrir(item);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } }}
      className={`vx-integra-card${emBreve ? " vx-integra-card--soon" : ""}`}
      aria-label={`${item.nome} — ${s.rotulo}`}
      style={{
        textAlign: "left", background: "var(--surface-solid)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 18, cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 12, minHeight: 168, transition: "border-color .18s, box-shadow .18s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Logo item={item} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", letterSpacing: "-.01em" }}>{item.nome}</div>
          <div style={{ marginTop: 3 }}><Status chave={statusChave} /></div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, flex: 1 }}>{item.descricao}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
          {rotuloCategoria(item.categoria)}
        </span>
        {s.acao ? (
          // Disponível/conectado: ação em forma de botão, para dar destaque.
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); abrir(); }}
            className={`vx-btn vx-btn-sm${statusChave === "atencao" ? "" : " vx-btn-primary"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            {s.acao}{statusChave !== "atencao" && <ArrowRight size={13} />}
          </button>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-2)" }}>Em breve</span>
        )}
      </div>
    </div>
  );
}

// ── Painel de configuração do Webhook ───────────────────────────────────────
function PainelWebhook({ aviso }) {
  const [cfg, setCfg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState("");

  const carregar = () => api("/webhooks/config").then((w) => setCfg(w || { ativado: false })).catch(() => setCfg({ ativado: false }));
  useEffect(() => { carregar(); }, []);

  const copiar = async (texto, qual) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(""), 1600); }
    catch { aviso?.("Não foi possível copiar. Selecione e copie manualmente."); }
  };

  const ativar = async () => { setOcupado(true); await api("/webhooks/ativar", {}); await carregar(); setOcupado(false); aviso?.("Webhook ativado. Já pode receber leads."); };
  const rotacionar = async () => {
    if (!window.confirm("Gerar um novo endereço? O endereço atual para de funcionar na hora.")) return;
    setOcupado(true); await api("/webhooks/rotacionar", {}); await carregar(); setOcupado(false); aviso?.("Novo endereço gerado.");
  };
  const alternar = async () => { setOcupado(true); await api("/webhooks/ativo", { ativo: !cfg.ativo }); await carregar(); setOcupado(false); };

  if (!cfg) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const Rotulo = ({ children }) => <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>{children}</div>;
  const CampoCopia = ({ valor, qual, mono = true }) => (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      <input readOnly value={valor} className="vx-input" style={{ fontFamily: mono ? "'Geist Mono',monospace" : "inherit", fontSize: 12, flex: 1, minWidth: 0 }} onFocus={(e) => e.target.select()} />
      <button type="button" className="vx-btn vx-btn-sm" disabled={ocupado} onClick={() => copiar(valor, qual)} style={{ flexShrink: 0 }}>
        {copiado === qual ? <Check size={14} style={{ color: "var(--green)" }} /> : <Copy size={14} />}
      </button>
    </div>
  );

  if (!cfg.ativado) return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
        Gere um endereço exclusivo da sua empresa. Qualquer sistema (site, formulário, automação) que enviar um contato
        para esse endereço vira um lead, entregue automaticamente a um profissional aprovado — igual aos leads da Meta.
      </p>
      <button type="button" className="vx-btn vx-btn-primary" disabled={ocupado} onClick={ativar} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Webhook size={15} /> {ocupado ? "Ativando..." : "Ativar webhook"}
      </button>
    </div>
  );

  const exemplo = `curl -X POST ${cfg.url} \\
  -H "Content-Type: application/json" \\
  -d '{"nome":"Maria Silva","email":"maria@email.com","telefone":"11999999999"}'`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Rotulo>Endereço do webhook (URL)</Rotulo>
        <CampoCopia valor={cfg.url} qual="url" />
        <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          Envie um <b>POST</b> com JSON para este endereço. Mantenha-o em segredo — quem tiver o endereço pode enviar leads.
        </p>
      </div>

      <div>
        <Rotulo>Campos aceitos</Rotulo>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
          <code>nome</code>, <code>email</code>, <code>telefone</code>, <code>empresa</code>, <code>cargo</code>.
          Também entende variações comuns (<code>name</code>, <code>phone</code>, <code>company</code>…) e campos dentro de <code>data</code> ou <code>fields</code>.
        </p>
      </div>

      <div>
        <Rotulo>Exemplo</Rotulo>
        <div style={{ position: "relative" }}>
          <pre style={{ margin: 0, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", fontSize: 11.5, lineHeight: 1.6, overflowX: "auto", fontFamily: "'Geist Mono',monospace", color: "var(--ink-2)" }}>{exemplo}</pre>
          <button type="button" className="vx-btn vx-btn-sm" onClick={() => copiar(exemplo, "curl")} style={{ position: "absolute", top: 8, right: 8 }}>
            {copiado === "curl" ? <Check size={14} style={{ color: "var(--green)" }} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: "var(--muted)" }}>
        <span>Recebidos: <b style={{ color: "var(--ink)" }}>{cfg.total || 0}</b></span>
        {cfg.ultimoRecebidoEm && <span>Último: {new Date(cfg.ultimoRecebidoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <button type="button" className="vx-btn vx-btn-sm" disabled={ocupado} onClick={rotacionar} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={13} /> Gerar novo endereço
        </button>
        <button type="button" className={`vx-btn vx-btn-sm${cfg.ativo ? " vx-btn-danger" : " vx-btn-primary"}`} disabled={ocupado} onClick={alternar} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Power size={13} /> {cfg.ativo ? "Pausar recebimento" : "Reativar"}
        </button>
      </div>
      {!cfg.ativo && <p style={{ margin: 0, fontSize: 12.5, color: "var(--amber)" }}>Recebimento pausado — o endereço não aceita leads até reativar.</p>}
    </div>
  );
}

// ── Drawer lateral direito ──────────────────────────────────────────────────
function Drawer({ item, statusChave, aviso, campanhas, onFechar }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  if (!item) return null;
  const s = STATUS[statusChave] || STATUS.em_breve;

  return (
    <div onClick={onFechar} className="vx-fade" style={{
      position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,17,33,.38)",
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Integração ${item.nome}`} style={{
        width: "min(480px, 100%)", height: "100%", background: "var(--surface-solid)",
        borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-pop)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Cabeçalho do drawer */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "20px 22px", borderBottom: "1px solid var(--border)" }}>
          <Logo item={item} tam={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{item.nome}</div>
            <div style={{ fontSize: 12, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, marginTop: 2 }}>
              {rotuloCategoria(item.categoria)}
            </div>
            <div style={{ marginTop: 6 }}><Status chave={statusChave} /></div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 7 }}>
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          {item.tipo === "meta" ? (
            // Reutiliza INTEGRALMENTE o fluxo real da Meta já existente.
            <IntegracaoMeta aviso={aviso} campanhas={campanhas} semCabecalho />
          ) : item.tipo === "webhook" ? (
            <PainelWebhook aviso={aviso} />
          ) : (
            <div style={{ textAlign: "center", padding: "32px 8px" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%", background: "var(--surface-2)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}>
                <Clock3 size={24} style={{ color: "var(--muted)" }} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Integração em breve</h3>
              <p style={{ margin: "0 auto", maxWidth: 320, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                Estamos preparando esta integração para que você possa conectar suas ferramentas à RYCS.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página: Central de Integrações ──────────────────────────────────────────
export default function Integracoes({ aviso, campanhas = [] }) {
  const [conexao, setConexao] = useState(null);
  const [webhook, setWebhook] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  // País do catálogo: começa no idioma logado; os botões no topo alternam.
  const [pais, setPais] = useState(paisDoIdioma);
  const catalogo = useMemo(() => integracoesDoPais(pais), [pais]);
  // Ao voltar do login da Meta (?meta=...) abre direto o fluxo da Meta, que
  // processa o aviso e limpa a URL — preservando a experiência original.
  const [aberto, setAberto] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("meta") ? "meta" : null
  );

  // Status REAL das integrações ligadas (read-only). Reconsulta ao fechar o
  // drawer, refletindo mudanças feitas lá dentro.
  useEffect(() => {
    api("/meta/conexao").then((c) => setConexao(c || { conectado: false })).catch(() => setConexao({ conectado: false }));
    api("/webhooks/config").then((w) => setWebhook(w || { ativado: false })).catch(() => setWebhook({ ativado: false }));
  }, [aberto]);

  const statusDe = (item) => {
    if (item.tipo === "meta") return statusMeta(conexao);
    if (item.tipo === "webhook") return webhook?.ativado && webhook?.ativo ? "conectado" : "nao_conectado";
    return "em_breve";
  };

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrada = catalogo.filter((item) => {
      if (termo && !item.nome.toLowerCase().includes(termo)) return false;
      const st = statusDe(item);
      if (filtro === "conectadas") return st === "conectado";
      if (filtro === "disponiveis") return item.tipo !== "em_breve";
      if (["anuncios", "crm", "formularios", "automacoes"].includes(filtro)) return item.categoria === filtro;
      return true; // "todas"
    });
    // Ativas/conectáveis primeiro, "Em breve" por último (sort estável mantém a
    // ordem base do país como critério de desempate).
    return filtrada
      .map((item, i) => ({ item, i, rank: ORDEM_STATUS[statusDe(item)] ?? 9 }))
      .sort((a, b) => a.rank - b.rank || a.i - b.i)
      .map((x) => x.item);
  }, [busca, filtro, conexao, webhook, catalogo]);

  const itemAberto = aberto ? catalogo.find((i) => i.id === aberto) : null;

  return (
    <>
      {/* Cabeçalho + seletor de país (segue o idioma; alterna o catálogo) */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", margin: "0 0 5px", letterSpacing: "-.02em" }}>Integrações</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            Conecte suas ferramentas e centralize automaticamente os leads para seus profissionais.
          </p>
        </div>
        <SeletorPais pais={pais} onEscolher={(c) => { setPais(c); setFiltro("todas"); }} />
      </div>

      {/* Busca */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)", pointerEvents: "none" }} />
        <input
          className="vx-input"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar integrações..."
          aria-label="Buscar integrações"
          style={{ paddingLeft: 38 }}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {FILTROS.map((f) => {
          const on = filtro === f.chave;
          return (
            <button
              key={f.chave}
              type="button"
              onClick={() => setFiltro(f.chave)}
              aria-pressed={on}
              style={{
                font: "inherit", fontSize: 12.5, fontWeight: 500, padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${on ? "#318CE7" : "var(--border-strong)"}`,
                background: on ? "#318CE7" : "var(--surface-solid)",
                color: on ? "#fff" : "var(--ink-2)", transition: ".15s",
              }}
            >{f.rotulo}</button>
          );
        })}
      </div>

      {/* Grade de cards */}
      {lista.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)", padding: "24px 0" }}>Nenhuma integração encontrada.</p>
      ) : (
        <div className="vx-integra-grid">
          {lista.map((item) => (
            <Card key={item.id} item={item} statusChave={statusDe(item)} onAbrir={(i) => setAberto(i.id)} />
          ))}
        </div>
      )}

      {/* Drawer */}
      {itemAberto && (
        <Drawer
          item={itemAberto}
          statusChave={statusDe(itemAberto)}
          aviso={aviso}
          campanhas={campanhas}
          onFechar={() => setAberto(null)}
        />
      )}
    </>
  );
}
