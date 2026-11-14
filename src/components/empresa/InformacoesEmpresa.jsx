import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Building2, Package, MessagesSquare, ClipboardCheck, Plus, Trash2, ChevronRight,
  ArrowUpRight, Check, Paperclip, X, ChevronUp, ChevronDown, FileText, Loader2,
  AlertCircle,
} from "lucide-react";
import { api, apiPatch, apiDelete } from "../../lib/api.js";

const AZUL = "#318CE7";
const AZUL_SUAVE = "#EAF4FF";
const BORDA = "#E8EAED";

// As quatro seções de "Informações da empresa". Ícones e descrições conforme o
// escopo. A base é a tabela company_info_entries (uma linha por registro/bloco).
export const INFO_SECOES = [
  { chave: "sobre", label: "Sobre a empresa", Icon: Building2, descricao: "Identidade, posicionamento e informações institucionais." },
  { chave: "produtos", label: "Produtos e serviços", Icon: Package, descricao: "Soluções, características e benefícios." },
  { chave: "abordagens", label: "Abordagens e orientações", Icon: MessagesSquare, descricao: "Comunicação, argumentos e diretrizes." },
  { chave: "processos", label: "Processos e procedimentos", Icon: ClipboardCheck, descricao: "Instruções e boas práticas operacionais." },
];
export const SECAO_DE = (chave) => INFO_SECOES.find((s) => s.chave === chave) || null;

// Blocos sugeridos para "Sobre a empresa" (opcionais; a empresa pode criar os seus).
const SUGESTOES_SOBRE = [
  { titulo: "Apresentação da empresa", dica: "Uma visão geral de quem é a empresa." },
  { titulo: "O que a empresa faz", dica: "Descrição das atividades principais." },
  { titulo: "Público-alvo", dica: "Quem são os clientes atendidos." },
  { titulo: "Diferenciais", dica: "O que diferencia a empresa dos concorrentes." },
  { titulo: "Posicionamento", dica: "Como a empresa deseja ser apresentada." },
];

// Esquema de campos por seção de registros (produtos, abordagens, processos).
// `dados: true` indica que o campo vive no JSON `dados` da entrada.
const SCHEMA = {
  produtos: {
    singular: "produto ou serviço", plural: "produtos e serviços", tipo: "produto",
    nomeLabel: "Nome", nomePlaceholder: "Ex.: Plano Pro",
    campos: [
      { k: "descricao", label: "Descrição", tipo: "textarea" },
      { k: "caracteristicas", label: "Características", tipo: "textarea", dados: true },
      { k: "beneficios", label: "Benefícios", tipo: "textarea", dados: true },
      { k: "diferenciais", label: "Diferenciais", tipo: "textarea", dados: true },
      { k: "publico", label: "Público indicado", tipo: "input", dados: true },
      { k: "preco", label: "Preço (quando aplicável)", tipo: "input", dados: true },
      { k: "complementos", label: "Informações complementares", tipo: "textarea", dados: true },
    ],
  },
  abordagens: {
    singular: "orientação", plural: "orientações", tipo: "orientacao",
    nomeLabel: "Título", nomePlaceholder: "Ex.: Como apresentar a empresa",
    campos: [
      { k: "descricao", label: "Descrição", tipo: "input" },
      { k: "conteudo", label: "Conteúdo", tipo: "textarea", grande: true },
    ],
  },
  processos: {
    singular: "procedimento", plural: "procedimentos", tipo: "procedimento",
    nomeLabel: "Nome", nomePlaceholder: "Ex.: Processo de atendimento",
    campos: [
      { k: "objetivo", label: "Objetivo", tipo: "input", dados: true },
      { k: "descricao", label: "Descrição", tipo: "textarea" },
      { k: "etapas", label: "Etapas", tipo: "etapas", dados: true },
      { k: "observacoes", label: "Observações", tipo: "textarea", dados: true },
    ],
  },
};

const temConteudo = (e) => {
  if (String(e.titulo || "").trim() || String(e.conteudo || "").trim() || String(e.descricao || "").trim()) return true;
  const d = e.dados || {};
  return Object.values(d).some((v) => Array.isArray(v) ? v.some((x) => String(x).trim()) : String(v || "").trim());
};

