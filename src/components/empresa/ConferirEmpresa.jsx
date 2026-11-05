import { useState } from "react";
import { CheckCircle2, X, AlertTriangle, Clock, ChevronDown, Eye } from "lucide-react";
import { apiPatch } from "../../lib/api.js";
import RegrasAprovacao from "./RegrasAprovacao.jsx";
import TrilhaAuditoria from "./TrilhaAuditoria.jsx";
import { ACOES, STATUS, MOTIVO_COR } from "../../lib/constants.js";
import { money, dataCurta } from "../../lib/utils.js";
import { Medidor } from "../ui.jsx";

const TIPO_LABEL = { agendamento: "Reunião agendada", realizada: "Visita realizada", venda: "Venda fechada", lead: "Lead gerado" };

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "PR";
}
function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function CardProfAprovacao({ sub, seller, db, onConfirmar, onRecusar, onContestar, modo }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const campanha = db.campaigns?.find((x) => x.id === sub.campaignId);
  const st = STATUS[sub.status] || STATUS.analisando;
  const acao = ACOES[sub.tipo] || { nome: sub.tipo || "Tarefa" };
  const scoreVal = Number(seller?.nota || 0);
  const scoreCor = scoreVal >= 80 ? "#0E7490" : scoreVal >= 50 ? "#b45309" : "#dc2626";

  return (
    <article className="vx-prof-card" style={{ cursor: "default", height: "auto", minHeight: 420 }}>
      {/* FOTO */}
      <div className="vx-prof-card__img" style={{ position: "relative" }}>
        {seller?.foto
          ? <img src={seller.foto} alt={seller?.nome} loading="lazy" decoding="async" />
          : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 36, fontWeight: 700, color: "var(--brand)", fontFamily: "var(--font-disp)" }}>{iniciais(seller?.nome)}</div>
        }
        {/* badge score */}
        <span style={{ position: "absolute", top: 10, right: 10, background: scoreCor, color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>
          {scoreVal} pts
        </span>
        {/* badge status da submissão */}
        <span style={{
          position: "absolute", bottom: 10, left: 10,
          background: st.tone === "green" ? "#dcfce7" : st.tone === "red" ? "#fee2e2" : st.tone === "amber" ? "#fffbeb" : "#eff6ff",
          color: st.tone === "green" ? "#166534" : st.tone === "red" ? "#b91c1c" : st.tone === "amber" ? "#92400e" : "#1e40af",
          fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
        }}>
          {st.txt}
        </span>
      </div>

      {/* CONTEÚDO */}
      <div className="vx-prof-card__body">
        <div className="vx-prof-card__info">
          {/* nome */}
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {capitalizar(seller?.nome || "Profissional")}
          </span>

          {/* tarefa + campanha */}
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            <b style={{ color: "var(--ink-2)" }}>{TIPO_LABEL[sub.tipo] || acao.nome}</b>
          </span>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {campanha?.titulo || "Sem campanha"} · {dataCurta(sub.criadoEm)}
          </span>

          {/* valor */}
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)", marginTop: 2 }}>
            {money(sub.valor)}
          </span>

          {/* barra de confiança */}
          {typeof sub.confianca === "number" && (
            <div style={{ marginTop: 4 }}>
              <Medidor value={sub.confianca} tone={st.tone === "red" ? "red" : st.tone === "amber" ? "amber" : "brand"} />
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{sub.confianca}% confiança · {sub.fonte === "ia" ? "IA" : "manual"}</span>
            </div>
          )}

          {/* motivo se houver */}
          {sub.motivo && (
            <span style={{ fontSize: 11.5, color: MOTIVO_COR[sub.status] || "var(--muted)", marginTop: 2 }}>{sub.motivo}</span>
          )}

          {/* detalhes expansíveis */}
          <button
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, color: "var(--brand)", display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}
            onClick={() => setAberto((v) => !v)}
          >
            <Eye size={12} />
            {aberto ? "Ocultar detalhes" : "Ver evidências"}
            <ChevronDown size={11} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: ".15s" }} />
          </button>

          {aberto && (
            <div style={{ marginTop: 6 }}>
              <TrilhaAuditoria submissionId={sub.id} />
            </div>
          )}
        </div>

        {/* AÇÕES */}
        <div className="vx-prof-card__actions">
          {modo === "revisao" && (
            <>
              <input
                style={{ width: "100%", padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none", marginBottom: 8, boxSizing: "border-box", background: "var(--surface-2)", color: "var(--ink)" }}
                placeholder="Motivo (se for recusar)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="vx-prof-card__btn"
                  style={{ flex: 1, fontSize: 12, height: 38, minHeight: 38, gap: 5 }}
                  onClick={() => onConfirmar(sub)}
                >
                  <CheckCircle2 size={13} /> Confirmar
                </button>
                <button
                  className="vx-prof-card__btn vx-prof-card__btn--danger"
                  style={{ flex: 1, fontSize: 12, height: 38, minHeight: 38, gap: 5 }}
                  onClick={() => onRecusar(sub, motivo)}
                >
                  <X size={13} /> Recusar
                </button>
              </div>
            </>
          )}
          {modo === "historico" && (
            <button
              className="vx-prof-card__btn vx-prof-card__btn--muted"
              style={{ fontSize: 12, height: 38, minHeight: 38, gap: 5 }}
              onClick={() => onContestar(sub)}
            >
              <AlertTriangle size={13} /> Algo errado — revisar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ConferirEmpresa({ emp, db, setDb, aviso, secao = "fila" }) {

  const revisao = db.submissions.filter((s) => s.companyId === emp.id && s.status === "revisao");
  const iaAprovados = db.submissions.filter((s) => s.companyId === emp.id && ["ia_aprovado", "conferido"].includes(s.status));

  const confirmar = async (sub) => {
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "conferido", motivo: "Confirmado manualmente pela empresa." });
    if (!r || r.error) return aviso(r?.error || "Não foi possível confirmar.");
    setDb((d) => ({ ...d, submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "conferido", motivo: "Confirmado manualmente pela empresa." } : s) }));
    aviso("Confirmado. A plataforma libera o pagamento.");
  };

  const recusar = async (sub, motivo) => {
    const m = (motivo || "").trim();
    if (!m) return aviso("Escreva o motivo da recusa. O vendedor precisa saber o que corrigir.");
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "recusado", motivo: m });
    if (!r || r.error) return aviso(r?.error || "Não foi possível recusar.");
    setDb((d) => ({ ...d, submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "recusado", motivo: m } : s) }));
    aviso("Ação recusada.");
  };

  const contestar = async (sub) => {
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "revisao", motivo: "Empresa sinalizou dúvida sobre a aprovação automática." });
    if (!r || r.error) return aviso(r?.error || "Não foi possível enviar para revisão.");
    setDb((d) => ({ ...d, submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "revisao", motivo: "Empresa sinalizou dúvida sobre a aprovação automática." } : s) }));
    aviso("Enviado para revisão manual.");
  };

  return (
    <>
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Governança de evidências</div>
          <h1 className="vx-disp">Aprovações</h1>
          <p>Revisão manual, recusas, contestações e decisões rastreáveis.</p>
        </div>
        <span className="vx-chip vx-mono">{revisao.length} pendentes</span>
      </div>

      {secao === "regras" && <RegrasAprovacao aviso={aviso} />}

      {secao === "fila" && (
        <>
          {/* ── Revisão manual ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>Revisão manual</h3>
            {revisao.length > 0 && <span className="vx-chip vx-mono">{revisao.length}</span>}
          </div>

          {!revisao.length
            ? (
              <div className="vx-card" style={{ padding: 24, textAlign: "center", marginBottom: 28 }}>
                <Clock size={28} color="var(--muted)" style={{ display: "block", margin: "0 auto 10px" }} />
                <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>Nada pendente de revisão humana no momento.</p>
              </div>
            )
            : (
              <div className="vx-prof-grid" style={{ marginBottom: 32 }}>
                {revisao.map((sub) => {
                  const seller = db.sellers.find((s) => s.id === sub.sellerId);
                  return (
                    <CardProfAprovacao
                      key={sub.id}
                      sub={sub}
                      seller={seller}
                      db={db}
                      onConfirmar={confirmar}
                      onRecusar={recusar}
                      onContestar={contestar}
                      modo="revisao"
                    />
                  );
                })}
              </div>
            )}

          {/* ── Decisões automáticas históricas ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>Decisões automáticas históricas</h3>
            {iaAprovados.length > 0 && <span className="vx-chip vx-mono">{iaAprovados.length}</span>}
          </div>

          {!iaAprovados.length
            ? (
              <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
                <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>Nenhum nas últimas horas.</p>
              </div>
            )
            : (
              <div className="vx-prof-grid">
                {iaAprovados.map((sub) => {
                  const seller = db.sellers.find((s) => s.id === sub.sellerId);
                  return (
                    <CardProfAprovacao
                      key={sub.id}
                      sub={sub}
                      seller={seller}
                      db={db}
                      onConfirmar={confirmar}
                      onRecusar={recusar}
                      onContestar={contestar}
                      modo="historico"
                    />
                  );
                })}
              </div>
            )}
        </>
      )}
    </>
  );
}
