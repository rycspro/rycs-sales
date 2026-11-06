import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, Award, BookOpen, CheckCircle2, ChevronDown, ChevronRight,
  Circle, Clock3, GraduationCap, Lock, Play, RotateCcw, Sparkles,
} from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Medidor } from "../ui.jsx";
import { DEMOS, temDemo } from "./academyDemos.jsx";

// Rótulo das abas para onde um passo interativo pode levar o aluno.
const ABA_LABEL = {
  painel: "Painel", oportunidades: "Oportunidades", academy: "Academy",
  carteira: "Carteira", indicar: "Indicar", perfil: "Perfil",
};

// Diretiva de aula interativa, numa linha só:
//   [[ir:carteira|Abrir a Carteira]]  -> botão que leva à tela real
//   [[demo:menu]]                     -> widget de demonstração embutido
const DIRETIVA = /^\[\[(ir|demo):([a-z-]+)(?:\|([^\]]+))?\]\]$/;

// Renderização leve do conteúdo da aula: negrito, citação e lista. Não é
// Markdown completo de propósito — carregar um parser inteiro para três
// marcações seria peso sem retorno.
// Passo interativo: leva o aluno para a tela real da plataforma.
function PassoIr({ aba, rotulo, navegar }) {
  const label = rotulo || `Abrir ${ABA_LABEL[aba] || aba}`;
  const valida = !!ABA_LABEL[aba] && aba !== "academy";
  if (!valida || !navegar) {
    // Sem ponte de navegação (ou aba inválida): não deixa um botão morto na tela.
    return <div className="vx-chart-source" style={{ margin: "14px 0" }}>Abra {ABA_LABEL[aba] || aba} no menu para praticar este passo.</div>;
  }
  return (
    <div style={{ margin: "16px 0" }}>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }}
        aria-label={label} onClick={() => navegar(aba)}>
        <ArrowUpRight size={15} /> {label}
      </button>
      <div className="vx-chart-source" style={{ marginTop: 6 }}>
        Abre a ferramenta de verdade. Depois use “Voltar ao curso” para retomar daqui.
      </div>
    </div>
  );
}

function Conteudo({ texto, navegar }) {
  const blocos = String(texto || "").split("\n").filter((l) => l.trim() !== "");
  return (
    <div style={{ fontSize: 14.5, lineHeight: 1.72 }}>
      {blocos.map((linha, i) => {
        const t = linha.trim();
        const dir = t.match(DIRETIVA);
        if (dir) {
          const [, tipo, chave, rotulo] = dir;
          if (tipo === "ir") return <PassoIr key={i} aba={chave} rotulo={rotulo} navegar={navegar} />;
          if (tipo === "demo" && temDemo(chave)) {
            const Demo = DEMOS[chave];
            return <Demo key={i} navegar={navegar} />;
          }
          return null; // diretiva desconhecida não vira texto cru
        }
        if (t.startsWith("> ")) {
          return (
            <blockquote key={i} style={{
              margin: "14px 0", padding: "12px 16px", borderLeft: "3px solid var(--brand)",
              background: "var(--surface-2)", borderRadius: "0 8px 8px 0", fontStyle: "italic",
            }}>{t.slice(2)}</blockquote>
          );
        }
        if (/^[-•]\s/.test(t) || /^\d+\.\s/.test(t)) {
          return <div key={i} style={{ paddingLeft: 18, position: "relative", margin: "5px 0" }}>
            <span style={{ position: "absolute", left: 2, color: "var(--brand)" }}>·</span>
            <Negrito texto={t.replace(/^([-•]|\d+\.)\s/, "")} />
          </div>;
        }
        return <p key={i} style={{ margin: "10px 0" }}><Negrito texto={t} /></p>;
      })}
    </div>
  );
}

function Negrito({ texto }) {
  const partes = String(texto).split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <b key={i} style={{ color: "var(--ink)" }}>{p.slice(2, -2)}</b>
      : <span key={i}>{p}</span>);
}

