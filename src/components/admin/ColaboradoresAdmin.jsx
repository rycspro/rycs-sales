// Admin — Colaboradores internos (docs/colaboradores/SPEC.md).
// Visão de todos lado a lado, ficha de cada pessoa, tarefas e revisão,
// fechamento do mês para o contador e configuração (modelos, feriados,
// natureza dos valores). A IA só resume e alerta; toda decisão é do admin.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiPatch, apiPut, apiDelete, API_URL } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Vazio } from "../ui.jsx";
import { ALVO, SITUACAO, TENDENCIA, Num, PainelResumo, ListaDias, TabelaExtrato, DiasPrevistos } from "../colaborador/comum.jsx";
import Organograma, { DadosEmpresa } from "../colaborador/Organograma.jsx";
import {
  DIAS_SEMANA, formatarCents, dataBRFormatada, TIPOS_LANCAMENTO, NATUREZAS, VINCULOS, REGIMES, TIPOS_AUSENCIA, TIPOS_PROVA,
  CAMPOS_CONTRATO, reducoes as listarReducoes,
} from "../../../shared/colaboradores.js";

const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const mesAtual = () => hoje().slice(0, 7);
const reaisParaCents = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const centsParaReais = (c) => (Number(c || 0) / 100).toFixed(2).replace(".", ",");
const abrir = (caminho) => window.open(`${API_URL}/api${caminho}`, "_blank", "noopener");


function Campo({ id, label, children, ajuda }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="vx-label" htmlFor={id}>{label}</label>
      {children}
      {ajuda && <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>{ajuda}</div>}
    </div>
  );
}

function Abas({ itens, valor, onChange, rotulo }) {
  return (
    <div className="vx-seg" role="tablist" aria-label={rotulo} style={{ marginBottom: 16, maxWidth: "100%" }}>
      {itens.map(([k, txt]) => (
        <button key={k} type="button" role="tab" aria-selected={valor === k} data-on={valor === k ? "1" : "0"} onClick={() => onChange(k)} style={ALVO}>{txt}</button>
      ))}
    </div>
  );
}

export default function ColaboradoresAdmin({ aviso }) {
  const [aba, setAba] = useState("equipe");
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(null);
  const carregar = useCallback(async () => {
    const r = await api("/admin/colaboradores");
    if (r?.error) return aviso(r.error);
    setDados(r);
  }, [aviso]);
  useEffect(() => { carregar(); }, [carregar]);

  if (aberto) return <Ficha id={aberto} aviso={aviso} voltar={() => { setAberto(null); carregar(); }} />;

  return (
    <div className="vx-fade">
      <h2 className="vx-disp" style={{ fontSize: 20, margin: "0 0 6px" }}>Colaboradores internos</h2>
      <p className="vx-mut" style={{ margin: "0 0 14px", fontSize: 13 }}>Quem trabalha para a própria RYCS. A IA acompanha e alerta; quem decide pagamento e vínculo é você.</p>
      <Abas rotulo="Seções de colaboradores" valor={aba} onChange={setAba} itens={[["equipe", "Equipe"], ["tarefas", `Tarefas${dados?.fila ? ` (${dados.fila})` : ""}`], ["fechamento", "Fechamento"], ["config", "Configuração"]]} />
      {aba === "equipe" && <><Organograma aviso={aviso} abrirPessoa={setAberto} />{dados && <AvisosAdmin avisos={dados.avisos} aviso={aviso} recarregar={carregar} />}</>}
      {aba === "tarefas" && <Tarefas aviso={aviso} recarregar={carregar} />}
      {aba === "fechamento" && <Fechamento aviso={aviso} />}
      {aba === "config" && <Config aviso={aviso} />}
    </div>
  );
}

function AvisosAdmin({ avisos = [], aviso, recarregar }) {
  const [metas, setMetas] = useState({});
  if (!avisos.length) return null;
  const resolver = async (a) => {
    const r = await api(`/admin/colaboradores-avisos/${a.id}/resolver`, {});
    if (r?.error) return aviso(r.error);
    recarregar();
  };
  const meta = async (a, acao) => {
    const quantidade = metas[a.id] ?? a.dados?.sugerida;
    const r = await api(`/admin/colaboradores/${a.colaboradorId}/meta`, { acao, quantidade, avisoId: a.id });
    if (r?.error) return aviso(r.error);
    aviso(acao === "aprovar" ? "Meta aprovada." : "Nova calibração iniciada.");
    recarregar();
  };
  return (
    <section style={{ marginTop: 24 }} aria-labelledby="col-avisos">
      <h3 id="col-avisos" className="vx-disp" style={{ fontSize: 15, margin: "0 0 10px" }}>Alertas e pedidos</h3>
      <div className="vx-grid">{avisos.map((a) => (
        <div key={a.id} className="vx-card" style={{ padding: 14 }}>
          <b style={{ fontSize: 13.5 }}>{a.titulo}</b>
          <div className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 8px" }}>{a.texto} · {dataCurta(a.criadoEm)}</div>
          {a.tipo === "meta_sugerida" ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ width: 140 }}>
                <label className="vx-label" htmlFor={`meta-${a.id}`}>Meta por {a.dados?.periodo === "semana" ? "semana" : "dia"}</label>
                <input id={`meta-${a.id}`} className="vx-input" inputMode="decimal" value={metas[a.id] ?? a.dados?.sugerida ?? ""} onChange={(e) => setMetas((m) => ({ ...m, [a.id]: e.target.value }))} style={ALVO} />
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={() => meta(a, "aprovar")}>Aprovar meta</button>
              <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => meta(a, "recalibrar")}>Medir mais 4 semanas</button>
            </div>
          ) : (
            <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => resolver(a)}>Marcar como visto</button>
          )}
        </div>
      ))}</div>
    </section>
  );
}

// ───────────────────────────── Ficha ─────────────────────────────

function Ficha({ id, aviso, voltar }) {
  const [aba, setAba] = useState("painel");
  const [mes, setMes] = useState(mesAtual());
  const [d, setD] = useState(null);
  const carregar = useCallback(async () => {
    const r = await api(`/admin/colaboradores/${id}?mes=${mes}`);
    if (r?.error) return aviso(r.error);
    setD(r);
  }, [id, mes, aviso]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!d) return <div className="vx-spinner" />;
  const c = d.colaborador;
  return (
    <div className="vx-fade">
      <button className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={voltar}>← Voltar</button>
      <div style={{ margin: "10px 0 14px" }}>
        <h2 className="vx-disp" style={{ fontSize: 20, margin: 0 }}>{c.nome}</h2>
        <div className="vx-mut" style={{ fontSize: 13 }}>{c.funcao || "Sem função"} · {VINCULOS[c.vinculo]}{c.regime ? ` · ${REGIMES[c.regime]}` : ""} · desde {dataBRFormatada(c.dataInicio)} · {c.email}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <span className={`vx-badge ${d.acesso.contratoAssinado ? "vx-badge-brand" : "vx-badge-amber"}`}>{d.acesso.contratoAssinado ? "Contrato assinado" : "Contrato pendente"}</span>
          <span className={`vx-badge ${d.acesso.termoAceito ? "vx-badge-brand" : "vx-badge-amber"}`}>{d.acesso.termoAceito ? "Termo aceito" : "Termo pendente"}</span>
          {c.status === "encerrado" && <span className="vx-badge vx-badge-muted">Vínculo encerrado em {dataBRFormatada(c.dataSaida)}</span>}
        </div>
      </div>
      <Abas rotulo="Ficha do colaborador" valor={aba} onChange={setAba} itens={[["painel", "Painel"], ["regra", "Regra e cadastro"], ["contrato", "Contrato"], ["ausencias", "Ausências"], ["extrato", "Extrato"], ["historico", "Histórico"]]} />
      {aba === "painel" && <PainelAdmin d={d} aviso={aviso} recarregar={carregar} />}
      {aba === "regra" && <RegraForm d={d} aviso={aviso} recarregar={carregar} />}
      {aba === "contrato" && <ContratosAdmin d={d} aviso={aviso} recarregar={carregar} />}
      {aba === "ausencias" && <AusenciasAdmin d={d} aviso={aviso} recarregar={carregar} />}
      {aba === "extrato" && <ExtratoAdmin d={d} mes={mes} setMes={setMes} aviso={aviso} recarregar={carregar} />}
      {aba === "historico" && <Historico d={d} />}
    </div>
  );
}

