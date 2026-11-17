import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Brain, Layers, ShieldAlert, HeartHandshake, Compass,
  Puzzle, MessageSquare, Lightbulb, ListChecks, Scale,
  CheckCircle2, Clock, ArrowLeft, ArrowRight, Lock, Eye,
} from "lucide-react";
import { api } from "../../lib/api.js";
import DiscAvaliacao from "./DiscAvaliacao.jsx";
import BigFive from "./BigFive.jsx";
import Autossabotagem from "./Autossabotagem.jsx";
import InteligenciaEmocional from "./InteligenciaEmocional.jsx";

// Azul institucional White Editorial (mesmo dos fluxos de cadastro/onboarding).
const AZUL = "#318CE7";

// ─────────────────────────────────────────────────────────────────────────
// Catálogo de avaliações.
//
// Estrutura extensível: para adicionar, remover, reordenar ou desativar uma
// avaliação, basta editar este array — a página se monta a partir dele.
//   publicado:false  → estado "Em breve" (sem início, sem perguntas fictícias)
//   fonte:"disc"     → reaproveita o resultado DISC já existente do profissional
// Nenhuma quantidade fictícia: só o DISC declara nº de blocos (o real: 8).
// ─────────────────────────────────────────────────────────────────────────
const CATEGORIAS = [
  { chave: "personalidade", titulo: "Personalidade e autoconhecimento" },
  { chave: "competencias", titulo: "Competências profissionais" },
];

const CATALOGO = [
  // ---- Personalidade e autoconhecimento ----
  {
    id: "disc", categoria: "personalidade", Icon: Brain,
    nome: "DISC — Perfil comportamental",
    descricao: "Conheça suas tendências de comportamento e interação profissional.",
    objetivo: "Identificar como você tende a agir, se comunicar e tomar decisões no dia a dia comercial.",
    avalia: "Quatro dimensões comportamentais: Dominância, Influência, Estabilidade e Conformidade.",
    instrucoes: "Em cada bloco, escolha a opção que MAIS e a que MENOS combina com você. Não há resposta certa ou errada.",
    privacidade: "Resultado de personalidade. Visível para empresas apenas se você autorizar. Nunca é usado para reprovar você.",
    perguntas: "24 blocos", tempo: "8 a 12 min", publicado: true, v2: true,
  },
  {
    id: "big-five", categoria: "personalidade", Icon: Layers,
    nome: "Big Five — Cinco grandes fatores",
    descricao: "Mapeie os cinco grandes fatores que descrevem seu estilo pessoal.",
    objetivo: "Oferecer uma leitura ampla da sua personalidade por cinco fatores reconhecidos.",
    avalia: "Abertura, conscienciosidade, extroversão, amabilidade e neuroticismo.",
    instrucoes: "Para cada afirmação, escolha o quanto você concorda, de 1 a 5. Não há resposta certa ou errada.",
    privacidade: "Resultado de personalidade, privado por padrão. Visível para empresas só com sua autorização; nunca altera score, ranking ou campanhas.",
    perguntas: "50 afirmações", tempo: "7 a 12 min", publicado: true, bf: true,
  },
  {
    id: "autossabotagem", categoria: "personalidade", Icon: ShieldAlert,
    nome: "Padrões de Autossabotagem",
    descricao: "Reconheça hábitos e reações que podem dificultar seu desenvolvimento.",
    objetivo: "Ajudar a reconhecer comportamentos e hábitos que podem estar dificultando seu desenvolvimento profissional.",
    avalia: "Oito padrões de comportamento, como autocrítica, perfeccionismo, controle e dificuldade de delegar.",
    instrucoes: "Para cada afirmação, escolha a frequência com que isso acontece com você. Não há resposta certa ou errada.",
    privacidade: "Avaliação voluntária e de autoconhecimento, privada por padrão. Visível para empresas só com sua autorização; nunca altera score, ranking ou campanhas.",
    perguntas: "40 afirmações", tempo: "8 a 12 min", publicado: true, auto: true,
  },
  {
    id: "inteligencia-emocional", categoria: "personalidade", Icon: HeartHandshake,
    nome: "Inteligência Emocional",
    descricao: "Explore como você reconhece, regula e expressa emoções no trabalho.",
    objetivo: "Ajudar você a refletir sobre como reconhece, regula e expressa emoções no ambiente profissional.",
    avalia: "Cinco competências: autoconsciência, autorregulação, percepção das emoções alheias, gestão de relacionamentos e adaptação emocional.",
    instrucoes: "Para cada afirmação, escolha a frequência com que isso acontece com você. Não há resposta certa ou errada.",
    privacidade: "Avaliação voluntária e de autoconhecimento, privada por padrão. Visível para empresas só com sua autorização; nunca altera score, ranking ou campanhas.",
    perguntas: "30 afirmações", tempo: "7 a 10 min", publicado: true, ie: true,
  },
  {
    id: "riasec", categoria: "personalidade", Icon: Compass,
    nome: "RIASEC — Interesses profissionais",
    descricao: "Descubra as áreas de atuação mais alinhadas aos seus interesses.",
    objetivo: "Relacionar seus interesses a famílias de atividades profissionais.",
    avalia: "Seis tipos de interesse: realista, investigativo, artístico, social, empreendedor e convencional.",
    instrucoes: "", privacidade: "Resultado de interesses, sob seu controle de visibilidade. Nunca restringe campanhas.",
    perguntas: "", tempo: "", publicado: false,
  },

  // ---- Competências profissionais ----
  {
    id: "raciocinio", categoria: "competencias", Icon: Puzzle,
    nome: "Raciocínio lógico e analítico",
    descricao: "Exercite a análise de padrões, dados e relações lógicas.",
    objetivo: "Avaliar sua capacidade de raciocinar sobre informações e padrões.",
    avalia: "Lógica, análise de dados e resolução estruturada.",
    instrucoes: "", privacidade: "Indicador de competência, visível para empresas apenas se você autorizar.",
    perguntas: "", tempo: "", publicado: false,
  },
  {
    id: "comunicacao", categoria: "competencias", Icon: MessageSquare,
    nome: "Comunicação profissional",
    descricao: "Avalie clareza, escuta e condução em contextos comerciais.",
    objetivo: "Medir a qualidade da sua comunicação em situações de trabalho.",
    avalia: "Clareza, escuta ativa, adequação de tom e condução de conversas.",
    instrucoes: "", privacidade: "Indicador de competência, visível para empresas apenas se você autorizar.",
    perguntas: "", tempo: "", publicado: false,
  },
  {
    id: "resolucao-problemas", categoria: "competencias", Icon: Lightbulb,
    nome: "Resolução de problemas",
    descricao: "Mostre como você aborda obstáculos e encontra saídas.",
    objetivo: "Avaliar sua forma de estruturar e resolver problemas reais.",
    avalia: "Diagnóstico, geração de alternativas e decisão.",
    instrucoes: "", privacidade: "Indicador de competência, visível para empresas apenas se você autorizar.",
    perguntas: "", tempo: "", publicado: false,
  },
  {
    id: "organizacao", categoria: "competencias", Icon: ListChecks,
    nome: "Organização e produtividade",
    descricao: "Avalie como você prioriza, planeja e mantém consistência.",
    objetivo: "Medir seus hábitos de organização e execução.",
    avalia: "Priorização, planejamento, foco e constância.",
    instrucoes: "", privacidade: "Indicador de competência, visível para empresas apenas se você autorizar.",
    perguntas: "", tempo: "", publicado: false,
  },
  {
    id: "julgamento", categoria: "competencias", Icon: Scale,
    nome: "Julgamento situacional",
    descricao: "Decida diante de cenários profissionais realistas.",
    objetivo: "Avaliar como você agiria em situações comerciais concretas.",
    avalia: "Tomada de decisão aplicada a cenários do dia a dia.",
    instrucoes: "", privacidade: "Indicador de competência, visível para empresas apenas se você autorizar.",
    perguntas: "", tempo: "", publicado: false,
  },
];

