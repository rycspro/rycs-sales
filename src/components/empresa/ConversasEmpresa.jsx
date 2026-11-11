import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Search, X, ChevronLeft,
  CheckCheck, Check, CheckCircle2,
  Paperclip, Image, FileText, Mic, MicOff, Download, Lock,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { uid, agora, money, dataCurta } from "../../lib/utils.js";
import { useI18n } from "../../lib/i18n.jsx";

const PERFIL_LABEL = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "Porta a porta", "sem-exp": "Em formação" };
const arr = (v) => Array.isArray(v) ? v : [];
const norm = (v) => String(v || "").toLocaleLowerCase("pt-BR");

function fitCultural(p, emp, campanhas, t) {
  const campanha = campanhas?.[0] || {};
  const pontos = [];
  const atencao = [];
  let score = 35;
  if (campanha.funcao && p.perfil === campanha.funcao) { score += 18; pontos.push(t("conv.fit.roleAligned")); } else if (campanha.funcao) atencao.push(t("conv.fit.roleDifferent"));
  if (campanha.regiao && norm(`${p.cidade} ${p.estado} ${arr(p.regioes).join(" ")}`).includes(norm(campanha.regiao))) { score += 10; pontos.push(t("conv.fit.regionMatch")); } else if (campanha.regiao) atencao.push(t("conv.fit.regionNotConfirmed"));
  if (campanha.segmento && arr(p.segmentos).some((s) => norm(campanha.segmento).includes(norm(s)) || norm(s).includes(norm(campanha.segmento)))) { score += 14; pontos.push(t("conv.fit.segmentExp")); } else if (campanha.segmento) atencao.push(t("conv.fit.segmentNoHistory"));
  if (arr(p.modalidades).some((m) => norm(`${emp?.produto || ""} ${emp?.icp || ""} ${campanha.objetivo || ""}`).includes(norm(m)))) { score += 8; pontos.push(t("conv.fit.prefsClose")); }
  if (p.disponibilidade) { score += 7; pontos.push(t("conv.fit.availDeclared")); } else atencao.push(t("conv.fit.availNotInformed"));
  if (Number(p.nota || 0) >= 80) { score += 8; pontos.push(t("conv.fit.highScore")); } else atencao.push(t("conv.fit.scoreNeedsFollow"));
  return { campanha, percentual: Math.min(100, score), pontos: pontos.length ? pontos : [t("conv.fit.noStrongMatch")], atencao: atencao.length ? atencao : [t("conv.fit.noCriticalIssue")] };
}

function resumoIA(p, t) {
  const partes = [];
  if (p.perfilComercial?.estilo) partes.push(`${t("conv.ai.behavioral")}: ${p.perfilComercial.estilo}.`);
  if (p.experiencia) partes.push(`${t("conv.ai.experience")}: ${p.experiencia}.`);
  const fortes = [...arr(p.skills), ...arr(p.segmentos)].slice(0, 5);
  if (fortes.length) partes.push(`${t("conv.ai.strengths")}: ${fortes.join(", ")}.`);
  if (p.perfil || arr(p.modalidades).length) partes.push(`${t("conv.ai.idealOp")}: ${[PERFIL_LABEL[p.perfil] || p.perfil, ...arr(p.modalidades).slice(0, 3)].filter(Boolean).join(", ")}.`);
  if (p.perfilComercial?.abordagem) partes.push(`${t("conv.ai.approach")}: ${p.perfilComercial.abordagem}.`);
  if (p.tarefasRealizadas || p.resultadosGerados) partes.push(`${t("conv.ai.historicalResults")}: ${p.tarefasAprovadas}/${p.tarefasRealizadas} ${t("conv.ai.tasksApproved")}, ${p.resultadosGerados} ${t("conv.ai.resultsGenerated")}.`);
  return partes.length ? partes.join(" ") : t("conv.ai.noData");
}

