import { useEffect, useId, useRef, useState } from "react";
import { Check, AlertTriangle, Sparkles, Pencil } from "lucide-react";
import { api } from "../../lib/api.js";
import { FASES_IA, PARTES_IA, VARIAVEIS_IA, parteCompleta } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Etapa 4: a IA monta script, funil de WhatsApp e follow-ups (4a) e o dono
// revisa e aprova (4b). O servidor processa em segundo plano; a tela só
// acompanha. Nada do que foi gerado é usado antes da aprovação.

const EM_ANDAMENTO = ["pendente", "processando"];

function estadoDaFase(geracao, chave) {
  if (!geracao) return "pendente";
  if (chave === "aprovacao") return geracao.status === "pronta" || geracao.status === "aprovada" ? "atual" : "pendente";
  const f = geracao.fases?.[chave];
  if (f === "concluida") return "concluida";
  if (f === "falhou" && geracao.status === "falhou") return "falhou";
  if (f === "atual" || (EM_ANDAMENTO.includes(geracao.status) && FASES_IA.find((x) => geracao.fases?.[x.chave] !== "concluida")?.chave === chave)) return "atual";
  return "pendente";
}

// 4a. IA trabalhando.
function Trabalhando({ geracao, aoTentar, tentando, aoRevisar }) {
  const { t } = useI18n();
  const atual = FASES_IA.find((f) => estadoDaFase(geracao, f.chave) === "atual" || estadoDaFase(geracao, f.chave) === "falhou") || FASES_IA[0];
  const falhou = geracao.status === "falhou";
  const pronta = geracao.status === "pronta";
  return (
    <div className="vx-onb-ia">
      <section className="vx-onb-card vx-onb-palco" aria-live="polite">
        <div className={`vx-onb-anim vx-onb-anim-${pronta ? "pronta" : falhou ? "falhou" : atual.chave}`} aria-hidden="true">
          <span /><span /><span />
        </div>
        {pronta ? <>
          <h2 className="vx-disp vx-onb-card-titulo">{t("onb.ia.readyToReview")}</h2>
          <p className="vx-mut vx-onb-card-apoio">{t("onb.ia.readyToReviewDesc")}</p>
          <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 52 }} onClick={aoRevisar}>{t("onb.ia.reviewStrategies")}</button>
        </> : falhou ? <>
          <h2 className="vx-disp vx-onb-card-titulo">{t("onb.ia.failedAt", { phase: atual.titulo.toLowerCase() })}</h2>
          <p className="vx-onb-erro" role="alert">{geracao.erro || t("onb.ia.generationFailed")}</p>
          <p className="vx-mut" style={{ fontSize: 14 }}>{t("onb.ia.failedHint")}</p>
          <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 52 }} onClick={aoTentar} disabled={tentando}>
            {tentando ? t("onb.ia.resuming") : t("onb.tryAgain")}
          </button>
        </> : <>
          <h2 className="vx-disp vx-onb-card-titulo">{atual.titulo}</h2>
          <p className="vx-mut vx-onb-card-apoio">{atual.frase}</p>
          <p className="vx-onb-dica">{t("onb.ia.processingHint")}</p>
        </>}
      </section>
      <aside className="vx-onb-card">
        <h2 className="vx-disp" style={{ fontSize: 18, margin: "0 0 12px" }}>{t("onb.ia.phases")}</h2>
        <ol className="vx-onb-fases">
          {FASES_IA.map((f) => {
            const estado = estadoDaFase(geracao, f.chave);
            return (
              <li key={f.chave} data-estado={estado} aria-current={estado === "atual" ? "step" : undefined}>
                <span className="vx-onb-fase-marca" aria-hidden="true">
                  {estado === "concluida" ? <Check size={14} strokeWidth={3} /> : estado === "falhou" ? <AlertTriangle size={13} /> : null}
                </span>
                <span>
                  <b>{f.titulo}</b>
                  <span className="vx-sr">{{ concluida: ` (${t("onb.ia.stDone")})`, atual: ` (${t("onb.ia.stInProgress")})`, falhou: ` (${t("onb.ia.stFailed")})`, pendente: ` (${t("onb.ia.stPending")})` }[estado]}</span>
                  <small>{f.frase}</small>
                </span>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

function BlocoParte({ parte, conteudo, aprovado, aoSalvar, aoAprovar, ocupado }) {
  const { t } = useI18n();
  const id = useId();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(conteudo);
  const [erro, setErro] = useState("");
  useEffect(() => { if (!editando) setRascunho(conteudo); }, [conteudo, editando]);

  const salvar = async () => {
    if (!parteCompleta(parte.chave, rascunho)) return setErro(t("onb.ia.fillAllFields"));
    setErro("");
    if (await aoSalvar(parte.chave, rascunho)) setEditando(false);
  };

  return (
    <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-t`} data-aprovado={aprovado ? "1" : "0"}>
      <div className="vx-row" style={{ flexWrap: "wrap", marginBottom: 12 }}>
        <h2 id={`${id}-t`} className="vx-disp" style={{ margin: 0 }}>{parte.label}</h2>
        {aprovado && <span className="vx-badge vx-onb-badge-ok"><Check size={12} aria-hidden="true" /> {t("onb.ia.approved")}</span>}
      </div>

      {parte.chave === "followups" ? (
        <ol className="vx-onb-followups">
          {(editando ? rascunho : conteudo || []).map((f, i) => (
            <li key={i}>
              {editando ? <>
                <label className="vx-label" htmlFor={`${id}-q${i}`}>{t("onb.ia.whenToSend")}</label>
                <input id={`${id}-q${i}`} className="vx-input" value={f.quando} onChange={(e) => setRascunho((r) => r.map((x, j) => (j === i ? { ...x, quando: e.target.value } : x)))} />
                <label className="vx-label" htmlFor={`${id}-m${i}`} style={{ marginTop: 8 }}>{t("onb.ia.message")}</label>
                <textarea id={`${id}-m${i}`} className="vx-input" rows={3} value={f.mensagem} onChange={(e) => setRascunho((r) => r.map((x, j) => (j === i ? { ...x, mensagem: e.target.value } : x)))} />
              </> : <>
                <b>{f.quando}</b>
                <p>{f.mensagem}</p>
              </>}
            </li>
          ))}
        </ol>
      ) : (
        <dl className="vx-onb-partes">
          {parte.campos.map(([campo, rotulo]) => (
            <div key={campo}>
              {editando ? <>
                <label className="vx-label" htmlFor={`${id}-${campo}`}>{rotulo}</label>
                <textarea id={`${id}-${campo}`} className="vx-input" rows={4} value={rascunho?.[campo] || ""}
                  onChange={(e) => setRascunho((r) => ({ ...r, [campo]: e.target.value }))} />
              </> : <>
                <dt>{rotulo}</dt>
                <dd>{conteudo?.[campo]}</dd>
              </>}
            </div>
          ))}
        </dl>
      )}

      {erro && <div className="vx-onb-erro" role="alert">{erro}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {editando ? <>
          <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => { setEditando(false); setErro(""); }} disabled={ocupado}>{t("onb.ia.cancel")}</button>
          <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={salvar} disabled={ocupado}>{t("onb.ia.saveEdit")}</button>
        </> : <>
          <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => setEditando(true)} disabled={ocupado}>
            <Pencil size={14} aria-hidden="true" /> {t("onb.ia.edit")}
          </button>
          <button type="button" className={`vx-btn ${aprovado ? "" : "vx-btn-primary"}`} style={{ minHeight: 44 }} aria-pressed={aprovado}
            onClick={() => aoAprovar(parte.chave, !aprovado)} disabled={ocupado}>
            {aprovado ? t("onb.ia.approved") : t("onb.ia.approve")}
          </button>
        </>}
      </div>
    </section>
  );
}

// 4b. Aprovação do dono.
function Aprovacao({ geracao, setGeracao, aoAtualizar, aoAvancar, aoVoltar }) {
  const { t } = useI18n();
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [pedindo, setPedindo] = useState(false);
  const [pedido, setPedido] = useState("");
  const aprovadas = PARTES_IA.filter((p) => geracao.aprovacoes?.[p.chave]).length;

  const chamar = async (caminho, corpo) => {
    setErro("");
    setOcupado(true);
    const r = await api(caminho, corpo);
    setOcupado(false);
    if (!r || r.error) { setErro(r?.error || t("onb.ia.errSave")); return null; }
    if (r.geracao) setGeracao(r.geracao);
    return r;
  };

  const aprovarTudo = async () => {
    const r = await chamar("/onboarding/ia/aprovar-tudo", {});
    if (r) { aoAtualizar(r); aoAvancar(r); }
  };

  return (
    <div>
      {geracao.conteudo?.fontes?.length > 0 && (
        <div className="vx-onb-aviso">
          {t("onb.ia.builtWithSources", { sources: geracao.conteudo.fontes.join("; ") })}
        </div>
      )}
      {geracao.conteudo?.aviso && <div className="vx-onb-aviso" role="status">{geracao.conteudo.aviso}</div>}
      <div className="vx-onb-aviso">
        {t("onb.ia.variablesNote")} {VARIAVEIS_IA.map((v, i) => <span key={v}>{i ? ", " : ""}<code>{v}</code></span>)}. {t("onb.ia.keepVariables")}
      </div>
      {PARTES_IA.map((p) => (
        <BlocoParte key={p.chave} parte={p} conteudo={geracao.conteudo?.[p.chave]} aprovado={!!geracao.aprovacoes?.[p.chave]} ocupado={ocupado}
          aoSalvar={async (parte, conteudo) => !!(await chamar("/onboarding/ia/conteudo", { parte, conteudo }))}
          aoAprovar={(parte, aprovado) => chamar("/onboarding/ia/aprovar", { parte, aprovado })} />
      ))}

      {pedindo && (
        <section className="vx-onb-card vx-onb-secao">
          <label className="vx-label" htmlFor={`${id}-ajuste`}>{t("onb.ia.adjustLabel")}</label>
          {geracao.conteudo?.motor === "interno" && (
            <div id={`${id}-ajuste-dica`} className="vx-onb-dica">
              {t("onb.ia.adjustHint")}
            </div>
          )}
          <textarea id={`${id}-ajuste`} aria-describedby={geracao.conteudo?.motor === "interno" ? `${id}-ajuste-dica` : undefined} className="vx-input" rows={4} maxLength={2000} value={pedido} onChange={(e) => setPedido(e.target.value)}
            placeholder={t("onb.ia.adjustPlaceholder")} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => setPedindo(false)} disabled={ocupado}>{t("onb.ia.cancel")}</button>
            <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={ocupado || pedido.trim().length < 5}
              onClick={async () => { if (await chamar("/onboarding/ia/ajustes", { pedido })) { setPedindo(false); setPedido(""); } }}>
              {t("onb.ia.sendToAI")}
            </button>
          </div>
        </section>
      )}

      <div aria-live="polite">{erro && <div className="vx-onb-erro" role="alert">{erro}</div>}</div>
      <div className="vx-onb-barra">
        <span role="status"><b>{aprovadas} {t("onb.ia.of")} {PARTES_IA.length}</b> {t("onb.ia.partsApproved")}</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="vx-btn" onClick={aoVoltar} disabled={ocupado}>{t("onb.back")}</button>
          <button type="button" className="vx-btn" onClick={() => setPedindo(true)} disabled={ocupado || pedindo}>{t("onb.ia.requestAdjustments")}</button>
          <button type="button" className="vx-btn vx-btn-primary" onClick={aprovarTudo} disabled={ocupado}>{t("onb.ia.approveAllContinue")}</button>
        </div>
      </div>
    </div>
  );
}

export default function EtapaIA({ estado, aoAtualizar, aoAvancar, aoVoltar }) {
  const { t } = useI18n();
  const [dados, setDados] = useState(null); // { disponivel, geracao }
  const [erroCarga, setErroCarga] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [tentando, setTentando] = useState(false);
  const [erro, setErro] = useState("");
  const timer = useRef(null);

  const carregar = async () => {
    const r = await api("/onboarding/ia");
    if (!r || r.error) { setErroCarga(r?.error || t("onb.ia.errLoad")); return null; }
    setErroCarga("");
    setDados(r);
    return r;
  };
  useEffect(() => { carregar(); return () => clearTimeout(timer.current); }, []);

  // Acompanha o trabalho em segundo plano enquanto ele não termina.
  const status = dados?.geracao?.status;
  useEffect(() => {
    if (!EM_ANDAMENTO.includes(status)) return;
    timer.current = setTimeout(carregar, 2000);
    return () => clearTimeout(timer.current);
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps

  const setGeracao = (g) => {
    setDados((d) => ({ ...d, geracao: g }));
    if (EM_ANDAMENTO.includes(g.status)) setRevisando(false);
  };

  const acao = async (caminho, corpo = {}) => {
    setErro("");
    const r = await api(caminho, corpo);
    if (!r || r.error) { setErro(r?.error || t("onb.ia.errContinue")); return null; }
    return r;
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>{t("onb.tryAgain")}</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">{t("onb.ia.loading")}</div>;

  const g = dados.geracao;
  const cabecalho = (
    <>
      <div className="vx-onb-eyebrow">{t("onb.stepOf", { n: 4, total: 6 })}</div>
      <h1 className="vx-disp vx-onb-titulo">{revisando ? t("onb.ia.reviewTitle") : t("onb.ia.title")}</h1>
      <p className="vx-mut vx-onb-card-apoio">{revisando ? t("onb.ia.reviewDesc") : t("onb.ia.desc")}</p>
    </>
  );
  const msgErro = erro && <div className="vx-onb-erro" role="alert">{erro}</div>;

  // Já aprovado (voltando a esta etapa): mostra e segue.
  if (estado.etapas.ia === "concluida") return (
    <div>
      {cabecalho}
      <div className="vx-onb-card vx-onb-estado">
        <p>{g?.status === "aprovada" ? t("onb.ia.alreadyApproved") : t("onb.ia.completedNoStrategies")}</p>
        <div className="vx-onb-acoes" style={{ justifyContent: "center" }}>
          <button type="button" className="vx-btn" onClick={aoVoltar}>{t("onb.back")}</button>
          <button type="button" className="vx-btn vx-btn-primary" onClick={() => aoAvancar(estado)}>{t("onb.continue")}</button>
        </div>
      </div>
    </div>
  );

  if (!g) return (
    <div>
      {cabecalho}
      <div className="vx-onb-card vx-onb-estado">
        <Sparkles size={22} aria-hidden="true" />
        <p>{t("onb.ia.notStarted")}</p>
        {msgErro}
        <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 52 }}
          onClick={async () => { const r = await acao("/onboarding/ia/gerar"); if (r) setGeracao(r.geracao); }}>{t("onb.ia.generateStrategies")}</button>
      </div>
    </div>
  );

  if (revisando && g.status === "pronta") return (
    <div>{cabecalho}
      <Aprovacao geracao={g} setGeracao={setGeracao} aoAtualizar={aoAtualizar} aoAvancar={aoAvancar} aoVoltar={() => setRevisando(false)} />
    </div>
  );

  return (
    <div>
      {cabecalho}
      <Trabalhando geracao={g} tentando={tentando} aoRevisar={() => setRevisando(true)}
        aoTentar={async () => { setTentando(true); const r = await acao("/onboarding/ia/tentar"); setTentando(false); if (r) setGeracao(r.geracao); }} />
      {msgErro}
      <div className="vx-onb-acoes">
        <button type="button" className="vx-btn" onClick={aoVoltar}>{t("onb.back")}</button>
        <span />
      </div>
    </div>
  );
}
