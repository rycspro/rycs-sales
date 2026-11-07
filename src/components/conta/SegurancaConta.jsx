import { useEffect, useState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api.js";

// Segurança da conta. Não há endpoint de troca de senha com sessão ativa — o
// fluxo real do app é por link de redefinição (/auth/forgot-password envia o
// e-mail, /auth/reset-password conclui com o token). Esta tela usa exatamente
// esse caminho: busca o e-mail da sessão e dispara o envio do link.

export default function SegurancaConta({ aviso }) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    let vivo = true;
    api("/auth/me").then((r) => { if (vivo && r?.email) setEmail(r.email); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const enviarLink = async () => {
    if (!email || enviando) return;
    setEnviando(true);
    const r = await api("/auth/forgot-password", { email });
    setEnviando(false);
    if (r?.error) return aviso?.(r.error);
    setEnviado(true);
    aviso?.("Enviamos um link de redefinição para o seu e-mail.");
  };

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><ShieldCheck size={22} /> Segurança</h1>
          <p>Proteja o acesso à sua conta.</p>
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="vx-icon-box"><Mail size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 14 }}>E-mail de acesso</strong>
            <span className="vx-mut" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{email || "—"}</span>
          </div>
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span className="vx-icon-box"><KeyRound size={18} /></span>
          <div>
            <strong style={{ display: "block", fontSize: 14 }}>Senha</strong>
            <span className="vx-mut" style={{ fontSize: 13 }}>Enviamos um link seguro para você criar uma nova senha.</span>
          </div>
        </div>
        <button className="vx-btn vx-btn-primary" onClick={enviarLink} disabled={!email || enviando}>
          {enviando ? "Enviando…" : enviado ? "Reenviar link de redefinição" : "Redefinir senha por e-mail"}
        </button>
        {enviado && (
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 10 }}>
            Se o e-mail existir, o link chega em instantes. Ele vale por 1 hora.
          </p>
        )}
      </div>
    </div>
  );
}
