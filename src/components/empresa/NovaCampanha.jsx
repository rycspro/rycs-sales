import { useState, useRef, useEffect } from "react";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha, custoEstimado } from "../../../shared/objetivosCampanha.js";
import { campanhaPodeSerPublicada, saldoDisponivel, isPosPago } from "../../../shared/empresa.js";
import { sugerirValores, impactoNoRoi } from "../../../shared/valorTarefa.js";
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

// Mapa de objetivo → label amigável para o Jarvas
const OBJETIVO_LABELS = {
  leads:      "Gerar leads",
  reunioes:   "Agendar reuniões",
  visitas:    "Visitas presenciais",
  campo:      "Porta a porta / campo",
  vendas:     "Fechar vendas",
  completa:   "Prospecção completa",
  prospeccao: "Abrir mercado novo",
  reativacao: "Reativar clientes",
};

// Perguntas que o Jarvas faz, em ordem
const PERGUNTAS_JARVAS = [
  {
    id: "objetivo",
    pergunta: "Que tipo de campanha você precisa?",
    tipo: "opcoes",
    opcoes: [
      { valor: "campo",      label: "Porta a porta / campo" },
      { valor: "visitas",    label: "Visitas presenciais" },
      { valor: "reunioes",   label: "Agendar reuniões" },
      { valor: "leads",      label: "Gerar leads" },
      { valor: "vendas",     label: "Fechar vendas" },
      { valor: "completa",   label: "Prospecção completa" },
      { valor: "prospeccao", label: "Abrir mercado novo" },
      { valor: "reativacao", label: "Reativar clientes" },
    ],
  },
  {
    id: "regiao",
    pergunta: "Em qual região vai acontecer essa campanha?",
    tipo: "texto",
    placeholder: "Ex.: Sorocaba, interior de SP, Grande BH…",
  },
  {
    id: "publico",
    pergunta: "Quem é o cliente ideal? Descreva o perfil.",
    tipo: "texto",
    placeholder: "Ex.: empresas com alto consumo energético, gestores de facilities…",
  },
  {
    id: "vagas",
    pergunta: "Quantos profissionais você precisa nessa campanha?",
    tipo: "numero",
    placeholder: "Ex.: 2",
  },
  {
    id: "extra",
    pergunta: "Quer acrescentar algo? (prazo, restrições, produto específico…)",
    tipo: "texto",
    placeholder: "Opcional — pressione Enter para pular",
    opcional: true,
  },
];