function PainelAdmin({ d, aviso, recarregar }) {
  const [respostas, setRespostas] = useState({});
  const responder = async (ct) => {
    const r = await api(`/admin/colaboradores-contestacoes/${ct.id}/responder`, { resposta: respostas[ct.id] });
    if (r?.error) return aviso(r.error);
    aviso("Resposta enviada.");
    recarregar();
  };
  const abertas = d.contestacoes.filter((x) => x.status === "aberta");
  return (
    <>
      <PainelResumo p={d.painel} formula={d.formula} />
      {d.regra.meta.status === "calibrando" && <p className="vx-mut" style={{ fontSize: 12.5 }}>Meta em calibração desde {dataBRFormatada(d.regra.meta.calibracaoDesde)}: as primeiras 4 semanas só medem. Depois disso aparece aqui uma meta sugerida para você aprovar.</p>}
      {abertas.length > 0 && (
        <section style={{ marginBottom: 16 }} aria-labelledby="ct-titulo">
          <h3 id="ct-titulo" className="vx-disp" style={{ fontSize: 15 }}>Contestações abertas</h3>
          {abertas.map((ct) => (
            <div key={ct.id} className="vx-card" style={{ padding: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 13 }}><b>{ct.alvoTipo === "dia" ? `Dia ${dataBRFormatada(ct.alvoId)}` : "Prova recusada"}</b>: {ct.texto}</div>
              <label className="vx-label" htmlFor={`resp-${ct.id}`} style={{ marginTop: 8 }}>Sua resposta</label>
              <textarea id={`resp-${ct.id}`} className="vx-input" rows={2} value={respostas[ct.id] || ""} onChange={(e) => setRespostas((r) => ({ ...r, [ct.id]: e.target.value }))} />
              <p className="vx-mut" style={{ fontSize: 12 }}>Se for o caso, registre a ausência justificada (aba Ausências) ou reveja a prova (Tarefas) antes de responder.</p>
              <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={() => responder(ct)}>Responder</button>
            </div>
          ))}
        </section>
      )}
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Dias do período</h3>
      <ListaDias dias={d.painel.dias} />
      {d.relatorios.length > 0 && (
        <section aria-labelledby="rel-titulo">
          <h3 id="rel-titulo" className="vx-disp" style={{ fontSize: 15 }}>Relatórios automáticos</h3>
          {d.relatorios.map((r) => (
            <div key={r.id} className="vx-card" style={{ padding: 12, marginBottom: 8, fontSize: 13 }}>
              <b>{r.periodo === "semana" ? "Semana" : "Mês"} {dataBRFormatada(r.inicio)} a {dataBRFormatada(r.fim)}</b>
              <div className="vx-mut" style={{ marginTop: 4 }}>{r.resumo}</div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function RegraForm({ d, aviso, recarregar }) {
  const c = d.colaborador;
  const [cad, setCad] = useState({ nome: c.nome, cpf: c.cpf, funcao: c.funcao, regime: c.regime || "", jornadaHoras: String(c.jornadaHoras || ""), dataInicio: c.dataInicio, cargoId: c.cargoId || "" });
  const [r, setR] = useState(() => ({
    ...d.regra,
    _fixo: centsParaReais(d.regra.fixoCents), _cad: centsParaReais(d.regra.variavel.cadastroCents), _tar: centsParaReais(d.regra.variavel.tarefaCents),
    _dia: centsParaReais(d.regra.variavel.diariaCents), _emp: centsParaReais(d.regra.variavel.empresaPagante.valorCents), _teto: centsParaReais(d.regra.tetoMensalCents),
  }));
  const [vig, setVig] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [encerrar, setEncerrar] = useState({ dataSaida: hoje(), motivo: "" });
  const s = (k, v) => setR((x) => ({ ...x, [k]: v }));
  const montar = () => {
    const { _fixo, _cad, _tar, _dia, _emp, _teto, ...base } = r;
    return {
      ...base,
      fixoCents: reaisParaCents(_fixo), tetoMensalCents: reaisParaCents(_teto),
      variavel: { ...base.variavel, cadastroCents: reaisParaCents(_cad), tarefaCents: reaisParaCents(_tar), diariaCents: reaisParaCents(_dia), garantiaDias: Math.max(0, Number(base.variavel.garantiaDias) || 0), empresaPagante: { ...base.variavel.empresaPagante, valorCents: reaisParaCents(_emp), percentual: Number(base.variavel.empresaPagante.percentual) || 0, meses: Number(base.variavel.empresaPagante.meses) || 1 } },
      alertaDiasSemAtividade: Number(base.alertaDiasSemAtividade) || 3,
      diaTrabalhado: { ...base.diaTrabalhado, minimo: Number(base.diaTrabalhado.minimo) || 1 },
      meta: { ...base.meta, quantidade: base.meta.quantidade === "" || base.meta.quantidade == null ? null : Number(base.meta.quantidade) },
      pesos: { meta: Number(base.pesos.meta) || 0, aprovacao: Number(base.pesos.aprovacao) || 0, presenca: Number(base.pesos.presenca) || 0 },
    };
  };
  const salvarRegra = async (e) => {
    e.preventDefault();
    const regra = montar();
    let confirmarReducao = false;
    const red = ["clt", "formacao", "aprendiz"].includes(c.vinculo) ? listarReducoes(d.regra, regra) : [];
    if (red.length) {
      confirmarReducao = window.confirm(`Atenção: esta alteração reduz ${red.join(", ")}.\n\nAlteração que prejudica o empregado não vale nem com o aceite dele (art. 468 da CLT) e pode ser revertida na Justiça do Trabalho.\n\nSalvar mesmo assim?`);
      if (!confirmarReducao) return;
    }
    const resp = await apiPut(`/admin/colaboradores/${c.id}/regra`, { regra, vigenciaInicio: vig, motivo, confirmarReducao });
    if (resp?.error) return aviso(resp.error);
    aviso(resp.aditivo?.erro ? `Regra salva. ${resp.aditivo.erro}` : resp.aditivo ? "Regra salva e aditivo enviado para aceite." : "Regra salva.");
    recarregar();
  };
  const salvarCadastro = async (e) => {
    e.preventDefault();
    const resp = await apiPatch(`/admin/colaboradores/${c.id}`, { ...cad, cpf: cad.cpf });
    if (resp?.error) return aviso(resp.error);
    aviso("Cadastro atualizado.");
    recarregar();
  };
  const fazerEncerramento = async () => {
    if (!window.confirm(`Encerrar o vínculo de ${c.nome} em ${dataBRFormatada(encerrar.dataSaida)}? O acesso às tarefas é bloqueado; contrato e relatórios continuam disponíveis para leitura.`)) return;
    const resp = await api(`/admin/colaboradores/${c.id}/encerrar`, encerrar);
    if (resp?.error) return aviso(resp.error);
    aviso("Vínculo encerrado. Faça o fechamento final do mês para o contador.");
    recarregar();
  };
  const ep = r.variavel.empresaPagante;
  const setVar = (k, v) => setR((x) => ({ ...x, variavel: { ...x.variavel, [k]: v } }));
  const setEp = (k, v) => setR((x) => ({ ...x, variavel: { ...x.variavel, empresaPagante: { ...x.variavel.empresaPagante, [k]: v } } }));
  return (
    <>
      <form onSubmit={salvarRegra} className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Remuneração (versão {d.versaoRegra})</h3>
        <div className="vx-g3" style={{ gap: 12 }}>
          <Campo id="r-fixo" label="Fixo por mês (R$)" ajuda="Salário de quem tem vínculo. Pago pela folha."><input id="r-fixo" className="vx-input" inputMode="decimal" value={r._fixo} onChange={(e) => s("_fixo", e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-cad" label="Por cadastro válido (R$)"><input id="r-cad" className="vx-input" inputMode="decimal" value={r._cad} onChange={(e) => s("_cad", e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-cadcrit" label="Cadastro válido é">
            <select id="r-cadcrit" className="vx-input" value={r.variavel.cadastroCriterio} onChange={(e) => setVar("cadastroCriterio", e.target.value)} style={ALVO}>
              <option value="qualificado">Cadastro qualificado</option><option value="cadastro">Qualquer cadastro concluído</option>
            </select>
          </Campo>
          <Campo id="r-tar" label="Por tarefa aprovada (R$)" ajuda="A tarefa pode ter valor próprio."><input id="r-tar" className="vx-input" inputMode="decimal" value={r._tar} onChange={(e) => s("_tar", e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-dia" label="Diária verificada (R$)"><input id="r-dia" className="vx-input" inputMode="decimal" value={r._dia} onChange={(e) => s("_dia", e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-teto" label="Teto mensal do variável (R$)" ajuda="0 = sem teto"><input id="r-teto" className="vx-input" inputMode="decimal" value={r._teto} onChange={(e) => s("_teto", e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-epm" label="Empresa pagante">
            <select id="r-epm" className="vx-input" value={ep.modo} onChange={(e) => setEp("modo", e.target.value)} style={ALVO}>
              <option value="fixo">Valor fixo por empresa</option><option value="percentual">Percentual do pagamento</option>
            </select>
          </Campo>
          {ep.modo === "fixo"
            ? <Campo id="r-epv" label="Valor por empresa (R$)"><input id="r-epv" className="vx-input" inputMode="decimal" value={r._emp} onChange={(e) => s("_emp", e.target.value)} style={ALVO} /></Campo>
            : <Campo id="r-epp" label="Percentual (%)"><input id="r-epp" className="vx-input" inputMode="decimal" value={ep.percentual} onChange={(e) => setEp("percentual", e.target.value)} style={ALVO} /></Campo>}
          <Campo id="r-epmes" label="Vale por quantos meses" ajuda="1 = só a primeira cobrança"><input id="r-epmes" className="vx-input" inputMode="numeric" value={ep.meses} onChange={(e) => setEp("meses", e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-gar" label="Prazo de garantia (dias)" ajuda="Cancelamento depois disso não estorna o que já foi lançado"><input id="r-gar" className="vx-input" inputMode="numeric" value={r.variavel.garantiaDias ?? 30} onChange={(e) => setVar("garantiaDias", e.target.value)} style={ALVO} /></Campo>
        </div>
        {(c.vinculo === "outro" || c.vinculo === "estagio") && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
            <input type="checkbox" checked={!!r.permiteSaque} onChange={(e) => s("permiteSaque", e.target.checked)} /> No fechamento, o variável aprovado vai para o saldo e sai pelo saque (Pix)
          </label>
        )}
        {["clt", "formacao", "aprendiz"].includes(c.vinculo) && <p className="vx-mut" style={{ fontSize: 12.5 }}>Empregado: fixo e variável vão para o fechamento e são pagos pela folha. Nada sai pelo saque da plataforma.</p>}

        <h3 className="vx-disp" style={{ fontSize: 15 }}>Presença, meta e avisos</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" checked={!!r.medirPresenca} onChange={(e) => s("medirPresenca", e.target.checked)} /> Medir presença e faltas
        </label>
        {r.medirPresenca && c.vinculo === "outro" && <div className="vx-notice vx-notice-amber" style={{ marginBottom: 8 }}>Cobrar presença de autônomo é o que a Justiça do Trabalho usa para reconhecer vínculo de emprego. Para autônomo, o mais seguro é medir só as entregas.</div>}
        <DiasPrevistos valor={r.diasPrevistos} onChange={(v) => s("diasPrevistos", v)} />
        <div className="vx-g3" style={{ gap: 12 }}>
          <Campo id="r-hi" label="Início do horário"><input id="r-hi" type="time" className="vx-input" value={r.horario.inicio} onChange={(e) => s("horario", { ...r.horario, inicio: e.target.value })} style={ALVO} /></Campo>
          <Campo id="r-hf" label="Fim do horário"><input id="r-hf" type="time" className="vx-input" value={r.horario.fim} onChange={(e) => s("horario", { ...r.horario, fim: e.target.value })} style={ALVO} /></Campo>
          <Campo id="r-crit" label="Dia trabalhado é quando há">
            <select id="r-crit" className="vx-input" value={r.diaTrabalhado.criterio} onChange={(e) => s("diaTrabalhado", { ...r.diaTrabalhado, criterio: e.target.value })} style={ALVO}>
              <option value="envio">Tarefa enviada com prova</option><option value="aprovada">Tarefa aprovada</option><option value="registro">Registro "Comecei o dia"</option>
            </select>
          </Campo>
          <Campo id="r-min" label="Mínimo por dia"><input id="r-min" className="vx-input" inputMode="numeric" value={r.diaTrabalhado.minimo} onChange={(e) => s("diaTrabalhado", { ...r.diaTrabalhado, minimo: e.target.value })} style={ALVO} /></Campo>
          <Campo id="r-alerta" label="Alertar você após quantos dias sem atividade"><input id="r-alerta" className="vx-input" inputMode="numeric" value={r.alertaDiasSemAtividade} onChange={(e) => s("alertaDiasSemAtividade", e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-mper" label="Meta por">
            <select id="r-mper" className="vx-input" value={r.meta.periodo} onChange={(e) => s("meta", { ...r.meta, periodo: e.target.value })} style={ALVO}>
              <option value="dia">Dia</option><option value="semana">Semana</option>
            </select>
          </Campo>
          <Campo id="r-mq" label="Meta (tarefas)" ajuda={r.meta.status === "calibrando" ? "Em calibração: deixe vazio para o sistema sugerir." : ""}>
            <input id="r-mq" className="vx-input" inputMode="decimal" value={r.meta.quantidade ?? ""} onChange={(e) => s("meta", { ...r.meta, quantidade: e.target.value, status: e.target.value ? "ativa" : r.meta.status })} style={ALVO} />
          </Campo>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" checked={!!r.registroAtividade} onChange={(e) => s("registroAtividade", e.target.checked)} /> Mostrar os botões "Comecei o dia" e "Encerrei o dia" (registro de atividade, não é ponto)
        </label>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="vx-label">Pesos da nota</legend>
          <div className="vx-g3" style={{ gap: 12 }}>
            {[["meta", "Meta"], ["aprovacao", "Aprovação"], ["presenca", "Presença"]].map(([k, t]) => (
              <Campo key={k} id={`r-p-${k}`} label={t}><input id={`r-p-${k}`} className="vx-input" inputMode="numeric" value={r.pesos[k]} onChange={(e) => s("pesos", { ...r.pesos, [k]: e.target.value })} style={ALVO} /></Campo>
            ))}
          </div>
        </fieldset>
        <div className="vx-g2" style={{ gap: 12 }}>
          <Campo id="r-vig" label="Vale a partir de"><input id="r-vig" type="date" className="vx-input" value={vig} onChange={(e) => setVig(e.target.value)} style={ALVO} /></Campo>
          <Campo id="r-mot" label="Motivo da mudança"><input id="r-mot" className="vx-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={ALVO} /></Campo>
        </div>
        <p className="vx-mut" style={{ fontSize: 12.5 }}>Mudança de remuneração, dias ou horário gera um aditivo para a pessoa aceitar.</p>
        <button className="vx-btn vx-btn-primary" style={ALVO}>Salvar nova versão</button>
      </form>

      <form onSubmit={salvarCadastro} className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Cadastro</h3>
        <div className="vx-g3" style={{ gap: 12 }}>
          <Campo id="c-nome" label="Nome completo"><input id="c-nome" className="vx-input" value={cad.nome} onChange={(e) => setCad({ ...cad, nome: e.target.value })} style={ALVO} /></Campo>
          <Campo id="c-cpf" label="CPF"><input id="c-cpf" className="vx-input" inputMode="numeric" value={cad.cpf} onChange={(e) => setCad({ ...cad, cpf: e.target.value })} style={ALVO} /></Campo>
          <Campo id="c-cargo" label="Cargo" ajuda="Só cargos com o mesmo tipo de contrato.">
            <select id="c-cargo" className="vx-input" value={cad.cargoId} onChange={(e) => setCad({ ...cad, cargoId: e.target.value })} style={ALVO}>
              <option value="">Sem cargo</option>
              {(d.cargos || []).filter((k) => k.vinculo === c.vinculo).map((k) => <option key={k.id} value={k.id}>{k.area} · {k.nome}</option>)}
            </select>
          </Campo>
          {c.vinculo !== "outro" && (
            <Campo id="c-reg" label="Regime">
              <select id="c-reg" className="vx-input" value={cad.regime} onChange={(e) => setCad({ ...cad, regime: e.target.value })} style={ALVO}>
                {Object.entries(REGIMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
          )}
          <Campo id="c-jor" label="Jornada (h/semana)"><input id="c-jor" className="vx-input" inputMode="decimal" value={cad.jornadaHoras} onChange={(e) => setCad({ ...cad, jornadaHoras: e.target.value })} style={ALVO} /></Campo>
          <Campo id="c-ini" label="Data real de início"><input id="c-ini" type="date" className="vx-input" value={cad.dataInicio} onChange={(e) => setCad({ ...cad, dataInicio: e.target.value })} style={ALVO} /></Campo>
        </div>
        <button className="vx-btn" style={ALVO}>Salvar cadastro</button>
      </form>

      {c.status === "ativo" && (
        <div className="vx-card" style={{ padding: 18 }}>
          <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Encerrar vínculo</h3>
          <div className="vx-g2" style={{ gap: 12 }}>
            <Campo id="e-data" label="Data de saída"><input id="e-data" type="date" className="vx-input" value={encerrar.dataSaida} onChange={(e) => setEncerrar({ ...encerrar, dataSaida: e.target.value })} style={ALVO} /></Campo>
            <Campo id="e-mot" label="Motivo"><input id="e-mot" className="vx-input" value={encerrar.motivo} onChange={(e) => setEncerrar({ ...encerrar, motivo: e.target.value })} style={ALVO} /></Campo>
          </div>
          <button className="vx-btn vx-btn-danger" style={ALVO} onClick={fazerEncerramento}>Encerrar vínculo</button>
        </div>
      )}
    </>
  );
}

function ContratosAdmin({ d, aviso, recarregar }) {
  const c = d.colaborador;
  const gerar = async (tipo) => {
    const r = await api(`/admin/colaboradores/${c.id}/contrato`, { tipo });
    if (r?.error) return aviso(r.error);
    aviso(tipo === "aditivo" ? "Aditivo gerado e enviado." : "Contrato gerado e enviado para assinatura.");
    recarregar();
  };
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={() => gerar("contrato")}>Gerar contrato do modelo</button>
        {d.acesso.contratoAssinado && <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => gerar("aditivo")}>Gerar aditivo</button>}
      </div>
      <p className="vx-mut" style={{ fontSize: 12.5 }}>O texto vem do modelo do tipo de contrato (aba Configuração) e o sistema só preenche os campos. A assinatura é feita na própria plataforma (nome digitado + código por e-mail). Sem contrato assinado, a pessoa não vê as tarefas.</p>
      <VerificarCodigo aviso={aviso} />
      {!d.contratos.length ? <Vazio titulo="Nenhum documento" texto="Cadastre o modelo do vínculo em Configuração e gere o contrato." /> : (
        <div className="vx-grid">{d.contratos.map((k) => (
          <div key={k.id} className="vx-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <b>{k.tipo === "aditivo" ? "Aditivo" : "Contrato"}</b> · {k.titulo}
              <div className="vx-mut" style={{ fontSize: 12 }}>
                {k.status === "assinado" ? `Assinado em ${dataCurta(k.assinadoEm)}${k.ip ? ` · IP ${k.ip}` : ""}` : k.status === "cancelado" ? "Substituído" : "Aguardando assinatura"} · modelo v{k.modeloVersao} · regra v{k.regraVersao}
                {k.codigoVerificacao && <> · <span className="vx-mono">{k.codigoVerificacao}</span></>}
              </div>
              <div className="vx-mut vx-mono" style={{ fontSize: 11 }}>SHA-256 {k.hash.slice(0, 16)}…</div>
            </div>
            <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => abrir(`/admin/colaboradores/${c.id}/contratos/${k.id}/documento`)}>Abrir / salvar em PDF</button>
          </div>
        ))}</div>
      )}
    </>
  );
}

function VerificarCodigo({ aviso }) {
  const [cod, setCod] = useState("");
  const [r, setR] = useState(null);
  const verificar = async (e) => {
    e.preventDefault();
    const x = await api(`/admin/colaboradores-verificar/${encodeURIComponent(cod.trim())}`);
    if (x?.error) return aviso(x.error);
    setR(x);
  };
  return (
    <form onSubmit={verificar} className="vx-card" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="vx-label" htmlFor="verif-cod">Conferir código de verificação de um documento</label>
          <input id="verif-cod" className="vx-input vx-mono" value={cod} onChange={(e) => { setCod(e.target.value); setR(null); }} placeholder="RYCS-0000-0000-0000" style={ALVO} />
        </div>
        <button className="vx-btn vx-btn-sm" style={ALVO} disabled={cod.trim().length < 8}>Conferir</button>
      </div>
      {r && <div role="status" style={{ marginTop: 8, fontSize: 13, color: r.valido ? "var(--brand)" : "var(--red)" }}>
        {r.valido ? `Válido: ${r.documento.tipo === "aditivo" ? "aditivo" : "contrato"} de ${r.documento.nome}, assinado em ${dataCurta(r.documento.assinadoEm)} (modelo v${r.documento.modeloVersao}).` : "Nenhum documento assinado com esse código."}
      </div>}
    </form>
  );
}

function AusenciasAdmin({ d, aviso, recarregar }) {
  const [f, setF] = useState({ dataInicio: hoje(), dataFim: hoje(), tipo: "folga", observacao: "" });
  const decidir = async (a, aprovar) => {
    const r = await apiPatch(`/admin/colaboradores-ausencias/${a.id}`, { aprovar });
    if (r?.error) return aviso(r.error);
    recarregar();
  };
  const registrar = async (e) => {
    e.preventDefault();
    const r = await api(`/admin/colaboradores/${d.colaborador.id}/ausencias`, f);
    if (r?.error) return aviso(r.error);
    aviso("Ausência justificada registrada.");
    recarregar();
  };
  return (
    <>
      <form onSubmit={registrar} className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Registrar ausência justificada</h3>
        <div className="vx-g4" style={{ gap: 12 }}>
          <Campo id="a-ini" label="De"><input id="a-ini" type="date" className="vx-input" value={f.dataInicio} onChange={(e) => setF({ ...f, dataInicio: e.target.value })} style={ALVO} /></Campo>
          <Campo id="a-fim" label="Até"><input id="a-fim" type="date" className="vx-input" value={f.dataFim} onChange={(e) => setF({ ...f, dataFim: e.target.value })} style={ALVO} /></Campo>
          <Campo id="a-tipo" label="Tipo">
            <select id="a-tipo" className="vx-input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} style={ALVO}>
              {Object.entries(TIPOS_AUSENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo id="a-obs" label="Observação"><input id="a-obs" className="vx-input" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} style={ALVO} /></Campo>
        </div>
        {f.tipo === "atestado" && <p className="vx-mut" style={{ fontSize: 12.5 }}>O atestado em si não sobe para a plataforma (é dado de saúde): fica só o registro. O documento vai para o contador.</p>}
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Registrar</button>
      </form>
      {!d.ausencias.length ? <Vazio titulo="Nenhuma ausência" texto="Férias, folgas, atestados e licenças aparecem aqui e não contam como falta." /> : (
        <div className="vx-grid">{d.ausencias.map((a) => (
          <div key={a.id} className="vx-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13 }}><b>{TIPOS_AUSENCIA[a.tipo]}</b> · {dataBRFormatada(a.dataInicio)} a {dataBRFormatada(a.dataFim)}{a.observacao ? ` · ${a.observacao}` : ""}
              <div className="vx-mut" style={{ fontSize: 12 }}>{a.status === "pedida" ? "Pedido do colaborador" : a.status === "aprovada" ? "Aprovada" : "Recusada"}</div></div>
            {a.status === "pedida" && <div style={{ display: "flex", gap: 6 }}>
              <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={() => decidir(a, true)}>Aprovar</button>
              <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => decidir(a, false)}>Recusar</button>
            </div>}
          </div>
        ))}</div>
      )}
    </>
  );
}

function ExtratoAdmin({ d, mes, setMes, aviso, recarregar }) {
  const [aj, setAj] = useState({ valor: "", motivo: "" });
  const ajustar = async (e) => {
    e.preventDefault();
    const r = await api(`/admin/colaboradores/${d.colaborador.id}/ajuste`, { valorCents: reaisParaCents(aj.valor), motivo: aj.motivo });
    if (r?.error) return aviso(r.error);
    aviso("Ajuste lançado no mês aberto.");
    setAj({ valor: "", motivo: "" });
    recarregar();
  };
  return (
    <>
      <div style={{ maxWidth: 200, marginBottom: 12 }}>
        <label className="vx-label" htmlFor="x-mes">Mês</label>
        <input id="x-mes" type="month" className="vx-input" value={mes} onChange={(e) => setMes(e.target.value)} style={ALVO} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => abrir(`/admin/colaboradores-fechamento.html?mes=${mes}&colaboradorId=${d.colaborador.id}`)}>PDF do mês desta pessoa</button>
        <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => abrir(`/admin/colaboradores-fechamento.csv?mes=${mes}&colaboradorId=${d.colaborador.id}`)}>CSV do mês desta pessoa</button>
      </div>
      <TabelaExtrato ex={d.extrato} />
      <form onSubmit={ajustar} className="vx-card" style={{ padding: 16, marginTop: 14 }}>
        <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Lançar ajuste</h3>
        <p className="vx-mut" style={{ fontSize: 12.5 }}>Lançamentos não se editam nem se apagam. Correção é um ajuste, com motivo (use valor negativo para descontar um lançamento errado).</p>
        <div className="vx-g2" style={{ gap: 12 }}>
          <Campo id="aj-v" label="Valor (R$)"><input id="aj-v" className="vx-input" inputMode="decimal" value={aj.valor} onChange={(e) => setAj({ ...aj, valor: e.target.value })} style={ALVO} /></Campo>
          <Campo id="aj-m" label="Motivo"><input id="aj-m" className="vx-input" required value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} style={ALVO} /></Campo>
        </div>
        <button className="vx-btn vx-btn-sm" style={ALVO}>Lançar ajuste</button>
      </form>
    </>
  );
}

function Historico({ d }) {
  return (
    <>
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Versões da regra</h3>
      <div className="vx-grid" style={{ marginBottom: 16 }}>{d.historicoRegras.map((h) => (
        <div key={h.versao} className="vx-card" style={{ padding: 12, fontSize: 13 }}>
          <b>Versão {h.versao}</b> · vale desde {dataBRFormatada(h.vigenciaInicio)} · {h.motivo || "sem motivo"} · {dataCurta(h.criadoEm)}
          <div className="vx-mut" style={{ fontSize: 12 }}>Fixo {formatarCents(h.regra.fixoCents)} · tarefa {formatarCents(h.regra.variavel.tarefaCents)} · diária {formatarCents(h.regra.variavel.diariaCents)} · cadastro {formatarCents(h.regra.variavel.cadastroCents)}</div>
        </div>
      ))}</div>
      <h3 className="vx-disp" style={{ fontSize: 15 }}>Auditoria</h3>
      <div className="vx-table-wrap">
        <table className="vx-table" style={{ minWidth: 0 }}>
          <thead><tr><th scope="col">Quando</th><th scope="col">Ação</th><th scope="col">Alvo</th></tr></thead>
          <tbody>{d.auditoria.map((a, i) => <tr key={i}><td>{dataCurta(a.criadoEm)}</td><td>{a.acao.replace(/_/g, " ")}</td><td className="vx-mut">{a.alvoTipo}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

// ───────────────────────────── Tarefas ─────────────────────────────

const TAREFA_VAZIA = { titulo: "", descricao: "", atribuicao: "pessoa", alvo: "", recorrencia: "diaria", prazoData: "", valor: "", tipoProva: "texto", aprovacao: "manual", contaMeta: true };

function Tarefas({ aviso, recarregar }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState(TAREFA_VAZIA);
  const [editando, setEditando] = useState(null);
  const [sug, setSug] = useState({ funcao: "", contexto: "" });
  const [motivos, setMotivos] = useState({});
  const carregar = useCallback(async () => {
    const r = await api("/admin/colaboradores-tarefas");
    if (r?.error) return aviso(r.error);
    setD(r);
  }, [aviso]);
  useEffect(() => { carregar(); }, [carregar]);
  const salvar = async (e) => {
    e.preventDefault();
    const corpo = { ...f, valorCents: f.valor === "" ? null : reaisParaCents(f.valor) };
    const r = editando ? await apiPut(`/admin/colaboradores-tarefas/${editando}`, corpo) : await api("/admin/colaboradores-tarefas", corpo);
    if (r?.error) return aviso(r.error);
    aviso(editando ? "Tarefa atualizada." : "Tarefa criada.");
    setF(TAREFA_VAZIA); setEditando(null);
    carregar();
  };
  const status = async (t, s) => {
    const r = await apiPatch(`/admin/colaboradores-tarefas/${t.id}/status`, { status: s });
    if (r?.error) return aviso(r.error);
    carregar();
  };
  const revisar = async (o, acao) => {
    const motivo = motivos[o.id] || "";
    if ((acao === "recusar") && !motivo.trim()) return aviso("Escreva o motivo da recusa.");
    const r = await api(`/admin/colaboradores-ocorrencias/${o.id}/revisar`, { acao, motivo });
    if (r?.error) return aviso(r.error);
    carregar(); recarregar();
  };
  const sugerir = async (e) => {
    e.preventDefault();
    aviso("Pedindo sugestões à IA…");
    const r = await api("/admin/colaboradores-tarefas/sugerir", sug);
    if (r?.error) return aviso(r.error);
    aviso(`${r.ids.length} sugestão(ões) criada(s). Nenhuma fica ativa sem você ativar.`);
    carregar();
  };
  const editar = (t) => {
    setEditando(t.id);
    setF({ titulo: t.titulo, descricao: t.descricao, atribuicao: t.atribuicao, alvo: t.alvo, recorrencia: t.recorrencia, prazoData: t.prazoData || "", valor: t.valorCents == null ? "" : centsParaReais(t.valorCents), tipoProva: t.tipoProva, aprovacao: t.aprovacao, contaMeta: !!t.contaMeta });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (!d) return <div className="vx-spinner" />;
  const nomeAlvo = (t) => t.atribuicao === "todos" ? "Qualquer colaborador" : t.atribuicao === "funcao" ? `Função: ${t.alvo}` : d.colaboradores.find((c) => c.id === t.alvo)?.nome || "—";
  return (
    <>
      {d.fila.length > 0 && (
        <section aria-labelledby="fila-t" style={{ marginBottom: 20 }}>
          <h3 id="fila-t" className="vx-disp" style={{ fontSize: 15 }}>Para revisar ({d.fila.length})</h3>
          <div className="vx-grid">{d.fila.map((o) => <CartaoProva key={o.id} o={o} motivo={motivos[o.id] || ""} setMotivo={(v) => setMotivos((m) => ({ ...m, [o.id]: v }))} revisar={revisar} />)}</div>
        </section>
      )}

      <form onSubmit={salvar} className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>{editando ? "Editar tarefa" : "Nova tarefa"}</h3>
        <div className="vx-g2" style={{ gap: 12 }}>
          <Campo id="t-tit" label="Título"><input id="t-tit" className="vx-input" required value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} style={ALVO} /></Campo>
          <Campo id="t-atr" label="Quem faz">
            <select id="t-atr" className="vx-input" value={f.atribuicao} onChange={(e) => setF({ ...f, atribuicao: e.target.value, alvo: "" })} style={ALVO}>
              <option value="pessoa">Uma pessoa</option><option value="funcao">Uma função</option><option value="todos">Qualquer colaborador</option>
            </select>
          </Campo>
        </div>
        <Campo id="t-desc" label="Descrição"><textarea id="t-desc" className="vx-input" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
        <div className="vx-g3" style={{ gap: 12 }}>
          {f.atribuicao === "pessoa" && (
            <Campo id="t-alvo" label="Colaborador">
              <select id="t-alvo" className="vx-input" required value={f.alvo} onChange={(e) => setF({ ...f, alvo: e.target.value })} style={ALVO}>
                <option value="">Escolha…</option>{d.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
          )}
          {f.atribuicao === "funcao" && <Campo id="t-func" label="Função"><input id="t-func" className="vx-input" required list="t-funcoes" value={f.alvo} onChange={(e) => setF({ ...f, alvo: e.target.value })} style={ALVO} />
            <datalist id="t-funcoes">{[...new Set(d.colaboradores.map((c) => c.funcao).filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist></Campo>}
          <Campo id="t-rec" label="Repetição">
            <select id="t-rec" className="vx-input" value={f.recorrencia} onChange={(e) => setF({ ...f, recorrencia: e.target.value })} style={ALVO}>
              <option value="diaria">Todo dia previsto</option><option value="semanal">Toda semana</option><option value="unica">Uma vez</option>
            </select>
          </Campo>
          {f.recorrencia === "unica" && <Campo id="t-prazo" label="Prazo"><input id="t-prazo" type="date" className="vx-input" required value={f.prazoData} onChange={(e) => setF({ ...f, prazoData: e.target.value })} style={ALVO} /></Campo>}
          <Campo id="t-prova" label="Prova exigida">
            <select id="t-prova" className="vx-input" value={f.tipoProva} onChange={(e) => setF({ ...f, tipoProva: e.target.value })} style={ALVO}>
              {Object.entries(TIPOS_PROVA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo id="t-apr" label="Aprovação" ajuda={f.aprovacao === "automatica" ? "Aprova sozinha se passar nas checagens; você pode reverter até fechar o mês." : ""}>
            <select id="t-apr" className="vx-input" value={f.aprovacao} onChange={(e) => setF({ ...f, aprovacao: e.target.value })} style={ALVO}>
              <option value="manual">Eu aprovo cada envio</option><option value="automatica">Automática, por regra</option>
            </select>
          </Campo>
          <Campo id="t-val" label="Valor próprio (R$)" ajuda="Vazio = valor por tarefa da regra da pessoa"><input id="t-val" className="vx-input" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} style={ALVO} /></Campo>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" checked={f.contaMeta} onChange={(e) => setF({ ...f, contaMeta: e.target.checked })} /> Conta para a meta
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="vx-btn vx-btn-primary" style={ALVO}>{editando ? "Salvar" : "Criar tarefa"}</button>
          {editando && <button type="button" className="vx-btn" style={ALVO} onClick={() => { setEditando(null); setF(TAREFA_VAZIA); }}>Cancelar</button>}
        </div>
      </form>

      <form onSubmit={sugerir} className="vx-card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Pedir sugestões à IA</h3>
        <div className="vx-g2" style={{ gap: 12 }}>
          <Campo id="s-func" label="Para a função (opcional)"><input id="s-func" className="vx-input" value={sug.funcao} onChange={(e) => setSug({ ...sug, funcao: e.target.value })} style={ALVO} /></Campo>
          <Campo id="s-ctx" label="O que essa pessoa faz hoje"><input id="s-ctx" className="vx-input" value={sug.contexto} onChange={(e) => setSug({ ...sug, contexto: e.target.value })} style={ALVO} /></Campo>
        </div>
        <button className="vx-btn vx-btn-sm" style={ALVO}>Sugerir tarefas</button>
      </form>

      <h3 className="vx-disp" style={{ fontSize: 15 }}>Tarefas</h3>
      {!d.tarefas.length ? <Vazio titulo="Nenhuma tarefa" texto="Crie a primeira tarefa acima." /> : (
        <div className="vx-grid" style={{ marginBottom: 20 }}>{d.tarefas.map((t) => (
          <div key={t.id} className="vx-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 13 }}>
              <b>{t.titulo}</b> {t.status === "sugerida" && <span className="vx-badge vx-badge-indigo">Sugerida pela IA</span>}
              <div className="vx-mut" style={{ fontSize: 12 }}>{nomeAlvo(t)} · {t.recorrencia === "diaria" ? "todo dia previsto" : t.recorrencia === "semanal" ? "semanal" : `até ${dataBRFormatada(t.prazoData)}`} · prova: {TIPOS_PROVA[t.tipoProva]} · {t.aprovacao === "automatica" ? "aprovação automática" : "aprovação manual"}{t.valorCents != null ? ` · ${formatarCents(t.valorCents)}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {t.status === "sugerida" && <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={() => status(t, "ativa")}>Ativar</button>}
              <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => editar(t)}>Editar</button>
              <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => status(t, "arquivada")}>Arquivar</button>
            </div>
          </div>
        ))}</div>
      )}

      {d.automaticas.length > 0 && (
        <section aria-labelledby="auto-t">
          <h3 id="auto-t" className="vx-disp" style={{ fontSize: 15 }}>Aprovadas automaticamente (14 dias)</h3>
          <p className="vx-mut" style={{ fontSize: 12.5 }}>Você pode reverter até o fechamento do mês. Para reverter, escreva o motivo e recuse.</p>
          <div className="vx-grid">{d.automaticas.map((o) => <CartaoProva key={o.id} o={o} motivo={motivos[o.id] || ""} setMotivo={(v) => setMotivos((m) => ({ ...m, [o.id]: v }))} revisar={revisar} automatica />)}</div>
        </section>
      )}
    </>
  );
}

function CartaoProva({ o, motivo, setMotivo, revisar, automatica }) {
  const p = o.prova || {};
  return (
    <div className="vx-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 13 }}><b>{o.colaboradorNome}</b> · {o.titulo} · {dataBRFormatada(o.dataRef)}</div>
      <div className="vx-mut" style={{ fontSize: 12, margin: "2px 0 6px" }}>Enviada {dataCurta(o.enviadoEm)}{o.foraJornada ? " · fora da jornada" : ""}{o.status === "aprovada" ? " · aprovada automaticamente" : ""}</div>
      {p.texto && <div style={{ fontSize: 13, whiteSpace: "pre-wrap", marginBottom: 6 }}>{p.texto}</div>}
      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, wordBreak: "break-all" }}>{p.link}</a>}
      {p.arquivo && <div><button className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={() => abrir(`/colaborador/provas/${o.id}/arquivo`)}>Ver arquivo ({p.arquivo.nome})</button></div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        {o.checagens?.linkAcessivel === false && <span className="vx-badge vx-badge-red">Link não abriu</span>}
        {o.repetida ? <span className="vx-badge vx-badge-red">Prova repetida</span> : null}
        {o.observacaoIA && <span className="vx-badge vx-badge-amber">Observação da IA: {o.observacaoIA}</span>}
      </div>
      <label className="vx-label" htmlFor={`mot-${o.id}`}>Motivo (obrigatório para recusar)</label>
      <input id={`mot-${o.id}`} className="vx-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ ...ALVO, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!automatica && o.status !== "aprovada" && <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={() => revisar(o, "aprovar")}>Aprovar</button>}
        {o.status === "aprovada" && !automatica && <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={() => revisar(o, "conferida")}>Está ok</button>}
        <button className="vx-btn vx-btn-danger vx-btn-sm" style={ALVO} onClick={() => revisar(o, "recusar")}>{o.status === "aprovada" ? "Reverter e recusar" : "Recusar"}</button>
      </div>
    </div>
  );
}

// ───────────────────────────── Fechamento ─────────────────────────────

function Fechamento({ aviso }) {
  const anterior = (() => { const [a, m] = mesAtual().split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; })();
  const [mes, setMes] = useState(anterior);
  const [d, setD] = useState(null);
  const carregar = useCallback(async () => {
    const r = await api(`/admin/colaboradores-fechamento?mes=${mes}`);
    if (r?.error) return aviso(r.error);
    setD(r);
  }, [mes, aviso]);
  useEffect(() => { carregar(); }, [carregar]);
  const fechar = async () => {
    if (!window.confirm(`Fechar ${mes}? Depois disso o mês fica trancado e correções viram ajuste no mês seguinte. Para quem não tem vínculo e tem saque previsto, o variável vai para o saldo.`)) return;
    const r = await api("/admin/colaboradores-fechamento", { mes });
    if (r?.error) return aviso(r.error);
    const falhas = (r.creditos || []).filter((c) => !c.ok);
    aviso(falhas.length ? `Mês fechado. Sem carteira para creditar: ${falhas.map((f) => f.nome).join(", ")}.` : "Mês fechado.");
    carregar();
  };
  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div style={{ width: 180 }}>
          <label className="vx-label" htmlFor="f-mes">Mês</label>
          <input id="f-mes" type="month" className="vx-input" value={mes} onChange={(e) => setMes(e.target.value)} style={ALVO} />
        </div>
        <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => abrir(`/admin/colaboradores-fechamento.csv?mes=${mes}`)}>Baixar CSV</button>
        <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => abrir(`/admin/colaboradores-fechamento.html?mes=${mes}`)}>Abrir PDF</button>
        {d && !d.fechado && <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={fechar}>Fechar mês</button>}
        {d?.fechado && <span className="vx-badge vx-badge-brand">Fechado em {dataCurta(d.fechadoEm)}</span>}
      </div>
      <p className="vx-mut" style={{ fontSize: 12.5 }}>A plataforma não substitui a folha. Encargos, FGTS, INSS, férias e 13º ficam com o contador. Cada linha sai com a natureza que o contador definiu em Configuração.</p>
      {!d ? <div className="vx-spinner" /> : !d.pessoas.length ? <Vazio titulo="Ninguém no período" texto="Não há colaborador ativo neste mês." /> : (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead><tr><th scope="col">Colaborador</th><th scope="col">Vínculo</th><th scope="col">Fixo</th><th scope="col">Variável</th><th scope="col">Devido</th><th scope="col">Pagamento</th><th scope="col">Dias</th></tr></thead>
            <tbody>{d.pessoas.map((p) => (
              <tr key={p.colaboradorId}>
                <td><b>{p.nome}</b><div className="vx-mut">{p.funcao}</div></td>
                <td>{VINCULOS[p.vinculo]}</td>
                <td className="vx-mono">{p.fixoVigencias?.length > 1 ? p.fixoVigencias.map((v) => <div key={v.desde}>{formatarCents(v.fixoCents)} <span className="vx-mut">desde {dataBRFormatada(v.desde).slice(0, 5)}</span></div>) : formatarCents(p.fixoCents)}</td>
                <td className="vx-mono">{formatarCents(p.variavelCents)}</td>
                <td className="vx-mono">{formatarCents(p.variavelDevidoCents)}</td>
                <td>{p.pagamento === "folha" ? "Folha" : p.pagamento === "saque" ? "Saldo / saque" : "Fechamento"}</td>
                <td className="vx-mut">{p.dias.presentes}/{p.dias.previstos} trab. · {p.dias.ausentes} aus. · {p.dias.justificadas} just.</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ───────────────────────────── Configuração ─────────────────────────────

function PadroesAvisos({ d, aviso, recarregar }) {
  const p0 = d.padroes || {};
  const [p, setP] = useState({
    diasPrevistos: p0.diasPrevistos || [1, 2, 3, 4, 5], horario: p0.horario || { inicio: "08:00", fim: "18:00" },
    diaTrabalhado: p0.diaTrabalhado || { criterio: "envio", minimo: 1 }, alertaDiasSemAtividade: p0.alertaDiasSemAtividade ?? 3,
    pesos: p0.pesos || { meta: 40, aprovacao: 30, presenca: 30 }, registroAtividade: !!p0.registroAtividade,
    meta: { periodo: p0.meta?.periodo || "dia" }, garantiaDias: p0.garantiaDias ?? 30,
  });
  const [a, setA] = useState(d.avisos);
  const salvarP = async (e) => {
    e.preventDefault();
    const r = await apiPut("/admin/colaboradores-config/padroes", { padroes: p });
    if (r?.error) return aviso(r.error);
    aviso("Padrões salvos. Valem para os próximos colaboradores; quem já existe não muda.");
    recarregar();
  };
  const salvarA = async (e) => {
    e.preventDefault();
    const r = await apiPut("/admin/colaboradores-config/avisos", { avisos: a });
    if (r?.error) return aviso(r.error);
    aviso("Avisos salvos.");
    recarregar();
  };
  return (
    <>
      <form onSubmit={salvarP} className="vx-card" style={{ padding: 18, marginBottom: 16 }} aria-labelledby="cfg-pad">
        <h3 id="cfg-pad" className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Padrões para novos colaboradores</h3>
        <p className="vx-mut" style={{ fontSize: 12.5 }}>Preenchem a regra de quem for ativado daqui em diante. Cada pessoa pode ser ajustada depois na própria ficha.</p>
        <DiasPrevistos valor={p.diasPrevistos} onChange={(v) => setP({ ...p, diasPrevistos: v })} />
        <div className="vx-g3" style={{ gap: 12 }}>
          <Campo id="p-hi" label="Início do horário"><input id="p-hi" type="time" className="vx-input" value={p.horario.inicio} onChange={(e) => setP({ ...p, horario: { ...p.horario, inicio: e.target.value } })} style={ALVO} /></Campo>
          <Campo id="p-hf" label="Fim do horário"><input id="p-hf" type="time" className="vx-input" value={p.horario.fim} onChange={(e) => setP({ ...p, horario: { ...p.horario, fim: e.target.value } })} style={ALVO} /></Campo>
          <Campo id="p-crit" label="Dia trabalhado é quando há">
            <select id="p-crit" className="vx-input" value={p.diaTrabalhado.criterio} onChange={(e) => setP({ ...p, diaTrabalhado: { ...p.diaTrabalhado, criterio: e.target.value } })} style={ALVO}>
              <option value="envio">Tarefa enviada com prova</option><option value="aprovada">Tarefa aprovada</option><option value="registro">Registro "Comecei o dia"</option>
            </select>
          </Campo>
          <Campo id="p-min" label="Mínimo por dia"><input id="p-min" className="vx-input" inputMode="numeric" value={p.diaTrabalhado.minimo} onChange={(e) => setP({ ...p, diaTrabalhado: { ...p.diaTrabalhado, minimo: e.target.value } })} style={ALVO} /></Campo>
          <Campo id="p-al" label="Alertar após quantos dias sem atividade"><input id="p-al" className="vx-input" inputMode="numeric" value={p.alertaDiasSemAtividade} onChange={(e) => setP({ ...p, alertaDiasSemAtividade: e.target.value })} style={ALVO} /></Campo>
          <Campo id="p-mp" label="Meta por">
            <select id="p-mp" className="vx-input" value={p.meta.periodo} onChange={(e) => setP({ ...p, meta: { periodo: e.target.value } })} style={ALVO}><option value="dia">Dia</option><option value="semana">Semana</option></select>
          </Campo>
          <Campo id="p-gar" label="Prazo de garantia do estorno (dias)"><input id="p-gar" className="vx-input" inputMode="numeric" value={p.garantiaDias} onChange={(e) => setP({ ...p, garantiaDias: e.target.value })} style={ALVO} /></Campo>
          {[["meta", "Peso da meta"], ["aprovacao", "Peso da aprovação"], ["presenca", "Peso da presença"]].map(([k, t]) => (
            <Campo key={k} id={`p-p-${k}`} label={t}><input id={`p-p-${k}`} className="vx-input" inputMode="numeric" value={p.pesos[k]} onChange={(e) => setP({ ...p, pesos: { ...p.pesos, [k]: e.target.value } })} style={ALVO} /></Campo>
          ))}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" checked={p.registroAtividade} onChange={(e) => setP({ ...p, registroAtividade: e.target.checked })} /> Mostrar "Comecei o dia" e "Encerrei o dia" por padrão
        </label>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Salvar padrões</button>
      </form>

      <form onSubmit={salvarA} className="vx-card" style={{ padding: 18, marginBottom: 16 }} aria-labelledby="cfg-av">
        <h3 id="cfg-av" className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Avisos e relatórios</h3>
        {[["relatorioEmail", "Enviar por e-mail o relatório semanal e o mensal"], ["lembreteEmail", "Mandar também por e-mail o lembrete de dia sem envio ao colaborador"], ["alertaEmail", "Mandar e-mail na hora quando surgir um alerta (além do painel)"]].map(([k, t]) => (
          <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
            <input type="checkbox" checked={!!a[k]} onChange={(e) => setA({ ...a, [k]: e.target.checked })} /> {t}
          </label>
        ))}
        <Campo id="av-dest" label="Quem recebe (e-mails separados por vírgula)" ajuda="Vazio = todos os administradores da plataforma.">
          <input id="av-dest" className="vx-input" value={a.destinatarios} onChange={(e) => setA({ ...a, destinatarios: e.target.value })} style={ALVO} />
        </Campo>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Salvar avisos</button>
      </form>
    </>
  );
}

function Config({ aviso }) {
  const [d, setD] = useState(null);
  const [m, setM] = useState({ tipo: "contrato", vinculo: "clt", titulo: "", texto: "" });
  const [fer, setFer] = useState({ data: "", nome: "" });
  const [nat, setNat] = useState({});
  const carregar = useCallback(async () => {
    const r = await api("/admin/colaboradores-config");
    if (r?.error) return aviso(r.error);
    setD(r); setNat(r.naturezas);
  }, [aviso]);
  useEffect(() => { carregar(); }, [carregar]);
  const salvarModelo = async (e) => {
    e.preventDefault();
    if (!window.confirm("Salvar como nova versão do modelo? Os contratos já assinados não mudam; os próximos usam este texto.")) return;
    const r = await api("/admin/colaboradores-config/modelos", m);
    if (r?.error) return aviso(r.error);
    aviso(`Modelo salvo (versão ${r.versao}).`);
    setM({ ...m, titulo: "", texto: "" });
    carregar();
  };
  const addFeriado = async (e) => {
    e.preventDefault();
    const r = await api("/admin/colaboradores-config/feriados", fer);
    if (r?.error) return aviso(r.error);
    setFer({ data: "", nome: "" });
    carregar();
  };
  const delFeriado = async (f) => {
    const r = await apiDelete(`/admin/colaboradores-config/feriados/${f.id}`);
    if (r?.error) return aviso(r.error);
    carregar();
  };
  const salvarNat = async () => {
    const r = await apiPut("/admin/colaboradores-config/naturezas", { naturezas: nat });
    if (r?.error) return aviso(r.error);
    aviso("Classificação salva.");
  };
  if (!d) return <div className="vx-spinner" />;
  return (
    <>
      <DadosEmpresa inicial={d.empresa} aviso={aviso} pronto={carregar} />
      <PadroesAvisos key={JSON.stringify([d.padroes, d.avisos])} d={d} aviso={aviso} recarregar={carregar} />
      <section className="vx-card" style={{ padding: 18, marginBottom: 16 }} aria-labelledby="cfg-mod">
        <h3 id="cfg-mod" className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Modelos de contrato e aditivo</h3>
        <p className="vx-mut" style={{ fontSize: 12.5 }}>Já vêm modelos de referência para cada tipo de contrato, no formato usado no mercado. Para mudar, salve uma nova versão. Campos entre chaves, que o sistema preenche: {Object.entries(CAMPOS_CONTRATO).map(([k, v]) => <span key={k}><code>{`{{${k}}}`}</code> ({v}) </span>)}</p>
        {d.modelos.length > 0 && (
          <ul style={{ paddingLeft: 18, fontSize: 13 }}>{d.modelos.map((x) => <li key={x.id}>{x.tipo === "aditivo" ? "Aditivo" : "Contrato"} · {VINCULOS[x.vinculo]} · v{x.versao} · {x.titulo} {x.ativo ? <span className="vx-badge vx-badge-brand">Em uso</span> : <span className="vx-mut">(anterior)</span>}</li>)}</ul>
        )}
        <form onSubmit={salvarModelo}>
          <div className="vx-g3" style={{ gap: 12 }}>
            <Campo id="m-tipo" label="Documento">
              <select id="m-tipo" className="vx-input" value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value })} style={ALVO}><option value="contrato">Contrato</option><option value="aditivo">Aditivo</option></select>
            </Campo>
            <Campo id="m-vin" label="Vínculo">
              <select id="m-vin" className="vx-input" value={m.vinculo} onChange={(e) => setM({ ...m, vinculo: e.target.value })} style={ALVO}>{Object.entries(VINCULOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Campo>
            <Campo id="m-tit" label="Título"><input id="m-tit" className="vx-input" required value={m.titulo} onChange={(e) => setM({ ...m, titulo: e.target.value })} style={ALVO} /></Campo>
          </div>
          <Campo id="m-txt" label="Texto do modelo"><textarea id="m-txt" className="vx-input" required rows={10} value={m.texto} onChange={(e) => setM({ ...m, texto: e.target.value })} /></Campo>
          <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Salvar nova versão do modelo</button>
        </form>
      </section>

      <section className="vx-card" style={{ padding: 18, marginBottom: 16 }} aria-labelledby="cfg-fer">
        <h3 id="cfg-fer" className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Feriados</h3>
        <p className="vx-mut" style={{ fontSize: 12.5 }}>Os nacionais já entram sozinhos ({d.feriadosNacionais.slice(0, 10).map((f) => `${dataBRFormatada(f.data).slice(0, 5)} ${f.nome}`).join(" · ")}). Cadastre aqui os estaduais e municipais.</p>
        <form onSubmit={addFeriado} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><label className="vx-label" htmlFor="fe-d">Data</label><input id="fe-d" type="date" className="vx-input" required value={fer.data} onChange={(e) => setFer({ ...fer, data: e.target.value })} style={ALVO} /></div>
          <div style={{ flex: 1, minWidth: 180 }}><label className="vx-label" htmlFor="fe-n">Nome</label><input id="fe-n" className="vx-input" required value={fer.nome} onChange={(e) => setFer({ ...fer, nome: e.target.value })} style={ALVO} /></div>
          <button className="vx-btn vx-btn-sm" style={ALVO}>Adicionar</button>
        </form>
        {d.feriados.length > 0 && <ul style={{ listStyle: "none", padding: 0, marginTop: 10 }}>{d.feriados.map((f) => (
          <li key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0" }}>
            <span>{dataBRFormatada(f.data)} · {f.nome}</span>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={() => delFeriado(f)} aria-label={`Remover feriado ${f.nome}`}>Remover</button>
          </li>
        ))}</ul>}
      </section>

      <section className="vx-card" style={{ padding: 18 }} aria-labelledby="cfg-nat">
        <h3 id="cfg-nat" className="vx-disp" style={{ fontSize: 15, marginTop: 0 }}>Como cada valor sai na exportação para a folha</h3>
        <p className="vx-mut" style={{ fontSize: 12.5 }}>Já vem preenchido: salário, comissão para valores por cadastro, empresa e tarefa (integram o salário, CLT art. 457) e vale-transporte para a diária de transporte. Mude só se precisar.</p>
        <div className="vx-g3" style={{ gap: 12 }}>
          {[["fixo", "Fixo por mês"], ...Object.entries(TIPOS_LANCAMENTO).filter(([k]) => k !== "estorno")].map(([k, t]) => (
            <Campo key={k} id={`nat-${k}`} label={t}>
              <select id={`nat-${k}`} className="vx-input" value={nat[k] || "a_classificar"} onChange={(e) => setNat({ ...nat, [k]: e.target.value })} style={ALVO}>
                {Object.entries(NATUREZAS).map(([v, rot]) => <option key={v} value={v}>{rot}</option>)}
              </select>
            </Campo>
          ))}
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO} onClick={salvarNat}>Salvar classificação</button>
      </section>
    </>
  );
}