// Estado de uma avaliação para o profissional atual.
//   indisponivel → ainda não publicada ("Em breve")
//   concluido    → já realizada (hoje, só o DISC, via dados existentes)
//   andamento    → iniciada e não concluída (reservado para o futuro)
//   disponivel   → publicada e ainda não iniciada
function estadoDe(item, discV2, big5, auto, ie) {
  if (!item.publicado) return "indisponivel";
  if (item.v2) {
    if (discV2 && discV2.disponivel === false) return "indisponivel";
    const st = discV2?.tentativa?.status;
    if (st === "concluido") return "concluido";
    if (st === "andamento") return "andamento";
    return "disponivel";
  }
  if (item.bf) {
    // Sob feature flag: até confirmar, o padrão seguro é "Em breve".
    if (!big5 || big5.disponivel === false) return "indisponivel";
    const st = big5?.tentativa?.status;
    if (st === "concluido") return "concluido";
    if (st === "andamento") return "andamento";
    return "disponivel";
  }
  if (item.auto) {
    // Sob feature flag (revisão interna): padrão seguro é "Em breve".
    if (!auto || auto.disponivel === false) return "indisponivel";
    const st = auto?.tentativa?.status;
    if (st === "concluido") return "concluido";
    if (st === "andamento") return "andamento";
    return "disponivel";
  }
  if (item.ie) {
    // Sob feature flag (revisão interna): padrão seguro é "Em breve".
    if (!ie || ie.disponivel === false) return "indisponivel";
    const st = ie?.tentativa?.status;
    if (st === "concluido") return "concluido";
    if (st === "andamento") return "andamento";
    return "disponivel";
  }
  return "disponivel";
}

