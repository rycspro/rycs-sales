// Área do colaborador interno (docs/colaboradores/SPEC.md).
// Ordem obrigatória: contrato assinado → termo de transparência → área.
// O colaborador vê só os próprios dados e sabe exatamente o que é medido.
import { useCallback, useEffect, useState } from "react";
import { api, API_URL } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Vazio } from "../ui.jsx";
import { ALVO, PainelResumo, ListaDias, TabelaExtrato } from "./comum.jsx";
import { dataBRFormatada, formatarCents, TIPOS_AUSENCIA, TIPOS_PROVA, DIAS_SEMANA } from "../../../shared/colaboradores.js";

const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const abrir = (caminho) => window.open(`${API_URL}/api${caminho}`, "_blank", "noopener");
const STATUS = {
  aberta: { txt: "A fazer", cls: "vx-badge-muted" }, enviada: { txt: "Enviada, aguardando", cls: "vx-badge-indigo" },
  aprovada: { txt: "Aprovada", cls: "vx-badge-brand" }, recusada: { txt: "Recusada", cls: "vx-badge-red" }, expirada: { txt: "Prazo encerrado", cls: "vx-badge-muted" },
};

export default function AreaColaborador({ aviso }) {
  const [eu, setEu] = useState(null);
  const carregar = useCallback(async () => {
    const r = await api("/colaborador/eu");
    setEu(r || { colaborador: null });
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (!eu) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  if (!eu.colaborador) return <Vazio titulo="Área de colaborador" texto="Sua conta não está marcada como colaborador interno da RYCS." />;

  const { acesso, contratos } = eu;
  const contratoPendente = contratos.find((c) => c.tipo === "contrato" && c.status === "pendente");
  const aditivoPendente = contratos.find((c) => c.tipo === "aditivo" && c.status === "pendente");

  if (!acesso.contratoAssinado && !acesso.encerrado) {
    return contratoPendente
      ? <Assinatura doc={contratoPendente} provedor={eu.assinatura} aviso={aviso} pronto={carregar} titulo="Seu contrato" intro="Antes de começar, leia e assine o seu contrato. Enquanto ele não estiver assinado, as tarefas ficam fechadas." />
      : <Vazio titulo="Contrato em preparação" texto="O seu contrato ainda está sendo preparado. Quando ficar pronto, ele aparece aqui para você ler e assinar, e você recebe um e-mail." />;
  }
  if (!acesso.termoAceito && !acesso.encerrado) return <Termo eu={eu} aviso={aviso} pronto={carregar} />;
  return <Area eu={eu} aviso={aviso} recarregar={carregar} aditivo={aditivoPendente} />;
}

// ───────────────────────────── Contrato e termo ─────────────────────────────

function Assinatura({ doc, provedor, aviso, pronto, titulo, intro }) {
  const [abriuZap, setAbriuZap] = useState(false);
  const assinarZapsign = async () => {
    // Abre a aba antes da chamada para o navegador não bloquear o pop-up.
    const janela = window.open("", "_blank");
    if (janela) janela.opener = null;
    const r = await api(`/colaborador/contratos/${doc.id}/zapsign`, {});
    if (r?.error) { janela?.close(); return aviso(r.error); }
    if (janela) janela.location.href = r.signUrl; else window.location.href = r.signUrl;
    setAbriuZap(true);
  };
  const conferir = async () => {
    const r = await api(`/colaborador/contratos/${doc.id}/conferir`, {});
    if (r?.error) return aviso(r.error);
    if (r.status === "assinado") { aviso("Documento assinado."); pronto(); } else aviso("A assinatura ainda não chegou. Se você já assinou, espere um minuto e tente de novo.");
  };
  const [texto, setTexto] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState(null);
  const [lido, setLido] = useState(false);
  useEffect(() => { api(`/colaborador/contratos/${doc.id}`).then((r) => setTexto(r?.texto || "")); }, [doc.id]);
  const pedirCodigo = async () => {
    const r = await api(`/colaborador/contratos/${doc.id}/codigo`, {});
    if (r?.error) return aviso(r.error);
    setEnviado(r.enviadoPara);
    aviso(`Código enviado para ${r.enviadoPara}.`);
  };
  const assinar = async (e) => {
    e.preventDefault();
    const r = await api(`/colaborador/contratos/${doc.id}/assinar`, { codigo });
    if (r?.error) return aviso(r.error);
    aviso("Documento assinado.");
    pronto();
  };
  return (
    <div className="vx-fade" style={{ maxWidth: 760 }}>
      <h2 className="vx-disp" style={{ fontSize: 20, margin: "0 0 6px" }}>{titulo}</h2>
      <p className="vx-mut" style={{ fontSize: 13.5, margin: "0 0 12px" }}>{intro}</p>
      <div className="vx-card" style={{ padding: 18, maxHeight: "55vh", overflowY: "auto", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }} tabIndex={0} aria-label="Texto do documento">
        {texto == null ? <div className="vx-spinner" /> : <><b>{doc.titulo}</b>{"\n\n"}{texto}</>}
      </div>
      <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, marginTop: 8 }} onClick={() => abrir(`/colaborador/contratos/${doc.id}/documento`)}>Abrir em PDF</button>
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44, margin: "8px 0" }}>
        <input type="checkbox" checked={lido} onChange={(e) => setLido(e.target.checked)} /> Li o documento inteiro e concordo com ele
      </label>
      {provedor === "zapsign" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="vx-btn vx-btn-primary" style={ALVO} disabled={!lido} onClick={assinarZapsign}>Assinar pela ZapSign</button>
          {abriuZap && <button className="vx-btn" style={ALVO} onClick={conferir}>Já assinei</button>}
        </div>
      ) : !enviado ? (
        <button className="vx-btn vx-btn-primary" style={ALVO} disabled={!lido} onClick={pedirCodigo}>Receber código de assinatura por e-mail</button>
      ) : (
        <form onSubmit={assinar} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ width: 180 }}>
            <label className="vx-label" htmlFor="ass-cod">Código de 6 dígitos</label>
            <input id="ass-cod" className="vx-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} style={ALVO} />
          </div>
          <button className="vx-btn vx-btn-primary" style={ALVO} disabled={codigo.length !== 6 || !lido}>Assinar</button>
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={pedirCodigo}>Enviar outro código</button>
        </form>
      )}
      <p className="vx-mut" style={{ fontSize: 12, marginTop: 10 }}>{provedor === "zapsign" ? "A assinatura é feita na ZapSign, que gera o PDF assinado; ele fica guardado aqui nos seus documentos." : "Ficam registrados a data e a hora, o IP, a versão do modelo e uma impressão digital (SHA-256) do texto, que prova que ele não foi alterado depois."}</p>
    </div>
  );
}

