import { useEffect, useRef, useState } from "react";
import { Trophy, Upload, Trash2, Image as ImageIcon, Plus, Save, X, Medal, Gift, Package } from "lucide-react";
import { api, apiPatch, apiDelete } from "../../lib/api.js";
import { FAIXAS, CONQUISTAS, CATEGORIAS } from "../../../shared/gamificacao.js";

// Envia um arquivo pelo fluxo de presign (S3 em produção) e devolve a URL
// pública. Em ambiente sem S3, orienta a colar uma URL.
async function enviarArquivo(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use PNG, JPG ou WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 8MB).");
  const pres = await api("/uploads/presign", { filename: file.name, mimetype: file.type, size: file.size });
  if (!pres || pres.error) throw new Error(pres?.error || "Falha ao preparar o upload.");
  if (pres.method === "s3" && pres.presignedUrl) {
    const put = await fetch(pres.presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!put.ok) throw new Error("Falha ao enviar a imagem ao armazenamento.");
    return pres.publicUrl;
  }
  throw new Error("Armazenamento de imagens (S3) não configurado neste ambiente. Cole a URL da imagem abaixo.");
}

function ImageSlot({ titulo, url, onSalvar, onRemover, aviso, pequeno }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const escolher = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try { const u = await enviarArquivo(file); await onSalvar(u); aviso("Imagem enviada."); }
    catch (err) { aviso(err.message); }
    finally { setEnviando(false); }
  };

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{titulo}</div>
      <div style={{ aspectRatio: pequeno ? "1 / 1" : "16 / 9", borderRadius: 10, overflow: "hidden", background: "#F4F7FA", marginBottom: 8, display: "grid", placeItems: "center" }}>
        {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <ImageIcon size={24} color="#AAB4C0" />}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={escolher} style={{ display: "none" }} />
        <button className="vx-btn vx-btn-sm" disabled={enviando} onClick={() => inputRef.current?.click()} style={{ gap: 5 }}>
          <Upload size={13} /> {enviando ? "Enviando…" : url ? "Substituir" : "Enviar"}
        </button>
        {url && <button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => onRemover()} style={{ gap: 5 }}><Trash2 size={13} /></button>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input className="vx-input" placeholder="ou cole uma URL" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} style={{ fontSize: 12, height: 32 }} />
        <button className="vx-btn vx-btn-sm" disabled={!urlInput.trim()} onClick={() => { onSalvar(urlInput.trim()); setUrlInput(""); }}>OK</button>
      </div>
    </div>
  );
}

