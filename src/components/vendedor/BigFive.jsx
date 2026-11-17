import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Layers, ArrowLeft, ArrowRight, CheckCircle2, Lock, Eye, EyeOff, RotateCcw, Info,
} from "lucide-react";
import { api } from "../../lib/api.js";

// Azul institucional White Editorial (mesmo dos demais fluxos).
const AZUL = "#318CE7";

// =============================================================================
// Big Five (IPIP-50) — fluxo completo: intro → questionário → resultado.
// O cálculo é sempre no servidor; aqui só coletamos respostas, salvamos
// progresso (auto-save) e exibimos o relatório que o servidor devolve.
// A dimensão avaliada NUNCA é mostrada durante as perguntas.
// =============================================================================
export default function BigFive({ onVoltar, aviso, recarregar }) {
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
      const r = await api("/big-five");
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
  const salvarTimer = useRef(null);
  const agendarSalvar = useCallback((mapa) => {
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => {
      api("/big-five/progresso", { respostas: mapa });
    }, 600);
  }, []);
  useEffect(() => () => { if (salvarTimer.current) clearTimeout(salvarTimer.current); }, []);

  const iniciar = async () => {
    setEnviando(true);
    const r = await api("/big-five/iniciar", { iniciar: true });
    setEnviando(false);
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível iniciar a avaliação."); return; }
    const resp = r.respostas || {};
    setItens(r.itens || []);
    setAlternativas(r.alternativas || alternativas);
    setRespostas(resp);
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

  const total = itens.length || estado?.total || 50;
  const respondidas = useMemo(
    () => itens.reduce((n, it) => (respostas[it.id] ? n + 1 : n), 0),
    [itens, respostas]
  );
  const todasRespondidas = itens.length > 0 && respondidas === itens.length;

  const concluir = async () => {
    if (!todasRespondidas) { aviso?.("Responda todas as afirmações antes de concluir."); return; }
    setEnviando(true);
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    const r = await api("/big-five/concluir", { respostas });
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
      <ResultadoBigFive
        resultado={resultado}
        relatorio={relatorio}
        compartilhar={estado?.tentativa?.compartilhar}
        onVoltar={onVoltar}
        onRefazer={() => { setRespostas({}); setResultado(null); setRelatorio(null); setFase("intro"); }}
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
        onVoltar={onVoltar}
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
  const total = estado?.total || 50;

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
            <Layers size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="vx-disp" style={{ fontSize: 21, margin: 0 }}>Big Five — Os Cinco Grandes Fatores</h1>
            <p className="vx-mut" style={{ fontSize: 13.5, margin: "4px 0 0", lineHeight: 1.5 }}>
              Uma leitura ampla da sua personalidade por cinco fatores reconhecidos.
            </p>
          </div>
        </div>

        <Linha rotulo="Objetivo">
          Oferecer uma leitura ampla da sua personalidade por cinco fatores: abertura à experiência,
          conscienciosidade, extroversão, amabilidade e neuroticismo.
        </Linha>
        <Linha rotulo="Como funciona">
          São {total} afirmações, uma por tela. Para cada uma, escolha o quanto você concorda — de
          "discordo totalmente" a "concordo totalmente". Não há resposta certa ou errada.
        </Linha>
        <Linha rotulo="Salvamento">
          Seu progresso é salvo automaticamente. Você pode fechar e retomar de onde parou.
        </Linha>
        <Linha rotulo="Privacidade">
          Resultado de personalidade, privado por padrão. Só fica visível para empresas se você
          autorizar. Nunca altera seu score comercial, ranking ou acesso a campanhas.
        </Linha>
        <Linha rotulo="Instrumento">
          IPIP Big-Five Factor Markers (50 itens), do International Personality Item Pool — domínio
          público. Tradução de trabalho em português; resultados apresentados como média de 1 a 5,
          sem percentis.
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
          {emAndamento ? "Continuar avaliação" : "Iniciar avaliação"} <ArrowRight size={14} />
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

      {/* Barra de progresso segmentada */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 2, alignItems: "stretch", height: 6 }}>
          {itens.map((it, i) => {
            const feito = !!respostas[it.id];
            const ativo = i === atual;
            return (
              <div key={it.id} aria-hidden="true" style={{
                flex: 1, minWidth: 0, borderRadius: 2,
                background: feito ? AZUL : "var(--surface-2)",
                outline: ativo ? `1.5px solid ${AZUL}` : "none",
                outlineOffset: ativo ? 1 : 0,
                transition: "background .2s ease",
              }} />
            );
          })}
        </div>
      </div>
      <div className="vx-mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
        <span>Afirmação {atual + 1} de {total}</span>
        <span>{respondidas} respondidas</span>
      </div>

      <div className="vx-card" style={{ padding: 24 }}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4, marginBottom: 4, width: "100%" }}>
            {item?.texto}
          </legend>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 18px" }}>
            O quanto esta afirmação combina com você?
          </p>

          <div role="radiogroup" aria-label="Escala de concordância" style={{ display: "grid", gap: 8 }}>
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
function ResultadoBigFive({ resultado, relatorio, compartilhar, onVoltar, onRefazer, aviso }) {
  const [visivel, setVisivel] = useState(!!compartilhar);
  const [salvandoVis, setSalvandoVis] = useState(false);
  const dimensoes = relatorio?.dimensoes || [];

  const alternarVisibilidade = async () => {
    const novo = !visivel;
    setSalvandoVis(true);
    const r = await api("/big-five/compartilhamento", { compartilhar: novo });
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

      <div className="vx-card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="vx-eyebrow" style={{ color: AZUL }}>Big Five — Resultado</div>
        <h1 className="vx-disp" style={{ fontSize: 22, margin: "6px 0 4px" }}>Seus cinco fatores</h1>
        <p className="vx-mut" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          Cada barra mostra a média das suas respostas (de 1 a 5) naquele fator. Não há fatores
          melhores ou piores — são tendências, não um diagnóstico.
        </p>

        {/* Cinco barras horizontais */}
        <div style={{ marginTop: 22, display: "grid", gap: 18 }}>
          {dimensoes.map((d) => <BarraDimensao key={d.chave} d={d} />)}
        </div>

        {/* Radar complementar (legível com 5 eixos) */}
        {dimensoes.length === 5 && <Radar dimensoes={dimensoes} />}
      </div>

      {/* Interpretação por dimensão */}
      <div style={{ display: "grid", gap: 12 }}>
        {dimensoes.map((d) => <CartaoDimensao key={d.chave} d={d} />)}
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

function BarraDimensao({ d }) {
  const pct = Math.max(0, Math.min(100, (Number(d.media) / 5) * 100));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{d.nome}</span>
        <span className="vx-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {Number(d.media).toFixed(2).replace(".", ",")} / 5 · {d.banda?.rotulo}
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: d.cor || AZUL, borderRadius: 999, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}

function CartaoDimensao({ d }) {
  return (
    <div className="vx-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{d.nome}</div>
        <div className="vx-mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          bruto {d.bruto}/{d.maximo} · média {Number(d.media).toFixed(2).replace(".", ",")}
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 10px" }}>{d.descricao}</p>
      <Secao rotulo="Tendências">{d.tendencias}</Secao>
      <Secao rotulo="Possíveis pontos de desenvolvimento">{d.desenvolvimento}</Secao>
      <Secao rotulo="Limitações da interpretação">{d.limitacoes}</Secao>
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

// Radar pentagonal (5 eixos) — complementar às barras. Média 1–5 normalizada.
function Radar({ dimensoes }) {
  const size = 240, cx = size / 2, cy = size / 2, raio = 86;
  const n = dimensoes.length;
  const ponto = (i, fator) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = raio * fator;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const grades = [0.25, 0.5, 0.75, 1];
  const eixos = dimensoes.map((_, i) => ponto(i, 1));
  const poligono = dimensoes.map((d, i) => ponto(i, Math.max(0.04, Number(d.media) / 5)));
  const pts = (arr) => arr.map((p) => p.join(",")).join(" ");

  return (
    <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label="Gráfico de radar das cinco dimensões" style={{ maxWidth: "100%" }}>
        {grades.map((g) => (
          <polygon key={g} points={pts(dimensoes.map((_, i) => ponto(i, g)))}
            fill="none" stroke="var(--surface-2)" strokeWidth="1" />
        ))}
        {eixos.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="var(--surface-2)" strokeWidth="1" />
        ))}
        <polygon points={pts(poligono)} fill="rgba(49,140,231,.16)" stroke={AZUL} strokeWidth="2" />
        {dimensoes.map((d, i) => {
          const [x, y] = ponto(i, 1.18);
          return (
            <text key={d.chave} x={x} y={y} fontSize="9.5" fontWeight="600"
              fill="var(--muted)" textAnchor="middle" dominantBaseline="middle">
              {d.nome.split(" ")[0]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
