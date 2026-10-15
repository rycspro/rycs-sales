import { useState, useEffect, useMemo } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Brain, Briefcase } from "lucide-react";
import { api } from "../../lib/api.js";
import { DIMENSOES } from "../../../shared/discQuiz.js";

export default function OnbQuizDisc({ aviso, aoAvancar }) {
  const [perguntas, setPerguntas] = useState(null);
  const [xpPerguntas, setXpPerguntas] = useState(null);
  const [idx, setIdx] = useState(0);
  const [respostaDisc, setRespostaDisc] = useState({});
  const [respostaXp, setRespostaXp] = useState({});
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [animDir, setAnimDir] = useState("next");

  useEffect(() => {
    api("/onboarding-pro/quiz").then((r) => {
      if (r && !r.error) {
        setPerguntas(r.disc);
        setXpPerguntas(r.experiencia);
      }
    });
  }, []);

  const todas = useMemo(() => {
    if (!perguntas || !xpPerguntas) return [];
    return [
      ...perguntas.map((p) => ({ ...p, secao: "disc" })),
      ...xpPerguntas.map((p) => ({ ...p, secao: "xp" })),
    ];
  }, [perguntas, xpPerguntas]);

  const total = todas.length;
  const atual = todas[idx];
  const nDisc = perguntas?.length || 0;

  const respondida = (i) => {
    const q = todas[i];
    if (!q) return false;
    if (q.secao === "disc") return !!respostaDisc[q.id]?.mais;
    const r = respostaXp[q.id];
    if (q.tipo === "multipla") return Array.isArray(r) && r.length > 0;
    return r !== undefined && r !== null && r !== "";
  };

  const totalRespondidas = todas.filter((_, i) => respondida(i)).length;
  const pct = total ? Math.round((totalRespondidas / total) * 100) : 0;
  const secaoAtual = atual?.secao === "disc" ? "Personalidade" : "Experiência";
  const numNaSecao = atual?.secao === "disc" ? idx + 1 : idx - nDisc + 1;
  const totalSecao = atual?.secao === "disc" ? nDisc : (xpPerguntas?.length || 0);

  const ir = (dir) => {
    setAnimDir(dir > 0 ? "next" : "prev");
    setIdx((i) => Math.max(0, Math.min(total - 1, i + dir)));
    window.scrollTo?.(0, 0);
  };

  const marcarDisc = (tipo, dim) => {
    setRespostaDisc((prev) => {
      const at = prev[atual.id] || {};
      if (tipo === "mais" && at.menos === dim) return { ...prev, [atual.id]: { ...at, mais: dim, menos: undefined } };
      if (tipo === "menos" && at.mais === dim) return { ...prev, [atual.id]: { ...at, menos: dim, mais: undefined } };
      return { ...prev, [atual.id]: { ...at, [tipo]: dim } };
    });
  };

  const marcarXp = (valor) => {
    setRespostaXp((prev) => ({ ...prev, [atual.id]: valor }));
  };

  const alternarXp = (valor) => {
    setRespostaXp((prev) => {
      const a = Array.isArray(prev[atual.id]) ? prev[atual.id] : [];
      return { ...prev, [atual.id]: a.includes(valor) ? a.filter((v) => v !== valor) : [...a, valor] };
    });
  };

  const autoAvancar = () => {
    if (idx < total - 1) setTimeout(() => ir(1), 350);
  };

  const enviar = async () => {
    setEnviando(true);
    const r = await api("/onboarding-pro/quiz", { disc: respostaDisc, experiencia: respostaXp });
    if (r?.error) { aviso(r.error); setEnviando(false); return; }
    setResultado(r.disc);
  };

  if (!perguntas) return <div className="vx-onb-estado">Carregando quiz…</div>;

  // ---------- Resultado ----------
  if (resultado) {
    const dim = DIMENSOES[resultado.predominante];
    const dim2 = DIMENSOES[resultado.secundario];
    return (
      <div className="vx-fade" style={{ maxWidth: 540, margin: "0 auto" }}>
        <div className="vx-onb-card" style={{ textAlign: "center", padding: 36 }}>
          <div style={{
            width: 68, height: 68, borderRadius: "50%", margin: "0 auto 18px",
            background: `linear-gradient(135deg, ${dim.cor}22, ${dim2.cor}22)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={30} color={dim.cor} />
          </div>
          <div className="vx-onb-eyebrow">Seu perfil DISC</div>
          <div className="vx-disp" style={{ fontSize: 32, marginTop: 8, color: dim.cor }}>
            {resultado.label}
          </div>
          <p className="vx-mut" style={{ fontSize: 14, maxWidth: 380, margin: "12px auto 0", lineHeight: 1.7 }}>
            <b style={{ color: dim.cor }}>{dim.nome}</b> é sua dimensão principal: {dim.descricao.toLowerCase()}{" "}
            Com traços de <b style={{ color: dim2.cor }}>{dim2.nome}</b>: {dim2.descricao.toLowerCase()}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 28 }}>
            {Object.entries(resultado.percentuais).map(([d, p]) => (
              <div key={d} style={{ textAlign: "center" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", margin: "0 auto 6px",
                  border: `3px solid ${DIMENSOES[d].cor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 700, color: DIMENSOES[d].cor,
                  background: d === resultado.predominante ? `${DIMENSOES[d].cor}18` : "transparent",
                }}>{p}%</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: DIMENSOES[d].cor }}>{d}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{DIMENSOES[d].nome}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" style={{ marginTop: 20 }}
          onClick={() => aoAvancar("concluido", { disc: resultado })}>
          Ver oportunidades disponíveis <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // ---------- Enviando ----------
  if (enviando) {
    return (
      <div className="vx-fade" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: 48 }}>
        <Sparkles size={38} color="var(--brand)" style={{ margin: "0 auto 18px", animation: "spin 2s linear infinite" }} />
        <div className="vx-disp" style={{ fontSize: 22 }}>Analisando seu perfil…</div>
        <p className="vx-mut" style={{ marginTop: 10 }}>Montando seu perfil comercial com base nas suas respostas.</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ---------- Quiz (uma pergunta por vez) ----------
  const resp = atual.secao === "disc" ? (respostaDisc[atual.id] || {}) : null;
  const podeAvancar = respondida(idx);
  const ultimaPergunta = idx === total - 1;

  return (
    <div className="vx-fade" style={{ maxWidth: 580, margin: "0 auto" }}>
      {/* Cabeçalho com progresso */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {atual.secao === "disc"
              ? <Brain size={16} style={{ color: "var(--brand)" }} />
              : <Briefcase size={16} style={{ color: "var(--brand)" }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              {secaoAtual} · {numNaSecao} de {totalSecao}
            </span>
          </div>
          <span className="vx-mono" style={{ fontSize: 13, color: "var(--muted)" }}>{totalRespondidas}/{total}</span>
        </div>

        {/* Barra de progresso com indicadores */}
        <div style={{ display: "flex", gap: 3, height: 6, borderRadius: 3, overflow: "hidden" }}>
          {todas.map((_, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 3, transition: "background .3s",
              background: respondida(i) ? "var(--brand)"
                : i === idx ? "var(--brand-50, rgba(59,130,246,.3))"
                : "var(--surface-3, #e5e7eb)",
            }} />
          ))}
        </div>
      </div>

      {/* Pergunta */}
      <div key={atual.id} className="vx-quiz-pergunta" style={{
        animation: `quizSlide${animDir === "next" ? "In" : "Back"} .25s ease`,
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5, marginBottom: 24, color: "var(--ink)" }}>
          {atual.texto}
        </h2>

        {atual.secao === "disc" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {atual.opcoes.map((op) => {
              const eMais = resp.mais === op.dim;
              const eMenos = resp.menos === op.dim;
              const sel = eMais || eMenos;
              return (
                <div key={op.dim} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 16px", borderRadius: 14,
                  border: `2px solid ${eMais ? "var(--brand)" : eMenos ? "var(--red, #ef4444)" : "var(--border)"}`,
                  background: eMais ? "var(--brand-50, rgba(59,130,246,.08))" : eMenos ? "var(--red-50, rgba(239,68,68,.06))" : "var(--surface-2, #f8f9fa)",
                  transition: "all .2s ease",
                }}>
                  <div style={{ flex: 1, fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-2)" }}>{op.texto}</div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => { marcarDisc("mais", op.dim); if (!resp.menos || (resp.menos && resp.mais)) autoAvancar(); }}
                      style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                        cursor: "pointer", border: "none", minWidth: 48, minHeight: 36,
                        transition: "all .15s",
                        background: eMais ? "var(--brand)" : "var(--surface)",
                        color: eMais ? "#fff" : "var(--muted)",
                        boxShadow: eMais ? "0 2px 8px rgba(59,130,246,.25)" : "0 1px 3px rgba(0,0,0,.06)",
                      }}>
                      MAIS
                    </button>
                    <button type="button" onClick={() => { marcarDisc("menos", op.dim); if (!resp.mais || (resp.mais && resp.menos)) autoAvancar(); }}
                      style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                        cursor: "pointer", border: "none", minWidth: 48, minHeight: 36,
                        transition: "all .15s",
                        background: eMenos ? "var(--red, #ef4444)" : "var(--surface)",
                        color: eMenos ? "#fff" : "var(--muted)",
                        boxShadow: eMenos ? "0 2px 8px rgba(239,68,68,.25)" : "0 1px 3px rgba(0,0,0,.06)",
                      }}>
                      MENOS
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="vx-mut" style={{ fontSize: 12, marginTop: 4, textAlign: "center" }}>
              Escolha a que <b>mais</b> e a que <b>menos</b> combina com você
            </div>
          </div>
        ) : (
          /* Experiência */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {atual.opcoes.map((op, i) => {
              const texto = typeof op === "string" ? op : op.texto;
              const valor = typeof op === "string" ? op : (op.valor !== undefined ? op.valor : i);
              const multi = atual.tipo === "multipla";
              const sel = multi
                ? (Array.isArray(respostaXp[atual.id]) && respostaXp[atual.id].includes(texto))
                : respostaXp[atual.id] === valor;
              return (
                <button key={i} type="button"
                  onClick={() => {
                    if (multi) { alternarXp(texto); }
                    else { marcarXp(valor); autoAvancar(); }
                  }}
                  style={{
                    textAlign: "left", padding: "14px 18px", borderRadius: 14, cursor: "pointer",
                    font: "inherit", fontSize: 14.5, lineHeight: 1.5, transition: "all .2s ease",
                    border: `2px solid ${sel ? "var(--brand)" : "var(--border)"}`,
                    background: sel ? "var(--brand-50, rgba(59,130,246,.08))" : "var(--surface-2, #f8f9fa)",
                    color: sel ? "var(--brand)" : "var(--ink-2)",
                    fontWeight: sel ? 600 : 400,
                    display: "flex", alignItems: "center", gap: 10,
                    boxShadow: sel ? "0 2px 8px rgba(59,130,246,.12)" : "none",
                  }}>
                  {sel && <CheckCircle2 size={18} style={{ flexShrink: 0 }} />}
                  {texto}
                </button>
              );
            })}
            {atual.tipo === "multipla" && (
              <div className="vx-mut" style={{ fontSize: 12, textAlign: "center", marginTop: 4 }}>
                Pode marcar mais de uma opção
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegação */}
      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        {idx > 0 && (
          <button className="vx-btn" onClick={() => ir(-1)} style={{ minHeight: 44, gap: 6 }}>
            <ArrowLeft size={15} /> Anterior
          </button>
        )}
        {ultimaPergunta ? (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1, minHeight: 48 }}
            disabled={totalRespondidas < total}
            onClick={enviar}>
            {totalRespondidas < total
              ? `Faltam ${total - totalRespondidas} respostas`
              : <>Descobrir meu perfil <Sparkles size={15} /></>}
          </button>
        ) : (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1, minHeight: 44 }}
            disabled={!podeAvancar}
            onClick={() => ir(1)}>
            Próxima <ArrowRight size={15} />
          </button>
        )}
      </div>

      <style>{`
        @keyframes quizSlideIn {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes quizSlideBack {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
