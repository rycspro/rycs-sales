import { useEffect, useId, useRef, useState } from "react";
import { Check, AlertTriangle, Sparkles, Pencil, Mic } from "lucide-react";
import { api } from "../../lib/api.js";
import { FASES_IA, PARTES_IA, VARIAVEIS_IA, parteCompleta } from "../../../shared/onboarding.js";
import ThinkingOrb from "../ThinkingOrb.jsx";

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

// 4a. IA trabalhando — fases animadas acima do "tudo pronto" com barra de progresso.
function Trabalhando({ geracao, aoTentar, tentando, aoRevisar }) {
  const atual = FASES_IA.find((f) => estadoDaFase(geracao, f.chave) === "atual" || estadoDaFase(geracao, f.chave) === "falhou") || FASES_IA[0];
  const falhou = geracao.status === "falhou";
  const pronta = geracao.status === "pronta";
  const concluidas = FASES_IA.filter((f) => estadoDaFase(geracao, f.chave) === "concluida").length;
  const progresso = pronta ? 100 : Math.round((concluidas / FASES_IA.length) * 100);

  return (
    <section className="vx-onb-card vx-onb-palco-v2" aria-live="polite" style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Fases — lista vertical acima do status central */}
      <ol className="vx-onb-fases-v2">
        {FASES_IA.map((f) => {
          const estado = estadoDaFase(geracao, f.chave);
          return (
            <li key={f.chave} data-estado={estado} aria-current={estado === "atual" ? "step" : undefined}>
              <span className="vx-onb-fase-marca" aria-hidden="true">
                {estado === "concluida" ? <Check size={14} strokeWidth={3} /> : estado === "falhou" ? <AlertTriangle size={13} /> : null}
              </span>
              <span className="vx-onb-fase-texto">
                <b>{f.titulo}</b>
                <span className="vx-sr">{{ concluida: " (concluída)", atual: " (em andamento)", falhou: " (falhou)", pendente: " (pendente)" }[estado]}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Barra de progresso */}
      <div className="vx-onb-ia-progresso" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
        <div className="vx-onb-ia-progresso-fill" style={{ width: `${progresso}%` }} />
      </div>
      <div className="vx-onb-ia-progresso-label">{concluidas} de {FASES_IA.length} fases concluídas</div>

      {/* Status central */}
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        {pronta ? <>
          <div className={`vx-onb-anim vx-onb-anim-pronta`} aria-hidden="true" style={{ margin: "0 auto 18px" }}>
            <span /><span /><span />
          </div>
          <h2 className="vx-disp vx-onb-card-titulo">Tudo pronto para revisar</h2>
          <p className="vx-mut vx-onb-card-apoio" style={{ maxWidth: 440, margin: "0 auto 16px" }}>O script, o funil de WhatsApp e os follow-ups estão prontos. Nada é usado antes da sua aprovação.</p>
          <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 52 }} onClick={aoRevisar}>Revisar estratégias</button>
        </> : falhou ? <>
          <div className={`vx-onb-anim vx-onb-anim-falhou`} aria-hidden="true" style={{ margin: "0 auto 18px" }}>
            <span /><span /><span />
          </div>
          <h2 className="vx-disp vx-onb-card-titulo">Não deu certo em "{atual.titulo.toLowerCase()}"</h2>
          <p className="vx-onb-erro" role="alert">{geracao.erro || "A geração falhou."}</p>
          <p className="vx-mut" style={{ fontSize: 14 }}>As fases que já terminaram estão guardadas. Tentar de novo continua daqui.</p>
          <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 52 }} onClick={aoTentar} disabled={tentando}>
            {tentando ? "Retomando…" : "Tentar novamente"}
          </button>
        </> : <>
          <div className={`vx-onb-anim vx-onb-anim-${atual.chave}`} aria-hidden="true" style={{ margin: "0 auto 18px" }}>
            <span /><span /><span />
          </div>
          <h2 className="vx-disp vx-onb-card-titulo">{atual.titulo}</h2>
          <p className="vx-mut vx-onb-card-apoio" style={{ maxWidth: 440, margin: "0 auto" }}>{atual.frase}</p>
          <p className="vx-onb-dica">Pode levar alguns minutos. Se sair desta tela, o trabalho continua e você volta para o mesmo ponto.</p>
        </>}
      </div>
    </section>
  );
}