/* ============================================================
   CARDS DAS 4 SEÇÕES (grade 2 colunas) — para a landing de Materiais
   ============================================================ */
export function CardsInformacoes({ resumo, onAbrir }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {INFO_SECOES.map((s) => (
        <CardSecao key={s.chave} secao={s} estado={resumo?.[s.chave]?.estado || "vazio"} onClick={() => onAbrir(s.chave)} />
      ))}
    </div>
  );
}

const ESTADOS = {
  vazio: { label: "Não preenchido", cor: "#9aa0a6", bg: "#F3F4F6" },
  parcial: { label: "Em preenchimento", cor: "#B4690E", bg: "#FDF3E7" },
  preenchido: { label: "Preenchido", cor: "#1E7F4F", bg: "#E7F6EE" },
};

function CardSecao({ secao, estado, onClick }) {
  const { Icon, label, descricao } = secao;
  const est = ESTADOS[estado] || ESTADOS.vazio;
  return (
    <button onClick={onClick}
      style={{ position: "relative", textAlign: "left", background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 19, cursor: "pointer", transition: "border-color .15s, box-shadow .15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = AZUL; e.currentTarget.style.boxShadow = "0 2px 10px rgba(49,140,231,.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDA; e.currentTarget.style.boxShadow = "none"; }}>
      <ArrowUpRight size={18} style={{ position: "absolute", top: 16, right: 16, color: "#b8bcc4" }} />
      <span style={{ width: 44, height: 44, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Icon size={22} style={{ color: AZUL }} />
      </span>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#171717" }}>{label}</div>
      <div style={{ fontSize: 13, color: "#737373", margin: "2px 0 12px", minHeight: 18 }}>{descricao}</div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: est.cor, background: est.bg, padding: "3px 9px", borderRadius: 20 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: est.cor }} /> {est.label}
      </span>
    </button>
  );
}

/* ============================================================
   INDICADOR DE SALVAMENTO
   ============================================================ */
function IndicadorSalvamento({ estado }) {
  if (estado === "salvando") return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#737373" }}><Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> Salvando...</span>;
  if (estado === "salvo") return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#1E7F4F" }}><Check size={13} /> Salvo</span>;
  if (estado === "erro") return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--red)" }}><AlertCircle size={13} /> Erro ao salvar</span>;
  return <span style={{ fontSize: 12, color: "transparent" }}>—</span>;
}

/* ============================================================
   VISTA INTERNA DE UMA SEÇÃO
   ============================================================ */
