import { useState } from "react";
import { CheckCircle, XCircle, Award, RefreshCw, ChevronRight, BookOpen } from "lucide-react";
import { api } from "../../lib/api.js";

const LETRAS = ["A", "B", "C", "D"];

function ProgressoQuiz({ atual, total }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "var(--ink-2)" }}>
        <span>Pergunta {atual} de {total}</span>
        <span>{Math.round(((atual - 1) / total) * 100)}% concluído</span>
      </div>
      <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${((atual - 1) / total) * 100}%`, background: "var(--brand)", borderRadius: 99, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export default function CertificacaoCampanha({ campanha, eu, onAprovado }) {
  const questoes = campanha.quiz || [];
  const notaMinima = campanha.notaMinimaQuiz || 70;
  const jaAprovado = campanha.quizAprovado;

  const [fase, setFase] = useState(jaAprovado ? "aprovado" : questoes.length ? "inicio" : "semquiz");
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [feedbackVisivel, setFeedbackVisivel] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const q = questoes[idx];

  async function submeter(rsFinal) {
    setEnviando(true);
    try {
      const r = await api(`/campaigns/${campanha.id}/quiz`, { method: "POST", body: JSON.stringify({ respostas: rsFinal }) });
      setResultado(r);
      setFase(r.aprovado ? "aprovado" : "reprovado");
      if (r.aprovado && onAprovado) onAprovado();
    } catch (e) {
      console.error(e);
    } finally {
      setEnviando(false);
    }
  }

  function confirmarResposta() {
    setFeedbackVisivel(true);
  }

  function avancar() {
    const novas = [...respostas];
    novas[idx] = selecionada;
    setRespostas(novas);
    setSelecionada(null);
    setFeedbackVisivel(false);
    if (idx + 1 < questoes.length) {
      setIdx(idx + 1);
    } else {
      submeter(novas);
    }
  }

  function reiniciar() {
    setIdx(0);
    setRespostas([]);
    setSelecionada(null);
    setFeedbackVisivel(false);
    setResultado(null);
    setFase("inicio");
  }

  if (fase === "semquiz") {
    return (
      <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
        <BookOpen size={28} color="var(--muted)" />
        <p className="vx-mut" style={{ marginTop: 10 }}>Esta campanha não possui quiz de certificação. Leia o treinamento e você estará habilitado para operar.</p>
      </div>
    );
  }

  if (fase === "inicio") {
    return (
      <div className="vx-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Award size={22} color="var(--brand)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Certificação da campanha</div>
            <div className="vx-mut" style={{ fontSize: 12 }}>{questoes.length} perguntas · Nota mínima: {notaMinima}%</div>
          </div>
        </div>
        <p style={{ fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
          Responda as perguntas sobre a operação, produto, público e abordagem desta campanha. Você precisa atingir {notaMinima}% de acertos para ser habilitado.
        </p>
        <button className="vx-btn" onClick={() => setFase("quiz")}>Iniciar certificação</button>
      </div>
    );
  }

  if (fase === "aprovado") {
    return (
      <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
        <CheckCircle size={36} color="#16a34a" />
        <div style={{ fontWeight: 700, fontSize: 18, marginTop: 12, color: "#16a34a" }}>Certificado para operar</div>
        {resultado && (
          <div className="vx-mut" style={{ fontSize: 13, marginTop: 6 }}>
            Você acertou {resultado.acertos} de {resultado.total} perguntas — {resultado.score}%
          </div>
        )}
        {!resultado && campanha.quizScore != null && (
          <div className="vx-mut" style={{ fontSize: 13, marginTop: 6 }}>Pontuação anterior: {campanha.quizScore}%</div>
        )}
        <div style={{ marginTop: 16, padding: "10px 16px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", fontSize: 12.5, color: "#15803d" }}>
          Você está habilitado para executar tarefas nesta campanha.
        </div>
      </div>
    );
  }

  if (fase === "reprovado") {
    return (
      <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
        <XCircle size={36} color="#dc2626" />
        <div style={{ fontWeight: 700, fontSize: 18, marginTop: 12, color: "#dc2626" }}>Não aprovado</div>
        {resultado && (
          <div className="vx-mut" style={{ fontSize: 13, marginTop: 6 }}>
            Você acertou {resultado.acertos} de {resultado.total} perguntas — {resultado.score}% (mínimo: {resultado.notaMinima}%)
          </div>
        )}
        {resultado?.temasRevisar?.length > 0 && (
          <div style={{ textAlign: "left", marginTop: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 8 }}>Revise estes temas:</div>
            {resultado.temasRevisar.map((t, i) => (
              <div key={i} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, marginBottom: 5 }}>• {t}</div>
            ))}
          </div>
        )}
        <button className="vx-btn" style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6 }} onClick={reiniciar}>
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  // fase === "quiz"
  return (
    <div className="vx-card" style={{ padding: 20 }}>
      <ProgressoQuiz atual={idx + 1} total={questoes.length} />

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>{q.pergunta}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {(q.opcoes || []).map((op, i) => {
          let bg = "var(--surface-2)";
          let border = "1px solid var(--border)";
          if (selecionada === i) { bg = "var(--brand)"; border = "1px solid var(--brand)"; }
          return (
            <button
              key={i}
              disabled={feedbackVisivel}
              onClick={() => !feedbackVisivel && setSelecionada(i)}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, background: bg, border, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, minWidth: 18, color: selecionada === i ? "#fff" : "var(--ink-2)" }}>{LETRAS[i]}</span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: selecionada === i ? "#fff" : "var(--ink)" }}>{op}</span>
            </button>
          );
        })}
      </div>

      {!feedbackVisivel ? (
        <button
          className="vx-btn"
          disabled={selecionada === null || enviando}
          onClick={confirmarResposta}
          style={{ width: "100%" }}
        >
          Confirmar resposta
        </button>
      ) : (
        <button
          className="vx-btn"
          disabled={enviando}
          onClick={avancar}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          {enviando ? "Calculando..." : idx + 1 < questoes.length ? <><ChevronRight size={14} /> Próxima pergunta</> : "Ver resultado"}
        </button>
      )}
    </div>
  );
}
