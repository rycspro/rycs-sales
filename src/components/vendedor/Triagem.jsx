import { useState, useEffect, useMemo } from "react";
import { GraduationCap, CheckCircle2, ArrowRight, ArrowLeft, Award, RotateCcw, TrendingUp } from "lucide-react";
import { api } from "../../lib/api.js";
import { Campo } from "../ui.jsx";

const CORES = {
  aprovado: "var(--brand)", condicional: "var(--amber)",
  reavaliacao: "var(--indigo)", reprovado: "var(--red)",
};

const TITULOS = {
  aprovado: "Você foi aprovado!",
  condicional: "Quase lá",
  reavaliacao: "Desenvolva seu perfil comercial",
  reprovado: "Sua avaliação ainda não foi aprovada",
};

const RECADOS = {
  aprovado: "Seu perfil comercial foi criado e você já pode acessar oportunidades compatíveis com suas habilidades.",
  condicional: "Você tem bom potencial, mas recomendamos concluir alguns treinamentos. Seu acesso está liberado.",
  reavaliacao: "Antes de acessar as oportunidades, complete a trilha da Academy e refaça a avaliação.",
  reprovado: "Isso não significa que você não saiba vender. Significa que precisamos desenvolver algumas competências antes de liberar sua conta.",
};

export default function Triagem({ aviso, recarregar }) {
  const [dados, setDados] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [fase, setFase] = useState("intro"); // intro | prova | resultado
  const [bloco, setBloco] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([api("/triagem/perguntas"), api("/triagem/minhas")]).then(([p, h]) => {
      if (p && !p.error) setDados(p);
      if (h && !h.error) {
        setHistorico(h);
        // Quem já tem resultado vê o resultado, não o convite para começar.
        if (h.atual) { setResultado(h.atual); setFase("resultado"); }
      }
    });
  }, []);

  // As perguntas chegam em ordem; agrupar por categoria dá os blocos da tela.
  const blocos = useMemo(() => {
    if (!dados) return [];
    const mapa = new Map();
    for (const p of dados.perguntas) {
      if (!mapa.has(p.categoria)) mapa.set(p.categoria, []);
      mapa.get(p.categoria).push(p);
    }
    return [...mapa.entries()].map(([chave, perguntas]) => ({
      chave, nome: dados.categorias[chave]?.nome || chave,
      peso: dados.categorias[chave]?.peso || 0, perguntas,
    }));
  }, [dados]);

  if (!dados) return <div className="vx-mut" style={{ padding: 20 }}>Carregando avaliação…</div>;

  const respondidas = Object.keys(respostas).filter((k) => {
    const v = respostas[k];
    return Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "";
  }).length;
  const progresso = Math.round((respondidas / dados.total) * 100);

  const marcar = (id, valor) => setRespostas((r) => ({ ...r, [id]: valor }));

  const alternar = (id, indice) => setRespostas((r) => {
    const atual = Array.isArray(r[id]) ? r[id] : [];
    return { ...r, [id]: atual.includes(indice) ? atual.filter((i) => i !== indice) : [...atual, indice] };
  });

  const blocoCompleto = (b) => b.perguntas.every((p) => {
    const v = respostas[p.id];
    return Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "";
  });

  const enviar = async () => {
    setEnviando(true);
    const r = await api("/triagem", { respostas });
    setEnviando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível enviar a avaliação.");
    setResultado(r);
    setFase("resultado");
    await recarregar?.();
  };

  // ---------- Resultado ----------
  if (fase === "resultado" && resultado) {
    const cor = CORES[resultado.status];
    const cats = resultado.categorias || {};
    const perfil = resultado.perfil || {};

    return (
      <div className="vx-fade" style={{ maxWidth: 620 }}>
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{
            width: 60, height: 60, borderRadius: 17, margin: "0 auto 16px",
            background: "var(--surface-2)", border: `1px solid ${cor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {resultado.status === "aprovado"
              ? <Award size={28} color={cor} strokeWidth={2.1} />
              : <TrendingUp size={28} color={cor} strokeWidth={2.1} />}
          </div>

          <div className="vx-disp" style={{ fontSize: 22 }}>{TITULOS[resultado.status]}</div>
          <div className="vx-disp vx-mono" style={{ fontSize: 46, color: cor, margin: "10px 0 4px" }}>
            {resultado.score}%
          </div>
          <p className="vx-mut" style={{ fontSize: 13.5, maxWidth: 420, margin: "8px auto 0" }}>
            {RECADOS[resultado.status]}
          </p>

          {perfil.predominante && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div className="vx-eyebrow">Perfil predominante</div>
              <div className="vx-disp" style={{ fontSize: 20, color: "var(--brand)", marginTop: 3 }}>
                {perfil.predominante}
              </div>
            </div>
          )}
        </div>

        {Object.keys(cats).length > 0 && (
          <>
            <h3 className="vx-disp" style={{ fontSize: 16, margin: "22px 0 10px" }}>Seu perfil comercial</h3>
            <div className="vx-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {blocos.map((b) => {
                const v = cats[b.chave] ?? 0;
                return (
                  <div key={b.chave}>
                    <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 5 }}>
                      <span className="vx-mut">{b.nome} <span style={{ opacity: .6 }}>· peso {b.peso}%</span></span>
                      <b className="vx-mono" style={{ color: v >= 80 ? "var(--brand)" : v >= 60 ? "var(--amber)" : "var(--red)" }}>
                        {v}%
                      </b>
                    </div>
                    <div className="vx-meter-track">
                      <div className="vx-meter-fill" style={{
                        width: `${v}%`,
                        background: v >= 80 ? "var(--brand)" : v >= 60 ? "var(--amber)" : "var(--red)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {historico?.tentativas?.length > 1 && (
          <>
            <h3 className="vx-disp" style={{ fontSize: 16, margin: "22px 0 10px" }}>Histórico</h3>
            <div className="vx-grid">
              {historico.tentativas.map((t) => (
                <div key={t.id} className="vx-card vx-row" style={{ padding: 13, fontSize: 13 }}>
                  <span className="vx-mut">Tentativa {t.tentativa}</span>
                  <span className="vx-badge" style={{ background: "var(--surface-2)", color: CORES[t.status] }}>
                    {t.score}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {resultado.status !== "aprovado" && (
          <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 18 }}
            onClick={() => { setRespostas({}); setBloco(0); setFase("prova"); }}>
            <RotateCcw size={14} /> Refazer a avaliação
          </button>
        )}
      </div>
    );
  }

  // ---------- Intro ----------
  if (fase === "intro") {
    return (
      <div className="vx-fade" style={{ maxWidth: 560 }}>
        <div className="vx-card" style={{ padding: 26 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, marginBottom: 16,
            background: "var(--brand-50)", border: "1px solid var(--brand-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GraduationCap size={23} color="var(--brand)" strokeWidth={2.1} />
          </div>

          <div className="vx-eyebrow">RYCS Academy</div>
          <div className="vx-disp" style={{ fontSize: 22, marginTop: 3 }}>Avaliação inicial</div>
          <p className="vx-mut" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
            Antes de começar a vender, queremos conhecer seu perfil comercial.
            São {dados.total} perguntas em {blocos.length} blocos, e leva cerca de 10 minutos.
          </p>

          <hr className="vx-sep" />
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>O que será avaliado</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {blocos.map((b) => (
              <span key={b.chave} className="vx-chip" style={{ fontSize: 11.5 }}>
                {b.nome} · {b.peso}%
              </span>
            ))}
          </div>

          <div style={{
            marginTop: 18, padding: "12px 14px", borderRadius: 10, fontSize: 12.5,
            background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink-2)",
          }}>
            Acima de <b>90%</b> a aprovação é imediata. Entre 80% e 90%, o acesso é liberado
            com trilha recomendada. Abaixo disso, você completa a Academy e refaz a avaliação
            quantas vezes precisar.
          </div>

          <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 18 }}
            onClick={() => setFase("prova")}>
            Começar avaliação <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ---------- Prova ----------
  const b = blocos[bloco];
  const ultimo = bloco === blocos.length - 1;

  return (
    <div className="vx-fade" style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 16 }}>
        <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 6 }}>
          <span className="vx-mut">Bloco {bloco + 1} de {blocos.length} · {b.nome}</span>
          <b className="vx-mono">{respondidas}/{dados.total}</b>
        </div>
        <div className="vx-meter-track">
          <div className="vx-meter-fill" style={{ width: `${progresso}%`, background: "var(--brand)" }} />
        </div>
      </div>

      <div className="vx-grid">
        {b.perguntas.map((p, i) => (
          <div key={p.id} className="vx-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>
              <span className="vx-mono vx-mut" style={{ fontSize: 12, marginRight: 8 }}>{i + 1}.</span>
              {p.texto}
            </div>

            {p.tipo === "aberta" ? (
              <>
                <textarea className="vx-input" rows={4} value={respostas[p.id] || ""}
                  onChange={(e) => marcar(p.id, e.target.value)}
                  placeholder="Responda com suas palavras, explicando seu raciocínio…"
                  style={{ resize: "vertical", fontFamily: "inherit" }} />
                <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 5 }}>
                  Quanto mais específico, melhor a avaliação.
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {p.opcoes.map((op, oi) => {
                  const multi = p.tipo === "multipla";
                  const sel = multi
                    ? (respostas[p.id] || []).includes(oi)
                    : respostas[p.id] === oi;
                  return (
                    <button key={oi} type="button"
                      onClick={() => (multi ? alternar(p.id, oi) : marcar(p.id, oi))}
                      style={{
                        textAlign: "left", padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                        font: "inherit", fontSize: 13.5, transition: ".15s",
                        border: `1px solid ${sel ? "var(--brand)" : "var(--border)"}`,
                        background: sel ? "var(--brand-50)" : "var(--surface-2)",
                        color: sel ? "var(--brand)" : "var(--ink-2)",
                        fontWeight: sel ? 600 : 400,
                        display: "flex", alignItems: "center", gap: 9,
                      }}>
                      {sel && <CheckCircle2 size={14} style={{ flex: "none" }} />}
                      {op}
                    </button>
                  );
                })}
                {p.tipo === "multipla" && (
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>Pode marcar mais de uma.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        {bloco > 0 && (
          <button className="vx-btn" onClick={() => { setBloco(bloco - 1); window.scrollTo(0, 0); }}>
            <ArrowLeft size={14} /> Voltar
          </button>
        )}
        {ultimo ? (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }}
            disabled={enviando || respondidas < dados.total}
            onClick={enviar}>
            {enviando ? "Calculando…" : respondidas < dados.total
              ? `Faltam ${dados.total - respondidas} respostas`
              : "Ver meu resultado"}
          </button>
        ) : (
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }}
            disabled={!blocoCompleto(b)}
            onClick={() => { setBloco(bloco + 1); window.scrollTo(0, 0); }}>
            {blocoCompleto(b) ? "Próximo bloco" : "Responda todas deste bloco"} <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