function Termo({ eu, aviso, pronto }) {
  const [ok, setOk] = useState(false);
  const aceitar = async () => {
    const r = await api("/colaborador/termo", {});
    if (r?.error) return aviso(r.error);
    pronto();
  };
  return (
    <div className="vx-fade" style={{ maxWidth: 760 }}>
      <h2 className="vx-disp" style={{ fontSize: 20, margin: "0 0 6px" }}>O que a plataforma mede</h2>
      <p className="vx-mut" style={{ fontSize: 13.5, margin: "0 0 14px" }}>Antes de usar a sua área, leia como funciona o acompanhamento. Sem surpresa e sem nada escondido.</p>
      {eu.termo.secoes.map((s) => (
        <div key={s.titulo} className="vx-card" style={{ padding: 14, marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>{s.titulo}</b>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.55 }}>{s.texto}</p>
        </div>
      ))}
      <div className="vx-card" style={{ padding: 14, marginBottom: 8, fontSize: 13.5 }}>
        <b>Como a sua nota é calculada</b>
        <p style={{ margin: "4px 0 0" }}>{eu.regra.formula}</p>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Li e estou ciente do que é medido (versão {eu.termo.versao})
      </label>
      <button className="vx-btn vx-btn-primary" style={ALVO} disabled={!ok} onClick={aceitar}>Continuar</button>
    </div>
  );
}

