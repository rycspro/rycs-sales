import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { api } from "../../lib/api.js";
import {
  CheckCircle2, Circle, CircleDot, ChevronLeft, ChevronRight, Mic, MicOff, Save, Sparkles, AlertTriangle, MonitorUp, Ban,
} from "lucide-react";
import { listarPerguntas, perguntasVisiveis } from "../../../shared/roteiroComercial.js";
import { useTranscricaoAoVivo, navegadorTranscreve, servidorPodeGravar } from "./useTranscricaoAoVivo.js";

// Roteiro guiado durante a ligação ou a videochamada. Mostra a pergunta atual
// e o progresso; a IA acompanha a fala, avança sozinha e preenche respostas.
// O profissional pode navegar e corrigir a qualquer momento; sem IA (ou com
// ela pausada) tudo funciona à mão. As respostas vão para o CRM em "Salvar".

const toque = { minHeight: 44 };
const ORIGEM = { ia: "IA", local: "Reconhecido", manual: "Manual" };
const QUALIFICACAO = {
  qualificado: { label: "Qualificado", cor: "var(--green)", fundo: "var(--green-50)" },
  desqualificado: { label: "Desqualificado", cor: "var(--red)", fundo: "var(--red-50)" },
  pendente: { label: "Qualificação pendente", cor: "var(--amber)", fundo: "var(--amber-50)" },
};
const CHAVE_PREF = "rycs.roteiro.ia";
const MAX_FILA_AUDIO = 6;

const blobBase64 = (blob) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] || "");
  r.onerror = () => falha(new Error("Falha ao ler o áudio."));
  r.readAsDataURL(blob);
});

function CampoResposta({ pergunta, resposta, onSalvar, desabilitado }) {
  const tipo = pergunta.campo?.tipo || "texto";
  const [valor, setValor] = useState(resposta?.valor || "");
  useEffect(() => { setValor(resposta?.valor || ""); }, [resposta?.valor, pergunta.id]);
  const id = `resp-${pergunta.id}`;
  const salvar = (v = valor) => onSalvar(String(v ?? "").trim());

  if (tipo === "sim_nao") {
    return (
      <div role="group" aria-label="Resposta" style={{ display: "flex", gap: 6 }}>
        {["Sim", "Não"].map((v) => (
          <button key={v} type="button" className={`vx-btn vx-btn-sm ${resposta?.valor === v ? "vx-btn-primary" : ""}`} aria-pressed={resposta?.valor === v}
            style={{ ...toque, minWidth: 72 }} disabled={desabilitado} onClick={() => salvar(resposta?.valor === v ? "" : v)}>{v}</button>
        ))}
      </div>
    );
  }
  if (tipo === "opcao") {
    return (
      <div>
        <label className="vx-label" htmlFor={id}>Resposta</label>
        <select id={id} className="vx-input" style={toque} value={resposta?.valor || ""} disabled={desabilitado} onChange={(e) => salvar(e.target.value)}>
          <option value="">Sem resposta</option>
          {pergunta.campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar(); }} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        <label className="vx-label" htmlFor={id}>Resposta</label>
        <input id={id} className="vx-input" style={toque} disabled={desabilitado}
          type={tipo === "data" ? "date" : "text"} inputMode={tipo === "numero" || tipo === "moeda" ? "decimal" : undefined}
          placeholder={tipo === "moeda" ? "R$" : tipo === "numero" ? "Número" : "Digite a resposta"}
          value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <button type="submit" className="vx-btn vx-btn-sm" style={toque} disabled={desabilitado || valor === (resposta?.valor || "")}>Salvar</button>
    </form>
  );
}

