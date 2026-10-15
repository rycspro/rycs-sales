import { useState, useRef, useEffect, useId } from "react";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { api } from "../../lib/api.js";
import ThinkingOrb from "../ThinkingOrb.jsx";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha, custoEstimado } from "../../../shared/objetivosCampanha.js";
import { campanhaPodeSerPublicada, requisitosPublicacao, saldoDisponivel, isPosPago } from "../../../shared/empresa.js";
import { sugerirValores, sugerirValorVisita, impactoNoRoi } from "../../../shared/valorTarefa.js";
import { takeRateDoPlano } from "../../../shared/planos.js";
import { interpretar, interpretarAjuste, proximoCampo, perguntar, pedirDeNovo, reagir, saudacao, resumo, calcularTarefasJarvas, rotuloObjetivo } from "../../../shared/jarvas.js";

// Criação de campanha em três passos.
//
// A tela antiga pedia trinta campos de uma vez, sem hierarquia: título, prazo,
// evidência por ação e limite por profissional no mesmo nível de importância.
// Para quem contrata, isso é um formulário de configuração — não uma decisão
// comercial. E quem não sabe a diferença entre SDR e BDR erra a escolha ali,
// recebe o profissional errado e conclui que a plataforma não funciona.
//
// Aqui a pergunta é outra: o que você precisa que aconteça. O objetivo
// escolhido configura função, ações remuneradas, prova exigida e prazo. Sobra
// para a empresa decidir só o que é dela: para quem, onde, quanto.
//
// Os campos avançados continuam existindo — ficam no editor completo, depois
// que a campanha nasce. Nada foi removido, só tirado do caminho.

const PASSOS = ["Objetivo", "Detalhes", "Revisão"];

