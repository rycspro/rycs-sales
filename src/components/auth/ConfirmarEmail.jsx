import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import MolduraAuth from "./MolduraAuth.jsx";
import { api } from "../../lib/api.js";
import { ROTAS, navegar } from "../../lib/rotas.js";

// Tela intermediária para /confirmar-email/:token.
// Chama o servidor, obtém o usuário logado e repassa via onLogin para App.jsx.

export default function ConfirmarEmail({ token, onLogin }) {
  const [estado, setEstado] = useState("verificando"); // verificando | ok | erro | expirado
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setEstado("erro"); setMsg("Link inválido."); return; }
    api(`/auth/confirmar-email/${encodeURIComponent(token)}`)
      .then((r) => {
        if (r?.ok && r.id) {
          setEstado("ok");
          // Dá tempo do cookie assentar antes de recarregar.
          setTimeout(() => onLogin(r), 800);
        } else if (r?.error) {
          if (r.error.toLowerCase().includes("expirado")) setEstado("expirado");
          else if (r.error.toLowerCase().includes("confirmado")) {
            // Já confirmado — vai para login.
            setEstado("ok");
            setTimeout(() => navegar(ROTAS.login), 1200);
          } else {
            setEstado("erro");
            setMsg(r.error);
          }
        } else {
          setEstado("erro");
          setMsg("Não foi possível confirmar. Tente de novo.");
        }
      })
      .catch(() => { setEstado("erro"); setMsg("Erro de conexão."); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const icones = {
    ok: <CheckCircle size={32} strokeWidth={1.8} color="#22c55e" aria-hidden="true" />,
    erro: <XCircle size={32} strokeWidth={1.8} color="var(--danger,#ef4444)" aria-hidden="true" />,
    expirado: <XCircle size={32} strokeWidth={1.8} color="var(--warning,#f59e0b)" aria-hidden="true" />,
  };

  const titulos = {
    verificando: "Confirmando seu e-mail…",
    ok: "E-mail confirmado!",
    erro: "Link inválido",
    expirado: "Link expirado",
  };

  const subtitulos = {
    verificando: "Aguarde um momento.",
    ok: "Entrando na plataforma…",
    erro: msg || "Este link não é válido.",
    expirado: "O link expirou. Faça login e solicite um novo.",
  };

  return (
    <MolduraAuth tarja="Empresa" titulo={titulos[estado]} subtitulo={subtitulos[estado]}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "16px 0" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: estado === "ok" ? "#f0fdf4" : estado === "verificando" ? "var(--brand-50)" : "#fef2f2",
          display: "grid", placeItems: "center",
        }}>
          {estado === "verificando"
            ? <Loader size={32} strokeWidth={1.8} color="var(--brand)" style={{ animation: "spin 1s linear infinite" }} aria-hidden="true" />
            : icones[estado]
          }
        </div>
        {(estado === "erro" || estado === "expirado") && (
          <button
            className="vx-btn vx-btn-primary"
            style={{ minHeight: 48 }}
            onClick={() => navegar(ROTAS.login)}
          >
            Ir para o login
          </button>
        )}
      </div>
    </MolduraAuth>
  );
}