function FormularioPremio({ premio, metricas, onSalvar, onCancelar, aviso }) {
  const [f, setF] = useState(() => ({
    nome: "", descricao: "", tipo: "fisico", metrica: "", alvo: 0, status: "rascunho", imagem: "", quantidade: "", ...premio,
  }));
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const enviarImg = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try { set("imagem", await enviarArquivo(file)); aviso("Imagem enviada."); }
    catch (err) { aviso(err.message); } finally { setEnviando(false); }
  };

  return (
    <div className="vx-card" style={{ padding: 18, marginBottom: 14, border: "1.5px solid var(--brand)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{premio?.id ? "Editar prêmio" : "Novo prêmio"}</div>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onCancelar}><X size={15} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ gridColumn: "1 / -1" }}><div className="vx-label">Nome</div>
          <input className="vx-input" value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
        <label style={{ gridColumn: "1 / -1" }}><div className="vx-label">Descrição</div>
          <textarea className="vx-input" value={f.descricao} onChange={(e) => set("descricao", e.target.value)} style={{ minHeight: 60 }} /></label>
        <label><div className="vx-label">Tipo</div>
          <select className="vx-input" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            <option value="fisico">Físico</option><option value="digital">Digital</option>
          </select></label>
        <label><div className="vx-label">Status</div>
          <select className="vx-input" value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="rascunho">Rascunho</option><option value="publicado">Publicado</option><option value="arquivado">Arquivado</option>
          </select></label>
        <label><div className="vx-label">Critério (métrica)</div>
          <select className="vx-input" value={f.metrica} onChange={(e) => set("metrica", e.target.value)}>
            <option value="">— selecione —</option>
            {Object.entries(metricas || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label><div className="vx-label">Marco (alvo)</div>
          <input className="vx-input vx-mono" type="number" value={f.alvo} onChange={(e) => set("alvo", e.target.value)} /></label>
        <label><div className="vx-label">Quantidade (vazio = ilimitado)</div>
          <input className="vx-input vx-mono" type="number" value={f.quantidade ?? ""} onChange={(e) => set("quantidade", e.target.value)} /></label>
        <div>
          <div className="vx-label">Imagem</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 54, height: 54, borderRadius: 8, overflow: "hidden", background: "#F4F7FA", display: "grid", placeItems: "center", flexShrink: 0 }}>
              {f.imagem ? <img src={f.imagem} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={18} color="#AAB4C0" />}
            </div>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={enviarImg} style={{ display: "none" }} />
            <button className="vx-btn vx-btn-sm" disabled={enviando} onClick={() => inputRef.current?.click()}>{enviando ? "Enviando…" : "Enviar"}</button>
          </div>
          <input className="vx-input" placeholder="ou cole uma URL" value={f.imagem} onChange={(e) => set("imagem", e.target.value)} style={{ marginTop: 6, fontSize: 12, height: 32 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button className="vx-btn" onClick={onCancelar}>Cancelar</button>
        <button className="vx-btn vx-btn-primary" onClick={() => onSalvar(f)} style={{ gap: 6 }}><Save size={14} /> Salvar</button>
      </div>
    </div>
  );
}

export default function RycsClubAdmin({ aviso }) {
  const [dados, setDados] = useState(null);
  const [tab, setTab] = useState("imagens");
  const [editando, setEditando] = useState(null); // premio em edição ou {} (novo)

  const carregar = () => api("/admin/club").then((r) => { if (r && !r.error) setDados(r); });
  useEffect(() => { carregar(); }, []);

  if (!dados) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const salvarImagem = async (chave, url) => {
    const r = await api("/admin/club/imagem", { chave, url });
    if (r?.error) return aviso(r.error);
    setDados((d) => ({ ...d, imagens: r.imagens }));
  };

  const salvarPremio = async (f) => {
    const r = f.id ? await apiPatch(`/admin/club/premios/${f.id}`, f) : await api("/admin/club/premios", f);
    if (r?.error) return aviso(r.error);
    setEditando(null);
    aviso("Prêmio salvo.");
    carregar();
  };
  const removerPremio = async (id) => {
    if (!window.confirm("Remover este prêmio?")) return;
    await apiDelete(`/admin/club/premios/${id}`);
    carregar();
  };
  const mudarEstado = async (id, estado) => {
    const r = await apiPatch(`/admin/club/resgates/${id}`, { estado });
    if (r?.error) return aviso(r.error);
    carregar();
  };

  const TABS = [["imagens", "Imagens"], ["premios", "Prêmios"], ["resgates", "Resgates"]];

  return (
    <div className="vx-fade">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Trophy size={22} color="#318CE7" />
        <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>RYCS Club</h1>
      </div>
      <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 13.5 }}>Configure imagens de níveis, medalhas e banner, gerencie prêmios e acompanhe resgates.</p>

      <div className="vx-seg vx-subnav" style={{ marginBottom: 18 }}>
        {TABS.map(([k, label]) => <button key={k} data-on={tab === k ? "1" : undefined} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === "imagens" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Banner</div>
            <div style={{ maxWidth: 380 }}>
              <ImageSlot titulo="Imagem do banner do Club" url={dados.imagens["banner"]} aviso={aviso}
                onSalvar={(u) => salvarImagem("banner", u)} onRemover={() => salvarImagem("banner", "")} />
            </div>
          </div>
          <div>
            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Níveis</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {FAIXAS.map((f) => (
                <ImageSlot key={f.chave} pequeno titulo={f.nome} url={dados.imagens[`nivel:${f.chave}`]} aviso={aviso}
                  onSalvar={(u) => salvarImagem(`nivel:${f.chave}`, u)} onRemover={() => salvarImagem(`nivel:${f.chave}`, "")} />
              ))}
            </div>
          </div>
          <div>
            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Medalhas (conquistas)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {CONQUISTAS.map((c) => (
                <ImageSlot key={c.id} pequeno titulo={c.nome} url={dados.imagens[`medalha:${c.id}`]} aviso={aviso}
                  onSalvar={(u) => salvarImagem(`medalha:${c.id}`, u)} onRemover={() => salvarImagem(`medalha:${c.id}`, "")} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "premios" && (
        <div>
          {editando
            ? <FormularioPremio premio={editando.id ? editando : null} metricas={dados.metricas} aviso={aviso}
                onSalvar={salvarPremio} onCancelar={() => setEditando(null)} />
            : <button className="vx-btn vx-btn-primary" onClick={() => setEditando({})} style={{ gap: 6, marginBottom: 16 }}><Plus size={15} /> Novo prêmio</button>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {dados.premios.map((p) => (
              <div key={p.id} className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ aspectRatio: "16 / 9", background: "#F4F7FA", display: "grid", placeItems: "center" }}>
                  {p.imagem ? <img src={p.imagem} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={22} color="#AAB4C0" />}
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{p.nome || "Sem nome"}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase",
                      color: p.status === "publicado" ? "#16A34A" : "var(--muted)", background: p.status === "publicado" ? "#16A34A14" : "var(--surface-2)" }}>{p.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 10px" }}>
                    {p.tipo === "digital" ? "Digital" : "Físico"}{p.requisito?.metrica ? ` · ${p.requisito.label} ≥ ${p.requisito.alvo}` : " · sem critério"}
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button className="vx-btn vx-btn-sm" onClick={() => setEditando(p._raw || { id: p.id, nome: p.nome, descricao: p.descricao, tipo: p.tipo, imagem: p.imagem, metrica: p.requisito?.metrica, alvo: p.requisito?.alvo, status: p.status, quantidade: p.quantidade })}>Editar</button>
                    <button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => removerPremio(p.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {dados.premios.length === 0 && !editando && <div className="vx-card" style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>Nenhum prêmio ainda. Crie o primeiro.</div>}
        </div>
      )}

      {tab === "resgates" && (
        <div>
          {dados.resgates.length === 0
            ? <div className="vx-card" style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>Nenhum resgate solicitado.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dados.resgates.map((r) => (
                  <div key={r.id} className="vx-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <Package size={18} color="#318CE7" />
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{r.prizeNome}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.sellerNome} · {r.prizeTipo === "digital" ? "Digital" : "Físico"} · {new Date(r.criadoEm).toLocaleDateString("pt-BR")}</div>
                      {r.endereco && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>📦 {r.endereco}</div>}
                    </div>
                    <select className="vx-input" value={r.estado} onChange={(e) => mudarEstado(r.id, e.target.value)} style={{ width: 150, height: 36 }}>
                      {(dados.estados || []).map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                ))}
              </div>}
        </div>
      )}
    </div>
  );
}