const RoteiroGuiado = forwardRef(function RoteiroGuiado({ roteiro, leadId, callId = null, reuniaoId = null, contexto = "ligacao", obterAudioRemoto, aviso, alturaLista = 300 }, ref) {
  const [execucao, setExecucao] = useState(null);
  const [estrutura, setEstrutura] = useState(roteiro?.estrutura || null);
  const [recursos, setRecursos] = useState({ ia: false, transcricaoServidor: false });
  const [erro, setErro] = useState("");
  const [iaLigada, setIaLigada] = useState(() => { try { return localStorage.getItem(CHAVE_PREF) !== "off"; } catch { return true; } });
  const [statusIA, setStatusIA] = useState("");
  const [processando, setProcessando] = useState(false);
  const [ultimaFala, setUltimaFala] = useState("");
  const [remotoSip, setRemotoSip] = useState(null);
  const [audioReuniao, setAudioReuniao] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const execId = useRef(null);
  const fila = useRef({ texto: "", audios: [], ocupado: false, timer: null });

  // Abre (ou retoma) a execução desta ligação/reunião.
  useEffect(() => {
    if (!roteiro?.id || !leadId) return undefined;
    let vivo = true;
    setErro("");
    execId.current = null;
    api.post("/voice/roteiros/execucoes", { scriptId: roteiro.id, leadId, callId: callId || undefined, reuniaoId: reuniaoId || undefined })
      .then((r) => { if (!vivo) return; execId.current = r.execucao.id; setExecucao(r.execucao); setEstrutura(r.roteiro.estrutura); setRecursos(r.recursos || {}); })
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [roteiro?.id, leadId, callId, reuniaoId]);

  // Áudio da ligação pelo navegador aparece quando a chamada conecta.
  useEffect(() => {
    if (contexto !== "ligacao" || !obterAudioRemoto) return undefined;
    const t = setInterval(() => setRemotoSip(obterAudioRemoto() || null), 1500);
    return () => clearInterval(t);
  }, [contexto, obterAudioRemoto]);

  useEffect(() => () => audioReuniao?.getTracks().forEach((t) => t.stop()), [audioReuniao]);

  const remoto = contexto === "ligacao" ? remotoSip : audioReuniao;
  const podeServidor = !!recursos.transcricaoServidor && servidorPodeGravar();
  // Com áudio do outro lado, só o servidor consegue ouvir as respostas do contato.
  const modo = !iaLigada || !execucao ? null
    : podeServidor && remoto ? "servidor"
    : navegadorTranscreve() ? "navegador"
    : podeServidor ? "servidor" : null;

  const processar = useCallback(async () => {
    const f = fila.current;
    if (f.ocupado || !execId.current) return;
    let pedido;
    if (f.audios.length) {
      const a = f.audios.shift();
      pedido = async () => api.post(`/voice/roteiros/execucoes/${execId.current}/audio`, { base64: await blobBase64(a.blob), formato: a.formato });
    } else if (f.texto.trim()) {
      const texto = f.texto.trim();
      f.texto = "";
      setUltimaFala(texto);
      pedido = () => api.post(`/voice/roteiros/execucoes/${execId.current}/trecho`, { texto });
    } else return;
    f.ocupado = true;
    setProcessando(true);
    try {
      const r = await pedido();
      setExecucao(r.execucao);
      setStatusIA(r.ia || "");
      if (r.texto) setUltimaFala(r.texto);
    } catch {
      setStatusIA("falhou");
    } finally {
      f.ocupado = false;
      setProcessando(false);
      if (f.audios.length || f.texto.trim()) processar();
    }
  }, []);

  // Falas curtas ("sim") esperam um instante para irem junto com a próxima.
  const onTrecho = useCallback((t) => {
    const f = fila.current;
    f.texto = `${f.texto} ${t}`;
    clearTimeout(f.timer);
    if (f.texto.trim().length >= 40) processar();
    else f.timer = setTimeout(processar, 1200);
  }, [processar]);

  const onAudio = useCallback((blob, formato) => {
    const f = fila.current;
    f.audios.push({ blob, formato });
    if (f.audios.length > MAX_FILA_AUDIO) f.audios.shift();
    processar();
  }, [processar]);

  useEffect(() => () => clearTimeout(fila.current.timer), []);

  const fontesExtras = useMemo(() => (modo === "servidor" && remoto ? [remoto] : []), [modo, remoto]);
  const escuta = useTranscricaoAoVivo({ ativo: !!modo, modo, onTrecho, onAudio, fontesExtras });

  const alternarIA = () => {
    setIaLigada((v) => { try { localStorage.setItem(CHAVE_PREF, v ? "off" : "on"); } catch { /* sem storage */ } return !v; });
  };

  const incluirAudioReuniao = async () => {
    try {
      const tela = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      tela.getVideoTracks().forEach((t) => t.stop());
      const faixas = tela.getAudioTracks();
      if (!faixas.length) return aviso?.("Ao escolher a aba da reunião, marque “Compartilhar áudio da guia”.");
      faixas[0].addEventListener("ended", () => setAudioReuniao(null));
      setAudioReuniao(new MediaStream(faixas));
    } catch { /* cancelado pelo usuário */ }
  };

  const patch = useCallback(async (corpo) => {
    if (!execId.current) return;
    try { const r = await api.patch(`/voice/roteiros/execucoes/${execId.current}`, corpo); setExecucao(r.execucao); } catch (e) { aviso?.(e.message); }
  }, [aviso]);

  const salvar = useCallback(async ({ silencioso = false } = {}) => {
    if (!execId.current) return null;
    await processar();
    setSalvando(true);
    try {
      const r = await api.post(`/voice/roteiros/execucoes/${execId.current}/salvar`);
      setExecucao((e) => (e ? { ...e, status: "salva", salvoEm: Date.now() } : e));
      if (!silencioso) aviso?.(`${r.respostas} resposta(s) salva(s) no CRM`);
      return r;
    } catch (e) { if (!silencioso) aviso?.(e.message); return null; } finally { setSalvando(false); }
  }, [aviso, processar]);

  useImperativeHandle(ref, () => ({ salvar }), [salvar]);

  const todas = useMemo(() => listarPerguntas(estrutura), [estrutura]);
  const estado = execucao?.estado || { feitas: {}, respostas: {} };
  const visiveis = useMemo(() => perguntasVisiveis(estrutura, estado.respostas), [estrutura, estado.respostas]);
  const idsVisiveis = new Set(visiveis.map((p) => p.id));
  const atual = todas.find((p) => p.id === estado.perguntaAtual) || null;
  const posAtual = visiveis.findIndex((p) => p.id === atual?.id);
  const prog = execucao?.progresso || { total: visiveis.length, feitas: 0, respondidas: 0, percentual: 0, obrigatoriasPendentes: [] };
  const qual = QUALIFICACAO[execucao?.qualificacao?.status];

  if (erro) return <div className="vx-notice vx-notice-amber" role="alert" style={{ fontSize: 13 }}>Roteiro indisponível: {erro}</div>;
  if (!execucao || !estrutura) return <div style={{ textAlign: "center", padding: 16 }}><div className="vx-spinner" /></div>;

  const pillIA = !iaLigada ? { txt: "IA pausada · modo manual", cor: "var(--muted)" }
    : !modo ? { txt: "Sem transcrição neste navegador · modo manual", cor: "var(--muted)" }
    : escuta.erro ? { txt: "Microfone indisponível · modo manual", cor: "var(--red)" }
    : !escuta.ouvindo ? { txt: "Ligando o microfone…", cor: "var(--muted)" }
    : !recursos.ia ? { txt: "Ouvindo · reconhecimento sem IA", cor: "var(--amber)" }
    : statusIA === "falhou" ? { txt: "IA instável · siga manualmente", cor: "var(--amber)" }
    : { txt: processando ? "IA analisando…" : "IA ouvindo", cor: "var(--green)" };

  const blocos = [];
  for (const p of todas) {
    let b = blocos[blocos.length - 1];
    if (!b || b.id !== p.blocoId) { b = { id: p.blocoId, titulo: p.blocoTitulo, perguntas: [] }; blocos.push(b); }
    b.perguntas.push(p);
  }

  return (
    <section aria-label={`Roteiro guiado: ${roteiro?.nome || ""}`} style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", letterSpacing: ".04em" }}>Roteiro guiado</div>
          <div style={{ fontWeight: 650, fontSize: 14 }}>{roteiro?.nome}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span role="status" aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: pillIA.cor }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: pillIA.cor }} />{pillIA.txt}
          </span>
          <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={toque} onClick={alternarIA} aria-pressed={iaLigada}>
            {iaLigada ? <><MicOff size={14} /> Pausar IA</> : <><Mic size={14} /> Ativar IA</>}
          </button>
          {contexto === "videochamada" && iaLigada && podeServidor && (
            <button type="button" className="vx-btn vx-btn-sm" style={toque} onClick={audioReuniao ? () => { audioReuniao.getTracks().forEach((t) => t.stop()); setAudioReuniao(null); } : incluirAudioReuniao}
              title="Compartilhe a aba da reunião com áudio para a IA ouvir também o contato">
              <MonitorUp size={14} /> {audioReuniao ? "Parar áudio da reunião" : "Incluir áudio da reunião"}
            </button>
          )}
        </div>
      </div>

      {escuta.erro && <div className="vx-notice vx-notice-amber" role="alert" style={{ fontSize: 12.5 }}>{escuta.erro}</div>}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
          <span>{prog.feitas} de {prog.total} perguntas · {prog.respondidas} respostas</span>
          {qual && <span style={{ color: qual.cor, background: qual.fundo, borderRadius: "var(--radius-pill)", padding: "1px 8px", fontWeight: 600 }}>{qual.label}</span>}
        </div>
        <div role="progressbar" aria-label="Progresso do roteiro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.percentual}
          style={{ height: 6, borderRadius: "var(--radius-pill)", background: "var(--surface-2)", overflow: "hidden" }}>
          <div style={{ width: `${prog.percentual}%`, height: "100%", background: "var(--brand)", transition: "width .3s" }} />
        </div>
        {execucao.qualificacao?.motivos?.length > 0 && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>{execucao.qualificacao.motivos.join(" · ")}</div>}
      </div>

      {atual ? (
        <div style={{ border: "2px solid var(--brand)", background: "var(--brand-50)", borderRadius: "var(--radius-md)", padding: 14, display: "grid", gap: 10 }} aria-live="polite">
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {[atual.blocoTitulo, atual.topicoTitulo].filter(Boolean).join(" › ")}
            {atual.obrigatoria && <span style={{ color: "var(--red)", fontWeight: 600 }}> · obrigatória</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>{atual.texto}</div>
          {atual.orientacao && <div style={{ fontSize: 12.5, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>{atual.orientacao}</div>}
          <CampoResposta pergunta={atual} resposta={estado.respostas[atual.id]} onSalvar={(v) => patch({ resposta: { perguntaId: atual.id, valor: v } })} />
          {estado.respostas[atual.id]?.trecho && (
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{ORIGEM[estado.respostas[atual.id].origem]}: “{estado.respostas[atual.id].trecho}”</div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={toque} disabled={posAtual <= 0} onClick={() => patch({ perguntaAtual: visiveis[posAtual - 1].id })}><ChevronLeft size={14} /> Anterior</button>
            {!estado.feitas[atual.id] && <button type="button" className="vx-btn vx-btn-sm" style={toque} onClick={() => patch({ feita: { perguntaId: atual.id } })}><CheckCircle2 size={14} /> Já perguntei</button>}
            <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={toque} disabled={posAtual < 0 || posAtual >= visiveis.length - 1} onClick={() => patch({ perguntaAtual: visiveis[posAtual + 1].id })}>Próxima <ChevronRight size={14} /></button>
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--green-100)", background: "var(--green-50)", borderRadius: "var(--radius-md)", padding: 12, fontSize: 13, color: "var(--green-700)", display: "flex", gap: 8, alignItems: "center" }}>
          <CheckCircle2 size={16} aria-hidden="true" /> Roteiro concluído. Revise as respostas e salve no CRM.
        </div>
      )}

      {modo && (escuta.parcial || ultimaFala) && (
        <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={escuta.parcial || ultimaFala}>
          <Sparkles size={12} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> {escuta.parcial || ultimaFala}
        </div>
      )}

      <div style={{ maxHeight: alturaLista, overflow: "auto", borderTop: "1px solid var(--border)", paddingTop: 6 }}>
        {blocos.map((b) => (
          <div key={b.id} style={{ marginBottom: 6 }}>
            {b.titulo && <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", padding: "6px 0 2px" }}>{b.titulo}</div>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {b.perguntas.map((p) => {
                const oculta = !idsVisiveis.has(p.id);
                const r = estado.respostas[p.id];
                const feita = !!estado.feitas[p.id];
                const Icone = oculta ? Ban : r?.valor ? CheckCircle2 : feita ? CircleDot : Circle;
                const cor = oculta ? "var(--muted-2)" : r?.valor ? "var(--green)" : feita ? "var(--amber)" : "var(--muted)";
                return (
                  <li key={p.id}>
                    <button type="button" disabled={oculta} onClick={() => patch({ perguntaAtual: p.id })} aria-current={p.id === atual?.id ? "step" : undefined}
                      style={{ ...toque, width: "100%", textAlign: "left", display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 6px", border: "none", borderRadius: "var(--radius-sm)", cursor: oculta ? "default" : "pointer", background: p.id === atual?.id ? "var(--surface-2)" : "transparent", color: oculta ? "var(--muted-2)" : "var(--ink)", fontFamily: "inherit" }}>
                      <Icone size={15} aria-hidden="true" style={{ color: cor, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                        <span style={{ textDecoration: oculta ? "line-through" : "none" }}>{p.texto}</span>
                        {p.obrigatoria && !oculta && <span style={{ color: "var(--red)" }}> *</span>}
                        {oculta && <span style={{ fontSize: 11 }}> · não se aplica (condição)</span>}
                        {r?.valor && (
                          <span style={{ display: "block", fontSize: 12, color: "var(--ink-2)", marginTop: 2 }} title={r.trecho ? `“${r.trecho}”` : undefined}>
                            <b>{r.valor}</b> <span className="vx-mut" style={{ fontSize: 11 }}>· {ORIGEM[r.origem] || r.origem}</span>
                          </span>
                        )}
                        {!r?.valor && feita && !oculta && <span style={{ display: "block", fontSize: 11.5, color: "var(--amber)" }}>Aguardando resposta</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {prog.obrigatoriasPendentes?.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--amber)", display: "flex", gap: 6, alignItems: "center" }}>
          <AlertTriangle size={13} aria-hidden="true" /> {prog.obrigatoriasPendentes.length} pergunta(s) obrigatória(s) sem resposta
        </div>
      )}

      <button type="button" className="vx-btn vx-btn-primary vx-btn-block" style={toque} disabled={salvando} onClick={() => salvar()}>
        <Save size={15} /> {salvando ? "Salvando…" : execucao.status === "salva" ? "Salvar de novo no CRM" : "Salvar respostas no CRM"}
      </button>
    </section>
  );
});

export default RoteiroGuiado;
