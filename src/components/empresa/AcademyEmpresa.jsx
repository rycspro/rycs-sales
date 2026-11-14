import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Plus, Search, BookOpen, Users, GraduationCap, X, ChevronRight, ArrowLeft,
  MoreVertical, Pencil, Copy, Archive, Trash2, Eye, GripVertical, ChevronDown,
  Video, FileText, Headphones, Link2, Type, Clock, Layers, FolderOpen, Check,
  Sparkles, Loader2, ArrowRight, RefreshCw, Send, Settings2, Building2, Package, ClipboardCheck,
  ChevronUp, Wand2,
} from "lucide-react";
import { api, apiPatch, apiDelete, API_URL } from "../../lib/api.js";

const AZUL = "#318CE7";
const AZUL_SUAVE = "#EAF4FF";
const BORDA = "#E8EAED";

const apiPut = (path, body) =>
  fetch(`${API_URL}/api${path}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" })
    .then((r) => r.json()).catch(() => null);

const TIPOS_AULA = [
  { chave: "video", label: "Vídeo", Icon: Video, categoria: "video" },
  { chave: "documento", label: "Documento", Icon: FileText, categoria: "documento" },
  { chave: "audio", label: "Áudio", Icon: Headphones, categoria: "audio" },
  { chave: "link", label: "Link", Icon: Link2, categoria: null },
  { chave: "texto", label: "Texto", Icon: Type, categoria: null },
];
const TIPO_DE = (c) => TIPOS_AULA.find((t) => t.chave === c) || TIPOS_AULA[4];

const STATUS_BADGE = {
  revisao: { txt: "Aguardando revisão", bg: "#FDF3E7", cor: "#B4690E" },
  publicado: { txt: "Publicado", bg: "#E8F6EE", cor: "#1A7F43" },
  rascunho: { txt: "Rascunho", bg: "#F3F4F6", cor: "#6B7280" },
  arquivado: { txt: "Arquivado", bg: "#FDECEC", cor: "#B4232A" },
};

const duracaoTxt = (min) => {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "revisao", label: "Aguardando revisão" },
  { key: "publicado", label: "Publicados" },
  { key: "rascunho", label: "Rascunhos" },
  { key: "arquivado", label: "Arquivados" },
];
const ORIGENS = [
  { key: "todos", label: "Todas as origens" },
  { key: "ia", label: "Gerados por IA" },
  { key: "manual", label: "Criados manualmente" },
];
const ORDENS = [
  { key: "recentes", label: "Mais recentes" },
  { key: "atualizacao", label: "Última atualização" },
  { key: "az", label: "Nome" },
];
const ORIGEM_LABEL = { ia: "Gerado por IA", manual: "Criado pela empresa" };

export default function AcademyEmpresa({ emp, db, aviso, onIrParaMateriais }) {
  const [vista, setVista] = useState("lista");   // lista | builder
  const [cursoId, setCursoId] = useState(null);

  const abrirBuilder = (id) => { setCursoId(id); setVista("builder"); };
  const voltarLista = () => { setVista("lista"); setCursoId(null); };

  if (vista === "builder" && cursoId) {
    return <Builder cursoId={cursoId} emp={emp} db={db} aviso={aviso} onVoltar={voltarLista} />;
  }
  return <Lista emp={emp} aviso={aviso} onAbrir={abrirBuilder} onIrMateriais={onIrParaMateriais} />;
}

/* ============================ LISTA / PÁGINA PRINCIPAL ============================ */
function Lista({ emp, aviso, onAbrir, onIrMateriais }) {
  const [dados, setDados] = useState(null);
  const [intel, setIntel] = useState(null);
  const [aba, setAba] = useState("minha"); // minha | configuracoes | aprendizado
  const [criar, setCriar] = useState(false);
  const [gerar, setGerar] = useState(false);
  const [preview, setPreview] = useState(false);
  const [aprend, setAprend] = useState(null); // mapa courseId -> stats

  const carregar = useCallback(async () => {
    const r = await api("/academy/empresa");
    if (r?.cursos) setDados(r);
  }, []);
  const carregarIntel = useCallback(async () => {
    const r = await api("/academy/empresa/inteligencia");
    if (r && !r.error) setIntel(r);
  }, []);
  const carregarAprend = useCallback(async () => {
    const r = await api("/academy/empresa/aprendizado");
    if (r?.modulos) setAprend(Object.fromEntries(r.modulos.map((m) => [m.id, m])));
  }, []);
  useEffect(() => { carregar(); carregarIntel(); carregarAprend(); }, [carregar, carregarIntel, carregarAprend]);

  const cursos = dados?.cursos || [];

  // Reordenação dos módulos na própria jornada (persistida).
  const mover = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= cursos.length) return;
    const ids = cursos.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setDados((d) => ({ ...d, cursos: ids.map((id) => cursos.find((c) => c.id === id)) }));
    await apiPut("/academy/empresa/cursos/ordem", { ordem: ids });
  };

  const gerarAulasModulo = async (c) => {
    aviso?.("Gerando aulas com IA...");
    const r = await api(`/academy/empresa/cursos/${c.id}/ia/aulas`, {});
    if (r?.error || !r?.ok) return aviso?.(r?.error || "Falha ao gerar aulas.");
    aviso?.(`${r.aulas} aula(s) geradas e aguardando sua revisão.`);
    carregar(); carregarIntel();
  };

  const acaoCurso = async (c, acao) => {
    if (acao === "editar" || acao === "abrir" || acao === "revisar") return onAbrir(c.id);
    if (acao === "duplicar") {
      const r = await api(`/academy/empresa/cursos/${c.id}/duplicar`, {});
      if (r?.error) return aviso?.(r.error);
      aviso?.("Treinamento duplicado."); carregar();
    }
    if (acao === "arquivar") {
      const r = await api(`/academy/empresa/cursos/${c.id}/arquivar`, {});
      if (r?.error) return aviso?.(r.error);
      aviso?.("Treinamento arquivado."); carregar(); carregarIntel();
    }
    if (acao === "excluir") {
      if (!confirm(`Excluir "${c.titulo}"? Esta ação não pode ser desfeita.`)) return;
      const r = await apiDelete(`/academy/empresa/cursos/${c.id}`);
      if (r?.error) return aviso?.(r.error);
      aviso?.("Treinamento excluído."); carregar(); carregarIntel();
    }
  };

  const aposGerar = (ids) => {
    setGerar(false);
    carregar(); carregarIntel();
    setAba("minha");
    aviso?.(`${ids.length} treinamento(s) gerado(s) e aguardando sua revisão.`);
  };

  const aceitarSugestao = async (sug) => {
    const r = await api("/academy/empresa/cursos", { titulo: sug.titulo, descricao: sug.descricao });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Módulo criado como rascunho."); carregar(); carregarIntel();
  };

  if (!dados) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const ABAS = [["minha", "Minha Academy"], ["configuracoes", "Configurações"], ["aprendizado", "Aprendizado"]];

  return (
    <div className="vx-fade">
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>Academy</h1>
          <p style={{ color: "#737373", margin: "4px 0 0", fontSize: 14 }}>Organize os treinamentos da sua empresa e acompanhe a capacitação dos profissionais.</p>
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => setGerar(true)} style={{ gap: 6, background: AZUL, borderColor: AZUL, whiteSpace: "nowrap" }}>
          <Sparkles size={16} /> Gerar com IA
        </button>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${BORDA}`, marginBottom: 24 }}>
        {ABAS.map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)} style={{ padding: "10px 16px", fontSize: 14, fontWeight: aba === k ? 600 : 400, color: aba === k ? AZUL : "#737373", background: "none", border: "none", borderBottom: aba === k ? `2px solid ${AZUL}` : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      {aba === "minha" && (
        <>
          <PainelInteligencia intel={intel} temModulos={cursos.length > 0} onGerar={() => setGerar(true)} onRevisar={() => setAba("minha")}
            onAtualizacoes={() => setAba("aprendizado")} onIrMateriais={onIrMateriais} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Jornada de aprendizagem</h2>
              <p style={{ color: "#737373", margin: "2px 0 0", fontSize: 13 }}>Organize o que seus profissionais precisam aprender e defina a sequência dos treinamentos.</p>
            </div>
            {cursos.length > 0 && (
              <button className="vx-btn vx-btn-sm" onClick={() => setPreview(true)} style={{ gap: 6, whiteSpace: "nowrap" }}>
                <Eye size={15} /> Visualizar como profissional
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cursos.map((c, i) => (
              <ModuloCard key={c.id} c={c} numero={i + 1} stats={aprend?.[c.id]} onGerenciar={() => onAbrir(c.id)}
                onEditar={() => onAbrir(c.id)} onGerarAulas={() => gerarAulasModulo(c)} onVerDesempenho={() => setAba("aprendizado")}
                podeSubir={i > 0} podeDescer={i < cursos.length - 1} onSubir={() => mover(i, -1)} onDescer={() => mover(i, 1)} />
            ))}
          </div>
          <button className="vx-btn vx-btn-sm" onClick={() => setCriar(true)} style={{ gap: 6, marginTop: 14 }}>
            <Plus size={16} /> Adicionar módulo
          </button>
        </>
      )}

      {aba === "configuracoes" && <ConfiguracoesAba cursos={cursos} onAbrir={onAbrir} />}

      {aba === "aprendizado" && <AprendizadoAba aviso={aviso} />}

      {criar && <PainelNovoModulo emp={emp} aviso={aviso} onClose={() => setCriar(false)}
        onCriado={(id, comIA) => { setCriar(false); carregar(); carregarIntel(); if (comIA) gerarAulasModulo({ id }); }}
        onAbrir={(id) => { setCriar(false); onAbrir(id); }} />}
      {gerar && <PainelGerarIA aviso={aviso} onClose={() => setGerar(false)} onGerado={aposGerar} />}
      {preview && <VisualizarProfissional emp={emp} cursos={cursos} onClose={() => setPreview(false)} />}
    </div>
  );
}

/* ---- Card horizontal "Inteligência da Academy" (compacto, §3) ---- */
function PainelInteligencia({ intel, onGerar, onRevisar, onAtualizacoes, onIrMateriais, temModulos }) {
  if (!intel) return null;
  const { fontes = 0, revisao = 0, atualizacoes = 0, modulosSemConteudo = 0 } = intel;
  // Ação contextual conforme o estado da Academy (§2).
  let btn, acao;
  if (fontes === 0) { btn = "Ir para Materiais"; acao = () => onIrMateriais?.(); }
  else if (atualizacoes > 0) { btn = "Revisar atualizações"; acao = onAtualizacoes; }
  else if (revisao > 0) { btn = "Revisar sugestões"; acao = onRevisar; }
  else if (!temModulos) { btn = "Criar estrutura com IA"; acao = onGerar; }
  else if (modulosSemConteudo > 0) { btn = "Gerar conteúdos"; acao = onGerar; }
  else { btn = "Gerar com IA"; acao = onGerar; }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: AZUL_SUAVE, borderRadius: 12, padding: "14px 18px", marginBottom: 26, flexWrap: "wrap" }}>
      <span style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Sparkles size={20} style={{ color: AZUL }} />
      </span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>Inteligência da Academy</div>
        <div style={{ fontSize: 13, color: "#3d5a73", marginTop: 1 }}>Transforme o conhecimento da sua empresa em treinamentos personalizados para seus profissionais.</div>
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 12, color: "#3d5a73", flexWrap: "wrap" }}>
          <span><b>{fontes}</b> fonte{fontes !== 1 ? "s" : ""} em Materiais</span>
          {modulosSemConteudo > 0 && <span><b>{modulosSemConteudo}</b> módulo(s) sem conteúdo</span>}
          {revisao > 0 && <span><b>{revisao}</b> aguardando revisão</span>}
          {atualizacoes > 0 && <span><b>{atualizacoes}</b> atualização(ões) sugerida(s)</span>}
        </div>
      </div>
      <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={acao} style={{ gap: 6, background: AZUL, borderColor: AZUL, whiteSpace: "nowrap" }}>{btn}</button>
    </div>
  );
}

