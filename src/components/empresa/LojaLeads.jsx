import { useState, useEffect, useCallback } from "react";
import {
  Search, MapPin, Phone, Globe, Star, Eye, Plus, Loader2, ChevronRight,
  Building2, FolderOpen, List, Receipt, Pencil, Trash2, ArrowLeft,
  ChevronDown, ListPlus, X, Clock, DollarSign, FileText,
  Megaphone, Link2, Unlink, BarChart3, RefreshCw,
} from "lucide-react";
import { api } from "../../lib/api.js";

const ABAS = [
  { key: "buscar", label: "Encontrar Leads", Icon: Search },
  { key: "revelados", label: "Meus Contatos", Icon: Eye },
  { key: "listas", label: "Minhas Listas", Icon: FolderOpen },
  { key: "consumo", label: "Consumo", Icon: Receipt },
];

const CATEGORIAS = [
  "Restaurantes", "Clínicas", "Academias", "Escritórios de advocacia",
  "Contabilidade", "Imobiliárias", "Salões de beleza", "Pet shops",
  "Oficinas mecânicas", "Dentistas", "Escolas", "Padarias",
  "Farmácias", "Supermercados", "Construtoras", "Consultorias",
];

export default function LojaLeads({ aviso }) {
  const [aba, setAba] = useState("buscar");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Loja de Leads</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Encontre contatos comerciais por segmento e região.
        </p>
      </div>

      <div className="vx-seg" style={{ alignSelf: "flex-start" }}>
        {ABAS.map(({ key, label, Icon }) => (
          <button key={key} data-on={aba === key ? "1" : "0"} onClick={() => setAba(key)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {aba === "buscar" && <AbaBuscar aviso={aviso} />}
      {aba === "revelados" && <AbaRevelados aviso={aviso} />}
      {aba === "listas" && <AbaListas aviso={aviso} />}
      {aba === "consumo" && <AbaConsumo />}
    </div>
  );
}

// ── helpers PATCH / DELETE (api() só faz GET/POST) ──────────────────────────
async function apiPatch(path, body) {
  const res = await fetch(`/api${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(`/api${path}`, { method: "DELETE", credentials: "include" });
  return res.json();
}

// ── helper: carregar todas as listas de todas as pastas ─────────────────────
async function carregarTodasListas() {
  const r = await api("/loja-leads/pastas");
  const pastas = r?.pastas || [];
  const todas = [];
  for (const p of pastas) {
    const lr = await api(`/loja-leads/listas/${p.id}`);
    for (const l of (lr?.listas || [])) todas.push({ ...l, pastaNome: p.nome });
  }
  return todas;
}

// ── Aba Buscar ──────────────────────────────────────────────────────────────
function AbaBuscar({ aviso }) {
  const [texto, setTexto] = useState("");
  const [regiao, setRegiao] = useState("");
  const [contatos, setContatos] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [nextPage, setNextPage] = useState(null);
  const [buscou, setBuscou] = useState(false);
  const [listas, setListas] = useState([]);

  useEffect(() => { carregarTodasListas().then(setListas); }, []);

  const buscar = async (pageToken) => {
    if (!texto.trim()) return aviso?.("Digite o que buscar.");
    setOcupado(true);
    const r = await api("/loja-leads/buscar", { texto: texto.trim(), regiao: regiao.trim(), pageToken });
    setOcupado(false);
    if (!r || r.error) return aviso?.(r?.error || "Erro ao buscar.");
    if (pageToken) setContatos((prev) => [...prev, ...(r.contatos || [])]);
    else setContatos(r.contatos || []);
    setNextPage(r.nextPageToken || null);
    setBuscou(true);
  };

  const revelar = async (contato) => {
    const r = await api("/loja-leads/revelar", { contatoId: contato.id });
    if (!r || r.error) return aviso?.(r?.error || "Erro ao revelar contato.");
    setContatos((prev) => prev.map((c) => c.id === contato.id ? { ...c, revelado: true } : c));
    if (!r.jaRevelado) aviso?.(`Contato "${contato.nome}" revelado.`);
  };

  const adicionarALista = async (contatoId, listaId) => {
    const r = await api("/loja-leads/listas/adicionar", { listaId, contatoId });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Contato adicionado à lista.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {CATEGORIAS.map((cat) => (
          <button key={cat} type="button" className="vx-btn vx-btn-sm"
            onClick={() => setTexto(cat)}
            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20 }}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 200, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
          <input className="vx-input" placeholder="Ex: Restaurantes, Clínicas, Academias..."
            value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            style={{ width: "100%", paddingLeft: 36, minHeight: 44, fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
          <MapPin size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
          <input className="vx-input" placeholder="Cidade ou região"
            value={regiao} onChange={(e) => setRegiao(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            style={{ width: "100%", paddingLeft: 36, minHeight: 44, fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <button type="button" className="vx-btn vx-btn-primary" disabled={ocupado} onClick={() => buscar()}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, whiteSpace: "nowrap" }}>
          {ocupado ? <Loader2 size={15} className="vx-spin" /> : <Search size={15} />}
          {ocupado ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {buscou && contatos.length === 0 && !ocupado && (
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 24 }}>
          Nenhum resultado encontrado. Tente outra categoria ou região.
        </p>
      )}

      {contatos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{contatos.length} resultado(s)</span>
          {contatos.map((c) => (
            <CardContato key={c.id || c.placeId} contato={c} onRevelar={() => revelar(c)}
              listas={listas} onAdicionarLista={(listaId) => adicionarALista(c.id, listaId)} />
          ))}
          {nextPage && (
            <button type="button" className="vx-btn" disabled={ocupado} onClick={() => buscar(nextPage)}
              style={{ alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {ocupado ? <Loader2 size={14} className="vx-spin" /> : <ChevronRight size={14} />}
              Carregar mais
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card de contato ─────────────────────────────────────────────────────────
function CardContato({ contato, onRevelar, listas, onAdicionarLista, onRemover }) {
  const c = contato;
  const oculto = !c.revelado;
  const [menuLista, setMenuLista] = useState(false);

  return (
    <div style={{
      background: "var(--surface-2)", borderRadius: 10, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 8,
      border: oculto ? "1px dashed var(--border)" : "1px solid var(--border)",
      opacity: oculto ? 0.85 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={15} style={{ flexShrink: 0, color: "var(--brand)" }} />
            {c.nome || "Sem nome"}
          </div>
          {c.categoria && (
            <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: 10, display: "inline-block", marginTop: 4 }}>
              {c.categoria.replace(/_/g, " ")}
            </span>
          )}
        </div>
        {c.rating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--amber)", flexShrink: 0 }}>
            <Star size={13} fill="var(--amber)" /> {c.rating.toFixed(1)}
            <span style={{ color: "var(--muted)", fontSize: 11 }}>({c.totalAvaliacoes})</span>
          </div>
        )}
      </div>

      {c.endereco && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)" }}>
          <MapPin size={13} style={{ flexShrink: 0 }} /> {c.endereco}
        </div>
      )}

      {oculto ? (
        <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" onClick={onRevelar}
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36 }}>
          <Eye size={14} /> Revelar contato
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {c.telefone && (
            <a href={`tel:${c.telefone}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--brand)", textDecoration: "none" }}>
              <Phone size={13} /> {c.telefone}
            </a>
          )}
          {c.site && (
            <a href={c.site} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--brand)", textDecoration: "none", wordBreak: "break-all" }}>
              <Globe size={13} /> {c.site.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          {!c.telefone && !c.site && (
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Nenhum contato disponível para este local.</span>
          )}
        </div>
      )}

      {c.revelado && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {listas && listas.length > 0 && (
            <div style={{ position: "relative" }}>
              <button type="button" className="vx-btn vx-btn-sm"
                onClick={() => setMenuLista(!menuLista)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <ListPlus size={13} /> Salvar em lista <ChevronDown size={12} />
              </button>
              {menuLista && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 4,
                  background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,.12)", minWidth: 200, maxHeight: 240, overflowY: "auto",
                }}>
                  {listas.map((l) => (
                    <button key={l.id} type="button"
                      style={{
                        display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                        fontSize: 13, color: "var(--ink)", background: "none", border: "none", cursor: "pointer",
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "none"; }}
                      onClick={() => { onAdicionarLista?.(l.id); setMenuLista(false); }}>
                      <div style={{ fontWeight: 500 }}>{l.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{l.pastaNome}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {onRemover && (
            <button type="button" className="vx-btn vx-btn-sm"
              onClick={onRemover}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--danger)" }}>
              <X size={13} /> Remover
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Aba Revelados ───────────────────────────────────────────────────────────
function AbaRevelados({ aviso }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listas, setListas] = useState([]);

  useEffect(() => {
    Promise.all([
      api("/loja-leads/revelados"),
      carregarTodasListas(),
    ]).then(([r, ls]) => {
      setContatos(r?.contatos || []);
      setListas(ls);
      setLoading(false);
    });
  }, []);

  const adicionarALista = async (contatoId, listaId) => {
    const r = await api("/loja-leads/listas/adicionar", { listaId, contatoId });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Contato adicionado à lista.");
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;

  if (!contatos.length) return (
    <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
      <Eye size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
      <p style={{ margin: 0, fontSize: 14 }}>Nenhum contato revelado ainda.</p>
      <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>Busque por segmento e região para encontrar leads.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{contatos.length} contato(s) revelado(s)</span>
      {contatos.map((c) => (
        <CardContato key={c.id} contato={{ ...c, revelado: true }}
          listas={listas} onAdicionarLista={(listaId) => adicionarALista(c.id, listaId)} />
      ))}
    </div>
  );
}

// ── Aba Listas (Lote 2 — CRUD completo) ────────────────────────────────────
function AbaListas({ aviso }) {
  const [pastas, setPastas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pastaAberta, setPastaAberta] = useState(null);
  const [listaAberta, setListaAberta] = useState(null);

  const recarregar = useCallback(async () => {
    const r = await api("/loja-leads/pastas");
    setPastas(r?.pastas || []);
  }, []);

  useEffect(() => { recarregar().then(() => setLoading(false)); }, []);

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;

  if (listaAberta) {
    return <VistaLista lista={listaAberta} aviso={aviso} voltar={() => setListaAberta(null)} />;
  }

  if (pastaAberta) {
    return (
      <VistaPasta pasta={pastaAberta} aviso={aviso}
        voltar={() => { setPastaAberta(null); recarregar(); }}
        abrirLista={setListaAberta} />
    );
  }

  const novaPasta = async () => {
    const r = await api("/loja-leads/pastas", { nome: "Nova pasta" });
    if (r?.error) return aviso?.(r.error);
    await recarregar();
    aviso?.("Pasta criada.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Pastas</span>
        <button type="button" className="vx-btn vx-btn-sm vx-btn-primary" onClick={novaPasta}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36 }}>
          <Plus size={14} /> Nova pasta
        </button>
      </div>

      {!pastas.length && (
        <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
          <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Nenhuma pasta criada.</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>Organize seus leads em pastas e listas.</p>
        </div>
      )}

      {pastas.map((p) => (
        <PastaCard key={p.id} pasta={p} aviso={aviso} onAbrir={() => setPastaAberta(p)} onAtualizar={recarregar} />
      ))}
    </div>
  );
}

// ── Card de pasta ───────────────────────────────────────────────────────────
function PastaCard({ pasta, aviso, onAbrir, onAtualizar }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(pasta.nome);

  const salvar = async () => {
    if (!nome.trim()) return;
    await apiPatch(`/loja-leads/pastas/${pasta.id}`, { nome: nome.trim() });
    setEditando(false);
    onAtualizar?.();
  };

  const excluir = async () => {
    if (!confirm(`Excluir pasta "${pasta.nome}" e todas as listas dentro dela?`)) return;
    const r = await apiDelete(`/loja-leads/pastas/${pasta.id}`);
    if (r?.error) return aviso?.(r.error);
    aviso?.("Pasta excluída.");
    onAtualizar?.();
  };

  return (
    <div style={{
      background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border)",
      cursor: "pointer",
    }}>
      <FolderOpen size={16} style={{ color: pasta.cor || "var(--brand)", flexShrink: 0 }} />

      {editando ? (
        <div style={{ flex: 1, display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            autoFocus style={{ flex: 1, fontSize: 13, minHeight: 32, padding: "4px 8px" }} />
          <button type="button" className="vx-btn vx-btn-sm vx-btn-primary" onClick={salvar}>OK</button>
          <button type="button" className="vx-btn vx-btn-sm" onClick={() => { setEditando(false); setNome(pasta.nome); }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)" }} onClick={onAbrir}>
            {pasta.nome}
          </span>
          <button type="button" className="vx-btn vx-btn-sm" onClick={(e) => { e.stopPropagation(); setEditando(true); }}
            title="Renomear" style={{ padding: 4 }}>
            <Pencil size={13} />
          </button>
          <button type="button" className="vx-btn vx-btn-sm" onClick={(e) => { e.stopPropagation(); excluir(); }}
            title="Excluir" style={{ padding: 4, color: "var(--danger)" }}>
            <Trash2 size={13} />
          </button>
          <ChevronRight size={15} style={{ color: "var(--muted)" }} onClick={onAbrir} />
        </>
      )}
    </div>
  );
}

// ── Vista de uma pasta (listas dentro) ──────────────────────────────────────
function VistaPasta({ pasta, aviso, voltar, abrirLista }) {
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    const r = await api(`/loja-leads/listas/${pasta.id}`);
    setListas(r?.listas || []);
  }, [pasta.id]);

  useEffect(() => { recarregar().then(() => setLoading(false)); }, []);

  const novaLista = async () => {
    const r = await api("/loja-leads/listas", { pastaId: pasta.id, nome: "Nova lista" });
    if (r?.error) return aviso?.(r.error);
    await recarregar();
    aviso?.("Lista criada.");
  };

  const renomearLista = async (lista, novoNome) => {
    await apiPatch(`/loja-leads/listas/${lista.id}`, { nome: novoNome });
    recarregar();
  };

  const excluirLista = async (lista) => {
    if (!confirm(`Excluir lista "${lista.nome}"?`)) return;
    const r = await apiDelete(`/loja-leads/listas/${lista.id}`);
    if (r?.error) return aviso?.(r.error);
    aviso?.("Lista excluída.");
    recarregar();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="vx-btn vx-btn-sm" onClick={voltar}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 36 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <FolderOpen size={16} style={{ color: pasta.cor || "var(--brand)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{pasta.nome}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{listas.length} lista(s)</span>
        <button type="button" className="vx-btn vx-btn-sm vx-btn-primary" onClick={novaLista}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36 }}>
          <Plus size={14} /> Nova lista
        </button>
      </div>

      {!listas.length && (
        <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
          <List size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Nenhuma lista nesta pasta.</p>
        </div>
      )}

      {listas.map((l) => (
        <ListaCard key={l.id} lista={l}
          onAbrir={() => abrirLista(l)}
          onRenomear={(novoNome) => renomearLista(l, novoNome)}
          onExcluir={() => excluirLista(l)} />
      ))}
    </div>
  );
}

// ── Card de lista ───────────────────────────────────────────────────────────
function ListaCard({ lista, onAbrir, onRenomear, onExcluir }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(lista.nome);

  return (
    <div style={{
      background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border)", cursor: "pointer",
    }}>
      <List size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />

      {editando ? (
        <div style={{ flex: 1, display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { onRenomear(nome.trim()); setEditando(false); } }}
            autoFocus style={{ flex: 1, fontSize: 13, minHeight: 32, padding: "4px 8px" }} />
          <button type="button" className="vx-btn vx-btn-sm vx-btn-primary"
            onClick={() => { onRenomear(nome.trim()); setEditando(false); }}>OK</button>
          <button type="button" className="vx-btn vx-btn-sm" onClick={() => { setEditando(false); setNome(lista.nome); }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1 }} onClick={onAbrir}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{lista.nome}</span>
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
              {lista.totalContatos ?? 0} contato(s)
            </span>
          </div>
          <button type="button" className="vx-btn vx-btn-sm" onClick={(e) => { e.stopPropagation(); setEditando(true); }}
            title="Renomear" style={{ padding: 4 }}>
            <Pencil size={13} />
          </button>
          <button type="button" className="vx-btn vx-btn-sm" onClick={(e) => { e.stopPropagation(); onExcluir(); }}
            title="Excluir" style={{ padding: 4, color: "var(--danger)" }}>
            <Trash2 size={13} />
          </button>
          <ChevronRight size={15} style={{ color: "var(--muted)" }} onClick={onAbrir} />
        </>
      )}
    </div>
  );
}

// ── Vista de uma lista (contatos dentro + vincular à campanha) ─────────────
function VistaLista({ lista, aviso, voltar }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vinculos, setVinculos] = useState([]);
  const [indicadores, setIndicadores] = useState(null);
  const [campanhas, setCampanhas] = useState([]);
  const [mostrarVincular, setMostrarVincular] = useState(false);
  const [campSelecionada, setCampSelecionada] = useState("");
  const [modoVinculo, setModoVinculo] = useState("pontual");
  const [vinculando, setVinculando] = useState(false);

  const recarregar = useCallback(async () => {
    const [r, v, ind] = await Promise.all([
      api(`/loja-leads/listas/${lista.id}/contatos`),
      api(`/loja-leads/vinculos/lista/${lista.id}`),
      api(`/loja-leads/listas/${lista.id}/indicadores`),
    ]);
    setContatos(r?.contatos || []);
    setVinculos(v?.vinculos || []);
    setIndicadores(ind);
  }, [lista.id]);

  useEffect(() => { recarregar().then(() => setLoading(false)); }, []);

  const abrirVincular = async () => {
    const r = await api("/campaigns");
    setCampanhas((r || []).filter((c) => c.status === "ativa" || c.status === "rascunho"));
    setMostrarVincular(true);
  };

  const vincular = async () => {
    if (!campSelecionada) return aviso?.("Selecione uma campanha.");
    setVinculando(true);
    const r = await api("/loja-leads/vincular", { listaId: lista.id, campaignId: campSelecionada, modo: modoVinculo });
    setVinculando(false);
    if (r?.error) return aviso?.(r.error);
    aviso?.(`Lista vinculada. ${r.copiados} contato(s) copiado(s) para a campanha.`);
    setMostrarVincular(false);
    setCampSelecionada("");
    recarregar();
  };

  const desvincular = async (vinculoId) => {
    if (!confirm("Remover vínculo desta lista com a campanha?")) return;
    const r = await apiDelete(`/loja-leads/vinculos/${vinculoId}`);
    if (r?.error) return aviso?.(r.error);
    aviso?.("Vínculo removido.");
    recarregar();
  };

  const sincronizar = async (campaignId) => {
    const r = await api(`/loja-leads/sincronizar/${campaignId}`, {});
    if (r?.error) return aviso?.(r.error);
    aviso?.(`Sincronização concluída. ${r.totalSincronizados} novo(s) contato(s).`);
    recarregar();
  };

  const remover = async (contatoId) => {
    const r = await api("/loja-leads/listas/remover", { listaId: lista.id, contatoId });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Contato removido da lista.");
    recarregar();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="vx-btn vx-btn-sm" onClick={voltar}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 36 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <List size={16} style={{ color: "var(--brand)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{lista.nome}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{contatos.length} contato(s)</span>
        <button type="button" className="vx-btn vx-btn-sm vx-btn-primary" onClick={abrirVincular}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36 }}>
          <Megaphone size={14} /> Vincular à campanha
        </button>
      </div>

      {/* Modal vincular à campanha */}
      {mostrarVincular && (
        <div style={{
          background: "var(--surface-2)", borderRadius: 10, padding: 16,
          border: "1px solid var(--brand)", display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Vincular lista à campanha</span>
            <button type="button" className="vx-btn vx-btn-sm" onClick={() => setMostrarVincular(false)} style={{ padding: 4 }}>
              <X size={14} />
            </button>
          </div>
          <select className="vx-input" value={campSelecionada} onChange={(e) => setCampSelecionada(e.target.value)}
            style={{ fontSize: 13 }}>
            <option value="">Selecione a campanha...</option>
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>{c.titulo} ({c.status})</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" name="modo" value="pontual" checked={modoVinculo === "pontual"} onChange={() => setModoVinculo("pontual")} />
              Pontual
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" name="modo" value="automatica" checked={modoVinculo === "automatica"} onChange={() => setModoVinculo("automatica")} />
              Automática
            </label>
          </div>
          <div className="vx-mut" style={{ fontSize: 11.5 }}>
            {modoVinculo === "pontual"
              ? "Copia os contatos atuais da lista para a campanha uma única vez."
              : "Mantém o vínculo ativo: novos contatos adicionados à lista são sincronizados com a campanha."}
          </div>
          <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" disabled={vinculando || !campSelecionada}
            onClick={vincular} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5 }}>
            {vinculando ? <Loader2 size={13} className="vx-spin" /> : <Link2 size={13} />}
            {vinculando ? "Vinculando..." : "Vincular"}
          </button>
        </div>
      )}

      {/* Campanhas vinculadas */}
      {vinculos.length > 0 && (
        <div style={{
          background: "var(--surface-2)", borderRadius: 10, padding: 14,
          border: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Link2 size={14} style={{ color: "var(--brand)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Campanhas vinculadas
            </span>
          </div>
          {vinculos.map((v) => (
            <div key={v.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "8px 0", borderTop: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{v.campanhaTitulo}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {v.modo === "automatica" ? "Automática" : "Pontual"} · {v.totalCopiados} enviado(s) · {v.campanhaStatus}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {v.modo === "automatica" && (
                  <button type="button" className="vx-btn vx-btn-sm" title="Sincronizar agora"
                    onClick={() => sincronizar(v.campaignId)} style={{ padding: 4 }}>
                    <RefreshCw size={13} />
                  </button>
                )}
                <button type="button" className="vx-btn vx-btn-sm" title="Remover vínculo"
                  onClick={() => desvincular(v.id)} style={{ padding: 4, color: "var(--danger)" }}>
                  <Unlink size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Indicadores de desempenho */}
      {indicadores && indicadores.campanhasVinculadas?.length > 0 && (
        <div style={{
          background: "var(--surface-2)", borderRadius: 10, padding: 14,
          border: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <BarChart3 size={14} style={{ color: "var(--brand)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Desempenho por campanha
            </span>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--surface)" }}>
                  <th style={thStyle}>Campanha</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Enviados</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Distribuídos</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Leads</th>
                </tr>
              </thead>
              <tbody>
                {indicadores.campanhasVinculadas.map((c) => (
                  <tr key={c.campaignId} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{c.titulo}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.status}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{c.contatosEnviados}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{c.distribuidos}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "var(--brand)" }}>{c.leadsGerados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!contatos.length && (
        <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
          <Eye size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Nenhum contato nesta lista.</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5 }}>Busque leads e adicione-os a esta lista.</p>
        </div>
      )}

      {contatos.map((c) => (
        <CardContato key={c.id} contato={{ ...c, revelado: true }}
          onRemover={() => remover(c.id)} />
      ))}
    </div>
  );
}

// ── Aba Consumo (Lote 3 — ciclo + faturas) ─────────────────────────────────
function AbaConsumo() {
  const [ciclo, setCiclo] = useState(null);
  const [faturas, setFaturas] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api("/loja-leads/ciclo"),
      api("/loja-leads/faturas"),
      api("/loja-leads/precos"),
    ]).then(([c, f, p]) => {
      setCiclo(c);
      setFaturas(f?.faturas || []);
      setPrecos(p?.precos || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const formatarData = (ts) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("pt-BR");
  };

  const faturasAnteriores = faturas.filter((f) => f.id !== ciclo?.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {ciclo && (
        <div style={{
          background: "var(--surface-2)", borderRadius: 12, padding: 20, border: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Clock size={16} style={{ color: "var(--brand)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Ciclo atual</span>
            <span style={{
              fontSize: 11, padding: "2px 10px", borderRadius: 10,
              background: "var(--brand)", color: "#fff", fontWeight: 600,
            }}>Aberto</span>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Período" valor={`${formatarData(ciclo.inicio)} — ${formatarData(ciclo.fim)}`} icone={<Clock size={16} />} />
            <StatCard label="Contatos revelados" valor={ciclo.totalContatos} icone={<Eye size={16} />} destaque />
            <StatCard label="Preço/contato" valor={`R$ ${(ciclo.valorUnitario || 0).toFixed(2)}`} icone={<DollarSign size={16} />} />
            <StatCard label="Estimativa" valor={`R$ ${(ciclo.valorTotal || 0).toFixed(2)}`} icone={<Receipt size={16} />} destaque />
          </div>
        </div>
      )}

      {faturasAnteriores.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <FileText size={16} style={{ color: "var(--muted)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Faturas anteriores</span>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <th style={thStyle}>Período</th>
                  <th style={thStyle}>Contatos</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {faturasAnteriores.map((f) => (
                  <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={tdStyle}>{formatarData(f.inicio)} — {formatarData(f.fim)}</td>
                    <td style={tdStyle}>{f.totalContatos}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "var(--brand)" }}>R$ {(f.valorTotal || 0).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 600,
                        background: f.status === "fechado" ? "var(--surface)" : "var(--brand)",
                        color: f.status === "fechado" ? "var(--muted)" : "#fff",
                      }}>
                        {f.status === "fechado" ? "Fechado" : "Aberto"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {precos.length > 0 && (
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
            Tabela de preços
          </span>
          <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--ink-2)" }}>Faixa</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--ink-2)" }}>Valor/contato</th>
                </tr>
              </thead>
              <tbody>
                {precos.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--ink)" }}>{p.faixa} contatos</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--brand)", fontWeight: 600 }}>
                      R$ {p.valorUnitario.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers visuais ─────────────────────────────────────────────────────────
function StatCard({ label, valor, icone, destaque }) {
  return (
    <div style={{
      flex: 1, minWidth: 140, background: destaque ? "var(--brand-bg, var(--surface))" : "var(--surface)",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ color: destaque ? "var(--brand)" : "var(--muted)" }}>{icone}</span>
        <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
      </div>
      <div style={{ fontSize: typeof valor === "number" ? 22 : 14, fontWeight: 700, color: "var(--ink)" }}>{valor}</div>
    </div>
  );
}

const thStyle = { padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--ink-2)", fontSize: 12 };
const tdStyle = { padding: "8px 12px", color: "var(--ink)" };