export function SecaoInformacoes({ secao, materiaisLib, onVoltar, aviso }) {
  const info = SECAO_DE(secao);
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvamento, setSalvamento] = useState("ocioso");
  const timers = useRef({});

  const carregar = useCallback(async () => {
    const r = await api(`/company-info?secao=${secao}`);
    if (r?.entradas) setEntradas(r.entradas);
    setLoading(false);
  }, [secao]);
  useEffect(() => { carregar(); }, [carregar]);

  // Salvamento automático com debounce por entrada. Marca status 'salvo' quando
  // há conteúdo real, para alimentar o indicador de preenchimento dos cards.
  const agendarSalvar = useCallback((id, patch, entradaAtual) => {
    setSalvamento("salvando");
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const base = { ...entradaAtual, ...patch, dados: { ...(entradaAtual.dados || {}), ...(patch.dados || {}) } };
      const status = temConteudo(base) ? "salvo" : "rascunho";
      const r = await apiPatch(`/company-info/${id}`, { ...patch, status });
      if (r?.id) setSalvamento("salvo"); else setSalvamento("erro");
    }, 700);
  }, []);

  const atualizarLocal = (id, patch) => setEntradas((prev) => prev.map((e) => e.id === id ? { ...e, ...patch, dados: { ...(e.dados || {}), ...(patch.dados || {}) } } : e));

  const editar = (id, patch) => {
    const entradaAtual = entradas.find((e) => e.id === id);
    atualizarLocal(id, patch);
    agendarSalvar(id, patch, entradaAtual);
  };

  const criar = async (extra = {}) => {
    const tipo = secao === "sobre" ? "bloco" : (SCHEMA[secao]?.tipo || "bloco");
    const r = await api("/company-info", { secao, tipo, ...extra });
    if (r?.id) { setEntradas((prev) => [...prev, r]); return r; }
    aviso?.("Não foi possível criar o registro."); return null;
  };

  const remover = async (id) => {
    setEntradas((prev) => prev.filter((e) => e.id !== id));
    await apiDelete(`/company-info/${id}`);
  };

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#737373", marginBottom: 14 }}>
        <button onClick={onVoltar} style={{ background: "none", border: "none", color: AZUL, cursor: "pointer", padding: 0, fontSize: 13 }}>Materiais</button>
        <ChevronRight size={14} />
        <span style={{ color: "#171717", fontWeight: 500 }}>{info.label}</span>
      </div>

      {/* Cabeçalho interno */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ width: 42, height: 42, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <info.Icon size={21} style={{ color: AZUL }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{info.label}</h2>
            <p style={{ fontSize: 13, color: "#737373", margin: 0 }}>{info.descricao}</p>
          </div>
        </div>
        <div style={{ paddingTop: 6 }}><IndicadorSalvamento estado={salvamento} /></div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" style={{ margin: "0 auto" }} /></div>
      ) : secao === "sobre" ? (
        <EditorSobre entradas={entradas} onEditar={editar} onCriar={criar} onRemover={remover} />
      ) : (
        <EditorRegistros secao={secao} entradas={entradas} materiaisLib={materiaisLib}
          onEditar={editar} onCriar={criar} onRemover={remover} />
      )}
    </div>
  );
}

/* ============================================================
   EDITOR "SOBRE A EMPRESA" — blocos de texto
   ============================================================ */
function EditorSobre({ entradas, onEditar, onCriar, onRemover }) {
  const titulosUsados = entradas.map((e) => (e.titulo || "").trim().toLowerCase());
  const sugestoesPend = SUGESTOES_SOBRE.filter((s) => !titulosUsados.includes(s.titulo.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {entradas.length === 0 && (
        <p style={{ fontSize: 14, color: "#737373", margin: "0 0 2px" }}>
          Adicione blocos com as informações institucionais da sua empresa. Comece por uma sugestão ou crie um bloco do zero.
        </p>
      )}

      {entradas.map((e) => (
        <BlocoSobre key={e.id} entrada={e} onEditar={onEditar} onRemover={onRemover} />
      ))}

      {sugestoesPend.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
          {sugestoesPend.map((s) => (
            <button key={s.titulo} onClick={() => onCriar({ titulo: s.titulo })} title={s.dica}
              className="vx-btn vx-btn-sm" style={{ gap: 6, borderStyle: "dashed" }}>
              <Plus size={14} /> {s.titulo}
            </button>
          ))}
        </div>
      )}

      <div>
        <button onClick={() => onCriar({ titulo: "", tipo: "custom" })} className="vx-btn vx-btn-sm" style={{ gap: 6 }}>
          <Plus size={15} /> Adicionar bloco personalizado
        </button>
      </div>
    </div>
  );
}

function BlocoSobre({ entrada, onEditar, onRemover }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input value={entrada.titulo || ""} onChange={(e) => onEditar(entrada.id, { titulo: e.target.value })}
          placeholder="Título do bloco" className="vx-input"
          style={{ fontWeight: 600, fontSize: 14, border: "none", background: "transparent", padding: "2px 0", flex: 1, height: "auto" }} />
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => onRemover(entrada.id)} style={{ padding: 4, color: "var(--red)" }} title="Remover bloco">
          <Trash2 size={15} />
        </button>
      </div>
      <textarea value={entrada.conteudo || ""} onChange={(e) => onEditar(entrada.id, { conteudo: e.target.value })}
        placeholder="Escreva aqui..." className="vx-input" rows={4}
        style={{ resize: "vertical", width: "100%", lineHeight: 1.5 }} />
    </div>
  );
}

