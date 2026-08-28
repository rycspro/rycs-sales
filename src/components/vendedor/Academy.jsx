import { useState, useEffect, useCallback } from "react";
import { GraduationCap, CheckCircle2, Circle, Award, RotateCcw, ChevronRight } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";

const CORES_NIVEL = { certified: "var(--brand)", pro: "var(--indigo)", elite: "var(--amber)" };
const NOME_NIVEL = { certified: "Certified", pro: "Pro", elite: "Elite" };

export default function Academy({ eu, aviso }) {
  const [trilha, setTrilha] = useState(null);
  const [progresso, setProgresso] = useState({ progresso: [], certificacoes: [], tentativas: [] });
  const [abertoIdx, setAbertoIdx] = useState(null);
  const [modo, setModo] = useState("trilha"); // trilha | prova | resultado
  const [respostas, setRespostas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const funcao = eu.perfil || "sem-exp";

  const carregar = useCallback(async () => {
    const [t, p] = await Promise.all([
      api(`/academy/trilhas/${funcao}`),
      api("/academy/meu-progresso"),
    ]);
    if (t && !t.error) setTrilha(t);
    if (p && !p.error) setProgresso(p);
  }, [funcao]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!trilha) return <div className="vx-mut" style={{ padding: 20 }}>Carregando trilha…</div>;

  const vistos = new Set(progresso.progresso.find((p) => p.funcao === funcao)?.modulosVistos || []);
  const certificacao = progresso.certificacoes.find((c) => c.funcao === funcao);
  const completos = trilha.modulos.filter((_, i) => vistos.has(i)).length;
  const pct = Math.round((completos / trilha.modulos.length) * 100);
  const prontoParaProva = completos === trilha.modulos.length;

  const marcarLido = async (i) => {
    if (vistos.has(i)) return;
    const r = await apiPatch("/academy/progresso", { funcao, moduloIndex: i });
    if (r?.error) return aviso(r.error);
    await carregar();
  };

  const enviarProva = async () => {
    const lista = trilha.prova.map((_, i) => respostas[i]);
    if (lista.some((v) => v === undefined)) return aviso("Responda todas as questões.");
    setEnviando(true);
    const r = await api(`/academy/prova/${funcao}`, { respostas: lista });
    setEnviando(false);
    if (!r || r.error) return aviso(r?.error || "Erro ao enviar a prova.");
    setResultado(r);
    setModo("resultado");
    await carregar();
  };

  const recomecar = () => { setRespostas({}); setResultado(null); setModo("prova"); };

  // ---- Resultado ----
  if (modo === "resultado" && resultado) {
    const aprovado = resultado.aprovado;
    return (
      <div className="vx-fade" style={{ maxWidth: 620 }}>
        <div className="vx-card" style={{ padding: 26, textAlign: "center" }}>
          <div style={{
            width: 58, height: 58, borderRadius: 16, margin: "0 auto 14px",
            background: aprovado ? "var(--brand-50)" : "var(--amber-50)",
            border: `1px solid ${aprovado ? "var(--brand-100)" : "var(--amber-100)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {aprovado
              ? <Award size={27} color="var(--brand)" strokeWidth={2.1} />
              : <RotateCcw size={27} color="var(--amber)" strokeWidth={2.1} />}
          </div>
          <div className="vx-disp" style={{ fontSize: 21 }}>
            {aprovado ? "Certificação conquistada!" : "Quase lá"}
          </div>
          <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 6 }}>
            Você acertou <b className="vx-mono" style={{ color: "var(--ink)" }}>{resultado.acertos} de {resultado.total}</b>
            {" "}({resultado.percentual}%). {aprovado
              ? `Selo ${NOME_NIVEL[resultado.nivel] || "Certified"} liberado no seu perfil.`
              : `São necessários ${trilha.notaAprovacao}% para certificar. Pode tentar de novo.`}
          </p>

          <div className="vx-meter-track" style={{ margin: "16px 0 6px" }}>
            <div className="vx-meter-fill" style={{
              width: `${resultado.percentual}%`,
              background: aprovado ? "var(--brand)" : "var(--amber)",
            }} />
          </div>
        </div>

        <h3 className="vx-disp" style={{ fontSize: 16, margin: "22px 0 10px" }}>Revisão</h3>
        <div className="vx-grid">
          {trilha.prova.map((q, i) => {
            const c = resultado.correcao[i];
            return (
              <div key={i} className="vx-card" style={{ padding: 15 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  {c.acertou
                    ? <CheckCircle2 size={16} color="var(--brand)" style={{ flex: "none", marginTop: 3 }} />
                    : <Circle size={16} color="var(--red)" style={{ flex: "none", marginTop: 3 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{q.pergunta}</div>
                    <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 5 }}>
                      Resposta correta: <b style={{ color: "var(--brand)" }}>{q.alternativas[c.correta]}</b>
                    </div>
                    {!c.acertou && respostas[i] !== undefined && (
                      <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
                        Você marcou: {q.alternativas[respostas[i]]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="vx-btn" style={{ flex: 1 }} onClick={() => setModo("trilha")}>Voltar à trilha</button>
          {!aprovado && <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} onClick={recomecar}>Tentar novamente</button>}
        </div>
      </div>
    );
  }

  // ---- Prova ----
  if (modo === "prova") {
    const respondidas = Object.keys(respostas).length;
    return (
      <div className="vx-fade" style={{ maxWidth: 620 }}>
        <div className="vx-row" style={{ marginBottom: 14 }}>
          <div>
            <div className="vx-disp" style={{ fontSize: 19 }}>Prova — {trilha.titulo}</div>
            <div className="vx-mut" style={{ fontSize: 12.5 }}>
              {respondidas} de {trilha.prova.length} respondidas · aprovação em {trilha.notaAprovacao}%
            </div>
          </div>
          <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={() => setModo("trilha")}>Sair</button>
        </div>

        <div className="vx-grid">
          {trilha.prova.map((q, i) => (
            <div key={i} className="vx-card" style={{ padding: 17 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 11 }}>
                <span className="vx-mono vx-mut" style={{ fontSize: 12, marginRight: 7 }}>{i + 1}.</span>
                {q.pergunta}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {q.alternativas.map((alt, ai) => {
                  const escolhida = respostas[i] === ai;
                  return (
                    <button key={ai} type="button"
                      onClick={() => setRespostas((r) => ({ ...r, [i]: ai }))}
                      style={{
                        textAlign: "left", padding: "10px 13px", borderRadius: 10, cursor: "pointer",
                        font: "inherit", fontSize: 13.5, transition: ".15s",
                        border: `1px solid ${escolhida ? "var(--brand)" : "var(--border)"}`,
                        background: escolhida ? "var(--brand-50)" : "var(--surface-2)",
                        color: escolhida ? "var(--brand)" : "var(--ink-2)",
                        fontWeight: escolhida ? 600 : 400,
                      }}>
                      {alt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}
          disabled={enviando || respondidas < trilha.prova.length} onClick={enviarProva}>
          {enviando ? "Corrigindo…" : respondidas < trilha.prova.length
            ? `Faltam ${trilha.prova.length - respondidas} respostas`
            : "Enviar prova"}
        </button>
      </div>
    );
  }

  // ---- Trilha ----
  return (
    <div className="vx-fade" style={{ maxWidth: 620 }}>
      <div className="vx-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flex: "none",
            background: "var(--brand-50)", border: "1px solid var(--brand-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GraduationCap size={21} color="var(--brand)" strokeWidth={2.1} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="vx-eyebrow">RYCS Academy</div>
            <div className="vx-disp" style={{ fontSize: 19, marginTop: 2 }}>{trilha.titulo}</div>
            <p className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>{trilha.resumo}</p>
          </div>
          {certificacao && (
            <span className="vx-badge" style={{
              background: "var(--brand-50)", color: CORES_NIVEL[certificacao.nivel] || "var(--brand)", flex: "none",
            }}>
              <Award size={12} /> {NOME_NIVEL[certificacao.nivel] || "Certified"}
            </span>
          )}
        </div>

        <hr className="vx-sep" />
        <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 7 }}>
          <span className="vx-mut">Progresso nos módulos</span>
          <b className="vx-mono">{completos}/{trilha.modulos.length}</b>
        </div>
        <div className="vx-meter-track">
          <div className="vx-meter-fill" style={{ width: `${pct}%`, background: "var(--brand)" }} />
        </div>
      </div>

      <div className="vx-grid" style={{ marginBottom: 16 }}>
        {trilha.modulos.map((m, i) => {
          const lido = vistos.has(i);
          const aberto = abertoIdx === i;
          return (
            <div key={i} className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setAbertoIdx(aberto ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "14px 16px",
                  background: "none", border: 0, font: "inherit", cursor: "pointer", textAlign: "left", color: "var(--ink)",
                }}>
                {lido
                  ? <CheckCircle2 size={18} color="var(--brand)" style={{ flex: "none" }} />
                  : <Circle size={18} color="var(--muted-2)" style={{ flex: "none" }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.titulo}</div>
                  <div className="vx-mut" style={{ fontSize: 12 }}>{m.min} min de leitura</div>
                </div>
                <ChevronRight size={16} color="var(--muted-2)"
                  style={{ flex: "none", transform: aberto ? "rotate(90deg)" : "none", transition: ".18s" }} />
              </button>

              {aberto && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ink-2)", margin: "13px 0 14px" }}>
                    {m.conteudo}
                  </p>
                  {!lido && (
                    <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => marcarLido(i)}>
                      Marcar como lido
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 16 }}>
          {certificacao ? "Refazer a prova" : "Prova de certificação"}
        </div>
        <p className="vx-mut" style={{ fontSize: 13, marginTop: 5 }}>
          {trilha.totalQuestoes} questões · aprovação a partir de {trilha.notaAprovacao}%.
          {certificacao && " Sua melhor nota é mantida — refazer não rebaixa o selo."}
        </p>
        {!prontoParaProva && (
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 8 }}>
            Leia os {trilha.modulos.length} módulos para liberar a prova.
          </p>
        )}
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 12 }}
          disabled={!prontoParaProva} onClick={() => { setRespostas({}); setModo("prova"); }}>
          {prontoParaProva ? "Começar prova" : `Faltam ${trilha.modulos.length - completos} módulos`}
        </button>
      </div>

      {progresso.tentativas.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 15, margin: "22px 0 9px" }}>Tentativas anteriores</h3>
          <div className="vx-grid">
            {progresso.tentativas.slice(0, 5).map((t) => (
              <div key={t.id} className="vx-card vx-row" style={{ padding: 13, fontSize: 13 }}>
                <span className="vx-mut">{t.acertos}/{t.total} acertos</span>
                <span className="vx-badge" style={{
                  background: t.aprovado ? "var(--brand-100)" : "var(--amber-100)",
                  color: t.aprovado ? "var(--brand)" : "var(--amber)",
                }}>{t.percentual}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
