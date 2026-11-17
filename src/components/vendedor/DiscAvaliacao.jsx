import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain, ArrowLeft, ArrowRight, Clock, Layers, CheckCircle2, Sparkles,
  Eye, EyeOff, Info, RefreshCw,
} from "lucide-react";
import { api, API_URL } from "../../lib/api.js";

const AZUL = "#318CE7";

// Central de Testes — DISC (perfil comportamental), instrumento rycs-disc-v1-24.
// Todo o conteúdo (blocos, dimensões, interpretação) vem do servidor: o
// mapeamento alternativa → dimensão nunca chega ao cliente, e as letras D/I/S/C
// não aparecem durante o preenchimento.
export default function DiscAvaliacao({ eu, aviso, onVoltar, onConcluir }) {
  const [estado, setEstado] = useState("carregando"); // carregando | intro | quiz | resultado
  const [dados, setDados] = useState(null);
  const [blocos, setBlocos] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [idx, setIdx] = useState(0);
  const [animDir, setAnimDir] = useState("next");
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    const r = await api("/disc/avaliacao");
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível carregar a avaliação."); return; }
    setDados(r);
    if (r.tentativa?.status === "concluido") setEstado("resultado");
    else setEstado("intro");
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const iniciar = async () => {
    setOcupado(true);
    const r = await api("/disc/avaliacao/iniciar", {});
    setOcupado(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível iniciar a avaliação."); return; }
    setBlocos(r.blocos || []);
    setRespostas(r.respostas || {});
    // Retoma do primeiro bloco ainda sem as duas escolhas.
    const prim = (r.blocos || []).findIndex((b) => {
      const resp = (r.respostas || {})[b.id];
      return !(resp?.mais && resp?.menos);
    });
    setIdx(prim < 0 ? 0 : prim);
    setEstado("quiz");
    window.scrollTo?.(0, 0);
  };

  // Rascunho / auto-save. Cada alteração é guardada no servidor (debounce de
  // 600ms). O ponto crítico é NÃO perder o que já foi feito quando o
  // profissional sai: ao desmontar (trocar de aba, "Voltar à central") ou
  // fechar/atualizar a página, gravamos na hora o que estiver pendente.
  const saveTimer = useRef(null);
  const respostasRef = useRef({});   // sempre o último mapa, para o flush ao sair
  const pendenteRef = useRef(false);  // há alteração ainda não persistida?
  useEffect(() => { respostasRef.current = respostas; }, [respostas]);

  const salvarProgresso = (mapa, aoSair = false) => {
    pendenteRef.current = false;
    if (aoSair) {
      // keepalive: a requisição completa mesmo se a aba estiver fechando.
      try {
        fetch(`${API_URL}/api/disc/avaliacao/progresso`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ respostas: mapa }),
          credentials: "include",
          keepalive: true,
        });
      } catch { /* melhor esforço: o próximo save cobre */ }
    } else {
      api("/disc/avaliacao/progresso", { respostas: mapa });
    }
  };

  const agendarSalvar = (mapa) => {
    pendenteRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => salvarProgresso(mapa), 600);
  };

  useEffect(() => {
    // Fechar/atualizar a aba: grava o rascunho imediatamente.
    const aoFechar = () => { if (pendenteRef.current) salvarProgresso(respostasRef.current, true); };
    window.addEventListener("beforeunload", aoFechar);
    window.addEventListener("pagehide", aoFechar);
    return () => {
      window.removeEventListener("beforeunload", aoFechar);
      window.removeEventListener("pagehide", aoFechar);
      // Desmontou (saiu da tela sem fechar): descarta o timer e grava o pendente.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pendenteRef.current) salvarProgresso(respostasRef.current, true);
    };
  }, []);

  if (estado === "carregando") {
    return <div className="vx-fade" style={{ padding: 48, textAlign: "center" }}><div className="vx-spinner" /></div>;
  }
  if (estado === "intro") {
    return <Intro dados={dados} ocupado={ocupado} onIniciar={iniciar} onVoltar={onVoltar} />;
  }
  if (estado === "resultado") {
    return <Resultado dados={dados} onVoltar={onVoltar} onRefazer={iniciar} aviso={aviso}
      onCompartilhar={async (v) => {
        const r = await api("/disc/avaliacao/compartilhamento", { compartilhar: v });
        if (r?.error) { aviso?.(r.error); return false; }
        return true;
      }} />;
  }

  // ---------- Quiz ----------
  const total = blocos.length;
  const atual = blocos[idx];
  const resp = respostas[atual?.id] || {};
  const completos = blocos.filter((b) => { const r = respostas[b.id]; return r?.mais && r?.menos; }).length;
  const podeAvancar = !!(resp.mais && resp.menos);
  const ultima = idx === total - 1;

  const marcar = (tipo, altId) => {
    setRespostas((prev) => {
      const at = prev[atual.id] || {};
      let novo;
      if (tipo === "mais") {
        novo = { ...at, mais: altId, menos: at.menos === altId ? undefined : at.menos };
      } else {
        novo = { ...at, menos: altId, mais: at.mais === altId ? undefined : at.mais };
      }
      const mapa = { ...prev, [atual.id]: novo };
      agendarSalvar(mapa);
      return mapa;
    });
  };

  const ir = (dir) => {
    setAnimDir(dir > 0 ? "next" : "prev");
    setIdx((i) => Math.max(0, Math.min(total - 1, i + dir)));
    window.scrollTo?.(0, 0);
  };

  const concluir = async () => {
    setOcupado(true);
    // Garante que o último estado foi salvo antes de concluir e evita um flush
    // de rascunho tardio depois que a tentativa já virou "concluído".
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendenteRef.current = false;
    const r = await api("/disc/avaliacao/concluir", { respostas });
    setOcupado(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível concluir a avaliação."); return; }
    await carregar();
    setEstado("resultado");
    onConcluir?.();
    window.scrollTo?.(0, 0);
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 620, margin: "0 auto" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: AZUL }}>
          <Brain size={16} /> DISC — Perfil comportamental
        </div>
        <span className="vx-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
          Pergunta {String(idx + 1).padStart(2, "0")} de {String(total).padStart(2, "0")}
        </span>
      </div>

      {/* Barra de progresso segmentada */}
      <div style={{ display: "flex", gap: 3, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 26 }}>
        {blocos.map((b, i) => {
          const r = respostas[b.id];
          const feito = r?.mais && r?.menos;
          return <div key={b.id} style={{ flex: 1, borderRadius: 3, transition: "background .3s",
            background: feito ? AZUL : i === idx ? "rgba(49,140,231,.3)" : "var(--surface-3, #e5e7eb)" }} />;
        })}
      </div>

      {/* Pergunta */}
      <div key={atual.id} style={{ animation: `discSlide${animDir === "next" ? "In" : "Back"} .25s ease` }}>
        <div className="vx-eyebrow" style={{ marginBottom: 6 }}>{atual.titulo}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5, margin: "0 0 20px", color: "var(--ink)" }}>
          {atual.pergunta}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {atual.alternativas.map((op) => {
            const eMais = resp.mais === op.id;
            const eMenos = resp.menos === op.id;
            return (
              <div key={op.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 14,
                border: `2px solid ${eMais ? AZUL : eMenos ? "var(--muted-2, #94a3b8)" : "var(--border)"}`,
                background: eMais ? "rgba(49,140,231,.08)" : eMenos ? "var(--surface-2, #f1f5f9)" : "var(--surface-2, #f8f9fa)",
                transition: "all .2s ease",
              }}>
                <div style={{ flex: 1, fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-2)" }}>{op.texto}</div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <BotaoEscolha ativo={eMais} corAtiva={AZUL} corTexto="#fff"
                    label="MAIS" onClick={() => marcar("mais", op.id)} />
                  <BotaoEscolha ativo={eMenos} corAtiva="var(--muted-2, #94a3b8)" corTexto="#fff"
                    label="MENOS" onClick={() => marcar("menos", op.id)} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="vx-mut" style={{ fontSize: 12, marginTop: 10, textAlign: "center" }}>
          Escolha a que <b>mais</b> e a que <b>menos</b> combina com você.
        </div>
      </div>

      {/* Navegação */}
      <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
        {idx > 0 && (
          <button className="vx-btn" onClick={() => ir(-1)} style={{ minHeight: 44, gap: 6 }}>
            <ArrowLeft size={15} /> Anterior
          </button>
        )}
        {ultima ? (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1, minHeight: 48 }}
            disabled={completos < total || ocupado}
            onClick={concluir}>
            {completos < total ? `Faltam ${total - completos} respostas` : <>Ver meu resultado <Sparkles size={15} /></>}
          </button>
        ) : (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1, minHeight: 44 }}
            disabled={!podeAvancar} onClick={() => ir(1)}>
            Próxima <ArrowRight size={15} />
          </button>
        )}
      </div>

      <style>{`
        @keyframes discSlideIn { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes discSlideBack { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

function BotaoEscolha({ ativo, corAtiva, corTexto, label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      style={{
        padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
        border: "none", minWidth: 52, minHeight: 36, transition: "all .15s",
        background: ativo ? corAtiva : "var(--surface)", color: ativo ? corTexto : "var(--muted)",
        boxShadow: ativo ? "0 2px 8px rgba(0,0,0,.14)" : "0 1px 3px rgba(0,0,0,.06)",
      }}>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Intro({ dados, ocupado, onIniciar, onVoltar }) {
  const emAndamento = dados?.tentativa?.status === "andamento";
  const dimensoes = dados?.dimensoes || [];
  const historico = dados?.historicoAntigo;

  return (
    <div className="vx-fade" style={{ maxWidth: 680, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar à central
      </button>

      <div className="vx-card" style={{ padding: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(49,140,231,.10)", color: AZUL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Brain size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>DISC — Perfil comportamental</h1>
            {dados?.experimental && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--amber, #b45309)", background: "var(--amber-50, rgba(245,158,11,.12))", borderRadius: 999, padding: "3px 10px", marginTop: 6 }}>
                <Info size={12} /> Instrumento experimental de autoconhecimento
              </span>
            )}
          </div>
        </div>

        <p className="vx-mut" style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 18px" }}>
          Descubra suas tendências de comportamento, sua maneira de interagir com pessoas e como
          costuma agir diante de diferentes situações profissionais.
        </p>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 20 }}>
          <InfoLinha Icon={Layers} texto={`${dados?.totalBlocos || 24} blocos de perguntas`} />
          <InfoLinha Icon={Clock} texto="Aproximadamente 8 a 12 minutos" />
          <InfoLinha Icon={Brain} texto="Quatro dimensões comportamentais" />
          <InfoLinha Icon={CheckCircle2} texto="Sem respostas certas ou erradas" />
        </div>

        {/* Quatro dimensões */}
        <div className="vx-eyebrow" style={{ marginBottom: 10 }}>As quatro dimensões</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 20 }}>
          {dimensoes.map((d) => (
            <div key={d.letra} style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `${d.cor}1a`, color: d.cor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15 }}>{d.letra}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{d.nome}</div>
                <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>{d.descricao}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Instruções */}
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(49,140,231,.06)", border: "1px solid rgba(49,140,231,.18)", marginBottom: 20 }}>
          <div className="vx-eyebrow" style={{ color: AZUL, marginBottom: 4 }}>Como responder</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "var(--ink-2)" }}>
            Em cada pergunta, escolha a alternativa que MAIS combina com você e aquela que MENOS
            combina. Pense em como costuma agir naturalmente, e não em como acredita que deveria agir.
          </p>
        </div>

        {historico && (
          <div className="vx-mut" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 18, padding: "10px 12px", borderRadius: 10, border: "1px dashed var(--border)" }}>
            Você já tem um resultado de uma versão anterior do DISC ({historico.label || historico.predominante}).
            Ele é preservado — esta é uma avaliação nova e mais completa, feita por sua escolha.
          </div>
        )}

        <button className="vx-btn vx-btn-primary" style={{ width: "100%", justifyContent: "center", minHeight: 48 }}
          disabled={ocupado} onClick={onIniciar}>
          {emAndamento ? <>Continuar avaliação <ArrowRight size={15} /></> : <>Começar avaliação <ArrowRight size={15} /></>}
        </button>
        <p className="vx-mut" style={{ fontSize: 11.5, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
          O resultado é privado e não é usado para aprovar, reprovar ou classificar você.
          Você pode continuar depois: seu progresso fica salvo.
        </p>
      </div>
    </div>
  );
}

function InfoLinha({ Icon, texto }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
      <Icon size={16} style={{ color: AZUL, flexShrink: 0 }} /> {texto}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Resultado({ dados, onVoltar, onRefazer, onCompartilhar, aviso }) {
  const resultado = dados?.resultado || {};
  const relatorio = dados?.relatorio || { cardPrincipal: {}, secoes: {} };
  const dimMeta = useMemo(() => Object.fromEntries((dados?.dimensoes || []).map((d) => [d.letra, d])), [dados]);
  const contagens = resultado.contagens || {};
  const [compartilhar, setCompartilhar] = useState(!!dados?.tentativa?.compartilhar);

  const dataConclusao = dados?.concluidoEm
    ? new Date(dados.concluidoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  const ordem = ["D", "I", "S", "C"];

  const alternar = async () => {
    const novo = !compartilhar;
    setCompartilhar(novo);
    const ok = await onCompartilhar(novo);
    if (!ok) setCompartilhar(!novo);
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 680, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar à central
      </button>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ color: AZUL }}>DISC — Perfil comportamental</div>
        <h1 className="vx-disp" style={{ fontSize: 24, margin: "4px 0 6px" }}>Seu perfil comportamental</h1>
        <p className="vx-mut" style={{ fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
          Conheça as tendências identificadas nas suas respostas.
        </p>
        <div className="vx-mut" style={{ fontSize: 12, marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {dataConclusao && <span>Concluído em {dataConclusao}</span>}
          <span>Versão {resultado.versao || dados?.versao}</span>
        </div>
      </div>

      {/* Card principal */}
      <div className="vx-card" style={{ padding: 24, textAlign: "center", marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 30, margin: 0, color: AZUL }}>{resultado.label || "—"}</div>
        {relatorio.cardPrincipal?.titulo && (
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginTop: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>
            {relatorio.cardPrincipal.titulo}
          </div>
        )}
        <p className="vx-mut" style={{ fontSize: 13.5, maxWidth: 440, margin: "12px auto 0", lineHeight: 1.7 }}>
          {relatorio.cardPrincipal?.frase}
        </p>
      </div>

      {/* Gráfico das dimensões */}
      <div className="vx-card" style={{ padding: 22, marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 14 }}>Distribuição das escolhas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {ordem.map((d) => {
            const meta = dimMeta[d] || {};
            const c = contagens[d] || { mais: 0, menos: 0 };
            const pct = Math.round((c.mais / 24) * 100);
            return (
              <div key={d}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    <b style={{ color: meta.cor }}>{d}</b> · {meta.nome}
                  </div>
                  <div className="vx-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                    MAIS {c.mais} · MENOS {c.menos}
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: meta.cor, borderRadius: 999, transition: "width .5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="vx-mut" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
          As barras mostram a frequência de escolhas MAIS (de 0 a 24). Não representam percentis
          psicológicos nem intensidade absoluta de um traço.
        </p>
      </div>

      {/* Interpretação */}
      <div className="vx-card" style={{ padding: 22, marginBottom: 16 }}>
        <Secao titulo="Como você costuma agir" texto={relatorio.secoes?.comoAgir} />
        <Secao titulo="Sua forma de se comunicar" texto={relatorio.secoes?.comunicacao} />
        <Secao titulo="Sua maneira de trabalhar" texto={relatorio.secoes?.trabalho} />
        <Secao titulo="Pontos para desenvolver" texto={relatorio.secoes?.desenvolver} />
        <Secao titulo="Entendendo seu resultado" texto={relatorio.secoes?.entendendo} ultimo />
      </div>

      {/* Compartilhamento */}
      <div className="vx-card" style={{ padding: 18, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
            {compartilhar ? <Eye size={16} style={{ color: AZUL }} /> : <EyeOff size={16} style={{ color: "var(--muted)" }} />}
            Compartilhar com empresas
          </div>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.5, maxWidth: 420 }}>
            {compartilhar
              ? "As empresas que avaliam seu perfil podem ver este resultado. Você pode desativar quando quiser."
              : "Seu resultado é privado. Ative para permitir que empresas vejam suas tendências comportamentais."}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={compartilhar} onClick={alternar}
          style={{
            flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: "none", cursor: "pointer",
            background: compartilhar ? AZUL : "var(--surface-3, #cbd5e1)", position: "relative", transition: "background .2s",
          }}>
          <span style={{ position: "absolute", top: 3, left: compartilhar ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="vx-btn vx-btn-sm" onClick={onRefazer}>
          <RefreshCw size={13} /> Refazer avaliação
        </button>
      </div>

      <div className="vx-chart-source" style={{ textAlign: "center", marginTop: 14 }}>
        Instrumento experimental de autoconhecimento da RYCS. Descreve preferências relativas — nunca aprova, reprova ou classifica você.
      </div>
    </div>
  );
}

function Secao({ titulo, texto, ultimo }) {
  if (!texto) return null;
  return (
    <div style={{ marginBottom: ultimo ? 0 : 16 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 5 }}>{titulo}</div>
      <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65, margin: 0 }}>{texto}</p>
    </div>
  );
}