/* ---- Sugestões de estrutura (quando a Academy ainda está vazia, §4) ---- */
const SUGESTOES_MODULOS = [
  { Icon: Building2, titulo: "Conhecendo a empresa", descricao: "Apresente sua empresa, história, posicionamento e cultura." },
  { Icon: Package, titulo: "Produtos e serviços", descricao: "Prepare seus profissionais para compreender o que sua empresa oferece." },
  { Icon: ClipboardCheck, titulo: "Processos e orientações", descricao: "Ensine os procedimentos e boas práticas necessários para executar as atividades." },
];
function SugestoesEstrutura({ onAceitar, onGerar }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#B4690E", background: "#FDF3E7", padding: "3px 9px", borderRadius: 20 }}>Sugestão de estrutura</span>
        <span style={{ fontSize: 12.5, color: "#737373" }}>Modelos editáveis — nada é publicado automaticamente.</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SUGESTOES_MODULOS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#F8F9FB", border: `1px dashed ${BORDA}`, borderRadius: 12, padding: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#b8bcc4", width: 24, textAlign: "center" }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ width: 38, height: 38, borderRadius: 9, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><s.Icon size={19} style={{ color: AZUL }} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>{s.titulo}</div>
              <div style={{ fontSize: 12.5, color: "#737373" }}>{s.descricao}</div>
            </div>
            <button className="vx-btn vx-btn-sm" onClick={() => onAceitar(s)} style={{ gap: 6, whiteSpace: "nowrap" }}><Plus size={14} /> Usar módulo</button>
          </div>
        ))}
      </div>
      <button className="vx-btn vx-btn-sm" onClick={onGerar} style={{ gap: 6, marginTop: 10, borderStyle: "dashed" }}>
        <Sparkles size={14} /> Gerar estrutura personalizada com IA
      </button>
    </div>
  );
}