function JarvasChat({ emp, onCampanha }) {
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [inputAtual, setInputAtual] = useState("");
  const [historico, setHistorico] = useState([]);
  const [gerando, setGerando] = useState(false);
  const fimRef = useRef(null);

  // Rola para o fim sempre que o histórico muda
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [historico, etapa]);

  const perguntaAtual = PERGUNTAS_JARVAS[etapa];

  const adicionarMensagem = (de, texto) =>
    setHistorico((h) => [...h, { de, texto, id: Date.now() + Math.random() }]);

  // Jarvas inicia com a primeira pergunta automaticamente
  useEffect(() => {
    if (historico.length === 0) {
      setTimeout(() => {
        adicionarMensagem("jarvas", `Olá! Vou te ajudar a montar a campanha. ${PERGUNTAS_JARVAS[0].pergunta}`);
      }, 200);
    }
  }, []);

  const responder = (valor, labelVisivel) => {
    const p = PERGUNTAS_JARVAS[etapa];
    const label = labelVisivel || valor;
    adicionarMensagem("usuario", label);
    const novasRespostas = { ...respostas, [p.id]: valor };
    setRespostas(novasRespostas);
    setInputAtual("");

    const proxima = etapa + 1;
    if (proxima < PERGUNTAS_JARVAS.length) {
      setTimeout(() => {
        const pNext = PERGUNTAS_JARVAS[proxima];
        adicionarMensagem("jarvas", pNext.pergunta);
        setEtapa(proxima);
      }, 400);
    } else {
      // Todas as perguntas respondidas → montar campanha
      setTimeout(() => montar(novasRespostas), 400);
    }
  };

  const pularOpcional = () => responder("", "—");

  const montar = async (r) => {
    adicionarMensagem("jarvas", "Perfeito! Montando sua campanha…");
    setGerando(true);

    const objetivo = r.objetivo || "reunioes";
    const nomeObj = OBJETIVO_LABELS[objetivo] || objetivo;
    const empresa = emp.nome || "";
    const regiao = r.regiao || "";

    // Constrói brief para o endpoint
    const brief = [
      `Criar campanha de ${nomeObj}`,
      regiao ? `na região de ${regiao}` : "",
      r.publico ? `para ${r.publico}` : "",
      r.vagas ? `com ${r.vagas} profissionais` : "",
      r.extra || "",
    ].filter(Boolean).join(", ").replace(/,\s*$/, "") + ".";

    // Tenta via API; cai no local se falhar
    let campanha = null;
    try {
      const res = await api("/campaigns/sugerir", { brief });
      if (res && !res.error && res.campanha) {
        campanha = res.campanha;
      }
    } catch (_) {}

    // Fallback local
    if (!campanha) {
      const { montarCampanha: mc } = await import("../../../shared/objetivosCampanha.js");
      campanha = mc(objetivo, emp);
    }

    // Sobrescreve com as respostas do Jarvas
    campanha.objetivoChave = objetivo;
    if (r.regiao) campanha.regiao = r.regiao;
    if (r.publico) campanha.publico = r.publico;
    if (r.vagas) campanha.vagas = Number(r.vagas) || campanha.vagas;

    // Título personalizado: Tipo — Empresa — Região
    const partesTitulo = [nomeObj];
    if (empresa) partesTitulo.push(empresa);
    if (regiao) partesTitulo.push(regiao);
    campanha.titulo = partesTitulo.join(" — ");

    setGerando(false);
    adicionarMensagem("jarvas", `Pronto! Campanha "${campanha.titulo}" montada. Revise os detalhes e ajuste o que quiser.`);
    setTimeout(() => onCampanha(objetivo, campanha), 600);
  };

  const reiniciar = () => {
    setEtapa(0);
    setRespostas({});
    setInputAtual("");
    setHistorico([]);
    setTimeout(() => {
      adicionarMensagem("jarvas", `Vamos recomeçar! ${PERGUNTAS_JARVAS[0].pergunta}`);
    }, 100);
  };

  const enviarTexto = () => {
    const v = inputAtual.trim();
    if (!v && !perguntaAtual?.opcional) return;
    responder(v || "");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* histórico */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto", padding: "4px 0 8px" }}>
        {historico.map((m) => (
          <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: m.de === "jarvas" ? "row" : "row-reverse" }}>
            {m.de === "jarvas" && (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>J</div>
            )}
            <div style={{
              maxWidth: "78%", padding: "9px 13px", borderRadius: m.de === "jarvas" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
              background: m.de === "jarvas" ? "var(--brand-50)" : "var(--brand)", color: m.de === "jarvas" ? "var(--text)" : "#fff",
              fontSize: 13.5, lineHeight: 1.5, border: m.de === "jarvas" ? "1px solid var(--brand-100)" : "none",
            }}>
              {m.texto}
            </div>
          </div>
        ))}
        {gerando && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>J</div>
            <div style={{ padding: "9px 13px", borderRadius: "4px 14px 14px 14px", background: "var(--brand-50)", border: "1px solid var(--brand-100)", display: "flex", gap: 5, alignItems: "center" }}>
              <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>Montando…</span>
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {/* área de resposta */}
      {!gerando && perguntaAtual && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
          {perguntaAtual.tipo === "opcoes" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {perguntaAtual.opcoes.map((op) => (
                <button key={op.valor} className="vx-btn vx-btn-sm"
                  style={{ borderRadius: 20, fontSize: 12.5 }}
                  onClick={() => responder(op.valor, op.label)}>
                  {op.label}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="vx-input"
                style={{ flex: 1, fontSize: 13.5 }}
                type={perguntaAtual.tipo === "numero" ? "number" : "text"}
                placeholder={perguntaAtual.placeholder}
                value={inputAtual}
                onChange={(e) => setInputAtual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarTexto()}
                autoFocus
              />
              <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={enviarTexto}>
                <Send size={13} />
              </button>
              {perguntaAtual.opcional && (
                <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={pularOpcional} style={{ fontSize: 11.5 }}>Pular</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* reiniciar */}
      {!gerando && Object.keys(respostas).length > 0 && etapa < PERGUNTAS_JARVAS.length && (
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginTop: 8, alignSelf: "flex-start", fontSize: 11.5 }} onClick={reiniciar}>
          <RotateCcw size={11} /> Recomeçar
        </button>
      )}
    </div>
  );
}

function formatarBRL(valor) {
  if (!valor && valor !== 0) return "";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(str) {
  if (!str) return 0;
  return Number(str.replace(/\./g, "").replace(",", ".")) || 0;
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
  const [gerandoTreinamento, setGerandoTreinamento] = useState(false);
  const [modeloTreinamento, setModeloTreinamento] = useState("rapido");

  const disponivel = saldoDisponivel(emp);
  const set = (k, v) => setCampanha((c) => ({ ...c, [k]: v }));

  const calcularSugestaoIA = () => {
    const plano = emp.assinatura || "free";
    const ticketBase = ticketLocal
      ? parseBRL(ticketLocal)
      : Number(String(emp.ticket || "").replace(/\D/g, "")) || Number(emp.ticket) || 0;
    const resultado = sugerirValores({
      ticketMedio: ticketBase,
      margem: 0.3,
      plano,
    });
    setSugestaoIA(resultado);
    setMostrarSugestao(true);
  };

  const aceitarSugestaoIA = () => {
    if (!sugestaoIA?.disponivel || !campanha) return;
    const novasTarefas = { ...campanha.tarefas };
    sugestaoIA.tarefas.forEach((t) => {
      if (novasTarefas[t.tipo] !== undefined) novasTarefas[t.tipo] = t.bruto;
    });
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
    const r = await api("/campaigns", campanha);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar a campanha.");
    aoCriar?.({ ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() });
  };

  const obj = objetivo ? OBJETIVOS[objetivo] : null;
  const custo = campanha ? custoEstimado(campanha, campanha.limitePorProfissional || 10) : null;
  const checklist = campanha ? campanhaPodeSerPublicada(campanha, emp) : { ok: false, pendencias: [] };
  const requisitosPublicacao = campanha ? [
    ["Título", !!campanha.titulo?.trim()], ["Objetivo", !!campanha.objetivo?.trim()],
    ["ICP", !!campanha.publico?.trim()], ["Região", !!campanha.regiao?.trim()],
    ["Função", !!campanha.funcao?.trim()], ["Orçamento", Number(campanha.orcamento) > 0],
    ["Tarefa remunerada", Object.values(campanha.tarefas || {}).some((valor) => Number(valor) > 0)],
    ["Treinamento obrigatório", (campanha.treinamento || []).length > 0],
    ["Empresa aprovada", emp.statusCadastro === "aprovada"], ["Plano ativo", !!emp.assinatura && emp.assinatura !== "free"],
    ...(isPosPago(emp) ? [] : [["Saldo suficiente", Number(campanha.orcamento || 0) > 0 && Number(campanha.orcamento) <= disponivel]]),
  ] : [];
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
            <JarvasChat emp={emp} onCampanha={receberCampanhaDoJarvas} />
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
              <span className="vx-chip"><Wallet size={12} /> {isPosPago(emp) ? "Pós-pago · sem limite" : `${money(disponivel)} disponível`}</span>
            </div>

            {/* Sugestão com IA */}
            <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div className="vx-row" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={14} color="var(--brand)" />
                  <b style={{ fontSize: 13 }}>Sugestão com IA</b>
                  <span className="vx-mut" style={{ fontSize: 11.5 }}>— quanto custará cada reunião/venda</span>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: mostrarSugestao ? 10 : 0 }}>
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
              </div>
              {mostrarSugestao && sugestaoIA && (
                sugestaoIA.disponivel ? (
                  <div>
                    <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                      {sugestaoIA.tarefas.filter((t) => campanha.tarefas[t.tipo] !== undefined).map((t) => (
                        <div key={t.tipo} style={{ background: "#fff", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 2 }}>{ACOES[t.tipo]?.nome || t.tipo}</div>
                          <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(t.bruto)}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>Take rate {(t.percentual * 100).toFixed(0)}% · líq. {money(t.liquido)}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>Faixa: {money(t.minimo)} – {money(t.maximo)}</div>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const agendamento = sugestaoIA.tarefas.find((t) => t.tipo === "agendamento");
                      return agendamento ? (
                        <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
                          Custo estimado por reunião agendada: <b className="vx-mono">{money(agendamento.bruto)}</b>
                          {sugestaoIA.premissas?.conversao ? ` · por venda: ~${money(agendamento.bruto / sugestaoIA.premissas.conversao)}` : ""}
                          {" · "}Take rate do plano: {(takeRateDoPlano(emp.assinatura || "free") * 100).toFixed(0)}%
                        </div>
                      ) : null;
                    })()}
                    <div className="vx-mut" style={{ fontSize: 11, marginBottom: 8 }}>
                      Confiança: {sugestaoIA.confianca} · {sugestaoIA.fontes?.[0]?.nome}
                    </div>
                    <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={aceitarSugestaoIA}>
                      <Check size={12} /> Aceitar sugestão
                    </button>
                  </div>
                ) : (
                  <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {sugestaoIA.motivo} <b>Ausente: {sugestaoIA.ausentes?.join(", ")}</b>
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
                  <div className="vx-label">{ACOES[k]?.nome || k}</div>
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
            <div className="vx-publish-checklist">{requisitosPublicacao.map(([label, ok]) => <div key={label} data-ok={ok ? "1" : "0"}><span>{ok ? <Check size={12} /> : "!"}</span>{label}</div>)}</div>
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
