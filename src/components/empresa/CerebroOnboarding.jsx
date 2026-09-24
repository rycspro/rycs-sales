import { useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronRight, FileText, Link2, Mic, MicOff, Paperclip, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const ETAPAS = [
  { id: 1, label: "Falar", icon: "💬" },
  { id: 2, label: "Materiais", icon: "📎" },
  { id: 3, label: "Revisar", icon: "🔍" },
  { id: 4, label: "Ativar", icon: "🧠" },
];

const TIPOS_UPLOAD = [
  { ext: ["pdf"], label: "PDF", icon: "📄" },
  { ext: ["doc", "docx"], label: "Documento", icon: "📝" },
  { ext: ["ppt", "pptx"], label: "Apresentação", icon: "📊" },
  { ext: ["xls", "xlsx", "csv"], label: "Planilha", icon: "📈" },
  { ext: ["jpg", "jpeg", "png", "webp"], label: "Imagem", icon: "🖼" },
  { ext: ["mp3", "wav", "m4a", "ogg"], label: "Áudio", icon: "🎧" },
  { ext: ["mp4", "mov", "webm"], label: "Vídeo", icon: "🎥" },
];

function suportaVoz() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function usarVoz(onTranscricao) {
  const recRef = useRef(null);
  const [gravando, setGravando] = useState(false);

  const iniciar = () => {
    if (!suportaVoz()) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    let acumulado = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) acumulado += e.results[i][0].transcript + " ";
        else interim = e.results[i][0].transcript;
      }
      onTranscricao((acumulado + interim).trim());
    };
    rec.onend = () => setGravando(false);
    rec.start();
    recRef.current = rec;
    setGravando(true);
    return true;
  };

  const parar = () => {
    recRef.current?.stop();
    setGravando(false);
  };

  return { gravando, iniciar, parar };
}

// ─── Etapa 1: Perguntas ──────────────────────────────────────────────────────

