// Página pública do quiz das empresas (app.rycs.pro/diagnostico), feita
// para o tráfego pago e pensada primeiro para o celular: 7 telas, resumo,
// contato campo a campo, escolha do horário e confirmação. A reserva cai na
// agenda interna (server/services/agendaComercial.js); quem atende não
// aparece para a empresa.
//
// Honestidade: nada de depoimento, número de clientes, vaga limitada ou
// contador. A confirmação só aparece depois de o servidor gravar a reserva.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, Clock, Globe, RefreshCw, ShieldCheck } from "lucide-react";
import { API_URL } from "../../lib/api.js";
import { eventoDiagnostico, dadosAgendamento, agendamentoConcluido } from "../../lib/rastreio.js";
import { PASSOS_QUIZ, PERGUNTAS_QUIZ, COMO_ACONTECE, icone3d } from "../../../shared/quizDiagnostico.js";
import "./DiagnosticoEmpresa.css";

const TOTAL = PASSOS_QUIZ.length;
const CHAVE = "rycs-diagnostico-v3";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Depois do quiz, a barra fica perto do fim: falta só agendar.
const FASES_FINAIS = { resumo: 0.95, contato: 0.96, horario: 0.98, confirmar: 0.99, agendado: 1 };
const ICONE_INTRO = "1f4c8";

const campoPorId = Object.fromEntries(PERGUNTAS_QUIZ.map((c) => [c.id, c]));
const opcaoDe = (respostas, id) => campoPorId[id]?.opcoes.find((o) => o.id === respostas[id]);
const passoCompleto = (passo, respostas) => passo.campos.every((c) => c.opcoes.some((o) => o.id === respostas[c.id]));

// Barra que anda rápido no começo e desacelera perto do fim: a pessoa sente
// que está quase acabando. O texto ao lado diz quantas telas faltam.
const progressoQuiz = (posicao) => 0.12 + 0.83 * (1 - Math.pow(1 - posicao / TOTAL, 1.7));

function preCarregar(passo) {
  if (!passo || typeof Image === "undefined") return;
  const codigos = [passo.icone, ...passo.campos.flatMap((c) => c.opcoes.map((o) => o.icone))].filter(Boolean);
  for (const c of codigos) { const img = new Image(); img.src = icone3d(c); }
}

