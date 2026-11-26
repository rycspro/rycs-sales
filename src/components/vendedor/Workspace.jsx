import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, FileText, Download, Database, Clock3, Shuffle, TrendingUp } from "lucide-react";
import { money } from "../../lib/utils.js";
import { ACOES, TAXA } from "../../lib/constants.js";
import { api, apiPatch } from "../../lib/api.js";
import Curso from "./Curso.jsx";
import Tarefas from "./Tarefas.jsx";
import MeusEnvios from "./MeusEnvios.jsx";
import Chat from "../Chat.jsx";

function pedirRevisaoHumana(setDb, aviso, sub) {
  const liquido = +(sub.valor * (1 - TAXA)).toFixed(2);
  const motivo = "Vendedor contestou e pediu revisão humana. Motivo original da IA: " + (sub.motivo || "—");
  apiPatch(`/submissions/${sub.id}`, { status: "revisao", motivo });
  setDb((d) => {
    const seller = d.sellers.find((s) => s.id === sub.sellerId);
    if (seller) apiPatch(`/sellers/${seller.id}`, { pendente: +(seller.pendente + liquido).toFixed(2) });
    return {
      ...d,
      submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "revisao", motivo } : s),
      sellers: d.sellers.map((s) => s.id === sub.sellerId ? { ...s, pendente: +(s.pendente + liquido).toFixed(2) } : s),
    };
  });
  aviso("Enviado para conferência humana da empresa.");
}

