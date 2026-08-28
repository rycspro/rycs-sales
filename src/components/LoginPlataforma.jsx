import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Campo } from "./ui.jsx";
import { api } from "../lib/api.js";

// Entrada da plataforma, separada do login comum e em endereço próprio.
// Exige a chave de segurança além da senha: quem opera aqui aprova saques e
// enxerga todas as empresas.
export default function LoginPlataforma({ onEntrar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const r = await api("/auth/admin/login", { email, senha, chave });
    setCarregando(false);
    if (!r || r.error) return setErro(r?.error || "Não foi possível entrar.");
    onEntrar(r);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, background: "var(--brand-50)", border: "1px solid var(--brand-100)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
          }}>
            <ShieldCheck size={22} color="var(--brand)" strokeWidth={2.2} />
          </div>
          <div className="vx-disp" style={{ fontSize: 21 }}>Plataforma RYCS</div>
          <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 6 }}>
            Acesso restrito à administração.
          </p>
        </div>

        <div className="vx-card" style={{ padding: 22 }}>
          <form onSubmit={entrar}>
            <Campo label="E-mail">
              <input className="vx-input" type="email" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)} required />
            </Campo>
            <Campo label="Senha">
              <input className="vx-input" type="password" value={senha} autoComplete="current-password"
                onChange={(e) => setSenha(e.target.value)} required />
            </Campo>
            <Campo label="Chave de segurança">
              <input className="vx-input vx-mono" type="password" value={chave} autoComplete="off"
                onChange={(e) => setChave(e.target.value)} required />
            </Campo>

            {erro && (
              <div style={{
                background: "var(--red-50)", border: "1px solid var(--red-100)", color: "var(--red)",
                padding: "10px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12,
              }}>{erro}</div>
            )}

            <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={carregando}>
              {carregando ? "Verificando…" : "Entrar na plataforma"}
            </button>
          </form>
        </div>

        <p className="vx-mut" style={{ fontSize: 12, textAlign: "center", marginTop: 14 }}>
          Empresas e profissionais entram pela <a href="/" style={{ color: "var(--brand)" }}>página principal</a>.
        </p>
      </div>
    </div>
  );
}