// ── Datas ──────────────────────────────────────────────────────────────
const dois = (n) => String(n).padStart(2, "0");
const chaveDia = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`; };
const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const diaLongo = (ts) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const minutos = (h) => Math.round((h.fim - h.inicio) / 60000);
function nomeFuso(ts = Date.now()) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZoneName: "long" }).formatToParts(new Date(ts)).find((p) => p.type === "timeZoneName")?.value
      || Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
}
function rotuloDia(ts) {
  const hoje = chaveDia(Date.now());
  const amanha = chaveDia(Date.now() + 86400000);
  const d = new Date(ts);
  const semana = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const k = chaveDia(ts);
  return { topo: k === hoje ? "Hoje" : k === amanha ? "Amanhã" : semana, data };
}
const utc = (ts) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function baixarIcs(ag) {
  const texto = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RYCS//Agenda comercial//PT-BR", "BEGIN:VEVENT",
    `UID:${ag.id}@rycs.pro`, `DTSTAMP:${utc(Date.now())}`, `DTSTART:${utc(ag.inicio)}`, `DTEND:${utc(ag.fim)}`,
    "SUMMARY:Reunião com a RYCS", `DESCRIPTION:${COMO_ACONTECE.replace(/[,;]/g, (c) => `\\${c}`)}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([texto], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "reuniao-rycs.ics" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const linkGoogle = (ag) => `https://calendar.google.com/calendar/render?${new URLSearchParams({
  action: "TEMPLATE", text: "Reunião com a RYCS", dates: `${utc(ag.inicio)}/${utc(ag.fim)}`, details: COMO_ACONTECE,
})}`;

// ── Contato ────────────────────────────────────────────────────────────
const CAMPOS_CONTATO = [
  { campo: "nome", rotulo: "Qual é o seu nome?", tipo: "text", auto: "name", max: 120 },
  { campo: "empresa", rotulo: "Qual é o nome da sua empresa?", tipo: "text", auto: "organization", max: 160 },
  { campo: "telefone", rotulo: "Seu WhatsApp com DDD", tipo: "tel", auto: "tel-national", max: 16, modo: "tel", dica: "O especialista chama você por aqui." },
  { campo: "email", rotulo: "Seu melhor e-mail", tipo: "email", auto: "email", max: 254, modo: "email" },
];
function mascaraTelefone(v) {
  const d = String(v).replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function errosContato(c) {
  const e = {};
  if (c.nome.trim().length < 2) e.nome = "Informe seu nome.";
  if (c.empresa.trim().length < 2) e.empresa = "Informe o nome da empresa.";
  const d = c.telefone.replace(/\D/g, "").length;
  if (d < 10 || d > 11) e.telefone = "Informe o WhatsApp com DDD.";
  if (!EMAIL_RE.test(c.email.trim())) e.email = "Informe um e-mail válido.";
  return e;
}

// ── Personalização do resumo (só com o que a pessoa respondeu) ─────────
const ATIVIDADE = {
  "cobrar-vendedor": "vendem por ação verificada, sem você precisar cobrar",
  "meta-nao-batida": "trabalham por resultado, com cada ação verificada",
  "sem-resposta": "respondem rápido quem chama a sua empresa",
  "orcamentos-parados": "acompanham cada orçamento até o fechamento",
  "poucos-clientes": "trazem clientes novos para a sua empresa",
  "dono-sozinho": "assumem a rotina de vendas para você cuidar do negócio",
};
function pautaReuniao(r) {
  const itens = [`Como profissionais da RYCS ${ATIVIDADE[r.dor] || "reforçam suas vendas"}.`];
  itens.push("Quanto custa vender com a RYCS perto do que você paga (ou pagaria) por um vendedor.");
  const prazo = opcaoDe(r, "prazo");
  itens.push(prazo && r.prazo !== "sem-prazo" ? `O plano para resolver ${prazo.texto.toLowerCase()}.` : "O prazo realista para começar.");
  if (r.decisor === "socio") itens.push("Se quiser, traga seu sócio(a): a reunião fica completa para os dois.");
  if (r.decisor === "indico" || r.decisor === "diretoria") itens.push("O material para você levar a quem aprova.");
  return itens;
}

// ── Estado salvo na aba (sobrevive a recarregar, some ao fechar) ───────
const CONTATO_VAZIO = { nome: "", empresa: "", telefone: "", email: "" };
function restaurar() {
  const base = { fase: "intro", indice: 0, respostas: {}, contato: CONTATO_VAZIO, agendado: null, precadastro: null };
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
    if (!salvo || typeof salvo !== "object") return base;
    if (salvo.agendado?.id) return { ...base, fase: "agendado", agendado: salvo.agendado };
    const respostas = {};
    for (const c of PERGUNTAS_QUIZ) if (c.opcoes.some((o) => o.id === salvo.respostas?.[c.id])) respostas[c.id] = salvo.respostas[c.id];
    const completas = PASSOS_QUIZ.every((p) => passoCompleto(p, respostas));
    const precadastro = typeof salvo.precadastro?.id === "string" && typeof salvo.precadastro?.token === "string" ? salvo.precadastro : null;
    let fase = ["intro", "quiz", "resumo", "contato", "horario"].includes(salvo.fase) ? salvo.fase : salvo.fase === "confirmar" ? "horario" : "intro";
    if (!completas && !["intro", "quiz"].includes(fase)) fase = "quiz";
    if (!precadastro && fase === "horario") fase = "contato";
    return {
      ...base, respostas, fase, precadastro,
      indice: Math.min(Math.max(0, Number(salvo.indice) || 0), TOTAL - 1),
      contato: { ...CONTATO_VAZIO, ...(salvo.contato || {}) },
    };
  } catch { return base; }
}
const guardar = (valor) => { try { sessionStorage.setItem(CHAVE, JSON.stringify(valor)); } catch { /* aba sem armazenamento */ } };
const movimentoReduzido = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

async function chamar(caminho, corpo) {
  try {
    const r = await fetch(`${API_URL}/api${caminho}`, {
      method: corpo ? "POST" : "GET",
      headers: corpo ? { "Content-Type": "application/json" } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
      credentials: "include",
    });
    const dados = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, dados };
  } catch {
    return { ok: false, status: 0, dados: {} };
  }
}

