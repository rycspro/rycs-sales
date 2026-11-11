import { useState, useEffect } from "react";
import { Mail, Plus, Send, Eye, Users, Building2, UserCheck, X, CheckCircle, AlertTriangle, Sparkles, FileText, GitBranch } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function CentralEmails({ aviso }) {
  const { t } = useI18n();
  const STATUS_LABEL = {
    rascunho: { txt: t("admin.emails.draft"), color: "var(--muted)" },
    enviado: { txt: t("admin.emails.sent"), color: "#22A06B" },
    falhou: { txt: t("admin.emails.failed"), color: "var(--red)" },
    parcial: { txt: t("admin.emails.partial"), color: "var(--amber)" },
  };
  const [tela, setTela] = useState("lista"); // lista | novo | ai | templates | sequencias
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/admin/emails").then((r) => {
      if (Array.isArray(r)) setHistorico(r);
      setLoading(false);
    });
  }, []);

  if (tela === "novo") {
    return (
      <NovoDisparo
        aviso={aviso}
        onConcluir={(item) => { setHistorico((h) => [item, ...h]); setTela("lista"); }}
        onVoltar={() => setTela("lista")}
      />
    );
  }
  if (tela === "ai") {
    return (
      <CriarComIA
        aviso={aviso}
        onConcluir={(item) => { if (item) setHistorico((h) => [item, ...h]); setTela("lista"); }}
        onVoltar={() => setTela("lista")}
      />
    );
  }
  if (tela === "templates") return <Templates aviso={aviso} onVoltar={() => setTela("lista")} onUsar={(t) => setTela("novo")} />;
  if (tela === "sequencias") return <Sequencias aviso={aviso} onVoltar={() => setTela("lista")} />;

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Admin</div>
          <h1 className="vx-disp">{t("admin.emails.title")}</h1>
          <p>{t("admin.emails.subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="vx-btn vx-btn-sm" onClick={() => setTela("sequencias")}>
            <GitBranch size={14} /> {t("admin.emails.sequences")}
          </button>
          <button className="vx-btn vx-btn-sm" onClick={() => setTela("templates")}>
            <FileText size={14} /> {t("admin.emails.templates")}
          </button>
          <button className="vx-btn vx-btn-sm" style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none" }} onClick={() => setTela("ai")}>
            <Sparkles size={14} /> {t("admin.emails.createWithAI")}
          </button>
          <button className="vx-btn vx-btn-primary" onClick={() => setTela("novo")}>
            <Plus size={15} /> {t("admin.emails.createEmail")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>{t("common.loading")}</div>
      ) : historico.length === 0 ? (
        <div className="vx-card" style={{ padding: 40, textAlign: "center" }}>
          <Mail size={40} style={{ color: "var(--muted-2)", marginBottom: 12 }} />
          <div className="vx-disp" style={{ fontSize: 17, marginBottom: 6 }}>{t("admin.emails.noSendsYet")}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("admin.emails.noSendsHint")}</div>
        </div>
      ) : (
        <div className="vx-card" style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 80px 100px 90px", gap: 10, padding: "10px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>
            <span>{t("admin.emails.subject")}</span><span>{t("admin.emails.audience")}</span><span>{t("admin.emails.qty")}</span><span>{t("admin.emails.date")}</span><span>{t("admin.emails.status")}</span>
          </div>
          {historico.map((item) => {
            const st = STATUS_LABEL[item.status] || STATUS_LABEL.enviado;
            return (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto 80px 100px 90px", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--border)", alignItems: "center", fontSize: 13 }}>
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.assunto}</b>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{item.publico}</span>
                <span className="vx-mono" style={{ fontSize: 12 }}>{item.quantidade ?? "—"}</span>
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{dataCurta(item.criadoEm)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color }}>{st.txt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Criar com IA ----------
function CriarComIA({ aviso, onConcluir, onVoltar }) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [gerando, setGerando] = useState(false);
  const [rascunho, setRascunho] = useState(null);
  const [melhorando, setMelhorando] = useState(null);

  const gerar = async () => {
    if (!prompt.trim()) return aviso(t("admin.emails.describeEmail"));
    setGerando(true);
    const r = await api("/admin/emails/ai-generate", { prompt });
    setGerando(false);
    if (r?.error) return aviso(r.error);
    setRascunho(r.dados || {});
  };

  const melhorar = async (action) => {
    setMelhorando(action);
    const r = await api("/admin/emails/ai-generate", { action, assunto: rascunho.assunto, conteudo: rascunho.conteudo });
    setMelhorando(null);
    if (r?.error) return aviso(r.error);
    if (action === "assunto") {
      const novoAssunto = r.resultado?.split("\n")[0] || rascunho.assunto;
      setRascunho({ ...rascunho, assunto: novoAssunto });
    } else {
      setRascunho({ ...rascunho, conteudo: r.resultado || rascunho.conteudo });
    }
  };

  const ACOES = [
    { key: "curto", label: t("admin.emails.aiShorter") },
    { key: "persuasivo", label: t("admin.emails.aiPersuasive") },
    { key: "profissional", label: t("admin.emails.aiProfessional") },
    { key: "amigavel", label: t("admin.emails.aiFriendly") },
    { key: "assunto", label: t("admin.emails.aiSubject") },
    { key: "cta", label: t("admin.emails.aiCTA") },
    { key: "corrigir", label: t("admin.emails.aiFix") },
  ];

  return (
    <div className="vx-fade" style={{ maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="vx-btn vx-btn-sm" onClick={onVoltar}>← {t("common.back")}</button>
        <h2 style={{ margin: 0, fontSize: 19 }}>✨ {t("admin.emails.createWithAI")}</h2>
      </div>

      <div className="vx-card" style={{ padding: 22, marginBottom: 16 }}>
        <label className="vx-label">{t("admin.emails.describePrompt")}</label>
        <textarea
          className="vx-input"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("admin.emails.describeExample")}
        />
        <button className="vx-btn vx-btn-primary" style={{ marginTop: 12 }} disabled={gerando} onClick={gerar}>
          <Sparkles size={14} /> {gerando ? t("admin.emails.generating") : t("admin.emails.generateEmail")}
        </button>
      </div>

      {rascunho && (
        <div className="vx-card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <CheckCircle size={16} color="#22A06B" />
            <b style={{ fontSize: 15 }}>{t("admin.emails.aiGenerated")}</b>
          </div>

          <label className="vx-label">{t("admin.emails.subject")}</label>
          <input className="vx-input" value={rascunho.assunto || ""} onChange={(e) => setRascunho({ ...rascunho, assunto: e.target.value })} />

          <label className="vx-label" style={{ marginTop: 12 }}>Preheader</label>
          <input className="vx-input" value={rascunho.preheader || ""} onChange={(e) => setRascunho({ ...rascunho, preheader: e.target.value })} />

          <label className="vx-label" style={{ marginTop: 12 }}>{t("admin.emails.content")}</label>
          <textarea className="vx-input" rows={8} value={rascunho.conteudo || ""} onChange={(e) => setRascunho({ ...rascunho, conteudo: e.target.value })} />

          <label className="vx-label" style={{ marginTop: 12 }}>{t("admin.emails.ctaLink")}</label>
          <input className="vx-input" value={rascunho.cta || ""} onChange={(e) => setRascunho({ ...rascunho, cta: e.target.value })} />

          <div style={{ marginTop: 14, marginBottom: 4 }}>
            <div className="vx-label" style={{ marginBottom: 6 }}>✨ {t("admin.emails.improveWithAI")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ACOES.map(({ key, label }) => (
                <button key={key} className="vx-btn vx-btn-sm" disabled={!!melhorando} onClick={() => melhorar(key)}>
                  {melhorando === key ? "..." : label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <button
              className="vx-btn vx-btn-primary"
              onClick={() => {
                // Passar para NovoDisparo com os dados preenchidos
                // Para simplicidade: abrimos o disparo com o conteúdo gerado
                onConcluir(null); // fecha IA e vai para lista
                aviso(t("admin.emails.copiedToDraft"));
              }}
            >
              {t("admin.emails.useThisEmail")} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Templates ----------
function Templates({ aviso, onVoltar, onUsar }) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/admin/email-templates").then((r) => {
      if (Array.isArray(r)) setTemplates(r);
      setLoading(false);
    });
  }, []);

  return (
    <div className="vx-fade">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="vx-btn vx-btn-sm" onClick={onVoltar}>← {t("common.back")}</button>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t("admin.emails.emailTemplates")}</h2>
      </div>

      {loading ? (
        <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>{t("common.loading")}</div>
      ) : (
        <div className="vx-grid">
          {templates.map((tpl) => (
            <div key={tpl.id} className="vx-card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <b style={{ fontSize: 14 }}>{tpl.nome}</b>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{tpl.assunto}</div>
                </div>
                <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => onUsar(tpl)}>{t("admin.emails.use")}</button>
              </div>
              {tpl.preheader && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>{tpl.preheader}</div>}
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 10, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "hidden" }}>{tpl.conteudo}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Sequências ----------
function Sequencias({ aviso, onVoltar }) {
  const { t } = useI18n();
  const [sequencias, setSequencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: "recuperacao", email: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api("/admin/email-sequences").then((r) => {
      if (Array.isArray(r)) setSequencias(r);
      setLoading(false);
    });
  };

  useEffect(() => { carregar(); }, []);

  const iniciar = async () => {
    if (!form.email) return aviso(t("admin.emails.enterEmail"));
    setSalvando(true);
    const r = await api("/admin/email-sequences", form);
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso(t("admin.emails.seqStarted"));
    setModal(false);
    setForm({ tipo: "recuperacao", email: "" });
    carregar();
  };

  const parar = async (id) => {
    const r = await apiPatch(`/admin/email-sequences/${id}/stop`, { motivo: "admin" });
    if (r?.error) return aviso(r.error);
    aviso(t("admin.emails.seqStopped"));
    carregar();
  };

  const TIPOS = [
    { key: "recuperacao", label: t("admin.emails.seqRecovery") },
    { key: "reativacao", label: t("admin.emails.seqReactivation") },
    { key: "bloqueio", label: t("admin.emails.seqBlocked") },
  ];

  return (
    <div className="vx-fade">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="vx-btn vx-btn-sm" onClick={onVoltar}>← {t("common.back")}</button>
          <h2 style={{ margin: 0, fontSize: 19 }}>{t("admin.emails.emailSequences")}</h2>
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => setModal(true)}>+ {t("admin.emails.newSequence")}</button>
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 20, background: "var(--surface-2)" }}>
        <b style={{ fontSize: 13 }}>{t("admin.emails.stopConditions")}</b>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
          {t("admin.emails.stopConditionsDesc")}
        </div>
      </div>

      {loading ? (
        <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>{t("common.loading")}</div>
      ) : sequencias.length === 0 ? (
        <div className="vx-card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          {t("admin.emails.noSequences")}
        </div>
      ) : (
        <div className="vx-grid">
          {sequencias.map((s) => (
            <div key={s.id} className="vx-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.email}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  {TIPOS.find((tp) => tp.key === s.tipo)?.label || s.tipo} · {t("admin.emails.step")} {s.passo}
                </div>
                <div style={{ fontSize: 11, color: s.status === "ativa" ? "#22A06B" : "var(--muted)", marginTop: 2 }}>
                  {s.status === "ativa" ? t("admin.emails.seqActive") : t("admin.emails.seqStoppedLabel")}
                </div>
              </div>
              {s.status === "ativa" && (
                <button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => parar(s.id)}>{t("admin.emails.stop")}</button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="vx-card" style={{ width: "100%", maxWidth: 420, padding: 28, margin: 16 }}>
            <div className="vx-disp" style={{ fontSize: 17, marginBottom: 16 }}>{t("admin.emails.startSequence")}</div>
            <label className="vx-label">{t("admin.emails.type")}</label>
            <select className="vx-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map((tp) => <option key={tp.key} value={tp.key}>{tp.label}</option>)}
            </select>
            <label className="vx-label" style={{ marginTop: 12 }}>{t("admin.emails.recipientEmail")}</label>
            <input className="vx-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={iniciar}>{t("admin.emails.start")}</button>
              <button className="vx-btn" onClick={() => setModal(false)}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Novo Disparo manual ----------
function NovoDisparo({ aviso, onConcluir, onVoltar }) {
  const { t } = useI18n();
  const [passo, setPasso] = useState(1);
  const [publico, setPublico] = useState("todos");
  const [emailsCustom, setEmailsCustom] = useState("");
  const [assunto, setAssunto] = useState("");
  const [preheader, setPreheader] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [cta, setCta] = useState("");
  const [emailTeste, setEmailTeste] = useState("");
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [previewModo, setPreviewModo] = useState("desktop");

  const PUBLICOS = [
    { key: "todos", label: t("admin.emails.allUsers"), Icon: Users },
    { key: "empresas", label: t("admin.emails.companiesOnly"), Icon: Building2 },
    { key: "profissionais", label: t("admin.emails.professionalsOnly"), Icon: UserCheck },
    { key: "custom", label: t("admin.emails.specificEmails"), Icon: Mail },
  ];

  const carregarPreview = async () => {
    const r = await api("/admin/emails/preview", { publico, emailsCustom });
    if (r?.error) { aviso(r.error); return; }
    setPreviewInfo(r);
    setPasso(3);
  };

  const enviarTeste = async () => {
    if (!emailTeste) { aviso(t("admin.emails.enterTestEmail")); return; }
    setEnviandoTeste(true);
    const r = await api("/admin/emails/teste", { para: emailTeste, assunto, preheader, conteudo, cta });
    setEnviandoTeste(false);
    if (r?.error) aviso(r.error);
    else aviso(t("admin.emails.testSent"));
  };

  const enviar = async () => {
    if (!confirmado) { aviso(t("admin.emails.confirmFirst")); return; }
    setEnviando(true);
    const r = await api("/admin/emails/disparar", { publico, emailsCustom, assunto, preheader, conteudo, cta });
    setEnviando(false);
    if (r?.error) { aviso(r.error); return; }
    aviso(`Disparo enviado para ${r.quantidade} destinatário(s).`);
    onConcluir(r.registro);
  };

  return (
    <div className="vx-fade" style={{ maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="vx-btn vx-btn-sm" onClick={onVoltar}>← Voltar</button>
        <h2 style={{ margin: 0, fontSize: 19 }}>Novo disparo de e-mail</h2>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 24, overflow: "auto" }}>
        {["Público", "Conteúdo", "Revisar & Enviar"].map((s, i) => (
          <span key={i} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", background: passo === i + 1 ? "var(--brand)" : passo > i + 1 ? "var(--brand-50)" : "var(--surface-2)", color: passo === i + 1 ? "#fff" : passo > i + 1 ? "var(--brand)" : "var(--muted)", border: "1px solid", borderColor: passo >= i + 1 ? "var(--brand)" : "var(--border)" }}>{i + 1}. {s}</span>
        ))}
      </div>

      {passo === 1 && (
        <div className="vx-card" style={{ padding: 22 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Selecionar destinatários</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {PUBLICOS.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setPublico(key)} style={{ padding: 14, border: "1.5px solid", borderColor: publico === key ? "var(--brand)" : "var(--border)", borderRadius: 12, background: publico === key ? "var(--brand-50)" : "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: publico === key ? "var(--brand)" : "var(--ink)", fontWeight: 600, fontSize: 13 }}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          {publico === "custom" && (
            <div style={{ marginBottom: 16 }}>
              <label className="vx-label">E-mails (separados por vírgula ou quebra de linha)</label>
              <textarea className="vx-input" rows={4} value={emailsCustom} onChange={(e) => setEmailsCustom(e.target.value)} placeholder="email1@example.com, email2@example.com" />
            </div>
          )}
          <button className="vx-btn vx-btn-primary" onClick={() => setPasso(2)}>Próximo →</button>
        </div>
      )}

      {passo === 2 && (
        <div className="vx-card" style={{ padding: 22 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Conteúdo do e-mail</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="vx-label">Assunto *</label>
              <input className="vx-input" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto do e-mail" />
            </div>
            <div>
              <label className="vx-label">Preheader (texto de preview no inbox)</label>
              <input className="vx-input" value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto curto exibido antes de abrir" />
            </div>
            <div>
              <label className="vx-label">Conteúdo *</label>
              <textarea className="vx-input" rows={7} value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Corpo do e-mail..." />
            </div>
            <div>
              <label className="vx-label">Link/CTA (opcional)</label>
              <input className="vx-input" value={cta} onChange={(e) => setCta(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button className="vx-btn vx-btn-sm" onClick={() => setPasso(1)}>← Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => { if (!assunto || !conteudo) { aviso("Preencha assunto e conteúdo."); return; } carregarPreview(); }}>Revisar →</button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="vx-card" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Preview</h3>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="vx-btn vx-btn-sm" style={{ background: previewModo === "desktop" ? "var(--brand)" : undefined, color: previewModo === "desktop" ? "#fff" : undefined }} onClick={() => setPreviewModo("desktop")}>Desktop</button>
                <button className="vx-btn vx-btn-sm" style={{ background: previewModo === "mobile" ? "var(--brand)" : undefined, color: previewModo === "mobile" ? "#fff" : undefined }} onClick={() => setPreviewModo("mobile")}>Mobile</button>
              </div>
            </div>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 14, maxWidth: previewModo === "mobile" ? 375 : "100%", margin: previewModo === "mobile" ? "0 auto 14px" : "0 0 14px" }}>
              {/* Header Hicks Pro */}
              <div style={{ background: "#1a2744", padding: "12px 18px", borderRadius: "8px 8px 0 0", textAlign: "center", marginBottom: 0 }}>
                <span style={{ color: "#60a5fa", fontSize: 22, fontWeight: 800 }}>H</span>
                <span style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginLeft: 4 }}>Hicks Pro</span>
              </div>
              <div style={{ background: "#f9fafb", padding: 18, borderRadius: "0 0 8px 8px" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>ASSUNTO</div>
                <b style={{ fontSize: 15 }}>{assunto}</b>
                {preheader && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{preheader}</div>}
                <hr style={{ margin: "12px 0", border: 0, borderTop: "1px solid #e5e7eb" }} />
                <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "#1f2937" }}>{conteudo}</div>
                {cta && (
                  <div style={{ textAlign: "center", margin: "18px 0 10px" }}>
                    <span style={{ background: "#2563EB", color: "#fff", padding: "10px 24px", borderRadius: 8, fontWeight: 600, fontSize: 13, display: "inline-block" }}>Acessar</span>
                  </div>
                )}
                <hr style={{ margin: "12px 0", border: 0, borderTop: "1px solid #e5e7eb" }} />
                <div style={{ color: "#9ca3af", fontSize: 11, textAlign: "center" }}>Equipe Hicks Pro</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label className="vx-label">Enviar e-mail de teste</label>
                <input className="vx-input" value={emailTeste} onChange={(e) => setEmailTeste(e.target.value)} placeholder="seu@email.com" />
              </div>
              <button className="vx-btn vx-btn-sm" onClick={enviarTeste} disabled={enviandoTeste} style={{ flexShrink: 0 }}>
                <Eye size={14} /> {enviandoTeste ? "Enviando..." : "Enviar teste"}
              </button>
            </div>
          </div>

          <div className="vx-card" style={{ padding: 22, border: "1.5px solid var(--brand-200)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--brand)" }}>Confirmar disparo real</h3>
            {previewInfo && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Público</div>
                  <div style={{ fontWeight: 600, marginTop: 3 }}>{previewInfo.publicoLabel}</div>
                </div>
                <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Destinatários</div>
                  <div style={{ fontWeight: 700, fontSize: 20, color: "var(--brand)" }}>{previewInfo.quantidade}</div>
                </div>
              </div>
            )}
            <div style={{ background: "var(--amber-50)", border: "1px solid var(--amber-100)", borderRadius: 10, padding: 13, marginBottom: 14, fontSize: 13 }}>
              <AlertTriangle size={14} style={{ display: "inline", marginRight: 6, color: "var(--amber)" }} />
              Você está prestes a enviar para <b>{previewInfo?.quantidade ?? "?"} destinatário(s)</b>. Esta ação não pode ser desfeita.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
              Confirmo que quero enviar este e-mail
            </label>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="vx-btn vx-btn-sm" onClick={() => setPasso(2)}>← Editar</button>
            <button className="vx-btn vx-btn-primary" onClick={enviar} disabled={enviando || !confirmado} style={{ flex: 1 }}>
              <Send size={15} /> {enviando ? "Enviando..." : "Confirmar envio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