function TreinamentoCampanha({ campanha }) {
  const [aberto, setAberto] = useState(false);
  const modulos = campanha?.treinamento || [];
  if (!modulos.length) return null;
  return (
    <div className="vx-card" style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
      <button
        style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        onClick={() => setAberto((v) => !v)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 13.5 }}>
          <BookOpen size={14} color="var(--brand)" /> Treinamento da campanha
          <span className="vx-chip" style={{ fontSize: 11 }}>{modulos.length} módulos</span>
        </span>
        {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {aberto && (
        <div style={{ padding: "0 16px 14px" }}>
          {modulos.map((m, i) => (
            <div key={m.id || i} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
              <b style={{ fontSize: 13 }}>{m.titulo}</b>
              <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4, whiteSpace: "pre-wrap" }}>{m.conteudo}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampanhaHeader({ campanha, empresa }) {
  const tarefas = campanha?.tarefas || {};
  const tiposAtivos = Object.entries(tarefas).filter(([, v]) => v > 0);
  return (
    <div className="vx-card" style={{ padding: 16, marginBottom: 14, background: "var(--surface-2)" }}>
      <div className="vx-row" style={{ marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
        <div>
          <div className="vx-eyebrow">{empresa.nome}</div>
          <div className="vx-disp" style={{ fontSize: 18, margin: "2px 0" }}>{campanha.titulo}</div>
        </div>
        {campanha.funcao && <span className="vx-chip">{campanha.funcao.toUpperCase()}</span>}
      </div>
      {campanha.descricao && <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 10px" }}>{campanha.descricao}</p>}
      {campanha.requisitos && (
        <div className="vx-notice" style={{ marginBottom: 10, fontSize: 12 }}>
          <b>Requisitos:</b> {campanha.requisitos}
        </div>
      )}
      {tiposAtivos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tiposAtivos.map(([tipo, valor]) => (
            <span key={tipo} className="vx-chip vx-mono" style={{ fontSize: 11 }}>
              {ACOES[tipo]?.nome || tipo} <b style={{ color: "var(--brand)" }}>{money(valor)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MateriaisProfissional({ campaignId }) {
  const [materiais, setMateriais] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api(`/campaigns/${campaignId}/materiais`).then((r) => {
      setMateriais(Array.isArray(r) ? r : []);
      setCarregando(false);
    });
  }, [campaignId]);

  const registrarConsulta = async (mat) => {
    await api(`/campaigns/${campaignId}/materiais/consulta`, { materialId: mat.materialId || mat.id });
  };

  if (carregando) return <div className="vx-mut">Carregando materiais...</div>;
  if (!materiais.length) return (
    <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
      <FileText size={24} color="var(--muted)" />
      <p className="vx-mut" style={{ marginTop: 10 }}>Nenhum material disponível nesta campanha.</p>
    </div>
  );

  const obrigatorios = materiais.filter((m) => m.obrigatoriedade === "obrigatorio");
  const outros = materiais.filter((m) => m.obrigatoriedade !== "obrigatorio");

  return (
    <div className="vx-fade">
      <div className="vx-eyebrow">Recursos da campanha</div>
      <h3 className="vx-disp" style={{ fontSize: 16, margin: "4px 0 14px" }}>Materiais disponíveis</h3>
      {obrigatorios.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="vx-label" style={{ marginBottom: 8, color: "var(--brand)" }}>Obrigatórios</div>
          {obrigatorios.map((mat) => (
            <div key={mat.materialId || mat.id} className="vx-card" style={{ padding: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{mat.nome || "Material"}</div>
                <div className="vx-mut" style={{ fontSize: 11 }}>{mat.categoria || "outros"}{mat.consultado ? " · Consultado" : ""}</div>
              </div>
              <button className="vx-btn vx-btn-sm" onClick={() => registrarConsulta(mat)}><Download size={12} /> Acessar</button>
            </div>
          ))}
        </div>
      )}
      {outros.length > 0 && (
        <div>
          {obrigatorios.length > 0 && <div className="vx-label" style={{ marginBottom: 8 }}>Complementares</div>}
          {outros.map((mat) => (
            <div key={mat.materialId || mat.id} className="vx-card" style={{ padding: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{mat.nome || "Material"}</div>
                <div className="vx-mut" style={{ fontSize: 11 }}>{mat.categoria || "outros"}</div>
              </div>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => registrarConsulta(mat)}><Download size={12} /> Acessar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MeusLeads({ campaignId }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [solicitando, setSolicitando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const r = await api(`/campaigns/${campaignId}/leads`);
    setLeads(r?.leads || r || []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [campaignId]);

  const solicitar = async () => {
    setSolicitando(true);
    const r = await api(`/campaigns/${campaignId}/leads/solicitar`, {});
    setSolicitando(false);
    if (r?.error) return setAviso(r.error);
    setAviso("Lead atribuído com sucesso!");
    await carregar();
  };

  const devolver = async (leadId) => {
    const r = await api(`/campaigns/${campaignId}/leads/devolver`, { leadId });
    if (r?.error) return setAviso(r.error);
    setAviso("Lead devolvido à fila.");
    await carregar();
  };

  const meus = leads.filter((l) => l.status === "em_atendimento");
  const disponiveis = leads.filter((l) => l.status === "disponivel").length;

  if (carregando) return <div className="vx-mut">Carregando leads...</div>;

  return (
    <div className="vx-fade">
      <div className="vx-eyebrow">Gestão de leads</div>
      <h3 className="vx-disp" style={{ fontSize: 16, margin: "4px 0 14px" }}>Meus leads</h3>

      {aviso && <div className="vx-notice" style={{ marginBottom: 12 }}>{aviso}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div className="vx-card" style={{ padding: 14, flex: 1, textAlign: "center" }}>
          <div className="vx-mut" style={{ fontSize: 11 }}>Meus</div>
          <b className="vx-mono" style={{ fontSize: 20 }}>{meus.length}</b>
        </div>
        <div className="vx-card" style={{ padding: 14, flex: 1, textAlign: "center" }}>
          <div className="vx-mut" style={{ fontSize: 11 }}>Disponíveis</div>
          <b className="vx-mono" style={{ fontSize: 20 }}>{disponiveis}</b>
        </div>
      </div>

      {disponiveis > 0 && (
        <button className="vx-btn vx-btn-primary" style={{ marginBottom: 16, width: "100%" }} disabled={solicitando} onClick={solicitar}>
          <Database size={14} /> {solicitando ? "Solicitando..." : "Solicitar próximo lead"}
        </button>
      )}

      {meus.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Database size={24} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 10 }}>Nenhum lead atribuído a você nesta campanha.</p>
          {disponiveis > 0 && <p className="vx-mut" style={{ fontSize: 12 }}>Clique em "Solicitar próximo lead" para começar.</p>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {meus.map((lead) => (
            <div key={lead.id || lead.leadId} className="vx-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{lead.nome || lead.leadNome || `Lead #${lead.leadId || lead.id}`}</div>
                  {lead.empresa && <div className="vx-mut" style={{ fontSize: 12 }}>{lead.empresa}</div>}
                  {lead.telefone && <div className="vx-mut" style={{ fontSize: 12 }}>{lead.telefone}</div>}
                  {lead.atribuidoEm && <div className="vx-mut" style={{ fontSize: 11, marginTop: 4 }}><Clock3 size={10} style={{ marginRight: 3 }} />Atribuído em {new Date(lead.atribuidoEm).toLocaleDateString("pt-BR")}</div>}
                </div>
                <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => devolver(lead.leadId || lead.id)} title="Devolver à fila">Devolver</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TransferenciasSDR({ campaignId }) {
  const [dados, setDados] = useState({ originadas: 0, transferidas: 0, convertidas: 0, lista: [] });
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    setCarregando(true);
    api(`/campaigns/${campaignId}/eventos`).then((r) => {
      const eventos = Array.isArray(r) ? r : [];
      const originadas = eventos.filter((e) => e.tipo === "reuniao_realizada").length;
      const transferidas = eventos.filter((e) => e.tipo === "transferencia").length;
      const convertidas = eventos.filter((e) => e.tipo === "venda").length;
      setDados({ originadas, transferidas, convertidas, lista: eventos.slice(0, 20) });
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }, [campaignId]);

  if (carregando) return <div className="vx-mut">Carregando...</div>;
  return (
    <div className="vx-fade">
      <div className="vx-eyebrow">Desempenho SDR</div>
      <h3 className="vx-disp" style={{ fontSize: 16, margin: "4px 0 14px" }}>Oportunidades originadas</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        <div className="vx-card" style={{ padding: 14, textAlign: "center" }}>
          <div className="vx-mut" style={{ fontSize: 11 }}>Reuniões</div>
          <b className="vx-mono" style={{ fontSize: 20 }}>{dados.originadas}</b>
        </div>
        <div className="vx-card" style={{ padding: 14, textAlign: "center" }}>
          <div className="vx-mut" style={{ fontSize: 11 }}>Transferidas</div>
          <b className="vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>{dados.transferidas}</b>
        </div>
        <div className="vx-card" style={{ padding: 14, textAlign: "center" }}>
          <div className="vx-mut" style={{ fontSize: 11 }}>Vendas</div>
          <b className="vx-mono" style={{ fontSize: 20, color: "#16A34A" }}>{dados.convertidas}</b>
        </div>
      </div>
      {dados.lista.length > 0 ? (
        <div style={{ display: "grid", gap: 6 }}>
          {dados.lista.map((ev) => (
            <div key={ev.id} className="vx-card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: ev.tipo === "venda" ? "#DCFCE7" : "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ev.tipo === "venda" ? <TrendingUp size={13} color="#16A34A" /> : <Shuffle size={13} color="var(--brand)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{ev.tipo === "venda" ? "Venda fechada" : ev.tipo === "transferencia" ? "Transferida p/ Closer" : ev.tipo === "reuniao_realizada" ? "Reunião realizada" : ev.tipo}</div>
                <div className="vx-mut" style={{ fontSize: 11 }}>{new Date(ev.criadoEm).toLocaleDateString("pt-BR")}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Shuffle size={24} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 10 }}>Nenhum evento registrado ainda.</p>
        </div>
      )}
    </div>
  );
}

function FilaCloser({ campaignId }) {
  const [transferencias, setTransferencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    setCarregando(true);
    api(`/transferencias?campanhaDestinoId=${campaignId}`).then((r) => {
      setTransferencias(Array.isArray(r) ? r : []);
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }, [campaignId]);

  if (carregando) return <div className="vx-mut">Carregando...</div>;
  const pendentes = transferencias.filter((t) => t.status === "pendente");
  const aceitas = transferencias.filter((t) => t.status === "aceita");
  return (
    <div className="vx-fade">
      <div className="vx-eyebrow">Closer</div>
      <h3 className="vx-disp" style={{ fontSize: 16, margin: "4px 0 14px" }}>Oportunidades recebidas</h3>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div className="vx-card" style={{ padding: 14, flex: 1, textAlign: "center" }}>
          <div className="vx-mut" style={{ fontSize: 11 }}>Pendentes</div>
          <b className="vx-mono" style={{ fontSize: 20, color: "#F59E0B" }}>{pendentes.length}</b>
        </div>
        <div className="vx-card" style={{ padding: 14, flex: 1, textAlign: "center" }}>
          <div className="vx-mut" style={{ fontSize: 11 }}>Aceitas</div>
          <b className="vx-mono" style={{ fontSize: 20, color: "#16A34A" }}>{aceitas.length}</b>
        </div>
      </div>
      {transferencias.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Shuffle size={24} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 10 }}>Nenhuma oportunidade transferida para esta campanha.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {transferencias.map((t) => (
            <div key={t.id} className="vx-card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.status === "pendente" ? "#F59E0B" : "#16A34A", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Oportunidade #{String(t.id).slice(-6)}</div>
                <div className="vx-mut" style={{ fontSize: 11 }}>
                  {t.status === "pendente" ? "Aguardando aceite" : "Aceita"} · {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Workspace({ campanha, empresa, eu, db, setDb, up, aviso, voltar, recarregar }) {
  const [aba, setAba] = useState("tarefas");
  const feitos = eu.curso?.[empresa.id];
  const todosFeitos = feitos === "todos" || (Array.isArray(feitos) && feitos.length === empresa.curso.length);

  // Sem campanha: bloquear tarefas, pedir que o profissional entre por uma campanha
  const semCampanha = !campanha;

  return (
    <div className="vx-fade">
      <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 12, marginLeft: -8 }} onClick={voltar}>
        <ArrowLeft size={14} /> Campanhas
      </button>

      {campanha
        ? <CampanhaHeader campanha={campanha} empresa={empresa} />
        : <div className="vx-row" style={{ marginBottom: 12 }}>
            <h2 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>{empresa.nome}</h2>
            <span className="vx-chip vx-mono">caixa {money(empresa.saldo)}</span>
          </div>}

      {campanha && <TreinamentoCampanha campanha={campanha} />}

      <div className="vx-tabs" style={{ margin: "4px 0 18px" }}>
        {[["tarefas", "Tarefas"],
          ...(campanha ? [["materiais", "Materiais"], ["meusleads", "Meus leads"]] : []),
          ...(campanha?.funcao === "sdr" ? [["sdr", "Oportunidades"]] : []),
          ...(campanha?.funcao === "closer" ? [["closer", "Fila Closer"]] : []),
          ["curso", "Curso da empresa"], ["envios", "Meus envios"], ["chat", "Chat"]
        ].map(([k, t]) => (
          <button key={k} className="vx-tab" data-on={aba === k ? "1" : "0"} onClick={() => setAba(k)}>{t}</button>
        ))}
      </div>

      {aba === "materiais" && campanha && <MateriaisProfissional campaignId={campanha.id} />}
      {aba === "meusleads" && campanha && <MeusLeads campaignId={campanha.id} />}
      {aba === "sdr" && campanha && <TransferenciasSDR campaignId={campanha.id} />}
      {aba === "closer" && campanha && <FilaCloser campaignId={campanha.id} />}
      {aba === "curso" && <Curso empresa={empresa} eu={eu} up={up} aviso={aviso} />}
      {aba === "tarefas" && (
        semCampanha
          ? <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
              <BookOpen size={24} color="var(--muted)" />
              <p className="vx-mut" style={{ marginTop: 10 }}>Para registrar tarefas, entre na operação por uma campanha aprovada.</p>
              <button className="vx-btn vx-btn-sm" style={{ marginTop: 8 }} onClick={voltar}>Ver campanhas</button>
            </div>
          : <Tarefas campanha={campanha} empresa={empresa} eu={eu} db={db} setDb={setDb} aviso={aviso} liberado={true} irCurso={() => setAba("curso")} recarregar={recarregar} />
      )}
      {aba === "envios" && <MeusEnvios empresa={empresa} eu={eu} db={db} pedirRevisao={(sub) => pedirRevisaoHumana(setDb, aviso, sub)} />}
      {aba === "chat" && <Chat empresa={empresa} sellerId={eu.id} db={db} up={up} de="vendedor" />}
    </div>
  );
}