export default function CursoPlayer({ courseId, eu, aviso, voltar, onCertified, navegar, aulaInicialId }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aulaId, setAulaId] = useState(null);
  const [abertos, setAbertos] = useState({});
  const [fase, setFase] = useState("curso");        // curso | prova | resultado
  const [prova, setProva] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    const r = await api(`/courses/${courseId}`);
    if (!r || r.error) return setErro(r?.error || "Curso indisponível.");
    setDados(r);
    setAbertos(Object.fromEntries(r.curso.modulos.map((m) => [m.id, true])));
    // Ao voltar de um tour na ferramenta real, retoma exatamente a aula de onde
    // o aluno saiu; só então cai para "próxima aula" ou a primeira.
    const todas = r.curso.modulos.flatMap((m) => m.aulas);
    const retomar = aulaInicialId && todas.some((a) => a.id === aulaInicialId) ? aulaInicialId : null;
    if (retomar) setAulaId(retomar);
    else if (!aulaId) setAulaId(r.progresso?.proximaAula?.id || todas[0]?.id || null);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [courseId]);

  const aulas = useMemo(() => dados?.curso.modulos.flatMap((m) => m.aulas) || [], [dados]);
  const aula = aulas.find((a) => a.id === aulaId) || null;

  // Passo interativo: abre a ferramenta real levando o contexto para que o aluno
  // consiga voltar a esta aula. Sem ponte (ex.: prévia), o botão some sozinho.
  const irFerramenta = navegar ? (aba) => navegar(aba, { courseId, aulaId }) : null;
  const indice = aulas.findIndex((a) => a.id === aulaId);
  const concluidas = new Set(dados?.progresso?.aulasConcluidas || []);

  const matricular = async () => {
    const r = await api(`/courses/${courseId}/enroll`, {});
    if (r?.error) return aviso(r.error);
    await carregar();
    aviso("Matrícula feita. Bom curso!");
  };

  const marcar = async (id, feito) => {
    const r = feito
      ? await apiDelete(`/courses/${courseId}/lessons/${id}/complete`)
      : await api(`/courses/${courseId}/lessons/${id}/complete`, {});
    if (r?.error) return aviso(r.error);
    setDados((d) => ({ ...d, progresso: r }));
  };

  const concluirEAvancar = async () => {
    if (!aula) return;
    if (!concluidas.has(aula.id)) await marcar(aula.id, false);
    const proxima = aulas[indice + 1];
    if (proxima) setAulaId(proxima.id);
    else aviso("Você chegou ao fim das aulas. A prova está liberada.");
  };

  const abrirProva = async () => {
    const r = await api(`/courses/${courseId}/quiz`);
    if (r?.error) return aviso(r.error);
    setProva(r.questoes);
    setRespostas({});
    setResultado(null);
    setFase("prova");
    window.scrollTo(0, 0);
  };

  const enviarProva = async () => {
    setEnviando(true);
    const r = await api(`/courses/${courseId}/quiz`, { respostas });
    setEnviando(false);
    if (r?.error) return aviso(r.error);
    setResultado(r);
    setFase("resultado");
    await carregar();
    if (r.aprovado) await onCertified?.();
    window.scrollTo(0, 0);
  };

  if (erro) return <><button className="vx-btn vx-btn-sm" onClick={voltar}><ArrowLeft size={13} /> Voltar</button><div className="vx-notice vx-notice-amber" style={{ marginTop: 12 }}>{erro}</div></>;
  if (!dados) return <div className="vx-card vx-skeleton" style={{ height: 400 }} />;

  const { curso, progresso, certificado } = dados;

  // ------------------------------------------------------- resultado ----
  if (fase === "resultado" && resultado) {
    return (
      <div className="vx-fade" style={{ maxWidth: 680 }}>
        <button className="vx-btn vx-btn-sm" onClick={() => setFase("curso")}><ArrowLeft size={13} /> Voltar ao curso</button>

        <div className="vx-card" style={{ padding: 26, textAlign: "center", marginTop: 12 }}>
          <div style={{
            width: 62, height: 62, borderRadius: 18, margin: "0 auto 14px",
            background: "var(--surface-2)", border: `1px solid ${resultado.aprovado ? "var(--brand)" : "var(--amber)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {resultado.aprovado ? <Award size={28} color="var(--brand)" /> : <RotateCcw size={28} color="var(--amber)" />}
          </div>
          <div className="vx-disp" style={{ fontSize: 21 }}>
            {resultado.aprovado ? "Aprovado!" : "Ainda não foi desta vez"}
          </div>
          <div className="vx-disp vx-mono" style={{ fontSize: 44, color: resultado.aprovado ? "var(--brand)" : "var(--amber)", margin: "8px 0 2px" }}>
            {resultado.percentual}%
          </div>
          <p className="vx-mut" style={{ fontSize: 13 }}>
            {resultado.acertos} de {resultado.total} corretas · nota mínima {resultado.notaMinima}%
          </p>

          {resultado.certificado && (
            <div className="vx-notice" style={{ marginTop: 14, textAlign: "left" }}>
              <b><Award size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Certificado emitido</b>
              <div className="vx-mono" style={{ fontSize: 13, color: "var(--brand)", marginTop: 4 }}>{resultado.certificado.codigo}</div>
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 3 }}>
                Já aparece no seu perfil e na aba Certificados. O código serve para qualquer empresa conferir.
              </div>
            </div>
          )}

          {!resultado.aprovado && (
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }} onClick={abrirProva}>
              <RotateCcw size={14} /> Refazer a prova
            </button>
          )}
        </div>

        <h3 className="vx-disp" style={{ fontSize: 16, margin: "22px 0 10px" }}>Revisão das questões</h3>
        <div className="vx-grid">
          {resultado.detalhe.map((d, i) => (
            <div key={d.id} className="vx-card" style={{ padding: 16, borderLeft: `3px solid ${d.acertou ? "var(--brand)" : "var(--red)"}` }}>
              <div className="vx-row" style={{ marginBottom: 6 }}>
                <b style={{ fontSize: 13.5 }}>{i + 1}. {d.pergunta}</b>
                <span className={"vx-badge " + (d.acertou ? "vx-badge-brand" : "vx-badge-red")} style={{ flexShrink: 0 }}>
                  {d.acertou ? "Certa" : "Errada"}
                </span>
              </div>
              <div style={{ fontSize: 12.5 }}>
                <div className="vx-mut">Sua resposta: {d.alternativas[d.marcada] ?? "não respondida"}</div>
                {!d.acertou && <div style={{ color: "var(--brand)" }}>Correta: {d.alternativas[d.correta]}</div>}
              </div>
              {d.explicacao && <div className="vx-chart-source" style={{ marginTop: 8 }}>{d.explicacao}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ prova ----
  if (fase === "prova" && prova) {
    const respondidas = prova.filter((q) => respostas[q.id] !== undefined).length;
    return (
      <div className="vx-fade" style={{ maxWidth: 680 }}>
        <button className="vx-btn vx-btn-sm" onClick={() => setFase("curso")}><ArrowLeft size={13} /> Voltar ao curso</button>

        <div className="vx-page-head" style={{ marginTop: 12 }}>
          <div>
            <div className="vx-eyebrow">Prova de certificação</div>
            <h1 className="vx-disp" style={{ fontSize: 22 }}>{curso.titulo}</h1>
            <p>{prova.length} questões · nota mínima {curso.notaMinima}% · tentativas ilimitadas.</p>
          </div>
          <span className="vx-chip vx-mono">{respondidas}/{prova.length}</span>
        </div>

        <div className="vx-grid">
          {prova.map((q, i) => (
            <div key={q.id} className="vx-card" style={{ padding: 18 }}>
              <b style={{ fontSize: 14 }}>{i + 1}. {q.pergunta}</b>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
                {q.alternativas.map((alt, ai) => {
                  const on = respostas[q.id] === ai;
                  return (
                    <button key={ai} type="button" className="vx-btn"
                      onClick={() => setRespostas({ ...respostas, [q.id]: ai })}
                      style={{
                        justifyContent: "flex-start", textAlign: "left", padding: "11px 13px",
                        borderColor: on ? "var(--brand)" : "var(--border)",
                        background: on ? "var(--brand-100)" : "transparent",
                        color: on ? "var(--brand)" : "var(--ink)",
                      }}>
                      {on ? <CheckCircle2 size={14} /> : <Circle size={14} />} {alt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 18 }}
          disabled={enviando || respondidas < prova.length} onClick={enviarProva}>
          {enviando ? "Corrigindo…" : respondidas < prova.length
            ? `Faltam ${prova.length - respondidas} questões`
            : "Enviar prova"}
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------ curso ----
  return (
    <div className="vx-fade">
      <button className="vx-btn vx-btn-sm" onClick={voltar}><ArrowLeft size={13} /> Todos os cursos</button>

      <div className="vx-card" style={{ padding: 0, overflow: "hidden", marginTop: 12 }}>
        <img src={curso.capa} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
        <div style={{ padding: 20 }}>
          <div className="vx-eyebrow">{curso.categoria} · {curso.professor}</div>
          <h1 className="vx-disp" style={{ fontSize: 23, margin: "4px 0 6px" }}>{curso.titulo}</h1>
          <p className="vx-mut" style={{ fontSize: 13.5, margin: 0 }}>{curso.descricao}</p>

          <div className="vx-course-meta" style={{ marginTop: 14 }}>
            <span><BookOpen size={12} /> {curso.modulos.length} módulos · {curso.totalAulas} aulas</span>
            <span><Clock3 size={12} /> {curso.duracaoMin} min</span>
            <span><GraduationCap size={12} /> {curso.totalQuestoes} questões</span>
            <span><Award size={12} /> Certificado</span>
          </div>

          {curso.requisitos && <div className="vx-chart-source">Requisitos: {curso.requisitos}</div>}

          {!progresso || progresso.total === 0 ? null : (
            <div style={{ marginTop: 16 }}>
              <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 5 }}>
                <span className="vx-mut">{progresso.concluidas} de {progresso.total} aulas</span>
                <b className="vx-mono">{progresso.percentual}%</b>
              </div>
              <Medidor value={progresso.percentual} tone={progresso.percentual === 100 ? "brand" : "amber"} />
            </div>
          )}

          {certificado ? (
            <div className="vx-notice" style={{ marginTop: 14 }}>
              <b><Award size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Você concluiu este curso</b>
              <div className="vx-mono" style={{ fontSize: 13, color: "var(--brand)", marginTop: 4 }}>{certificado.codigo}</div>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>{certificado.percentual}% em {dataCurta(certificado.emitidoEm)}</div>
            </div>
          ) : progresso?.liberouProva ? (
            <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 14 }} onClick={abrirProva}>
              <GraduationCap size={14} /> Fazer a prova de certificação
            </button>
          ) : null}
        </div>
      </div>

      <div className="vx-course-layout">
        {/* ------------------------------------------------ sumário ---- */}
        <aside className="vx-card" style={{ padding: 14, alignSelf: "start" }}>
          <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Conteúdo do curso</div>
          {curso.modulos.map((m, mi) => {
            const feitasNoModulo = m.aulas.filter((a) => concluidas.has(a.id)).length;
            const aberto = abertos[m.id];
            return (
              <div key={m.id} style={{ marginBottom: 6 }}>
                <button className="vx-btn vx-btn-sm vx-btn-block" style={{ justifyContent: "space-between", textAlign: "left" }}
                  onClick={() => setAbertos({ ...abertos, [m.id]: !aberto })}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mi + 1}. {m.titulo}
                  </span>
                  <span className="vx-mut vx-mono" style={{ fontSize: 10.5, flexShrink: 0 }}>
                    {feitasNoModulo}/{m.aulas.length} {aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                </button>
                {aberto && m.aulas.map((a) => {
                  const feita = concluidas.has(a.id);
                  const atual = a.id === aulaId;
                  return (
                    <button key={a.id} onClick={() => { setAulaId(a.id); window.scrollTo(0, 0); }}
                      style={{
                        display: "flex", gap: 8, alignItems: "center", width: "100%", textAlign: "left",
                        padding: "8px 10px", background: atual ? "var(--brand-100)" : "transparent",
                        border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12.5,
                        color: atual ? "var(--brand)" : feita ? "var(--muted)" : "var(--ink)",
                        font: "inherit", fontWeight: atual ? 600 : 400,
                      }}>
                      {feita ? <CheckCircle2 size={13} color="var(--brand)" style={{ flexShrink: 0 }} />
                        : <Circle size={13} style={{ flexShrink: 0, opacity: .5 }} />}
                      <span style={{ flex: 1, minWidth: 0 }}>{a.titulo}</span>
                      <span className="vx-mut vx-mono" style={{ fontSize: 10, flexShrink: 0 }}>{a.duracaoMin}m</span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          <hr className="vx-sep" />
          <button className="vx-btn vx-btn-sm vx-btn-block"
            disabled={!progresso?.liberouProva} onClick={abrirProva}>
            {progresso?.liberouProva ? <><GraduationCap size={13} /> Prova</> : <><Lock size={13} /> Prova bloqueada</>}
          </button>
          {!progresso?.liberouProva && (
            <div className="vx-chart-source">Conclua as {progresso?.total || curso.totalAulas} aulas para liberar.</div>
          )}
        </aside>

        {/* --------------------------------------------------- aula ---- */}
        <div>
          {!aula ? (
            <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
              <p className="vx-mut">Escolha uma aula no sumário para começar.</p>
            </div>
          ) : (
            <div className="vx-card" style={{ padding: 22 }}>
              <div className="vx-row" style={{ gap: 8 }}>
                <div className="vx-eyebrow">Aula {indice + 1} de {aulas.length} · {aula.duracaoMin} min</div>
                {aula.tipo === "interativo" && (
                  <span className="vx-badge vx-badge-brand" style={{ flexShrink: 0 }}>
                    <Sparkles size={11} /> Interativa
                  </span>
                )}
              </div>
              <h2 className="vx-disp" style={{ fontSize: 20, margin: "5px 0 14px" }}>{aula.titulo}</h2>

              {aula.tipo === "video" && aula.videoUrl && (
                <div className="vx-notice" style={{ marginBottom: 14 }}>
                  <Play size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                  <a href={aula.videoUrl} target="_blank" rel="noreferrer">Abrir o vídeo da aula</a>
                </div>
              )}

              <Conteudo texto={aula.conteudo} navegar={irFerramenta} />

              {!!aula.materiais?.length && (
                <div style={{ marginTop: 16 }}>
                  <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Materiais</div>
                  {aula.materiais.map((m, i) => (
                    <a key={i} className="vx-chip" href={m.url} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>{m.titulo || m.url}</a>
                  ))}
                </div>
              )}

              <hr className="vx-sep" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="vx-btn" disabled={indice <= 0}
                  onClick={() => setAulaId(aulas[indice - 1]?.id)}>Aula anterior</button>
                <button className="vx-btn" onClick={() => marcar(aula.id, concluidas.has(aula.id))}>
                  {concluidas.has(aula.id) ? <><RotateCcw size={13} /> Marcar como não concluída</> : <><CheckCircle2 size={13} /> Marcar concluída</>}
                </button>
                <button className="vx-btn vx-btn-primary" style={{ flex: 1, minWidth: 160 }} onClick={concluirEAvancar}>
                  {indice + 1 < aulas.length ? "Concluir e avançar" : "Concluir última aula"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