export default function DiagnosticoEmpresa() {
  const inicial = useMemo(restaurar, []);
  const [fase, setFase] = useState(inicial.fase);
  const [indice, setIndice] = useState(inicial.indice);
  const [respostas, setRespostas] = useState(inicial.respostas);
  const [contato, setContato] = useState(inicial.contato);
  const [horario, setHorario] = useState(null);
  const [agendado, setAgendado] = useState(inicial.agendado);
  const [precadastro, setPrecadastro] = useState(inicial.precadastro);
  const [escolhendo, setEscolhendo] = useState(null);
  const tituloRef = useRef(null);
  const timer = useRef(null);
  const quizConcluido = useRef(false);

  useEffect(() => { eventoDiagnostico("ViewContent"); }, []);
  useEffect(() => {
    guardar(agendado ? { agendado } : { fase, indice, respostas, contato, precadastro });
  }, [fase, indice, respostas, contato, agendado, precadastro]);
  // A cada tela nova: topo da página e foco no título (leitor de tela lê a pergunta).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: movimentoReduzido() ? "auto" : "smooth" });
    tituloRef.current?.focus({ preventScroll: true });
  }, [fase, indice]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const passo = PASSOS_QUIZ[indice];
  // Elementos da próxima tela já ficam no cache: a troca não pisca.
  useEffect(() => {
    if (fase === "intro") preCarregar(PASSOS_QUIZ[0]);
    if (fase === "quiz") preCarregar(PASSOS_QUIZ[indice + 1]);
  }, [fase, indice]);

  const irPara = useCallback((novaFase, novoIndice) => {
    clearTimeout(timer.current);
    setEscolhendo(null);
    if (novoIndice != null) setIndice(novoIndice);
    setFase(novaFase);
  }, []);

  const avancar = useCallback((i) => {
    if (i < TOTAL - 1) return irPara("quiz", i + 1);
    if (!quizConcluido.current) {
      quizConcluido.current = true;
      eventoDiagnostico("QuizConcluido");
    }
    irPara("resumo");
  }, [irPara]);

  // Cards: escolhe e avança sozinho. Seletores: só marca; avança no botão.
  const escolher = useCallback((campoId, opcaoId) => {
    const i = indice;
    setRespostas((r) => ({ ...r, [campoId]: opcaoId }));
    if (PASSOS_QUIZ[i].tipo !== "cards") return;
    setEscolhendo(opcaoId);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => avancar(i), movimentoReduzido() ? 220 : 450);
  }, [indice, avancar]);

  function voltar() {
    if (fase === "quiz") return indice === 0 ? irPara("intro") : irPara("quiz", indice - 1);
    if (fase === "resumo") return irPara("quiz", TOTAL - 1);
    if (fase === "contato") return irPara("resumo");
    if (fase === "horario") return irPara("contato");
    if (fase === "confirmar") return irPara("horario");
  }

  // Teclado: 1–9 escolhem o card; Enter segue quando a tela está completa.
  useEffect(() => {
    if (fase !== "quiz") return undefined;
    const aoTeclar = (e) => {
      const alvo = e.target?.tagName || "";
      if (e.altKey || e.ctrlKey || e.metaKey || /^(input|textarea|select)$/i.test(alvo)) return;
      if (e.key === "Enter") {
        if (passoCompleto(passo, respostas) && !/^(button|a)$/i.test(alvo)) { e.preventDefault(); avancar(indice); }
        return;
      }
      if (passo.tipo !== "cards") return;
      const n = Number(e.key);
      const opcao = Number.isInteger(n) && n >= 1 ? passo.campos[0].opcoes[n - 1] : null;
      if (opcao) { e.preventDefault(); escolher(passo.campos[0].id, opcao.id); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [fase, passo, escolher, respostas, avancar, indice]);

  // Contato → pré-cadastro no servidor → horários.
  async function salvarContato(dados) {
    const { visitanteId, origem } = dadosAgendamento();
    const r = await chamar("/agenda-publica/precadastro", { ...dados, respostas, aceite: true, visitanteId, origem, ...(precadastro || {}) });
    if (!r.ok || !r.dados?.id) {
      return r.status === 0 ? "Sem conexão. Confira a internet e tente de novo." : (r.dados?.error || "Não foi possível salvar seus dados. Tente de novo.");
    }
    if (!precadastro) eventoDiagnostico("Lead");
    setContato(dados);
    setPrecadastro({ id: r.dados.id, token: r.dados.token });
    irPara("horario");
    return "";
  }
  const refazerContato = () => { setPrecadastro(null); irPara("contato"); };

  const posicao = fase === "quiz" ? indice + (escolhendo ? 1 : 0) : 0;
  const progresso = fase === "intro" ? 0 : fase === "quiz" ? progressoQuiz(posicao) : FASES_FINAIS[fase] ?? 0.95;
  const percentual = Math.round(progresso * 100);
  const faltam = TOTAL - indice;
  const statusTopo = fase === "intro" ? "Cerca de 1 minuto"
    : fase === "quiz" ? (faltam === 1 ? "Última pergunta!" : faltam <= 3 ? `Quase lá: faltam ${faltam}` : `Faltam só ${faltam}`)
    : fase === "agendado" ? "Reunião agendada"
    : fase === "resumo" ? "Raio-X pronto" : "Último passo";

  const tituloProps = { ref: tituloRef, tabIndex: -1, className: "vx-disp dg-titulo" };

  return (
    <div className="dg-pagina">
      <header className="dg-topo">
        <div className="dg-topo-linha">
          {fase !== "intro" && fase !== "agendado"
            ? <button type="button" className="dg-voltar" onClick={voltar}><ArrowLeft size={18} aria-hidden="true" /><span>Voltar</span></button>
            : <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine" className="dg-logo" onError={(e) => { e.currentTarget.hidden = true; }} />}
          <span className={`dg-topo-info${fase === "quiz" && faltam <= 3 ? " is-quase" : ""}`} aria-live="polite">{statusTopo}</span>
        </div>
        {fase !== "intro" && (
          <div className="dg-barra" role="progressbar" aria-label="Progresso do diagnóstico" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} aria-valuetext={`${percentual}% concluído`}>
            <div className="dg-barra-trilho"><div className="dg-barra-cheia" style={{ transform: `scaleX(${progresso})` }} /></div>
            <span className="dg-barra-valor">{percentual}%</span>
          </div>
        )}
      </header>

      <main className={`dg-corpo dg-fase-${fase}`}>
        <BannerTech fase={fase} progresso={progresso} faltam={faltam} />

        <section className="dg-cartao" key={`${fase}-${fase === "quiz" ? indice : ""}`}>
          {fase === "intro" && <Intro tituloProps={tituloProps} temProgresso={Object.keys(respostas).length > 0}
            onComecar={() => irPara("quiz", Math.max(0, PASSOS_QUIZ.findIndex((p) => !passoCompleto(p, respostas))))}
            onRecomecar={() => { setRespostas({}); irPara("quiz", 0); }} />}

          {fase === "quiz" && (
            <Pergunta tituloProps={tituloProps} passo={passo} indice={indice} respostas={respostas} escolhendo={escolhendo}
              onEscolher={escolher} onContinuar={() => avancar(indice)} />
          )}

          {fase === "resumo" && <Resumo tituloProps={tituloProps} respostas={respostas} onRever={() => irPara("quiz", 0)} onSeguir={() => irPara("contato")} />}

          {fase === "contato" && <Contato tituloProps={tituloProps} contato={contato} setContato={setContato} onSalvar={salvarContato} />}

          {fase === "horario" && <Horarios tituloProps={tituloProps} selecionado={horario}
            onEscolher={setHorario} onSeguir={() => irPara("confirmar")} />}

          {fase === "confirmar" && horario && (
            <Confirmar tituloProps={tituloProps} horario={horario} contato={contato} precadastro={precadastro}
              onAlterarContato={() => irPara("contato")} onAlterarHorario={() => irPara("horario")} onRefazer={refazerContato}
              onIndisponivel={() => { setHorario(null); irPara("horario"); }}
              onAgendado={(ag) => { setAgendado(ag); irPara("agendado"); }} />
          )}
          {fase === "confirmar" && !horario && <SemHorarioEscolhido onVoltar={() => irPara("horario")} tituloProps={tituloProps} />}

          {fase === "agendado" && agendado && <Agendado tituloProps={tituloProps} ag={agendado} />}
        </section>
      </main>
    </div>
  );
}

// Painel escuro com grade e um gráfico de vendas que sobe com o progresso
// (só em telas grandes; no celular fica tudo no cartão). Ilustrativo: não
// mostra número nenhum.
function BannerTech({ fase, progresso, faltam }) {
  const texto = fase === "intro"
    ? { kicker: "RYCS Sales Machine", titulo: "Raio-X de vendas", frase: "Profissionais de vendas pagos por ação verificada." }
    : fase === "quiz"
      ? { kicker: "Diagnóstico em andamento", titulo: faltam === 1 ? "Última pergunta" : `Faltam ${faltam}`, frase: "Cada resposta afina o seu plano de vendas." }
      : fase === "agendado"
        ? { kicker: "Tudo certo", titulo: "Reunião agendada", frase: "O especialista já tem o seu raio-X." }
        : { kicker: "Raio-X concluído", titulo: "Agora, a reunião", frase: "Um especialista monta o plano com você." };
  const desenho = fase === "intro" ? 1 : Math.max(0.15, progresso);
  const recorte = { clipPath: `inset(0 ${100 - desenho * 100}% 0 0)` };
  return (
    <aside className="dg-banner" aria-hidden="true">
      <svg className="dg-banner-grafico" viewBox="0 0 400 160" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dg-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".45" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="dg-banner-area" d="M0 150 L40 138 L80 142 L120 118 L160 124 L200 96 L240 100 L280 70 L320 74 L360 38 L400 20 L400 160 L0 160 Z" fill="url(#dg-area)" style={recorte} />
        <path className="dg-banner-linha" d="M0 150 L40 138 L80 142 L120 118 L160 124 L200 96 L240 100 L280 70 L320 74 L360 38 L400 20" style={recorte} />
      </svg>
      <div className="dg-banner-texto">
        <span className="dg-banner-kicker"><span className="dg-banner-ponto" />{texto.kicker}</span>
        <strong className="vx-disp">{texto.titulo}</strong>
        <span className="dg-banner-frase">{texto.frase}</span>
      </div>
    </aside>
  );
}

function Icone3d({ codigo, tamanho = 56, className = "" }) {
  return <img className={`dg-3d ${className}`} src={icone3d(codigo)} alt="" width={tamanho} height={tamanho} decoding="async" draggable="false" />;
}

function Intro({ tituloProps, onComecar, onRecomecar, temProgresso }) {
  return (
    <div className="dg-intro">
      <div className="dg-intro-hero" aria-hidden="true"><Icone3d codigo={ICONE_INTRO} tamanho={112} /></div>
      <span className="dg-selo">Diagnóstico de vendas gratuito</span>
      <h1 {...tituloProps}>Descubra o que está travando suas vendas</h1>
      <p className="dg-texto">7 perguntas rápidas. No fim, você agenda uma reunião com um especialista da RYCS.</p>
      <div className="dg-rodape-pergunta">
        <button type="button" className="vx-btn vx-btn-primary dg-cta dg-cta-pulso" onClick={onComecar}>
          {temProgresso ? "Continuar de onde parei" : "Começar agora"} <ArrowRight size={18} aria-hidden="true" />
        </button>
        {temProgresso && <button type="button" className="dg-link" onClick={onRecomecar}>Começar do zero</button>}
      </div>
      <p className="dg-nota"><ShieldCheck size={15} aria-hidden="true" /> Sem cadastro para começar.</p>
    </div>
  );
}

function Pergunta({ tituloProps, passo, indice, respostas, escolhendo, onEscolher, onContinuar }) {
  const idTitulo = `dg-pergunta-${passo.id}`;
  const completo = passoCompleto(passo, respostas);
  return (
    <>
      <p className="dg-kicker">Pergunta {indice + 1} de {TOTAL}</p>
      <h1 {...tituloProps} id={idTitulo}>{passo.titulo}</h1>
      <p className="dg-texto">{passo.ajuda}</p>

      {passo.tipo === "cards" ? (
        <div role="group" aria-labelledby={idTitulo} className={`dg-cards${escolhendo ? " tem-escolha" : ""}`}>
          {passo.campos[0].opcoes.map((o, k) => {
            const marcada = respostas[passo.campos[0].id] === o.id;
            return (
              <button key={o.id} type="button" aria-pressed={marcada} style={{ "--ordem": k }}
                className={`dg-card${marcada ? " is-marcada" : ""}${escolhendo === o.id ? " is-escolhendo" : ""}`}
                onClick={() => onEscolher(passo.campos[0].id, o.id)}>
                <span className="dg-card-icone" aria-hidden="true"><Icone3d codigo={o.icone} /></span>
                <span className="dg-card-textos">
                  <strong>{o.texto}</strong>
                  {o.detalhe && <small>{o.detalhe}</small>}
                </span>
                <span className="dg-card-marca" aria-hidden="true">{marcada ? <Check size={14} strokeWidth={3} /> : <kbd>{k + 1}</kbd>}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dg-seletores">
          {passo.icone && <div className="dg-seletores-icone" aria-hidden="true"><Icone3d codigo={passo.icone} tamanho={64} /></div>}
          {passo.campos.map((c) => {
            const idRotulo = `dg-campo-${c.id}`;
            return (
              <div key={c.id} className={`dg-seletor${respostas[c.id] ? " is-respondido" : ""}`}>
                <span className="dg-seletor-rotulo" id={idRotulo}>{respostas[c.id] && <Check size={14} strokeWidth={3} aria-hidden="true" />}{c.titulo}</span>
                <div className="dg-chips" role="group" aria-labelledby={idRotulo}>
                  {c.opcoes.map((o) => {
                    const marcada = respostas[c.id] === o.id;
                    return (
                      <button key={o.id} type="button" aria-pressed={marcada} className={`dg-chip${marcada ? " is-marcada" : ""}`}
                        onClick={() => onEscolher(c.id, o.id)}>{o.texto}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="dg-rodape-pergunta">
        {passo.tipo === "seletores" ? (
          <button type="button" className={`vx-btn vx-btn-primary dg-cta${completo ? " dg-cta-pulso" : ""}`} disabled={!completo} onClick={onContinuar}>
            {completo ? (indice === TOTAL - 1 ? "Ver meu raio-X" : "Continuar") : "Escolha uma opção em cada linha"} <ArrowRight size={18} aria-hidden="true" />
          </button>
        ) : completo && !escolhendo
          ? <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={onContinuar}>{indice === TOTAL - 1 ? "Ver meu raio-X" : "Continuar"} <ArrowRight size={18} aria-hidden="true" /></button>
          : <p className="dg-dica" role="status">{escolhendo ? "Boa! Indo para a próxima…" : "Toque na opção que mais combina com você."}</p>}
      </div>
    </>
  );
}

function Resumo({ tituloProps, respostas, onRever, onSeguir }) {
  const linhas = [
    ["O que trava", "dor"], ["Prazo para resolver", "prazo"], ["Ticket médio", "ticket"], ["Vendas por mês", "vendas-mes"],
  ].map(([rotulo, id]) => ({ rotulo, opcao: opcaoDe(respostas, id), icone: opcaoDe(respostas, id)?.icone || campoPorId[id]?.icone })).filter((l) => l.opcao);
  return (
    <>
      <span className="dg-selo dg-selo-ok"><Check size={14} strokeWidth={3} aria-hidden="true" /> Raio-X pronto</span>
      <h1 {...tituloProps}>Este é o retrato das suas vendas hoje</h1>
      <p className="dg-texto">O especialista recebe todas as respostas e chega à reunião preparado.</p>
      <ul className="dg-resumo">
        {linhas.map((l) => (
          <li key={l.rotulo}>
            {l.icone && <Icone3d codigo={l.icone} tamanho={40} />}
            <div><small>{l.rotulo}</small><strong>{l.opcao.texto}</strong></div>
          </li>
        ))}
      </ul>
      <h2 className="dg-subtitulo">Na reunião, vamos falar sobre</h2>
      <ul className="dg-pauta">{pautaReuniao(respostas).map((t) => <li key={t}><Check size={16} strokeWidth={2.5} aria-hidden="true" />{t}</li>)}</ul>
      <div className="dg-aviso"><Clock size={18} aria-hidden="true" /><p>{COMO_ACONTECE} A reunião não tem custo.</p></div>
      <button type="button" className="vx-btn vx-btn-primary dg-cta dg-cta-pulso" onClick={onSeguir}>Agendar minha reunião <ArrowRight size={18} aria-hidden="true" /></button>
      <button type="button" className="dg-link" onClick={onRever}>Revisar minhas respostas</button>
    </>
  );
}

// Um campo por vez: preencheu, aparece o próximo.
function Contato({ tituloProps, contato, setContato, onSalvar }) {
  const erros = errosContato(contato);
  const [visiveis, setVisiveis] = useState(() => {
    const prontos = CAMPOS_CONTATO.findIndex((c) => erros[c.campo]);
    return prontos === -1 ? CAMPOS_CONTATO.length : prontos + 1;
  });
  const [mostrarErro, setMostrarErro] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroServidor, setErroServidor] = useState("");
  const atual = CAMPOS_CONTATO[visiveis - 1];
  const ultimo = visiveis === CAMPOS_CONTATO.length;
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) { primeiraRenderizacao.current = false; return; }
    document.getElementById(`dg-${atual.campo}`)?.focus();
  }, [visiveis]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(e) {
    e.preventDefault();
    if (salvando) return;
    if (!ultimo) {
      if (erros[atual.campo]) { setMostrarErro((m) => ({ ...m, [atual.campo]: true })); return; }
      setVisiveis((v) => v + 1);
      return;
    }
    const comErro = CAMPOS_CONTATO.find((c) => erros[c.campo]);
    if (comErro) {
      setMostrarErro((m) => ({ ...m, [comErro.campo]: true }));
      document.getElementById(`dg-${comErro.campo}`)?.focus();
      return;
    }
    setSalvando(true);
    setErroServidor("");
    const erro = await onSalvar({ nome: contato.nome.trim(), empresa: contato.empresa.trim(), telefone: contato.telefone, email: contato.email.trim() });
    setSalvando(false);
    if (erro) setErroServidor(erro);
  }

  return (
    <>
      <p className="dg-kicker">Quase lá · {visiveis} de {CAMPOS_CONTATO.length}</p>
      <h1 {...tituloProps}>Para quem é a reunião?</h1>
      <p className="dg-texto">Com estes dados o especialista prepara a reunião e fala com você no horário escolhido.</p>
      <form onSubmit={enviar} noValidate className="dg-form">
        {CAMPOS_CONTATO.slice(0, visiveis).map((c, k) => {
          const erro = mostrarErro[c.campo] && erros[c.campo];
          return (
            <div key={c.campo} className={`dg-campo${k === visiveis - 1 ? " is-atual" : ""}`}>
              <label htmlFor={`dg-${c.campo}`}>{c.rotulo}</label>
              <input id={`dg-${c.campo}`} className="vx-input" type={c.tipo} autoComplete={c.auto} inputMode={c.modo} maxLength={c.max}
                enterKeyHint={k === CAMPOS_CONTATO.length - 1 ? "done" : "next"} autoFocus={k === 0 && !contato.nome}
                value={contato[c.campo]} aria-invalid={!!erro}
                aria-describedby={erro ? `dg-${c.campo}-erro` : c.dica ? `dg-${c.campo}-dica` : undefined}
                onBlur={() => contato[c.campo] && setMostrarErro((m) => ({ ...m, [c.campo]: true }))}
                onChange={(e) => setContato((v) => ({ ...v, [c.campo]: c.campo === "telefone" ? mascaraTelefone(e.target.value) : e.target.value }))} />
              {erro
                ? <span className="dg-erro" id={`dg-${c.campo}-erro`}>{erros[c.campo]}</span>
                : c.dica && <span className="dg-campo-dica" id={`dg-${c.campo}-dica`}>{c.dica}</span>}
            </div>
          );
        })}
        {erroServidor && <p className="dg-alerta" role="alert">{erroServidor}</p>}
        <button type="submit" className="vx-btn vx-btn-primary dg-cta" disabled={salvando} aria-busy={salvando}>
          {salvando ? <><span className="dg-girando" aria-hidden="true" /> Salvando…</>
            : <>{ultimo ? "Ver horários livres" : "Continuar"} <ArrowRight size={18} aria-hidden="true" /></>}
        </button>
      </form>
      <p className="dg-nota"><ShieldCheck size={15} aria-hidden="true" /><span>Ao continuar, você autoriza a RYCS a usar estes dados e as suas respostas para falar com você e preparar a reunião, conforme a <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></p>
    </>
  );
}

function Horarios({ tituloProps, selecionado, onEscolher, onSeguir }) {
  const [estado, setEstado] = useState({ carregando: true, erro: "", lista: [] });
  const [dia, setDia] = useState(null);
  const carregar = useCallback(async () => {
    setEstado((s) => ({ ...s, carregando: true, erro: "" }));
    const r = await chamar("/agenda-publica/horarios");
    if (!r.ok || !Array.isArray(r.dados.horarios)) {
      setEstado({ carregando: false, erro: r.status === 0 ? "Sem conexão com a agenda. Confira sua internet e tente de novo." : (r.dados.error || "Não foi possível carregar os horários."), lista: [] });
      return;
    }
    setEstado({ carregando: false, erro: "", lista: r.dados.horarios });
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const dias = useMemo(() => {
    const mapa = new Map();
    for (const h of estado.lista) {
      const k = chaveDia(h.inicio);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(h);
    }
    return [...mapa.entries()].map(([chave, itens]) => ({ chave, itens }));
  }, [estado.lista]);

  // Mantém a escolha só se o horário continuar livre na lista nova.
  useEffect(() => {
    if (estado.carregando) return;
    const aindaLivre = selecionado && estado.lista.some((h) => h.inicio === selecionado.inicio && h.fim === selecionado.fim);
    if (selecionado && !aindaLivre) onEscolher(null);
    const diaValido = dias.some((d) => d.chave === dia);
    if (!diaValido) setDia(aindaLivre ? chaveDia(selecionado.inicio) : dias[0]?.chave ?? null);
  }, [estado, dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const doDia = dias.find((d) => d.chave === dia)?.itens || [];
  return (
    <>
      <p className="dg-kicker">Agendar reunião</p>
      <h1 {...tituloProps}>Escolha o melhor horário</h1>
      <p className="dg-texto dg-fuso"><Globe size={16} aria-hidden="true" /> Horários em {nomeFuso()}.</p>

      {estado.carregando && (
        <div role="status" aria-live="polite" className="dg-carregando">
          <span className="dg-sr">Buscando horários livres…</span>
          <div className="dg-esqueleto dg-esqueleto-dias" aria-hidden="true">{[0, 1, 2, 3].map((k) => <span key={k} />)}</div>
          <div className="dg-esqueleto dg-esqueleto-horas" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((k) => <span key={k} />)}</div>
        </div>
      )}

      {!estado.carregando && estado.erro && (
        <div className="dg-estado" role="alert">
          <Icone3d codigo="26a0-fe0f" tamanho={48} />
          <strong>Não conseguimos abrir a agenda</strong>
          <p>{estado.erro}</p>
          <button type="button" className="vx-btn vx-btn-ghost" onClick={carregar}><RefreshCw size={16} aria-hidden="true" /> Tentar de novo</button>
        </div>
      )}

      {!estado.carregando && !estado.erro && !dias.length && (
        <div className="dg-estado" role="status">
          <Icone3d codigo="1f4c5" tamanho={48} />
          <strong>Nenhum horário livre agora</strong>
          <p>A equipe da RYCS abre novos horários ao longo da semana. Suas respostas e seus dados ficam salvos nesta aba: atualize mais tarde para agendar.</p>
          <button type="button" className="vx-btn vx-btn-ghost" onClick={carregar}><RefreshCw size={16} aria-hidden="true" /> Atualizar horários</button>
        </div>
      )}

      {!estado.carregando && !estado.erro && dias.length > 0 && (
        <>
          <h2 className="dg-subtitulo" id="dg-dias">Dia</h2>
          <div className="dg-dias" role="group" aria-labelledby="dg-dias">
            {dias.map((d) => {
              const r = rotuloDia(d.itens[0].inicio);
              return (
                <button key={d.chave} type="button" aria-pressed={dia === d.chave} className={`dg-dia${dia === d.chave ? " is-marcada" : ""}`}
                  onClick={() => setDia(d.chave)} aria-label={`${diaLongo(d.itens[0].inicio)}, ${d.itens.length} ${d.itens.length === 1 ? "horário" : "horários"}`}>
                  <small>{r.topo}</small><strong>{r.data}</strong><span>{d.itens.length} {d.itens.length === 1 ? "horário" : "horários"}</span>
                </button>
              );
            })}
          </div>
          <h2 className="dg-subtitulo" id="dg-horas">{dia ? diaLongo(doDia[0]?.inicio) : "Horário"}</h2>
          <div className="dg-horas" role="group" aria-labelledby="dg-horas">
            {doDia.map((h) => {
              const marcado = selecionado?.inicio === h.inicio && selecionado?.fim === h.fim;
              return (
                <button key={`${h.inicio}-${h.fim}`} type="button" aria-pressed={marcado} className={`dg-hora${marcado ? " is-marcada" : ""}`}
                  onClick={() => onEscolher({ inicio: h.inicio, fim: h.fim })}>
                  <strong>{hora(h.inicio)}</strong><small>{minutos(h)} min</small>
                </button>
              );
            })}
          </div>
          <div className="dg-rodape-pergunta">
            <button type="button" className="vx-btn vx-btn-primary dg-cta" disabled={!selecionado} onClick={onSeguir}>
              {selecionado ? `Continuar · ${rotuloDia(selecionado.inicio).topo}, ${rotuloDia(selecionado.inicio).data} às ${hora(selecionado.inicio)}` : "Escolha um horário"} <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="dg-link" onClick={carregar}><RefreshCw size={14} aria-hidden="true" /> Atualizar horários</button>
          </div>
        </>
      )}
    </>
  );
}

function Confirmar({ tituloProps, horario, contato, precadastro, onAlterarContato, onAlterarHorario, onRefazer, onIndisponivel, onAgendado }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const enviandoRef = useRef(false);
  async function confirmar() {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro("");
    const rastreio = dadosAgendamento();
    const r = await chamar("/agenda-publica/reservas", { ...precadastro, inicio: horario.inicio, fim: horario.fim, ...rastreio });
    enviandoRef.current = false;
    setEnviando(false);
    if (r.ok && r.dados?.id) {
      agendamentoConcluido(rastreio.meta.eventId, contato);
      onAgendado({ ...r.dados, nome: contato.nome, empresa: contato.empresa, email: contato.email, telefone: contato.telefone });
      return;
    }
    if (r.dados?.codigo === "PRECADASTRO_INVALIDO") { onRefazer(); return; }
    if (r.dados?.codigo === "HORARIO_INDISPONIVEL") {
      setErro(r.dados.error);
      setTimeout(onIndisponivel, 1800);
      return;
    }
    setErro(r.status === 0 ? "Sem conexão. Sua reserva não foi feita; confira a internet e tente de novo." : (r.dados?.error || "Não foi possível confirmar. Sua reserva não foi feita; tente de novo."));
  }
  return (
    <>
      <p className="dg-kicker">Agendar reunião · confirmação</p>
      <h1 {...tituloProps}>Confira e confirme</h1>
      <p className="dg-texto">A reserva só vale depois que você confirmar.</p>
      <dl className="dg-confere">
        <div><dt>Data</dt><dd className="dg-data">{diaLongo(horario.inicio)}</dd></div>
        <div><dt>Horário</dt><dd>{hora(horario.inicio)} às {hora(horario.fim)} · {minutos(horario)} min</dd></div>
        <div><dt>Fuso</dt><dd>{nomeFuso(horario.inicio)}</dd></div>
        <div className="dg-confere-acao"><button type="button" className="dg-link" onClick={onAlterarHorario} disabled={enviando}>Alterar horário</button></div>
        <div><dt>Nome</dt><dd>{contato.nome}</dd></div>
        <div><dt>Empresa</dt><dd>{contato.empresa}</dd></div>
        <div><dt>WhatsApp</dt><dd>{contato.telefone}</dd></div>
        <div><dt>E-mail</dt><dd>{contato.email}</dd></div>
        <div className="dg-confere-acao"><button type="button" className="dg-link" onClick={onAlterarContato} disabled={enviando}>Alterar dados</button></div>
      </dl>
      <div className="dg-aviso"><Clock size={18} aria-hidden="true" /><p>{COMO_ACONTECE}</p></div>
      {erro && <p className="dg-alerta" role="alert">{erro}</p>}
      <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={confirmar} disabled={enviando} aria-busy={enviando}>
        {enviando ? <><span className="dg-girando" aria-hidden="true" /> Confirmando…</> : <>Confirmar reunião <Check size={18} strokeWidth={2.5} aria-hidden="true" /></>}
      </button>
    </>
  );
}

function SemHorarioEscolhido({ tituloProps, onVoltar }) {
  return (
    <>
      <h1 {...tituloProps}>Escolha um horário</h1>
      <p className="dg-texto">Ainda falta escolher o horário da reunião.</p>
      <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={onVoltar}>Ver horários</button>
    </>
  );
}

function Agendado({ tituloProps, ag }) {
  return (
    <>
      <div className="dg-sucesso-icone" aria-hidden="true"><Icone3d codigo="2705" tamanho={72} /></div>
      <h1 {...tituloProps}>Reunião agendada!</h1>
      <p className="dg-texto">{ag.nome ? `${ag.nome.split(" ")[0]}, está tudo certo.` : "Está tudo certo."} Um especialista da RYCS já tem as suas respostas.</p>
      <div className="dg-ingresso">
        <strong className="vx-disp">{diaLongo(ag.inicio)}</strong>
        <span className="dg-ingresso-hora">{hora(ag.inicio)} às {hora(ag.fim)}</span>
        <span>{minutos(ag)} minutos · {nomeFuso(ag.inicio)}</span>
      </div>
      <h2 className="dg-subtitulo">Como vai acontecer</h2>
      <p className="dg-texto">{COMO_ACONTECE}{ag.telefone ? ` Número informado: ${ag.telefone}.` : ""}</p>
      <h2 className="dg-subtitulo">Para aproveitar melhor</h2>
      <ul className="dg-pauta">
        <li><Check size={16} strokeWidth={2.5} aria-hidden="true" />Tenha à mão o valor médio de uma venda e quantas vendas vocês fazem por mês.</li>
        <li><Check size={16} strokeWidth={2.5} aria-hidden="true" />Se alguém decide com você, convide para participar.</li>
      </ul>
      <div className="dg-calendario">
        <button type="button" className="vx-btn vx-btn-ghost" onClick={() => baixarIcs(ag)}><CalendarPlus size={18} aria-hidden="true" /> Salvar no calendário</button>
        <a className="vx-btn vx-btn-ghost" href={linkGoogle(ag)} target="_blank" rel="noreferrer">Google Agenda</a>
      </div>
      <p className="dg-nota"><span>Não enviamos convite automático: guarde o horário. Precisa mudar? Avise o especialista quando ele chamar você ou fale com a RYCS em <a href="https://rycs.pro" target="_blank" rel="noreferrer">rycs.pro</a>.</span></p>
    </>
  );
}
