import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, Search, LayoutGrid, List, Upload, Link2, X, FileText, Image, Film,
  Music, Presentation, ExternalLink, Download, Trash2, Pencil, MoreVertical,
  FolderOpen, SearchX, ChevronRight, Replace, Share2, GripVertical, File,
} from "lucide-react";
import { api, apiPatch, apiDelete, API_URL } from "../../lib/api.js";

const CATEGORIAS = [
  { chave: "todos", label: "Todos" },
  { chave: "apresentacao", label: "Apresentações" },
  { chave: "documento", label: "Documentos" },
  { chave: "foto", label: "Fotos" },
  { chave: "video", label: "Vídeos" },
  { chave: "audio", label: "Áudios" },
  { chave: "link", label: "Links" },
];

const ICONES_CAT = {
  apresentacao: Presentation, documento: FileText, foto: Image,
  video: Film, audio: Music, link: Link2,
};

const formatarTamanho = (b) => {
  if (!b) return "";
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
};

const formatarData = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const ORDENACOES = [
  { key: "recentes", label: "Mais recentes" },
  { key: "antigos", label: "Mais antigos" },
  { key: "az", label: "Nome A–Z" },
  { key: "za", label: "Nome Z–A" },
];

function ordenar(materiais, chave) {
  const arr = [...materiais];
  switch (chave) {
    case "antigos": return arr.sort((a, b) => a.criadoEm - b.criadoEm);
    case "az": return arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    case "za": return arr.sort((a, b) => b.nome.localeCompare(a.nome, "pt-BR"));
    default: return arr.sort((a, b) => b.criadoEm - a.criadoEm);
  }
}

function filtrar(materiais, busca, categoria) {
  let r = materiais;
  if (categoria !== "todos") r = r.filter(m => m.categoria === categoria);
  if (busca.trim()) {
    const t = busca.toLowerCase().trim();
    r = r.filter(m =>
      m.nome.toLowerCase().includes(t) ||
      (m.descricao || "").toLowerCase().includes(t) ||
      m.categoria.toLowerCase().includes(t) ||
      (m.campanhas || []).some(c => c.titulo.toLowerCase().includes(t))
    );
  }
  return r;
}

