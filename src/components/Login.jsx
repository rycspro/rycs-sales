import { useState } from "react";
import { Campo } from "./ui.jsx";

export default function Login({ onLogin, onRegister }) {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState("vendedor");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (modo === "login") {
      await onLogin(email, senha);
    } else {
      await onRegister({ email, senha, role, nome });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="vx-mark" style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy)" }}>
            <span style={{ color: "var(--brand)", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 24 }}>R</span>
          </div>
          <div className="vx-disp" style={{ fontSize: 26 }}>RYCS</div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginTop: 2 }}>Sales Solutions</div>
          <p className="vx-mut" style={{ fontSize: 14, marginTop: 6 }}>
            {modo === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <div className="vx-card" style={{ padding: 22 }}>
          <form onSubmit={submit}>
            {modo === "registro" && (
              <>
                <Campo label="Seu nome">
                  <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você quer ser chamado" />
                </Campo>
                <Campo label="Tipo de conta">
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["vendedor", "Vendedor"], ["empresa", "Empresa"]].map(([k, t]) => (
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
            <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? "Carregando…" : modo === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

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

        {modo === "login" && (
          <div className="vx-card" style={{ padding: 16, marginTop: 14, background: "var(--surface-2)", border: "none" }}>
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Contas de demonstração</div>
            {[
              ["rafa@email.com", "123456", "Vendedor"],
              ["nexo@email.com", "123456", "Empresa"],
              ["admin@email.com", "123456", "Plataforma"],
            ].map(([e, s, label]) => (
              <button key={e} className="vx-btn vx-btn-sm vx-btn-block" style={{ marginBottom: 6, justifyContent: "space-between" }}
                onClick={() => { setEmail(e); setSenha(s); }}>
                <span className="vx-mono" style={{ fontSize: 12 }}>{e}</span>
                <span className="vx-badge vx-badge-muted">{label}</span>
              </button>
            ))}
            <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>Senha: 123456</div>
          </div>
        )}
      </div>
    </div>
  );
}
