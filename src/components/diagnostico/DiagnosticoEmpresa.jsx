// Página pública do quiz das empresas (app.rycs.pro/diagnostico), feita
// para o tráfego pago: uma pergunta por tela, resumo das respostas, dados de
// contato, escolha do horário e confirmação. A reserva cai na agenda interna
// do closer (server/services/agendaComercial.js).
//
// Honestidade: nada de depoimento, número de clientes, vaga limitada ou
// contador. A confirmação só aparece depois de o servidor gravar a reserva.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, Clock, Globe, RefreshCw, ShieldCheck } from "lucide-react";
import { API_URL } from "../../lib/api.js";
import { eventoDiagnostico, dadosAgendamento, agendamentoConcluido } from "../../lib/rastreio.js";
import { PERGUNTAS_QUIZ, ETAPAS_QUIZ, COMO_ACONTECE } from "../../../shared/quizDiagnostico.js";
import "./DiagnosticoEmpresa.css";

const TOTAL = PERGUNTAS_QUIZ.length;
const CHAVE = "rycs-diagnostico-v1";
const FOTO_INTRO = { src: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=70", alt: "Equipe conversando em volta de uma mesa de trabalho" };
const FOTO_AGENDA = { src: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1200&q=70", alt: "Agenda de papel aberta com metas do mês e calendário" };
const PASSOS = [...ETAPAS_QUIZ.map((e) => e.titulo), "Agendar"];
const FASES_AGENDA = { resumo: 0.1, contato: 0.35, horario: 0.65, confirmar: 0.9, agendado: 1 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const perguntaPorId = Object.fromEntries(PERGUNTAS_QUIZ.map((p) => [p.id, p]));
const textoDe = (respostas, id) => perguntaPorId[id]?.opcoes.find((o) => o.id === respostas[id]);
const inicioEtapa = ETAPAS_QUIZ.map((e) => PERGUNTAS_QUIZ.findIndex((p) => p.etapa === e.chave));
const tamanhoEtapa = ETAPAS_QUIZ.map((e) => PERGUNTAS_QUIZ.filter((p) => p.etapa === e.chave).length);

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
    "SUMMARY:Conversa com a RYCS", `DESCRIPTION:${COMO_ACONTECE.replace(/[,;]/g, (c) => `\\${c}`)}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([texto], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "conversa-rycs.ics" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const linkGoogle = (ag) => `https://calendar.google.com/calendar/render?${new URLSearchParams({
  action: "TEMPLATE", text: "Conversa com a RYCS", dates: `${utc(ag.inicio)}/${utc(ag.fim)}`, details: COMO_ACONTECE,
})}`;

// ── Contato ────────────────────────────────────────────────────────────
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
  if (c.empresa.trim().length < 2) e.empresa = "Informe o nome da empresa.";
  if (c.nome.trim().length < 2) e.nome = "Informe seu nome.";
  if (!EMAIL_RE.test(c.email.trim())) e.email = "Informe um e-mail válido.";
  const d = c.telefone.replace(/\D/g, "").length;
  if (d < 10 || d > 11) e.telefone = "Informe o WhatsApp com DDD.";
  return e;
}

// ── Personalização do resumo (só com o que a pessoa respondeu) ─────────
const MERCADO = {
  climatizacao: "empresas de climatização", turismo: "agências de turismo", educacao: "escolas e cursos",
  estetica: "clínicas e espaços de estética", piscinas: "lojas de piscinas", distribuidora: "distribuidoras",
  servicos: "empresas de serviços", varejo: "lojas", saude: "empresas de saúde", outro: "o seu mercado",
};
const ATIVIDADE = {
  prospeccao: "prospectam novos clientes", atendimento: "respondem rápido quem chama a empresa",
  agendamento: "qualificam contatos e marcam reuniões", acompanhamento: "acompanham orçamentos até o fechamento",
  fechamento: "negociam e fecham vendas", visitas: "visitam clientes na sua região", "sem-trava": "ampliam o que já funciona nas suas vendas",
};
function pautaConversa(r) {
  const itens = [`Como profissionais da RYCS ${ATIVIDADE[r.gargalo] || "reforçam suas vendas"} em ${MERCADO[r.segmento] || "o seu mercado"}.`];
  const ticket = textoDe(r, "ticket");
  itens.push(r.ticket && r.ticket !== "na-conversa"
    ? `Quanto faz sentido pagar por resultado com vendas de ${ticket.texto.replace(/^De /, "").replace(/^Até/, "até").replace(/^Acima/, "acima")}.`
    : "Quanto faz sentido pagar por resultado, a partir do valor médio das suas vendas.");
  const inicio = textoDe(r, "inicio");
  itens.push(r.inicio && r.inicio !== "nao-sei"
    ? `Os próximos passos para a primeira campanha começar ${inicio.texto.toLowerCase()}.`
    : "Os próximos passos e o prazo realista para a primeira campanha.");
  if (r.decisor === "socio") itens.push("Se quiser, traga seu sócio(a): a conversa fica completa para os dois.");
  if (r.decisor === "recomendo" || r.decisor === "comite") itens.push("O que você precisa levar para quem aprova a contratação.");
  return itens;
}

// ── Estado salvo na aba (sobrevive a recarregar, some ao fechar) ───────
const CONTATO_VAZIO = { empresa: "", nome: "", email: "", telefone: "" };
function restaurar() {
  const base = { fase: "intro", indice: 0, respostas: {}, contato: CONTATO_VAZIO, horario: null, agendado: null };
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
    if (!salvo || typeof salvo !== "object") return base;
    if (salvo.agendado?.id) return { ...base, fase: "agendado", agendado: salvo.agendado };
    const respostas = {};
    for (const p of PERGUNTAS_QUIZ) if (p.opcoes.some((o) => o.id === salvo.respostas?.[p.id])) respostas[p.id] = salvo.respostas[p.id];
    const completas = Object.keys(respostas).length === TOTAL;
    const fase = ["intro", "quiz", "resumo", "contato", "horario"].includes(salvo.fase) ? salvo.fase : salvo.fase === "confirmar" ? "horario" : "intro";
    return {
      ...base, respostas,
      fase: !completas && fase !== "intro" && fase !== "quiz" ? "quiz" : fase,
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
  const [escolhendo, setEscolhendo] = useState(null);
  const tituloRef = useRef(null);
  const timer = useRef(null);
  const quizConcluido = useRef(false);

  useEffect(() => { eventoDiagnostico("ViewContent"); }, []);
  useEffect(() => {
    guardar(agendado ? { agendado } : { fase, indice, respostas, contato });
  }, [fase, indice, respostas, contato, agendado]);
  // A cada tela nova: topo da página e foco no título (leitor de tela lê a pergunta).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: movimentoReduzido() ? "auto" : "smooth" });
    tituloRef.current?.focus({ preventScroll: true });
  }, [fase, indice]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pergunta = PERGUNTAS_QUIZ[indice];
  const etapaAtual = fase === "quiz" ? ETAPAS_QUIZ.findIndex((e) => e.chave === pergunta.etapa) : fase === "intro" ? -1 : ETAPAS_QUIZ.length;

  // Pré-carrega a foto da próxima etapa para a troca não piscar.
  useEffect(() => {
    const proxima = ETAPAS_QUIZ[etapaAtual + 1]?.foto || FOTO_AGENDA.src;
    const img = new Image();
    img.src = proxima;
  }, [etapaAtual]);

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

  const escolher = useCallback((opcaoId) => {
    const i = indice;
    const p = PERGUNTAS_QUIZ[i];
    setRespostas((r) => ({ ...r, [p.id]: opcaoId }));
    setEscolhendo(opcaoId);
    clearTimeout(timer.current);
    // Pausa curta para a pessoa ver a escolha marcada antes de avançar.
    timer.current = setTimeout(() => avancar(i), movimentoReduzido() ? 220 : 420);
  }, [indice, avancar]);

  function voltar() {
    if (fase === "quiz") return indice === 0 ? irPara("intro") : irPara("quiz", indice - 1);
    if (fase === "resumo") return irPara("quiz", TOTAL - 1);
    if (fase === "contato") return irPara("resumo");
    if (fase === "horario") return irPara("contato");
    if (fase === "confirmar") return irPara("horario");
  }

  // Atalho de teclado: 1–9 (e 0 para a décima) escolhem a opção.
  useEffect(() => {
    if (fase !== "quiz") return undefined;
    const aoTeclar = (e) => {
      const alvo = e.target?.tagName || "";
      if (e.altKey || e.ctrlKey || e.metaKey || /^(input|textarea|select)$/i.test(alvo)) return;
      // Enter num botão é clique do próprio botão; fora dele, segue adiante.
      if (e.key === "Enter") {
        if (respostas[pergunta.id] && !/^(button|a)$/i.test(alvo)) { e.preventDefault(); avancar(indice); }
        return;
      }
      const n = e.key === "0" ? 10 : Number(e.key);
      const opcao = Number.isInteger(n) && n >= 1 ? pergunta.opcoes[n - 1] : null;
      if (opcao) { e.preventDefault(); escolher(opcao.id); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [fase, pergunta, escolher, respostas, avancar, indice]);

  // Progresso: posição real no quiz, por etapa.
  const preenchimento = ETAPAS_QUIZ.map((_, k) => {
    if (fase === "intro") return 0;
    if (fase !== "quiz") return 1;
    return Math.min(1, Math.max(0, (indice - inicioEtapa[k]) / tamanhoEtapa[k]));
  }).concat(fase === "intro" || fase === "quiz" ? 0 : FASES_AGENDA[fase] ?? 0);
  const percentual = Math.round(preenchimento.reduce((s, v) => s + v, 0) / PASSOS.length * 100);

  const foto = fase === "intro" ? FOTO_INTRO
    : fase === "quiz" ? { src: ETAPAS_QUIZ[etapaAtual].foto, alt: ETAPAS_QUIZ[etapaAtual].alt }
    : FOTO_AGENDA;
  const etapaInfo = fase === "intro"
    ? { kicker: "Diagnóstico comercial", titulo: "Vendas por ação verificada", frase: "Escale vendas sem montar equipe." }
    : fase === "quiz"
      ? { kicker: `Etapa ${etapaAtual + 1} de ${PASSOS.length}`, titulo: ETAPAS_QUIZ[etapaAtual].titulo, frase: ETAPAS_QUIZ[etapaAtual].frase }
      : fase === "agendado"
        ? { kicker: "Tudo certo", titulo: "Conversa agendada", frase: "O especialista já tem suas respostas." }
        : { kicker: `Etapa ${PASSOS.length} de ${PASSOS.length}`, titulo: "Agendar", frase: "Escolha quando conversar com um especialista." };

  const tituloProps = { ref: tituloRef, tabIndex: -1, className: "vx-disp dg-titulo" };

  return (
    <div className="dg-pagina">
      <header className="dg-topo">
        <div className="dg-topo-linha">
          {fase !== "intro" && fase !== "agendado"
            ? <button type="button" className="dg-voltar" onClick={voltar}><ArrowLeft size={18} aria-hidden="true" /><span>Voltar</span></button>
            : <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine" className="dg-logo" onError={(e) => { e.currentTarget.hidden = true; }} />}
          <span className="dg-topo-info" aria-live="polite">
            {fase === "intro" ? "Cerca de 2 minutos"
              : fase === "quiz" ? `Pergunta ${indice + 1} de ${TOTAL}`
              : fase === "agendado" ? "Agendamento confirmado"
              : "Último passo"}
          </span>
        </div>
        <div className="dg-progresso" role="progressbar" aria-label="Progresso do diagnóstico" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} aria-valuetext={`${percentual}% concluído`}>
          {PASSOS.map((nome, k) => (
            <div key={nome} className={`dg-passo${k === etapaAtual ? " is-atual" : ""}${preenchimento[k] >= 1 ? " is-feito" : ""}`}>
              <div className="dg-passo-trilho"><div className="dg-passo-barra" style={{ transform: `scaleX(${preenchimento[k]})` }} /></div>
              <span className="dg-passo-nome">{preenchimento[k] >= 1 && <Check size={12} strokeWidth={3} aria-hidden="true" />}<span className="dg-passo-rotulo">{nome}</span></span>
            </div>
          ))}
        </div>
      </header>

      <main className={`dg-corpo dg-fase-${fase}`}>
        <aside className="dg-visual">
          <img key={foto.src} src={foto.src} alt={foto.alt} className="dg-foto" onError={(e) => { e.currentTarget.hidden = true; }} />
          <div className="dg-visual-texto">
            <span className="dg-visual-kicker">{etapaInfo.kicker}</span>
            <strong className="vx-disp">{etapaInfo.titulo}</strong>
            <span className="dg-visual-frase">{etapaInfo.frase}</span>
            {fase !== "intro" && (
              <ol className="dg-visual-etapas" aria-hidden="true">
                {PASSOS.map((nome, k) => (
                  <li key={nome} className={preenchimento[k] >= 1 ? "is-feito" : k === etapaAtual ? "is-atual" : ""}>
                    <span>{preenchimento[k] >= 1 ? <Check size={12} strokeWidth={3} /> : k + 1}</span>{nome}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>

        <section className="dg-cartao" key={`${fase}-${fase === "quiz" ? indice : ""}`}>
          {fase === "intro" && <Intro tituloProps={tituloProps} temProgresso={Object.keys(respostas).length > 0}
            onComecar={() => irPara("quiz", Object.keys(respostas).length ? Math.min(Object.keys(respostas).length, TOTAL - 1) : 0)}
            onRecomecar={() => { setRespostas({}); irPara("quiz", 0); }} />}

          {fase === "quiz" && (
            <Pergunta tituloProps={tituloProps} pergunta={pergunta} indice={indice}
              selecionada={respostas[pergunta.id]} escolhendo={escolhendo}
              onEscolher={escolher} onContinuar={() => avancar(indice)} />
          )}

          {fase === "resumo" && <Resumo tituloProps={tituloProps} respostas={respostas} onRever={() => irPara("quiz", 0)} onSeguir={() => irPara("contato")} />}

          {fase === "contato" && <Contato tituloProps={tituloProps} contato={contato} setContato={setContato} onSeguir={() => irPara("horario")} />}

          {fase === "horario" && <Horarios tituloProps={tituloProps} selecionado={horario}
            onEscolher={setHorario} onSeguir={() => irPara("confirmar")} />}

          {fase === "confirmar" && horario && (
            <Confirmar tituloProps={tituloProps} horario={horario} contato={contato} respostas={respostas}
              onAlterarContato={() => irPara("contato")} onAlterarHorario={() => irPara("horario")}
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

function Intro({ tituloProps, onComecar, onRecomecar, temProgresso }) {
  return (
    <>
      <span className="dg-selo">Diagnóstico comercial gratuito</span>
      <h1 {...tituloProps}>Descubra como escalar as vendas da sua empresa sem montar equipe</h1>
      <p className="dg-texto">
        Responda perguntas rápidas sobre o momento das suas vendas e agende uma conversa com um especialista da RYCS.
        Você vai entender como profissionais de vendas podem atuar para sua empresa, pagos por ação verificada.
      </p>
      <div className="dg-rodape-pergunta">
        <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={onComecar}>
          {temProgresso ? "Continuar de onde parei" : "Começar o diagnóstico"} <ArrowRight size={18} aria-hidden="true" />
        </button>
        {temProgresso && <button type="button" className="dg-link" onClick={onRecomecar}>Começar do zero</button>}
      </div>
      <p className="dg-nota"><ShieldCheck size={15} aria-hidden="true" /> Sem cadastro. Os dados de contato só são pedidos no fim, para agendar.</p>
      <h2 className="dg-subtitulo dg-como">Como funciona</h2>
      <ol className="dg-roteiro">
        <li><span aria-hidden="true">📝</span><div><strong>Responda o diagnóstico</strong><p>{TOTAL} perguntas de um toque, cerca de 2 minutos.</p></div></li>
        <li><span aria-hidden="true">🔎</span><div><strong>Veja o resumo do seu momento</strong><p>Com o que vale aprofundar na conversa.</p></div></li>
        <li><span aria-hidden="true">📅</span><div><strong>Escolha o horário</strong><p>A conversa entra direto na agenda de um especialista.</p></div></li>
      </ol>
    </>
  );
}

function Pergunta({ tituloProps, pergunta, indice, selecionada, escolhendo, onEscolher, onContinuar }) {
  const idTitulo = `dg-pergunta-${pergunta.id}`;
  const etapa = ETAPAS_QUIZ.find((e) => e.chave === pergunta.etapa);
  const primeiraDaEtapa = PERGUNTAS_QUIZ.findIndex((p) => p.etapa === pergunta.etapa) === indice;
  return (
    <>
      <p className="dg-kicker">
        {primeiraDaEtapa && indice > 0 ? <><span className="dg-kicker-novo">Nova etapa</span> {etapa.titulo}</> : etapa.titulo}
        <span aria-hidden="true"> · </span>{indice + 1} de {TOTAL}
      </p>
      <h1 {...tituloProps} id={idTitulo}>{pergunta.titulo}</h1>
      <p className="dg-texto">{pergunta.ajuda}</p>
      <div role="group" aria-labelledby={idTitulo} className={`dg-opcoes${pergunta.colunas === 2 ? " dg-opcoes-2" : ""}`}>
        {pergunta.opcoes.map((o, k) => {
          const marcada = selecionada === o.id;
          return (
            <button key={o.id} type="button" aria-pressed={marcada}
              className={`dg-opcao${marcada ? " is-marcada" : ""}${escolhendo === o.id ? " is-escolhendo" : ""}`}
              onClick={() => onEscolher(o.id)}>
              <span className="dg-opcao-icone" aria-hidden="true">{o.icone}</span>
              <span className="dg-opcao-texto">{o.texto}</span>
              <span className="dg-opcao-marca" aria-hidden="true">{marcada ? <Check size={14} strokeWidth={3} /> : <kbd>{k === 9 ? 0 : k + 1}</kbd>}</span>
            </button>
          );
        })}
      </div>
      <div className="dg-rodape-pergunta">
        {selecionada && !escolhendo
          ? <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={onContinuar}>{indice === TOTAL - 1 ? "Ver meu resumo" : "Continuar"} <ArrowRight size={18} aria-hidden="true" /></button>
          : <p className="dg-dica" role="status">{escolhendo ? "Resposta registrada ✓" : "Toque na opção que mais combina com a sua empresa."}</p>}
      </div>
    </>
  );
}

function Resumo({ tituloProps, respostas, onRever, onSeguir }) {
  const cartoes = [
    ["Por que agora", "motivo"], ["Onde reforçar", "gargalo"], ["Prazo para contratar", "prazo"], ["Quem aprova", "decisor"],
  ].map(([rotulo, id]) => ({ rotulo, opcao: textoDe(respostas, id) })).filter((c) => c.opcao);
  return (
    <>
      <span className="dg-selo dg-selo-ok"><Check size={14} strokeWidth={3} aria-hidden="true" /> Diagnóstico respondido</span>
      <h1 {...tituloProps}>Este é o retrato das suas vendas hoje</h1>
      <p className="dg-texto">Com base no que você respondeu. O especialista recebe todas as respostas e chega à conversa preparado.</p>
      <ul className="dg-resumo">
        {cartoes.map((c) => (
          <li key={c.rotulo}><span aria-hidden="true">{c.opcao.icone}</span><div><small>{c.rotulo}</small><strong>{c.opcao.texto}</strong></div></li>
        ))}
      </ul>
      <h2 className="dg-subtitulo">Na conversa, vamos falar sobre</h2>
      <ul className="dg-pauta">{pautaConversa(respostas).map((t) => <li key={t}><Check size={16} strokeWidth={2.5} aria-hidden="true" />{t}</li>)}</ul>
      <div className="dg-aviso"><Clock size={18} aria-hidden="true" /><p>{COMO_ACONTECE} A conversa não tem custo.</p></div>
      <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={onSeguir}>Agendar minha conversa <ArrowRight size={18} aria-hidden="true" /></button>
      <button type="button" className="dg-link" onClick={onRever}>Revisar minhas respostas</button>
    </>
  );
}

function Contato({ tituloProps, contato, setContato, onSeguir }) {
  const [tocado, setTocado] = useState({});
  const [tentou, setTentou] = useState(false);
  const erros = errosContato(contato);
  const mostrar = (campo) => (tentou || tocado[campo]) && erros[campo];
  const campos = [
    { campo: "empresa", rotulo: "Nome da empresa", tipo: "text", auto: "organization", max: 160 },
    { campo: "nome", rotulo: "Seu nome", tipo: "text", auto: "name", max: 120 },
    { campo: "email", rotulo: "E-mail", tipo: "email", auto: "email", max: 254, modo: "email" },
    { campo: "telefone", rotulo: "WhatsApp com DDD", tipo: "tel", auto: "tel-national", max: 16, modo: "tel", dica: "O especialista chama você por aqui." },
  ];
  function enviar(e) {
    e.preventDefault();
    setTentou(true);
    if (Object.keys(erros).length) {
      const id = campos.find((c) => erros[c.campo])?.campo;
      document.getElementById(`dg-${id}`)?.focus();
      return;
    }
    setContato({ empresa: contato.empresa.trim(), nome: contato.nome.trim(), email: contato.email.trim(), telefone: contato.telefone });
    onSeguir();
  }
  return (
    <>
      <p className="dg-kicker">Agendar · dados de contato</p>
      <h1 {...tituloProps}>Para quem é a conversa?</h1>
      <p className="dg-texto">O especialista usa estes dados para falar com você no horário escolhido.</p>
      <form onSubmit={enviar} noValidate className="dg-form">
        {campos.map((c) => (
          <div key={c.campo} className="dg-campo">
            <label htmlFor={`dg-${c.campo}`}>{c.rotulo}</label>
            <input id={`dg-${c.campo}`} className="vx-input" type={c.tipo} autoComplete={c.auto} inputMode={c.modo} maxLength={c.max}
              value={contato[c.campo]} aria-invalid={!!mostrar(c.campo)}
              aria-describedby={mostrar(c.campo) ? `dg-${c.campo}-erro` : c.dica ? `dg-${c.campo}-dica` : undefined}
              onBlur={() => setTocado((t) => ({ ...t, [c.campo]: true }))}
              onChange={(e) => setContato((v) => ({ ...v, [c.campo]: c.campo === "telefone" ? mascaraTelefone(e.target.value) : e.target.value }))} />
            {mostrar(c.campo)
              ? <span className="dg-erro" id={`dg-${c.campo}-erro`}>{erros[c.campo]}</span>
              : c.dica && <span className="dg-campo-dica" id={`dg-${c.campo}-dica`}>{c.dica}</span>}
          </div>
        ))}
        <button type="submit" className="vx-btn vx-btn-primary dg-cta">Ver horários disponíveis <ArrowRight size={18} aria-hidden="true" /></button>
      </form>
      <p className="dg-nota"><ShieldCheck size={15} aria-hidden="true" /> Seus dados e respostas ficam só com a equipe da RYCS, para esta conversa. <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a></p>
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
      <p className="dg-kicker">Agendar · horário</p>
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
          <span aria-hidden="true">⚠️</span>
          <strong>Não conseguimos abrir a agenda</strong>
          <p>{estado.erro}</p>
          <button type="button" className="vx-btn vx-btn-ghost" onClick={carregar}><RefreshCw size={16} aria-hidden="true" /> Tentar de novo</button>
        </div>
      )}

      {!estado.carregando && !estado.erro && !dias.length && (
        <div className="dg-estado" role="status">
          <span aria-hidden="true">🗓️</span>
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

function Confirmar({ tituloProps, horario, contato, respostas, onAlterarContato, onAlterarHorario, onIndisponivel, onAgendado }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const enviandoRef = useRef(false);
  async function confirmar() {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro("");
    const rastreio = dadosAgendamento();
    const r = await chamar("/agenda-publica/reservas", {
      ...contato, inicio: horario.inicio, fim: horario.fim, respostas, aceite: true, ...rastreio,
    });
    enviandoRef.current = false;
    setEnviando(false);
    if (r.ok && r.dados?.id) {
      agendamentoConcluido(rastreio.meta.eventId, contato);
      onAgendado({ ...r.dados, nome: contato.nome, empresa: contato.empresa, email: contato.email, telefone: contato.telefone });
      return;
    }
    if (r.dados?.codigo === "HORARIO_INDISPONIVEL") {
      setErro(r.dados.error);
      setTimeout(onIndisponivel, 1800);
      return;
    }
    setErro(r.status === 0 ? "Sem conexão. Sua reserva não foi feita; confira a internet e tente de novo." : (r.dados?.error || "Não foi possível confirmar. Sua reserva não foi feita; tente de novo."));
  }
  return (
    <>
      <p className="dg-kicker">Agendar · confirmação</p>
      <h1 {...tituloProps}>Confira e confirme</h1>
      <p className="dg-texto">A reserva só vale depois que você confirmar.</p>
      <dl className="dg-confere">
        <div><dt>📅 Data</dt><dd className="dg-data">{diaLongo(horario.inicio)}</dd></div>
        <div><dt>🕘 Horário</dt><dd>{hora(horario.inicio)} às {hora(horario.fim)} · {minutos(horario)} min</dd></div>
        <div><dt>🌎 Fuso</dt><dd>{nomeFuso(horario.inicio)}</dd></div>
        <div className="dg-confere-acao"><button type="button" className="dg-link" onClick={onAlterarHorario} disabled={enviando}>Alterar horário</button></div>
        <div><dt>🏢 Empresa</dt><dd>{contato.empresa}</dd></div>
        <div><dt>👤 Contato</dt><dd>{contato.nome}</dd></div>
        <div><dt>✉️ E-mail</dt><dd>{contato.email}</dd></div>
        <div><dt>📱 WhatsApp</dt><dd>{contato.telefone}</dd></div>
        <div className="dg-confere-acao"><button type="button" className="dg-link" onClick={onAlterarContato} disabled={enviando}>Alterar dados</button></div>
      </dl>
      <div className="dg-aviso"><Clock size={18} aria-hidden="true" /><p>{COMO_ACONTECE}</p></div>
      {erro && <p className="dg-alerta" role="alert">{erro}</p>}
      <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={confirmar} disabled={enviando} aria-busy={enviando}>
        {enviando ? <><span className="dg-girando" aria-hidden="true" /> Confirmando…</> : <>Confirmar agendamento <Check size={18} strokeWidth={2.5} aria-hidden="true" /></>}
      </button>
      <p className="dg-nota">Ao confirmar, você autoriza a RYCS a usar estes dados e as suas respostas para preparar e realizar a conversa, conforme a <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</p>
    </>
  );
}

function SemHorarioEscolhido({ tituloProps, onVoltar }) {
  return (
    <>
      <h1 {...tituloProps}>Escolha um horário</h1>
      <p className="dg-texto">Ainda falta escolher o horário da conversa.</p>
      <button type="button" className="vx-btn vx-btn-primary dg-cta" onClick={onVoltar}>Ver horários</button>
    </>
  );
}

function Agendado({ tituloProps, ag }) {
  return (
    <>
      <div className="dg-sucesso-icone" aria-hidden="true"><Check size={34} strokeWidth={3} /></div>
      <h1 {...tituloProps}>Conversa agendada!</h1>
      <p className="dg-texto">
        {ag.nome ? `${ag.nome.split(" ")[0]}, está tudo certo.` : "Está tudo certo."}
        {ag.closer ? ` ${ag.closer}, especialista da RYCS, já tem suas respostas na agenda.` : " O especialista da RYCS já tem suas respostas na agenda."}
      </p>
      <div className="dg-ingresso">
        <strong className="vx-disp">{diaLongo(ag.inicio)}</strong>
        <span className="dg-ingresso-hora">{hora(ag.inicio)} às {hora(ag.fim)}</span>
        <span>{minutos(ag)} minutos · {nomeFuso(ag.inicio)}</span>
      </div>
      <h2 className="dg-subtitulo">Como vai acontecer</h2>
      <p className="dg-texto">{COMO_ACONTECE}{ag.telefone ? ` Número informado: ${ag.telefone}.` : ""}</p>
      <h2 className="dg-subtitulo">Para aproveitar melhor</h2>
      <ul className="dg-pauta">
        <li><Check size={16} strokeWidth={2.5} aria-hidden="true" />Tenha à mão o valor médio de uma venda e quantos clientes vocês atendem por mês.</li>
        <li><Check size={16} strokeWidth={2.5} aria-hidden="true" />Se alguém decide com você, convide para participar.</li>
      </ul>
      <div className="dg-calendario">
        <button type="button" className="vx-btn vx-btn-ghost" onClick={() => baixarIcs(ag)}><CalendarPlus size={18} aria-hidden="true" /> Salvar no calendário</button>
        <a className="vx-btn vx-btn-ghost" href={linkGoogle(ag)} target="_blank" rel="noreferrer">Google Agenda</a>
      </div>
      <p className="dg-nota">Não enviamos convite automático: guarde o horário. Precisa mudar? Avise o especialista quando ele chamar você ou fale com a RYCS em <a href="https://rycs.pro" target="_blank" rel="noreferrer">rycs.pro</a>.</p>
    </>
  );
}
