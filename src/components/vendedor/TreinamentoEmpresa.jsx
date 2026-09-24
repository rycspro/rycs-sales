import { useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, XCircle, RefreshCw, ChevronRight, Award } from "lucide-react";
import { api } from "../../lib/api.js";

export default function TreinamentoEmpresa({ empresa, eu, voltar, onAprovado, aviso, recarregar }) {
  const qualificacao = empresa.qualificacao || {};
  const questoes = qualificacao.questoes || [];
  const notaMinima = Number(qualificacao.notaMinimaQuiz || 70);
  const cursoModulos = empresa.curso || [];

  const detalhe = eu.aplicacoesDetalhe?.[empresa.id] || {};
  const quizScoreAnterior = detalhe.quizScore;

  const [fase, setFase] = useState("treinamento"); // treinamento | avaliacao | resultado
  const [perguntaIdx, setPerguntaIdx] = useState(0);
  const [respostas, setRespostas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [candidatando, setCandidatando] = useState(false);

  const st = eu.aplicacoes?.[empresa.id];

  async function enviarQuiz() {
    if (respostas.length !== questoes.length || respostas.some((x) => x === undefined)) {
      return aviso("Responda todas as questões antes de enviar.");
    }
    setEnviando(true);
    const r = await api(`/company-training/${empresa.id}/quiz`, { respostas });
    setEnviando(false);
    if (r?.error) return aviso(r.error);
    setResultado(r);
    setFase("resultado");
    await recarregar?.();
  }

  async function candidatar() {
    setCandidatando(true);
    const r = await api("/applications", { sellerId: eu.id, companyId: empresa.id });
    setCandidatando(false);
    if (r?.error) return aviso(r.error);
    aviso(`Candidatura enviada para ${empresa.nome}. A empresa irá analisar.`);
    await recarregar?.();
  }

  function escolher(opcaoIdx) {
    const novas = [...respostas];
    novas[perguntaIdx] = opcaoIdx;
    setRespostas(novas);
  }

  function proximaPergunta() {
    if (perguntaIdx < questoes.length - 1) setPerguntaIdx((i) => i + 1);
  }

  function reiniciar() {
    setRespostas([]);
    setPerguntaIdx(0);
    setResultado(null);
    setFase("treinamento");
  }

  // Seller já aprovado: não deveria estar aqui, mas por segurança mostra campanhas
  if (st === "aprovado") {
    onAprovado?.();
    return null;
  }

  // Seller pendente: aguardando aprovação da empresa
  if (st === "pendente") {
    return (
      <div className="vx-fade">
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 14, marginLeft: -8 }} onClick={voltar}>
          <ArrowLeft size={14} /> Empresas
        </button>
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Award size={32} color="var(--brand)" style={{ marginBottom: 12 }} />
          <div className="vx-disp" style={{ fontSize: 18, marginBottom: 8 }}>Candidatura em análise</div>
          <p className="vx-mut" style={{ fontSize: 13 }}>
            Você concluiu a avaliação e sua candidatura foi enviada para <b>{empresa.nome}</b>.<br />
            Aguarde a empresa analisar e aprovar seu perfil.
          </p>
          {quizScoreAnterior !== undefined && (
            <div style={{ marginTop: 12, fontSize: 13, color: quizScoreAnterior >= notaMinima ? "var(--brand)" : "#b45309" }}>
              <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Sua nota: <b>{quizScoreAnterior}%</b> · mínimo {notaMinima}%
            </div>
          )}
        </div>
      </div>
    );
  }

  // FASE: TREINAMENTO
  if (fase === "treinamento") {
    return (
      <div className="vx-fade">
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 14, marginLeft: -8 }} onClick={voltar}>
          <ArrowLeft size={14} /> Empresas
        </button>

        <div style={{ marginBottom: 20 }}>
          <div className="vx-eyebrow">{empresa.nome}</div>
          <div className="vx-disp" style={{ fontSize: 22, margin: "4px 0 2px" }}>Preparação para operar</div>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>
            Estude o material abaixo para representar esta empresa. Depois responda a avaliação.
          </p>
        </div>

        {quizScoreAnterior !== undefined && (
          <div style={{ background: quizScoreAnterior >= notaMinima ? "rgba(34,197,94,.1)" : "#fef3c7", border: `1px solid ${quizScoreAnterior >= notaMinima ? "#86efac" : "#fcd34d"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            {quizScoreAnterior >= notaMinima
              ? <CheckCircle2 size={16} color="#16a34a" />
              : <XCircle size={16} color="#b45309" />}
            <span style={{ fontSize: 13 }}>
              Última avaliação: <b>{quizScoreAnterior}%</b> · mínimo {notaMinima}%
              {quizScoreAnterior < notaMinima && " — revise o material e tente novamente"}
            </span>
          </div>
        )}

        {cursoModulos.length === 0 && questoes.length === 0 && (
          <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
            <BookOpen size={28} color="var(--muted)" />
            <p className="vx-mut" style={{ marginTop: 10 }}>Esta empresa ainda não publicou material de treinamento.</p>
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 14 }} onClick={candidatar} disabled={candidatando}>
              {candidatando ? "Enviando…" : "Candidatar-se mesmo assim"}
            </button>
          </div>
        )}

        {cursoModulos.map((m, i) => (
          <div key={m.id || i} className="vx-card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{m.titulo}</div>
            <div className="vx-mut" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.conteudo}</div>
          </div>
        ))}

        {!!questoes.length && (
          <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 8 }} onClick={() => { setFase("avaliacao"); setPerguntaIdx(0); setRespostas([]); }}>
            <Award size={15} /> Fazer avaliação ({questoes.length} perguntas)
          </button>
        )}

        {!questoes.length && cursoModulos.length > 0 && (
          <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 8 }} onClick={candidatar} disabled={candidatando}>
            {candidatando ? "Enviando…" : "Candidatar-se para esta empresa"}
          </button>
        )}
      </div>
    );
  }

  // FASE: AVALIAÇÃO (uma pergunta por vez)
  if (fase === "avaliacao") {
    const q = questoes[perguntaIdx];
    const respostaAtual = respostas[perguntaIdx];
    const totalRespondidas = respostas.filter((r) => r !== undefined).length;
    const progresso = Math.round((perguntaIdx / questoes.length) * 100);

    return (
      <div className="vx-fade">
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 14, marginLeft: -8 }} onClick={() => setFase("treinamento")}>
          <ArrowLeft size={14} /> Voltar ao treinamento
        </button>

        <div style={{ marginBottom: 16 }}>
          <div className="vx-eyebrow">{empresa.nome} · Avaliação</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span className="vx-mut" style={{ fontSize: 13 }}>Pergunta {perguntaIdx + 1} de {questoes.length}</span>
            <span className="vx-mut vx-mono" style={{ fontSize: 12 }}>{totalRespondidas} respondidas</span>
          </div>
          <div style={{ height: 5, background: "var(--surface-3)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progresso}%`, background: "var(--brand)", borderRadius: 99, transition: "width .25s" }} />
          </div>
        </div>

        <div className="vx-card" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.5, margin: "0 0 16px" }}>{q.pergunta}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(q.opcoes || []).map((op, n) => (
              <button
                key={n}
                onClick={() => escolher(n)}
                style={{
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: `2px solid ${respostaAtual === n ? "var(--brand)" : "var(--border)"}`,
                  background: respostaAtual === n ? "var(--brand-50, rgba(var(--brand-rgb,79,70,229),.08))" : "var(--surface-1)",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: respostaAtual === n ? 600 : 400,
                  color: "var(--ink-1)",
                  transition: "border-color .15s, background .15s",
                }}
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {perguntaIdx > 0 && (
            <button className="vx-btn" style={{ flex: 1 }} onClick={() => setPerguntaIdx((i) => i - 1)}>
              Anterior
            </button>
          )}
          {perguntaIdx < questoes.length - 1 ? (
            <button
              className="vx-btn vx-btn-primary"
              style={{ flex: 2 }}
              disabled={respostaAtual === undefined}
              onClick={proximaPergunta}
            >
              Próxima <ChevronRight size={14} />
            </button>
          ) : (
            <button
              className="vx-btn vx-btn-primary"
              style={{ flex: 2 }}
              disabled={totalRespondidas < questoes.length || enviando}
              onClick={enviarQuiz}
            >
              {enviando ? "Enviando…" : "Enviar avaliação"}
            </button>
          )}
        </div>

        {totalRespondidas < questoes.length && (
          <p className="vx-mut" style={{ textAlign: "center", fontSize: 12, marginTop: 10 }}>
            Responda todas as perguntas para enviar
          </p>
        )}
      </div>
    );
  }

  // FASE: RESULTADO
  if (fase === "resultado" && resultado) {
    const aprovado = resultado.aprovado || resultado.quizScore >= notaMinima;
    const score = resultado.quizScore;

    return (
      <div className="vx-fade">
        <div className="vx-card" style={{ padding: 28, textAlign: "center", marginBottom: 16 }}>
          {aprovado
            ? <CheckCircle2 size={40} color="#16a34a" style={{ marginBottom: 12 }} />
            : <XCircle size={40} color="#dc2626" style={{ marginBottom: 12 }} />}
          <div className="vx-disp" style={{ fontSize: 20, marginBottom: 8 }}>
            {aprovado ? "Aprovado!" : "Não atingiu a nota mínima"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: aprovado ? "#16a34a" : "#dc2626", marginBottom: 8 }}>
            {score}%
          </div>
          <div className="vx-mut" style={{ fontSize: 13 }}>Nota mínima: {notaMinima}%</div>

          {!aprovado && (
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginTop: 16, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "#92400e" }}>Recomendação</div>
              <p style={{ fontSize: 13, color: "#78350f", margin: 0 }}>
                Revise o material de treinamento da empresa e tente novamente.
                Preste atenção especial em: ICP, produto, objeções e abordagem comercial.
              </p>
            </div>
          )}
        </div>

        {aprovado ? (
          <div>
            <p style={{ fontSize: 13, textAlign: "center", marginBottom: 14 }}>
              ✅ Você está preparado para representar <b>{empresa.nome}</b>.
              Envie sua candidatura para a empresa analisar.
            </p>
            <button className="vx-btn vx-btn-primary vx-btn-block" onClick={candidatar} disabled={candidatando}>
              {candidatando ? "Enviando…" : "Enviar candidatura"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="vx-btn vx-btn-block" onClick={() => setFase("treinamento")}>
              <BookOpen size={14} /> Revisar treinamento
            </button>
            <button className="vx-btn vx-btn-primary vx-btn-block" onClick={reiniciar}>
              <RefreshCw size={14} /> Refazer avaliação
            </button>
          </div>
        )}
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginTop: 14, width: "100%" }} onClick={voltar}>
          <ArrowLeft size={14} /> Voltar para empresas
        </button>
      </div>
    );
  }

  return null;
}
