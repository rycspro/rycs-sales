import { useState } from "react";
import { CampoSenha } from "./ui.jsx";

// Modal de reautenticação para operações financeiras sensíveis (troca de Pix,
// saque). Segue o White Editorial da RYCS, azul #318CE7. A senha nunca é
// registrada em log/analytics — fica só no estado local e vai no corpo da
// requisição por HTTPS.
const AZUL = "#318CE7";

export default function ModalConfirmarSenha({ aberto, titulo = "Confirme sua senha", descricao, erro, carregando, onConfirmar, onFechar }) {
  const [senha, setSenha] = useState("");
  if (!aberto) return null;

  const confirmar = (e) => {
    e?.preventDefault();
    if (!senha || carregando) return;
    onConfirmar(senha);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !carregando) { setSenha(""); onFechar?.(); } }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={confirmar} className="vx-fade"
        style={{ width: "100%", maxWidth: 380, background: "var(--surface-solid)", border: "1px solid var(--border-strong)", borderRadius: 14, padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: AZUL, marginBottom: 8 }}>Verificação de segurança</div>
        <h2 className="vx-disp" style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>{titulo}</h2>
        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
          {descricao || "Para sua segurança, confirme a senha da sua conta para continuar."}
        </p>

        <label className="vx-label" htmlFor="reauth-senha" style={{ display: "block", marginBottom: 6 }}>Senha</label>
        <CampoSenha id="reauth-senha" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" autoComplete="current-password" />

        {erro && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: "var(--danger,#DC2626)" }}>{erro}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" onClick={() => { setSenha(""); onFechar?.(); }} disabled={carregando}
            style={{ flex: 1, background: "var(--surface-solid)", border: "1px solid var(--border-strong)", color: "var(--ink)", borderRadius: 10, padding: "11px 16px", fontWeight: 600, fontSize: 14, cursor: carregando ? "default" : "pointer", minHeight: 44 }}>
            Cancelar
          </button>
          <button type="submit" disabled={!senha || carregando}
            onMouseEnter={(e) => { if (senha && !carregando) e.currentTarget.style.background = "#2b7cd0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = senha ? AZUL : "var(--surface-3)"; }}
            style={{ flex: 1, background: senha && !carregando ? AZUL : "var(--surface-3)", color: senha && !carregando ? "#fff" : "var(--muted-2)", border: "none", borderRadius: 10, padding: "11px 16px", fontWeight: 600, fontSize: 14, cursor: !senha || carregando ? "not-allowed" : "pointer", minHeight: 44 }}>
            {carregando ? "Confirmando…" : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}
