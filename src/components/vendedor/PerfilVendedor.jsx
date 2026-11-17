import { useEffect, useMemo, useRef, useState } from "react";
import { Award, Camera, CheckCircle2, GraduationCap, Pencil, Trash2, X, RotateCcw, Eye, FileText, UserRound, Settings } from "lucide-react";
import { api, apiPatch, apiDelete, API_URL } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Medidor } from "../ui.jsx";
import OnbPerfil from "./OnbPerfil.jsx";
import VerificarWhatsapp from "./VerificarWhatsapp.jsx";
import { LIMITES, GUIA_FOTO, exemploEnquadramento } from "../../../shared/fotoPerfil.js";
import CropperFoto from "./CropperFoto.jsx";
import MultiSelect from "../ui/MultiSelect.jsx";
import ComboSelect from "../ui/ComboSelect.jsx";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";
import { IDIOMAS, NIVEIS_IDIOMA } from "../../../shared/localidades.js";
import {
  AREAS_ATUACAO, HABILIDADES, ANOS_EXPERIENCIA, DISPONIBILIDADE as DISPONIBILIDADE_CAD,
  SEGMENTOS as SEGMENTOS_CAD, FERRAMENTAS, CONHECIMENTOS, EQUIPAMENTOS, TIPOS_FORMACAO,
} from "../auth/CadastroProfissional.jsx";

const PERFIS = { sdr: "SDR", closer: "Closer", bdr: "BDR", pap: "PAP", "sem-exp": "Iniciante" };

// Cargos de vendas como opções {value,label} para o multi-seletor.
const CARGOS_OPC = ORDEM_FUNCOES.map((k) => ({ value: k, label: FUNCOES[k]?.nome || k }));

// Mapa value→label de todas as listas comerciais do cadastro, para a vitrine.
const LABELS_COMERCIAIS = {};
for (const lista of [AREAS_ATUACAO, HABILIDADES, SEGMENTOS_CAD, FERRAMENTAS, CONHECIMENTOS, EQUIPAMENTOS, ANOS_EXPERIENCIA, DISPONIBILIDADE_CAD, TIPOS_FORMACAO, NIVEIS_IDIOMA, CARGOS_OPC])
  for (const o of lista) LABELS_COMERCIAIS[o.value] = o.label;
const rotuloComercial = (v) => LABELS_COMERCIAIS[v] || v;

// Lê o perfilComercial (JSON string ou objeto) com tolerância a formato.
function lerPerfilComercial(valor) {
  try { const o = typeof valor === "string" ? JSON.parse(valor || "{}") : (valor || {}); return o || {}; }
  catch { return {}; }
}

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

// Item do menu de opções da foto de perfil.
function ItemMenuFoto({ Icon, label, onClick, danger }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
        padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer",
        font: "inherit", fontSize: 13, color: danger ? "var(--danger, #dc2626)" : "var(--ink)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      <Icon size={14} /> {label}
    </button>
  );
}

