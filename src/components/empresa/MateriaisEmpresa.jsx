import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Plus, Search, X, Presentation, FileText, Images, Video, Headphones, Link2,
  ExternalLink, Download, Trash2, Pencil, MoreVertical, SearchX,
  ChevronRight, ArrowUpRight, Replace, Share2, Upload, File, FileUp,
  LayoutGrid, List, Eye,
} from "lucide-react";
import { api, apiPatch, apiDelete, API_URL } from "../../lib/api.js";
import { CardsInformacoes, SecaoInformacoes } from "./InformacoesEmpresa.jsx";

// As seis pastas da biblioteca. Os formatos espelham o que o backend aceita
// (server/routes/materiais.js). "link" não tem upload de arquivo.
const PASTAS = [
  { chave: "apresentacao", label: "Apresentações", descricao: "Decks e pitches comerciais", Icon: Presentation, formatos: ["pdf", "ppt", "pptx", "key"] },
  { chave: "documento", label: "Documentos", descricao: "Propostas, contratos e materiais de apoio", Icon: FileText, formatos: ["pdf", "doc", "docx", "xls", "xlsx", "txt"] },
  { chave: "foto", label: "Fotos", descricao: "Imagens de produtos e campanhas", Icon: Images, formatos: ["jpg", "jpeg", "png", "webp"] },
  { chave: "video", label: "Vídeos", descricao: "Vídeos institucionais e demonstrações", Icon: Video, formatos: ["mp4", "mov"] },
  { chave: "audio", label: "Áudios", descricao: "Áudios e gravações", Icon: Headphones, formatos: ["mp3", "wav", "m4a"] },
  { chave: "link", label: "Links", descricao: "Links externos e páginas de vendas", Icon: Link2, formatos: [] },
];

const PASTA_DE = (chave) => PASTAS.find((p) => p.chave === chave) || null;
const ICONE_DE = (chave) => (PASTA_DE(chave)?.Icon) || File;

const AZUL = "#318CE7";
const AZUL_SUAVE = "#EAF4FF";
const BORDA = "#E8EAED";

const formatarTamanho = (b) => {
  if (!b) return "";
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
};

