import { useEffect, useMemo, useState } from "react";
import { Search, X, Clock3, ArrowRight, Webhook, Code2 } from "lucide-react";
import { api } from "../../../lib/api.js";
import IntegracaoMeta from "../IntegracaoMeta.jsx";
import { INTEGRACOES, FILTROS, STATUS, statusMeta, rotuloCategoria } from "./catalogo.js";

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
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  // Ao voltar do login da Meta (?meta=...) abre direto o fluxo da Meta, que
  // processa o aviso e limpa a URL — preservando a experiência original.
  const [aberto, setAberto] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("meta") ? "meta" : null
  );

  // Status REAL da Meta (read-only, mesmo endpoint já usado pela integração).
  useEffect(() => {
    api("/meta/conexao").then((c) => setConexao(c || { conectado: false })).catch(() => setConexao({ conectado: false }));
  }, [aberto]); // reconsulta ao fechar o drawer, refletindo mudanças feitas no fluxo da Meta

  const statusDe = (item) => (item.tipo === "meta" ? statusMeta(conexao) : "em_breve");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return INTEGRACOES.filter((item) => {
      if (termo && !item.nome.toLowerCase().includes(termo)) return false;
      const st = statusDe(item);
      if (filtro === "conectadas") return st === "conectado";
      if (filtro === "disponiveis") return item.tipo !== "em_breve";
      if (["anuncios", "crm", "formularios", "automacoes"].includes(filtro)) return item.categoria === filtro;
      return true; // "todas"
    });
  }, [busca, filtro, conexao]);

  const itemAberto = aberto ? INTEGRACOES.find((i) => i.id === aberto) : null;

  return (
    <>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", margin: "0 0 5px", letterSpacing: "-.02em" }}>Integrações</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
          Conecte suas ferramentas e centralize automaticamente os leads para seus profissionais.
        </p>
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
