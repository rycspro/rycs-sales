import { useState, useEffect } from "react";
import { Mail, Plus, Send, Eye, Users, Building2, UserCheck, X, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";

const STATUS_LABEL = {
  rascunho: { txt: "Rascunho", color: "var(--muted)" },
  enviado: { txt: "Enviado", color: "#22A06B" },
  falhou: { txt: "Falhou", color: "var(--red)" },
  parcial: { txt: "Parcial", color: "var(--amber)" },
};

export default function CentralEmails({ aviso }) {
  const [tela, setTela] = useState("lista"); // lista | novo
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
        onConcluir={(item) => {
          setHistorico((h) => [item, ...h]);
          setTela("lista");
        }}
        onVoltar={() => setTela("lista")}
      />
    );
  }

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Admin</div>
          <h1 className="vx-disp">Central de E-mails</h1>
          <p>Gerencie disparos de e-mail para usuários da plataforma.</p>
        </div>
        <button className="vx-btn vx-btn-primary" onClick={() => setTela("novo")}>
          <Plus size={15} /> Novo disparo
        </button>
      </div>

      {loading ? (
        <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Carregando...</div>
      ) : historico.length === 0 ? (
        <div className="vx-card" style={{ padding: 40, textAlign: "center" }}>
          <Mail size={40} style={{ color: "var(--muted-2)", marginBottom: 12 }} />
          <div className="vx-disp" style={{ fontSize: 17, marginBottom: 6 }}>Nenhum disparo ainda</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Clique em "Novo disparo" para enviar o primeiro e-mail.</div>
        </div>
      ) : (
        <div className="vx-card" style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 80px 100px 90px", gap: 10, padding: "10px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>
            <span>Assunto</span><span>Público</span><span>Qtd.</span><span>Data</span><span>Status</span>
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

function NovoDisparo({ aviso, onConcluir, onVoltar }) {
  const [passo, setPasso] = useState(1); // 1=público 2=conteúdo 3=revisar
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

  const PUBLICOS = [
    { key: "todos", label: "Todos os usuários", Icon: Users },
    { key: "empresas", label: "Somente empresas", Icon: Building2 },
    { key: "profissionais", label: "Somente profissionais", Icon: UserCheck },
    { key: "custom", label: "E-mails específicos", Icon: Mail },
  ];

  const carregarPreview = async () => {
    const r = await api("/admin/emails/preview", { publico, emailsCustom });
    if (r?.error) { aviso(r.error); return; }
    setPreviewInfo(r);
    setPasso(3);
  };

  const enviarTeste = async () => {
    if (!emailTeste) { aviso("Informe um e-mail de teste."); return; }
    setEnviandoTeste(true);
    const r = await api("/admin/emails/teste", { para: emailTeste, assunto, preheader, conteudo, cta });
    setEnviandoTeste(false);
    if (r?.error) aviso(r.error);
    else aviso("E-mail de teste enviado.");
  };

  const enviar = async () => {
    if (!confirmado) { aviso("Confirme o envio marcando a caixa de confirmação."); return; }
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

      {/* Steps */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, overflow: "auto" }}>
        {["Público", "Conteúdo", "Revisar & Enviar"].map((s, i) => (
          <span key={i} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: passo === i + 1 ? "var(--brand)" : passo > i + 1 ? "var(--brand-50)" : "var(--surface-2)", color: passo === i + 1 ? "#fff" : passo > i + 1 ? "var(--brand)" : "var(--muted)", border: "1px solid", borderColor: passo >= i + 1 ? "var(--brand)" : "var(--border)" }}>{i + 1}. {s}</span>
        ))}
      </div>

      {/* Passo 1: Público */}
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

      {/* Passo 2: Conteúdo */}
      {passo === 2 && (
        <div className="vx-card" style={{ padding: 22 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Conteúdo do e-mail</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="vx-label">Assunto *</label>
              <input className="vx-input" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto do e-mail" />
            </div>
            <div>
              <label className="vx-label">Preheader (texto de preview)</label>
              <input className="vx-input" value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto curto exibido antes de abrir o e-mail" />
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

      {/* Passo 3: Revisar & Enviar */}
      {passo === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Preview */}
          <div className="vx-card" style={{ padding: 22 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Preview</h3>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>ASSUNTO</div>
              <b style={{ fontSize: 15 }}>{assunto}</b>
              {preheader && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{preheader}</div>}
              <hr style={{ margin: "12px 0", border: 0, borderTop: "1px solid var(--border)" }} />
              <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{conteudo}</div>
              {cta && <div style={{ marginTop: 12 }}><a href={cta} style={{ color: "var(--brand)", fontWeight: 600, fontSize: 13 }}>{cta}</a></div>}
            </div>

            {/* Teste */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label className="vx-label">Enviar e-mail de teste para</label>
                <input className="vx-input" value={emailTeste} onChange={(e) => setEmailTeste(e.target.value)} placeholder="seu@email.com" />
              </div>
              <button className="vx-btn vx-btn-sm" onClick={enviarTeste} disabled={enviandoTeste} style={{ flexShrink: 0 }}>
                <Eye size={14} /> {enviandoTeste ? "Enviando..." : "Testar"}
              </button>
            </div>
          </div>

          {/* Confirmação */}
          <div className="vx-card" style={{ padding: 22, border: "1.5px solid var(--brand-200)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--brand)" }}>Confirmar disparo</h3>
            {previewInfo && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Público</div>
                  <div style={{ fontWeight: 600, marginTop: 3 }}>{previewInfo.publicoLabel}</div>
                </div>
                <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Destinatários</div>
                  <div style={{ fontWeight: 700, fontSize: 20, color: "var(--brand)", fontFamily: "'Space Grotesk'" }}>{previewInfo.quantidade}</div>
                </div>
              </div>
            )}
            <div style={{ background: "var(--amber-50)", border: "1px solid var(--amber-100)", borderRadius: 10, padding: 13, marginBottom: 14, fontSize: 13, color: "var(--ink-2)" }}>
              <AlertTriangle size={14} style={{ display: "inline", marginRight: 6, color: "var(--amber)" }} />
              Você está prestes a enviar este e-mail para <b>{previewInfo?.quantidade ?? "?"} destinatário(s)</b>. Esta ação não pode ser desfeita.
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
