import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HeartHandshake, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, RotateCcw,
} from "lucide-react";
import { api, API_URL } from "../../lib/api.js";

// Azul institucional White Editorial (mesmo dos demais fluxos).
const AZUL = "#318CE7";

// =============================================================================
// Inteligência Emocional — fluxo completo: intro → questionário → resultado.
// O cálculo é sempre no servidor; aqui só coletamos respostas, salvamos progresso
// (auto-save) e exibimos o relatório que o servidor devolve. A competência
// avaliada NUNCA é mostrada durante o preenchimento.
// =============================================================================
export default function InteligenciaEmocional({ onVoltar, aviso, recarregar }) {
  const [carregando, setCarregando] = useState(true);
  const [estado, setEstado] = useState(null);
  const [fase, setFase] = useState("intro"); // intro | quiz | resultado
  const [itens, setItens] = useState([]);
  const [alternativas, setAlternativas] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [atual, setAtual] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [relatorio, setRelatorio] = useState(null);

  // Carrega o estado atual da avaliação ao abrir.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await api("/inteligencia-emocional");
      if (!vivo) return;
      if (!r || r.error) { aviso?.(r?.error || "Não foi possível carregar a avaliação."); onVoltar?.(); return; }
      setEstado(r);
      setAlternativas(r.alternativas || []);
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

  // ---- Auto-save (debounce) das respostas enquanto preenche ----
  // O último mapa fica sempre num ref para conseguirmos gravar NA HORA de sair
  // (clicar em "Sair", trocar de tela interna ou fechar/atualizar a aba) sem
  // depender do debounce — assim nenhuma resposta se perde ao deixar o teste.
  const salvarTimer = useRef(null);
  const respostasRef = useRef({});
  const faseRef = useRef("intro");
  useEffect(() => { faseRef.current = fase; }, [fase]);

  const agendarSalvar = useCallback((mapa) => {
    respostasRef.current = mapa;
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => {
      api("/inteligencia-emocional/progresso", { respostas: mapa });
    }, 600);
  }, []);

  // Grava imediatamente o que estiver pendente. Usa fetch com keepalive para
  // sobreviver à navegação/fechamento da aba. Só grava durante o preenchimento.
  const flushSalvar = useCallback(() => {
    if (salvarTimer.current) { clearTimeout(salvarTimer.current); salvarTimer.current = null; }
    if (faseRef.current !== "quiz") return;
    const mapa = respostasRef.current;
    if (!mapa || !Object.keys(mapa).length) return;
    try {
      fetch(`${API_URL}/api/inteligencia-emocional/progresso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas: mapa }),
        credentials: "include",
        keepalive: true,
      });
    } catch { /* silencioso: é apenas o salvamento de saída */ }
  }, []);

  // Fechar/atualizar a aba e desmontar o componente: grava o progresso antes de
  // a tela sumir, para o profissional retomar exatamente de onde parou.
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

  // Sair do quiz pelo botão: garante a gravação antes de voltar ao catálogo.
  const sairDoQuiz = useCallback(async () => {
    if (salvarTimer.current) { clearTimeout(salvarTimer.current); salvarTimer.current = null; }
    const mapa = respostasRef.current;
    if (mapa && Object.keys(mapa).length) {
      await api("/inteligencia-emocional/progresso", { respostas: mapa });
    }
    onVoltar?.();
  }, [onVoltar]);

  const iniciar = async () => {
    setEnviando(true);
    const r = await api("/inteligencia-emocional/iniciar", { iniciar: true });
    setEnviando(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível iniciar a avaliação."); return; }
    const resp = r.respostas || {};
    setItens(r.itens || []);
    setAlternativas(r.alternativas || alternativas);
    setRespostas(resp);
    respostasRef.current = resp;
    // Retoma do primeiro item sem resposta.
    const idx = (r.itens || []).findIndex((it) => !resp[it.id]);
    setAtual(idx >= 0 ? idx : 0);
    setFase("quiz");
  };

  const responder = (itemId, valor) => {
    setRespostas((prev) => {
      const mapa = { ...prev, [itemId]: valor };
      agendarSalvar(mapa);
      return mapa;
    });
  };

  const total = itens.length || estado?.total || 30;
  const respondidas = useMemo(
    () => itens.reduce((n, it) => (respostas[it.id] ? n + 1 : n), 0),
    [itens, respostas]
  );
  const todasRespondidas = itens.length > 0 && respondidas === itens.length;

  const concluir = async () => {
    if (!todasRespondidas) { aviso?.("Responda todas as afirmações antes de concluir."); return; }
    setEnviando(true);
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    const r = await api("/inteligencia-emocional/concluir", { respostas });
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
      <ResultadoIE
        resultado={resultado}
        relatorio={relatorio}
        compartilhar={estado?.tentativa?.compartilhar}
        onVoltar={onVoltar}
        onRefazer={() => { setRespostas({}); respostasRef.current = {}; setResultado(null); setRelatorio(null); setFase("intro"); }}
        aviso={aviso}
      />
    );
  }

  if (fase === "quiz") {
    return (
      <Questionario
        itens={itens}
        alternativas={alternativas}
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

  // ---- Intro ----
  return (
    <Intro
      estado={estado}
      onIniciar={iniciar}
      onVoltar={onVoltar}
      enviando={enviando}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Intro({ estado, onIniciar, onVoltar, enviando }) {
  const emAndamento = estado?.tentativa?.status === "andamento";
  const progresso = estado?.tentativa?.progresso || 0;
  const total = estado?.total || 30;

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
            <HeartHandshake size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="vx-disp" style={{ fontSize: 21, margin: 0 }}>Inteligência Emocional</h1>
            <p className="vx-mut" style={{ fontSize: 13.5, margin: "4px 0 0", lineHeight: 1.5 }}>
              Explore como você reconhece suas emoções, reage a situações desafiadoras e se relaciona com
              outras pessoas no ambiente profissional.
            </p>
          </div>
        </div>

        <Linha rotulo="O que esperar">
          São {total} afirmações distribuídas em cinco competências emocionais. Leva cerca de 7 a 10 minutos.
          Não há respostas certas ou erradas, e o resultado é individual, exibido ao concluir.
        </Linha>
        <Linha rotulo="Como responder">
          Responda considerando como você costuma agir na maioria das situações, e não apenas em momentos
          excepcionais.
        </Linha>
        <Linha rotulo="Salvamento">
          Seu progresso é salvo automaticamente. Você pode fechar e retomar de onde parou.
        </Linha>
        <Linha rotulo="Privacidade">
          Avaliação voluntária e de autoconhecimento, privada por padrão. Só fica visível para empresas se
          você autorizar. Nunca altera seu score comercial, ranking ou acesso a campanhas, e não gera
          diagnósticos nem mede inteligência emocional de forma objetiva.
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
  itens, alternativas, respostas, atual, respondidas, total,
  onResponder, onProximo, onAnterior, onConcluir, onVoltar, enviando, todasRespondidas,
}) {
  const item = itens[atual];
  const valorAtual = item ? respostas[item.id] : undefined;
  const ultimo = atual === itens.length - 1;

  const selecionar = (valor) => {
    onResponder(item.id, valor);
    // Avança sozinho, exceto no último item (lá o botão Concluir assume).
    if (!ultimo) setTimeout(onProximo, 180);
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 620, margin: "0 auto" }}>
      <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} /> Sair (progresso salvo)
      </button>

      {/* Cabeçalho (padrão do sistema: nome + contador mono) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: AZUL }}>
          <HeartHandshake size={16} /> Inteligência Emocional
        </div>
        <span className="vx-mono" style={{ fontSize: 13, color: "var(--muted)" }}>
          Afirmação {String(atual + 1).padStart(2, "0")} de {String(total).padStart(2, "0")}
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
          <legend style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, marginBottom: 4, width: "100%" }}>
            {item?.texto}
          </legend>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 18px" }}>
            Com que frequência isso acontece com você?
          </p>

          <div role="radiogroup" aria-label="Escala de frequência" style={{ display: "grid", gap: 8 }}>
            {alternativas.map((alt) => {
              const sel = valorAtual === alt.valor;
              return (
                <button
                  key={alt.valor}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => selecionar(alt.valor)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    minHeight: 48, padding: "10px 16px", textAlign: "left",
                    borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 14.5,
                    border: `1.5px solid ${sel ? AZUL : "var(--border, #e5e7eb)"}`,
                    background: sel ? "rgba(49,140,231,.08)" : "var(--surface, #fff)",
                    color: sel ? AZUL : "var(--ink)",
                    fontWeight: sel ? 600 : 400,
                    transition: "border-color .15s ease, background .15s ease",
                  }}
                >
                  <span aria-hidden="true" style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${sel ? AZUL : "var(--muted-2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {sel && <span style={{ width: 10, height: 10, borderRadius: "50%", background: AZUL }} />}
                  </span>
                  {alt.texto}
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
          Faltam {total - respondidas} afirmações para concluir.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function ResultadoIE({ resultado, relatorio, compartilhar, onVoltar, onRefazer, aviso }) {
  const [visivel, setVisivel] = useState(!!compartilhar);
  const [salvandoVis, setSalvandoVis] = useState(false);
  const competencias = relatorio?.competencias || [];
  const destaques = relatorio?.destaques || [];

  const alternarVisibilidade = async () => {
    const novo = !visivel;
    setSalvandoVis(true);
    const r = await api("/inteligencia-emocional/compartilhamento", { compartilhar: novo });
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

      {/* Cabeçalho */}
      <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ color: AZUL }}>Inteligência Emocional — Resultado</div>
        <h1 className="vx-disp" style={{ fontSize: 22, margin: "6px 0 4px" }}>Seu panorama emocional</h1>
        <p className="vx-mut" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          Veja como você descreveu seus comportamentos em diferentes situações emocionais. Não há
          competências melhores ou piores — são tendências, não um diagnóstico.
        </p>

        {/* Gráfico: cinco barras horizontais (média 1–5) */}
        <div style={{ marginTop: 20 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 2 }}>Média por competência</div>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.5 }}>
            Cada barra mostra a média das suas respostas, de 1 (nunca ou quase nunca) a 5 (quase sempre).
          </p>
          <div style={{ display: "grid", gap: 16 }}>
            {competencias.map((d) => <BarraCompetencia key={d.chave} d={d} />)}
          </div>
        </div>
      </div>

      {/* Card de destaque */}
      {destaques.length > 0 && (
        <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>
            {relatorio?.tituloDestaques || "Competências mais presentes nas suas respostas"}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {destaques.map((d) => (
              <div key={d.chave} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "rgba(49,140,231,.10)", color: d.cor || AZUL, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={15} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>
                    {d.nome}
                    <span className="vx-mono" style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>
                      média {Number(d.media).toFixed(1).replace(".", ",")}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, margin: "3px 0 0" }}>{d.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desenvolvimento: todas as competências com descrição e sugestão */}
      <div style={{ display: "grid", gap: 12 }}>
        {competencias.map((d) => <CartaoCompetencia key={d.chave} d={d} />)}
      </div>

      {/* Visibilidade */}
      <div className="vx-card" style={{ padding: 18, marginTop: 16 }}>
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

      {/* Nota global de interpretação */}
      {relatorio?.notaGlobal && (
        <div className="vx-chart-source" style={{ marginTop: 14, lineHeight: 1.6 }}>
          {relatorio.notaGlobal}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="vx-btn vx-btn-sm" onClick={onRefazer}>
          <RotateCcw size={14} /> Refazer avaliação
        </button>
      </div>
    </div>
  );
}

function BarraCompetencia({ d }) {
  const pct = Math.max(0, Math.min(100, (Number(d.media) / 5) * 100));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{d.nome}</span>
        <span className="vx-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {Number(d.media).toFixed(1).replace(".", ",")} / 5
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: d.cor || AZUL, borderRadius: 999, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}

function CartaoCompetencia({ d }) {
  return (
    <div className="vx-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{d.nome}</div>
        <div className="vx-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          soma {d.soma}/{d.maximo} · média {Number(d.media).toFixed(1).replace(".", ",")}
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 10px" }}>{d.descricao}</p>
      <Secao rotulo="Sugestão de desenvolvimento">{d.sugestao}</Secao>
    </div>
  );
}

function Secao({ rotulo, children }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 2 }}>{rotulo}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
