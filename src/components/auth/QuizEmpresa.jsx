import { useEffect, useRef, useState } from "react";
import "./QuizEmpresa.css";
import { PERGUNTAS_QUALIFICACAO as PERGUNTAS } from "../../../shared/quizCadastroEmpresa.js";
import AgendarConversa from "./AgendarConversa.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import { ROTAS, navegar } from "../../lib/rotas.js";

const EMOJIS = ["💬", "🧩", "🧭", "📌", "💭"];
const MARCOS = ["Necessidades", "Estrutura", "Decisão"];
const INICIO_MARCOS = [0, 4, 9];


export default function QuizEmpresa({ onConcluir }) {
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState([]);
  const tituloRef = useRef(null);
  const resultado = etapa === PERGUNTAS.length;
  const pergunta = PERGUNTAS[etapa];
  const resumo = [0, 1, 3, 7, 9, 11, 12];
  useEffect(() => { tituloRef.current?.focus(); }, [etapa]);

  return <MolduraAuth largura={540} tarja="Seu próximo passo comercial" titulo="Como sua empresa pode começar na RYCS?"
    subtitulo="Conte seu momento em 13 perguntas para preparar uma conversa sobre a contratação."
    rodape={<button type="button" className="vx-onb-link" onClick={() => navegar(ROTAS.login)}>Já tenho conta — entrar</button>}>
    <div className="rycs-quiz-hero">
      <img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=80" alt="Equipe colaborando em uma mesa de trabalho" onError={(e) => { e.currentTarget.hidden = true; }} />
      <div className="rycs-quiz-hero-copy"><span className="rycs-quiz-badge">✨ Um caminho com a sua cara</span><strong>{resultado ? "Seu próximo capítulo começa aqui." : "Grandes conquistas começam com uma escolha."}</strong><span>Vamos construir o próximo passo da sua empresa.</span></div>
    </div>
    <div className="rycs-quiz-progress-heading" aria-live="polite">
      <span>{resultado ? "📅 Próximo passo: conversar com a RYCS" : `✨ Pergunta ${etapa + 1} de ${PERGUNTAS.length}${etapa === PERGUNTAS.length - 1 ? " · Última escolha!" : ""}`}</span>
      <strong>{Math.round(etapa / PERGUNTAS.length * 100)}%</strong>
    </div>
    <div className="rycs-quiz-track" role="progressbar" aria-label="Progresso do quiz" aria-valuemin={0} aria-valuemax={PERGUNTAS.length} aria-valuenow={etapa} aria-valuetext={`${etapa} de ${PERGUNTAS.length} etapas concluídas`}>
      <div className="rycs-quiz-fill" style={{ width: `${etapa / PERGUNTAS.length * 100}%` }} />
    </div>
    <div className="rycs-quiz-milestones">{MARCOS.map((marco, i) => <span key={marco} className={INICIO_MARCOS[i] <= etapa ? "is-active" : ""} aria-current={!resultado && etapa >= INICIO_MARCOS[i] && etapa < (INICIO_MARCOS[i + 1] ?? PERGUNTAS.length) ? "step" : undefined}><b>{etapa >= (INICIO_MARCOS[i + 1] ?? PERGUNTAS.length) ? "✓" : i + 1}</b>{marco}</span>)}</div>
    <div key={etapa} className="rycs-quiz-stage">
    <h2 ref={tituloRef} tabIndex={-1} className="vx-disp" style={{ fontSize: 22, margin: "0 0 10px" }}>{resultado ? "Vamos conversar sobre o momento da sua empresa?" : pergunta.titulo}</h2>
    {resultado ? <>
      <p className="vx-mut" style={{ lineHeight: 1.6 }}>Confira o resumo e agende uma conversa para avaliar o formato de trabalho, o investimento e o prazo de início.</p>
      <ol className="rycs-quiz-results">
        {resumo.map((i) => <li key={PERGUNTAS[i].criterio}><span aria-hidden="true">📌</span><div><strong>{PERGUNTAS[i].criterio}</strong><p>{PERGUNTAS[i].opcoes[respostas[i]]}</p></div></li>)}
      </ol>
      <AgendarConversa respostas={respostas} />
    </> : <>
      <p className="vx-mut" style={{ fontSize: 14, lineHeight: 1.6 }}>{pergunta.texto}</p>
      <fieldset style={{ border: 0, padding: 0, margin: "20px 0" }}>
        <legend className="vx-label">Escolha a opção que mais combina com sua empresa</legend>
        {pergunta.opcoes.map((opcao, i) => <label key={opcao} className={`rycs-quiz-option ${respostas[etapa] === i ? "is-selected" : ""}`}>
          <input type="radio" name={`quiz-empresa-${etapa}`} checked={respostas[etapa] === i} onChange={() => setRespostas((anteriores) => { const novas = [...anteriores]; novas[etapa] = i; return novas; })} />
          <span className="rycs-quiz-emoji" aria-hidden="true">{EMOJIS[i]}</span><span>{opcao}</span><span className="rycs-quiz-check" aria-hidden="true">{respostas[etapa] === i ? "✓" : ""}</span>
        </label>)}
      </fieldset>
      <p className="rycs-quiz-feedback" role="status">{respostas[etapa] === undefined ? "👆 Toque em uma opção para continuar" : "✨ Escolha registrada! Vamos ao próximo passo?"}</p>
      <button type="button" className="vx-btn vx-btn-primary vx-btn-block rycs-quiz-next" disabled={respostas[etapa] === undefined} onClick={() => setEtapa(etapa + 1)}>{etapa === PERGUNTAS.length - 1 ? "Concluir e ir para agendamento" : "Continuar →"}</button>
      <p className="vx-mut" style={{ fontSize: 12, lineHeight: 1.6 }}>Ao concluir, você confere suas respostas e segue para o agendamento da conversa.</p>
    </>}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
      {etapa > 0 && <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEtapa(etapa - 1)}>Voltar e revisar</button>}
      <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => onConcluir(false)}>Ir direto ao cadastro</button>
    </div>
  </MolduraAuth>;
}
