import { useState, useEffect, useMemo } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { api } from "../../lib/api.js";
import { DIMENSOES } from "../../../shared/discQuiz.js";

export default function OnbQuizDisc({ aviso, aoAvancar }) {
  const [perguntas, setPerguntas] = useState(null);
  const [xpPerguntas, setXpPerguntas] = useState(null);
  const [fase, setFase] = useState("disc"); // disc | experiencia | enviando | resultado
  const [pagina, setPagina] = useState(0);
  const [respostaDisc, setRespostaDisc] = useState({});
  const [respostaXp, setRespostaXp] = useState({});
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    api("/onboarding-pro/quiz").then((r) => {
      if (r && !r.error) {
        setPerguntas(r.disc);
        setXpPerguntas(r.experiencia);
      }
    });
  }, []);

  const POR_PAGINA = 4;
  const paginas = useMemo(() => {
    if (!perguntas) return [];
    const p = [];
    for (let i = 0; i < perguntas.length; i += POR_PAGINA) {
      p.push(perguntas.slice(i, i + POR_PAGINA));
    }
    return p;
  }, [perguntas]);

  const discCompletas = perguntas ? perguntas.filter((p) => respostaDisc[p.id]?.mais).length : 0;
  const discTotal = perguntas?.length || 0;
  const discPct = discTotal ? Math.round((discCompletas / discTotal) * 100) : 0;

  const xpCompletas = xpPerguntas ? xpPerguntas.filter((p) => {
    const r = respostaXp[p.id];
    if (p.tipo === "multipla") return Array.isArray(r) && r.length > 0;
    return r !== undefined && r !== null && r !== "";
  }).length : 0;
  const xpTotal = xpPerguntas?.length || 0;

  const marcarDisc = (perguntaId, tipo, dim) => {
    setRespostaDisc((prev) => {
      const atual = prev[perguntaId] || {};
      if (tipo === "mais" && atual.menos === dim) return { ...prev, [perguntaId]: { ...atual, mais: dim, menos: undefined } };
      if (tipo === "menos" && atual.mais === dim) return { ...prev, [perguntaId]: { ...atual, menos: dim, mais: undefined } };
      return { ...prev, [perguntaId]: { ...atual, [tipo]: dim } };
    });
  };

  const marcarXp = (perguntaId, valor) => {
    setRespostaXp((prev) => ({ ...prev, [perguntaId]: valor }));
  };

  const alternarXp = (perguntaId, valor) => {
    setRespostaXp((prev) => {
      const atual = Array.isArray(prev[perguntaId]) ? prev[perguntaId] : [];
      return { ...prev, [perguntaId]: atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor] };
    });
  };

  const enviar = async () => {
    setFase("enviando");
    const r = await api("/onboarding-pro/quiz", { disc: respostaDisc, experiencia: respostaXp });
    if (r?.error) {
      aviso(r.error);
      setFase("experiencia");
      return;
    }
    setResultado(r.disc);
    setFase("resultado");
  };

  if (!perguntas) return <div className="vx-onb-estado">Carregando quiz…</div>;

  // ---------- Resultado DISC ----------
  if (fase === "resultado" && resultado) {
    const dim = DIMENSOES[resultado.predominante];
    const dim2 = DIMENSOES[resultado.secundario];
    return (
      <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="vx-onb-card" style={{ textAlign: "center", padding: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
            background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={28} color="var(--brand)" />
          </div>
          <div className="vx-onb-eyebrow">Seu perfil DISC</div>
          <div className="vx-disp" style={{ fontSize: 28, marginTop: 6, color: dim.cor }}>
            {resultado.label}
          </div>
          <p className="vx-mut" style={{ fontSize: 14, maxWidth: 400, margin: "10px auto 0", lineHeight: 1.7 }}>
            <b style={{ color: dim.cor }}>{dim.nome}</b> é sua dimensão predominante: {dim.descricao.toLowerCase()}{" "}
            Com traços de <b style={{ color: dim2.cor }}>{dim2.nome}</b>: {dim2.descricao.toLowerCase()}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 24 }}>
            {Object.entries(resultado.percentuais).map(([d, pct]) => (
              <div key={d} style={{ textAlign: "center" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", margin: "0 auto 6px",
                  border: `3px solid ${DIMENSOES[d].cor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: DIMENSOES[d].cor,
                  background: d === resultado.predominante ? `${DIMENSOES[d].cor}18` : "transparent",
                }}>
                  {pct}%
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: DIMENSOES[d].cor }}>{d}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{DIMENSOES[d].nome}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" style={{ marginTop: 18 }}
          onClick={() => aoAvancar("concluido", { disc: resultado })}>
          Ver oportunidades disponíveis <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // ---------- Enviando ----------
  if (fase === "enviando") {
    return (
      <div className="vx-fade" style={{ maxWidth: 540, margin: "0 auto", textAlign: "center", padding: 40 }}>
        <Sparkles size={36} color="var(--brand)" style={{ margin: "0 auto 16px" }} />
        <div className="vx-disp" style={{ fontSize: 20 }}>Analisando seu perfil…</div>
        <p className="vx-mut" style={{ marginTop: 8 }}>A IA está montando seu perfil comercial com base nas suas respostas.</p>
      </div>
    );
  }

  // ---------- Quiz de Experiência ----------
  if (fase === "experiencia") {
    return (
      <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div className="vx-onb-eyebrow">Passo 2 de 3 · Experiência</div>
          <h1 className="vx-disp" style={{ fontSize: 26, marginTop: 8 }}>Sua experiência em vendas</h1>
          <p className="vx-mut" style={{ fontSize: 14, marginTop: 6 }}>
            Estas informações ajudam a conectar você com as campanhas certas.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {xpPerguntas.map((p) => (
            <div key={p.id} className="vx-onb-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>{p.texto}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {p.opcoes.map((op, i) => {
                  const texto = typeof op === "string" ? op : op.texto;
                  const valor = typeof op === "string" ? op : (op.valor !== undefined ? op.valor : i);
                  const multi = p.tipo === "multipla";
                  const sel = multi
                    ? (Array.isArray(respostaXp[p.id]) && respostaXp[p.id].includes(texto))
                    : respostaXp[p.id] === valor;
                  return (
                    <button key={i} type="button"
                      onClick={() => multi ? alternarXp(p.id, texto) : marcarXp(p.id, valor)}
                      style={{
                        textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                        font: "inherit", fontSize: 13.5, transition: ".15s",
                        border: `1px solid ${sel ? "var(--brand)" : "var(--border)"}`,
                        background: sel ? "var(--brand-50)" : "var(--surface-2)",
                        color: sel ? "var(--brand)" : "var(--ink-2)",
                        fontWeight: sel ? 600 : 400,
                        display: "flex", alignItems: "center", gap: 9,
                      }}>
                      {sel && <CheckCircle2 size={14} style={{ flex: "none" }} />}
                      {texto}
                    </button>
                  );
                })}
                {p.tipo === "multipla" && <div className="vx-mut" style={{ fontSize: 11.5 }}>Pode marcar mais de uma.</div>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="vx-btn" onClick={() => { setFase("disc"); setPagina(paginas.length - 1); }}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }}
            disabled={xpCompletas < xpTotal}
            onClick={enviar}>
            {xpCompletas < xpTotal
              ? `Faltam ${xpTotal - xpCompletas} respostas`
              : <>Descobrir meu perfil <Sparkles size={14} /></>}
          </button>
        </div>
      </div>
    );
  }

  // ---------- Quiz DISC ----------
  const paginaAtual = paginas[pagina] || [];
  const ultimaPagina = pagina === paginas.length - 1;

  const paginaCompleta = paginaAtual.every((p) => respostaDisc[p.id]?.mais);

  return (
    <div className="vx-fade" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div className="vx-onb-eyebrow">Passo 2 de 3 · Personalidade</div>
        <h1 className="vx-disp" style={{ fontSize: 26, marginTop: 8 }}>Quiz de personalidade comercial</h1>
        <p className="vx-mut" style={{ fontSize: 14, marginTop: 6 }}>
          Não existe resposta certa ou errada. Escolha o que MAIS e o que MENOS combina com você.
        </p>
      </div>

      <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 10 }}>
        <span className="vx-mut">Pergunta {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, discTotal)} de {discTotal}</span>
        <b className="vx-mono">{discCompletas}/{discTotal}</b>
      </div>
      <div className="vx-meter-track" style={{ marginBottom: 18 }}>
        <div className="vx-meter-fill" style={{ width: `${discPct}%`, background: "var(--brand)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {paginaAtual.map((p) => {
          const resp = respostaDisc[p.id] || {};
          return (
            <div key={p.id} className="vx-onb-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>{p.texto}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {p.opcoes.map((op) => {
                  const eMais = resp.mais === op.dim;
                  const eMenos = resp.menos === op.dim;
                  return (
                    <div key={op.dim} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 12px", borderRadius: 10,
                      border: `1px solid ${eMais ? "var(--brand)" : eMenos ? "var(--red)" : "var(--border)"}`,
                      background: eMais ? "var(--brand-50)" : eMenos ? "var(--red-50)" : "var(--surface-2)",
                      transition: ".15s",
                    }}>
                      <div style={{ flex: 1, fontSize: 13.5, color: "var(--ink-2)" }}>{op.texto}</div>
                      <button type="button" onClick={() => marcarDisc(p.id, "mais", op.dim)}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                          cursor: "pointer", border: `1px solid ${eMais ? "var(--brand)" : "var(--border)"}`,
                          background: eMais ? "var(--brand)" : "var(--surface)",
                          color: eMais ? "#fff" : "var(--muted)", minWidth: 44, minHeight: 32,
                        }}>
                        MAIS
                      </button>
                      <button type="button" onClick={() => marcarDisc(p.id, "menos", op.dim)}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                          cursor: "pointer", border: `1px solid ${eMenos ? "var(--red)" : "var(--border)"}`,
                          background: eMenos ? "var(--red)" : "var(--surface)",
                          color: eMenos ? "#fff" : "var(--muted)", minWidth: 44, minHeight: 32,
                        }}>
                        MENOS
                      </button>
                    </div>
                  );
                })}
              </div>
              {resp.mais && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                  Mais: <b style={{ color: DIMENSOES[resp.mais]?.cor }}>{DIMENSOES[resp.mais]?.nome}</b>
                  {resp.menos && <> · Menos: <b style={{ color: DIMENSOES[resp.menos]?.cor }}>{DIMENSOES[resp.menos]?.nome}</b></>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {pagina > 0 && (
          <button className="vx-btn" onClick={() => { setPagina(pagina - 1); window.scrollTo(0, 0); }}>
            <ArrowLeft size={14} /> Voltar
          </button>
        )}
        {ultimaPagina ? (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }}
            disabled={!paginaCompleta}
            onClick={() => { setFase("experiencia"); window.scrollTo(0, 0); }}>
            {paginaCompleta ? <>Quiz de experiência <ArrowRight size={14} /></> : "Responda todas desta página"}
          </button>
        ) : (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }}
            disabled={!paginaCompleta}
            onClick={() => { setPagina(pagina + 1); window.scrollTo(0, 0); }}>
            {paginaCompleta ? "Próximas perguntas" : "Responda todas desta página"} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
