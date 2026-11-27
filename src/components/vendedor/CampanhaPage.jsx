import { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft, Target, BookOpen, Zap, Users, BarChart2, Award,
  CheckCircle, XCircle, TrendingUp,
  DollarSign, Shield, ChevronDown, ChevronUp, ClipboardCheck,
  ShieldCheck, AlertCircle, ArrowRight, MessageCircle
} from "lucide-react";
import { money } from "../../lib/utils.js";
import { ACOES, TAXA } from "../../lib/constants.js";
import { api, apiPatch } from "../../lib/api.js";
import CertificacaoCampanha from "./CertificacaoCampanha.jsx";
import Tarefas from "./Tarefas.jsx";
import MeusEnvios from "./MeusEnvios.jsx";
import Curso from "./Curso.jsx";
import Chat from "../Chat.jsx";
import { TIPOS_RESPOSTA, CLASSIFICACOES, calcularScore } from "../../../shared/qualificacaoLeads.js";
import { STATUS_CONFIRMACAO } from "../../../shared/confirmacaoContato.js";

const ABAS = [
  { id: "visao", label: "Visão Geral", Icon: Target },
  { id: "treinamento", label: "Treinamento", Icon: BookOpen },
  { id: "operacao", label: "Operação", Icon: Zap },
  { id: "leads", label: "Leads", Icon: ClipboardCheck },
  { id: "equipe", label: "Equipe", Icon: Users },
  { id: "resultados", label: "Meus Resultados", Icon: BarChart2 },
  { id: "envios", label: "Meus Envios", Icon: CheckCircle },
  { id: "chat", label: "Chat", Icon: null },
];

// Orçamento da campanha calculado a partir das submissions aprovadas/pendentes
function calcularOrcamento(campanha, submissions) {
  const subs = submissions.filter((s) => s.campaignId === campanha.id);
  const aprovados = subs.filter((s) => ["liberado", "aprovado"].includes(s.status));
  const pendentes = subs.filter((s) => ["pendente", "revisao", "ia_aprovado"].includes(s.status));
  const consumido = aprovados.reduce((a, s) => a + (s.valor || 0), 0);
  const aguardando = pendentes.reduce((a, s) => a + (s.valor || 0), 0);
  const total = campanha.orcamento || 0;
  const disponivel = Math.max(0, total - consumido - aguardando);
  return { total, consumido, aguardando, disponivel };
}

function BadgeStatus({ status }) {
  const mapa = {
    ativa: { label: "Ativa", color: "#16a34a", bg: "#f0fdf4" },
    pausada: { label: "Pausada", color: "#92400e", bg: "#fef3c7" },
    encerrada: { label: "Encerrada", color: "#6b7280", bg: "var(--surface-3)" },
  };
  const s = mapa[status] || mapa.encerrada;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: "2px 10px", fontSize: 11.5, fontWeight: 700 }}>{s.label}</span>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span className="vx-mut">{label}</span>
      <span style={{ fontWeight: 500, maxWidth: "55%", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function OrcamentoCard({ campanha, submissions }) {
  const orc = calcularOrcamento(campanha, submissions);
  if (!orc.total) return null;
  const pct = orc.total > 0 ? Math.min(100, Math.round(((orc.consumido + orc.aguardando) / orc.total) * 100)) : 0;
  return (
    <div className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <DollarSign size={14} color="var(--brand)" /> Orçamento da campanha
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { l: "Total", v: money(orc.total), accent: false },
          { l: "Consumido", v: money(orc.consumido), accent: false },
          { l: "Disponível", v: money(orc.disponivel), accent: true },
          { l: "Aguardando aprovação", v: money(orc.aguardando), accent: false },
        ].map(({ l, v, accent }) => (
          <div key={l} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 3 }}>{l}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: accent ? "var(--brand)" : "var(--ink)" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "var(--surface-3)", height: 6, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct > 85 ? "#dc2626" : "var(--brand)", borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4, textAlign: "right" }}>{pct}% utilizado</div>
    </div>
  );
}

