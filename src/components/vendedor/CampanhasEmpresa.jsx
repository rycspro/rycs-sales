import { useState } from "react";
import { ArrowLeft, Award, Users, DollarSign, Target, Lock, CheckCircle, Clock } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { atendeCertificacaoDaCampanha } from "../../../shared/campaignAcademy.js";

function calcDisponivel(campanha, submissions) {
  const subs = (submissions || []).filter((s) => s.campaignId === campanha.id);
  const aprovados = subs.filter((s) => ["liberado", "aprovado"].includes(s.status));
  const pendentes = subs.filter((s) => ["pendente", "revisao", "ia_aprovado"].includes(s.status));
  const consumido = aprovados.reduce((a, s) => a + (s.valor || 0), 0);
  const aguardando = pendentes.reduce((a, s) => a + (s.valor || 0), 0);
  const total = campanha.orcamento || 0;
  return { total, disponivel: Math.max(0, total - consumido - aguardando) };
}

function StatusChip({ status }) {
  const mapa = {
    ativa: { label: "Ativa", color: "#16a34a", bg: "rgba(22,163,74,.1)" },
    pausada: { label: "Pausada", color: "#b45309", bg: "#fef3c7" },
    encerrada: { label: "Encerrada", color: "#6b7280", bg: "var(--surface-3)" },
    concluida: { label: "Concluída", color: "#6b7280", bg: "var(--surface-3)" },
  };
  const s = mapa[status] || mapa.encerrada;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: "2px 9px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

function CampanhaCard({ campanha, eu, db, onAbrir, onCandidatar, irAcademy, aviso }) {
  const [candidatando, setCandidatando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const candidatura = campanha.candidaturas?.[0];
  const certificada = atendeCertificacaoDaCampanha(campanha, eu.certificacoes);
  const quizCampanhaOk = campanha.quizAprovado || !campanha.exigeCertificacao || !(campanha.quiz?.length);
  const tarefas = campanha.tarefas || {};
  const tiposAtivos = Object.entries(tarefas).filter(([, v]) => v > 0);
  const ativos = (campanha.candidaturas || []).filter((a) => a.status === "aprovado").length;
  const orc = calcDisponivel(campanha, db.submissions);

  async function candidatar() {
    setCandidatando(true);
    const r = await api(`/campaigns/${campanha.id}/apply`, { mensagem: mensagem.trim() });
    setCandidatando(false);
    if (r?.error) return aviso?.(r.error);
    onCandidatar?.();
  }

  const podeOperar = candidatura?.status === "aprovado";

  return (
    <div className="vx-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="vx-disp" style={{ fontSize: 16, marginBottom: 2 }}>{campanha.titulo}</div>
          {campanha.descricao && <p className="vx-mut" style={{ fontSize: 12, margin: 0, lineHeight: 1.4 }}>{campanha.descricao}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <StatusChip status={campanha.status} />
          {campanha.funcao && <span className="vx-chip" style={{ fontSize: 10 }}>{campanha.funcao.toUpperCase()}</span>}
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {orc.total > 0 && (
          <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginBottom: 2 }}>Disponível</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--brand)" }}>{money(orc.disponivel)}</div>
          </div>
        )}
        {ativos > 0 && (
          <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginBottom: 2 }}>Profissionais</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{ativos}</div>
          </div>
        )}
        {campanha.regiao && (
          <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginBottom: 2 }}>Região</div>
            <div style={{ fontWeight: 600, fontSize: 12.5 }}>{campanha.regiao}</div>
          </div>
        )}
      </div>

      {/* Remuneração por ação */}
      {tiposAtivos.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {tiposAtivos.map(([tipo, valor]) => (
            <span key={tipo} className="vx-chip vx-mono" style={{ fontSize: 10.5 }}>
              {ACOES[tipo]?.nome || tipo} <b style={{ color: "var(--brand)" }}>{money(valor)}</b>
            </span>
          ))}
        </div>
      )}

      {/* Certificação necessária */}
      {campanha.exigeCertificacao && !podeOperar && !certificada && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#b45309", background: "#fef3c7", borderRadius: 8, padding: "7px 10px" }}>
          <Award size={13} /> Exige certificação Academy ({campanha.funcao})
        </div>
      )}

      {/* CTA */}
      {podeOperar ? (
        <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => onAbrir(campanha.id)} style={{ marginTop: 4 }}>
          <Target size={14} /> Abrir campanha
        </button>
      ) : candidatura?.status === "pendente" ? (
        <button className="vx-btn vx-btn-block" disabled style={{ marginTop: 4 }}>
          <Clock size={14} /> Candidatura em análise
        </button>
      ) : campanha.candidaturasAbertas === false ? (
        <button className="vx-btn vx-btn-block" disabled style={{ marginTop: 4 }}>
          Candidaturas encerradas
        </button>
      ) : (
        <div style={{ marginTop: 4 }}>
          <textarea
            className="vx-input" rows={2} value={mensagem} maxLength={1000}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Mensagem para a empresa (opcional): conte por que você é ideal para esta campanha."
            style={{ resize: "vertical", marginBottom: 8, fontSize: 13 }}
          />
          <button className="vx-btn vx-btn-primary vx-btn-block" disabled={candidatando} onClick={candidatar}>
            {candidatando ? "Enviando..." : "Candidatar-se a esta campanha"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CampanhasEmpresa({ empresa, eu, db, onAbrir, voltar, aviso, recarregar, irAcademy }) {
  const campanhas = (db.campaigns || []).filter((c) => c.companyId === empresa.id && c.status === "ativa");

  return (
    <div className="vx-fade">
      <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 14, marginLeft: -8 }} onClick={voltar}>
        <ArrowLeft size={14} /> Empresas
      </button>

      <div style={{ marginBottom: 18 }}>
        <div className="vx-eyebrow">{empresa.nome}</div>
        <div className="vx-disp" style={{ fontSize: 22, margin: "4px 0 2px" }}>Campanhas disponíveis</div>
        <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>
          Escolha uma campanha para entrar, fazer treinamento e começar a operar.
        </p>
      </div>

      {campanhas.length === 0 ? (
        <div className="vx-card" style={{ padding: 32, textAlign: "center" }}>
          <Target size={28} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 12 }}>Nenhuma campanha ativa no momento.</p>
        </div>
      ) : (
        <div className="vx-grid">
          {campanhas.map((c) => (
            <CampanhaCard
              key={c.id}
              campanha={c}
              eu={eu}
              db={db}
              onAbrir={onAbrir}
              onCandidatar={recarregar}
              irAcademy={irAcademy}
              aviso={aviso}
            />
          ))}
        </div>
      )}
    </div>
  );
}
