import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import { useVoice } from "./useVoice.js";
import { useSipPhone } from "./useSipPhone.js";
import {
  Phone, PhoneOff, Play, Pause, SkipForward, Clock, Target,
  CheckCircle2, User, Building2, ChevronRight, AlertTriangle,
  Calendar, MessageSquare, FileText, PhoneCall, XCircle, RotateCcw,
  Mic, MicOff, Users, TrendingUp, Zap, ArrowRight
} from "lucide-react";

const RESULTADOS = [
  { id: "reuniao_agendada", label: "Reunião agendada", cor: "var(--green)", icon: Calendar },
  { id: "atendeu", label: "Ligação atendida", cor: "var(--brand)", icon: PhoneCall },
  { id: "nao_atendeu", label: "Não atendeu", cor: "var(--muted)", icon: PhoneOff },
  { id: "ocupado", label: "Ocupado", cor: "var(--amber)", icon: Clock },
  { id: "retornar", label: "Retornar depois", cor: "var(--sky-600)", icon: RotateCcw },
  { id: "sem_interesse", label: "Sem interesse", cor: "var(--red)", icon: XCircle },
  { id: "numero_invalido", label: "Número inválido", cor: "var(--red)", icon: AlertTriangle },
  { id: "caixa_postal", label: "Caixa postal", cor: "var(--muted)", icon: MessageSquare },
  { id: "nao_ligar", label: "Não ligar novamente", cor: "var(--red)", icon: XCircle },
  { id: "venda", label: "Venda realizada", cor: "var(--green)", icon: CheckCircle2 },
  { id: "outro", label: "Outro", cor: "var(--muted-2)", icon: FileText },
];

function Card({ children, style, ...p }) {
  return <div style={{ background: "var(--surface-solid)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", ...style }} {...p}>{children}</div>;
}

