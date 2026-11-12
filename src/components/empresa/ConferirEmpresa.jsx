import { useState } from "react";
import { CheckCircle2, X, AlertTriangle, Clock, ChevronDown, Eye, UserPlus, MessageSquare, Shield, ToggleLeft, ToggleRight, TrendingUp, Megaphone } from "lucide-react";

export const STATUS_CLIENTE = {
  aguardando:       { label: "Aguardando",       cor: "#64748B", bg: "#F1F5F9" },
  em_contato:       { label: "Em contato",       cor: "#2563EB", bg: "#EFF6FF" },
  negociando:       { label: "Negociando",       cor: "#7C3AED", bg: "#F5F3FF" },
  proposta_enviada: { label: "Proposta enviada", cor: "#D97706", bg: "#FFFBEB" },
  ganho:            { label: "Ganho ✓",          cor: "#059669", bg: "#ECFDF5" },
  perdido:          { label: "Perdido",           cor: "#DC2626", bg: "#FEF2F2" },
  sem_resposta:     { label: "Sem resposta",      cor: "#94A3B8", bg: "#F8FAFC" },
  reagendado:       { label: "Reagendado",        cor: "#0891B2", bg: "#ECFEFF" },
  liberar_saldo:    { label: "Liberar saldo ↑",  cor: "#166534", bg: "#DCFCE7" },
};
import { api, apiPatch } from "../../lib/api.js";
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

function ConfigAprovacaoProfissionais({ aviso, campanhasAutoDefault }) {
  const [auto, setAuto] = useState(!!campanhasAutoDefault);
  const [salvando, setSalvando] = useState(false);

  const alternar = async () => {
    setSalvando(true);
    const novoValor = !auto;
    const r = await apiPatch("/company/approval-config", { campanhasAutoDefault: novoValor });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    setAuto(novoValor);
    aviso(novoValor ? "Padrão alterado: profissionais aprovados entram em todas as campanhas automaticamente." : "Padrão alterado: cada campanha exigirá aprovação manual.");
  };

  return (
    <div className="vx-card" style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <UserPlus size={20} color="var(--brand)" />
        <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>Aprovação de profissionais</h3>
      </div>
      <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 14px" }}>
        Quando um profissional é aprovado para trabalhar com sua empresa, ele pode ser incluído em todas as campanhas automaticamente ou precisar de aprovação manual para cada campanha.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          className="vx-btn vx-btn-sm"
          style={{ gap: 6, opacity: salvando ? 0.6 : 1 }}
          onClick={alternar}
          disabled={salvando}
        >
          {auto ? <ToggleRight size={18} color="var(--brand)" /> : <ToggleLeft size={18} />}
          {auto ? "Campanhas automáticas (ativo)" : "Aprovação manual por campanha (ativo)"}
        </button>
        <span className="vx-mut" style={{ fontSize: 12 }}>
          Este é o padrão — pode ser ajustado por profissional na aprovação.
        </span>
      </div>
    </div>
  );
}

