import { useState } from "react";
import { Campo } from "./ui.jsx";
import { api } from "../lib/api.js";

export default function Login({ onLogin, onRegister }) {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState("vendedor");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const [indicacao, setIndicacao] = useState("");

  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) { setResetToken(t); setShowReset(true); }
    // Link de convite: /?ref=CODIGO já abre no cadastro com o código preenchido.
    const ref = params.get("ref");
    if (ref) { setIndicacao(ref.toUpperCase()); setModo("registro"); }
  });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (modo === "login") {
      await onLogin(email, senha);
    } else {
      if (!aceitouTermos) { setLoading(false); return; }
      await onRegister({ email, senha, role, nome, aceitouTermos: true, indicacao: indicacao || undefined });
    }
    setLoading(false);
  };

  const enviarForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    const r = await api("/auth/forgot-password", { email: forgotEmail });
    setForgotMsg(r?.message || "Link enviado, se o e-mail existir.");
    setLoading(false);
  };

  const enviarReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    const r = await api("/auth/reset-password", { token: resetToken, senha: novaSenha });
    setResetMsg(r?.message || r?.error || "Erro");
    if (r?.ok) { setTimeout(() => { setShowReset(false); window.history.replaceState({}, "", "/"); }, 2000); }
    setLoading(false);
  };

  if (showReset) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ width: 180, margin: "0 auto 12px" }} />
          <div className="vx-disp" style={{ fontSize: 22 }}>Redefinir senha</div>
        </div>
        <div className="vx-card" style={{ padding: 22 }}>
          <form onSubmit={enviarReset}>
            <Campo label="Nova senha"><input className="vx-input" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} minLength={6} required /></Campo>
            <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading}>Redefinir</button>
          </form>
          {resetMsg && <div className="vx-mut" style={{ marginTop: 12, textAlign: "center" }}>{resetMsg}</div>}
        </div>
      </div>
    </div>
  );

  if (showForgot) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ width: 180, margin: "0 auto 12px" }} />
          <div className="vx-disp" style={{ fontSize: 22 }}>Esqueci minha senha</div>
          <p className="vx-mut" style={{ fontSize: 13, marginTop: 6 }}>Informe seu e-mail para receber o link de redefinição.</p>
        </div>
        <div className="vx-card" style={{ padding: 22 }}>
          <form onSubmit={enviarForgot}>
            <Campo label="E-mail"><input className="vx-input" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required /></Campo>
            <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading}>Enviar link</button>
          </form>
          {forgotMsg && <div className="vx-mut" style={{ marginTop: 12, textAlign: "center" }}>{forgotMsg}</div>}
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowForgot(false)} style={{ marginTop: 8, width: "100%" }}>Voltar ao login</button>
        </div>
      </div>
    </div>
  );

  if (showTermos) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 640 }}>
        <div className="vx-card" style={{ padding: 24, maxHeight: "80vh", overflowY: "auto" }}>
          <div className="vx-disp" style={{ fontSize: 20, marginBottom: 16 }}>Termos de Uso — RYCS Sales Solutions</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)" }}>
            <p><b>1. Objeto.</b> A RYCS Sales Solutions é uma plataforma digital que conecta empresas contratantes a profissionais de vendas independentes, intermediando atividades comerciais verificadas por inteligência artificial.</p>
            <p><b>2. Cadastro.</b> O usuário declara que as informações fornecidas são verdadeiras. A RYCS reserva-se o direito de recusar ou suspender cadastros com informações falsas.</p>
            <p><b>3. Papel da RYCS.</b> A RYCS atua como intermediadora. Não há vínculo empregatício entre a RYCS e os profissionais, nem entre as empresas e os profissionais. A remuneração é por ação verificada.</p>
            <p><b>4. Comissões e pagamentos.</b> As comissões são definidas por cada empresa em suas campanhas. A RYCS cobra uma taxa de serviço (take rate) sobre o volume transacionado. Os pagamentos aos profissionais são processados via Pix após liberação pela plataforma.</p>
            <p><b>5. Auditoria.</b> Todas as ações são verificadas por inteligência artificial e/ou revisão humana. Ações fraudulentas resultam em suspensão imediata e retenção de valores.</p>
            <p><b>6. Saldo e saques.</b> Empresas adicionam saldo à plataforma para remunerar ações. Profissionais podem sacar valores liberados a qualquer momento, sujeito ao valor mínimo de R$ 10,00.</p>
            <p><b>7. Privacidade e LGPD.</b> Os dados pessoais são tratados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Os dados são usados exclusivamente para operação da plataforma e podem ser excluídos mediante solicitação do titular.</p>
            <p><b>8. Propriedade intelectual.</b> Todo o conteúdo da plataforma, incluindo treinamentos e materiais, pertence à RYCS ou às empresas contratantes.</p>
            <p><b>9. Rescisão.</b> O usuário pode encerrar sua conta a qualquer momento. Valores pendentes serão liquidados conforme os prazos operacionais.</p>
            <p><b>10. Foro.</b> Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.</p>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div className="vx-disp" style={{ fontSize: 18, marginBottom: 12 }}>Política de Privacidade</div>
              <p><b>Dados coletados:</b> nome, e-mail, telefone, cidade, chave Pix, vídeos e áudios de comprovação.</p>
              <p><b>Finalidade:</b> operação da plataforma, verificação de ações, processamento de pagamentos e comunicação com o usuário.</p>
              <p><b>Compartilhamento:</b> dados são compartilhados apenas entre as partes envolvidas na operação (empresa ↔ RYCS ↔ profissional) e com processadores de pagamento.</p>
              <p><b>Retenção:</b> dados são mantidos enquanto a conta estiver ativa e por 5 anos após o encerramento, conforme obrigações legais.</p>
              <p><b>Direitos do titular:</b> acesso, correção, exclusão, portabilidade e revogação do consentimento podem ser solicitados via e-mail: contato@rycs.com.br.</p>
              <p><b>Segurança:</b> utilizamos criptografia, tokens seguros e cookies HttpOnly para proteger seus dados.</p>
            </div>
          </div>
          <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 20 }} onClick={() => { setAceitouTermos(true); setShowTermos(false); }}>
            Li e aceito os termos
          </button>
          <button className="vx-btn vx-btn-ghost vx-btn-block vx-btn-sm" style={{ marginTop: 6 }} onClick={() => setShowTermos(false)}>Voltar</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS Sales Solutions" style={{ width: 220, margin: "0 auto 14px" }} />
          <p className="vx-mut" style={{ fontSize: 14, marginTop: 6 }}>
            {modo === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <div className="vx-card" style={{ padding: 22 }}>
          <form onSubmit={submit}>
            {modo === "registro" && (
              <>
                <Campo label="Seu nome">
                  <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você quer ser chamado" required />
                </Campo>
                <Campo label="Tipo de conta">
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["vendedor", "Profissional"], ["empresa", "Empresa"]].map(([k, t]) => (
                      <button key={k} type="button" className="vx-btn" style={{
                        flex: 1, borderColor: role === k ? "var(--brand)" : undefined,
                        background: role === k ? "var(--brand-50)" : undefined,
                        color: role === k ? "var(--brand)" : undefined,
                      }} onClick={() => setRole(k)}>{t}</button>
                    ))}
                  </div>
                </Campo>
              </>
            )}
            <Campo label="E-mail">
              <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
            </Campo>
            <Campo label="Senha">
              <input className="vx-input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
            </Campo>

            {modo === "registro" && (
              <Campo label="Código de indicação (opcional)">
                <input className="vx-input vx-mono" value={indicacao} placeholder="Ex.: SXMD9JG"
                  onChange={(e) => setIndicacao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                  style={{ letterSpacing: ".08em" }} />
              </Campo>
            )}

            {modo === "registro" && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "12px 0", cursor: "pointer", fontSize: 12.5, color: "var(--text-2)" }}>
                <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                  Li e aceito os{" "}
                  <button type="button" onClick={() => setShowTermos(true)} style={{ color: "var(--brand)", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit" }}>
                    Termos de Uso e Política de Privacidade
                  </button>
                </span>
              </label>
            )}

            <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading || (modo === "registro" && !aceitouTermos)} style={{ marginTop: 8 }}>
              {loading ? "Carregando…" : modo === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          {modo === "login" && (
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowForgot(true)} style={{ width: "100%", marginTop: 8, fontSize: 12.5 }}>
              Esqueci minha senha
            </button>
          )}

          <hr className="vx-sep" />

          <div style={{ textAlign: "center" }}>
            {modo === "login" ? (
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setModo("registro")}>
                Não tem conta? Crie aqui
              </button>
            ) : (
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setModo("login")}>
                Já tem conta? Entre aqui
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
