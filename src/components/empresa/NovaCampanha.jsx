import { useState, useRef, useEffect } from "react";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha, custoEstimado } from "../../../shared/objetivosCampanha.js";
import { campanhaPodeSerPublicada, requisitosPublicacao, saldoDisponivel, isPosPago } from "../../../shared/empresa.js";
import { sugerirValores, sugerirValorVisita, impactoNoRoi } from "../../../shared/valorTarefa.js";
import { takeRateDoPlano } from "../../../shared/planos.js";

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

const OBJETIVO_LABELS = {
  leads: "Gerar leads", reunioes: "Agendar reuniões", visitas: "Visitas presenciais",
  campo: "Porta a porta", vendas: "Fechar vendas", completa: "Prospecção completa",
  prospeccao: "Abrir mercado novo", reativacao: "Reativar clientes",
};

const OBJETIVO_OPCOES = [
  { valor: "campo", label: "Porta a porta" }, { valor: "visitas", label: "Visitas presenciais" },
  { valor: "reunioes", label: "Agendar reuniões" }, { valor: "leads", label: "Gerar leads" },
  { valor: "vendas", label: "Fechar vendas" }, { valor: "completa", label: "Prospecção completa" },
  { valor: "prospeccao", label: "Abrir mercado novo" }, { valor: "reativacao", label: "Reativar clientes" },
];

const PERGUNTAS_JARVAS = [
  { id: "objetivo",        voz: "Que tipo de campanha você precisa criar?",                                           tipo: "opcoes" },
  { id: "regiao",          voz: "Em qual cidade ou região vai acontecer essa campanha?",                             tipo: "texto",  ph: "Ex.: Sorocaba" },
  { id: "publico",         voz: "Quem é o cliente ideal? Descreva o perfil de quem você quer atingir.",              tipo: "texto",  ph: "Ex.: Empresas com alto consumo energético" },
  { id: "vagas",           voz: "Quantos profissionais você precisa nessa campanha?",                                 tipo: "numero", ph: "Ex.: 2" },
  { id: "ticketMedio",     voz: "Qual é o ticket médio? Quanto vale uma venda fechada para você, em reais?",         tipo: "moeda",  ph: "Ex.: 5000" },
  { id: "visitasPorDia",   voz: "Quantas visitas por dia você espera que cada profissional realize?",                tipo: "numero", ph: "Ex.: 5" },
  { id: "fixoMensal",      voz: "Qual o valor máximo que você quer pagar por mês por profissional, em reais?",       tipo: "moeda",  ph: "Ex.: 3000" },
];

// Calcula tarefas e orçamento a partir das respostas do Jarvas
function calcularTarefasJarvas(r, objetivo, emp) {
  const fixoMensal    = parseBRL(String(r.fixoMensal || "")) || 0;
  const visitasPorDia = Number(r.visitasPorDia) || 5;
  const vagas         = Number(r.vagas) || 1;
  const ticket        = parseBRL(String(r.ticketMedio || "")) || 0;
  const obj           = OBJETIVOS[objetivo] || OBJETIVOS.reunioes;
  const diasUteis     = 22;

  const principalKey = obj.principal;
  const tarefas = {};

  if (obj.usaVisitasPorDia) {
    // Campanha de visitas: orcamento / diasUteis / visitasPorDia = valor por visita
    const valorVisita = fixoMensal > 0 ? Math.round(fixoMensal / diasUteis / visitasPorDia) : (ticket ? Math.round(ticket * (obj.proporcao.visita || 0.008)) : 0);
    tarefas.visita = valorVisita;
    if (obj.acoes.includes("venda")) tarefas.venda = ticket ? Math.round(ticket * (obj.proporcao.venda || 0.08)) : 0;
  } else {
    // Demais campanhas: fixo mensal / (unidades principais por dia × dias úteis)
    const unidadesDia = 1;
    const valorPrincipal = fixoMensal > 0 ? Math.round(fixoMensal / (unidadesDia * diasUteis)) : 0;
    const propPrincipal = obj.proporcao[principalKey] || 1;
    for (const acao of obj.acoes) {
      if (acao === principalKey) { tarefas[acao] = valorPrincipal; continue; }
      const propRel = (obj.proporcao[acao] || 0) / propPrincipal;
      tarefas[acao] = valorPrincipal > 0 ? Math.max(1, Math.round(valorPrincipal * propRel)) : (ticket ? Math.round(ticket * (obj.proporcao[acao] || 0)) : 0);
    }
    // Comissão venda sempre baseada no ticket se não tiver valor ainda
    if (tarefas.venda === 0 && ticket) tarefas.venda = Math.round(ticket * (obj.proporcao.venda || 0.08));
  }

  const orcamento = fixoMensal > 0 ? fixoMensal * vagas : 0;
  return { tarefas, orcamento };
}