export default function MateriaisEmpresa({ emp, db, aviso }) {
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [armazenamento, setArmazenamento] = useState(true);
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState("todos");
  const [ordem, setOrdem] = useState("recentes");
  const [vista, setVista] = useState("grid");
  const [modalUpload, setModalUpload] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [menuAberto, setMenuAberto] = useState(null);

  const carregar = useCallback(async () => {
    const r = await api("/materiais");
    if (r?.materiais) {
      setMateriais(r.materiais);
      setArmazenamento(r.armazenamento);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = ordenar(filtrar(materiais, busca, catFiltro), ordem);

  const limparFiltros = () => { setBusca(""); setCatFiltro("todos"); };

  const excluir = async (m, forcar) => {
    const url = `/materiais/${m.id}${forcar ? "?forcar=1" : ""}`;
    const r = await apiDelete(url);
    if (r?.error && r?.campanhas) {
      if (confirm(`Este material está vinculado a ${r.campanhas.length} campanha(s). Deseja removê-lo mesmo assim?`)) {
        return excluir(m, true);
      }
      return;
    }
    if (r?.error) { aviso?.(r.error); return; }
    setMateriais(prev => prev.filter(x => x.id !== m.id));
    if (detalhe?.id === m.id) setDetalhe(null);
    aviso?.("Material excluído.");
  };

  if (loading) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  return (
    <div className="vx-fade" style={{ position: "relative" }}>
      {/* Cabeçalho */}
      <div className="vx-page-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>Materiais</h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 14 }}>
            Organize e compartilhe conteúdos que ajudam seus profissionais a vender.
          </p>
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => setModalUpload(true)} style={{ whiteSpace: "nowrap", gap: 6 }}>
          <Plus size={16} /> Adicionar material
        </button>
      </div>

      {/* Barra de ferramentas */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 360 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input className="vx-input" placeholder="Buscar materiais..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ paddingLeft: 32, width: "100%", height: 36 }} />
        </div>
        <select className="vx-input" value={ordem} onChange={e => setOrdem(e.target.value)} style={{ height: 36, width: "auto", minWidth: 150 }}>
          {ORDENACOES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 2, background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: 2 }}>
          <button className={`vx-btn vx-btn-sm ${vista === "grid" ? "vx-btn-primary" : "vx-btn-ghost"}`} onClick={() => setVista("grid")} title="Grade" style={{ padding: "5px 8px" }}>
            <LayoutGrid size={16} />
          </button>
          <button className={`vx-btn vx-btn-sm ${vista === "list" ? "vx-btn-primary" : "vx-btn-ghost"}`} onClick={() => setVista("list")} title="Lista" style={{ padding: "5px 8px" }}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Filtros por categoria */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {CATEGORIAS.map(c => (
          <button key={c.chave}
            className={`vx-chip ${catFiltro === c.chave ? "vx-chip-active" : ""}`}
            onClick={() => setCatFiltro(c.chave)}
            style={{
              whiteSpace: "nowrap", cursor: "pointer", fontSize: 13, padding: "5px 14px", borderRadius: "var(--radius-pill)",
              border: "1px solid var(--border)", background: catFiltro === c.chave ? "#318CE7" : "var(--surface)",
              color: catFiltro === c.chave ? "#fff" : "var(--ink-2)", fontWeight: catFiltro === c.chave ? 600 : 400,
              transition: "all .15s",
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Conteúdo principal + detalhe */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {visiveis.length === 0 && materiais.length === 0 && <EstadoVazio onAdd={() => setModalUpload(true)} />}
          {visiveis.length === 0 && materiais.length > 0 && <EstadoSemResultado onLimpar={limparFiltros} />}
          {visiveis.length > 0 && vista === "grid" && (
            <GridMateriais materiais={visiveis} onSelect={setDetalhe} selecionado={detalhe?.id}
              menuAberto={menuAberto} setMenuAberto={setMenuAberto} onExcluir={excluir} />
          )}
          {visiveis.length > 0 && vista === "list" && (
            <ListaMateriais materiais={visiveis} onSelect={setDetalhe} selecionado={detalhe?.id}
              menuAberto={menuAberto} setMenuAberto={setMenuAberto} onExcluir={excluir} />
          )}
        </div>

        {detalhe && (
          <PainelDetalhe material={detalhe} campanhas={(db.campaigns || []).filter(c => c.companyId === emp.id)}
            onClose={() => setDetalhe(null)} onUpdate={(m) => {
              setMateriais(prev => prev.map(x => x.id === m.id ? m : x));
              setDetalhe(m);
            }} onExcluir={excluir} aviso={aviso} recarregar={carregar} />
        )}
      </div>

      {modalUpload && (
        <ModalUpload onClose={() => setModalUpload(false)} aviso={aviso} armazenamento={armazenamento}
          onSucesso={() => { setModalUpload(false); carregar(); }} />
      )}
    </div>
  );
}

/* ====================== GRID ====================== */
function GridMateriais({ materiais, onSelect, selecionado, menuAberto, setMenuAberto, onExcluir }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
      {materiais.map(m => (
        <CardMaterial key={m.id} m={m} ativo={selecionado === m.id} onClick={() => onSelect(m)}
          menuAberto={menuAberto === m.id} setMenuAberto={setMenuAberto} onExcluir={onExcluir} />
      ))}
    </div>
  );
}

function CardMaterial({ m, ativo, onClick, menuAberto, setMenuAberto, onExcluir }) {
  const Icon = ICONES_CAT[m.categoria] || File;
  const ref = useRef(null);

  useEffect(() => {
    if (!menuAberto) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuAberto(null); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuAberto]);

  return (
    <div onClick={onClick} ref={ref}
      style={{
        background: "var(--surface)", border: `1.5px solid ${ativo ? "#318CE7" : "var(--border)"}`,
        borderRadius: "var(--radius-md)", cursor: "pointer", overflow: "hidden",
        transition: "border-color .15s, box-shadow .15s",
        boxShadow: ativo ? "0 0 0 2px rgba(49,140,231,.15)" : "none",
      }}
      onMouseEnter={e => { if (!ativo) e.currentTarget.style.borderColor = "#c5ddf5"; }}
      onMouseLeave={e => { if (!ativo) e.currentTarget.style.borderColor = "var(--border)"; }}>
      {/* Thumbnail */}
      <div style={{
        height: 120, display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface-2)", position: "relative",
      }}>
        {m.categoria === "foto" && m.id ? (
          <img src={`${API_URL}/api/materiais/${m.id}/download`} alt={m.nome}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
            crossOrigin="use-credentials" />
        ) : null}
        <div style={{ display: m.categoria === "foto" ? "none" : "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
          <Icon size={36} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
        </div>
        {/* Menu */}
        <div style={{ position: "absolute", top: 6, right: 6 }}>
          <button onClick={e => { e.stopPropagation(); setMenuAberto(menuAberto ? null : m.id); }}
            className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 3, borderRadius: 6, background: "rgba(255,255,255,.85)" }}>
            <MoreVertical size={16} />
          </button>
          {menuAberto && (
            <div style={{
              position: "absolute", right: 0, top: 28, background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", padding: 4, minWidth: 140, zIndex: 20, boxShadow: "var(--shadow-pop)",
            }}>
              <MenuBtn icon={Download} label="Baixar" onClick={e => { e.stopPropagation(); window.open(`${API_URL}/api/materiais/${m.id}/download`, "_blank"); setMenuAberto(null); }} />
              <MenuBtn icon={Trash2} label="Excluir" danger onClick={e => { e.stopPropagation(); onExcluir(m); setMenuAberto(null); }} />
            </div>
          )}
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {m.nome}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icon size={13} /> {CATEGORIAS.find(c => c.chave === m.categoria)?.label || m.categoria}
          </span>
          <span>{m.tamanho ? formatarTamanho(m.tamanho) : ""}</span>
        </div>
        {m.campanhas?.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#318CE7" }}>
            <Share2 size={11} /> {m.campanhas.length} campanha{m.campanhas.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== LISTA ====================== */
function ListaMateriais({ materiais, onSelect, selecionado, menuAberto, setMenuAberto, onExcluir }) {
  return (
    <div className="vx-table-wrap">
      <table className="vx-table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Campanhas</th>
            <th>Data</th>
            <th style={{ textAlign: "right" }}>Tamanho</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {materiais.map(m => {
            const Icon = ICONES_CAT[m.categoria] || File;
            return (
              <tr key={m.id} onClick={() => onSelect(m)} style={{ cursor: "pointer", background: selecionado === m.id ? "var(--surface-2)" : undefined }}>
                <td><Icon size={16} style={{ color: "var(--muted)" }} /></td>
                <td style={{ fontWeight: 500, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</td>
                <td style={{ color: "var(--muted)" }}>{CATEGORIAS.find(c => c.chave === m.categoria)?.label || m.categoria}</td>
                <td style={{ color: m.campanhas?.length ? "#318CE7" : "var(--muted)" }}>
                  {m.campanhas?.length ? `${m.campanhas.length} campanha${m.campanhas.length > 1 ? "s" : ""}` : "—"}
                </td>
                <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{formatarData(m.criadoEm)}</td>
                <td style={{ textAlign: "right", color: "var(--muted)" }}>{m.tamanho ? formatarTamanho(m.tamanho) : "—"}</td>
                <td>
                  <div style={{ position: "relative" }}>
                    <button onClick={e => { e.stopPropagation(); setMenuAberto(menuAberto === m.id ? null : m.id); }}
                      className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 3 }}>
                      <MoreVertical size={15} />
                    </button>
                    {menuAberto === m.id && (
                      <div style={{
                        position: "absolute", right: 0, top: 28, background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)", padding: 4, minWidth: 140, zIndex: 20, boxShadow: "var(--shadow-pop)",
                      }}>
                        <MenuBtn icon={Download} label="Baixar" onClick={e => { e.stopPropagation(); window.open(`${API_URL}/api/materiais/${m.id}/download`, "_blank"); setMenuAberto(null); }} />
                        <MenuBtn icon={Trash2} label="Excluir" danger onClick={e => { e.stopPropagation(); onExcluir(m); setMenuAberto(null); }} />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ====================== MENU BTN ====================== */
function MenuBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 13,
        background: "none", border: "none", cursor: "pointer", borderRadius: 6,
        color: danger ? "var(--red)" : "var(--ink)",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      <Icon size={15} /> {label}
    </button>
  );
}

/* ====================== PAINEL DETALHE ====================== */
function PainelDetalhe({ material: m, campanhas, onClose, onUpdate, onExcluir, aviso, recarregar }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(m.nome);
  const [descricao, setDescricao] = useState(m.descricao || "");
  const [campSel, setCampSel] = useState((m.campanhas || []).map(c => c.id));
  const [salvando, setSalvando] = useState(false);
  const Icon = ICONES_CAT[m.categoria] || File;

  useEffect(() => {
    setNome(m.nome);
    setDescricao(m.descricao || "");
    setCampSel((m.campanhas || []).map(c => c.id));
    setEditando(false);
  }, [m.id]);

  const salvarEdicao = async () => {
    setSalvando(true);
    const r = await apiPatch(`/materiais/${m.id}`, { nome, descricao });
    if (r?.error) { aviso?.(r.error); setSalvando(false); return; }
    onUpdate(r);
    setEditando(false);
    setSalvando(false);
  };

  const salvarCampanhas = async () => {
    setSalvando(true);
    const r = await fetch(`${API_URL}/api/materiais/${m.id}/campanhas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campanhaIds: campSel }),
      credentials: "include",
    }).then(x => x.json()).catch(() => null);
    if (r?.error) { aviso?.(r.error); setSalvando(false); return; }
    if (r) onUpdate(r);
    setSalvando(false);
    aviso?.("Campanhas atualizadas.");
  };

  const substituirRef = useRef(null);
  const substituir = async (file) => {
    if (!file) return;
    setSalvando(true);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/materiais/${m.id}/substituir`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-Arquivo-Nome", encodeURIComponent(file.name));
    xhr.onload = () => {
      setSalvando(false);
      try {
        const r = JSON.parse(xhr.responseText);
        if (r.error) { aviso?.(r.error); return; }
        onUpdate(r);
        aviso?.("Arquivo substituído.");
      } catch { aviso?.("Erro ao substituir."); }
    };
    xhr.onerror = () => { setSalvando(false); aviso?.("Falha na conexão."); };
    xhr.send(file);
  };

  return (
    <div style={{
      width: 340, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)", padding: 20, position: "sticky", top: 20, maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Detalhes</span>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={16} /></button>
      </div>

      {/* Preview */}
      <div style={{
        background: "var(--surface-2)", borderRadius: "var(--radius-sm)", height: 160,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden",
      }}>
        {m.categoria === "foto" ? (
          <img src={`${API_URL}/api/materiais/${m.id}/download`} alt={m.nome}
            style={{ width: "100%", height: "100%", objectFit: "contain" }} crossOrigin="use-credentials"
            onError={e => { e.target.style.display = "none"; }} />
        ) : m.categoria === "video" ? (
          <video src={`${API_URL}/api/materiais/${m.id}/download`} controls style={{ maxWidth: "100%", maxHeight: "100%" }} crossOrigin="use-credentials" />
        ) : m.categoria === "audio" ? (
          <audio src={`${API_URL}/api/materiais/${m.id}/download`} controls style={{ width: "90%" }} crossOrigin="use-credentials" />
        ) : (
          <Icon size={48} strokeWidth={1.2} style={{ color: "var(--muted)" }} />
        )}
      </div>

      {/* Nome e descrição */}
      {editando ? (
        <div style={{ marginBottom: 14 }}>
          <label className="vx-label">Nome</label>
          <input className="vx-input" value={nome} onChange={e => setNome(e.target.value)} style={{ marginBottom: 8 }} />
          <label className="vx-label">Descrição</label>
          <textarea className="vx-input" value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} style={{ resize: "vertical" }} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvarEdicao} disabled={salvando}>Salvar</button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => { setEditando(false); setNome(m.nome); setDescricao(m.descricao || ""); }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, wordBreak: "break-word" }}>{m.nome}</h3>
          {m.descricao && <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>{m.descricao}</p>}
        </div>
      )}

      {/* Metadados */}
      <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Categoria</span>
          <span style={{ color: "var(--ink)", fontWeight: 500 }}>{CATEGORIAS.find(c => c.chave === m.categoria)?.label || m.categoria}</span>
        </div>
        {m.tamanho > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Tamanho</span><span style={{ color: "var(--ink)" }}>{formatarTamanho(m.tamanho)}</span>
        </div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Adicionado em</span><span style={{ color: "var(--ink)" }}>{formatarData(m.criadoEm)}</span>
        </div>
        {m.atualizadoEm !== m.criadoEm && <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Atualizado em</span><span style={{ color: "var(--ink)" }}>{formatarData(m.atualizadoEm)}</span>
        </div>}
      </div>

      {/* Campanhas */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
          Disponibilidade
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>Escolha em quais campanhas este material estará disponível.</p>
        <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {campanhas.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>Nenhuma campanha criada.</span>}
          {campanhas.map(c => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "4px 0" }}>
              <input type="checkbox" checked={campSel.includes(c.id)}
                onChange={e => {
                  setCampSel(prev => e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id));
                }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</span>
            </label>
          ))}
        </div>
        {campanhas.length > 0 && (
          <button className="vx-btn vx-btn-sm" onClick={salvarCampanhas} disabled={salvando}
            style={{ marginTop: 8, fontSize: 12 }}>
            Salvar campanhas
          </button>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEditando(true)} style={{ justifyContent: "flex-start", gap: 8 }}>
          <Pencil size={14} /> Renomear / Descrever
        </button>
        {m.categoria !== "link" && (
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => window.open(`${API_URL}/api/materiais/${m.id}/download`, "_blank")} style={{ justifyContent: "flex-start", gap: 8 }}>
            <Download size={14} /> Baixar
          </button>
        )}
        {m.url && (
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => window.open(m.url, "_blank", "noopener")} style={{ justifyContent: "flex-start", gap: 8 }}>
            <ExternalLink size={14} /> Abrir link
          </button>
        )}
        {m.categoria !== "link" && (
          <>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => substituirRef.current?.click()} disabled={salvando} style={{ justifyContent: "flex-start", gap: 8 }}>
              <Replace size={14} /> Substituir arquivo
            </button>
            <input ref={substituirRef} type="file" hidden onChange={e => substituir(e.target.files?.[0])} />
          </>
        )}
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => onExcluir(m)}
          style={{ justifyContent: "flex-start", gap: 8, color: "var(--red)" }}>
          <Trash2 size={14} /> Excluir
        </button>
      </div>
    </div>
  );
}

/* ====================== MODAL UPLOAD ====================== */
function ModalUpload({ onClose, aviso, armazenamento, onSucesso }) {
  const [arquivos, setArquivos] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({});
  const [tab, setTab] = useState("arquivo");
  const dropRef = useRef(null);
  const inputRef = useRef(null);

  const addFiles = (files) => {
    const novos = [...files].map(f => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      nome: f.name,
      tamanho: f.size,
      status: "pendente",
    }));
    setArquivos(prev => [...prev, ...novos]);
  };

  const removerArquivo = (id) => setArquivos(prev => prev.filter(a => a.id !== id));

  const enviarTodos = async () => {
    setEnviando(true);
    let ok = 0;
    for (const arq of arquivos) {
      if (arq.status === "ok") { ok++; continue; }
      setArquivos(prev => prev.map(a => a.id === arq.id ? { ...a, status: "enviando" } : a));
      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API_URL}/api/materiais/upload`);
          xhr.withCredentials = true;
          xhr.setRequestHeader("Content-Type", arq.file.type || "application/octet-stream");
          xhr.setRequestHeader("X-Arquivo-Nome", encodeURIComponent(arq.file.name));
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgresso(prev => ({ ...prev, [arq.id]: Math.round(e.loaded / e.total * 100) }));
          };
          xhr.onload = () => {
            try {
              const r = JSON.parse(xhr.responseText);
              if (r.error) reject(new Error(r.error));
              else resolve(r);
            } catch { reject(new Error("Erro no envio")); }
          };
          xhr.onerror = () => reject(new Error("Falha na conexão"));
          xhr.send(arq.file);
        });
        setArquivos(prev => prev.map(a => a.id === arq.id ? { ...a, status: "ok" } : a));
        ok++;
      } catch (e) {
        setArquivos(prev => prev.map(a => a.id === arq.id ? { ...a, status: "erro", erro: e.message } : a));
      }
    }
    setEnviando(false);
    if (ok > 0) {
      aviso?.(`${ok} material(is) enviado(s).`);
      onSucesso();
    }
  };

  const enviarLink = async () => {
    setEnviando(true);
    const r = await api("/materiais/links", { url: linkUrl });
    setEnviando(false);
    if (r?.error) { aviso?.(r.error); return; }
    aviso?.("Link adicionado.");
    onSucesso();
  };

  const onDragOver = (e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#318CE7"; };
  const onDragLeave = (e) => { e.currentTarget.style.borderColor = "var(--border)"; };
  const onDrop = (e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border)"; addFiles(e.dataTransfer.files); };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius-md)", width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto", padding: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Adicionar material</h2>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>
          Envie arquivos ou adicione links para sua biblioteca comercial.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
          {[["arquivo", "Arquivos", Upload], ["link", "Link", Link2]].map(([k, label, Ic]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                padding: "8px 18px", fontSize: 13, fontWeight: tab === k ? 600 : 400,
                color: tab === k ? "#318CE7" : "var(--muted)", background: "none", border: "none",
                borderBottom: tab === k ? "2px solid #318CE7" : "2px solid transparent",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>
              <Ic size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === "arquivo" && (
          <>
            {/* Drop zone */}
            {armazenamento ? (
              <div ref={dropRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                style={{
                  border: "2px dashed var(--border)", borderRadius: "var(--radius-sm)",
                  padding: 32, textAlign: "center", marginBottom: 16, transition: "border-color .15s",
                }}>
                <Upload size={32} strokeWidth={1.3} style={{ color: "var(--muted)", marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Arraste seus arquivos aqui</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Ou selecione arquivos do seu dispositivo.</div>
                <button className="vx-btn vx-btn-sm" onClick={() => inputRef.current?.click()}>Escolher arquivos</button>
                <input ref={inputRef} type="file" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                O envio de arquivos ainda não está disponível. Você pode adicionar links.
              </div>
            )}

            {/* Lista de arquivos selecionados */}
            {arquivos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {arquivos.map(a => (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                    background: "var(--surface-2)", borderRadius: "var(--radius-sm)", fontSize: 13,
                  }}>
                    <File size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {formatarTamanho(a.tamanho)}
                        {a.status === "ok" && <span style={{ color: "var(--green)", marginLeft: 8 }}>Enviado</span>}
                        {a.status === "erro" && <span style={{ color: "var(--red)", marginLeft: 8 }}>{a.erro || "Erro"}</span>}
                        {a.status === "enviando" && <span style={{ color: "#318CE7", marginLeft: 8 }}>{progresso[a.id] || 0}%</span>}
                      </div>
                    </div>
                    {a.status === "pendente" && (
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => removerArquivo(a.id)} style={{ padding: 2 }}>
                        <X size={14} />
                      </button>
                    )}
                    {a.status === "enviando" && (
                      <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${progresso[a.id] || 0}%`, height: "100%", background: "#318CE7", transition: "width .2s" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {arquivos.length > 0 && (
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={enviarTodos} disabled={enviando}
                style={{ width: "100%" }}>
                {enviando ? "Enviando..." : `Enviar ${arquivos.filter(a => a.status !== "ok").length} arquivo(s)`}
              </button>
            )}
          </>
        )}

        {tab === "link" && (
          <div>
            <label className="vx-label">URL</label>
            <input className="vx-input" placeholder="https://" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              style={{ marginBottom: 14 }} />
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={enviarLink} disabled={enviando || !linkUrl.trim()}
              style={{ width: "100%" }}>
              {enviando ? "Adicionando..." : "Adicionar link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== ESTADOS VAZIOS ====================== */
function EstadoVazio({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <FolderOpen size={48} strokeWidth={1.2} style={{ color: "var(--muted)", marginBottom: 12 }} />
      <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>Sua biblioteca começa aqui</h3>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px", maxWidth: 380, marginInline: "auto" }}>
        Adicione apresentações, documentos, imagens e outros materiais para apoiar seus profissionais.
      </p>
      <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onAdd} style={{ gap: 6 }}>
        <Plus size={16} /> Adicionar primeiro material
      </button>
    </div>
  );
}

function EstadoSemResultado({ onLimpar }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <SearchX size={48} strokeWidth={1.2} style={{ color: "var(--muted)", marginBottom: 12 }} />
      <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>Nenhum material encontrado</h3>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>
        Tente outro termo ou ajuste os filtros.
      </p>
      <button className="vx-btn vx-btn-sm" onClick={onLimpar} style={{ gap: 6 }}>
        Limpar filtros
      </button>
    </div>
  );
}