function PerfilModal({ seller, db, emp, empId, onFechar }) {
  const { t } = useI18n();
  const [bioExpandida, setBioExpandida] = useState(false);
  const p = seller;
  const subs = (db.submissions || []).filter((s) => s.companyId === empId && s.sellerId === p.id);
  const leads = (db.leads || []).filter((l) => l.companyId === empId && l.sellerId === p.id);
  const aprovadas = subs.filter((s) => s.status === "liberado").length;
  const recusadas = subs.filter((s) => s.status === "recusado").length;
  const reunioes = subs.filter((s) => s.status === "liberado" && s.tipo === "agendamento").length;
  const visitas = subs.filter((s) => s.status === "liberado" && s.tipo === "realizada").length;
  const vendas = subs.filter((s) => s.status === "liberado" && s.tipo === "venda").length;
  const ganhos = subs.filter((s) => s.status === "liberado").reduce((t, s) => t + Number(s.liquido || s.valor || 0), 0);
  const taxa = subs.length ? Math.round(aprovadas / subs.length * 100) : 0;
  const nomeCompleto = capitalizar([p.nome, p.sobrenome].filter(Boolean).join(" ") || p.nome || "");
  const campanhasEmpresa = (db.campaigns || []).filter((c) => c.companyId === empId);
  const fit = fitCultural(p, emp, campanhasEmpresa, t);

  const canais = [
    p.whats && { label: "WhatsApp", icon: "📱", href: `https://wa.me/${p.whats.replace(/\D/g, "")}` },
    p.email && { label: t("conv.channel.email"), icon: "✉️", href: `mailto:${p.email}` },
    arr(p.modalidades).some((m) => /video|confer/i.test(m)) && { label: t("conv.channel.video"), icon: "🎥", href: null },
    p.telefone && { label: t("conv.channel.phone"), icon: "📞", href: `tel:${p.telefone}` },
  ].filter(Boolean);

  return (
    <div className="vx-overlay" onClick={onFechar}>
      <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1020 }}>

        {/* cabeçalho */}
        <div className="vx-row" style={{ marginBottom: 16 }}>
          <div className="vx-eyebrow">{t("conv.profile.full")}</div>
          <button className="vx-btn vx-btn-ghost" onClick={onFechar}><X size={16} /></button>
        </div>

        {/* HERO: foto 3:4 + coluna direita */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 180, minWidth: 180, flexShrink: 0 }}>
            <div style={{ width: 180, height: 240, borderRadius: 16, overflow: "hidden", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {p.foto
                ? <img src={p.foto} alt={nomeCompleto} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
                : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 52, fontWeight: 700, color: "var(--brand)", fontFamily: "var(--font-disp)" }}>{iniciais(p.nome)}</div>
              }
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 className="vx-disp" style={{ margin: "0 0 12px", fontSize: 24 }}>{nomeCompleto}</h2>

            {/* bio */}
            <div style={{ marginBottom: 12 }}>
              {(p.bio || p.experiencia) ? (
                <>
                  <p className="vx-mut" style={{ fontSize: 13, lineHeight: 1.65, margin: 0, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden", textAlign: "justify", maxHeight: "calc(1.65em * 6)" }}>
                    {p.bio || p.experiencia}
                  </p>
                  {(p.bio || p.experiencia).length > 320 && (
                    <button type="button" onClick={() => setBioExpandida(true)}
                      style={{ background: "none", border: "none", padding: 0, marginTop: 4, fontSize: 12.5, color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}>
                      {t("conv.profile.readBio")}
                    </button>
                  )}
                </>
              ) : (
                <p className="vx-mut" style={{ fontSize: 13, margin: 0, fontStyle: "italic" }}>{t("conv.profile.bioUpdating")}</p>
              )}
            </div>

            {/* canais */}
            {canais.length > 0 && (
              <div>
                <div className="vx-eyebrow" style={{ marginBottom: 7 }}>{t("conv.profile.channels")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {canais.map(({ label, icon, href }) =>
                    href
                      ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="vx-chip" style={{ fontSize: 12, textDecoration: "none", color: "var(--ink)" }}>{icon} {label}</a>
                      : <span key={label} className="vx-chip" style={{ fontSize: 12 }}>{icon} {label}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DADOS DO PERFIL */}
        <div className="vx-card" style={{ padding: "14px 18px", marginTop: 20 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 12 }}>{t("conv.profile.data")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px 20px", fontSize: 13 }}>
            <div><div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>{t("conv.profile.role")}</div><b>{PERFIL_LABEL[p.perfil] || p.perfil || t("conv.profile.notInformed")}</b></div>
            <div><div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>{t("conv.profile.location")}</div><b>{[p.cidade, p.estado].filter(Boolean).join(" / ") || "—"}</b></div>
            {p.disponibilidade && <div><div className="vx-mut" style={{ fontSize: 11, marginBottom: 2 }}>{t("conv.profile.availability")}</div><b>{p.disponibilidade}</b></div>}
            {arr(p.segmentos).length > 0 && (
              <div style={{ gridColumn: "span 2" }}>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 5 }}>{t("conv.profile.segments")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{arr(p.segmentos).map((s) => <span key={s} className="vx-chip" style={{ fontSize: 11 }}>{s}</span>)}</div>
              </div>
            )}
            {arr(p.skills).length > 0 && (
              <div style={{ gridColumn: "span 2" }}>
                <div className="vx-mut" style={{ fontSize: 11, marginBottom: 5 }}>{t("conv.profile.skills")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{arr(p.skills).map((s) => <span key={s} className="vx-chip" style={{ fontSize: 11 }}>{s}</span>)}</div>
              </div>
            )}
          </div>
        </div>

        {/* INDICADORES — 5 cards igual ao de Profissionais */}
        <div style={{ marginTop: 16 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 12 }}>{t("conv.profile.performance")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { label: "Score", val: p.nota ?? 0 },
              { label: t("conv.profile.tasks"), val: `${aprovadas}/${subs.length}` },
              { label: t("conv.profile.approval"), val: `${taxa}%` },
              { label: t("conv.profile.sales"), val: vendas },
              { label: t("conv.profile.compatibility"), val: `${fit.percentual}%` },
            ].map(({ label, val }) => (
              <div key={label} className="vx-card" style={{ padding: "12px 8px", textAlign: "center" }}>
                <div className="vx-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--brand)" }}>{val}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* modal de bio completa */}
        {bioExpandida && (
          <div className="vx-overlay" onClick={() => setBioExpandida(false)} style={{ zIndex: 1100 }}>
            <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
              <div className="vx-row" style={{ marginBottom: 16 }}>
                <h3 className="vx-disp" style={{ margin: 0 }}>{t("conv.profile.biography")} — {nomeCompleto}</h3>
                <button className="vx-btn vx-btn-ghost" onClick={() => setBioExpandida(false)}><X size={16} /></button>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--ink)", margin: 0, whiteSpace: "pre-wrap", textAlign: "justify" }}>{p.bio || p.experiencia}</p>
            </div>
          </div>
        )}

        {/* MÉTRICAS COMPLETAS */}
        <div className="vx-grid vx-g4" style={{ marginTop: 20 }}>
          {[
            [t("conv.metrics.overallScore"), p.nota ?? 0],
            [t("conv.metrics.tasksApproved"), `${aprovadas}/${subs.length}`],
            [t("conv.metrics.approvalRate"), `${taxa}%`],
            [t("conv.metrics.totalEarnings"), money(ganhos)],
            [t("conv.metrics.meetings"), reunioes],
            [t("conv.metrics.visits"), visitas],
            [t("conv.metrics.sales"), vendas],
            ["Leads", leads.length],
          ].map(([label, val]) => (
            <div key={label} className="vx-scenario"><span>{label}</span><strong>{val}</strong></div>
          ))}
        </div>

        {/* RESUMO COM IA + CERTIFICAÇÕES */}
        <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>{t("conv.profile.aiSummary")}</h3>
            <p className="vx-mut" style={{ lineHeight: 1.6 }}>{resumoIA(p, t)}</p>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>{t("conv.profile.culturalFit")}</h3>
            <div className="vx-row"><b className="vx-mono" style={{ fontSize: 24 }}>{fit.percentual}%</b><span className="vx-chip">{fit.campanha?.titulo || t("conv.profile.refCampaign")}</span></div>
            <p className="vx-mut">{t("conv.profile.compatibilityLabel")}: {fit.pontos.join("; ")}.</p>
            <p className="vx-mut">{t("conv.profile.attentionPoints")}: {fit.atencao.join("; ")}.</p>
          </section>
          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>{t("conv.profile.certifications")}</h3>
            {p.certificacoes?.length
              ? p.certificacoes.map((c) => (
                  <span key={`${c.funcao}-${c.percentual}`} className="vx-chip" style={{ marginRight: 6, marginBottom: 6 }}>
                    <CheckCircle2 size={12} />{PERFIL_LABEL[c.funcao] || c.funcao} · {c.percentual}%
                  </span>
                ))
              : <p className="vx-mut">{t("conv.profile.noCertifications")}</p>
            }
            <p className="vx-mut" style={{ marginTop: 8 }}>{t("conv.profile.trainingsCompleted")}: {p.certificacoes?.length || 0}</p>
          </section>
        </div>

        {/* HISTÓRICO + TREINAMENTOS */}
        <div className="vx-grid vx-g2" style={{ marginTop: 14 }}>
          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>{t("conv.profile.history")}</h3>
            {p.campanhas?.length
              ? <div className="vx-compact-list">{p.campanhas.slice(0, 8).map((c) => (
                  <div key={c.id}><div><b>{c.titulo}</b><span>{PERFIL_LABEL[c.funcao] || c.funcao || t("conv.profile.notInformed")} · {c.regiao || t("conv.profile.noRegion")}</span></div><span className="vx-chip">{c.candidaturaStatus || c.status}</span></div>
                ))}</div>
              : <p className="vx-mut">{t("conv.profile.noHistory")}</p>
            }
            <p className="vx-mut">{t("conv.profile.rejectedTasks")}: {recusadas} · Leads: {leads.length}</p>
          </section>
          <section className="vx-card" style={{ padding: 14 }}>
            <h3 className="vx-disp" style={{ fontSize: 15 }}>{t("conv.profile.trainingFeedback")}</h3>
            {p.certificacoes?.length
              ? p.certificacoes.map((c) => (
                  <span key={`${c.funcao}-${c.percentual}`} className="vx-chip" style={{ marginRight: 6, marginBottom: 6 }}>
                    <CheckCircle2 size={12} />{PERFIL_LABEL[c.funcao] || c.funcao} · {c.percentual}%
                  </span>
                ))
              : <p className="vx-mut">{t("conv.profile.noCertifications")}</p>
            }
            <p className="vx-mut">{t("conv.profile.trainingsCompleted")}: {p.certificacoes?.length || 0}</p>
            <p className="vx-mut">{t("conv.profile.noFeedbacks")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── utilidades ────────────────────────────────────────────────────────────────

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
}

function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function horaOuData(ts, t, lang) {
  if (!ts) return "";
  const d = new Date(ts);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const loc = lang || "en";
  if (d.toDateString() === hoje.toDateString())
    return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === ontem.toDateString()) return t("conv.time.yesterday");
  return d.toLocaleDateString(loc, { day: "2-digit", month: "2-digit" });
}

function labelData(ts, t, lang) {
  const d = new Date(ts);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const loc = lang || "en";
  if (d.toDateString() === hoje.toDateString()) return t("conv.time.today");
  if (d.toDateString() === ontem.toDateString()) return t("conv.time.yesterday");
  return d.toLocaleDateString(loc, { day: "2-digit", month: "long", year: "numeric" });
}

function agruparPorData(msgs, t, lang) {
  const grupos = [];
  let diaAtual = null;
  for (const m of msgs) {
    const dia = new Date(m.ts).toDateString();
    if (dia !== diaAtual) { grupos.push({ tipo: "separador", label: labelData(m.ts, t, lang), ts: m.ts }); diaAtual = dia; }
    grupos.push({ tipo: "msg", ...m });
  }
  return grupos;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nome, foto, size = 40, fontSize = 15, className = "" }) {
  const [err, setErr] = useState(false);
  const cores = ["#2563EB", "#7C3AED", "#059669", "#DC2626", "#D97706"];
  const cor = cores[(nome?.charCodeAt(0) || 0) % cores.length];
  if (foto && !err)
    return <img src={foto} alt={nome} onError={() => setErr(true)} className={className}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div className={className} style={{
      width: size, height: size, borderRadius: "50%", background: cor,
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 700, flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {iniciais(nome)}
    </div>
  );
}

// ── Item da lista de conversas ─────────────────────────────────────────────────

function ItemConversa({ c, ativo, onClick, arquivada, onArquivar, onApagar }) {
  const { t, lang } = useI18n();
  const nome = capitalizar(c.seller?.nome || t("conv.professional"));
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuAberto) return;
    const handler = (e) => { if (!menuRef.current?.contains(e.target)) setMenuAberto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuAberto]);

  const previewTexto = (() => {
    if (!c.ultima) return t("conv.noMessages");
    const prefixo = c.ultima.de === "empresa" ? `${t("conv.you")}: ` : "";
    if (c.ultima.anexo) {
      try {
        const a = JSON.parse(c.ultima.anexo);
        if (a.tipo === "imagem") return prefixo + `📷 ${t("conv.attach.photo")}`;
        if (a.tipo === "audio") return prefixo + `🎤 ${t("conv.attach.audio")}`;
        if (a.tipo === "gif") return prefixo + "GIF";
        if (a.tipo === "documento") return prefixo + `📄 ${a.nome || t("conv.attach.document")}`;
        if (a.tipo === "lead_card") return prefixo + `📋 ${t("conv.attach.sharedLead")}`;
      } catch { /* */ }
    }
    return prefixo + (c.ultima.texto || "");
  })();

  return (
    <div
      style={{
        position: "relative",
        background: ativo ? "#EFF6FF" : "transparent",
        borderLeft: `3px solid ${ativo ? "#2563EB" : "transparent"}`,
        transition: "background .12s",
      }}
      onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = "#F8FAFC"; }}
      onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = ativo ? "#EFF6FF" : "transparent"; }}
    >
      <button
        onClick={onClick}
        aria-pressed={ativo}
        style={{
          display: "flex", alignItems: "center", gap: 13, width: "100%",
          padding: "15px 16px", paddingRight: 38, textAlign: "left", border: "none", cursor: "pointer",
          background: "transparent", outline: "none",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar nome={c.seller?.nome} foto={c.seller?.foto} size={52} fontSize={18} className="vx-conv-avatar" />
          {c.naoLidas > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2,
              width: 11, height: 11, borderRadius: "50%",
              background: "#2563EB", border: "2px solid #fff",
            }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{
              fontWeight: c.naoLidas > 0 ? 700 : 500,
              fontSize: 15, color: "#0B1220",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{nome}</span>
            <span style={{ fontSize: 11.5, color: "#94A3B8", flexShrink: 0 }}>{horaOuData(c.ultima?.ts, t, lang)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
            <span style={{
              fontSize: 13.5, color: c.naoLidas > 0 ? "#334155" : "#94A3B8",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontWeight: c.naoLidas > 0 ? 500 : 400,
            }}>{previewTexto}</span>
            {c.naoLidas > 0 && (
              <span style={{
                background: "#2563EB", color: "#fff", borderRadius: 20,
                fontSize: 10.5, padding: "1px 6px", fontWeight: 700, flexShrink: 0,
                minWidth: 18, textAlign: "center",
              }}>{c.naoLidas}</span>
            )}
          </div>
        </div>
      </button>

      {/* botão 3 pontos */}
      <div ref={menuRef} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuAberto((v) => !v); }}
          style={{
            width: 26, height: 26, borderRadius: 6, border: "none", background: menuAberto ? "#E2E8F0" : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#64748B", fontSize: 15, fontWeight: 700, letterSpacing: 1,
          }}
          title={t("conv.menu.options")}
        >⋯</button>
        {menuAberto && (
          <div style={{
            position: "absolute", right: 0, top: 30, zIndex: 200,
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,.12)", minWidth: 170, overflow: "hidden",
          }}>
            {[
              { label: arquivada ? t("conv.menu.unarchive") : t("conv.menu.archive"), action: () => { onArquivar(); setMenuAberto(false); } },
              { label: t("conv.menu.deleteConv"), action: () => { onApagar(); setMenuAberto(false); }, danger: true },
              { label: t("conv.menu.report"), action: () => { alert(t("conv.menu.reportConfirm")); setMenuAberto(false); }, danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={(e) => { e.stopPropagation(); item.action(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 14px", border: "none", background: "none",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  color: item.danger ? "#DC2626" : "#1E293B",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = item.danger ? "#FEF2F2" : "#F8FAFC"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >{item.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Área de mensagens ─────────────────────────────────────────────────────────

function AreaMensagens({ msgs, companyId, nomeEmpresa, seller }) {
  const { t, lang } = useI18n();
  const fimRef = useRef(null);
  const itens = agruparPorData([...msgs].sort((a, b) => a.ts - b.ts), t, lang);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  if (!msgs.length)
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "#94A3B8" }}>
        <MessageSquare size={32} strokeWidth={1.5} />
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{t("conv.noMessagesYet")}</p>
        <p style={{ margin: 0, fontSize: 12, color: "#CBD5E1" }}>{t("conv.sendFirst")}</p>
      </div>
    );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 2, scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}>
      {itens.map((item, i) => {
        if (item.tipo === "separador") return (
          <div key={`sep-${item.ts}`} style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px", userSelect: "none" }}>
            <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, whiteSpace: "nowrap" }}>{item.label}</span>
            <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
          </div>
        );
        const meu = item.de === "empresa";
        const lida = !!item.lida;
        return (
          <div key={item.id || i} style={{ display: "flex", justifyContent: meu ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 7, marginBottom: 4 }}>
            {/* avatar do profissional nas mensagens dele */}
            {!meu && (
              <div style={{ flexShrink: 0, marginBottom: 20 }}>
                <Avatar nome={seller?.nome} foto={seller?.foto} size={28} fontSize={10} />
              </div>
            )}
            <div style={{ maxWidth: "72%" }}>
              {/* nome do profissional acima da primeira mensagem de cada grupo */}
              {!meu && seller?.nome && (
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginBottom: 2, paddingLeft: 2 }}>
                  {capitalizar(seller.nome)}
                </div>
              )}
              <div style={{
                background: meu ? "#2563EB" : "#F1F5F9",
                color: meu ? "#fff" : "#1E293B",
                padding: item.anexo ? "6px" : "9px 13px",
                borderRadius: meu ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                fontSize: 13.5, lineHeight: 1.5, wordBreak: "break-word",
                boxShadow: meu ? "0 2px 8px rgba(37,99,235,.2)" : "0 1px 2px rgba(0,0,0,.04)",
                overflow: "hidden",
              }}>
                {(() => {
                  let anexo = null;
                  try { anexo = item.anexo ? JSON.parse(item.anexo) : null; } catch { /* */ }
                  if (anexo?.tipo === "imagem") return (
                    <img src={anexo.dados} alt={anexo.nome || "Foto"} style={{ maxWidth: 260, maxHeight: 300, borderRadius: 10, display: "block" }} />
                  );
                  if (anexo?.tipo === "audio") return (
                    <div style={{ padding: "4px 6px" }}>
                      <audio controls src={anexo.dados} style={{ maxWidth: 240, height: 36 }} />
                    </div>
                  );
                  if (anexo?.tipo === "gif") return (
                    <img src={anexo.url} alt={anexo.nome || "GIF"} style={{ maxWidth: 260, maxHeight: 240, borderRadius: 10, display: "block" }} />
                  );
                  if (anexo?.tipo === "lead_card") return (
                    <div style={{ padding: "10px 12px", minWidth: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.7, marginBottom: 6, textTransform: "uppercase" }}>📋 {t("conv.attach.sharedLead")}</div>
                      {anexo.tipo_acao && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{anexo.tipo_acao}</div>}
                      {anexo.campanha && <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 2 }}>📢 {anexo.campanha}</div>}
                      {anexo.data && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>🗓 {anexo.data}</div>}
                      {(anexo.contato || anexo.empresa_lead || anexo.telefone || anexo.endereco || anexo.resultado) && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,.25)", paddingTop: 6, marginTop: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                          {anexo.contato   && <div style={{ fontSize: 12 }}>👤 {anexo.contato}</div>}
                          {anexo.empresa_lead && <div style={{ fontSize: 12 }}>🏢 {anexo.empresa_lead}</div>}
                          {anexo.telefone  && <div style={{ fontSize: 12 }}>📞 {anexo.telefone}</div>}
                          {anexo.endereco  && <div style={{ fontSize: 12 }}>📍 {anexo.endereco}</div>}
                          {anexo.resultado && <div style={{ fontSize: 12 }}>✅ {anexo.resultado}</div>}
                        </div>
                      )}
                      {anexo.texto_extra && <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6, fontStyle: "italic" }}>{anexo.texto_extra}</div>}
                    </div>
                  );
                  if (anexo?.tipo === "documento") return (
                    <a href={anexo.dados} download={anexo.nome} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px", color: meu ? "#fff" : "#1E293B", textDecoration: "none" }}>
                      <FileText size={18} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{anexo.nome}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{t("conv.attach.tapDownload")}</div>
                      </div>
                      <Download size={14} style={{ marginLeft: 4, opacity: 0.7 }} />
                    </a>
                  );
                  return item.texto;
                })()}
              </div>
              <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3, display: "flex", alignItems: "center", gap: 3, justifyContent: meu ? "flex-end" : "flex-start", paddingLeft: meu ? 0 : 4, paddingRight: meu ? 4 : 0 }}>
                <span>{new Date(item.ts).toLocaleTimeString(lang || "en", { hour: "2-digit", minute: "2-digit" })}</span>
                {meu && (
                  lida
                    ? <CheckCheck size={13} color="#2563EB" strokeWidth={2.5} />
                    : <Check size={13} color="#94A3B8" strokeWidth={2.5} />
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={fimRef} style={{ height: 1 }} />
    </div>
  );
}

