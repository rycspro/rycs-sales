import { useState } from "react";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Campo } from "./ui.jsx";
import { api } from "../lib/api.js";
import { useI18n } from "../lib/i18n.jsx";

// Entrada da plataforma, separada do login comum e em endereço próprio.
// Exige a chave de segurança além da senha: quem opera aqui aprova saques e
// enxerga todas as empresas.
export default function LoginPlataforma({ onEntrar }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [verChave, setVerChave] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const r = await api("/auth/admin/login", { email, senha, chave });
    setCarregando(false);
    if (!r || r.error) return setErro(r?.error || t("adminLogin.failed"));
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
          <div className="vx-disp" style={{ fontSize: 21 }}>{t("adminLogin.title")}</div>
          <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 6 }}>
            {t("adminLogin.subtitle")}
          </p>
        </div>

        <div className="vx-card" style={{ padding: 22 }}>
          <form onSubmit={entrar}>
            <Campo label="E-mail">
              <input className="vx-input" type="email" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)} required />
            </Campo>
            <Campo label={t("adminLogin.password")}>
              <div style={{ position: "relative" }}>
                <input className="vx-input" type={verSenha ? "text" : "password"} value={senha}
                  autoComplete="new-password" onChange={(e) => setSenha(e.target.value)}
                  required style={{ paddingRight: 38 }} />
                <button type="button" onClick={() => setVerSenha(v => !v)} style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-2)", padding: 2,
                }}>
                  {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Campo>
            <Campo label={t("adminLogin.securityKey")}>
              <div style={{ position: "relative" }}>
                <input className="vx-input vx-mono" type={verChave ? "text" : "password"} value={chave}
                  autoComplete="off" onChange={(e) => setChave(e.target.value)}
                  required style={{ paddingRight: 38 }} />
                <button type="button" onClick={() => setVerChave(v => !v)} style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-2)", padding: 2,
                }}>
                  {verChave ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Campo>

            {erro && (
              <div style={{
                background: "var(--red-50)", border: "1px solid var(--red-100)", color: "var(--red)",
                padding: "10px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12,
              }}>{erro}</div>
            )}

            <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={carregando}>
              {carregando ? t("adminLogin.verifying") : t("adminLogin.enter")}
            </button>
          </form>
        </div>

        <p className="vx-mut" style={{ fontSize: 12, textAlign: "center", marginTop: 14 }}>
          {t("adminLogin.mainPageNote")} <a href="/" style={{ color: "var(--brand)" }}>{t("adminLogin.mainPage")}</a>.
        </p>
      </div>
    </div>
  );
}
