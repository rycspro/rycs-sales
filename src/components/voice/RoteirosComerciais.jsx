import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import {
  FileText, Sparkles, FilePen, CheckCircle2, Headphones, Plus, Copy, Trash2, Edit3, ArrowLeft,
  ChevronUp, ChevronDown, AlertTriangle, Upload, Save, Eye, EyeOff, ArrowDown, X,
} from "lucide-react";
import { TIPOS_CAMPO, OPERADORES, EFEITOS_CRITERIO, novoId, listarPerguntas, contarPerguntas } from "../../../shared/roteiroComercial.js";

// Roteiros comerciais da empresa, dentro da discadora: criar à mão ou gerar
// com IA a partir de PDF/TXT/texto, revisar, editar, publicar e vincular a
// campanhas. O que a IA gera nasce rascunho: só vai para os profissionais
// depois que a empresa publica.

const ORIGEM = { ia: "Gerado com IA", interno: "Importado (sem IA)", manual: "Criado à mão" };
const toque = { minHeight: 44, minWidth: 44 };

function Card({ children, style, ...p }) {
  return <div className="vx-card" style={{ padding: 18, ...style }} {...p}>{children}</div>;
}

function BotaoIcone({ label, onClick, children, disabled, perigo }) {
  return (
    <button type="button" className={`vx-btn vx-btn-sm ${perigo ? "vx-btn-danger" : "vx-btn-ghost"}`} aria-label={label} title={label}
      onClick={onClick} disabled={disabled} style={{ ...toque, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </button>
  );
}

const FLUXO = [
  { Icon: FileText, titulo: "Upload de PDF ou texto" },
  { Icon: Sparkles, titulo: "IA gera o roteiro automaticamente", sub: "Blocos, perguntas, condições e campos" },
  { Icon: FilePen, titulo: "Empresa revisa e edita" },
  { Icon: CheckCircle2, titulo: "Publicação na campanha" },
  { Icon: Headphones, titulo: "Profissional inicia a chamada", sub: "IA acompanha, avança e registra as respostas." },
];

function ComoFunciona() {
  return (
    <ol aria-label="Como funciona" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
      {FLUXO.map(({ Icon, titulo, sub }, i) => (
        <li key={titulo} style={{ display: "grid", justifyItems: "center", gap: 6 }}>
          <div style={{ width: "100%", textAlign: "center", padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: i === 1 ? "var(--surface-2)" : "var(--surface-solid)" }}>
            <Icon size={20} aria-hidden="true" style={{ color: i === 3 ? "var(--green)" : "var(--ink)" }} />
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>{titulo}</div>
            {sub && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>{sub}</div>}
          </div>
          {i < FLUXO.length - 1 && <ArrowDown size={14} aria-hidden="true" style={{ color: "var(--muted)" }} />}
        </li>
      ))}
    </ol>
  );
}

export default function RoteirosComerciais({ aviso }) {
  const [roteiros, setRoteiros] = useState(null);
  const [iaDisponivel, setIaDisponivel] = useState(false);
  const [campanhas, setCampanhas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(() => {
    api.get("/voice/roteiros").then((r) => { setRoteiros(r.roteiros || []); setIaDisponivel(!!r.ia?.disponivel); }).catch((e) => { setRoteiros([]); aviso?.(e.message); });
  }, [aviso]);

  useEffect(() => {
    carregar();
    api.get("/campaigns").then((c) => setCampanhas(Array.isArray(c) ? c : [])).catch(() => {});
  }, [carregar]);

  const abrir = async (id, avisos = []) => {
    try { const r = await api.get(`/voice/roteiros/${id}`); setEditando({ ...r, avisos }); } catch (e) { aviso?.(e.message); }
  };

  const criarManual = async () => {
    try {
      const r = await api.post("/voice/roteiros", { nome: "Novo roteiro", estrutura: { blocos: [{ id: novoId("b"), titulo: "Abertura", orientacao: "", topicos: [{ id: novoId("t"), titulo: "", orientacao: "", perguntas: [] }] }], criterios: [] } });
      setEditando({ ...r, avisos: [] });
    } catch (e) { aviso?.(e.message); }
  };

  const acao = async (fn, ok) => {
    try { await fn(); if (ok) aviso?.(ok); carregar(); } catch (e) { aviso?.(e.message); }
  };

  if (editando) {
    const usadas = {};
    for (const r of roteiros || []) if (r.id !== editando.id) for (const c of r.campanhas) usadas[c.id] = r.nome;
    return <EditorRoteiro inicial={editando} campanhas={campanhas} usadas={usadas} aviso={aviso} onFechar={() => { setEditando(null); carregar(); }} />;
  }
  if (gerando) {
    return <GerarComIA iaDisponivel={iaDisponivel} aviso={aviso} onCancelar={() => setGerando(false)} onGerado={(r) => { setGerando(false); setEditando({ ...r, avisos: r.avisos || [] }); }} />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Roteiros comerciais</h3>
          <p className="vx-mut" style={{ margin: "4px 0 0", fontSize: 13, maxWidth: 560 }}>
            O roteiro aparece para o profissional durante a ligação e a videochamada. A IA acompanha a conversa, avança as perguntas e preenche as respostas.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="vx-btn" style={toque} onClick={criarManual}><Plus size={15} /> Criar manualmente</button>
          <button type="button" className="vx-btn vx-btn-primary" style={toque} onClick={() => setGerando(true)}><Sparkles size={15} /> Gerar com IA</button>
        </div>
      </div>

      {roteiros === null && <div style={{ textAlign: "center", padding: 30 }}><div className="vx-spinner" /></div>}

      {roteiros?.length === 0 && (
        <Card style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Nenhum roteiro ainda</div>
            <p className="vx-mut" style={{ fontSize: 13, margin: "6px 0 14px" }}>
              Envie o roteiro que sua equipe já usa (PDF, TXT ou texto colado). A IA lê o documento uma vez, monta blocos e perguntas e deixa tudo para você revisar antes de publicar.
            </p>
            <button type="button" className="vx-btn vx-btn-primary" style={toque} onClick={() => setGerando(true)}><Upload size={15} /> Enviar documento</button>
          </div>
          <ComoFunciona />
        </Card>
      )}

      {roteiros?.map((r) => (
        <Card key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 650, fontSize: 15 }}>{r.nome}</span>
              <span className={`vx-badge ${r.status === "publicado" ? "vx-badge-brand" : "vx-badge-amber"}`}>{r.status === "publicado" ? "Publicado" : "Rascunho"}</span>
              <span className="vx-chip" style={{ fontSize: 11.5 }}>{r.legado ? "Roteiro antigo" : ORIGEM[r.origem] || "Criado à mão"}</span>
            </div>
            <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>
              {r.perguntas} pergunta{r.perguntas === 1 ? "" : "s"}
              {r.fonteNome ? ` · ${r.fonteNome}` : ""}
              {" · "}{r.campanhas.length ? `Campanhas: ${r.campanhas.map((c) => c.titulo || "sem título").join(", ")}` : "Sem campanha vinculada"}
              {" · atualizado "}{new Date(r.atualizadoEm).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="vx-btn vx-btn-sm" style={toque} onClick={() => abrir(r.id)}><Edit3 size={14} /> Editar</button>
            {r.status === "publicado"
              ? <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={toque} onClick={() => acao(() => api.post(`/voice/roteiros/${r.id}/publicar`, { publicar: false }), "Roteiro voltou para rascunho")}><EyeOff size={14} /> Despublicar</button>
              : <button type="button" className="vx-btn vx-btn-sm vx-btn-primary" style={toque} disabled={!r.perguntas} title={r.perguntas ? "" : "Adicione perguntas antes de publicar"} onClick={() => acao(() => api.post(`/voice/roteiros/${r.id}/publicar`, { publicar: true }), "Roteiro publicado")}><Eye size={14} /> Publicar</button>}
            <BotaoIcone label={`Duplicar ${r.nome}`} onClick={() => acao(() => api.post(`/voice/roteiros/${r.id}/duplicar`), "Cópia criada como rascunho")}><Copy size={15} /></BotaoIcone>
            <BotaoIcone label={`Excluir ${r.nome}`} perigo onClick={() => {
              if (window.confirm(`Excluir o roteiro "${r.nome}"? Ele sai das campanhas; respostas já salvas no CRM continuam.`)) acao(() => api.delete(`/voice/roteiros/${r.id}`), "Roteiro excluído");
            }}><Trash2 size={15} /></BotaoIcone>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Geração com IA ───────────────────────────────────────────────────

function lerBase64(arquivo) {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result).split(",")[1] || "");
    leitor.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

function GerarComIA({ iaDisponivel, aviso, onCancelar, onGerado }) {
  const [modo, setModo] = useState("arquivo");
  const [arquivo, setArquivo] = useState(null);
  const [texto, setTexto] = useState("");
  const [nome, setNome] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");

  const gerar = async () => {
    setErro("");
    const corpo = { nome: nome.trim() || undefined };
    if (modo === "arquivo") {
      if (!arquivo) return setErro("Escolha um arquivo PDF ou TXT.");
      if (!/\.(pdf|txt)$/i.test(arquivo.name)) return setErro("Envie um arquivo PDF ou TXT.");
      if (arquivo.size > 10 * 1024 * 1024) return setErro("O arquivo deve ter até 10 MB.");
      corpo.arquivo = { nome: arquivo.name, base64: await lerBase64(arquivo) };
    } else {
      if (texto.trim().length < 80) return setErro("Cole o roteiro completo (pelo menos algumas linhas).");
      corpo.texto = texto;
    }
    setProcessando(true);
    try { onGerado(await api.post("/voice/roteiros/gerar", corpo)); } catch (e) { setErro(e.message); aviso?.(e.message); } finally { setProcessando(false); }
  };

  return (
    <Card style={{ display: "grid", gap: 14, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <BotaoIcone label="Voltar" onClick={onCancelar}><ArrowLeft size={16} /></BotaoIcone>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Gerar roteiro com IA</h3>
      </div>
      <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>
        O documento é lido uma única vez. A IA organiza blocos, tópicos, perguntas, orientações, campos de resposta, perguntas obrigatórias, condições e critérios de qualificação, sem inventar conteúdo. O resultado fica como rascunho para você revisar e publicar.
      </p>
      {!iaDisponivel && (
        <div className="vx-notice vx-notice-amber" role="status" style={{ fontSize: 13 }}>
          A IA não está configurada neste ambiente. O leitor interno monta o roteiro (títulos viram blocos e frases com "?" viram perguntas) e tudo fica marcado para revisão.
        </div>
      )}

      <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <legend className="vx-label">Origem do roteiro</legend>
        {[["arquivo", "Enviar arquivo (PDF ou TXT)"], ["texto", "Colar texto"]].map(([id, label]) => (
          <label key={id} className={`vx-chip`} style={{ ...toque, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", cursor: "pointer", border: modo === id ? "2px solid var(--brand)" : "1px solid var(--border)" }}>
            <input type="radio" name="origem-roteiro" value={id} checked={modo === id} onChange={() => setModo(id)} /> {label}
          </label>
        ))}
      </fieldset>

      {modo === "arquivo" ? (
        <div>
          <label className="vx-label" htmlFor="roteiro-arquivo">Arquivo do roteiro</label>
          <input id="roteiro-arquivo" type="file" accept=".pdf,.txt,application/pdf,text/plain" className="vx-input" style={toque}
            onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>PDF com texto ou TXT, até 10 MB.</div>
        </div>
      ) : (
        <div>
          <label className="vx-label" htmlFor="roteiro-texto">Texto do roteiro</label>
          <textarea id="roteiro-texto" className="vx-input" rows={12} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Cole aqui o roteiro: etapas, falas, perguntas, regras e critérios de qualificação." style={{ fontFamily: "inherit", resize: "vertical" }} />
        </div>
      )}

      <div>
        <label className="vx-label" htmlFor="roteiro-nome-novo">Nome do roteiro (opcional)</label>
        <input id="roteiro-nome-novo" className="vx-input" style={toque} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Usa o título do documento quando vazio" />
      </div>

      {erro && <div className="vx-notice vx-notice-amber" role="alert" style={{ fontSize: 13 }}>{erro}</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" className="vx-btn vx-btn-ghost" style={toque} onClick={onCancelar} disabled={processando}>Cancelar</button>
        <button type="button" className="vx-btn vx-btn-primary" style={toque} onClick={gerar} disabled={processando} aria-busy={processando}>
          {processando ? <><span className="vx-spinner" style={{ width: 14, height: 14 }} /> Lendo o documento…</> : <><Sparkles size={15} /> Gerar roteiro</>}
        </button>
      </div>
    </Card>
  );
}

// ── Editor ───────────────────────────────────────────────────────────

const clonar = (o) => JSON.parse(JSON.stringify(o));
const comNovosIds = (item, prefixo) => {
  const c = clonar(item);
  c.id = novoId(prefixo);
  if (c.topicos) c.topicos = c.topicos.map((t) => comNovosIds(t, "t"));
  if (c.perguntas) c.perguntas = c.perguntas.map((p) => comNovosIds(p, "p"));
  return c;
};
const mover = (lista, i, delta) => {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
};
const novaPergunta = () => ({ id: novoId("p"), texto: "", variacoes: [], orientacao: "", obrigatoria: false, campo: { tipo: "texto", opcoes: [] }, condicao: null, revisar: false });
const novoTopico = () => ({ id: novoId("t"), titulo: "", orientacao: "", perguntas: [novaPergunta()] });
const novoBloco = () => ({ id: novoId("b"), titulo: "", orientacao: "", condicao: null, topicos: [novoTopico()] });

function Controles({ nome, i, total, onMover, onDuplicar, onExcluir }) {
  return (
    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
      <BotaoIcone label={`Subir ${nome}`} disabled={i === 0} onClick={() => onMover(-1)}><ChevronUp size={15} /></BotaoIcone>
      <BotaoIcone label={`Descer ${nome}`} disabled={i === total - 1} onClick={() => onMover(1)}><ChevronDown size={15} /></BotaoIcone>
      <BotaoIcone label={`Duplicar ${nome}`} onClick={onDuplicar}><Copy size={15} /></BotaoIcone>
      <BotaoIcone label={`Excluir ${nome}`} perigo onClick={onExcluir}><Trash2 size={15} /></BotaoIcone>
    </div>
  );
}

function CondicaoEditor({ idBase, condicao, perguntas, excluirId, onChange }) {
  const opcoes = perguntas.filter((p) => p.id !== excluirId);
  const ref = opcoes.find((p) => p.id === condicao?.perguntaId);
  const semValor = ["preenchido", "vazio"].includes(condicao?.operador);
  const valores = ref?.campo?.tipo === "sim_nao" ? ["Sim", "Não"] : ref?.campo?.tipo === "opcao" ? ref.campo.opcoes : null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label className="vx-label" htmlFor={`${idBase}-cond`} style={{ margin: 0 }}>Quando mostrar</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select id={`${idBase}-cond`} className="vx-input" style={{ ...toque, flex: "1 1 220px" }} value={condicao?.perguntaId || ""}
          onChange={(e) => onChange(e.target.value ? { perguntaId: e.target.value, operador: condicao?.operador || "igual", valor: condicao?.valor || "" } : null)}>
          <option value="">Sempre</option>
          {opcoes.map((p) => <option key={p.id} value={p.id}>Só se “{(p.texto || "pergunta sem texto").slice(0, 60)}”</option>)}
        </select>
        {condicao && (
          <>
            <select aria-label="Operador da condição" className="vx-input" style={{ ...toque, flex: "0 1 170px" }} value={condicao.operador} onChange={(e) => onChange({ ...condicao, operador: e.target.value })}>
              {OPERADORES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {!semValor && (valores?.length ? (
              <select aria-label="Valor da condição" className="vx-input" style={{ ...toque, flex: "0 1 170px" }} value={condicao.valor} onChange={(e) => onChange({ ...condicao, valor: e.target.value })}>
                <option value="">Escolha…</option>
                {valores.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <input aria-label="Valor da condição" className="vx-input" style={{ ...toque, flex: "0 1 170px" }} value={condicao.valor} onChange={(e) => onChange({ ...condicao, valor: e.target.value })} placeholder="Valor" />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function PerguntaEditor({ p, idx, total, perguntas, onAlterar, onMover, onDuplicar, onExcluir }) {
  const idBase = `perg-${p.id}`;
  const set = (campo, valor) => onAlterar((x) => { x[campo] = valor; });
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 12, display: "grid", gap: 10, background: "var(--surface-solid)" }}>
      {p.revisar && (
        <div className="vx-notice vx-notice-amber" role="status" style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <AlertTriangle size={14} aria-hidden="true" /> Confira esta pergunta: ela não aparece igual no documento.
          <button type="button" className="vx-btn vx-btn-sm" style={toque} onClick={() => set("revisar", false)}>Conferida</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label className="vx-label" htmlFor={`${idBase}-texto`}>Pergunta {idx + 1}</label>
          <input id={`${idBase}-texto`} className="vx-input" style={toque} value={p.texto} onChange={(e) => set("texto", e.target.value)} placeholder="O que o profissional pergunta" />
        </div>
        <Controles nome="pergunta" i={idx} total={total} onMover={onMover} onDuplicar={onDuplicar} onExcluir={onExcluir} />
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div>
          <label className="vx-label" htmlFor={`${idBase}-tipo`}>Campo de resposta</label>
          <select id={`${idBase}-tipo`} className="vx-input" style={toque} value={p.campo.tipo} onChange={(e) => onAlterar((x) => { x.campo = { tipo: e.target.value, opcoes: e.target.value === "opcao" ? x.campo.opcoes || [] : [] }; })}>
            {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        {p.campo.tipo === "opcao" && (
          <div>
            <label className="vx-label" htmlFor={`${idBase}-opcoes`}>Opções (separadas por vírgula)</label>
            <input id={`${idBase}-opcoes`} className="vx-input" style={toque} defaultValue={p.campo.opcoes.join(", ")}
              onBlur={(e) => onAlterar((x) => { x.campo.opcoes = [...new Set(e.target.value.split(",").map((o) => o.trim()).filter(Boolean))]; })} />
          </div>
        )}
        <label style={{ ...toque, display: "flex", alignItems: "center", gap: 8, fontSize: 13, alignSelf: "end", cursor: "pointer" }}>
          <input type="checkbox" checked={p.obrigatoria} onChange={(e) => set("obrigatoria", e.target.checked)} style={{ width: 18, height: 18 }} /> Pergunta obrigatória
        </label>
      </div>
      <div>
        <label className="vx-label" htmlFor={`${idBase}-var`}>Outras formas de perguntar (uma por linha · ajudam a IA a reconhecer)</label>
        <textarea id={`${idBase}-var`} className="vx-input" rows={2} style={{ fontFamily: "inherit", resize: "vertical" }} defaultValue={(p.variacoes || []).join("\n")}
          onBlur={(e) => set("variacoes", e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} />
      </div>
      <div>
        <label className="vx-label" htmlFor={`${idBase}-ori`}>Orientação para o profissional</label>
        <textarea id={`${idBase}-ori`} className="vx-input" rows={2} style={{ fontFamily: "inherit", resize: "vertical" }} value={p.orientacao} onChange={(e) => set("orientacao", e.target.value)} />
      </div>
      <CondicaoEditor idBase={idBase} condicao={p.condicao} perguntas={perguntas} excluirId={p.id} onChange={(c) => set("condicao", c)} />
    </div>
  );
}

function EditorRoteiro({ inicial, campanhas, usadas, aviso, onFechar }) {
  const [nome, setNome] = useState(inicial.nome);
  const [estrutura, setEstrutura] = useState(() => clonar(inicial.estrutura || { blocos: [], criterios: [] }));
  const [vinculos, setVinculos] = useState(() => inicial.campanhas.map((c) => c.id));
  const [status, setStatus] = useState(inicial.status);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [recolhidos, setRecolhidos] = useState({});
  const perguntas = listarPerguntas(estrutura);

  const alterar = (fn) => { setEstrutura((e) => { const c = clonar(e); fn(c); return c; }); setAlterado(true); };

  const salvar = async (publicar) => {
    setSalvando(true);
    try {
      let r = await api.put(`/voice/roteiros/${inicial.id}`, { nome, estrutura, campanhas: vinculos });
      if (publicar !== undefined) r = await api.post(`/voice/roteiros/${inicial.id}/publicar`, { publicar });
      setEstrutura(clonar(r.estrutura));
      setStatus(r.status);
      setAlterado(false);
      aviso?.(publicar === true ? "Roteiro publicado" : publicar === false ? "Roteiro voltou para rascunho" : "Roteiro salvo");
      return true;
    } catch (e) { aviso?.(e.message); return false; } finally { setSalvando(false); }
  };

  const fechar = () => {
    if (alterado && !window.confirm("Há alterações não salvas. Sair mesmo assim?")) return;
    onFechar();
  };

  const totalRevisar = perguntas.filter((p) => p.revisar).length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", position: "sticky", top: 0, zIndex: 2 }}>
        <BotaoIcone label="Voltar para a lista" onClick={fechar}><ArrowLeft size={16} /></BotaoIcone>
        <div style={{ flex: "1 1 260px" }}>
          <label className="vx-label" htmlFor="roteiro-nome">Nome do roteiro</label>
          <input id="roteiro-nome" className="vx-input" style={toque} value={nome} onChange={(e) => { setNome(e.target.value); setAlterado(true); }} />
        </div>
        <span className={`vx-badge ${status === "publicado" ? "vx-badge-brand" : "vx-badge-amber"}`} style={{ alignSelf: "center" }}>{status === "publicado" ? "Publicado" : "Rascunho"}</span>
        <div className="vx-mut" style={{ fontSize: 12.5, alignSelf: "center" }}>{estrutura.blocos.length} blocos · {perguntas.length} perguntas</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="vx-btn" style={toque} disabled={salvando} onClick={() => salvar()}><Save size={15} /> Salvar</button>
          {status === "publicado"
            ? <button type="button" className="vx-btn vx-btn-ghost" style={toque} disabled={salvando} onClick={() => salvar(false)}><EyeOff size={15} /> Despublicar</button>
            : <button type="button" className="vx-btn vx-btn-primary" style={toque} disabled={salvando || !perguntas.length} onClick={() => salvar(true)}><CheckCircle2 size={15} /> Publicar</button>}
        </div>
      </Card>

      {(inicial.avisos?.length > 0 || totalRevisar > 0) && (
        <div className="vx-notice vx-notice-amber" role="status" style={{ fontSize: 13 }}>
          <b>Revise antes de publicar.</b>
          {totalRevisar > 0 && <div>{totalRevisar} pergunta(s) marcada(s) para conferir com o documento.</div>}
          {inicial.avisos?.map((a, i) => <div key={i}>• {a}</div>)}
        </div>
      )}

      <Card>
        <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 4 }}>Campanhas</div>
        <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
          Cada campanha usa um roteiro. Sem campanha marcada, o roteiro publicado vale para as ligações das campanhas que não têm roteiro próprio.
        </p>
        {campanhas.length === 0 && <div className="vx-mut" style={{ fontSize: 13 }}>Nenhuma campanha criada.</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {campanhas.map((c) => (
            <label key={c.id} className="vx-chip" style={{ ...toque, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", cursor: "pointer" }}>
              <input type="checkbox" checked={vinculos.includes(c.id)} style={{ width: 18, height: 18 }}
                onChange={(e) => { setVinculos((v) => (e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id))); setAlterado(true); }} />
              {c.titulo || "Campanha sem título"}
              {usadas[c.id] && !vinculos.includes(c.id) && <span className="vx-mut" style={{ fontSize: 11 }}>(usa “{usadas[c.id]}”)</span>}
            </label>
          ))}
        </div>
      </Card>

      {estrutura.blocos.map((b, bi) => (
        <Card key={b.id} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <BotaoIcone label={recolhidos[b.id] ? "Expandir bloco" : "Recolher bloco"} onClick={() => setRecolhidos((r) => ({ ...r, [b.id]: !r[b.id] }))}>
              {recolhidos[b.id] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </BotaoIcone>
            <div style={{ flex: 1 }}>
              <label className="vx-label" htmlFor={`bloco-${b.id}`}>Bloco {bi + 1}</label>
              <input id={`bloco-${b.id}`} className="vx-input" style={{ ...toque, fontWeight: 600 }} value={b.titulo} placeholder="Ex.: Abertura, Qualificação, Objeções"
                onChange={(e) => alterar((x) => { x.blocos[bi].titulo = e.target.value; })} />
            </div>
            <Controles nome="bloco" i={bi} total={estrutura.blocos.length}
              onMover={(d) => alterar((x) => mover(x.blocos, bi, d))}
              onDuplicar={() => alterar((x) => x.blocos.splice(bi + 1, 0, comNovosIds(x.blocos[bi], "b")))}
              onExcluir={() => window.confirm("Excluir este bloco e todas as perguntas dele?") && alterar((x) => x.blocos.splice(bi, 1))} />
          </div>
          {!recolhidos[b.id] && (
            <>
              <div>
                <label className="vx-label" htmlFor={`bloco-ori-${b.id}`}>Orientação do bloco</label>
                <textarea id={`bloco-ori-${b.id}`} className="vx-input" rows={2} style={{ fontFamily: "inherit", resize: "vertical" }} value={b.orientacao}
                  onChange={(e) => alterar((x) => { x.blocos[bi].orientacao = e.target.value; })} />
              </div>
              <CondicaoEditor idBase={`bloco-${b.id}`} condicao={b.condicao} perguntas={perguntas.filter((p) => p.blocoId !== b.id)} onChange={(c) => alterar((x) => { x.blocos[bi].condicao = c; })} />

              {b.topicos.map((t, ti) => (
                <div key={t.id} style={{ borderLeft: "3px solid var(--brand-100)", paddingLeft: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label className="vx-label" htmlFor={`topico-${t.id}`}>Tópico {ti + 1}</label>
                      <input id={`topico-${t.id}`} className="vx-input" style={toque} value={t.titulo} placeholder="Opcional"
                        onChange={(e) => alterar((x) => { x.blocos[bi].topicos[ti].titulo = e.target.value; })} />
                    </div>
                    <Controles nome="tópico" i={ti} total={b.topicos.length}
                      onMover={(d) => alterar((x) => mover(x.blocos[bi].topicos, ti, d))}
                      onDuplicar={() => alterar((x) => x.blocos[bi].topicos.splice(ti + 1, 0, comNovosIds(x.blocos[bi].topicos[ti], "t")))}
                      onExcluir={() => window.confirm("Excluir este tópico e as perguntas dele?") && alterar((x) => x.blocos[bi].topicos.splice(ti, 1))} />
                  </div>
                  <div>
                    <label className="vx-label" htmlFor={`topico-ori-${t.id}`}>Orientação do tópico</label>
                    <textarea id={`topico-ori-${t.id}`} className="vx-input" rows={2} style={{ fontFamily: "inherit", resize: "vertical" }} value={t.orientacao}
                      onChange={(e) => alterar((x) => { x.blocos[bi].topicos[ti].orientacao = e.target.value; })} />
                  </div>
                  {t.perguntas.map((p, pi) => (
                    <PerguntaEditor key={p.id} p={p} idx={pi} total={t.perguntas.length} perguntas={perguntas}
                      onAlterar={(fn) => alterar((x) => fn(x.blocos[bi].topicos[ti].perguntas[pi]))}
                      onMover={(d) => alterar((x) => mover(x.blocos[bi].topicos[ti].perguntas, pi, d))}
                      onDuplicar={() => alterar((x) => x.blocos[bi].topicos[ti].perguntas.splice(pi + 1, 0, comNovosIds(x.blocos[bi].topicos[ti].perguntas[pi], "p")))}
                      onExcluir={() => alterar((x) => x.blocos[bi].topicos[ti].perguntas.splice(pi, 1))} />
                  ))}
                  <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={{ ...toque, justifySelf: "start" }}
                    onClick={() => alterar((x) => x.blocos[bi].topicos[ti].perguntas.push(novaPergunta()))}><Plus size={14} /> Adicionar pergunta</button>
                </div>
              ))}
              <button type="button" className="vx-btn vx-btn-sm" style={{ ...toque, justifySelf: "start" }} onClick={() => alterar((x) => x.blocos[bi].topicos.push(novoTopico()))}>
                <Plus size={14} /> Adicionar tópico
              </button>
            </>
          )}
        </Card>
      ))}

      <button type="button" className="vx-btn" style={{ ...toque, justifySelf: "start" }} onClick={() => alterar((x) => x.blocos.push(novoBloco()))}><Plus size={15} /> Adicionar bloco</button>

      <Card style={{ display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 650, fontSize: 14 }}>Critérios de qualificação</div>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>Avaliados com as respostas da chamada e mostrados ao profissional.</p>
        </div>
        {estrutura.criterios.map((c, ci) => (
          <div key={c.id} style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", alignItems: "end", borderTop: ci ? "1px solid var(--border)" : "none", paddingTop: ci ? 10 : 0 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="vx-label" htmlFor={`crit-${c.id}`}>Critério {ci + 1}</label>
              <input id={`crit-${c.id}`} className="vx-input" style={toque} value={c.descricao} placeholder="Ex.: Empresa com mais de 10 funcionários"
                onChange={(e) => alterar((x) => { x.criterios[ci].descricao = e.target.value; })} />
            </div>
            <select aria-label="Pergunta do critério" className="vx-input" style={toque} value={c.perguntaId} onChange={(e) => alterar((x) => { x.criterios[ci].perguntaId = e.target.value; })}>
              <option value="">Escolha a pergunta…</option>
              {perguntas.map((p) => <option key={p.id} value={p.id}>{(p.texto || "pergunta sem texto").slice(0, 60)}</option>)}
            </select>
            <select aria-label="Operador do critério" className="vx-input" style={toque} value={c.operador} onChange={(e) => alterar((x) => { x.criterios[ci].operador = e.target.value; })}>
              {OPERADORES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {!["preenchido", "vazio"].includes(c.operador) && (
              <input aria-label="Valor do critério" className="vx-input" style={toque} value={c.valor} placeholder="Valor" onChange={(e) => alterar((x) => { x.criterios[ci].valor = e.target.value; })} />
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <select aria-label="Efeito do critério" className="vx-input" style={{ ...toque, flex: 1 }} value={c.efeito} onChange={(e) => alterar((x) => { x.criterios[ci].efeito = e.target.value; })}>
                {EFEITOS_CRITERIO.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <BotaoIcone label="Excluir critério" perigo onClick={() => alterar((x) => x.criterios.splice(ci, 1))}><X size={15} /></BotaoIcone>
            </div>
          </div>
        ))}
        <button type="button" className="vx-btn vx-btn-sm" style={{ ...toque, justifySelf: "start" }} disabled={!contarPerguntas(estrutura)}
          onClick={() => alterar((x) => x.criterios.push({ id: novoId("c"), descricao: "", perguntaId: "", operador: "igual", valor: "", efeito: "qualifica" }))}>
          <Plus size={14} /> Adicionar critério
        </button>
      </Card>
    </div>
  );
}