function formatarBRL(valor) {
  if (!valor && valor !== 0) return "";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(str) {
  if (!str) return 0;
  return Number(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const movimentoReduzido = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Jarvas: monta a campanha conversando, no ritmo de um chat. Cada resposta
// tem um instante de "digitando" (mais longo para texto mais longo) e chega
// palavra por palavra. Quem prefere menos movimento recebe o texto inteiro.
// A inteligência (o que a frase quer dizer, a próxima pergunta, as contas)
// está em shared/jarvas.js; aqui fica o ritmo, a voz e a tela.
function Jarvas({ emp, onCampanha }) {
  const id = useId();
  const [msgs, setMsgs] = useState([]); // { id, de: "jarvas"|"voce", texto, completo, chips?, resumo? }
  const [digitando, setDigitando] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);
  const [ocupado, setOcupado] = useState(true);
  const [campo, setCampo] = useState(null); // pergunta em aberto, "ajuste" no resumo, "fim" ao montar
  const [texto, setTexto] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [voz, setVoz] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const temMic = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const respostas = useRef({});
  const fila = useRef(Promise.resolve());
  const geracao = useRef(0);
  const seq = useRef(0);
  const lista = useRef(null);
  const entrada = useRef(null);
  const rec = useRef(null);
  const vozLigada = useRef(false);
  vozLigada.current = voz;

  useEffect(() => { const el = lista.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, digitando]);

  const falar = (t) => {
    if (!vozLigada.current || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t.replace(/\n+/g, " "));
    u.lang = "pt-BR"; u.rate = 1.05;
    const vozes = window.speechSynthesis.getVoices();
    u.voice = vozes.find((v) => v.lang === "pt-BR" && /natural|google|luciana|francisca/i.test(v.name)) || vozes.find((v) => v.lang.startsWith("pt")) || null;
    window.speechSynthesis.speak(u);
  };

  // Escreve uma mensagem do Jarvas no ritmo do chat. As mensagens entram em
  // fila; recomeçar a conversa invalida o que estava sendo escrito.
  const escrever = (t, extra = {}) => {
    const g = geracao.current;
    fila.current = fila.current.then(async () => {
      if (g !== geracao.current) return;
      const reduzido = movimentoReduzido();
      setDigitando(true);
      await esperar(reduzido ? 0 : Math.min(420 + t.length * 4, 1100));
      if (g !== geracao.current) return;
      setDigitando(false);
      setEscrevendo(true);
      const mid = ++seq.current;
      setMsgs((m) => [...m, { id: mid, de: "jarvas", texto: reduzido ? t : "", completo: reduzido, ...(reduzido ? extra : {}) }]);
      if (!reduzido) {
        const partes = t.split(/(\s+)/);
        for (let i = 1; i <= partes.length; i += 2) {
          await esperar(14 + partes[i - 1].length * 3);
          if (g !== geracao.current) return;
          const parcial = partes.slice(0, i).join("");
          setMsgs((m) => m.map((x) => (x.id === mid ? { ...x, texto: parcial } : x)));
        }
        setMsgs((m) => m.map((x) => (x.id === mid ? { ...x, texto: t, completo: true, ...extra } : x)));
      }
      setEscrevendo(false);
      setAnuncio(t);
      falar(t);
    });
    return fila.current;
  };

  const fazerPergunta = (r, prefixo = "") => {
    const c = proximoCampo(r);
    if (!c) {
      setCampo("ajuste");
      return escrever(`${prefixo ? `${prefixo}\n\n` : ""}Pronto, já tenho tudo. Confere o resumo:`, { resumo: resumo(r) });
    }
    setCampo(c);
    const p = perguntar(c, r, emp);
    return escrever(prefixo ? `${prefixo}\n\n${p.texto}` : p.texto, { chips: p.chips });
  };

  const comecar = async () => {
    const g = ++geracao.current;
    fila.current = Promise.resolve();
    window.speechSynthesis?.cancel();
    respostas.current = {};
    setMsgs([]); setTexto(""); setCampo(null); setOcupado(true);
    await escrever(saudacao(emp));
    if (g !== geracao.current) return;
    await fazerPergunta({});
    if (g === geracao.current) setOcupado(false);
  };
  // Sair da tela invalida o que estava sendo escrito (e, no modo de
  // desenvolvimento do React, a montagem dupla recomeça do zero).
  useEffect(() => {
    comecar();
    return () => { geracao.current++; window.speechSynthesis?.cancel(); rec.current?.stop(); };
  }, []);

  const mostrarDoUsuario = (t) => setMsgs((m) => [
    ...m.map((x) => (x.chips ? { ...x, chips: undefined } : x)),
    { id: ++seq.current, de: "voce", texto: t, completo: true },
  ]);

  const responder = async (bruto, patchDireto = null) => {
    const t = String(bruto || "").trim();
    if (ocupado || campo === "fim" || (!t && !patchDireto)) return;
    setTexto("");
    mostrarDoUsuario(t);
    setOcupado(true);
    const g = geracao.current;
    const patch = patchDireto || (campo === "ajuste" ? interpretarAjuste(t) : interpretar(t, campo));
    const novas = { ...respostas.current, ...patch };
    respostas.current = novas;

    if (campo === "ajuste") {
      if (!Object.keys(patch).length) await escrever('Não entendi o que mudar. Você pode dizer, por exemplo, "muda para 3 profissionais" ou "região: Campinas".', { resumo: resumo(novas) });
      else await fazerPergunta(novas, `Feito! ${reagir(patch, novas, emp)}`.trim());
    } else if (!Object.keys(patch).length) {
      await escrever(pedirDeNovo(campo), { chips: perguntar(campo, novas, emp).chips });
    } else {
      await fazerPergunta(novas, reagir(patch, novas, emp));
    }
    if (g !== geracao.current) return;
    setOcupado(false);
    entrada.current?.focus();
  };

  const clicarChip = async (chip) => {
    if (chip.patch) return responder(chip.rotulo, chip.patch);
    if (ocupado) return;
    mostrarDoUsuario(chip.rotulo);
    setOcupado(true);
    const g = geracao.current;
    await escrever(chip.seguir || perguntar(campo, respostas.current, emp).texto);
    if (g !== geracao.current) return;
    setOcupado(false);
    entrada.current?.focus();
  };

  const montar = async () => {
    if (ocupado) return;
    setCampo("fim");
    setMsgs((m) => m.map((x) => (x.resumo ? { ...x, fechado: true } : x)));
    setOcupado(true);
    await escrever("Perfeito! Montando a sua campanha agora…");
    const r = respostas.current;
    const objetivo = r.objetivo || "reunioes";
    const campanha = montarCampanha(objetivo, emp);
    const { tarefas, orcamento } = calcularTarefasJarvas(r);
    Object.assign(campanha, { objetivoChave: objetivo, regiao: r.regiao || "", vagas: Number(r.vagas) || 1, tarefas });
    if (r.publico) campanha.publico = r.publico;
    if (orcamento > 0) campanha.orcamento = orcamento;
    campanha.titulo = [rotuloObjetivo(objetivo), r.regiao, `${campanha.vagas} prof.`, orcamento > 0 ? money(orcamento) : ""].filter(Boolean).join(" — ");
    await esperar(movimentoReduzido() ? 0 : 700);
    onCampanha(objetivo, campanha);
  };

  const ditar = () => {
    if (ouvindo) { rec.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "pt-BR"; r.continuous = false; r.interimResults = true;
    let final = "";
    r.onstart = () => setOuvindo(true);
    r.onresult = (e) => { final = Array.from(e.results).map((x) => x[0].transcript).join(""); setTexto(final); };
    r.onend = () => { setOuvindo(false); if (final.trim()) responder(final); };
    r.onerror = () => setOuvindo(false);
    rec.current = r;
    r.start();
  };

  const ultimoResumo = [...msgs].reverse().find((m) => m.resumo)?.id;
  const estadoOrb = ouvindo ? "listening" : digitando ? "thinking" : escrevendo ? "speaking" : msgs.length ? "idle" : "connecting";
  const status = { listening: "Ouvindo você…", thinking: "Pensando…", speaking: "Respondendo…", connecting: "Conectando…", idle: campo === "fim" ? "Montando a campanha" : "Sua vez" }[estadoOrb];

  return (
    <div className="vx-jarvas">
      <style>{`
        .vx-jarvas-log{display:flex;flex-direction:column;gap:12px;max-height:440px;min-height:240px;overflow-y:auto;padding:4px 2px 8px;scroll-behavior:smooth}
        .vx-jarvas-linha{display:flex;gap:8px;align-items:flex-end}
        .vx-jarvas-linha[data-de="voce"]{justify-content:flex-end}
        .vx-jarvas-topo{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 0 10px}
        .vx-jarvas-topo .vx-mut{font-size:12.5px;min-height:18px}
        .vx-jarvas-bolha{max-width:min(85%,560px);padding:10px 14px;border-radius:16px;font-size:14.5px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}
        .vx-jarvas-linha[data-de="jarvas"] .vx-jarvas-bolha{background:var(--surface);border:1px solid var(--border);color:var(--ink);border-bottom-left-radius:4px}
        .vx-jarvas-linha[data-de="voce"] .vx-jarvas-bolha{background:var(--brand);color:#fff;border-bottom-right-radius:4px}
        .vx-jarvas-cursor{display:inline-block;width:7px;height:15px;margin-left:2px;vertical-align:-2px;background:var(--brand);border-radius:1px;animation:jv-pisca 1s steps(2) infinite}
        .vx-jarvas-pontos{display:flex;gap:4px;padding:4px 2px}
        .vx-jarvas-pontos span{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:jv-ponto 1.2s infinite ease-in-out}
        .vx-jarvas-pontos span:nth-child(2){animation-delay:.15s}.vx-jarvas-pontos span:nth-child(3){animation-delay:.3s}
        .vx-jarvas-chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0 36px}
        .vx-jarvas-chips .vx-btn{min-height:44px;border-radius:var(--radius-pill,999px);font-size:13px}
        .vx-jarvas-resumo{margin:8px 0 0 36px;max-width:min(85%,560px);background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px}
        .vx-jarvas-resumo dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px}
        .vx-jarvas-resumo dt{color:var(--muted)}.vx-jarvas-resumo dd{margin:0;font-weight:600;color:var(--ink)}
        .vx-jarvas-form{display:flex;gap:8px;align-items:center;margin-top:12px;padding:6px;border:1px solid var(--border);border-radius:var(--radius-pill,999px);background:var(--surface)}
        .vx-jarvas-form:focus-within{box-shadow:0 0 0 3px var(--ring)}
        .vx-jarvas-form input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:14.5px;padding:0 12px;min-height:44px;color:var(--ink)}
        .vx-jarvas-icone{flex:none;width:44px;height:44px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:transparent;color:var(--muted)}
        .vx-jarvas-icone[data-on="1"]{color:var(--red)}
        .vx-jarvas-enviar{background:var(--brand);color:#fff}
        .vx-jarvas-enviar:disabled{opacity:.4;cursor:default}
        .vx-jarvas-rodape{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:8px}
        @keyframes jv-ponto{0%,80%,100%{transform:scale(.6);opacity:.5}40%{transform:scale(1);opacity:1}}
        @keyframes jv-pisca{to{visibility:hidden}}
        @media (prefers-reduced-motion: reduce){.vx-jarvas-log{scroll-behavior:auto}.vx-jarvas-cursor,.vx-jarvas-pontos span{animation:none}}
      `}</style>

      <div className="vx-jarvas-topo">
        <ThinkingOrb state={estadoOrb} size={64} />
        <span className="vx-mut" aria-hidden="true">{status}</span>
      </div>

      <div ref={lista} className="vx-jarvas-log" aria-label="Conversa com o Jarvas" role="log" aria-busy={digitando || undefined}>
        {msgs.map((m) => (
          <div key={m.id}>
            <div className="vx-jarvas-linha" data-de={m.de}>
              {m.de === "jarvas" && <ThinkingOrb size={28} decorativo />}
              <div className="vx-jarvas-bolha">
                {m.de === "jarvas" && <span className="vx-sr">Jarvas: </span>}
                {m.texto}
                {!m.completo && <span className="vx-jarvas-cursor" aria-hidden="true" />}
              </div>
            </div>
            {m.completo && m.chips?.length > 0 && (
              <div className="vx-jarvas-chips">
                {m.chips.map((c) => (
                  <button key={c.rotulo} type="button" className="vx-btn vx-btn-sm" disabled={ocupado} onClick={() => clicarChip(c)}>{c.rotulo}</button>
                ))}
              </div>
            )}
            {m.completo && m.resumo && (
              <div className="vx-jarvas-resumo">
                <dl>{m.resumo.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                {m.id === ultimoResumo && !m.fechado && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={ocupado} onClick={montar}>
                      <Check size={14} /> Montar campanha
                    </button>
                    <span className="vx-mut" style={{ fontSize: 12.5, alignSelf: "center" }}>ou me diga o que ajustar</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {digitando && (
          <div className="vx-jarvas-linha" data-de="jarvas">
            <ThinkingOrb size={28} state="thinking" decorativo />
            <div className="vx-jarvas-bolha" aria-label="Jarvas está digitando"><div className="vx-jarvas-pontos"><span /><span /><span /></div></div>
          </div>
        )}
      </div>
      <div className="vx-sr" aria-live="polite">{anuncio}</div>

      <form className="vx-jarvas-form" onSubmit={(e) => { e.preventDefault(); responder(texto); }}>
        <label htmlFor={`${id}-msg`} className="vx-sr">Mensagem para o Jarvas</label>
        <input id={`${id}-msg`} ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
          disabled={campo === "fim"} placeholder={ouvindo ? "Ouvindo…" : campo === "ajuste" ? "Peça um ajuste ou clique em Montar campanha" : "Escreva sua resposta…"} />
        {temMic && (
          <button type="button" className="vx-jarvas-icone" data-on={ouvindo ? "1" : "0"} aria-pressed={ouvindo}
            aria-label={ouvindo ? "Parar de ouvir" : "Responder falando"} onClick={ditar} disabled={campo === "fim"}>
            {ouvindo ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" className="vx-jarvas-icone vx-jarvas-enviar" aria-label="Enviar" disabled={ocupado || !texto.trim() || campo === "fim"}>
          <Send size={17} />
        </button>
      </form>
      <div className="vx-jarvas-rodape">
        <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} aria-pressed={voz} onClick={() => { setVoz((v) => !v); window.speechSynthesis?.cancel(); }}>
          {voz ? <Volume2 size={14} /> : <VolumeX size={14} />} {voz ? "Voz ligada" : "Ler em voz alta"}
        </button>
        <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} onClick={comecar} disabled={campo === "fim"}>
          <RotateCcw size={13} /> Recomeçar
        </button>
      </div>
    </div>
  );
}

function CampoOrcamento({ value, onChange }) {
  const [display, setDisplay] = useState(value > 0 ? formatarBRL(value) : "");
  const inputRef = useRef(null);
  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^\d,]/g, "");
    setDisplay(raw);
    onChange(parseBRL(raw));
  };
  const handleBlur = () => {
    const n = parseBRL(display);
    setDisplay(n > 0 ? formatarBRL(n) : "");
    onChange(n);
  };
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)", fontSize: 13.5, pointerEvents: "none", userSelect: "none" }}>R$</span>
      <input ref={inputRef} className="vx-input vx-mono" style={{ paddingLeft: 30 }}
        inputMode="decimal" value={display}
        onChange={handleChange} onBlur={handleBlur}
        placeholder="0,00" />
    </div>
  );
}
const ICONES_OBJETIVO = { leads: Target, reunioes: CalendarCheck, visitas: MapPin, vendas: BadgeDollarSign, completa: Workflow };

export default function NovaCampanha({ emp, aoCriar, aoCancelar, aviso, iniciarComIA = false }) {
  const [passo, setPasso] = useState(0);
  const [objetivo, setObjetivo] = useState(null);
  const [campanha, setCampanha] = useState(null);
  const [brief, setBrief] = useState("");
  const [gerando, setGerando] = useState(false);
  const [explicacao, setExplicacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [sugestaoIA, setSugestaoIA] = useState(null);
  const [mostrarSugestao, setMostrarSugestao] = useState(false);
  const [ticketLocal, setTicketLocal] = useState("");
  const [visitasPorDiaLocal, setVisitasPorDiaLocal] = useState("");
  const [gerandoTreinamento, setGerandoTreinamento] = useState(false);
  const [modeloTreinamento, setModeloTreinamento] = useState("rapido");

  const disponivel = saldoDisponivel(emp);
  const set = (k, v) => setCampanha((c) => ({ ...c, [k]: v }));

  const objAtual = campanha?.objetivoChave ? OBJETIVOS[campanha.objetivoChave] : null;
  const ehCampanhaVisita = objAtual?.usaVisitasPorDia || false;

  const calcularSugestaoIA = () => {
    const plano = emp.assinatura || "free";
    const ticketBase = ticketLocal
      ? parseBRL(ticketLocal)
      : Number(String(emp.ticket || "").replace(/\D/g, "")) || Number(emp.ticket) || 0;

    if (ehCampanhaVisita) {
      const vpd = Number(visitasPorDiaLocal) || 0;
      const orcBase = Number(campanha?.orcamento) || 0;
      const resultado = sugerirValorVisita({ orcamento: orcBase, visitasPorDia: vpd, ticketMedio: ticketBase, plano });
      setSugestaoIA({ ...resultado, tipo: "visita" });
      setMostrarSugestao(true);
    } else {
      const resultado = sugerirValores({ ticketMedio: ticketBase, margem: 0.3, plano });
      setSugestaoIA({ ...resultado, tipo: "reuniao" });
      setMostrarSugestao(true);
    }
  };

  const aceitarSugestaoIA = () => {
    if (!sugestaoIA?.disponivel || !campanha) return;
    const novasTarefas = { ...campanha.tarefas };
    if (sugestaoIA.tipo === "visita") {
      if (novasTarefas.visita !== undefined) novasTarefas.visita = sugestaoIA.valorVisita.bruto;
      if (novasTarefas.venda !== undefined) novasTarefas.venda = sugestaoIA.comissaoVenda.bruto;
    } else {
      sugestaoIA.tarefas?.forEach((t) => {
        if (novasTarefas[t.tipo] !== undefined) novasTarefas[t.tipo] = t.bruto;
      });
    }
    set("tarefas", novasTarefas);
    setMostrarSugestao(false);
  };

  const MODELOS_TREINAMENTO = {
    rapido: { nome: "Treinamento rápido", descricao: "Visão geral + script de abordagem + 3 objeções principais" },
    completo: { nome: "Treinamento completo", descricao: "Módulos detalhados: produto, ICP, objeções, processo comercial e evidências" },
    quiz: { nome: "Quiz + certificação", descricao: "Perguntas de múltipla escolha para testar conhecimento antes de liberar" },
    script: { nome: "Script operacional", descricao: "Roteiro passo a passo para cada tipo de contato da campanha" },
  };

  const gerarTreinamentoComIA = async () => {
    if (!campanha) return;
    setGerandoTreinamento(true);
    const r = await api("/campaigns/treinamento", {
      modelo: modeloTreinamento,
      campanha: {
        titulo: campanha.titulo,
        objetivo: campanha.objetivo,
        descricao: campanha.descricao,
        publico: campanha.publico,
        regiao: campanha.regiao,
        funcao: campanha.funcao,
      },
      empresa: {
        nome: emp.nome,
        produto: emp.produto,
        icp: emp.icp,
        ticket: emp.ticket,
      },
    });
    setGerandoTreinamento(false);
    if (!r || r.error) return;
    if (Array.isArray(r.modulos) && r.modulos.length > 0) {
      set("treinamento", r.modulos);
    }
  };

  const escolher = (chave) => {
    setObjetivo(chave);
    setCampanha(montarCampanha(chave, emp));
    setExplicacao("");
    setPasso(1);
  };

  const gerarComIA = async () => {
    if (brief.trim().length < 10) return aviso("Escreva uma frase dizendo o que você precisa.");
    setGerando(true);
    const r = await api("/campaigns/sugerir", { brief });
    setGerando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível montar a campanha.");
    setObjetivo(r.campanha.objetivoChave);
    setCampanha(r.campanha);
    setExplicacao(r.explicacao);
    setPasso(1);
  };

  const receberCampanhaDoJarvas = (chaveObjetivo, campanhaMontada) => {
    setObjetivo(chaveObjetivo);
    setCampanha(campanhaMontada);
    setExplicacao("");
    setPasso(1);
  };

  const criar = async () => {
    if (!campanha?.titulo?.trim()) return aviso("Dê um título à campanha.");
    setSalvando(true);
    const payload = { ...campanha };
    if (ehCampanhaVisita && visitasPorDiaLocal) payload.visitasPorDia = Number(visitasPorDiaLocal) || 0;
    const r = await api("/campaigns", payload);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar a campanha.");
    aoCriar?.({ ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() });
  };

  const obj = objetivo ? OBJETIVOS[objetivo] : null;
  const custo = campanha ? custoEstimado(campanha, campanha.limitePorProfissional || 10) : null;
  const checklist = campanha ? campanhaPodeSerPublicada(campanha, emp) : { ok: false, pendencias: [] };
  // Os itens do checklist vêm da mesma regra que decide a publicação. Antes
  // eram uma lista à parte, escrita aqui, e as duas discordavam: a empresa
  // premium via "Plano ativo" em vermelho num checklist que o servidor já
  // tinha aprovado.
  const requisitos = campanha ? requisitosPublicacao(campanha, emp) : [];
  const adicionarTreinamento = () => set("treinamento", [...(campanha.treinamento || []), { id: `mod-${Date.now()}`, titulo: "", conteudo: "" }]);
  const atualizarTreinamento = (indice, campo, valor) => set("treinamento", campanha.treinamento.map((item, i) => i === indice ? { ...item, [campo]: valor } : item));
  const removerTreinamento = (indice) => set("treinamento", campanha.treinamento.filter((_, i) => i !== indice));

  return (
    <div className="vx-fade vx-campaign-wizard">
      {/* trilha dos passos */}
      <div className="vx-wizard-steps">
        {PASSOS.map((p, i) => (
          <div key={p} data-active={i === passo ? "1" : "0"} data-done={i < passo ? "1" : "0"}>
            <div>
              <span>{i < passo ? <Check size={12} /> : i + 1}</span>
              {p}
            </div>
            {i < PASSOS.length - 1 && <i />}
          </div>
        ))}
      </div>

      {/* ---------------------------------------------- passo 1: objetivo */}
      {passo === 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Nova campanha</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {iniciarComIA ? "Descreva o que você precisa — a IA monta a campanha e você revisa antes de publicar." : "Use a IA ou escolha o objetivo manualmente."}
          </p>

          {/* Jarvas — conversa no ritmo de um chat */}
          <div className="vx-card" style={{ padding: 20, marginTop: 4, borderColor: "var(--brand-200, var(--brand-100))", background: "linear-gradient(135deg, var(--brand-50) 0%, var(--indigo-50, var(--brand-50)) 100%)", borderWidth: 1.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <b style={{ fontSize: 15 }}>Jarvas</b>
              <span className="vx-badge vx-badge-brand" style={{ fontSize: 11 }}>IA · Recomendado</span>
            </div>
            <Jarvas emp={emp} onCampanha={receberCampanhaDoJarvas} />
          </div>

          {!iniciarComIA && <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span className="vx-mut" style={{ fontSize: 12 }}>ou escolha um objetivo manualmente</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div className="vx-objective-grid">
              {ORDEM_OBJETIVOS.map((k) => {
                const o = OBJETIVOS[k];
                const Icone = ICONES_OBJETIVO[k] || Target;
                return (
                  <button key={k} className="vx-card vx-objective-card" onClick={() => escolher(k)}>
                    <span className="vx-objective-icon"><Icone size={19} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <b style={{ fontSize: 15 }}>{o.nome}</b>
                        <span className="vx-badge vx-badge-muted">{o.funcao.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{o.resumo}</div>
                      <div className="vx-mut" style={{ fontSize: 12, marginTop: 6 }}>{o.paraQuem}</div>
                    </div>
                    <ArrowRight size={16} className="vx-objective-arrow" />
                  </button>
                );
              })}
            </div>
          </>}

          <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginTop: 14 }} onClick={aoCancelar}>Cancelar</button>
        </>
      )}

      {/* ---------------------------------------------- passo 2: detalhes */}
      {passo === 1 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>{obj?.nome}</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Já configuramos função, ações e evidências. Falta o que só você sabe.
          </p>

          {explicacao && (
            <div style={{ padding: "11px 14px", borderRadius: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)", marginTop: 14, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>
              {explicacao}
            </div>
          )}

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <label><div className="vx-label">Nome da campanha</div>
              <input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>

            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Descrição curta da operação</div>
              <textarea className="vx-input" style={{ minHeight: 62 }} value={campanha.descricao || ""}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Explique o resultado esperado e o contexto que o profissional precisa conhecer." /></label>

            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">ICP — quem é o cliente que você quer</div>
              <textarea className="vx-input" style={{ minHeight: 64 }} value={campanha.publico}
                onChange={(e) => set("publico", e.target.value)}
                placeholder="Ex.: distribuidoras de bebida com 10 a 80 funcionários" /></label>

            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
              <label><div className="vx-label">Região</div>
                <input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder="Ex.: interior de SP" /></label>
              <label><div className="vx-label">Quantos profissionais</div>
                <input className="vx-input vx-mono" type="number" min="1" value={campanha.vagas}
                  onChange={(e) => set("vagas", Number(e.target.value))} /></label>
            </div>
          </div>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 12 }}><div><b>Estrutura da operação</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Função, prazo e limites de execução.</div></div><ShieldCheck size={18} color="var(--brand)" /></div>
            <div className="vx-grid vx-g3">
              <label><div className="vx-label">Função recomendada</div><select className="vx-input" value={campanha.funcao} onChange={(e) => set("funcao", e.target.value)}><option value="sdr">SDR</option><option value="bdr">BDR</option><option value="closer">Closer</option><option value="pap">Porta a porta</option></select></label>
              <label><div className="vx-label">Prazo por tarefa (horas)</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.prazoHoras} onChange={(e) => set("prazoHoras", Number(e.target.value))} /></label>
              <label><div className="vx-label">Limite por profissional</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.limitePorProfissional} onChange={(e) => set("limitePorProfissional", Number(e.target.value))} /></label>
            </div>
            <div className="vx-wizard-checks" style={{ marginTop: 12 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.prospeccaoAtiva} onChange={(e) => set("prospeccaoAtiva", e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Quero fazer prospecção ativa / Cold Call</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>O profissional aborda novos contatos por conta própria — ligações, mensagens, visitas — e traz o lead até você.</div>
                </div>
              </label>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 10 }}>
                <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.aceitaLeadProprio} onChange={(e) => set("aceitaLeadProprio", e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Aceitar leads dos próprios profissionais</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>O profissional pode submeter leads que ele já conhece ou mantém relacionamento — sem precisar prospectar do zero.</div>
                </div>
              </label>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 10 }}>
                <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.exigeCertificacao} onChange={(e) => set("exigeCertificacao", e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Exigir certificação antes de trabalhar</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>Profissional precisa completar o treinamento desta campanha antes de submeter tarefas.</div>
                </div>
              </label>
            </div>
          </div>

          {/* valores: o ponto onde a empresa decide o que paga */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 4 }}>
              <b style={{ fontSize: 14 }}>Quanto você paga por ação</b>
              <span className="vx-chip"><Wallet size={12} /> {disponivel === Infinity ? (isPosPago(emp) ? "Pós-pago · sem limite" : "Premium · sem limite") : `${money(disponivel)} disponível`}</span>
            </div>

            {/* Sugestão com IA */}
            <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div className="vx-row" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={14} color="var(--brand)" />
                  <b style={{ fontSize: 13 }}>Sugestão com IA</b>
                  <span className="vx-mut" style={{ fontSize: 11.5 }}>— {ehCampanhaVisita ? "valor por visita e comissão" : "quanto custará cada ação"}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={calcularSugestaoIA}>
                    <Sparkles size={12} /> Calcular
                  </button>
                  {sugestaoIA && <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={() => setMostrarSugestao((v) => !v)}>
                    {mostrarSugestao ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: mostrarSugestao ? 10 : 0 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>Ticket médio</span>
                <div style={{ position: "relative", maxWidth: 160 }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)", fontSize: 12.5, pointerEvents: "none" }}>R$</span>
                  <input
                    className="vx-input vx-mono"
                    style={{ paddingLeft: 28, fontSize: 13, height: 32 }}
                    inputMode="decimal"
                    placeholder={emp.ticket ? String(emp.ticket).replace("R$", "").trim() : "0,00"}
                    value={ticketLocal}
                    onChange={(e) => setTicketLocal(e.target.value.replace(/[^\d,]/g, ""))}
                  />
                </div>
                {!ticketLocal && emp.ticket && (
                  <span className="vx-mut" style={{ fontSize: 11 }}>Usando do perfil: {emp.ticket}</span>
                )}
                {ehCampanhaVisita && (
                  <>
                    <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", marginLeft: 4 }}>Visitas/dia</span>
                    <input
                      className="vx-input vx-mono"
                      style={{ width: 72, fontSize: 13, height: 32 }}
                      type="number" min="1" step="1"
                      placeholder="Ex.: 5"
                      value={visitasPorDiaLocal}
                      onChange={(e) => setVisitasPorDiaLocal(e.target.value)}
                    />
                    <span className="vx-mut" style={{ fontSize: 11 }}>Orçamento ÷ 22 dias ÷ visitas/dia</span>
                  </>
                )}
              </div>
              {mostrarSugestao && sugestaoIA && (
                sugestaoIA.disponivel ? (
                  <div>
                    {sugestaoIA.tipo === "visita" ? (
                      <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                        <div style={{ background: "#fff", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 2 }}>Por visita realizada</div>
                          <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(sugestaoIA.valorVisita.bruto)}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>Take rate {(sugestaoIA.valorVisita.percentual * 100).toFixed(0)}% · líq. {money(sugestaoIA.valorVisita.liquido)}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>{sugestaoIA.fonte}</div>
                        </div>
                        {sugestaoIA.comissaoVenda.bruto > 0 && (
                          <div style={{ background: "#fff", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 2 }}>Comissão por venda fechada</div>
                            <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(sugestaoIA.comissaoVenda.bruto)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>Take rate {(sugestaoIA.comissaoVenda.percentual * 100).toFixed(0)}% · líq. {money(sugestaoIA.comissaoVenda.liquido)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>8% do ticket</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                        {sugestaoIA.tarefas?.filter((t) => campanha.tarefas[t.tipo] !== undefined).map((t) => (
                          <div key={t.tipo} style={{ background: "#fff", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 2 }}>{ACOES[t.tipo]?.nome || t.tipo}</div>
                            <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(t.bruto)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>Take rate {(t.percentual * 100).toFixed(0)}% · líq. {money(t.liquido)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>Faixa: {money(t.minimo)} – {money(t.maximo)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {sugestaoIA.tipo !== "visita" && (() => {
                      const agendamento = sugestaoIA.tarefas?.find((t) => t.tipo === "agendamento");
                      return agendamento ? (
                        <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
                          Custo estimado por reunião agendada: <b className="vx-mono">{money(agendamento.bruto)}</b>
                          {sugestaoIA.premissas?.conversao ? ` · por venda: ~${money(agendamento.bruto / sugestaoIA.premissas.conversao)}` : ""}
                          {" · "}Take rate do plano: {(takeRateDoPlano(emp.assinatura || "free") * 100).toFixed(0)}%
                        </div>
                      ) : null;
                    })()}
                    {sugestaoIA.confianca && <div className="vx-mut" style={{ fontSize: 11, marginBottom: 8 }}>
                      Confiança: {sugestaoIA.confianca} · {sugestaoIA.fontes?.[0]?.nome}
                    </div>}
                    <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={aceitarSugestaoIA}>
                      <Check size={12} /> Aceitar sugestão
                    </button>
                  </div>
                ) : (
                  <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {sugestaoIA.motivo} {sugestaoIA.ausentes && <b>Ausente: {sugestaoIA.ausentes.join(", ")}</b>}
                  </div>
                )
              )}
            </div>

            <p className="vx-mut" style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.6 }}>
              {campanha.valoresDerivadosDoTicket
                ? `Valores pré-preenchidos a partir do seu ticket (${emp.ticket}). São ponto de partida — você decide.`
                : "Preencha o valor de cada ação abaixo ou use a sugestão da IA."}
            </p>
            <div className="vx-grid vx-g2">
              {Object.keys(campanha.tarefas).map((k) => (
                <label key={k}>
                  <div className="vx-label">
                    {k === "venda" ? "Comissão por venda fechada (R$)" : (ACOES[k]?.nome || k)}
                  </div>
                  <input className="vx-input vx-mono" type="number" min="0" step="0.5" value={campanha.tarefas[k]}
                    onChange={(e) => set("tarefas", { ...campanha.tarefas, [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 12 }}><div className="vx-label">Orçamento total da campanha</div>
              <CampoOrcamento value={campanha.orcamento} onChange={(v) => set("orcamento", v)} /></div>
            {!isPosPago(emp) && campanha.orcamento > disponivel && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--amber)" }}>
                O orçamento passa do seu saldo disponível. Dá para salvar como rascunho, mas não para publicar.
              </div>
            )}
          </div>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 12 }}>
              <div><b style={{ fontSize: 14 }}>Treinamento obrigatório</b><div className="vx-mut" style={{ fontSize: 11.5 }}>O profissional precisa conhecer a operação antes de começar.</div></div>
              <button className="vx-btn vx-btn-sm" onClick={adicionarTreinamento}><Plus size={13} /> Módulo</button>
            </div>

            {/* Gerador de treinamento com IA */}
            <div style={{ background: "linear-gradient(135deg, var(--brand-50), var(--indigo-50, var(--brand-50)))", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <BookOpen size={14} color="var(--brand)" />
                <b style={{ fontSize: 13 }}>Gerar treinamento com IA</b>
              </div>
              <p className="vx-mut" style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.5 }}>
                A IA monta os módulos usando as informações da campanha e do Cérebro da Operação. Você edita ou adiciona módulos depois.
              </p>
              <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                {Object.entries(MODELOS_TREINAMENTO).map(([k, m]) => (
                  <label key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer", background: modeloTreinamento === k ? "var(--brand-50)" : "var(--surface)", border: `1px solid ${modeloTreinamento === k ? "var(--brand)" : "var(--border)"}`, borderRadius: 8, padding: "9px 11px" }}>
                    <input type="radio" name="modeloTreinamento" value={k} checked={modeloTreinamento === k} onChange={() => setModeloTreinamento(k)} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nome}</div>
                      <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{m.descricao}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={gerandoTreinamento} onClick={gerarTreinamentoComIA}>
                {gerandoTreinamento ? <><Loader size={13} /> Gerando módulos…</> : <><Sparkles size={13} /> Gerar treinamento</>}
              </button>
            </div>

            {(campanha.treinamento || []).length === 0
              ? <div className="vx-campaign-inline-empty">Gere com IA ou adicione ao menos um módulo para liberar a publicação.</div>
              : <div className="vx-training-drafts">
                  {campanha.treinamento.map((modulo, indice) => (
                    <div key={modulo.id || indice}>
                      <input className="vx-input" placeholder="Título do módulo" value={modulo.titulo || ""} onChange={(e) => atualizarTreinamento(indice, "titulo", e.target.value)} />
                      <textarea className="vx-input" placeholder="Resumo, conteúdo ou URL autorizada" value={modulo.conteudo || ""} onChange={(e) => atualizarTreinamento(indice, "conteudo", e.target.value)} />
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" aria-label="Remover módulo" onClick={() => removerTreinamento(indice)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(0)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(2)}>Revisar <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ---------------------------------------------- passo 3: revisão */}
      {passo === 2 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Confira antes de criar</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            A campanha nasce como rascunho. Publicar é um segundo passo, depois do treinamento.
          </p>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-grid vx-g2" style={{ fontSize: 13 }}>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Campanha</span><div style={{ fontWeight: 600 }}>{campanha.titulo}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Objetivo</span><div style={{ fontWeight: 600 }}>{obj?.nome}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>ICP</span><div style={{ fontWeight: 600 }}>{campanha.publico || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Profissional</span><div style={{ fontWeight: 600 }}>{campanha.funcao.toUpperCase()}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Vagas</span><div style={{ fontWeight: 600 }}>{campanha.vagas}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Região</span><div style={{ fontWeight: 600 }}>{campanha.regiao || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Prazo por ação</span><div style={{ fontWeight: 600 }}>{campanha.prazoHoras}h</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Orçamento</span><div style={{ fontWeight: 600 }} className="vx-mono">{money(campanha.orcamento)}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Limite por profissional</span><div style={{ fontWeight: 600 }}>{campanha.limitePorProfissional || "Sem limite"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Leads próprios</span><div style={{ fontWeight: 600 }}>{campanha.aceitaLeadProprio ? "Aceitos" : "Não aceitos"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Certificação</span><div style={{ fontWeight: 600 }}>{campanha.exigeCertificacao ? "Obrigatória" : "Não exigida"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Treinamento</span><div style={{ fontWeight: 600 }}>{(campanha.treinamento || []).length} módulo(s)</div></div>
            </div>

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>O que você paga</div>
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              {Object.entries(campanha.tarefas).map(([k, v]) => (
                <div key={k} className="vx-row">
                  <span style={{ color: "var(--text-2)" }}>{ACOES[k]?.nome || k}</span>
                  <b className="vx-mono">{money(Number(v))}</b>
                </div>
              ))}
            </div>
            {custo?.estimativaPorProfissional > 0 && (
              <div className="vx-mut" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                Se um profissional bater o limite de {campanha.limitePorProfissional} ações de cada tipo,
                a campanha consome cerca de <b className="vx-mono">{money(custo.estimativaPorProfissional)}</b> com ele.
                É estimativa de teto, não previsão: você só paga ação aprovada.
              </div>
            )}

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Evidências exigidas</div>
            <div className="vx-evidence-summary">{Object.entries(campanha.evidencias || {}).map(([tipo, campos]) => <div key={tipo}><b>{ACOES[tipo]?.nome || tipo}</b><span>{Array.isArray(campos) ? campos.join(" · ") : "Critério configurado"}</span></div>)}</div>

            <hr className="vx-sep" />
            <div className="vx-row" style={{ alignItems: "flex-start" }}><div><div className="vx-eyebrow">Checklist de publicação</div><b style={{ fontSize: 13 }}>{checklist.ok ? "Rascunho pronto para solicitar publicação" : `${checklist.pendencias.length} pendência(s) identificada(s)`}</b></div><span className={`vx-campaign-status ${checklist.ok ? "is-ativa" : "is-em_revisao"}`}>{checklist.ok ? "Completo" : "Pendente"}</span></div>
            <div className="vx-publish-checklist">{requisitos.map(({ label, ok }) => <div key={label} data-ok={ok ? "1" : "0"}><span>{ok ? <Check size={12} /> : "!"}</span>{label}</div>)}</div>
            {!checklist.ok && <div className="vx-notice vx-notice-amber" style={{ marginTop: 11 }}>{checklist.pendencias.join(" · ")}</div>}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(1)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? "Salvando…" : <>Salvar como rascunho <Check size={14} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