// ── Campo de envio ────────────────────────────────────────────────────────────

async function comprimirImagem(file) {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = url;
  });
}

function lerArquivoBase64(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

const GIPHY_KEY = "dc6zaTOxFJmzC";

const EMOJI_CATS = [
  { label: "😀", emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😋","😛","😜","🤪","😎","🤩","🥳","😏","😒","😔","😟","😕","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","😱","😨","😰","🤔","🤭","🤫","😶","😐","😑","😬","🙄","😯","😮","😲","🥱","😴","🤐","🥴","🤢","🤮","🤧","😷"] },
  { label: "👋", emojis: ["👋","✋","✌️","🤞","🤟","🤘","🤙","👌","🤌","🤏","👍","👎","✊","👊","🤛","🤜","👏","🙌","🙏","🤝","👐","🤲","💅","💪","🦾","👆","👇","👈","👉","☝️","✍️"] },
  { label: "🐶", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐧","🦅","🦉","🦋","🐝","🌵","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🌺","🌸","🌼","🌻","🌞","⭐","🌈","☁️","🌊","🔥","💧","❄️"] },
  { label: "🍎", emojis: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🌽","🌶","🧄","🥔","🍳","🧀","🍗","🍖","🌮","🌯","🥙","🍔","🍟","🍕","🌭","🍜","🍛","🍣","🍱","🧁","🎂","🍰","🍩","🍪","🍫","🍬","🍭","☕","🍵","🧋","🍺","🥂","🍾"] },
  { label: "⚽", emojis: ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🎯","🎳","🎲","🎮","🎭","🎨","🎬","🎤","🎧","🎵","🎶","🎸","🎹","🥁","🎺","🎻","🎷","🎙","🏆","🥇","🏅","🎉","🎊","🎈","🎁","🎀","🎗","🎪","🎠","🎡","🎢"] },
  { label: "🚗", emojis: ["🚗","🚕","🚌","🚎","🏎","🚓","🚑","🚒","🛻","🚚","🛵","🚲","✈️","🚀","🛸","🛶","⛵","🚢","⚓","🌍","🌎","🗺","🏔","🌋","🏕","🏖","🏠","🏡","🏢","🏥","🏦","🏨","🏪","🏫","🏯","🏰","⛩","🗼","🗽","⛪","🌃","🌄","🌅","🌆","🌇","🌉"] },
  { label: "❤️", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","❤️‍🔥","💯","✨","🌟","⭐","✅","❌","⭕","🔴","🟡","🟢","🔵","🟣","⚫","⚪","🔶","🔷","🔸","🔹","💠","💫","⚡","🌙","☀️","⛅","🌧","⛈","❄️","🌈","☔"] },
];

const btnAnexoStyle = {
  width: 36, height: 36, borderRadius: 9, border: "1.5px solid #E2E8F0",
  background: "#F8FAFC", color: "#64748B", display: "flex", alignItems: "center",
  justifyContent: "center", cursor: "pointer", transition: "all .15s",
};

function CampoEnvio({ onEnviar, onEnviarAnexo, enviando }) {
  const { t } = useI18n();
  const [txt, setTxt] = useState("");
  const [gravando, setGravando] = useState(false);
  const [tempoGrav, setTempoGrav] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [catEmoji, setCatEmoji] = useState(0);
  const [showGif, setShowGif] = useState(false);
  const [buscaGif, setBuscaGif] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loadingGif, setLoadingGif] = useState(false);

  const ref = useRef(null);
  const fotoRef = useRef(null);
  const docRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const rightRef = useRef(null);
  const gifDebRef = useRef(null);

  // Fechar painéis ao clicar fora
  useEffect(() => {
    if (!showEmoji && !showGif) return;
    const handler = (e) => {
      if (!rightRef.current?.contains(e.target)) {
        setShowEmoji(false);
        setShowGif(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji, showGif]);

  // Carregar/buscar GIFs
  useEffect(() => {
    if (!showGif) return;
    clearTimeout(gifDebRef.current);
    const q = buscaGif.trim();
    let ctrl;
    gifDebRef.current = setTimeout(() => {
      ctrl = new AbortController();
      setLoadingGif(true);
      const url = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=16&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=16&rating=g`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((d) => { setGifs(Array.isArray(d.data) ? d.data : []); setLoadingGif(false); })
        .catch(() => { setGifs([]); setLoadingGif(false); });
    }, q ? 400 : 0);
    return () => { clearTimeout(gifDebRef.current); ctrl?.abort(); };
  }, [buscaGif, showGif]);

  const submeter = () => {
    if (!txt.trim() || enviando) return;
    onEnviar(txt.trim());
    setTxt("");
    ref.current?.focus();
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submeter(); }
  };

  const enviarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const dados = await comprimirImagem(file);
    onEnviarAnexo({ tipo: "imagem", nome: file.name, mime: "image/jpeg", dados });
  };

  const enviarDoc = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) { alert(t("conv.docTooLarge")); return; }
    const dados = await lerArquivoBase64(file);
    onEnviarAnexo({ tipo: "documento", nome: file.name, mime: file.type, dados });
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg" });
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const r = new FileReader();
        r.onload = () => onEnviarAnexo({ tipo: "audio", nome: "audio.webm", mime, dados: r.result });
        r.readAsDataURL(blob);
      };
      mr.start(200);
      setGravando(true);
      setTempoGrav(0);
      timerRef.current = setInterval(() => setTempoGrav((t) => t + 1), 1000);
    } catch {
      alert(t("conv.micDenied"));
    }
  };

  const pararGravacao = () => {
    mrRef.current?.stop();
    clearInterval(timerRef.current);
    setGravando(false);
    setTempoGrav(0);
  };

  const cancelarGravacao = () => {
    chunksRef.current = [];
    mrRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (mrRef.current && mrRef.current.state !== "inactive") {
      mrRef.current.ondataavailable = null;
      mrRef.current.onstop = null;
      mrRef.current.stop();
    }
    clearInterval(timerRef.current);
    setGravando(false);
    setTempoGrav(0);
  };

  const fmtTempo = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const inserirEmoji = (emoji) => {
    const el = ref.current;
    if (!el) { setTxt((t) => t + emoji); return; }
    const start = el.selectionStart ?? txt.length;
    const end = el.selectionEnd ?? txt.length;
    const novo = txt.slice(0, start) + emoji + txt.slice(end);
    setTxt(novo);
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + [...emoji].length; el.focus(); }, 0);
  };

  const enviarGif = (gif) => {
    const url = gif.images?.downsized?.url || gif.images?.fixed_height?.url || gif.images?.original?.url;
    if (!url) return;
    onEnviarAnexo({ tipo: "gif", url, nome: gif.title || "GIF" });
    setShowGif(false);
    setBuscaGif("");
  };

  const podeSend = txt.trim() && !enviando;

  return (
    <div style={{ borderTop: "1px solid #F1F5F9", background: "#fff" }}>
      {/* Barra de gravação */}
      {gravando && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC2626", animation: "pulse 1s infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>{t("conv.recording")} {fmtTempo(tempoGrav)}</span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={cancelarGravacao} style={{ padding: "5px 12px", fontSize: 12, background: "none", border: "1px solid #FECACA", borderRadius: 8, color: "#B91C1C", cursor: "pointer" }}>{t("app.cancel")}</button>
            <button onClick={pararGravacao} style={{ padding: "5px 12px", fontSize: 12, background: "#DC2626", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}>{t("conv.sendAudio")}</button>
          </div>
        </div>
      )}

      <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-end" }}>
        {/* Botões de anexo — esquerda */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, paddingBottom: 1 }}>
          <input ref={fotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={enviarFoto} />
          <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" style={{ display: "none" }} onChange={enviarDoc} />

          <button onClick={() => fotoRef.current?.click()} title={t("conv.sendPhoto")} disabled={gravando || enviando}
            style={btnAnexoStyle}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.color = "#2563EB"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#64748B"; }}
          ><Image size={15} /></button>

          <button onClick={() => docRef.current?.click()} title={t("conv.sendDoc")} disabled={gravando || enviando}
            style={btnAnexoStyle}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.color = "#2563EB"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#64748B"; }}
          ><FileText size={15} /></button>

          <button onClick={gravando ? pararGravacao : iniciarGravacao} title={gravando ? t("conv.stopRecording") : t("conv.recordAudio")} disabled={enviando}
            style={{ ...btnAnexoStyle, border: `1.5px solid ${gravando ? "#DC2626" : "#E2E8F0"}`, background: gravando ? "#FEF2F2" : "#F8FAFC", color: gravando ? "#DC2626" : "#64748B" }}
          >{gravando ? <MicOff size={15} /> : <Mic size={15} />}</button>
        </div>

        {/* Input de texto */}
        <textarea
          ref={ref}
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={onKey}
          placeholder={t("conv.placeholder")}
          rows={1}
          disabled={gravando}
          style={{
            flex: 1, resize: "none", border: "1.5px solid #E2E8F0", borderRadius: 10,
            padding: "9px 13px", fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.5,
            outline: "none", color: "#1E293B", background: "#F8FAFC",
            transition: "border-color .15s", maxHeight: 120, overflowY: "auto",
            opacity: gravando ? 0.4 : 1,
          }}
          onFocus={(e) => { if (!gravando) { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; } }}
          onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
          onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          aria-label={t("conv.messageField")}
        />

        {/* Botões direita: emoji + GIF + enviar */}
        <div ref={rightRef} style={{ position: "relative", display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>

          {/* Painel emoji */}
          {showEmoji && (
            <div style={{
              position: "absolute", bottom: 46, right: 0, width: 316,
              background: "#fff", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.13)",
              border: "1px solid #E2E8F0", zIndex: 1000, overflow: "hidden",
            }}>
              <div style={{ display: "flex", gap: 1, padding: "8px 8px 0", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>
                {EMOJI_CATS.map((cat, i) => (
                  <button key={i} onClick={() => setCatEmoji(i)} style={{
                    flex: 1, fontSize: 16, padding: "5px 2px", border: "none", cursor: "pointer",
                    background: catEmoji === i ? "#EFF6FF" : "transparent",
                    borderRadius: 6, transition: "background .12s",
                  }}>{cat.label}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2, padding: "6px 8px", maxHeight: 220, overflowY: "auto" }}>
                {EMOJI_CATS[catEmoji].emojis.map((em) => (
                  <button key={em} onClick={() => inserirEmoji(em)} title={em} style={{
                    fontSize: 20, padding: 4, border: "none", background: "transparent",
                    cursor: "pointer", borderRadius: 6, transition: "background .1s", lineHeight: 1.2,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >{em}</button>
                ))}
              </div>
            </div>
          )}

          {/* Painel GIF */}
          {showGif && (
            <div style={{
              position: "absolute", bottom: 46, right: 0, width: 316,
              background: "#fff", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.13)",
              border: "1px solid #E2E8F0", zIndex: 1000, overflow: "hidden",
            }}>
              <div style={{ padding: "8px 8px 6px", borderBottom: "1px solid #F1F5F9" }}>
                <input
                  value={buscaGif}
                  onChange={(e) => setBuscaGif(e.target.value)}
                  placeholder={t("conv.searchGifs")}
                  autoFocus
                  style={{
                    width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8,
                    padding: "7px 10px", fontSize: 13, outline: "none", fontFamily: "inherit",
                    boxSizing: "border-box", background: "#F8FAFC",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#2563EB"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; }}
                />
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto", padding: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {loadingGif ? (
                  <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "center", padding: 24 }}>
                    <div className="vx-spinner" />
                  </div>
                ) : gifs.length === 0 ? (
                  <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 20, color: "#94A3B8", fontSize: 13 }}>{t("conv.noGifFound")}</div>
                ) : gifs.map((gif) => (
                  <button key={gif.id} onClick={() => enviarGif(gif)} style={{
                    padding: 0, border: "none", borderRadius: 8, overflow: "hidden",
                    cursor: "pointer", background: "#F1F5F9", aspectRatio: "16/9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <img
                      src={gif.images?.fixed_height_small?.url || gif.images?.downsized_small?.url}
                      alt={gif.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
              <div style={{ padding: "4px 8px 6px", textAlign: "right" }}>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>Powered by GIPHY</span>
              </div>
            </div>
          )}

          {/* Botão emoji */}
          <button
            onClick={() => { setShowEmoji((v) => !v); setShowGif(false); }}
            title="Emoji"
            disabled={gravando || enviando}
            style={{ ...btnAnexoStyle, borderColor: showEmoji ? "#2563EB" : "#E2E8F0" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563EB"; }}
            onMouseLeave={(e) => { if (!showEmoji) e.currentTarget.style.borderColor = "#E2E8F0"; }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>😊</span>
          </button>

          {/* Botão GIF */}
          <button
            onClick={() => { setShowGif((v) => !v); setShowEmoji(false); if (!showGif) setBuscaGif(""); }}
            title="GIF"
            disabled={gravando || enviando}
            style={{ ...btnAnexoStyle, fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", borderColor: showGif ? "#2563EB" : "#E2E8F0", color: showGif ? "#2563EB" : "#64748B" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.color = "#2563EB"; }}
            onMouseLeave={(e) => { if (!showGif) { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#64748B"; } }}
          >GIF</button>

          {/* Botão enviar — sempre azul */}
          <button
            onClick={submeter}
            disabled={!podeSend}
            aria-label={t("conv.sendMessage")}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "none",
              background: "#2563EB", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: podeSend ? "pointer" : "not-allowed",
              opacity: podeSend ? 1 : 0.4,
              transition: "opacity .15s", flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConversasEmpresa({ emp, db, up, bloqueado, irParaPlano }) {
  const { t, lang } = useI18n();
  const FILTROS = [
    { id: "todas", label: t("conv.filter.all") },
    { id: "arquivadas", label: t("conv.filter.archived") },
  ];
  const [popupPlano, setPopupPlano] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [selSellerId, setSelSellerId] = useState(null);
  const [lidosLocal, setLidosLocal] = useState({});
  const [arquivadas, setArquivadas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`arq_${emp.id}`) || "[]")); } catch { return new Set(); }
  });
  const [enviando, setEnviando] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  const debounceRef = useRef(null);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // debounce da busca
  const onBusca = (v) => {
    setBusca(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBuscaAtiva(v), 220);
  };

  // agrupa mensagens por vendedor
  const conversas = (() => {
    const por = {};
    for (const m of db.messages || []) {
      if (m.companyId !== emp.id) continue;
      if (!por[m.sellerId]) por[m.sellerId] = [];
      por[m.sellerId].push(m);
    }
    return Object.entries(por).map(([sellerId, msgs]) => {
      const seller = (db.sellers || []).find((s) => s.id === sellerId);
      const ordenadas = [...msgs].sort((a, b) => a.ts - b.ts);
      const ultima = ordenadas[ordenadas.length - 1];
      const naoLidas = msgs.filter((m) => m.de === "vendedor" && !m.lida && !lidosLocal[sellerId]).length;
      return { sellerId, seller, ultima, naoLidas, total: msgs.length };
    }).sort((a, b) => (b.ultima?.ts || 0) - (a.ultima?.ts || 0));
  })();

  const totalNaoLidas = conversas.reduce((s, c) => s + c.naoLidas, 0);

  const alternarArquivo = (sellerId) => {
    setArquivadas((prev) => {
      const next = new Set(prev);
      next.has(sellerId) ? next.delete(sellerId) : next.add(sellerId);
      try { localStorage.setItem(`arq_${emp.id}`, JSON.stringify([...next])); } catch { /* */ }
      return next;
    });
  };

  const apagarConversa = async (sellerId) => {
    if (!confirm(t("conv.deleteConfirm"))) return;
    await api(`/messages/apagar`, { companyId: emp.id, sellerId });
    up((d) => ({ messages: d.messages.filter((m) => !(m.companyId === emp.id && m.sellerId === sellerId)) }));
    if (selSellerId === sellerId) setSelSellerId(null);
  };

  const filtradas = conversas.filter((c) => {
    const eArq = arquivadas.has(c.sellerId);
    if (filtro === "arquivadas") return eArq;
    if (eArq) return false; // esconde arquivadas em "todas"
    if (!buscaAtiva) return true;
    const nome = (c.seller?.nome || "").toLowerCase();
    return nome.includes(buscaAtiva.toLowerCase());
  });

  const abrirConversa = useCallback((sellerId) => {
    setSelSellerId(sellerId);
    setLidosLocal((prev) => ({ ...prev, [sellerId]: true }));
    api("/messages/ler", { companyId: emp.id, sellerId });
    up((d) => ({
      messages: d.messages.map((m) =>
        m.companyId === emp.id && m.sellerId === sellerId && m.de === "vendedor" ? { ...m, lida: 1 } : m
      ),
    }));
  }, [emp.id, up]);

  const enviarMensagem = useCallback(async (texto, anexo) => {
    // Sem plano ativo: abre o popup para assinar, sem enviar nada.
    if (bloqueado) { setPopupPlano(true); return; }
    if (enviando || !selSellerId) return;
    setEnviando(true);
    const id = uid();
    const ts = agora();
    up((d) => ({ messages: [...d.messages, { id, companyId: emp.id, sellerId: selSellerId, de: "empresa", texto: texto || "", ts, lida: 0, anexo: anexo ? JSON.stringify(anexo) : "" }] }));
    try {
      await api("/messages", { companyId: emp.id, sellerId: selSellerId, de: "empresa", texto: texto || (anexo ? `[${anexo.tipo === "imagem" ? "📷 Foto" : anexo.tipo === "audio" ? "🎤 Áudio" : `📄 ${anexo.nome || "Documento"}`}]` : ""), anexo: anexo ? JSON.stringify(anexo) : undefined });
    } catch {
      up((d) => ({ messages: d.messages.filter((m) => m.id !== id) }));
    } finally {
      setEnviando(false);
    }
  }, [bloqueado, enviando, selSellerId, emp.id, up]);

  const enviarAnexo = useCallback((anexo) => {
    enviarMensagem("", anexo);
  }, [enviarMensagem]);

  const selConv = conversas.find((c) => c.sellerId === selSellerId);
  const msgsSel = selConv
    ? (db.messages || []).filter((m) => m.companyId === emp.id && m.sellerId === selSellerId)
    : [];

  const nomeSel = capitalizar(selConv?.seller?.nome || t("conv.professional"));

  // Mobile: se tem conversa aberta, mostra só o chat
  const mostraLista = !mobile || !selSellerId;
  const mostraChat = !mobile || !!selSellerId;

  return (
    <div style={{ display: "flex", height: mobile ? "calc(100dvh - 56px - env(safe-area-inset-bottom,0px))" : "calc(100vh - 56px)", overflow: "hidden", background: "#F8FAFC" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* ── PAINEL 2: LISTA DE CONVERSAS ─────────────────────────────────── */}
      {mostraLista && (
        <div style={{
          width: mobile ? "100%" : 340,
          minWidth: mobile ? undefined : 280,
          maxWidth: mobile ? undefined : 380,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: mobile ? "none" : "1px solid #E2E8F0",
          background: "#fff",
          height: "100%",
        }}>
          {/* cabeçalho da lista */}
          <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0B1220", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {t("nav.conversations")}
                </h2>
                {totalNaoLidas > 0 && (
                  <span style={{ background: "#2563EB", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 7px" }}>
                    {totalNaoLidas}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{conversas.length} {conversas.length === 1 ? t("conv.convSingular") : t("conv.convPlural")}</span>
            </div>

            {/* busca */}
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
              <input
                value={busca}
                onChange={(e) => onBusca(e.target.value)}
                placeholder={t("conv.searchPro")}
                aria-label={t("conv.searchConv")}
                style={{
                  width: "100%", paddingLeft: 30, paddingRight: busca ? 28 : 10,
                  padding: "8px 10px 8px 30px", border: "1.5px solid #E2E8F0",
                  borderRadius: 8, fontSize: 13, fontFamily: "inherit",
                  outline: "none", color: "#1E293B", background: "#F8FAFC",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
              />
              {busca && (
                <button onClick={() => onBusca("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94A3B8" }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* filtros */}
          <div style={{ display: "flex", borderBottom: "1px solid #F1F5F9", padding: "0 16px" }}>
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)} style={{
                padding: "8px 12px", border: "none", background: "none", cursor: "pointer",
                fontSize: 12.5, fontWeight: filtro === f.id ? 600 : 400,
                color: filtro === f.id ? "#2563EB" : "#64748B",
                borderBottom: `2px solid ${filtro === f.id ? "#2563EB" : "transparent"}`,
                marginBottom: -1, transition: "color .12s",
              }}>
                {f.label}
                {f.id === "arquivadas" && arquivadas.size > 0 && (
                  <span style={{ marginLeft: 5, background: "#F1F5F9", color: "#64748B", borderRadius: 20, fontSize: 10, padding: "0 5px", fontWeight: 700 }}>{arquivadas.size}</span>
                )}
              </button>
            ))}
          </div>

          {/* lista */}
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}>
            {!filtradas.length && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#94A3B8" }}>
                {buscaAtiva || filtro !== "todas" ? (
                  <>
                    <Search size={28} style={{ margin: "0 auto 10px", display: "block" }} strokeWidth={1.5} />
                    <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 500 }}>{t("app.noResults")}</p>
                    <button onClick={() => { onBusca(""); setFiltro("todas"); }} style={{ background: "none", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12.5, color: "#2563EB", fontWeight: 500 }}>
                      {t("conv.clearFilters")}
                    </button>
                  </>
                ) : (
                  <>
                    <MessageSquare size={32} style={{ margin: "0 auto 10px", display: "block" }} strokeWidth={1.5} />
                    <p style={{ margin: "0 0 6px", fontSize: 13.5, fontWeight: 500 }}>{t("conv.noConvYet")}</p>
                    <p style={{ margin: 0, fontSize: 12 }}>{t("conv.noConvHint")}</p>
                  </>
                )}
              </div>
            )}
            {filtradas.map((c) => (
              <ItemConversa
                key={c.sellerId}
                c={c}
                ativo={selSellerId === c.sellerId}
                onClick={() => abrirConversa(c.sellerId)}
                arquivada={arquivadas.has(c.sellerId)}
                onArquivar={() => alternarArquivo(c.sellerId)}
                onApagar={() => apagarConversa(c.sellerId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── PAINEL 3: CHAT ───────────────────────────────────────────────── */}
      {mostraChat && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff", height: "100%" }}>
          {!selConv ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#94A3B8" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare size={28} strokeWidth={1.5} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#334155" }}>{t("conv.selectConv")}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>{t("conv.selectConvHint")}</p>
              </div>
            </div>
          ) : (
            <>
              {/* cabeçalho do chat */}
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, background: "#fff", flexShrink: 0 }}>
                {mobile && (
                  <button onClick={() => setSelSellerId(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#64748B", display: "flex", marginLeft: -4 }}>
                    <ChevronLeft size={20} />
                  </button>
                )}
                <button
                  onClick={() => setPerfilAberto(true)}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: 0, flex: 1, minWidth: 0, textAlign: "left" }}
                >
                  <Avatar nome={selConv.seller?.nome} foto={selConv.seller?.foto} size={38} fontSize={13} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: "#0B1220", fontFamily: "'Space Grotesk', sans-serif", textDecoration: "underline", textDecorationColor: "#CBD5E1", textUnderlineOffset: 3 }}>{nomeSel}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>{msgsSel.length} {msgsSel.length === 1 ? t("conv.msgSingular") : t("conv.msgPlural")}</div>
                  </div>
                </button>
              </div>

              {perfilAberto && selConv?.seller && (
                <PerfilModal seller={selConv.seller} db={db} emp={emp} empId={emp.id} onFechar={() => setPerfilAberto(false)} />
              )}

              {/* mensagens */}
              <AreaMensagens msgs={msgsSel} companyId={emp.id} nomeEmpresa={emp.nome} seller={selConv?.seller} />

              {/* campo de envio */}
              <CampoEnvio onEnviar={enviarMensagem} onEnviarAnexo={enviarAnexo} enviando={enviando} />
            </>
          )}
        </div>
      )}

      {/* Popup: sem plano, não envia — convida a assinar */}
      {popupPlano && (
        <div
          onClick={() => setPopupPlano(false)}
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 24px 48px rgba(0,0,0,.2)", width: "100%", maxWidth: 400, padding: "28px 26px", textAlign: "center" }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Lock size={22} color="var(--brand)" strokeWidth={2} />
            </div>
            <h3 className="vx-disp" style={{ margin: "0 0 6px", fontSize: 18 }}>{t("conv.planPopup.title")}</h3>
            <p className="vx-mut" style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6 }}>
              {t("conv.planPopup.desc")}
            </p>
            <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => { setPopupPlano(false); irParaPlano?.(); }}>
              {t("conv.planPopup.seePlans")}
            </button>
            <button className="vx-btn vx-btn-block" style={{ marginTop: 8 }} onClick={() => setPopupPlano(false)}>
              {t("conv.planPopup.notNow")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