export default function PerfilVendedor({ eu, db, up, aviso, refazerAvaliacao }) {
  const [secao, setSecao] = useState("curriculo"); // curriculo | apresentacao
  // Abre já em modo de edição: os campos ficam visíveis e editáveis sem
  // precisar clicar em "Editar perfil" — o profissional muda quando quiser.
  const [editando, setEditando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [avaliacaoFoto, setAvaliacaoFoto] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [menuFoto, setMenuFoto] = useState(false);        // menu de opções da foto
  const [fotoAmpliada, setFotoAmpliada] = useState(false); // "Ver foto" em tamanho grande
  const [cropperAberto, setCropperAberto] = useState(false); // "Editar foto" — enquadramento
  const [enviandoCv, setEnviandoCv] = useState(false);     // upload do currículo em arquivo
  const arquivo = useRef(null);
  const cvInput = useRef(null);
  const [certificados, setCertificados] = useState([]);

  // Os certificados que o profissional tirou na Academy fazem parte do
  // currículo comercial dele — é o que a empresa lê antes de convidar.
  useEffect(() => { api("/courses/me/certificates").then((r) => setCertificados(r?.certificados || [])); }, []);

  // Dados comerciais vêm do cadastro, guardados em perfilComercial (JSON).
  const pc = useMemo(() => lerPerfilComercial(eu.perfilComercial), [eu.perfilComercial]);

  const [form, setForm] = useState(() => {
    const p = lerPerfilComercial(eu.perfilComercial);
    return {
      nome: eu.nome || "", perfil: eu.perfil || "",
      pais: eu.pais || "Brasil", cidade: eu.cidade || "", estado: eu.estado || "", whats: eu.whats || "", dataNascimento: eu.dataNascimento || "",
      genero: eu.genero || "",
      perfilComercial: {
        areasAtuacao: p.areasAtuacao || [], habilidades: p.habilidades || [],
        segmentos: p.segmentos || [], ferramentas: p.ferramentas || [],
        conhecimentos: p.conhecimentos || [], equipamentos: p.equipamentos || [],
        anosExperiencia: p.anosExperiencia || "", disponibilidade: p.disponibilidade || "",
        cargosExp: p.cargosExp || [], formacoes: p.formacoes || [], idiomas: p.idiomas || [],
      },
    };
  });

  const setPC = (campo, valor) => setForm((f) => ({ ...f, perfilComercial: { ...f.perfilComercial, [campo]: valor } }));
  // Itens repetíveis (formações, idiomas): adicionar, editar um campo, remover.
  const addItem = (campo, vazio) => setForm((f) => ({ ...f, perfilComercial: { ...f.perfilComercial, [campo]: [...(f.perfilComercial[campo] || []), vazio] } }));
  const setItem = (campo, i, chave, val) => setForm((f) => ({ ...f, perfilComercial: { ...f.perfilComercial, [campo]: f.perfilComercial[campo].map((x, j) => j === i ? { ...x, [chave]: val } : x) } }));
  const remItem = (campo, i) => setForm((f) => ({ ...f, perfilComercial: { ...f.perfilComercial, [campo]: f.perfilComercial[campo].filter((_, j) => j !== i) } }));

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

  // Não há mais etapa de aprovação: todo profissional entra ativo na plataforma.
  // O selo só mostra que o perfil está ativo, com a nota da avaliação ao lado
  // quando existir.
  const nota = Number(eu.scoreTriagem) || 0;

  const salvar = async () => {
    setSalvando(true);
    const r = await apiPatch(`/sellers/${eu.id}`, form);
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    up((d) => ({
      sellers: d.sellers.map((s) => {
        if (s.id !== eu.id) return s;
        const atual = lerPerfilComercial(s.perfilComercial);
        const { perfilComercial, ...cols } = form;
        // perfilComercial fica como string no estado local, igual ao servidor.
        return { ...s, ...cols, perfilComercial: JSON.stringify({ ...atual, ...perfilComercial }) };
      }),
    }));
    setEditando(false);
    aviso("Perfil atualizado.");
  };

  const enviarFoto = async (file) => {
    if (!file) return;
    setAvaliacaoFoto(null);
    setEnviandoFoto(true);
    try {
      const img = await lerImagem(file);
      // Imagem nova: guardamos a origem (sem recorte) para o editor de
      // enquadramento poder reajustar depois, e zeramos o enquadramento salvo.
      const r = await fetch(`${API_URL}/api/sellers/${eu.id}/foto`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...img, original: { base64: img.base64, mimetype: img.mimetype }, enquadramento: {} }),
      });
      const corpo = await r.json();
      setEnviandoFoto(false);

      if (!r.ok) {
        setAvaliacaoFoto(corpo.avaliacao || null);
        return aviso(corpo.error || "Não foi possível enviar a foto.");
      }
      setAvaliacaoFoto(corpo.avaliacao);
      up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, foto: corpo.foto, fotoScore: corpo.avaliacao.score, fotoOriginal: `/api/sellers/${eu.id}/foto-original?t=${Date.now()}`, fotoEnquadramento: "{}" } : s) }));
      aviso(`Foto aprovada com ${corpo.avaliacao.score}/100.`);
    } catch (err) {
      setEnviandoFoto(false);
      aviso(err.message);
    }
  };

  // "Editar foto": salva um novo enquadramento (recorte) a partir da imagem
  // existente, sem escolher outro arquivo. A origem é preservada no backend.
  const salvarEnquadramento = async (payload) => {
    setEnviandoFoto(true);
    try {
      const r = await fetch(`${API_URL}/api/sellers/${eu.id}/foto`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const corpo = await r.json();
      setEnviandoFoto(false);
      if (!r.ok) return aviso(corpo.error || "Não foi possível salvar o enquadramento.");
      up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, foto: `${corpo.foto.split("#")[0]}`, fotoScore: corpo.avaliacao.score, fotoEnquadramento: JSON.stringify(payload.enquadramento || {}) } : s) }));
      setCropperAberto(false);
      aviso("Enquadramento salvo.");
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

  // Currículo em arquivo (PDF/Word): enviar/trocar/remover depois do cadastro.
  const enviarCurriculo = async (file) => {
    if (!file) return;
    setEnviandoCv(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });
      const r = await api(`/sellers/${eu.id}/curriculo`, { base64, mimetype: file.type, nome: file.name });
      setEnviandoCv(false);
      if (r?.error) return aviso(r.error);
      up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, curriculo: r.url, curriculoNome: r.curriculoNome } : s) }));
      aviso("Currículo enviado.");
    } catch (err) {
      setEnviandoCv(false);
      aviso(err.message);
    }
  };

  const removerCurriculo = async () => {
    const r = await apiDelete(`/sellers/${eu.id}/curriculo`);
    if (r?.error) return aviso(r.error);
    up((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, curriculo: null, curriculoNome: "" } : s) }));
    aviso("Currículo removido.");
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
            <button className="vx-btn vx-btn-sm" onClick={() => setMenuFoto((v) => !v)} disabled={enviandoFoto}
              style={{ position: "absolute", right: -6, bottom: -6, padding: "5px 7px", borderRadius: 999 }}
              aria-haspopup="menu" aria-expanded={menuFoto} title="Opções da foto">
              <Camera size={13} />
            </button>
            <input ref={arquivo} hidden type="file" accept={LIMITES.tiposAceitos.join(",")}
              onChange={(e) => { enviarFoto(e.target.files?.[0]); e.target.value = ""; }} />

            {/* Menu de opções da foto: ver, editar (guia de enquadramento),
                trocar (escolher arquivo) e remover. */}
            {menuFoto && (
              <>
                <div onClick={() => setMenuFoto(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div role="menu" style={{
                  position: "absolute", left: "50%", top: "100%", transform: "translateX(-50%)", marginTop: 10,
                  zIndex: 41, minWidth: 168, padding: 5, background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,.18)",
                }}>
                  {eu.foto && <ItemMenuFoto Icon={Eye} label="Ver foto" onClick={() => { setFotoAmpliada(true); setMenuFoto(false); }} />}
                  <ItemMenuFoto Icon={Pencil} label={eu.foto ? "Editar foto" : "Adicionar foto"}
                    onClick={() => { setMenuFoto(false); if (eu.foto) setCropperAberto(true); else setGuiaAberto(true); }} />
                  <ItemMenuFoto Icon={Camera} label={eu.foto ? "Trocar" : "Escolher arquivo"} onClick={() => { setMenuFoto(false); arquivo.current?.click(); }} />
                  {eu.foto && <ItemMenuFoto Icon={Trash2} label="Remover" danger onClick={() => { setMenuFoto(false); removerFoto(); }} />}
                </div>
              </>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="vx-disp" style={{ fontSize: 21 }}>{[eu.nome, eu.sobrenome].filter(Boolean).join(" ")}</div>
            <div style={{ fontSize: 13.5, color: "var(--brand)", fontWeight: 600 }}>
              {eu.titulo || `${PERFIS[eu.perfil] || "Profissional"} comercial`}
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
              {localizacao(eu) || "Localização não informada"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <span className="vx-badge vx-badge-brand">
              Perfil ativo
              {nota > 0 && <> · {nota}%</>}
            </span>
            {/* A avaliação fica sempre à mão. Quem estudou na Academy precisa
                de onde provar isso, e a nota é o que a empresa lê antes de
                aceitar alguém numa campanha. */}
            {refazerAvaliacao && (
              <button className="vx-btn vx-btn-sm" onClick={refazerAvaliacao}>
                <RotateCcw size={13} /> {nota > 0 ? "Refazer avaliação" : "Fazer avaliação"}
              </button>
            )}
            {secao === "curriculo" && (
              <button className="vx-btn vx-btn-sm" onClick={() => setEditando(!editando)}>
                {editando ? <><Eye size={13} /> Ver Perfil</> : <><Pencil size={13} /> Editar perfil</>}
              </button>
            )}
          </div>
        </div>

        {eu.bio && !editando && (
          <div className="vx-mut" style={{ fontSize: 13, marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: eu.bio }} />
        )}

        {enviandoFoto && <div className="vx-mut" style={{ fontSize: 12, marginTop: 10 }}>Verificando a foto…</div>}
      </div>

      {/* "Editar foto" — editor de enquadramento sobre a imagem existente. */}
      {cropperAberto && eu.foto && (
        <CropperFoto
          src={`/api/sellers/${eu.id}/foto-original?t=${eu.fotoScore ?? ""}`}
          inicial={(() => { try { return JSON.parse(eu.fotoEnquadramento || "{}"); } catch { return {}; } })()}
          enviando={enviandoFoto}
          onFechar={() => setCropperAberto(false)}
          onSalvar={salvarEnquadramento}
        />
      )}

      {/* "Ver foto" — a foto atual em tamanho grande. */}
      {fotoAmpliada && eu.foto && (
        <div onClick={() => setFotoAmpliada(false)} role="dialog" aria-label="Foto de perfil"
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: 420, width: "100%" }}>
            <img src={eu.foto} alt={`Foto de ${eu.nome}`} style={{ width: "100%", borderRadius: 16, display: "block" }} />
            <button className="vx-btn vx-btn-sm" onClick={() => setFotoAmpliada(false)} aria-label="Fechar"
              style={{ position: "absolute", top: 8, right: 8, borderRadius: 999, padding: "5px 7px" }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Orientação antes do upload. Descobrir o padrão levando recusa é a
          pior forma de aprender qual foto serve. */}
      {guiaAberto && (
        <div className="vx-overlay" onClick={() => setGuiaAberto(false)}>
          <div className="vx-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="vx-row">
              <div>
                <div className="vx-eyebrow">Foto de perfil</div>
                <h2 className="vx-disp" style={{ margin: "4px 0", fontSize: 19 }}>{GUIA_FOTO.titulo}</h2>
              </div>
              <button className="vx-btn vx-btn-ghost" onClick={() => setGuiaAberto(false)}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "14px 0 18px" }}>
              {["certo", "errado"].map((t) => (
                <img key={t} src={exemploEnquadramento(t)} alt={t === "certo" ? "Enquadramento correto" : "Enquadramento incorreto"}
                  style={{ width: 108, height: 108, borderRadius: 14 }} />
              ))}
            </div>

            <div className="vx-grid vx-g2">
              <div>
                <div className="vx-eyebrow" style={{ marginBottom: 6, color: "var(--brand)" }}>Recomendado</div>
                <ul style={{ fontSize: 12.5, paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
                  {GUIA_FOTO.recomendado.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
              <div>
                <div className="vx-eyebrow" style={{ marginBottom: 6, color: "var(--red)" }}>Evite</div>
                <ul className="vx-mut" style={{ fontSize: 12.5, paddingLeft: 16, margin: 0, lineHeight: 1.7 }}>
                  {GUIA_FOTO.evitar.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            </div>

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 7 }}>Requisitos técnicos</div>
            <div className="vx-grid vx-g2">
              {GUIA_FOTO.requisitos.map((r) => (
                <div key={r.chave} style={{ fontSize: 12.5 }}>
                  <b>{r.texto}</b>
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>{r.detalhe}</div>
                </div>
              ))}
            </div>

            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 18 }}
              onClick={() => { setGuiaAberto(false); arquivo.current?.click(); }}>
              <Camera size={14} /> Escolher foto
            </button>
            <div className="vx-chart-source">
              Avaliamos apenas a apresentação técnica da imagem — nunca características pessoais de quem aparece nela.
            </div>
          </div>
        </div>
      )}

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

      <VerificarWhatsapp eu={eu} up={up} aviso={aviso} />

      {/* abas estilo fichário: Currículo comercial | Apresentação */}
      <style>{`
        .pf-tabs{display:flex;gap:4px;align-items:flex-end;position:relative;z-index:2;margin:14px 0 0;padding:0 2px}
        .pf-tab{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;
          padding:0 15px;height:34px;color:#64748B;background:#F8FAFC;
          border:1px solid #E2E8F0;border-bottom-color:var(--border);border-radius:10px 10px 0 0;white-space:nowrap;
          transition:height .2s ease-out,background .2s ease-out,color .2s ease-out,box-shadow .2s ease-out}
        .pf-tab svg{color:#94A3B8;transition:color .2s ease-out}
        .pf-tab[aria-selected="false"]:hover{color:#334155;background:#F1F5F9}
        .pf-tab[aria-selected="true"]{height:40px;background:#fff;color:var(--ink);font-weight:600;
          border-color:#CBD5E1;border-bottom-color:#fff;margin-bottom:-1px;box-shadow:0 -2px 5px rgba(15,23,42,.04)}
        .pf-tab[aria-selected="true"] svg{color:#318CE7}
        .pf-tab:focus-visible{outline:2px solid #318CE7;outline-offset:2px}
        .pf-panel{position:relative;z-index:1}
        .pf-panel>.vx-card:first-child{margin-top:0}
        @media (prefers-reduced-motion:reduce){.pf-tab{transition:none}}
        @media (max-width:560px){.pf-tabs{overflow-x:auto;scrollbar-width:none}.pf-tabs::-webkit-scrollbar{display:none}.pf-tab{flex:none;min-height:44px}}
      `}</style>
      <div className="pf-tabs" role="tablist" aria-label="Seções do perfil"
        onKeyDown={(e) => {
          const ks = ["curriculo", "apresentacao", "configuracoes"];
          const i = ks.indexOf(secao);
          let alvo = null;
          if (e.key === "ArrowRight") alvo = ks[(i + 1) % ks.length];
          else if (e.key === "ArrowLeft") alvo = ks[(i - 1 + ks.length) % ks.length];
          else if (e.key === "Home") alvo = ks[0];
          else if (e.key === "End") alvo = ks[ks.length - 1];
          if (alvo) { e.preventDefault(); setSecao(alvo); requestAnimationFrame(() => document.getElementById(`pf-tab-${alvo}`)?.focus()); }
        }}>
        {[["curriculo", "Currículo comercial", FileText], ["apresentacao", "Apresentação", UserRound], ["configuracoes", "Configurações", Settings]].map(([k, l, Ico]) => (
          <button key={k} id={`pf-tab-${k}`} type="button" role="tab" className="pf-tab"
            aria-selected={secao === k} aria-controls="pf-panel" tabIndex={secao === k ? 0 : -1}
            onClick={() => setSecao(k)}>
            <Ico size={15} aria-hidden="true" /> {l}
          </button>
        ))}
      </div>

      <div id="pf-panel" role="tabpanel" className="pf-panel" aria-labelledby={`pf-tab-${secao}`}>
      {secao === "apresentacao" ? (
        <OnbPerfil modoPerfil aviso={aviso} />
      ) : secao === "configuracoes" ? (
        <OnbPerfil modoPerfil apenasPrivacidade aviso={aviso} />
      ) : (
      <>
      {/* -------------------------------------------------- edição ---- */}
      {editando && (
        <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
          <div className="vx-eyebrow">Currículo comercial</div>
          <h3 className="vx-disp" style={{ fontSize: 17, margin: "3px 0 12px" }}>Suas informações</h3>

          <div className="vx-grid vx-g2">
            {campo("nome", "Nome *")}
            {campo("whats", "WhatsApp")}
          </div>
          <div className="vx-grid vx-g3" style={{ marginTop: 9 }}>
            {campo("pais", "País *")}
            <label>
              <div className="vx-label">Estado *</div>
              <select className="vx-input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="">Selecione</option>
                {[["AC","Acre"],["AL","Alagoas"],["AM","Amazonas"],["AP","Amapá"],["BA","Bahia"],["CE","Ceará"],["DF","Distrito Federal"],["ES","Espírito Santo"],["GO","Goiás"],["MA","Maranhão"],["MG","Minas Gerais"],["MS","Mato Grosso do Sul"],["MT","Mato Grosso"],["PA","Pará"],["PB","Paraíba"],["PE","Pernambuco"],["PI","Piauí"],["PR","Paraná"],["RJ","Rio de Janeiro"],["RN","Rio Grande do Norte"],["RO","Rondônia"],["RR","Roraima"],["RS","Rio Grande do Sul"],["SC","Santa Catarina"],["SE","Sergipe"],["SP","São Paulo"],["TO","Tocantins"]].map(([uf, nome]) => (
                  <option key={uf} value={uf}>{uf} — {nome}</option>
                ))}
              </select>
            </label>
            {campo("cidade", "Cidade *")}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 9, flexWrap: "wrap" }}>
            <label>
              <div className="vx-label">Data de nascimento</div>
              <input type="date" className="vx-input" style={{ maxWidth: 200 }} value={form.dataNascimento}
                onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
            </label>
            <label>
              <div className="vx-label">Gênero</div>
              <select className="vx-input" style={{ maxWidth: 180 }} value={form.genero}
                onChange={(e) => setForm({ ...form, genero: e.target.value })}>
                <option value="">Não informado</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </label>
          </div>

          <div className="vx-mut" style={{ fontSize: 12, marginTop: 10, padding: "9px 12px", background: "var(--surface-1)", borderRadius: 8 }}>
            Sua apresentação, bio, redes sociais, vídeo e portfólio ficam na aba <b>Apresentação</b>, acima.
          </div>

          <div className="vx-eyebrow" style={{ margin: "18px 0 10px" }}>Experiência comercial</div>
          <div style={{ marginTop: 10 }}>
            <div className="vx-label">Áreas de atuação</div>
            <MultiSelect opcoes={AREAS_ATUACAO} valor={form.perfilComercial.areasAtuacao} onChange={(v) => setPC("areasAtuacao", v)} placeholder="Selecione" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="vx-label">Habilidades</div>
            <MultiSelect opcoes={HABILIDADES} valor={form.perfilComercial.habilidades} onChange={(v) => setPC("habilidades", v)} placeholder="Selecione" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="vx-label">Segmentos em que já vendeu</div>
            <MultiSelect opcoes={SEGMENTOS_CAD} valor={form.perfilComercial.segmentos} onChange={(v) => setPC("segmentos", v)} placeholder="Selecione" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="vx-label">Ferramentas que domina</div>
            <MultiSelect opcoes={FERRAMENTAS} valor={form.perfilComercial.ferramentas} onChange={(v) => setPC("ferramentas", v)} placeholder="Selecione" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="vx-label">Conhecimentos</div>
            <MultiSelect opcoes={CONHECIMENTOS} valor={form.perfilComercial.conhecimentos} onChange={(v) => setPC("conhecimentos", v)} placeholder="Selecione" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="vx-label">Equipamentos</div>
            <MultiSelect opcoes={EQUIPAMENTOS} valor={form.perfilComercial.equipamentos} onChange={(v) => setPC("equipamentos", v)} placeholder="Selecione" />
          </div>
          <div className="vx-grid vx-g2" style={{ marginTop: 10 }}>
            <div>
              <div className="vx-label">Anos de experiência</div>
              <ComboSelect opcoes={ANOS_EXPERIENCIA} valor={form.perfilComercial.anosExperiencia} onChange={(v) => setPC("anosExperiencia", v)} placeholder="Selecione" />
            </div>
            <div>
              <div className="vx-label">Disponibilidade</div>
              <ComboSelect opcoes={DISPONIBILIDADE_CAD} valor={form.perfilComercial.disponibilidade} onChange={(v) => setPC("disponibilidade", v)} placeholder="Selecione" />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="vx-label">Cargos com experiência em vendas</div>
            <MultiSelect opcoes={CARGOS_OPC} valor={form.perfilComercial.cargosExp}
              onChange={(v) => setForm((f) => ({ ...f, perfil: v.includes(f.perfil) ? f.perfil : (v[0] || ""), perfilComercial: { ...f.perfilComercial, cargosExp: v } }))}
              placeholder="Selecione" />
            {form.perfilComercial.cargosExp.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="vx-label">Experiência principal</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {form.perfilComercial.cargosExp.map((k) => (
                    <button key={k} type="button"
                      className={"vx-chip" + (form.perfil === k ? " vx-badge-brand" : "")}
                      onClick={() => setForm((f) => ({ ...f, perfil: k }))}
                      style={{ cursor: "pointer", borderColor: form.perfil === k ? "var(--brand)" : "var(--border)" }}>
                      {FUNCOES[k]?.nome || k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="vx-label">Formações</div>
            {form.perfilComercial.formacoes.map((f, i) => (
              <div key={i} className="vx-grid vx-g2" style={{ marginBottom: 8 }}>
                <ComboSelect opcoes={TIPOS_FORMACAO} valor={f.tipo} onChange={(v) => setItem("formacoes", i, "tipo", v)} placeholder="Tipo de formação" />
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="vx-input" style={{ flex: 1 }} value={f.descricao || ""} maxLength={120}
                    placeholder="Curso / instituição" onChange={(e) => setItem("formacoes", i, "descricao", e.target.value)} />
                  <button type="button" className="vx-btn vx-btn-sm" onClick={() => remItem("formacoes", i)} aria-label="Remover formação"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            <button type="button" className="vx-btn vx-btn-sm" onClick={() => addItem("formacoes", { tipo: "", descricao: "" })}>+ Adicionar formação</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="vx-label">Idiomas</div>
            {form.perfilComercial.idiomas.map((idi, i) => (
              <div key={i} className="vx-grid vx-g2" style={{ marginBottom: 8 }}>
                <ComboSelect opcoes={IDIOMAS} valor={idi.idioma} onChange={(v) => setItem("idiomas", i, "idioma", v)} placeholder="Idioma" />
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <ComboSelect opcoes={NIVEIS_IDIOMA} valor={idi.nivel} onChange={(v) => setItem("idiomas", i, "nivel", v)} placeholder="Nível" />
                  </div>
                  <button type="button" className="vx-btn vx-btn-sm" onClick={() => remItem("idiomas", i)} aria-label="Remover idioma"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            <button type="button" className="vx-btn vx-btn-sm" onClick={() => addItem("idiomas", { idioma: "", nivel: "" })}>+ Adicionar idioma</button>
          </div>

          {/* Currículo em arquivo (PDF/Word) — mesmo do cadastro, editável aqui. */}
          <div style={{ marginTop: 16 }}>
            <div className="vx-label">Currículo (PDF ou Word)</div>
            <input ref={cvInput} hidden type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => { enviarCurriculo(e.target.files?.[0]); e.target.value = ""; }} />
            {eu.curriculo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, flexWrap: "wrap" }}>
                <FileText size={18} style={{ color: "var(--brand)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 140, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {eu.curriculoNome || "Currículo enviado"}
                </div>
                <a className="vx-btn vx-btn-sm" href={`${API_URL}/api/sellers/${eu.id}/curriculo`} target="_blank" rel="noreferrer">
                  <Eye size={13} /> Ver
                </a>
                <button type="button" className="vx-btn vx-btn-sm" disabled={enviandoCv} onClick={() => cvInput.current?.click()}>
                  <RotateCcw size={13} /> {enviandoCv ? "Enviando…" : "Trocar"}
                </button>
                <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" onClick={removerCurriculo}>
                  <Trash2 size={13} /> Remover
                </button>
              </div>
            ) : (
              <button type="button" className="vx-btn vx-btn-sm" disabled={enviandoCv} onClick={() => cvInput.current?.click()}>
                <FileText size={13} /> {enviandoCv ? "Enviando…" : "Enviar currículo"}
              </button>
            )}
            <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6 }}>PDF ou Word, até 8MB. As empresas podem baixar seu currículo.</div>
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
          {(() => {
            const secoes = [
              ["Cargos", pc.cargosExp],
              ["Áreas de atuação", pc.areasAtuacao],
              ["Habilidades", pc.habilidades],
              ["Segmentos", pc.segmentos],
              ["Ferramentas", pc.ferramentas],
              ["Conhecimentos", pc.conhecimentos],
              ["Equipamentos", pc.equipamentos],
            ].filter(([, arr]) => arr?.length);
            const formacoes = (pc.formacoes || []).filter((f) => f?.tipo || f?.descricao);
            const idiomas = (pc.idiomas || []).filter((i) => i?.idioma);
            const temAlgo = secoes.length || formacoes.length || idiomas.length || pc.anosExperiencia || pc.disponibilidade;
            return temAlgo ? (
              <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
                {secoes.map(([titulo, arr]) => (
                  <div key={titulo} style={{ marginBottom: 14 }}>
                    <div className="vx-eyebrow" style={{ marginBottom: 6 }}>{titulo}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {arr.map((v) => <span key={v} className="vx-chip">{rotuloComercial(v)}</span>)}
                    </div>
                  </div>
                ))}
                {!!idiomas.length && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Idiomas</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {idiomas.map((i, k) => <span key={k} className="vx-chip">{i.idioma}{i.nivel ? ` · ${rotuloComercial(i.nivel)}` : ""}</span>)}
                    </div>
                  </div>
                )}
                {!!formacoes.length && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Formações</div>
                    {formacoes.map((f, k) => (
                      <div key={k} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 3 }}>
                        <b>{rotuloComercial(f.tipo) || "Formação"}</b>{f.descricao ? ` — ${f.descricao}` : ""}
                      </div>
                    ))}
                  </div>
                )}
                {(pc.anosExperiencia || pc.disponibilidade) && (
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {pc.anosExperiencia && <div><div className="vx-eyebrow" style={{ marginBottom: 6 }}>Experiência</div><span className="vx-chip">{rotuloComercial(pc.anosExperiencia)}</span></div>}
                    {pc.disponibilidade && <div><div className="vx-eyebrow" style={{ marginBottom: 6 }}>Disponibilidade</div><span className="vx-chip">{rotuloComercial(pc.disponibilidade)}</span></div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="vx-card" style={{ padding: 18, marginTop: 12, textAlign: "center" }}>
                <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>
                  Seu currículo comercial ainda está vazio. Toque em <b>Editar perfil</b> para adicionar suas
                  áreas, habilidades e segmentos — é o que as empresas leem antes de te convidar.
                </p>
              </div>
            );
          })()}

          <div className="vx-card" style={{ padding: 18, marginTop: 12 }}>
            <div className="vx-row" style={{ marginBottom: 10 }}>
              <div className="vx-eyebrow">
                <GraduationCap size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Certificados da RYCS Academy
              </div>
              <span className="vx-chip vx-mono">{certificados.length}</span>
            </div>
            {!certificados.length ? (
              <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>
                Nenhum certificado ainda. Conclua um curso na Academy e passe na prova — o certificado
                aparece aqui com código de verificação.
              </p>
            ) : (
              <div className="vx-grid vx-g2">
                {certificados.map((c) => (
                  <div key={c.codigo} style={{ padding: 13, border: "1px solid var(--border)", borderRadius: 12, borderLeft: "3px solid var(--brand)" }}>
                    <div className="vx-row" style={{ gap: 8 }}>
                      <b style={{ fontSize: 13 }}>{c.titulo}</b>
                      <span className="vx-badge vx-badge-brand vx-mono" style={{ flexShrink: 0 }}>{c.percentual}%</span>
                    </div>
                    <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{c.categoria} · {dataCurta(c.emitidoEm)}</div>
                    <div className="vx-mono" style={{ fontSize: 11.5, marginTop: 5, color: "var(--brand)" }}>{c.codigo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            <div className="vx-chart-source">
              A taxa considera só ações já decididas. O que está em auditoria não entra na conta.
            </div>
          </div>
        </>
      )}
      </>
      )}
      </div>
    </div>
  );
}