// ───────────────────────────── Área ─────────────────────────────

function Area({ eu, aviso, recarregar, aditivo }) {
  const encerrado = eu.acesso.encerrado;
  const [aba, setAba] = useState(encerrado ? "documentos" : "tarefas");
  const [assinando, setAssinando] = useState(false);
  const lembretes = (eu.avisos || []).filter((a) => !a.lidoEm).slice(0, 3);
  const marcarLido = async (a) => { await api(`/colaborador/avisos/${a.id}/lido`, {}); recarregar(); };

  if (assinando && aditivo) return <Assinatura doc={aditivo} provedor={eu.assinatura} aviso={aviso} pronto={() => { setAssinando(false); recarregar(); }} titulo="Aditivo ao contrato" intro="Houve mudança de valores, dias ou horário. Leia o aditivo e aceite para registrar a mudança." />;

  const abas = encerrado
    ? [["documentos", "Documentos"], ["painel", "Meu painel"], ["extrato", "Extrato"]]
    : [["tarefas", "Tarefas"], ["painel", "Meu painel"], ["extrato", "Extrato"], ["ausencias", "Ausências"], ["documentos", "Documentos"]];
  return (
    <div className="vx-fade">
      <h2 className="vx-disp" style={{ fontSize: 20, margin: "0 0 4px" }}>Colaborador RYCS</h2>
      <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 12px" }}>{eu.colaborador.funcao || "Colaborador"} · desde {dataBRFormatada(eu.colaborador.dataInicio)}{encerrado ? ` · vínculo encerrado em ${dataBRFormatada(eu.colaborador.dataSaida)}` : ""}</p>
      {aditivo && !encerrado && (
        <div className="vx-notice vx-notice-amber" role="status" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span>Há um aditivo ao seu contrato para você ler e aceitar.</span>
          <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => setAssinando(true)}>Ler aditivo</button>
        </div>
      )}
      {lembretes.map((a) => (
        <div key={a.id} className="vx-notice" role="status" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span><b>{a.titulo}.</b> {a.texto}</span>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={() => marcarLido(a)}>Entendi</button>
        </div>
      ))}
      <div className="vx-seg" role="tablist" aria-label="Seções da área do colaborador" style={{ marginBottom: 16, maxWidth: "100%" }}>
        {abas.map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={aba === k} data-on={aba === k ? "1" : "0"} onClick={() => setAba(k)} style={ALVO}>{t}</button>)}
      </div>
      {aba === "tarefas" && <Tarefas eu={eu} aviso={aviso} />}
      {aba === "painel" && <Painel eu={eu} aviso={aviso} encerrado={encerrado} />}
      {aba === "extrato" && <Extrato />}
      {aba === "ausencias" && <Ausencias aviso={aviso} />}
      {aba === "documentos" && <Documentos eu={eu} />}
    </div>
  );
}