function BloqueioCard({ onIrTreinamento }) {
  return (
    <div className="vx-card" style={{ padding: 24, textAlign: "center", border: "2px dashed var(--border)" }}>
      <Shield size={28} color="var(--muted)" />
      <div style={{ fontWeight: 700, fontSize: 15, marginTop: 12, marginBottom: 8 }}>Conclua a certificação para operar</div>
      <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 16px" }}>Esta campanha exige que você seja aprovado no quiz de certificação antes de executar tarefas.</p>
      <button className="vx-btn" onClick={onIrTreinamento}>Ir para o Treinamento</button>
    </div>
  );
}

function AcaoCard({ tipo, valor, acoes, onRegistrar }) {
  const def = acoes[tipo];
  if (!def) return null;
  const { Icon, nome, regra } = def;
  return (
    <div className="vx-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
          {Icon && <Icon size={16} color="var(--brand)" />}
          {nome}
        </div>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--brand)" }}>{money(valor)}</span>
      </div>
      <p className="vx-mut" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>{regra}</p>
      <button className="vx-btn vx-btn-sm" onClick={() => onRegistrar(tipo)}>Registrar ação</button>
    </div>
  );
}

function TreinamentoModulos({ campanha, onIrCertificacao, quizAprovado }) {
  const [aberto, setAberto] = useState({});
  const modulos = campanha.treinamento || [];
  const temQuiz = campanha.quiz?.length > 0;

  return (
    <div>
      {modulos.length === 0 && (
        <div className="vx-card" style={{ padding: 20, textAlign: "center" }}>
          <BookOpen size={22} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 8 }}>Nenhum módulo de treinamento configurado.</p>
        </div>
      )}
      {modulos.map((m, i) => (
        <div key={m.id || i} className="vx-card" style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
          <button
            style={{ width: "100%", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setAberto((p) => ({ ...p, [i]: !p[i] }))}
          >
            <span style={{ fontWeight: 600, fontSize: 13.5, textAlign: "left" }}>
              <span style={{ color: "var(--brand)", marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span>
              {m.titulo}
            </span>
            {aberto[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {aberto[i] && (
            <div style={{ padding: "0 14px 14px", fontSize: 13, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{m.conteudo}</div>
          )}
        </div>
      ))}
      {modulos.length > 0 && temQuiz && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          {quizAprovado
            ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#16a34a", fontWeight: 600, fontSize: 13 }}>
                <CheckCircle size={15} /> Certificado — pronto para operar
              </div>
            : <button className="vx-btn" onClick={onIrCertificacao}>Fazer a certificação</button>}
        </div>
      )}
    </div>
  );
}

function EquipeCard({ campanha, db }) {
  const apps = (campanha.candidaturas || []).filter((a) => a.status === "aprovado");
  const subs = (db.submissions || []).filter((s) => s.campaignId === campanha.id);
  const hoje = new Date().toDateString();
  const ativosHoje = new Set(
    subs.filter((s) => new Date(s.criadoEm).toDateString() === hoje).map((s) => s.sellerId)
  ).size;
  const aprovadas = subs.filter((s) => ["liberado", "aprovado"].includes(s.status)).length;
  const reunioes = subs.filter((s) => ["agendamento", "realizada"].includes(s.tipo) && ["liberado", "aprovado"].includes(s.status)).length;
  const vendas = subs.filter((s) => s.tipo === "venda" && ["liberado", "aprovado"].includes(s.status)).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { l: "Profissionais ativos", v: apps.length },
          { l: "Operando hoje", v: ativosHoje },
          { l: "Tarefas aprovadas", v: aprovadas },
          { l: "Reuniões", v: reunioes },
          { l: "Vendas fechadas", v: vendas },
        ].map(({ l, v }) => (
          <div key={l} className="vx-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 4 }}>{l}</div>
            <div style={{ fontWeight: 700, fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>
      {apps.length === 0 && (
        <p className="vx-mut" style={{ textAlign: "center", fontSize: 13 }}>Nenhum profissional aprovado ainda.</p>
      )}
    </div>
  );
}

function MeusResultadosCard({ campanha, eu, db }) {
  const subs = (db.submissions || []).filter((s) => s.campaignId === campanha.id && s.sellerId === eu.id);
  const aprovadas = subs.filter((s) => ["liberado", "aprovado"].includes(s.status));
  const pendentes = subs.filter((s) => ["pendente", "revisao", "ia_aprovado", "ia_recusado"].includes(s.status));
  const recusadas = subs.filter((s) => ["recusado"].includes(s.status));
  const ganhoAprovado = aprovadas.reduce((a, s) => a + (s.valor || 0) * (1 - TAXA), 0);
  const ganhoPendente = pendentes.reduce((a, s) => a + (s.valor || 0) * (1 - TAXA), 0);
  const taxa = subs.length ? Math.round((aprovadas.length / subs.length) * 100) : null;
  const reunioes = aprovadas.filter((s) => ["agendamento", "realizada"].includes(s.tipo)).length;
  const vendas = aprovadas.filter((s) => s.tipo === "venda").length;

  if (!subs.length) {
    return (
      <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
        <TrendingUp size={24} color="var(--muted)" />
        <p className="vx-mut" style={{ marginTop: 10 }}>Você ainda não possui envios nesta campanha.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { l: "Realizadas", v: subs.length },
          { l: "Aprovadas", v: aprovadas.length },
          { l: "Pendentes", v: pendentes.length },
          { l: "Recusadas", v: recusadas.length },
          { l: "Reuniões", v: reunioes },
          { l: "Vendas", v: vendas },
        ].map(({ l, v }) => (
          <div key={l} className="vx-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 4 }}>{l}</div>
            <div style={{ fontWeight: 700, fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="vx-card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Ganho aprovado</span>
          <span style={{ fontWeight: 700, color: "#16a34a" }}>{money(ganhoAprovado)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Ganho pendente</span>
          <span style={{ fontWeight: 700, color: "#92400e" }}>{money(ganhoPendente)}</span>
        </div>
        {taxa !== null && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Taxa de aprovação</span>
            <span style={{ fontWeight: 700 }}>{taxa}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fase 02: Qualificação do lead pelo profissional ────────────────────
function QualificacaoLeadCard({ lead, campanha, onQualificado }) {
  const perguntas = JSON.parse(campanha?.perguntasQualificacao || "[]");
  const criterios = JSON.parse(campanha?.criteriosQualificacaoLeads || "[]");
  const [respostas, setRespostas] = useState(() => {
    try { return JSON.parse(lead?.qualificacaoRespostas || "[]"); } catch { return []; }
  });
  const [salvando, setSalvando] = useState(false);

  if (!perguntas.length) return null;

  const setResposta = (perguntaId, valor) => {
    setRespostas((prev) => {
      const idx = prev.findIndex((r) => r.perguntaId === perguntaId);
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], valor }; return n; }
      return [...prev, { perguntaId, valor }];
    });
  };

  const resultado = calcularScore(respostas, criterios);

  const salvar = async () => {
    setSalvando(true);
    const r = await api(`/leads/${lead.id}/qualificar`, { respostas });
    setSalvando(false);
    if (r && !r.error && onQualificado) onQualificado(r);
  };

  return (
    <div className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <ClipboardCheck size={16} color="var(--brand)" />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Qualificação: {lead.nome || "Lead"}</span>
        {resultado.score > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: CLASSIFICACOES[resultado.classificacao]?.cor || "var(--ink)" }}>
            Score: {resultado.score}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {perguntas.map((p) => {
          const resp = respostas.find((r) => r.perguntaId === p.id);
          return (
            <div key={p.id}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {p.texto}{p.obrigatoria && <span style={{ color: "#dc2626" }}> *</span>}
              </div>
              {p.tipo === "sim_nao" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  {["Sim", "Não"].map((opt) => (
                    <button key={opt} className="vx-btn vx-btn-sm" style={{
                      background: resp?.valor === opt ? "var(--brand-50)" : "var(--surface)",
                      border: `1px solid ${resp?.valor === opt ? "var(--brand)" : "var(--border)"}`,
                      color: resp?.valor === opt ? "var(--brand)" : "var(--ink)",
                    }} onClick={() => setResposta(p.id, opt)}>{opt}</button>
                  ))}
                </div>
              ) : p.tipo === "escolha_unica" ? (
                <select className="vx-input" style={{ fontSize: 13 }} value={resp?.valor || ""}
                  onChange={(e) => setResposta(p.id, e.target.value)}>
                  <option value="">Selecione...</option>
                  {(p.opcoes || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : p.tipo === "escala" ? (
                <div style={{ display: "flex", gap: 4 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <button key={n} style={{
                      width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: `1px solid ${Number(resp?.valor) === n ? "var(--brand)" : "var(--border)"}`,
                      background: Number(resp?.valor) === n ? "var(--brand)" : "var(--surface)",
                      color: Number(resp?.valor) === n ? "#fff" : "var(--ink)", cursor: "pointer",
                    }} onClick={() => setResposta(p.id, n)}>{n}</button>
                  ))}
                </div>
              ) : p.tipo === "numero" || p.tipo === "valor_monetario" ? (
                <input className="vx-input" type="number" style={{ fontSize: 13 }} value={resp?.valor || ""}
                  onChange={(e) => setResposta(p.id, e.target.value)} placeholder={p.tipo === "valor_monetario" ? "R$ 0,00" : "0"} />
              ) : (
                <input className="vx-input" style={{ fontSize: 13 }} value={resp?.valor || ""}
                  onChange={(e) => setResposta(p.id, e.target.value)} placeholder="Responda aqui..." />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <div className="vx-mut" style={{ fontSize: 11.5 }}>{resultado.respondidas}/{resultado.total} respondidas</div>
        <button className="vx-btn vx-btn-sm vx-btn-primary" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando..." : "Salvar qualificação"}
        </button>
      </div>
    </div>
  );
}

// ── Fase 02: Recomendação de próxima atividade ─────────────────────────
function ProximaAtividadeCard({ lead, campanha, onAcao }) {
  const [rec, setRec] = useState(null);
  useEffect(() => {
    if (!lead?.id) return;
    api(`/leads/${lead.id}/proxima-atividade`, null, "GET").then((r) => {
      if (r && !r.error) setRec(r);
    });
  }, [lead?.id, lead?.etapa]);

  if (!rec || !rec.recomendacao?.acao) return null;
  const { acao, motivo, prioridade } = rec.recomendacao;
  const def = ACOES[acao];

  return (
    <div className="vx-card" style={{ padding: 14, marginBottom: 10, border: `1px solid ${prioridade === "alta" ? "var(--brand-100)" : "var(--border)"}`, background: prioridade === "alta" ? "var(--brand-50)" : "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Zap size={14} color="var(--brand)" />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Próxima ação sugerida:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>{def?.nome || acao}</span>
      </div>
      <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>{motivo}</div>
      {acao !== "confirmacao" && onAcao && (
        <button className="vx-btn vx-btn-sm" style={{ marginTop: 8 }} onClick={() => onAcao(acao)}>
          Registrar <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

// ── Fase 02: Status de confirmação ─────────────────────────────────────
function ConfirmacaoStatusCard({ lead }) {
  if (!lead || lead.confirmacaoStatus === "nao_enviada") return null;
  const st = STATUS_CONFIRMACAO[lead.confirmacaoStatus] || {};
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)", marginBottom: 8, fontSize: 12 }}>
      <ShieldCheck size={14} color={st.cor || "var(--ink-2)"} />
      <span>Confirmação: <b style={{ color: st.cor }}>{st.nome || lead.confirmacaoStatus}</b></span>
      {lead.confirmacaoRespondidaEm && <span className="vx-mut" style={{ marginLeft: "auto" }}>{new Date(lead.confirmacaoRespondidaEm).toLocaleDateString("pt-BR")}</span>}
    </div>
  );
}

function pedirRevisaoHumana(setDb, aviso, sub) {
  const liquido = +(sub.valor * (1 - TAXA)).toFixed(2);
  const motivo = "Vendedor contestou e pediu revisão humana. Motivo original da IA: " + (sub.motivo || "—");
  apiPatch(`/submissions/${sub.id}`, { status: "revisao", motivo });
  setDb((d) => ({
    ...d,
    submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "revisao", motivo } : s),
  }));
  aviso("Enviado para conferência humana da empresa.");
}

export default function CampanhaPage({ campanha, empresa, eu, db, setDb, up, aviso, voltar, recarregar }) {
  const [aba, setAba] = useState("visao");
  const [tipoAcao, setTipoAcao] = useState(null);
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const [leadsLocal, setLeadsLocal] = useState([]);

  useEffect(() => {
    const cl = (db.leads || []).filter((l) => l.campaignId === campanha.id);
    setLeadsLocal(cl);
  }, [db.leads, campanha.id]);

  const quizAprovado = campanha.quizAprovado || !campanha.exigeCertificacao || !(campanha.quiz?.length);
  const tarefas = campanha.tarefas || {};
  const tiposAtivos = Object.entries(tarefas).filter(([, v]) => v > 0);

  function abrirOperacao(tipo) {
    setTipoAcao(tipo);
    setAba("operacao");
  }

  const abas = ABAS.filter((a) => {
    if (a.id === "chat") return true;
    return true;
  });

  return (
    <div className="vx-fade">
      <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 12, marginLeft: -8 }} onClick={voltar}>
        <ArrowLeft size={14} /> Campanhas
      </button>

      {/* Header da campanha */}
      <div className="vx-card" style={{ padding: 16, marginBottom: 14, background: "var(--surface-2)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div className="vx-eyebrow">{empresa.nome}</div>
            <div className="vx-disp" style={{ fontSize: 20, margin: "4px 0" }}>{campanha.titulo}</div>
            {campanha.descricao && <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0" }}>{campanha.descricao}</p>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <BadgeStatus status={campanha.status} />
            {campanha.funcao && <span className="vx-chip">{campanha.funcao.toUpperCase()}</span>}
            {quizAprovado && campanha.quiz?.length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#16a34a", fontWeight: 600 }}>
                <Award size={12} /> Certificado
              </span>
            )}
          </div>
        </div>
        {tiposAtivos.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {tiposAtivos.map(([tipo, valor]) => (
              <span key={tipo} className="vx-chip vx-mono" style={{ fontSize: 11 }}>
                {ACOES[tipo]?.nome || tipo} <b style={{ color: "var(--brand)" }}>{money(valor)}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="vx-tabs" style={{ margin: "0 0 18px", overflowX: "auto" }}>
        {abas.map(({ id, label, Icon }) => (
          <button key={id} className="vx-tab" data-on={aba === id ? "1" : "0"} onClick={() => { setAba(id); setTipoAcao(null); }}>
            {Icon && <Icon size={13} style={{ marginRight: 4 }} />}
            {label}
          </button>
        ))}
      </div>

      {/* VISÃO GERAL */}
      {aba === "visao" && (
        <div className="vx-fade">
          <OrcamentoCard campanha={campanha} submissions={db.submissions || []} />
          <div className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Detalhes da operação</div>
            <InfoRow label="Produto / serviço" value={campanha.produto || empresa.produto} />
            <InfoRow label="Objetivo" value={campanha.objetivo} />
            <InfoRow label="Público / ICP" value={campanha.publico || campanha.icp || empresa.icp} />
            <InfoRow label="Região" value={campanha.regiao} />
            <InfoRow label="Modelo de operação" value={campanha.modeloOperacao || campanha.funcao} />
            <InfoRow label="Prazo da campanha" value={campanha.duracaoDias ? `${campanha.duracaoDias} dias` : null} />
            <InfoRow label="Prazo de envio de evidência" value={campanha.prazoHoras ? `${campanha.prazoHoras}h após a ação` : null} />
            <InfoRow label="Candidaturas" value={campanha.candidaturasAbertas === false ? "Encerradas" : "Abertas"} />
            {campanha.requisitos && (
              <div className="vx-notice" style={{ marginTop: 10, fontSize: 12.5 }}>
                <b>Requisitos:</b> {campanha.requisitos}
              </div>
            )}
          </div>
          {tiposAtivos.length > 0 && (
            <div className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Remuneração por ação</div>
              {tiposAtivos.map(([tipo, valor]) => (
                <div key={tipo} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span>{ACOES[tipo]?.nome || tipo}</span>
                  <span style={{ fontWeight: 700, color: "var(--brand)" }}>{money(valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TREINAMENTO */}
      {aba === "treinamento" && (
        <div className="vx-fade">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Treinamento da campanha</div>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: 0 }}>
              Conheça o produto, público, abordagem e regras desta operação antes de começar.
            </p>
          </div>
          <TreinamentoModulos
            campanha={campanha}
            onIrCertificacao={() => document.getElementById("certificacao-campanha")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            quizAprovado={campanha.quizAprovado}
          />
          {campanha.quiz?.length > 0 && (
            <div id="certificacao-campanha" style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Certificação</div>
              <CertificacaoCampanha
                campanha={campanha}
                eu={eu}
                onAprovado={() => recarregar && recarregar()}
              />
            </div>
          )}
          {/* Curso da empresa também disponível */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Academy da empresa</div>
            <Curso empresa={empresa} eu={eu} up={up} aviso={aviso} />
          </div>
        </div>
      )}

      {/* OPERAÇÃO */}
      {aba === "operacao" && (
        <div className="vx-fade">
          {!quizAprovado ? (
            <BloqueioCard onIrTreinamento={() => setAba("treinamento")} />
          ) : tipoAcao ? (
            <div>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 12, marginLeft: -8 }} onClick={() => setTipoAcao(null)}>
                <ArrowLeft size={14} /> Ações disponíveis
              </button>
              <Tarefas
                campanha={campanha}
                empresa={empresa}
                eu={eu}
                db={db}
                setDb={setDb}
                aviso={aviso}
                liberado={true}
                irCurso={() => setAba("treinamento")}
                recarregar={recarregar}
                tipoInicial={tipoAcao}
              />
            </div>
          ) : (
            <div className="vx-fade">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Ações disponíveis</div>
              <p className="vx-mut" style={{ fontSize: 12.5, marginBottom: 16 }}>Escolha uma ação para registrar. Cada ação tem valor e requisitos específicos desta campanha.</p>
              {tiposAtivos.length === 0 ? (
                <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
                  <Zap size={22} color="var(--muted)" />
                  <p className="vx-mut" style={{ marginTop: 8 }}>Nenhuma ação configurada nesta campanha.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {tiposAtivos.map(([tipo, valor]) => (
                    <AcaoCard key={tipo} tipo={tipo} valor={valor} acoes={ACOES} onRegistrar={abrirOperacao} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* LEADS */}
      {aba === "leads" && (
        <div className="vx-fade">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Leads da campanha</div>
          <p className="vx-mut" style={{ fontSize: 12.5, marginBottom: 16 }}>Gerencie, qualifique e acompanhe os leads vinculados a esta campanha.</p>

          {leadSelecionado ? (
            <div>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 12, marginLeft: -8 }} onClick={() => setLeadSelecionado(null)}>
                <ArrowLeft size={14} /> Voltar aos leads
              </button>

              <div className="vx-card" style={{ padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{leadSelecionado.nome || "Lead sem nome"}</div>
                {leadSelecionado.empresa && <div className="vx-mut" style={{ fontSize: 12 }}>{leadSelecionado.empresa}</div>}
                {leadSelecionado.telefone && <div style={{ fontSize: 12.5, marginTop: 4 }}>{leadSelecionado.telefone}</div>}
                {leadSelecionado.email && <div style={{ fontSize: 12.5 }}>{leadSelecionado.email}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {leadSelecionado.etapa && <span className="vx-chip">{leadSelecionado.etapa}</span>}
                  {leadSelecionado.origemLead && <span className="vx-chip">{leadSelecionado.origemLead}</span>}
                  {leadSelecionado.qualificacaoScore > 0 && (
                    <span className="vx-chip" style={{ background: "var(--brand-50)", color: "var(--brand)" }}>
                      Score: {leadSelecionado.qualificacaoScore}
                    </span>
                  )}
                </div>
              </div>

              <ConfirmacaoStatusCard lead={leadSelecionado} />
              {(!leadSelecionado.confirmacaoStatus || leadSelecionado.confirmacaoStatus === "nao_enviada") && campanha.confirmacaoContato && JSON.parse(campanha.confirmacaoContato || "{}").habilitada && (
                <button className="vx-btn vx-btn-sm" style={{ marginBottom: 10, gap: 6 }} onClick={async () => {
                  const r = await api(`/campaigns/${campanha.id}/confirmacao-token`, { leadId: leadSelecionado.id });
                  if (r?.token) {
                    setLeadSelecionado((prev) => ({ ...prev, confirmacaoStatus: "enviada" }));
                    aviso("Link de confirmação gerado!");
                  }
                }}>
                  <MessageCircle size={14} /> Enviar confirmação de contato
                </button>
              )}
              <ProximaAtividadeCard lead={leadSelecionado} campanha={campanha} onAcao={(tipo) => { setTipoAcao(tipo); setAba("operacao"); }} />
              <QualificacaoLeadCard
                lead={leadSelecionado}
                campanha={campanha}
                onQualificado={(r) => {
                  setLeadsLocal((prev) => prev.map((l) => l.id === leadSelecionado.id ? { ...l, qualificacaoScore: r.score, qualificacaoClassificacao: r.classificacao, qualificacaoRespostas: JSON.stringify(r.respostas) } : l));
                  setLeadSelecionado((prev) => ({ ...prev, qualificacaoScore: r.score, qualificacaoClassificacao: r.classificacao, qualificacaoRespostas: JSON.stringify(r.respostas) }));
                  aviso("Qualificação salva!");
                }}
              />
            </div>
          ) : (
            <div>
              {leadsLocal.length === 0 ? (
                <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
                  <ClipboardCheck size={22} color="var(--muted)" />
                  <p className="vx-mut" style={{ marginTop: 8 }}>Nenhum lead vinculado a esta campanha ainda.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {leadsLocal.map((lead) => {
                    const cls = CLASSIFICACOES[lead.qualificacaoClassificacao];
                    return (
                      <button key={lead.id} className="vx-card" style={{ padding: 14, textAlign: "left", cursor: "pointer", border: "1px solid var(--border)", width: "100%" }} onClick={() => setLeadSelecionado(lead)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{lead.nome || "Lead"}</div>
                            {lead.empresa && <div className="vx-mut" style={{ fontSize: 11.5 }}>{lead.empresa}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {lead.qualificacaoScore > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: cls?.cor || "var(--ink)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 10 }}>
                                {lead.qualificacaoScore}
                              </span>
                            )}
                            {lead.etapa && <span className="vx-chip" style={{ fontSize: 10.5 }}>{lead.etapa}</span>}
                            {lead.confirmacaoStatus && lead.confirmacaoStatus !== "nao_enviada" && (
                              <ShieldCheck size={14} color={(STATUS_CONFIRMACAO[lead.confirmacaoStatus] || {}).cor || "var(--ink-2)"} />
                            )}
                            <ArrowRight size={14} color="var(--muted)" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EQUIPE */}
      {aba === "equipe" && (
        <div className="vx-fade">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Equipe da campanha</div>
          <EquipeCard campanha={campanha} db={db} />
        </div>
      )}

      {/* MEUS RESULTADOS */}
      {aba === "resultados" && (
        <div className="vx-fade">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Meus resultados nesta campanha</div>
          <MeusResultadosCard campanha={campanha} eu={eu} db={db} />
        </div>
      )}

      {/* MEUS ENVIOS */}
      {aba === "envios" && (
        <MeusEnvios
          empresa={empresa}
          eu={eu}
          db={{ ...db, submissions: (db.submissions || []).filter((s) => s.campaignId === campanha.id) }}
          pedirRevisao={(sub) => pedirRevisaoHumana(setDb, aviso, sub)}
        />
      )}

      {/* CHAT */}
      {aba === "chat" && <Chat empresa={empresa} sellerId={eu.id} db={db} up={up} de="vendedor" />}
    </div>
  );
}
