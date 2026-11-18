import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Scale, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Eye, EyeOff, ClipboardList,
} from "lucide-react";
import { api, API_URL } from "../../lib/api.js";

// Azul institucional White Editorial (mesmo dos demais fluxos).
const AZUL = "#318CE7";

// =============================================================================
// Julgamento Situacional Profissional — avaliação situacional de múltipla
// escolha. A correção é sempre no servidor; o gabarito só aparece na revisão,
// depois de concluir. Uma tentativa concluída por profissional (sem refazer).
// =============================================================================
export default function JulgamentoSituacional({ onVoltar, aviso, recarregar }) {
  const [carregando, setCarregando] = useState(true);
  const [estado, setEstado] = useState(null);
  const [fase, setFase] = useState("intro"); // intro | quiz | resultado
  const [itens, setItens] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [atual, setAtual] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [relatorio, setRelatorio] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await api("/julgamento");
      if (!vivo) return;
      if (!r || r.error) { aviso?.(r?.error || "Não foi possível carregar a avaliação."); onVoltar?.(); return; }
      setEstado(r);
      if (r.tentativa?.status === "concluido" && r.resultado) {
        setResultado(r.resultado);
        setRelatorio(r.relatorio || null);
        setFase("resultado");
      } else {
        setFase("intro");
      }
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [aviso, onVoltar]);

  // ---- Auto-save das respostas (com gravação garantida ao sair) ----
  const salvarTimer = useRef(null);
  const respostasRef = useRef({});
  const faseRef = useRef("intro");
  useEffect(() => { faseRef.current = fase; }, [fase]);

  const agendarSalvar = useCallback((mapa) => {
    respostasRef.current = mapa;
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => {
      api("/julgamento/progresso", { respostas: mapa });
    }, 600);
  }, []);

  const flushSalvar = useCallback(() => {
    if (salvarTimer.current) { clearTimeout(salvarTimer.current); salvarTimer.current = null; }
    if (faseRef.current !== "quiz") return;
    const mapa = respostasRef.current;
    if (!mapa || !Object.keys(mapa).length) return;
    try {
      fetch(`${API_URL}/api/julgamento/progresso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas: mapa }),
        credentials: "include",
        keepalive: true,
      });
    } catch { /* silencioso: é apenas o salvamento de saída */ }
  }, []);

  useEffect(() => {
    const aoSair = () => flushSalvar();
    window.addEventListener("pagehide", aoSair);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      window.removeEventListener("pagehide", aoSair);
      window.removeEventListener("beforeunload", aoSair);
      flushSalvar();
    };
  }, [flushSalvar]);

  const sairDoQuiz = useCallback(async () => {
    if (salvarTimer.current) { clearTimeout(salvarTimer.current); salvarTimer.current = null; }
    const mapa = respostasRef.current;
    if (mapa && Object.keys(mapa).length) {
      await api("/julgamento/progresso", { respostas: mapa });
    }
    onVoltar?.();
  }, [onVoltar]);

  const iniciar = async () => {
    setEnviando(true);
    const r = await api("/julgamento/iniciar", { iniciar: true });
    setEnviando(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível iniciar a avaliação."); return; }
    const resp = r.respostas || {};
    setItens(r.itens || []);
    setRespostas(resp);
    respostasRef.current = resp;
    const idx = (r.itens || []).findIndex((it) => !resp[it.id]);
    setAtual(idx >= 0 ? idx : 0);
    setFase("quiz");
  };

  const responder = (itemId, letra) => {
    setRespostas((prev) => {
      const mapa = { ...prev, [itemId]: letra };
      agendarSalvar(mapa);
      return mapa;
    });
  };

  const total = itens.length || estado?.total || 25;
  const respondidas = useMemo(
    () => itens.reduce((n, it) => (respostas[it.id] ? n + 1 : n), 0),
    [itens, respostas]
  );
  const todasRespondidas = itens.length > 0 && respondidas === itens.length;

  const concluir = async () => {
    if (!todasRespondidas) { aviso?.("Responda todas as situações antes de concluir."); return; }
    setEnviando(true);
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    const r = await api("/julgamento/concluir", { respostas });
    setEnviando(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível concluir a avaliação."); return; }
    setResultado(r.resultado);
    setRelatorio(r.relatorio || null);
    setFase("resultado");
    recarregar?.();
  };

  const irProximo = () => setAtual((i) => Math.min(i + 1, itens.length - 1));
  const irAnterior = () => setAtual((i) => Math.max(i - 1, 0));

  if (carregando) {
    return (
      <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>
    );
  }

  if (fase === "resultado") {
    return (
      <ResultadoJulgamento
        relatorio={relatorio}
        compartilhar={estado?.tentativa?.compartilhar}
        onVoltar={onVoltar}
        aviso={aviso}
      />
    );
  }

  if (fase === "quiz") {
    return (
      <Questionario
        itens={itens}
        respostas={respostas}
        atual={atual}
        respondidas={respondidas}
        total={total}
        onResponder={responder}
        onProximo={irProximo}
        onAnterior={irAnterior}
        onConcluir={concluir}
        onVoltar={sairDoQuiz}
        enviando={enviando}
        todasRespondidas={todasRespondidas}
      />
    );
  }

  return (
    <Intro estado={estado} onIniciar={iniciar} onVoltar={onVoltar} enviando={enviando} />
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Intro({ estado, onIniciar, onVoltar, enviando }) {
  const emAndamento = estado?.tentativa?.status === "andamento";
  const progresso = estado?.tentativa?.progresso || 0;
  const total = estado?.total || 25;

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
            <Scale size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="vx-disp" style={{ fontSize: 21, margin: 0 }}>Julgamento Situacional Profissional</h1>
            <p className="vx-mut" style={{ fontSize: 13.5, margin: "4px 0 0", lineHeight: 1.5 }}>
              Explore situações desafiadoras do ambiente profissional e descubra como você identifica decisões
              responsáveis, colaborativas e adequadas a diferentes contextos.
            </p>
          </div>
        </div>

        <Linha rotulo="O que esperar">
          São {total} situações, cada uma com quatro alternativas e uma resposta preferencial. Leva cerca de
          15 a 20 minutos, em cinco competências: ética e integridade, responsabilidade, colaboração, autonomia
          e julgamento sob pressão.
        </Linha>
        <Linha rotulo="Como responder">
          Leia cada situação com atenção. Considere as informações disponíveis e escolha a atitude que você
          acredita ser mais adequada.
        </Linha>
        <Linha rotulo="Salvamento">
          Seu progresso é salvo automaticamente. Você pode fechar e retomar de onde parou. É permitida uma
          tentativa concluída, e as respostas não podem ser alteradas após a conclusão.
        </Linha>
        <Linha rotulo="Privacidade">
          Avaliação voluntária, privada por padrão. Só fica visível para empresas se você autorizar. Mostra
          quais alternativas você reconheceu como preferenciais — não comprova caráter nem prevê comportamento,
          e nunca altera score, ranking ou campanhas.
        </Linha>

        {Array.isArray(estado?.pendencias) && estado.pendencias.length > 0 && (
          <details style={{ marginBottom: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--muted)" }}>
              Limitações desta versão
            </summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
              {estado.pendencias.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </details>
        )}

        {emAndamento && (
          <div className="vx-mut" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Você já respondeu {progresso} de {total}. Continue de onde parou.
          </div>
        )}

        <button type="button" className="vx-btn vx-btn-primary" disabled={enviando}
          onClick={onIniciar} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
          {emAndamento ? "Continuar avaliação" : "Começar avaliação"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Questionario({
  itens, respostas, atual, respondidas, total,
  onResponder, onProximo, onAnterior, onConcluir, onVoltar, enviando, todasRespondidas,
}) {
  const item = itens[atual];
  const letraAtual = item ? respostas[item.id] : undefined;
  const ultimo = atual === itens.length - 1;

  const selecionar = (letra) => {
    onResponder(item.id, letra);
    if (!ultimo) setTimeout(onProximo, 180);
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Sair (progresso salvo)
      </button>

      {/* Cabeçalho (padrão do sistema: nome + contador mono) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: AZUL }}>
          <Scale size={16} /> Julgamento Situacional
        </div>
        <span className="vx-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
          Situação {String(atual + 1).padStart(2, "0")} de {String(total).padStart(2, "0")}
        </span>
      </div>

      {/* Barra de progresso segmentada (padrão do sistema) */}
      <div style={{ display: "flex", gap: 3, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 26 }}>
        {itens.map((it, i) => {
          const feito = !!respostas[it.id];
          return (
            <div key={it.id} aria-hidden="true" style={{
              flex: 1, borderRadius: 3, transition: "background .3s",
              background: feito ? AZUL : i === atual ? "rgba(49,140,231,.3)" : "var(--surface-3, #e5e7eb)",
            }} />
          );
        })}
      </div>

      <div className="vx-card" style={{ padding: 24 }}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 18.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, marginBottom: 16, width: "100%" }}>
            {item?.enunciado}
          </legend>

          <div role="radiogroup" aria-label="Alternativas" style={{ display: "grid", gap: 10 }}>
            {(item?.alternativas || []).map((alt) => {
              const sel = letraAtual === alt.id;
              return (
                <button
                  key={alt.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => selecionar(alt.id)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "12px 16px", textAlign: "left",
                    borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 14,
                    border: `1.5px solid ${sel ? AZUL : "var(--border, #e5e7eb)"}`,
                    background: sel ? "rgba(49,140,231,.08)" : "var(--surface, #fff)",
                    color: sel ? AZUL : "var(--ink)",
                    fontWeight: sel ? 600 : 400, lineHeight: 1.5,
                    transition: "border-color .15s ease, background .15s ease",
                  }}
                >
                  <span aria-hidden="true" style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1,
                    fontSize: 12.5, fontWeight: 700,
                    border: `1.5px solid ${sel ? AZUL : "var(--muted-2)"}`,
                    color: sel ? "#fff" : "var(--muted)",
                    background: sel ? AZUL : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {alt.id}
                  </span>
                  <span>{alt.texto}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Navegação */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
        <button type="button" className="vx-btn vx-btn-sm" onClick={onAnterior} disabled={atual === 0}
          style={{ opacity: atual === 0 ? 0.5 : 1 }}>
          <ArrowLeft size={14} /> Anterior
        </button>
        {!ultimo ? (
          <button type="button" className="vx-btn vx-btn-sm" onClick={onProximo}
            disabled={atual >= itens.length - 1} style={{ marginLeft: "auto" }}>
            Próxima <ArrowRight size={14} />
          </button>
        ) : (
          <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" onClick={onConcluir}
            disabled={enviando || !todasRespondidas} style={{ marginLeft: "auto", opacity: (!todasRespondidas || enviando) ? 0.6 : 1 }}>
            <CheckCircle2 size={14} /> Concluir avaliação
          </button>
        )}
      </div>
      {ultimo && !todasRespondidas && (
        <p className="vx-mut" style={{ fontSize: 12, textAlign: "right", marginTop: 8 }}>
          Faltam {total - respondidas} situações para concluir.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function ResultadoJulgamento({ relatorio, compartilhar, onVoltar, aviso }) {
  const [visivel, setVisivel] = useState(!!compartilhar);
  const [salvandoVis, setSalvandoVis] = useState(false);
  const [verRevisao, setVerRevisao] = useState(false);

  const competencias = relatorio?.competencias || [];
  const acertos = relatorio?.acertos ?? 0;
  const total = relatorio?.total ?? 25;
  const percentual = relatorio?.percentual ?? 0;
  const maisAcertos = relatorio?.maisAcertos || [];
  const desenvolver = relatorio?.desenvolver || [];
  const revisao = relatorio?.revisao || [];
  const porChave = useMemo(() => Object.fromEntries(competencias.map((c) => [c.chave, c])), [competencias]);

  const alternarVisibilidade = async () => {
    const novo = !visivel;
    setSalvandoVis(true);
    const r = await api("/julgamento/compartilhamento", { compartilhar: novo });
    setSalvandoVis(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível salvar a preferência."); return; }
    setVisivel(!!r.compartilhar);
    aviso?.(r.compartilhar ? "Resultado visível para empresas." : "Resultado mantido privado.");
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Cabeçalho + card principal */}
      <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ color: AZUL }}>Julgamento Situacional — Resultado</div>
        <h1 className="vx-disp" style={{ fontSize: 22, margin: "6px 0 4px" }}>Seu resultado em Julgamento Situacional</h1>
        <p className="vx-mut" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          Veja seu desempenho em situações que exigem responsabilidade, colaboração e decisões profissionais.
        </p>

        <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: AZUL, lineHeight: 1 }}>
            {acertos} <span style={{ fontSize: 18, fontWeight: 600, color: "var(--muted)" }}>de {total}</span>
          </div>
          <div className="vx-mono" style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>
            {percentual}% de acertos
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, margin: "10px 0 0" }}>
          Você identificou a resposta preferencial em {acertos} das {total} situações apresentadas.
        </p>
      </div>

      {/* Gráfico por competência (acertos de 0 a 5) */}
      <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 2 }}>Acertos por competência</div>
        <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 18px", lineHeight: 1.5 }}>
          Cada barra mostra seus acertos na competência, de 0 a {competencias[0]?.total ?? 5}.
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          {competencias.map((c) => <BarraCompetencia key={c.chave} c={c} />)}
        </div>
      </div>

      {/* Análise: mais acertos / desenvolvimento */}
      {maisAcertos.length > 0 && (
        <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>
            {relatorio?.tituloMaisAcertos || "Áreas com mais acertos"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {maisAcertos.map((ch) => (
              <span key={ch} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: AZUL, background: "rgba(49,140,231,.08)", borderRadius: 999, padding: "5px 12px" }}>
                <CheckCircle2 size={13} /> {porChave[ch]?.nome} · {porChave[ch]?.acertos}/{porChave[ch]?.total}
              </span>
            ))}
          </div>
        </div>
      )}

      {desenvolver.length > 0 && (
        <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>
            {relatorio?.tituloDesenvolver || "Oportunidades de desenvolvimento"}
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {desenvolver.map((ch) => {
              const c = porChave[ch];
              if (!c) return null;
              return (
                <div key={ch}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                    {c.nome} <span className="vx-mono" style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>· {c.acertos}/{c.total}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, margin: "3px 0 0" }}>{c.sugestao}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revisar respostas */}
      {revisao.length > 0 && (
        <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
          <button type="button" className="vx-btn vx-btn-sm" onClick={() => setVerRevisao((v) => !v)} style={{ width: "100%", justifyContent: "center" }}>
            <ClipboardList size={14} /> {verRevisao ? "Ocultar revisão das respostas" : "Revisar respostas"}
          </button>
          {verRevisao && (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {revisao.map((q) => <ItemRevisao key={q.id} q={q} />)}
            </div>
          )}
        </div>
      )}

      {/* Visibilidade */}
      <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {visivel ? "Visível para empresas" : "Resultado privado"}
            </div>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0", maxWidth: 420, lineHeight: 1.5 }}>
              Por padrão seu resultado é privado. Você pode autorizar que empresas o vejam no seu
              perfil — e revogar quando quiser.
            </p>
          </div>
          <button type="button" className="vx-btn vx-btn-sm" onClick={alternarVisibilidade} disabled={salvandoVis}>
            {visivel ? <><EyeOff size={14} /> Tornar privado</> : <><Eye size={14} /> Autorizar empresas</>}
          </button>
        </div>
      </div>

      {relatorio?.notaGlobal && (
        <div className="vx-chart-source" style={{ lineHeight: 1.6 }}>
          {relatorio.notaGlobal}
        </div>
      )}
    </div>
  );
}

function BarraCompetencia({ c }) {
  const pct = Math.max(0, Math.min(100, (Number(c.acertos) / Number(c.total || 5)) * 100));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{c.nome}</span>
        <span className="vx-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {c.acertos}/{c.total} · {c.percentual}%
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: c.cor || AZUL, borderRadius: 999, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}

function ItemRevisao({ q }) {
  const corOk = "var(--green, #22c55e)";
  const corErro = "#e5484d";
  const altById = Object.fromEntries((q.alternativas || []).map((a) => [a.id, a.texto]));
  const textoEscolhida = q.escolhida ? altById[q.escolhida] : null;
  const textoCorreta = altById[q.correta];

  return (
    <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <span style={{ flexShrink: 0, marginTop: 1, color: q.acertou ? corOk : corErro }}>
          {q.acertou ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>
          <span className="vx-mono" style={{ fontSize: 12, color: "var(--muted)", marginRight: 6 }}>{String(q.numero).padStart(2, "0")}</span>
          {q.enunciado}
        </div>
      </div>

      <div style={{ paddingLeft: 24, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600, color: q.acertou ? corOk : corErro }}>Sua resposta ({q.escolhida || "—"}):</span>{" "}
          {textoEscolhida || "não respondida"}
        </div>
        {!q.acertou && (
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600, color: corOk }}>Preferencial ({q.correta}):</span> {textoCorreta}
          </div>
        )}
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
          <span className="vx-eyebrow">Por quê</span> {q.justificativa}
        </div>
      </div>
    </div>
  );
}
