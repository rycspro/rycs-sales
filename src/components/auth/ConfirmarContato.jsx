import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Shield, Loader } from "lucide-react";
import { api } from "../../lib/api.js";

export default function ConfirmarContato({ token }) {
  const [estado, setEstado] = useState("carregando"); // carregando, pendente, confirmado, recusado, expirado, erro
  const [dados, setDados] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api(`/confirmar/${encodeURIComponent(token)}`, null, "GET").then((r) => {
      if (r?.error || r?.expirado) {
        setEstado(r.expirado ? "expirado" : "erro");
        setDados(r);
      } else if (r?.jaRespondido) {
        setEstado(r.confirmado ? "confirmado" : "recusado");
        setDados(r);
      } else {
        setEstado("pendente");
        setDados(r);
      }
    }).catch(() => setEstado("erro"));
  }, [token]);

  const responder = async (confirmado) => {
    setEnviando(true);
    const r = await api(`/confirmar/${encodeURIComponent(token)}`, { confirmado });
    setEnviando(false);
    if (r && !r.error) {
      setEstado(confirmado ? "confirmado" : "recusado");
    } else {
      setEstado("erro");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg, #f8f9fa)" }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
        <div style={{ marginBottom: 20 }}>
          <Shield size={40} color="var(--brand, #6366f1)" />
        </div>

        {estado === "carregando" && (
          <div>
            <Loader size={24} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: 12, color: "#666" }}>Verificando...</p>
          </div>
        )}

        {estado === "pendente" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Confirmação de contato</h2>
            <p style={{ color: "#555", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              {dados?.campanha || "Uma empresa"} gostaria de confirmar o contato com você.
              {dados?.profissional && <><br/>Profissional: <b>{dados.profissional}</b></>}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button disabled={enviando} onClick={() => responder(true)} style={{
                padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14,
                background: "#16a34a", color: "#fff", border: "none", cursor: "pointer",
                opacity: enviando ? 0.6 : 1,
              }}>
                <CheckCircle size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                Confirmo o contato
              </button>
              <button disabled={enviando} onClick={() => responder(false)} style={{
                padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14,
                background: "#f1f5f9", color: "#555", border: "1px solid #e2e8f0", cursor: "pointer",
                opacity: enviando ? 0.6 : 1,
              }}>
                Não confirmo
              </button>
            </div>
            <p style={{ marginTop: 20, fontSize: 11, color: "#999" }}>
              Este link expira em {dados?.expiraEm || "24 horas"}.
            </p>
          </div>
        )}

        {estado === "confirmado" && (
          <div>
            <CheckCircle size={48} color="#16a34a" />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12, color: "#16a34a" }}>Contato confirmado!</h2>
            <p style={{ color: "#555", fontSize: 14, marginTop: 8 }}>Obrigado pela confirmação. Você pode fechar esta página.</p>
          </div>
        )}

        {estado === "recusado" && (
          <div>
            <XCircle size={48} color="#ef4444" />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Contato não confirmado</h2>
            <p style={{ color: "#555", fontSize: 14, marginTop: 8 }}>Registramos que o contato não foi confirmado. Você pode fechar esta página.</p>
          </div>
        )}

        {estado === "expirado" && (
          <div>
            <XCircle size={48} color="#f59e0b" />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12, color: "#f59e0b" }}>Link expirado</h2>
            <p style={{ color: "#555", fontSize: 14, marginTop: 8 }}>Este link de confirmação expirou. Solicite um novo ao profissional.</p>
          </div>
        )}

        {estado === "erro" && (
          <div>
            <XCircle size={48} color="#ef4444" />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Erro</h2>
            <p style={{ color: "#555", fontSize: 14, marginTop: 8 }}>Não foi possível processar a confirmação. O link pode ser inválido.</p>
          </div>
        )}

        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
          <p style={{ fontSize: 11, color: "#aaa" }}>RYCS · Plataforma de vendas</p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
