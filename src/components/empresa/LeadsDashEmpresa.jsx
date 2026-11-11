import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Filter, Eye, X, CheckSquare, Square, Minus, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { Vazio, Medidor } from "../ui.jsx";
import { money, dataCurta } from "../../lib/utils.js";
import { api, apiPatch } from "../../lib/api.js";
import { STATUS_CLIENTE } from "./ConferirEmpresa.jsx";
import { STATUS, ACOES, CAMPOS, MOTIVO_COR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

const TIPO_LABEL_KEYS = {
  agendamento: "leads.type.meeting", realizada: "leads.type.visit",
  venda: "leads.type.sale", lead: "leads.type.lead",
  contato: "leads.type.contact", follow: "leads.type.followup", ligacao: "leads.type.call", visita: "leads.type.siteVisit",
};

function buildTempoRelativo(t) {
  return (ts) => {
    if (!ts) return "—";
    const diff = Date.now() - Number(ts);
    const seg = Math.floor(diff / 1000);
    if (seg < 60) return t("time.now");
    const min = Math.floor(seg / 60);
    if (min < 60) return t("time.minAgo", { n: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t("time.hoursAgo", { n: h });
    const d = Math.floor(h / 24);
    return t("time.daysAgo", { n: d });
  };
}

function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
}

function MiniAvatar({ seller, size = 30 }) {
  if (seller?.foto) {
    const src = typeof seller.foto === "string" && seller.foto.startsWith("data:")
      ? seller.foto : `/api/sellers/${seller.id}/foto`;
    return (
      <img src={src} alt={capitalizar(seller?.nome || "")} loading="lazy" style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        border: "2px solid var(--surface-2)", flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "var(--brand)",
      display: "grid", placeItems: "center", fontSize: size < 40 ? 11 : 20,
      fontWeight: 700, color: "#fff", flexShrink: 0, fontFamily: "var(--font-disp)",
    }}>
      {iniciais(seller?.nome)}
    </div>
  );
}

function BadgeStatus({ status }) {
  const st = STATUS[status] || STATUS.analisando;
  const cores = {
    indigo: { bg: "#EEF2FF", cor: "#3730A1" }, amber: { bg: "#FFFBEB", cor: "#92400E" },
    red: { bg: "#FEF2F2", cor: "#B91C1C" }, brand: { bg: "#F0FDF4", cor: "#166534" },
    muted: { bg: "#F1F5F9", cor: "#64748B" },
  };
  const c = cores[st.tone] || cores.muted;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
      background: c.bg, color: c.cor, whiteSpace: "nowrap",
    }}>{st.txt}</span>
  );
}

function BadgeCliente({ statusCliente }) {
  const st = STATUS_CLIENTE[statusCliente] || STATUS_CLIENTE.aguardando;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
      background: st.bg, color: st.cor, border: `1.5px solid ${st.cor}30`, whiteSpace: "nowrap",
    }}>{st.label}</span>
  );
}