// Interface estilo Siri: orb animado, voz Web Speech API, input texto como fallback
function JarvasVoice({ emp, onCampanha }) {
  const [fase, setFase] = useState("intro"); // intro|perguntando|ouvindo|confirmando|montando
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [transcricao, setTranscricao] = useState("");
  const [inputTexto, setInputTexto] = useState("");
  const [temMic, setTemMic] = useState(false);
  const [micAtivo, setMicAtivo] = useState(false);

  const recRef = useRef(null);
  const inputRef = useRef(null);

  // Detecta suporte a Speech API
  useEffect(() => {
    setTemMic(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const pergunta = PERGUNTAS_JARVAS[etapa];
  const totalEtapas = PERGUNTAS_JARVAS.length;
  const progresso = Math.round((etapa / totalEtapas) * 100);

  // Fala um texto e chama callback ao terminar
  const falar = (texto, aoTerminar) => {
    if (!window.speechSynthesis) { aoTerminar?.(); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = "pt-BR"; utter.rate = 1.0; utter.pitch = 1.05;
    const definirVoz = () => {
      const vozes = window.speechSynthesis.getVoices();
      const voz = vozes.find(v => v.lang.startsWith("pt-BR")) || vozes.find(v => v.lang.startsWith("pt")) || vozes[0];
      if (voz) utter.voice = voz;
    };
    definirVoz();
    if (window.speechSynthesis.getVoices().length === 0) window.speechSynthesis.addEventListener("voiceschanged", definirVoz, { once: true });
    utter.onend = () => aoTerminar?.();
    utter.onerror = () => aoTerminar?.();
    window.speechSynthesis.speak(utter);
  };

  // Inicia escuta via microfone
  const iniciarEscuta = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pt-BR"; rec.continuous = false; rec.interimResults = true;
    recRef.current = rec;
    rec.onstart = () => { setMicAtivo(true); setFase("ouvindo"); setTranscricao(""); };
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("");
      setTranscricao(t);
    };
    rec.onend = () => { setMicAtivo(false); setFase("confirmando"); };
    rec.onerror = () => { setMicAtivo(false); setFase("confirmando"); };
    rec.start();
  };

  const pararEscuta = () => { recRef.current?.stop(); };

  // Avança para a pergunta atual: fala e depois escuta
  const fazerPergunta = (idx) => {
    const p = PERGUNTAS_JARVAS[idx];
    if (!p) return;
    setEtapa(idx); setFase("perguntando"); setTranscricao(""); setInputTexto("");
    if (p.tipo !== "opcoes") {
      falar(p.voz, () => { setFase("ouvindo"); if (temMic) iniciarEscuta(); else setFase("confirmando"); });
    } else {
      falar(p.voz, () => setFase("confirmando"));
    }
  };

  const iniciar = () => fazerPergunta(0);

  const confirmar = (valorOverride) => {
    const valor = valorOverride !== undefined ? valorOverride : (transcricao.trim() || inputTexto.trim());
    if (!valor && pergunta?.tipo !== "opcoes") return;
    const novas = { ...respostas, [pergunta.id]: valor };
    setRespostas(novas);
    setTranscricao(""); setInputTexto("");
    const prox = etapa + 1;
    if (prox < totalEtapas) {
      setTimeout(() => fazerPergunta(prox), 300);
    } else {
      montar(novas);
    }
  };

  const repetir = () => { setTranscricao(""); setInputTexto(""); setFase("ouvindo"); if (temMic) iniciarEscuta(); };

  const reiniciar = () => { window.speechSynthesis?.cancel(); recRef.current?.stop(); setFase("intro"); setEtapa(0); setRespostas({}); setTranscricao(""); setInputTexto(""); };

  const montar = async (r) => {
    setFase("montando");
    falar("Perfeito! Montando sua campanha agora.");
    const objetivo = r.objetivo || "reunioes";
    const nomeObj = OBJETIVO_LABELS[objetivo] || objetivo;
    const regiao = r.regiao || "";
    const vagas = Number(r.vagas) || 1;

    let campanha = montarCampanha(objetivo, emp);
    const { tarefas, orcamento } = calcularTarefasJarvas(r, objetivo, emp);

    campanha.objetivoChave = objetivo;
    campanha.regiao = regiao;
    if (r.publico) campanha.publico = r.publico;
    campanha.vagas = vagas;
    campanha.tarefas = tarefas;
    if (orcamento > 0) campanha.orcamento = orcamento;

    // Título: Tipo — Cidade — N prof. — R$ orçamento
    const parts = [nomeObj];
    if (regiao) parts.push(regiao);
    parts.push(`${vagas} prof.`);
    if (orcamento > 0) parts.push(money(orcamento));
    campanha.titulo = parts.join(" — ");

    setTimeout(() => onCampanha(objetivo, campanha), 800);
  };

  // ---- render ----
  const corOrb = fase === "ouvindo" ? "#ef4444" : "var(--brand)";
  const pulsando = fase === "ouvindo" || fase === "perguntando";

  return (
    <>
      <style>{`
        @keyframes jv-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.12);opacity:.85} }
        @keyframes jv-ring  { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.7);opacity:0} }
        @keyframes jv-dots  { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"28px 0 20px", gap:20 }}>

        {/* barra de progresso */}
        {fase !== "intro" && (
          <div style={{ width:"100%", height:3, background:"var(--border)", borderRadius:2 }}>
            <div style={{ height:"100%", width:`${progresso}%`, background:"var(--brand)", borderRadius:2, transition:"width .4s" }} />
          </div>
        )}

        {/* orb */}
        <div style={{ position:"relative", width:100, height:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {pulsando && (
            <div style={{ position:"absolute", width:100, height:100, borderRadius:"50%", background:corOrb, opacity:.2, animation:"jv-ring 1.4s ease-out infinite" }} />
          )}
          <div style={{
            width:80, height:80, borderRadius:"50%",
            background:`radial-gradient(circle at 35% 35%, ${fase==="ouvindo"?"#f87171":corOrb}, ${fase==="ouvindo"?"#dc2626":"var(--brand-700,#1d4ed8)"})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 8px 32px ${fase==="ouvindo"?"rgba(239,68,68,.4)":"rgba(59,130,246,.35)"}`,
            animation: pulsando ? "jv-pulse 1.6s ease-in-out infinite" : "none",
            cursor: fase==="montando" ? "default" : "pointer",
            transition:"all .3s",
          }}
            onClick={() => {
              if (fase === "intro") iniciar();
              else if (fase === "ouvindo") pararEscuta();
              else if (fase === "confirmando" && temMic) repetir();
            }}
          >
            {fase === "montando"
              ? <div style={{ display:"flex", gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"#fff",animation:`jv-dots 1.2s ${i*0.16}s infinite ease-in-out` }} />)}</div>
              : fase === "ouvindo"
                ? <div style={{ width:18,height:18,borderRadius:3,background:"#fff" }} />
                : <span style={{ fontSize:28, color:"#fff", fontWeight:700, fontFamily:"serif" }}>J</span>
            }
          </div>
        </div>

        {/* texto central */}
        {fase === "intro" && (
          <div style={{ textAlign:"center", maxWidth:360 }}>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>Jarvas</div>
            <div className="vx-mut" style={{ fontSize:13.5, lineHeight:1.6, marginBottom:16 }}>
              Vou fazer algumas perguntas e montar a campanha para você — com nome, valores por tarefa e orçamento calculados automaticamente.
            </div>
            <button className="vx-btn vx-btn-primary" style={{ minWidth:140 }} onClick={iniciar}>
              <Sparkles size={14} /> Começar
            </button>
          </div>
        )}

        {fase !== "intro" && fase !== "montando" && pergunta && (
          <div style={{ textAlign:"center", maxWidth:400, width:"100%" }}>
            <div className="vx-mut" style={{ fontSize:11.5, marginBottom:6 }}>Pergunta {etapa+1} de {totalEtapas}</div>
            <div style={{ fontSize:15, fontWeight:600, lineHeight:1.5, marginBottom:16, minHeight:44 }}>{pergunta.voz}</div>

            {/* Resposta do usuário */}
            {(transcricao || inputTexto) && (
              <div style={{ fontSize:14, color:"var(--brand)", fontWeight:500, marginBottom:12, minHeight:20 }}>
                "{transcricao || inputTexto}"
              </div>
            )}

            {/* Opções para objetivo */}
            {pergunta.tipo === "opcoes" && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center", marginBottom:12 }}>
                {OBJETIVO_OPCOES.map(op => (
                  <button key={op.valor} className="vx-btn vx-btn-sm"
                    style={{ borderRadius:20, fontSize:12.5, background: respostas.objetivo === op.valor ? "var(--brand)" : "", color: respostas.objetivo === op.valor ? "#fff" : "" }}
                    onClick={() => confirmar(op.valor)}>
                    {op.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input texto fallback */}
            {pergunta.tipo !== "opcoes" && (
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <input
                  ref={inputRef}
                  className="vx-input"
                  style={{ flex:1, fontSize:13.5, textAlign:"center" }}
                  type={pergunta.tipo === "numero" || pergunta.tipo === "moeda" ? "text" : "text"}
                  inputMode={pergunta.tipo === "moeda" || pergunta.tipo === "numero" ? "decimal" : "text"}
                  placeholder={fase === "ouvindo" ? "Ouvindo… ou escreva aqui" : pergunta.ph}
                  value={transcricao || inputTexto}
                  onChange={(e) => { setTranscricao(""); setInputTexto(e.target.value); }}
                  onKeyDown={(e) => e.key === "Enter" && confirmar()}
                />
              </div>
            )}

            {/* status e botões de ação */}
            <div style={{ display:"flex", gap:8, justifyContent:"center", alignItems:"center", flexWrap:"wrap" }}>
              {fase === "ouvindo" && (
                <span className="vx-mut" style={{ fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"jv-pulse 1s infinite" }} /> Ouvindo…
                </span>
              )}
              {(fase === "confirmando" || (transcricao || inputTexto)) && pergunta.tipo !== "opcoes" && (
                <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => confirmar()}>
                  <Check size={13} /> Confirmar
                </button>
              )}
              {temMic && fase === "confirmando" && (
                <button className="vx-btn vx-btn-sm" onClick={repetir}>
                  <RotateCcw size={12} /> Falar de novo
                </button>
              )}
              {temMic && fase === "confirmando" && !micAtivo && (
                <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ fontSize:11.5 }} onClick={iniciarEscuta}>
                  🎤 Usar microfone
                </button>
              )}
            </div>
          </div>
        )}

        {fase === "montando" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Montando sua campanha…</div>
            <div className="vx-mut" style={{ fontSize:12.5 }}>Calculando valores por tarefa e orçamento</div>
          </div>
        )}

        {/* reiniciar */}
        {fase !== "intro" && fase !== "montando" && (
          <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ fontSize:11, marginTop:4 }} onClick={reiniciar}>
            <RotateCcw size={10} /> Recomeçar
          </button>
        )}
      </div>
    </>
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

          {/* Jarvas — wizard conversacional */}
          <div className="vx-card" style={{ padding: 20, marginTop: 4, borderColor: "var(--brand-200, var(--brand-100))", background: "linear-gradient(135deg, var(--brand-50) 0%, var(--indigo-50, var(--brand-50)) 100%)", borderWidth: 1.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>J</div>
              <b style={{ fontSize: 15 }}>Jarvas</b>
              <span className="vx-badge vx-badge-brand" style={{ fontSize: 11 }}>IA · Recomendado</span>
            </div>
            <JarvasVoice emp={emp} onCampanha={receberCampanhaDoJarvas} />
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
