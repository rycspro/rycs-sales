// Agenda comercial interna da RYCS (admin e closers liberados).
// Closer: publica horários, vê só as próprias reuniões e as respostas do quiz,
// cancela ou registra o resultado. Admin: libera/revoga closers, vê todas as
// reuniões, quem atende cada uma e os resultados.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarCheck2, CalendarX2, Clock, RefreshCw, UserX, Users, MessageCircle, Phone, Mail, AlertTriangle, Trophy } from "lucide-react";
import { api } from "../../lib/api.js";
import { Stat } from "../ui.jsx";
import { DIMENSOES_QUIZ, ETAPAS_QUIZ, DURACOES_AGENDA } from "../../../shared/quizDiagnostico.js";
import "./AgendaComercial.css";

const fuso = (() => {
  try { return new Intl.DateTimeFormat("pt-BR", { timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value; } catch { return ""; }
})() || Intl.DateTimeFormat().resolvedOptions().timeZone;
const dois = (n) => String(n).padStart(2, "0");
const chaveDia = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`; };
const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = (ts) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const diaLongo = (ts) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const STATUS = {
  agendada: { txt: "Agendada", tone: "brand" },
  cancelada: { txt: "Cancelada", tone: "muted" },
  realizada: { txt: "Realizada", tone: "indigo" },
  nao_compareceu: { txt: "Não compareceu", tone: "red" },
};
const ORIGEM = (o = {}) => [o.utm_source, o.utm_campaign, o.utm_content].filter(Boolean).join(" · ") || (o.fbclid ? "Anúncio da Meta" : o.referrer || "");
// Número com DDI: o que veio sem (10–11 dígitos) é brasileiro.
const comDdi = (tel) => { const d = String(tel || "").replace(/\D/g, ""); return d.length <= 11 ? `55${d}` : d; };
const telefoneLegivel = (tel) => {
  const d = String(tel || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
};
const whatsapp = (tel) => (String(tel || "").replace(/\D/g, "") ? `https://wa.me/${comDdi(tel)}` : null);

export default function AgendaComercial() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState("proximas");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await api("/agenda-comercial");
    setCarregando(false);
    if (!r || r.error) { setErro(r?.error || "Não foi possível carregar a agenda. Verifique a conexão e tente de novo."); return; }
    setErro("");
    setDados(r);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function executar(caminho, corpo, mensagem) {
    if (ocupado) return null;
    setOcupado(true); setErro(""); setSucesso("");
    const r = await api(`/agenda-comercial${caminho}`, corpo);
    setOcupado(false);
    if (!r || r.error) { setErro(r?.error || "Não foi possível salvar. Tente de novo."); return null; }
    setSucesso(typeof mensagem === "function" ? mensagem(r) : mensagem);
    await carregar();
    return r;
  }

  const agora = Date.now();
  const grupos = useMemo(() => {
    const lista = dados?.reunioes || [];
    return {
      proximas: lista.filter((r) => r.status === "agendada" && r.fim > agora).sort((a, b) => a.inicio - b.inicio),
      registrar: lista.filter((r) => r.status === "agendada" && r.fim <= agora).sort((a, b) => b.inicio - a.inicio),
      historico: lista.filter((r) => r.status !== "agendada").sort((a, b) => b.inicio - a.inicio),
    };
  }, [dados, agora]);

  if (!dados) {
    return (
      <div className="vx-fade ag-pagina">
        <Cabecalho onAtualizar={carregar} carregando={carregando} />
        {carregando ? <div className="vx-card ag-vazio" role="status">Carregando agenda…</div>
          : <div className="vx-card ag-vazio" role="alert"><p>{erro}</p><button className="vx-btn vx-btn-primary" onClick={carregar}>Tentar de novo</button></div>}
      </div>
    );
  }

  const livres = dados.horarios;
  // Quem pode receber horários e reuniões: a agenda do próprio admin (Equipe
  // RYCS) e os closers liberados.
  const atendentes = dados.admin
    ? [{ id: dados.eu, nome: "Minha agenda (Equipe RYCS)" }, ...(dados.closers || []).filter((c) => c.ativo)]
    : [{ id: dados.eu, nome: "Minha agenda" }];
  const abas = [
    ["proximas", `Próximas (${grupos.proximas.length})`],
    ["registrar", `A registrar (${grupos.registrar.length})`],
    ["livres", `Horários livres (${livres.length})`],
    ["historico", `Histórico (${grupos.historico.length})`],
    ...(dados.admin ? [["precadastros", `Pré-cadastros sem reunião (${(dados.precadastros || []).length})`], ["aprendizado", "Aprendizado do diagnóstico"]] : []),
  ];

  return (
    <div className="vx-fade ag-pagina">
      <Cabecalho onAtualizar={carregar} carregando={carregando} admin={dados.admin} />
      {erro && <p className="vx-notice ag-alerta" role="alert">{erro}</p>}
      {sucesso && <p className="vx-notice ag-ok" role="status">{sucesso}</p>}
      {!livres.filter((h) => h.inicio > agora + 3600000).length && (
        <p className="vx-notice ag-alerta-amber" role="status"><AlertTriangle size={16} aria-hidden="true" />
          {dados.admin ? "Nenhum horário livre publicado: quem concluir o quiz em /diagnostico não consegue agendar." : "Você não tem horários livres publicados. Abra horários para receber reuniões."}
        </p>
      )}

      <div className="ag-stats">
        <Stat label="Próximas reuniões" value={grupos.proximas.length} Icon={CalendarClock} />
        <Stat label="A registrar" value={grupos.registrar.length} Icon={Clock} />
        <Stat label="Realizadas" value={dados.reunioes.filter((r) => r.status === "realizada").length} Icon={CalendarCheck2} />
        <Stat label="Não compareceu" value={dados.reunioes.filter((r) => r.status === "nao_compareceu").length} Icon={UserX} />
        <Stat label="Canceladas" value={dados.reunioes.filter((r) => r.status === "cancelada").length} Icon={CalendarX2} />
        <Stat label="Horários livres" value={livres.length} Icon={Users} />
        <Stat label="Vendas fechadas" value={dados.reunioes.filter((r) => r.resultadoVenda === "fechou").length} Icon={Trophy} />
      </div>

      {dados.admin && <Resultados dados={dados} />}
      {dados.admin && <Closers closers={dados.closers} reunioes={dados.reunioes} ocupado={ocupado}
        onAlterar={(c, ativo) => executar("/closers", { userId: c.id, ativo },
          (r) => ativo ? `${c.nome} pode usar a agenda.` : `Acesso de ${c.nome} revogado.${r.reunioesFuturas ? ` Ainda há ${r.reunioesFuturas} reunião(ões) futura(s) com esse closer: cancele ou combine com a empresa.` : ""}`)} />}

      <Disponibilidade admin={dados.admin} eu={dados.eu} atendentes={atendentes} regras={dados.disponibilidade || []} ocupado={ocupado}
        onSalvar={(corpo) => executar("/disponibilidade", corpo, (r) => `Disponibilidade salva. ${r.criados} horário(s) livre(s) gerado(s) para as próximas 2 semanas.`)}
        onDesativar={(closerId) => executar("/disponibilidade/desativar", { closerId }, "Disponibilidade semanal desativada. Os horários livres dela saíram do quiz.")} />

      <PublicarHorarios admin={dados.admin} closers={atendentes} padrao={dados.eu} ocupado={ocupado}
        onPublicar={(corpo) => executar("/horarios", corpo, (r) => {
          const extras = [r.ocupados && `${r.ocupados} já ocupado(s)`, r.passados && `${r.passados} em menos de 1 hora`].filter(Boolean);
          return `${r.criados} horário(s) publicado(s) no quiz.${extras.length ? ` Pulados: ${extras.join(" e ")}.` : ""}`;
        })} />

      <div className="vx-seg ag-abas" role="tablist" aria-label="Visão da agenda">
        {abas.map(([k, txt]) => <button key={k} type="button" role="tab" aria-selected={aba === k} data-on={aba === k ? "1" : "0"} onClick={() => setAba(k)}>{txt}</button>)}
      </div>

      <div role="tabpanel">
        {aba === "aprendizado" ? <Aprendizado dados={dados.aprendizado} />
          : aba === "precadastros" ? <ListaPrecadastros lista={dados.precadastros || []} />
          : aba === "livres" ? <HorariosLivres horarios={livres} admin={dados.admin} ocupado={ocupado}
          onRetirar={(h) => executar(`/horarios/${h.id}/retirar`, {}, "Horário retirado do quiz.")} />
          : <ListaReunioes lista={grupos[aba]} admin={dados.admin} ocupado={ocupado}
            vazio={{ proximas: "Nenhuma reunião marcada pela frente.", registrar: "Nada para registrar: todas as reuniões passadas já têm resultado.", historico: "Nenhuma reunião encerrada ainda." }[aba]}
            onResultado={(r, resultado) => executar(`/reunioes/${r.id}/resultado`, { resultado }, "Resultado da venda registrado.")}
            atendentes={atendentes}
            onTransferir={(r, closerId) => executar(`/reunioes/${r.id}/transferir`, { closerId }, "Reunião transferida. O horário anterior voltou a ficar livre.")}
            onStatus={(r, status, reabrir) => executar(`/reunioes/${r.id}/status`, { status, reabrir },
              (res) => status === "cancelada" ? (res.reaberto ? "Reunião cancelada. O horário voltou para o quiz." : "Reunião cancelada. O horário saiu da agenda.") : "Resultado registrado.")} />}
      </div>
    </div>
  );
}

function Cabecalho({ onAtualizar, carregando, admin }) {
  return (
    <div className="ag-cabecalho">
      <div>
        <h2 className="vx-disp">Agenda comercial</h2>
        <p className="vx-mut">{admin ? "Reuniões das empresas que concluíram o quiz, de todos os closers." : "Suas reuniões com as empresas que concluíram o quiz."} Horários em {fuso}.</p>
      </div>
      <button type="button" className="vx-btn vx-btn-ghost" onClick={onAtualizar} disabled={carregando}><RefreshCw size={15} aria-hidden="true" /> {carregando ? "Atualizando…" : "Atualizar"}</button>
    </div>
  );
}

function Resultados({ dados }) {
  const porCloser = new Map();
  for (const r of dados.reunioes) {
    const linha = porCloser.get(r.closerId) || { nome: r.closer, ativo: r.closerAtivo, agendada: 0, realizada: 0, nao_compareceu: 0, cancelada: 0 };
    linha[r.status] = (linha[r.status] || 0) + 1;
    porCloser.set(r.closerId, linha);
  }
  const porCampanha = new Map();
  for (const r of dados.reunioes) {
    const chave = r.origem?.utm_campaign || (r.origem?.fbclid ? "Meta (sem utm_campaign)" : "Sem campanha identificada");
    const linha = porCampanha.get(chave) || { total: 0, realizada: 0 };
    linha.total++; if (r.status === "realizada") linha.realizada++;
    porCampanha.set(chave, linha);
  }
  if (!dados.reunioes.length) return null;
  return (
    <details className="vx-card ag-bloco">
      <summary>Resultados por closer e por campanha</summary>
      <div className="vx-table-wrap">
        <table className="vx-table ag-tabela">
          <thead><tr><th>Closer</th><th>Agendadas</th><th>Realizadas</th><th>Não compareceu</th><th>Canceladas</th></tr></thead>
          <tbody>{[...porCloser.values()].map((l) => (
            <tr key={l.nome}><td>{l.nome}{!l.ativo && <span className="vx-badge vx-badge-muted ag-ml">sem acesso</span>}</td><td>{l.agendada}</td><td>{l.realizada}</td><td>{l.nao_compareceu}</td><td>{l.cancelada}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="vx-table-wrap">
        <table className="vx-table ag-tabela">
          <thead><tr><th>Campanha (utm_campaign)</th><th>Reuniões</th><th>Realizadas</th></tr></thead>
          <tbody>{[...porCampanha.entries()].map(([c, l]) => <tr key={c}><td>{c}</td><td>{l.total}</td><td>{l.realizada}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function Closers({ closers, reunioes, ocupado, onAlterar }) {
  const [busca, setBusca] = useState("");
  const ativos = closers.filter((c) => c.ativo);
  // Abre sozinho só quando ninguém tem acesso; depois, quem decide é o admin.
  const [aberto, setAberto] = useState(() => !closers.some((c) => c.ativo));
  const termo = busca.trim().toLowerCase();
  const lista = termo ? closers.filter((c) => c.nome.toLowerCase().includes(termo)) : closers.filter((c) => c.ativo || c.perfil === "closer");
  const futuras = (id) => reunioes.filter((r) => r.closerId === id && r.status === "agendada" && r.fim > Date.now()).length;
  return (
    <details className="vx-card ag-bloco" open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)}>
      <summary>Closers com acesso à agenda ({ativos.length})</summary>
      <p className="vx-mut ag-texto">Libere só quem atende as empresas da RYCS. Revogar tira os horários livres do quiz e o acesso do closer; as reuniões continuam aqui para você.</p>
      <label className="vx-label" htmlFor="ag-busca">Buscar profissional aprovado</label>
      <input id="ag-busca" className="vx-input ag-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do profissional" />
      {!termo && <p className="vx-mut ag-texto">Mostrando quem tem acesso e os profissionais com perfil Closer. Busque pelo nome para liberar outro perfil.</p>}
      <ul className="ag-closers">
        {lista.slice(0, 60).map((c) => (
          <li key={c.id}>
            <div>
              <strong>{c.nome}</strong>
              <span className="vx-mut">{c.perfil ? c.perfil.toUpperCase() : "—"}{c.status !== "aprovado" && " · não aprovado"}{futuras(c.id) ? ` · ${futuras(c.id)} reunião(ões) futura(s)` : ""}</span>
            </div>
            {c.ativo
              ? <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={ocupado} onClick={() => onAlterar(c, false)}>Revogar acesso</button>
              : <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" disabled={ocupado || c.status !== "aprovado"} onClick={() => onAlterar(c, true)}>Liberar</button>}
          </li>
        ))}
        {!lista.length && <li className="vx-mut">Nenhum profissional encontrado.</li>}
      </ul>
    </details>
  );
}

const DIAS_SEMANA = [["Seg", 1], ["Ter", 2], ["Qua", 3], ["Qui", 4], ["Sex", 5], ["Sáb", 6], ["Dom", 0]];
const descreverDias = (dias) => {
  const d = [...dias].sort();
  if (d.join() === "1,2,3,4,5") return "Seg a sex";
  if (d.length === 7) return "Todos os dias";
  return DIAS_SEMANA.filter(([, n]) => d.includes(n)).map(([t]) => t).join(", ");
};

// Disponibilidade semanal: os horários livres se renovam sozinhos (próximas
// 2 semanas, horário de Brasília). A empresa não vê quem atende.
function Disponibilidade({ admin, eu, atendentes, regras, ocupado, onSalvar, onDesativar }) {
  const [closerId, setCloserId] = useState(eu);
  const formDe = (id) => {
    const r = regras.find((x) => x.closerId === id && x.ativo);
    return { dias: r?.dias || [1, 2, 3, 4, 5], inicio: r?.inicio || "08:00", fim: r?.fim || "20:00", duracao: r?.duracao || 30 };
  };
  const [form, setForm] = useState(() => formDe(eu));
  useEffect(() => { setForm(formDe(closerId)); }, [closerId, regras]); // eslint-disable-line react-hooks/exhaustive-deps
  const ativas = regras.filter((r) => r.ativo);
  const alternarDia = (n) => setForm((f) => ({ ...f, dias: f.dias.includes(n) ? f.dias.filter((d) => d !== n) : [...f.dias, n] }));
  return (
    <form className="vx-card ag-bloco" onSubmit={(e) => { e.preventDefault(); onSalvar({ closerId, ...form }); }} noValidate>
      <h3>Disponibilidade semanal</h3>
      <p className="vx-mut ag-texto">Os horários livres são gerados sozinhos para as próximas 2 semanas, no horário de Brasília. A empresa vê só “um especialista da RYCS”; vocês redistribuem as reuniões depois, se precisar.</p>
      {ativas.length > 0 && (
        <ul className="ag-regras">
          {ativas.map((r) => (
            <li key={r.closerId}>
              <span><strong>{r.closerId === eu ? (admin ? "Minha agenda (Equipe RYCS)" : "Minha agenda") : r.closer}</strong> · {descreverDias(r.dias)}, {r.inicio} às {r.fim}, reuniões de {r.duracao} min</span>
              <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={ocupado} onClick={() => onDesativar(r.closerId)}>Desativar</button>
            </li>
          ))}
        </ul>
      )}
      <div className="ag-campos">
        {admin && (
          <div><label className="vx-label" htmlFor="ag-disp-pessoa">Agenda de</label>
            <select id="ag-disp-pessoa" className="vx-input" value={closerId} onChange={(e) => setCloserId(e.target.value)}>
              {atendentes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
        )}
        <div><label className="vx-label" htmlFor="ag-disp-das">Das</label><input id="ag-disp-das" className="vx-input" type="time" step={900} value={form.inicio} onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))} /></div>
        <div><label className="vx-label" htmlFor="ag-disp-ate">Até</label><input id="ag-disp-ate" className="vx-input" type="time" step={900} value={form.fim} onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))} /></div>
        <div><label className="vx-label" htmlFor="ag-disp-duracao">Cada reunião</label>
          <select id="ag-disp-duracao" className="vx-input" value={form.duracao} onChange={(e) => setForm((f) => ({ ...f, duracao: Number(e.target.value) }))}>
            {DURACOES_AGENDA.map((n) => <option key={n} value={n}>{n} minutos</option>)}
          </select></div>
      </div>
      <div className="ag-dias" role="group" aria-label="Dias da semana">
        {DIAS_SEMANA.map(([t, n]) => (
          <button key={n} type="button" aria-pressed={form.dias.includes(n)} className={`vx-btn vx-btn-sm ${form.dias.includes(n) ? "vx-btn-primary" : "vx-btn-ghost"}`} onClick={() => alternarDia(n)}>{t}</button>
        ))}
      </div>
      <button type="submit" className="vx-btn vx-btn-primary ag-salvar" disabled={ocupado}>Salvar disponibilidade</button>
    </form>
  );
}

function PublicarHorarios({ admin, closers, padrao, ocupado, onPublicar }) {
  const hoje = chaveDia(Date.now());
  const [form, setForm] = useState({ closerId: padrao || "", data: hoje, das: "", ate: "", duracao: 30 });
  const [erroLocal, setErroLocal] = useState("");
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: campo === "duracao" ? Number(e.target.value) : e.target.value }));
  async function enviar(e) {
    e.preventDefault();
    setErroLocal("");
    if (admin && !form.closerId) return setErroLocal("Escolha o closer.");
    if (!form.data || !form.das) return setErroLocal("Informe o dia e o horário de início.");
    const inicio = new Date(`${form.data}T${form.das}`).getTime();
    const fim = form.ate ? new Date(`${form.data}T${form.ate}`).getTime() : undefined;
    if (fim != null && fim <= inicio) return setErroLocal("O horário final precisa ser depois do inicial.");
    const ok = await onPublicar({ inicio, ...(fim != null && { fim }), duracao: form.duracao, ...(admin && { closerId: form.closerId }) });
    if (ok) setForm((f) => ({ ...f, das: "", ate: "" }));
  }
  return (
    <form className="vx-card ag-bloco ag-publicar" onSubmit={enviar} noValidate>
      <h3>Abrir horários avulsos</h3>
      <p className="vx-mut ag-texto">Para um dia fora da disponibilidade semanal. Preencha “até” para abrir vários horários seguidos; deixe vazio para abrir um só. Horários que batem com outro compromisso são pulados.</p>
      <div className="ag-campos">
        {admin && (
          <div><label className="vx-label" htmlFor="ag-closer">Agenda de</label>
            <select id="ag-closer" className="vx-input" value={form.closerId} onChange={mudar("closerId")}>
              {closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
        )}
        <div><label className="vx-label" htmlFor="ag-data">Dia</label><input id="ag-data" className="vx-input" type="date" min={hoje} value={form.data} onChange={mudar("data")} /></div>
        <div><label className="vx-label" htmlFor="ag-das">Das</label><input id="ag-das" className="vx-input" type="time" step={300} value={form.das} onChange={mudar("das")} /></div>
        <div><label className="vx-label" htmlFor="ag-ate">Até (opcional)</label><input id="ag-ate" className="vx-input" type="time" step={300} value={form.ate} onChange={mudar("ate")} /></div>
        <div><label className="vx-label" htmlFor="ag-duracao">Duração de cada reunião</label>
          <select id="ag-duracao" className="vx-input" value={form.duracao} onChange={mudar("duracao")}>
            {DURACOES_AGENDA.map((n) => <option key={n} value={n}>{n} minutos</option>)}
          </select></div>
        <button type="submit" className="vx-btn vx-btn-primary" disabled={ocupado}>Publicar</button>
      </div>
      {erroLocal && <p className="ag-erro" role="alert">{erroLocal}</p>}
    </form>
  );
}