function Pergunta({ pergunta, indice, total, resposta, onChange, onProxima }) {
  const [transcricao, setTranscricao] = useState(resposta || "");
  const [modoLivre, setModoLivre] = useState(false);
  const { gravando, iniciar, parar } = usarVoz((t) => {
    setTranscricao(t);
    onChange(t);
  });

  useEffect(() => {
    setTranscricao(resposta || "");
  }, [pergunta.id]);

  const toggleVoz = () => {
    if (gravando) parar();
    else {
      if (!iniciar()) {
        alert("Seu navegador não suporta gravação de voz. Use a digitação.");
      }
    }
  };

  const podeProsseguir = transcricao.trim().length >= 5;

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
        Pergunta {indice + 1} de {total}
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, lineHeight: 1.4 }}>{pergunta.texto}</h2>

      {pergunta.respostaExistente && !transcricao && (
        <div style={{ background: "var(--surface-1, #f0f4ff)", border: "1px solid var(--brand-100, #dbeafe)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <Check size={14} color="var(--brand)" />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Já temos: <strong>{String(pergunta.respostaExistente).slice(0, 80)}{String(pergunta.respostaExistente).length > 80 ? "…" : ""}</strong></span>
          <button className="vx-btn vx-btn-sm" style={{ marginLeft: "auto", fontSize: 11 }} onClick={() => { onChange(pergunta.respostaExistente); setTranscricao(pergunta.respostaExistente); }}>Usar</button>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <textarea
          className="vx-input"
          style={{ width: "100%", minHeight: 120, resize: "vertical", fontSize: 15, padding: "12px 14px", boxSizing: "border-box" }}
          placeholder={gravando ? "Ouvindo… fale à vontade" : "Digite ou use o microfone"}
          value={transcricao}
          onChange={(e) => { setTranscricao(e.target.value); onChange(e.target.value); }}
        />
        {suportaVoz() && (
          <button
            onClick={toggleVoz}
            title={gravando ? "Parar gravação" : "Falar resposta"}
            style={{ position: "absolute", right: 10, top: 10, background: gravando ? "linear-gradient(135deg,#ef4444,#dc2626)" : "var(--grad-ai,linear-gradient(135deg,#4338CA,#2563EB))", color: "#fff", border: "none", borderRadius: 10, padding: "7px 11px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, boxShadow: gravando ? "0 4px 12px -4px rgba(239,68,68,.5)" : "0 4px 12px -4px rgba(67,56,202,.4)" }}
          >
            {gravando ? (
              <><div style={{ display: "flex", gap: 2, height: 14, alignItems: "center" }}>{[0,1,2,3].map(i=><span key={i} style={{ width: 3, borderRadius: 2, background: "#fff", height: [8,14,10,12][i], animation: "vxwave 1.2s ease-in-out infinite", animationDelay: `${i*0.15}s` }}/>)}</div> Ouvindo…</>
            ) : <><Mic size={14} /> Falar</>}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {gravando && <span style={{ color: "var(--red, #ef4444)", fontWeight: 600 }}>● Gravando…</span>}
        </span>
        <button
          className="vx-btn vx-btn-primary"
          style={{ gap: 7, minWidth: 140 }}
          disabled={!podeProsseguir}
          onClick={() => onProxima(transcricao)}
        >
          {indice + 1 < total ? <>Próxima <ChevronRight size={15} /></> : <>Concluir perguntas <Check size={15} /></>}
        </button>
      </div>

      {indice === 0 && (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <button className="vx-btn vx-btn-sm" style={{ gap: 6 }} onClick={() => setModoLivre(!modoLivre)}>
            <Mic size={13} /> {modoLivre ? "Fechar modo livre" : "🎙 Falar livremente sobre minha empresa"}
          </button>
          {modoLivre && (
            <div style={{ marginTop: 12 }}>
              <p className="vx-mut" style={{ fontSize: 13, marginBottom: 8 }}>Fale tudo o que quiser sobre sua empresa. A RYCS vai organizar depois.</p>
              <FalarLivremente onSalvar={(texto) => { onChange(texto); setTranscricao(texto); setModoLivre(false); }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FalarLivremente({ onSalvar }) {
  const [texto, setTexto] = useState("");
  const { gravando, iniciar, parar } = usarVoz((t) => setTexto(t));

  return (
    <div>
      <textarea
        className="vx-input"
        style={{ width: "100%", minHeight: 140, fontSize: 14, boxSizing: "border-box" }}
        placeholder="Fale ou escreva livremente…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {suportaVoz() && (
          <button className="vx-btn vx-btn-sm" style={{ gap: 6 }} onClick={gravando ? parar : iniciar}>
            {gravando ? <><MicOff size={12} /> Parar</> : <><Mic size={12} /> Gravar</>}
          </button>
        )}
        <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={texto.trim().length < 20} onClick={() => onSalvar(texto)}>
          Usar este conteúdo
        </button>
      </div>
    </div>
  );
}

// ─── Etapa 2: Materiais ──────────────────────────────────────────────────────

function UploadMateriais({ aviso, materiais, setMateriais }) {
  const [link, setLink] = useState("");
  const [textoManual, setTextoManual] = useState("");
  const [enviando, setEnviando] = useState({});

  const uploadArquivo = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const tipo = TIPOS_UPLOAD.find((t) => t.ext.includes(ext));
    const titulo = file.name;
    setEnviando((e) => ({ ...e, [titulo]: "enviando" }));

    try {
      const base64 = await new Promise((ok) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(",")[1]);
        r.readAsDataURL(file);
      });
      const r = await api("/knowledge/import", { base64, titulo, mimetype: file.type, categoria: "material" });
      if (r?.error) { aviso(r.error); setEnviando((e) => ({ ...e, [titulo]: "erro" })); return; }
      setMateriais((m) => [...m, { id: r.id, titulo, tipo: tipo?.label || ext, status: "processado" }]);
      setEnviando((e) => ({ ...e, [titulo]: "ok" }));
      aviso(`${titulo} processado.`);
    } catch (err) {
      setEnviando((e) => ({ ...e, [titulo]: "erro" }));
      aviso("Erro ao processar arquivo.");
    }
  };

  const adicionarLink = async () => {
    if (!link.trim()) return;
    const r = await api("/knowledge", { titulo: `Link: ${link}`, conteudo: `URL: ${link}`, origem: "link", categoria: "link" });
    if (r?.error) return aviso(r.error);
    setMateriais((m) => [...m, { id: r.id, titulo: `Link: ${link}`, tipo: "Link", status: "processado" }]);
    setLink("");
    aviso("Link adicionado.");
  };

  const adicionarTexto = async () => {
    if (textoManual.trim().length < 20) return aviso("Texto muito curto.");
    const r = await api("/knowledge", { titulo: "Texto manual", conteudo: textoManual, origem: "texto", categoria: "geral" });
    if (r?.error) return aviso(r.error);
    setMateriais((m) => [...m, { id: r.id, titulo: "Texto manual", tipo: "Texto", status: "processado" }]);
    setTextoManual("");
    aviso("Texto adicionado.");
  };

  const remover = async (mat) => {
    await apiDelete(`/knowledge/${mat.id}`);
    setMateriais((m) => m.filter((x) => x.id !== mat.id));
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Envie seus materiais</h2>
      <p className="vx-mut" style={{ marginBottom: 20 }}>
        Não precisa criar nada novo. Envie o que você já usa — apresentações, scripts, propostas, vídeos.
        <br /><strong>Recomendamos de 2 a 5 materiais.</strong>
      </p>

      {/* Drag and drop */}
      <label
        style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", background: "var(--surface-1, #fafafa)", marginBottom: 16 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(uploadArquivo); }}
      >
        <input type="file" style={{ display: "none" }} multiple onChange={(e) => Array.from(e.target.files).forEach(uploadArquivo)} />
        <Upload size={28} color="var(--brand)" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Arraste arquivos ou clique para selecionar</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          PDF · DOC · PPT · XLS · JPG · PNG · MP3 · MP4 · e mais
        </span>
      </label>

      {/* Link */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input className="vx-input" style={{ flex: 1 }} placeholder="Cole um link (site, landing page, YouTube…)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionarLink()} />
        <button className="vx-btn vx-btn-sm" onClick={adicionarLink} disabled={!link.trim()}><Link2 size={14} /> Adicionar</button>
      </div>

      {/* Texto manual */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>⌨ Digitar ou colar texto</summary>
        <div style={{ marginTop: 8 }}>
          <textarea className="vx-input" style={{ width: "100%", minHeight: 100, boxSizing: "border-box", fontSize: 13 }} placeholder="Cole seu script, FAQ, proposta ou qualquer conteúdo textual…" value={textoManual} onChange={(e) => setTextoManual(e.target.value)} />
          <button className="vx-btn vx-btn-sm" style={{ marginTop: 6 }} onClick={adicionarTexto} disabled={textoManual.trim().length < 20}>Adicionar texto</button>
        </div>
      </details>

      {/* Lista */}
      {materiais.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {materiais.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-1, #f8fafc)", borderRadius: 8, padding: "9px 12px", border: "1px solid var(--border)" }}>
              <FileText size={16} color="var(--brand)" />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{m.titulo}</span>
              <span className="vx-chip" style={{ fontSize: 11 }}>{m.status === "processado" ? "✓ Processado" : enviando[m.titulo] === "enviando" ? "Enviando…" : m.status}</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} onClick={() => remover(m)}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
        {materiais.length === 0 ? "Nenhum material adicionado ainda." : `${materiais.length} material(is) adicionado(s).`}
        {materiais.length >= 2 && <span style={{ color: "var(--green, #22c55e)", marginLeft: 8 }}>✓ Bom conjunto de materiais</span>}
      </div>
    </div>
  );
}

// ─── Etapa 3: Revisão ────────────────────────────────────────────────────────

function RevisaoResumo({ resumo, onConfirmar, onEditar, organizando }) {
  const [editando, setEditando] = useState(false);
  const [edicoes, setEdicoes] = useState({});

  if (organizando) {
    return (
      <div className="vx-fade" style={{ textAlign: "center", padding: "40px 20px" }}>
        <Brain size={48} color="var(--brand)" style={{ margin: "0 auto 16px", display: "block" }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Organizando seu conhecimento…</h2>
        <p className="vx-mut">A RYCS está estruturando tudo o que você compartilhou.</p>
        <div style={{ marginTop: 20, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand)", animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }} />)}
        </div>
      </div>
    );
  }

  const campos = [
    { id: "produto", label: "Produto / Serviço" },
    { id: "clienteIdeal", label: "Cliente Ideal" },
    { id: "problema", label: "Problema Resolvido" },
    { id: "diferenciais", label: "Diferenciais" },
    { id: "objecoes", label: "Objeções" },
    { id: "processo", label: "Processo Comercial" },
    { id: "qualificacao", label: "Qualificação" },
    { id: "ticket", label: "Precificação" },
    { id: "ensinamentos", label: "Conhecimento Essencial" },
  ];

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Isso é o que entendemos sobre sua empresa</h2>
      <p className="vx-mut" style={{ marginBottom: 20 }}>Revise abaixo. Você pode editar qualquer informação antes de ativar.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {campos.map((c) => {
          const valor = edicoes[c.id] !== undefined ? edicoes[c.id] : (resumo[c.id] || "");
          const vazia = !String(valor).trim();
          return (
            <div key={c.id} style={{ background: "var(--surface-1, #f8fafc)", borderRadius: 10, padding: "12px 14px", border: `1px solid ${vazia ? "var(--orange, #f97316)" : "var(--border)"}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: vazia ? "var(--orange, #f97316)" : "var(--text-muted)", marginBottom: 5 }}>
                {c.label} {vazia && "⚠ Em branco"}
              </div>
              {editando ? (
                <textarea className="vx-input" style={{ width: "100%", minHeight: 60, fontSize: 13, boxSizing: "border-box" }} value={valor} onChange={(e) => setEdicoes((prev) => ({ ...prev, [c.id]: e.target.value }))} />
              ) : (
                <p style={{ fontSize: 14, margin: 0, color: vazia ? "var(--text-muted)" : "inherit" }}>{valor || "Não informado"}</p>
              )}
            </div>
          );
        })}
      </div>

      {resumo.docs?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>MATERIAIS INCLUÍDOS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {resumo.docs.map((d, i) => <span key={i} className="vx-chip">{d}</span>)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="vx-btn" style={{ gap: 6 }} onClick={() => setEditando(!editando)}>
          <RotateCcw size={14} /> {editando ? "Fechar edição" : "Editar"}
        </button>
        <button className="vx-btn vx-btn-primary" style={{ gap: 7, flex: 1, minWidth: 160 }} onClick={() => onConfirmar(edicoes)}>
          <Check size={15} /> Está correto — Próxima etapa
        </button>
      </div>
    </div>
  );
}

// ─── Etapa 4: Ativar ─────────────────────────────────────────────────────────

function AtivarCerebro({ onAtivar, ativando }) {
  return (
    <div className="vx-fade" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🧠</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>Tudo pronto!</h2>
      <p className="vx-mut" style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
        A RYCS aprendeu sobre sua empresa. Agora vamos ativar o <strong>Cérebro da Operação</strong> para que sua equipe, campanhas e treinamentos usem essas informações.
      </p>
      <button className="vx-btn vx-btn-primary" style={{ fontSize: 16, padding: "13px 32px", gap: 10 }} onClick={onAtivar} disabled={ativando}>
        <Brain size={18} /> {ativando ? "Ativando…" : "Ativar Cérebro da Operação"}
      </button>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function CerebroOnboarding({ aviso, onConcluir }) {
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [onboarding, setOnboarding] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [indicePergunta, setIndicePergunta] = useState(0);
  const [perguntas, setPerguntas] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [organizando, setOrganizando] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    api("/brain/onboarding").then((r) => {
      if (!r) return;
      setOnboarding(r);
      setEtapa(r.etapa || 1);
      setRespostas(r.respostas || {});
      setPerguntas(r.perguntas || []);
      if (r.concluida) setConcluido(true);
      if (r.resumoIa) { try { setResumo(JSON.parse(r.resumoIa)); } catch {} }
    }).finally(() => setCarregando(false));

    api("/knowledge").then((docs) => {
      if (Array.isArray(docs)) {
        setMateriais(docs.filter((d) => d.origem !== "onboarding").map((d) => ({ id: d.id, titulo: d.titulo, tipo: d.origem, status: d.status })));
      }
    });
  }, []);

  const salvarResposta = async (qid, valor) => {
    setRespostas((r) => ({ ...r, [qid]: valor }));
  };

  const avancarPergunta = async (valor) => {
    const perguntaAtual = perguntas[indicePergunta];
    const novasRespostas = { ...respostas, [perguntaAtual.id]: valor };
    setRespostas(novasRespostas);
    await api("/brain/onboarding/respostas", { respostas: { [perguntaAtual.id]: valor }, etapa: 1 });

    if (indicePergunta + 1 < perguntas.length) {
      setIndicePergunta(indicePergunta + 1);
    } else {
      // Última pergunta — avançar para etapa 2
      setEtapa(2);
    }
  };

  const concluirMateriais = () => setEtapa(3);

  const organizarConhecimento = async () => {
    setOrganizando(true);
    const r = await api("/brain/onboarding/organizar", {});
    if (r?.resumo) setResumo(r.resumo);
    setOrganizando(false);
  };

  useEffect(() => {
    if (etapa === 3 && !resumo) organizarConhecimento();
  }, [etapa]);

  const confirmarRevisao = async (edicoes) => {
    await api("/brain/onboarding/revisar", { edicoes });
    setEtapa(4);
  };

  const ativarCerebro = async () => {
    setAtivando(true);
    const r = await api("/brain/onboarding/ativar", {});
    setAtivando(false);
    if (r?.error) return aviso(r.error);
    setConcluido(true);
    aviso("Cérebro da Operação ativado com sucesso!");
    onConcluir?.();
  };

  if (carregando) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><Brain size={40} color="var(--brand)" /></div>;

  if (concluido) {
    return (
      <div className="vx-fade" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "30px 0" }}>
        <div style={{ fontSize: 56 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "16px 0 8px" }}>Cérebro da Operação ativado!</h2>
        <p className="vx-mut">Sua base de conhecimento está pronta. Campanhas e treinamentos já podem usar tudo o que você compartilhou.</p>
        <button className="vx-btn vx-btn-primary" style={{ marginTop: 20 }} onClick={onConcluir}>Ver Score do Cérebro</button>
      </div>
    );
  }

  return (
    <div className="vx-fade">
      {/* Progresso */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, background: "var(--surface-1, #f8fafc)", borderRadius: 12, padding: 4, maxWidth: 560, margin: "0 auto 32px" }}>
        {ETAPAS.map((e, i) => {
          const ativa = etapa === e.id;
          const concluida = etapa > e.id;
          return (
            <div key={e.id} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 8, background: ativa ? "var(--brand)" : "transparent", transition: "background 0.2s" }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{concluida ? "✓" : e.icon}</div>
              <div style={{ fontSize: 11, fontWeight: concluida || ativa ? 700 : 400, color: ativa ? "#fff" : concluida ? "var(--brand)" : "var(--text-muted)" }}>{e.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, textAlign: "center", color: "var(--text-muted)", marginBottom: 24 }}>
        {etapa} de {ETAPAS.length} etapas concluídas
        {etapa === 1 && " · Tempo estimado: ~10 minutos"}
        {etapa === 2 && " · Tempo estimado: ~5 minutos"}
      </div>

      {/* Etapa 1 */}
      {etapa === 1 && perguntas.length > 0 && (
        <Pergunta
          pergunta={perguntas[indicePergunta]}
          indice={indicePergunta}
          total={perguntas.length}
          resposta={respostas[perguntas[indicePergunta]?.id] || ""}
          onChange={(v) => salvarResposta(perguntas[indicePergunta]?.id, v)}
          onProxima={avancarPergunta}
        />
      )}

      {/* Etapa 2 */}
      {etapa === 2 && (
        <div className="vx-fade">
          <UploadMateriais aviso={aviso} materiais={materiais} setMateriais={setMateriais} />
          <div style={{ maxWidth: 640, margin: "20px auto 0", display: "flex", justifyContent: "flex-end" }}>
            <button className="vx-btn vx-btn-primary" style={{ gap: 7 }} onClick={concluirMateriais}>
              Continuar <ChevronRight size={15} />
            </button>
          </div>
          {materiais.length === 0 && (
            <div style={{ maxWidth: 640, margin: "8px auto 0", textAlign: "right" }}>
              <button className="vx-btn vx-btn-sm" onClick={concluirMateriais} style={{ color: "var(--text-muted)" }}>Pular materiais por enquanto</button>
            </div>
          )}
        </div>
      )}

      {/* Etapa 3 */}
      {etapa === 3 && (
        <RevisaoResumo
          resumo={resumo || {}}
          organizando={organizando}
          onConfirmar={confirmarRevisao}
          onEditar={() => setEtapa(1)}
        />
      )}

      {/* Etapa 4 */}
      {etapa === 4 && (
        <AtivarCerebro onAtivar={ativarCerebro} ativando={ativando} />
      )}
    </div>
  );
}