const formatarData = (ts) => {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

function filtrarTexto(materiais, busca) {
  const t = busca.toLowerCase().trim();
  if (!t) return materiais;
  return materiais.filter((m) =>
    m.nome.toLowerCase().includes(t) ||
    (m.descricao || "").toLowerCase().includes(t) ||
    (PASTA_DE(m.categoria)?.label || m.categoria).toLowerCase().includes(t) ||
    (m.campanhas || []).some((c) => c.titulo.toLowerCase().includes(t))
  );
}

const ORDENS = [
  { key: "recentes", label: "Mais recentes" },
  { key: "antigos", label: "Mais antigos" },
  { key: "az", label: "Nome A–Z" },
  { key: "za", label: "Nome Z–A" },
];

function ordenar(materiais, ordem) {
  const arr = [...materiais];
  if (ordem === "antigos") return arr.sort((a, b) => a.criadoEm - b.criadoEm);
  if (ordem === "az") return arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (ordem === "za") return arr.sort((a, b) => b.nome.localeCompare(a.nome, "pt-BR"));
  return arr.sort((a, b) => b.criadoEm - a.criadoEm);
}

const formatoDe = (m) => {
  if (m.categoria === "link") return "LINK";
  const ext = (String(m.nome || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1];
  return ext ? ext.toUpperCase() : "—";
};

const OFFICE_EXTS = ["ppt", "pptx", "doc", "docx", "xls", "xlsx"];
// Tipo de pré-visualização. "office" usa o visualizador do Microsoft Office.
function tipoPreview(m) {
  if (m.categoria === "foto") return "imagem";
  if (m.categoria === "video") return "video";
  if (m.categoria === "audio") return "audio";
  const ext = (String(m.nome || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1];
  if (ext === "pdf" || (m.mimetype || "") === "application/pdf") return "pdf";
  if (OFFICE_EXTS.includes(ext)) return "office";
  return "indisponivel";
}
const urlInline = (m) => `${API_URL}/api/materiais/${m.id}/download?inline=1`;

export default function MateriaisEmpresa({ emp, db, aviso }) {
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [armazenamento, setArmazenamento] = useState(true);
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [buscaPasta, setBuscaPasta] = useState("");
  const [pasta, setPasta] = useState(null);             // chave da categoria aberta ou null
  const [modalUpload, setModalUpload] = useState(null); // null ou { categoria, iniciais }
  const [detalhe, setDetalhe] = useState(null);
  const [editarDetalhe, setEditarDetalhe] = useState(false);
  const [preview, setPreview] = useState(null);
  const [menuAberto, setMenuAberto] = useState(null);
  const [ordem, setOrdem] = useState("recentes");
  const [vista, setVista] = useState("grid");
  const [infoSecao, setInfoSecao] = useState(null);   // seção de "Informações da empresa" aberta
  const [resumoInfo, setResumoInfo] = useState(null); // estado de preenchimento dos 4 cards

  const abrirDetalhe = (m) => { setDetalhe(m); setEditarDetalhe(false); };
  const renomear = (m) => { setDetalhe(m); setEditarDetalhe(true); };

  const carregar = useCallback(async () => {
    const r = await api("/materiais");
    if (r?.materiais) {
      setMateriais(r.materiais);
      setArmazenamento(r.armazenamento);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Resumo de preenchimento das "Informações da empresa" — recarrega ao voltar
  // de uma seção para refletir o que foi salvo.
  const carregarResumo = useCallback(async () => {
    const r = await api("/company-info/resumo");
    if (r?.resumo) setResumoInfo(r.resumo);
  }, []);
  useEffect(() => { if (infoSecao === null) carregarResumo(); }, [infoSecao, carregarResumo]);

  const contagem = useMemo(() => {
    const c = {};
    for (const m of materiais) c[m.categoria] = (c[m.categoria] || 0) + 1;
    return c;
  }, [materiais]);

  const recentes = useMemo(
    () => [...materiais].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 5),
    [materiais]
  );

  const excluir = async (m, forcar) => {
    const url = `/materiais/${m.id}${forcar ? "?forcar=1" : ""}`;
    const r = await apiDelete(url);
    if (r?.error && r?.campanhas) {
      if (confirm(`Este material está disponível em ${r.campanhas.length} campanha(s). Deseja removê-lo da biblioteca?`)) return excluir(m, true);
      return;
    }
    if (r?.error) { aviso?.(r.error); return; }
    setMateriais((prev) => prev.filter((x) => x.id !== m.id));
    if (detalhe?.id === m.id) setDetalhe(null);
    aviso?.("Material excluído.");
  };

  const abrirPasta = (chave) => { setPasta(chave); setBuscaPasta(""); setDetalhe(null); setBuscaGlobal(""); setOrdem("recentes"); };
  const voltar = () => { setPasta(null); setBuscaPasta(""); setDetalhe(null); };

  if (loading) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  // Vista interna de uma das quatro "Informações da empresa".
  if (infoSecao) {
    return (
      <div className="vx-fade">
        <SecaoInformacoes secao={infoSecao} materiaisLib={materiais} aviso={aviso} onVoltar={() => setInfoSecao(null)} />
      </div>
    );
  }

  const buscandoGlobal = buscaGlobal.trim().length > 0 && !pasta;
  const resultadosGlobais = buscandoGlobal ? filtrarTexto(materiais, buscaGlobal) : [];

  const pastaInfo = pasta ? PASTA_DE(pasta) : null;
  const arquivosDaPasta = pasta ? materiais.filter((m) => m.categoria === pasta) : [];
  const pastaVazia = pasta && arquivosDaPasta.length === 0;
  const arquivosPasta = pasta ? ordenar(filtrarTexto(arquivosDaPasta, buscaPasta), ordem) : [];
  const ehLinks = pasta === "link";
  const painelDetalhe = detalhe && (
    <PainelDetalhe material={detalhe} campanhas={(db.campaigns || []).filter((c) => c.companyId === emp.id)}
      onClose={() => setDetalhe(null)} onUpdate={(m) => { setMateriais((prev) => prev.map((x) => x.id === m.id ? m : x)); setDetalhe(m); }}
      onExcluir={excluir} aviso={aviso} iniciarEditando={editarDetalhe} onPreview={setPreview} />
  );
  const dropNaPasta = (e) => {
    e.preventDefault();
    if (ehLinks) return;
    const files = e.dataTransfer?.files;
    if (files?.length) setModalUpload({ categoria: pasta, iniciais: files });
  };

  return (
    <div className="vx-fade" style={{ position: "relative" }}>
      {/* Cabeçalho principal — só na biblioteca, não dentro de uma pasta */}
      {!pasta && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>Materiais</h1>
            <p style={{ color: "#737373", margin: "4px 0 0", fontSize: 14 }}>
              Centralize as informações e os arquivos da sua empresa em um só lugar.
            </p>
          </div>
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => setModalUpload({ categoria: null })}
            style={{ gap: 6, background: AZUL, borderColor: AZUL, whiteSpace: "nowrap" }}>
            <Plus size={16} /> Adicionar material
          </button>
        </div>
      )}

      {/* ===== DENTRO DE UMA PASTA ===== */}
      {pasta ? (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#737373", marginBottom: 14 }}>
              <button onClick={voltar} style={{ background: "none", border: "none", color: AZUL, cursor: "pointer", padding: 0, fontSize: 13 }}>Materiais</button>
              <ChevronRight size={14} />
              <span style={{ color: "#171717", fontWeight: 500 }}>{pastaInfo.label}</span>
            </div>

            {/* Cabeçalho da categoria em uma linha */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={{ width: 42, height: 42, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <pastaInfo.Icon size={21} style={{ color: AZUL }} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{pastaInfo.label}</h2>
                  <p style={{ fontSize: 13, color: "#737373", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pastaInfo.descricao}</p>
                </div>
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => setModalUpload({ categoria: pasta })}
                style={{ gap: 6, background: AZUL, borderColor: AZUL, whiteSpace: "nowrap" }}>
                <Plus size={16} /> {ehLinks ? "Adicionar link" : "Adicionar"}
              </button>
            </div>

            {/* Toolbar — oculta quando a pasta está vazia */}
            {!pastaVazia && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
                  <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
                  <input className="vx-input" placeholder={`Buscar em ${pastaInfo.label.toLowerCase()}...`} value={buscaPasta}
                    onChange={(e) => setBuscaPasta(e.target.value)} style={{ paddingLeft: 32, width: "100%", height: 36 }} />
                </div>
                <select className="vx-input" value={ordem} onChange={(e) => setOrdem(e.target.value)} style={{ height: 36, width: "auto", minWidth: 150 }}>
                  {ORDENS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                {!ehLinks && (
                  <div style={{ display: "flex", gap: 2, background: "#F8F9FB", borderRadius: 10, padding: 2 }}>
                    <button onClick={() => setVista("grid")} title="Grade" style={{ padding: "6px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: vista === "grid" ? AZUL : "transparent", color: vista === "grid" ? "#fff" : "#737373" }}>
                      <LayoutGrid size={16} />
                    </button>
                    <button onClick={() => setVista("list")} title="Lista" style={{ padding: "6px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: vista === "list" ? AZUL : "transparent", color: vista === "list" ? "#fff" : "#737373" }}>
                      <List size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo */}
            {pastaVazia ? (
              <PastaVazia pastaInfo={pastaInfo} onAdd={() => setModalUpload({ categoria: pasta })} onDropFiles={dropNaPasta} />
            ) : arquivosPasta.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
                <SearchX size={36} strokeWidth={1.3} style={{ color: "#737373", marginBottom: 10 }} />
                <p style={{ fontSize: 14, color: "#737373", margin: "0 0 12px" }}>Nenhum material encontrado nesta pasta.</p>
                <button className="vx-btn vx-btn-sm" onClick={() => setBuscaPasta("")}>Limpar busca</button>
              </div>
            ) : vista === "list" && !ehLinks ? (
              <ListaArquivos materiais={arquivosPasta} onSelect={abrirDetalhe} selecionado={detalhe?.id}
                menuAberto={menuAberto} setMenuAberto={setMenuAberto} onExcluir={excluir} onDropFiles={dropNaPasta}
                onPreview={setPreview} onRenomear={renomear} />
            ) : (
              <div onDragOver={(e) => e.preventDefault()} onDrop={dropNaPasta}>
                <GridArquivos materiais={arquivosPasta} onSelect={abrirDetalhe} selecionado={detalhe?.id}
                  menuAberto={menuAberto} setMenuAberto={setMenuAberto} onExcluir={excluir}
                  onPreview={setPreview} onRenomear={renomear} />
              </div>
            )}
          </div>

          {painelDetalhe}
        </div>
      ) : (
        <>
          {/* Busca global */}
          <div style={{ position: "relative", maxWidth: 420, marginBottom: 24 }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
            <input className="vx-input" placeholder="Buscar materiais..." value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)} style={{ paddingLeft: 32, width: "100%", height: 38 }} />
            {buscaGlobal && (
              <button onClick={() => setBuscaGlobal("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#737373", padding: 2 }}>
                <X size={16} />
              </button>
            )}
          </div>

          {buscandoGlobal ? (
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#737373", marginBottom: 14 }}>
                  {resultadosGlobais.length} resultado{resultadosGlobais.length !== 1 ? "s" : ""} para "{buscaGlobal.trim()}"
                </div>
                {resultadosGlobais.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 20px" }}>
                    <SearchX size={44} strokeWidth={1.2} style={{ color: "#737373", marginBottom: 12 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Nenhum material encontrado</h3>
                    <p style={{ fontSize: 14, color: "#737373", margin: "0 0 16px" }}>Tente outro termo.</p>
                    <button className="vx-btn vx-btn-sm" onClick={() => setBuscaGlobal("")}>Voltar à biblioteca</button>
                  </div>
                ) : (
                  <GridArquivos materiais={resultadosGlobais} onSelect={abrirDetalhe} selecionado={detalhe?.id}
                    menuAberto={menuAberto} setMenuAberto={setMenuAberto} onExcluir={excluir} mostrarCategoria
                    onPreview={setPreview} onRenomear={renomear} />
                )}
              </div>
              {painelDetalhe}
            </div>
          ) : (
            <>
              {/* SEÇÃO 01 — Informações da empresa (base de conhecimento estruturada) */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
                  Informações da empresa
                </div>
                <p style={{ fontSize: 13, color: "#737373", margin: 0 }}>
                  Organize o conhecimento que será utilizado para orientar e capacitar seus profissionais.
                </p>
              </div>
              <div style={{ marginBottom: 32 }}>
                <CardsInformacoes resumo={resumoInfo} onAbrir={(s) => setInfoSecao(s)} />
              </div>

              {/* SEÇÃO 02 — Biblioteca de arquivos (6 pastas existentes) */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
                  Biblioteca de arquivos
                </div>
                <p style={{ fontSize: 13, color: "#737373", margin: 0 }}>
                  Armazene apresentações, documentos e outros recursos da sua empresa.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 32 }}>
                {PASTAS.map((p) => (
                  <CardPasta key={p.chave} pasta={p} quantidade={contagem[p.chave] || 0} onClick={() => abrirPasta(p.chave)} />
                ))}
              </div>

              {/* Adicionados recentemente */}
              {recentes.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 12 }}>
                    Adicionados recentemente
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {recentes.map((m) => {
                      const Icon = ICONE_DE(m.categoria);
                      return (
                        <button key={m.id} onClick={() => abrirPasta(m.categoria)}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "border-color .15s" }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = "#c5ddf5"}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = BORDA}>
                          <span style={{ width: 34, height: 34, borderRadius: 8, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={17} style={{ color: AZUL }} />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</div>
                            <div style={{ fontSize: 12, color: "#737373" }}>{PASTA_DE(m.categoria)?.label || m.categoria}</div>
                          </div>
                          <span style={{ fontSize: 12, color: "#737373", flexShrink: 0 }}>{formatarData(m.criadoEm)}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {modalUpload !== null && (
        <ModalUpload categoria={modalUpload.categoria} iniciais={modalUpload.iniciais} onClose={() => setModalUpload(null)} aviso={aviso} armazenamento={armazenamento}
          onSucesso={() => { setModalUpload(null); carregar(); }} />
      )}

      {preview && <PreviewModal material={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ====================== CARD DE PASTA ====================== */
function CardPasta({ pasta, quantidade, onClick }) {
  const { Icon, label, descricao } = pasta;
  return (
    <button onClick={onClick}
      style={{ position: "relative", textAlign: "left", background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 20, cursor: "pointer", transition: "border-color .15s, box-shadow .15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = AZUL; e.currentTarget.style.boxShadow = "0 2px 10px rgba(49,140,231,.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDA; e.currentTarget.style.boxShadow = "none"; }}>
      <ArrowUpRight size={18} style={{ position: "absolute", top: 16, right: 16, color: "#b8bcc4" }} />
      <span style={{ width: 44, height: 44, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Icon size={22} style={{ color: AZUL }} />
      </span>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#171717" }}>{label}</div>
      <div style={{ fontSize: 13, color: "#737373", margin: "2px 0 10px", minHeight: 18 }}>{descricao}</div>
      <div style={{ fontSize: 12, color: "#737373", fontWeight: 500 }}>
        {quantidade === 0 ? "Nenhum arquivo" : `${quantidade} ${quantidade === 1 ? "arquivo" : "arquivos"}`}
      </div>
    </button>
  );
}

/* ====================== GRID DE ARQUIVOS ====================== */
function GridArquivos({ materiais, onSelect, selecionado, menuAberto, setMenuAberto, onExcluir, onPreview, onRenomear, mostrarCategoria }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
      {materiais.map((m) => (
        <CardArquivo key={m.id} m={m} ativo={selecionado === m.id} onClick={() => onSelect(m)}
          menuAberto={menuAberto === m.id} setMenuAberto={setMenuAberto} onExcluir={onExcluir}
          onPreview={onPreview} onRenomear={onRenomear} mostrarCategoria={mostrarCategoria} />
      ))}
    </div>
  );
}

function CardArquivo({ m, ativo, onClick, menuAberto, setMenuAberto, onExcluir, onPreview, onRenomear, mostrarCategoria }) {
  const Icon = ICONE_DE(m.categoria);
  const ref = useRef(null);
  useEffect(() => {
    if (!menuAberto) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuAberto(null); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuAberto]);

  return (
    <div onClick={onClick} ref={ref}
      style={{ background: "#fff", border: `1.5px solid ${ativo ? AZUL : BORDA}`, borderRadius: 12, cursor: "pointer", overflow: "hidden", transition: "border-color .15s", boxShadow: ativo ? "0 0 0 2px rgba(49,140,231,.15)" : "none" }}
      onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.borderColor = "#c5ddf5"; }}
      onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.borderColor = BORDA; }}>
      <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F9FB", position: "relative" }}>
        {m.categoria === "foto" ? (
          <>
            <img src={`${API_URL}/api/materiais/${m.id}/download`} alt={m.nome}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="use-credentials"
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
            <div style={{ display: "none", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
              <Icon size={34} strokeWidth={1.4} style={{ color: "#737373" }} />
            </div>
          </>
        ) : (
          <Icon size={34} strokeWidth={1.4} style={{ color: "#737373" }} />
        )}
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
          {m.categoria !== "link" && onPreview && (
            <button onClick={(e) => { e.stopPropagation(); onPreview(m); }} title="Visualizar"
              className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 3, borderRadius: 6, background: "rgba(255,255,255,.85)" }}>
              <Eye size={16} />
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button onClick={(e) => { e.stopPropagation(); setMenuAberto(menuAberto ? null : m.id); }}
              className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 3, borderRadius: 6, background: "rgba(255,255,255,.85)" }}>
              <MoreVertical size={16} />
            </button>
            {menuAberto && (
              <div style={{ position: "absolute", right: 0, top: 28, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, padding: 4, minWidth: 150, zIndex: 20, boxShadow: "var(--shadow-pop)" }}>
                {m.categoria !== "link" && onPreview && <MenuBtn icon={Eye} label="Visualizar" onClick={(e) => { e.stopPropagation(); onPreview(m); setMenuAberto(null); }} />}
                {onRenomear && <MenuBtn icon={Pencil} label="Renomear" onClick={(e) => { e.stopPropagation(); onRenomear(m); setMenuAberto(null); }} />}
                {m.categoria !== "link" && <MenuBtn icon={Download} label="Baixar" onClick={(e) => { e.stopPropagation(); window.open(`${API_URL}/api/materiais/${m.id}/download`, "_blank"); setMenuAberto(null); }} />}
                <MenuBtn icon={Trash2} label="Excluir" danger onClick={(e) => { e.stopPropagation(); onExcluir(m); setMenuAberto(null); }} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#171717", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{m.nome}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 12, color: "#737373" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {mostrarCategoria ? <><Icon size={13} /> {PASTA_DE(m.categoria)?.label || m.categoria}</> : (m.tamanho ? formatarTamanho(m.tamanho) : formatarData(m.criadoEm))}
          </span>
          {mostrarCategoria && <span>{m.tamanho ? formatarTamanho(m.tamanho) : ""}</span>}
        </div>
        {m.campanhas?.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: AZUL }}>
            <Share2 size={11} /> {m.campanhas.length} campanha{m.campanhas.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== MENU BTN ====================== */
function MenuBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 13, background: "none", border: "none", cursor: "pointer", borderRadius: 6, color: danger ? "var(--red)" : "#171717" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"}
      onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
      <Icon size={15} /> {label}
    </button>
  );
}

/* ====================== LISTA DE ARQUIVOS ====================== */
function ListaArquivos({ materiais, onSelect, selecionado, menuAberto, setMenuAberto, onExcluir, onPreview, onRenomear, onDropFiles }) {
  return (
    <div className="vx-table-wrap" onDragOver={(e) => e.preventDefault()} onDrop={onDropFiles}>
      <table className="vx-table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th>Nome</th>
            <th>Formato</th>
            <th>Campanhas</th>
            <th style={{ textAlign: "right" }}>Tamanho</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {materiais.map((m) => {
            const Icon = ICONE_DE(m.categoria);
            return (
              <tr key={m.id} onClick={() => onSelect(m)} style={{ cursor: "pointer", background: selecionado === m.id ? "#F8F9FB" : undefined }}>
                <td><Icon size={16} style={{ color: "#737373" }} /></td>
                <td style={{ fontWeight: 500, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</td>
                <td style={{ color: "#737373" }}>{formatoDe(m)}</td>
                <td style={{ color: m.campanhas?.length ? AZUL : "#737373" }}>
                  {m.campanhas?.length ? `${m.campanhas.length} campanha${m.campanhas.length > 1 ? "s" : ""}` : "—"}
                </td>
                <td style={{ textAlign: "right", color: "#737373" }}>{m.tamanho ? formatarTamanho(m.tamanho) : "—"}</td>
                <td>
                  <div style={{ position: "relative" }}>
                    <button onClick={(e) => { e.stopPropagation(); setMenuAberto(menuAberto === m.id ? null : m.id); }} className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 3 }}>
                      <MoreVertical size={15} />
                    </button>
                    {menuAberto === m.id && (
                      <div style={{ position: "absolute", right: 0, top: 28, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, padding: 4, minWidth: 150, zIndex: 20, boxShadow: "var(--shadow-pop)" }}>
                        {m.categoria !== "link" && onPreview && <MenuBtn icon={Eye} label="Visualizar" onClick={(e) => { e.stopPropagation(); onPreview(m); setMenuAberto(null); }} />}
                        {onRenomear && <MenuBtn icon={Pencil} label="Renomear" onClick={(e) => { e.stopPropagation(); onRenomear(m); setMenuAberto(null); }} />}
                        {m.categoria !== "link" && <MenuBtn icon={Download} label="Baixar" onClick={(e) => { e.stopPropagation(); window.open(`${API_URL}/api/materiais/${m.id}/download`, "_blank"); setMenuAberto(null); }} />}
                        <MenuBtn icon={Trash2} label="Excluir" danger onClick={(e) => { e.stopPropagation(); onExcluir(m); setMenuAberto(null); }} />
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

/* ====================== PASTA VAZIA (compacto, drag-drop) ====================== */
function PastaVazia({ pastaInfo, onAdd, onDropFiles }) {
  const ehLink = pastaInfo.chave === "link";
  const [sobre, setSobre] = useState(false);
  if (ehLink) {
    return (
      <div style={{ textAlign: "center", padding: "36px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: AZUL_SUAVE, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Link2 size={22} style={{ color: AZUL }} />
        </span>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Nenhum link nesta pasta</h3>
        <p style={{ fontSize: 13, color: "#737373", margin: "0 0 14px" }}>Adicione URLs de catálogos, páginas de vendas e outros.</p>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onAdd} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
          <Plus size={16} /> Adicionar link
        </button>
      </div>
    );
  }
  return (
    <div onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
      onDrop={(e) => { setSobre(false); onDropFiles(e); }}
      style={{ textAlign: "center", padding: "40px 20px", border: `1.5px dashed ${sobre ? AZUL : BORDA}`, borderRadius: 12, background: sobre ? AZUL_SUAVE : "transparent", transition: "border-color .15s, background .15s" }}>
      <span style={{ width: 48, height: 48, borderRadius: 12, background: AZUL_SUAVE, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <FileUp size={24} style={{ color: AZUL }} />
      </span>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Nenhum material nesta pasta</h3>
      <p style={{ fontSize: 13, color: "#737373", margin: "0 0 14px" }}>Arraste arquivos para esta área ou selecione do seu dispositivo.</p>
      <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onAdd} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
        <Plus size={16} /> Enviar arquivos
      </button>
    </div>
  );
}

/* ====================== PAINEL DETALHE ====================== */
function PainelDetalhe({ material: m, campanhas, onClose, onUpdate, onExcluir, aviso, iniciarEditando, onPreview }) {
  const [editando, setEditando] = useState(!!iniciarEditando);
  const [nome, setNome] = useState(m.nome);
  const [descricao, setDescricao] = useState(m.descricao || "");
  const [campSel, setCampSel] = useState((m.campanhas || []).map((c) => c.id));
  const [salvando, setSalvando] = useState(false);
  const Icon = ICONE_DE(m.categoria);

  useEffect(() => {
    setNome(m.nome); setDescricao(m.descricao || "");
    setCampSel((m.campanhas || []).map((c) => c.id)); setEditando(!!iniciarEditando);
  }, [m.id, iniciarEditando]);

  const salvarEdicao = async () => {
    setSalvando(true);
    const r = await apiPatch(`/materiais/${m.id}`, { nome, descricao });
    if (r?.error) { aviso?.(r.error); setSalvando(false); return; }
    onUpdate(r); setEditando(false); setSalvando(false);
  };

  const salvarCampanhas = async () => {
    setSalvando(true);
    const r = await fetch(`${API_URL}/api/materiais/${m.id}/campanhas`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campanhaIds: campSel }), credentials: "include",
    }).then((x) => x.json()).catch(() => null);
    if (r?.error) { aviso?.(r.error); setSalvando(false); return; }
    if (r) onUpdate(r);
    setSalvando(false); aviso?.("Campanhas atualizadas.");
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
        onUpdate(r); aviso?.("Arquivo substituído.");
      } catch { aviso?.("Erro ao substituir."); }
    };
    xhr.onerror = () => { setSalvando(false); aviso?.("Falha na conexão."); };
    xhr.send(file);
  };

  return (
    <div style={{ width: 340, flexShrink: 0, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 20, position: "sticky", top: 20, maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px" }}>Detalhes</span>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={16} /></button>
      </div>

      <div style={{ background: "#F8F9FB", borderRadius: 10, height: 160, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" }}>
        {m.categoria === "foto" ? (
          <img src={`${API_URL}/api/materiais/${m.id}/download`} alt={m.nome} style={{ width: "100%", height: "100%", objectFit: "contain" }} crossOrigin="use-credentials" onError={(e) => { e.target.style.display = "none"; }} />
        ) : m.categoria === "video" ? (
          <video src={`${API_URL}/api/materiais/${m.id}/download`} controls style={{ maxWidth: "100%", maxHeight: "100%" }} crossOrigin="use-credentials" />
        ) : m.categoria === "audio" ? (
          <audio src={`${API_URL}/api/materiais/${m.id}/download`} controls style={{ width: "90%" }} crossOrigin="use-credentials" />
        ) : (
          <Icon size={48} strokeWidth={1.2} style={{ color: "#737373" }} />
        )}
      </div>

      {editando ? (
        <div style={{ marginBottom: 14 }}>
          <label className="vx-label">Nome</label>
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} style={{ marginBottom: 8 }} />
          <label className="vx-label">Descrição</label>
          <textarea className="vx-input" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} style={{ resize: "vertical" }} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={salvarEdicao} disabled={salvando} style={{ background: AZUL, borderColor: AZUL }}>Salvar</button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => { setEditando(false); setNome(m.nome); setDescricao(m.descricao || ""); }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, wordBreak: "break-word" }}>{m.nome}</h3>
          {m.descricao && <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 0" }}>{m.descricao}</p>}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#737373", display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Categoria</span><span style={{ color: "#171717", fontWeight: 500 }}>{PASTA_DE(m.categoria)?.label || m.categoria}</span>
        </div>
        {m.tamanho > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tamanho</span><span style={{ color: "#171717" }}>{formatarTamanho(m.tamanho)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Adicionado em</span><span style={{ color: "#171717" }}>{formatarData(m.criadoEm)}</span></div>
        {m.atualizadoEm !== m.criadoEm && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Atualizado em</span><span style={{ color: "#171717" }}>{formatarData(m.atualizadoEm)}</span></div>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Disponibilidade</div>
        <p style={{ fontSize: 12, color: "#737373", margin: "0 0 8px" }}>Escolha em quais campanhas este material estará disponível.</p>
        <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {campanhas.length === 0 && <span style={{ fontSize: 12, color: "#737373" }}>Nenhuma campanha criada.</span>}
          {campanhas.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "4px 0" }}>
              <input type="checkbox" checked={campSel.includes(c.id)}
                onChange={(e) => setCampSel((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</span>
            </label>
          ))}
        </div>
        {campanhas.length > 0 && (
          <button className="vx-btn vx-btn-sm" onClick={salvarCampanhas} disabled={salvando} style={{ marginTop: 8, fontSize: 12 }}>Salvar campanhas</button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {m.categoria !== "link" && onPreview && (
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => onPreview(m)} style={{ justifyContent: "flex-start", gap: 8 }}>
            <Eye size={14} /> Visualizar
          </button>
        )}
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
            <input ref={substituirRef} type="file" hidden onChange={(e) => substituir(e.target.files?.[0])} />
          </>
        )}
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => onExcluir(m)} style={{ justifyContent: "flex-start", gap: 8, color: "var(--red)" }}>
          <Trash2 size={14} /> Excluir
        </button>
      </div>
    </div>
  );
}

/* ====================== MODAL DE PRÉ-VISUALIZAÇÃO ====================== */
function PreviewModal({ material: m, onClose }) {
  const tipo = tipoPreview(m);
  const src = urlInline(m);
  const [officeUrl, setOfficeUrl] = useState(null); // null carregando, "" erro, string ok
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  useEffect(() => {
    if (tipo !== "office") return;
    let vivo = true;
    api(`/materiais/${m.id}/preview-link`).then((r) => {
      if (!vivo) return;
      if (r?.url && !/\/\/(localhost|127\.0\.0\.1)/.test(r.url)) {
        setOfficeUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(r.url)}`);
      } else {
        setOfficeUrl(""); // local/sem url pública: o visualizador do Office não alcança
      }
    }).catch(() => vivo && setOfficeUrl(""));
    return () => { vivo = false; };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 900, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${BORDA}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => window.open(`${API_URL}/api/materiais/${m.id}/download`, "_blank")} style={{ gap: 6 }}>
              <Download size={15} /> Baixar
            </button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
          {tipo === "imagem" && <img src={src} alt={m.nome} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} crossOrigin="use-credentials" />}
          {tipo === "pdf" && <iframe src={src} title={m.nome} style={{ width: "100%", height: "80vh", border: "none" }} />}
          {tipo === "video" && <video src={src} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh" }} crossOrigin="use-credentials" />}
          {tipo === "audio" && <div style={{ padding: 40, width: "100%" }}><audio src={src} controls autoPlay style={{ width: "100%" }} crossOrigin="use-credentials" /></div>}
          {tipo === "office" && officeUrl === null && (
            <div style={{ padding: "80px 24px", textAlign: "center" }}><div className="vx-spinner" style={{ margin: "0 auto" }} /><p style={{ fontSize: 13, color: "#737373", marginTop: 12 }}>Carregando pré-visualização...</p></div>
          )}
          {tipo === "office" && officeUrl && (
            <iframe src={officeUrl} title={m.nome} style={{ width: "100%", height: "80vh", border: "none" }} />
          )}
          {(tipo === "indisponivel" || (tipo === "office" && officeUrl === "")) && (
            <div style={{ textAlign: "center", padding: "60px 24px" }}>
              <FileText size={44} strokeWidth={1.2} style={{ color: "#737373", marginBottom: 12 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Pré-visualização indisponível para {formatoDe(m)}</h3>
              <p style={{ fontSize: 13, color: "#737373", margin: "0 0 16px" }}>Baixe o arquivo para visualizar.</p>
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => window.open(`${API_URL}/api/materiais/${m.id}/download`, "_blank")} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
                <Download size={15} /> Baixar arquivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================== MODAL UPLOAD ====================== */
function ModalUpload({ categoria, iniciais, onClose, aviso, armazenamento, onSucesso }) {
  const ehLink = categoria === "link";
  const [arquivos, setArquivos] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({});
  const [tab, setTab] = useState(ehLink ? "link" : "arquivo");
  const inputRef = useRef(null);
  const pastaInfo = categoria ? PASTA_DE(categoria) : null;
  const accept = pastaInfo && pastaInfo.formatos.length ? pastaInfo.formatos.map((f) => "." + f).join(",") : undefined;
  const mostrarTabs = !categoria; // sem categoria fixa, deixa escolher arquivo/link
  const titulo = pastaInfo ? `Adicionar ${pastaInfo.label.toLowerCase()}` : "Adicionar material";

  // Arquivos arrastados para a área de conteúdo já entram na fila.
  useEffect(() => {
    if (iniciais?.length) {
      const novos = [...iniciais].map((f) => ({ file: f, id: Math.random().toString(36).slice(2), nome: f.name, tamanho: f.size, status: "pendente" }));
      setArquivos(novos);
    }
  }, []);

  const addFiles = (files) => {
    const novos = [...files].map((f) => ({ file: f, id: Math.random().toString(36).slice(2), nome: f.name, tamanho: f.size, status: "pendente" }));
    setArquivos((prev) => [...prev, ...novos]);
  };
  const removerArquivo = (id) => setArquivos((prev) => prev.filter((a) => a.id !== id));

  const enviarTodos = async () => {
    setEnviando(true);
    let ok = 0;
    for (const arq of arquivos) {
      if (arq.status === "ok") { ok++; continue; }
      setArquivos((prev) => prev.map((a) => a.id === arq.id ? { ...a, status: "enviando" } : a));
      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API_URL}/api/materiais/upload`);
          xhr.withCredentials = true;
          xhr.setRequestHeader("Content-Type", arq.file.type || "application/octet-stream");
          xhr.setRequestHeader("X-Arquivo-Nome", encodeURIComponent(arq.file.name));
          if (categoria && categoria !== "link") xhr.setRequestHeader("X-Categoria", categoria);
          xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgresso((prev) => ({ ...prev, [arq.id]: Math.round(e.loaded / e.total * 100) })); };
          xhr.onload = () => {
            try { const r = JSON.parse(xhr.responseText); if (r.error) reject(new Error(r.error)); else resolve(r); }
            catch { reject(new Error("Erro no envio")); }
          };
          xhr.onerror = () => reject(new Error("Falha na conexão"));
          xhr.send(arq.file);
        });
        setArquivos((prev) => prev.map((a) => a.id === arq.id ? { ...a, status: "ok" } : a));
        ok++;
      } catch (e) {
        setArquivos((prev) => prev.map((a) => a.id === arq.id ? { ...a, status: "erro", erro: e.message } : a));
      }
    }
    setEnviando(false);
    if (ok > 0) { aviso?.(`${ok} material(is) enviado(s).`); onSucesso(); }
  };

  const enviarLink = async () => {
    setEnviando(true);
    const r = await api("/materiais/links", { url: linkUrl });
    setEnviando(false);
    if (r?.error) { aviso?.(r.error); return; }
    aviso?.("Link adicionado."); onSucesso();
  };

  const onDragOver = (e) => { e.preventDefault(); e.currentTarget.style.borderColor = AZUL; };
  const onDragLeave = (e) => { e.currentTarget.style.borderColor = BORDA; };
  const onDrop = (e) => { e.preventDefault(); e.currentTarget.style.borderColor = BORDA; addFiles(e.dataTransfer.files); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{titulo}</h2>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: "#737373", margin: "0 0 18px" }}>
          {ehLink ? "Adicione links para sua biblioteca comercial." : pastaInfo ? `Envie arquivos para ${pastaInfo.label.toLowerCase()}.` : "Envie arquivos ou adicione links para sua biblioteca comercial."}
        </p>

        {mostrarTabs && (
          <div style={{ display: "flex", marginBottom: 18, borderBottom: `1px solid ${BORDA}` }}>
            {[["arquivo", "Arquivos", Upload], ["link", "Link", Link2]].map(([k, label, Ic]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ padding: "8px 18px", fontSize: 13, fontWeight: tab === k ? 600 : 400, color: tab === k ? AZUL : "#737373", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${AZUL}` : "2px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Ic size={15} /> {label}
              </button>
            ))}
          </div>
        )}

        {tab === "arquivo" && !ehLink && (
          <>
            {armazenamento ? (
              <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                style={{ border: `2px dashed ${BORDA}`, borderRadius: 10, padding: 32, textAlign: "center", marginBottom: 16, transition: "border-color .15s" }}>
                <Upload size={32} strokeWidth={1.3} style={{ color: "#737373", marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>Arraste seus arquivos aqui</div>
                <div style={{ fontSize: 12, color: "#737373", marginBottom: 12 }}>Ou selecione arquivos do seu dispositivo.</div>
                <button className="vx-btn vx-btn-sm" onClick={() => inputRef.current?.click()}>Escolher arquivos</button>
                {pastaInfo && pastaInfo.formatos.length > 0 && (
                  <div style={{ fontSize: 11, color: "#737373", marginTop: 10 }}>Formatos: {pastaInfo.formatos.map((f) => f.toUpperCase()).join(", ")}</div>
                )}
                <input ref={inputRef} type="file" multiple hidden accept={accept} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "#737373", fontSize: 13 }}>O envio de arquivos ainda não está disponível. Você pode adicionar links.</div>
            )}

            {arquivos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {arquivos.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#F8F9FB", borderRadius: 10, fontSize: 13 }}>
                    <File size={16} style={{ color: "#737373", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: "#737373" }}>
                        {formatarTamanho(a.tamanho)}
                        {a.status === "ok" && <span style={{ color: "var(--green)", marginLeft: 8 }}>Enviado</span>}
                        {a.status === "erro" && <span style={{ color: "var(--red)", marginLeft: 8 }}>{a.erro || "Erro"}</span>}
                        {a.status === "enviando" && <span style={{ color: AZUL, marginLeft: 8 }}>{progresso[a.id] || 0}%</span>}
                      </div>
                    </div>
                    {a.status === "pendente" && <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => removerArquivo(a.id)} style={{ padding: 2 }}><X size={14} /></button>}
                    {a.status === "enviando" && (
                      <div style={{ width: 60, height: 4, background: BORDA, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${progresso[a.id] || 0}%`, height: "100%", background: AZUL, transition: "width .2s" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {arquivos.length > 0 && (
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={enviarTodos} disabled={enviando} style={{ width: "100%", background: AZUL, borderColor: AZUL }}>
                {enviando ? "Enviando..." : `Enviar ${arquivos.filter((a) => a.status !== "ok").length} arquivo(s)`}
              </button>
            )}
          </>
        )}

        {(tab === "link" || ehLink) && (
          <div>
            <label className="vx-label">URL</label>
            <input className="vx-input" placeholder="https://" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={{ marginBottom: 14 }} />
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={enviarLink} disabled={enviando || !linkUrl.trim()} style={{ width: "100%", background: AZUL, borderColor: AZUL }}>
              {enviando ? "Adicionando..." : "Adicionar link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