// ── Modal de detalhes ──────────────────────────────────────────────────────
function ModalDetalhes({ sub, seller, camp, emp, setAba, onFechar }) {
  const { t } = useI18n();
  const tipoLabel = (k) => TIPO_LABEL_KEYS[k] ? t(TIPO_LABEL_KEYS[k]) : k;
  const tempoRelativo = buildTempoRelativo(t);
  const overlayRef = useRef(null);
  const acao = ACOES[sub.tipo] || { nome: sub.tipo || t("leads.task"), prova: Object.keys(sub.prova || {}).filter((k) => k !== "evidencias") };
  const prova = sub.prova || {};
  const evidencias = Array.isArray(prova.evidencias) ? prova.evidencias : [];
  const camposProva = (acao.prova || []).filter((k) => k !== "evidencias");
  const extraProva = Object.entries(prova).filter(([k]) => k !== "evidencias" && !camposProva.includes(k));
  const st = STATUS[sub.status] || STATUS.analisando;

  const tipoLabelVal = tipoLabel(sub.tipo) || sub.tipo || t("leads.task");
  const _linhasLead = [
    prova.cliente    && `• ${t("leads.detail.contact")}: ${prova.cliente}`,
    prova.empresa    && `• ${t("leads.detail.company")}: ${prova.empresa}`,
    prova.telefone   && `• ${t("leads.detail.phone")}: ${prova.telefone}`,
    prova.endereco   && `• ${t("leads.detail.address")}: ${prova.endereco}`,
    prova.resultado  && `• ${t("leads.detail.result")}: ${prova.resultado}`,
  ].filter(Boolean);
  const textoInicial = `${t("leads.msgIntro", { type: tipoLabelVal, campaign: camp?.titulo ? ` ${t("leads.inCampaign", { name: camp.titulo })}` : "", date: dataCurta(sub.criadoEm) })}${_linhasLead.length ? "\n\n" + _linhasLead.join("\n") : ""}\n\n`;

  const [compondo, setCompondo] = useState(false);
  const [texto, setTexto] = useState(textoInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (compondo && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(texto.length, texto.length);
    }
  }, [compondo]);

  const enviarMensagem = () => {
    if (!seller?.id || !emp?.id) return;
    const card = {
      tipo: "lead_card",
      tipo_acao: tipoLabelVal,
      campanha: camp?.titulo || null,
      data: dataCurta(sub.criadoEm),
      contato: prova.cliente || null,
      empresa_lead: prova.empresa || null,
      telefone: prova.telefone || null,
      endereco: prova.endereco || null,
      resultado: prova.resultado || null,
      texto_extra: texto.trim() !== textoInicial.trim() ? texto.trim() : null,
      subId: sub.id,
    };
    setEnviado(true);
    api("/messages", { companyId: emp.id, sellerId: seller.id, de: "empresa", texto: "📋 Lead compartilhado", anexo: JSON.stringify(card) });
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onFechar(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
      }}
    >
      <div style={{
        width: "min(480px, 100vw)", height: "100dvh", background: "var(--surface)",
        boxShadow: "-4px 0 32px rgba(0,0,0,.18)", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        {/* Cabeçalho */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <span className="vx-disp" style={{ fontSize: 16 }}>{t("leads.taskDetails")}</span>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px", flex: 1 }}>
          {/* Vendedor */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <MiniAvatar seller={seller} size={48} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{capitalizar(seller?.nome || t("misc.professional"))}</div>
              {seller?.titulo && <div style={{ fontSize: 12, color: "var(--muted)" }}>{seller.titulo}</div>}
              {seller?.cidade && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{seller.cidade}{seller.estado ? `, ${seller.estado}` : ""}</div>}
            </div>
          </div>

          {/* Resumo */}
          <div className="vx-card" style={{ padding: "14px 16px", marginBottom: 16 }}>
            {[
              [t("leads.actionType"), tipoLabel(sub.tipo) || sub.tipo || "—"],
              [t("leads.campaign"), camp?.titulo || t("leads.noCampaign")],
              [t("leads.value"), money(sub.valor)],
              [t("leads.date"), dataCurta(sub.criadoEm)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>{label}</span>
                <b style={{ textAlign: "right" }}>{val}</b>
              </div>
            ))}
          </div>

          {/* Status */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <BadgeStatus status={sub.status} />
            <BadgeCliente statusCliente={sub.statusCliente || "aguardando"} />
          </div>

          {/* Confiança IA */}
          {typeof sub.confianca === "number" && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                {t("leads.aiConfidence")}: <b>{sub.confianca}%</b>{sub.fonte === "ia" ? ` · ${t("leads.aiAnalysis")}` : ` · ${t("leads.localCheck")}`}
              </div>
              <Medidor value={sub.confianca} tone={st.tone === "red" ? "red" : st.tone === "amber" ? "amber" : st.tone === "indigo" ? "indigo" : "brand"} />
            </div>
          )}

          {/* Motivo */}
          {sub.motivo && (
            <div style={{
              fontSize: 12.5, color: MOTIVO_COR[sub.status] || "var(--muted)",
              background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16,
            }}>{sub.motivo}</div>
          )}

          {/* Campos da prova */}
          {(camposProva.length > 0 || extraProva.length > 0) && (
            <div className="vx-card" style={{ padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 10 }}>{t("leads.taskData")}</div>
              {camposProva.map((k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, gap: 10 }}>
                  <span style={{ color: "var(--muted)", flexShrink: 0 }}>{CAMPOS[k]?.label || k}</span>
                  <b style={{ textAlign: "right", wordBreak: "break-all" }}>{String(prova[k] || "—")}</b>
                </div>
              ))}
              {extraProva.map(([k, v]) => (
                typeof v !== "object" && (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, gap: 10 }}>
                    <span style={{ color: "var(--muted)", flexShrink: 0 }}>{CAMPOS[k]?.label || k}</span>
                    <b style={{ textAlign: "right", wordBreak: "break-all" }}>{String(v || "—")}</b>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Evidências / fotos */}
          {evidencias.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 10 }}>{t("leads.evidence")}</div>
              {evidencias.map((ev, i) => {
                const val = String(ev.valor || "");
                const isImg = val.startsWith("data:image");
                const isVid = val.startsWith("data:video");
                const isLink = /^https?:\/\//i.test(val);
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>#{i + 1} {ev.slot || "evidência"}</div>
                    {isImg ? (
                      <img src={val} alt="evidência" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, background: "var(--surface-2)" }} />
                    ) : isVid ? (
                      <video src={val} controls style={{ width: "100%", maxHeight: 180, borderRadius: 8 }} />
                    ) : isLink ? (
                      <a href={val} target="_blank" rel="noreferrer" style={{ color: "var(--brand)", fontSize: 13, wordBreak: "break-all" }}>{t("leads.openLink")} ↗</a>
                    ) : val ? (
                      <div style={{ fontSize: 13, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, wordBreak: "break-word" }}>{val}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Botão / área de mensagem */}
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            {!compondo && !enviado && (
              <button
                onClick={() => setCompondo(true)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border: "none", background: "var(--brand)",
                  color: "#fff", cursor: "pointer", transition: "opacity .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                <MessageSquare size={16} />
                {t("leads.askAboutLead")}
              </button>
            )}

            {compondo && !enviado && (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <MessageSquare size={12} />
                  {t("leads.messageTo")} <b style={{ color: "var(--ink)" }}>{capitalizar(seller?.nome || t("misc.professional"))}</b>
                </div>
                <textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 13, fontFamily: "inherit",
                    border: "1.5px solid var(--border)", borderRadius: 10,
                    background: "var(--surface-2)", color: "var(--ink)", resize: "vertical",
                    outline: "none", boxSizing: "border-box", lineHeight: 1.5,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--brand)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setCompondo(false); setTexto(textoInicial); }}
                    style={{
                      padding: "7px 14px", fontSize: 13, borderRadius: 8,
                      border: "1.5px solid var(--border)", background: "var(--surface-2)",
                      color: "var(--muted)", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{t("app.cancel")}</button>
                  <button
                    onClick={enviarMensagem}
                    disabled={!texto.trim()}
                    style={{
                      padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: "none", background: "var(--brand)", color: "#fff",
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 6,
                      opacity: !texto.trim() ? 0.5 : 1,
                    }}
                  >
                    <Send size={13} />
                    {t("app.send")}
                  </button>
                </div>
              </div>
            )}

            {enviado && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                padding: "16px", background: "var(--surface-2)", borderRadius: 10, textAlign: "center",
              }}>
                <CheckCircle2 size={28} color="#16a34a" />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t("leads.messageSent")}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {t("leads.willReceive", { name: capitalizar(seller?.nome || t("misc.professional")) })}
                </div>
                {setAba && (
                  <button
                    onClick={() => { onFechar(); setAba("conversas"); }}
                    style={{
                      padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: "1.5px solid var(--brand)", background: "transparent",
                      color: "var(--brand)", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{t("leads.viewConversation")}</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Barra de ação em massa ─────────────────────────────────────────────────
function BarraAcao({ qtd, onLimpar, onMudarStatus, onLiberarSaldo, salvando }) {
  const { t } = useI18n();
  const [statusSel, setStatusSel] = useState("");
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 10,
      background: "var(--brand)", color: "#fff",
      borderRadius: 10, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      marginBottom: 12,
    }}>
      <span style={{ fontWeight: 700, fontSize: 13, flex: "0 0 auto" }}>{t("leads.selected", { count: qtd })}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
        <select
          value={statusSel}
          onChange={(e) => setStatusSel(e.target.value)}
          style={{
            fontSize: 12, padding: "5px 10px", borderRadius: 20,
            border: "1.5px solid rgba(255,255,255,.4)",
            background: "rgba(255,255,255,.15)", color: "#fff",
            fontFamily: "inherit", cursor: "pointer", outline: "none",
            minWidth: 160,
          }}
        >
          <option value="">{t("leads.changeClientStatus")}</option>
          {Object.entries(STATUS_CLIENTE)
            .filter(([k]) => k !== "liberar_saldo")
            .map(([k, v]) => (
              <option key={k} value={k} style={{ color: "#000", background: "#fff" }}>{v.label}</option>
            ))}
        </select>
        {statusSel && (
          <button
            className="vx-btn vx-btn-sm"
            disabled={salvando}
            onClick={() => { onMudarStatus(statusSel); setStatusSel(""); }}
            style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "1.5px solid rgba(255,255,255,.4)" }}
          >
            {t("app.apply")}
          </button>
        )}
        <button
          className="vx-btn vx-btn-sm"
          disabled={salvando}
          onClick={onLiberarSaldo}
          style={{
            background: "#16a34a", color: "#fff", border: "none",
            fontWeight: 700, opacity: salvando ? 0.6 : 1,
          }}
        >
          {salvando ? t("app.wait") : t("leads.releaseFunds")}
        </button>
      </div>
      <button
        onClick={onLimpar}
        style={{ background: "none", border: "none", color: "rgba(255,255,255,.8)", cursor: "pointer", padding: 4 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
const TH = ({ children, right, check }) => (
  <th style={{
    padding: check ? "10px 8px 10px 14px" : "10px 12px",
    fontSize: 11.5, fontWeight: 600, color: "var(--muted)",
    textAlign: right ? "right" : "left",
    whiteSpace: "nowrap", borderBottom: "1.5px solid var(--border)",
    background: "var(--surface-2)", width: check ? 36 : undefined,
  }}>{children}</th>
);

const TD = ({ children, right, muted, check }) => (
  <td style={{
    padding: check ? "10px 8px 10px 14px" : "10px 12px",
    fontSize: 13, color: muted ? "var(--muted)" : "var(--ink)",
    textAlign: right ? "right" : "left",
    borderBottom: "1px solid var(--border)", verticalAlign: "middle",
    width: check ? 36 : undefined,
  }}>{children}</td>
);

export default function LeadsDashEmpresa({ emp, db, up, recarregar, filtroData, filtroBtn, setAba }) {
  const { t } = useI18n();
  const tipoLabel = (k) => TIPO_LABEL_KEYS[k] ? t(TIPO_LABEL_KEYS[k]) : k;
  const tempoRelativo = buildTempoRelativo(t);
  const [atualizadoEm, setAtualizadoEm] = useState(Date.now());
  const [refrescando, setRefrescando] = useState(false);
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [modalSub, setModalSub] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [salvando, setSalvando] = useState(false);

  const refrescar = useCallback(async () => {
    if (refrescando) return;
    setRefrescando(true);
    await recarregar?.();
    setAtualizadoEm(Date.now());
    setRefrescando(false);
  }, [recarregar, refrescando]);

  useEffect(() => {
    const id = setInterval(refrescar, 30000);
    return () => clearInterval(id);
  }, [refrescar]);

  const todasSubs = (db.submissions || []).filter((s) => s.companyId === emp.id);

  const vendedoresPresentes = [...new Map(
    todasSubs.map((s) => {
      const v = db.sellers?.find((x) => x.id === s.sellerId);
      return [s.sellerId, { id: s.sellerId, nome: capitalizar(v?.nome || "Profissional") }];
    })
  ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

  const tiposPresentes = [...new Set(todasSubs.map((s) => s.tipo).filter(Boolean))];

  const lista = (() => {
    let r = todasSubs.filter((s) => {
      if (filtroVendedor && s.sellerId !== filtroVendedor) return false;
      if (filtroTipo && s.tipo !== filtroTipo) return false;
      if (filtroStatus && s.statusCliente !== filtroStatus) return false;
      if (filtroData?.dataInicio && Number(s.criadoEm) < new Date(filtroData.dataInicio).getTime()) return false;
      if (filtroData?.dataFim && Number(s.criadoEm) > new Date(filtroData.dataFim + "T23:59:59").getTime()) return false;
      return true;
    });
    if (filtroData?.campo) {
      const { campo, direcao } = filtroData;
      r = [...r].sort((a, b) => {
        const va = a[campo] ?? ""; const vb = b[campo] ?? "";
        const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
        return direcao === "asc" ? cmp : -cmp;
      });
    } else {
      r = [...r].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    }
    return r;
  })();

  const temFiltro = filtroVendedor || filtroTipo || filtroStatus;
  const idsVisiveis = lista.map((s) => s.id);
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));
  const algumSelecionado = idsVisiveis.some((id) => selecionados.has(id));

  const toggleTodos = () => {
    if (todosSelecionados) {
      setSelecionados((prev) => { const n = new Set(prev); idsVisiveis.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelecionados((prev) => { const n = new Set(prev); idsVisiveis.forEach((id) => n.add(id)); return n; });
    }
  };

  const toggleItem = (id) => {
    setSelecionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selSubs = lista.filter((s) => selecionados.has(s.id));

  const aplicarEmMassa = async (statusCliente, liberarSaldo = false) => {
    setSalvando(true);
    const payload = liberarSaldo
      ? { statusCliente: "liberar_saldo", status: "conferido" }
      : { statusCliente };
    for (const s of selSubs) {
      await apiPatch(`/submissions/${s.id}`, payload);
    }
    setSalvando(false);
    setSelecionados(new Set());
    await recarregar?.();
    setAtualizadoEm(Date.now());
  };

  return (
    <div className="vx-fade">
      {/* Cabeçalho */}
      <div className="vx-row" style={{ marginBottom: 16, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 className="vx-disp" style={{ fontSize: 18, margin: 0, flex: 1 }}>{t("nav.leads")}</h2>
        {filtroBtn}
        <button className="vx-btn vx-btn-sm" onClick={refrescar} disabled={refrescando}
          style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} />
          {t("leads.refresh")}
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: refrescando ? "var(--amber)" : "var(--brand)",
            display: "inline-block",
          }} />
          {refrescando ? t("leads.refreshing") : `${t("leads.updated")} ${tempoRelativo(atualizadoEm)}`}
        </span>
      </div>

      {/* Filtros */}
      <div className="vx-row" style={{ marginBottom: 16, gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Filter size={14} color="var(--muted)" />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>{t("leads.filters")}</span>
        <select className="vx-input" value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}
          style={{ fontSize: 13, padding: "5px 10px", minWidth: 160 }}>
          <option value="">{t("leads.allSellers")}</option>
          {vendedoresPresentes.map((v) => (
            <option key={v.id} value={v.id}>{v.nome}</option>
          ))}
        </select>
        <select className="vx-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
          style={{ fontSize: 13, padding: "5px 10px", minWidth: 160 }}>
          <option value="">{t("leads.allTypes")}</option>
          {tiposPresentes.map((tp) => (
            <option key={tp} value={tp}>{tipoLabel(tp) || tp}</option>
          ))}
        </select>
        <select className="vx-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
          style={{ fontSize: 13, padding: "5px 10px", minWidth: 160 }}>
          <option value="">{t("leads.allStatuses")}</option>
          {Object.entries(STATUS_CLIENTE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {temFiltro && (
          <button className="vx-btn vx-btn-sm"
            onClick={() => { setFiltroVendedor(""); setFiltroTipo(""); setFiltroStatus(""); }}>
            {t("leads.clearFilters")}
          </button>
        )}
      </div>

      {/* Barra de ação em massa */}
      {selecionados.size > 0 && (
        <BarraAcao
          qtd={selecionados.size}
          salvando={salvando}
          onLimpar={() => setSelecionados(new Set())}
          onMudarStatus={(sc) => aplicarEmMassa(sc)}
          onLiberarSaldo={() => aplicarEmMassa("liberar_saldo", true)}
        />
      )}

      {!lista.length ? (
        <Vazio
          titulo={temFiltro ? t("leads.noResults") : t("leads.noActions")}
          texto={temFiltro ? t("leads.adjustFilters") : t("leads.actionsWillAppear")}
        />
      ) : (
        <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <TH check>
                    <button
                      onClick={toggleTodos}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}
                      title={todosSelecionados ? t("leads.deselectAll") : t("leads.selectAll")}
                    >
                      {todosSelecionados
                        ? <CheckSquare size={16} color="var(--brand)" />
                        : algumSelecionado
                          ? <Minus size={16} color="var(--brand)" />
                          : <Square size={16} />}
                    </button>
                  </TH>
                  <TH>{t("leads.th.leadContact")}</TH>
                  <TH>{t("leads.th.clientStatus")}</TH>
                  <TH>{t("leads.th.approval")}</TH>
                  <TH right>{t("leads.value")}</TH>
                  <TH>{t("leads.th.when")}</TH>
                  <TH>{t("leads.th.seller")}</TH>
                  <TH></TH>
                </tr>
              </thead>
              <tbody>
                {lista.map((sub) => {
                  const seller = db.sellers?.find((s) => s.id === sub.sellerId);
                  const camp = db.campaigns?.find((c) => c.id === sub.campaignId);
                  const sel = selecionados.has(sub.id);
                  return (
                    <tr
                      key={sub.id}
                      onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = ""; }}
                      style={{ background: sel ? "var(--brand)10" : "", transition: "background .1s" }}
                    >
                      <TD check>
                        <button
                          onClick={() => toggleItem(sub.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}
                        >
                          {sel ? <CheckSquare size={15} color="var(--brand)" /> : <Square size={15} />}
                        </button>
                      </TD>
                      <TD>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {capitalizar(sub.prova?.empresa || sub.prova?.cliente || camp?.titulo || "Lead")}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                          {tipoLabel(sub.tipo) || sub.tipo || "—"}
                          {camp?.titulo && <span> · {camp.titulo}</span>}
                        </div>
                      </TD>
                      <TD><BadgeCliente statusCliente={sub.statusCliente || "aguardando"} /></TD>
                      <TD><BadgeStatus status={sub.status} /></TD>
                      <TD right>
                        <span style={{ fontWeight: 600, color: "var(--brand)" }}>{money(sub.valor)}</span>
                      </TD>
                      <TD muted>
                        <span title={dataCurta(sub.criadoEm)}>{tempoRelativo(sub.criadoEm)}</span>
                      </TD>
                      <TD>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <MiniAvatar seller={seller} />
                          <span style={{ fontWeight: 500, fontSize: 12.5 }}>
                            {capitalizar(seller?.nome || t("misc.professional"))}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <button
                          onClick={() => setModalSub(sub)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--muted)", padding: 4, display: "flex",
                            borderRadius: 6, transition: "color .15s, background .15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--brand)"; e.currentTarget.style.background = "var(--surface-2)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = ""; }}
                          title={t("leads.viewDetails")}
                        >
                          <Eye size={16} />
                        </button>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
            {t("leads.recordCount", { count: lista.length })}
            {temFiltro ? ` (${t("leads.filtered")})` : ""}
            {selecionados.size > 0 && ` · ${t("leads.selected", { count: selecionados.size })}`}
          </div>
        </div>
      )}

      {/* Modal de detalhes */}
      {modalSub && (
        <ModalDetalhes
          sub={modalSub}
          seller={db.sellers?.find((s) => s.id === modalSub.sellerId)}
          camp={db.campaigns?.find((c) => c.id === modalSub.campaignId)}
          emp={emp}
          setAba={setAba}
          onFechar={() => setModalSub(null)}
        />
      )}
    </div>
  );
}
