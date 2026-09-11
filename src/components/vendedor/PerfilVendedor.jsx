import { useMemo, useRef, useState } from "react";
import { Award, Camera, CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import { api, apiPatch, apiDelete, API_URL } from "../../lib/api.js";
import { Medidor } from "../ui.jsx";
import { MODALIDADES, SEGMENTOS, DISPONIBILIDADES, SKILLS, LIMITES } from "../../../shared/fotoPerfil.js";

const PERFIS = { sdr: "SDR", closer: "Closer", bdr: "BDR", pap: "PAP", "sem-exp": "Iniciante" };

// Cadastros antigos guardavam "Guarulhos, SP" inteiro no campo cidade. Repetir
// o estado depois disso vira "Guarulhos, SP · SP".
function localizacao({ cidade = "", estado = "" }) {
  const c = String(cidade).trim();
  const e = String(estado).trim();
  if (!e) return c;
  if (!c) return e;
  return new RegExp(`\\b${e}\\b`, "i").test(c) ? c : `${c} · ${e}`;
}

// Lê o arquivo e mede as dimensões antes de enviar: as checagens objetivas
// precisam de largura e altura, e o navegador é quem sabe isso.
function lerImagem(file) {
  return new Promise((ok, falha) => {
    const fr = new FileReader();
    fr.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    fr.onload = () => {
      const dataUri = String(fr.result);
      const img = new Image();
      img.onerror = () => falha(new Error("O arquivo não é uma imagem válida."));
      img.onload = () => ok({
        base64: dataUri.split(",")[1],
        mimetype: file.type,
        largura: img.naturalWidth,
        altura: img.naturalHeight,
      });
      img.src = dataUri;
    };
    fr.readAsDataURL(file);
  });
}

function Marcadores({ opcoes, valor = [], onChange, max = 12 }) {
  const alternar = (v) => {
    const atual = valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v];
    if (atual.length <= max) onChange(atual);
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opcoes.map((o) => {
        const on = valor.includes(o);
        return (
          <button key={o} type="button" className={"vx-chip" + (on ? " vx-badge-brand" : "")}
            onClick={() => alternar(o)}
            style={{ cursor: "pointer", borderColor: on ? "var(--brand)" : "var(--border)" }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function PerfilVendedor({ eu, db, up, aviso }) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [avaliacaoFoto, setAvaliacaoFoto] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const arquivo = useRef(null);

  const [form, setForm] = useState(() => ({
    nome: eu.nome || "", titulo: eu.titulo || "", bio: eu.bio || "",
    cidade: eu.cidade || "", estado: eu.estado || "", whats: eu.whats || "",
    experiencia: eu.experiencia || "", disponibilidade: eu.disponibilidade || "",
    segmentos: eu.segmentos || [], modalidades: eu.modalidades || [],
    regioes: eu.regioes || [], skills: eu.skills || [],
  }));

  const stats = useMemo(() => {
    const meus = (db.submissions || []).filter((s) => s.sellerId === eu.id);
    const lib = meus.filter((s) => s.status === "liberado");
    const rec = meus.filter((s) => ["recusado", "ia_recusado"].includes(s.status));
    const decididas = lib.length + rec.length;
    return {
      total: meus.length, lib: lib.length, rec: rec.length,
      taxa: decididas ? Math.round((lib.length / decididas) * 100) : null,
      reunioes: lib.filter((s) => s.tipo === "realizada").length,
      vendas: lib.filter((s) => s.tipo === "venda").length,
    };
  }, [db, eu]);

  const parcial = eu.status === "parcial";

  const salvar = async () => {
    setSalvando(true);
    const r = await apiPatch(`/sellers/${eu.id}`, form);
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, ...form } : s) }));
    setEditando(false);
    aviso("Perfil atualizado.");
  };

  const enviarFoto = async (file) => {
    if (!file) return;
    setAvaliacaoFoto(null);
    setEnviandoFoto(true);
    try {
      const img = await lerImagem(file);
      const r = await fetch(`${API_URL}/api/sellers/${eu.id}/foto`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(img),
      });
      const corpo = await r.json();
      setEnviandoFoto(false);

      if (!r.ok) {
        setAvaliacaoFoto(corpo.avaliacao || null);
        return aviso(corpo.error || "Não foi possível enviar a foto.");
      }
      setAvaliacaoFoto(corpo.avaliacao);
      up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, foto: corpo.foto, fotoScore: corpo.avaliacao.score } : s) }));
      aviso(`Foto aprovada com ${corpo.avaliacao.score}/100.`);
    } catch (err) {
      setEnviandoFoto(false);
      aviso(err.message);
    }
  };

  const removerFoto = async () => {
    const r = await apiDelete(`/sellers/${eu.id}/foto`);
    if (r?.error) return aviso(r.error);
    up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, foto: "", fotoScore: null } : s) }));
    setAvaliacaoFoto(null);
    aviso("Foto removida.");
  };

  const campo = (chave, label, extra = {}) => (
    <label>
      <div className="vx-label">{label}</div>
      <input className="vx-input" value={form[chave]} maxLength={extra.max || 120}
        placeholder={extra.placeholder || ""}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })} />
    </label>
  );

  return (
    <div className="vx-fade">
      {/* ------------------------------------------------ cabeçalho ---- */}
      <div className="vx-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 84, height: 84, borderRadius: 20, overflow: "hidden",
              background: eu.foto ? "transparent" : "var(--brand)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 30,
              border: "1px solid var(--border)",
            }}>
              {eu.foto
                ? <img src={eu.foto} alt={`Foto de ${eu.nome}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : String(eu.nome || "?").slice(0, 1).toUpperCase()}
            </div>
            <button className="vx-btn vx-btn-sm" onClick={() => arquivo.current?.click()} disabled={enviandoFoto}
              style={{ position: "absolute", right: -6, bottom: -6, padding: "5px 7px", borderRadius: 999 }}
              title="Trocar foto">
              <Camera size={13} />
            </button>
            <input ref={arquivo} hidden type="file" accept={LIMITES.tiposAceitos.join(",")}
              onChange={(e) => { enviarFoto(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="vx-disp" style={{ fontSize: 21 }}>{eu.nome}</div>
            <div style={{ fontSize: 13.5, color: "var(--brand)", fontWeight: 600 }}>
              {eu.titulo || `${PERFIS[eu.perfil] || "Profissional"} comercial`}
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
              {localizacao(eu) || "Localização não informada"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <span className={"vx-badge " + (parcial ? "vx-badge-amber" : "vx-badge-brand")}>
              {parcial ? "Perfil parcial" : "Perfil aprovado"}
              {eu.scoreTriagem != null && eu.scoreTriagem > 0 && <> · {eu.scoreTriagem}%</>}
            </span>
            <button className="vx-btn vx-btn-sm" onClick={() => setEditando(!editando)}>
              {editando ? <><X size={13} /> Cancelar</> : <><Pencil size={13} /> Editar perfil</>}
            </button>
          </div>
        </div>

        {eu.bio && !editando && (
          <p className="vx-mut" style={{ fontSize: 13, marginTop: 14, marginBottom: 0, whiteSpace: "pre-wrap" }}>{eu.bio}</p>
        )}

        {enviandoFoto && <div className="vx-mut" style={{ fontSize: 12, marginTop: 10 }}>Verificando a foto…</div>}
      </div>

      {/* Resultado da verificação de foto. Aparece com os critérios, não só
          com a nota: uma reprovação sem instrução não ajuda a corrigir. */}
      {avaliacaoFoto && (
        <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
          <div className="vx-row">
            <div className="vx-eyebrow">Verificação de apresentação da foto</div>
            <span className={"vx-badge " + (avaliacaoFoto.aprovada ? "vx-badge-brand" : "vx-badge-amber")}>
              {avaliacaoFoto.score}/100 · {avaliacaoFoto.aprovada ? "Aprovada" : "Não aprovada"}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Medidor value={avaliacaoFoto.score} tone={avaliacaoFoto.aprovada ? "brand" : "amber"} />
          </div>
          {!!avaliacaoFoto.problemas?.length && (
            <ul style={{ fontSize: 12.5, paddingLeft: 18, margin: "12px 0 0", color: "var(--amber)" }}>
              {avaliacaoFoto.problemas.map((p, i) => <li key={i} style={{ marginBottom: 3 }}><b>{p.titulo}:</b> {p.comoResolver}</li>)}
            </ul>
          )}
          {!!avaliacaoFoto.pendentesDeAnalise?.length && (
            <div style={{ marginTop: 12 }}>
              <div className="vx-eyebrow" style={{ marginBottom: 5 }}>Pendente de análise de imagem</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {avaliacaoFoto.pendentesDeAnalise.map((p) => <span key={p} className="vx-chip">{p}</span>)}
              </div>
            </div>
          )}
          <div className="vx-chart-source">
            {avaliacaoFoto.observacao} Avaliamos apresentação técnica — nunca características pessoais.
          </div>
        </div>
      )}

      {/* -------------------------------------------------- edição ---- */}
      {editando && (
        <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
          <div className="vx-eyebrow">Currículo comercial</div>
          <h3 className="vx-disp" style={{ fontSize: 17, margin: "3px 0 12px" }}>Suas informações</h3>

          <div className="vx-grid vx-g2">
            {campo("nome", "Nome completo")}
            {campo("titulo", "Título profissional", { placeholder: "Closer B2B | SaaS | Energia" })}
          </div>
          <div className="vx-grid vx-g3" style={{ marginTop: 9 }}>
            {campo("cidade", "Cidade")}
            {campo("estado", "Estado", { max: 40 })}
            {campo("whats", "WhatsApp")}
          </div>

          <label style={{ display: "block", marginTop: 9 }}>
            <div className="vx-label">Apresentação</div>
            <textarea className="vx-input" rows={4} maxLength={1200} value={form.bio}
              placeholder="Conte sua experiência comercial, segmentos em que trabalhou e os tipos de venda em que tem mais experiência."
              onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <div className="vx-mut" style={{ fontSize: 11, textAlign: "right" }}>{form.bio.length}/1200</div>
          </label>

          <div style={{ marginTop: 12 }}>
            <div className="vx-label">Disponibilidade</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {DISPONIBILIDADES.map((d) => (
                <button key={d.chave} type="button"
                  className={"vx-chip" + (form.disponibilidade === d.chave ? " vx-badge-brand" : "")}
                  onClick={() => setForm({ ...form, disponibilidade: form.disponibilidade === d.chave ? "" : d.chave })}
                  style={{ cursor: "pointer", borderColor: form.disponibilidade === d.chave ? "var(--brand)" : "var(--border)" }}>
                  {d.nome}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="vx-label">Modalidades comerciais</div>
            <Marcadores opcoes={MODALIDADES} valor={form.modalidades} onChange={(v) => setForm({ ...form, modalidades: v })} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="vx-label">Segmentos em que já vendeu</div>
            <Marcadores opcoes={SEGMENTOS} valor={form.segmentos} onChange={(v) => setForm({ ...form, segmentos: v })} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="vx-label">Habilidades</div>
            <Marcadores opcoes={SKILLS} valor={form.skills} onChange={(v) => setForm({ ...form, skills: v })} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={salvar}>
              {salvando ? "Salvando…" : "Salvar perfil"}
            </button>
            {eu.foto && <button className="vx-btn vx-btn-danger" onClick={removerFoto}><Trash2 size={13} /> Remover foto</button>}
          </div>
          <div className="vx-chart-source">
            Este perfil é o seu currículo comercial dentro da RYCS. As empresas o veem antes de convidar você para uma campanha.
          </div>
        </div>
      )}

      {/* -------------------------------------------------- vitrine ---- */}
      {!editando && (
        <>
          {(eu.modalidades?.length || eu.segmentos?.length || eu.skills?.length) ? (
            <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
              {!!eu.modalidades?.length && <>
                <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Modalidades</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {eu.modalidades.map((m) => <span key={m} className="vx-chip">{m}</span>)}
                </div>
              </>}
              {!!eu.segmentos?.length && <>
                <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Segmentos</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {eu.segmentos.map((m) => <span key={m} className="vx-chip">{m}</span>)}
                </div>
              </>}
              {!!eu.skills?.length && <>
                <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Habilidades</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {eu.skills.map((m) => <span key={m} className="vx-chip">{m}</span>)}
                </div>
              </>}
            </div>
          ) : (
            <div className="vx-card" style={{ padding: 18, marginTop: 12, textAlign: "center" }}>
              <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>
                Seu currículo comercial ainda está vazio. Toque em <b>Editar perfil</b> para adicionar
                título, apresentação, modalidades e segmentos — é o que as empresas leem antes de te convidar.
              </p>
            </div>
          )}

          <div className="vx-card" style={{ padding: 20, marginTop: 12 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 10 }}>
              <Award size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Histórico na plataforma
            </div>
            <div className="vx-grid vx-g4">
              {[["Ações enviadas", stats.total], ["Aprovadas", stats.lib],
                ["Reuniões realizadas", stats.reunioes], ["Vendas", stats.vendas]].map(([k, v]) => (
                <div key={k}>
                  <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{k}</div>
                  <div className="vx-disp vx-mono" style={{ fontSize: 21 }}>{v}</div>
                </div>
              ))}
            </div>
            <hr className="vx-sep" />
            <div className="vx-row" style={{ fontSize: 13, marginBottom: 5 }}>
              <span className="vx-mut">Taxa de aprovação</span>
              <b className="vx-mono">{stats.taxa === null ? "—" : `${stats.taxa}%`}</b>
            </div>
            {stats.taxa !== null && <Medidor value={stats.taxa} tone={stats.taxa >= 70 ? "brand" : stats.taxa >= 50 ? "amber" : "red"} />}
            {parcial && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--amber)" }}>
                Seu perfil está parcial. Conclua a trilha da Academy e refaça a avaliação para chegar à aprovação plena.
              </div>
            )}
            <div className="vx-chart-source">
              A taxa considera só ações já decididas. O que está em auditoria não entra na conta.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