function Tarefas({ eu, aviso }) {
  const [lista, setLista] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [registros, setRegistros] = useState([]);
  const carregar = useCallback(async () => {
    const r = await api("/colaborador/tarefas");
    if (r?.error) return aviso(r.error);
    setLista(r.ocorrencias);
    if (eu.regra.registroAtividade) api("/colaborador/registros").then((x) => setRegistros(x?.registros || []));
  }, [aviso, eu.regra.registroAtividade]);
  useEffect(() => { carregar(); }, [carregar]);
  const pegar = async (o) => {
    const r = await api(`/colaborador/tarefas/${o.id}/pegar`, {});
    if (r?.error) return aviso(r.error);
    aviso("Tarefa reservada para você.");
    carregar();
  };
  const registrar = async (tipo) => {
    const r = await api("/colaborador/registro", { tipo });
    if (r?.error) return aviso(r.error);
    aviso(tipo === "inicio" ? "Início do dia registrado." : "Fim do dia registrado.");
    carregar();
  };
  if (!lista) return <div className="vx-spinner" />;
  const minhas = lista.filter((o) => o.colaboradorId === eu.colaborador.id);
  const fazer = minhas.filter((o) => o.status === "aberta" || o.status === "recusada");
  const fila = lista.filter((o) => !o.colaboradorId);
  const feitas = minhas.filter((o) => o.status === "enviada" || o.status === "aprovada").sort((a, b) => b.enviadoEm - a.enviadoEm).slice(0, 20);
  const regHoje = registros.filter((r) => r.data === hoje());
  return (
    <>
      {eu.regra.registroAtividade && (
        <div className="vx-card" style={{ padding: 14, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, flex: 1 }}>Registro de atividade de hoje (não é ponto; sem localização e sem foto).</span>
          <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} disabled={regHoje.some((r) => r.tipo === "inicio")} onClick={() => registrar("inicio")}>Comecei o dia</button>
          <button className="vx-btn vx-btn-sm" style={ALVO} disabled={!regHoje.some((r) => r.tipo === "inicio") || regHoje.some((r) => r.tipo === "fim")} onClick={() => registrar("fim")}>Encerrei o dia</button>
        </div>
      )}
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Para fazer ({fazer.length})</h3>
      {!fazer.length ? <p className="vx-mut" style={{ fontSize: 13 }}>Nada pendente agora.</p> : (
        <div className="vx-grid" style={{ marginBottom: 16 }}>{fazer.map((o) => (
          <div key={o.id} className="vx-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>{o.titulo}</b>
              <span className={`vx-badge ${STATUS[o.status].cls}`}>{STATUS[o.status].txt}</span>
            </div>
            {o.descricao && <p className="vx-mut" style={{ fontSize: 13, margin: "4px 0" }}>{o.descricao}</p>}
            <div className="vx-mut" style={{ fontSize: 12 }}>Prazo: {new Date(o.prazoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} · prova: {TIPOS_PROVA[o.tipoProva]}{o.valorTarefa ? ` · ${formatarCents(o.valorTarefa)}` : ""}</div>
            {o.status === "recusada" && o.motivo && <div className="vx-notice vx-notice-amber" style={{ marginTop: 8 }}>Motivo da recusa: {o.motivo}. Corrija e envie de novo até o prazo, ou conteste se discordar.</div>}
            {o.status === "recusada" && <ContestarProva o={o} aviso={aviso} />}
            {aberta === o.id
              ? <EnvioProva o={o} aviso={aviso} fechar={() => setAberta(null)} pronto={() => { setAberta(null); carregar(); }} />
              : <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ ...ALVO, marginTop: 8 }} onClick={() => setAberta(o.id)}>Enviar prova</button>}
          </div>
        ))}</div>
      )}
      {fila.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 15 }}>Disponíveis para pegar</h3>
          <p className="vx-mut" style={{ fontSize: 12.5 }}>Quem pegar primeiro fica com a tarefa, para duas pessoas não fazerem a mesma coisa.</p>
          <div className="vx-grid" style={{ marginBottom: 16 }}>{fila.map((o) => (
            <div key={o.id} className="vx-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 13 }}><b>{o.titulo}</b><div className="vx-mut" style={{ fontSize: 12 }}>{o.descricao}</div></div>
              <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => pegar(o)}>Pegar tarefa</button>
            </div>
          ))}</div>
        </>
      )}
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Enviadas recentemente</h3>
      {!feitas.length ? <p className="vx-mut" style={{ fontSize: 13 }}>Nenhum envio ainda.</p> : (
        <div className="vx-grid">{feitas.map((o) => (
          <div key={o.id} className="vx-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
            <span><b>{o.titulo}</b> · {dataCurta(o.enviadoEm)}</span>
            <span className={`vx-badge ${STATUS[o.status].cls}`}>{STATUS[o.status].txt}</span>
          </div>
        ))}</div>
      )}
    </>
  );
}