function HorariosLivres({ horarios, admin, ocupado, onRetirar }) {
  if (!horarios.length) return <div className="vx-card ag-vazio">Nenhum horário livre. Use “Abrir horários” acima.</div>;
  const porDia = new Map();
  for (const h of horarios) { const k = chaveDia(h.inicio); porDia.set(k, [...(porDia.get(k) || []), h]); }
  return [...porDia.values()].map((lista) => (
    <section key={chaveDia(lista[0].inicio)} className="ag-dia">
      <h4>{diaLongo(lista[0].inicio)}</h4>
      <ul className="ag-slots">
        {lista.map((h) => (
          <li key={h.id} className="vx-card">
            <span><strong>{hora(h.inicio)}–{hora(h.fim)}</strong>{admin && <span className="vx-mut"> · {h.closer}</span>}</span>
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={ocupado} onClick={() => onRetirar(h)} aria-label={`Retirar horário das ${hora(h.inicio)} de ${diaLongo(h.inicio)}`}>Retirar</button>
          </li>
        ))}
      </ul>
    </section>
  ));
}

function ListaReunioes({ lista, admin, ocupado, vazio, onStatus, onResultado, atendentes, onTransferir }) {
  if (!lista.length) return <div className="vx-card ag-vazio">{vazio}</div>;
  return lista.map((r) => <Reuniao key={r.id} r={r} admin={admin} ocupado={ocupado} onStatus={onStatus} onResultado={onResultado} atendentes={atendentes} onTransferir={onTransferir} />);
}