function StatCard({ label, valor, icon: Icon, cor, sub }) {
  return (
    <Card style={{ padding: "16px 20px", flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {Icon && <Icon size={16} style={{ color: cor || "var(--brand)" }} />}
        <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function ScriptSection({ titulo, conteudo }) {
  if (!conteudo) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--brand)", letterSpacing: ".04em", marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{conteudo}</div>
    </div>
  );
}

export default function DiscadoraProfissional({ aviso }) {
  const voice = useVoice();
  const [filas, setFilas] = useState([]);
  const [filaSelecionada, setFilaSelecionada] = useState("");
  const [modalidade, setModalidade] = useState("mobile");
  const [providers, setProviders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [resultado, setResultado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [abaScript, setAbaScript] = useState("abertura");
  const [salvando, setSalvando] = useState(false);
  const [callbacks, setCallbacks] = useState([]);
  const [abaOp, setAbaOp] = useState("operacao");
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [agendarData, setAgendarData] = useState("");
  const [agendarHora, setAgendarHora] = useState("");
  const [retornoData, setRetornoData] = useState("");
  const [retornoHora, setRetornoHora] = useState("");

  useEffect(() => {
    api.get("/voice/status").then(setVoiceStatus).catch(() => setVoiceStatus({ habilitada: false }));
    api.get("/voice/queues").then((f) => {
      setFilas(f);
      // Uma fila só: já vem escolhida, basta apertar Iniciar.
      if (f.length === 1) setFilaSelecionada((atual) => atual || f[0].id);
    }).catch(() => {});
    api.get("/voice/providers").then(setProviders).catch(() => {});
    api.get("/voice/settings").then(setSettings).catch(() => {});
    api.get("/voice/callbacks").then(setCallbacks).catch(() => {});
    voice.carregarSessaoAtual();
    voice.carregarStats();
  }, []);

  const emSessao = voice.sessao?.status === "ativo" || voice.sessao?.status === "pausado";
  const sip = useSipPhone(modalidade === "sip" && emSessao);
  const capsSip = providers.find((p) => p.id === "sip");
  const sipDisponivel = !!capsSip?.capabilities?.canInitiate;
  const [statusSip, setStatusSip] = useState("");
  const callIdSip = modalidade === "sip" ? voice.ligacaoAtual?.callId : null;

  // Andamento real da ligação vem dos eventos do Asterisk gravados no servidor.
  useEffect(() => {
    if (!callIdSip) { setStatusSip(""); return undefined; }
    const t = setInterval(() => {
      api.get(`/voice/calls/${callIdSip}`).then((c) => setStatusSip(c?.status || "")).catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [callIdSip]);

  if (voiceStatus && !voiceStatus.habilitada) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <Phone size={48} style={{ color: "var(--muted-2)", marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Discadora não disponível</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
          A discadora ainda não foi habilitada para a sua empresa. Solicite a ativação ao administrador.
        </p>
      </div>
    );
  }

  const iniciar = async () => {
    if (!filaSelecionada) return aviso?.("Selecione uma fila.");
    const companyId = filas.find((f) => f.id === filaSelecionada)?.companyId;
    const r = await voice.iniciarSessao(filaSelecionada, companyId, modalidade);
    if (r) {
      voice.buscarProximo(filaSelecionada);
      voice.carregarStats();
    }
  };

  const ligar = async () => {
    if (!voice.leadAtual) return;
    const prov = modalidade === "mock" || modalidade === "sip" ? modalidade : "mobile";
    if (prov === "sip" && sip.estado !== "pronto") return aviso?.("O áudio do navegador ainda não está conectado.");
    await voice.iniciarLigacao(voice.leadAtual.id, filaSelecionada, prov);
  };

  const salvarEProximo = async () => {
    if (!resultado) return aviso?.("Selecione um resultado.");
    if (!voice.ligacaoAtual?.callId) return aviso?.("Nenhuma ligação ativa.");
    setSalvando(true);
    const dados = { resultado, observacao };

    // Agendar reunião no calendário
    if (resultado === "reuniao_agendada" && agendarData && agendarHora) {
      const dt = new Date(`${agendarData}T${agendarHora}`);
      if (!isNaN(dt.getTime())) dados.agendarReuniao = { data: dt.getTime(), duracao: 30 };
    }

    // Agendar retorno
    if (resultado === "retornar" && retornoData && retornoHora) {
      const dt = new Date(`${retornoData}T${retornoHora}`);
      if (!isNaN(dt.getTime())) dados.agendarRetorno = dt.getTime();
    }

    const r = await voice.registrarResultado(voice.ligacaoAtual.callId, dados);
    if (r?.ok) {
      setResultado("");
      setObservacao("");
      setAgendarData("");
      setAgendarHora("");
      setRetornoData("");
      setRetornoHora("");
      await voice.buscarProximo(filaSelecionada);
      voice.carregarStats();
      api.get("/voice/callbacks").then(setCallbacks).catch(() => {});
    }
    setSalvando(false);
  };

  const pularLead = async () => {
    setResultado("");
    setObservacao("");
    voice.limpar();
    await voice.buscarProximo(filaSelecionada);
  };

  const em = voice.sessao?.status === "ativo";
  const pausado = voice.sessao?.status === "pausado";
  const temLead = !!voice.leadAtual;
  const temLigacao = !!voice.ligacaoAtual;
  const capsMobile = providers.find((p) => p.id === modalidade)?.capabilities || {};

  // ── Tabs ──

  const ABAS_PROF = [
    { id: "operacao", label: "Operação", Icon: Zap },
    { id: "fila", label: "Minha fila", Icon: Users },
    { id: "historico", label: "Histórico", Icon: Clock },
    { id: "desempenho", label: "Meu desempenho", Icon: TrendingUp },
  ];

  return (
    <div style={{ padding: "0 4px" }}>
      <audio ref={sip.audioRef} autoPlay />
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Phone size={18} style={{ color: "var(--brand)" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Discadora</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {em ? "Em operação" : pausado ? "Pausado" : "Offline"}
              {voice.sessao?.modalidade === "mock" && " · Simulação"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
          <select value={filaSelecionada} onChange={(e) => setFilaSelecionada(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "var(--surface-solid)", fontSize: 13 }}>
            <option value="">Selecionar fila</option>
            {filas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>

          <select value={modalidade} onChange={(e) => setModalidade(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "var(--surface-solid)", fontSize: 13 }}>
            <option value="mobile">Celular</option>
            <option value="mock">Simulação</option>
            <option value="sip" disabled={!sipDisponivel}>{sipDisponivel ? "Navegador (fone)" : "Navegador (em ativação)"}</option>
          </select>

          {!em && !pausado && (
            <button onClick={iniciar} disabled={!filaSelecionada || voice.carregando}
              style={{ padding: "8px 20px", borderRadius: "var(--radius-pill)", background: "var(--brand)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Play size={14} /> Iniciar
            </button>
          )}
          {em && (
            <button onClick={voice.pausarSessao}
              style={{ padding: "8px 16px", borderRadius: "var(--radius-pill)", background: "var(--amber-50)", color: "var(--amber)", border: "1px solid var(--amber)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Pause size={14} /> Pausar
            </button>
          )}
          {pausado && (
            <button onClick={voice.retomarSessao}
              style={{ padding: "8px 16px", borderRadius: "var(--radius-pill)", background: "var(--green-50)", color: "var(--green)", border: "1px solid var(--green)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Play size={14} /> Retomar
            </button>
          )}
          {(em || pausado) && (
            <button onClick={voice.encerrarSessao}
              style={{ padding: "8px 16px", borderRadius: "var(--radius-pill)", background: "var(--red-50)", color: "var(--red)", border: "1px solid var(--red)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Encerrar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {ABAS_PROF.map((a) => (
          <button key={a.id} onClick={() => setAbaOp(a.id)}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: abaOp === a.id ? 600 : 400, color: abaOp === a.id ? "var(--brand)" : "var(--muted)", background: "transparent", border: "none", borderBottom: abaOp === a.id ? "2px solid var(--brand)" : "2px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <a.Icon size={14} /> {a.label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      {abaOp === "operacao" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            <StatCard label="Ligações" valor={voice.stats?.totalLigacoes || 0} icon={PhoneCall} cor="var(--brand)" />
            <StatCard label="Atendidas" valor={voice.stats?.atendidas || 0} icon={CheckCircle2} cor="var(--green)" />
            <StatCard label="Reuniões" valor={voice.stats?.reunioes || 0} icon={Calendar} cor="var(--indigo)" />
            <StatCard label="Tempo" valor={voice.stats?.tempoTotal ? `${Math.round(voice.stats.tempoTotal / 60)}min` : "0min"} icon={Clock} cor="var(--sky-600)" />
            <StatCard label="Meta diária" valor={settings?.metaDiaria || 30} icon={Target} cor="var(--amber)"
              sub={voice.stats?.totalLigacoes ? `${Math.round((voice.stats.totalLigacoes / (settings?.metaDiaria || 30)) * 100)}%` : "0%"} />
          </div>

          {voice.erro && (
            <div style={{ padding: "10px 16px", background: "var(--red-50)", borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} /> {voice.erro}
              <button onClick={() => voice.setErro(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontWeight: 600 }}>✕</button>
            </div>
          )}

          {(!em && !pausado) && (
            <Card style={{ padding: 40, textAlign: "center" }}>
              <Phone size={40} style={{ color: "var(--muted-2)", marginBottom: 12 }} />
              <h3 style={{ margin: "0 0 8px", fontWeight: 600 }}>Pronto para começar?</h3>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: 14 }}>Selecione uma fila e clique em Iniciar para começar a discagem.</p>
            </Card>
          )}

          {/* Main 3-column layout */}
          {(em || pausado) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 300px", gap: 16, alignItems: "start" }}>
              {/* Left — Lead info */}
              <Card style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", letterSpacing: ".04em", marginBottom: 12 }}>LEAD ATUAL</div>
                {voice.carregando && !temLead && <div style={{ textAlign: "center", padding: 20 }}><div className="vx-spinner" /></div>}
                {!temLead && !voice.carregando && (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                    <Users size={32} style={{ marginBottom: 8, opacity: .4 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>Nenhum lead na fila.</p>
                  </div>
                )}
                {temLead && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <User size={20} style={{ color: "var(--brand)" }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{voice.leadAtual.nome}</div>
                        {voice.leadAtual.empresa && <div style={{ fontSize: 12, color: "var(--muted)" }}><Building2 size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> {voice.leadAtual.empresa}</div>}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      {voice.leadAtual.cargo && <div><span style={{ color: "var(--muted)", width: 70, display: "inline-block" }}>Cargo</span> {voice.leadAtual.cargo}</div>}
                      <div><span style={{ color: "var(--muted)", width: 70, display: "inline-block" }}>Telefone</span> <strong>{voice.leadAtual.telefone}</strong></div>
                      {voice.leadAtual.email && <div><span style={{ color: "var(--muted)", width: 70, display: "inline-block" }}>E-mail</span> {voice.leadAtual.email}</div>}
                      {voice.leadAtual.origem && <div><span style={{ color: "var(--muted)", width: 70, display: "inline-block" }}>Origem</span> {voice.leadAtual.origem}</div>}
                      <div><span style={{ color: "var(--muted)", width: 70, display: "inline-block" }}>Etapa</span> {voice.leadAtual.etapa}</div>
                    </div>

                    {/* Histórico recente */}
                    {voice.eventosLead.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>HISTÓRICO</div>
                        {voice.eventosLead.slice(0, 5).map((e) => (
                          <div key={e.id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                            <span>{e.tipo} {e.resultado && `· ${e.resultado}`}</span>
                            <span style={{ color: "var(--muted-2)" }}>{new Date(e.criadoEm).toLocaleDateString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {voice.callbackPendente && (
                      <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--amber-50)", borderRadius: "var(--radius-sm)", fontSize: 12 }}>
                        <strong style={{ color: "var(--amber)" }}>Retorno agendado</strong>
                        <div>{new Date(voice.callbackPendente.agendadoPara).toLocaleString("pt-BR")}</div>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {/* Center — Call controls + result */}
              <Card style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", letterSpacing: ".04em", marginBottom: 12 }}>LIGAÇÃO</div>

                {temLead && !temLigacao && (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <button onClick={ligar} disabled={voice.carregando || pausado}
                      style={{ width: 80, height: 80, borderRadius: "50%", background: pausado ? "var(--muted-2)" : "var(--brand)", color: "#fff", border: "none", cursor: pausado ? "default" : "pointer", fontSize: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: pausado ? "none" : "var(--shadow-brand)", transition: "transform .15s" }}>
                      <Phone size={32} />
                    </button>
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                      {pausado ? "Sessão pausada" : modalidade === "mobile" ? "Tocar para ligar (abre o telefone)" : modalidade === "mock" ? "Iniciar chamada simulada" : "Iniciar chamada"}
                    </div>
                    {modalidade === "mobile" && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <AlertTriangle size={12} /> O resultado deve ser registrado manualmente
                      </div>
                    )}
                    {modalidade === "sip" && (
                      <div style={{ marginTop: 8, fontSize: 12, color: sip.estado === "erro" ? "var(--red)" : "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <span>
                          {sip.estado === "pronto" ? "Áudio conectado · use fone de ouvido"
                            : sip.estado === "erro" ? sip.erro
                            : sip.estado === "em_chamada" ? "Teste de áudio em andamento"
                            : "Conectando o áudio…"}
                        </span>
                        {sip.estado === "pronto" && (
                          <button onClick={sip.testarAudio} className="vx-btn vx-btn-sm" style={{ minHeight: 44 }}>
                            <Mic size={14} /> Testar áudio (eco)
                          </button>
                        )}
                        {sip.estado === "em_chamada" && (
                          <button onClick={sip.desligar} className="vx-btn vx-btn-danger vx-btn-sm" style={{ minHeight: 44 }}>
                            <PhoneOff size={14} /> Encerrar teste
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {temLigacao && (
                  <div style={{ textAlign: "center", padding: "12px 0 16px" }}>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--green-50)", border: "2px solid var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                      <PhoneCall size={24} style={{ color: "var(--green)" }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--green)" }}>
                      {voice.ligacaoAtual.simulado ? "Chamada simulada" : voice.ligacaoAtual.status === "iniciada" ? "Ligação iniciada" : voice.ligacaoAtual.status}
                    </div>
                    {modalidade === "sip" && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {{ chamando_profissional: "Conectando seu áudio…", discando: "Chamando o contato…", em_andamento: "Em conversa", nao_atendida: "Não atendeu", encerrada: "Ligação encerrada", falhou: "A ligação não completou" }[statusSip] || "Preparando a ligação…"}
                        </span>
                        {sip.estado === "em_chamada" && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={sip.alternarMudo} className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} aria-pressed={sip.mudo}>
                              {sip.mudo ? <><MicOff size={14} /> Ativar microfone</> : <><Mic size={14} /> Silenciar</>}
                            </button>
                            <button onClick={sip.desligar} className="vx-btn vx-btn-danger vx-btn-sm" style={{ minHeight: 44 }}>
                              <PhoneOff size={14} /> Desligar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {voice.ligacaoAtual.origemDados === "declarado" && (
                      <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>Dados declarados pelo profissional</div>
                    )}
                    {voice.ligacaoAtual.simulado && (
                      <div style={{ fontSize: 11, color: "var(--indigo)", marginTop: 4 }}>Simulação — nenhuma ligação real</div>
                    )}
                  </div>
                )}

                {/* Script */}
                {voice.scriptAtual && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                      {["abertura", "qualificacao", "argumentacao", "objecoes", "encerramento", "agendamento"].map((s) => (
                        voice.scriptAtual[s] ? (
                          <button key={s} onClick={() => setAbaScript(s)}
                            style={{ padding: "4px 10px", fontSize: 11, borderRadius: "var(--radius-pill)", background: abaScript === s ? "var(--brand)" : "var(--surface-2)", color: abaScript === s ? "#fff" : "var(--muted)", border: "none", cursor: "pointer", fontWeight: 500, textTransform: "capitalize" }}>
                            {s}
                          </button>
                        ) : null
                      ))}
                    </div>
                    <div style={{ maxHeight: 120, overflow: "auto", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {voice.scriptAtual[abaScript] || "Sem conteúdo para esta seção."}
                    </div>
                  </div>
                )}

                {/* Result registration */}
                {temLigacao && (
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>RESULTADO DA LIGAÇÃO</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
                      {RESULTADOS.map((r) => {
                        const Icon = r.icon;
                        const sel = resultado === r.id;
                        return (
                          <button key={r.id} onClick={() => setResultado(r.id)}
                            style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: sel ? `2px solid ${r.cor}` : "1px solid var(--border)", background: sel ? `${r.cor}11` : "var(--surface-solid)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: sel ? 600 : 400, color: sel ? r.cor : "var(--ink-2)", transition: "all .15s" }}>
                            <Icon size={14} /> {r.label}
                          </button>
                        );
                      })}
                    </div>
                    <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Observações (opcional)"
                      rows={2}
                      style={{ width: "100%", marginTop: 10, padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />

                    {resultado === "reuniao_agendada" && (
                      <div style={{ marginTop: 10, padding: 12, background: "var(--green-50)", borderRadius: "var(--radius-sm)", border: "1px solid var(--green-100)" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={14} /> Agendar reunião
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="date" value={agendarData} onChange={(e) => setAgendarData(e.target.value)}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13 }} />
                          <input type="time" value={agendarHora} onChange={(e) => setAgendarHora(e.target.value)}
                            style={{ width: 100, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13 }} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>A reunião aparecerá no calendário da empresa.</div>
                      </div>
                    )}

                    {resultado === "retornar" && (
                      <div style={{ marginTop: 10, padding: 12, background: "var(--sky-50)", borderRadius: "var(--radius-sm)", border: "1px solid var(--sky-100)" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sky-600)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                          <RotateCcw size={14} /> Agendar retorno
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="date" value={retornoData} onChange={(e) => setRetornoData(e.target.value)}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13 }} />
                          <input type="time" value={retornoHora} onChange={(e) => setRetornoHora(e.target.value)}
                            style={{ width: 100, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: 13 }} />
                        </div>
                      </div>
                    )}

                    <button onClick={salvarEProximo} disabled={!resultado || salvando || sip.estado === "em_chamada"}
                      style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: "var(--radius-sm)", background: resultado ? "var(--brand)" : "var(--muted-2)", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: resultado ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: resultado ? "var(--shadow-brand)" : "none" }}>
                      {salvando ? <div className="vx-spinner" style={{ width: 16, height: 16 }} /> : <><CheckCircle2 size={16} /> Salvar e próximo lead</>}
                    </button>
                  </div>
                )}

                {!temLead && !voice.carregando && (em || pausado) && (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                    Aguardando lead da fila...
                  </div>
                )}
              </Card>

              {/* Right — Queue preview */}
              <Card style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", letterSpacing: ".04em", marginBottom: 10 }}>FILA DE PROSPECÇÃO</div>
                <QueuePreview queueId={filaSelecionada} />

                {callbacks.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--amber)", marginBottom: 6 }}>RETORNOS PENDENTES</div>
                    {callbacks.slice(0, 5).map((cb) => (
                      <div key={cb.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                        <div style={{ fontWeight: 500 }}>{cb.leadNome}</div>
                        <div style={{ color: "var(--muted)" }}>{new Date(cb.agendadoPara).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {abaOp === "fila" && <MinhaFila queueId={filaSelecionada} />}
      {abaOp === "historico" && <MeuHistorico />}
      {abaOp === "desempenho" && <MeuDesempenho stats={voice.stats} settings={settings} />}

      <style>{`
        @media (max-width: 900px) {
          .disc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function QueuePreview({ queueId }) {
  const [leads, setLeads] = useState([]);
  useEffect(() => {
    if (!queueId) return;
    api.get(`/voice/queues/${queueId}/leads`, { status: "pendente" }).then((r) => setLeads(r?.slice?.(0, 10) || [])).catch(() => {});
  }, [queueId]);

  if (!queueId) return <div style={{ fontSize: 12, color: "var(--muted)" }}>Selecione uma fila.</div>;
  if (!leads.length) return <div style={{ fontSize: 12, color: "var(--muted)" }}>Fila vazia.</div>;

  return (
    <div style={{ display: "grid", gap: 2 }}>
      {leads.map((l, i) => (
        <div key={l.id} style={{ padding: "6px 8px", borderRadius: "var(--radius-sm)", background: i === 0 ? "var(--brand-50)" : "transparent", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: i === 0 ? 600 : 400 }}>{l.nome}</span>
          <span style={{ color: "var(--muted-2)" }}>{l.tentativas || 0}x</span>
        </div>
      ))}
    </div>
  );
}

function MinhaFila({ queueId }) {
  const [leads, setLeads] = useState([]);
  useEffect(() => {
    if (!queueId) return;
    api.get(`/voice/queues/${queueId}/leads`).then(setLeads).catch(() => {});
  }, [queueId]);

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>MINHA FILA</div>
      {!queueId && <p style={{ color: "var(--muted)" }}>Selecione uma fila acima.</p>}
      {leads.length === 0 && queueId && <p style={{ color: "var(--muted)" }}>Nenhum lead nesta fila.</p>}
      <div style={{ display: "grid", gap: 2 }}>
        {leads.map((l) => (
          <div key={l.id} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface-2)", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontWeight: 500 }}>{l.nome}</span>
              {l.empresa && <span style={{ color: "var(--muted)", marginLeft: 8 }}>{l.empresa}</span>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--muted-2)" }}>{l.tentativas || 0} tent.</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: l.status === "pendente" ? "var(--brand-50)" : "var(--surface-3)", color: l.status === "pendente" ? "var(--brand)" : "var(--muted)" }}>{l.status}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MeuHistorico() {
  const [calls, setCalls] = useState([]);
  useEffect(() => {
    api.get("/voice/calls", { limit: 50 }).then(setCalls).catch(() => {});
  }, []);

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>HISTÓRICO DE LIGAÇÕES</div>
      {calls.length === 0 && <p style={{ color: "var(--muted)" }}>Nenhuma ligação registrada.</p>}
      <div style={{ display: "grid", gap: 2 }}>
        {calls.map((c) => (
          <div key={c.id} style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface-2)", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontWeight: 500 }}>{c.leadNome || "Lead"}</span>
              <span style={{ color: "var(--muted)", marginLeft: 8 }}>{c.numeroDestino}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: RESULTADOS.find((r) => r.id === c.resultado)?.cor || "var(--muted)" }}>{RESULTADOS.find((r) => r.id === c.resultado)?.label || c.resultado}</span>
              <span style={{ fontSize: 11, color: "var(--muted-2)" }}>{new Date(c.criadoEm).toLocaleDateString("pt-BR")}</span>
              {c.origemDados === "declarado" && <span style={{ fontSize: 10, color: "var(--amber)", background: "var(--amber-50)", padding: "1px 6px", borderRadius: "var(--radius-pill)" }}>declarado</span>}
              {c.origemDados === "simulado" && <span style={{ fontSize: 10, color: "var(--indigo)", background: "var(--indigo-50)", padding: "1px 6px", borderRadius: "var(--radius-pill)" }}>simulado</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MeuDesempenho({ stats, settings }) {
  if (!stats) return <Card style={{ padding: 20 }}><p style={{ color: "var(--muted)" }}>Carregando...</p></Card>;
  const meta = settings?.metaDiaria || 30;
  const progresso = Math.min(100, Math.round(((stats.totalLigacoes || 0) / meta) * 100));

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>MEU DESEMPENHO</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.totalLigacoes || 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Ligações</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{stats.atendidas || 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Atendidas</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--indigo)" }}>{stats.reunioes || 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Reuniões</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand)" }}>{stats.vendas || 0}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Vendas</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.taxaAtendimento || 0}%</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Taxa de atendimento</div>
        </div>
        <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.taxaConversao || 0}%</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Taxa de conversão</div>
        </div>
      </div>

      {/* Meta progress */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: "var(--muted)" }}>Meta diária</span>
          <span style={{ fontWeight: 600 }}>{stats.totalLigacoes || 0}/{meta}</span>
        </div>
        <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progresso}%`, background: progresso >= 100 ? "var(--green)" : "var(--brand)", borderRadius: 4, transition: "width .3s" }} />
        </div>
      </div>
    </Card>
  );
}