function ContestarProva({ o, aviso }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const enviar = async (e) => {
    e.preventDefault();
    const r = await api("/colaborador/contestacoes", { alvoTipo: "ocorrencia", alvoId: o.id, texto });
    if (r?.error) return aviso(r.error);
    aviso("Contestação enviada ao administrador.");
    setAberto(false); setTexto("");
  };
  if (!aberto) return <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, marginTop: 6 }} onClick={() => setAberto(true)}>Contestar recusa</button>;
  return (
    <form onSubmit={enviar} style={{ marginTop: 8 }}>
      <label className="vx-label" htmlFor={`cp-${o.id}`}>Por que a recusa não está certa?</label>
      <textarea id={`cp-${o.id}`} className="vx-input" rows={2} required value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button className="vx-btn vx-btn-sm" style={ALVO}>Enviar contestação</button>
        <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

function lerArquivo(arquivo) {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = erro;
    r.readAsDataURL(arquivo);
  });
}

function EnvioProva({ o, aviso, fechar, pronto }) {
  const [link, setLink] = useState("");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    let arq = null;
    if (o.tipoProva === "arquivo" && arquivo) {
      if (arquivo.size > 8 * 1024 * 1024) { setEnviando(false); return aviso("Arquivo maior que 8 MB."); }
      arq = { nome: arquivo.name, mimetype: arquivo.type, base64: await lerArquivo(arquivo) };
    }
    const r = await api(`/colaborador/tarefas/${o.id}/prova`, { link, texto, arquivo: arq });
    setEnviando(false);
    if (r?.error) return aviso(r.error);
    aviso(r.ocorrencia?.status === "aprovada" ? "Prova enviada e aprovada." : "Prova enviada.");
    pronto();
  };
  return (
    <form onSubmit={enviar} style={{ marginTop: 10 }}>
      {o.tipoProva === "link" && (
        <div style={{ marginBottom: 10 }}>
          <label className="vx-label" htmlFor={`pl-${o.id}`}>Link</label>
          <input id={`pl-${o.id}`} className="vx-input" type="url" required placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} style={ALVO} />
        </div>
      )}
      {o.tipoProva === "arquivo" && (
        <div style={{ marginBottom: 10 }}>
          <label className="vx-label" htmlFor={`pa-${o.id}`}>Arquivo (PDF ou imagem de documento ou de tela, até 8 MB)</label>
          <input id={`pa-${o.id}`} type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setArquivo(e.target.files?.[0] || null)} style={ALVO} />
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>Não envie foto de pessoas, nem selfie.</div>
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <label className="vx-label" htmlFor={`pt-${o.id}`}>{o.tipoProva === "texto" ? "O que você fez" : "Comentário (opcional)"}</label>
        <textarea id={`pt-${o.id}`} className="vx-input" rows={3} required={o.tipoProva === "texto"} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button>
        <button type="button" className="vx-btn vx-btn-sm" style={ALVO} onClick={fechar}>Cancelar</button>
      </div>
    </form>
  );
}