const RESULTADOS = [["fechou", "Venda fechada"], ["negociando", "Em negociação"], ["nao_fechou", "Não fechou"]];
const pct = (parte, total) => (total ? `${Math.round((parte / total) * 100)}%` : "—");

// Cada resposta do diagnóstico cruzada com o que aconteceu depois. Com
// volume, mostra quais respostas viram venda e quem priorizar.
function Aprendizado({ dados }) {
  if (!dados) return null;
  return (
    <div className="ag-aprendizado">
      <div className="vx-card ag-bloco">
        <h3>O que o diagnóstico está ensinando</h3>
        <p className="vx-mut ag-texto">
          {dados.diagnosticos} diagnóstico(s) com pré-cadastro nesta versão do quiz. Para cada resposta: quantas empresas a escolheram,
          quantas agendaram, compareceram e fecharam (o closer registra a venda na reunião). São contagens reais, não previsão.
          Com menos de 10 empresas numa resposta, a taxa ainda não diz muito.
        </p>
      </div>
      {dados.perguntas.map((p) => (
        <div key={p.id} className="vx-card ag-bloco">
          <h4 className="ag-aprendizado-titulo">{p.titulo}</h4>
          <div className="vx-table-wrap">
            <table className="vx-table ag-tabela">
              <thead><tr><th>Resposta</th><th>Empresas</th><th>Agendaram</th><th>Compareceram</th><th>Fecharam</th></tr></thead>
              <tbody>{p.opcoes.map((o) => (
                <tr key={o.id} className={o.total < 10 ? "ag-amostra-pequena" : ""}>
                  <td>{o.texto}</td><td>{o.total}</td>
                  <td>{o.agendaram} <span className="vx-mut">({pct(o.agendaram, o.total)})</span></td>
                  <td>{o.compareceram} <span className="vx-mut">({pct(o.compareceram, o.total)})</span></td>
                  <td><strong>{o.fecharam}</strong> <span className="vx-mut">({pct(o.fecharam, o.total)})</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// Empresas que fizeram o quiz e o pré-cadastro, mas não reservaram (sem
// horário livre, desistiram ou não confirmaram o WhatsApp).
function ListaPrecadastros({ lista }) {
  if (!lista.length) return <div className="vx-card ag-vazio">Nenhum pré-cadastro parado: todos viraram reunião.</div>;
  return lista.map((p) => {
    const tel = p.whatsapp?.numero ? `+${p.whatsapp.numero}` : p.telefone;
    const wa = whatsapp(tel);
    const segmento = p.respostas.find((x) => x.id === "segmento")?.resposta;
    const origem = ORIGEM(p.origem);
    return (
      <article key={p.id} className="vx-card ag-reuniao">
        <span className="ag-quando ag-quando-texto">Pré-cadastro em {new Date(p.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
        <h3>{p.empresa}</h3>
        <div className="ag-tags">
          <span className="vx-badge vx-badge-muted">Sem reunião</span>
          {segmento && <span className="vx-badge vx-badge-muted">{segmento}</span>}
          {p.whatsapp ? <span className="vx-badge vx-badge-indigo">WhatsApp verificado</span> : <span className="vx-badge vx-badge-amber">WhatsApp não verificado</span>}
        </div>
        <div className="ag-contato">
          <span><strong>{p.nome}</strong></span>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} aria-hidden="true" /> WhatsApp {telefoneLegivel(tel)}</a>}
          <a href={`mailto:${p.email}`}><Mail size={15} aria-hidden="true" /> {p.email}</a>
        </div>
        {origem && <p className="vx-mut ag-origem">Origem: {origem}</p>}
        <LeituraRespostas respostas={p.respostas} criadoEm={p.criadoEm} />
      </article>
    );
  });
}

function Nivel({ n }) {
  if (!n) return null;
  const tom = n >= 4 ? "forte" : n === 3 ? "medio" : "fraco";
  return (
    <span className={`ag-nivel ag-nivel-${tom}`} aria-label={`Sinal ${n} de 5`} title={`Sinal ${n} de 5 (escala da planilha de qualificação)`}>
      {[1, 2, 3, 4, 5].map((k) => <i key={k} className={k <= n ? "on" : ""} />)}
    </span>
  );
}

function LeituraRespostas({ respostas = [], quizVersao, criadoEm }) {
  const porId = Object.fromEntries(respostas.map((x) => [x.id, x]));
  const r = { respostas, quizVersao, criadoEm };
  return (
    <>
      <div className="ag-leitura">
        {DIMENSOES_QUIZ.map((d) => {
          const itens = d.perguntas.map((id) => porId[id]).filter(Boolean);
          if (!itens.length) return null;
          return (
            <div key={d.chave} className="ag-dimensao">
              <h4>{d.titulo}</h4>
              {itens.map((x) => <p key={x.id}><Nivel n={x.nivel} /><span>{x.resposta}</span></p>)}
            </div>
          );
        })}
      </div>

      <details className="ag-respostas">
        <summary>Todas as respostas do quiz ({r.respostas.length})</summary>
        {ETAPAS_QUIZ.map((e) => {
          const itens = r.respostas.filter((x) => x.etapa === e.chave);
          if (!itens.length) return null;
          return (
            <dl key={e.chave}>
              <h5>{e.titulo}</h5>
              {itens.map((x) => <div key={x.id}><dt>{x.criterio} — {x.pergunta}</dt><dd><Nivel n={x.nivel} /> {x.resposta}</dd></div>)}
            </dl>
          );
        })}
        <p className="vx-mut ag-texto">Texto exatamente como a empresa leu{r.quizVersao ? ` (versão ${r.quizVersao} do quiz)` : ""}. Recebida em {new Date(r.criadoEm).toLocaleString("pt-BR")}.</p>
      </details>
    </>
  );
}

// Admin passa a reunião para outro profissional (rodízio por trás do quiz).
function Transferir({ r, atendentes, ocupado, onTransferir }) {
  const opcoes = atendentes.filter((c) => c.id !== r.closerId);
  const [destino, setDestino] = useState("");
  if (!opcoes.length) return null;
  return (
    <div className="ag-acoes ag-transferir">
      <label className="vx-label" htmlFor={`ag-tr-${r.id}`}>Transferir para</label>
      <select id={`ag-tr-${r.id}`} className="vx-input" value={destino} onChange={(e) => setDestino(e.target.value)}>
        <option value="">Escolha quem atende</option>
        {opcoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={ocupado || !destino} onClick={() => onTransferir(r, destino)}>Transferir</button>
    </div>
  );
}

function Reuniao({ r, admin, ocupado, onStatus, onResultado, atendentes = [], onTransferir }) {
  const [cancelando, setCancelando] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const porId = Object.fromEntries((r.respostas || []).map((x) => [x.id, x]));
  const segmento = porId.segmento?.resposta;
  const status = STATUS[r.status] || STATUS.agendada;
  const comecou = r.inicio <= Date.now();
  const wa = whatsapp(r.telefone);
  const origem = ORIGEM(r.origem);
  return (
    <article className="vx-card ag-reuniao">
      <header>
        <div>
          <span className="ag-quando">{dia(r.inicio)} · {hora(r.inicio)}–{hora(r.fim)}</span>
          <h3>{r.empresa}</h3>
          <div className="ag-tags">
            <span className={`vx-badge vx-badge-${status.tone}`}>{status.txt}</span>
            {segmento && <span className="vx-badge vx-badge-muted">{segmento}</span>}
            {admin && <span className="vx-badge vx-badge-muted">Closer: {r.closer}</span>}
            {admin && !r.closerAtivo && r.status === "agendada" && <span className="vx-badge vx-badge-amber">Closer sem acesso</span>}
            {r.whatsVerificado ? <span className="vx-badge vx-badge-indigo">WhatsApp verificado</span> : <span className="vx-badge vx-badge-amber">WhatsApp não verificado</span>}
          </div>
        </div>
      </header>
      <div className="ag-contato">
        <span><strong>{r.nome}</strong></span>
        {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} aria-hidden="true" /> WhatsApp {telefoneLegivel(r.telefone)}</a>}
        <a href={`tel:+${comDdi(r.telefone)}`}><Phone size={15} aria-hidden="true" /> Ligar</a>
        <a href={`mailto:${r.email}`}><Mail size={15} aria-hidden="true" /> {r.email}</a>
      </div>
      {origem && <p className="vx-mut ag-origem">Origem: {origem}</p>}

      <LeituraRespostas respostas={r.respostas} quizVersao={r.quizVersao} criadoEm={r.criadoEm} />

      {r.status === "realizada" && (
        <div className="ag-acoes" role="group" aria-label="Resultado da venda">
          <span className="ag-dica"><strong>Resultado da venda:</strong></span>
          {RESULTADOS.map(([valor, txt]) => (
            <button key={valor} type="button" aria-pressed={r.resultadoVenda === valor} disabled={ocupado}
              className={`vx-btn vx-btn-sm ${r.resultadoVenda === valor ? "vx-btn-primary" : "vx-btn-ghost"}`}
              onClick={() => onResultado(r, valor)}>{txt}</button>
          ))}
        </div>
      )}
      {admin && r.status === "agendada" && r.fim > Date.now() && !cancelando && <Transferir r={r} atendentes={atendentes} ocupado={ocupado} onTransferir={onTransferir} />}
      {r.status === "agendada" && !cancelando && (
        <div className="ag-acoes">
          <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" disabled={ocupado || !comecou} onClick={() => onStatus(r, "realizada")}>Realizada</button>
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={ocupado || !comecou} onClick={() => onStatus(r, "nao_compareceu")}>Não compareceu</button>
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={ocupado} onClick={() => setCancelando(true)}>Cancelar reunião</button>
          {!comecou && <span className="vx-mut ag-dica">O resultado é registrado depois do horário.</span>}
        </div>
      )}
      {cancelando && (
        <div className="ag-cancelar" role="group" aria-label="Cancelar reunião">
          <p>Cancelar a conversa com <strong>{r.empresa}</strong>? Avise {r.nome} pelo WhatsApp ou e-mail: a plataforma não envia aviso. A reunião fica no histórico.</p>
          {r.inicio > Date.now() + 3600000 && (
            <label className="ag-check"><input type="checkbox" checked={reabrir} onChange={(e) => setReabrir(e.target.checked)} /> Devolver o horário ao quiz para outra empresa</label>
          )}
          <div className="ag-acoes">
            <button type="button" className="vx-btn vx-btn-primary vx-btn-sm" disabled={ocupado} onClick={async () => { await onStatus(r, "cancelada", reabrir); setCancelando(false); }}>Confirmar cancelamento</button>
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setCancelando(false)}>Voltar</button>
          </div>
        </div>
      )}
    </article>
  );
}