function BlocoParte({ parte, conteudo, aprovado, aoSalvar, aoAprovar, ocupado }) {
  const id = useId();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(conteudo);
  const [erro, setErro] = useState("");
  useEffect(() => { if (!editando) setRascunho(conteudo); }, [conteudo, editando]);

  const salvar = async () => {
    if (!parteCompleta(parte.chave, rascunho)) return setErro("Preencha todos os campos desta parte.");
    setErro("");
    if (await aoSalvar(parte.chave, rascunho)) setEditando(false);
  };

  return (
    <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-t`} data-aprovado={aprovado ? "1" : "0"}>
      <div className="vx-row" style={{ flexWrap: "wrap", marginBottom: 12 }}>
        <h2 id={`${id}-t`} className="vx-disp" style={{ margin: 0 }}>{parte.label}</h2>
        {aprovado && <span className="vx-badge vx-onb-badge-ok"><Check size={12} aria-hidden="true" /> Aprovado</span>}
      </div>

      {parte.chave === "followups" ? (
        <ol className="vx-onb-followups">
          {(editando ? rascunho : conteudo || []).map((f, i) => (
            <li key={i}>
              {editando ? <>
                <label className="vx-label" htmlFor={`${id}-q${i}`}>Quando enviar</label>
                <input id={`${id}-q${i}`} className="vx-input" value={f.quando} onChange={(e) => setRascunho((r) => r.map((x, j) => (j === i ? { ...x, quando: e.target.value } : x)))} />
                <label className="vx-label" htmlFor={`${id}-m${i}`} style={{ marginTop: 8 }}>Mensagem</label>
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
          <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => { setEditando(false); setErro(""); }} disabled={ocupado}>Cancelar</button>
          <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={salvar} disabled={ocupado}>Salvar edição</button>
        </> : <>
          <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => setEditando(true)} disabled={ocupado}>
            <Pencil size={14} aria-hidden="true" /> Editar
          </button>
          <button type="button" className={`vx-btn ${aprovado ? "" : "vx-btn-primary"}`} style={{ minHeight: 44 }} aria-pressed={aprovado}
            onClick={() => aoAprovar(parte.chave, !aprovado)} disabled={ocupado}>
            {aprovado ? "Aprovado" : "Aprovar"}
          </button>
        </>}
      </div>
    </section>
  );
}

// 4b. Aprovação do dono.
function Aprovacao({ geracao, setGeracao, aoAtualizar, aoAvancar, aoVoltar }) {
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
    if (!r || r.error) { setErro(r?.error || "Não foi possível salvar. Tente de novo."); return null; }
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
          Montado com as estratégias do Academy da RYCS: {geracao.conteudo.fontes.join("; ")}.
        </div>
      )}
      {geracao.conteudo?.aviso && <div className="vx-onb-aviso" role="status">{geracao.conteudo.aviso}</div>}
      <div className="vx-onb-aviso">
        Os textos usam variáveis que a plataforma troca na hora de enviar: {VARIAVEIS_IA.map((v, i) => <span key={v}>{i ? ", " : ""}<code>{v}</code></span>)}. Mantenha as chaves ao editar.
      </div>
      {PARTES_IA.map((p) => (
        <BlocoParte key={p.chave} parte={p} conteudo={geracao.conteudo?.[p.chave]} aprovado={!!geracao.aprovacoes?.[p.chave]} ocupado={ocupado}
          aoSalvar={async (parte, conteudo) => !!(await chamar("/onboarding/ia/conteudo", { parte, conteudo }))}
          aoAprovar={(parte, aprovado) => chamar("/onboarding/ia/aprovar", { parte, aprovado })} />
      ))}

      {pedindo && (
        <section className="vx-onb-card vx-onb-secao">
          <label className="vx-label" htmlFor={`${id}-ajuste`}>O que você quer que a IA ajuste?</label>
          {geracao.conteudo?.motor === "interno" && (
            <div id={`${id}-ajuste-dica`} className="vx-onb-dica">
              O motor da RYCS ajusta a forma: mais curto, mais formal ou mais informal, com ou sem emojis, sem falar de preço ou de prazo. Para mudar o conteúdo, edite o texto direto.
            </div>
          )}
          <textarea id={`${id}-ajuste`} aria-describedby={geracao.conteudo?.motor === "interno" ? `${id}-ajuste-dica` : undefined} className="vx-input" rows={4} maxLength={2000} value={pedido} onChange={(e) => setPedido(e.target.value)}
            placeholder="Ex.: deixe a abertura mais curta e não fale de prazo de entrega." />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className="vx-btn" style={{ minHeight: 44 }} onClick={() => setPedindo(false)} disabled={ocupado}>Cancelar</button>
            <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={ocupado || pedido.trim().length < 5}
              onClick={async () => { if (await chamar("/onboarding/ia/ajustes", { pedido })) { setPedindo(false); setPedido(""); } }}>
              Enviar pedido à IA
            </button>
          </div>
        </section>
      )}

      <div aria-live="polite">{erro && <div className="vx-onb-erro" role="alert">{erro}</div>}</div>
      <div className="vx-onb-barra">
        <span role="status"><b>{aprovadas} de {PARTES_IA.length}</b> partes aprovadas</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="vx-btn" onClick={aoVoltar} disabled={ocupado}>Voltar</button>
          <button type="button" className="vx-btn" onClick={() => setPedindo(true)} disabled={ocupado || pedindo}>Pedir ajustes</button>
          <button type="button" className="vx-btn vx-btn-primary" onClick={aprovarTudo} disabled={ocupado}>Aprovar tudo e continuar</button>
        </div>
      </div>
    </div>
  );
}

export default function EtapaIA({ estado, aoAtualizar, aoAvancar, aoVoltar }) {
  const [dados, setDados] = useState(null); // { disponivel, geracao }
  const [erroCarga, setErroCarga] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [tentando, setTentando] = useState(false);
  const [erro, setErro] = useState("");
  const timer = useRef(null);

  const carregar = async () => {
    const r = await api("/onboarding/ia");
    if (!r || r.error) { setErroCarga(r?.error || "Não foi possível carregar."); return null; }
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
    if (!r || r.error) { setErro(r?.error || "Não foi possível continuar. Tente de novo."); return null; }
    return r;
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>Tentar novamente</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">Carregando…</div>;

  const g = dados.geracao;
  const cabecalho = (
    <>
      <div className="vx-onb-eyebrow">Passo 4 de 6</div>
      <h1 className="vx-disp vx-onb-titulo">{revisando ? "Revise e aprove as estratégias" : "A IA monta tudo sozinha"}</h1>
      <p className="vx-mut vx-onb-card-apoio">{revisando
        ? "Edite o que quiser e aprove cada parte. Nada vira ativo antes da sua aprovação."
        : "Com o perfil e os materiais, a IA cria o script de vendas, o funil de WhatsApp e os follow-ups."}</p>
    </>
  );
  const msgErro = erro && <div className="vx-onb-erro" role="alert">{erro}</div>;

  // Já aprovado (voltando a esta etapa): mostra e segue.
  if (estado.etapas.ia === "concluida") return (
    <div>
      {cabecalho}
      <div className="vx-onb-card vx-onb-estado">
        <p>{g?.status === "aprovada" ? "As estratégias desta empresa já foram aprovadas." : "Esta etapa foi concluída sem estratégias geradas."}</p>
        <div className="vx-onb-acoes" style={{ justifyContent: "center" }}>
          <button type="button" className="vx-btn" onClick={aoVoltar}>Voltar</button>
          <button type="button" className="vx-btn vx-btn-primary" onClick={() => aoAvancar(estado)}>Continuar</button>
        </div>
      </div>
    </div>
  );

  if (!g) return (
    <div>
      {cabecalho}
      <div className="vx-onb-card vx-onb-jarvis" style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: "36px 24px" }}>
        <div className="vx-jarvis-ring" style={{ width: 120, height: 120, margin: "0 auto 18px" }}>
          <ThinkingOrb state="idle" size={100} decorativo />
        </div>
        <h2 className="vx-disp vx-onb-card-titulo">Jarvas, sua IA de vendas</h2>
        <p className="vx-mut vx-onb-card-apoio" style={{ maxWidth: 420, margin: "0 auto 20px" }}>
          O Jarvas vai criar o script de vendas, funil de WhatsApp e follow-ups com base no perfil da sua empresa.
        </p>
        {msgErro}
        <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 52, gap: 8 }}
          onClick={async () => { const r = await acao("/onboarding/ia/gerar"); if (r) setGeracao(r.geracao); }}>
          <Sparkles size={16} /> Gerar estratégias com o Jarvas
        </button>
        <p className="vx-onb-dica" style={{ marginTop: 14 }}>
          <Mic size={13} style={{ verticalAlign: -2 }} /> O Jarvas usa inteligência artificial com voz — depois de gerar, você pode conversar com ele nas campanhas.
        </p>
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
        <button type="button" className="vx-btn" onClick={aoVoltar}>Voltar</button>
        <span />
      </div>
    </div>
  );
}