const ROTULO_ESTADO = {
  disponivel: { txt: "Disponível", Icon: ArrowRight, cor: AZUL },
  andamento: { txt: "Em andamento", Icon: Clock, cor: "var(--amber)" },
  concluido: { txt: "Concluído", Icon: CheckCircle2, cor: "var(--green, #22c55e)" },
  indisponivel: { txt: "Em breve", Icon: Lock, cor: "var(--muted-2)" },
};

export default function TestesAvaliacoes({ eu, aviso, recarregar }) {
  const [vista, setVista] = useState({ tipo: "catalogo" });
  const [discV2, setDiscV2] = useState(null);
  const [big5, setBig5] = useState(null);
  const [auto, setAuto] = useState(null);
  const [ie, setIe] = useState(null);

  const carregarDisc = () => api("/disc/avaliacao").then((r) => { if (r && !r.error) setDiscV2(r); });
  const carregarBig5 = () => api("/big-five").then((r) => { if (r && !r.error) setBig5(r); });
  const carregarAuto = () => api("/autossabotagem").then((r) => { if (r && !r.error) setAuto(r); });
  const carregarIe = () => api("/inteligencia-emocional").then((r) => { if (r && !r.error) setIe(r); });
  useEffect(() => { carregarDisc(); carregarBig5(); carregarAuto(); carregarIe(); }, []);

  const comEstado = useMemo(
    () => CATALOGO.map((a) => ({ ...a, estado: estadoDe(a, discV2, big5, auto, ie) })),
    [discV2, big5, auto, ie]
  );

  const total = comEstado.length;
  const concluidas = comEstado.filter((a) => a.estado === "concluido").length;
  const pct = total ? Math.round((concluidas / total) * 100) : 0;

  const abrir = (item) => {
    if (item.v2 && item.estado !== "indisponivel") setVista({ tipo: "disc" });
    else if (item.bf && item.estado !== "indisponivel") setVista({ tipo: "bigfive" });
    else if (item.auto && item.estado !== "indisponivel") setVista({ tipo: "autossabotagem" });
    else if (item.ie && item.estado !== "indisponivel") setVista({ tipo: "inteligencia-emocional" });
    else setVista({ tipo: "detalhe", id: item.id });
  };

  if (vista.tipo === "disc") {
    return (
      <DiscAvaliacao
        eu={eu}
        aviso={aviso}
        onVoltar={() => { carregarDisc(); setVista({ tipo: "catalogo" }); }}
        onConcluir={() => { carregarDisc(); recarregar?.(); }}
      />
    );
  }
  if (vista.tipo === "bigfive") {
    return (
      <BigFive
        aviso={aviso}
        recarregar={() => { carregarBig5(); recarregar?.(); }}
        onVoltar={() => { carregarBig5(); setVista({ tipo: "catalogo" }); }}
      />
    );
  }
  if (vista.tipo === "autossabotagem") {
    return (
      <Autossabotagem
        aviso={aviso}
        recarregar={() => { carregarAuto(); recarregar?.(); }}
        onVoltar={() => { carregarAuto(); setVista({ tipo: "catalogo" }); }}
      />
    );
  }
  if (vista.tipo === "inteligencia-emocional") {
    return (
      <InteligenciaEmocional
        aviso={aviso}
        recarregar={() => { carregarIe(); recarregar?.(); }}
        onVoltar={() => { carregarIe(); setVista({ tipo: "catalogo" }); }}
      />
    );
  }
  if (vista.tipo === "detalhe") {
    const item = comEstado.find((a) => a.id === vista.id);
    return <Detalhe item={item} onVoltar={() => setVista({ tipo: "catalogo" })} aviso={aviso} />;
  }

  return (
    <div className="vx-fade">
      {/* ───────────── Cabeçalho ───────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="vx-disp" style={{ fontSize: 26, margin: "0 0 6px" }}>Testes e Avaliações</h1>
          <p className="vx-mut" style={{ fontSize: 14, margin: 0, maxWidth: 560, lineHeight: 1.6 }}>
            Descubra suas habilidades, conheça seu perfil e acompanhe seu desenvolvimento profissional.
          </p>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "rgba(49,140,231,.10)", color: AZUL, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ClipboardList size={22} aria-hidden="true" />
        </div>
      </div>

      {/* ───────────── Progresso geral ───────────── */}
      <div className="vx-card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div className="vx-eyebrow">Seu progresso</div>
          <div className="vx-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
            {concluidas} de {total} avaliações concluídas
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: AZUL, borderRadius: 999, transition: "width .4s ease" }} />
        </div>
        <p className="vx-mut" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          Continue explorando suas competências no seu ritmo.
        </p>
      </div>

      {/* ───────────── Categorias + grid ───────────── */}
      {CATEGORIAS.map((cat) => {
        const itens = comEstado.filter((a) => a.categoria === cat.chave);
        if (!itens.length) return null;
        return (
          <section key={cat.chave} style={{ marginBottom: 26 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 12 }}>{cat.titulo}</div>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))" }}>
              {itens.map((item) => <CardAvaliacao key={item.id} item={item} onAbrir={() => abrir(item)} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CardAvaliacao({ item, onAbrir }) {
  const { Icon } = item;
  const est = ROTULO_ESTADO[item.estado];
  const EstIcon = est.Icon;
  const clicavel = item.estado !== "indisponivel";

  return (
    <div className="vx-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, opacity: item.estado === "indisponivel" ? 0.72 : 1 }}>
      {/* topo: ícone + status */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(49,140,231,.10)", color: AZUL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: est.cor, whiteSpace: "nowrap" }}>
          <EstIcon size={13} aria-hidden="true" /> {est.txt}
        </span>
      </div>

      {/* centro: nome + descrição + meta */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>{item.nome}</div>
        <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.55, margin: "6px 0 0" }}>{item.descricao}</p>
        {(item.perguntas || item.tempo) && (
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 10 }}>
            {item.perguntas || "A definir"}{item.tempo ? ` · ${item.tempo}` : " · Tempo a definir"}
          </div>
        )}
      </div>

      {/* base: ação */}
      <div style={{ marginTop: 4 }}>
        {item.estado === "indisponivel" ? (
          <button type="button" className="vx-btn vx-btn-sm" disabled style={{ width: "100%", justifyContent: "center", opacity: 0.6 }}>
            <Lock size={13} /> Em breve
          </button>
        ) : item.estado === "concluido" ? (
          <button type="button" className="vx-btn vx-btn-sm" onClick={onAbrir} style={{ width: "100%", justifyContent: "center" }}>
            <Eye size={13} /> Ver resultado
          </button>
        ) : item.estado === "andamento" ? (
          <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" onClick={onAbrir} style={{ width: "100%", justifyContent: "center" }}>
            Continuar <ArrowRight size={13} />
          </button>
        ) : (
          <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" onClick={onAbrir} style={{ width: "100%", justifyContent: "center" }}>
            Iniciar avaliação <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Detalhe({ item, onVoltar, aviso }) {
  if (!item) return null;
  const { Icon } = item;
  const emBreve = item.estado === "indisponivel";

  const Linha = ({ rotulo, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{rotulo}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>{children}</div>
    </div>
  );

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="vx-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(49,140,231,.10)", color: AZUL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="vx-disp" style={{ fontSize: 21, margin: 0 }}>{item.nome}</h1>
            <p className="vx-mut" style={{ fontSize: 13.5, margin: "4px 0 0", lineHeight: 1.5 }}>{item.descricao}</p>
          </div>
        </div>

        {emBreve && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted-2)", background: "var(--surface-2)", borderRadius: 999, padding: "6px 12px", marginBottom: 16 }}>
            <Lock size={13} /> Em breve — esta avaliação ainda será disponibilizada.
          </div>
        )}

        {item.objetivo && <Linha rotulo="Objetivo">{item.objetivo}</Linha>}
        {item.avalia && <Linha rotulo="O que avalia">{item.avalia}</Linha>}
        {(item.perguntas || item.tempo) && (
          <Linha rotulo="Formato">
            {item.perguntas || "Quantidade a definir"}{item.tempo ? ` · tempo estimado ${item.tempo}` : " · tempo a definir"}
          </Linha>
        )}
        {item.instrucoes && <Linha rotulo="Instruções">{item.instrucoes}</Linha>}
        {item.privacidade && <Linha rotulo="Privacidade">{item.privacidade}</Linha>}

        <div style={{ marginTop: 20 }}>
          {emBreve ? (
            <button type="button" className="vx-btn" disabled style={{ width: "100%", justifyContent: "center", opacity: 0.6 }}>
              <Lock size={14} /> Disponível em breve
            </button>
          ) : item.fonte === "disc" ? (
            // DISC é realizado no onboarding e não é refeito aqui para não
            // sobrescrever o resultado existente. Quando há resultado, o card
            // mostra "Ver resultado"; sem resultado, orientamos pelo onboarding.
            <div className="vx-mut" style={{ fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
              O DISC é realizado na sua jornada inicial. Assim que concluído, o resultado aparece aqui.
            </div>
          ) : (
            <button type="button" className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center" }}
              onClick={() => aviso?.("Esta avaliação estará disponível em breve.")}>
              Começar avaliação <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