/* ---- Card horizontal de módulo (treinamento) na aba Minha Academy, §5 ---- */
function statusModulo(c) {
  if ((c.aulas || 0) === 0 && c.status === "rascunho") return { txt: "Não configurado", bg: "#F3F4F6", cor: "#6B7280" };
  return STATUS_BADGE[c.status] || STATUS_BADGE.rascunho;
}
const AULAS_DEMO = [
  { Icon: Type, titulo: "Conteúdo em texto", desc: "Espaço para explicações, informações e orientações." },
  { Icon: Video, titulo: "Vídeo ou apresentação", desc: "Espaço para conteúdos audiovisuais." },
  { Icon: Check, titulo: "Avaliação", desc: "Espaço para verificar o conhecimento adquirido." },
];
function ModuloCard({ c, numero, stats, onGerenciar, onEditar, onGerarAulas, onVerDesempenho, podeSubir, podeDescer, onSubir, onDescer }) {
  const [aberto, setAberto] = useState(false);
  const [aulas, setAulas] = useState(null);
  const st = statusModulo(c);
  const publicadoComDados = c.status === "publicado" && stats && stats.elegiveis > 0;
  const expandir = async () => {
    const novo = !aberto; setAberto(novo);
    if (novo && aulas === null) {
      const r = await api(`/academy/empresa/cursos/${c.id}`);
      setAulas((r?.curso?.modulos || []).flatMap((m) => m.aulas || []));
    }
  };
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16 }}>
        {/* Reordenar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#c5c9d0" }}>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onSubir} disabled={!podeSubir} style={{ padding: 0, height: 16 }} title="Subir"><ChevronUp size={14} /></button>
          <GripVertical size={14} />
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onDescer} disabled={!podeDescer} style={{ padding: 0, height: 16 }} title="Descer"><ChevronDown size={14} /></button>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#b8bcc4", width: 26, textAlign: "center", flexShrink: 0 }}>{String(numero).padStart(2, "0")}</span>
        <span style={{ width: 42, height: 42, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {c.origem === "ia" ? <Sparkles size={20} style={{ color: AZUL }} /> : <BookOpen size={20} style={{ color: AZUL }} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</div>
          <div style={{ fontSize: 12.5, color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.descricao || "Sem descrição."}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 5, fontSize: 12, color: "#9aa0a6", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><BookOpen size={12} /> {c.aulas} aula{c.aulas !== 1 ? "s" : ""}</span>
            {c.duracaoMin > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {duracaoTxt(c.duracaoMin)}</span>}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.cor, flexShrink: 0, whiteSpace: "nowrap" }}>{st.txt}</span>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={expandir} style={{ padding: 6 }} title={aberto ? "Recolher" : "Expandir"}>
          {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onGerenciar} style={{ gap: 4, background: AZUL, borderColor: AZUL, whiteSpace: "nowrap" }}>
          Gerenciar <ChevronRight size={15} />
        </button>
      </div>

      {/* Indicadores compactos quando publicado com elegíveis (§10) */}
      {publicadoComDados && (
        <div style={{ padding: "0 16px 14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#737373" }}>{stats.elegiveis} elegíveis · {stats.iniciaram} iniciaram · {stats.concluiram} concluíram</div>
          <div style={{ flex: 1, minWidth: 120, height: 6, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${stats.pct}%`, background: AZUL, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: AZUL }}>{stats.pct}%</span>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onVerDesempenho} style={{ fontSize: 12 }}>Ver desempenho</button>
        </div>
      )}

      {aberto && (
        <div style={{ borderTop: `1px solid ${BORDA}`, padding: "14px 16px", background: "#F8F9FB" }}>
          {/* Cabeçalho interno + ações */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, color: "#737373" }}>{c.descricao || "Sem descrição."}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onEditar} style={{ gap: 5 }}><Pencil size={14} /> Editar módulo</button>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onGerarAulas} style={{ gap: 5, color: AZUL }}><Sparkles size={14} /> Gerar aulas com IA</button>
              <button className="vx-btn vx-btn-sm" onClick={onGerenciar} style={{ gap: 5 }}><Plus size={14} /> Adicionar aula</button>
            </div>
          </div>

          {aulas === null ? (
            <div style={{ fontSize: 13, color: "#9aa0a6" }}>Carregando...</div>
          ) : aulas.length === 0 ? (
            <>
              <div style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 8 }}>Prévia de como você poderá organizar o conteúdo — nada é criado automaticamente.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {AULAS_DEMO.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: `1px dashed ${BORDA}`, borderRadius: 10, background: "#fff", opacity: 0.85 }}>
                    <span style={{ fontSize: 12, color: "#c5c9d0", width: 24 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}><a.Icon size={15} style={{ color: "#9aa0a6" }} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#737373" }}>Aula {String(i + 1).padStart(2, "0")} — {a.titulo}</div>
                      <div style={{ fontSize: 12, color: "#9aa0a6" }}>{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {aulas.map((a, i) => {
                const T = TIPO_DE(a.tipo); const Ic = T.Icon;
                return (
                  <div key={a.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: `1px solid ${BORDA}`, borderRadius: 10, background: "#fff" }}>
                    <span style={{ fontSize: 12, color: "#9aa0a6", width: 24 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic size={15} style={{ color: AZUL }} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</div>
                      <div style={{ fontSize: 11.5, color: "#9aa0a6" }}>{T.label}{a.duracaoMin ? ` · ${a.duracaoMin} min` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Aba Configurações: regras gerais da Academy (§13) ---- */
function ConfiguracoesAba({ cursos, onAbrir }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { api("/academy/empresa/config").then((r) => setCfg(r?.config || {})); }, []);
  const toggle = async (campo) => {
    const novo = { ...cfg, [campo]: !cfg[campo] };
    setCfg(novo);
    await apiPut("/academy/empresa/config", { [campo]: novo[campo] });
  };
  const publicados = cursos.filter((c) => c.status === "publicado").length;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Configurações da Academy</h2>
        <p style={{ color: "#737373", margin: "2px 0 0", fontSize: 13 }}>Defina as regras gerais de aprendizagem, obrigatoriedade, avaliações e acesso.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Sequência de aprendizagem — regra real persistida */}
        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>Sequência de aprendizagem</div>
            <div style={{ fontSize: 13, color: "#737373", marginTop: 2 }}>Exigir que os profissionais concluam os módulos na ordem definida na jornada.</div>
          </div>
          {cfg === null ? <div className="vx-spinner" style={{ width: 20, height: 20 }} /> : (
            <button onClick={() => toggle("sequenciaObrigatoria")} aria-pressed={cfg.sequenciaObrigatoria}
              style={{ width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: cfg.sequenciaObrigatoria ? AZUL : "#D5D8DD", position: "relative", flexShrink: 0, transition: "background .15s" }}>
              <span style={{ position: "absolute", top: 3, left: cfg.sequenciaObrigatoria ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .15s" }} />
            </button>
          )}
        </div>

        {/* Regras aplicadas na publicação de cada módulo */}
        <CardRegra titulo="Módulos obrigatórios e avaliações"
          desc="A obrigatoriedade, a ativação de avaliação e a nota mínima são definidas ao publicar cada módulo." />
        <CardRegra titulo="Acesso por campanha"
          desc="Cada módulo é disponibilizado às campanhas escolhidas na publicação; só profissionais aprovados na campanha têm acesso." />
        <CardRegra titulo="Disponibilização e publicação"
          desc={`${publicados} módulo(s) publicado(s). Conteúdos gerados por IA passam por revisão antes de publicar — nada vai ao ar automaticamente.`} />
      </div>

      {cursos.length > 0 && (
        <p style={{ fontSize: 12.5, color: "#9aa0a6", marginTop: 16 }}>
          Para ajustar a publicação de um módulo, abra-o em <b>Minha Academy → Gerenciar → Publicação</b>.
        </p>
      )}
    </div>
  );
}
function CardRegra({ titulo, desc }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>{titulo}</div>
      <div style={{ fontSize: 13, color: "#737373", marginTop: 2 }}>{desc}</div>
    </div>
  );
}

/* ---- Painel lateral: novo módulo (§7) ---- */
function PainelNovoModulo({ aviso, onClose, onCriado, onAbrir }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const criar = async (comIA) => {
    if (!titulo.trim()) return aviso?.("Dê um nome ao módulo.");
    setSalvando(true);
    const r = await api("/academy/empresa/cursos", { titulo: titulo.trim(), descricao: descricao.trim() });
    setSalvando(false);
    if (r?.error) return aviso?.(r.error);
    const id = r.curso?.id;
    if (comIA) onCriado(id, true); else onAbrir(id);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vx-fade" style={{ background: "#fff", width: "100%", maxWidth: 440, height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDA}` }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Novo módulo</div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <label className="vx-label">Nome do módulo</label>
          <input className="vx-input" autoFocus placeholder="Ex.: Conhecendo a empresa" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ marginBottom: 14 }} />
          <label className="vx-label">Objetivo ou descrição <span style={{ color: "#9aa0a6", fontWeight: 400 }}>(opcional)</span></label>
          <textarea className="vx-input" placeholder="O que os profissionais vão aprender neste módulo." value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} style={{ resize: "vertical" }} />
        </div>
        <div style={{ borderTop: `1px solid ${BORDA}`, padding: "14px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="vx-btn vx-btn-sm" onClick={() => criar(true)} disabled={salvando} style={{ gap: 6 }}><Sparkles size={15} /> Criar com IA</button>
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => criar(false)} disabled={salvando} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>{salvando ? "Criando..." : "Criar módulo"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Prévia "Visualizar como profissional" (§9) — somente leitura ---- */
function VisualizarProfissional({ emp, cursos, onClose }) {
  const visiveis = cursos.filter((c) => c.status !== "arquivado");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#F8F9FB", borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 20px", borderBottom: `1px solid ${BORDA}`, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#737373" }}><Eye size={15} /> Prévia da experiência do profissional</div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#9aa0a6" }}>{emp?.nome || "Sua empresa"}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "2px 0 0" }}>Seus treinamentos</h2>
            <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 0" }}>Continue aprendendo para evoluir na sua jornada.</p>
          </div>
          {visiveis.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9aa0a6", fontSize: 13 }}>Nenhum treinamento disponível ainda.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visiveis.map((c, i) => {
                const publicado = c.status === "publicado";
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, opacity: publicado ? 1 : 0.6 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#b8bcc4", width: 26, textAlign: "center" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ width: 42, height: 42, borderRadius: 10, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}><GraduationCap size={20} style={{ color: AZUL }} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#171717" }}>{c.titulo}</div>
                      <div style={{ fontSize: 12.5, color: "#737373" }}>
                        {c.aulas === 0 ? "Conteúdo em breve" : `${c.aulas} aula${c.aulas !== 1 ? "s" : ""}`}
                        {!publicado && " · ainda não publicado"}
                      </div>
                    </div>
                    <button className="vx-btn vx-btn-primary vx-btn-sm" disabled style={{ background: AZUL, borderColor: AZUL, opacity: 0.7, cursor: "default" }}>Começar</button>
                  </div>
                );
              })}
            </div>
          )}
          <p style={{ fontSize: 11.5, color: "#9aa0a6", textAlign: "center", marginTop: 20 }}>Prévia somente leitura — nenhuma ação aqui gera progresso real.</p>
        </div>
      </div>
    </div>
  );
}