function Painel({ eu, aviso, encerrado }) {
  const [p, setP] = useState(null);
  const [contestando, setContestando] = useState(null);
  const [texto, setTexto] = useState("");
  const carregar = useCallback(async () => {
    const r = await api("/colaborador/painel");
    if (r?.error) return aviso(r.error);
    setP(r);
  }, [aviso]);
  useEffect(() => { carregar(); }, [carregar]);
  const enviar = async (e) => {
    e.preventDefault();
    const r = await api("/colaborador/contestacoes", { alvoTipo: "dia", alvoId: contestando, texto });
    if (r?.error) return aviso(r.error);
    aviso("Contestação enviada ao administrador.");
    setContestando(null); setTexto("");
  };
  if (!p) return <div className="vx-spinner" />;
  const r = eu.regra;
  return (
    <>
      <PainelResumo p={p} formula={r.formula} />
      <div className="vx-card" style={{ padding: 14, marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
        <b>Sua regra</b><br />
        Dias previstos: {r.diasPrevistos.slice().sort().map((d) => DIAS_SEMANA[d]).join(", ")} · horário {r.horario.inicio} às {r.horario.fim}<br />
        {r.medirPresenca ? `Dia trabalhado: pelo menos ${r.diaTrabalhado.minimo} ${r.diaTrabalhado.criterio === "aprovada" ? "tarefa aprovada" : r.diaTrabalhado.criterio === "registro" ? "registro de início" : "tarefa enviada com prova"}.` : "Sua presença não é medida: o painel acompanha as suas entregas."}<br />
        {r.meta.status === "calibrando" ? `Meta: em calibração desde ${dataBRFormatada(r.meta.calibracaoDesde)}. As primeiras 4 semanas só medem a sua média; depois a meta é definida com base nela.` : `Meta: ${r.meta.quantidade} por ${r.meta.periodo === "semana" ? "semana" : "dia"}.`}
      </div>
      {contestando && (
        <form onSubmit={enviar} className="vx-card" style={{ padding: 14, marginBottom: 14 }}>
          <label className="vx-label" htmlFor="ct-txt">O que aconteceu em {dataBRFormatada(contestando)}?</label>
          <textarea id="ct-txt" className="vx-input" rows={3} required value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Enviar</button>
            <button type="button" className="vx-btn vx-btn-sm" style={ALVO} onClick={() => setContestando(null)}>Cancelar</button>
          </div>
        </form>
      )}
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Seus dias neste mês</h3>
      <ListaDias dias={p.dias} onContestar={encerrado ? null : setContestando} />
    </>
  );
}

function Extrato() {
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [ex, setEx] = useState(null);
  useEffect(() => { setEx(null); api(`/colaborador/extrato?mes=${mes}`).then(setEx); }, [mes]);
  return (
    <>
      <div style={{ maxWidth: 200, marginBottom: 12 }}>
        <label className="vx-label" htmlFor="ce-mes">Mês</label>
        <input id="ce-mes" type="month" className="vx-input" value={mes} onChange={(e) => setMes(e.target.value)} style={ALVO} />
      </div>
      {!ex ? <div className="vx-spinner" /> : ex.error ? <p className="vx-mut">{ex.error}</p> : (
        <>
          <TabelaExtrato ex={ex} />
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 10 }}>
            {ex.pagamento === "folha" ? "Você é empregado: o fixo e o variável são pagos na folha, pelo contador." : ex.pagamento === "saque" ? "No fechamento do mês, o variável aprovado vai para o seu saldo e você saca por Pix na Carteira." : "O variável é acertado no fechamento do mês."}
          </p>
        </>
      )}
    </>
  );
}