function CardSolicitacao({ seller, solicitacao, onAprovar, onRecusar }) {
  const [campanhasAuto, setCampanhasAuto] = useState(null);
  const diasAguardando = solicitacao.criadoEm
    ? Math.max(0, Math.floor((Date.now() - solicitacao.criadoEm) / (1000 * 60 * 60 * 24)))
    : null;
  const diasCor = diasAguardando === null ? "#64748B" : diasAguardando >= 8 ? "#DC2626" : diasAguardando >= 3 ? "#B45309" : "#16A34A";

  return (
    <div className="vx-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      {/* AVATAR */}
      <div style={{ width: 54, height: 54, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
        {seller?.foto
          ? <img src={typeof seller.foto === "string" && seller.foto.startsWith("data:") ? seller.foto : `/api/sellers/${seller.id}/foto`} alt={seller?.nome} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>{iniciais(seller?.nome)}</span>
        }
      </div>

      {/* INFO */}
      <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>{capitalizar(seller?.nome || "Profissional")}</span>
          {diasAguardando !== null && (
            <span style={{ background: diasCor, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px" }}>
              {diasAguardando === 0 ? "hoje" : `${diasAguardando}d`}
            </span>
          )}
          <span style={{ background: "#fffbeb", color: "#92400e", fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 8px" }}>Aguardando aprovação</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          <Clock size={11} style={{ marginRight: 3, verticalAlign: "-1px" }} />
          {solicitacao.criadoEm ? dataCurta(solicitacao.criadoEm) : "Data não registrada"}
          {seller?.cidade && ` · ${seller.cidade}${seller?.estado ? `, ${seller.estado}` : ""}`}
          {seller?.titulo && ` · ${seller.titulo}`}
        </span>
        {solicitacao.mensagem && (
          <div style={{ padding: "6px 10px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 2 }}>
            <MessageSquare size={11} style={{ marginRight: 4, verticalAlign: "-1px", color: "var(--muted)" }} />{solicitacao.mensagem}
          </div>
        )}
        <button
          style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", marginTop: 2 }}
          onClick={() => setCampanhasAuto((v) => v === null ? false : v === false ? true : null)}
        >
          {campanhasAuto === true ? <ToggleRight size={16} color="var(--brand)" /> : <ToggleLeft size={16} />}
          {campanhasAuto === true ? "Auto em campanhas" : campanhasAuto === false ? "Manual por campanha" : "Usar padrão da empresa"}
        </button>
      </div>

      {/* AÇÕES */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button className="vx-prof-card__btn" style={{ width: "auto", padding: "0 16px", fontSize: 13, height: 40, minHeight: 40, gap: 6 }} onClick={() => onAprovar(seller.id, campanhasAuto)}>
          <CheckCircle2 size={14} /> Aprovar
        </button>
        <button className="vx-prof-card__btn vx-prof-card__btn--danger" style={{ width: "auto", padding: "0 16px", fontSize: 13, height: 40, minHeight: 40, gap: 6 }} onClick={() => onRecusar(seller.id)}>
          <X size={14} /> Recusar
        </button>
      </div>
    </div>
  );
}

const TH = ({ children, right }) => (
  <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textAlign: right ? "right" : "left", whiteSpace: "nowrap", borderBottom: "1.5px solid var(--border)", background: "var(--surface-2)" }}>
    {children}
  </th>
);

const TD = ({ children, right, muted }) => (
  <td style={{ padding: "10px 12px", fontSize: 13, color: muted ? "var(--muted)" : "var(--ink)", textAlign: right ? "right" : "left", borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
    {children}
  </td>
);

function BadgeStatus({ val }) {
  const st = STATUS_CLIENTE[val] || STATUS_CLIENTE.aguardando;
  return (
    <span style={{ background: st.bg, color: st.cor, fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>
      {st.label}
    </span>
  );
}

function TabelaHistorico({ subs, db }) {
  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden", marginBottom: 32 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <TH>Profissional</TH>
              <TH>Ação</TH>
              <TH>Campanha</TH>
              <TH right>Valor</TH>
              <TH>Data</TH>
              <TH>Status do cliente</TH>
              <TH>Aprovação</TH>
            </tr>
          </thead>
          <tbody>
            {[...subs].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)).map((sub) => {
              const seller = db.sellers.find((s) => s.id === sub.sellerId);
              const campanha = db.campaigns?.find((c) => c.id === sub.campaignId);
              const st = STATUS[sub.status] || STATUS.analisando;
              const nome = capitalizar(seller?.nome || "Profissional");
              return (
                <tr key={sub.id} style={{ transition: "background .1s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                >
                  <TD>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      {seller?.foto
                        ? <img src={`/api/sellers/${seller.id}/foto`} alt={nome} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{iniciais(seller?.nome)}</div>
                      }
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{nome}</span>
                    </div>
                  </TD>
                  <TD>{TIPO_LABEL[sub.tipo] || sub.tipo || "—"}</TD>
                  <TD muted>{campanha?.titulo || "—"}</TD>
                  <TD right><span style={{ fontWeight: 600, color: "var(--brand)" }}>{money(sub.valor)}</span></TD>
                  <TD muted>{dataCurta(sub.criadoEm)}</TD>
                  <TD><BadgeStatus val={sub.statusCliente} /></TD>
                  <TD>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                      background: st.tone === "indigo" ? "#EEF2FF" : st.tone === "amber" ? "#FFFBEB" : st.tone === "red" ? "#FEF2F2" : "#F0FDF4",
                      color: st.tone === "indigo" ? "#3730A1" : st.tone === "amber" ? "#92400E" : st.tone === "red" ? "#B91C1C" : "#166534",
                    }}>{st.txt}</span>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ConferirEmpresa({ emp, db, setDb, aviso, secao = "fila", recarregar, filtroData }) {
  const [abaFila, setAbaFila] = useState("empresa"); // "empresa" | "campanhas"
  const solicitacoes = db.solicitacoesPendentes || [];
  // Candidaturas pendentes das campanhas da empresa (aprovar para participar
  // daquela campanha específica — diferente de aprovar para a empresa inteira).
  const candidaturasCampanha = (db.campaigns || [])
    .filter((c) => c.companyId === emp.id)
    .flatMap((c) => (c.candidaturas || [])
      .filter((a) => a.status === "pendente")
      .map((a) => ({ campanha: c, app: a, seller: db.sellers.find((s) => s.id === a.sellerId) })));

  const decidirCandidatura = async (campanhaId, appId, status) => {
    const r = await apiPatch(`/campaigns/${campanhaId}/applications/${appId}`, { status });
    if (!r || r.error) return aviso(r?.error || "Não foi possível decidir a candidatura.");
    aviso(status === "aprovado" ? "Candidatura aprovada para a campanha." : "Candidatura recusada.");
    await recarregar?.();
  };
  const revisaoBase = db.submissions.filter((s) => s.companyId === emp.id && s.status === "revisao");
  const iaAprovadosBase = db.submissions.filter((s) => s.companyId === emp.id && ["ia_aprovado", "conferido"].includes(s.status));

  const aplicarFiltro = (lista) => {
    if (!filtroData) return lista;
    const { dataInicio, dataFim, campo, direcao } = filtroData;
    let r = lista;
    if (dataInicio) r = r.filter((s) => Number(s.criadoEm) >= new Date(dataInicio).getTime());
    if (dataFim)    r = r.filter((s) => Number(s.criadoEm) <= new Date(dataFim + "T23:59:59").getTime());
    if (campo) r = [...r].sort((a, b) => {
      const va = a[campo] ?? ""; const vb = b[campo] ?? "";
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return direcao === "asc" ? cmp : -cmp;
    });
    return r;
  };

  const revisao = aplicarFiltro(revisaoBase);
  const iaAprovados = aplicarFiltro(iaAprovadosBase);

  const aprovarProfissional = async (sellerId, campanhasAuto) => {
    const r = await apiPatch("/applications", { sellerId, companyId: emp.id, status: "aprovado", campanhasAuto });
    if (r?.error) return aviso(r.error);
    aviso("Profissional aprovado!");
    recarregar?.();
  };

  const recusarProfissional = async (sellerId) => {
    const r = await apiPatch("/applications", { sellerId, companyId: emp.id, status: "recusado" });
    if (r?.error) return aviso(r.error);
    aviso("Solicitação recusada.");
    recarregar?.();
  };

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
          <div className="vx-eyebrow">{secao === "regras" ? "Configurações" : "Governança de evidências"}</div>
          <h1 className="vx-disp">{secao === "regras" ? "Regras automáticas" : "Aprovações"}</h1>
          <p>{secao === "regras"
            ? "Configure a aprovação de profissionais e a conferência automática de ações."
            : "Revisão manual, recusas, contestações e decisões rastreáveis."}</p>
        </div>
        {secao !== "regras" && <span className="vx-chip vx-mono">{revisao.length} pendentes</span>}
      </div>

      {secao === "regras" && <>
        <ConfigAprovacaoProfissionais aviso={aviso} campanhasAutoDefault={db.campanhasAutoDefault} />
        <RegrasAprovacao aviso={aviso} />
      </>}

      {secao === "fila" && (
        <>
          {/* ── Abas: aprovação na empresa vs. candidatura em campanha ── */}
          <div className="vx-seg vx-subnav" style={{ marginBottom: 18 }}>
            <button data-on={abaFila === "empresa" ? "1" : "0"} onClick={() => setAbaFila("empresa")}>
              Empresa{solicitacoes.length > 0 ? ` (${solicitacoes.length})` : ""}
            </button>
            <button data-on={abaFila === "campanhas" ? "1" : "0"} onClick={() => setAbaFila("campanhas")}>
              Campanhas{candidaturasCampanha.length > 0 ? ` (${candidaturasCampanha.length})` : ""}
            </button>
          </div>

          {/* ── Aba Empresa: aprovar o profissional para trabalhar com a empresa ── */}
          {abaFila === "empresa" && <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>
                <UserPlus size={18} style={{ marginRight: 6, verticalAlign: "-3px" }} />
                Profissionais aguardando aprovação
              </h3>
              {solicitacoes.length > 0 && <span className="vx-chip vx-mono">{solicitacoes.length}</span>}
            </div>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 14px" }}>Aprovar libera o profissional para trabalhar com a sua empresa (todas as campanhas, conforme a regra).</p>

            {!solicitacoes.length
              ? (
                <div className="vx-card" style={{ padding: 24, textAlign: "center", marginBottom: 28 }}>
                  <Shield size={28} color="var(--muted)" style={{ display: "block", margin: "0 auto 10px" }} />
                  <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>Nenhum profissional aguardando aprovação no momento.</p>
                </div>
              )
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                  {solicitacoes.map((sol) => {
                    const seller = db.sellers.find((s) => s.id === sol.sellerId);
                    return (
                      <CardSolicitacao
                        key={sol.sellerId}
                        seller={seller}
                        solicitacao={sol}
                        onAprovar={aprovarProfissional}
                        onRecusar={recusarProfissional}
                      />
                    );
                  })}
                </div>
              )}
          </>}

          {/* ── Aba Campanhas: aprovar a candidatura numa campanha específica ── */}
          {abaFila === "campanhas" && <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h3 className="vx-disp" style={{ fontSize: 16, margin: 0 }}>
                <Megaphone size={18} style={{ marginRight: 6, verticalAlign: "-3px" }} />
                Candidaturas às campanhas
              </h3>
              {candidaturasCampanha.length > 0 && <span className="vx-chip vx-mono">{candidaturasCampanha.length}</span>}
            </div>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 14px" }}>Aprovar libera o profissional apenas para aquela campanha específica.</p>

            {!candidaturasCampanha.length
              ? (
                <div className="vx-card" style={{ padding: 24, textAlign: "center", marginBottom: 28 }}>
                  <Shield size={28} color="var(--muted)" style={{ display: "block", margin: "0 auto 10px" }} />
                  <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>Nenhuma candidatura pendente nas suas campanhas.</p>
                </div>
              )
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                  {candidaturasCampanha.map(({ campanha, app, seller }) => (
                    <div key={`${campanha.id}-${app.id || app.sellerId}`} className="vx-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ width: 54, height: 54, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
                        {seller?.foto
                          ? <img src={typeof seller.foto === "string" && seller.foto.startsWith("data:") ? seller.foto : `/api/sellers/${seller.id}/foto`} alt={seller?.nome} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>{iniciais(seller?.nome)}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>{capitalizar(seller?.nome || "Profissional")}</span>
                          <span style={{ background: "#fffbeb", color: "#92400e", fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 8px" }}>Aguardando aprovação</span>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          <Megaphone size={11} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                          {campanha.titulo || "Campanha"}{app.criadoEm ? ` · ${dataCurta(app.criadoEm)}` : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="vx-prof-card__btn" style={{ width: "auto", padding: "0 16px", fontSize: 13, height: 40, minHeight: 40, gap: 6 }} onClick={() => decidirCandidatura(campanha.id, app.id, "aprovado")}>
                          <CheckCircle2 size={14} /> Aprovar
                        </button>
                        <button className="vx-prof-card__btn vx-prof-card__btn--danger" style={{ width: "auto", padding: "0 16px", fontSize: 13, height: 40, minHeight: 40, gap: 6 }} onClick={() => decidirCandidatura(campanha.id, app.id, "recusado")}>
                          <X size={14} /> Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </>}

        </>
      )}
    </>
  );
}