/* ---- Aba Aprendizado: indicadores reais + desempenho por módulo (§11, §12) ---- */
function AprendizadoAba({ aviso }) {
  const [dados, setDados] = useState(null);
  useEffect(() => { api("/academy/empresa/aprendizado").then((r) => { if (r && !r.error) setDados(r); else { aviso?.(r?.error); setDados({ indicadores: {}, modulos: [] }); } }); }, []);
  if (!dados) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" style={{ margin: "0 auto" }} /></div>;
  const ind = dados.indicadores || {};
  const cards = [
    { label: "Profissionais aprovados", valor: ind.aprovados || 0 },
    { label: "Iniciaram a Academy", valor: ind.iniciaram || 0 },
    { label: "Concluíram a jornada", valor: ind.concluiram || 0 },
    { label: "Progresso médio", valor: `${ind.progressoMedio || 0}%` },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Aprendizado dos profissionais</h2>
        <p style={{ color: "#737373", margin: "2px 0 0", fontSize: 13 }}>Acompanhe como os profissionais estão consumindo os treinamentos da sua empresa.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 28 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px" }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#171717", marginTop: 6 }}>{c.valor}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Desempenho por módulo</h3>
      {(!dados.modulos || dados.modulos.length === 0) ? (
        <div style={{ textAlign: "center", padding: "32px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12, fontSize: 13.5, color: "#737373" }}>
          Ainda não há módulos com dados de participação. Publique um módulo e vincule-o a uma campanha para acompanhar o desempenho.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dados.modulos.map((m) => (
            <div key={m.id} style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>{m.titulo}</div>
                <div style={{ fontSize: 12.5, color: "#737373" }}>{m.elegiveis} elegíve{m.elegiveis !== 1 ? "is" : "l"} · {m.iniciaram} iniciaram · {m.concluiram} concluíram</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${m.pct}%`, borderRadius: 999, background: AZUL, transition: "width .4s" }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: AZUL, width: 42, textAlign: "right" }}>{m.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardCurso({ c, onAbrir, menu, setMenu, onAcao }) {
  const badge = STATUS_BADGE[c.status] || STATUS_BADGE.rascunho;
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [menu]);
  const capaImg = /^https?:|^data:/.test(c.capa || "") ? c.capa : null;
  const origem = c.origem || "manual";
  const revisao = c.status === "revisao";
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Capa 16:9 */}
      <div style={{ aspectRatio: "16 / 9", background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {capaImg ? <img src={capaImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <GraduationCap size={40} strokeWidth={1.3} style={{ color: AZUL }} />}
        <span style={{ position: "absolute", top: 10, left: 10, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.cor }}>{badge.txt}</span>
      </div>
      {/* Corpo */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: origem === "ia" ? AZUL : "#9aa0a6", marginBottom: 6 }}>
          {origem === "ia" ? <Sparkles size={12} /> : <Pencil size={11} />} {ORIGEM_LABEL[origem]}
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#171717" }}>{c.titulo}</h3>
        <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 10px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 36 }}>{c.descricao || "Sem descrição."}</p>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#737373", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Layers size={13} /> {c.modulos} mód.</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><BookOpen size={13} /> {c.aulas} aulas</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> {duracaoTxt(c.duracaoMin)}</span>
          {c.profissionais > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={13} /> {c.profissionais}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center" }}>
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => onAbrir(c.id)} style={{ flex: 1, gap: 6, background: AZUL, borderColor: AZUL }}>
            {revisao ? "Revisar e publicar" : c.status === "publicado" ? "Gerenciar" : "Abrir"}
          </button>
          <div style={{ position: "relative" }} ref={ref}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setMenu(!menu)} style={{ padding: 6 }}><MoreVertical size={16} /></button>
            {menu && (
              <div style={{ position: "absolute", right: 0, bottom: 34, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, padding: 4, minWidth: 150, zIndex: 20, boxShadow: "var(--shadow-pop)" }}>
                <MenuBtn icon={Pencil} label={revisao ? "Revisar" : "Editar"} onClick={() => onAcao("editar")} />
                <MenuBtn icon={Copy} label="Duplicar" onClick={() => onAcao("duplicar")} />
                {c.status !== "arquivado" && <MenuBtn icon={Archive} label="Arquivar" onClick={() => onAcao("arquivar")} />}
                <MenuBtn icon={Trash2} label="Excluir" danger onClick={() => onAcao("excluir")} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 13, background: "none", border: "none", cursor: "pointer", borderRadius: 6, color: danger ? "var(--red)" : "#171717" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
      <Icon size={15} /> {label}
    </button>
  );
}

function EstadoVazio({ onCriar, onGerar }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
      <span style={{ width: 48, height: 48, borderRadius: 12, background: AZUL_SUAVE, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <GraduationCap size={24} style={{ color: AZUL }} />
      </span>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Comece a capacitar seus profissionais</h3>
      <p style={{ fontSize: 13.5, color: "#737373", margin: "0 0 16px", maxWidth: 440, marginInline: "auto" }}>Utilize os materiais da sua empresa para gerar treinamentos ou crie seu próprio conteúdo.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onGerar} style={{ gap: 6, background: AZUL, borderColor: AZUL }}><Sparkles size={16} /> Gerar com IA</button>
        <button className="vx-btn vx-btn-sm" onClick={onCriar} style={{ gap: 6 }}><Plus size={16} /> Criar manualmente</button>
      </div>
    </div>
  );
}

/* ============================ PAINEL GERAR COM IA ============================ */
function PainelGerarIA({ aviso, onClose, onGerado }) {
  const [etapa, setEtapa] = useState("fontes"); // fontes | analisando | sugestoes | gerando
  const [fontes, setFontes] = useState(null);
  const [sel, setSel] = useState(() => new Set());        // ids de fontes marcadas
  const [sugestoes, setSugestoes] = useState([]);
  const [motor, setMotor] = useState("");
  const [selSug, setSelSug] = useState(() => new Set());  // índices de sugestões marcadas

  useEffect(() => {
    api("/academy/empresa/fontes").then((r) => {
      if (r?.fontes) { setFontes(r); setSel(new Set(r.fontes.map((f) => f.id))); }
      else setFontes({ fontes: [], grupos: {}, total: 0 });
    });
  }, []);

  const toggleFonte = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const analisar = async () => {
    setEtapa("analisando");
    const r = await api("/academy/empresa/ia/sugestoes", { fonteIds: [...sel] });
    if (r?.error || !r) { aviso?.(r?.error || "Não foi possível analisar agora."); setEtapa("fontes"); return; }
    setSugestoes(r.sugestoes || []); setMotor(r.motor || "");
    setSelSug(new Set((r.sugestoes || []).map((_, i) => i)));
    setEtapa("sugestoes");
  };

  const gerar = async () => {
    const escolhidas = sugestoes.filter((_, i) => selSug.has(i));
    if (!escolhidas.length) return aviso?.("Selecione ao menos uma sugestão.");
    setEtapa("gerando");
    const r = await api("/academy/empresa/ia/gerar", { sugestoes: escolhidas });
    if (r?.error || !r?.ok) { aviso?.(r?.error || "Falha ao gerar treinamentos."); setEtapa("sugestoes"); return; }
    onGerado(r.cursoIds || []);
  };

  const toggleSug = (i) => setSelSug((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const grupos = fontes ? Object.entries(fontes.grupos || {}) : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vx-fade" style={{ background: "#fff", width: "100%", maxWidth: 520, height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${BORDA}` }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={18} style={{ color: AZUL }} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Gerar com IA</div>
            <div style={{ fontSize: 12.5, color: "#737373" }}>Transforme as informações da empresa em treinamentos.</div>
          </div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* ETAPA 1 — FONTES */}
          {(etapa === "fontes" || etapa === "analisando") && (
            !fontes ? <div style={{ textAlign: "center", padding: 30 }}><div className="vx-spinner" style={{ margin: "0 auto" }} /></div>
            : fontes.total === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
                <FolderOpen size={32} strokeWidth={1.3} style={{ color: "#737373", marginBottom: 10 }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Nenhuma fonte disponível ainda</h3>
                <p style={{ fontSize: 13, color: "#737373", margin: 0 }}>Adicione informações ou arquivos em <b>Materiais</b> para a IA analisar.</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#737373", marginBottom: 14 }}>
                  <b style={{ color: "#171717" }}>{fontes.total}</b> fonte(s) disponível(is). Escolha o que a IA pode usar — por padrão, tudo está selecionado.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {grupos.map(([grupo]) => {
                    const doGrupo = fontes.fontes.filter((f) => f.grupo === grupo);
                    return (
                      <div key={grupo}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>{grupo}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {doGrupo.map((f) => (
                            <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "5px 8px", border: `1px solid ${BORDA}`, borderRadius: 8 }}>
                              <input type="checkbox" checked={sel.has(f.id)} onChange={() => toggleFonte(f.id)} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.titulo}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}

          {/* ETAPA 2 — SUGESTÕES */}
          {(etapa === "sugestoes" || etapa === "gerando") && (
            <>
              <div style={{ fontSize: 13, color: "#737373", marginBottom: 14 }}>
                A IA propôs <b style={{ color: "#171717" }}>{sugestoes.length}</b> treinamento(s) com base nas suas fontes. Selecione quais deseja gerar.
                {motor === "deterministico" && <div style={{ marginTop: 4, fontSize: 12, color: "#9aa0a6" }}>Montados a partir das informações cadastradas.</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sugestoes.map((s, i) => (
                  <label key={i} style={{ display: "flex", gap: 10, padding: 14, border: `1.5px solid ${selSug.has(i) ? AZUL : BORDA}`, borderRadius: 12, cursor: "pointer", background: selSug.has(i) ? AZUL_SUAVE : "#fff" }}>
                    <input type="checkbox" checked={selSug.has(i)} onChange={() => toggleSug(i)} style={{ marginTop: 3 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#171717" }}>{s.titulo}</div>
                      {s.objetivo && <div style={{ fontSize: 12.5, color: "#3d5a73", marginTop: 2 }}>{s.objetivo}</div>}
                      {s.resumo && <div style={{ fontSize: 12.5, color: "#737373", marginTop: 4 }}>{s.resumo}</div>}
                      {s.estrutura?.length > 0 && (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#737373" }}>
                          {s.estrutura.slice(0, 5).map((m, k) => <li key={k}>{m}</li>)}
                        </ul>
                      )}
                      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, color: "#9aa0a6", flexWrap: "wrap" }}>
                        {s.fontes?.length > 0 && <span>{s.fontes.length} fonte(s)</span>}
                        {s.ausencias?.length > 0 && <span style={{ color: "#B4690E" }}>{s.ausencias.length} informação(ões) ausente(s)</span>}
                      </div>
                    </div>
                  </label>
                ))}
                {sugestoes.length === 0 && <div style={{ fontSize: 13, color: "#737373", textAlign: "center", padding: 20 }}>Não foi possível propor treinamentos com as fontes selecionadas.</div>}
              </div>
            </>
          )}
        </div>

        {/* Rodapé de ação */}
        <div style={{ borderTop: `1px solid ${BORDA}`, padding: "14px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {(etapa === "fontes" || etapa === "analisando") && fontes?.total > 0 && (
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={analisar} disabled={etapa === "analisando" || sel.size === 0} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
              {etapa === "analisando" ? <><Loader2 size={15} style={{ animation: "spin .7s linear infinite" }} /> Analisando materiais...</> : <><Sparkles size={15} /> Analisar materiais</>}
            </button>
          )}
          {(etapa === "sugestoes" || etapa === "gerando") && (
            <>
              <button className="vx-btn vx-btn-sm" onClick={() => setEtapa("fontes")} disabled={etapa === "gerando"}>Voltar</button>
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={gerar} disabled={etapa === "gerando" || selSug.size === 0} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
                {etapa === "gerando" ? <><Loader2 size={15} style={{ animation: "spin .7s linear infinite" }} /> Gerando...</> : <>Gerar {selSug.size > 0 ? selSug.size : ""} treinamento(s)</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ MODAL CRIAR ============================ */
function ModalCriar({ onClose, onCriado, aviso }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const criar = async () => {
    if (!titulo.trim()) return aviso?.("Dê um nome ao treinamento.");
    setSalvando(true);
    const r = await api("/academy/empresa/cursos", { titulo: titulo.trim(), descricao: descricao.trim() });
    setSalvando(false);
    if (r?.error) return aviso?.(r.error);
    onCriado(r.curso.id);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 520, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Criar treinamento</h2>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: "#737373", margin: "0 0 18px" }}>Comece com o essencial. Você adiciona módulos e aulas no próximo passo.</p>
        <label className="vx-label">Nome do treinamento</label>
        <input className="vx-input" autoFocus placeholder="Ex.: Conhecendo nossos produtos" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ marginBottom: 14 }} onKeyDown={(e) => { if (e.key === "Enter") criar(); }} />
        <label className="vx-label">Descrição <span style={{ color: "#9aa0a6", fontWeight: 400 }}>(opcional)</span></label>
        <textarea className="vx-input" placeholder="Explique brevemente o que o profissional aprenderá." value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} style={{ resize: "vertical", marginBottom: 18 }} />
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={criar} disabled={salvando} style={{ width: "100%", gap: 6, background: AZUL, borderColor: AZUL }}>{salvando ? "Criando..." : "Continuar"}</button>
      </div>
    </div>
  );
}

/* ============================ BUILDER ============================ */
function Builder({ cursoId, emp, db, aviso, onVoltar }) {
  const [curso, setCurso] = useState(null);
  const [aba, setAba] = useState("conteudo"); // conteudo | publicacao
  const [aulaEdit, setAulaEdit] = useState(null); // { ...aula, moduleId }
  const [salvandoTitulo, setSalvandoTitulo] = useState("");
  const [materiaisLib, setMateriaisLib] = useState([]);

  const carregar = useCallback(async () => {
    const r = await api(`/academy/empresa/cursos/${cursoId}`);
    if (r?.curso) setCurso(r.curso);
    else { aviso?.(r?.error || "Treinamento não encontrado."); onVoltar(); }
  }, [cursoId]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { api("/materiais").then((r) => { if (r?.materiais) setMateriaisLib(r.materiais); }); }, []);

  const recarregarLeve = async () => { const r = await api(`/academy/empresa/cursos/${cursoId}`); if (r?.curso) setCurso(r.curso); };

  if (!curso) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  const badge = STATUS_BADGE[curso.status] || STATUS_BADGE.rascunho;

  const salvarTitulo = async (titulo) => {
    if (titulo === curso.titulo) return;
    setSalvandoTitulo("Salvando...");
    const r = await apiPatch(`/academy/empresa/cursos/${curso.id}`, { titulo });
    setSalvandoTitulo(r?.error ? "Erro ao salvar" : "Salvo");
    if (r?.curso) setCurso((c) => ({ ...c, titulo: r.curso.titulo }));
    setTimeout(() => setSalvandoTitulo(""), 1500);
  };

  return (
    <div className="vx-fade">
      {/* Breadcrumb + topo */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#737373", marginBottom: 14 }}>
        <button onClick={onVoltar} style={{ background: "none", border: "none", color: AZUL, cursor: "pointer", padding: 0, fontSize: 13 }}>Academy</button>
        <ChevronRight size={14} />
        <span style={{ color: "#171717", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>{curso.titulo}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button onClick={onVoltar} className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 6 }}><ArrowLeft size={18} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <TituloEditavel valor={curso.titulo} onSalvar={salvarTitulo} />
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.cor, flexShrink: 0 }}>{badge.txt}</span>
              {salvandoTitulo && <span style={{ fontSize: 12, color: "#9aa0a6" }}>{salvandoTitulo}</span>}
            </div>
            <div style={{ fontSize: 13, color: "#737373", marginTop: 2 }}>{curso.modulos.length} módulos · {curso.totalAulas} aulas · {duracaoTxt(curso.duracaoMin)}</div>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDA}`, marginBottom: 20 }}>
        {[["conteudo", "Conteúdo"], ["publicacao", "Publicação"]].map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)} style={{ padding: "9px 18px", fontSize: 14, fontWeight: aba === k ? 600 : 400, color: aba === k ? AZUL : "#737373", background: "none", border: "none", borderBottom: aba === k ? `2px solid ${AZUL}` : "2px solid transparent", cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {aba === "conteudo" ? (
        <Conteudo curso={curso} setCurso={setCurso} aviso={aviso} onAbrirAula={setAulaEdit} recarregar={recarregarLeve} />
      ) : (
        <Publicacao curso={curso} emp={emp} db={db} aviso={aviso} recarregar={carregar} />
      )}

      {aulaEdit && (
        <EditorAula aula={aulaEdit} materiaisLib={materiaisLib} aviso={aviso}
          onClose={() => setAulaEdit(null)}
          onSalvo={(a) => { setAulaEdit(null); recarregarLeve(); }} />
      )}
    </div>
  );
}

function TituloEditavel({ valor, onSalvar }) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSalvar(v.trim() || valor)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={{ fontSize: 19, fontWeight: 700, border: "1px solid transparent", borderRadius: 8, padding: "2px 6px", margin: "-2px -6px", background: "transparent", color: "#171717", maxWidth: 420, minWidth: 100 }}
      onFocus={(e) => { e.currentTarget.style.borderColor = BORDA; e.currentTarget.style.background = "#fff"; }}
      onBlurCapture={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }} />
  );
}

/* ---------------------------- Conteúdo (módulos/aulas) ---------------------------- */
function Conteudo({ curso, setCurso, aviso, onAbrirAula, recarregar }) {
  const [abertos, setAbertos] = useState(() => new Set(curso.modulos.map((m) => m.id)));
  const [dragMod, setDragMod] = useState(null);
  const [dragAula, setDragAula] = useState(null);

  const toggle = (id) => setAbertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addModulo = async () => {
    const r = await api(`/academy/empresa/cursos/${curso.id}/modulos`, {});
    if (r?.error) return aviso?.(r.error);
    recarregar();
  };
  const renomearModulo = async (mid, titulo) => { await apiPatch(`/academy/empresa/modulos/${mid}`, { titulo }); recarregar(); };
  const excluirModulo = async (m) => {
    if (!confirm(`Excluir o módulo "${m.titulo}" e suas aulas?`)) return;
    await apiDelete(`/academy/empresa/modulos/${m.id}`); recarregar();
  };
  const addAula = async (mid) => {
    const r = await api(`/academy/empresa/modulos/${mid}/aulas`, { titulo: "Nova aula", tipo: "texto" });
    if (r?.error) return aviso?.(r.error);
    recarregar();
    setTimeout(() => onAbrirAula({ ...r.aula, moduleId: mid }), 100);
  };
  const excluirAula = async (a) => { if (!confirm(`Excluir a aula "${a.titulo}"?`)) return; await apiDelete(`/academy/empresa/aulas/${a.id}`); recarregar(); };

  // Reordenar módulos
  const soltarModulo = async (destino) => {
    if (!dragMod || dragMod === destino) return setDragMod(null);
    const ids = curso.modulos.map((m) => m.id);
    const from = ids.indexOf(dragMod), to = ids.indexOf(destino);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragMod(null);
    await apiPut(`/academy/empresa/cursos/${curso.id}/modulos/ordem`, { ids });
    recarregar();
  };
  // Reordenar aulas dentro do módulo
  const soltarAula = async (mid, destinoId) => {
    if (!dragAula || dragAula.mid !== mid || dragAula.id === destinoId) return setDragAula(null);
    const mod = curso.modulos.find((m) => m.id === mid);
    const ids = mod.aulas.map((a) => a.id);
    const from = ids.indexOf(dragAula.id), to = ids.indexOf(destinoId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragAula(null);
    await apiPut(`/academy/empresa/modulos/${mid}/aulas/ordem`, { ids });
    recarregar();
  };

  return (
    <div style={{ maxWidth: 820 }}>
      {curso.modulos.map((m) => {
        const aberto = abertos.has(m.id);
        return (
          <div key={m.id} draggable onDragStart={() => setDragMod(m.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => soltarModulo(m.id)}
            style={{ border: `1px solid ${BORDA}`, borderRadius: 12, marginBottom: 12, background: "#fff", opacity: dragMod === m.id ? 0.5 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px" }}>
              <GripVertical size={16} style={{ color: "#c0c4ca", cursor: "grab", flexShrink: 0 }} />
              <button onClick={() => toggle(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#737373" }}><ChevronDown size={18} style={{ transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .15s" }} /></button>
              <TituloModulo valor={m.titulo} onSalvar={(t) => renomearModulo(m.id, t)} />
              <span style={{ fontSize: 12, color: "#9aa0a6", marginLeft: 4 }}>{m.aulas.length} {m.aulas.length === 1 ? "aula" : "aulas"}</span>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => excluirModulo(m)} style={{ marginLeft: "auto", padding: 5, color: "var(--red)" }} title="Excluir módulo"><Trash2 size={15} /></button>
            </div>
            {aberto && (
              <div style={{ padding: "0 14px 12px 40px" }}>
                {m.aulas.map((a) => {
                  const T = TIPO_DE(a.tipo);
                  return (
                    <div key={a.id} draggable onDragStart={(e) => { e.stopPropagation(); setDragAula({ mid: m.id, id: a.id }); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); soltarAula(m.id, a.id); }}
                      onClick={() => onAbrirAula({ ...a, moduleId: m.id })}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: `1px solid ${BORDA}`, marginBottom: 6, cursor: "pointer", background: "#fff" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"} onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}>
                      <GripVertical size={14} style={{ color: "#c0c4ca", cursor: "grab", flexShrink: 0 }} onClick={(e) => e.stopPropagation()} />
                      <span style={{ width: 28, height: 28, borderRadius: 7, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><T.Icon size={15} style={{ color: AZUL }} /></span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</span>
                      <span style={{ fontSize: 12, color: "#9aa0a6" }}>{T.label}{a.duracaoMin ? ` · ${a.duracaoMin}min` : ""}</span>
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={(e) => { e.stopPropagation(); excluirAula(a); }} style={{ padding: 4, color: "var(--red)" }}><Trash2 size={14} /></button>
                    </div>
                  );
                })}
                <button onClick={() => addAula(m.id)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: AZUL, background: "none", border: `1px dashed ${BORDA}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", width: "100%", justifyContent: "center", marginTop: 2 }}><Plus size={15} /> Adicionar aula</button>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={addModulo} className="vx-btn vx-btn-sm" style={{ gap: 6 }}><Plus size={16} /> Adicionar módulo</button>
    </div>
  );
}

function TituloModulo({ valor, onSalvar }) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={() => { if (v.trim() && v !== valor) onSalvar(v.trim()); else setV(valor); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={{ fontSize: 14, fontWeight: 600, border: "1px solid transparent", borderRadius: 6, padding: "3px 6px", background: "transparent", color: "#171717", minWidth: 120, maxWidth: 300 }}
      onFocus={(e) => { e.currentTarget.style.borderColor = BORDA; e.currentTarget.style.background = "#fff"; }} />
  );
}

/* ---------------------------- Editor de aula ---------------------------- */
function EditorAula({ aula, materiaisLib, aviso, onClose, onSalvo }) {
  const [titulo, setTitulo] = useState(aula.titulo);
  const [tipo, setTipo] = useState(aula.tipo || "texto");
  const [conteudo, setConteudo] = useState(aula.conteudo || "");
  const [videoUrl, setVideoUrl] = useState(aula.videoUrl || "");
  const [materiais, setMateriais] = useState(aula.materiais || []);
  const [duracaoMin, setDuracaoMin] = useState(aula.duracaoMin || 0);
  const [estado, setEstado] = useState(""); // "", Salvando..., Salvo, Erro
  const [picker, setPicker] = useState(null); // categoria para escolher material principal / "apoio"
  const primeiro = useRef(true);

  // Salvamento automático (debounce) ao editar qualquer campo.
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    setEstado("Salvando...");
    const t = setTimeout(async () => {
      const r = await apiPatch(`/academy/empresa/aulas/${aula.id}`, { titulo, tipo, conteudo, videoUrl, materiais, duracaoMin });
      setEstado(r?.error ? "Erro ao salvar" : "Salvo");
      setTimeout(() => setEstado(""), 1500);
    }, 700);
    return () => clearTimeout(t);
  }, [titulo, tipo, conteudo, videoUrl, materiais, duracaoMin]);

  const T = TIPO_DE(tipo);
  const principal = materiais.find((x) => x.papel === "principal");
  const apoio = materiais.filter((x) => x.papel !== "principal");

  const escolherPrincipal = (m) => {
    setMateriais((prev) => [{ id: m.id, nome: m.nome, categoria: m.categoria, papel: "principal" }, ...prev.filter((x) => x.papel !== "principal")]);
    setPicker(null);
  };
  const addApoio = (m) => { setMateriais((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, { id: m.id, nome: m.nome, categoria: m.categoria, papel: "apoio" }]); setPicker(null); };
  const removerMaterial = (id) => setMateriais((prev) => prev.filter((x) => x.id !== id));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "min(560px, 100%)", height: "100%", background: "#fff", overflowY: "auto", padding: 24, boxShadow: "-8px 0 24px rgba(0,0,0,.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px" }}>Editar aula</span>
            {estado && <span style={{ fontSize: 12, color: estado.startsWith("Erro") ? "var(--red)" : "#9aa0a6" }}>{estado}</span>}
          </div>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>

        <label className="vx-label">Título da aula</label>
        <input className="vx-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ marginBottom: 16 }} />

        <label className="vx-label">Tipo de conteúdo</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {TIPOS_AULA.map((t) => (
            <button key={t.chave} onClick={() => setTipo(t.chave)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "7px 12px", borderRadius: 8, border: `1px solid ${tipo === t.chave ? AZUL : BORDA}`, background: tipo === t.chave ? AZUL_SUAVE : "#fff", color: tipo === t.chave ? AZUL : "#737373", cursor: "pointer", fontWeight: tipo === t.chave ? 600 : 400 }}>
              <t.Icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo por tipo */}
        {tipo === "texto" && (
          <>
            <label className="vx-label">Conteúdo</label>
            <textarea className="vx-input" value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={8} placeholder="Escreva o conteúdo da aula..." style={{ resize: "vertical", marginBottom: 16, lineHeight: 1.5 }} />
          </>
        )}
        {tipo === "link" && (
          <>
            <label className="vx-label">URL</label>
            <input className="vx-input" value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="https://" style={{ marginBottom: 16 }} />
          </>
        )}
        {(tipo === "video" || tipo === "documento" || tipo === "audio") && (
          <div style={{ marginBottom: 16 }}>
            <label className="vx-label">Conteúdo principal</label>
            {principal ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${BORDA}`, borderRadius: 8, marginBottom: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 7, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center" }}><T.Icon size={15} style={{ color: AZUL }} /></span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{principal.nome}</span>
                <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => removerMaterial(principal.id)} style={{ padding: 4 }}><X size={14} /></button>
              </div>
            ) : (
              <button className="vx-btn vx-btn-sm" onClick={() => setPicker(T.categoria || "todos")} style={{ gap: 6, marginBottom: 8 }}><FolderOpen size={15} /> Selecionar da biblioteca</button>
            )}
            {tipo === "video" && (
              <>
                <label className="vx-label" style={{ marginTop: 4 }}>Ou cole uma URL de vídeo <span style={{ color: "#9aa0a6", fontWeight: 400 }}>(YouTube, etc.)</span></label>
                <input className="vx-input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://" />
              </>
            )}
          </div>
        )}

        <label className="vx-label">Duração estimada (min)</label>
        <input className="vx-input" type="number" min="0" value={duracaoMin} onChange={(e) => setDuracaoMin(Math.max(0, Number(e.target.value) || 0))} style={{ marginBottom: 16, width: 140 }} />

        {/* Materiais de apoio */}
        <div style={{ borderTop: `1px solid ${BORDA}`, paddingTop: 16 }}>
          <label className="vx-label">Materiais de apoio <span style={{ color: "#9aa0a6", fontWeight: 400 }}>(opcional)</span></label>
          {apoio.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: `1px solid ${BORDA}`, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
              <FileText size={15} style={{ color: "#737373" }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</span>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => removerMaterial(m.id)} style={{ padding: 3 }}><X size={13} /></button>
            </div>
          ))}
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setPicker("apoio")} style={{ gap: 6, fontSize: 13 }}><Plus size={14} /> Anexar da biblioteca</button>
        </div>
      </div>

      {picker && (
        <PickerMateriais materiaisLib={materiaisLib} categoria={picker === "apoio" ? null : picker} apoio={picker === "apoio"}
          onEscolher={(m) => picker === "apoio" ? addApoio(m) : escolherPrincipal(m)} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

function PickerMateriais({ materiaisLib, categoria, apoio, onEscolher, onClose }) {
  const [busca, setBusca] = useState("");
  const itens = materiaisLib
    .filter((m) => (apoio || !categoria || categoria === "todos") ? true : m.categoria === categoria)
    .filter((m) => !busca.trim() || m.nome.toLowerCase().includes(busca.toLowerCase().trim()));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BORDA}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Escolher da biblioteca</h3>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
            <input className="vx-input" placeholder="Buscar material..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 30, height: 34, width: "100%" }} autoFocus />
          </div>
          <div style={{ overflowY: "auto", maxHeight: "50vh", display: "flex", flexDirection: "column", gap: 4 }}>
            {itens.length === 0 && <p style={{ fontSize: 13, color: "#737373", textAlign: "center", padding: 20 }}>Nenhum material disponível. Adicione na página de Materiais.</p>}
            {itens.map((m) => (
              <button key={m.id} onClick={() => onEscolher(m)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: `1px solid ${BORDA}`, borderRadius: 8, cursor: "pointer", background: "#fff", textAlign: "left" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"} onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}>
                <FileText size={15} style={{ color: "#737373" }} />
                <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome}</span>
                <span style={{ fontSize: 11, color: "#9aa0a6" }}>{m.categoria}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Publicação ---------------------------- */
function Publicacao({ curso, emp, db, aviso, recarregar }) {
  const campanhas = useMemo(() => (db.campaigns || []).filter((c) => c.companyId === emp.id), [db, emp]);
  const [sel, setSel] = useState(() => new Set((curso.campanhas || []).map((c) => c.id)));
  const [obrigatorio, setObrigatorio] = useState(() => (curso.campanhas || []).some((c) => c.obrigatorio));
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filtradas = campanhas.filter((c) => !busca.trim() || c.titulo.toLowerCase().includes(busca.toLowerCase().trim()));

  const publicar = async () => {
    setSalvando(true);
    const r = await api(`/academy/empresa/cursos/${curso.id}/publicar`, { campanhaIds: [...sel], obrigatorio });
    setSalvando(false);
    if (r?.error) return aviso?.(r.error);
    aviso?.("Treinamento publicado."); recarregar();
  };
  const salvarRascunho = async () => {
    setSalvando(true);
    const r = await api(`/academy/empresa/cursos/${curso.id}/rascunho`, {});
    setSalvando(false);
    if (r?.error) return aviso?.(r.error);
    aviso?.("Salvo como rascunho."); recarregar();
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Publicar treinamento</h3>
      <p style={{ fontSize: 13, color: "#737373", margin: "0 0 20px" }}>Escolha em quais campanhas este treinamento ficará disponível para os profissionais.</p>

      <div style={{ marginBottom: 20 }}>
        <label className="vx-label">Disponibilidade</label>
        {campanhas.length === 0 ? (
          <p style={{ fontSize: 13, color: "#737373" }}>Você ainda não tem campanhas. O treinamento pode ser publicado e vinculado depois.</p>
        ) : (
          <>
            <div style={{ position: "relative", marginBottom: 8, maxWidth: 340 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
              <input className="vx-input" placeholder="Buscar campanha..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 30, height: 34, width: "100%" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", border: `1px solid ${BORDA}`, borderRadius: 10, padding: 8 }}>
              {filtradas.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, border: `1px solid ${BORDA}`, borderRadius: 10, marginBottom: 24 }}>
        <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} style={{ marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#171717" }}>Exigir conclusão antes de executar tarefas</div>
          <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>Se ativado, o profissional precisará concluir este treinamento para executar tarefas nas campanhas selecionadas.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="vx-btn vx-btn-sm" onClick={salvarRascunho} disabled={salvando}>Salvar rascunho</button>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={publicar} disabled={salvando} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
          <Check size={16} /> {curso.status === "publicado" ? "Atualizar publicação" : "Publicar treinamento"}
        </button>
      </div>
    </div>
  );
}