function Ausencias({ aviso }) {
  const [lista, setLista] = useState(null);
  const [f, setF] = useState({ dataInicio: hoje(), dataFim: hoje(), tipo: "folga", observacao: "" });
  const carregar = useCallback(() => api("/colaborador/ausencias").then((r) => setLista(r?.ausencias || [])), []);
  useEffect(() => { carregar(); }, [carregar]);
  const pedir = async (e) => {
    e.preventDefault();
    const r = await api("/colaborador/ausencias", f);
    if (r?.error) return aviso(r.error);
    aviso("Pedido enviado ao administrador.");
    carregar();
  };
  return (
    <>
      <form onSubmit={pedir} className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Avisar uma ausência</h3>
        <p className="vx-mut" style={{ fontSize: 12.5 }}>Férias, folga combinada, atestado ou licença. Depois de aprovada, o dia não conta como falta. Atestado: não envie o documento aqui, só registre; o documento vai para o contador.</p>
        <div className="vx-g4" style={{ gap: 12 }}>
          <div><label className="vx-label" htmlFor="ca-ini">De</label><input id="ca-ini" type="date" className="vx-input" value={f.dataInicio} onChange={(e) => setF({ ...f, dataInicio: e.target.value })} style={ALVO} /></div>
          <div><label className="vx-label" htmlFor="ca-fim">Até</label><input id="ca-fim" type="date" className="vx-input" value={f.dataFim} onChange={(e) => setF({ ...f, dataFim: e.target.value })} style={ALVO} /></div>
          <div><label className="vx-label" htmlFor="ca-tipo">Tipo</label>
            <select id="ca-tipo" className="vx-input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} style={ALVO}>{Object.entries(TIPOS_AUSENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="vx-label" htmlFor="ca-obs">Observação</label><input id="ca-obs" className="vx-input" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} style={ALVO} /></div>
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ ...ALVO, marginTop: 10 }}>Enviar pedido</button>
      </form>
      {!lista ? <div className="vx-spinner" /> : lista.map((a) => (
        <div key={a.id} className="vx-card" style={{ padding: 12, marginBottom: 8, fontSize: 13 }}>
          <b>{TIPOS_AUSENCIA[a.tipo]}</b> · {dataBRFormatada(a.dataInicio)} a {dataBRFormatada(a.dataFim)} · {a.status === "pedida" ? "aguardando" : a.status === "aprovada" ? "aprovada" : "não aprovada"}
        </div>
      ))}
    </>
  );
}

function Documentos({ eu }) {
  const [rel, setRel] = useState([]);
  const [cts, setCts] = useState([]);
  useEffect(() => {
    api("/colaborador/relatorios").then((r) => setRel(r?.relatorios || []));
    api("/colaborador/contestacoes").then((r) => setCts(r?.contestacoes || []));
  }, []);
  return (
    <>
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Contrato e aditivos</h3>
      <div className="vx-grid" style={{ marginBottom: 16 }}>{eu.contratos.filter((c) => c.status !== "cancelado").map((c) => (
        <div key={c.id} className="vx-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
          <span><b>{c.tipo === "aditivo" ? "Aditivo" : "Contrato"}</b> · {c.status === "assinado" ? `assinado em ${dataCurta(c.assinadoEm)}` : "aguardando assinatura"}</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.temPdf ? <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => abrir(`/colaborador/contratos/${c.id}/pdf`)}>PDF assinado</button> : null}
            <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => abrir(`/colaborador/contratos/${c.id}/documento`)}>Texto do contrato</button>
          </span>
        </div>
      ))}</div>
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Relatórios</h3>
      {!rel.length ? <p className="vx-mut" style={{ fontSize: 13 }}>Os relatórios semanais e mensais aparecem aqui. São os mesmos que o administrador recebe.</p> : rel.map((r) => (
        <div key={r.id} className="vx-card" style={{ padding: 12, marginBottom: 8, fontSize: 13 }}>
          <b>{r.periodo === "semana" ? "Semana" : "Mês"} {dataBRFormatada(r.inicio)} a {dataBRFormatada(r.fim)}</b>
          <div className="vx-mut" style={{ marginTop: 4 }}>{r.resumo}</div>
        </div>
      ))}
      {cts.length > 0 && (
        <>
          <h3 className="vx-disp" style={{ fontSize: 15 }}>Suas contestações</h3>
          {cts.map((c) => (
            <div key={c.id} className="vx-card" style={{ padding: 12, marginBottom: 8, fontSize: 13 }}>
              <b>{c.alvoTipo === "dia" ? `Dia ${dataBRFormatada(c.alvoId)}` : "Prova"}</b>: {c.texto}
              <div className="vx-mut" style={{ marginTop: 4 }}>{c.status === "aberta" ? "Aguardando resposta" : `Resposta: ${c.resposta}`}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
