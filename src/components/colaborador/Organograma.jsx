// Colaboradores em cards: áreas da empresa, cargos dentro de cada área e as
// pessoas em cada cargo. O cargo guarda tipo de contrato, jornada, horário e
// tarefas; adicionar alguém pede só e-mail, CPF, data de início e salário.
import { useCallback, useEffect, useState } from "react";
import { Megaphone, Building2, Calculator, Target, Users, Plus, Pencil, Trash2, X } from "lucide-react";
import { api, apiPatch, apiPut, apiDelete } from "../../lib/api.js";
import { VINCULOS, DADOS_EXIGIDOS, DIAS_SEMANA } from "../../../shared/colaboradores.js";
import { ALVO, DiasPrevistos } from "./comum.jsx";

const ICONES = { megaphone: Megaphone, building: Building2, calculator: Calculator, target: Target };
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const reaisParaCents = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const iniciais = (nome) => String(nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const TOM_VINCULO = { clt: "vx-badge-muted", formacao: "vx-badge-indigo", aprendiz: "vx-badge-indigo", estagio: "vx-badge-amber", outro: "vx-badge-muted" };
const CURTO = { clt: "CLT", formacao: "Em formação", aprendiz: "Aprendiz", estagio: "Estágio", outro: "Autônomo" };

function Campo({ id, label, children, ajuda }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="vx-label" htmlFor={id}>{label}</label>
      {children}
      {ajuda && <div className="vx-mut" style={{ fontSize: 12, marginTop: 3 }}>{ajuda}</div>}
    </div>
  );
}