/* ============================================================
   EDITOR DE REGISTROS — produtos, abordagens, processos
   ============================================================ */
function EditorRegistros({ secao, entradas, materiaisLib, onEditar, onCriar, onRemover }) {
  const schema = SCHEMA[secao];
  const [abertoId, setAbertoId] = useState(null);
  const aberto = entradas.find((e) => e.id === abertoId) || null;

  const adicionar = async () => {
    const r = await onCriar({});
    if (r?.id) setAbertoId(r.id);
  };

  if (aberto) {
    return (
      <RegistroEditor secao={secao} schema={schema} entrada={aberto} materiaisLib={materiaisLib}
        onEditar={onEditar} onVoltar={() => setAbertoId(null)}
        onRemover={() => { onRemover(aberto.id); setAbertoId(null); }} />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={adicionar} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
          <Plus size={16} /> Adicionar {schema.singular}
        </button>
      </div>

      {entradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
          <p style={{ fontSize: 14, color: "#737373", margin: "0 0 14px" }}>Nenhum {schema.singular} cadastrado ainda.</p>
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={adicionar} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
            <Plus size={16} /> Adicionar {schema.singular}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
          {entradas.map((e) => (
            <CardRegistro key={e.id} entrada={e} schema={schema} onClick={() => setAbertoId(e.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardRegistro({ entrada, schema, onClick }) {
  const resumo = entrada.descricao || entrada.conteudo || entrada.dados?.objetivo || "";
  const nEtapas = Array.isArray(entrada.dados?.etapas) ? entrada.dados.etapas.filter((x) => String(x).trim()).length : 0;
  return (
    <button onClick={onClick}
      style={{ textAlign: "left", background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, cursor: "pointer", transition: "border-color .15s", minHeight: 96 }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = AZUL}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = BORDA}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {entrada.titulo || `Sem título`}
      </div>
      <div style={{ fontSize: 12.5, color: "#737373", marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {resumo || "Sem descrição"}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 11, color: "#9aa0a6" }}>
        {nEtapas > 0 && <span>{nEtapas} etapa{nEtapas > 1 ? "s" : ""}</span>}
        {entrada.anexos?.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Paperclip size={11} /> {entrada.anexos.length}</span>}
      </div>
    </button>
  );
}

function RegistroEditor({ secao, schema, entrada, materiaisLib, onEditar, onVoltar, onRemover }) {
  const info = SECAO_DE(secao);
  const val = (c) => c.dados ? (entrada.dados?.[c.k] ?? "") : (entrada[c.k] ?? "");
  const setCampo = (c, v) => onEditar(entrada.id, c.dados ? { dados: { [c.k]: v } } : { [c.k]: v });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#737373", marginBottom: 16 }}>
        <button onClick={onVoltar} style={{ background: "none", border: "none", color: AZUL, cursor: "pointer", padding: 0, fontSize: 13 }}>{info.label}</button>
        <ChevronRight size={14} />
        <span style={{ color: "#171717", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{entrada.titulo || "Novo registro"}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 20 }}>
        <div>
          <label className="vx-label">{schema.nomeLabel}</label>
          <input className="vx-input" value={entrada.titulo || ""} placeholder={schema.nomePlaceholder}
            onChange={(e) => onEditar(entrada.id, { titulo: e.target.value })} />
        </div>

        {schema.campos.map((c) => (
          <div key={c.k}>
            <label className="vx-label">{c.label}</label>
            {c.tipo === "input" && (
              <input className="vx-input" value={val(c)} onChange={(e) => setCampo(c, e.target.value)} />
            )}
            {c.tipo === "textarea" && (
              <textarea className="vx-input" value={val(c)} rows={c.grande ? 6 : 3} style={{ resize: "vertical", lineHeight: 1.5 }}
                onChange={(e) => setCampo(c, e.target.value)} />
            )}
            {c.tipo === "etapas" && (
              <EditorEtapas etapas={Array.isArray(entrada.dados?.etapas) ? entrada.dados.etapas : []}
                onChange={(arr) => onEditar(entrada.id, { dados: { etapas: arr } })} />
            )}
          </div>
        ))}

        <AnexosBiblioteca anexos={entrada.anexos || []} materiaisLib={materiaisLib}
          onChange={(arr) => onEditar(entrada.id, { anexos: arr })} />

        <div style={{ borderTop: `1px solid ${BORDA}`, paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onRemover} style={{ gap: 6, color: "var(--red)" }}>
            <Trash2 size={15} /> Remover {schema.singular}
          </button>
          <button className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ gap: 6 }}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EDITOR DE ETAPAS (sequência simples, reordenável)
   ============================================================ */
function EditorEtapas({ etapas, onChange }) {
  const set = (i, v) => onChange(etapas.map((e, n) => n === i ? v : e));
  const add = () => onChange([...etapas, ""]);
  const rem = (i) => onChange(etapas.filter((_, n) => n !== i));
  const mover = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= etapas.length) return;
    const arr = [...etapas];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {etapas.length === 0 && <p style={{ fontSize: 12.5, color: "#9aa0a6", margin: 0 }}>Nenhuma etapa. Procedimentos não precisam ser sequenciais.</p>}
      {etapas.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: AZUL_SUAVE, color: AZUL, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
          <input className="vx-input" value={e} placeholder={`Etapa ${i + 1}`} onChange={(ev) => set(i, ev.target.value)} style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 2 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => mover(i, -1)} disabled={i === 0} style={{ padding: 3 }} title="Subir"><ChevronUp size={14} /></button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => mover(i, 1)} disabled={i === etapas.length - 1} style={{ padding: 3 }} title="Descer"><ChevronDown size={14} /></button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => rem(i)} style={{ padding: 3, color: "var(--red)" }} title="Remover"><X size={14} /></button>
          </div>
        </div>
      ))}
      <button className="vx-btn vx-btn-sm" onClick={add} style={{ gap: 6, alignSelf: "flex-start" }}><Plus size={14} /> Adicionar etapa</button>
    </div>
  );
}

/* ============================================================
   ANEXOS DA BIBLIOTECA (vincula materiais existentes por id)
   ============================================================ */
function AnexosBiblioteca({ anexos, materiaisLib, onChange }) {
  const [picker, setPicker] = useState(false);
  const porId = useMemo(() => Object.fromEntries((materiaisLib || []).map((m) => [m.id, m])), [materiaisLib]);
  const add = (id) => { if (!anexos.includes(id)) onChange([...anexos, id]); setPicker(false); };
  const rem = (id) => onChange(anexos.filter((x) => x !== id));
  const disponiveis = (materiaisLib || []).filter((m) => !anexos.includes(m.id));

  return (
    <div>
      <label className="vx-label">Arquivos relacionados</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {anexos.map((id) => {
          const m = porId[id];
          return (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "#F8F9FB", border: `1px solid ${BORDA}`, borderRadius: 20, padding: "4px 10px" }}>
              <FileText size={13} style={{ color: "#737373" }} />
              <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m?.nome || "Arquivo removido"}</span>
              <button onClick={() => rem(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", padding: 0, display: "flex" }}><X size={13} /></button>
            </span>
          );
        })}
        <button className="vx-btn vx-btn-sm" onClick={() => setPicker((v) => !v)} style={{ gap: 6, borderStyle: "dashed" }}>
          <Paperclip size={14} /> Vincular da biblioteca
        </button>
      </div>

      {picker && (
        <div style={{ marginTop: 8, border: `1px solid ${BORDA}`, borderRadius: 10, maxHeight: 220, overflowY: "auto" }}>
          {disponiveis.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: "#737373" }}>Nenhum arquivo disponível na biblioteca.</div>
          ) : disponiveis.map((m) => (
            <button key={m.id} onClick={() => add(m.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", background: "none", border: "none", borderBottom: `1px solid ${BORDA}`, cursor: "pointer", textAlign: "left" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
              <FileText size={15} style={{ color: "#737373", flexShrink: 0 }} />
              <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#9aa0a6" }}>{m.categoria}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
