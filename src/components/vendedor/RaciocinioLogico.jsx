import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Puzzle, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Eye, EyeOff, Info,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { api } from "../../lib/api.js";

const AZUL = "#318CE7";
const VERDE = "#22c55e";
const VERMELHO = "#ef4444";

// =============================================================================
// Raciocínio Lógico e Analítico — fluxo completo: intro → questionário →
// resultado. A correção é sempre no servidor; o gabarito não chega ao cliente
// antes da conclusão. Durante o teste não se revela se a resposta está correta.
// =============================================================================
export default function RaciocinioLogico({ onVoltar, aviso, recarregar }) {
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
      const r = await api("/raciocinio");
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

  const salvarTimer = useRef(null);
  const agendarSalvar = useCallback((mapa) => {
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => { api("/raciocinio/progresso", { respostas: mapa }); }, 600);
  }, []);
  useEffect(() => () => { if (salvarTimer.current) clearTimeout(salvarTimer.current); }, []);

  const iniciar = async () => {
    setEnviando(true);
    const r = await api("/raciocinio/iniciar", { iniciar: true });
    setEnviando(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível iniciar a avaliação."); return; }
    if (r.jaConcluido) { setResultado(r.resultado); setRelatorio(r.relatorio || null); setFase("resultado"); return; }
    const resp = r.respostas || {};
    setItens(r.itens || []);
    setRespostas(resp);
    const idx = (r.itens || []).findIndex((it) => !resp[it.id]);
    setAtual(idx >= 0 ? idx : 0);
    setFase("quiz");
  };

  const responder = (itemId, alternativaId) => {
    setRespostas((prev) => {
      const mapa = { ...prev, [itemId]: alternativaId };
      agendarSalvar(mapa);
      return mapa;
    });
  };

  const total = itens.length || estado?.total || 20;
  const respondidas = useMemo(
    () => itens.reduce((n, it) => (respostas[it.id] ? n + 1 : n), 0),
    [itens, respostas]
  );
  const todasRespondidas = itens.length > 0 && respondidas === itens.length;

  const concluir = async () => {
    if (!todasRespondidas) { aviso?.("Responda todas as questões antes de finalizar."); return; }
    setEnviando(true);
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    const r = await api("/raciocinio/concluir", { respostas });
    setEnviando(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível finalizar a avaliação."); return; }
    setResultado(r.resultado);
    setRelatorio(r.relatorio || null);
    setFase("resultado");
    recarregar?.();
  };

  const irProximo = () => setAtual((i) => Math.min(i + 1, itens.length - 1));
  const irAnterior = () => setAtual((i) => Math.max(i - 1, 0));

  if (carregando) {
    return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  }

  if (fase === "resultado") {
    return (
      <Resultado
        resultado={resultado}
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
        onVoltar={onVoltar}
        enviando={enviando}
        todasRespondidas={todasRespondidas}
      />
    );
  }

  return <Intro estado={estado} onIniciar={iniciar} onVoltar={onVoltar} enviando={enviando} />;
}

// ─────────────────────────────────────────────────────────────────────────
function Intro({ estado, onIniciar, onVoltar, enviando }) {
  const emAndamento = estado?.tentativa?.status === "andamento";
  const progresso = estado?.tentativa?.progresso || 0;
  const total = estado?.total || 20;

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
            <Puzzle size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="vx-disp" style={{ fontSize: 21, margin: 0 }}>Raciocínio Lógico e Analítico</h1>
            <p className="vx-mut" style={{ fontSize: 13.5, margin: "4px 0 0", lineHeight: 1.5 }}>
              Resolva desafios que envolvem números, padrões, dedução e interpretação de informações.
              Descubra como você se sai em diferentes tipos de problemas.
            </p>
          </div>
        </div>

        {estado?.experimental && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--amber)", background: "rgba(245,158,11,.10)", borderRadius: 999, padding: "6px 12px", marginBottom: 16 }}>
            <Info size={13} /> Avaliação de desempenho — não é teste de QI.
          </div>
        )}

        <Linha rotulo="Formato">
          {total} questões · aproximadamente 15 a 20 minutos · quatro competências · uma resposta correta por questão.
        </Linha>
        <Linha rotulo="Instruções">
          Leia cada questão com atenção e selecione a alternativa que considera correta. Você pode
          revisar suas respostas antes de finalizar. O resultado aparece ao concluir.
        </Linha>
        <Linha rotulo="Salvamento">
          Seu progresso é salvo automaticamente. Você pode interromper e continuar depois.
        </Linha>
        <Linha rotulo="Privacidade">
          Participação voluntária. Resultado privado por padrão — só fica visível para empresas se você
          autorizar. Não altera seu score comercial, ranking ou acesso a campanhas.
        </Linha>

        {Array.isArray(estado?.pendencias) && estado.pendencias.length > 0 && (
          <details style={{ marginBottom: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--muted)" }}>O que esta avaliação não é</summary>
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
  const selecionada = item ? respostas[item.id] : undefined;
  const ultimo = atual === itens.length - 1;

  const selecionar = (altId) => {
    onResponder(item.id, altId);
    if (!ultimo) setTimeout(onProximo, 200);
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Sair (progresso salvo)
      </button>

      {/* Barra de progresso segmentada */}
      <div style={{ display: "flex", gap: 3, alignItems: "stretch", height: 6, marginBottom: 6 }}>
        {itens.map((it, i) => {
          const feito = !!respostas[it.id];
          const ativo = i === atual;
          return (
            <div key={it.id} aria-hidden="true" style={{
              flex: 1, minWidth: 0, borderRadius: 2,
              background: feito ? AZUL : "var(--surface-2)",
              outline: ativo ? `1.5px solid ${AZUL}` : "none", outlineOffset: ativo ? 1 : 0,
              transition: "background .2s ease",
            }} />
          );
        })}
      </div>
      <div className="vx-mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
        <span>Questão {atual + 1} de {total}</span>
        <span>{respondidas} respondidas</span>
      </div>

      <div className="vx-card" style={{ padding: 24 }}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 17.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5, marginBottom: 16, width: "100%" }}>
            {item?.enunciado}
          </legend>

          <div role="radiogroup" aria-label="Alternativas" style={{ display: "grid", gap: 10 }}>
            {(item?.alternativas || []).map((alt) => {
              const sel = selecionada === alt.id;
              return (
                <button
                  key={alt.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => selecionar(alt.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    minHeight: 52, padding: "12px 16px", textAlign: "left",
                    borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 14.5,
                    border: `1.5px solid ${sel ? AZUL : "var(--border, #e5e7eb)"}`,
                    background: sel ? "rgba(49,140,231,.08)" : "var(--surface, #fff)",
                    color: sel ? AZUL : "var(--ink)", fontWeight: sel ? 600 : 400,
                    transition: "border-color .15s ease, background .15s ease",
                  }}
                >
                  <span aria-hidden="true" style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                    border: `1.5px solid ${sel ? AZUL : "var(--muted-2)"}`,
                    background: sel ? AZUL : "transparent", color: sel ? "#fff" : "var(--muted)",
                  }}>{alt.id}</span>
                  {alt.texto}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

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
            <CheckCircle2 size={14} /> Finalizar avaliação
          </button>
        )}
      </div>
      {ultimo && !todasRespondidas && (
        <p className="vx-mut" style={{ fontSize: 12, textAlign: "right", marginTop: 8 }}>
          Faltam {total - respondidas} questões para finalizar.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Resultado({ resultado, relatorio, compartilhar, onVoltar, aviso }) {
  const [visivel, setVisivel] = useState(!!compartilhar);
  const [salvandoVis, setSalvandoVis] = useState(false);
  const [verRevisao, setVerRevisao] = useState(false);

  const competencias = relatorio?.competencias || [];
  const acertos = relatorio?.acertosTotais ?? resultado?.acertosTotais ?? 0;
  const total = relatorio?.totalQuestoes ?? resultado?.totalQuestoes ?? 20;
  const percentual = relatorio?.percentual ?? resultado?.percentual ?? 0;
  const dataConclusao = resultado?.concluidoEm
    ? new Date(resultado.concluidoEm).toLocaleDateString("pt-BR")
    : null;
  const analise = relatorio?.analise || { fortes: [], desenvolver: [] };

  const alternarVisibilidade = async () => {
    const novo = !visivel;
    setSalvandoVis(true);
    const r = await api("/raciocinio/compartilhamento", { compartilhar: novo });
    setSalvandoVis(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível salvar a preferência."); return; }
    setVisivel(!!r.compartilhar);
    aviso?.(r.compartilhar ? "Resultado visível para empresas." : "Resultado mantido privado.");
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 680, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Cabeçalho + card principal */}
      <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ color: AZUL }}>Seu resultado em Raciocínio Lógico</div>
        <p className="vx-mut" style={{ fontSize: 13, margin: "6px 0 18px", lineHeight: 1.6 }}>
          Veja seu desempenho nos desafios de lógica, números e análise de informações.
        </p>

        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <div className="vx-disp" style={{ fontSize: 40, color: AZUL, lineHeight: 1 }}>{percentual}%</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{acertos} de {total} questões</div>
            <div className="vx-mut" style={{ fontSize: 12.5 }}>
              de acertos{dataConclusao ? ` · concluído em ${dataConclusao}` : ""}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "14px 0 0", lineHeight: 1.6 }}>
          Você acertou {acertos} das {total} questões desta avaliação.
        </p>
      </div>

      {/* Desempenho por competência */}
      <div className="vx-card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 14 }}>Desempenho por área</div>
        <div style={{ display: "grid", gap: 16 }}>
          {competencias.map((c) => (
            <div key={c.chave}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{c.nome}</span>
                <span className="vx-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.acertos} / {c.total} acertos</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${c.total ? (c.acertos / c.total) * 100 : 0}%`, background: c.cor || AZUL, borderRadius: 999, transition: "width .5s ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Análise */}
      <div className="vx-card" style={{ padding: 20, marginBottom: 16 }}>
        {analise.fortes?.length > 0 && (
          <div style={{ marginBottom: analise.desenvolver?.length ? 14 : 0 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 4 }}>Áreas mais fortes</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Maior número de acertos em: {analise.fortes.join(", ")}.
            </div>
          </div>
        )}
        {analise.desenvolver?.length > 0 && (
          <div>
            <div className="vx-eyebrow" style={{ marginBottom: 4 }}>Oportunidades de desenvolvimento</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Mais erros em: {analise.desenvolver.join(", ")}. São áreas para praticar — não dizem nada
              sobre suas características pessoais.
            </div>
          </div>
        )}
        {!analise.fortes?.length && !analise.desenvolver?.length && (
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Desempenho equilibrado entre as áreas.</div>
        )}
      </div>

      {/* Revisão de respostas */}
      <div className="vx-card" style={{ padding: 20, marginBottom: 16 }}>
        <button type="button" onClick={() => setVerRevisao((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", font: "inherit", padding: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Revisar respostas</span>
          {verRevisao ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {verRevisao && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            {(relatorio?.revisao || []).map((q) => (
              <RevisaoQuestao key={q.id} q={q} />
            ))}
          </div>
        )}
      </div>

      {/* Visibilidade */}
      <div className="vx-card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {visivel ? "Visível para empresas" : "Resultado privado"}
            </div>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0", maxWidth: 440, lineHeight: 1.5 }}>
              Por padrão seu resultado é privado. Você pode autorizar que empresas o vejam no seu perfil —
              e revogar quando quiser. O percentual mede desempenho nestas questões, não uma certificação geral.
            </p>
          </div>
          <button type="button" className="vx-btn vx-btn-sm" onClick={alternarVisibilidade} disabled={salvandoVis}>
            {visivel ? <><EyeOff size={14} /> Tornar privado</> : <><Eye size={14} /> Autorizar empresas</>}
          </button>
        </div>
      </div>

      {relatorio?.notaGlobal && (
        <div className="vx-chart-source" style={{ lineHeight: 1.6 }}>{relatorio.notaGlobal}</div>
      )}
    </div>
  );
}

function RevisaoQuestao({ q }) {
  return (
    <div style={{ borderTop: "1px solid var(--surface-2)", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: q.acertou ? VERDE : VERMELHO }}>
          {q.acertou ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {q.acertou ? "Correta" : "Incorreta"}
        </span>
        <span className="vx-mut" style={{ fontSize: 11.5 }}>Questão {q.numero} · {q.competenciaNome}</span>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 500, lineHeight: 1.5, marginBottom: 8 }}>{q.enunciado}</div>
      <div style={{ display: "grid", gap: 5 }}>
        {q.alternativas.map((alt) => {
          const correta = alt.id === q.correta;
          const escolhida = alt.id === q.selecionada;
          const cor = correta ? VERDE : (escolhida ? VERMELHO : "var(--muted-2)");
          return (
            <div key={alt.id} style={{
              display: "flex", alignItems: "center", gap: 8, fontSize: 13,
              color: (correta || escolhida) ? "var(--ink)" : "var(--muted)",
              fontWeight: correta ? 600 : 400,
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1.5px solid ${cor}`, color: correta ? "#fff" : cor, background: correta ? VERDE : "transparent",
              }}>{alt.id}</span>
              <span>{alt.texto}</span>
              {correta && <span style={{ fontSize: 11, color: VERDE, fontWeight: 600 }}>correta</span>}
              {escolhida && !correta && <span style={{ fontSize: 11, color: VERMELHO, fontWeight: 600 }}>sua resposta</span>}
            </div>
          );
        })}
      </div>
      {q.explicacao && (
        <p className="vx-mut" style={{ fontSize: 12.5, margin: "8px 0 0", lineHeight: 1.55 }}>
          <b style={{ color: "var(--ink-2)" }}>Explicação:</b> {q.explicacao}
        </p>
      )}
    </div>
  );
}