export default function Organograma({ aviso, abrirPessoa }) {
  const [d, setD] = useState(null);
  const [adicionando, setAdicionando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [novoCargo, setNovoCargo] = useState(null);
  const [novaArea, setNovaArea] = useState("");
  const [empresaAberta, setEmpresaAberta] = useState(false);
  const carregar = useCallback(async () => {
    const r = await api("/admin/colaboradores-organograma");
    if (r?.error) return aviso(r.error);
    setD(r);
  }, [aviso]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!d) return <div className="vx-spinner" />;

  const criarArea = async (e) => {
    e.preventDefault();
    const r = await api("/admin/colaboradores-areas", { nome: novaArea });
    if (r?.error) return aviso(r.error);
    setNovaArea("");
    carregar();
  };
  const renomearArea = async (a) => {
    const nome = window.prompt("Novo nome da área", a.nome);
    if (!nome) return;
    const r = await apiPatch(`/admin/colaboradores-areas/${a.id}`, { nome });
    if (r?.error) return aviso(r.error);
    carregar();
  };
  const removerArea = async (a) => {
    if (!window.confirm(`Remover a área ${a.nome} e os cargos vazios dela?`)) return;
    const r = await apiDelete(`/admin/colaboradores-areas/${a.id}`);
    if (r?.error) return aviso(r.error);
    carregar();
  };

  return (
    <>
      {!d.empresaCompleta && (empresaAberta
        ? <DadosEmpresa inicial={d.empresa} aviso={aviso} pronto={() => { setEmpresaAberta(false); carregar(); }} />
        : (
          <div className="vx-notice vx-notice-amber" role="status" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1 }}>Falta preencher os dados da empresa (razão social, CNPJ…) para os contratos saírem.</span>
            <button className="vx-btn vx-btn-sm" style={ALVO} onClick={() => setEmpresaAberta(true)}>Preencher agora</button>
          </div>
        ))}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 14, alignItems: "start" }}>
        {d.areas.map((a) => {
          const Icone = ICONES[a.icone] || Users;
          const total = a.cargos.reduce((s, c) => s + c.pessoas.length, 0);
          return (
            <section key={a.id} className="vx-card" style={{ padding: 16 }} aria-labelledby={`area-${a.id}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icone size={18} color="var(--icon-secondary)" aria-hidden="true" />
                <h3 id={`area-${a.id}`} className="vx-disp" style={{ fontSize: 16, margin: 0, flex: 1 }}>{a.nome}</h3>
                {total > 0 && <span className="vx-badge vx-badge-muted">{total}</span>}
                <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, minWidth: 44 }} onClick={() => renomearArea(a)} aria-label={`Renomear área ${a.nome}`}><Pencil size={14} /></button>
                <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, minWidth: 44 }} onClick={() => removerArea(a)} aria-label={`Remover área ${a.nome}`}><Trash2 size={14} /></button>
              </div>

              {a.cargos.map((c) => (
                <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13.5, flex: 1, minWidth: 120 }}>{c.nome}</b>
                    <span className={`vx-badge ${TOM_VINCULO[c.vinculo]}`}>{CURTO[c.vinculo]}</span>
                    <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, minWidth: 44 }} onClick={() => setEditando(editando === c.id ? null : c.id)} aria-label={`Editar cargo ${c.nome}`}><Pencil size={14} /></button>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {c.pessoas.map((p) => <ChipPessoa key={p.id} p={p} onClick={() => abrirPessoa(p.id)} />)}
                    <button type="button" className="vx-btn vx-btn-sm" style={{ ...ALVO, borderStyle: "dashed" }} onClick={() => setAdicionando(adicionando === c.id ? null : c.id)} aria-expanded={adicionando === c.id}>
                      <Plus size={14} aria-hidden="true" /> Adicionar pessoa
                    </button>
                  </div>
                  {adicionando === c.id && <AdicionarPessoa cargo={c} aviso={aviso} cancelar={() => setAdicionando(null)} pronto={() => { setAdicionando(null); carregar(); }} />}
                  {editando === c.id && <EditarCargo cargo={c} aviso={aviso} fechar={() => setEditando(null)} pronto={() => { setEditando(null); carregar(); }} />}
                </div>
              ))}

              {novoCargo === a.id
                ? <NovoCargo area={a} exemplos={d.exemplos} aviso={aviso} cancelar={() => setNovoCargo(null)} pronto={() => { setNovoCargo(null); carregar(); }} />
                : <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, marginTop: 10, width: "100%" }} onClick={() => setNovoCargo(a.id)}><Plus size={14} aria-hidden="true" /> Novo cargo</button>}
            </section>
          );
        })}

        <form onSubmit={criarArea} className="vx-card" style={{ padding: 16, borderStyle: "dashed" }}>
          <label className="vx-label" htmlFor="nova-area">Nova área</label>
          <input id="nova-area" className="vx-input" value={novaArea} onChange={(e) => setNovaArea(e.target.value)} placeholder="Tecnologia, Operações, Atendimento…" style={ALVO} />
          <button className="vx-btn vx-btn-sm" style={{ ...ALVO, marginTop: 8, width: "100%" }} disabled={!novaArea.trim()}><Plus size={14} aria-hidden="true" /> Criar área</button>
        </form>
      </div>

      {d.semCargo.length > 0 && (
        <section className="vx-card" style={{ padding: 16, marginTop: 14 }} aria-labelledby="sem-cargo">
          <h3 id="sem-cargo" className="vx-disp" style={{ fontSize: 15, margin: "0 0 8px" }}>Sem cargo</h3>
          <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 8px" }}>Abra a pessoa e escolha o cargo em "Regra e cadastro".</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{d.semCargo.map((p) => <ChipPessoa key={p.id} p={p} onClick={() => abrirPessoa(p.id)} />)}</div>
        </section>
      )}
      {d.encerrados.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="vx-mut" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontSize: 13 }}>Vínculos encerrados ({d.encerrados.length})</summary>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{d.encerrados.map((p) => <ChipPessoa key={p.id} p={p} onClick={() => abrirPessoa(p.id)} />)}</div>
        </details>
      )}
    </>
  );
}

function ChipPessoa({ p, onClick }) {
  const status = !p.contratoAssinado ? { txt: "contrato pendente", cor: "var(--amber)" }
    : !p.termoAceito ? { txt: "termo pendente", cor: "var(--amber)" }
      : p.alertas + p.avisos > 0 ? { txt: `${p.alertas + p.avisos} alerta(s)`, cor: "var(--red)" }
        : { txt: p.nota != null ? `nota ${p.nota}` : "começando", cor: "var(--muted)" };
  return (
    <button type="button" onClick={onClick} className="vx-btn vx-btn-sm" style={{ ...ALVO, gap: 8, paddingLeft: 6 }} aria-label={`${p.nome}, ${status.txt}. Abrir painel`}>
      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--brand-50)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600 }}>{iniciais(p.nome)}</span>
      <span style={{ textAlign: "left", lineHeight: 1.2 }}>
        <span style={{ display: "block", fontSize: 13 }}>{p.nome.split(" ")[0]}</span>
        <span style={{ display: "block", fontSize: 11.5, color: status.cor }}>{status.txt}</span>
      </span>
    </button>
  );
}

// Cadastro rápido. Usado no card do cargo e na ficha do profissional
// (onde a conta já é conhecida e o cargo é escolhido numa lista).
export function AdicionarPessoa({ cargo: cargoFixo, cargos = [], usuario: usuarioFixo, aviso, cancelar, pronto }) {
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState([]);
  const [usuario, setUsuario] = useState(usuarioFixo || null);
  const [cargoId, setCargoId] = useState(cargoFixo?.id || "");
  const [f, setF] = useState({ nome: usuarioFixo?.nomeProfissional || "", cpf: usuarioFixo?.documento || "", dataInicio: hoje(), salario: "" });
  const [dados, setDados] = useState({});
  const [salvando, setSalvando] = useState(false);
  const cargo = cargoFixo || cargos.find((c) => c.id === cargoId);
  const exig = cargo ? DADOS_EXIGIDOS[cargo.vinculo] || {} : {};
  const pref = `ad-${cargoFixo?.id || "x"}`;

  const procurar = async (e) => {
    e.preventDefault();
    const r = await api(`/admin/colaboradores-usuarios?email=${encodeURIComponent(busca.trim())}`);
    const lista = r?.usuarios || [];
    setEncontrados(lista);
    if (!lista.length) aviso("Ninguém com esse e-mail. A pessoa precisa criar a conta de profissional em rycs.pro antes.");
    if (lista.length === 1 && !lista[0].jaColaborador) escolher(lista[0]);
  };
  const escolher = (u) => { setUsuario(u); setF((x) => ({ ...x, nome: u.nomeProfissional || x.nome, cpf: u.documento || x.cpf })); };
  const salvar = async (e) => {
    e.preventDefault();
    if (!cargo) return aviso("Escolha o cargo.");
    setSalvando(true);
    const r = await api("/admin/colaboradores", {
      userId: usuario.id, cargoId: cargo.id, nome: f.nome, cpf: f.cpf, dataInicio: f.dataInicio, fixoCents: reaisParaCents(f.salario), dados,
    });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso(r.contrato?.erro ? `${f.nome.split(" ")[0]} entrou em ${cargo.nome}. ${r.contrato.erro}` : `${f.nome.split(" ")[0]} entrou em ${cargo.nome}. O contrato já está esperando a assinatura.`);
    pronto?.(r.colaborador.id);
  };
  const rotuloSalario = cargo?.vinculo === "estagio" ? "Bolsa por mês (R$)" : cargo?.vinculo === "outro" ? "Fixo por mês, se houver (R$)" : "Salário por mês (R$)";

  return (
    <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: 12, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <b style={{ fontSize: 13.5, flex: 1 }}>{cargo ? `Adicionar em ${cargo.nome}` : "Adicionar como colaborador"}</b>
        {cancelar && <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, minWidth: 44 }} onClick={cancelar} aria-label="Fechar"><X size={14} /></button>}
      </div>
      {cargo && <p className="vx-mut" style={{ fontSize: 12, margin: "0 0 10px" }}>Contrato {VINCULOS[cargo.vinculo]}, {cargo.jornadaHoras ? `${cargo.jornadaHoras} h por semana, ` : ""}{(cargo.regra?.diasPrevistos || []).map((x) => DIAS_SEMANA[x].slice(0, 3)).join(", ")}{cargo.tarefas?.length ? ` e ${cargo.tarefas.length} tarefa(s) do cargo` : ""}. Tudo vem do cargo.</p>}

      {!usuario ? (
        <form onSubmit={procurar}>
          <Campo id={`${pref}-email`} label="E-mail da conta na plataforma">
            <div style={{ display: "flex", gap: 6 }}>
              <input id={`${pref}-email`} className="vx-input" type="email" required value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome@exemplo.com" style={{ ...ALVO, flex: 1 }} />
              <button className="vx-btn vx-btn-sm" style={ALVO}>Buscar</button>
            </div>
          </Campo>
          {encontrados.length > 1 && encontrados.map((u) => (
            <button key={u.id} type="button" className="vx-btn vx-btn-sm" style={{ ...ALVO, width: "100%", justifyContent: "flex-start", marginBottom: 4 }} disabled={u.jaColaborador} onClick={() => escolher(u)}>{u.email}{u.jaColaborador ? " · já é colaborador" : ""}</button>
          ))}
        </form>
      ) : (
        <form onSubmit={salvar}>
          {!usuarioFixo && <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 8px" }}>Conta: <b>{usuario.email}</b> <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={ALVO} onClick={() => setUsuario(null)}>Trocar</button></p>}
          {!cargoFixo && (
            <Campo id={`${pref}-cargo`} label="Cargo">
              <select id={`${pref}-cargo`} className="vx-input" required value={cargoId} onChange={(e) => setCargoId(e.target.value)} style={ALVO}>
                <option value="">Escolha…</option>
                {cargos.map((c) => <option key={c.id} value={c.id}>{c.area} · {c.nome} ({CURTO[c.vinculo]})</option>)}
              </select>
            </Campo>
          )}
          <div className="vx-g2" style={{ gap: 10 }}>
            <Campo id={`${pref}-nome`} label="Nome completo"><input id={`${pref}-nome`} className="vx-input" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} style={ALVO} /></Campo>
            <Campo id={`${pref}-cpf`} label="CPF"><input id={`${pref}-cpf`} className="vx-input" required inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} placeholder="000.000.000-00" style={ALVO} /></Campo>
            <Campo id={`${pref}-ini`} label="Começou a trabalhar em" ajuda="Se já trabalha, use a data real do primeiro dia."><input id={`${pref}-ini`} type="date" className="vx-input" required value={f.dataInicio} onChange={(e) => setF({ ...f, dataInicio: e.target.value })} style={ALVO} /></Campo>
            <Campo id={`${pref}-sal`} label={rotuloSalario}><input id={`${pref}-sal`} className="vx-input" inputMode="decimal" required={cargo?.vinculo !== "outro"} value={f.salario} onChange={(e) => setF({ ...f, salario: e.target.value })} placeholder="0,00" style={ALVO} /></Campo>
            {Object.entries(exig).map(([k, rot]) => (
              <Campo key={k} id={`${pref}-${k}`} label={rot}>
                <input id={`${pref}-${k}`} className="vx-input" required type={k === "dataNascimento" || k === "dataFim" ? "date" : "text"} value={dados[k] || ""} onChange={(e) => setDados({ ...dados, [k]: e.target.value })} style={ALVO} />
              </Campo>
            ))}
          </div>
          {cargo?.vinculo === "aprendiz" && <p className="vx-mut" style={{ fontSize: 12, margin: "0 0 8px" }}>Aprendiz pela lei precisa estar matriculado num curso de aprendizagem (SENAI, SENAC ou entidade credenciada) e ter de 14 a 24 anos. Sem curso, use um cargo "em formação".</p>}
          <button className="vx-btn vx-btn-primary" style={ALVO} disabled={salvando}>{salvando ? "Adicionando…" : "Adicionar e enviar contrato"}</button>
        </form>
      )}
    </div>
  );
}

function EditarCargo({ cargo, aviso, fechar, pronto }) {
  const [f, setF] = useState({
    nome: cargo.nome, vinculo: cargo.vinculo, jornadaHoras: String(cargo.jornadaHoras ?? ""),
    diasPrevistos: cargo.regra?.diasPrevistos || [1, 2, 3, 4, 5], horario: cargo.regra?.horario || { inicio: "08:00", fim: "17:00" },
    tarefas: cargo.tarefas || [],
  });
  const [novaTarefa, setNovaTarefa] = useState("");
  const pref = `ed-${cargo.id}`;
  const salvar = async (e) => {
    e.preventDefault();
    const r = await apiPatch(`/admin/colaboradores-cargos/${cargo.id}`, f);
    if (r?.error) return aviso(r.error);
    aviso("Cargo salvo. Vale para quem entrar daqui em diante.");
    pronto();
  };
  const remover = async () => {
    if (!window.confirm(`Remover o cargo ${cargo.nome}?`)) return;
    const r = await apiDelete(`/admin/colaboradores-cargos/${cargo.id}`);
    if (r?.error) return aviso(r.error);
    pronto();
  };
  return (
    <form onSubmit={salvar} style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: 12, marginTop: 10 }}>
      <div className="vx-g2" style={{ gap: 10 }}>
        <Campo id={`${pref}-nome`} label="Nome do cargo"><input id={`${pref}-nome`} className="vx-input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} style={ALVO} /></Campo>
        <Campo id={`${pref}-vin`} label="Tipo de contrato">
          <select id={`${pref}-vin`} className="vx-input" value={f.vinculo} onChange={(e) => setF({ ...f, vinculo: e.target.value })} style={ALVO}>
            {Object.entries(VINCULOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo id={`${pref}-jor`} label="Horas por semana"><input id={`${pref}-jor`} className="vx-input" inputMode="numeric" value={f.jornadaHoras} onChange={(e) => setF({ ...f, jornadaHoras: e.target.value })} style={ALVO} /></Campo>
        <div style={{ display: "flex", gap: 8 }}>
          <Campo id={`${pref}-hi`} label="Entrada"><input id={`${pref}-hi`} type="time" className="vx-input" value={f.horario.inicio} onChange={(e) => setF({ ...f, horario: { ...f.horario, inicio: e.target.value } })} style={ALVO} /></Campo>
          <Campo id={`${pref}-hf`} label="Saída"><input id={`${pref}-hf`} type="time" className="vx-input" value={f.horario.fim} onChange={(e) => setF({ ...f, horario: { ...f.horario, fim: e.target.value } })} style={ALVO} /></Campo>
        </div>
      </div>
      <DiasPrevistos valor={f.diasPrevistos} onChange={(v) => setF({ ...f, diasPrevistos: v })} />
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 10px" }}>
        <legend className="vx-label">Tarefas do cargo (entram para cada pessoa nova)</legend>
        {f.tarefas.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "2px 0" }}>
            <span style={{ flex: 1 }}>{t.titulo} <span className="vx-mut">· {t.recorrencia === "semanal" ? "semanal" : t.recorrencia === "unica" ? "uma vez" : "diária"}</span></span>
            <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, minWidth: 44 }} onClick={() => setF({ ...f, tarefas: f.tarefas.filter((_, j) => j !== i) })} aria-label={`Tirar a tarefa ${t.titulo}`}><X size={14} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <label className="vx-sr-only" htmlFor={`${pref}-nt`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Nova tarefa do cargo</label>
          <input id={`${pref}-nt`} className="vx-input" value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} placeholder="Nova tarefa diária" style={{ ...ALVO, flex: 1 }} />
          <button type="button" className="vx-btn vx-btn-sm" style={ALVO} disabled={!novaTarefa.trim()} onClick={() => { setF({ ...f, tarefas: [...f.tarefas, { titulo: novaTarefa.trim(), descricao: "", tipoProva: "texto", recorrencia: "diaria" }] }); setNovaTarefa(""); }}>Incluir</button>
        </div>
      </fieldset>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Salvar cargo</button>
        <button type="button" className="vx-btn vx-btn-sm" style={ALVO} onClick={fechar}>Cancelar</button>
        <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ ...ALVO, marginLeft: "auto" }} onClick={remover}>Remover cargo</button>
      </div>
    </form>
  );
}

function NovoCargo({ area, exemplos, aviso, cancelar, pronto }) {
  const [exemplo, setExemplo] = useState("");
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("clt");
  const pref = `nc-${area.id}`;
  const salvar = async (e) => {
    e.preventDefault();
    const r = await api("/admin/colaboradores-cargos", { areaId: area.id, exemplo: exemplo || undefined, nome: nome || undefined, vinculo: exemplo ? undefined : vinculo });
    if (r?.error) return aviso(r.error);
    pronto();
  };
  const ex = exemplos.find((x) => x.chave === exemplo);
  return (
    <form onSubmit={salvar} style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: 12, marginTop: 10 }}>
      <Campo id={`${pref}-ex`} label="Começar de um exemplo">
        <select id={`${pref}-ex`} className="vx-input" value={exemplo} onChange={(e) => { setExemplo(e.target.value); setNome(""); }} style={ALVO}>
          <option value="">Cargo em branco</option>
          {exemplos.map((x) => <option key={x.chave} value={x.chave}>{x.area} · {x.nome} ({CURTO[x.vinculo]}, {x.tarefas} tarefa{x.tarefas === 1 ? "" : "s"})</option>)}
        </select>
      </Campo>
      <Campo id={`${pref}-nome`} label="Nome do cargo"><input id={`${pref}-nome`} className="vx-input" required={!exemplo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={ex?.nome || "Ex.: Assistente de atendimento"} style={ALVO} /></Campo>
      {!exemplo && (
        <Campo id={`${pref}-vin`} label="Tipo de contrato">
          <select id={`${pref}-vin`} className="vx-input" value={vinculo} onChange={(e) => setVinculo(e.target.value)} style={ALVO}>
            {Object.entries(VINCULOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Criar cargo</button>
        <button type="button" className="vx-btn vx-btn-sm" style={ALVO} onClick={cancelar}>Cancelar</button>
      </div>
    </form>
  );
}

export function DadosEmpresa({ inicial = {}, aviso, pronto, titulo = "Dados da empresa para os contratos" }) {
  const [e, setE] = useState({ nome: "", cnpj: "", endereco: "", representante: "", cidade: "", ...inicial });
  const salvar = async (ev) => {
    ev.preventDefault();
    const r = await apiPut("/admin/colaboradores-config/empresa", { empresa: e });
    if (r?.error) return aviso(r.error);
    aviso(!r.completa ? "Salvo. Ainda faltam campos para os contratos." : r.contratosGerados ? `Dados salvos e ${r.contratosGerados} contrato(s) enviado(s) para assinatura.` : "Dados da empresa salvos.");
    pronto?.();
  };
  const campos = [["nome", "Razão social", "RYCS Tecnologia Ltda."], ["cnpj", "CNPJ", "00.000.000/0001-00"], ["endereco", "Endereço completo", "Rua, número, bairro, CEP"], ["representante", "Quem assina pela empresa", "Nome e cargo"], ["cidade", "Cidade", "São Paulo/SP"]];
  return (
    <form onSubmit={salvar} className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
      <h3 className="vx-disp" style={{ fontSize: 15, margin: "0 0 4px" }}>{titulo}</h3>
      <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 10px" }}>Preencha uma vez. Entram em todos os contratos e aditivos.</p>
      <div className="vx-g3" style={{ gap: 10 }}>
        {campos.map(([k, rot, ph]) => (
          <Campo key={k} id={`emp-${k}`} label={rot}><input id={`emp-${k}`} className="vx-input" value={e[k]} onChange={(x) => setE({ ...e, [k]: x.target.value })} placeholder={ph} style={ALVO} /></Campo>
        ))}
      </div>
      <button className="vx-btn vx-btn-primary vx-btn-sm" style={ALVO}>Salvar dados da empresa</button>
    </form>
  );
}
